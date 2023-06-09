//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2021.11.11
//////////////////////////////////////////////////////////////////////
/**
 * @module mainESM
 */
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const cron   = require('node-cron');
const Store  = require('electron-store');
const eSM    = require('e-smartmeter-echonet-lite');
const EL     = require('echonet-lite');
const ELconv = require('echonet-lite-conv');
const mainEL = require('./mainEL');      // ELの管理
const { Sequelize, Op, sqlite3, esmdataModel, esmrawModel, electricEnergyModel } = require('./models/localDBModels');   // DBデータと連携
const { objectSort, getNow, getToday, isObjEmpty, mergeDeeply} = require('./mainSubmodule');

let sendIPCMessage = null;
const store = new Store();

let config = {
	enabled: false,  // 有効/無効
	dongleType: 'TESSERA',  // 'ROHM' or 'TESSERA', default:TESSERA
	id:'',   // Bルート認証ID設定, Your B route ID.
	password:'',   // Bルート認証パスワード設定, Your B route password.
	userAmpere: '30', // ユーザの契約アンペア
	EPANDESC:{},       // コネクション情報
	debug: false     // スマメライブラリのデバッグ有効
};

let persist = {};


//////////////////////////////////////////////////////////////////////
// config
let mainESM = {
	isRun: false,  // 動作中
	observationJob: null,
	observationPort: null,
	receiveCallback: null,
	changeCallback: null,
	connected: false, // 初回起動のみ実施するためのフラグ, flag for first connection

	//////////////////////////////////////////////////////////////////////
	// 電力スマートメーターの処理

	// interfaces
	/**
	 * @func start
	 * @desc 初期化
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	start: function( _sendIPCMessage ) {
		sendIPCMessage = _sendIPCMessage;

		if( mainESM.isRun ) {
			if( persist ) {
				sendIPCMessage( "renewESMConfigView", config );
				sendIPCMessage( "fclESM", persist );
			}
			mainESM.sendTodayEnergy(); // 現在持っているデータを送っておく
			return;
		}

		config.enabled    = store.get('config.ESM.enabled', false);
		config.dongleType = store.get('config.ESM.dongleType', '');
		config.id         = store.get('config.ESM.id', '');
		config.password   = store.get('config.ESM.password', '');
		config.userAmpere = store.get('config.ESM.userAmpere', '30');
		config.EPANDESC   = store.get('config.ESM.EPANDESC', {});
		config.debug      = store.get('config.ESM.debug', false);
		persist           = store.get('persist.ESM', {});

		sendIPCMessage( "renewESMConfigView", config );

		if( config.enabled == false ) {
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.start() desabled.'):0;
			mainESM.isRun = false;
			return;
		}
		mainESM.isRun = true;

		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.start()'):0;

		try{
			mainESM.startCore (
				mainESM.received,
				(facilities) => {
					ELconv.refer( objectSort(facilities) , function (devs) {
						// console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| ESMStart() devs:\x1b[32m', objectSort(devs), '\x1b[0m' );
						persist = eSM.objectSort(devs);
						sendIPCMessage( "fclESM", persist );
					});
				});
		}catch(error){
			console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.start() error:', error);
			mainESM.isRun = false;
			throw error;
		}


		//////////////////////////////////////////////////////////////////////
		// 定時処理
		// 1分毎にチェック
		let task = cron.schedule('*/1 * * * *', async () => {
			try{
				config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.start.cron.schedule() every min'):0;

				let dt = new Date();

				// Wi-SUN電力スマートメーターの状態のチェック
				if( mainESM.connected && persist && persist.IPs && persist.IPs.length != 0 ) {
					// config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.start.cron.schedule() persist:\x1b[32m', persist, '\x1b[0m' ):0;

					let ip = persist.IPs[0];
					let sm = persist[ip];
					// 蓄積するほどデータがそろってない場合はスキップ
					if( !sm || !sm['低圧スマート電力量メータ01(028801)']  ) {
						config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.start.cron.schedule() SumartMeter persist.esmData is Null.' ):0;

					}else if( !sm['低圧スマート電力量メータ01(028801)']['設置場所(81)'] ) {  // 基本プロパティがなければ取り直す
						config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.start.cron.schedule() SumartMeter esmData.place is Null.' ):0;
						eSM.getStatic();

					}else if( isObjEmpty(sm.Means) ) {
						config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.start.cron.schedule() SumartMeter sm.Means is Empty.' ):0;

					}else{
						// merge用ベース
						let means = {
							'積算電力量計測値（正方向計測値）[kWh]': null,
							'積算電力量計測値（逆方向計測値）[kWh]': null,
							'定時積算電力量計測値正方向': {
								'日時':null,
								'計測値[kWh]':null
							},
							'定時積算電力量計測値逆方向': {
								'日時':null,
								'計測値[kWh]':null
							}
						};

						// merge用ベースとesmDataとマージ
						let mergeObj = mergeDeeply( means, sm.Means);
						// config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.start.cron.schedule() ESM mergeObj \x1b[32m', mergeObj, '\x1b[0m' ):0;

						let instantaneousPower = null;
						if( sm['低圧スマート電力量メータ01(028801)']['瞬時電力計測値(E7)'] ) {
							// console.log( 'E7:', sm['低圧スマート電力量メータ01(028801)']['瞬時電力計測値(E7)'] );
							instantaneousPower = sm['低圧スマート電力量メータ01(028801)']['瞬時電力計測値(E7)'].split('W')[0];
						}

						let instantaneousCurrentsR = null;
						if( sm['低圧スマート電力量メータ01(028801)']['瞬時電流計測値(E8)'] ) {
							let e8 = JSON.parse( sm['低圧スマート電力量メータ01(028801)']['瞬時電流計測値(E8)'].split('(')[0] );
							let rp = e8['RPhase'];
							// console.log( rp );
							instantaneousCurrentsR = rp.split('[A]')[0];
						}

						let instantaneousCurrentsT = null;
						if( sm['低圧スマート電力量メータ01(028801)']['瞬時電流計測値(E8)'] ) {
							let e8 = JSON.parse( sm['低圧スマート電力量メータ01(028801)']['瞬時電流計測値(E8)'].split('(')[0] );
							let tp = e8['TPhase'];
							// console.log( tp );
							instantaneousCurrentsT = tp.split('[A]')[0];
						}

						//------------------------------------------------------------
						// 整理されたデータベースにする
						let q = {
							dateTime: dt,
							srcType: 'Meter',
							place: sm['低圧スマート電力量メータ01(028801)']['設置場所(81)'],
							commulativeAmountNormal: mergeObj['積算電力量計測値（正方向計測値）[kWh]'], // E0
							commulativeAmountReverse: mergeObj['積算電力量計測値（逆方向計測値）[kWh]'], // E3
							instantaneousPower: instantaneousPower,  // E7
							instantaneousCurrentsR: instantaneousCurrentsR, // E8
							instantaneousCurrentsT: instantaneousCurrentsT,  // E8
							commulativeAmountsFixedTimeNormalDaytime: mergeObj['定時積算電力量計測値正方向']['日時'],  // EA
							commulativeAmountsFixedTimeNormalPower: mergeObj['定時積算電力量計測値正方向']['計測値[kWh]'],
							commulativeAmountsFixedTimeReverseDaytime: mergeObj['定時積算電力量計測値逆方向']['日時'], // EB
							commulativeAmountsFixedTimeRiversePower: mergeObj['定時積算電力量計測値逆方向']['計測値[kWh]']
						};

						// config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.start.cron.schedule() ESM insert:\x1b[32m', q, '\x1b[0m' ):0;
						electricEnergyModel.create( q );
					}
				};

				mainESM.sendTodayEnergy(); 		// 本日のデータの定期的送信 スマートメータ分
			} catch( error ) {
				console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.start.cron.schedule() each 3min, error:', error);
				throw error;
			}
		});

		if( persist ) {
			sendIPCMessage( "fclESM", persist );
		}
		mainESM.sendTodayEnergy(); // 現在持っているデータを送っておく
		task.start();
	},


	/**
	 * @func stop
	 * @desc シリアルポートを開放して連携終了
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	stop: async function () {
		mainESM.isRun = false;
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.stop()'):0;

		mainESM.connected = false;
		await mainESM.stopObservation();
		await eSM.release();
		await mainESM.setConfig();
		await store.set('persist.ESM', persist);
	},

	/**
	 * @func stopWithoutSave
	 * @desc stopWithoutSave
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	stopWithoutSave: async function () {
		mainESM.isRun = false;
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.stopWithoutSave()'):0;

		mainESM.connected = false;
		await mainESM.stopObservation();
		await eSM.release();
	},

	/**
	 * @func setConfig
	 * @desc setConfig
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	setConfig: async function  ( _config ) {
		if( _config ) {
			config = mergeDeeply( config, _config );
		}
		await store.set('config.ESM', config);

		sendIPCMessage( "renewESMConfigView", config );  // 保存したので画面に通知
		sendIPCMessage( "configSaved", 'ESM' );  // 保存したので画面に通知
	},

	/**
	 * @func getConfig
	 * @desc getConfig
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * @func getPersist
	 * @desc getPersist
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	getPersist: function() {
		return persist;
	},


	//////////////////////////////////////////////////////////////////////
	// Entry point
	/**
	 * @func startCore
	 * @desc startCore
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	startCore: async function( _receiveCallback, _changeCallback ) {
		// pre-conditions
		if( !config.dongleType )  { throw new Error('mainESM.startCore(); config.dongleType is null.'); }
		if( !config.id )          { throw new Error('mainESM.startCore(); config.id is null.'); }
		if( !config.password )    { throw new Error('mainESM.startCore(); config.password is null.'); }
		if( !_receiveCallback )   { throw new Error('mainESM.startCore(); receiveCallback is null.'); }
		if( !_changeCallback )    { throw new Error('mainESM.startCore(); changeCallback is null.'); }

		mainESM.receiveCallback = _receiveCallback;
		mainESM.changeCallback  = _changeCallback;

		if( mainESM.observationPort ) {
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.startCore() already started.'):0;
		}

		// 既に接続していたら機器情報の変化をみる。接続していなかったら接続する
		// USB挿抜を30秒で監視
		mainESM.observationPort = cron.schedule('*/30 * * * * *', async () => {
			if( mainESM.connected ) { // 接続してればなにもしない
				config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.startCore().cron.schedule(), serialport has already connected.'):0;
			}else{ // 接続してなければ初期化からやる
				config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.startCore().cron.schedule(), serialport is NOT connected.'):0;
				try{
					await eSM.initialize( config, mainESM.receiveCallback );  // ライブラリの方でリエントラント制御してるので、ここでは雑に呼ぶ
				}catch(error){
					await eSM.release();
					console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.startCore() error:', error);
				}
			}
		});
	},


	//////////////////////////////////////////////////////////////////////
	// inner functions
	/**
	 * @func renewPortList
	 * @desc renewPortList
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	renewPortList: async function () {
		return await eSM.renewPortList();
	},


	/**
	 * @func received
	 * @desc 受信の処理
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	received: function ( sm, rinfo, els, error ) {
		// わからんエラー
		if( error ) {
			sendIPCMessage( "Error", '' + error + '<br>スマートメータの設定をもう一度確認し、一度アプリを再起動してみてください。' );
			console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.received() error:\x1b[32m', error, '\x1b[0m');
			return;
		}
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.received() sm:\x1b[32m', sm, '\x1b[0m' ):0;
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.received() rinfo:\x1b[32m', rinfo, '\x1b[0m'):0;
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.received() els:\x1b[32m', els, '\x1b[0m'):0;

		try{
			// 切断された
			if( sm.state == 'close' ) {
				mainESM.connected = false;  // 未接続にする
				return;
			}

			// 初回接続時, first connection
			if( !mainESM.connected && sm.state == 'available' ) {
				config.EPANDESC = eSM.EPANDESC;  // 接続できたので接続情報を確保
				mainESM.connected = true;  // 接続できたフラグ

				eSM.getStatic(); // 初回接続時は静的プロパティをもらっておく
				mainESM.observe(); // 監視も開始
			}

			if( els ) {
				mainESM.connected = true;  // 接続できたフラグ
				sendIPCMessage( "ESMLinked" );

				// 受信データを解析してDBに格納
				let rawdata = EL.getSeparatedString_ELDATA(els);
				ELconv.elsAnarysis(els, function( eljson ) {
					for (const [key, value] of Object.entries(eljson.EDT) ) {
						esmdataModel.create({ srcip: rinfo.address, seoj: eljson.SEOJ, deoj: eljson.DEOJ, esv: eljson.ESV, epc: key, edt: value });
					}
				});
				esmrawModel.create({ srcip: rinfo.address, rawdata: rawdata, seoj: els.SEOJ, deoj: els.DEOJ, esv: els.ESV, opc: els.OPC, detail: els.DETAIL });

			}else{
				// elsが入っていないときは処理しない
				config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.received() els is NO Data'):0;
			}
		}catch(e){
			console.error(e);
		}
	},


	//////////////////////////////////////////////////////////////////////
	// 定時処理のインタフェース
	/**
	 * @func observe
	 * @desc スマートメータを監視する、初回受信時にトリガー
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	observe: function() {
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.observe() start.' ):0;

		if( mainESM.observationJob ) {
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.observe() already started.' ):0;
		}

		// 監視はcronで実施、1分毎
		mainESM.observationJob = cron.schedule('*/1 * * * *', () => {
			config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.observe.cron.schedule()'):0;

			// 既に接続していたら機器情報の変化をみる。接続していなかったら接続する。30秒に1回、ポートの状況を監視
			// この処理はmainESM.start()でobserve serialportとして分割した。
			// ここでは機器情報を1分に1回取得しに行く処理だけ書く

			if( mainESM.connected ) {
				// 機器情報の変化の監視
				eSM.getMeasuredValues();  // 機器情報の変化を定期的にgetする
				// config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.observe().cron facilities:\x1b[32m', eSM.facilities, '\x1b[0m' ):0;
				mainESM.changeCallback( eSM.facilities );

			}else{
				// 切断状態
				config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.observe.cron.schedule() is NO connection.'):0;
			}
		});
	},


	/**
	 * @func stopObservation
	 * @desc 監視をやめる
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	stopObservation: function() {
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.stopObserve() observation.' ):0;

		if( mainESM.observationJob ) {
			mainESM.observationJob.stop();
			mainESM.observationJob = null;
		}
	},


	//////////////////////////////////////////////////////////////////////
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
	 * @func getCases
	 * @desc 定時処理、スマートメータのデータ送信
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
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


	/**
	 * @func getRows
	 * @desc DBからテーブル取得
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	getRows: async function() {
		try {
			let now = new Date();  // 現在
			let begin = new Date(now);  // 現在時刻UTCで取得
			begin.setHours( begin.getHours() - begin.getHours() - 1, 57, 0, 0 ); // 前日の23時57分０秒にする
			let end = new Date(begin);  // 現在時刻UTCで取得
			end.setHours( begin.getHours() + 25, 0, 0, 0 ); // 次の日の00:00:00にする
			let cases = mainESM.getCases( now );

			let subQuery = `CASE ${cases} END`;

			// 3分毎データ
			let rows = await electricEnergyModel.findAll( {
				attributes: ['id',
							 [Sequelize.fn('AVG', Sequelize.col('commulativeAmountNormal')), 'avgCommulativeAmountNormal'],
							 [Sequelize.fn('AVG', Sequelize.col('commulativeAmountReverse')), 'avgCommulativeAmountReverse'],
							 [Sequelize.fn('AVG', Sequelize.col('instantaneousPower')), 'avgInstantaneousPower'],
							 [Sequelize.fn('AVG', Sequelize.col('instantaneousCurrentsR')), 'avgInstantaneousCurrentsR'],
							 [Sequelize.fn('AVG', Sequelize.col('instantaneousCurrentsT')), 'avgInstantaneousCurrentsT'],
							 'createdAt',
							 [Sequelize.literal(subQuery), 'timeunit']
							 ],
				where: {
					srcType: 'Meter',
					dateTime: { [Op.between] : [begin.toISOString(), end.toISOString()] }
				},
				group: ['timeunit']
			} );

			return rows;
		} catch( error ) {
			console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainOmron.getTodayRoomEnvOmron()', error);
		}
	},


	/**
	 * @func getTodayElectricEnergy
	 * @desc 電力
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	getTodayElectricEnergy: async function( ) {
		// 画面に今日のデータを送信するためのデータ作る
		try {
			let rows = await mainESM.getRows();

			let T1 = new Date();
			T1.setHours( 0, 0, 0);

			let array = [];
			for( let t=0; t<480; t+=1 ) {
				let row = rows.find( (row) => row.dataValues.timeunit == T1.toFormat('HH24:MI') );

				if( row ) {
					array.push( {
						id: t,
						time: T1.toISOString(),
						srcType: 'electric',
						commulativeAmountNormal: row.dataValues.avgCommulativeAmountNormal,
						commulativeAmountReverse: row.dataValues.avgCommulativeAmountReverse,
						instantaneousPower: row.dataValues.avgInstantaneousPower,
						instantaneousCurrentsR: row.dataValues.avgInstantaneousCurrentsR,
						instantaneousCurrentsT: row.dataValues.avgInstantaneousCurrentsT
					} );
				}else{
					array.push( {
						id: t,
						time: T1.toISOString(),
						srcType: 'electric',
						commulativeAmountNormal: null,
						commulativeAmountReverse: null,
						instantaneousPower: null,
						instantaneousCurrentsR: null,
						instantaneousCurrentsT: null
					});
				}

				T1.setMinutes( T1.getMinutes() +3 ); // + 3 min
			}
			return array;

		} catch( error ) {
			console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.getTodayElectricEnergy()', error);
			throw error;
		}
	},

	/**
	 * @func sendTodayEnergy
	 * @desc 全体
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	sendTodayEnergy: async function( ) {
		let arg = { };

		// WI-SUNのスマートメータ
		if( config.enabled ) {
			arg = await mainESM.getTodayElectricEnergy();
			// config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.sendTodayEnergy() arg:\x1b[32m', arg, '\x1b[0m' ):0;
			sendIPCMessage( 'renewTodayElectricEnergy', JSON.stringify(arg));
		}
	}

};


module.exports = mainESM;
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
