//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2021.11.11
//////////////////////////////////////////////////////////////////////
/**
 * @module mainESM
 */
// 'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { fileURLToPath } from "node:url";
import fs from 'fs';
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import Store from 'electron-store';
import eSM from 'e-smartmeter-echonet-lite';
import cron from 'node-cron';
import EL from 'echonet-lite';
import ELconv from 'echonet-lite-conv';
import { Sequelize, Op, esmdataModel, esmrawModel, electricEnergyModel } from './models/localDBModels.cjs';   // DBデータと連携
import { objectSort, isObjEmpty, mergeDeeply } from './mainSubmodule.cjs';



// 基礎設定
const appDir = process.env.NODE_ENV === 'development' ? __dirname : __dirname;
let sendIPCMessage = null;
const store = new Store();

let config = {
	enabled: false,  // 有効/無効
	dongleType: 'TESSERA',  // 'ROHM' or 'TESSERA', default:TESSERA
	id: '',   // Bルート認証ID設定, Your B route ID.
	password: '',   // Bルート認証パスワード設定, Your B route password.
	userAmpere: '30', // ユーザの契約アンペア
	EPANDESC: {},       // コネクション情報
	connectionType: 'stable', // 接続方式, 'stable' or 'fast', stable:No use EPANDESC
	debug: false     // スマメライブラリのデバッグ有効
};

let persist = {};


