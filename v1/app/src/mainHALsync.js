//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2021.11.09
//////////////////////////////////////////////////////////////////////
/**
 * @module mainHALsync
 */
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const { Op, eldataModel, IOT_MajorResultsModel, IOT_MinorResultsModel, IOT_GarminDailiesModel, IOT_GarminStressDetailsModel, IOT_GarminEpochsModel, IOT_GarminSleepsModel, IOT_GarminUserMetricsModel, IOT_GarminActivitiesModel, IOT_GarminActivityDetailsModel, IOT_GarminMoveIQActivitiesModel, IOT_GarminAllDayRespirationModel, IOT_GarminPulseoxModel, IOT_GarminBodyCompsModel } = require('./models/localDBModels');   // DBデータと連携

const Store = require('electron-store');
const https = require('https');
const cron = require('node-cron');
require('date-utils'); // for log
const { getToday, mergeDeeply } = require('./mainSubmodule');

const store = new Store();
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
	age: 'No Data',
	garmin: {}
};

let sendIPCMessage = null;


//////////////////////////////////////////////////////////////////////
// HAL, Home-life Assessment Listの処理
let mainHALsync = {
	isRun: false,
	uploadEldataTask: null,

	//----------------------------------
	/**
	 * @func start
	 * @desc 初期化
	 * @async
	 * @param {function} _sendIPCMessage
	 * @throw error
	 */
	start: async function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		if (mainHALsync.isRun) {  // 重複起動対策
			sendIPCMessage("renewHALConfigView", config);  // configを送る、そうするとViewがkeyチェックのためにprofile取りに来る
			sendIPCMessage("showGarmin", persist.garmin);  // 保持しているGarminデータを表示する
			return;
		}
		mainHALsync.isRun = true;

		config = await store.get('config.HAL', config);
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALsync.start()') : 0;

		persist = store.get('persist.HAL', persist);

		// 家電操作ログのアップロード、HALのDBがきついので停止中
		/*
		mainHALsync.uploadEldataTask = cron.schedule('0 0 * * *', () => { // 毎日0時
			mainHALsync.startUploadEldata();  // 家電操作ログのアップロード
		})
		mainHALsync.uploadEldataTask.start();
		*/

		sendIPCMessage("renewHALConfigView", config);  // configを送る、そうするとViewがkeyチェックのためにprofile取りに来る
		sendIPCMessage("showGarmin", persist.garmin);  // 保持しているGarminデータを表示する

		if (!persist?.garmin) {  // garminデータがない時には一回ダウンロードする
			mainHALsync.garminDownload();
		}

	},


	//----------------------------------------------------------------------------------------------
	/**
	 * @func startSync
	 * @desc 同期処理, トリガー：APIKey設定時、同期ボタン押下、定時処理
	 * @async
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
				// config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- major_data:', JSON.stringify(major_data.dataValues, null, '  ')) : 0;
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- major_data: found in DB') : 0;
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
				// config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- minor_data:', JSON.stringify(minor_data.dataValues, null, '  ')) : 0;
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- minor_data: found in DB') : 0;
			} else {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- minor_data: null') : 0;
			}

			// 成績データを HAL にアップロード
			const hal_results_url = HAL_API_BASE_URL + '/results';

			if (updata.MajorResults || updata.MinorResults) {
				// config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Uploading to HAL, updata:', JSON.stringify(updata, null, '  ')) : 0;
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Uploading to HAL') : 0;
				await mainHALsync.httpPostRequest(hal_results_url, updata);
			}

			// HAL から成績データをダウンロード
			let dndata = await mainHALsync.httpGetRequest(hal_results_url);
			// config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Downloading from HAL, dndata:', JSON.stringify(dndata, null, '  ')) : 0;
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Downloading from HAL') : 0;

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
					// config.debug ? console.log(JSON.stringify(updated_res.dataValues, null, '  ')) : 0;
				} else {
					// 今日のレコードがなければ、それを INSERT
					rec = dndata.MajorResults;
					delete rec.idIOT_MajorResults;
					delete rec.UID;
					// rec.createdAt = now;
					// rec.updatedAt = now;
					let ins_res = await IOT_MajorResultsModel.create(rec);
					config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Inserted a new record in the IOT_MajorResults table:') : 0;
					// config.debug ? console.log(JSON.stringify(ins_res.dataValues, null, '  ')) : 0;
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
					// config.debug ? console.log(JSON.stringify(updated_res.dataValues, null, '  ')) : 0;
				} else {
					// 今日のレコードがなければ、それを INSERT
					rec = dndata.MinorResults;
					delete rec.idIOT_MinorResults;
					delete rec.UID;
					// rec.createdAt = now;
					// rec.updatedAt = now;
					let ins_res = await IOT_MinorResultsModel.create(rec);
					config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Inserted a new record in the IOT_MinorResults table:') : 0;
					// config.debug ? console.log(JSON.stringify(ins_res.dataValues, null, '  ')) : 0;
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
			mainHALsync.garminDownload();

			// メインプロセスに同期完了のイベントを送信
			sendIPCMessage("HALSyncResponse", {});

		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALsync.startSync() ', error);
			let arg = {
				error: error.message
			};

			sendIPCMessage('Error', {
				datetime: new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"),
				moduleName: 'mainHALsync.startSync()',
				stackLog: `Detail: ${error}`
			});

			// mainWindow.webContents.send('to-renderer', JSON.stringify({ cmd: "Synced", arg: arg }));
		}
	},

	//----------------------------------------------------------------------------------------------
	/**
	 * @func garminDownload
	 * @desc garminDownload
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	garminDownload: async function () {
		mainHALsync.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALsync.garminDownload().') : 0;

		// HAL API トークンが登録されていなければ終了
		if (!config.halApiToken) {
			return;
		}

		const hal_garmin_download_url = HAL_API_BASE_URL + '/garminDownload';

		try {
			// HAL からGarminデータをダウンロード
			let dndata = await mainHALsync.httpGetRequest(hal_garmin_download_url);
			// config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Downloading garmin data from HAL', JSON.stringify(dndata, null, '  ')) : 0;
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Downloading garmin data from HAL') : 0;

			// HAL からダウンロードしたGarminデータをローカルに保存
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Saving.') : 0;

			// Activities
			if (dndata.Activities) {
				// ダウンロードしたデータをテーブルに追加
				await IOT_GarminActivitiesModel.findOrCreate({
					where: {
						idIOT_GarminActivities: dndata.Activities.idIOT_GarminActivities
					},
					defaults: {
						idIOT_GarminActivities: dndata.Activities.idIOT_GarminActivities,
						garminId: dndata.Activities.garminId,
						garminAccessToken: dndata.Activities.garminAccessToken,
						summaryId: dndata.Activities.summaryId,
						activityId: dndata.Activities.activityId,
						durationInSeconds: dndata.Activities.durationInSeconds,
						startTimeInSeconds: dndata.Activities.startTimeInSeconds,
						startTimeOffsetInSeconds: dndata.Activities.startTimeOffsetInSeconds,
						activityType: dndata.Activities.activityType,
						averageHeartRateInBeatsPerMinute: dndata.Activities.averageHeartRateInBeatsPerMinute,
						averageRunCadenceInStepsPerMinute: dndata.Activities.averageRunCadenceInStepsPerMinute,
						averageSpeedInMetersPerSecond: dndata.Activities.averageSpeedInMetersPerSecond,
						averagePaceInMinutesPerKilometer: dndata.Activities.averagePaceInMinutesPerKilometer,
						activeKilocalories: dndata.Activities.activeKilocalories,
						deviceName: dndata.Activities.deviceName,
						distanceInMeters: dndata.Activities.distanceInMeters,
						maxHeartRateInBeatsPerMinute: dndata.Activities.maxHeartRateInBeatsPerMinute,
						maxPaceInMinutesPerKilometer: dndata.Activities.maxPaceInMinutesPerKilometer,
						maxRunCadenceInStepsPerMinute: dndata.Activities.maxRunCadenceInStepsPerMinute,
						maxSpeedInMetersPerSecond: dndata.Activities.maxSpeedInMetersPerSecond,
						steps: dndata.Activities.steps,
						createdAt: dndata.Activities.createdAt,
						updatedAt: dndata.Activities.updatedAt
					}
				});
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Inserted a record in the IOT_GarminActivitiesModel teble.') : 0;
			} else {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- No record in the IOT_GarminActivitiesModel teble.') : 0;
			}

			// ActivityDetails
			if (dndata.ActivityDetails) {
				// ダウンロードしたデータをテーブルに追加
				await IOT_GarminActivityDetailsModel.findOrCreate({
					where: {
						idIOT_GarminActivityDetails: dndata.ActivityDetails.idIOT_GarminActivityDetails
					},
					defaults: {
						idIOT_GarminActivityDetails: dndata.ActivityDetails.idIOT_GarminActivityDetails,
						garminId: dndata.ActivityDetails.garminId,
						garminAccessToken: dndata.ActivityDetails.garminAccessToken,
						summaryId: dndata.ActivityDetails.summaryId,
						activityId: dndata.ActivityDetails.activityId,
						summary: dndata.ActivityDetails.summary,
						samples: dndata.ActivityDetails.samples,
						laps: dndata.ActivityDetails.laps,
						createdAt: dndata.ActivityDetails.createdAt,
						updatedAt: dndata.ActivityDetails.updatedAt
					}
				});
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Inserted a record in the IOT_GarminActivityDetailsModel teble.') : 0;
			} else {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- No record in the IOT_GarminActivityDetailsModel teble.') : 0;
			}


			// ActivityDetails
			if (dndata.AllDayRespiration) {
				// ダウンロードしたデータをテーブルに追加
				await IOT_GarminAllDayRespirationModel.findOrCreate({
					where: {
						idIOT_GarminAllDayRespiration: dndata.ActivityDetails.idIOT_GarminAllDayRespiration
					},
					defaults: {
						idIOT_GarminAllDayRespiration: dndata.ActivityDetails.idIOT_GarminAllDayRespiration,
						garminId: dndata.AllDayRespiration.garminId,
						garminAccessToken: dndata.AllDayRespiration.garminAccessToken,
						summaryId: dndata.AllDayRespiration.summaryId,
						activityId: dndata.AllDayRespiration.startTimeInSeconds,
						summary: dndata.AllDayRespiration.durationInSeconds,
						samples: dndata.AllDayRespiration.startTimeOffsetInSeconds,
						laps: dndata.AllDayRespiration.timeOffsetEpochToBreaths,
						createdAt: dndata.AllDayRespiration.createdAt,
						updatedAt: dndata.AllDayRespiration.updatedAt
					}
				});
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Inserted a record in the IOT_GarminAllDayRespirationModel teble.') : 0;
			} else {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- No record in the IOT_GarminAllDayRespirationModel teble.') : 0;
			}


			// BodyComps
			if (dndata.BodyComps) {
				// ダウンロードしたデータをテーブルに追加
				await IOT_GarminBodyCompsModel.findOrCreate({
					where: {
						idIOT_GarminBodyComps: dndata.BodyComps.idIOT_GarminBodyComps
					},
					defaults: {
						idIOT_GarminBodyComps: dndata.BodyComps.idIOT_GarminBodyComps,
						garminId: dndata.BodyComps.garminId,
						garminAccessToken: dndata.BodyComps.garminAccessToken,
						summaryId: dndata.BodyComps.summaryId,
						muscleMassInGrams: dndata.BodyComps.muscleMassInGrams,
						boneMassInGrams: dndata.BodyComps.boneMassInGrams,
						bodyWaterInPercent: dndata.BodyComps.bodyWaterInPercent,
						bodyFatInPercent: dndata.BodyComps.bodyFatInPercent,
						bodyMassIndex: dndata.BodyComps.bodyMassIndex,
						weightInGrams: dndata.BodyComps.weightInGrams,
						measurementTimeInSeconds: dndata.BodyComps.measurementTimeInSeconds,
						measurementTimeOffsetInSeconds: dndata.BodyComps.measurementTimeOffsetInSeconds,
						createdAt: dndata.BodyComps.createdAt,
						updatedAt: dndata.BodyComps.updatedAt
					}
				});
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Inserted a record in the IOT_GarminPulseoxModel teble.') : 0;
			} else {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- No record in the IOT_GarminPulseoxModel teble.') : 0;
			}

			// Dailies
			if (dndata.Dailies) {
				// ダウンロードしたデータをテーブルに追加
				await IOT_GarminDailiesModel.findOrCreate({
					where: {
						idIOT_GarminDailies: dndata.Dailies.idIOT_GarminDailies
					},
					defaults: {
						idIOT_GarminDailies: dndata.Dailies.idIOT_GarminDailies,
						garminId: dndata.Dailies.garminId,
						garminAccessToken: dndata.Dailies.garminAccessToken,
						summaryId: dndata.Dailies.summaryId,
						calendarDate: dndata.Dailies.calendarDate,
						startTimeInSeconds: dndata.Dailies.startTimeInSeconds,
						startTimeOffsetInSeconds: dndata.Dailies.startTimeOffsetInSeconds,
						activityType: dndata.Dailies.activityType,
						durationInSeconds: dndata.Dailies.durationInSeconds,
						steps: dndata.Dailies.steps,
						distanceInMeters: dndata.Dailies.distanceInMeters,
						activeTimeInSeconds: dndata.Dailies.activeTimeInSeconds,
						activeKilocalories: dndata.Dailies.activeKilocalories,
						bmrKilocalories: dndata.Dailies.bmrKilocalories,
						cunsumedCalories: dndata.Dailies.cunsumedCalories,
						moderateIntensityDurationInSeconds: dndata.Dailies.moderateIntensityDurationInSeconds,
						vigorousIntensityDurationInSeconds: dndata.Dailies.vigorousIntensityDurationInSeconds,
						floorsClimbed: dndata.Dailies.floorsClimbed,
						minHeartRateInBeatsPerMinute: dndata.Dailies.minHeartRateInBeatsPerMinute,
						averageHeartRateInBeatsPerMinute: dndata.Dailies.averageHeartRateInBeatsPerMinute,
						maxHeartRateInBeatsPerMinute: dndata.Dailies.maxHeartRateInBeatsPerMinute,
						restStressDurationInSeconds: dndata.Dailies.restStressDurationInSeconds,
						timeOffsetHeartRateSamples: dndata.Dailies.timeOffsetHeartRateSamples,
						averageStressLevel: dndata.Dailies.averageStressLevel,
						maxStressLevel: dndata.Dailies.maxStressLevel,
						stressDurationInSeconds: dndata.Dailies.stressDurationInSeconds,
						activityStressDurationInSeconds: dndata.Dailies.activityStressDurationInSeconds,
						lowStressDurationInSeconds: dndata.Dailies.lowStressDurationInSeconds,
						mediumStressDurationInSeconds: dndata.Dailies.mediumStressDurationInSeconds,
						highStressDurationInSeconds: dndata.Dailies.highStressDurationInSeconds,
						stressQualifier: dndata.Dailies.stressQualifier,
						stepsGoal: dndata.Dailies.stepsGoal,
						netKilocaloriesGoal: dndata.Dailies.netKilocaloriesGoal,
						intensityDurationGoalInSeconds: dndata.Dailies.intensityDurationGoalInSeconds,
						floorsClimbedGoal: dndata.Dailies.floorsClimbedGoal,
						createdAt: dndata.Dailies.createdAt,
						updatedAt: dndata.Dailies.updatedAt
					}
				});
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Inserted a record in the IOT_GarminDailiesModel teble.') : 0;
			} else {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- No record in the IOT_GarminDailiesModel teble.') : 0;
			}

			// Epochs
			if (dndata.Epochs) {
				// ダウンロードしたデータをテーブルに追加
				await IOT_GarminEpochsModel.findOrCreate({
					where: {
						idIOT_GarminEpochs: dndata.Epochs.idIOT_GarminEpochs
					},
					defaults: {
						idIOT_GarminEpochs: dndata.Epochs.idIOT_GarminEpochs,
						garminId: dndata.Epochs.garminId,
						garminAccessToken: dndata.Epochs.garminAccessToken,
						summaryId: dndata.Epochs.summaryId,
						startTimeInSeconds: dndata.Epochs.startTimeInSeconds,
						startTimeOffsetInSeconds: dndata.Epochs.startTimeOffsetInSeconds,
						activityType: dndata.Epochs.activityType,
						durationInSeconds: dndata.Epochs.durationInSeconds,
						activeTimeInSeconds: dndata.Epochs.activeTimeInSeconds,
						steps: dndata.Epochs.steps,
						distanceInMeters: dndata.Epochs.distanceInMeters,
						activeKilocalories: dndata.Epochs.activeKilocalories,
						met: dndata.Epochs.met,
						intensity: dndata.Epochs.intensity,
						meanMotionIntensity: dndata.Epochs.meanMotionIntensity,
						maxMotionIntensity: dndata.Epochs.maxMotionIntensity,
						createdAt: dndata.Epochs.createdAt,
						updatedAt: dndata.Epochs.updatedAt
					}
				});
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Inserted a record in the IOT_GarminEpochsModel teble.') : 0;
			} else {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- No record in the IOT_GarminEpochsModel teble.') : 0;
			}

			// MoveIQActivities
			if (dndata.MoveIQActivities) {
				// ダウンロードしたデータをテーブルに追加
				await IOT_GarminMoveIQActivitiesModel.findOrCreate({
					where: {
						idIOT_GarminMoveIQActivities: dndata.MoveIQActivities.idIOT_GarminMoveIQActivities
					},
					defaults: {
						idIOT_GarminMoveIQActivities: dndata.MoveIQActivities.idIOT_GarminMoveIQActivities,
						garminId: dndata.MoveIQActivities.garminId,
						garminAccessToken: dndata.MoveIQActivities.garminAccessToken,
						summaryId: dndata.MoveIQActivities.summaryId,
						calendarDate: dndata.MoveIQActivities.calendarDate,
						startTimeInSeconds: dndata.MoveIQActivities.startTimeInSeconds,
						offsetInSeconds: dndata.MoveIQActivities.offsetInSeconds,
						durationInSeconds: dndata.MoveIQActivities.durationInSeconds,
						activityType: dndata.MoveIQActivities.activityType,
						activitySubType: dndata.MoveIQActivities.activitySubType,
						createdAt: dndata.MoveIQActivities.createdAt,
						updatedAt: dndata.MoveIQActivities.updatedAt
					}
				});
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Inserted a record in the IOT_GarminMoveIQActivitiesModel teble.') : 0;
			} else {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- No record in the IOT_GarminMoveIQActivitiesModel teble.') : 0;
			}

			// Pulseox
			if (dndata.Pulseox) {
				// ダウンロードしたデータをテーブルに追加
				await IOT_GarminPulseoxModel.findOrCreate({
					where: {
						idIOT_GarminPulseox: dndata.Pulseox.idIOT_GarminPulseox
					},
					defaults: {
						idIOT_GarminPulseox: dndata.Pulseox.idIOT_GarminPulseox,
						garminId: dndata.Pulseox.garminId,
						garminAccessToken: dndata.Pulseox.garminAccessToken,
						summaryId: dndata.Pulseox.summaryId,
						calendarDate: dndata.Pulseox.calendarDate,
						startTimeInSeconds: dndata.Pulseox.startTimeInSeconds,
						durationInSeconds: dndata.Pulseox.durationInSeconds,
						startTimeOffsetInSeconds: dndata.Pulseox.startTimeOffsetInSeconds,
						timeOffsetSpo2Values: dndata.Pulseox.timeOffsetSpo2Values,
						onDemand: dndata.Pulseox.onDemand,
						createdAt: dndata.Pulseox.createdAt,
						updatedAt: dndata.Pulseox.updatedAt
					}
				});
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Inserted a record in the IOT_GarminPulseoxModel teble.') : 0;
			} else {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- No record in the IOT_GarminPulseoxModel teble.') : 0;
			}

			// Sleeps
			if (dndata.Sleeps) {
				// ダウンロードしたデータをテーブルに追加
				await IOT_GarminSleepsModel.findOrCreate({
					where: {
						idIOT_GarminSleeps: dndata.Sleeps.idIOT_GarminSleeps
					},
					defaults: {
						idIOT_GarminSleeps: dndata.Sleeps.idIOT_GarminSleeps,
						garminId: dndata.Sleeps.garminId,
						garminAccessToken: dndata.Sleeps.garminAccessToken,
						summaryId: dndata.Sleeps.summaryId,
						calendarDate: dndata.Sleeps.calendarDate,
						startTimeInSeconds: dndata.Sleeps.startTimeInSeconds,
						startTimeOffsetInSeconds: dndata.Sleeps.startTimeOffsetInSeconds,
						durationInSeconds: dndata.Sleeps.durationInSeconds,
						unmeasurableSleepInSeconds: dndata.Sleeps.unmeasurableSleepInSeconds,
						deepSleepDurationInSeconds: dndata.Sleeps.deepSleepDurationInSeconds,
						lightSleepDurationInSeconds: dndata.Sleeps.lightSleepDurationInSeconds,
						remSleepInSeconds: dndata.Sleeps.remSleepInSeconds,
						awakeDurationInSeconds: dndata.Sleeps.awakeDurationInSeconds,
						sleepLevelsMap: dndata.Sleeps.sleepLevelsMap,
						validation: dndata.Sleeps.validation,
						timeOffsetSleepRespiration: dndata.Sleeps.timeOffsetSleepRespiration,
						timeOffsetSleepSpo2: dndata.Sleeps.timeOffsetSleepSpo2,
						timeOffsetSleepSpo2: dndata.Sleeps.timeOffsetSleepSpo2,
						overallSleepScore: dndata.Sleeps.overallSleepScore,
						createdAt: dndata.Sleeps.createdAt,
						updatedAt: dndata.Sleeps.updatedAt
					}
				});
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Inserted a record in the IOT_GarminSleepsModel teble.') : 0;
			} else {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- No record in the IOT_GarminSleepsModel teble.') : 0;
			}

			// StressDetails
			if (dndata.StressDetails) {
				// ダウンロードしたデータをテーブルに追加
				await IOT_GarminStressDetailsModel.findOrCreate({
					where: {
						idIOT_GarminStressDetails: dndata.StressDetails.idIOT_GarminStressDetails
					},
					defaults: {
						idIOT_GarminStressDetails: dndata.StressDetails.idIOT_GarminStressDetails,
						garminId: dndata.StressDetails.garminId,
						garminAccessToken: dndata.StressDetails.garminAccessToken,
						summaryId: dndata.StressDetails.summaryId,
						startTimeInSeconds: dndata.StressDetails.startTimeInSeconds,
						startTimeOffsetInSeconds: dndata.StressDetails.startTimeOffsetInSeconds,
						durationInSeconds: dndata.StressDetails.durationInSeconds,
						calendarDate: dndata.StressDetails.calendarDate,
						timeOffsetStressLevelValues: dndata.StressDetails.timeOffsetStressLevelValues,
						timeOffsetBodyBatteryValues: dndata.StressDetails.timeOffsetBodyBatteryValues,
						createdAt: dndata.StressDetails.createdAt,
						updatedAt: dndata.StressDetails.updatedAt
					}
				});
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Inserted a record in the IOT_GarminStressDetailsModel teble.') : 0;
			} else {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- No record in the IOT_GarminStressDetailsModel teble.') : 0;
			}

			// UserMetrics
			if (dndata.UserMetrics) {
				// ダウンロードしたデータをテーブルに追加
				await IOT_GarminUserMetricsModel.findOrCreate({
					where: {
						idIOT_GarminUserMetrics: dndata.UserMetrics.idIOT_GarminUserMetrics
					},
					defaults: {
						idIOT_GarminUserMetrics: dndata.UserMetrics.idIOT_GarminUserMetrics,
						garminId: dndata.UserMetrics.garminId,
						garminAccessToken: dndata.UserMetrics.garminAccessToken,
						summaryId: dndata.UserMetrics.summaryId,
						calendarDate: dndata.UserMetrics.calendarDate,
						vo2Max: dndata.UserMetrics.vo2Max,
						fitnessAge: dndata.UserMetrics.fitnessAge,
						createdAt: dndata.UserMetrics.createdAt,
						updatedAt: dndata.UserMetrics.updatedAt
					}
				});
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Inserted a record in the IOT_GarminUserMetrics teble.') : 0;
			} else {
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- No record in the IOT_GarminUserMetrics teble.') : 0;
			}

			// 画面表示
			if (dndata) {
				persist.garmin = dndata;
				sendIPCMessage("showGarmin", persist.garmin);
			}


		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALsync.garminDownload() ', error);
			let arg = {
				error: error.message
			};

			sendIPCMessage('Error', {
				datetime: new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"),
				moduleName: 'mainHALsync.garminDownload()',
				stackLog: `Detail: ${error}`
			});

			// mainWindow.webContents.send('to-renderer', JSON.stringify({ cmd: "Synced", arg: arg }));
		}
	},


	//----------------------------------------------------------------------------------------------
	/**
	 * @func httpGetRequest
	 * @desc httpGetRequest
	 * @async
	 * @param {string} url
	 * @param {string} token
	 * @return body - string promise
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
	 * @param {string} url
	 * @param {string} data
	 * @param {string} token
	 * @return body - string promise
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
	 * @param {string} _token
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
			sendIPCMessage('Error', {
				datetime: new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"),
				moduleName: 'mainHALsync.startUploadEldata()',
				stackLog: `Detail: ${error}`
			});
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
	},

	//----------------------------------------------------------------------------------------------
	/**
	 * @func ConfigSave
	 * @desc ConfigSave
	 * @throw error
	 */
	ConfigSave: function () {
		store.set('config.HAL', config);
	},

	/**
	 * @func setConfig
	 * @desc setConfig
	 * @async
	 * @param {Object} _config
	 * @throw error
	 */
	setConfig: async function (_config) {
		if (_config) {
			config = mergeDeeply(config, _config);
		}
		await store.set('config.HAL', config);
		sendIPCMessage("renewHALConfigView", config);
		sendIPCMessage("configSaved", 'HAL');  // 保存したので画面に通知
	},

	/**
	 * @func getConfig
	 * @desc 設定取得
	 * @async
	 * @return config
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * @func getPersist
	 * @desc 現在のデータを取得する
	 * @async
	 * @return persist
	 */
	getPersist: function () {
		return persist;
	},

	/**
	 * @func stop
	 * @desc 開放して連携終了、設定や現在の数値を永続化する
	 * @async
	 */
	stop: async function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALsync.stop()') : 0;

		if (mainHALsync.uploadEldataTask) {
			await mainHALsync.uploadEldataTask.stop();
			mainHALsync.uploadEldataTask = null;
		}
		await mainHAL.setConfig();
		await store.set('persist.HAL', persist);
	},


	//----------------------------------------------------------------------------------------------
	/**
	 * @func renewConfigView
	 * @desc renewConfigView
	 * @throw error
	 */
	renewConfigView: function () {
		sendIPCMessage("renewHALConfigView", config);  // 現在の設定値を表示
	}

};


module.exports = mainHALsync;
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
