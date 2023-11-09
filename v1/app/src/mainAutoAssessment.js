//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2023.10.09
//////////////////////////////////////////////////////////////////////
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const cron = require('node-cron');
require("date-utils");

const { sqlite3, Op, IOT_MajorResultsModel, IOT_MinorResultsModel, IOT_QuestionnaireAnswersModel } = require('./models/localDBModels');   // DB models

const { getToday, getYesterday, roundFloat, checkValue } = require('./mainSubmodule');


//////////////////////////////////////////////////////////////////////
// config

let config = {
	debug: false
}

const minorSchema = {
	date: "",
	assessmentSource: "HAL",
	r_1_1: null,
	r_1_2: null,
	r_1_3: null,
	r_1_4: null,
	r_1_5: null,
	r_1_6: null,
	r_1_7: null,
	r_1_8: null,
	r_1_9: null,
	r_1_10: null,
	r_1_11: null,
	r_1_12: null,
	r_1_13: null,
	r_1_14: null,
	r_1_15: null,
	r_2_1: null,
	r_2_2: null,
	r_2_3: null,
	r_2_4: null,
	r_2_5: null,
	r_2_6: null,
	r_2_7: null,
	r_2_8: null,
	r_2_9: null,
	r_2_10: null,
	r_2_11: null,
	r_2_12: null,
	r_2_13: null,
	r_2_14: null,
	r_2_15: null,
	r_3_1: null,
	r_3_2: null,
	r_3_3: null,
	r_3_4: null,
	r_3_5: null,
	r_3_6: null,
	r_3_7: null,
	r_3_8: null,
	r_3_9: null,
	r_3_10: null,
	r_3_11: null,
	r_3_12: null,
	r_3_13: null,
	r_3_14: null,
	r_3_15: null,
	r_4_1: null,
	r_4_2: null,
	r_4_3: null,
	r_4_4: null,
	r_4_5: null,
	r_4_6: null,
	r_4_7: null,
	r_4_8: null,
	r_4_9: null,
	r_4_10: null,
	r_4_11: null,
	r_4_12: null,
	r_4_13: null,
	r_4_14: null,
	r_4_15: null,
	r_5_1: null,
	r_5_2: null,
	r_5_3: null,
	r_5_4: null,
	r_5_5: null,
	r_5_6: null,
	r_5_7: null,
	r_5_8: null,
	r_5_9: null,
	r_5_10: null,
	r_5_11: null,
	r_5_12: null,
	r_5_13: null,
	r_5_14: null,
	r_5_15: null,
	r_6_1: null,
	r_6_2: null,
	r_6_3: null,
	r_6_4: null,
	r_6_5: null,
	r_6_6: null,
	r_6_7: null,
	r_6_8: null,
	r_6_9: null,
	r_6_10: null,
	r_6_11: null,
	r_6_12: null,
	r_6_13: null,
	r_6_14: null,
	r_6_15: null
};

const majorSchema = {
	date: "",
	assessmentSource: "HAL",
	smartLifeIndex: 3,
	totalPoint: 0,
	totalRank: 0,
	clothingPoint: 0,
	clothingRawScore: 0,
	foodPoint: 0,
	foodRawScore: 0,
	housingPoint: 0,
	housingRawScore: 0,
	physicalHealthPoint: 0,
	physicalHealthRawScore: 0,
	mentalHealthPoint: 0,
	mentalHealthRawScore: 0,
	ecologyPoint: 0,
	ecologyRawScore: 0,
	comments: "やったね！"
};

let sendIPCMessage = null;


//////////////////////////////////////////////////////////////////////
// モジュール

