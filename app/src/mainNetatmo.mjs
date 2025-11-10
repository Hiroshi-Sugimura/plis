//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2018.03.16
//////////////////////////////////////////////////////////////////////
/**
 * @module mainNetatmo
 */
// 'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import Store from 'electron-store';
import axios from 'axios';
import cron from 'node-cron';
import * as dateUtils from 'date-utils';
import { Sequelize, Op, netatmoModel, roomEnvModel } from './models/localDBModels.cjs';   // DBデータと連携
import { mergeDeeply } from './mainSubmodule.cjs';


let sendIPCMessage = null;
const store = new Store();

let config = {
	enabled: false,
	id: "",
	secret: "",
	accessToken: "",
	debug: false
};

let persist = {};


//////////////////////////////////////////////////////////////////////
// config
let mainNetatmo = {
	accessToken: null,
	refreshToken: null,
	tokenExpires: null,
	observationJob: null,
	data: {},
	debug: false,
	isRun: false,

	//////////////////////////////////////////////////////////////////////
	/**
	 * @func start
	 * @desc start
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	// netatmo start
	start: async function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		if (mainNetatmo.isRun) {
			sendIPCMessage("renewNetatmoConfigView", config);
			sendIPCMessage("renewNetatmo", persist);
			mainNetatmo.sendTodayRoomEnv();
			return;
		}

	config.enabled = store.get('config.Netatmo.enabled', false);
	config.id = store.get('config.Netatmo.id', '');
	config.secret = store.get('config.Netatmo.secret', '');
	config.accessToken = store.get('config.Netatmo.accessToken', '');
	config.debug = store.get('config.Netatmo.debug', false);
		sendIPCMessage("renewNetatmoConfigView", config);

		persist = store.get('persist.Netatmo', {});

		if (!config.enabled) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.start() Netatmo is disabled.') : 0;
			mainNetatmo.isRun = false;
			return;
		}
		mainNetatmo.isRun = true;

		// configがなければ実行しない。
		if (config.id == '' || config.secret == '' || config.accessToken == '') {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.start() no config.') : 0;
			if (sendIPCMessage) {
				sendIPCMessage('NetatmoAuthError', '設定が不足しています（Client ID / Secret / Access Token）');
			}
			return;
		}

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.start() config:\x1b[32m', config, '\x1b[0m') : 0;

		// すでに取得済みのアクセストークンを使う
		try {
			await mainNetatmo.fetchStationsData();
			mainNetatmo.setObserve();
		} catch (e) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.start() error:', e);
			sendIPCMessage('NetatmoAuthError', e.message || e);
		}

		sendIPCMessage("renewNetatmo", persist);
		mainNetatmo.sendTodayRoomEnv();
	},
	/**
	 * @func getAccessToken
	 * @desc Netatmo OAuth2認証でaccess_token取得
	 */
	getAccessToken: async function () {
		// アクセストークンはconfigから直接取得
		mainNetatmo.accessToken = config.accessToken;
		if (!mainNetatmo.accessToken) {
			throw new Error('Netatmoアクセストークンが設定されていません');
		}
	},

	/**
	 * @func fetchStationsData
	 * @desc Netatmo APIでステーションデータ取得
	 */
	fetchStationsData: async function () {
		if (!mainNetatmo.accessToken) {
			await mainNetatmo.getAccessToken();
		}
		try {
			const res = await axios.get('https://api.netatmo.com/api/getstationsdata', {
				headers: {
					Authorization: `Bearer ${mainNetatmo.accessToken}`
				}
			});
			persist = res.data.body.devices;
			sendIPCMessage("renewNetatmo", persist);
			await netatmoModel.create({ detail: JSON.stringify(persist) });
		} catch (error) {
			throw new Error('Netatmoデータ取得失敗: ' + error);
		}
	},


	//////////////////////////////////////////////////////////////////////
	// Netatmoの処理


	/**
	 * @func stop
	 * @desc stop
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	stop: async function () {
		mainNetatmo.isRun = false;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.stop()') : 0;

		await mainNetatmo.setConfig(config);
		await store.set('persist.Netatmo', persist);
		await mainNetatmo.stopObservation();
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
		mainNetatmo.isRun = false;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.stopWithoutSave()') : 0;
		await mainNetatmo.stopObservation();
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
		await store.set('config.Netatmo', config);
		sendIPCMessage("renewNetatmoConfigView", config);
		sendIPCMessage("configSaved", 'Netatmo');// 保存したので画面に通知
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
	// innser functions

	/**
	 * @func getCases
	 * @desc getRows
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	// 定時処理、部屋環境のデータ送信
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
		T1.setHours(T1.getHours() - T1.getHours() - 10, 57, 0, 0);// 前日の14時57分xx秒   14:57:00 .. 15:00:00 --> 00:00
		T2.setHours(T1.getHours() - T1.getHours() - 10, 58, 0, 0);// T1 + 1min
		T3.setHours(T1.getHours() - T1.getHours() - 10, 59, 0, 0);// T1 + 2min
		T4.setHours(T1.getHours() - T1.getHours(), 0, 0, 0);// 集約先

		let ret = "";
		for (let t = 0; t < 480; t += 1) {// 24h * 20 times (= 60min / 3min)
			// console.log( T1.toISOString(), ':', T1.toFormat('YYYY-MM-DD HH24:MI'), ', ', T4.toFormat('HH24:MI') );

			ret += `WHEN "createdAt" LIKE "${T1.toFormat('YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${T2.toFormat('YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${T3.toFormat('YYYY-MM-DD HH24:MI')}%" THEN "${T4.toFormat('HH24:MI')}" \n`;

			T1.setMinutes(T1.getMinutes() + 3);// + 3 min
			T2.setMinutes(T2.getMinutes() + 3);// + 3 min
			T3.setMinutes(T3.getMinutes() + 3);// + 3 min
			T4.setMinutes(T4.getMinutes() + 3);// + 3 min
		}
		return ret + 'ELSE "24:00"';
	},


	/**
	 * @func getRows
	 * @desc DBからテーブル取得
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	getRows: async function () {
		try {
			let now = new Date();// 現在
			let begin = new Date(now);// 現在時刻UTCで取得
			begin.setHours(begin.getHours() - begin.getHours() - 1, 57, 0, 0);// 前日の23時57分０秒にする
			let end = new Date(begin);// 現在時刻UTCで取得
			end.setHours(begin.getHours() + 25, 0, 0, 0);// 次の日の00:00:00にする
			let cases = mainNetatmo.getCases(now);

			let subQuery = `CASE ${cases} END`;

			// 3分毎データ
			let rows = await roomEnvModel.findAll({
				attributes: ['id',
					[Sequelize.fn('AVG', Sequelize.col('temperature')), 'avgTemperature'],
					[Sequelize.fn('AVG', Sequelize.col('humidity')), 'avgHumidity'],
					[Sequelize.fn('AVG', Sequelize.col('pressure')), 'avgPressure'],
					[Sequelize.fn('AVG', Sequelize.col('CO2')), 'avgCO2'],
					[Sequelize.fn('AVG', Sequelize.col('noise')), 'avgNoise'],
					'createdAt',
					[Sequelize.literal(subQuery), 'timeunit']
				],
				where: {
					srcType: 'netatmo',
					dateTime: { [Op.between]: [begin.toISOString(), end.toISOString()] }
				},
				group: ['timeunit']
			});

			return rows;
		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.getRows()', error);
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
			let rows = await mainNetatmo.getRows();

			let T1 = new Date();
			T1.setHours(0, 0, 0);

			let array = [];
			for (let t = 0; t < 480; t += 1) {
				let row = rows.find((row) => row.dataValues.timeunit == T1.toFormat('HH24:MI'));

				if (row) {
					array.push({
						id: t,
						time: T1.toISOString(),
						srcType: 'netatmo',
						temperature: row.dataValues.avgTemperature,
						humidity: row.dataValues.avgHumidity,
						pressure: row.dataValues.avgPressure,
						noise: row.dataValues.avgNoise,
						CO2: row.dataValues.avgCO2
					});
				} else {
					array.push({
						id: t,
						time: T1.toISOString(),
						srcType: 'omron',
						temperature: null,
						humidity: null,
						pressure: null,
						noise: null,
						CO2: null
					});
				}

				T1.setMinutes(T1.getMinutes() + 3);// + 3 min
			}
			return array;

		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.getTodayRoomEnv()', error);
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
			arg = await mainNetatmo.getTodayRoomEnv();
			sendIPCMessage('renewRoomEnvNetatmo', JSON.stringify(arg));
		}
	},

	/**
	 * @func setObservesetObserve
	 * @func setObserve
	 * @desc netatmoを監視する
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	setObserve: function () {
		if (mainNetatmo.observationJob) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.observe() is already started.') : 0;
		}
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.observe() start.') : 0;

		// 監視はcronで実施、1分毎
		mainNetatmo.observationJob = cron.schedule('*/1 * * * *', async () => {
			try {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.cron.schedule() every 1min') : 0;

				// トークン期限切れなら再取得
				if (!mainNetatmo.accessToken || (mainNetatmo.tokenExpires && Date.now() > mainNetatmo.tokenExpires - 60000)) {
					await mainNetatmo.getAccessToken();
				}
				await mainNetatmo.fetchStationsData();

				let dt = new Date();
				if (config.enabled && persist.length != 0) {
					let n = persist[0];
					if (n) {
						roomEnvModel.create({
							dateTime: dt,
							srcType: 'netatmo',
							place: n.home_name,
							temperature: n.dashboard_data.Temperature,
							humidity: n.dashboard_data.Humidity,
							pressure: n.dashboard_data.Pressure,
							noise: n.dashboard_data.Noise,
							CO2: n.dashboard_data.CO2
						});
					}
				}
				mainNetatmo.sendTodayRoomEnv();
			} catch (error) {
				console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.cron.schedule() each 1min, error:', error);
			}
		});
		mainNetatmo.observationJob.start();
	},


	/**
	 * @func stopObservation
	 * @desc 監視をやめる
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	stopObservation: function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.stop() observation.') : 0;

		if (mainNetatmo.observationJob) {
			mainNetatmo.observationJob.stop();
			mainNetatmo.observationJob = null;
		}
	}
};


// module.exports = mainNetatmo;
export { mainNetatmo };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
