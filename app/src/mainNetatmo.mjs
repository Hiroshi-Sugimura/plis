//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2018.03.16
//////////////////////////////////////////////////////////////////////
/**
 * @module mainNetatmo
 */
// 'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { store } from './storeSingleton.mjs';
import axios from 'axios';
import cron from 'node-cron';
import localDB from './models/localDBModels.mjs';   // DBデータと連携
const { Sequelize, Op, netatmoModel, roomEnvModel } = localDB;
import { mergeDeeply } from './mainSubmodule.mjs';


let sendIPCMessage = null;
// const store = new Store();

/**
 * @typedef {Object} NetatmoConfig
 * @property {boolean} enabled 機能が有効か
 * @property {string} clientId Netatmo APIのClient ID
 * @property {string} clientSecret Netatmo APIのClient Secret
 * @property {string} refreshToken OAuth2 Refresh Token（使用毎にローテーション）
 * @property {boolean} debug デバッグログを出すか
 */
let config = /** @type {NetatmoConfig} */ ({
	enabled: false,
	clientId: "",
	clientSecret: "",
	refreshToken: "",
	debug: false
});

/**
 * @typedef {Object} NetatmoPersist
 * @property {any[]} [devices] getstationsdata の devices 配列を想定（互換性維持のため既存構造を保持）
 */
let persist = /** @type {any} */ ({});


