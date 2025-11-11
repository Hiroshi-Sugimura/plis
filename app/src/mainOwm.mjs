//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainOwm
 */

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import Store from 'electron-store';
import http from 'http';
import cron from 'node-cron';
import * as dateUtils from 'date-utils';
import { owmModel, weatherModel } from './models/localDBModels.cjs';   // DBデータと連携
import { isObjEmpty, mergeDeeply, getNow } from './mainSubmodule.cjs';


const store = new Store();

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

		config.enabled = store.get('config.OWM.enabled', false);
		config.APIKey = store.get('config.OWM.APIKey', '');
		config.debug = store.get('config.OWM.debug', false);
		config.zipcode = store.get('config.OWM.zipcode', '');
		persist = store.get('persist.OWM', {});
		sendIPCMessage("renewOwmConfigView", config);  // 画面に通知

		if (!config.enabled) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.start(): Owm is disabled.') : 0;
			mainOwm.isRun = false;
			return;
		}
		mainOwm.isRun = true;

		if (config.APIKey == '') {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.start(): no key.') : 0;
			return;
		}

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.start() config:', '\x1b[32m', config, '\x1b[0m') : 0;

		await mainOwm.startCore({ APIKey: config.APIKey, zipcode: config.zipcode }, (_body) => {
			try {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.start() _body:', '\x1b[32m', _body, '\x1b[0m') : 0;
				persist = JSON.parse(_body);
				if (!isObjEmpty(persist)) {
					sendIPCMessage("renewOwm", persist);
					owmModel.create({ detail: JSON.stringify(persist) }); // dbに入れる
				}
			} catch (error) {
				// JSONじゃないbodyもくる？
				console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.start().start()', error);
			}
		});

		if (!isObjEmpty(persist)) { sendIPCMessage("renewOwm", persist); }  // もし前回データがあれば送る
	},

	/** 保存して停止。
	 * @returns {Promise<void>}
	 */
	stop: async function () {
		mainOwm.isRun = false;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.stop()') : 0;

		await store.set('persist.OWM', persist);
		await mainOwm.stopObservation();
	},

	/** 保存せず停止。
	 * @returns {Promise<void>}
	 */
	stopWithoutSave: async function () {
		mainOwm.isRun = false;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.stopWithoutSave()') : 0;
		await mainOwm.stopObservation();
	},


	//////////////////////////////////////////////////////////////////////
	/**
	 * OpenWeatherMapのURL組み立てとcron開始、起動時1回取得。
	 * @param {{APIKey:string, zipcode:string}} option
	 * @param {(body:string)=>void} _callback
	 */
	startCore: function (option, _callback) {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.startCore(), option:\x1b[32m', option, '\x1b[0m') : 0;
		mainOwm.url = 'http://api.openweathermap.org/data/2.5/weather?zip=' + option.zipcode + ',jp&units=metric&appid=' + option.APIKey;
		mainOwm.callback = _callback;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.startCore(), url:\x1b[32m', mainOwm.url, '\x1b[0m') : 0;

		try {
			mainOwm.setObserve();  // 1 hour
		} catch (e) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.start().setObserve(), error:', e);
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
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.start().get, error:', error);
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
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.setObserve() start.') : 0;

		if (mainOwm.observationJob) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.setObserve() already started.') : 0;
		}

		// 監視はcronで実施、１時間毎
		mainOwm.observationJob = cron.schedule('0 */1 * * *', () => {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.observationJob.schedule()') : 0;

			// 天気を取得
			http.get(mainOwm.url, function (res) {
				let body = '';
				res.setEncoding('utf8');

				res.on('data', function (chunk) {
					body += chunk;
				});

				res.on('data', function (chunk) {
					mainOwm.callback(body);		// 画面更新
					mainOwm.storeData();		// 天気をDB記録
				});
			}).on('error', function (error) {
				console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.setObserve.cron.get errror:', error);
			});
		});

		mainOwm.observationJob.start();
	},

	/**
	 * 監視停止。
	 */
	stopObservation: function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.stop() observation.') : 0;

		if (mainOwm.observationJob) {
			mainOwm.observationJob.stop();
			mainOwm.observationJob = null;
		}
	},

	/** persistをDBへ保存。 */
	storeData: function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.storeData().') : 0;

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
