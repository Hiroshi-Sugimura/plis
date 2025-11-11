//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainEL
 */
// 'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { fileURLToPath } from "node:url";
import path from 'node:path';
import os from 'os';
import fs from 'fs';

import Store from 'electron-store';
import cron from 'node-cron';
import EL from 'echonet-lite';
import ELconv from 'echonet-lite-conv';
import { mainArp } from './mainArp.mjs';     // arpの管理
import { mainSystem } from './mainSystem.mjs';     // systemの管理(network部分を利用)
import { Sequelize, Op, elrawModel, eldataModel, electricEnergyModel } from './models/localDBModels.cjs';   // DBデータと連携
import { objectSort, isObjEmpty, mergeDeeply } from './mainSubmodule.cjs';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// 基礎設定
const appDir = process.env.NODE_ENV === 'development' ? __dirname : __dirname;
let sendIPCMessage = null;
const store = new Store();

/**
 * @typedef {Object} ELConfig
 * @property {boolean} enabled 機能有効フラグ
 * @property {boolean} oldSearch 旧Search手法(Ver1.0系)を追加発火するか
 * @property {boolean} debug デバッグログ出力
 */
/** @type {ELConfig} */

let config = {
	enabled: true,
	oldSearch: false,
	debug: false
};

/**
 * @typedef {Object} NetworkConfig
 * @property {number} IPver 0=auto,4=IPv4,6=IPv6
 * @property {string} IPv4 IPv4アドレスまたは 'auto'
 * @property {string} IPv6 IPv6アドレスまたは 'auto'
 */
let network = {
	IPver: 0,
	IPv4: "auto",
	IPv6: "auto"
};

