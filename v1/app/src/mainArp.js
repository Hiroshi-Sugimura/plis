//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainArp
 */
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const Store = require('electron-store');
const arp = require('@network-utils/arp-lookup');
const cron = require('node-cron');
require('date-utils'); // for log
const { Sequelize, sqlite3, arpModel } = require('./models/localDBModels');   // DBデータと連携

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

	// arpテーブル検索，IPからMACアドレスに変換
	toMAC: function(IP) {  //  IP = '192.168.2.192'
		if( IP == '224.0.23.0' || IP == 'FF02::1' ) {
			return 'Multicast(EL)';
		}

		if( !mainArp.isRun || mainArp.table == undefined || mainArp.table == null ) {
			return 'unknown';
		}


		let foundRow = mainArp.table.find( (row) => {
			if( row.ip==IP ) {
				true;
			}
		} );

		if( foundRow == undefined ) {
			return 'unknown';
		}else{
			return foundRow.mac;
		}
	},


	//////////////////////////////////////////////////////////////////////
	// 定時処理のインタフェース、監視開始
	start: async function(_sendIPCMessage ) {
		sendIPCMessage = _sendIPCMessage;
		if( mainArp.isRun ) {
			return;
		}
		mainArp.isRun = true;

		config.enabled    = store.get('config.Arp.enabled', true);
		config.debug      = store.get('config.Arp.debug',   false);
		persist           = store.get('persist.Arp', {});

		if( !config.enabled ) {
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.start() disabled.' ):0;
			return;
		}

		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.start() config:\x1b[32m', config, '\x1b[0m' ):0;

		if( mainArp.observationJob ) {
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.observe() already started.' ):0;
		}

		mainArp.table = await arp.getTable();  // 監視前に一度実施
		mainArp.isRun = true;

		// 監視はcronで実施、10分毎
		mainArp.observationJob = cron.schedule('*/10 * * * *', async () => {
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.cron.schedule()'):0;

			if( config.enabled ) {
				mainArp.table   = await arp.getTable();
				persist = mainArp.table;
				arpModel.create( { detail: JSON.stringify(persist) } );
			}
		})
	},


	// 停止
	stop: async function () {
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.stop()'):0;
		mainArp.isRun = false;
		config.enabled = false;

		await mainArp.stopObservation();
	},

	stopWithoutSave: async function () {
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.stopWithoutSave()'):0;
		mainArp.isRun = false;
		config.enabled = false;

		await mainArp.stopObservation();
	},

	// 監視をやめる
	stopObservation: async function() {
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainArp.stopObserve() observation.' ):0;

		if( mainArp.observationJob ) {
			await mainArp.observationJob.stop();
			mainArp.observationJob = null;
		}
	},


	// 設定保存
	setConfig: async function ( ) {
		await store.set('config.Arp', config );
		await store.set('persist.Arp', persist );
	},

	// 設定参照
	getConfig: function () {
		return config;
	},

	getPersist: function() {
		return persist;
	}

};


module.exports = mainArp;
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
