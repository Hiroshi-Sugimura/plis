//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2023.08.26
//////////////////////////////////////////////////////////////////////
/**
 * @module mainCo2s
 */
// 'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { store } from './storeSingleton.mjs';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import co2s from 'usb-ud-co2s';
import cron from 'node-cron';
import localDB from './models/localDBModels.mjs';   // DBデータと連携
const { Sequelize, Op, roomEnvModel } = localDB;
import { objectSort, getNow, formatDate, getTodayDate, getYesterdayDate, getToday, isObjEmpty, mergeDeeply, getCases } from './mainSubmodule.mjs';



/**
 * @typedef {Object} Co2sConfig
 * @property {boolean} enabled 機能有効
 * @property {boolean} debug デバッグログ
 * @property {string} place 記録場所
 */
/**
 * @typedef {Object} Co2sPersist
 * @property {string} [time]
 * @property {number} [temperature]
 * @property {number} [humidity]
 * @property {number} [co2]
 */
/**
 * @callback SendIPCMessage
 * @param {string} channel
 * @param {any} payload
 */

let sendIPCMessage = null;
let lastSendTime = 0;
// const store = new Store();

/** @type {Co2sConfig} */
let config = {
	enabled: false,
	debug: false,
	place: 'Room'
};

/** @type {Co2sPersist} */
let persist = {};

