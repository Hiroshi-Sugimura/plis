//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainUser
 */

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { store } from './storeSingleton.mjs';
import { mergeDeeply } from './mainSubmodule.mjs';

import { fileURLToPath } from "node:url";
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 基礎設定
const appDir = process.env.NODE_ENV === 'development' ? __dirname : __dirname;
let sendIPCMessage = null;
// const store = new Store();

/**
 * @typedef {Object} UserConfig
 * @property {string} nickname ニックネーム
 * @property {string} height 身長(cm)
 * @property {string} weight 体重(kg)
 * @property {string} age 年齢
 * @property {string} ampere 契約アンペア
 * @property {boolean} debug デバッグログ
 */

/** @type {UserConfig} */
let config = {  // config.user
	nickname: 'user',
	height: '165',
	weight: '65',
	age: '40',
	ampere: '30',
	debug: false
};

//////////////////////////////////////////////////////////////////////
// ユーザー設定関連
/**
 * @classdesc mainUser
 */
let mainUser = {

	/**
	 * ユーザー設定の読み込み。UIへ反映は別途。
	 * @param {(ch:string,p:any)=>void} _sendIPCMessage
	 * @returns {Promise<void>}
	 */
	start: async function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		// config.user
		config.nickname = await store.get('config.user.nickname', config.nickname);
		config.height = await store.get('config.user.height', config.height);
		config.weight = await store.get('config.user.weight', config.weight);
		config.age = await store.get('config.user.age', config.age);
		config.ampere = await store.get('config.user.ampere', config.ampere);
		config.debug = await store.get('config.user.debug', config.debug);

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainUser.start()') : 0;
	},

	/** 保存して停止。
	 * @returns {Promise<void>}
	 */
	stop: async function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainUser.stop()') : 0;
		await mainUser.setConfig(config);
	},

	/** 設定をマージ保存。UIへ通知。
	 * @param {Partial<UserConfig>} _config
	 */
	setConfig: async function (_config) {
		if (_config) {
			config = mergeDeeply(config, _config);
		}
		await store.set('config.user', config);

		// sendIPCMessage が未初期化のケース（起動途中/異常終了時）に備えてガード
		if (typeof sendIPCMessage === 'function') {
			sendIPCMessage("renewUserConfigView", config);
			sendIPCMessage("configSaved", "User");
		} else {
			config.debug ? console.warn(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainUser.setConfig() sendIPCMessage not initialized') : 0;
		}
	},

	/** 現在設定取得。
	 * @returns {UserConfig}
	 */
	getConfig: function () {
		return config;
	}
};

// module.exports = mainUser;
export { mainUser };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
