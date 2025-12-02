//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainIkea
 */
// 'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import Store from 'electron-store';
import TF from 'tradfri-handler';
import cron from 'node-cron';
import localDB from './models/localDBModels.cjs';   // DBデータと連携
const { ikeaRawModel, ikeaDataModel } = localDB;
import { isObjEmpty, mergeDeeply } from './mainSubmodule.cjs';

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

const store = new Store();

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
	 * 保存して機能終了。
	 * @returns {Promise<void>}
	 */
	stop: async function () {
		mainIkea.isRun = false;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.stop()') : 0;

		await mainIkea.stop();

		await mainIkea.setConfig();
		await store.set('persist.Ikea', persist);
	},

	/**
	 * 保存せずに機能終了。
	 * @returns {Promise<void>}
	 */
	stopWithoutSave: async function () {
		mainIkea.isRun = false;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.stopWithoutSave()') : 0;

		await mainIkea.stop();
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
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.control() key:', key, ', type:', type, ', command:', command) : 0;
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
			console.log('-- received error');
			console.error(error);
			return;
		}

		// 要求したら一度だけ受信処理する
		if (mainIkea.isRequested == true) {
			if (device.type === TF.AccessoryTypes.blind) {
				// ブラインドは取得すると現在値をとってしまうので無視する（より良い方法がある？）
			} else {
				persist = TF.facilities;
				sendIPCMessage("fclIkea", persist);
			}
		}
		mainIkea.isRequested = false;
	},


	/**
	 * facilitiesの変化監視開始。変化検出時persistをUIとDBへ反映。
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
	 * デバイスタイプごとに意味のある形へ抜粋しDBへ保存。
	 * @returns {Promise<void>}
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
	 * 内部：監視ジョブ停止とTradfri接続リリース。
	 * @returns {Promise<void>}
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



// module.exports = mainIkea;
export { mainIkea };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
