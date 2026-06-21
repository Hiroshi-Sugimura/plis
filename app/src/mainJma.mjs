//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2022.09.06
//////////////////////////////////////////////////////////////////////
/**
 * @module mainJma
 */
// 'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { store } from './storeSingleton.mjs';
import axios from 'axios';
import cron from 'node-cron';
import localDB from './models/localDBModels.mjs';   // DBデータと連携
const { jmaRawModel, jmaAbstModel, weatherForecastModel, popsForecastModel, tempForecastModel } = localDB;
import { getNow, formatDate, getTodayDate, getYesterdayDate, getToday, isObjEmpty, mergeDeeply } from './mainSubmodule.mjs';
import { logger } from './logger.mjs';

/**
 * @typedef {Object} JmaConfig
 * @property {boolean} enabled 機能有効フラグ
 * @property {string} area UI表示用エリア名
 * @property {string} code 気象庁API用エリアコード
 * @property {boolean} debug デバッグログ
 */
/**
 * @typedef {Object} JmaPersist
 * @property {Object} abst 概要情報
 * @property {Object} detail 詳細情報（weather/pops/temperature 配列含む）
 */
/**
 * @callback SendIPCMessage
 * @param {string} channel
 * @param {any} payload
 */


let sendIPCMessage = null;
// const store = new Store();

/** @type {JmaConfig} */
let config = {
	enabled: true,
	area: '東京都',
	code: '130000',
	debug: false
};
/** @type {JmaPersist} */
let persist = {};


//////////////////////////////////////////////////////////////////////
// config

