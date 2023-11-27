//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainOwm
 */
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const Store = require('electron-store');
const http = require('http');
const cron = require('node-cron');
require('date-utils'); // for log
const { Sequelize, Op, sqlite3, owmModel } = require('./models/localDBModels');   // DBデータと連携
const { objectSort, getNow, getToday, isObjEmpty, mergeDeeply } = require('./mainSubmodule');

const store = new Store();

/** mainOwmからIPCMessageを呼ぶためのcallback */
let sendIPCMessage = null;

/** mainOwmのconfig */
let config = {
	enabled: false,
	APIKey: '',
	zipcode: '',
	debug: false
};

/** mainOwmのpersist */
let persist = {};


//////////////////////////////////////////////////////////////////////
// mainOwm
let mainOwm = {
	isRun: false,
	url: '',
	observationJob: null,
	callback: null,

	/** @func start
	 *  @desc startする
	 *  @async
	 *  @param {sendIPCMessage} _sendIPCMessage
	 *  @return {void}
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

	/** @func stop
	 *  @desc stopする
	 *  @async
	 *  @param {void}
	 *  @return {void}
	 */
	stop: async function () {
		mainOwm.isRun = false;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.stop()') : 0;

		await store.set('persist.OWM', persist);
		await mainOwm.stopObservation();
	},

	/** @func stopWithoutSave
	 *  @desc stopWithoutSave
	 *  @async
	 *  @param {void}
	 *  @return {void}
	 */
	stopWithoutSave: async function () {
		mainOwm.isRun = false;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.stopWithoutSave()') : 0;
		await mainOwm.stopObservation();
	},


	//////////////////////////////////////////////////////////////////////
	/** @func startCore
	 *  @desc Opwn Weather Mapの処理
	 *  @async
	 *  @param {option} option
	 *  @param {startCore-callback} callback _callback
	 *  @return {void}
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

	/** @func setObserve
	 *  @desc Opwn Weather Mapの監視する
	 *  @async
	 *  @param {void}
	 *  @return {void}
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
	},

	/** @func stopObservation
	 *  @desc 監視をやめる
	 *  @param {void}
	 *  @return {void}
	 */
	stopObservation: function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.stop() observation.') : 0;

		if (mainOwm.observationJob) {
			mainOwm.observationJob.stop();
			mainOwm.observationJob = null;
		}
	},

	/** 
	 * @func storeData
	 * @desc persistをDBに保存する
	 */
	storeData: function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOwm.storeData().') : 0;

		if (persist) {
			weatherModel.create({
				dateTime: dt,
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

	/** @func setConfig
	 *  @desc 設定の保存
	 *  @async
	 *  @param {config} [_config]
	 *  @return {void}
	 */
	setConfig: async function (_config) {
		if (_config) {
			config = mergeDeeply(config, _config);
		}
		store.set('config.OWM', config);

		sendIPCMessage("renewOwmConfigView", config);  // 保存したので画面に通知
		sendIPCMessage("configSaved", 'OWM');  // 保存したので画面に通知
	},

	/** @func getConfig
	 *  @desc 設定を別で参照
	 *  @param {void}
	 *  @return {void}
	 */
	getConfig: function () {
		return config;
	},

	/** @func getPersist
	 *  @desc 受信データの保存
	 *  @param {void}
	 *  @return {void}
	 */
	getPersist: function () {
		return persist;
	}

};


module.exports = mainOwm;
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
