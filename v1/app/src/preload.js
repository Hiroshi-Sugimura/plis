//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2013.09.27.
//	Last updated: 2022.08.04
//////////////////////////////////////////////////////////////////////
/**
 * @module preload
 */
'use strict'

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipc', {
	//======================================================
	// renderer to main

	/**
	 * @func 
	 * @desc PLIS全体、rendererが準備できた羅呼ばれる
	 * @param {void} 
	 * @return void
	 */
	already: () => {
		ipcRenderer.invoke('already', '');
	},

	/**
	 * @func 
	 * @desc URLopen
	 * @param {void} 
	 * @return void
	 */
	URLopen: (url) => {
		ipcRenderer.invoke('URLopen', url);
	},

	/**
	 * @func 
	 * @desc ページ内検索
	 * @param {text} 
	 * @return void
	 */
	PageInSearch: (text) => {
		ipcRenderer.invoke('PageInSearch', text);
	},

	/**
	 * @func 
	 * @desc ページ内検索前方
	 * @param {text} 
	 * @return void
	 */
	PageInSearchNext: (text) => {
		ipcRenderer.invoke('PageInSearchNext', text);
	},

	/**
	 * @func 
	 * @desc ページ内検索後方
	 * @param {text} 
	 * @return void
	 */
	PageInSearchPrev: (text) => {
		ipcRenderer.invoke('PageInSearchPrev', text);
	},

	/**
	 * @func 
	 * @desc ページ内検索停止
	 * @param {void} 
	 * @return void
	 */
	PageInSearchStop: () => {
		ipcRenderer.invoke('PageInSearchStop');
	},

	/**
	 * @func 
	 * @desc Calendar
	 * @param {void} 
	 * @return void
	 */
	CalendarRenewHolidays: () => {
		ipcRenderer.invoke('CalendarRenewHolidays', '');
	},

	/**
	 * @func 
	 * @desc system settings
	 * @param {void} 
	 * @return void
	 */
	SystemSetConfig: (_screenMode, _debug, _elLogExpireDays, _resultExpireDays, _IPver, _IPv4, _IPv6) => {
		ipcRenderer.invoke('SystemSetConfig', { screenMode: _screenMode, debug: _debug, ellogExpireDays: _elLogExpireDays, resultExpireDays: _resultExpireDays, IPver: _IPver, IPv4: _IPv4, IPv6: _IPv6 });
	},

	/**
	 * @func 
	 * @desc ScreenMode
	 * @param {void} 
	 * @return void
	 */
	ScreenMode: (_screenMode) => {
		ipcRenderer.invoke('ScreenMode', { screenMode: _screenMode });
	},

	//----------------------------------------------------------------------------------------------
	/**
	 * @func 
	 * @desc Profile関連
	 * @param {void} 
	 * @return void
	 */
	userProfileSave: (_nickname, _age, _height, _weight, _ampere) => {
		ipcRenderer.invoke('userProfileSave', { nickname: _nickname, age: _age, height: _height, weight: _weight, ampere: _ampere });
	},


	//----------------------------------------------------------------------------------------------
	/**
	 * @func 
	 * @desc HAL関連
	 * @param {void} 
	 * @return void
	 */
	HALsetApiTokenRequest: (HALtoken) => {
		ipcRenderer.invoke('HALsetApiTokenRequest', HALtoken);
	},

	/**
	 * @func 
	 * @desc HAL関連
	 * @param {void} 
	 * @return void
	 */
	HALgetApiTokenRequest: () => {
		ipcRenderer.invoke('HALgetApiTokenRequest', '');
	},

	/**
	 * @func 
	 * @desc HAL関連
	 * @param {void} 
	 * @return void
	 */
	HALdeleteApiToken: () => {
		ipcRenderer.invoke('HALdeleteApiToken', '');
	},

	/**
	 * @func 
	 * @desc HAL関連
	 * @param {void} 
	 * @return void
	 */
	HALsync: () => {
		ipcRenderer.invoke('HALsync', '');
	},

	/**
	 * @func 
	 * @desc HAL関連
	 * @param {void} 
	 * @return void
	 */
	HALrenew: () => {
		ipcRenderer.invoke('HALrenew', '');
	},

	/**
	 * @func 
	 * @desc HAL関連
	 * @param {void} 
	 * @return void
	 */
	HALsubmitQuestionnaire: (submitData) => {
		ipcRenderer.invoke('HALsubmitQuestionnaire', '');
	},

	/**
	 * @func 
	 * @desc HAL関連
	 * @param {void} 
	 * @return void
	 */
	HALgetUserProfileRequest: async () => {
		return await ipcRenderer.invoke('HALgetUserProfileRequest', '');
	},

	//----------------------------------------------------------------------------------------------
	/**
	 * @func 
	 * @desc ESM関連
	 * @param {void} 
	 * @return void
	 */
	ESMUse: (_dongleType, _id, _password) => {
		ipcRenderer.invoke('ESMUse', {
			dongleType: _dongleType,
			id: _id,
			password: _password
		});
	},

	/**
	 * @func 
	 * @desc ESM関連
	 * @param {void} 
	 * @return void
	 */
	ESMnotUse: (_dongleType, _id, _password) => {
		ipcRenderer.invoke('ESMnotUse', {
			dongleType: _dongleType,
			id: _id,
			password: _password
		});
	},

	//----------------------------------------------------------------------------------------------
	/**
	 * @func 
	 * @desc Hue関連
	 * @param {void} 
	 * @return void
	 */
	HueUse: (_key) => {
		ipcRenderer.invoke('HueUse', { key: _key });
	},

	/**
	 * @func 
	 * @desc Hue関連
	 * @param {void} 
	 * @return void
	 */
	HueUseCancel: (_key) => {
		ipcRenderer.invoke('HueUseCancel', { key: _key });
	},

	/**
	 * @func 
	 * @desc Hue関連
	 * @param {void} 
	 * @return void
	 */
	HueUseStop: (_key) => {
		ipcRenderer.invoke('HueUseStop', { key: _key });
	},

	/**
	 * @func 
	 * @desc Hue関連
	 * @param {void} 
	 * @return void
	 */
	HueControl: (_url, _json) => {
		console.log(_url, _json);
		ipcRenderer.invoke('HueControl', { url: _url, json: _json });
	},

	//----------------------------------------------------------------------------------------------
	/**
	 * @func 
	 * @desc Ikea関連
	 * @param {void} 
	 * @return void
	 */
	IkeaUse: (_securityCode, _identity, _psk) => {
		ipcRenderer.invoke('IkeaUse', { securityCode: _securityCode, identity: _identity, psk: _psk });
	},

	/**
	 * @func 
	 * @desc Ikea関連
	 * @param {void} 
	 * @return void
	 */
	IkeaUseStop: (_securityCode, _identity, _psk) => {
		ipcRenderer.invoke('IkeaUseStop', { securityCode: _securityCode, identity: _identity, psk: _psk });
	},

	/**
	 * @func 
	 * @desc Ikea関連
	 * @param {void} 
	 * @return void
	 */
	IkeaSend: (url, json) => {
		console.log(url, json);
		ipcRenderer.invoke('IkeaSend', { url: url, json: json });
	},


	//----------------------------------------------------------------------------------------------
	/**
	 * @func 
	 * @desc Open Weather Map関連
	 * @param {void} 
	 * @return void
	 */
	OwmUse: (_APIKey, _zipcode) => {
		ipcRenderer.invoke('OwmUse', { APIKey: _APIKey, zipcode: _zipcode });
	},

	/**
	 * @func 
	 * @desc Open Weather Map関連
	 * @param {void} 
	 * @return void
	 */
	OwmStop: (_APIKey, _zipcode) => {
		ipcRenderer.invoke('OwmStop', { APIKey: _APIKey, zipcode: _zipcode });
	},

	//----------------------------------------------------------------------------------------------
	/**
	 * @func 
	 * @desc JMA関連
	 * @param {void} 
	 * @return void
	 */
	JmaConfigSave: (_areaName, _areaCode) => {
		ipcRenderer.invoke('JmaConfigSave', { area: _areaName, code: _areaCode });
	},


	//----------------------------------------------------------------------------------------------
	/**
	 * @func 
	 * @desc Netatmo関連
	 * @param {void} 
	 * @return void
	 */
	NetatmoUse: (_id, _secret, _username, _password) => {
		ipcRenderer.invoke('NetatmoUse', { id: _id, secret: _secret, username: _username, password: _password });
	},

	/**
	 * @func 
	 * @desc Netatmo関連
	 * @param {void} 
	 * @return void
	 */
	NetatmoStop: (_id, _secret, _username, _password) => {
		ipcRenderer.invoke('NetatmoStop', { id: _id, secret: _secret, username: _username, password: _password });
	},


	//----------------------------------------------------------------------------------------------
	/**
	 * @func 
	 * @desc Omron関連
	 * @param {void} 
	 * @return void
	 */
	OmronUse: (_place) => {
		ipcRenderer.invoke('OmronUse', { place: _place });
	},

	/**
	 * @func 
	 * @desc Omron関連
	 * @param {void} 
	 * @return void
	 */
	OmronStop: (_place) => {
		ipcRenderer.invoke('OmronStop', { place: _place });
	},

	//----------------------------------------------------------------------------------------------
	/**
	 * @func 
	 * @desc SwitchBot関連
	 * @param {void} 
	 * @return void
	 */
	SwitchBotUse: (_token) => {
		ipcRenderer.invoke('SwitchBotUse', { token: _token });
	},

	/**
	 * @func 
	 * @desc SwitchBot関連
	 * @param {void} 
	 * @return void
	 */
	SwitchBotStop: (_token) => {
		ipcRenderer.invoke('SwitchBotStop', { token: _token });
	},

	/**
	 * @func 
	 * @desc SwitchBot関連
	 * @param {void} 
	 * @return void
	 */
	SwitchBotControl: (_id, _commandJson) => {
		// console.log( 'SwitchBotControl', { id:_id, command: _commandJson} );
		ipcRenderer.invoke('SwitchBotControl', { id: _id, command: _commandJson });
	},

	//----------------------------------------------------------------------------------------------
	/**
	 * @func 
	 * @desc EL利用開始
	 * @param {void} 
	 * @return void
	 */
	ELUse: () => {
		ipcRenderer.invoke('ELUse');
	},

	/**
	 * @func 
	 * @desc EL利用停止
	 * @param {void} 
	 * @return void
	 */
	ELStop: () => {
		ipcRenderer.invoke('ELStop');
	},

	/**
	 * @func 
	 * @desc EL旧バージョン検索有効
	 * @param {void} 
	 * @return void
	 */
	ELUseOldSearch: () => {
		ipcRenderer.invoke('ELUseOldSearch');
	},

	/**
	 * @func 
	 * @desc EL旧バージョン検索無効
	 * @param {void} 
	 * @return void
	 */
	ELStopOldSearch: () => {
		ipcRenderer.invoke('ELStopOldSearch');
	},

	/**
	 * @func 
	 * @desc EL関連制御
	 * @param {void} 
	 * @return void
	 */
	Elsend: (ip, sendmsg) => {
		ipcRenderer.invoke('Elsend', { ip: ip, msg: sendmsg });
	},

	/**
	 * @func 
	 * @desc EL関連制御
	 * @param {void} 
	 * @return void
	 */
	ElsendOPC1: (ip, seoj, deoj, esv, epc, edt) => {
		ipcRenderer.invoke('ElsendOPC1', { ip: ip, seoj: seoj, deoj: deoj, esv: esv, epc: epc, edt: edt });
	},

	/**
	 * @func 
	 * @desc EL関連制御
	 * @param {void} 
	 * @return void
	 */
	ELsearch: () => {
		ipcRenderer.invoke('ELSearch', '');
	},

	//======================================================
	// main to renderer
	on: (channel, callback) => {
		try {
			ipcRenderer.on(channel, (event, obj) => {
				try {
					callback(channel, obj);
				} catch (error) {
					console.error('Error: preload.on.ipcRenderer.on()');
					console.error(error);
					console.error('channel:', channel, 'obj:', obj);
				}
			});
		} catch (error) {
			console.error('Error: preload.on()');
			console.error(error);
			console.error('channel:', channel);
		}
	}

});


