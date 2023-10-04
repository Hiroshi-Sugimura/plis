//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainEL
 */
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');
const cron = require('node-cron');  // 監視はechonet-liteモジュールに頼らないで自前でやる
const EL = require('echonet-lite');
const ELconv = require('echonet-lite-conv');
const mainArp = require('./mainArp');     // arpの管理
const mainSystem = require('./mainSystem');     // systemの管理(network部分を利用)
const { Sequelize, Op, elrawModel, eldataModel, electricEnergyModel } = require('./models/localDBModels');   // DBデータと連携
const { objectSort, isObjEmpty, mergeDeeply } = require('./mainSubmodule');

// 基礎設定
const appDir = process.env.NODE_ENV === 'development' ? __dirname : __dirname;
let sendIPCMessage = null;
const store = new Store();

let config = {
	enabled: true,
	oldSearch: false,
	debug: false
};

let network = {
	IPver: 0,
	IPv4: "auto",
	IPv6: "auto"
};

let persist = {
	facilities: {},
	parsed: {}
};


//////////////////////////////////////////////////////////////////////
// EL関連
let mainEL = {
	objList: ['05ff01'],  // 自分のELオブジェクトリスト
	controllerObj: {  // 自分はELコントローラ
		// super
		"80": [0x30], // 動作状態
		"81": [0xff], // 設置場所
		"82": [0x00, 0x00, 0x46, 0x00], // release F
		"88": [0x42], // 異常状態
		"8a": [0x00, 0x00, 0x77], // maker code
		"9d": [0x04, 0x80, 0x8f, 0xa0, 0xb0], // inf map, 1 Byte目は個数
		"9e": [0x04, 0x80, 0x8f, 0xa0, 0xb0], // set map, 1 Byte目は個数
		"9f": [0x09, 0x80, 0x81, 0x82, 0x88, 0x8a, 0x8f, 0x9d, 0x9e, 0x9f] // get map, 1 Byte目は個数
		// child
	},
	localaddresses: null,  // localaddress
	elsocket: null,   // port 3610のbind
	observationTask: null,  // cronオブジェクト
	changeTask: null,  // facilities監視するcron
	isRun: false,  // 実行中か？

	//////////////////////////////////////////////////////////////////////
	// インタフェース
	/**
	 * @func start
	 * @desc 初期化
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	start: async function (_sendIPCMessage, _localaddresses) {
		sendIPCMessage = _sendIPCMessage;

		if (mainEL.isRun) {  // 重複起動対応
			if (config.enabled && persist.parsed && !isObjEmpty(persist.parsed)) {
				sendIPCMessage("fclEL", persist.parsed);
			}
			return;
		}

		config = store.get('config.EL', config);
		persist = store.get('persist.EL', persist);
		network = mainSystem.getConfig();
		mainEL.localaddresses = _localaddresses;
		sendIPCMessage("renewELConfigView", config);   // 保存したので画面に通知

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.start()') : 0;

		if (config.enabled == false) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.start() EL is desabled.') : 0;
			mainEL.isRun = false;
			return;
		}
		mainEL.isRun = true;

		// mainEL初期設定
		await mainEL.init();

		await mainEL.sendTodayEnergy(); 	// 本日のスマメデータの定期的送信、一発目

		if (config.enabled && persist.parsed && !isObjEmpty(persist.parsed)) {
			sendIPCMessage("fclEL", persist.parsed);
		}

		EL.sendOPC1('224.0.23.0', [0x0e, 0xf0, 0x01], [0x0e, 0xf0, 0x01], 0x60, 0x80, [0x30]);// 立ち上がったのでONの宣言
		mainEL.search();

		mainEL.setCron();		// 定時処理設定
	},


	/**
	 * @func stop
	 * @desc ELの機能を停止する。
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	stop: async function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.stop()') : 0;

		await mainEL.stopObservation();
		await EL.release();

		await mainEL.setConfig();
		await store.set('persist.EL', persist);
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
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.stopWithoutSave()') : 0;

		await mainEL.stopObservation();
		await EL.release();
	},

	/**
	 * @func setConfig
	 * @desc setConfig
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	setConfig: async function (_config) {
		config.debug ?? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.setConfig() _config:', _config);

		if (_config) {
			config = mergeDeeply(config, _config);
		}
		await store.set('config.EL', config);
		mainSystem.setConfig(network);

		sendIPCMessage("renewELConfigView", config);  // 保存したので画面に通知
		sendIPCMessage("configSaved", 'EL');  // 保存したので画面に通知
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
	getPersist: function () {
		return persist;
	},

	//////////////////////////////////////////////////////////////////////
	// 内部
	/**
	 * @func received
	 * @desc EL受け取った後の処理
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	received: function (rinfo, els, error) {
		if (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.received() error:', error);
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.received() rinfo:', rinfo);
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.received() els:', els);
			sendIPCMessage('Error', {
				datetime: new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), 
				moduleName: 'mainEL.received()', 
				stackLog: `EL packets that cannot be analyzed. From: ${rinfo.address}, Detail: ${error}`
			} );
			// throw error;
			return;
		}

		// EL controller
		if (els.DEOJ.substr(0, 4) == '05ff') {
			// ESVで振り分け，主に0x60系列に対応すればいい
			switch (els.ESV) {
				////////////////////////////////////////////////////////////////////////////////////
				// 0x6x
				case EL.SETI:// "60
					break;
				case EL.SETC:// "61"，返信必要あり
					break;

				case EL.GET:// 0x62，Get
					for (var epc in els.DETAILs) {
						if (mainEL.controllerObj[epc]) {// 持ってるEPCのとき
							EL.replyOPC1(rinfo.address, EL.toHexArray(els.TID), [0x05, 0xFF, 0x01], EL.toHexArray(els.SEOJ), EL.GET_RES, EL.toHexArray(epc), mainEL.controllerObj[epc]);
						} else {// 持っていないEPCのとき, SNA
							EL.replyOPC1(rinfo.address, EL.toHexArray(els.TID), [0x05, 0xFF, 0x01], EL.toHexArray(els.SEOJ), EL.GET_SNA, EL.toHexArray(epc), [0x00]);
						}
					}
					break;

				case EL.INFREQ:// 0x63
					break;

				case EL.SETGET:// "6e"
					break;

				default:
					break;
			}
		}

		// databaseに登録
		// 確認
		let rawdata = EL.getSeparatedString_ELDATA(els);

		ELconv.elsAnarysis(els, function (eljson) {
			for (const [key, value] of Object.entries(eljson.EDT)) {
				eldataModel.create({ srcip: rinfo.address, srcmac: mainArp.toMAC(rinfo.address), seoj: eljson.SEOJ, deoj: eljson.DEOJ, esv: eljson.ESV, epc: key, edt: value });
			}
		});
		elrawModel.create({ srcip: rinfo.address, srcmac: mainArp.toMAC(rinfo.address), dstip: mainEL.localaddresses[0], dstmac: mainArp.toMAC(mainEL.localaddresses[0]), rawdata: rawdata, seoj: els.SEOJ, deoj: els.DEOJ, esv: els.ESV, opc: els.OPC, detail: els.DETAIL });
	},

	/**
	 * @func sendMsg
	 * @desc sendMsg
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	sendMsg: function (_ip, _msg) {
		// 送信は自分のログも残しておく
		let rawdata = _msg;
		let els = EL.parseString(_msg);

		ELconv.elsAnarysis(els, function (eljson) {
			for (const [key, value] of Object.entries(eljson.EDT)) {
				eldataModel.create({ srcip: mainEL.localaddresses[0], srcmac: mainArp.toMAC(mainEL.localaddresses[0]), seoj: eljson.SEOJ, deoj: eljson.DEOJ, esv: eljson.ESV, epc: key, edt: value });
			}
		});
		elrawModel.create({ srcip: mainEL.localaddresses[0], srcmac: mainArp.toMAC(mainEL.localaddresses[0]), dstip: _ip, dstmac: mainArp.toMAC(_ip), rawdata: rawdata, seoj: els.SEOJ, deoj: els.DEOJ, esv: els.ESV, opc: els.OPC, detail: els.DETAIL });
		EL.sendString(_ip, _msg);
	},

	/**
	 * @func sendOPC1
	 * @desc sendOPC1
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	sendOPC1: function (_ip, _seoj, _deoj, _esv, _epc, _edt) {
		EL.sendOPC1(_ip, _seoj, _deoj, _esv, _epc, _edt);
	},

	/**
	 * @func search
	 * @desc search
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	search: function () {
		EL.search();

		if( config.oldSearch ) {  // Ver. 1.0系Search有効時
			EL.sendOPC1(EL.EL_Multi, '0ef001', '0ef001', '63', 'd5', '00');
		}
	},


	/**
	 * @func sendTodayEnergy
	 * @desc sendTodayEnergy
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	sendTodayEnergy: async function () {
		let arg = {};

		// Ether等でつながるスマート電力量サブメータ
		if (config.enabled && persist.parsed) {
			arg = await mainEL.getTodayElectricEnergy_submeter();
			// config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.getTodayElectricEnergy_submeter() arg:\x1b[32m', arg, '\x1b[0m' ):0;

			if (arg.filter((d) => { return d.instantaneousPower != null }).length) {  // 何もないと [] が来るので、lengthで判定してNodataならフロントに送らない
				sendIPCMessage('renewTodayElectricEnergy_submeter', JSON.stringify(arg));
			}
		}
	},


	/**
	 * @func setCron
	 * @desc 3分毎にチェックする
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	setCron: function () {
		// cron.schedule('*/3 * * * *', async () => {
		cron.schedule('*/1 * * * *', async () => {
			try {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.cron.schedule() every 3min') : 0;

				let dt = new Date();

				// スマート電力サブメーターの状態のチェック
				if (config.enabled && persist.parsed && persist.parsed.IPs && persist.parsed.IPs.length != 0) {
					// config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.cron.schedule() persist.elParsed:\x1b[32m', persist.elParsed, '\x1b[0m' ):0;

					// persist.elParsed の中にスマート電力サブメータあるか？あればIP取得
					let ip = '';
					for (let i of persist.parsed.IPs) {
						for (let o of persist.parsed[i].EOJs) {
							if (o == 'スマート電力量サブメータ01(028d01)') {
								ip = i;
							}
						}
					}

					if (ip != '') {  // スマート電力サブメータ みつかった
						let sm = persist.parsed[ip];

						// 蓄積するほどデータがそろってない場合はやらない
						if (isObjEmpty(sm.Means)) {
							config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.cron.schedule() SubMeter sm.Means is Empty.') : 0;
						}

						// 設置場所は取得する
						else if (!sm['スマート電力量サブメータ01(028d01)']['設置場所(81)']) {
							config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.cron.schedule() SubMeter place is Null.') : 0;
							EL.sendOPC1(ip, [0x0e, 0xf0, 0x01], [0x02, 0x88, 0x01], EL.GET, [0x81], [0x00]);  // サブメータの設置場所

						} else {
							// config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.cron.schedule() SubMeter sm:\x1b[32m', sm, '\x1b[0m' ):0;

							// merge用ベース
							let means = {
								'積算電力量計測値（正方向計測値）[kWh]': null,
								'積算電力量計測値（逆方向計測値）[kWh]': null,
								'瞬時電力計測値[W]': null,
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
							// config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.cron.schedule() SubMeter mergeObj \x1b[32m', mergeObj, '\x1b[0m' ):0;

							let instantaneousCurrentsR = null;
							if (sm['スマート電力量サブメータ01(028d01)']['瞬時電流計測値(E8)']) {
								let e8 = JSON.parse(sm['スマート電力量サブメータ01(028d01)']['瞬時電流計測値(E8)'].split('(')[0]);
								let rp = e8['RPhase'];
								// console.log( rp );
								instantaneousCurrentsR = rp.split('[A]')[0];
							}

							let instantaneousCurrentsT = null;
							if (sm['スマート電力量サブメータ01(028d01)']['瞬時電流計測値(E8)']) {
								let e8 = JSON.parse(sm['スマート電力量サブメータ01(028d01)']['瞬時電流計測値(E8)'].split('(')[0]);
								let tp = e8['TPhase'];
								// console.log( tp );
								instantaneousCurrentsT = tp.split('[A]')[0];
							}
							//------------------------------------------------------------
							// 整理されたデータベースにする
							let q = {
								dateTime: dt,
								srcType: 'SubMeter',
								place: sm['スマート電力量サブメータ01(028d01)']['設置場所(81)'],
								commulativeAmountNormal: mergeObj['積算電力量計測値（正方向計測値）[kWh]'], // E1 * D3 * D4
								commulativeAmountReverse: mergeObj['積算電力量計測値（逆方向計測値）[kWh]'], // E3 * D3 * D4
								instantaneousPower: mergeObj['瞬時電力計測値[W]'],  // E7 * D3
								instantaneousCurrentsR: instantaneousCurrentsR, // E8
								instantaneousCurrentsT: instantaneousCurrentsT,  // E8
								commulativeAmountsFixedTimeNormalDaytime: mergeObj['定時積算電力量計測値正方向']['日時'],  // EA
								commulativeAmountsFixedTimeNormalPower: mergeObj['定時積算電力量計測値正方向']['計測値[kWh]'],
								commulativeAmountsFixedTimeReverseDaytime: mergeObj['定時積算電力量計測値逆方向']['日時'], // EB
								commulativeAmountsFixedTimeRiversePower: mergeObj['定時積算電力量計測値逆方向']['計測値[kWh]']
							};

							// config.debug ? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.cron.schedule() SubMeter insert:\x1b[32m', q, '\x1b[0m' ):0;
							electricEnergyModel.create(q);
						}
					}
				};

				mainEL.sendTodayEnergy(); 		// 本日のデータの定期的送信 スマートメータ分

			} catch (error) {
				console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.cron.schedule() each 3min, error:', error);
				mainEL.isRun = false;
				throw error;
			}
		});
	},


	//////////////////////////////////////////////////////////////////////
	/**
	 * @func init
	 * @desc ELの処理開始
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	init: async function () {

		// 辞書の読み込みをオーバーライド
		ELconv.initialize = function () {
			ELconv.m_dictNod = JSON.parse(fs.readFileSync(path.join(appDir, 'nodeProfile.json'), 'utf8'));
			ELconv.m_dictSup = JSON.parse(fs.readFileSync(path.join(appDir, 'superClass_I.json'), 'utf8'));
			ELconv.m_dictDev = JSON.parse(fs.readFileSync(path.join(appDir, 'deviceObject_I.json'), 'utf8'));
			ELconv.m_dictMakers = JSON.parse(fs.readFileSync(path.join(appDir, 'makers.json'), 'utf8'));
		};
		ELconv.initialize();

		EL.facilities = persist.facilities;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.start() config:\x1b[32m', config, '\x1b[0m') : 0;

		// ECHONET Lite socket
		mainEL.elsocket = EL.initialize(mainEL.objList, mainEL.received, network.IPver,
			{
				v4: network.IPv4 == 'auto' ? '' : network.IPv4,
				v6: network.IPv6 == 'auto' ? '' : network.IPv6,
				ignoreMe: true,
				autoGetProperties: true,
				autoGetDelay: 1000,
				debugMode: false
			});


		// 監視対象機器は、定期的にEPCを取得する。cronで実施、3分毎
		// 未取得EPCの補完も3分毎に確認
		mainEL.observationTask = cron.schedule('*/3 * * * *', async () => {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.cron.schedule() observationTask') : 0;
			EL.complementFacilities();
			await mainEL.observation();
		});

		// facilitiesの変化を監視して、変化があったらcallbackする、1分毎
		let oldVal = JSON.stringify(EL.objectSort(EL.facilities));
		mainEL.changeTask = cron.schedule('*/1 * * * *', async () => {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.cron.schedule() changeTask') : 0;
			const newVal = JSON.stringify(EL.objectSort(EL.facilities));
			if (oldVal == newVal) return;

			// 変化があったのでmainに通知、全体監視して変更があったときに全体データとして呼ばれる
			persist.facilities = objectSort(EL.facilities);
			ELconv.refer(persist.facilities, function (devs) {
				persist.parsed = objectSort(devs);
				if (!isObjEmpty(persist.parsed)) {
					sendIPCMessage("fclEL", persist.parsed);
				}
			});

			oldVal = newVal;
		});
	},



	//////////////////////////////////////////////////////////////////////
	/**
	 * @func getStatic
	 * @desc 基礎的なデバイスの情報取得
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	getStatic: async function () {
		await EL.sendString(EL.Multi, "1081000405ff01028d016206E100E300E700E800D300D400");  // サブメータ
		await mainEL.sleep(5000);
	},


	//////////////////////////////////////////////////////////////////////
	// 定期的なデバイスの監視、監視はIPアドレスが変更される可能性があることに注意すべし

	/**
	 * @func observation
	 * @desc 監視シーケンス
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	observation: async function () {
		// config.debug ? console.log('mainEL.observation() network:', network):0;
		// ipv4, or 0 and 4
		if (network.IPver == '0' || network.IPver == '4' || network.IPver == 0 || network.IPver == 4) {
			// console.log('mainEL.observation() ipv4');
			await EL.sendOPC1(EL.Multi, [0x0e, 0xf0, 0x01], [0x00, 0x22, 0x00], EL.GET, [0xe0], [0x00]);  // 電力センサ
			await EL.sendOPC1(EL.Multi, [0x0e, 0xf0, 0x01], [0x02, 0x81, 0x00], EL.GET, [0xe0], [0x00]);  // 水道量メータ
			await EL.sendOPC1(EL.Multi, [0x0e, 0xf0, 0x01], [0x02, 0x82, 0x00], EL.GET, [0xe0], [0x00]);  // ガスメータ
			await EL.sendOPC1(EL.Multi, [0x0e, 0xf0, 0x01], [0x02, 0x87, 0x00], EL.GET, [0xc0], [0x00]);  // 分電盤メータ
			await EL.sendOPC1(EL.Multi, [0x0e, 0xf0, 0x01], [0x02, 0x88, 0x00], EL.GET, [0xe0], [0x00]);  // 低圧スマート電力量メータ

			// サブメータ
			await EL.sendString(EL.Multi, "1081000405ff01028d016206E100E300E700E800D300D400");
			await mainEL.sleep(5000);
			await EL.sendString(EL.Multi, "1081000505ff01028d016202EA00EB00");
		}

		// ipv6, or 0 and 6
		if (network.IPver == '0' || network.IPver == '6' || network.IPver == 0 || network.IPver == 6) {
			// console.log('mainEL.observation() ipv6');
			await EL.sendOPC1(EL.Multi6, [0x0e, 0xf0, 0x01], [0x00, 0x22, 0x00], EL.GET, [0xe0], [0x00]);  // 電力センサ
			await EL.sendOPC1(EL.Multi6, [0x0e, 0xf0, 0x01], [0x02, 0x81, 0x00], EL.GET, [0xe0], [0x00]);  // 水道量メータ
			await EL.sendOPC1(EL.Multi6, [0x0e, 0xf0, 0x01], [0x02, 0x82, 0x00], EL.GET, [0xe0], [0x00]);  // ガスメータ
			await EL.sendOPC1(EL.Multi6, [0x0e, 0xf0, 0x01], [0x02, 0x87, 0x00], EL.GET, [0xc0], [0x00]);  // 分電盤メータ
			await EL.sendOPC1(EL.Multi6, [0x0e, 0xf0, 0x01], [0x02, 0x88, 0x00], EL.GET, [0xe0], [0x00]);  // 低圧スマート電力量メータ

			// スマートサブメータ
			await EL.sendString(EL.Multi6, "1081000405ff01028d016206E100E300E700E800D300D400");
			await mainEL.sleep(5000);
			await EL.sendString(EL.Multi6, "1081000505ff01028d016202EA00EB00");
		}
	},


	/**
	 * @func stopObservation
	 * @desc 監視行動をやめて，タイマーも解放する
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	stopObservation: async function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.stopObservation()') : 0;

		if (mainEL.observationTask) {
			await mainEL.observationTask.stop();
			mainEL.observationTask = null;
		}

		if (mainEL.changeTask) {
			await mainEL.changeTask.stop();
			mainEL.changeTask = null;
		}
	},

	/**
	 * @func sleep
	 * @desc Wait必要な時
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	sleep: function (ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	},

	/**
	 * @func getTodayElectricEnergy_submeter
	 * @desc 定時処理用, 電力（サブメータ）
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	getTodayElectricEnergy_submeter: async function () {
		// 画面に今日のデータを送信するためのデータ作る
		try {
			// グラフに表示される値1時間で取れたデータの平均値とする。
			// つまり、開始は前日の23時から当日の0時の値を、当日の0時の値とする
			let begin = new Date();  // 現在時刻UTCで取得
			begin.setHours(begin.getHours() - begin.getHours() - 1, 57, 0, 0); // 前日の23時0分０秒にする
			let end = new Date(begin);  // 現在時刻UTCで取得
			end.setMinutes(begin.getMinutes() + 3); // begin + 3min

			// config.debug? console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| sendTodayRoomEnv: begin:\x1b[32m', begin.toISOString(), '\x1b[0mend:\x1b[32m', end.toISOString(), '\x1b[0m' ):0;

			// 24h x 3分(=20回)
			let rows = [];
			for (let i = 0; i < (24 * 20); i += 1) {

				// １時間分
				let r = await electricEnergyModel.findAll({
					attributes: [[Sequelize.literal(`${i}`), 'id'],
					[Sequelize.fn('AVG', Sequelize.col('commulativeAmountNormal')), 'avgCommulativeAmountNormal'],
					[Sequelize.fn('AVG', Sequelize.col('commulativeAmountReverse')), 'avgCommulativeAmountReverse'],
					[Sequelize.fn('AVG', Sequelize.col('instantaneousPower')), 'avgInstantaneousPower'],
					[Sequelize.fn('AVG', Sequelize.col('instantaneousCurrentsR')), 'avgInstantaneousCurrentsR'],
					[Sequelize.fn('AVG', Sequelize.col('instantaneousCurrentsT')), 'avgInstantaneousCurrentsT'],
					[Sequelize.fn('AVG', Sequelize.col('commulativeAmountsFixedTimeNormalPower')), 'avgCommulativeAmountsFixedTimeNormalPower'],
					[Sequelize.fn('AVG', Sequelize.col('commulativeAmountsFixedTimeRiversePower')), 'avgCommulativeAmountsFixedTimeRiversePower'],
					],
					where: {
						srcType: 'SubMeter',
						dateTime: { [Op.between]: [begin.toISOString(), end.toISOString()] }
					}
				});

				rows.push({ t: end.toISOString(), v: r[0].dataValues });

				begin.setMinutes(begin.getMinutes() + 3); // begin + 3min
				end.setMinutes(begin.getMinutes() + 3); // begin + 3min
			}

			let array = [];

			for (const row of rows) {
				array.push({
					id: row.v.id,
					time: row.t,
					srcType: 'electricSub',
					commulativeAmountNormal: row.v.avgCommulativeAmountNormal,
					commulativeAmountReverse: row.v.avgCommulativeAmountReverse,
					instantaneousPower: row.v.avgInstantaneousPower,
					instantaneousCurrentsR: row.v.avgInstantaneousCurrentsR,
					instantaneousCurrentsT: row.v.avgInstantaneousCurrentsT,
					commulativeAmountsFixedTimeNormalPower: row.v.avgCommulativeAmountsFixedTimeNormalPower,
					commulativeAmountsFixedTimeRiversePower: row.v.avgCommulativeAmountsFixedTimeRiversePower
				});
			}

			return array;

		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.getTodayElectricEnergy_submeter()', error);
		}
	}

};


module.exports = mainEL;
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