//////////////////////////////////////////////////////////////////////
// config
let mainESM = {
	isRun: false,  // 動作中
	observationJob: null,
	observationPort: null,
	connected: false, // 初回起動のみ実施するためのフラグ, flag for first connection

	//////////////////////////////////////////////////////////////////////
	// interfaces
	//////////////////////////////////////////////////////////////////////

	/**
	 * @func start
	 * @desc 初期化と開始
	 * @async
	 * @param {sendIPCMessage} _sendIPCMessage IPC通信関数
	 * @return void
	 * @throw error
	 */
	start: function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		if (mainESM.isRun) {
			if (persist) {
				sendIPCMessage("renewESMConfigView", config);
				sendIPCMessage("fclESM", persist);
			}
			mainESM.sendTodayEnergy(); // 現在持っているデータを送っておく
			return;
		}

		config.enabled = store.get('config.ESM.enabled', false);
		config.dongleType = store.get('config.ESM.dongleType', '');
		config.id = store.get('config.ESM.id', '');
		config.password = store.get('config.ESM.password', '');
		config.userAmpere = store.get('config.ESM.userAmpere', '30');
		config.connectionType = store.get('config.ESM.connectionType', 'stable');
		config.EPANDESC = store.get('config.ESM.EPANDESC', {});
		config.debug = store.get('config.ESM.debug', false);

		persist = store.get('persist.ESM', {});

		sendIPCMessage("renewESMConfigView", config);

		if (config.enabled == false) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.start() desabled.') : 0;
			mainESM.isRun = false;
			return;
		}
		mainESM.isRun = true;

		// 辞書の読み込みをオーバーライド
		ELconv.initialize = function () {
			ELconv.m_dictNod = JSON.parse(fs.readFileSync(path.join(appDir, 'nodeProfile.json'), 'utf8'));
			ELconv.m_dictSup = JSON.parse(fs.readFileSync(path.join(appDir, 'superClass_I.json'), 'utf8'));
			ELconv.m_dictDev = JSON.parse(fs.readFileSync(path.join(appDir, 'deviceObject_I.json'), 'utf8'));
			ELconv.m_dictMakers = JSON.parse(fs.readFileSync(path.join(appDir, 'makers.json'), 'utf8'));
		};
		ELconv.initialize();

		try {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.start()') : 0;
			mainESM.startObserve();		// 定時処理
		} catch (error) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.start() startObserve error') : 0;
			mainESM.isRun = false;
		}

		if (persist) {
			sendIPCMessage("fclESM", persist);
		}
		mainESM.sendTodayEnergy(); // 現在持っているデータを送っておく
	},


	/**
	 * @func stop
	 * @desc シリアルポートを開放して連携終了、設定や現在の数値を永続化する
	 * @async
	 * @param {void}
	 */
	stop: async function () {
		mainESM.isRun = false;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.stop()') : 0;

		mainESM.connected = false;
		await mainESM.stopObservation();
		await eSM.release();
		await mainESM.setConfig();
		await store.set('persist.ESM', persist);
	},

	/**
	 * @func stopWithoutSave
	 * @desc シリアルポートを開放して連携終了、設定や現在の数値を永続化しない
	 * @async
	 * @param {void}
	 * @throw error
	 */
	stopWithoutSave: async function () {
		mainESM.isRun = false;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.stopWithoutSave()') : 0;

		mainESM.connected = false;
		await mainESM.stopObservation();
		await eSM.release();
	},

	/**
	 * @func setConfig
	 * @desc 設定をセットするとともに永続化する、引数なければ保存だけする
	 * @async
	 * @param {config} _config 設定、nullなら保存のみ
	 * @return void
	 * @throw error
	 */
	setConfig: async function (_config) {
		if (_config) {
			config = mergeDeeply(config, _config);
		}
		await store.set('config.ESM', config);

		sendIPCMessage("renewESMConfigView", config);  // 保存したので画面に通知
		sendIPCMessage("configSaved", 'ESM');  // 保存したので画面に通知
	},

	/**
	 * @func getConfig
	 * @desc 現在の設定を取得する
	 * @async
	 * @param {void}
	 * @return config config
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * @func getPersist
	 * @desc 現在のデータを取得する
	 * @async
	 * @param {void}
	 * @return persist persist
	 */
	getPersist: function () {
		return persist;
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
	startObserve: function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.startObserve() start.') : 0;

		if (mainESM.observationJob) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.startObserve() already started.') : 0;
		}

		// 1分毎に監視タスクは動作する
		// 接続状態チェック
		// 機器情報の変化を意味付けする
		// DBにinsertする
		mainESM.observationJob = cron.schedule('*/1 * * * *', async () => {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.startObserve.cron.schedule()') : 0;

			// 既に接続していたら機器情報の変化をみる。接続していなかったら接続する
			// この処理はmainESM.start()でobserve serialportとして分割した。

			if (mainESM.connected) {
				// 機器情報の変化の監視
				eSM.getMeasuredValues();  // 機器情報の変化を定期的にgetする
				mainESM.changeCallback(eSM.facilities);  // 機器の変化の監視
				mainESM.insertDB();  // データベースに登録

			} else {
				// 切断状態なら再接続？
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.startObserve.cron.schedule() is NO connection.') : 0;

				// 既に接続していたら機器情報の変化をみる。接続していなかったら接続する
				if (eSM.state == 'disconnected') {
					config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.startObserve.cron.schedule() eSM.state is disconnected.') : 0;
					if (config.connectionType == 'stable') {
						config.EPANDESC = {};
					}
					eSM.initialize(config, mainESM.received);  // ライブラリの方でリエントラント制御してるので、ここでは雑に呼ぶ
				}
			}
		});

		mainESM.observationJob.start();
	},


	/**
	 * @func stopObservation
	 * @desc 監視をやめる
	 * @async
	 * @param {void}
	 * @return void
	 */
	stopObservation: function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.stopObserve() observation.') : 0;

		if (mainESM.observationJob) {
			mainESM.observationJob.stop();
			mainESM.observationJob = null;
		}
	},


	//////////////////////////////////////////////////////////////////////
	// inner functions
	//////////////////////////////////////////////////////////////////////

	/**
	 * @func insertDB
	 * @desc 現在のデータをDBにinsertする、基本的には１分に１回呼ばれる
	 * @async
	 * @param {void}
	 * @return void
	 */
	insertDB: async () => {
		try {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.insertDB() every min') : 0;

			let dt = new Date();

			// Wi-SUN電力スマートメーターの状態のチェック
			if (mainESM.connected && persist && persist.IPs && persist.IPs.length != 0) {
				// config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.insertDB() persist:\x1b[32m', persist, '\x1b[0m' ):0;

				let ip = persist.IPs[0];
				let sm = persist[ip];
				// 蓄積するほどデータがそろってない場合はスキップ
				if (!sm || !sm['低圧スマート電力量メータ01(028801)']) {
					config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.insertDB.() SumartMeter persist.esmData is Null.') : 0;

				} else if (!sm['低圧スマート電力量メータ01(028801)']['設置場所(81)']) {  // 基本プロパティがなければ取り直す
					config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.insertDB() SumartMeter esmData.place is Null.') : 0;
					eSM.getStatic();

				} else if (isObjEmpty(sm.Means)) {
					config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.insertDB() SumartMeter sm.Means is Empty.') : 0;

				} else {
					// merge用ベース
					let means = {
						'積算電力量計測値（正方向計測値）[kWh]': null,
						'積算電力量計測値（逆方向計測値）[kWh]': null,
						'定時積算電力量計測値正方向': {
							'日時': null,
							'計測値[kWh]': null
						},
						'定時積算電力量計測値逆方向': {
							'日時': null,
							'計測値[kWh]': null
						}
					};

					// merge用ベースとesmDataとマージ
					let mergeObj = mergeDeeply(means, sm.Means);
					// config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.insertDB() ESM mergeObj \x1b[32m', mergeObj, '\x1b[0m' ):0;

					let instantaneousPower = null;
					if (sm['低圧スマート電力量メータ01(028801)']['瞬時電力計測値(E7)']) {
						// console.log( 'E7:', sm['低圧スマート電力量メータ01(028801)']['瞬時電力計測値(E7)'] );
						instantaneousPower = sm['低圧スマート電力量メータ01(028801)']['瞬時電力計測値(E7)'].split('W')[0];
					}

					let instantaneousCurrentsR = null;
					if (sm['低圧スマート電力量メータ01(028801)']['瞬時電流計測値(E8)']) {
						let e8 = JSON.parse(sm['低圧スマート電力量メータ01(028801)']['瞬時電流計測値(E8)'].split('(')[0]);
						let rp = e8['RPhase'];
						// console.log( rp );
						instantaneousCurrentsR = rp.split('[A]')[0];
					}

					let instantaneousCurrentsT = null;
					if (sm['低圧スマート電力量メータ01(028801)']['瞬時電流計測値(E8)']) {
						let e8 = JSON.parse(sm['低圧スマート電力量メータ01(028801)']['瞬時電流計測値(E8)'].split('(')[0]);
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

					// config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.insertDB() ESM insert:\x1b[32m', q, '\x1b[0m' ):0;
					electricEnergyModel.create(q);
				}
			};

			mainESM.sendTodayEnergy(); 		// 本日のデータの定期的送信 スマートメータ分
		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.insertDB() each 3min, error:', error);
			throw error;
		}
	},

	/**
	 * @func renewPortList
	 * @desc シリアルポートリストを取得する
	 * @async
	 * @param {void}
	 * @return Array シリアルポートリスト
	 * @throw error
	 */
	renewPortList: async function () {
		return await eSM.renewPortList();
	},


	/**
	 * @func received
	 * @desc 受信処理
	 * @async
	 * @param {eSM} sm スマメオブジェクト
	 * @param {rinfo} rinfo 送信元のIPアドレス
	 * @param {ELStructure} els ECHONET Lite Structureの形で受信したデータ
	 * @param {Error} error エラーオブジェクト、エラーがあったときに情報あり
	 * @return void
	 * @throw error
	 */
	received: function (sm, rinfo, els, error) {
		// わからんエラー
		if (error) {
			sendIPCMessage('Error', { datetime: new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), moduleName: 'mainESM.received()', stackLog: `${error}\nスマートメータの設定をもう一度確認し、一度アプリを再起動してください。または機器を再起動してください。` });

			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.received() error:\x1b[32m', error, '\x1b[0m');
			return;
		}
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.received() sm:\x1b[32m', sm, '\x1b[0m') : 0;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.received() rinfo:\x1b[32m', rinfo, '\x1b[0m') : 0;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.received() els:\x1b[32m', els, '\x1b[0m') : 0;

		try {
			// 切断された
			if (sm.state == 'close') {
				mainESM.connected = false;  // 未接続にする
				return;
			}

			// 初回接続時, first connection
			if (!mainESM.connected && sm.state == 'available') {
				config.EPANDESC = eSM.EPANDESC;  // 接続できたので接続情報を確保
				mainESM.connected = true;  // 接続できたフラグ

				eSM.getStatic(); // 初回接続時は静的プロパティをもらっておく
			}

			if (els) {
				mainESM.connected = true;  // 接続できたフラグ
				sendIPCMessage("ESMLinked");

				// 受信データを解析してDBに格納
				let rawdata = EL.getSeparatedString_ELDATA(els);
				ELconv.elsAnarysis(els, function (eljson) {
					for (const [key, value] of Object.entries(eljson.EDT)) {
						esmdataModel.create({ srcip: rinfo.address, seoj: eljson.SEOJ, deoj: eljson.DEOJ, esv: eljson.ESV, epc: key, edt: value });
					}
				});
				esmrawModel.create({ srcip: rinfo.address, rawdata: rawdata, seoj: els.SEOJ, deoj: els.DEOJ, esv: els.ESV, opc: els.OPC, detail: els.DETAIL });

			} else {
				// elsが入っていないときは処理しない
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.received() els is NO Data') : 0;
			}
		} catch (e) {
			console.error(e);
		}
	},

	/**
	 * @func changeCallback
	 * @desc 受信処理、変更があった場合に呼ばれる
	 * @async
	 * @param {facilities} facilities 変更後データ
	 * @return void
	 */
	changeCallback: function (facilities) {
		ELconv.refer(objectSort(facilities), function (devs) {
			// console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| ESMStart() devs:\x1b[32m', objectSort(devs), '\x1b[0m' );
			persist = eSM.objectSort(devs);
			sendIPCMessage("fclESM", persist);
		});
	},


	/**
	 * @func getCases
	 * @desc 或る日のデータを3分単位で取得するためのwhen文を生成する
	 * @async
	 * @param {string} date 或る日
	 * 	date: Date="2023-01-06"
	 * @return {string} when文の文字列
	 * 	when createdAt >= "2023-01-05 23:57" and createdAt < "2023-01-06 00:00" then "00:00"
	 *	when createdAt >= "2023-01-06 00:00" and createdAt < "2023-01-06 00:03" then "00:03"
	 *	when createdAt >= "2023-01-06 00:03" and createdAt < "2023-01-06 00:06" then "00:06"
	 *	...
	 *	when createdAt >= "2023-01-06 23:54" and createdAt < "2023-01-06 23:57" then "23:57"
	 *	else "24:00"
	 */
	getCases: function (date) {
		let T1 = new Date(date);
		let T2 = new Date(date);
		let T3 = new Date(date);
		let T4 = new Date(date);

		// UTCだがStringにて表現しているので、なんか複雑
		T1.setHours(T1.getHours() - T1.getHours() - 10, 57, 0, 0); // 前日の14時57分xx秒   14:57:00 .. 15:00:00 --> 00:00
		T2.setHours(T1.getHours() - T1.getHours() - 10, 58, 0, 0); // T1 + 1min
		T3.setHours(T1.getHours() - T1.getHours() - 10, 59, 0, 0); // T1 + 2min
		T4.setHours(T1.getHours() - T1.getHours(), 0, 0, 0); // 集約先

		let ret = "";
		for (let t = 0; t < 480; t += 1) {  // 24h * 20 times (= 60min / 3min)
			// console.log( T1.toISOString(), ':', T1.toFormat('YYYY-MM-DD HH24:MI'), ', ', T4.toFormat('HH24:MI') );

			ret += `WHEN "createdAt" LIKE "${T1.toFormat('YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${T2.toFormat('YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${T3.toFormat('YYYY-MM-DD HH24:MI')}%" THEN "${T4.toFormat('HH24:MI')}" \n`;

			T1.setMinutes(T1.getMinutes() + 3); // + 3 min
			T2.setMinutes(T2.getMinutes() + 3); // + 3 min
			T3.setMinutes(T3.getMinutes() + 3); // + 3 min
			T4.setMinutes(T4.getMinutes() + 3); // + 3 min
		}
		return ret + 'ELSE "24:00"';
	},


	/**
	 * @func getRows
	 * @desc DBから今日のデータを取得
	 * @async
	 * @param {void}
	 * @return Array[] rows
	 */
	getRows: async function () {
		try {
			let now = new Date();  // 現在
			let begin = new Date(now);  // 現在時刻UTCで取得
			begin.setHours(begin.getHours() - begin.getHours() - 1, 57, 0, 0); // 前日の23時57分０秒にする
			let end = new Date(begin);  // 現在時刻UTCで取得
			end.setHours(begin.getHours() + 25, 0, 0, 0); // 次の日の00:00:00にする
			let cases = mainESM.getCases(now);

			let subQuery = `CASE ${cases} END`;

			// 3分毎データ
			let rows = await electricEnergyModel.findAll({
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
					dateTime: { [Op.between]: [begin.toISOString(), end.toISOString()] }
				},
				group: ['timeunit']
			});

			return rows;
		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.getRows()', error);
		}
	},


	/**
	 * @func getTodayElectricEnergy
	 * @desc 今日のデータを配列として取得する
	 * @async
	 * @param {void}
	 * @return Array[Object] 今日のデータ
	 * @throw error
	 */
	getTodayElectricEnergy: async function () {
		// 画面に今日のデータを送信するためのデータ作る
		try {
			let rows = await mainESM.getRows();

			let T1 = new Date();
			T1.setHours(0, 0, 0);

			let array = [];
			for (let t = 0; t < 480; t += 1) {  // 3分が480回で1440＝1日
				let row = rows.find((row) => row.dataValues.timeunit == T1.toFormat('HH24:MI'));

				if (row) {
					array.push({
						id: t,
						time: T1.toISOString(),
						srcType: 'electric',
						commulativeAmountNormal: row.dataValues.avgCommulativeAmountNormal,
						commulativeAmountReverse: row.dataValues.avgCommulativeAmountReverse,
						instantaneousPower: row.dataValues.avgInstantaneousPower,
						instantaneousCurrentsR: row.dataValues.avgInstantaneousCurrentsR,
						instantaneousCurrentsT: row.dataValues.avgInstantaneousCurrentsT
					});
				} else {
					array.push({
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

				T1.setMinutes(T1.getMinutes() + 3); // + 3 min
			}
			return array;

		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.getTodayElectricEnergy()', error);
			throw error;
		}
	},

	/**
	 * @func sendTodayEnergy
	 * @desc 現在持っているデータをRendererに送る
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	sendTodayEnergy: async function () {
		let arg = {};

		// WI-SUNのスマートメータ
		if (config.enabled) {
			arg = await mainESM.getTodayElectricEnergy();
			// config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainESM.sendTodayEnergy() arg:\x1b[32m', arg, '\x1b[0m' ):0;
			sendIPCMessage('renewTodayElectricEnergy', JSON.stringify(arg));
		}
	}

};


// module.exports = mainESM;
export { mainESM };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
