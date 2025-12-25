//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainIkea
 */
// 'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { store } from './storeSingleton.mjs';
import TF from 'tradfri-handler';
import cron from 'node-cron';
import localDB from './models/localDBModels.mjs';   // DBデータと連携
const { ikeaRawModel, ikeaDataModel } = localDB;
import { objectSort, getNow, formatDate, getTodayDate, getYesterdayDate, getToday, isObjEmpty, mergeDeeply } from './mainSubmodule.mjs';
import { logger } from './logger.mjs';

/**
 * @typedef {Object} IkeaConfig
 * @property {boolean} enabled 機能が有効か
 * @property {string} securityCode Gatewayのセキュリティコード
 * @property {string} identity Tradfri認証で払い出されるidentity
 * @property {string} psk Tradfri認証で払い出されるpsk
 * @property {boolean} debug デバッグログ出力フラグ
 */
/**
 * @typedef {Object.<string, any>} IkeaPersist
 * @description TF.facilitiesをほぼそのまま保持する。deviceIdをキーにした状態オブジェクト。
 */
/**
 * @callback SendIPCMessage
 * @param {string} channel IPCチャネル名
 * @param {any} payload 送信データ
 */

let sendIPCMessage = null;

// const store = new Store();

/** @type {IkeaConfig} */
let config = {
	enabled: false,
	securityCode: "",
	identity: "",
	psk: "",
	debug: false
};

/** @type {IkeaPersist} */
let persist = {};


