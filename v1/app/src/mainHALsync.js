//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2021.11.09
//////////////////////////////////////////////////////////////////////
/**
 * @module mainHALsync
 */
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const { eldataModel, IOT_MajorResultsModel, IOT_MinorResultsModel } = require('./models/localDBModels');   // DBデータと連携
const { Op } = require("sequelize");
// const http = require('http');
const https = require('https');

const Store = require('electron-store');
const store = new Store();

const { getToday, mergeDeeply } = require('./mainSubmodule');

const HAL_API_BASE_URL = 'https://hal.sugi-lab.net/api';

let config = {  // = config.HAL
	halApiToken: '',   // HALと連携するユーザ別のトークン
	// startUploadEldataTime: 300000,
	resultExpireDays: 365,
	ellogExpireDays: 30,
	UPLOAD_UNIT_NUM: 100, 	// 分割アップロードのログの数
	UPLOAD_UNIT_INTERVAL: 1000, // 分割アップロードの間隔 (ミリ秒)
	UPLOAD_START_INTERVAL: 300000, // アップロード処理の起動間隔 (ミリ秒)
	lastUploadedTime: 0,  // 最終アップロード時間
	lastUploadedId: 0,    // 最終アップロードID
	debug: false
};

let persist = {  // = persist.HAL
	name: 'No Profile',  // HALからのprofile
	UID: 'No Data',
	sex: 'No Data',
	age: 'No Data'
};

let sendIPCMessage = null;

//////////////////////////////////////////////////////////////////////
// HAL, Home-life Assessment Listの処理

