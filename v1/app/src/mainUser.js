//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const Store   = require('electron-store');
const { objectSort, getNow, getToday, isObjEmpty, mergeDeeply } = require('./mainSubmodule');

// 基礎設定
const appDir = process.env.NODE_ENV === 'development' ? __dirname : __dirname;
let sendIPCMessage = null;
const store = new Store();

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
let mainUser = {

	start: async function ( _sendIPCMessage ) {
		sendIPCMessage = _sendIPCMessage;

		// config.user
		config.nickname  = await store.get('config.user.nickname',  config.nickname);
		config.height    = await store.get('config.user.height',    config.height);
		config.weight    = await store.get('config.user.weight',    config.weight);
		config.age       = await store.get('config.user.age',       config.age);
		config.ampere    = await store.get('config.user.ampere',    config.ampere);
		config.debug     = await store.get('config.user.debug',     config.debug);

		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainUser.start()'):0;
	},

	stop: async function () {
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainUser.stop()'):0;
		await mainUser.setConfig( config );
	},

	setConfig: async function  ( _config ) {
		if( _config ) {
			config = mergeDeeply( config, _config );
		}
		await store.set('config.user', config);

		sendIPCMessage( "renewUserConfigView", config );
		sendIPCMessage( "configSaved", "User" );
	},

	getConfig: function () {
		return config;
	}
};

module.exports = mainUser;
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
