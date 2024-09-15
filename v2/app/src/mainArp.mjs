//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainArp
 */
// 'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import Store from 'electron-store';
import arp from '@network-utils/arp-lookup';
import cron from 'node-cron';
import * as dateUtils from 'date-utils';
import { Sequelize, sqlite3, arpModel } from './models/localDBModels.cjs';   // DBデータと連携


const store = new Store();
let config = {
	enabled: true,  // 機能の有効化
	debug: false
};

let persist = {};


let sendIPCMessage = null;

//////////////////////////////////////////////////////////////////////
let mainArp = {
	isRun: false,  // 機能が利用可能になったか？
	table: null,
	observationJob: null,

	//////////////////////////////////////////////////////////////////////
	// 内部

	/**
	 * @func toMAC
	 * @desc IP address to MAC address
	 * @async
	 * @throw error
	 */
	// arpテーブル検索，IPからMACアドレスに変換
	toMAC: function (IP) {  //  IP = '192.168.2.192'
		if (IP == '224.0.23.0' || IP == 'FF02::1') {
			return 'Multicast(EL)';
		}

		if (!mainArp.isRun || mainArp.table == undefined || mainArp.table == null) {
			return 'unknown';
		}


		let foundRow = mainArp.table.find((row) => {
			if (row.ip == IP) {
				true;
			}
		});

		if (foundRow == undefined) {
			return 'unknown';
		} else {
			return foundRow.mac;
		}
	},


	//////////////////////////////////////////////////////////////////////
	// interfaces
	/**
	 * @func start
	 * @desc 定時処理のインタフェース、監視開始
	 * @async
	 * @throw error
	 */
	start: async function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;
		if (mainArp.isRun) {
			return;
		}
		mainArp.isRun = true;

		config.enabled = store.get('config.Arp.enabled', true);
		config.debug = store.get('config.Arp.debug', false);
		persist = store.get('persist.Arp', {});

		if (!config.enabled) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.start() disabled.') : 0;
			return;
		}

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.start() config:\x1b[32m', config, '\x1b[0m') : 0;

		if (mainArp.observationJob) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.observe() already started.') : 0;
		}

		mainArp.table = await arp.getTable();  // 監視前に一度実施
		mainArp.isRun = true;

		// 監視はcronで実施、10分毎
		mainArp.observationJob = cron.schedule('*/10 * * * *', async () => {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.cron.schedule()') : 0;

			if (config.enabled) {
				mainArp.table = await arp.getTable();
				persist = mainArp.table;
				arpModel.create({ detail: JSON.stringify(persist) });
			}
		})
	},


	// interfaces
	/**
	 * @func stop
	 * @desc 停止
	 * @async
	 * @throw error
	 */
	stop: async function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.stop()') : 0;
		mainArp.isRun = false;
		config.enabled = false;

		await mainArp.stopObservation();
	},

	/**
	 * @func stopWithoutSave
	 * @desc stopWithoutSave
	 * @async
	 * @throw error
	 */
	stopWithoutSave: async function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.stopWithoutSave()') : 0;
		mainArp.isRun = false;
		config.enabled = false;

		await mainArp.stopObservation();
	},

	/**
	 * @func stopObservation
	 * @desc 監視をやめる
	 * @async
	 * @throw error
	 */
	stopObservation: async function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.stopObserve() observation.') : 0;

		if (mainArp.observationJob) {
			await mainArp.observationJob.stop();
			mainArp.observationJob = null;
		}
	},


	// interfaces
	/**
	 * @func setConfig
	 * @desc 設定保存
	 * @async
	 * @throw error
	 */
	setConfig: async function () {
		await store.set('config.Arp', config);
		await store.set('persist.Arp', persist);
	},

	/**
	 * @func getConfig
	 * @desc 設定参照
	 * @async
	 * @throw error
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * @func getPersist
	 * @desc getPersist
	 * @async
	 * @throw error
	 */
	getPersist: function () {
		return persist;
	}

};


// module.exports = mainArp;
export { mainArp };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
