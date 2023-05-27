//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainIkea
 */
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const Store = require('electron-store');
const TF = require('tradfri-handler');
const cron = require('node-cron');
const { Sequelize, sqlite3 } = require('./models/localDBModels');   // DBデータと連携
const { objectSort, getNow, getToday, isObjEmpty, mergeDeeply} = require('./mainSubmodule');

let sendIPCMessage = null;

const store = new Store();

let config = {
	enabled: false,
	securityCode: "",
	identity: "",
	psk: "",
	debug: false
};

let persist = {};


//////////////////////////////////////////////////////////////////////
// config
let mainIkea = {
	callback: null,
	observationJob: null,
	isRun: false,

	//////////////////////////////////////////////////////////////////////
	// interfaces
	start: async function ( _sendIPCMessage ) {
		sendIPCMessage = _sendIPCMessage;

		if( mainIkea.isRun ) { // 重複起動対策
			if( !isObjEmpty(persist) ) {
				sendIPCMessage( "renewIkeaConfigView", config );
				sendIPCMessage( "fclIkea", persist );
			}
			return;
		}

		config.enabled      = store.get('config.Ikea.enabled', false);
		config.securityCode = store.get('config.Ikea.securityCode', '');
		config.identity     = store.get('config.Ikea.identity', '');
		config.psk          = store.get('config.Ikea.psk', '');
		config.debug        = store.get('config.Ikea.debug', false);
		persist = store.get('persist.Ikea', {});
		sendIPCMessage( "renewIkeaConfigView", config );



		if( config.enabled == false ) {
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.start() disabled.'):0;
			mainIkea.isRun = false;
			return;
		}
		mainIkea.isRun = true;

		config.debug? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.start(), config:\x1b[32m', config, '\x1b[0m'):0;

		try{
			let co = await mainIkea.startCore( ( facilities ) => {
				persist = facilities;
				if( !isObjEmpty(persist) ) {
					sendIPCMessage( "fclIKEA", persist  );
				}
			} );

			config.identity = co.identity;
			config.psk = co.psk;
			config.debug? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mianIkea.start() is connected. config:\x1b[32m', config, '\x1b[0m'):0;
			await store.set('config.Ikea', config);

		}catch( error ) {
			console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.start() error:\x1b[32m', error, '\x1b[0m');
			config.enabled = false;
			mainIkea.isRun = false;
			return;
		}

		if( !isObjEmpty(persist) ) {
			sendIPCMessage( "fclIkea", persist );
		}
	},

	stop: async function () {
		mainIkea.isRun = false;

		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.stop()'):0;

		await mainIkea.stop();

		await mainIkea.setConfig();
		await store.set('persist.Ikea', persist);
	},

	stopWithoutSave: async function () {
		mainIkea.isRun = false;

		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.stopWithoutSave()'):0;

		await mainIkea.stop();
	},



	setConfig: async function ( _config ) {
		if( _config ) {
			config = mergeDeeply( config, _config );
		}
		await store.set('config.Ikea', config);

		sendIPCMessage( "renewIkeaConfigView", config );  // 保存したので画面に通知
		sendIPCMessage( "configSaved", 'Ikea' );  // 保存したので画面に通知
	},

	getConfig: function () {
		return config;
	},

	getPersist: function() {
		return persist;
	},


	//////////////////////////////////////////////////////////////////////
	// inner functions
	startCore: async function( callback ) {
		if( !config.securityCode || config.securityCode == "" ) {
			console.error('mainIkea.startCore() config.key is not valid.');
		}

		mainIkea.callback     = callback;

		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.startCore() config::\x1b[32m', config, '\x1b[0m' ):0;

		let ret;
		try{
			ret = await TF.initialize( config.securityCode, mainIkea.received, {identity: config.identity, psk: config.psk, debugMode:config.debug} );
			mainIkea.observe();
			return ret;
		}catch(error){
			console.error( 'mainIkea.startCore() error:\x1b[32m', error, '\x1b[0m');
			throw error;
		}
	},


	// 受信データ処理
	received: function(rIP, device, error) {
		if( error ) {
			console.log('-- received error');
			console.error( error );
			return;
		}

		// if( device.type === AccessoryTypes.lightbulb ) {
		// console.log( device );
		// }
		// console.log('-- received, IP:', rIP, ', device:', device);
	},


	// Ikeaを監視する
	observe: async function( interval ) {
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.observe() start.' ):0;

		if( mainIkea.observationJob ) {
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.observe() already started.' ):0;
		}

		// facilitiesの定期的監視
		let oldVal = JSON.stringify( TF.objectSort(TF.facilities) );
		mainIkea.observationJob = cron.schedule('0 * * * * *', () => {  // 1分毎にautoget、変化があればログ表示
			const newVal = JSON.stringify( TF.objectSort(TF.facilities) );
			if ( oldVal == newVal ) return; // 変化した
			oldVal = newVal;
			mainIkea.callback( TF.facilities );
			// console.log('TF changed, new TF.facilities:', newVal);
		});
		mainIkea.observationJob.start();
	},


	// 監視をやめる、リリースする
	stop: function() {
		config.debug? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainIkea.stop().' ):0;

		if( mainIkea.observationJob ) {
			mainIkea.observationJob.stop();
			mainIkea.observationJob = null;
		}
		TF.release();
	}
};



module.exports = mainIkea;
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