let mainHALsync = {
	//----------------------------------
	/**
	 * @func start
	 * @desc 初期化
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	start: async function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;
		config = await store.get('config.HAL', config);
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALsync.initialize') : 0;

		// mainHALsync.startUploadEldata(); 	// 家電操作ログのアップロードを開始、HALのDBがきついのでとりあえずやらない
		sendIPCMessage("renewHALConfigView", config);  // configを送る、そうするとViewがkeyチェックのためにprofile取りに来る
	},

	//----------------------------------------------------------------------------------------------
	/**
	 * @func startSync
	 * @desc 同期処理, トリガー：APIKey設定時、同期ボタン押下、定時処理
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	startSync: async function () {
		mainHALsync.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALsync.startSync().') : 0;

		// HAL API トークンが登録されていなければ終了
		if (!config.halApiToken) {
			return;
		}

		// 今日の日付を取得 (YYYY-MM-DD)
		let today = getToday();

		try {
			let updata = {
				MajorResults: null,
				MinorResults: null
			};

			// ローカルの MajorResults から今日のレコードを取得
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Getting the latest record in the local MajorResults table.') : 0;
			let major_data = await IOT_MajorResultsModel.findOne({
				where: {
					date: today
				}
			});
			if (major_data) {
				updata.MajorResults = major_data.dataValues;
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- major_data:',
										   JSON.stringify(major_data.dataValues, null, '  ')) : 0;
			} else {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- major_data: null') : 0;
			}

			// ローカルの MinorResults から最新のレコードを取得
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Getting the latest record in the local MinorResults table.') : 0;
			let minor_data = await IOT_MinorResultsModel.findOne({
				where: {
					date: today
				}
			});
			if (minor_data) {
				updata.MinorResults = minor_data.dataValues;
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- minor_data:',
										   JSON.stringify(minor_data.dataValues, null, '  ')) : 0;
			} else {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- minor_data: null') : 0;
			}

			// 成績データを HAL にアップロード
			const hal_results_url = HAL_API_BASE_URL + '/results';

			if (updata.MajorResults || updata.MinorResults) {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Uploading to HAL, updata:', JSON.stringify(updata, null, '  ')) : 0;
				await mainHALsync.httpPostRequest(hal_results_url, updata);
			}

			// HAL から成績データをダウンロード
			let dndata = await mainHALsync.httpGetRequest(hal_results_url);
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Downloading from HAL, dndata:', JSON.stringify(dndata, null, '  ')) : 0;

			// HAL からダウンロードした成績データをローカルに保存
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Saving.') : 0;

			// 今の日時 ("YYYY-MM-DD hh:mm:ss")
			//let now = getNow();
			let now = new Date();

			// MajorResults テーブルのレコードを保存
			if (dndata.MajorResults) {
				let rec = {};
				if (updata.MajorResults) {
					// ローカルに今日のレコードがあれば、それをダウンロードデータで UPDATE する。
					// ただし、ローカルのレコードとダウンロードしたレコードの assessmentSource
					// の値がともに "questionnaire" なら、すべてのカラムの値を上書きし、そうで
					// なければ、ローカル側が null のカラムのみを更新する
					if (updata.MajorResults.assessmentSource === 'questionnaire' && dndata.MajorResults.assessmentSource === 'questionnaire') {
						for (let [k] of Object.entries(updata.MajorResults)) {
							rec[k] = dndata.MajorResults[k];
						}
					} else {
						for (let [k, v] of Object.entries(updata.MajorResults)) {
							if (v === null && dndata.MajorResults[k] !== null) {
								rec[k] = dndata.MajorResults[k];
							}
						}
					}
					let id = updata.MajorResults.idIOT_MajorResults;
					rec.updatedAt = now;
					await IOT_MajorResultsModel.update(rec, {
						where: { idIOT_MajorResults: id }
					});
					let updated_res = await IOT_MajorResultsModel.findOne({
						where: { idIOT_MajorResults: id }
					});
					config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Updated the latest record in the IOT_MajorResults table:') : 0;
					config.debug ? console.log(JSON.stringify( updated_res.dataValues, null, '  ')) : 0;
				} else {
					// 今日のレコードがなければ、それを INSERT
					rec = dndata.MajorResults;
					delete rec.idIOT_MajorResults;
					delete rec.UID;
					// rec.createdAt = now;
					// rec.updatedAt = now;
					let ins_res = await IOT_MajorResultsModel.create(rec);
					config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Inserted a new record in the IOT_MajorResults table:') : 0;
					config.debug ? console.log(JSON.stringify( ins_res.dataValues, null, '  ')) : 0;
				}
			}
			// MinorResults テーブルのレコードを保存
			if (dndata.MinorResults) {
				let rec = {};
				if (updata.MinorResults) {
					// ローカルに今日のレコードがあれば、それをダウンロードデータで UPDATE する。
					// ただし、ローカルのレコードとダウンロードしたレコードの assessmentSource
					// の値がともに "questionnaire" なら、すべてのカラムの値を上書きし、そうで
					// なければ、ローカル側が null のカラムのみを更新する
					if (updata.MinorResults.assessmentSource === 'questionnaire' && dndata.MinorResults.assessmentSource === 'questionnaire') {
						for (let [k] of Object.entries(updata.MinorResults)) {
							rec[k] = dndata.MinorResults[k];
						}
					} else {
						for (let [k, v] of Object.entries(rec)) {
							if (v === null && dndata.MinorResults[k] !== null) {
								rec[k] = dndata.MinorResults[k];
							}
						}
					}
					let id = updata.MinorResults.idIOT_MinorResults;
					rec.updatedAt = now;
					await IOT_MinorResultsModel.update(rec, {
						where: { idIOT_MinorResults: id }
					});
					let updated_res = await IOT_MinorResultsModel.findOne({
						where: { idIOT_MinorResults: id }
					});
					config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Updated the latest record in the IOT_MinorResults table:') : 0;
					config.debug ? console.log(JSON.stringify( updated_res.dataValues, null, '  ')) : 0;
				} else {
					// 今日のレコードがなければ、それを INSERT
					rec = dndata.MinorResults;
					delete rec.idIOT_MinorResults;
					delete rec.UID;
					// rec.createdAt = now;
					// rec.updatedAt = now;
					let ins_res = await IOT_MinorResultsModel.create(rec);
					config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Inserted a new record in the IOT_MinorResults table:') : 0;
					config.debug ? console.log(JSON.stringify( ins_res.dataValues, null, '  ')) : 0;
				}
			}
			// MinorkeyMeans テーブルのレコードを保存
			// MinorkeyMeansに関してはローカルで生成することにした
			/*
			if (dndata.MinorkeyMeans) {
				let mdata = dndata.MinorkeyMeans;
				// 同じバージョンのレコードをテーブルから削除
				let deleted_num = await IOT_MinorkeyMeansModel.destroy({
					where: {
						version: mdata.version
					}
				});
				console.log('Deleted ' + deleted_num + ' records in the MinorkeyMeans teble.');
				// ダウンロードしたデータをテーブルに追加
				for (let [name, val] of Object.entries(mdata.data)) {
					let parts = name.split('_');
					let major_key = parseInt(parts[1], 10);
					let minor_key = parseInt(parts[2], 10);
					await IOT_MinorkeyMeansModel.create({
						version: mdata.version,
						majorKey: major_key,
						minorKey: minor_key,
						means: val
					});
				}
				console.log('Inserted ' + Object.keys(mdata.data).length + ' records in the MinorkeyMeans teble.');
			}
			*/
			// メインプロセスに同期完了のイベントを送信
			sendIPCMessage("HALsyncResponse", {});

			// mainWindow.webContents.send('to-renderer', JSON.stringify({ cmd: "Synced", arg: {} }));

		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALsync.startSync() error:', error);
			let arg = {
				error: error.message
			};

			sendIPCMessage("HALsyncResponse", arg);
			// mainWindow.webContents.send('to-renderer', JSON.stringify({ cmd: "Synced", arg: arg }));
		}
	},

	//----------------------------------------------------------------------------------------------
	/**
	 * @func httpGetRequest
	 * @desc httpGetRequest
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	httpGetRequest: function (url, token) {
		return new Promise((resolve, reject) => {
			if (!token) {
				token = config.halApiToken;
			}

			const options = {
				method: 'GET',
				headers: {
					'Authorization': 'Bearer ' + token
				},
				rejectUnauthorized: false,
				requestCert: true,
				agent: false
			};

			let res_str = '';
			const req = https.request(url, options, (res) => {
				res.setEncoding('utf8');
				res.on('data', (chunk) => {
					res_str += chunk;
				});
				res.on('end', () => {
					if (res.statusCode === 200) {
						let res_data = null;
						try {
							res_data = JSON.parse(res_str);
						} catch (error) {
							console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALsync.httpGetRequest', error);
							console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| error res_str:', res_str);
						}
						resolve(res_data);
					} else {
						let message = 'method=get, url=' + url + ', code=' + res.statusCode + ', message=';
						try {
							let res_data = JSON.parse(res_str);
							message += res_data.error;
						} catch (error) {
							console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALsync.httpGetRequest', error);
							console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| error res_str:', res_str);
						}
						reject(new Error('Received an error response from HAL: ' + message));
					}
				});
			});

			req.on('error', (error) => {
				reject(new Error('Failed to send a http get request: ' + error.message));
			});

			req.end();
		});
	},


	//----------------------------------------------------------------------------------------------
	/**
	 * @func httpPostRequest
	 * @desc httpPostRequest
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	httpPostRequest: function (url, data, token) {
		if (!token) {
			token = config.halApiToken;
		}
		return new Promise((resolve, reject) => {
			const req_body_str = JSON.stringify(data);

			const options = {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer ' + token,
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(req_body_str)
				},
				rejectUnauthorized: false,
				requestCert: true,
				agent: false
			};

			let res_str = '';
			const req = https.request(url, options, (res) => {
				res.setEncoding('utf8');
				res.on('data', (chunk) => {
					res_str += chunk;
				});
				res.on('end', () => {
					if (res.statusCode === 200) {
						let res_data = null;
						try {
							res_data = JSON.parse(res_str);
						} catch (error) {
							console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALsync.httpPostRequest', error);
							console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| error res_str:', res_str);
						}
						resolve(res_data);
					} else {
						let message = 'method=post, url=' + url + ', code=' + res.statusCode + ', message=';
						try {
							let res_data = JSON.parse(res_str);
							message += res_data.error;
						} catch (error) {
							console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALsync.httpPostRequest', error);
						}
						reject(new Error('Received an error response from HAL: ' + message));
					}
				});
			});

			req.on('error', (error) => {
				reject(new Error('Failed to send a http post request: ' + error.message));
			});

			req.write(req_body_str);
			req.end();
		});
	},


	//----------------------------------
	/**
	 * @func setHalApiTokenRequest
	 * @desc HAL API トークン設定
	 * APIトークンをセットして、実際にプロファイルを受信できたら設定値として保存
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	setHalApiTokenRequest: async function (_token) {
		let arg = {};
		try {
			let profile = await mainHALsync.httpGetRequest(HAL_API_BASE_URL + '/profile', _token);
			await store.set('config.HAL.halApiToken', _token);
			config.halApiToken = _token;
			arg = { profile: profile };
		} catch (error) {
			arg.error = error.message;
		}
		sendIPCMessage("HALsetApiTokenResponse", arg);
	},

	//----------------------------------
	/**
	 * @func deleteHalApiToken
	 * @desc HAL API トークン設定削除
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	deleteHalApiToken: async function () {
		try {
			await store.delete('config.HAL.halApiToken');
			config.halApiToken = null;
			persist.profile = { name: 'No Profile', UID: 'No Data', sex: 'No Data', age: 'No Data' };
		} catch (error) {
			arg.error = error.message;
		}

		sendIPCMessage("HALdeleteApiTokenResponse", null);
	},

	//----------------------------------
	/**
	 * @func getHalUserProfileRequest
	 * @desc HAL ユーザープロファイル取得
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	getHalUserProfileRequest: async function () {
		let arg = {};
		try {
			let profile = await mainHALsync.httpGetRequest(HAL_API_BASE_URL + '/profile');
			arg.profile = profile;
			persist.profile = profile;
		} catch (error) {
			arg.error = error.message;
		}

		sendIPCMessage("HALgetUserProfileResponse", arg);
	},

	//----------------------------------------------------------------------------------------------
	/**
	 * @func startUploadEldata
	 * @desc 家電操作ログのアップロードを開始、定期的実行
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	startUploadEldata: async function () {
		// HAL API トークンが登録されていなければ次回起動のタイマーをセットして終了
		if (!config.halApiToken) {
			setTimeout(mainHALsync.startUploadEldata, config.UPLOAD_START_INTERVAL, config);
			return;
		}

		// 最後にアップロードした日時と Log ID をストレージから取得したので、エラーチェック
		if (!config.lastUploadedTime) {
			config.lastUploadedTime = 0;
		}

		if (!config.lastUploadedId) {
			config.lastUploadedId = 0;
		}

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALsync.startUploadEldata Started to upload ELData:') : 0;
		// console.log('- Last Uploaded time: ' + (new Date(config.lastUploadedTime)).toLocaleString());
		// console.log('- Last Uploaded Log ID: ' + config.lastUploadedId);

		// 新たな家電操作ログ件数を取得
		let cnt = 0;
		try {
			cnt = await eldataModel.count({
				where: {
					id: { [Op.gt]: config.lastUploadedId }
				}
			});
			// console.log('- Number of new logs: ' + cnt);
		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALsync.startUploadEldata', error);
			setTimeout(mainHALsync.startUploadEldata, config.UPLOAD_START_INTERVAL, config);
			return;
		}

		// 新たな家電操作ログがなければ次回起動のタイマーをセットして終了
		if (!cnt) {
			setTimeout(mainHALsync.startUploadEldata, config.UPLOAD_START_INTERVAL, config);
			return;
		}

		// 新たな家電操作ログを取得 (最大 100 件)
		let dlist_orig = await eldataModel.findAll({
			where: { id: { [Op.gt]: config.lastUploadedId } },
			order: [['id', 'ASC']], // id の値が小さい順
			offset: 0,
			limit: config.UPLOAD_UNIT_NUM
		});
		// 純粋な Object オブジェクトじゃないので、純粋な Object オブジェクトに変換
		let dlist = JSON.parse(JSON.stringify(dlist_orig));

		// createdAt の値が Date オブジェクトから文字列に変換されてしまったが、
		// そのフォーマットが 2021-08-22T07:32:00.353Z になっているので、
		// SQL の datetime のフォーマット (2021-08-22 07:32:00) に変換
		for (let d of dlist) {
			let t = d.createdAt;
			d.createdAt = t.substr(0, 10) + ' ' + t.substr(11, 8);
		}

		// HAL に家電操作ログをアップロード
		try {
			await mainHALsync.httpPostRequest(HAL_API_BASE_URL + '/eldata', dlist);
			// console.log('- Number of uploaded logs: ' + dlist.length);
		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| ', error);
			setTimeout(mainHALsync.startUploadEldata, config.UPLOAD_START_INTERVAL, config);
			return;
		}

		// ログの id の最大値
		let max_id = 0;
		for (let d of dlist) {
			if (d.id > max_id) {
				max_id = d.id;
			}
		}

		// 最後にアップロードした日時と Log ID をストレージに保存
		await store.set('config.HAL.lastUploadedTime', Date.now());
		await store.set('config.HAL.lastUploadedId', max_id);

		// 次回起動のタイマーをセット
		let interval = config.UPLOAD_START_INTERVAL;
		if (dlist.length === config.UPLOAD_UNIT_NUM) {
			interval = config.UPLOAD_UNIT_INTERVAL;
		}
		setTimeout(mainHALsync.startUploadEldata, interval, config);
	},

	//----------------------------------------------------------------------------------------------
	/**
	 * @func ConfigSave
	 * @desc ConfigSave
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	ConfigSave: async function () {
		await store.set('config.HAL', config);
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
		config = mergeDeeply(config, _config);
		await store.set('config.HAL', config);
		sendIPCMessage("renewHALConfigView", config);
		sendIPCMessage("configSaved", 'HAL');  // 保存したので画面に通知
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

	//----------------------------------------------------------------------------------------------
	/**
	 * @func renewConfigView
	 * @desc renewConfigView
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	renewConfigView: async function () {
		sendIPCMessage("renewHALConfigView", config);  // 現在の設定値を表示
	}

};


module.exports = mainHALsync;
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
