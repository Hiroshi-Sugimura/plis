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

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { store } from './storeSingleton.mjs';
import { SwitchBotHandler } from 'switchbot-handler';
import cron from 'node-cron';
import localDB from './models/localDBModels.mjs';   // DBデータと連携
const { Sequelize, Op, switchBotRawModel, switchBotDataModel } = localDB;
import { objectSort, isObjEmpty, mergeDeeply, getToday, formatDate } from './mainSubmodule.mjs';
import { logger } from './logger.mjs';

/**
 * @typedef {Object} SwitchBotConfig
 * @property {boolean} enabled 機能有効
 * @property {string} token APIトークン
 * @property {string} secret APIシークレット
 * @property {boolean} debug デバッグログ
 */
/**
 * @typedef {Object.<string, any>} SwitchBotPersist
 * @property {number} [count] API呼び出し回数
 * @property {string} [countDay] カウント対象日 (YYYY-MM-DD)
 */
/**
 * @callback SendIPCMessage
 * @param {string} channel
 * @param {any} payload
 */

// const store = new Store();

/** mainSwitchBotのconfig */
/** @type {SwitchBotConfig} */
let config = {
	enabled: false,
	token: '',
	secret: '',
	debug: false
};

/** mainSwitchBotのpersist */
/** @type {SwitchBotPersist} */
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
	 *  @type {cron.ScheduledTask|null}
	 */
	observationJob: null,
	/** @member callback
	 *  @desc SwitchBotの状態を取得したら呼ばれる関数を保持
	 *  @default null
	 */
	callback: null,
	/** @member isRun
	 *  @desc 初期化して起動済みのフラグ
	 *  @default false
	 */
	isRun: false,
	/** @member count
	 *  @desc switch bot との通信カウンター、countUp()メソドでカウントアップせよ。
	 *  @default 0
	 */
	count: 0,
	/** @member countResetJob
	 *  @desc APIカウンターを日替わりでリセット
	 *  @type {cron.ScheduledTask|null}
	 */
	countResetJob: null,

	//////////////////////////////////////////////////////////////////////
	// interfaces
	/**
	 * @callback sendIPCMessage
	 * @param {string} cmdStr - command string. e.g. "Info"
	 * @param {string} argStr - details. g.g. "detail text."
	 */

	/**
	 * エントリーポイント。重複起動時はpersist/configをUIへ再送。
	 * @param {SendIPCMessage} _sendIPCMessage
	 */
	start: function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		if (mainSwitchBot.isRun) {
			if (!isObjEmpty(persist)) {
				sendIPCMessage("renewSwitchBotConfigView", config);
				sendIPCMessage("fclSwitchBot", persist);
				mainSwitchBot.sendTodayRoomEnv();		// 現在のデータを送っておく
			}
			return;
		}

		config.enabled = store.get('config.SwitchBot.enabled', false);
		config.debug = store.get('config.SwitchBot.debug', false);
		config.token = store.get('config.SwitchBot.token', '');
		config.secret = store.get('config.SwitchBot.secret', '');
		persist = store.get('persist.SwitchBot', {});

		sendIPCMessage("renewSwitchBotConfigView", config);

		if (!config.enabled) {
			logger.debug('mainSwitchBot', config.debug, 'start(): mainSwitchBot is disabled.');
			mainSwitchBot.isRun = false;
			return;
		}
		mainSwitchBot.isRun = true;

		logger.debug('mainSwitchBot', config.debug, 'start()');

		if (config.token == '') {
			logger.debug('mainSwitchBot', config.debug, 'start() token is empty.');
			mainSwitchBot.isRun = false;
			return;
		}

		if (config.secret == '') {
			logger.debug('mainSwitchBot', config.debug, 'start() secret is empty.');
			mainSwitchBot.isRun = false;
			return;
		}

		if (persist?.countDay == getToday()) {  // カウンタが今日でなければ、persistあっても0リセット
			logger.debug('mainSwitchBot', config.debug, 'count is continued.');
			mainSwitchBot.count = persist.count;
		} else {
			logger.debug('mainSwitchBot', config.debug, 'count is reset.');
			persist.count = 0;
			persist.countDay = getToday();
		}

		try {
			mainSwitchBot.startCore(async (facilities) => {
				try {
					persist = facilities;
					persist.count = mainSwitchBot.count;
					persist.countDay = getToday();
					sendIPCMessage("fclSwitchBot", persist);
					await switchBotRawModel.create({ detail: JSON.stringify(persist) });  // store raw data
					await mainSwitchBot.storeData(facilities);  // store meaningfull data
					await mainSwitchBot.sendTodayRoomEnv();		// 現在のデータを送っておく
				} catch (innerError) {
					logger.error('mainSwitchBot', 'start callback error:', innerError);
				}
			});
		} catch (error) {
			logger.error('mainSwitchBot', 'start() error:', error);
		}
	},

	/** 保存して停止。
	 * @returns {Promise<void>}
	 */
	stop: async function () {
		mainSwitchBot.isRun = false;
		logger.debug('mainSwitchBot', config.debug, 'stop()');

		await mainSwitchBot.stopObservation();
		await store.set('config.SwitchBot', config);
		await store.set('persist.SwitchBot', persist);
	},

	/** 保存せず停止。
	 * @returns {Promise<void>}
	 */
	stopWithoutSave: async function () {
		mainSwitchBot.isRun = false;
		logger.debug('mainSwitchBot', config.debug, 'stopWithoutSave()');

		await mainSwitchBot.stopObservation();
	},


	/** 設定をマージ保存しUI通知。
	 * @param {Partial<SwitchBotConfig>} [_config]
	 */
	setConfig: async function (_config) {
		if (_config) {
			config = mergeDeeply(config, _config);
		}

		await store.set('config.SwitchBot', config);

		sendIPCMessage("configSaved", 'SwitchBot');  // 保存したので画面に通知
		sendIPCMessage("renewSwitchBotConfigView", config);  // 保存したので画面に通知
	},

	/** 現在設定取得。
	 * @returns {SwitchBotConfig}
	 */
	getConfig: function () {
		return config;
	},


	/** 現在persist取得。
	 * @returns {SwitchBotPersist}
	 */
	getPersist: function () {
		return persist;
	},


	/**
	 * デバイス制御要求。成功時は次回renewFacilitiesでpersist更新。
	 * @param {string} id
	 * @param {string} command
	 * @param {string} param
	 */
	control: function (id, command, param) {
		// mainSwitchBot.client
		logger.debug('mainSwitchBot', config.debug, `control() id:${id}, command:${command}, param:${param}`);

		mainSwitchBot.client.setDeviceStatus(id, command, param, (ret) => {
			if (isObjEmpty(ret)) {
				logger.error('mainSwitchBot', 'control() ret is empty:', ret);
			} else {
				for (let i of ret.items) {
					// console.log(JSON.stringify(i));
					if (i.message == 'success') {
						persist[i.deviceID] = i.status;
						sendIPCMessage("fclSwitchBot", persist);
					} else {
						// console.error(JSON.stringify(ret));
					}
				}
			}
		});
		mainSwitchBot.countUp();
	},


	//////////////////////////////////////////////////////////////////////
	// inner functions
	/**
	 * SwitchBot APIからデバイス/ステータス一覧を取得し整形してcallback。
	 * @param {SwitchBotHandler} _client
	 * @param {(devStatusList:Object)=>void} callback
	 */
	renewFacilities: function (_client, callback) {
		let ret = {};
		try {
			_client.getDevices(async (devlist) => {
				mainSwitchBot.countUp();
				if (!devlist || !devlist.deviceList) {
					logger.warn('mainSwitchBot', 'renewFacilities() devlist is undefined or null.');
					return;
				}
				ret.deviceList = devlist.deviceList;
				ret.infraredRemoteList = devlist.infraredRemoteList;
				for (let d of ret.deviceList) {
					switch (d.deviceType) {
						case 'Plug':
						case 'Plug Mini (US)':
						case 'Plug Mini (JP)':
						case 'Meter':
						case 'MeterPlus':
						case 'Curtain':
						case 'Humidifier':
						case 'Motion Sensor':
						case 'Contact Sensor':
						case 'Color Bulb':
						case 'Bot':
							try {
								ret[d.deviceId] = await _client.getDeviceStatusSync(d.deviceId);
								mainSwitchBot.countUp();
							} catch (e) {
								logger.error('mainSwitchBot', `getDeviceStatusSync error for ${d.deviceId}:`, e);
							}
							break;
						case 'Hub Mini': // APIの回数を抑えるために、詳細を取りに行かないデバイスを設定
						case 'Indoor Cam':
						case 'Remote':
						default:
							continue;
					}
				}
				callback(objectSort(ret));
			});
		} catch (error) {
			if (error.toString().includes('Http 401 Error')) {
				sendIPCMessage('Error', { datetime: formatDate(new Date(), "YYYY-MM-DD HH24:MI:SS"), moduleName: 'mainSwitchBot.renewFacilities()', stackLog: `Http 401 Error. User permission is denied due to invalid token.\n${error}` });
			}

			logger.error('mainSwitchBot', 'renewFacilities() error:', error);
			throw error;
		}
	},

	countUp: function () {
		mainSwitchBot.count += 1;
		if (mainSwitchBot.count == 10000) {
			logger.error('mainSwitchBot', 'count reaches the API limits (10000 calls)');
		}
	},


	//////////////////////////////////////////////////////////////////////
	// 定時処理のインタフェース
	/**
	 * 内部：初期取得とcron登録。
	 * @param {(facilities:Object)=>void} _callback
	 */
	startCore: function (_callback) {
		if (config.token == '' || config.secret == '') {
			throw new Error('mainSwitchBot.startCore() config.token or config.secret is empty.');
		}

		mainSwitchBot.callback = _callback;
		logger.debug('mainSwitchBot', config.debug, 'startCore() config:\x1b[32m', config, '\x1b[0m');

		try {
			mainSwitchBot.client = new SwitchBotHandler(config.token, config.secret);

			mainSwitchBot.renewFacilities(mainSwitchBot.client, (devStatusList) => {
				mainSwitchBot.facilities = devStatusList;
				mainSwitchBot.callback(mainSwitchBot.facilities);  // mainに通知
			});  // 一回実行

			// 監視はcronで実施、DBへのクエリ方法をもっと高速になるように考えたほうが良い
			// 1分に1回実施だと一日10000回のAPI制限に引っかかるので通信時間考えて毎2分30秒で実施、3分に1回という感じ
			mainSwitchBot.observationJob = cron.schedule('30 */2 * * * *', async () => {
				logger.debug('mainSwitchBot', config.debug, 'cron.observationJob()');

				mainSwitchBot.renewFacilities(mainSwitchBot.client, (devStatusList) => {  // 現在のデータ取得
					mainSwitchBot.facilities = devStatusList;
					mainSwitchBot.callback(mainSwitchBot.facilities);  // mainに通知
				});  // 一回実行
			});
			mainSwitchBot.observationJob.start();

			// カウントリセットジョブ
			mainSwitchBot.countResetJob = cron.schedule('0 0 * * *', () => {
				logger.debug('mainSwitchBot', config.debug, `cron.countResetJob() count: ${mainSwitchBot.count}`);
				mainSwitchBot.count = 0;
			});
			mainSwitchBot.countResetJob.start();

		} catch (error) {
			logger.error('mainSwitchBot', 'startCore() error:\x1b[32m', error, '\x1b[0m');
		}
	},

	/** 内部：cron停止。 */
	stopObservation: function () {
		logger.debug('mainSwitchBot', config.debug, 'stopObservation()');

		if (mainSwitchBot.observationJob) {
			mainSwitchBot.observationJob.stop();
			mainSwitchBot.observationJob = null;
			logger.debug('mainSwitchBot', config.debug, 'observationJob is stopped.');
		} else {
			logger.debug('mainSwitchBot', config.debug, 'observationJob has already stopped.');
		}

		if (mainSwitchBot.countResetJob) {
			mainSwitchBot.countResetJob.stop();
			mainSwitchBot.countResetJob = null;
			logger.debug('mainSwitchBot', config.debug, 'countResetJob is stopped.');
		} else {
			logger.debug('mainSwitchBot', config.debug, 'countResetJob has already stopped.');
		}

	},


	/** デバイスごとに意味のあるプロパティを抽出しDB保存。 */
	storeData: async function (facilities) {
		for (let d of facilities.deviceList) {
			let det = facilities[d.deviceId];
			// console.log('SwitchBot:dev:', d, ' detail:', det);
			if (!det) { continue; }  // 詳細の無いデバイスは保存しない。continueで次のデバイスへ。

			try {
				switch (d.deviceType) {
					case 'Plug':
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'power',
							value: det.power
						});
						break;

					case 'Plug Mini (US)':
					case 'Plug Mini (JP)':
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'power',
							value: det.power
						});
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'voltage',
							value: det.voltage
						});
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'weight',
							value: det.weight
						});
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'electricityOfDay',
							value: det.electricityOfDay
						});
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'electricCurrent',
							value: det.electricCurrent
						});
						break;

					case 'Meter':
					case 'MeterPlus':
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'temperature',
							value: det.temperature
						});
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'humidity',
							value: det.humidity
						});
						break;

					case 'Curtain':  // カーテン
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'slidePosition',
							value: det.slidePosition
						});
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'openDirection',
							value: d.openDirection
						});
						break;

					case 'Humidifier':  // 加湿器
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'power',
							value: det.power
						});
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'humidity',
							value: det.humidity
						});
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'temperature',
							value: det.temperature
						});
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'lackWater',
							value: det.lackWater
						});
						break;

					case 'Motion Sensor':  // 人感センサ＝動きセンサ
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'moveDetected',
							value: det.moveDetected
						});
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'brightness',
							value: det.brightness
						});
						break;

					case 'Contact Sensor':  // 開閉センサ＝接触センサ
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'moveDetected',
							value: det.moveDetected
						});
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'brightness',
							value: det.brightness
						});
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'openState',
							value: det.openState
						});
						break;

					case 'Color Bulb':  // ライト
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'power',
							value: det.power
						});
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'brightness',
							value: det.brightness
						});
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'color',
							value: det.color
						});
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'colorTemperature',
							value: det.colorTemperature
						});
						break;

					case 'Bot':  // ボット
						switchBotDataModel.create({
							deviceId: d.deviceId,
							deviceType: d.deviceType,
							deviceName: d.deviceName,
							property: 'power',
							value: det.power
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
			} catch (error) {
				sendIPCMessage('Error', { datetime: formatDate(new Date(), "YYYY-MM-DD HH24:MI:SS"), moduleName: 'mainSwitchBot', stackLog: `${error.message}, d:${JSON.stringify(d)}, det:${JSON.stringify(det)}` });
				logger.error('mainSwitchBot', 'storeData() error:', error, 'SwitchBot:dev:', d, ' detail:', det);
				throw error;
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
	/** 1日分の3分粒度データ抽出用CASE式生成。
	 * @param {string} date
	 * @returns {string}
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

			ret += `WHEN "createdAt" LIKE "${formatDate(T1, 'YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${formatDate(T2, 'YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${formatDate(T3, 'YYYY-MM-DD HH24:MI')}%" THEN "${formatDate(T4, 'HH24:MI')}" \n`;

			T1.setMinutes(T1.getMinutes() + 3); // + 3 min
			T2.setMinutes(T2.getMinutes() + 3); // + 3 min
			T3.setMinutes(T3.getMinutes() + 3); // + 3 min
			T4.setMinutes(T4.getMinutes() + 3); // + 3 min
		}
		return ret + 'ELSE "24:00"';
	},

	/** 温湿度計(Meter/MeterPlus)の当日記録があるデバイス名一覧取得。
	 * @param {Date} theDayBegin
	 * @param {Date} theDayEnd
	 * @returns {Promise<string[]>}
	 */
	getMeterList: async function (theDayBegin, theDayEnd) {
		let meterList = [];
		try {
			// 1日分で記録があるデバイスリスト（温湿度計）
			let rows = [];
			rows = await switchBotDataModel.findAll({
				attributes: ['deviceName'],
				group: ['deviceName'],
				where: {
					deviceType: { [Op.or]: ['Meter', 'MeterPlus'] },
					createdAt: { [Op.between]: [theDayBegin.toISOString(), theDayEnd.toISOString()] }
				}
			});
			for (const row of rows) {
				meterList.push(row.dataValues.deviceName);
			}
			return meterList;
		} catch (error) {
			logger.error('mainSwitchBot', 'getMeterList() error:', error);
		}
	},

	/** プラグミニ(電力取得可能)当日記録があるデバイス名一覧取得。
	 * @param {Date} theDayBegin
	 * @param {Date} theDayEnd
	 * @returns {Promise<string[]>}
	 */
	getPlugMiniList: async function (theDayBegin, theDayEnd) {
		let list = [];
		try {
			// 1日分で記録があるデバイスリスト（プラグミニ）
			let rows = [];
			rows = await switchBotDataModel.findAll({
				attributes: ['deviceName'],
				group: ['deviceName'],
				where: {
					deviceType: { [Op.or]: ['Plug Mini (JP)', 'Plug Mini (US)'] },
					createdAt: { [Op.between]: [theDayBegin.toISOString(), theDayEnd.toISOString()] }
				}
			});
			for (const row of rows) {
				list.push(row.dataValues.deviceName);
			}
			return list;
		} catch (error) {
			logger.error('mainSwitchBot', 'getPlugMiniList() error:', error);
		}
	},


	/** 指定Meterの温度3分毎平均行取得。
	 * @param {Date} theDayBegin
	 * @param {Date} theDayEnd
	 * @param {string} meter
	 * @param {string} subQuery CASE式
	 */
	getTempratureRows: async function (theDayBegin, theDayEnd, meter, subQuery) {
		try {
			// 3分毎データ tempreture
			let rows = await switchBotDataModel.findAll({
				attributes: [
					[Sequelize.fn('AVG', Sequelize.col('value')), 'avgTemperature'],
					'createdAt',
					[Sequelize.literal(subQuery), 'timeunit']
				],
				where: {
					deviceType: { [Op.or]: ['Meter', 'MeterPlus'] },
					deviceName: meter,
					property: 'temperature',
					createdAt: { [Op.between]: [theDayBegin.toISOString(), theDayEnd.toISOString()] }
				},
				group: ['timeunit']
			});

			return rows;
		} catch (error) {
			logger.error('mainSwitchBot', 'getTempratureRows() error:', error);
		}
	},


	/** 指定Meterの湿度3分毎平均行取得。
	 * @param {Date} theDayBegin
	 * @param {Date} theDayEnd
	 * @param {string} meter
	 * @param {string} subQuery
	 */
	getHumidityRows: async function (theDayBegin, theDayEnd, meter, subQuery) {
		let ret = [];
		try {
			// 3分毎データ humidity
			let rows = await switchBotDataModel.findAll({
				attributes: [
					[Sequelize.fn('AVG', Sequelize.col('value')), 'avgHumidity'],
					'createdAt',
					[Sequelize.literal(subQuery), 'timeunit']
				],
				where: {
					deviceType: { [Op.or]: ['Meter', 'MeterPlus'] },
					deviceName: meter,
					property: 'humidity',
					createdAt: { [Op.between]: [theDayBegin.toISOString(), theDayEnd.toISOString()] }
				},
				group: ['timeunit']
			});

			return rows;
		} catch (error) {
			logger.error('mainSwitchBot', 'getHumidityRows() error:', error);
		}
	},


	/** 指定PlugMiniの電圧3分毎平均行取得。 */
	getVoltageRows: async function (theDayBegin, theDayEnd, plug, subQuery) {
		try {
			// 3分毎データ tempreture
			let rows = await switchBotDataModel.findAll({
				attributes: [
					[Sequelize.fn('AVG', Sequelize.col('value')), 'avgVoltage'],
					'createdAt',
					[Sequelize.literal(subQuery), 'timeunit']
				],
				where: {
					deviceType: { [Op.or]: ['Plug Mini (JP)', 'Plug Mini (US)'] },
					deviceName: plug,
					property: 'voltage',
					createdAt: { [Op.between]: [theDayBegin.toISOString(), theDayEnd.toISOString()] }
				},
				group: ['timeunit']
			});

			return rows;
		} catch (error) {
			logger.error('mainSwitchBot', 'getVoltageRows() error:', error);
		}
	},

	/** 指定PlugMiniの電力(W)3分毎平均行取得。 */
	getWeightRows: async function (theDayBegin, theDayEnd, plug, subQuery) {
		let ret = [];
		try {
			// 3分毎データ humidity
			let rows = await switchBotDataModel.findAll({
				attributes: [
					[Sequelize.fn('AVG', Sequelize.col('value')), 'avgWatt'],
					'createdAt',
					[Sequelize.literal(subQuery), 'timeunit']
				],
				where: {
					deviceType: { [Op.or]: ['Plug Mini (JP)', 'Plug Mini (US)'] },
					deviceName: plug,
					property: 'weight',
					createdAt: { [Op.between]: [theDayBegin.toISOString(), theDayEnd.toISOString()] }
				},
				group: ['timeunit']
			});

			return rows;
		} catch (error) {
			logger.error('mainSwitchBot', 'getWeightRows()', error);
		}
	},


	/** 指定PlugMiniの電流(A)3分毎平均行取得。 */
	getCurrentRows: async function (theDayBegin, theDayEnd, plug, subQuery) {
		let ret = [];
		try {
			// 3分毎データ humidity
			let rows = await switchBotDataModel.findAll({
				attributes: [
					[Sequelize.fn('AVG', Sequelize.col('value')), 'avgAmpere'],
					'createdAt',
					[Sequelize.literal(subQuery), 'timeunit']
				],
				where: {
					deviceType: { [Op.or]: ['Plug Mini (JP)', 'Plug Mini (US)'] },
					deviceName: plug,
					property: 'electricCurrent',
					createdAt: { [Op.between]: [theDayBegin.toISOString(), theDayEnd.toISOString()] }
				},
				group: ['timeunit']
			});

			return rows;
		} catch (error) {
			logger.error('mainSwitchBot', 'getCurrentRows()', error);
		}
	},


	/** 全Meter/PlugMiniの本日3分毎データをまとめた構造を生成。 */
	getTodayRoomEnvSwitchBot: async function () {
		// 画面に今日のデータを送信するためのデータ作る
		let ret = { srcType: 'switchBot', meterList: [], plugList: [] }; // 戻り値  // { meterList:[], meter1:[], meter2[], .... }

		try {
			let now = new Date();  // 現在
			let begin = new Date(now);  // 現在時刻UTCで取得
			begin.setHours(begin.getHours() - begin.getHours() - 1, 57, 0, 0); // 前日の23時57分０秒にする
			let end = new Date(begin);  // 現在時刻UTCで取得
			end.setHours(begin.getHours() + 25, 0, 0, 0); // 次の日の00:00:00にする

			ret.meterList = await mainSwitchBot.getMeterList(begin, end);		// 温湿度計のリストを取得
			ret.plugMiniList = await mainSwitchBot.getPlugMiniList(begin, end);		// Plug Miniのリストを取得

			//------------------------------------------------------------
			// 温湿度計毎にデータ作る
			const cases = mainSwitchBot.getCases(now);
			const subQuery = `CASE ${cases} END`;

			for (const meter of ret.meterList) {
				let rowsT = await mainSwitchBot.getTempratureRows(begin, end, meter, subQuery);			// 3分毎データ tempreture
				let rowsH = await mainSwitchBot.getHumidityRows(begin, end, meter, subQuery);			// 3分毎データ humidity

				// console.log( rowsT );
				// console.log( rowsH );

				let T1 = new Date();
				T1.setHours(0, 0, 0);
				let array = [];
				for (let t = 0; t < 480; t += 1) {
					let pushRow = {
						id: t,
						time: T1.toISOString()
					}

					// temperature
					if (rowsT) {
						let row = rowsT.find((row) => row.dataValues.timeunit == formatDate(T1, 'HH24:MI'));

						if (row) {
							pushRow.temperature = row.dataValues.avgTemperature;
						} else {
							pushRow.temperature = null;
						}
					}

					// humidity
					if (rowsH) {
						let row = rowsH.find((row) => row.dataValues.timeunit == formatDate(T1, 'HH24:MI'));

						if (row) {
							pushRow.humidity = row.dataValues.avgHumidity;
						} else {
							pushRow.humidity = null;
						}
					}

					array.push(pushRow);
					T1.setMinutes(T1.getMinutes() + 3); // + 3 min
				}

				ret[meter] = array;
			}


			//------------------------------------------------------------
			// プラグ毎にデータ作る
			for (const plug of ret.plugMiniList) {
				let rowsV = await mainSwitchBot.getVoltageRows(begin, end, plug, subQuery);			// 3分毎データ volt
				let rowsW = await mainSwitchBot.getWeightRows(begin, end, plug, subQuery);			// 3分毎データ watt
				let rowsC = await mainSwitchBot.getCurrentRows(begin, end, plug, subQuery);			// 3分毎データ ampere

				// console.log( rowsV );
				// console.log( rowsW );
				// console.log( rowsC );

				let T1 = new Date();
				T1.setHours(0, 0, 0);
				let array = [];
				for (let t = 0; t < 480; t += 1) {
					let pushRow = {
						id: t,
						time: T1.toISOString()
					}

					// volt
					if (rowsV) {
						let row = rowsV.find((row) => row.dataValues.timeunit == formatDate(T1, 'HH24:MI'));

						if (row) {
							pushRow.voltage = row.dataValues.avgVoltage;
						} else {
							pushRow.voltage = null;
						}
					}

					// watt
					if (rowsW) {
						let row = rowsW.find((row) => row.dataValues.timeunit == formatDate(T1, 'HH24:MI'));

						if (row) {
							pushRow.watt = row.dataValues.avgWatt;
						} else {
							pushRow.watt = null;
						}
					}

					// ampere
					if (rowsC) {
						let row = rowsC.find((row) => row.dataValues.timeunit == formatDate(T1, 'HH24:MI'));

						if (row) {
							pushRow.ampere = row.dataValues.avgAmpere;
						} else {
							pushRow.ampere = null;
						}
					}

					array.push(pushRow);
					T1.setMinutes(T1.getMinutes() + 3); // + 3 min
				}

				ret[plug] = array;
			}

			return ret;
		} catch (error) {
			logger.error('mainSwitchBot', 'getTodayRoomEnvSwitchBot() error:', error);
		}
	},

	/** 本日のデータをRendererへ送信。 */
	sendTodayRoomEnv: async function () {
		let arg = {};

		if (config.enabled) {
			arg = await mainSwitchBot.getTodayRoomEnvSwitchBot();
			sendIPCMessage('renewRoomEnvSwitchBot', JSON.stringify(arg));
		} else {
			logger.error('mainSwitchBot', 'sendTodayRoomEnv() config.enabled:', config.enabled);
		}
	}

};


// module.exports = mainSwitchBot;
export { mainSwitchBot };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
