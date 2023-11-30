//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainIkea
 */
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const Store = require('electron-store');
const TF = require('tradfri-handler');
const cron = require('node-cron');
const { ikeaRawModel, ikeaDataModel } = require('./models/localDBModels');   // DBデータと連携
const { isObjEmpty, mergeDeeply } = require('./mainSubmodule');

let sendIPCMessage = null;

const store = new Store();

let config = {
	enabled: false,
	securityCode: "",
	identity: "",
	psk: "",
	debug: false
};

let persist = {};


//////////////////////////////////////////////////////////////////////
// config
let mainIkea = {
	/** 監視ジョブ */
	observationJob: null,
	/** 監視ジョブ */
	storeJob: null,
	/** 多重起動抑制 */
	isRun: false,
	/** 受信処理抑制 */
	isRequested: false,

	//////////////////////////////////////////////////////////////////////
	/**
	 * @func start
	 * @desc start
	 * @async
	 * @param {Function} _sendIPCMessage
	 * @throw error
	 */
	start: async function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		if (mainIkea.isRun) { // 重複起動対策
			if (!isObjEmpty(persist)) {
				sendIPCMessage("renewIkeaConfigView", config);
				sendIPCMessage("fclIkea", persist);
			}
			return;
		}

		config.enabled = store.get('config.Ikea.enabled', false);
		config.securityCode = store.get('config.Ikea.securityCode', '');
		config.identity = store.get('config.Ikea.identity', '');
		config.psk = store.get('config.Ikea.psk', '');
		config.debug = store.get('config.Ikea.debug', false);
		persist = store.get('persist.Ikea', {});
		sendIPCMessage("renewIkeaConfigView", config);

		if (config.enabled == false) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.start() disabled.') : 0;
			mainIkea.isRun = false;
			return;
		}
		mainIkea.isRun = true;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.start(), config:\x1b[32m', config, '\x1b[0m') : 0;

		try {
			let co = await TF.initialize(config.securityCode, mainIkea.received, { identity: config.identity, psk: config.psk, debugMode: config.debug });
			mainIkea.startObserve();
			config.identity = co.identity;
			config.psk = co.psk;
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mianIkea.start() is connected. config:\x1b[32m', config, '\x1b[0m') : 0;
			await store.set('config.Ikea', config);

		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.start() error:\x1b[32m', error, '\x1b[0m');
			sendIPCMessage('Error', { datetime: new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), moduleName: 'mainIkea.start', stackLog: 'Can not discover and connect gateway. Please check your network connection. And restart PLIS.' });
			config.enabled = false;
			mainIkea.isRun = false;
			throw error;
		}

		if (!isObjEmpty(persist)) {
			sendIPCMessage("fclIkea", persist); // 起動後に一回画面表示
			mainIkea.storeData();  // 起動時に一回persistをDB記録
		}
	},


	/**
	 * @func stop
	 * @desc 保存して機能終了
	 * @async
	 * @throw error
	 */
	stop: async function () {
		mainIkea.isRun = false;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.stop()') : 0;

		await mainIkea.stop();

		await mainIkea.setConfig();
		await store.set('persist.Ikea', persist);
	},

	/**
	 * @func stopWithoutSave
	 * @desc 保存しないで機能終了
	 * @async
	 * @throw error
	 */
	stopWithoutSave: async function () {
		mainIkea.isRun = false;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.stopWithoutSave()') : 0;

		await mainIkea.stop();
	},


	/**
	 * @func setConfig
	 * @desc configの変更と保存
	 * @async
	 * @param {object} _config - nullable
	 * @throw error
	 */
	setConfig: async function (_config) {
		if (_config) {
			config = mergeDeeply(config, _config);
		}
		await store.set('config.Ikea', config);

		sendIPCMessage("renewIkeaConfigView", config);  // 保存したので画面に通知
		sendIPCMessage("configSaved", 'Ikea');  // 保存したので画面に通知
	},

	/**
	 * @func getConfig
	 * @desc Config取得
	 * @return {Object} config
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * @func getPersist
	 * @desc Persist取得
	 * @return {Object} persist
	 */
	getPersist: function () {
		return persist;
	},


	/**
	 * @func control
	 * @desc デバイスの制御
	 * @param {string} key
	 * @param {string} type
	 * @param {object} command
	 */
	control: function (key, type, command) {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.control() key:', key, ', type:', type, ', command:', command) : 0;
		mainIkea.isRequested = true;
		TF.setState(key, type, command);
	},


	//////////////////////////////////////////////////////////////////////

	/**
	 * @func received
	 * @desc 内部関数、受信データ処理、callbackで呼ばれる
	 * @param {string} rIP
	 * @param {Object} device
	 * @param {Error} error
	 * @throw error
	 */
	received: function (rIP, device, error) {
		if (error) {
			console.log('-- received error');
			console.error(error);
			return;
		}
		// 要求したら一度だけ受信処理する
		if (mainIkea.isRequested == true) {
			persist = TF.facilities;
			sendIPCMessage("fclIkea", persist);
		}
		mainIkea.isRequested = false;
	},


	/**
	 * @func startObserve
	 * @desc Ikeaを監視開始
	 * @throw error
	 */
	startObserve: function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.startObserve() start.') : 0;

		if (mainIkea.observationJob) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.startObserve() already started.') : 0;
		}

		// facilitiesの定期的監視、変化があれば記録
		let oldValStr = JSON.stringify(TF.objectSort(TF.facilities));
		mainIkea.observationJob = cron.schedule('0 * * * * *', () => {  // 1分毎にautoget、変化があればログ表示
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.startObserve().cron() each 1min') : 0;
			let newValStr = JSON.stringify(TF.objectSort(TF.facilities));
			if (oldValStr == newValStr) return;  // 変化しないので無視
			persist = TF.facilities;
			if (!isObjEmpty(persist)) {
				sendIPCMessage("fclIkea", persist);
				mainIkea.storeData();
			}
			// console.log('TF changed, new TF.facilities:', newVal);
		});
		mainIkea.observationJob.start();


		// 3分毎にDB登録、変化がなくても記録
		mainIkea.storeJob = cron.schedule('0 */3 * * * *', () => {
			sendIPCMessage("fclIkea", persist);
			ikeaRawModel.create({ detail: JSON.stringify(persist) });  // store raw data
		});
		mainIkea.storeJob.start();
	},

	/**
	 * @async
	 * @function storeData
	 * @desc 内部関数：デバイスタイプごとにステータスの読見方を変えてDBにためる
	*/
	storeData: async function () {
		// config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.storeData() persist:', persist) : 0;
		for (let d in persist) {
			let det = persist[d];
			// console.log('Ikea:dev:', d, ' detail:', det);

			if (!det) { continue; }  // 詳細の無いデバイスは保存しない。continueで次のデバイスへ。

			let name = det.name;
			let type = det.type;
			let alive = det.alive;
			let info = det.deviceInfo;
			let power = info.power;
			let battery = info.battery;

			try {
				switch (det.type) {
					case 0:  // remote controller
						ikeaDataModel.create({
							deviceId: d,
							deviceType: type,
							deviceName: name,
							alive: alive,
							power: power,
							battery: battery,
							list: JSON.stringify(det.switchList)
						});
						break;
					case 2: // bulb
						// console.log('subIkea.js, bulb value:', value);
						ikeaDataModel.create({
							deviceId: d,
							deviceType: type,
							deviceName: name,
							alive: alive,
							power: power,
							battery: battery,
							list: JSON.stringify(det.lightList)
						});
						break;
					case 6: // signal repeater
						// console.log('subIkea.js, signal repeater value:', value);
						ikeaDataModel.create({
							deviceId: d,
							deviceType: type,
							deviceName: name,
							alive: alive,
							power: power,
							battery: battery,
							list: JSON.stringify(det.repeaterList)
						});
						break;
					case 7: // blind
						// console.log('subIkea.js, bulb value:', value);
						ikeaDataModel.create({
							deviceId: d,
							deviceType: type,
							deviceName: name,
							alive: alive,
							power: power,
							battery: battery,
							list: JSON.stringify(det.blindList)
						});
						break;

					default:
						console.log('unknown device in SwitchBot:dev:', d, ' detail:', det);
						break;
				}

			} catch (error) {
				sendIPCMessage('Error', { datetime: new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), moduleName: 'mainIkea', stackLog: `${error.message}, d:${d}, det:${det}` });
				console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.storeData() error:\x1b[32m', error, 'Ikea:dev:', d, ' detail:', det, '\x1b[0m');
				throw error;
			}

		}
	},


	/**
	 * @func stop
	 * @desc 監視をやめる、リリースする
	 * @async
	 * @throw error
	 */
	stop: async function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.stop().') : 0;

		if (mainIkea.observationJob) {
			await mainIkea.observationJob.stop();
			mainIkea.observationJob = null;
		}

		if (mainIkea.storeJob) {
			await mainIkea.storeJob.stop();
			mainIkea.storeJob = null;
		}

		await TF.release();
	}
};



module.exports = mainIkea;
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