/**
 * @typedef {Object} ELPersist
 * @property {Record<string, any>} facilities 生RAW設備ツリー
 * @property {Record<string, any>} parsed 解析後設備構造
 */
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
	disableIPv6: false, // 利用可能なIPv6インタフェースが無い/不安定なときにv6送信を抑止

	//////////////////////////////////////////////////////////////////////
	// インタフェース
	/**
	 * 起動処理。設定/永続値読込→ソケット初期化→探索→定期Cron開始。
	 * 既に起動済みなら最新persistをRendererへ送りreturn。
	 * @param {(ch:string,...args:any[])=>void} _sendIPCMessage IPC送信用関数
	 * @param {string[]} _localaddresses ローカルインタフェースIP一覧
	 * @returns {Promise<void>}
	 */
	start: async function (_sendIPCMessage, _localaddresses) {
		sendIPCMessage = _sendIPCMessage;

		if (mainEL.isRun) {  // 重複起動対応
			if (config.enabled && persist.parsed && !isObjEmpty(persist.parsed)) {
				sendIPCMessage("renewELConfigView", config);
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
	 * 観測/ソケットを解放し設定とpersist保存して停止する。
	 * @returns {Promise<void>}
	 */
	stop: async function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.stop()') : 0;

		await mainEL.stopObservation();
		await EL.release();

		await mainEL.setConfig();
		await store.set('persist.EL', persist);
	},

	/**
	 * 保存せず停止（観測とソケットのみ解放）。
	 * @returns {Promise<void>}
	 */
	stopWithoutSave: async function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.stopWithoutSave()') : 0;

		await mainEL.stopObservation();
		await EL.release();
	},

	/**
	 * 設定をマージし永続化＋UI更新。_configが無ければ現状保存のみ。
	 * @param {Partial<ELConfig>=} _config
	 * @returns {Promise<void>}
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
	 * 現在の設定を返す。
	 * @returns {ELConfig}
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * 現在保持している設備情報を返す。
	 * @returns {ELPersist}
	 */
	getPersist: function () {
		return persist;
	},

	//////////////////////////////////////////////////////////////////////
	// 内部
	/**
	 * 受信ハンドラ。コントローラEPC応答/DB保存/解析。
	 * @param {{address:string}} rinfo 送信元情報
	 * @param {any} els 解析前EL構造
	 * @param {Error=} error エラー（解析失敗など）
	 * @returns {void}
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
			});
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
	 * 文字列ELフレーム送信（自分側ログも保存）。
	 * @param {string} _ip 宛先IP
	 * @param {string} _msg ELフレーム文字列
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
	 * OPC1送信ヘルパ。
	 * @param {string} _ip 宛先IP
	 * @param {number[]} _seoj SEOJ
	 * @param {number[]} _deoj DEOJ
	 * @param {number} _esv ESV
	 * @param {number[]} _epc EPC
	 * @param {number[]} _edt EDT
	 */
	sendOPC1: function (_ip, _seoj, _deoj, _esv, _epc, _edt) {
		EL.sendOPC1(_ip, _seoj, _deoj, _esv, _epc, _edt);
	},

	/**
	 * ネットワーク上のEL機器探索（oldSearch有効時は追加マルチキャスト）。
	 */
	search: function () {
		EL.search();

		if (config.oldSearch) {  // Ver. 1.0系Search有効時
			EL.sendOPC1(EL.EL_Multi, '0ef001', '0ef001', '63', 'd5', '00');
		}
	},


	/**
	 * 当日のサブメータ電力集計を取得しRendererへ送る。
	 * @returns {Promise<void>}
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
	 * 監視Cron（1分毎）開始。設備変化検出とサブメータ集計保存。
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
	 * 初期化シーケンス。
	 * 1. 変換ライブラリ辞書(JSON)を同期読込して ELconv を再初期化。
	 * 2. 永続化されている facilities を EL.facilities に復元。
	 * 3. IPv6 利用判定: 利用可能なインタフェース(awdl/llw/utun/p2p/lo を除外)が無い場合 disableIPv6 を true にし、IPv6 マルチキャスト送信を抑止。
	 * 4. EL.initialize によりソケット生成（autoGetProperties 有効）。
	 * 5. 監視 cron を2種開始:
	 *    observationTask(3分毎): sanitizeFacilities() → complementFacilities() → observation() の順で呼び、
	 *      過去に complementFacilities() 内部で undefined.match が発生した問題を "sanitizeFacilities" で未定義/非オブジェクト/不正 EOJs を除去することで防御。
	 *    changeTask(1分毎): facilities の構造変化検出し parsed を再生成、Rendererへ通知。
	 *
	 * エラーは各 try/catch でローカルログ出力し連鎖停止を防ぐ。致命的例外が発生した場合のみ isRun を外部側で再起動判断する想定。
	 * @returns {Promise<void>} 完了時に resolve。
	 */
	init: async function () {

		// (1) 辞書の読み込みをオーバーライド
		ELconv.initialize = function () {
			ELconv.m_dictNod = JSON.parse(fs.readFileSync(path.join(appDir, 'nodeProfile.json'), 'utf8'));
			ELconv.m_dictSup = JSON.parse(fs.readFileSync(path.join(appDir, 'superClass_I.json'), 'utf8'));
			ELconv.m_dictDev = JSON.parse(fs.readFileSync(path.join(appDir, 'deviceObject_I.json'), 'utf8'));
			ELconv.m_dictMakers = JSON.parse(fs.readFileSync(path.join(appDir, 'makers.json'), 'utf8'));
		};
		ELconv.initialize();

		// (2) facilities 復元
		EL.facilities = persist.facilities;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.start() config:\x1b[32m', config, '\x1b[0m') : 0;

		// (3) IPv6 の利用可否判定（awdl0 など不安定 NIC の ENETDOWN 回避）。
		if (network.IPver === 0 || network.IPver === '0' || network.IPver === 6 || network.IPver === '6') {
			const usable = mainEL.hasUsableIPv6();
			mainEL.disableIPv6 = !usable;
			if (!usable) {
				config.debug ? console.warn(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.init(): IPv6 disabled (no usable interface)') : 0;
			}
		}

		// (4) ECHONET Lite socket 生成
		mainEL.elsocket = EL.initialize(mainEL.objList, mainEL.received, network.IPver,
			{
				v4: network.IPv4 == 'auto' ? '' : network.IPv4,
				v6: network.IPv6 == 'auto' ? '' : network.IPv6,
				ignoreMe: true,
				autoGetProperties: true,
				autoGetDelay: 1000,
				debugMode: false
			});


		// (5a) 未取得EPC補完 + 定期観測（3分毎）
		mainEL.observationTask = cron.schedule('*/3 * * * *', async () => {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.cron.schedule() observationTask') : 0;
			try {
				// complementFacilities() 前に最低限のサニタイズで undefined.match 例外を防止
				mainEL.sanitizeFacilities();
				EL.complementFacilities();
			} catch (e) {
				console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.observationTask complementFacilities error:', e);
			}
			try {
				await mainEL.observation();
			} catch (e) {
				console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.observationTask observation error:', e);
			}
		});

		// (5b) facilities 構造変化検出（1分毎）
		let oldVal = JSON.stringify(EL.objectSort(EL.facilities));
		mainEL.changeTask = cron.schedule('*/1 * * * *', async () => {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.cron.schedule() changeTask') : 0;
			const newVal = JSON.stringify(EL.objectSort(EL.facilities));
			if (oldVal == newVal) return;

			// 変化通知: parsed 再生成し Renderer へ push
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


	/**
	 * EL.facilities の最低限の健全性を確保する簡易サニタイズ。
	 * 不正なエントリや非オブジェクト/未定義を削除し、EOJs配列を文字列のみに制限。
	 * 各EOJキー配下の不正データ（非オブジェクト/配列）も除去する。
	 */
	sanitizeFacilities: function () {
		try {
			if (!EL.facilities || typeof EL.facilities !== 'object') return;
			for (const ip of Object.keys(EL.facilities)) {
				const fac = EL.facilities[ip];
				if (!fac || typeof fac !== 'object' || Array.isArray(fac)) {
					delete EL.facilities[ip];
					continue;
				}
				// EOJs配列を文字列のみにフィルタ
				if (Array.isArray(fac.EOJs)) {
					fac.EOJs = fac.EOJs.filter((x) => typeof x === 'string' && x.length === 6);
				} else {
					fac.EOJs = [];
				}
				// 各EOJキー（例: "028801"）配下が不正なら削除
				for (const key of Object.keys(fac)) {
					if (key === 'EOJs') continue;
					const val = fac[key];
					// complementFacilities内部でval[epc].matchを呼ぶ想定なので、オブジェクトでない場合削除
					if (!val || typeof val !== 'object' || Array.isArray(val)) {
						delete fac[key];
					}
				}
			}
		} catch (e) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.sanitizeFacilities error:', e);
		}
	},



	//////////////////////////////////////////////////////////////////////
	/**
	 * サブメータ静的EPC群を一括取得。
	 * @returns {Promise<void>}
	 */
	getStatic: async function () {
		await EL.sendString(EL.Multi, "1081000405ff01028d016206E100E300E700E800D300D400");  // サブメータ
		await mainEL.sleep(5000);
	},


	//////////////////////////////////////////////////////////////////////
	// 定期的なデバイスの監視、監視はIPアドレスが変更される可能性があることに注意すべし

	/**
	 * 観測シーケンス：主要センサ群へ GET を投げる。IPv6 は init() で disableIPv6=true と判断された場合は送信抑止。
	 * エラーは上位(observationTask)で捕捉されるため、この関数内では throw をそのまま伝播して OK。
	 *
	 * 注意:
	 * - IPv6 側で ENETDOWN が発生しやすい awdl/utun/llw/p2p/lo は hasUsableIPv6() にて事前に除外。
	 * - サブメータの連続2フレーム(GET 定義群 → 定時計測値要求)間には 5 秒のインターバルを確保。
	 * - マルチキャスト送信先は v4: EL.Multi, v6: EL.Multi6。
	 * @returns {Promise<void>}
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

		// ipv6, or 0 and 6 (かつ利用可能なインタフェースがあるときのみ)
		if (!mainEL.disableIPv6 && (network.IPver == '0' || network.IPver == '6' || network.IPver == 0 || network.IPver == 6)) {
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
	 * 利用可能なIPv6インタフェースがあるかざっくり判定する。
	 * awdl/utun/llw/p2p/lo は除外。
	 * @returns {boolean}
	 */
	hasUsableIPv6: function () {
		try {
			const ifaces = os.networkInterfaces();
			const exclude = ['awdl', 'llw', 'utun', 'p2p', 'lo'];
			for (const [name, addrs] of Object.entries(ifaces)) {
				if (!addrs) continue;
				if (exclude.some(prefix => name.startsWith(prefix))) continue;
				for (const addr of addrs) {
					if (addr && addr.family === 'IPv6' && addr.internal === false) {
						return true;
					}
				}
			}
		} catch (e) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.hasUsableIPv6 error:', e);
		}
		return false;
	},


	/**
	 * 観測/変化検出cron停止。
	 * @returns {Promise<void>}
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
	 * ms待機Promise。
	 * @param {number} ms ミリ秒
	 * @returns {Promise<void>}
	 */
	sleep: function (ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	},

	/**
	 * 当日のサブメータ電力を3分刻み平均に整形して配列返す。
	 * @returns {Promise<Array<{id:number,time:string,srcType:string,commulativeAmountNormal:number|null,commulativeAmountReverse:number|null,instantaneousPower:number|null,instantaneousCurrentsR:number|null,instantaneousCurrentsT:number|null,commulativeAmountsFixedTimeNormalPower:number|null,commulativeAmountsFixedTimeRiversePower:number|null}>>}
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


// module.exports = mainEL;
export { mainEL };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
