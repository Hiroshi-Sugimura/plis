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
import { store } from './storeSingleton.mjs';
import { logger } from './logger.mjs';
import eSM from 'e-smartmeter-echonet-lite';
import cron from 'node-cron';
import EL from 'echonet-lite';
import ELconv from 'echonet-lite-conv';
import localDB from './models/localDBModels.mjs';   // DBデータと連携
const { Sequelize, Op, esmdataModel, esmrawModel, electricEnergyModel } = localDB;
import { objectSort, isObjEmpty, mergeDeeply, getCases } from './mainSubmodule.mjs';



// 基礎設定
const appDir = process.env.NODE_ENV === 'development' ? __dirname : __dirname;
let sendIPCMessage = null;
// const store = new Store();

/**
 * @typedef {Object} ESMConfig
 * @property {boolean} enabled 有効/無効
 * @property {'ROHM'|'TESSERA'} dongleType ドングル種類
 * @property {string} id BルートID
 * @property {string} password Bルートパスワード
 * @property {string} userAmpere 契約アンペア
 * @property {Object} EPANDESC 接続情報
 * @property {'stable'|'fast'} connectionType 接続方式
 * @property {boolean} debug ライブラリのデバッグ
 */
let config = /** @type {ESMConfig} */ ({
	enabled: false,  // 有効/無効
	dongleType: 'TESSERA',  // 'ROHM' or 'TESSERA', default:TESSERA
	id: '',   // Bルート認証ID設定, Your B route ID.
	password: '',   // Bルート認証パスワード設定, Your B route password.
	userAmpere: '30', // ユーザの契約アンペア
	EPANDESC: {},       // コネクション情報
	connectionType: 'stable', // 接続方式, 'stable' or 'fast', stable:No use EPANDESC
	debug: false     // スマメライブラリのデバッグ有効
});

