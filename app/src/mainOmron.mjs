//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2021.11.11
//////////////////////////////////////////////////////////////////////
/**
 * @module mainOmron
 */

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { store } from './storeSingleton.mjs';
import omron from 'usb-2jcie-bu';
import cron from 'node-cron';
import localDB from './models/localDBModels.mjs';   // DBデータと連携
const { Sequelize, Op, roomEnvModel } = localDB;
import { objectSort, getNow, formatDate, getTodayDate, getYesterdayDate, getToday, isObjEmpty, mergeDeeply } from './mainSubmodule.mjs';
import { logger } from './logger.mjs';

/**
 * @typedef {Object} OmronConfig
 * @property {boolean} enabled 機能有効
 * @property {boolean} debug デバッグログ
 * @property {string} place 記録先の場所名
 */
/**
 * @typedef {Object.<string, any>} OmronPersist
 * @property {string} [time]
 * @property {number} [temperature]
 * @property {number} [humidity]
 * @property {number} [anbient_light]
 * @property {number} [pressure]
 * @property {number} [noise]
 * @property {number} [etvoc]
 * @property {number} [eco2]
 * @property {number} [discomfort_index]
 * @property {number} [heat_stroke]
 */
/**
 * @callback SendIPCMessage
 * @param {string} channel
 * @param {any} payload
 */

let sendIPCMessage = null;
// const store = new Store();

/** @type {OmronConfig} */
let config = {
	enabled: false,
	debug: false,
	place: 'Room'
};

/** @type {OmronPersist} */
let persist = {};

