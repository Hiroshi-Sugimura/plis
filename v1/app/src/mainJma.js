//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2022.09.06
//////////////////////////////////////////////////////////////////////
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const Store = require('electron-store');
const request = require('request');
const cron = require('node-cron');
require('date-utils'); // for log
const { Sequelize, sqlite3, jmaRawModel, jmaAbstModel, weatherForecastModel, popsForecastModel, tempForecastModel } = require('./models/localDBModels');   // DBデータと連携
const {objectSort, getNow, getToday, isObjEmpty, mergeDeeply} = require('./mainSubmodule');

let sendIPCMessage = null;
const store = new Store();

let config = {
	enabled: true,
	area: '東京都',
	code: '130000',
	debug: false
};
let persist = {};


//////////////////////////////////////////////////////////////////////
// config
let mainJma = {
	isRun: false,
	abstURL:   "https://www.jma.go.jp/bosai/forecast/data/overview_forecast/",
	detailURL: "https://www.jma.go.jp/bosai/forecast/data/forecast/",
	observationJob: null,
	callback: null,
	debug: false,

	areaCodes: {
		"群馬県": "100000",
		"埼玉県": "110000",
		"千葉県": "120000",
		"東京都": "130000",
		"神奈川県": "140000",
		"新潟県": "150000",
		"富山県": "160000",
		"石川県": "170000",
		"福井県": "180000",
		"山梨県": "190000",
		"長野県": "200000",
		"岐阜県": "210000",
		"静岡県": "220000",
		"愛知県": "230000",
		"三重県": "240000",
		"滋賀県": "250000",
		"京都府": "260000",
		"大阪府": "270000",
		"兵庫県": "280000",
		"奈良県": "290000",
		"和歌山県": "300000",
		"鳥取県": "310000",
		"島根県": "320000",
		"岡山県": "330000",
		"広島県": "340000",
		"山口県": "350000",
		"徳島県": "360000",
		"香川県": "370000",
		"愛媛県": "380000",
		"高知県": "390000",
		"福岡県": "400000",
		"佐賀県": "410000",
		"長崎県": "420000",
		"熊本県": "430000",
		"大分県": "440000",
		"宮崎県": "450000",
		"奄美地方": "460040",
		"鹿児島県（奄美地方除く）": "460100",
		"沖縄本島地方": "471000",
		"大東島地方": "472000",
		"宮古島地方": "473000",
		"八重山地方": "474000",
		"青森県": "20000",
		"岩手県": "30000",
		"宮城県": "40000",
		"秋田県": "50000",
		"山形県": "60000",
		"福島県": "70000",
		"茨城県": "80000",
		"栃木県": "90000"
	},

	//////////////////////////////////////////////////////////////////////
	// 気象庁の処理

	// 重複起動してもよい
	start: function ( _sendIPCMessage ) {
		sendIPCMessage = _sendIPCMessage;
		if( mainJma.isRun ) {  // 重複起動は現在データを渡す
			sendIPCMessage('renewJmaConfigView', config );
			if( !isObjEmpty( persist.abst ) )   { sendIPCMessage( "renewJmaAbst",   persist.abst ); }
			if( !isObjEmpty( persist.detail ) ) { sendIPCMessage( "renewJmaDetail", persist.detail ); }
			return;
		}

		config.enabled = store.get('config.JMA.enabled', true);
		config.area    = store.get('config.JMA.area', '東京都');
		config.code    = store.get('config.JMA.code', '130000');
		config.debug   = store.get('config.JMA.debug', false);
		persist        = store.get('persist.JMA', {});

		if( !config.enabled ) {
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| JmaStart(): Jma is disabled.'):0;
			mainJma.isRun = false;
			return;
		}
		mainJma.isRun = true;

		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| JmaStart() config:', '\x1b[32m', config, '\x1b[0m'):0;
		if( !persist || isObjEmpty(persist) ) { persist = {abst:{}, detail:{}}; }

		mainJma.callback = async function (res) {
			switch( res.cmd ) {
				case "abst":
				try{
					if( !isObjEmpty(res.json) ) {
						// raw
						let raw = mainJma.parseAbstRaw( res.json );
						// config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| JmaStart() abst raw:', '\x1b[32m', raw, '\x1b[0m'):0;
						await jmaRawModel.findOne( {where: { requestAreaCode: raw.requestAreaCode, reportDatetime: raw.reportDatetime } })
							.then( async (row) => {
								if( !row ) {  // 重複は蓄積しない
									await jmaRawModel.create( raw );
								}
							}).catch( (error) => {
								config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Error JmaStart() abst raw:', '\x1b[32m', raw, '\x1b[0m'):0;
								throw error;
							});

						// 構造化されたデータ
						persist.abst = mainJma.parseAbst(res.json);
						sendIPCMessage( "renewJmaAbst", persist.abst );
						await jmaAbstModel.findOne( {where: { requestAreaCode: persist.abst.requestAreaCode, reportDatetime: persist.abst.reportDatetime } })
							.then( async (row) => {
								if( !row ) {  // 重複は蓄積しない
									await jmaAbstModel.create( persist.abst );
								}
							}).catch( (error) => {
								config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Error JmaStart() abst:', '\x1b[32m', persist.abst, '\x1b[0m'):0;
								throw error;
							});
					}
				}catch( error ) {
					// JSONじゃないbodyもくる？
					console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| JmaStart() abst error:', error);
				}
				break;


				case "detail":
				try{
					if( !isObjEmpty(res.json) ) {
						// raw
						let raw = mainJma.parseDetailRaw( res.json );
						// config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| JmaStart() abst raw:', '\x1b[32m', raw, '\x1b[0m'):0;
						await jmaRawModel.findOne( {where: { requestAreaCode: raw.requestAreaCode, reportDatetime: raw.reportDatetime } })
							.then( async (row) => {
								if( !row ) {  // 重複は蓄積しない
									await jmaRawModel.create( raw );
								}
							}).catch( (error) => {
								config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Error JmaStart() detail raw:', '\x1b[32m', raw, '\x1b[0m'):0;
								throw error;
							});

						// 構造化されたデータ
						persist.detail = mainJma.parseDetail(res.json);
						sendIPCMessage( "renewJmaDetail", persist.detail );


						// 詳細の天気
						for( let i in persist.detail.weather ) {
							await weatherForecastModel.findOne( {where: { code: persist.detail.weather[i].code, reportDatetime: persist.detail.weather[i].reportDatetime } })
								.then( async (row) => {
									if( !row ) {  // 重複は蓄積しない
										await weatherForecastModel.create( persist.detail.weather[i] );
									}
								}).catch( (error) => {
									config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Error JmaStart() detail weather:', '\x1b[32m', persist.detail.weather[i], '\x1b[0m'):0;
									throw error;
								});
						}

						// 詳細の降水確率
						for( let i in persist.detail.pops ) {
							await popsForecastModel.findOne( {where: { code: persist.detail.pops[i].code, reportDatetime: persist.detail.pops[i].reportDatetime } })
								.then( async (row) => {
									if( !row ) {  // 重複は蓄積しない
										await popsForecastModel.create( persist.detail.pops[i] );
									}
								}).catch( (error) => {
									config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Error JmaStart() detail pops:', '\x1b[32m', persist.detail.pops[i], '\x1b[0m'):0;
									throw error;
								});
						}

						// 詳細の気温
						for( let i in persist.detail.temperature ) {
							await tempForecastModel.findOne( {where: { code: persist.detail.temperature[i].code, reportDatetime: persist.detail.temperature[i].reportDatetime } })
								.then( async (row) => {
									if( !row ) {  // 重複は蓄積しない
										await tempForecastModel.create( persist.detail.temperature[i] );
									}
								}).catch( (error) => {
									config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Error JmaStart() detail temperature:', '\x1b[32m', persist.detail.temperature[i], '\x1b[0m'):0;
									throw error;
								});
						}
					}
				}catch( error ) {
					// JSONじゃないbodyもくる？
					console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Error JmaStart() detail:', error);
				}
				break;
			}
		};

		mainJma.setObserve();  // 3 hour each

		sendIPCMessage('renewJmaConfigView', config );
		if( !isObjEmpty( persist.abst ) )   { sendIPCMessage( "renewJmaAbst",   persist.abst ); }
		if( !isObjEmpty( persist.detail ) ) { sendIPCMessage( "renewJmaDetail", persist.detail ); }
		mainJma.gets(); // 初回起動はデータ取得する
	},


	// ---------------------------------------------------------------
	// inner functions
	gets: function() {
		request( { url: mainJma.abstURL + config.code + ".json", method: 'GET', json:true }, function (error, response, body ) {
			if( error ) {
				console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainJma.observe().abst error:', error);
				return;
			}
			mainJma.callback( {cmd:"abst", json:body} );
		});

		request( { url: mainJma.detailURL + config.code + ".json", method: 'GET', json:true }, function (error, response, body ) {
			if( error ) {
				console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainJma.observe().detail error:', error);
				return;
			}
			mainJma.callback( {cmd:"detail", json:body} );
		});
	},

	// getしたbodyを使い物になる形に変える
	parseAbstRaw: function(body) {
		return {
			type: 'abst',
			publishingOffice: body.publishingOffice,
			reportDatetime: body.reportDatetime,
			requestAreaCode: config.code,
			json: JSON.stringify( body )
		};
	},

	parseAbst: function(body) {
		return {
			reportDatetime: body.reportDatetime,
			publishingOffice: body.publishingOffice,
			requestAreaCode: config.code,
			headlineText: body.headlineText,
			text: body.text
		}
	},

	parseDetailRaw: function(body) {
		let w = body[0];  // json[1]はちょっとよくわからんので
		let publishingOffice = w.publishingOffice;
		let reportDatetime = w.reportDatetime;

		return {
			type: 'detail',
			publishingOffice: publishingOffice,
			reportDatetime: reportDatetime,
			requestAreaCode: config.code,
			json: JSON.stringify( body )
		};
	},

	parseDetail: function(body) {
		// console.log( body );
		let res = {weather:[], pops:[], temperature:[]};
		let w = body[0];  // body[1]はちょっとよくわからんので
		let publishingOffice = w.publishingOffice;
		let reportDatetime = w.reportDatetime;
		let we = w.timeSeries[0];  // 天気関係
		let po = w.timeSeries[1];  // 降水確率
		let te = w.timeSeries[2];  // 気温

		// timeseries 0 = weather
		let timeDefines = JSON.stringify(we.timeDefines);
		for( let a of we.areas ) {
			res.weather.push( {
				reportDatetime: reportDatetime,
				publishingOffice: publishingOffice,
				targetArea: a.area.name,
				code: a.area.code,
				timeDefines: timeDefines,
				weatherCodes: JSON.stringify(a.weatherCodes),
				weathers: JSON.stringify(a.weathers),
				winds: JSON.stringify(a.winds),
				waves: JSON.stringify(a.waves)
			});
		}

		// timeseries 1 = pops
		timeDefines = JSON.stringify(po.timeDefines);
		for( let a of po.areas ) {
			res.pops.push( {
				reportDatetime: reportDatetime,
				publishingOffice: publishingOffice,
				targetArea: a.area.name,
				code: a.area.code,
				timeDefines: timeDefines,
				pops: JSON.stringify(a.pops)
			});
		};

		// timeseries 2 = temperature
		timeDefines = JSON.stringify(te.timeDefines);
		for( let a of te.areas ) {
			res.temperature.push( {
				reportDatetime: reportDatetime,
				publishingOffice: publishingOffice,
				targetArea: a.area.name,
				code: a.area.code,
				timeDefines: timeDefines,
				temps: JSON.stringify(a.temps)
			});
		};

		return res;
	},


	// 監視開始する
	setObserve: function() {
		mainJma.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainJma.setObserve() start.' ):0;

		if( mainJma.observationJob ) {
			mainJma.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainJma.setObserve() already started.' ):0;
		}

		// 監視はcronで実施、3時間毎
		mainJma.observationJob = cron.schedule('0 */3 * * *', () => {
			mainJma.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainJma.setObserve cron.schedule()'):0;
			mainJma.gets();
		})
	},

	// 監視をやめる
	stopObservation: function() {
		mainJma.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainJma.stopObservation() observation.' ):0;

		if( mainJma.observationJob ) {
			mainJma.observationJob.stop();
			mainJma.observationJob = null;
		}
	},

	// interface
	// 機能を停止する
	stop: async function () {
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainJma.stop()'):0;

		await mainJma.setConfig( config );
		await store.set('persist.JMA', persist);
		await mainJma.stopObservation();
	},

	stopWithoutSave: async function () {
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainJma.stopWithoutSave()'):0;
		await mainJma.stopObservation();
	},

	setConfig: async function  ( _config ) {
		if( _config ) {
			config = mergeDeeply( config, _config );
		}
		await store.set('config.JMA', config);
		sendIPCMessage( "configSaved", 'JMA' );  // 保存したので画面に通知
	},

	getConfig: function () {
		return config;
	},

	getPersist: function() {
		return persist;
	}

};



module.exports = mainJma;
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