/** @typedef {{[key:string]: any, IPs?: string[]}} ESMPersist */
let persist = /** @type {ESMPersist} */ ({});


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
	 * 初期化して監視開始。起動済みなら現状送信してreturn。
	 * @param {(ch:string,...args:any[])=>void} _sendIPCMessage IPC送信用関数
	 * @returns {void}
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
			logger.debug('mainESM', config.debug, 'start(): ESM is disabled.');
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
			logger.debug('mainESM', config.debug, 'start()');
			mainESM.startObserve();		// 定時処理
		} catch (error) {
			logger.debug('mainESM', config.debug, 'start(): startObserve error');
			mainESM.isRun = false;
		}

		if (persist) {
			sendIPCMessage("fclESM", persist);
		}
		mainESM.sendTodayEnergy(); // 現在持っているデータを送っておく
	},


	/**
	 * 監視停止・ポート解放・設定/persist保存。
	 * @returns {Promise<void>}
	 */
	stop: async function () {
		mainESM.isRun = false;
		logger.debug('mainESM', config.debug, 'stop()');

		mainESM.connected = false;
		await mainESM.stopObservation();
		await eSM.release();
		await mainESM.setConfig();
		await store.set('persist.ESM', persist);
	},

	/**
	 * 保存せず停止（監視停止とポート解放のみ）。
	 * @returns {Promise<void>}
	 */
	stopWithoutSave: async function () {
		mainESM.isRun = false;
		logger.debug('mainESM', config.debug, 'stopWithoutSave()');

		mainESM.connected = false;
		await mainESM.stopObservation();
		await eSM.release();
	},

	/**
	 * 設定をディープマージして保存。引数省略時は現状保存のみ。
	 * @param {Partial<ESMConfig>=} _config
	 * @returns {Promise<void>}
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
	 * 現在の設定を返す。
	 * @returns {ESMConfig}
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * 現在の保持データを返す。
	 * @returns {ESMPersist}
	 */
	getPersist: function () {
		return persist;
	},



	//////////////////////////////////////////////////////////////////////
	// 定時処理のインタフェース
	/**
	 * 監視Cronを開始（1分毎）。接続/測定/DB登録/送信フローをドライブ。
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
			logger.debug('mainESM', config.debug, 'startObserve.cron.schedule()');

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
	 * 監視Cronを停止。
	 */
	stopObservation: function () {
		logger.debug('mainESM', config.debug, 'stopObserve() observation.');

		if (mainESM.observationJob) {
			mainESM.observationJob.stop();
			mainESM.observationJob = null;
		}
	},


	//////////////////////////////////////////////////////////////////////
	// inner functions
	//////////////////////////////////////////////////////////////////////

	/**
	 * 現在のデータをDBにinsert（1分毎想定）。
	 * @returns {Promise<void>}
	 */
	insertDB: async () => {
		try {
			logger.debug('mainESM', config.debug, 'insertDB() every min');

			let dt = new Date();

			// Wi-SUN電力スマートメーターの状態のチェック
			if (mainESM.connected && persist && persist.IPs && persist.IPs.length != 0) {
				// logger.debug('mainESM', config.debug, `insertDB() persist: ${JSON.stringify(persist)}`);

				let ip = persist.IPs[0];
				let sm = persist[ip];
				// 蓄積するほどデータがそろってない場合はスキップ
				if (!sm || !sm['低圧スマート電力量メータ01(028801)']) {
					logger.debug('mainESM', config.debug, 'insertDB(): SmartMeter persist.esmData is Null.');

				} else if (!sm['低圧スマート電力量メータ01(028801)']['設置場所(81)']) {  // 基本プロパティがなければ取り直す
					logger.debug('mainESM', config.debug, 'insertDB(): SmartMeter esmData.place is Null.');
					eSM.getStatic();

				} else if (isObjEmpty(sm.Means)) {
					logger.debug('mainESM', config.debug, 'insertDB(): SmartMeter sm.Means is Empty.');

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

					// logger.debug('mainESM', config.debug, `insertDB() ESM insert: ${JSON.stringify(q)}`);
					electricEnergyModel.create(q);
				}
			};

			mainESM.sendTodayEnergy(); 		// 本日のデータの定期的送信 スマートメータ分
		} catch (error) {
			logger.error('mainESM', 'insertDB() each 3min', error);
			throw error;
		}
	},

	/**
	 * シリアルポート一覧を取得。
	 * @returns {Promise<any[]>}
	 */
	renewPortList: async function () {
		return await eSM.renewPortList();
	},


	/**
	 * 受信処理。接続状態更新、DB格納、UI通知。
	 * @param {any} sm e-smartmeterオブジェクト状態
	 * @param {{address:string}} rinfo 送信元
	 * @param {any} els 受信EL構造
	 * @param {Error=} error エラー
	 * @returns {void}
	 */
	received: function (sm, rinfo, els, error) {
		// わからんエラー
		if (error) {
			sendIPCMessage('Error', { datetime: formatDate(new Date(), "YYYY-MM-DD HH24:MI:SS"), moduleName: 'mainESM.received()', stackLog: `${error}\nスマートメータの設定をもう一度確認し、一度アプリを再起動してください。または機器を再起動してください。` });

			logger.error('mainESM', 'received() error:\x1b[32m', error, '\x1b[0m');
			return;
		}
		logger.debug('mainESM', config.debug, `received() sm:\x1b[32m ${JSON.stringify(sm)} \x1b[0m`);
		logger.debug('mainESM', config.debug, `received() rinfo:\x1b[32m ${JSON.stringify(rinfo)} \x1b[0m`);
		logger.debug('mainESM', config.debug, `received() els:\x1b[32m ${JSON.stringify(els)} \x1b[0m`);

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
				logger.debug('mainESM', config.debug, 'received() els is NO Data');
			}
		} catch (e) {
			logger.error('mainESM', 'received() error:', e);
		}
	},

	/**
	 * 設備変化時のコールバック。解析してpersist更新＋UI送信。
	 * @param {any} facilities
	 */
	changeCallback: function (facilities) {
		ELconv.refer(objectSort(facilities), function (devs) {
			// console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| ESMStart() devs:\x1b[32m', objectSort(devs), '\x1b[0m' );
			persist = eSM.objectSort(devs);
			sendIPCMessage("fclESM", persist);
		});
	},





	/**
	 * DBから今日の3分刻み集計を取得。
	 * @returns {Promise<any[]>}
	 */
	getRows: async function () {
		try {
			let now = new Date();  // 現在
			let begin = new Date(now);  // 現在時刻UTCで取得
			begin.setHours(begin.getHours() - begin.getHours() - 1, 57, 0, 0); // 前日の23時57分０秒にする
			let end = new Date(begin);  // 現在時刻UTCで取得
			end.setHours(begin.getHours() + 25, 0, 0, 0); // 次の日の00:00:00にする
			let cases = getCases(now);

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
			logger.error('mainESM', 'getRows()', error);
		}
	},


	/**
	 * 今日の電力データを3分刻み配列で返す。
	 * @returns {Promise<Array<{id:number,time:string,srcType:string,commulativeAmountNormal:number|null,commulativeAmountReverse:number|null,instantaneousPower:number|null,instantaneousCurrentsR:number|null,instantaneousCurrentsT:number|null}>>}
	 */
	getTodayElectricEnergy: async function () {
		// 画面に今日のデータを送信するためのデータ作る
		try {
			let rows = await mainESM.getRows();

			let T1 = new Date();
			T1.setHours(0, 0, 0);

			let array = [];
			for (let t = 0; t < 480; t += 1) {  // 3分が480回で1440＝1日
				let row = rows.find((row) => row.dataValues.timeunit == formatDate(T1, 'HH24:MI'));

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
			logger.error('mainESM', 'getTodayElectricEnergy()', error);
			throw error;
		}
	},

	/**
	 * 今日の電力データを取得してRendererへ送る。
	 * @returns {Promise<void>}
	 */
	sendTodayEnergy: async function () {
		let arg = {};

		// WI-SUNのスマートメータ
		if (config.enabled) {
			arg = await mainESM.getTodayElectricEnergy();
			// logger.debug('mainESM', config.debug, `sendTodayEnergy() arg: ${JSON.stringify(arg)}`);
			sendIPCMessage('renewTodayElectricEnergy', JSON.stringify(arg));
		}
	}

};


// module.exports = mainESM;
export { mainESM };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
