//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainUser
 */

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import Store from 'electron-store';
import { mergeDeeply } from './mainSubmodule.cjs';

import { fileURLToPath } from "node:url";
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 基礎設定
const appDir = process.env.NODE_ENV === 'development' ? __dirname : __dirname;
let sendIPCMessage = null;
const store = new Store();

/**
 * @type {{
 *  nickname: 'user',
 *  height: '165',
 *  weight: '65',
 *  age: '40',
 *  ampere: '30',
 *  debug: false
 * }}
 */

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
	 * @async
	 * @function start
	 * @param {Function} _sendIPCMessage - sendIPCMessage
	 * @return {Promise<void>}
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

	/**
	 * @async
	 * @function stop
	 * @return {Promise<void>}
	 */
	stop: async function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainUser.stop()') : 0;
		await mainUser.setConfig(config);
	},

	/**
	 * @async
	 * @function setConfig
	 * @param {Object} _config
	 * @return {Promise<void>}
	 */
	setConfig: async function (_config) {
		if (_config) {
			config = mergeDeeply(config, _config);
		}
		await store.set('config.user', config);

		sendIPCMessage("renewUserConfigView", config);
		sendIPCMessage("configSaved", "User");
	},

	/**
	 * @async
	 * @function getConfig
	 * @return {config} config
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
