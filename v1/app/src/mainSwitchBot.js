//////////////////////////////////////////////////////////////////////
/** 
 * @file mainSwitchBot.js
 * @author SUGIMURA Hiroshi
 * @copyright © 2020.10.30 Sugimura Laboratory, KAIT
 * @license MIT
 */

//////////////////////////////////////////////////////////////////////
/**
 * @module mainSwitchBot
 */
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const Store = require('electron-store');
const SBC   = require('switchbot-client');
const cron  = require('node-cron');
require('date-utils'); // for log
const { Sequelize, Op, sqlite3, switchBotRawModel, switchBotDataModel } = require('./models/localDBModels');   // DBデータと連携
const { objectSort, getNow, getToday, isObjEmpty, mergeDeeply} = require('./mainSubmodule');

const store = new Store();

/** mainSwitchBotのconfig */
let config =  {
	enabled: false,
	token: '',
	debug: false
};

/** mainSwitchBotのpersist */
let persist = {};

/** mainSwitchBotからIPCMessageを呼ぶためのcallback */
let sendIPCMessage = null;

//////////////////////////////////////////////////////////////////////
/** mainSwitchBot
 *  @desc SwitchBotとの通信を管理
 */
let mainSwitchBot = {
	/** @member client
	 *  @desc SwitchBotとの接続を保持
	 *  @default null
	 */
	client: null,
	/** @member observationJob
	 *  @desc 定期的にSwitchBotの状態を取得するタイマー
	 *  @default null
	 */
	observationJob: null,
	/** @member callback
	 *  @desc SwitchBotの状態を取得したら呼ばれる関数を保持
	 *  @default null
	 */
	callback: null,
	/** @member isRun
	 *  @desc 初期化して起動済みのフラグ
	 *  @default null
	 */
	isRun: false,

	//////////////////////////////////////////////////////////////////////
	// interfaces
	/**
	 * @async
	 * @function start
	 * @param {sendIPCMessage} [_sendIPCMessage]
	 * @return {void}
	*/
	start: function ( _sendIPCMessage ) {
		sendIPCMessage = _sendIPCMessage;

		if( mainSwitchBot.isRun ) {
			if( !isObjEmpty(persist) ) {
				sendIPCMessage( "renewSwitchBotConfigView", config );
				sendIPCMessage( "fclSwitchBot", persist );
				mainSwitchBot.sendTodayRoomEnv();		// 現在のデータを送っておく
			}
			return;
		}

		config.enabled    = store.get('config.SwitchBot.enabled', false);
		config.debug      = store.get('config.SwitchBot.debug',   false);
		config.token      = store.get('config.SwitchBot.token',   '');
		persist = store.get('persist.SwitchBot', {});

		sendIPCMessage( "renewSwitchBotConfigView", config );

		if( !config.enabled ) {
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot is disabled.'):0;
			mainSwitchBot.isRun = false;
			return;
		}
		mainSwitchBot.isRun = true;

		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.start()'):0;

		if( config.token == '' ) {
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.start() token is empty.'):0;
			mainSwitchBot.isRun = false;
			return;
		}

		try{
			mainSwitchBot.startCore( (facilities) => {
				persist = facilities;
				sendIPCMessage( "fclSwitchBot", persist );
				switchBotRawModel.create({ detail: JSON.stringify(persist) });  // store raw data
				mainSwitchBot.storeData( facilities );  // store meaningfull data
				mainSwitchBot.sendTodayRoomEnv();		// 現在のデータを送っておく
			});
		} catch(error) {
			console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.start() error:\x1b[32m', error, '\x1b[0m');
		}
	},
	
	/**
	 * @async
	 * @function stop
	 * @param {void} [void]
	 * @return {void}
	*/
	stop: async function () {
		mainSwitchBot.isRun = false;
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.stop()'):0;

		await mainSwitchBot.stopObservation();
		await store.set('config.SwitchBot', config );
		await store.set('persist.SwitchBot', persist );
	},

	/**
	 * @async
	 * @function stopWithoutSave
	 * @param {void} [void]
	 * @return {void}
	*/
	stopWithoutSave: async function () {
		mainSwitchBot.isRun = false;
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.stopWithoutSave()'):0;

		await mainSwitchBot.stopObservation();
	},


	/**
	 * @async
	 * @function setConfig
	 * @param {_config} [_config]
	 * @return {void}
	*/
	setConfig: async function (_config) {
		if( _config ) {
			config = mergeDeeply( config, _config );
		}

		await store.set('config.SwitchBot', config);

		sendIPCMessage( "configSaved", 'SwitchBot' );  // 保存したので画面に通知
		sendIPCMessage( "renewSwitchBotConfigView", config );  // 保存したので画面に通知
	},

	/**
	 * @async
	 * @function getConfig
	 * @param {void}
	 * @return {config}
	*/
	getConfig: function () {
		return config;
	},


	/**
	 * @async
	 * @function getPersist
	 * @param {void}
	 * @return {persist}
	*/
	getPersist: function() {
		return persist;
	},

	// デバイスタイプごとに制御
	/**
	 * @async
	 * @function control
	 * @param {id} [id]
	 * @param {command} [command]
	 * @return {void}
	*/
	control: async function( id, command ) {
		// mainSwitchBot.client
		console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.control() id:', id, 'command:', command);

		let r = await mainSwitchBot.client.sendControlCommand(id, command);
		console.log( 'mainSwitchBot.client.sendControlCommand ret:', r );
	},


	//////////////////////////////////////////////////////////////////////
	// inner functions
	/**
	 * @async
	 * @function renewFacilities
	 * @param {_client} [_client]
	 * @return {object} ret
	*/
	renewFacilities: async function ( _client ) {
		let ret = {};
		try{
			let devlist = await _client.getDeviceList();
			// mainSwitchBot.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.renewFacilities() devlist:\x1b[32m', devlist, '\x1b[0m' ):0;
			ret.deviceList = devlist.deviceList;
			ret.infraredRemoteList = devlist.infraredRemoteList;
			for( let d of ret.deviceList) {
				ret[d.deviceId] = await _client.getDeviceStatus( d.deviceId );
			}
		}catch(error) {
			switch(error) {
				case 'Error: Http 401 Error. User permission is denied due to invalid token.':
				console.log( JSON.stringify(_client) );
				break;
			}

			console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.renewFacilities() error:\x1b[32m', error, '\x1b[0m');
			throw error;
		}

		return objectSort( ret );
	},


	//////////////////////////////////////////////////////////////////////
	// 定時処理のインタフェース
	// 監視開始
	/**
	 * @async
	 * @function startCore
	 * @callback {_callback} [_callback]
	 * @return {void}
	*/
	startCore: async function( _callback ) {
		if( !config.token || config.token == '' ) {
			throw new Error('mainSwitchBot.startCore() config.token is empty.');
		}

		mainSwitchBot.callback = _callback;
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.startCore() config:\x1b[32m', config, '\x1b[0m' ):0;

		try{
			mainSwitchBot.client = new SBC.RestClient( config.token );

			mainSwitchBot.facilities = await mainSwitchBot.renewFacilities( mainSwitchBot.client );  // 一回実行
			mainSwitchBot.callback( mainSwitchBot.facilities );  // mainに通知

			// 監視はcronで実施、処理が相当重いので3分毎、DBへのクエリ方法をもっと高速になるように考えたほうが良い
			// 1分に1回実施
			mainSwitchBot.observationJob = cron.schedule('*/1 * * * *', async () => {
				config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.cron.schedule()'):0;

				mainSwitchBot.facilities = await mainSwitchBot.renewFacilities( mainSwitchBot.client );  // 現在のデータ取得
				mainSwitchBot.callback( mainSwitchBot.facilities );  // mainに通知
			});

			mainSwitchBot.observationJob.start();
		}catch( error ) {
			console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.startCore() error:\x1b[32m', error, '\x1b[0m');
		}
	},

	// 監視をやめる
	/**
	 * @async
	 * @function stopObservation
	 * @param {void} [void]
	 * @return {void}
	*/
	stopObservation: function() {
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.stopObserve().' ):0;

		if( mainSwitchBot.observationJob ) {
			mainSwitchBot.observationJob.stop();
			mainSwitchBot.observationJob = null;
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.stopObserve() is stopped.' ):0;
		}else{
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.stopObserve() has already stopped.' ):0;
		}

		// mainSwitchBot.client.close();  // axiosのソケットcloseの方法不明
	},


	// デバイスタイプごとにステータスの読見方を変えてDBにためる
	/**
	 * @async
	 * @function storeData
	 * @param {facilities} [facilities]
	 * @return {void}
	*/
	storeData: async function( facilities ) {
		for( let d of facilities.deviceList ) {
			let det = facilities[d.deviceId];
			// console.log( 'SwitchBot:dev:', d, ' detail:', det );

			switch( d.deviceType ) {
				case 'Plug':
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'power',
					value:      det.power
				});
				break;

				case 'Meter':
				case 'MeterPlus':
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'temperature',
					value:      det.temperature
				});
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'humidity',
					value:      det.humidity
				});
				break;

				case 'Curtain':  // カーテン
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'slidePosition',
					value:      det.slidePosition
				});
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'openDirection',
					value:      d.openDirection
				});
				break;

				case 'Humidifier':  // 加湿器
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'power',
					value:      det.power
				});
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'humidity',
					value:      det.humidity
				});
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'temperature',
					value:      det.temperature
				});
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'lackWater',
					value:      det.lackWater
				});
				break;

				case 'Motion Sensor':  // 人感センサ＝動きセンサ
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'moveDetected',
					value:      det.moveDetected
				});
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'brightness',
					value:      det.brightness
				});
				break;

				case 'Contact Sensor':  // 開閉センサ＝接触センサ
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'moveDetected',
					value:      det.moveDetected
				});
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'brightness',
					value:      det.brightness
				});
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'openState',
					value:      det.openState
				});
				break;

				case 'Color Bulb':  // ライト
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'power',
					value:      det.power
				});
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'brightness',
					value:      det.brightness
				});
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'color',
					value:      det.color
				});
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'colorTemperature',
					value:      det.colorTemperature
				});
				break;

				case 'Bot':  // ボット
				switchBotDataModel.create({
					deviceId:   d.deviceId,
					deviceType: d.deviceType,
					deviceName: d.deviceName,
					property:   'power',
					value:      det.power
				});
				break;

				// 以下はDB格納無し
				case 'Hub Mini': break;
				case 'Indoor Cam': break;
				case 'Remote': break;

				default:
				// console.log( 'unknown device in SwitchBot:dev:', d, ' detail:', det );
				// 屋外カメラはなぜかdeviceType持ってない
				break;
			}
		}
	},

	//////////////////////////////////////////////////////////////////////
	// 定時処理
	/*
	getCases
	input
		date: Date="2023-01-06"

	output
		when createdAt >= "2023-01-05 23:57" and createdAt < "2023-01-06 00:00" then "00:00"
		when createdAt >= "2023-01-06 00:00" and createdAt < "2023-01-06 00:03" then "00:03"
		when createdAt >= "2023-01-06 00:03" and createdAt < "2023-01-06 00:06" then "00:06"
		...
		when createdAt >= "2023-01-06 23:54" and createdAt < "2023-01-06 23:57" then "23:57"
		else "24:00"
	*/
	/**
	 * @async
	 * @function getCases
	 * @param {date} [date]
	 * @return {ret}
	*/
	getCases: function ( date ) {
		let T1 = new Date(date);
		let T2 = new Date(date);
		let T3 = new Date(date);
		let T4 = new Date(date);

		// UTCだがStringにて表現しているので、なんか複雑
		T1.setHours( T1.getHours() - T1.getHours() -10, 57, 0, 0 ); // 前日の14時57分xx秒   14:57:00 .. 15:00:00 --> 00:00
		T2.setHours( T1.getHours() - T1.getHours() -10, 58, 0, 0 ); // T1 + 1min
		T3.setHours( T1.getHours() - T1.getHours() -10, 59, 0, 0 ); // T1 + 2min
		T4.setHours( T1.getHours() - T1.getHours()   ,  0, 0, 0 ); // 集約先

		let ret = "";
		for( let t=0; t<480; t+=1 ) {  // 24h * 20 times (= 60min / 3min)
			// console.log( T1.toISOString(), ':', T1.toFormat('YYYY-MM-DD HH24:MI'), ', ', T4.toFormat('HH24:MI') );

			ret += `WHEN "createdAt" LIKE "${T1.toFormat('YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${T2.toFormat('YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${T3.toFormat('YYYY-MM-DD HH24:MI')}%" THEN "${T4.toFormat('HH24:MI')}" \n`;

			T1.setMinutes( T1.getMinutes() +3 ); // + 3 min
			T2.setMinutes( T2.getMinutes() +3 ); // + 3 min
			T3.setMinutes( T3.getMinutes() +3 ); // + 3 min
			T4.setMinutes( T4.getMinutes() +3 ); // + 3 min
		}
		return ret + 'ELSE "24:00"';
	},

	// meterListを取得
	/**
	 * @async
	 * @function getMeterList
	 * @param {theDayBegin} [theDayBegin]
	 * @param {theDayEnd} [theDayEnd]
	 * @return {rows}
	*/
	getMeterList: async function( theDayBegin, theDayEnd ) {
		let meterList = [];
		try{
			// 1日分で記録があるデバイスリスト（温湿度計）
			let rows = [];
			rows = await switchBotDataModel.findAll( {
				attributes: ['deviceName' ],
				group: ['deviceName'],
				where: {
					deviceType: { [Op.or]: ['Meter','MeterPlus'] },
					createdAt: { [Op.between] : [theDayBegin.toISOString(), theDayEnd.toISOString()] }
				}
			} );
			for( const row of rows ) {
				meterList.push( row.dataValues.deviceName );
			}
			return meterList;
		} catch( error ) {
			console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.getMeterList()', error);
		}
	},


	// 3分毎のtemperature
	/**
	 * @async
	 * @function getTempratureRows
	 * @param {theDayBegin} [theDayBegin]
	 * @param {theDayEnd} [theDayEnd]
	 * @param {meter} [meter]
	 * @param {subQuery} [subQuery]
	 * @return {rows}
	*/
	getTempratureRows: async function( theDayBegin, theDayEnd, meter, subQuery ) {
		try{
			// 3分毎データ tempreture
			let rows = await switchBotDataModel.findAll( {
				attributes: [
					[Sequelize.fn('AVG', Sequelize.col('value')), 'avgTemperature'],
					'createdAt',
					[Sequelize.literal(subQuery), 'timeunit']
					],
				where: {
					deviceType: { [Op.or]: ['Meter','MeterPlus'] },
					deviceName: meter,
					property:  'temperature',
					createdAt: { [Op.between] : [theDayBegin.toISOString(), theDayEnd.toISOString()] }
				},
				group: ['timeunit']
			} );

			return rows;
		} catch( error ) {
			console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.getTempratureRows()', error);
		}
	},

	// 3分毎のhumidity
	/**
	 * @async
	 * @function getHumidityRows
	 * @param {sendIPCMessage} [_sendIPCMessage]
	 * @return {rows}
	*/
	getHumidityRows: async function( theDayBegin, theDayEnd, meter, subQuery ) {
		let ret = [];
		try{
			// 3分毎データ humidity
			let rows = await switchBotDataModel.findAll( {
				attributes: [
					[Sequelize.fn('AVG', Sequelize.col('value')), 'avgHumidity'],
					'createdAt',
					[Sequelize.literal(subQuery), 'timeunit']
					],
				where: {
					deviceType: { [Op.or]: ['Meter','MeterPlus'] },
					deviceName: meter,
					property:  'humidity',
					createdAt: { [Op.between] : [theDayBegin.toISOString(), theDayEnd.toISOString()] }
				},
				group: ['timeunit']
			} );

			return rows;
		} catch( error ) {
			console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.getHumidityRows()', error);
		}
	},


	// DBからテーブル取得
	/**
	 * @async
	 * @function getTodayRoomEnvSwitchBot
	 * @param {void}
	 * @return {object}
	*/
	getTodayRoomEnvSwitchBot: async function() {
		// 画面に今日のデータを送信するためのデータ作る
		let ret = {	srcType: 'switchBot', meterList:[] }; // 戻り値  // { meterList:[], meter1:[], meter2[], .... }

		try {
			let now = new Date();  // 現在
			let begin = new Date(now);  // 現在時刻UTCで取得
			begin.setHours( begin.getHours() - begin.getHours() - 1, 57, 0, 0 ); // 前日の23時57分０秒にする
			let end = new Date(begin);  // 現在時刻UTCで取得
			end.setHours( begin.getHours() + 25, 0, 0, 0 ); // 次の日の00:00:00にする

			// 温湿度計のリストを取得
			ret.meterList = await mainSwitchBot.getMeterList( begin, end );

			//------------------------------------------------------------
			// 温湿度計毎にデータ作る
			let cases = mainSwitchBot.getCases( now );
			let subQuery = `CASE ${cases} END`;

			for( const meter of ret.meterList ) {
				let rowsT = await mainSwitchBot.getTempratureRows( begin, end, meter, subQuery );			// 3分毎データ tempreture
				let rowsH = await mainSwitchBot.getHumidityRows( begin, end, meter, subQuery );			// 3分毎データ humidity

				// console.log( rowsT );
				// console.log( rowsH );

				let T1 = new Date();
				T1.setHours( 0, 0, 0);
				let array = [];
				for( let t=0; t<480; t+=1 ) {
					let pushRow = {
						id: t,
						time: T1.toISOString()
					}

					// temperature
					if( rowsT ) {
						let row = rowsT.find( (row) => row.dataValues.timeunit == T1.toFormat('HH24:MI') );

						if( row ) {
							pushRow.temperature = row.dataValues.avgTemperature;
						}else{
							pushRow.temperature = null;
						}
					}

					// humidity
					if( rowsH ) {
						let row = rowsH.find( (row) => row.dataValues.timeunit == T1.toFormat('HH24:MI') );

						if( row ) {
							pushRow.humidity = row.dataValues.avgHumidity;
						}else{
							pushRow.humidity = null;
						}
					}

					array.push( pushRow );
					T1.setMinutes( T1.getMinutes() +3 ); // + 3 min
				}

				ret[meter] = array;
			}

			return ret;
		} catch( error ) {
			console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.getTodayRoomEnvSwitchBot()', error);
		}
	},

	/**
	 * @async
	 * @function sendTodayRoomEnv
	 * @param {void}
	 * @return {void}
	*/
	sendTodayRoomEnv: async function( ) {
		let arg = { };

		if( config.enabled ) {
			arg = await mainSwitchBot.getTodayRoomEnvSwitchBot();
			sendIPCMessage( 'renewRoomEnvSwitchBot', JSON.stringify(arg) );
		}else{
			console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainSwitchBot.sendTodayRoomEnv() config.enabled:', config.enabled);
		}
	}

};


module.exports = mainSwitchBot;
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