//////////////////////////////////////////////////////////////////////
// config
let mainNetatmo = {
	accessToken: null,
	refreshToken: null,
	tokenExpires: null,
	observationJob: null,
	data: {},
	debug: false,
	isRun: false,

	//////////////////////////////////////////////////////////////////////
	/**
	 * Netatmoモジュールを開始する。初回起動時は store から設定を読み、必要に応じてトークンのリフレッシュを行う。
	 * 既に稼働中なら最新設定と当日集計をRendererへ再送してreturn。
	 * エラー時は NetatmoAuthError IPC を通知。
	 * @param {(channel:string, ...args:any[])=>void} _sendIPCMessage IPC送信用関数
	 * @returns {Promise<void>}
	 */
	start: async function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		if (mainNetatmo.isRun) {
			sendIPCMessage("renewNetatmoConfigView", config);
			sendIPCMessage("renewNetatmo", persist);
			mainNetatmo.sendTodayRoomEnv();
			return;
		}

		config.enabled = store.get('config.Netatmo.enabled', false);
		config.clientId = store.get('config.Netatmo.clientId', '');
		config.clientSecret = store.get('config.Netatmo.clientSecret', '');
		config.refreshToken = store.get('config.Netatmo.refreshToken', '');
		config.debug = store.get('config.Netatmo.debug', false);
		// 旧バージョンのaccessToken永続値は読まない＆削除して整理
		try { store.delete('config.Netatmo.accessToken'); } catch (_) { }
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.start() config loaded from store:\x1b[32m', config, '\x1b[0m') : 0;
		sendIPCMessage("renewNetatmoConfigView", config);

		persist = store.get('persist.Netatmo', {});

		if (!config.enabled) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.start() Netatmo is disabled.') : 0;
			mainNetatmo.isRun = false;
			return;
		}

		// リフレッシュトークンがあれば、起動時にアクセストークンを取得
		if (config.refreshToken && config.clientId && config.clientSecret) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.start() リフレッシュトークンからアクセストークンを取得します') : 0;
			try {
				await mainNetatmo.refreshAccessToken();
			} catch (e) {
				console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.start() 初回リフレッシュ失敗:', e);
				if (sendIPCMessage) {
					sendIPCMessage('NetatmoAuthError', '初回トークン取得失敗: ' + e.message);
				}
				return;
			}
		}

		// 必須の設定がなければ実行しない（Refresh Tokenのみ必須）。
		if (!config.refreshToken) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.start() no refreshToken.') : 0;
			if (sendIPCMessage) {
				sendIPCMessage('NetatmoAuthError', '設定が不足しています（Refresh Token が必要です）');
			}
			return;
		}

		// 実行開始
		mainNetatmo.isRun = true;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.start() config:\x1b[32m', config, '\x1b[0m') : 0;

		// データ取得
		try {
			await mainNetatmo.fetchStationsData();
			// 初回も直ちに1レコード保存してUXを向上
			try {
				let dt = new Date();
				if (config.enabled && persist && persist.length) {
					let n = persist[0];
					if (n && n.dashboard_data) {
						await roomEnvModel.create({
							dateTime: dt,
							srcType: 'netatmo',
							place: n.home_name,
							temperature: n.dashboard_data.Temperature,
							humidity: n.dashboard_data.Humidity,
							pressure: n.dashboard_data.Pressure,
							noise: n.dashboard_data.Noise,
							CO2: n.dashboard_data.CO2
						});
					}
				}
			} catch (e) {
				config.debug ? console.warn(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.start() initial save warn:', e) : 0;
			}
			mainNetatmo.setObserve();

		} catch (e) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.start() error:', e);
			// 403やAPIエラー時は必ずトースト通知
			let msg = '';
			if (e && e.message && e.message.includes('Netatmoデータ取得失敗')) {
				msg = e.message;
			} else if (e && e.response && e.response.status === 403) {
				msg = 'Netatmo APIが403で拒否されました。アクセストークンや権限を確認してください。';
			} else {
				msg = e.message || String(e);
			}
			if (sendIPCMessage) {
				sendIPCMessage('NetatmoAuthError', msg);
			}
		}

		sendIPCMessage("renewNetatmo", persist);
		mainNetatmo.sendTodayRoomEnv();
	},
	/**
	 * （廃止）直接アクセストークンを取得する旧API。常に例外を投げる。
	 * @deprecated refreshAccessToken() を使ってください。
	 * @throws {Error} 常に廃止エラー
	 */
	getAccessToken: async function () {
		// 直接設定は廃止。常にrefreshAccessToken()から取得する運用に変更。
		throw new Error('アクセストークンの直接取得は廃止されました。refreshAccessToken() を使用してください');
	},

	/**
	 * Refresh Token を使って新しい Access Token を取得し内部状態を更新する。
	 * Access Token は永続化しない。Refresh Token はローテーションされるため最新値を保存する。
	 * invalid_grant（古い/再利用Refresh Token）検出時はRefresh Tokenを消去しUIへ再設定促進のトーストを送る。
	 * @returns {Promise<boolean>} 成功したら true
	 * @throws {Error} 必須情報不足/HTTPエラー/invalid_grant
	 */
	refreshAccessToken: async function () {
		if (!config.clientId || !config.clientSecret || !config.refreshToken) {
			throw new Error('Netatmoリフレッシュに必要な情報が不足しています（ClientID, ClientSecret, RefreshToken）');
		}

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.refreshAccessToken() リフレッシュ開始') : 0;

		try {
			const params = new URLSearchParams();
			params.append('grant_type', 'refresh_token');
			params.append('refresh_token', config.refreshToken);
			params.append('client_id', config.clientId);
			params.append('client_secret', config.clientSecret);

			const res = await axios.post('https://api.netatmo.com/oauth2/token', params, {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			});

			// 新しいトークンを内部に保持（accessTokenは永続化しない）
			mainNetatmo.accessToken = res.data.access_token;
			config.refreshToken = res.data.refresh_token; // 新しいリフレッシュトークンは永続化
			mainNetatmo.tokenExpires = Date.now() + (res.data.expires_in * 1000);
			await store.set('config.Netatmo.refreshToken', config.refreshToken);

			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.refreshAccessToken() トークン更新成功') : 0;
			return true;
		} catch (error) {
			const detail = error.response ? error.response.data : error;
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.refreshAccessToken() エラー:', detail);
			if (detail && detail.error === 'invalid_grant') {
				// 古い/使用済みのRefresh Token。自動的にクリアしてUIに再設定を促す。
				config.refreshToken = '';
				mainNetatmo.accessToken = null;
				mainNetatmo.tokenExpires = null;
				try { await store.set('config.Netatmo.refreshToken', ''); } catch (_) { }
				if (sendIPCMessage) {
					sendIPCMessage('NetatmoAuthError', 'Refresh Tokenが無効です。Netatmo開発者ポータルで新しいRefresh Tokenを生成して設定してね');
					sendIPCMessage('renewNetatmoConfigView', config);
				}
				throw new Error('Netatmoトークンリフレッシュ失敗: invalid_grant（古い/既に使用済みのRefresh Token。Netatmo開発者ポータルで新しいトークンを再生成してください）');
			}
			throw new Error('Netatmoトークンリフレッシュ失敗: ' + (error.response ? JSON.stringify(error.response.data) : error.message));
		}
	},

	/**
	 * Netatmo API (getstationsdata) を叩いて最新デバイス情報を取得し persist に反映・DBへ保存。
	 * 403で未リトライならトークンをリフレッシュして一度だけ再試行する。
	 * @param {boolean} [isRetry=false] 内部再試行フラグ（無限ループ防止）
	 * @returns {Promise<void>}
	 * @throws {Error} API失敗/リフレッシュ失敗
	 */
	fetchStationsData: async function (isRetry = false) {
		if (!mainNetatmo.accessToken) {
			// accessTokenが無いならリフレッシュ実行
			// await mainNetatmo.refreshAccessToken();
		}
		// config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.fetchStationsData() using accessToken (masked)') : 0;
		try {
			const res = await axios.get('https://api.netatmo.com/api/getstationsdata', {
				headers: {
					Authorization: `Bearer ${mainNetatmo.accessToken}`
				}
			});
			persist = res.data.body.devices;
			sendIPCMessage("renewNetatmo", persist);
			await netatmoModel.create({ detail: JSON.stringify(persist) });
		} catch (error) {
			// 403エラー（トークン期限切れ）の場合はリフレッシュして再試行
			if (error.response && error.response.status === 403 && !isRetry && config.refreshToken) {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.fetchStationsData() トークン期限切れ検出、リフレッシュします') : 0;
				try {
					await mainNetatmo.refreshAccessToken();
					// リフレッシュ成功したら再試行（無限ループ防止でisRetry=true）
					return await mainNetatmo.fetchStationsData(true);
				} catch (refreshError) {
					console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.fetchStationsData() リフレッシュ失敗:', refreshError);
					if (sendIPCMessage) {
						sendIPCMessage('NetatmoAuthError', 'トークンリフレッシュ失敗: ' + refreshError.message);
					}
					throw refreshError;
				}
			}
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.fetchStationsData() error detail:\x1b[31m', error.response ? error.response.data : error, '\x1b[0m');
			throw new Error('Netatmoデータ取得失敗: ' + error);
		}
	},


	//////////////////////////////////////////////////////////////////////
	// Netatmoの処理


	/**
	 * 観測ジョブを停止して現状設定を保存する。
	 * @returns {Promise<void>}
	 */
	stop: async function () {
		mainNetatmo.isRun = false;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.stop()') : 0;

		await mainNetatmo.setConfig(config);
		await store.set('persist.Netatmo', persist);
		await mainNetatmo.stopObservation();
	},

	/**
	 * 保存せずに観測ジョブのみ停止する。
	 * @returns {Promise<void>}
	 */
	stopWithoutSave: async function () {
		mainNetatmo.isRun = false;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.stopWithoutSave()') : 0;
		await mainNetatmo.stopObservation();
	},


	/**
	 * 設定をディープマージして永続化・UIへ反映する。accessTokenキーは無視/除去。
	 * @param {Partial<NetatmoConfig>} _config 変更したい設定
	 * @returns {Promise<void>}
	 */
	setConfig: async function (_config) {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.setConfig() _config:\x1b[33m', _config, '\x1b[0m') : 0;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.setConfig() before merge config:\x1b[33m', config, '\x1b[0m') : 0;
		if (_config) {
			// accessTokenは無視してマージ
			if ('accessToken' in _config) {
				delete _config.accessToken;
			}
			config = mergeDeeply(config, _config);
		}
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.setConfig() after merge config:\x1b[32m', config, '\x1b[0m') : 0;
		await store.set('config.Netatmo', config);
		sendIPCMessage("renewNetatmoConfigView", config);
		sendIPCMessage("configSaved", 'Netatmo');// 保存したので画面に通知
	},

	/**
	 * 現在の設定を返す。
	 * @returns {NetatmoConfig}
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * 最新のステーションデータ永続オブジェクトを返す。
	 * @returns {any} persist構造（devices配列など）
	 */
	getPersist: function () {
		return persist;
	},


	//////////////////////////////////////////////////////////////////////
	// innser functions

	/**
	 * 日次集計用CASE式を生成する内部関数。3分刻み(24h * 20 = 480)で時間帯をバケット化。
	 * @param {Date} date 対象日（その日の0:00起点）
	 * @returns {string} SQL CASE 式断片
	 */
	getCases: function (date) {
		let T1 = new Date(date);
		let T2 = new Date(date);
		let T3 = new Date(date);
		let T4 = new Date(date);

		// UTCだがStringにて表現しているので、なんか複雑
		T1.setHours(T1.getHours() - T1.getHours() - 10, 57, 0, 0);// 前日の14時57分xx秒   14:57:00 .. 15:00:00 --> 00:00
		T2.setHours(T1.getHours() - T1.getHours() - 10, 58, 0, 0);// T1 + 1min
		T3.setHours(T1.getHours() - T1.getHours() - 10, 59, 0, 0);// T1 + 2min
		T4.setHours(T1.getHours() - T1.getHours(), 0, 0, 0);// 集約先

		let ret = "";
		for (let t = 0; t < 480; t += 1) {// 24h * 20 times (= 60min / 3min)
			// console.log( T1.toISOString(), ':', T1.toFormat('YYYY-MM-DD HH24:MI'), ', ', T4.toFormat('HH24:MI') );

			ret += `WHEN "createdAt" LIKE "${T1.toFormat('YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${T2.toFormat('YYYY-MM-DD HH24:MI')}%" OR "createdAt" LIKE "${T3.toFormat('YYYY-MM-DD HH24:MI')}%" THEN "${T4.toFormat('HH24:MI')}" \n`;

			T1.setMinutes(T1.getMinutes() + 3);// + 3 min
			T2.setMinutes(T2.getMinutes() + 3);// + 3 min
			T3.setMinutes(T3.getMinutes() + 3);// + 3 min
			T4.setMinutes(T4.getMinutes() + 3);// + 3 min
		}
		return ret + 'ELSE "24:00"';
	},


	/**
	 * 指定日の環境データを3分刻みバケットで平均値集計して取得する。
	 * @param {Date|string|null} [targetDate=null] 指定日。nullなら今日。
	 * @returns {Promise<any[]>} Sequelize findAll結果
	 */
	getRows: async function (targetDate = null) {
		try {
			// targetDateが指定されていればその日、なければ今日
			let baseDate = targetDate ? new Date(targetDate) : new Date();
			baseDate.setHours(0, 0, 0, 0); // その日の0時

			let begin = new Date(baseDate);
			begin.setHours(0, 0, 0, 0); // 0:00:00
			let end = new Date(baseDate);
			end.setDate(end.getDate() + 1); // 翌日の0:00:00

			let cases = mainNetatmo.getCases(baseDate);
			let subQuery = `CASE ${cases} END`;

			let rows = await roomEnvModel.findAll({
				attributes: ['id',
					[Sequelize.fn('AVG', Sequelize.col('temperature')), 'avgTemperature'],
					[Sequelize.fn('AVG', Sequelize.col('humidity')), 'avgHumidity'],
					[Sequelize.fn('AVG', Sequelize.col('pressure')), 'avgPressure'],
					[Sequelize.fn('AVG', Sequelize.col('CO2')), 'avgCO2'],
					[Sequelize.fn('AVG', Sequelize.col('noise')), 'avgNoise'],
					'createdAt',
					[Sequelize.literal(subQuery), 'timeunit']
				],
				where: {
					srcType: 'netatmo',
					dateTime: { [Op.between]: [begin.toISOString(), end.toISOString()] }
				},
				group: ['timeunit']
			});

			return rows;
		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.getRows()', error);
		}
	},

	/**
	 * 指定日の3分刻み配列（欠損はnull）を作りUI送信用構造を返す。
	 * @param {Date|string|null} [targetDate=null]
	 * @returns {Promise<Array<{id:number,time:string,srcType:string,temperature:number|null,humidity:number|null,pressure:number|null,noise:number|null,CO2:number|null}>>}
	 */
	getTodayRoomEnv: async function (targetDate = null) {
		// 画面に指定日のデータを送信するためのデータ作る
		try {
			let baseDate = targetDate ? new Date(targetDate) : new Date();
			baseDate.setHours(0, 0, 0, 0);
			let rows = await mainNetatmo.getRows(baseDate);

			let T1 = new Date(baseDate);

			let array = [];
			for (let t = 0; t < 480; t += 1) {
				let row = rows.find((row) => row.dataValues.timeunit == T1.toFormat('HH24:MI'));

				if (row) {
					array.push({
						id: t,
						time: T1.toISOString(),
						srcType: 'netatmo',
						temperature: row.dataValues.avgTemperature,
						humidity: row.dataValues.avgHumidity,
						pressure: row.dataValues.avgPressure,
						noise: row.dataValues.avgNoise,
						CO2: row.dataValues.avgCO2
					});
				} else {
					array.push({
						id: t,
						time: T1.toISOString(),
						srcType: 'netatmo',
						temperature: null,
						humidity: null,
						pressure: null,
						noise: null,
						CO2: null
					});
				}

				T1.setMinutes(T1.getMinutes() + 3);// + 3 min
			}
			return array;

		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.getTodayRoomEnv()', error);
		}
	},

	/**
	 * 当日（または最新）の環境データ配列をIPCでRendererへ送る。
	 * @returns {Promise<void>}
	 */
	sendTodayRoomEnv: async function () {
		let arg = {};

		if (config.enabled) {
			arg = await mainNetatmo.getTodayRoomEnv();
			sendIPCMessage('renewRoomEnvNetatmo', JSON.stringify(arg));
		}
	},

	/**
	 * 1分毎の監視cronを開始。トークン期限1分前ならリフレッシュし取得→DB保存→当日集計送信。
	 * 再重複開始は無視。
	 * @returns {void}
	 */
	setObserve: function () {
		if (mainNetatmo.observationJob) {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.observe() is already started.') : 0;
		}
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.observe() start.') : 0;

		// 監視はcronで実施、1分毎
		mainNetatmo.observationJob = cron.schedule('*/1 * * * *', async () => {
			try {
				// config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.cron.schedule() every 1min') : 0;

				// トークンが無い/期限切れなら再取得
				if (!mainNetatmo.accessToken || (mainNetatmo.tokenExpires && Date.now() > mainNetatmo.tokenExpires - 60000)) {
					await mainNetatmo.refreshAccessToken();
				}
				await mainNetatmo.fetchStationsData();

				let dt = new Date();
				if (config.enabled && persist.length != 0) {
					let n = persist[0];
					if (n) {
						roomEnvModel.create({
							dateTime: dt,
							srcType: 'netatmo',
							place: n.home_name,
							temperature: n.dashboard_data.Temperature,
							humidity: n.dashboard_data.Humidity,
							pressure: n.dashboard_data.Pressure,
							noise: n.dashboard_data.Noise,
							CO2: n.dashboard_data.CO2
						});
					}
				}
				mainNetatmo.sendTodayRoomEnv();
			} catch (error) {
				console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.cron.schedule() each 1min, error:', error);
			}
		});
		mainNetatmo.observationJob.start();
	},


	/**
	 * 観測cronを停止する。
	 * @returns {void}
	 */
	stopObservation: function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainNetatmo.stop() observation.') : 0;

		if (mainNetatmo.observationJob) {
			mainNetatmo.observationJob.stop();
			mainNetatmo.observationJob = null;
		}
	}
};


// module.exports = mainNetatmo;
export { mainNetatmo };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
