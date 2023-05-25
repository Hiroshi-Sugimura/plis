//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2013.09.27.
//	Last updated: 2022.08.04
//////////////////////////////////////////////////////////////////////
'use strict'

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipc', {
	//======================================================
	// renderer to main

	// PLIS全体
	already: () => { // rendererが準備できた
		ipcRenderer.invoke('already', '');
	},

	URLopen: (url) => {
		ipcRenderer.invoke('URLopen', url );
	},

	// Calendar
	CalendarRenewHolidays: ( ) => {
		ipcRenderer.invoke('CalendarRenewHolidays', '');
	},

	// system settings
	SystemSetConfig: ( _screenMode, _debug, _elLogExpireDays, _resultExpireDays, _IPver, _IPv4, _IPv6 ) => {
		ipcRenderer.invoke('SystemSetConfig', { screenMode:_screenMode, debug:_debug, ellogExpireDays:_elLogExpireDays, resultExpireDays:_resultExpireDays, IPver:_IPver, IPv4:_IPv4, IPv6:_IPv6} );
	},

	ScreenMode: (_screenMode) => {
		ipcRenderer.invoke('ScreenMode', {screenMode: _screenMode});
	},

	//----------------------------------------------------------------------------------------------
	// Profile関連
	userProfileSave: ( _nickname, _age, _height, _weight, _ampere ) => {
		ipcRenderer.invoke('userProfileSave', { nickname: _nickname, age:_age, height:_height, weight:_weight, ampere:_ampere} );
	},


	//----------------------------------------------------------------------------------------------
	// HAL関連
	HALsetApiTokenRequest: (HALtoken)=>{
		ipcRenderer.invoke('HALsetApiTokenRequest', HALtoken);
	},

	HALgetApiTokenRequest: ()=>{
		ipcRenderer.invoke('HALgetApiTokenRequest', '');
	},

	HALdeleteApiToken: () => {
		ipcRenderer.invoke('HALdeleteApiToken', '');
	},

	HALsync: ()=>{
		ipcRenderer.invoke('HALsync', '');
	},

	HALrenew: () => {
		ipcRenderer.invoke('HALrenew', '');
	},

	HALsubmitQuestionnaire: (submitData)=>{
		ipcRenderer.invoke('HALsubmitQuestionnaire', '');
	},

	HALgetUserProfileRequest: async ()=>{
		return await ipcRenderer.invoke('HALgetUserProfileRequest', '');
	},

	//----------------------------------------------------------------------------------------------
	// ESM関連
	ESMUse: (_dongleType, _id, _password )=>{
		ipcRenderer.invoke('ESMUse',  {
			dongleType: _dongleType,
			id: _id,
			password: _password});
	},

	ESMnotUse: (_dongleType, _id, _password )=>{
		ipcRenderer.invoke('ESMnotUse', {
			dongleType: _dongleType,
			id: _id,
			password: _password});
	},

	//----------------------------------------------------------------------------------------------
	// Hue関連
	HueUse: (_key)=>{
		ipcRenderer.invoke('HueUse', {key: _key});
	},

	HueUseCancel: (_key)=>{
		ipcRenderer.invoke('HueUseCancel', {key: _key});
	},

	HueUseStop: (_key)=>{
		ipcRenderer.invoke('HueUseStop', {key: _key});
	},

	HueControl: (_url, _json )=>{
		console.log(_url, _json);
		ipcRenderer.invoke('HueControl', {url: _url, json: _json});
	},

	//----------------------------------------------------------------------------------------------
	// Ikea関連
	IkeaUse: (_securityCode, _identity, _psk)=>{
		ipcRenderer.invoke('IkeaUse', {securityCode:_securityCode, identity:_identity, psk:_psk});
	},

	IkeaUseStop: (_securityCode, _identity, _psk)=>{
		ipcRenderer.invoke('IkeaUseStop', {securityCode:_securityCode, identity:_identity, psk:_psk});
	},

	IkeaSend: (url, json )=>{
		console.log(url, json);
		ipcRenderer.invoke('IkeaSend', {url:url, json:json});
	},


	//----------------------------------------------------------------------------------------------
	// Open Weather Map関連
	OwmUse: (_APIKey, _zipcode) => {
		ipcRenderer.invoke('OwmUse', {APIKey:_APIKey, zipcode:_zipcode});
	},

	OwmStop: (_APIKey, _zipcode) => {
		ipcRenderer.invoke('OwmStop', {APIKey:_APIKey, zipcode:_zipcode});
	},

	//----------------------------------------------------------------------------------------------
	// JMA関連
	JmaConfigSave: (_areaName, _areaCode)=>{
		ipcRenderer.invoke('JmaConfigSave', {area:_areaName, code:_areaCode});
	},


	//----------------------------------------------------------------------------------------------
	// Netatmo関連
	NetatmoUse: ( _id, _secret, _username, _password) =>{
		ipcRenderer.invoke('NetatmoUse', { id: _id, secret: _secret, username: _username, password: _password });
	},

	NetatmoStop: ( _id, _secret, _username, _password) =>{
		ipcRenderer.invoke('NetatmoStop', { id: _id, secret: _secret, username: _username, password: _password });
	},


	//----------------------------------------------------------------------------------------------
	// Omron関連
	OmronUse: ( _place ) =>{
		ipcRenderer.invoke('OmronUse', {place: _place});
	},

	OmronStop: ( _place ) =>{
		ipcRenderer.invoke('OmronStop', {place: _place});
	},

	//----------------------------------------------------------------------------------------------
	// SwitchBot関連
	SwitchBotUse: (_token)=>{
		ipcRenderer.invoke('SwitchBotUse', {token: _token});
	},

	SwitchBotStop: (_token)=>{
		ipcRenderer.invoke('SwitchBotStop', {token: _token});
	},

	SwitchBotControl: ( _id, _commandJson )=>{
		// console.log( 'SwitchBotControl', { id:_id, command: _commandJson} );
		ipcRenderer.invoke('SwitchBotControl', { id:_id, command: _commandJson} );
	},

	//----------------------------------------------------------------------------------------------
	// EL関連
	ELUse: ( ) =>{
		ipcRenderer.invoke('ELUse');
	},

	ELStop: () =>{
		ipcRenderer.invoke('ELStop');
	},

	// EL関連制御
	Elsend: (ip, sendmsg )=>{
		ipcRenderer.invoke('Elsend', {ip:ip, msg:sendmsg});
	},

	ElsendOPC1: (ip, seoj, deoj, esv, epc, edt )=>{
		ipcRenderer.invoke('ElsendOPC1', {ip: ip, seoj: seoj, deoj: deoj, esv: esv, epc: epc, edt: edt});
	},

	ELsearch: ()=>{
		ipcRenderer.invoke('ELSearch', '');
	},


	//======================================================
	// main to renderer
	on: ( channel, callback ) => {
		try{
			ipcRenderer.on( channel, (event, obj ) => {
				try{
					callback( channel, obj );
				}catch( error ) {
					console.error( 'Error: preload.on.ipcRenderer.on()' );
					console.error( error );
					console.error( 'channel:', channel, 'obj:', obj );
				}
			});
		}catch( error ) {
			console.error( 'Error: preload.on()' );
			console.error( error );
			console.error( 'channel:', channel );
		}
	}

});