//////////////////////////////////////////////////////////////////////
// config
let mainIkea = {
	/** @type {cron.ScheduledTask|null} 監視ジョブ（状態変化監視）*/
	observationJob: null,
	/** @type {cron.ScheduledTask|null} 保存ジョブ（定期DB記録）*/
	storeJob: null,
	/** @type {boolean} 多重起動抑制 */
	isRun: false,
	/** @type {boolean} 受信処理抑制（制御要求後一度だけ受信を評価）*/
	isRequested: false,

	//////////////////////////////////////////////////////////////////////
	/**
	 * Ikea機能を開始するエントリーポイント。重複起動時は現在persist/configをUIへ再送する。
	 * @param {SendIPCMessage} _sendIPCMessage IPC送信関数
	 * @returns {Promise<void>}
	 */
	start: async function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		if (mainIkea.isRun) { // 重複起動対策
			if (!isObjEmpty(persist)) {
				sendIPCMessage("renewIkeaConfigView", config);
				sendIPCMessage("fclIkea", JSON.parse(JSON.stringify(persist)));
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
			logger.debug('mainIkea', config.debug, 'start() disabled.');
			mainIkea.isRun = false;
			return;
		}
		mainIkea.isRun = true;

		logger.debug('mainIkea', config.debug, 'start(), config:\x1b[32m', config, '\x1b[0m');

		try {
			let co = await TF.initialize(config.securityCode, mainIkea.received, { identity: config.identity, psk: config.psk, debugMode: config.debug });
			mainIkea.startObserve();
			config.identity = co.identity;
			config.psk = co.psk;
			logger.debug('mainIkea', config.debug, 'start() is connected. config:\x1b[32m', config, '\x1b[0m');
			await store.set('config.Ikea', config);

		} catch (error) {
			logger.error('mainIkea', 'start() error:', error);
			sendIPCMessage('Error', { datetime: getNow(), moduleName: 'mainIkea.start', stackLog: 'Can not discover and connect gateway. Please check your network connection. And restart PLIS.' });
			config.enabled = false;
			mainIkea.isRun = false;
			throw error;
		}

		if (!isObjEmpty(persist)) {
			sendIPCMessage("fclIkea", JSON.parse(JSON.stringify(persist))); // 起動後に一回画面表示
			await mainIkea.storeData();  // 起動時に一回persistをDB記録
		}
	},


	/**
	 * 保存して機能終了。
	 * @returns {Promise<void>}
	 */
	stop: async function () {
		mainIkea.isRun = false;
		logger.debug('mainIkea', config.debug, 'stop()');

		await mainIkea.stopCore();

		await mainIkea.setConfig();
		await store.set('persist.Ikea', persist);
	},

	/**
	 * 保存せずに機能終了。
	 * @returns {Promise<void>}
	 */
	stopWithoutSave: async function () {
		mainIkea.isRun = false;
		logger.debug('mainIkea', config.debug, 'stopWithoutSave()');

		await mainIkea.stopCore();
	},


	/**
	 * 設定をマージして保存。UIへ更新通知。
	 * @param {Partial<IkeaConfig>} [_config]
	 * @returns {Promise<void>}
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
	 * 現在の設定取得。
	 * @returns {IkeaConfig}
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * 現在のpersist取得。
	 * @returns {IkeaPersist}
	 */
	getPersist: function () {
		return persist;
	},


	/**
	 * デバイス制御要求。成功時は次回callback受信でpersist更新。
	 * @param {string} key deviceId
	 * @param {string} type accessory type
	 * @param {Object} command state command
	 */
	control: function (key, type, command) {
		logger.debug('mainIkea', config.debug, 'control() key:', key, ', type:', type, ', command:', command);
		mainIkea.isRequested = true;
		TF.setState(key, type, command);
	},


	//////////////////////////////////////////////////////////////////////

	/**
	 * Tradfriハンドラからの受信コールバック。制御要求後一度だけpersist更新を反映。
	 * @param {string} rIP 送信元IP
	 * @param {Object} device 受信デバイス情報
	 * @param {Error} error エラー
	 */
	received: function (rIP, device, error) {
		if (error) {
			logger.error('mainIkea', 'received() error:', error);
			return;
		}

		// 要求したら一度だけ受信処理する
		if (mainIkea.isRequested == true) {
			if (device.type === TF.AccessoryTypes.blind) {
				// ブラインドは取得すると現在値をとってしまうので無視する（より良い方法がある？）
			} else {
				persist = TF.facilities;
				sendIPCMessage("fclIkea", JSON.parse(JSON.stringify(persist)));
			}
		}
		mainIkea.isRequested = false;
	},


	/**
	 * facilitiesの変化監視開始。変化検出時persistをUIとDBへ反映。
	 */
	startObserve: function () {
		logger.debug('mainIkea', config.debug, 'startObserve() start.');

		if (mainIkea.observationJob) {
			logger.debug('mainIkea', config.debug, 'startObserve() already started.');
		}

		// facilitiesの定期的監視、変化があれば記録
		let oldValStr = JSON.stringify(objectSort(TF.facilities));
		mainIkea.observationJob = cron.schedule('0 * * * * *', async () => {  // 1分毎にautoget、変化があればログ表示
			try {
				logger.debug('mainIkea', config.debug, 'observationJob each 1min');
				let newValStr = JSON.stringify(objectSort(TF.facilities));
				if (oldValStr == newValStr) return;  // 変化しないので無視
				oldValStr = newValStr;
				persist = TF.facilities;
				if (!isObjEmpty(persist)) {
					sendIPCMessage("fclIkea", JSON.parse(JSON.stringify(persist)));
					await mainIkea.storeData();
				}
			} catch (error) {
				logger.error('mainIkea', 'observationJob error:', error);
			}
		});
		mainIkea.observationJob.start();


		// 3分毎にDB登録、変化がなくても記録
		mainIkea.storeJob = cron.schedule('0 */3 * * * *', async () => {
			try {
				sendIPCMessage("fclIkea", JSON.parse(JSON.stringify(persist)));
				await ikeaRawModel.create({ detail: JSON.stringify(persist) });  // store raw data
			} catch (error) {
				logger.error('mainIkea', 'storeJob error:', error);
			}
		});
		mainIkea.storeJob.start();
	},

	/**
	 * デバイスタイプごとに意味のある形へ抜粋しDBへ保存。
	 * @returns {Promise<void>}
	 */
	storeData: async function () {
		// logger.debug('mainIkea', config.debug, 'storeData() persist:', persist);
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
						await ikeaDataModel.create({
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
						await ikeaDataModel.create({
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
						await ikeaDataModel.create({
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
						await ikeaDataModel.create({
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
						logger.debug('mainIkea', config.debug, 'unknown device type in IKEA:dev:', d, ' detail:', det);
						break;
				}

			} catch (error) {
				sendIPCMessage('Error', { datetime: getNow(), moduleName: 'mainIkea.storeData', stackLog: `${error.message}, d:${d}` });
				logger.error('mainIkea', 'storeData() error:', error, 'd:', d);
			}

		}
	},


	/**
	 * 内部：監視ジョブ停止とTradfri接続リリース。
	 * @returns {Promise<void>}
	 */
	stopCore: async function () {
		logger.debug('mainIkea', config.debug, 'stopCore().');

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



// module.exports = mainIkea;
export { mainIkea };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
