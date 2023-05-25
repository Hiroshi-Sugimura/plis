//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const Hue = require('hue-handler');
const Store = require('electron-store');
const { Sequelize, sqlite3, huerawModel } = require('./models/localDBModels');   // DBデータと連携
const { objectSort, getNow, getToday, isObjEmpty, mergeDeeply} = require('./mainSubmodule');
const cron = require('node-cron');

let sendIPCMessage = null;

const store = new Store();

let config = {
	enabled: false,
	key: "",
	connected: false,
	debug: false
};

let persist = {};

//////////////////////////////////////////////////////////////////////
// config
let mainHue = {
	callback: null,
	task: null,
	isRun: false,

	//////////////////////////////////////////////////////////////////////
	// Philips hueの処理

	// interfaces
	start: async function ( _sendIPCMessage ) {
		sendIPCMessage = _sendIPCMessage;

		if( mainHue.isRun ) {  // 重複起動対応
			if( !isObjEmpty(persist) ) {
				sendIPCMessage( "HueLinked", config.key );
				sendIPCMessage( "renewHueConfigView", config );
				sendIPCMessage( "fclHue", persist );
			}
			return;
		}

		config.enabled    = store.get('config.Hue.enabled', false);
		config.key        = store.get('config.Hue.key', '');
		config.connected  = store.get('config.Hue.connected', false);
		config.debug      = store.get('config.Hue.debug', false);
		persist           = store.get('persist.Hue', {});

		sendIPCMessage( "renewHueConfigView", config );  // 設定を画面に表示する

		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHue.start():\x1b[32m', config, '\x1b[0m'):0;

		if( !config.enabled ) {
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHue.start() enabled is false.' ):0;
			mainHue.isRun = false;
			return;
		}

		mainHue.isRun = true;


		// 起動時にはkeyはconfigから、実行時には機能有効にするタイミングのGUIから持ってくる
		// 無ければ''として、新規key取得
		mainHue.startCore( async (newkey) =>
						   {  // Linked callback
							   sendIPCMessage( "HueLinked", newkey );
							   config.connected = true;
							   if( config.key != newkey ) { // configから、keyの変動があったら保存
								   config.key = newkey;
								   await mainHue.setConfig( config );
							   }
						   },
						   (json) => {  // changed callback
							   if( json != '' ) {
								   persist = JSON.parse(json);
								   if( !isObjEmpty(persist) ) {
									   sendIPCMessage( "fclHue", persist );
									   huerawModel.create({ detail: json });
								   }
							   }
						   });

		if( !isObjEmpty(persist) ) {  // リンクしなくても、旧情報あれば一回送る
			sendIPCMessage( "fclHue", persist );
		}
	},

	stop: async function () {
		mainHue.isRun = false;

		if( config.connected ) {
			await store.set('persist.Hue', persist);
			await mainHue.stopObserve();
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHue.stop() stop.'):0;
		}else{
			await mainHue.cancel();
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHue.stop() cancel'):0;
		}
	},

	stopWithoutSave: async function () {
		mainHue.isRun = false;

		if( config.connected ) {
			await mainHue.stopObserve();
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHue.stopWithoutSave() stop.'):0;
		}else{
			await mainHue.cancel();
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHue.stopWithoutSave() cancel'):0;
		}
	},

	control: function ( _url, _json) {
		Hue.setState( _url, JSON.stringify(_json) );
	},

	setConfig: async function(_config) {
		config = mergeDeeply( config, _config );
		await store.set('config.Hue', config);
		sendIPCMessage( "renewHueConfigView", config );
		sendIPCMessage( "configSaved", 'Hue' );  // 保存したので画面に通知
	},

	getConfig: function () {
		return config;
	},

	getPersist: function() {
		return persist;
	},

	//////////////////////////////////////////////////////////////////////
	// inner functions
	// Hue受信の処理
	received: function(gwIP, response, error) {
		if( error ) {
			// console.error( gwIP );
			// console.error( response );
			// console.error( error );
			return;
		}

		switch ( response ) {
			case 'Canceled':
			console.log('Hue.initialize is canceled.');
			break;

			case 'Linking':
			console.log('Please push Link button.');
			break;

			default:
			// setが成功するとsuccessなので、一旦Getしておく
			if( response[0] && response[0].success ) {
				Hue.getState();
			}else{
				mainHue.callback( JSON.stringify(Hue.facilities) );
				config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHue.received() facilities:\x1b[32m', Hue.facilities, '\x1b[0m' ):0;
			}
		}
	},

	dummy: function(json) {
		// console.dir(json);
	},


	startCore: async function( linked_cb, change_cb ) {
		mainHue.callback = change_cb == undefined || change_cb == '' ? dummy : change_cb;

		config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHue.start() option:\x1b[32m', config, '\x1b[0m' ):0;

		try{
			config.key = await Hue.initialize( config.key, mainHue.received, {debugMode: config.debug} );
			if( config.key == '' ) {
				config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHue.start(), cancel or no key.' ):0;
			}
			linked_cb( config.key );

		}catch(e){
			console.dir(e);
		}

		try{
			mainHue.startObserve();
		}catch(e){
			console.dir(e);
		}

		return config.key;
	},

	cancel: function() {
		Hue.initializeCancel();
	},


	// 監視する，自動取得開始
	startObserve: function() {
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHue.startObserve().' ):0;

		if( config.key == undefined || config.key == '' ) { // 設定されてないのにobserveされないようにする
			return;
		}

		// Hue.facilitiesの定期的監視，変化があればUIに送る
		mainHue.task = cron.schedule('0 */1 * * * *', async () => {  // １分毎
			await Hue.getState();
		});

		mainHue.task.start();
	},

	// 監視をやめる，自動取得停止
	stopObserve: async function() {
		config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHue.stopObserve().' ):0;

		if( mainHue.task ) {
			mainHue.task.stop();
			mainHue.task = null;
		}
	}
};

module.exports = mainHue;
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
