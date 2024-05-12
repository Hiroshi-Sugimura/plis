//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2023.08.26
//////////////////////////////////////////////////////////////////////
/**
 * @module mainCo2s
 */
// 'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
// const Store = require('electron-store');
import Store from 'electron-store';
// const co2s = require('usb-ud-co2s');
import co2s from 'usb-ud-co2s';
// const cron = require('node-cron');
import cron from 'node-cron';
// require('date-utils'); // for log
import * as dateUtils from 'date-utils';
// const { Sequelize, Op, roomEnvModel } = require('./models/localDBModels');   // DBデータと連携
import { Sequelize, Op, roomEnvModel } from './models/localDBModels.cjs';   //
// const { objectSort, getNow, getToday, isObjEmpty, mergeDeeply } = require('./mainSubmodule');
import { objectSort, getNow, getToday, isObjEmpty, mergeDeeply } from './mainSubmodule.cjs';

let sendIPCMessage = null;
const store = new Store();

let config = {
	enabled: false,
	debug: false,
	place: 'Room'
};

let persist = {};

//////////////////////////////////////////////////////////////////////
// mainCo2s
let mainCo2s = {
	isRun: false,
	observationJob: null,
	storeJob: null,

	//////////////////////////////////////////////////////////////////////
	//
	/**
	 * @func start
	 * @desc Co2sセンサの処理開始
	 * @param {Object} _sendIPCMessage
	 * @return void
	 * @throw error
	 */
	start: function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		if (mainCo2s.isRun) {  // 重複起動対策
			sendIPCMessage("renewCo2sConfigView", config);
			sendIPCMessage("renewCo2s", persist);
			mainCo2s.sendTodayRoomEnv();		// 現在のデータを送っておく
			return;
		}

		config.enabled = store.get('config.Co2s.enabled', config.enabled);
		config.place = store.get('config.Co2s.place', config.place);
		config.debug = store.get('config.Co2s.debug', config.debug);
		persist = store.get('persist.Co2s', persist);
		sendIPCMessage("renewCo2sConfigView", config);

		if (config.enabled == false) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCo2s.start() usb-ud-co2s is disabled.') : 0;
			mainCo2s.isRun = false;
			return;
		}
		mainCo2s.isRun = true;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCo2s.start()') : 0;

		try {
			co2s.start((sensorData, error) => {
				if (error) {
					// それ以外のエラーは良く知らないのでエラーとして出す
					console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCo2s.co2s.start()', error);
					return;
				}

				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCo2s.start() sensorData:', '\x1b[32m', sensorData, '\x1b[0m') : 0;

				switch (sensorData.state) {
					case 'OK':
						break;
					case 'connected':
						persist.time = new Date().toFormat("YYYY-MM-DD HH24:MI:SS");
						persist.temperature = sensorData.TMP;
						persist.humidity = sensorData.HUM;
						persist.co2 = sensorData.CO2;
						sendIPCMessage("renewCo2s", persist);
						break;
				}
			});
		} catch (e) {
		}

		mainCo2s.storeJob = cron.schedule('*/1 * * * *', async () => {
			try {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCo2s.cron.schedule() every 1min') : 0;

				let dt = new Date();

				//------------------------------------------------------------
				// 部屋の環境を記録、Co2s
				if (config.enabled && persist.length != 0) {
					// config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.cron.schedule() Store Co2s'):0;
					let n = persist;
					if (n) {
						roomEnvModel.create({
							dateTime: dt,
							srcType: 'Co2s',
							place: config.place ? config.place : 'Room',
							temperature: n.temperature,
							humidity: n.humidity,
							CO2: n.co2
						});
					}
				} else {
					config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCo2s.cron.schedule() persist:', persist) : 0;
				}

				mainCo2s.sendTodayRoomEnv(); 		// 本日のデータの定期的送信
			} catch (error) {
				console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCo2s.cron.schedule() each 1min, error:', error);
			}
		});

		sendIPCMessage("renewCo2s", persist);
		mainCo2s.sendTodayRoomEnv();		// 現在のデータを送っておく
		mainCo2s.storeJob.start();
	},

	/**
	 * @func stop
	 * @desc stop
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	stop: async function () {
		mainCo2s.isRun = false;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCo2s.stop()') : 0;

		if (mainCo2s.observationJob) {
			await mainCo2s.observationJob.stop();
			mainCo2s.observationJob = null;
		}

		await mainCo2s.setConfig(config);
		await store.set('persist.Co2s', persist);
		await co2s.stop();
	},

	/**
	 * @func stopWithoutSave
	 * @desc stopWithoutSave
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	stopWithoutSave: async function () {
		mainCo2s.isRun = false;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCo2s.stopWithoutSave()') : 0;

		if (mainCo2s.observationJob) {
			await mainCo2s.observationJob.stop();
			mainCo2s.observationJob = null;
		}
		await co2s.stop();
	},

	/**
	 * @func setConfig
	 * @desc setConfig
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	setConfig: async function (_config) {
		if (_config) {
			config = mergeDeeply(config, _config);
		}
		await store.set('config.Co2s', config);

		sendIPCMessage("renewCo2sConfigView", config);
		sendIPCMessage("configSaved", 'Co2s');// 保存したので画面に通知
	},

	/**
	 * @func getConfig
	 * @desc getConfig
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * @func getPersist
	 * @desc getPersist
	 * @async
	 * @param {void}
	 * @return void
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
	 * @param {void}
	 * @return void
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
			let cases = mainCo2s.getCases(now);

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
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCo2s.getTodayRoomEnvCo2s()', error);
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
			let rows = await mainCo2s.getRows();

			let T1 = new Date();
			T1.setHours(0, 0, 0);
			let array = [];
			for (let t = 0; t < 480; t += 1) {
				let row = rows.find((row) => row.dataValues.timeunit == T1.toFormat('HH24:MI'));

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
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCo2s.getTodayRoomEnvCo2s()', error);
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
			sendIPCMessage('renewRoomEnvCo2s', JSON.stringify(arg));
		} else {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCo2s.sendTodayRoomEnv() config.enabled:', config.enabled);
		}
	}
};


// module.exports = mainCo2s;
export {mainCo2s};
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
