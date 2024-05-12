//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2021.11.11
//////////////////////////////////////////////////////////////////////
/**
 * @module mainOmron
 */
// 'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
// const Store = require('electron-store');
import Store from 'electron-store';
// const omron = require('usb-2jcie-bu');
import omron from 'usb-2jcie-bu';
// const cron = require('node-cron');
import cron from 'node-cron';
// require('date-utils'); // for log
import * as dateUtils from 'date-utils';
// const { Sequelize, Op, roomEnvModel } = require('./models/localDBModels');   // DBデータと連携
import { Sequelize, Op, roomEnvModel } from './models/localDBModels.cjs';   // DBデータと連携
// const { mergeDeeply } = require('./mainSubmodule');
import { mergeDeeply } from './mainSubmodule.cjs';

let sendIPCMessage = null;
const store = new Store();

let config = {
	enabled: false,
	debug: false,
	place: 'Room'
};

let persist = {};

//////////////////////////////////////////////////////////////////////
// mainOmron
let mainOmron = {
	isRun: false,
	observationJob: null,
	storeJob: null,

	//////////////////////////////////////////////////////////////////////
	//
	/**
	 * @func start
	 * @desc Omronセンサの処理開始
	 * @param {Function} _sendIPCMessage
	 * @throw error
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
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.start() Omron is disabled.') : 0;
			mainOmron.isRun = false;
			return;
		}
		mainOmron.isRun = true;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.start()') : 0;

		try {
			omron.start((sensorData, error) => {
				if (error) {
					switch (error) {
						case 'INF: port is closed.':  // ポート閉じたというのはエラーというか、正常状態でもある
							sendIPCMessage('omronDisconnected', null);
							break;

						case 'Error: recvData is nothing.': // recvDataがないというのはよく発生する
							config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.omron.start() callback', '\x1b[32m', error, '\x1b[0m') : 0;
							break;

						case 'Error: usb-2jcie-bu.requestData(): port is not found.':  // portがないというのもよくある
							config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.omron.start() callback', '\x1b[32m', error, '\x1b[0m') : 0;
							break;

						default:
							// それ以外のエラーは良く知らないのでエラーとして出す
							console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.omron.start()', error);
					}
					return;
				}
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.start() sensorData:', '\x1b[32m', sensorData, '\x1b[0m') : 0;

				persist = sensorData;
				persist.time = new Date().toFormat("YYYY-MM-DD HH24:MI:SS");
				sendIPCMessage("renewOmron", persist);
			}, { debug: config.debug });

			// 3秒毎にセンサの値チェック、画面表示は3秒毎にするが、DBへの記録は1分毎とする
			mainOmron.observationJob = cron.schedule('*/3 * * * * *', () => {
				omron.requestData();
			});
			mainOmron.observationJob.start();
		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.start().start()', error);
		}

		// 3秒毎にセンサの値チェック、画面表示は3秒毎にするが、DBへの記録は1分毎とする
		mainOmron.storeJob = cron.schedule('*/3 * * * *', async () => {
			try {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.cron.schedule() every 3min') : 0;

				let dt = new Date();

				//------------------------------------------------------------
				// 部屋の環境を記録、Omron
				if (config.enabled && persist.length != 0) {
					// config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.cron.schedule() Store Omron'):0;
					let n = persist;
					if (n) {
						roomEnvModel.create({
							dateTime: dt,
							srcType: 'omron',
							place: config.place ? config.place : 'MyRoom',
							temperature: n.temperature,
							humidity: n.humidity,
							anbientLight: n.anbient_light,
							pressure: n.pressure,
							noise: n.noise,
							TVOC: n.etvoc,
							CO2: n.eco2,
							discomfortIndex: n.discomfort_index,
							heatStroke: n.heat_stroke
						});
					}
				} else {
					config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.cron.schedule() persist:', persist) : 0;
				}

				mainOmron.sendTodayRoomEnv(); 		// 本日のデータの定期的送信
			} catch (error) {
				console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.cron.schedule() each 3min, error:', error);
			}
		});

		sendIPCMessage("renewOmron", persist);
		mainOmron.sendTodayRoomEnv();		// 現在のデータを送っておく
		mainOmron.storeJob.start();
	},

	/**
	 * @func stop
	 * @desc stop
	 * @async
	 * @throw error
	 */
	stop: async function () {
		mainOmron.isRun = false;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.stop()') : 0;

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
	 * @func stopWithoutSave
	 * @desc stopWithoutSave
	 * @async
	 * @throw error
	 */
	stopWithoutSave: async function () {
		mainOmron.isRun = false;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.stopWithoutSave()') : 0;

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
	 * @func setConfig
	 * @desc setConfig
	 * @async
	 * @param {Object} _config - nullable
	 * @throw error
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
	 * @func getConfig
	 * @desc getConfig
	 * @async
	 * @return {Object} config
	 * @throw error
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * @func getPersist
	 * @desc getPersist
	 * @async
	 * @return {Object} persist
	 * @throw error
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
			// console.log( T1.toISOString(), ':', T1.toFormat('YYYY-MM-DD HH24:MI'), ', ', T4.toFormat('HH24:MI') );

			ret += `WHEN "createdAt" LIKE "${T1.toFormat('YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${T2.toFormat('YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${T3.toFormat('YYYY-MM-DD HH24:MI')}%" THEN "${T4.toFormat('HH24:MI')}" \n`;

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
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.getTodayRoomEnvOmron()', error);
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
			let rows = await mainOmron.getRows();

			let T1 = new Date();
			T1.setHours(0, 0, 0);
			let array = [];
			for (let t = 0; t < 480; t += 1) {
				let row = rows.find((row) => row.dataValues.timeunit == T1.toFormat('HH24:MI'));

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
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.getTodayRoomEnvOmron()', error);
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
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.sendTodayRoomEnv() config.enabled:', config.enabled);
		}
	}
};


// module.exports = mainOmron;
export {mainOmron};
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