let mainJma = {
	/** @type {boolean} 多重起動防止 */
	isRun: false,
	/** 天気概要の取得URL、固定値 */
	abstURL: "https://www.jma.go.jp/bosai/forecast/data/overview_forecast/",
	/** 詳細予報取得URL、固定値 */
	detailURL: "https://www.jma.go.jp/bosai/forecast/data/forecast/",
	/** @type {cron.ScheduledTask|null} 監視ジョブ */
	observationJob: null,
	/** @type {Function|null} 画面更新先 */
	callback: null,
	/** エリアコード、固定値（UIから選択可） */
	areaCodes: {
		"群馬県": "100000",
		"埼玉県": "110000",
		"千葉県": "120000",
		"東京都": "130000",
		"神奈川県": "140000",
		"新潟県": "150000",
		"富山県": "160000",
		"石川県": "170000",
		"福井県": "180000",
		"山梨県": "190000",
		"長野県": "200000",
		"岐阜県": "210000",
		"静岡県": "220000",
		"愛知県": "230000",
		"三重県": "240000",
		"滋賀県": "250000",
		"京都府": "260000",
		"大阪府": "270000",
		"兵庫県": "280000",
		"奈良県": "290000",
		"和歌山県": "300000",
		"鳥取県": "310000",
		"島根県": "320000",
		"岡山県": "330000",
		"広島県": "340000",
		"山口県": "350000",
		"徳島県": "360000",
		"香川県": "370000",
		"愛媛県": "380000",
		"高知県": "390000",
		"福岡県": "400000",
		"佐賀県": "410000",
		"長崎県": "420000",
		"熊本県": "430000",
		"大分県": "440000",
		"宮崎県": "450000",
		"奄美地方": "460040",
		"鹿児島県（奄美地方除く）": "460100",
		"沖縄本島地方": "471000",
		"大東島地方": "472000",
		"宮古島地方": "473000",
		"八重山地方": "474000",
		"青森県": "020000",
		"岩手県": "030000",
		"宮城県": "040000",
		"秋田県": "050000",
		"山形県": "060000",
		"福島県": "070000",
		"茨城県": "080000",
		"栃木県": "090000"
	},

	//////////////////////////////////////////////////////////////////////
	/**
	 * 気象庁予報取得開始。重複起動時は現在persist/configをUIへ再送する。
	 * @param {SendIPCMessage} _sendIPCMessage
	 */
	start: function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;
		if (mainJma.isRun) {  // 重複起動は現在データを渡す
			sendIPCMessage('renewJmaConfigView', config);
			if (!isObjEmpty(persist.abst)) { sendIPCMessage("renewJmaAbst", persist.abst); }
			if (!isObjEmpty(persist.detail)) { sendIPCMessage("renewJmaDetail", persist.detail); }
			return;
		}

		config.enabled = store.get('config.JMA.enabled', true);
		config.area = store.get('config.JMA.area', '東京都');
		config.code = store.get('config.JMA.code', '130000');
		config.debug = store.get('config.JMA.debug', false);
		persist = store.get('persist.JMA', {});

		if (!config.enabled) {
			logger.debug('mainJma', config.debug, 'start(): Jma is disabled.');
			mainJma.isRun = false;
			return;
		}
		mainJma.isRun = true;

		logger.debug('mainJma', config.debug, 'start() config:\x1b[32m', config, '\x1b[0m');
		if (!persist || isObjEmpty(persist)) { persist = { abst: {}, detail: {} }; }

		mainJma.callback = async function (res) {
			switch (res.cmd) {
				case "abst":
					try {
						if (!isObjEmpty(res.json)) {
							// raw
							let raw = mainJma.parseAbstRaw(res.json);

							let row = await jmaRawModel.findOne({ where: { requestAreaCode: raw.requestAreaCode, reportDatetime: raw.reportDatetime, type: 'abst' } });
							if (!row) {
								await jmaRawModel.create(raw);
							}

							// 構造化されたデータ
							persist.abst = mainJma.parseAbst(res.json);
							sendIPCMessage("renewJmaAbst", persist.abst);

							let arow = await jmaAbstModel.findOne({ where: { requestAreaCode: persist.abst.requestAreaCode, reportDatetime: persist.abst.reportDatetime } });
							if (!arow) {
								await jmaAbstModel.create(persist.abst);
							}
						}
					} catch (error) {
						logger.error('mainJma', 'abst callback error:', error);
					}
					break;


				case "detail":
					try {
						if (!isObjEmpty(res.json)) {
							// raw
							let raw = mainJma.parseDetailRaw(res.json);

							let row = await jmaRawModel.findOne({ where: { requestAreaCode: raw.requestAreaCode, reportDatetime: raw.reportDatetime, type: 'detail' } });
							if (!row) {
								await jmaRawModel.create(raw);
							}

							// 構造化されたデータ
							persist.detail = mainJma.parseDetail(res.json);
							sendIPCMessage("renewJmaDetail", persist.detail);


							// 詳細の天気
							for (let item of persist.detail.weather) {
								let wrow = await weatherForecastModel.findOne({ where: { targetArea: item.targetArea, reportDatetime: item.reportDatetime } });
								if (!wrow) {
									await weatherForecastModel.create(item);
								}
							}

							// 詳細の降水確率
							for (let item of persist.detail.pops) {
								let prow = await popsForecastModel.findOne({ where: { targetArea: item.targetArea, reportDatetime: item.reportDatetime } });
								if (!prow) {
									await popsForecastModel.create(item);
								}
							}

							// 詳細の気温
							for (let item of persist.detail.temperature) {
								let trow = await tempForecastModel.findOne({ where: { targetArea: item.targetArea, reportDatetime: item.reportDatetime } });
								if (!trow) {
									await tempForecastModel.create(item);
								}
							}
						}
					} catch (error) {
						logger.error('mainJma', 'detail callback error:', error);
					}
					break;
			}
		};

		mainJma.setObserve();  // 3 hour each

		sendIPCMessage('renewJmaConfigView', config);
		if (!isObjEmpty(persist.abst)) { sendIPCMessage("renewJmaAbst", persist.abst); }
		if (!isObjEmpty(persist.detail)) { sendIPCMessage("renewJmaDetail", persist.detail); }
		mainJma.gets(); // 初回起動はデータ取得する
	},


	// ---------------------------------------------------------------
	/**
	 * 内部：天気概要/詳細を取得し callback に渡す。
	 */
	gets: async function () {
		try {
			const abstRes = await axios.get(mainJma.abstURL + config.code + ".json");
			mainJma.callback({ cmd: "abst", json: abstRes.data });
		} catch (error) {
			if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH' || error.code === 'ECONNABORTED' || error.code === 'EHOSTUNREACH' || error.code === 'ECONNRESET' || (error.message && error.message.includes('AggregateError'))) {
				logger.error('mainJma', `gets() abst Connection Error: ${error.code || error.message.split('\n')[0]}`);
			} else {
				logger.error('mainJma', 'gets() abst error:', error);
			}
		}

		try {
			const detailRes = await axios.get(mainJma.detailURL + config.code + ".json");
			mainJma.callback({ cmd: "detail", json: detailRes.data });
		} catch (error) {
			if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH' || error.code === 'ECONNABORTED' || error.code === 'EHOSTUNREACH' || error.code === 'ECONNRESET' || (error.message && error.message.includes('AggregateError'))) {
				logger.error('mainJma', `gets() detail Connection Error: ${error.code || error.message.split('\n')[0]}`);
			} else {
				logger.error('mainJma', 'gets() detail error:', error);
			}
		}
	},

	/**
	 * 取得した概要JSONをそのままraw保存形式へ変換。
	 * @param {any} body APIレスポンス
	 * @returns {{type:string,publishingOffice:string,reportDatetime:string,requestAreaCode:string,json:string}}
	 */
	parseAbstRaw: function (body) {
		return {
			type: 'abst',
			publishingOffice: body.publishingOffice,
			reportDatetime: body.reportDatetime,
			requestAreaCode: config.code,
			json: JSON.stringify(body)
		};
	},

	/**
	 * 概要JSONをUI/DB向け構造へ変換。
	 * @param {any} body APIレスポンス
	 * @returns {{reportDatetime:string,publishingOffice:string,requestAreaCode:string,headlineText:string,text:string}}
	 */
	parseAbst: function (body) {
		return {
			reportDatetime: body.reportDatetime,
			publishingOffice: body.publishingOffice,
			requestAreaCode: config.code,
			headlineText: body.headlineText || "",
			text: body.text || ""
		}
	},

	/**
	 * 詳細予報JSON配列をraw保存形式へ変換。
	 * @param {any[]} body APIレスポンス
	 * @returns {{type:string,publishingOffice:string,reportDatetime:string,requestAreaCode:string,json:string}}
	 */
	parseDetailRaw: function (body) {
		let w = body[0];  // json[1]はちょっとよくわからんので
		let publishingOffice = w.publishingOffice;
		let reportDatetime = w.reportDatetime;

		return {
			type: 'detail',
			publishingOffice: publishingOffice,
			reportDatetime: reportDatetime,
			requestAreaCode: config.code,
			json: JSON.stringify(body)
		};
	},

	/**
	 * 詳細予報を weather/pops/temperature の配列へ正規化。
	 * @param {any[]} body APIレスポンス
	 * @returns {{weather:Array,pops:Array,temperature:Array}}
	 */
	parseDetail: function (body) {
		let res = { weather: [], pops: [], temperature: [] };
		let w = body[0];  // body[1]はちょっとよくわからんので
		let publishingOffice = w.publishingOffice;
		let reportDatetime = w.reportDatetime;
		let we = w.timeSeries[0];  // 天気関係
		let po = w.timeSeries[1];  // 降水確率
		let te = w.timeSeries[2];  // 気温

		// timeseries 0 = weather
		let timeDefines0 = JSON.stringify(we.timeDefines);
		for (let a of we.areas) {
			res.weather.push({
				reportDatetime: reportDatetime,
				publishingOffice: publishingOffice,
				targetArea: a.area.name,
				code: a.area.code,
				timeDefines: timeDefines0,
				weatherCodes: JSON.stringify(a.weatherCodes),
				weathers: JSON.stringify(a.weathers),
				winds: JSON.stringify(a.winds || []),
				waves: JSON.stringify(a.waves || [])
			});
		}

		// timeseries 1 = pops
		let timeDefines1 = JSON.stringify(po.timeDefines);
		for (let a of po.areas) {
			res.pops.push({
				reportDatetime: reportDatetime,
				publishingOffice: publishingOffice,
				targetArea: a.area.name,
				code: a.area.code,
				timeDefines: timeDefines1,
				pops: JSON.stringify(a.pops)
			});
		};

		// timeseries 2 = temperature
		if (te) {
			let timeDefines2 = JSON.stringify(te.timeDefines);
			for (let a of te.areas) {
				res.temperature.push({
					reportDatetime: reportDatetime,
					publishingOffice: publishingOffice,
					targetArea: a.area.name,
					code: a.area.code,
					timeDefines: timeDefines2,
					temps: JSON.stringify(a.temps)
				});
			};
		}

		return res;
	},


	/**
	 * cronスケジュール登録 (3時間毎)。
	 */
	setObserve: function () {
		logger.debug('mainJma', config.debug, 'setObserve() start.');

		if (mainJma.observationJob) {
			logger.debug('mainJma', config.debug, 'setObserve() already started.');
		}

		// 監視はcronで実施、3時間毎
		mainJma.observationJob = cron.schedule('0 */3 * * *', async () => {
			logger.debug('mainJma', config.debug, 'observationJob cron.schedule()');
			await mainJma.gets();
		});

		mainJma.observationJob.start();
	},

	/**
	 * 監視停止。
	 */
	stopObservation: function () {
		logger.debug('mainJma', config.debug, 'stopObservation()');

		if (mainJma.observationJob) {
			mainJma.observationJob.stop();
			mainJma.observationJob = null;
		}
	},

	/**
	 * 設定/persist保存して停止。
	 * @returns {Promise<void>}
	 */
	stop: async function () {
		logger.debug('mainJma', config.debug, 'stop()');

		await mainJma.setConfig(config);
		await store.set('persist.JMA', persist);
		await mainJma.stopObservation();
	},

	/**
	 * 保存せず停止。
	 * @returns {Promise<void>}
	 */
	stopWithoutSave: async function () {
		logger.debug('mainJma', config.debug, 'stopWithoutSave()');
		await mainJma.stopObservation();
	},

	/**
	 * 設定をマージ保存。UIへ通知。
	 * @param {Partial<JmaConfig>} [_config]
	 */
	setConfig: async function (_config) {
		if (_config) {
			config = mergeDeeply(config, _config);
		}
		await store.set('config.JMA', config);
		sendIPCMessage("configSaved", 'JMA');  // 保存したので画面に通知
	},

	/**
	 * 現在設定の取得。
	 * @returns {JmaConfig}
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * 現在persistの取得。
	 * @returns {JmaPersist}
	 */
	getPersist: function () {
		return persist;
	}

};



// module.exports = mainJma;
export { mainJma };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
