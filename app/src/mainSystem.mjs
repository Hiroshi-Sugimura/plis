//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainSystem
 */

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import Store from 'electron-store';
import { objectSort, getNow, getToday, isObjEmpty, mergeDeeply } from './mainSubmodule.cjs';

import { fileURLToPath } from "node:url";
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 基礎設定
const appDir = process.env.NODE_ENV === 'development' ? __dirname : __dirname;
let sendIPCMessage = null;
const store = new Store();

/**
 * @typedef {Object} SystemConfig
 * @property {'window'|'user'} screenMode 表示モード
 * @property {number} windowWidth ウィンドウ幅
 * @property {number} windowHeight ウィンドウ高さ
 * @property {number} resultExpireDays 結果保持日数
 * @property {number} ellogExpireDays ログ保持日数
 * @property {0|4|6} IPver IPバージョン指定（0=auto）
 * @property {string} IPv4 IPv4アドレス
 * @property {string} IPv6 IPv6アドレス
 * @property {boolean} debug デバッグログ
 */
/** @type {SystemConfig} */
let config = {  // config.system
	screenMode: 'window',
	windowWidth: 1024,
	windowHeight: 768,
	resultExpireDays: 365,
	ellogExpireDays: 30,
	IPver: 0,
	IPv4: '',
	IPv6: '',
	debug: false
};


//////////////////////////////////////////////////////////////////////
// EL関連
let mainSystem = {

	/**
	* 設定をstoreから読み込み、起動する。
	* @param {(channel:string, ...args:any[])=>void} _sendIPCMessage IPC送信用関数
	* @returns {Promise<void>}
	*/
	start: async function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;
		// config.system
		config.screenMode = await store.get('config.system.screenMode', config.screenMode);
		config.windowWidth = await store.get('config.system.windowWidth', config.windowWidth);
		config.windowHeight = await store.get('config.system.windowHeight', config.windowHeight);
		config.resultExpireDays = await store.get('config.system.resultExpireDays', config.resultExpireDays);
		config.ellogExpireDays = await store.get('config.system.ellogExpireDays', config.ellogExpireDays);
		config.IPver = await store.get('config.system.IPver', config.IPver);
		config.IPv4 = await store.get('config.system.IPv4', config.IPv4);
		config.IPv6 = await store.get('config.system.IPv6', config.IPv6);
		config.debug = await store.get('config.system.debug', config.debug);

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSystem.start()') : 0;
	},

	/**
	 * 現在の設定を保存して停止する。
	 * @returns {Promise<void>}
	*/
	stop: async function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSystem.stop()') : 0;
		await mainSystem.setConfig(config);
	},

	/**
	 * 設定をディープマージして保存、UIを更新する。
	 * @param {Partial<SystemConfig>=} _config 変更したい設定
	 * @returns {Promise<void>}
	*/
	setConfig: async function (_config) {
		if (_config) {
			config = mergeDeeply(config, _config);
		}
		await store.set('config.system', config);
		sendIPCMessage("renewSystemConfigView", config);
		sendIPCMessage("configSaved", 'System');
	},

	/**
	 * 現在の設定を返す。
	 * @returns {SystemConfig}
	*/
	getConfig: function () {
		return config;
	}
};

// module.exports = mainSystem;
export { mainSystem };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
