//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainArp
 */
// 'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { store } from './storeSingleton.mjs';
import arp from '@network-utils/arp-lookup';
import cron from 'node-cron';
import localDB from './models/localDBModels.mjs';   // DBデータと連携
const { arpModel } = localDB;
import { objectSort, getNow, formatDate, getTodayDate, getYesterdayDate } from './mainSubmodule.mjs';
import { logger } from './logger.mjs';

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


// const store = new Store();
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
			return row.ip == IP;
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
			logger.debug('mainArp', config.debug, 'start() disabled.');
			return;
		}

		logger.debug('mainArp', config.debug, 'start() config:\x1b[32m', config, '\x1b[0m');

		if (mainArp.observationJob) {
			logger.debug('mainArp', config.debug, 'observe() already started.');
		}

		mainArp.table = await arp.getTable();  // 監視前に一度実施
		mainArp.isRun = true;

		// 監視はcronで実施、10分毎
		mainArp.observationJob = cron.schedule('*/10 * * * *', async () => {
			try {
				logger.debug('mainArp', config.debug, 'cron.schedule()');

				if (config.enabled) {
					mainArp.table = await arp.getTable();
					persist = mainArp.table;
					await arpModel.create({ detail: JSON.stringify(persist) });
				}
			} catch (error) {
				logger.error('mainArp', 'observationJob error:', error);
			}
		})
	},


	// interfaces
	/** 停止しcron解除（保存あり）。 */
	stop: async function () {
		logger.debug('mainArp', config.debug, 'stop()');
		mainArp.isRun = false;
		config.enabled = false;

		await mainArp.stopObservation();
	},

	/** 保存せず停止。 */
	stopWithoutSave: async function () {
		logger.debug('mainArp', config.debug, 'stopWithoutSave()');
		mainArp.isRun = false;
		config.enabled = false;

		await mainArp.stopObservation();
	},

	/** 監視cron停止。 */
	stopObservation: async function () {
		logger.debug('mainArp', config.debug, 'stopObserve() observation.');

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