//////////////////////////////////////////////////////////////////////
// mainOmron
let mainOmron = {
	isRun: false,
	/** @type {cron.ScheduledTask|null} */
	observationJob: null,
	/** @type {cron.ScheduledTask|null} */
	storeJob: null,

	//////////////////////////////////////////////////////////////////////
	//
	/**
	 * Omronセンサの処理開始。重複起動時はpersist/configをUIへ再送。
	 * @param {SendIPCMessage} _sendIPCMessage
	 */
	start: function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		if (mainOmron.isRun) {  // 重複起動対策
			sendIPCMessage("renewOmronConfigView", config);
			sendIPCMessage("renewOmron", persist);
			mainOmron.sendTodayRoomEnv();		// 現在のデータを送っておく
			return;
		}

		config.enabled = store.get('config.Omron.enabled', config.enabled);
		config.place = store.get('config.Omron.place', config.place);
		config.debug = store.get('config.Omron.debug', config.debug);
		persist = store.get('persist.Omron', persist);
		sendIPCMessage("renewOmronConfigView", config);

		if (config.enabled == false) {
			logger.debug('mainOmron', config.debug, 'start() Omron is disabled.');
			mainOmron.isRun = false;
			return;
		}
		mainOmron.isRun = true;


		logger.debug('mainOmron', config.debug, 'start()');

		try {
			omron.start((sensorData, error) => {
				if (error) {
					switch (error) {
						case 'INF: port is closed.':  // ポート閉じたというのはエラーというか、正常状態でもある
							sendIPCMessage('omronDisconnected', null);
							break;

						case 'Error: recvData is nothing.': // recvDataがないというのはよく発生する
							logger.debug('mainOmron', config.debug, 'omron.start() callback error:', error);
							break;

						case 'Error: usb-2jcie-bu.requestData(): port is not found.':  // portがないというのもよくある
							logger.debug('mainOmron', config.debug, 'omron.start() callback error:', error);
							break;

						default:
							// それ以外のエラーは良く知らないのでエラーとして出す
							logger.error('mainOmron', 'omron.start() error:', error);
					}
					return;
				}
				logger.debug('mainOmron', config.debug, 'start() sensorData:', sensorData);

				persist = sensorData;
				persist.time = getNow();
				sendIPCMessage("renewOmron", persist);
			}, { debug: config.debug });

			// 3秒毎にセンサの値チェック、画面表示は3秒毎にするが、DBへの記録は1分毎とする
			mainOmron.observationJob = cron.schedule('*/3 * * * * *', () => {
				try {
					omron.requestData();
				} catch (error) {
					logger.error('mainOmron', 'omron.requestData() error:', error);
				}
			});
			mainOmron.observationJob.start();
		} catch (error) {
			logger.error('mainOmron', 'start() outer error:', error);
		}

		// 3秒毎にセンサの値チェック、画面表示は3秒毎にするが、DBへの記録は1分毎とする
		mainOmron.storeJob = cron.schedule('*/3 * * * *', async () => {
			try {
				logger.debug('mainOmron', config.debug, 'cron.schedule() every 3min');

				let dt = new Date();

				//------------------------------------------------------------
				// 部屋の環境を記録、Omron
				if (config.enabled && !isObjEmpty(persist)) {
					let n = persist;
					if (n) {
						await roomEnvModel.create({
							dateTime: dt,
							srcType: 'omron',
							place: config.place ? config.place : 'MyRoom',
							temperature: n.temperature,
							humidity: n.humidity,
							anbientLight: n.anbient_light, // light -> anbientLight
							pressure: n.pressure,
							noise: n.noise,
							TVOC: n.etvoc,
							CO2: n.eco2,
							discomfortIndex: n.discomfort_index,
							heatStroke: n.heat_stroke
						});
					}
				} else {
					logger.debug('mainOmron', config.debug, 'cron.schedule() persist is empty or disabled:', persist);
				}

				mainOmron.sendTodayRoomEnv(); 		// 本日のデータの定期的送信
			} catch (error) {
				logger.error('mainOmron', 'cron.schedule() each 3min, error:', error);
			}
		});

		sendIPCMessage("renewOmron", persist);
		mainOmron.sendTodayRoomEnv();		// 現在のデータを送っておく
		mainOmron.storeJob.start();
	},

	/**
	 * 設定/persist保存して停止。
	 * @returns {Promise<void>}
	 */
	stop: async function () {
		mainOmron.isRun = false;
		logger.debug('mainOmron', config.debug, 'stop()');

		if (mainOmron.observationJob) {  // センサ監視ジョブ
			await mainOmron.observationJob.stop();
			mainOmron.observationJob = null;
		}

		if (mainOmron.storeJob) {  // DB保存ジョブ
			await mainOmron.storeJob.stop();
			mainOmron.storeJob = null;
		}

		await mainOmron.setConfig(config);
		await store.set('persist.Omron', persist);
		await omron.stop();
	},

	/**
	 * 保存せず停止。
	 * @returns {Promise<void>}
	 */
	stopWithoutSave: async function () {
		mainOmron.isRun = false;
		logger.debug('mainOmron', config.debug, 'stopWithoutSave()');

		if (mainOmron.observationJob) {  // センサ監視ジョブ
			await mainOmron.observationJob.stop();
			mainOmron.observationJob = null;
		}

		if (mainOmron.storeJob) {  // DB保存ジョブ
			await mainOmron.storeJob.stop();
			mainOmron.storeJob = null;
		}

		await omron.stop();
	},

	/**
	 * 設定をマージ保存しUIへ通知。
	 * @param {Partial<OmronConfig>} [_config]
	 */
	setConfig: async function (_config) {
		if (_config) {
			config = mergeDeeply(config, _config);
		}
		await store.set('config.Omron', config);

		sendIPCMessage("renewOmronConfigView", config);
		sendIPCMessage("configSaved", 'Omron');// 保存したので画面に通知
	},

	/**
	 * 現在設定の取得。
	 * @returns {OmronConfig}
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * 現在persistの取得。
	 * @returns {OmronPersist}
	 */
	getPersist: function () {
		return persist;
	},


	//////////////////////////////////////////////////////////////////////
	// inner functions

	/**
	 * @func getCases
	 * @desc getCases
	 * @async
	 * @param {Date}  date
	 * @return {string} when clause
	 * @throw error
	 */
	/*
   getCases
   input
	   date: Date="2023-01-06"

   output
	   when createdAt >= "2023-01-05 23:57" and createdAt < "2023-01-06 00:00" then "00:00"
	   when createdAt >= "2023-01-06 00:00" and createdAt < "2023-01-06 00:03" then "00:03"
	   when createdAt >= "2023-01-06 00:03" and createdAt < "2023-01-06 00:06" then "00:06"
	   ...
	   when createdAt >= "2023-01-06 23:54" and createdAt < "2023-01-06 23:57" then "23:57"
	   else "24:00"
   */
	getCases: function (date) {
		let T1 = new Date(date);
		let T2 = new Date(date);
		let T3 = new Date(date);
		let T4 = new Date(date);

		// UTCだがStringにて表現しているので、なんか複雑
		T1.setHours(T1.getHours() - T1.getHours() - 10, 57, 0, 0); // 前日の14時57分xx秒   14:57:00 .. 15:00:00 --> 00:00
		T2.setHours(T1.getHours() - T1.getHours() - 10, 58, 0, 0); // T1 + 1min
		T3.setHours(T1.getHours() - T1.getHours() - 10, 59, 0, 0); // T1 + 2min
		T4.setHours(T1.getHours() - T1.getHours(), 0, 0, 0); // 集約先

		let ret = "";
		for (let t = 0; t < 480; t += 1) {  // 24h * 20 times (= 60min / 3min)
			ret += `WHEN "createdAt" LIKE "${formatDate(T1, 'YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${formatDate(T2, 'YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${formatDate(T3, 'YYYY-MM-DD HH24:MI')}%" THEN "${formatDate(T4, 'HH24:MI')}" \n`;

			T1.setMinutes(T1.getMinutes() + 3); // + 3 min
			T2.setMinutes(T2.getMinutes() + 3); // + 3 min
			T3.setMinutes(T3.getMinutes() + 3); // + 3 min
			T4.setMinutes(T4.getMinutes() + 3); // + 3 min
		}
		return ret + 'ELSE "24:00"';
	},

	/**
	 * @func getRows
	 * @desc getRows
	 * @async
	 * @return {Array} rows
	 * @throw error
	 */
	// DBからテーブル取得
	getRows: async function () {
		try {
			let now = new Date();  // 現在
			let begin = new Date(now);  // 現在時刻UTCで取得
			begin.setHours(begin.getHours() - begin.getHours() - 1, 57, 0, 0); // 前日の23時57分０秒にする
			let end = new Date(begin);  // 現在時刻UTCで取得
			end.setHours(begin.getHours() + 25, 0, 0, 0); // 次の日の00:00:00にする
			let cases = mainOmron.getCases(now);

			let subQuery = `CASE ${cases} END`;

			// 3分毎データ
			let rows = await roomEnvModel.findAll({
				attributes: ['id',
					[Sequelize.fn('AVG', Sequelize.col('temperature')), 'avgTemperature'],
					[Sequelize.fn('AVG', Sequelize.col('humidity')), 'avgHumidity'],
					[Sequelize.fn('AVG', Sequelize.col('anbientLight')), 'avgAnbientLight'],
					[Sequelize.fn('AVG', Sequelize.col('pressure')), 'avgPressure'],
					[Sequelize.fn('AVG', Sequelize.col('noise')), 'avgNoise'],
					[Sequelize.fn('AVG', Sequelize.col('TVOC')), 'avgTVOC'],
					[Sequelize.fn('AVG', Sequelize.col('CO2')), 'avgCO2'],
					[Sequelize.fn('AVG', Sequelize.col('discomfortIndex')), 'avgDiscomfortIndex'],
					[Sequelize.fn('AVG', Sequelize.col('heatStroke')), 'avgHeatStroke'],
					'createdAt',
					[Sequelize.literal(subQuery), 'timeunit']
				],
				where: {
					srcType: 'omron',
					dateTime: { [Op.between]: [begin.toISOString(), end.toISOString()] }
				},
				group: ['timeunit']
			});

			return rows;
		} catch (error) {
			logger.error('mainOmron', 'getRows()', error);
			return []; // エラー時は空配列を返す
		}
	},

	/**
	 * @func getTodayRoomEnv
	 * @desc getTodayRoomEnv
	 * @async
	 * @return {Array} rows
	 * @throw error
	 */
	getTodayRoomEnv: async function () {
		// 画面に今日のデータを送信するためのデータ作る
		try {
			let rows = (await mainOmron.getRows()) || [];

			let T1 = new Date();
			T1.setHours(0, 0, 0);
			let array = [];
			for (let t = 0; t < 480; t += 1) {
				let row = rows.find((row) => row.dataValues.timeunit == formatDate(T1, 'HH24:MI'));

				if (row) {
					array.push({
						id: t,
						time: T1.toISOString(),
						srcType: 'omron',
						temperature: row.dataValues.avgTemperature,
						humidity: row.dataValues.avgHumidity,
						anbientLight: row.dataValues.avgAnbientLight,
						pressure: row.dataValues.avgPressure,
						noise: row.dataValues.avgNoise,
						TVOC: row.dataValues.avgTVOC,
						CO2: row.dataValues.avgCO2,
						discomfortIndex: row.dataValues.avgDiscomfortIndex,
						heatStroke: row.dataValues.avgHeatStroke
					});
				} else {
					array.push({
						id: t,
						time: T1.toISOString(),
						srcType: 'omron',
						temperature: null,
						humidity: null,
						anbientLight: null,
						pressure: null,
						noise: null,
						TVOC: null,
						CO2: null,
						discomfortIndex: null,
						heatStroke: null
					});
				}

				T1.setMinutes(T1.getMinutes() + 3); // + 3 min
			}

			return array;
		} catch (error) {
			logger.error('mainOmron', 'getTodayRoomEnv()', error);
		}
	},

	/**
	 * @func sendTodayRoomEnv
	 * @desc 画面更新
	 * @async
	 * @throw error
	 */
	sendTodayRoomEnv: async function () {
		let arg = {};

		if (config.enabled) {
			arg = await mainOmron.getTodayRoomEnv();
			sendIPCMessage('renewRoomEnvOmron', JSON.stringify(arg));
		} else {
			logger.debug('mainOmron', config.debug, 'sendTodayRoomEnv() config.enabled is false');
		}
	}
};


// module.exports = mainOmron;
export { mainOmron };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