let mainAutoAssessment = {
	isRun: false,  // 機能が利用可能になったか？
	observationJob: null,

	// 以前のMinorResultsからMinorResults（1日経過処理）
	lastMR2mr: async function (mrRow, mr) {

		await Object.keys(mr).forEach(async function (key) {
			// await console.log( `mr[${key}] == ${mr[key]}  <==  mrRow[${key}] == ${mrRow[key]}` );
			if (mr[key] == null) {
				mr[key] = mrRow[key] - 1;
			}
		});

		return mr;
	},


	// MinorResultsから MajorResultsを計算する
	calcMajorResults: function (mr) {
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
		let comments = "";

		for (let [k, v] of Object.entries(mr)) {
			if (v === null) {
				continue;
			}
			if (k.startsWith('r_1_')) {
				clothing_sum += v;
				clothing_num++;
			} else if (k.startsWith('r_2_')) {
				food_sum += v;
				food_num++;
			} else if (k.startsWith('r_3_')) {
				housing_sum += v;
				housing_num++;
			} else if (k.startsWith('r_4_')) {
				physical_sum += v;
				physical_num++;
			} else if (k.startsWith('r_5_')) {
				mental_sum += v;
				mental_num++;
			} else if (k.startsWith('r_6_')) {
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
			comments = '最高です！';
		} else if (total_point >= 80) {
			total_rank = 'SS';
			comments = 'いい調子だね！';
		} else if (total_point >= 70) {
			total_rank = 'S';
			comments = '頑張りました～';
		} else if (total_point >= 60) {
			total_rank = 'A';
			comments = 'なかなかぐっどだよ';
		} else if (total_point >= 50) {
			total_rank = 'B';
			comments = 'けっこうすごいじゃん';
		} else if (total_point >= 40) {
			total_rank = 'C';
			comments = '普通くらいには頑張れてるね';
		} else if (total_point >= 30) {
			total_rank = 'D';
			comments = 'がんばれそう';
		} else if (total_point >= 20) {
			total_rank = 'E';
			comments = '改善点を探したいね';
		} else {
			total_rank = 'F';
			comments = 'しょっく';
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
			totalRank: total_rank,
			comments: comments
		};

		return data;
	},


	// 評価シーケンス全体、なんかawaitが効いてないかんじ
	assessment: async function (today, yesterday) {
		console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainAutoAssessment - today:', today, ' yesterday:', yesterday);

		let now = new Date();

		// DB トランザクション開始
		let t = await sqlite3.transaction();

		try {
			// 初期化
			let minorResults = await Object.assign({}, minorSchema);
			let majorResults = await Object.assign({}, majorSchema);

			////////////////////////////////////////////////////////////////////////////////////////
			// MinorResults
			// await console.log( '-- MinorResults' );

			//--------------------------------------------------------
			// アンケートデータでまずは点数をつける
			// await console.log('questionnaire');
			// SELECT * FROM halexp.IOT_QuestionnaireAnswersModel
			// where UID="U517290377a4861b16cc91c2d111f116d" and createdAt like "2022-05-11%" order by createdAt desc;
			let qaRow = await IOT_QuestionnaireAnswersModel.findOne({
				where: { createdAt: { [Op.like]: yesterday + "%" } },
				order: [["createdAt", "desc"]]
			});
			if (qaRow) { // アンケートがあれば
				minorResults = await mainAutoAssessment.qa2mr(qaRow, minorResults);
				// console.log( 'There is questionnaire.' );
			}
			// console.dir( minorResults );


			//--------------------------------------------------------
			// IoTデータで点数をつける
			// await console.log('IoT');




			//--------------------------------------------------------
			// nullの場所だけ、前日以前の得点を利用する。各得点は-1することで放置していると0点になる
			// await console.log('latest MinorResults');
			// SELECT * FROM halexp.IOT_MinorResults
			// where UID="U517290377a4861b16cc91c2d111f116d" order by date desc;
			let mrRow = await IOT_MinorResultsModel.findOne({
				order: [["date", "desc"]]
			});
			if (mrRow) { // 以前のMinorResultsがあれば
				minorResults = await mainAutoAssessment.lastMR2mr(mrRow, minorResults);
				// console.log( 'There is latest MinorResults.' );
			}

			// それでも残るnullは0点
			// await console.log('Null fix');
			await Object.keys(minorResults).forEach(function (key) {
				if (minorResults[key] == undefined || minorResults[key] == null) {
					minorResults[key] = 0;
				}
			});

			// 最終的な値のチェック、min = 0, max = 100
			// await console.log('checkValues');
			await Object.keys(minorResults).forEach(function (key) {
				minorResults[key] = checkValue(minorResults[key], 0, 100);
			});
			// console.dir( minorResults );


			////////////////////////////////////////////////////////////////////////////////////////
			// 完成した成績表の登録
			// IOT_MinorResults テーブルから該当ユーザーの今日のレコードを取得
			let minorToday = await IOT_MinorResultsModel.findOne({
				where: {
					date: today
				}
			});

			// 該当ユーザーの今日の minorResults レコードが見つかればUpdate、なければCreate
			if (minorToday) {
				// minorResults を UPDATE
				minorResults.updatedAt = now;
				minorResults.date = today;
				// console.log('Update IOT_MinorResultsModel', minorResults);
				await IOT_MinorResultsModel.update(minorResults, {
					where: {
						idIOT_MinorResults: minorToday.dataValues.idIOT_MinorResults
					}
				});
			} else {
				// minorResultsをCreate
				minorResults.createdAt = now;
				minorResults.updatedAt = now;
				minorResults.assessmentSource = 'HEMS-Logger';
				minorResults.date = today;
				// console.log('Create IOT_MinorResultsModel:', minorResults);
				await IOT_MinorResultsModel.create(minorResults);
			}


			//--------------------------------------------------------------------------------------
			// MajorResults
			// await console.log( '-- MajorResults' );
			majorResults = mainAutoAssessment.calcMajorResults(minorResults);  // minorからmajorを計算

			// IOT_MajorResults テーブルから該当ユーザーの今日のレコードを取得
			let majorToday = await IOT_MajorResultsModel.findOne({
				where: {
					date: today
				}
			});

			// 該当ユーザーの今日の majorResults レコードが見つかればUpdate、なければCreate
			if (majorToday) {
				// majorResults を UPDATE
				majorResults.updatedAt = now;
				majorResults.date = today;
				// console.log('Update IOT_MajorResultsModel', majorResults);
				await IOT_MajorResultsModel.update(majorResults, {
					where: {
						idIOT_MajorResults: majorToday.dataValues.idIOT_MajorResults
					}
				});
			} else {
				// majorResultsをCreate
				majorResults.createdAt = now;
				majorResults.updatedAt = now;
				majorResults.date = today;
				majorResults.assessmentSource = 'HAL';
				// console.log('Create IOT_MajorResultsModel:', majorResults);
				await IOT_MajorResultsModel.create(majorResults);
			}

			// コミット
			await t.commit();
			// console.log('commit');
		} catch (error) {
			// ロールバック
			await t.rollback();
			// console.log('rollback');
			console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '|', error);
		}

	},


	//////////////////////////////////////////////////////////////////////
	// 自動評価システムの開始処理（定時実行、EntryPoint）
	start: function (_sendIPCMessage) {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainAutoAssessment.start()') : 0;

		if (mainAutoAssessment.isRun) {
			return; // 多重起動防止
		}
		mainAutoAssessment.isRun = true;
		sendIPCMessage = _sendIPCMessage;

		mainAutoAssessment.observationJob = cron.schedule('0 0 9 * * *', () => {  // 本番用の AM9:00
			// mainAutoAssessment.observationJob = cron.schedule('*/10 * * * * *', () => {  // debug用の0秒毎
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainAutoAssessment.start().observationJob') : 0;

			let today = getToday();
			let yesterday = getYesterday();

			mainAutoAssessment.assessment(today, yesterday);
		});

		mainAutoAssessment.observationJob.start();
	},

	stop: async function () {
		await mainAutoAssessment.observationJob.stop();
		mainAutoAssessment.observationJob = null;
		mainAutoAssessment.isRun = false;
	}
};


//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
module.exports = mainAutoAssessment;
