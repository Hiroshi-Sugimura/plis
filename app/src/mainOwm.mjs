//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainOwm
 */

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { store } from './storeSingleton.mjs';
import http from 'http';
import cron from 'node-cron';
import localDB from './models/localDBModels.mjs';   // DBデータと連携
const { owmModel, weatherModel } = localDB;
import { isObjEmpty, mergeDeeply, getNow, formatDate } from './mainSubmodule.mjs';
import { logger } from './logger.mjs';


// const store = new Store();

/** mainOwmからIPCMessageを呼ぶためのcallback */
let sendIPCMessage = null;

/**
 * @typedef {Object} OwmConfig
 * @property {boolean} enabled 機能有効
 * @property {string} APIKey OpenWeatherMap APIキー
 * @property {string} zipcode 郵便番号（JP）
 * @property {boolean} debug デバッグログ
 */

/** mainOwmのconfig */
/** @type {OwmConfig} */
let config = {
	enabled: false,
	APIKey: '',
	zipcode: '',
	debug: false
};

/** mainOwmのpersist */
/** @type {Object.<string, any>} */
let persist = {};


//////////////////////////////////////////////////////////////////////
// mainOwm
let mainOwm = {
	isRun: false,
	url: '',
	/** @type {cron.ScheduledTask|null} */
	observationJob: null,
	callback: null,

	/**
	 * OpenWeatherMap 取得処理の開始。重複起動時はpersist/configをUIへ再送。
	 * @param {(ch:string,p:any)=>void} _sendIPCMessage
	 */
	start: async function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		if (mainOwm.isRun) {  // 重複起動対策
			sendIPCMessage("renewOwmConfigView", config);  // 現在の設定値を表示
			if (!isObjEmpty(persist)) { sendIPCMessage("renewOwm", persist); }  // もし前回データがあれば送る
			return;
		}

		config.enabled = await store.get('config.OWM.enabled', false);
		config.APIKey = await store.get('config.OWM.APIKey', '');
		config.debug = await store.get('config.OWM.debug', false);
		config.zipcode = await store.get('config.OWM.zipcode', '');
		persist = await store.get('persist.OWM', {});
		sendIPCMessage("renewOwmConfigView", config);  // 画面に通知

		if (!config.enabled) {
			logger.debug('mainOwm', config.debug, 'start(): Owm is disabled.');
			mainOwm.isRun = false;
			return;
		}
		mainOwm.isRun = true;

		if (config.APIKey == '') {
			logger.debug('mainOwm', config.debug, 'start(): no key.');
			return;
		}

		logger.debug('mainOwm', config.debug, 'start() config:', config);

		await mainOwm.startCore({ APIKey: config.APIKey, zipcode: config.zipcode }, (_body) => {
			try {
				logger.debug('mainOwm', config.debug, 'start() _body:', _body);
				persist = JSON.parse(_body);
				if (!isObjEmpty(persist)) {
					sendIPCMessage("renewOwm", persist);
					owmModel.create({ detail: JSON.stringify(persist) }); // dbに入れる
				}
			} catch (error) {
				logger.error('mainOwm', 'start() callback error:', error);
			}
		});

		if (!isObjEmpty(persist)) { sendIPCMessage("renewOwm", persist); }  // もし前回データがあれば送る
	},

	/** 保存して停止。
	 * @returns {Promise<void>}
	 */
	stop: async function () {
		mainOwm.isRun = false;

		logger.debug('mainOwm', config.debug, 'stop()');

		await store.set('persist.OWM', persist);
		await mainOwm.stopObservation();
	},

	/** 保存せず停止。
	 * @returns {Promise<void>}
	 */
	stopWithoutSave: async function () {
		mainOwm.isRun = false;

		logger.debug('mainOwm', config.debug, 'stopWithoutSave()');
		await mainOwm.stopObservation();
	},


	//////////////////////////////////////////////////////////////////////
	/**
	 * OpenWeatherMapのURL組み立てとcron開始、起動時1回取得。
	 * @param {{APIKey:string, zipcode:string}} option
	 * @param {(body:string)=>void} _callback
	 */
	startCore: function (option, _callback) {
		logger.debug('mainOwm', config.debug, 'startCore(), option:', option);
		mainOwm.url = 'http://api.openweathermap.org/data/2.5/weather?zip=' + option.zipcode + ',jp&units=metric&appid=' + option.APIKey;
		mainOwm.callback = _callback;

		logger.debug('mainOwm', config.debug, 'startCore(), url:', mainOwm.url);

		try {
			mainOwm.setObserve();  // 1 hour
		} catch (e) {
			logger.error('mainOwm', 'startCore() setObserve error:', e);
		}

		// 起動時に一回取得する
		// 天気を取得
		http.get(mainOwm.url, function (res) {
			let body = '';
			res.setEncoding('utf8');

			res.on('data', function (chunk) {
				body += chunk;
			});

			res.on('data', function (chunk) {
				mainOwm.callback(body);
			});
		}).on('error', function (error) {
			logger.error('mainOwm', 'startCore() http.get error:', error);
		});

	},

	/**
	 * コールバック関数の説明
	 * @callback startCore-callback
	 * @param {body} body
	 */

	/**
	 * 監視cron登録（1時間毎）。
	 */
	setObserve: function () {
		logger.debug('mainOwm', config.debug, 'setObserve() start.');

		if (mainOwm.observationJob) {
			logger.debug('mainOwm', config.debug, 'setObserve() already started.');
		}

		// 監視はcronで実施、１時間毎
		mainOwm.observationJob = cron.schedule('0 */1 * * *', () => {
			try {
				logger.debug('mainOwm', config.debug, 'observationJob.schedule()');

				// 天気を取得
				http.get(mainOwm.url, function (res) {
					let body = '';
					res.setEncoding('utf8');

					res.on('data', function (chunk) {
						body += chunk;
					});

					res.on('end', function () {
						try {
							mainOwm.callback(body);		// 画面更新
							mainOwm.storeData();		// 天気をDB記録
						} catch (innerError) {
							logger.error('mainOwm', 'observationJob.schedule() callback inner error:', innerError);
						}
					});
				}).on('error', function (error) {
					logger.error('mainOwm', 'observationJob.schedule() http.get error:', error);
				});
			} catch (cronError) {
				logger.error('mainOwm', 'observationJob.schedule() error:', cronError);
			}
		});

		mainOwm.observationJob.start();
	},

	/**
	 * 監視停止。
	 */
	stopObservation: function () {
		logger.debug('mainOwm', config.debug, 'stopObservation().');

		if (mainOwm.observationJob) {
			mainOwm.observationJob.stop();
			mainOwm.observationJob = null;
		}
	},

	/** persistをDBへ保存。 */
	storeData: function () {
		logger.debug('mainOwm', config.debug, 'storeData().');

		if (persist) {
			weatherModel.create({
				dateTime: getNow(),
				srcType: 'owm',
				place: persist.name,
				weather: persist.weather[0].main,
				temperature: persist.main.temp,
				humidity: persist.main.humidity,
				pressure: persist.main.pressure,
				windSpeed: persist.wind.speed,
				windDirection: persist.wind.deg,
				cloudCover: persist.clouds.all
			});
		}
	},

	/** 設定をマージ保存。UIへ通知。
	 * @param {Partial<OwmConfig>} [_config]
	 */
	setConfig: async function (_config) {
		if (_config) {
			config = mergeDeeply(config, _config);
		}
		store.set('config.OWM', config);

		sendIPCMessage("renewOwmConfigView", config);  // 保存したので画面に通知
		sendIPCMessage("configSaved", 'OWM');  // 保存したので画面に通知
	},

	/** 現在設定の取得。
	 * @returns {OwmConfig}
	 */
	getConfig: function () {
		return config;
	},

	/** 現在persistの取得。
	 * @returns {Object}
	 */
	getPersist: function () {
		return persist;
	}

};


// module.exports = mainOwm;
export { mainOwm };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