//////////////////////////////////////////////////////////////////////
// mainCo2s
let mainCo2s = {
	isRun: false,
	/** @type {cron.ScheduledTask|null} */
	observationJob: null,
	/** @type {cron.ScheduledTask|null} */
	storeJob: null,

	//////////////////////////////////////////////////////////////////////
	//
	/**
	 * Co2sセンサ開始。重複起動時はpersist/config再送。
	 * @param {SendIPCMessage} _sendIPCMessage
	 */
	start: function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		if (mainCo2s.isRun) {  // 重複起動対策
			if (typeof sendIPCMessage === 'function') {
				sendIPCMessage("renewCo2sConfigView", config);
				sendIPCMessage("renewCo2s", persist);
			} else {
				logger.warn('mainCo2s', config.debug, 'start() duplicate-start, sendIPCMessage not initialized');
			}
			mainCo2s.sendTodayRoomEnv();		// 現在のデータを送っておく
			return;
		}

		config.enabled = store.get('config.Co2s.enabled', config.enabled);
		config.place = store.get('config.Co2s.place', config.place);
		config.debug = store.get('config.Co2s.debug', config.debug);
		persist = store.get('persist.Co2s', persist);

		if (typeof sendIPCMessage === 'function') {
			sendIPCMessage("renewCo2sConfigView", config);
		} else {
			logger.warn('mainCo2s', config.debug, 'start() sendIPCMessage not initialized');
		}

		if (config.enabled == false) {
			logger.debug('mainCo2s', config.debug, 'start() usb-ud-co2s is disabled.');
			mainCo2s.isRun = false;
			return;
		}
		mainCo2s.isRun = true;

		logger.debug('mainCo2s', config.debug, 'start()');

		try {
			co2s.start((sensorData, error) => {
				try {
					if (error) {
						// それ以外のエラーは良く知らないのでエラーとして出す
						logger.error('mainCo2s', 'co2s.start() error:', error);
						return;
					}

					logger.debug('mainCo2s', config.debug, 'start() sensorData:', sensorData);

					switch (sensorData.state) {
						case 'OK':
							break;
						case 'connected':
							persist.time = getNow();
							persist.temperature = sensorData.TMP;
							persist.humidity = sensorData.HUM;
							persist.co2 = sensorData.CO2;
							if (typeof sendIPCMessage === 'function') {
								let now = Date.now();
								if (now - lastSendTime > 1000) { // 1000ms limit
									sendIPCMessage("renewCo2s", persist);
									lastSendTime = now;
								}
							} else {
								logger.warn('mainCo2s', config.debug, 'co2s.start() callback sendIPCMessage not initialized');
							}
							break;
					}
				} catch (e) {
					logger.error('mainCo2s', 'co2s.start() callback catch error:', e);
				}
			});
		} catch (e) {
			logger.error('mainCo2s', 'co2s.start() outer error:', e);
		}

		mainCo2s.storeJob = cron.schedule('*/1 * * * *', async () => {
			try {
				logger.debug('mainCo2s', config.debug, 'cron.schedule() every 1min');

				let dt = new Date();

				//------------------------------------------------------------
				// 部屋の環境を記録、Co2s
				if (config.enabled && !isObjEmpty(persist)) {
					let n = persist;
					if (n) {
						await roomEnvModel.create({
							dateTime: dt,
							srcType: 'Co2s',
							place: config.place ? config.place : 'Room',
							temperature: n.temperature,
							humidity: n.humidity,
							CO2: n.co2
						});
					}
				} else {
					logger.debug('mainCo2s', config.debug, 'cron.schedule() persist is empty or disabled:', persist);
				}

				mainCo2s.sendTodayRoomEnv(); 		// 本日のデータの定期的送信
			} catch (error) {
				logger.error('mainCo2s', 'cron.schedule() each 1min, error:', error);
			}
		});

		if (typeof sendIPCMessage === 'function') {
			sendIPCMessage("renewCo2s", persist);
		} else {
			logger.warn('mainCo2s', config.debug, 'start() tail sendIPCMessage not initialized');
		}
		mainCo2s.sendTodayRoomEnv();		// 現在のデータを送っておく
		mainCo2s.storeJob.start();
	},

	/** 保存して停止。
	 * @returns {Promise<void>}
	 */
	stop: async function () {
		mainCo2s.isRun = false;
		logger.debug('mainCo2s', config.debug, 'stop()');

		if (mainCo2s.observationJob) {
			await mainCo2s.observationJob.stop();
			mainCo2s.observationJob = null;
		}

		await mainCo2s.setConfig(config);
		await store.set('persist.Co2s', persist);
		await co2s.stop();
	},

	/** 保存せず停止。
	 * @returns {Promise<void>}
	 */
	stopWithoutSave: async function () {
		mainCo2s.isRun = false;
		logger.debug('mainCo2s', config.debug, 'stopWithoutSave()');

		if (mainCo2s.observationJob) {
			await mainCo2s.observationJob.stop();
			mainCo2s.observationJob = null;
		}
		await co2s.stop();
	},

	/** 設定マージ保存、UI通知。
	 * @param {Partial<Co2sConfig>} [_config]
	 */
	setConfig: async function (_config) {
		if (_config) {
			config = mergeDeeply(config, _config);
		}
		await store.set('config.Co2s', config);

		if (typeof sendIPCMessage === 'function') {
			sendIPCMessage("renewCo2sConfigView", config);
			sendIPCMessage("configSaved", 'Co2s');
		} else {
			logger.warn('mainCo2s', config.debug, 'setConfig() sendIPCMessage not initialized');
		}
	},

	/** 現在設定取得。
	 * @returns {Co2sConfig}
	 */
	getConfig: function () {
		return config;
	},

	/** 現在persist取得。
	 * @returns {Co2sPersist}
	 */
	getPersist: function () {
		return persist;
	},


	//////////////////////////////////////////////////////////////////////
	// inner functions



	/**
	 * @func getRows
	 * @desc getRows
	 * @async
	 * @param {void}
	 * @return void
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
			let cases = getCases(now);

			let subQuery = `CASE ${cases} END`;

			// 3分毎データ
			let rows = await roomEnvModel.findAll({
				attributes: ['id',
					[Sequelize.fn('AVG', Sequelize.col('temperature')), 'avgTemperature'],
					[Sequelize.fn('AVG', Sequelize.col('humidity')), 'avgHumidity'],
					[Sequelize.fn('AVG', Sequelize.col('CO2')), 'avgCO2'],
					'createdAt',
					[Sequelize.literal(subQuery), 'timeunit']
				],
				where: {
					srcType: 'Co2s',
					dateTime: { [Op.between]: [begin.toISOString(), end.toISOString()] }
				},
				group: ['timeunit']
			});

			return rows;
		} catch (error) {
			logger.error('mainCo2s', 'getRows()', error);
			return []; // エラー時は空配列を返す
		}
	},

	/**
	 * @func getTodayRoomEnv
	 * @desc getTodayRoomEnv
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	getTodayRoomEnv: async function () {
		// 画面に今日のデータを送信するためのデータ作る
		try {
			let rows = (await mainCo2s.getRows()) || [];

			let T1 = new Date();
			T1.setHours(0, 0, 0);
			let array = [];
			for (let t = 0; t < 480; t += 1) {
				let row = rows.find((row) => row.dataValues.timeunit == formatDate(T1, 'HH24:MI'));

				if (row) {
					array.push({
						id: t,
						time: T1.toISOString(),
						srcType: 'Co2s',
						temperature: row.dataValues.avgTemperature,
						humidity: row.dataValues.avgHumidity,
						CO2: row.dataValues.avgCO2
					});
				} else {
					array.push({
						id: t,
						time: T1.toISOString(),
						srcType: 'Co2s',
						temperature: null,
						humidity: null,
						CO2: null
					});
				}

				T1.setMinutes(T1.getMinutes() + 3); // + 3 min
			}

			return array;
		} catch (error) {
			logger.error('mainCo2s', 'getTodayRoomEnv()', error);
		}
	},

	/**
	 * @func sendTodayRoomEnv
	 * @desc sendTodayRoomEnv
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	sendTodayRoomEnv: async function () {
		let arg = {};

		if (config.enabled) {
			arg = await mainCo2s.getTodayRoomEnv();
			if (typeof sendIPCMessage === 'function') {
				sendIPCMessage('renewRoomEnvCo2s', JSON.stringify(arg));
			} else {
				logger.warn('mainCo2s', config.debug, 'sendTodayRoomEnv() sendIPCMessage not initialized');
			}
		} else {
			logger.debug('mainCo2s', config.debug, 'sendTodayRoomEnv() config.enabled is false');
		}
	}
};


// module.exports = mainCo2s;
export { mainCo2s };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
