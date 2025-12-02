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
import { Sequelize, sqlite3, arpModel } from './models/localDBModels.cjs';   // DBデータと連携

/**
 * @typedef {Object} ArpConfig
 * @property {boolean} enabled 機能有効
 * @property {boolean} debug デバッグログ
 */
/**
 * @typedef {Array<{ip:string, mac:string}>} ArpTable
 */
/**
 * @typedef {ArpTable} ArpPersist
 */
/**
 * @callback SendIPCMessage
 * @param {string} channel
 * @param {any} payload
 */


const store = new Store();
/** @type {ArpConfig} */
let config = {
	enabled: true,  // 機能の有効化
	debug: false
};

/** @type {ArpPersist} */
let persist = {};


let sendIPCMessage = null;

//////////////////////////////////////////////////////////////////////
let mainArp = {
	isRun: false,  // 機能が利用可能になったか？
	/** @type {ArpTable|null} */
	table: null,
	/** @type {cron.ScheduledTask|null} */
	observationJob: null,

	//////////////////////////////////////////////////////////////////////
	// 内部

	/**
	 * IPからMACアドレスへ変換（現在保持するARPテーブル使用）。
	 * @param {string} IP IPv4/IPv6
	 * @returns {string} MAC or 'unknown'
	 */
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
	 * ARP取得開始。重複起動時は何もしない。
	 * @param {SendIPCMessage} _sendIPCMessage
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
	/** 停止しcron解除（保存あり）。 */
	stop: async function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.stop()') : 0;
		mainArp.isRun = false;
		config.enabled = false;

		await mainArp.stopObservation();
	},

	/** 保存せず停止。 */
	stopWithoutSave: async function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.stopWithoutSave()') : 0;
		mainArp.isRun = false;
		config.enabled = false;

		await mainArp.stopObservation();
	},

	/** 監視cron停止。 */
	stopObservation: async function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.stopObserve() observation.') : 0;

		if (mainArp.observationJob) {
			await mainArp.observationJob.stop();
			mainArp.observationJob = null;
		}
	},


	// interfaces
	/** 設定/持続データ保存。 */
	setConfig: async function () {
		await store.set('config.Arp', config);
		await store.set('persist.Arp', persist);
	},

	/** 現在設定取得。
	 * @returns {ArpConfig}
	 */
	getConfig: function () {
		return config;
	},

	/** 現在persist取得。
	 * @returns {ArpPersist}
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
