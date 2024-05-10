//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2021.11.09
//////////////////////////////////////////////////////////////////////
/**
 * @module mainHALlocal
 */
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { sqlite3, eldataModel, IOT_QuestionnaireAnswersModel, IOT_MajorResultsModel, IOT_MinorResultsModel, IOT_MinorkeyMeansModel, MinorkeyMeansValues } from './models/localDBModels.cjs';   // DBデータと連携

import { Op } from "sequelize";

import Store from 'electron-store';
const store = new Store();

import { getToday, roundFloat } from './mainSubmodule.cjs';

//////////////////////////////////////////////////////////////////////
// config
let config = {  // デフォルト値
	enabled: false,
	halApiToken: '',
	startUploadEldata: 300000,
	resultExpireDays: 365,
	ellogExpireDays: 30,
	UPLOAD_UNIT_NUM: 100, 	// 分割アップロードのログの数
	UPLOAD_UNIT_INTERVAL: 1000, // 分割アップロードの間隔 (ミリ秒)
	UPLOAD_START_INTERVAL: 300000, // アップロード処理の起動間隔 (ミリ秒)
	debug: false // mainHALsyncのdebug
};


//////////////////////////////////////////////////////////////////////
let mainHALlocal = {

	/**
	 * @func initialize
	 * @desc HAL, Home-life Assessment Listの処理
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	initialize: async function () {
		config = await store.get('config.HAL', config);
	},


	//////////////////////////////////////////////////////////////////////
	/**
	 * @func submitQuestionnaire
	 * @desc アンケート回答したので処理
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	submitQuestionnaire: async function (arg, succeessFunc, errorFunc) {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALlocal.submitQuestionnaire()') : 0;
		// console.dir( arg );

		let today = getToday();

		// IOT_QuestionnaireAnswers テーブル用データ
		let q_data = {
			date: today
		};

		// IOT_MinorResults テーブル用データ
		let minor_data = {
			date: today
		};

		// アンケート回答の値をチェック
		try {
			for (let i = 1; i <= 6; i++) {
				for (let j = 1; j <= 15; j++) {
					let k = 'q_' + i + '_' + j;
					let v = arg[k];
					if (!v) {
						q_data[k] = null;
						minor_data['r_' + i + '_' + j] = null;
					} else if (/^\d+$/.test(v)) {
						v = parseInt(v, 10);
						if (v >= 0 || v <= 100) {
							q_data[k] = v;
							minor_data['r_' + i + '_' + j] = v;
						} else {
							throw new Error('回答の値が不正です: ' + k + '=' + v);
						}
					} else {
						throw new Error('回答の値が不正です: ' + k + '=' + v);
					}
				}
			}
		} catch (error) {
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| questionnaire_error', error.message);
			return;
		}
		// console.log( 'アンケート回答の値をチェック ok' );


		// MajorResults を計算
		let major_data = mainHALlocal.calcMajorResults(q_data);
		// console.log( 'mainHALlocal.calcMajorResults ok' );

		// SQL トランザクション開始
		let t = await sqlite3.transaction();
		// console.log( 'transaction started' );

		try {
			// IOT_QuestionnaireAnswers テーブルから該当ユーザーの今日のレコードを取得
			let record = await IOT_QuestionnaireAnswersModel.findOne({ where: { date: today } });

			if (record) {
				await record.update(q_data);	// レコードあればUpdate
			} else {
				await IOT_QuestionnaireAnswersModel.create(q_data);	// レコードなければinsert
			}
			// console.log('アンケート格納 ok');

			// IOT_MinorResults テーブルから該当ユーザーの今日のレコードを取得
			let minor = await IOT_MinorResultsModel.findOne({ where: { date: today } });

			let now = new Date();

			// console.log('today, now確認');
			// console.dir(today);
			// console.dir(now);

			if (minor) {
				// 今日の minorResults レコードが見つかれば、成績データを更新
				let minor_update_data = {};
				if (minor.dataValues.assessmentSource === 'PLIS') {
					// assessmentSource が "PLIS" なら null のカラムだけ更新
					for (let [k, v] of Object.entries(minor.dataValues)) {
						if (/^r_\d+_\d+$/.test(k) && v === null) {
							minor_update_data[k] = v;
						}
					}
				} else {
					// assessmentSource が "questionnaire" のとき，すべてのカラムを更新
					minor_update_data = minor_data;
				}

				// minorResults を UPDATE
				minor_update_data.updatedAt = now;
				await IOT_MinorResultsModel.update(minor_update_data, {
					where: {
						idIOT_MinorResults: minor.dataValues.idIOT_MinorResults
					}
				});

				// 該当ユーザーの今日の majorResults レコードを検索
				// MinorResults レコードがあれば、MajorResults のレコードもあるはず
				let major = await IOT_MajorResultsModel.findOne({ where: { date: today } });
				if (!major) {
					throw new Error('成績データ major/minor 不整合が見つかりました。');
				}

				let major_update_data = {};
				if (major.dataValues.assessmentSource === 'PLIS') {
					// assessmentSource が "PLIS" なら null のカラムだけ更新
					for (let [k, v] of Object.entries(major.dataValues)) {
						if (/^r_\d+_\d+$/.test(k) && v === null) {
							major_update_data[k] = v;
						}
					}
				} else {
					// assessmentSource が "questionnaire" なら、すべてのカラムを更新
					major_update_data = major_data;
				}

				// majorResults を UPDATE
				major_update_data.updatedAt = now;
				await IOT_MajorResultsModel.update(major_update_data, {
					where: {
						idIOT_MajorResults: major.dataValues.idIOT_MajorResults
					}
				});

			} else {
				// 該当ユーザーの今日の minorResults レコードが見つからなければ、新規に成績データを追加
				// minor_data.createdAt = now;
				// minor_data.updatedAt = now;
				minor_data.assessmentSource = 'questionnaire';
				await IOT_MinorResultsModel.create(minor_data);
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALlocal.submitQuestionnaire() IOT_MinorResultsModel格納') : 0;

				major_data.date = today;
				// major_data.createdAt = now;
				// major_data.updatedAt = now;
				major_data.assessmentSource = 'questionnaire';
				await IOT_MajorResultsModel.create(major_data);
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALlocal.submitQuestionnaire() IOT_MajorResultsModel格納') : 0;
			}

			// コミット
			await t.commit();
			// console.log('commited');

			succeessFunc();
		} catch (error) {
			// ロールバック
			await t.rollback();
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALlocal.submitQuestionnaire() rollbacked') : 0;
			console.error(error);

			// HTTP レスポンス
			errorFunc();
		}
	},

	/**
	 * @func calcMajorResults
	 * @desc アンケート回答から Major 成績データを計算する
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	calcMajorResults: function (q_data) {
		// console.log( '-- calcMajorResults()' );
		// console.dir( q_data );
		let clothing_sum = 0;
		let clothing_num = 0;
		let food_sum = 0;
		let food_num = 0;
		let housing_sum = 0;
		let housing_num = 0;
		let physical_sum = 0;
		let physical_num = 0;
		let mental_sum = 0;
		let mental_num = 0;
		let ecology_sum = 0;
		let ecology_num = 0;

		for (let [k, v] of Object.entries(q_data)) {
			if (v === null) {
				continue;
			}
			if (k.startsWith('q_1_')) {
				clothing_sum += v;
				clothing_num++;
			} else if (k.startsWith('q_2_')) {
				food_sum += v;
				food_num++;
			} else if (k.startsWith('q_3_')) {
				housing_sum += v;
				housing_num++;
			} else if (k.startsWith('q_4_')) {
				physical_sum += v;
				physical_num++;
			} else if (k.startsWith('q_5_')) {
				mental_sum += v;
				mental_num++;
			} else if (k.startsWith('q_6_')) {
				ecology_sum += v;
				ecology_num++;
			}
		}

		// 平均値を求める
		let clothing_point = clothing_sum / clothing_num;
		let food_point = food_sum / food_num;
		let housing_point = housing_sum / housing_num;
		let physical_point = physical_sum / physical_num;
		let mental_point = mental_sum / mental_num;
		let ecology_point = ecology_sum / ecology_num;

		// totalPoint は平均値の和
		let total_point = (clothing_point + food_point + housing_point + physical_point + mental_point + ecology_point) / 6;

		// totalRank の特定
		let total_rank = '';

		if (total_point >= 90) {
			total_rank = 'SSS';
		} else if (total_point >= 80) {
			total_rank = 'SS';
		} else if (total_point >= 70) {
			total_rank = 'S';
		} else if (total_point >= 60) {
			total_rank = 'A';
		} else if (total_point >= 50) {
			total_rank = 'B';
		} else if (total_point >= 40) {
			total_rank = 'C';
		} else if (total_point >= 30) {
			total_rank = 'D';
		} else if (total_point >= 20) {
			total_rank = 'E';
		} else {
			total_rank = 'F';
		}

		let data = {
			clothingPoint: roundFloat(clothing_point),
			clothingRawScore: roundFloat(clothing_point * 5),
			foodPoint: roundFloat(food_point),
			foodRawScore: roundFloat(food_point * 5),
			housingPoint: roundFloat(housing_point),
			housingRawScore: roundFloat(housing_point * 5),
			physicalHealthPoint: roundFloat(physical_point),
			physicalHealthRawScore: roundFloat(physical_point * 5),
			mentalHealthPoint: roundFloat(mental_point),
			mentalHealthRawScore: roundFloat(mental_point * 5),
			ecologyPoint: roundFloat(ecology_point),
			ecologyRawScore: roundFloat(ecology_point * 5),
			totalPoint: roundFloat(total_point),
			totalRank: total_rank
		};

		return data;
	},


	/**
	 * @func getLastData
	 * @desc HALの最新データを取得
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	getLastData: async function () {
		let halData = {};
		let MajorResults = {};
		let MinorResults = {};
		let MinorkeyMeans = [];

		// ローカルの MajorResults から最新のレコードを取得
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALlocal.getLastData() Getting the latest record in the local MajorResults table.') : 0;
		MajorResults = await IOT_MajorResultsModel.findOne({
			order: [['date', 'DESC']]
		});
		if (MajorResults) {
			halData.majorResults = MajorResults.dataValues;
			// console.log(JSON.stringify(MajorResults.dataValues, null, '  '));
		} else {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALlocal.getLastData() local MajorResults table is empty.') : 0;
		}

		// ローカルの MinorResults から最新のレコードを取得
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALlocal.getLastData() Getting the latest record in the local MinorResults table.') : 0;
		MinorResults = await IOT_MinorResultsModel.findOne({
			order: [['date', 'DESC']]
		});
		if (MinorResults) {
			halData.minorResults = MinorResults.dataValues;
			// console.log(JSON.stringify(MinorResults.dataValues, null, '  '));
		} else {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALlocal.getLastData() local MinorResults table is empty.') : 0;
		}

		// ローカルの MinorkeyMeans から最新のレコードを取得
		await IOT_MinorkeyMeansModel.findAll({
			where: { version: '1' }
		}).then(function (data) {
			// console.dir( data.length );
			if (data && data.length != 0) { // データはあって，空ではないなら
				// データあり
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALlocal.getLastData() MinorkeyMeans data is found.') : 0;
				data.forEach((d) => {
					// console.log(d);
					MinorkeyMeans.push(d.dataValues);
				});
			} else {
				// データなし
				config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALlocal.getLastData() MinorkeyMeans data is NOT found.') : 0;
				IOT_MinorkeyMeansModel.bulkCreate(MinorkeyMeansValues);
			}
		}).catch(function (err) {
			// DBエラーした
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALlocal.getLastData() IOT_MinorkeyMeans occurs error.', err);
		});

		halData.minorkeyMeans = MinorkeyMeans;

		return { MajorResults, MinorResults, MinorkeyMeans };
	},


	/**
	 * @func truncatelogs
	 * @desc SQLite のデータベースのレコードの削除処理
	 * データがたまりすぎるので古いものを定期的に消す
	 * @async
	 * @param {void}
	 * @return void
	 * @throw error
	 */
	truncatelogs: async function () {

		// eldata テーブルのレコード削除
		let eldata_del_count = await eldataModel.destroy({
			where: {
				createdAt: {
					[Op.lt]: new Date(Date.now() - 86400000 * config.ellogExpireDays)
				}
			}
		});

		// IOT_MajorResults テーブルのレコード削除
		let major_del_count = await IOT_MajorResultsModel.destroy({
			where: {
				createdAt: {
					[Op.lt]: new Date(Date.now() - 86400000 * config.resultExpireDays)
				}
			}
		});

		// IOT_MinorResults テーブルのレコード削除
		let minor_del_count = await IOT_MinorResultsModel.destroy({
			where: {
				createdAt: {
					[Op.lt]: new Date(Date.now() - 86400000 * config.resultExpireDays)
				}
			}
		});

		// IOT_QuestionnaireAnswersModel テーブルのレコード削除
		let questionnaire_del_count = await IOT_QuestionnaireAnswersModel.destroy({
			where: {
				createdAt: {
					[Op.lt]: new Date(Date.now() - 86400000 * config.resultExpireDays)
				}
			}
		});

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainHALlocal.truncatelogs()') : 0;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Deleted ' + eldata_del_count + ' records from the `eldata` table.') : 0;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Deleted ' + major_del_count + ' records from the `IOT_MajorResults` table.') : 0;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Deleted ' + minor_del_count + ' records from the `IOT_MinorResults` table.') : 0;
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|- Deleted ' + questionnaire_del_count + ' records from the `IOT_QuestionnaireAnswersModel` table.') : 0;
	}

};

// module.exports = mainHALlocal;
export {mainHALlocal};
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
