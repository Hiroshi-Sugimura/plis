//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainHue
 */

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import Hue from 'hue-handler';
import { store } from './storeSingleton.mjs';
import localDB from './models/localDBModels.mjs';   // DBデータと連携
const { Sequelize, sqlite3, huerawModel } = localDB;
import { objectSort, getNow, formatDate, getTodayDate, getYesterdayDate, getToday, isObjEmpty, mergeDeeply } from './mainSubmodule.mjs';
import cron from 'node-cron';
import { logger } from './logger.mjs';

let sendIPCMessage = null;

// const store = new Store();

/**
 * Hue設定
 * @typedef {Object} HueConfig
 * @property {boolean} enabled 機能有効
 * @property {string} key Bridge APIキー
 * @property {boolean} connected リンク完了状態
 * @property {boolean} debug デバッグログ
 */
let config = /** @type {HueConfig} */ ({
	enabled: false,
	key: "",
	connected: false,
	debug: false
});

/** @typedef {{[key:string]:any}} HuePersist */
let persist = /** @type {HuePersist} */ ({});

//////////////////////////////////////////////////////////////////////
// config
let mainHue = {
	callback: null,
	task: null,
	isRun: false,

	//////////////////////////////////////////////////////////////////////
	// Philips hueの処理
	/**
	 * 起動: 設定ロード/前回状態再送。二重起動時は保持データのみ再送。
	 * @param {(ch:string,...args:any[])=>void} _sendIPCMessage IPC送信用
	 * @returns {Promise<void>}
	 */
	// interfaces
	start: async function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		if (mainHue.isRun) {  // 重複起動対応
			if (!isObjEmpty(persist)) {
				sendIPCMessage("HueLinked", config.key);
				sendIPCMessage("renewHueConfigView", config);
				sendIPCMessage("fclHue", persist);
			}
			return;
		}

		config.enabled = store.get('config.Hue.enabled', false);
		config.key = store.get('config.Hue.key', '');
		config.connected = store.get('config.Hue.connected', false);
		config.debug = store.get('config.Hue.debug', false);
		persist = store.get('persist.Hue', {});

		sendIPCMessage("renewHueConfigView", config);  // 設定を画面に表示する

		logger.debug('mainHue', config.debug, 'start():\x1b[32m', config, '\x1b[0m');

		if (!config.enabled) {
			logger.debug('mainHue', config.debug, 'start() enabled is false.');
			mainHue.isRun = false;
			return;
		}

		mainHue.isRun = true;


		// 起動時にはkeyはconfigから、実行時には機能有効にするタイミングのGUIから持ってくる
		// 無ければ''として、新規key取得
		mainHue.startCore(async (newkey) => {  // Linked callback
			sendIPCMessage("HueLinked", newkey);
			config.connected = true;
			if (config.key != newkey) { // configから、keyの変動があったら保存
				config.key = newkey;
				await mainHue.setConfig(config);
			}
		},
			async (json) => {  // changed callback
				try {
					if (json != '') {
						persist = JSON.parse(json);
						if (!isObjEmpty(persist)) {
							sendIPCMessage("fclHue", persist);
							await huerawModel.create({ detail: json });
						}
					}
				} catch (error) {
					logger.error('mainHue', 'changed callback error:', error);
				}
			});

		if (!isObjEmpty(persist)) {  // リンクしなくても、旧情報あれば一回送る
			sendIPCMessage("fclHue", persist);
		}
	},

	/**
	 * 保存あり停止。接続済みならpersist保存し監視停止、未接続ならキャンセル。
	 * @returns {Promise<void>}
	 */
	stop: async function () {
		mainHue.isRun = false;
		logger.debug('mainHue', config.debug, 'stop()');

		if (config.connected) {
			await store.set('persist.Hue', persist);
			await mainHue.stopObserve();
		} else {
			await mainHue.cancel();
		}
	},

	/**
	 * 保存なし停止。監視停止/キャンセルのみ。
	 * @returns {Promise<void>}
	 */
	stopWithoutSave: async function () {
		mainHue.isRun = false;
		logger.debug('mainHue', config.debug, 'stopWithoutSave()');

		if (config.connected) {
			await mainHue.stopObserve();
		} else {
			await mainHue.cancel();
		}
	},

	/**
	 * ライト制御: Hue RESTへ状態送信。
	 * @param {string} _url Hue APIエンドポイント
	 * @param {Record<string,any>} _json 送信ボディ
	 */
	control: function (_url, _json) {
		Hue.setState(_url, JSON.stringify(_json));
	},

	/**
	 * 設定をマージし保存/UI通知。
	 * @param {Partial<HueConfig>} _config
	 * @returns {Promise<void>}
	 */
	setConfig: async function (_config) {
		config = mergeDeeply(config, _config);
		await store.set('config.Hue', config);
		sendIPCMessage("renewHueConfigView", config);
		sendIPCMessage("configSaved", 'Hue');  // 保存したので画面に通知
	},

	/** 現在設定を返す。
	 * @returns {HueConfig} */
	getConfig: function () {
		return config;
	},

	/** 現在の保持データを返す。
	 * @returns {HuePersist} */
	getPersist: function () {
		return persist;
	},

	//////////////////////////////////////////////////////////////////////
	/**
	 * Hueライブラリ受信コールバック。成功レスポンスなら状態再取得、施設一覧更新時UI送信。
	 * @param {string} gwIP ゲートウェイIP
	 * @param {any} response ライブラリからのレスポンス
	 * @param {Error=} error エラー
	 */
	received: function (gwIP, response, error) {
		if (error) {
			logger.error('mainHue', 'received() error:', error, 'GW:', gwIP);
			return;
		}

		switch (response) {
			case 'Canceled':
				logger.debug('mainHue', config.debug, 'initialize is canceled.');
				break;

			case 'Linking':
				logger.debug('mainHue', config.debug, 'Please push Link button.');
				break;

			default:
				// setが成功するとsuccessなので、一旦Getしておく
				if (response[0] && response[0].success) {
					Hue.getState();
				} else {
					if (mainHue.callback) mainHue.callback(JSON.stringify(Hue.facilities));
					logger.debug('mainHue', config.debug, 'received() facilities:\x1b[32m', Hue.facilities, '\x1b[0m');
				}
		}
	},

	/** 何もしないダミーコールバック */
	dummy: function (json) {
		// console.dir(json);
	},


	/**
	 * Hue初期化と監視開始。キー取得しlinked_cbに渡す。変化時change_cb。
	 * @param {(key:string)=>void} linked_cb リンク完了コールバック
	 * @param {(json:string)=>void} change_cb 施設変化コールバック(JSON文字列)
	 * @returns {Promise<string>} 取得済みキー
	 */
	startCore: async function (linked_cb, change_cb) {
		mainHue.callback = change_cb || mainHue.dummy;

		logger.debug('mainHue', config.debug, 'startCore() option:\x1b[32m', config, '\x1b[0m');

		try {
			config.key = await Hue.initialize(config.key, mainHue.received, { debugMode: config.debug });
			if (config.key == '') {
				logger.debug('mainHue', config.debug, 'startCore(), cancel or no key.');
			} else {
				mainHue.startObserve();
			}
			linked_cb(config.key);

		} catch (e) {
			logger.error('mainHue', 'startCore() error:', e);
		}

		return config.key;
	},

	/** Hue初期化キャンセル。 */
	cancel: function () {
		Hue.initializeCancel();
	},


	/**
	 * 1分毎に状態取得し変化を拾う監視タスク開始。
	 */
	startObserve: function () {
		logger.debug('mainHue', config.debug, 'startObserve().');

		if (config.key == undefined || config.key == '') { // 設定されてないのにobserveされないようにする
			return;
		}

		// Hue.bridge.ipaddress が解決できないと axios が http://undefined/... へ飛んで ENOTFOUND になるため防御
		if (!Hue?.bridge?.ipaddress) {
			logger.error('mainHue', 'startObserve() skipped: bridge ipaddress is undefined. Link the bridge first.');
			return;
		}

		// Hue.facilitiesの定期的監視，変化があればUIに送る
		mainHue.task = cron.schedule('0 */1 * * * *', async () => {  // １分毎
			try {
				await Hue.getState();
			} catch (e) {
				if (e.code === 'ETIMEDOUT' || e.code === 'EHOSTUNREACH' || e.code === 'ECONNABORTED') {
					logger.error('mainHue', `task cron Connection Error (Timeout/Unreachable): ${e.code}`);
				} else {
					logger.error('mainHue', 'task cron error:', e);
				}
				// ブリッジ未解決時はこれ以上リトライせず停止する
				if (e?.code === 'ENOTFOUND' || e?.hostname === 'undefined') {
					mainHue.stopObserve();
				}
			}
		});

		mainHue.task.start();
	},

	/** 監視タスク停止。 */
	stopObserve: async function () {
		logger.debug('mainHue', config.debug, 'stopObserve().');

		if (mainHue.task) {
			mainHue.task.stop();
			mainHue.task = null;
		}
	}
};

// module.exports = mainHue;
export { mainHue };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
