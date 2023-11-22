//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.08.28
//  Last updated: 2021.09.24
//////////////////////////////////////////////////////////////////////
// Require all the stuff
const { Sequelize, Op } = require('sequelize');
const env = process.env.NODE_ENV || "development";

const path = require('path');

const appname = 'PLIS';
const userHome = process.env[process.platform == "win32" ? "USERPROFILE" : "HOME"];
const configDir = path.join(userHome, appname);

// Setup sequelize db connection
const sqlite3 = new Sequelize(
	'database', '', '', {
	"dialect": "sqlite",
	"storage": path.join(configDir, "lifelog.db"),
	"logging": false
});

// freezeTableNameはモデルに渡した名前を実テーブルにマッピングする際に複数形に変換してしまうのを抑制する
// timestamps: falseを入れておかないと，createdAt, updatedAtが勝手に追加されるみたい

//////////////////////////////////////////////////////////////////////
// eldata
const eldataModel = sqlite3.define('eldata', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	srcip: {
		type: Sequelize.STRING
	},
	srcmac: {
		type: Sequelize.STRING
	},
	seoj: {
		type: Sequelize.STRING
	},
	deoj: {
		type: Sequelize.STRING
	},
	esv: {
		type: Sequelize.STRING
	},
	epc: {
		type: Sequelize.STRING
	},
	edt: {
		type: Sequelize.STRING
	}
}, {
	freezeTableName: true,
	timestamps: true
});


//////////////////////////////////////////////////////////////////////
// elraw
const elrawModel = sqlite3.define('elraw', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	srcip: {
		type: Sequelize.STRING
	},
	srcmac: {
		type: Sequelize.STRING
	},
	dstip: {
		type: Sequelize.STRING
	},
	dstmac: {
		type: Sequelize.STRING
	},
	rawdata: {
		type: Sequelize.STRING
	},
	seoj: {
		type: Sequelize.STRING
	},
	deoj: {
		type: Sequelize.STRING
	},
	esv: {
		type: Sequelize.STRING
	},
	opc: {
		type: Sequelize.STRING
	},
	detail: {
		type: Sequelize.STRING
	}
}, {
	freezeTableName: true,
	timestamps: true
});



//////////////////////////////////////////////////////////////////////
// esm data (電力スマートメータ 解析後データ)
const esmdataModel = sqlite3.define('esmdata', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	srcip: {
		type: Sequelize.STRING
	},
	seoj: {
		type: Sequelize.STRING
	},
	deoj: {
		type: Sequelize.STRING
	},
	esv: {
		type: Sequelize.STRING
	},
	epc: {
		type: Sequelize.STRING
	},
	edt: {
		type: Sequelize.STRING
	}
}, {
	freezeTableName: true,
	timestamps: true
});


//////////////////////////////////////////////////////////////////////
// esm raw (電力スマートメータ 通信生データ)
const esmrawModel = sqlite3.define('esmraw', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	srcip: {
		type: Sequelize.STRING
	},
	rawdata: {
		type: Sequelize.STRING
	},
	seoj: {
		type: Sequelize.STRING
	},
	deoj: {
		type: Sequelize.STRING
	},
	esv: {
		type: Sequelize.STRING
	},
	opc: {
		type: Sequelize.STRING
	},
	detail: {
		type: Sequelize.STRING
	}
}, {
	freezeTableName: true,
	timestamps: true
});

//////////////////////////////////////////////////////////////////////
// Electric Energy
// 基本はスマートメータのデータ、他にはスマート分電盤や他のIoT機器による分電盤計測値等
const electricEnergyModel = sqlite3.define('ElectricEnergy', {
	id: {
		type: Sequelize.BIGINT,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	dateTime: {
		type: Sequelize.DATE,
		allowNull: false
	},
	srcType: {  // Meter, DistributionBoard, Sensor, and so on.
		type: Sequelize.STRING(32),
		allowNull: false
	},
	place: {
		type: Sequelize.STRING(128),
		allowNull: false
	},
	commulativeAmountNormal: {  // EL ESM:e0, 積算電力量（正）
		type: Sequelize.DOUBLE
	},
	commulativeAmountReverse: {  // EL ESM:e3, 積算電力量計測値（逆）
		type: Sequelize.DOUBLE
	},
	instantaneousPower: {  // EL ESM:e7, 瞬時電力計測値
		type: Sequelize.FLOAT
	},
	instantaneousCurrentsR: {  // EL ESM:e8, 瞬時電流計測値, R相
		type: Sequelize.INTEGER
	},
	instantaneousCurrentsT: {  // EL ESM:e8, 瞬時電流計測値, T相
		type: Sequelize.INTEGER
	},
	commulativeAmountsFixedTimeNormalDaytime: {  // EL ESM:ea, 定時積算電力量計測値（正）, 計測日時
		type: 'TIMESTAMP',
	},
	commulativeAmountsFixedTimeNormalPower: {  // EL ESM:ea, 定時積算電力量計測値（正）, 電力量
		type: Sequelize.INTEGER
	},
	commulativeAmountsFixedTimeReverseDaytime: {  // EL ESM:eb, 定時積算電力量計測値（逆）
		type: 'TIMESTAMP',
	},
	commulativeAmountsFixedTimeRiversePower: {  // EL ESM:eb, 定時積算電力量計測値（逆）, 電力量
		type: Sequelize.INTEGER
	},
	createdAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	},
	updatedAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	}
}, {
	freezeTableName: true,
	timestamps: true
});



//////////////////////////////////////////////////////////////////////
// hueraw
const huerawModel = sqlite3.define('huerawModel', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	rawdata: {
		type: Sequelize.STRING
	}
}, {
	freezeTableName: true,
	timestamps: true
});



//////////////////////////////////////////////////////////////////////
// arpTable
const arpModel = sqlite3.define('arpTable', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	detail: {
		type: Sequelize.STRING
	}
}, {
	freezeTableName: true,
	timestamps: true
});

//////////////////////////////////////////////////////////////////////
// open weather map
const owmModel = sqlite3.define('owmTable', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	detail: {
		type: Sequelize.STRING
	}
}, {
	freezeTableName: true,
	timestamps: true
});


//////////////////////////////////////////////////////////////////////
// netatmo
const netatmoModel = sqlite3.define('netatmoTable', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	detail: {
		type: Sequelize.STRING
	}
}, {
	freezeTableName: true,
	timestamps: true
});


//////////////////////////////////////////////////////////////////////
// switchBot
const switchBotRawModel = sqlite3.define('switchBotRawTable', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	detail: {
		type: Sequelize.TEXT('medium')
	},
	createdAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	},
	updatedAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	}
}, {
	freezeTableName: true,
	timestamps: true
});

const switchBotDataModel = sqlite3.define('switchBotDataTable', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	deviceId: {
		type: Sequelize.TEXT('tiny'),
		allowNull: false
	},
	deviceType: {
		type: Sequelize.TEXT('tiny'),
		allowNull: false
	},
	deviceName: {
		type: Sequelize.TEXT('tiny')
	},
	property: {
		type: Sequelize.TEXT('tiny')
	},
	value: {
		type: Sequelize.TEXT('tiny')
	},
	createdAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	},
	updatedAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	}
}, {
	freezeTableName: true,
	timestamps: true
});



//////////////////////////////////////////////////////////////////////
// IOT_QuestionnaireAnswersModel
const IOT_QuestionnaireAnswersModel = sqlite3.define('IOT_QuestionnaireAnswers', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	createdAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	},
	updatedAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	},
	date: {
		type: Sequelize.DATEONLY,
		unique: true,
		allowNull: false
	},
	q_1_1: {
		type: Sequelize.INTEGER
	},
	q_1_2: {
		type: Sequelize.INTEGER
	},
	q_1_3: {
		type: Sequelize.INTEGER
	},
	q_1_4: {
		type: Sequelize.INTEGER
	},
	q_1_5: {
		type: Sequelize.INTEGER
	},
	q_1_6: {
		type: Sequelize.INTEGER
	},
	q_1_7: {
		type: Sequelize.INTEGER
	},
	q_1_8: {
		type: Sequelize.INTEGER
	},
	q_1_9: {
		type: Sequelize.INTEGER
	},
	q_1_10: {
		type: Sequelize.INTEGER
	},
	q_1_11: {
		type: Sequelize.INTEGER
	},
	q_1_12: {
		type: Sequelize.INTEGER
	},
	q_1_15: {
		type: Sequelize.INTEGER
	},
	q_2_1: {
		type: Sequelize.INTEGER
	},
	q_2_2: {
		type: Sequelize.INTEGER
	},
	q_2_3: {
		type: Sequelize.INTEGER
	},
	q_2_4: {
		type: Sequelize.INTEGER
	},
	q_2_5: {
		type: Sequelize.INTEGER
	},
	q_2_6: {
		type: Sequelize.INTEGER
	},
	q_2_7: {
		type: Sequelize.INTEGER
	},
	q_2_8: {
		type: Sequelize.INTEGER
	},
	q_2_9: {
		type: Sequelize.INTEGER
	},
	q_2_10: {
		type: Sequelize.INTEGER
	},
	q_2_11: {
		type: Sequelize.INTEGER
	},
	q_2_12: {
		type: Sequelize.INTEGER
	},
	q_2_15: {
		type: Sequelize.INTEGER
	},
	q_3_1: {
		type: Sequelize.INTEGER
	},
	q_3_2: {
		type: Sequelize.INTEGER
	},
	q_3_3: {
		type: Sequelize.INTEGER
	},
	q_3_4: {
		type: Sequelize.INTEGER
	},
	q_3_5: {
		type: Sequelize.INTEGER
	},
	q_3_6: {
		type: Sequelize.INTEGER
	},
	q_3_7: {
		type: Sequelize.INTEGER
	},
	q_3_8: {
		type: Sequelize.INTEGER
	},
	q_3_9: {
		type: Sequelize.INTEGER
	},
	q_3_10: {
		type: Sequelize.INTEGER
	},
	q_3_11: {
		type: Sequelize.INTEGER
	},
	q_3_12: {
		type: Sequelize.INTEGER
	},
	q_3_15: {
		type: Sequelize.INTEGER
	},
	q_4_1: {
		type: Sequelize.INTEGER
	},
	q_4_2: {
		type: Sequelize.INTEGER
	},
	q_4_3: {
		type: Sequelize.INTEGER
	},
	q_4_4: {
		type: Sequelize.INTEGER
	},
	q_4_5: {
		type: Sequelize.INTEGER
	},
	q_4_6: {
		type: Sequelize.INTEGER
	},
	q_4_7: {
		type: Sequelize.INTEGER
	},
	q_4_8: {
		type: Sequelize.INTEGER
	},
	q_4_9: {
		type: Sequelize.INTEGER
	},
	q_4_10: {
		type: Sequelize.INTEGER
	},
	q_4_11: {
		type: Sequelize.INTEGER
	},
	q_4_12: {
		type: Sequelize.INTEGER
	},
	q_4_15: {
		type: Sequelize.INTEGER
	},
	q_5_1: {
		type: Sequelize.INTEGER
	},
	q_5_2: {
		type: Sequelize.INTEGER
	},
	q_5_3: {
		type: Sequelize.INTEGER
	},
	q_5_4: {
		type: Sequelize.INTEGER
	},
	q_5_5: {
		type: Sequelize.INTEGER
	},
	q_5_6: {
		type: Sequelize.INTEGER
	},
	q_5_7: {
		type: Sequelize.INTEGER
	},
	q_5_8: {
		type: Sequelize.INTEGER
	},
	q_5_9: {
		type: Sequelize.INTEGER
	},
	q_5_10: {
		type: Sequelize.INTEGER
	},
	q_5_11: {
		type: Sequelize.INTEGER
	},
	q_5_12: {
		type: Sequelize.INTEGER
	},
	q_5_15: {
		type: Sequelize.INTEGER
	},
	q_6_1: {
		type: Sequelize.INTEGER
	},
	q_6_2: {
		type: Sequelize.INTEGER
	},
	q_6_3: {
		type: Sequelize.INTEGER
	},
	q_6_4: {
		type: Sequelize.INTEGER
	},
	q_6_5: {
		type: Sequelize.INTEGER
	},
	q_6_6: {
		type: Sequelize.INTEGER
	},
	q_6_7: {
		type: Sequelize.INTEGER
	},
	q_6_8: {
		type: Sequelize.INTEGER
	},
	q_6_9: {
		type: Sequelize.INTEGER
	},
	q_6_10: {
		type: Sequelize.INTEGER
	},
	q_6_11: {
		type: Sequelize.INTEGER
	},
	q_6_12: {
		type: Sequelize.INTEGER
	},
	q_6_15: {
		type: Sequelize.INTEGER
	}
}, {
	freezeTableName: true,
	timestamps: true
});


//////////////////////////////////////////////////////////////////////
// IOT_MajorResultsModel
const IOT_MajorResultsModel = sqlite3.define('IOT_MajorResults', {
	idIOT_MajorResults: {
		type: Sequelize.BIGINT,
		autoIncrement: true,
		primaryKey: true
	},
	createdAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	},
	updatedAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	},
	date: {
		type: Sequelize.DATEONLY,
		unique: true,
		allowNull: false
	},
	assessmentSource: {
		type: Sequelize.STRING(16)
	},
	smartLifeIndex: {
		type: Sequelize.DOUBLE
	},
	totalPoint: {
		type: Sequelize.DOUBLE
	},
	totalRank: {
		type: Sequelize.STRING(10)
	},
	clothingPoint: {
		type: Sequelize.DOUBLE
	},
	clothingRawScore: {
		type: Sequelize.DOUBLE
	},
	foodPoint: {
		type: Sequelize.DOUBLE
	},
	foodRawScore: {
		type: Sequelize.DOUBLE
	},
	housingPoint: {
		type: Sequelize.DOUBLE
	},
	housingRawScore: {
		type: Sequelize.DOUBLE
	},
	physicalHealthPoint: {
		type: Sequelize.DOUBLE
	},
	physicalHealthRawScore: {
		type: Sequelize.DOUBLE
	},
	mentalHealthPoint: {
		type: Sequelize.DOUBLE
	},
	mentalHealthRawScore: {
		type: Sequelize.DOUBLE
	},
	ecologyPoint: {
		type: Sequelize.DOUBLE
	},
	ecologyRawScore: {
		type: Sequelize.DOUBLE
	},
	comments: {
		type: Sequelize.TEXT,
	}
}, {
	freezeTableName: true,
	timestamps: true
});


//////////////////////////////////////////////////////////////////////
// IOT_MinorResultsModel
const IOT_MinorResultsModel = sqlite3.define('IOT_MinorResults', {
	idIOT_MinorResults: {
		type: Sequelize.BIGINT,
		autoIncrement: true,
		primaryKey: true
	},
	createdAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	},
	updatedAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	},
	date: {
		type: Sequelize.DATEONLY,
		unique: true,
		allowNull: false
	},
	assessmentSource: {
		type: Sequelize.STRING(16)
	},
	r_1_1: {
		type: Sequelize.INTEGER
	},
	r_1_2: {
		type: Sequelize.INTEGER
	},
	r_1_3: {
		type: Sequelize.INTEGER
	},
	r_1_4: {
		type: Sequelize.INTEGER
	},
	r_1_5: {
		type: Sequelize.INTEGER
	},
	r_1_6: {
		type: Sequelize.INTEGER
	},
	r_1_7: {
		type: Sequelize.INTEGER
	},
	r_1_8: {
		type: Sequelize.INTEGER
	},
	r_1_9: {
		type: Sequelize.INTEGER
	},
	r_1_10: {
		type: Sequelize.INTEGER
	},
	r_1_11: {
		type: Sequelize.INTEGER
	},
	r_1_12: {
		type: Sequelize.INTEGER
	},
	r_1_15: {
		type: Sequelize.INTEGER
	},
	r_2_1: {
		type: Sequelize.INTEGER
	},
	r_2_2: {
		type: Sequelize.INTEGER
	},
	r_2_3: {
		type: Sequelize.INTEGER
	},
	r_2_4: {
		type: Sequelize.INTEGER
	},
	r_2_5: {
		type: Sequelize.INTEGER
	},
	r_2_6: {
		type: Sequelize.INTEGER
	},
	r_2_7: {
		type: Sequelize.INTEGER
	},
	r_2_8: {
		type: Sequelize.INTEGER
	},
	r_2_9: {
		type: Sequelize.INTEGER
	},
	r_2_10: {
		type: Sequelize.INTEGER
	},
	r_2_11: {
		type: Sequelize.INTEGER
	},
	r_2_12: {
		type: Sequelize.INTEGER
	},
	r_2_15: {
		type: Sequelize.INTEGER
	},
	r_3_1: {
		type: Sequelize.INTEGER
	},
	r_3_2: {
		type: Sequelize.INTEGER
	},
	r_3_3: {
		type: Sequelize.INTEGER
	},
	r_3_4: {
		type: Sequelize.INTEGER
	},
	r_3_5: {
		type: Sequelize.INTEGER
	},
	r_3_6: {
		type: Sequelize.INTEGER
	},
	r_3_7: {
		type: Sequelize.INTEGER
	},
	r_3_8: {
		type: Sequelize.INTEGER
	},
	r_3_9: {
		type: Sequelize.INTEGER
	},
	r_3_10: {
		type: Sequelize.INTEGER
	},
	r_3_11: {
		type: Sequelize.INTEGER
	},
	r_3_12: {
		type: Sequelize.INTEGER
	},
	r_3_15: {
		type: Sequelize.INTEGER
	},
	r_4_1: {
		type: Sequelize.INTEGER
	},
	r_4_2: {
		type: Sequelize.INTEGER
	},
	r_4_3: {
		type: Sequelize.INTEGER
	},
	r_4_4: {
		type: Sequelize.INTEGER
	},
	r_4_5: {
		type: Sequelize.INTEGER
	},
	r_4_6: {
		type: Sequelize.INTEGER
	},
	r_4_7: {
		type: Sequelize.INTEGER
	},
	r_4_8: {
		type: Sequelize.INTEGER
	},
	r_4_9: {
		type: Sequelize.INTEGER
	},
	r_4_10: {
		type: Sequelize.INTEGER
	},
	r_4_11: {
		type: Sequelize.INTEGER
	},
	r_4_12: {
		type: Sequelize.INTEGER
	},
	r_4_15: {
		type: Sequelize.INTEGER
	},
	r_5_1: {
		type: Sequelize.INTEGER
	},
	r_5_2: {
		type: Sequelize.INTEGER
	},
	r_5_3: {
		type: Sequelize.INTEGER
	},
	r_5_4: {
		type: Sequelize.INTEGER
	},
	r_5_5: {
		type: Sequelize.INTEGER
	},
	r_5_6: {
		type: Sequelize.INTEGER
	},
	r_5_7: {
		type: Sequelize.INTEGER
	},
	r_5_8: {
		type: Sequelize.INTEGER
	},
	r_5_9: {
		type: Sequelize.INTEGER
	},
	r_5_10: {
		type: Sequelize.INTEGER
	},
	r_5_11: {
		type: Sequelize.INTEGER
	},
	r_5_12: {
		type: Sequelize.INTEGER
	},
	r_5_15: {
		type: Sequelize.INTEGER
	},
	r_6_1: {
		type: Sequelize.INTEGER
	},
	r_6_2: {
		type: Sequelize.INTEGER
	},
	r_6_3: {
		type: Sequelize.INTEGER
	},
	r_6_4: {
		type: Sequelize.INTEGER
	},
	r_6_5: {
		type: Sequelize.INTEGER
	},
	r_6_6: {
		type: Sequelize.INTEGER
	},
	r_6_7: {
		type: Sequelize.INTEGER
	},
	r_6_8: {
		type: Sequelize.INTEGER
	},
	r_6_9: {
		type: Sequelize.INTEGER
	},
	r_6_10: {
		type: Sequelize.INTEGER
	},
	r_6_11: {
		type: Sequelize.INTEGER
	},
	r_6_12: {
		type: Sequelize.INTEGER
	},
	r_6_15: {
		type: Sequelize.INTEGER
	}
}, {
	freezeTableName: true,
	timestamps: true
});

//////////////////////////////////////////////////////////////////////
// IOT_MinorKeyMeansModel
const IOT_MinorkeyMeansModel = sqlite3.define('IOT_MinorkeyMeans', {
	idIOT_MinorkeyMeans: {
		type: Sequelize.BIGINT,
		autoIncrement: true,
		primaryKey: true
	},
	version: {
		type: Sequelize.INTEGER
	},
	majorKey: {
		type: Sequelize.INTEGER
	},
	minorKey: {
		type: Sequelize.INTEGER
	},
	means: {
		type: Sequelize.STRING(45)
	}
}, {
	freezeTableName: true,
	timestamps: false
});


// MinorKeyMeansModelの格納データ, HAL ver.1
const MinorkeyMeansValues = [
	{ "idIOT_MinorkeyMeans": 1, "version": 1, "majorKey": 1, "minorKey": 1, "means": "洗濯頻度" },
	{ "idIOT_MinorkeyMeans": 2, "version": 1, "majorKey": 1, "minorKey": 2, "means": "アイロン頻度" },
	{ "idIOT_MinorkeyMeans": 3, "version": 1, "majorKey": 1, "minorKey": 3, "means": "服装選択" },
	{ "idIOT_MinorkeyMeans": 4, "version": 1, "majorKey": 1, "minorKey": 4, "means": "服装種類" },
	{ "idIOT_MinorkeyMeans": 5, "version": 1, "majorKey": 1, "minorKey": 5, "means": "着替えの頻度" },
	{ "idIOT_MinorkeyMeans": 6, "version": 1, "majorKey": 1, "minorKey": 6, "means": "爪切り頻度" },
	{ "idIOT_MinorkeyMeans": 7, "version": 1, "majorKey": 1, "minorKey": 7, "means": "歯磨き頻度" },
	{ "idIOT_MinorkeyMeans": 8, "version": 1, "majorKey": 1, "minorKey": 8, "means": "散髪頻度" },
	{ "idIOT_MinorkeyMeans": 9, "version": 1, "majorKey": 1, "minorKey": 9, "means": "ムダ毛、髭処理頻度" },
	{ "idIOT_MinorkeyMeans": 10, "version": 1, "majorKey": 2, "minorKey": 1, "means": "コレステロール値" },
	{ "idIOT_MinorkeyMeans": 11, "version": 1, "majorKey": 2, "minorKey": 2, "means": "血圧値" },
	{ "idIOT_MinorkeyMeans": 12, "version": 1, "majorKey": 2, "minorKey": 3, "means": "血糖値" },
	{ "idIOT_MinorkeyMeans": 13, "version": 1, "majorKey": 2, "minorKey": 4, "means": "水分量" },
	{ "idIOT_MinorkeyMeans": 14, "version": 1, "majorKey": 2, "minorKey": 5, "means": "野菜摂取量" },
	{ "idIOT_MinorkeyMeans": 15, "version": 1, "majorKey": 2, "minorKey": 6, "means": "肉摂取量" },
	{ "idIOT_MinorkeyMeans": 16, "version": 1, "majorKey": 2, "minorKey": 7, "means": "カロリー" },
	{ "idIOT_MinorkeyMeans": 17, "version": 1, "majorKey": 2, "minorKey": 8, "means": "夜食時間" },
	{ "idIOT_MinorkeyMeans": 18, "version": 1, "majorKey": 2, "minorKey": 9, "means": "賞味期限" },
	{ "idIOT_MinorkeyMeans": 19, "version": 1, "majorKey": 3, "minorKey": 1, "means": "掃除頻度" },
	{ "idIOT_MinorkeyMeans": 20, "version": 1, "majorKey": 3, "minorKey": 2, "means": "整理整頓" },
	{ "idIOT_MinorkeyMeans": 21, "version": 1, "majorKey": 3, "minorKey": 3, "means": "換気頻度" },
	{ "idIOT_MinorkeyMeans": 22, "version": 1, "majorKey": 3, "minorKey": 4, "means": "ほこり量" },
	{ "idIOT_MinorkeyMeans": 23, "version": 1, "majorKey": 3, "minorKey": 5, "means": "室温" },
	{ "idIOT_MinorkeyMeans": 24, "version": 1, "majorKey": 3, "minorKey": 6, "means": "布団清潔度" },
	{ "idIOT_MinorkeyMeans": 25, "version": 1, "majorKey": 3, "minorKey": 7, "means": "鍵施錠管理" },
	{ "idIOT_MinorkeyMeans": 26, "version": 1, "majorKey": 4, "minorKey": 1, "means": "睡眠時間" },
	{ "idIOT_MinorkeyMeans": 27, "version": 1, "majorKey": 4, "minorKey": 2, "means": "運動量（スポーツ）" },
	{ "idIOT_MinorkeyMeans": 28, "version": 1, "majorKey": 4, "minorKey": 3, "means": "運動量（歩数）" },
	{ "idIOT_MinorkeyMeans": 29, "version": 1, "majorKey": 4, "minorKey": 4, "means": "食事時間（朝）" },
	{ "idIOT_MinorkeyMeans": 30, "version": 1, "majorKey": 4, "minorKey": 5, "means": "食事時間（昼）" },
	{ "idIOT_MinorkeyMeans": 31, "version": 1, "majorKey": 4, "minorKey": 6, "means": "食事時間（夜）" },
	{ "idIOT_MinorkeyMeans": 32, "version": 1, "majorKey": 4, "minorKey": 7, "means": "体脂肪率（BMI）" },
	{ "idIOT_MinorkeyMeans": 33, "version": 1, "majorKey": 4, "minorKey": 8, "means": "お風呂頻度" },
	{ "idIOT_MinorkeyMeans": 34, "version": 1, "majorKey": 4, "minorKey": 9, "means": "薬摂取" },
	{ "idIOT_MinorkeyMeans": 35, "version": 1, "majorKey": 4, "minorKey": 10, "means": "飲酒頻度" },
	{ "idIOT_MinorkeyMeans": 36, "version": 1, "majorKey": 4, "minorKey": 11, "means": "喫煙頻度" },
	{ "idIOT_MinorkeyMeans": 37, "version": 1, "majorKey": 4, "minorKey": 12, "means": "座位時間" },
	{ "idIOT_MinorkeyMeans": 38, "version": 1, "majorKey": 5, "minorKey": 1, "means": "ストレス" },
	{ "idIOT_MinorkeyMeans": 39, "version": 1, "majorKey": 5, "minorKey": 2, "means": "コミュニケーション" },
	{ "idIOT_MinorkeyMeans": 40, "version": 1, "majorKey": 5, "minorKey": 3, "means": "笑顔頻度" },
	{ "idIOT_MinorkeyMeans": 41, "version": 1, "majorKey": 5, "minorKey": 4, "means": "外出頻度" },
	{ "idIOT_MinorkeyMeans": 42, "version": 1, "majorKey": 5, "minorKey": 5, "means": "親密具合" },
	{ "idIOT_MinorkeyMeans": 43, "version": 1, "majorKey": 5, "minorKey": 6, "means": "対面頻度" },
	{ "idIOT_MinorkeyMeans": 44, "version": 1, "majorKey": 5, "minorKey": 7, "means": "高揚感" },
	{ "idIOT_MinorkeyMeans": 45, "version": 1, "majorKey": 5, "minorKey": 8, "means": "イライラ" },
	{ "idIOT_MinorkeyMeans": 46, "version": 1, "majorKey": 5, "minorKey": 9, "means": "趣味満足度" },
	{ "idIOT_MinorkeyMeans": 47, "version": 1, "majorKey": 5, "minorKey": 10, "means": "SNS依存" },
	{ "idIOT_MinorkeyMeans": 48, "version": 1, "majorKey": 6, "minorKey": 1, "means": "ゴミ削減量" },
	{ "idIOT_MinorkeyMeans": 49, "version": 1, "majorKey": 6, "minorKey": 2, "means": "リサイクル頻度" },
	{ "idIOT_MinorkeyMeans": 50, "version": 1, "majorKey": 6, "minorKey": 3, "means": "プラスチック削減量" },
	{ "idIOT_MinorkeyMeans": 51, "version": 1, "majorKey": 6, "minorKey": 4, "means": "使用電気削減量" },
	{ "idIOT_MinorkeyMeans": 52, "version": 1, "majorKey": 6, "minorKey": 5, "means": "使用ガス削減量" },
	{ "idIOT_MinorkeyMeans": 53, "version": 1, "majorKey": 6, "minorKey": 6, "means": "使用水道水削減量" },
	{ "idIOT_MinorkeyMeans": 54, "version": 1, "majorKey": 6, "minorKey": 7, "means": "自動車排気削減量" },
	{ "idIOT_MinorkeyMeans": 55, "version": 1, "majorKey": 3, "minorKey": 8, "means": "湿度" }
];

//////////////////////////////////////////////////////////////////////
// Room Environment data
const roomEnvModel = sqlite3.define('roomEnv', {
	id: {
		type: Sequelize.BIGINT,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	dateTime: {
		type: Sequelize.DATE,
		allowNull: false
	},
	srcType: {  // Netatmo, Omron, etc.
		type: Sequelize.STRING(32),
		allowNull: false
	},
	place: {
		type: Sequelize.STRING(128),
		allowNull: false
	},
	temperature: {
		type: Sequelize.FLOAT
	},
	humidity: {
		type: Sequelize.FLOAT
	},
	anbientLight: {
		type: Sequelize.INTEGER
	},
	pressure: {
		type: Sequelize.FLOAT
	},
	noise: {
		type: Sequelize.FLOAT
	},
	TVOC: {
		type: Sequelize.INTEGER
	},
	CO2: {
		type: Sequelize.INTEGER
	},
	discomfortIndex: {
		type: Sequelize.FLOAT
	},
	heatStroke: {
		type: Sequelize.FLOAT
	},
	createdAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	},
	updatedAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	}
}, {
	freezeTableName: true,
	timestamps: true
});

// Weather
const weatherModel = sqlite3.define('weather', {
	id: {
		type: Sequelize.BIGINT,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	dateTime: {
		type: Sequelize.DATE,
		allowNull: false
	},
	srcType: {  // OWM, Netatmo(?), etc.
		type: Sequelize.STRING(32),
		allowNull: false
	},
	place: {
		type: Sequelize.STRING(128),
		allowNull: false
	},
	weather: {
		type: Sequelize.STRING(32),
	},
	temperature: {
		type: Sequelize.FLOAT
	},
	humidity: {
		type: Sequelize.FLOAT
	},
	solarRadiation: {
		type: Sequelize.FLOAT
	},
	pressure: {
		type: Sequelize.FLOAT
	},
	noise: {
		type: Sequelize.FLOAT
	},
	TVOC: {
		type: Sequelize.INTEGER
	},
	windSpeed: {
		type: Sequelize.FLOAT
	},
	windDirection: {
		type: Sequelize.INTEGER
	},
	cloudCover: {
		type: Sequelize.FLOAT
	},
	discomfortIndex: {
		type: Sequelize.FLOAT
	},
	heatStroke: {
		type: Sequelize.FLOAT
	},
	createdAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	},
	updatedAt: {
		type: 'TIMESTAMP',
		defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
		allowNull: false
	}
}, {
	freezeTableName: true,
	timestamps: true
});


//////////////////////////////////////////////////////////////////////
// jma data (気象庁天気予報データ、受信データそのまま)
const jmaRawModel = sqlite3.define('jmaRaw', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	type: {
		type: Sequelize.STRING
	},
	publishingOffice: {
		type: Sequelize.STRING
	},
	reportDatetime: {
		type: 'TIMESTAMP'
	},
	requestAreaCode: {
		type: Sequelize.STRING
	},
	json: {
		type: Sequelize.STRING
	}
}, {
	freezeTableName: true,
	timestamps: true
});



//////////////////////////////////////////////////////////////////////
// jma data (気象庁天気予報データ、概要）
const jmaAbstModel = sqlite3.define('jmaAbst', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	reportDatetime: {
		type: 'TIMESTAMP'
	},
	publishingOffice: {
		type: Sequelize.STRING
	},
	targetArea: {
		type: Sequelize.STRING
	},
	requestAreaCode: {
		type: Sequelize.STRING
	},
	headlineText: {
		type: Sequelize.STRING
	},
	text: {
		type: Sequelize.STRING
	}
}, {
	freezeTableName: true,
	timestamps: true
});


// jma data (気象庁天気予報データ、詳細：天気)
const weatherForecastModel = sqlite3.define('jmaWeatherForecast', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	reportDatetime: {
		type: 'TIMESTAMP'
	},
	publishingOffice: {
		type: Sequelize.STRING
	},
	targetArea: {
		type: Sequelize.STRING
	},
	code: {
		type: Sequelize.STRING
	},
	timeDefines: {
		type: Sequelize.STRING
	},
	weatherCodes: {
		type: Sequelize.STRING
	},
	weathers: {
		type: Sequelize.STRING
	},
	winds: {
		type: Sequelize.STRING
	},
	waves: {
		type: Sequelize.STRING
	}
}, {
	freezeTableName: true,
	timestamps: true
});


// jma data (気象庁天気予報データ、詳細：降水確率)
const popsForecastModel = sqlite3.define('jmaPopsForecast', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	reportDatetime: {
		type: 'TIMESTAMP'
	},
	publishingOffice: {
		type: Sequelize.STRING
	},
	targetArea: {
		type: Sequelize.STRING
	},
	code: {
		type: Sequelize.STRING
	},
	timeDefines: {
		type: Sequelize.STRING
	},
	pops: {
		type: Sequelize.STRING
	}
}, {
	freezeTableName: true,
	timestamps: true
});

// jma data (気象庁天気予報データ、詳細：気温)
const tempForecastModel = sqlite3.define('jmaTempForecast', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	reportDatetime: {
		type: 'TIMESTAMP'
	},
	publishingOffice: {
		type: Sequelize.STRING
	},
	targetArea: {
		type: Sequelize.STRING
	},
	code: {
		type: Sequelize.STRING
	},
	timeDefines: {
		type: Sequelize.STRING
	},
	temps: {
		type: Sequelize.STRING
	}
}, {
	freezeTableName: true,
	timestamps: true
});


//////////////////////////////////////////////////////////////////////
// Garmin

// garmin healsh api
const IOT_GarminDailiesModel = sqlite3.define('IOT_GarminDailies', {
	idIOT_GarminDailies: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	garminId: Sequelize.STRING(255),
	garminAccessToken: Sequelize.STRING(255),
	summaryId: Sequelize.STRING(255),
	calendarDate: Sequelize.STRING(255),
	startTimeInSeconds: Sequelize.BIGINT,
	startTimeOffsetInSeconds: Sequelize.BIGINT,
	activityType: Sequelize.STRING(255),
	durationInSeconds: Sequelize.BIGINT,
	steps: Sequelize.INTEGER,
	distanceInMeters: Sequelize.REAL,
	activeTimeInSeconds: Sequelize.BIGINT,
	activeKilocalories: Sequelize.INTEGER,
	bmrKilocalories: Sequelize.INTEGER,
	cunsumedCalories: Sequelize.INTEGER,
	moderateIntensityDurationInSeconds: Sequelize.BIGINT,
	vigorousIntensityDurationInSeconds: Sequelize.BIGINT,
	floorsClimbed: Sequelize.BIGINT,
	minHeartRateInBeatsPerMinute: Sequelize.BIGINT,
	averageHeartRateInBeatsPerMinute: Sequelize.BIGINT,
	maxHeartRateInBeatsPerMinute: Sequelize.BIGINT,
	restingHeartRateInBeatsPerMinute: Sequelize.BIGINT,
	timeOffsetHeartRateSamples: Sequelize.TEXT('medium'),
	averageStressLevel: Sequelize.BIGINT,
	maxStressLevel: Sequelize.BIGINT,
	stressDurationInSeconds: Sequelize.BIGINT,
	restStressDurationInSeconds: Sequelize.BIGINT,
	activityStressDurationInSeconds: Sequelize.BIGINT,
	lowStressDurationInSeconds: Sequelize.BIGINT,
	mediumStressDurationInSeconds: Sequelize.BIGINT,
	highStressDurationInSeconds: Sequelize.BIGINT,
	stressQualifier: Sequelize.STRING,
	stepsGoal: Sequelize.BIGINT,
	netKilocaloriesGoal: Sequelize.BIGINT,
	intensityDurationGoalInSeconds: Sequelize.BIGINT,
	floorsClimbedGoal: Sequelize.BIGINT
}, {
	freezeTableName: true,
	timestamps: true
});

const IOT_GarminStressDetailsModel = sqlite3.define('IOT_GarminStressDetails', {
	idIOT_GarminStressDetails: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	garminId: Sequelize.STRING(255),
	garminAccessToken: Sequelize.STRING(255),
	summaryId: Sequelize.STRING(255),
	startTimeInSeconds: Sequelize.BIGINT,
	startTimeOffsetInSeconds: Sequelize.BIGINT,
	durationInSeconds: Sequelize.BIGINT,
	calendarDate: Sequelize.STRING,
	timeOffsetStressLevelValues: Sequelize.TEXT('medium'),
	timeOffsetBodyBatteryValues: Sequelize.TEXT('medium')
}, {
	freezeTableName: true,
	timestamps: true
});


const IOT_GarminEpochsModel = sqlite3.define('IOT_GarminEpochs', {
	idIOT_GarminEpochs: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	garminId: Sequelize.STRING(255),
	garminAccessToken: Sequelize.STRING(255),
	summaryId: Sequelize.STRING(255),
	startTimeInSeconds: Sequelize.BIGINT,
	startTimeOffsetInSeconds: Sequelize.BIGINT,
	activityType: Sequelize.STRING(255),
	durationInSeconds: Sequelize.BIGINT,
	activeTimeInSeconds: Sequelize.BIGINT,
	steps: Sequelize.BIGINT,
	distanceInMeters: Sequelize.REAL,
	activeKilocalories: Sequelize.BIGINT,
	met: Sequelize.REAL,
	intensity: Sequelize.STRING(255),
	meanMotionIntensity: Sequelize.REAL,
	maxMotionIntensity: Sequelize.REAL
}, {
	freezeTableName: true,
	timestamps: true
});


const IOT_GarminSleepsModel = sqlite3.define('IOT_GarminSleeps', {
	idIOT_GarminSleeps: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	garminId: Sequelize.STRING(255),
	garminAccessToken: Sequelize.STRING(255),
	summaryId: Sequelize.STRING(255),
	calendarDate: Sequelize.STRING,
	startTimeInSeconds: Sequelize.BIGINT,
	startTimeOffsetInSeconds: Sequelize.BIGINT,
	durationInSeconds: Sequelize.BIGINT,
	unmeasurableSleepInSeconds: Sequelize.BIGINT,
	deepSleepDurationInSeconds: Sequelize.BIGINT,
	lightSleepDurationInSeconds: Sequelize.BIGINT,
	remSleepInSeconds: Sequelize.BIGINT,
	awakeDurationInSeconds: Sequelize.BIGINT,
	sleepLevelsMap: Sequelize.TEXT('medium'),
	validation: Sequelize.STRING,
	timeOffsetSleepRespiration: Sequelize.TEXT('medium'),
	timeOffsetSleepSpo2: Sequelize.TEXT('medium'),
	overallSleepScore: Sequelize.STRING,
	sleepScores: Sequelize.TEXT('medium')
}, {
	freezeTableName: true,
	timestamps: true
});


const IOT_GarminUserMetricsModel = sqlite3.define('IOT_GarminUserMetrics', {
	idIOT_GarminUserMetrics: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	garminId: Sequelize.STRING(255),
	garminAccessToken: Sequelize.STRING(255),
	summaryId: Sequelize.STRING(255),
	calendarDate: Sequelize.STRING,
	vo2Max: Sequelize.REAL,
	fitnessAge: Sequelize.INTEGER
}, {
	freezeTableName: true,
	timestamps: true
});


// garmin activity api
const IOT_GarminActivitiesModel = sqlite3.define('IOT_GarminActivities', {
	idIOT_GarminActivities: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	garminId: Sequelize.STRING(255),
	garminAccessToken: Sequelize.STRING(255),
	summaryId: Sequelize.STRING(255),
	activityId: Sequelize.STRING,
	durationInSeconds: Sequelize.BIGINT,
	startTimeInSeconds: Sequelize.BIGINT,
	startTimeOffsetInSeconds: Sequelize.BIGINT,
	activityType: Sequelize.STRING,
	averageHeartRateInBeatsPerMinute: Sequelize.INTEGER,
	averageRunCadenceInStepsPerMinute: Sequelize.INTEGER,
	averageSpeedInMetersPerSecond: Sequelize.REAL,
	averagePaceInMinutesPerKilometer: Sequelize.REAL,
	activeKilocalories: Sequelize.REAL,
	deviceName: Sequelize.STRING,
	distanceInMeters: Sequelize.REAL,
	maxHeartRateInBeatsPerMinute: Sequelize.INTEGER,
	maxPaceInMinutesPerKilometer: Sequelize.REAL,
	maxRunCadenceInStepsPerMinute: Sequelize.INTEGER,
	maxSpeedInMetersPerSecond: Sequelize.REAL,
	steps: Sequelize.INTEGER
}, {
	freezeTableName: true,
	timestamps: true
});


const IOT_GarminActivityDetailsModel = sqlite3.define('IOT_GarminActivityDetails', {
	idIOT_GarminActivityDetails: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	garminId: Sequelize.STRING(255),
	garminAccessToken: Sequelize.STRING(255),
	summaryId: Sequelize.STRING(255),
	activityId: Sequelize.STRING,
	summary: Sequelize.TEXT('medium'),
	samples: Sequelize.TEXT('medium'),
	laps: Sequelize.STRING
}, {
	freezeTableName: true,
	timestamps: true
});



const IOT_GarminMoveIQActivitiesModel = sqlite3.define('IOT_GarminMoveIQActivities', {
	idIOT_GarminMoveIQActivities: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	garminId: Sequelize.STRING(255),
	garminAccessToken: Sequelize.STRING(255),
	summaryId: Sequelize.STRING(255),
	calendarDate: Sequelize.STRING,
	startTimeInSeconds: Sequelize.BIGINT,
	offsetInSeconds: Sequelize.BIGINT,
	durationInSeconds: Sequelize.BIGINT,
	activityType: Sequelize.STRING,
	activitySubType: Sequelize.STRING
}, {
	freezeTableName: true,
	timestamps: true
});


// 謎API
const IOT_GarminAllDayRespirationModel = sqlite3.define('IOT_GarminAllDayRespiration', {
	idIOT_GarminAllDayRespiration: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	garminId: Sequelize.STRING(255),
	garminAccessToken: Sequelize.STRING(255),
	summaryId: Sequelize.STRING(255),
	startTimeInSeconds: Sequelize.BIGINT,
	durationInSeconds: Sequelize.BIGINT,
	startTimeOffsetInSeconds: Sequelize.BIGINT,
	timeOffsetEpochToBreaths: Sequelize.TEXT('medium')
}, {
	freezeTableName: true,
	timestamps: true
});


const IOT_GarminPulseoxModel = sqlite3.define('IOT_GarminPulseox', {
	idIOT_GarminPulseox: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	garminId: Sequelize.STRING(255),
	garminAccessToken: Sequelize.STRING(255),
	summaryId: Sequelize.STRING(255),
	calendarDate: Sequelize.STRING,
	startTimeInSeconds: Sequelize.BIGINT,
	durationInSeconds: Sequelize.BIGINT,
	startTimeOffsetInSeconds: Sequelize.BIGINT,
	timeOffsetSpo2Values: Sequelize.TEXT('medium'),
	onDemand: Sequelize.STRING
}, {
	freezeTableName: true,
	timestamps: true
});


// 体重計
const IOT_GarminBodyCompsModel = sqlite3.define('IOT_GarminBodyComps', {
	idIOT_GarminBodyComps: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	garminId: Sequelize.STRING(255),
	garminAccessToken: Sequelize.STRING(255),
	summaryId: Sequelize.STRING(255),
	muscleMassInGrams: Sequelize.INTEGER,
	boneMassInGrams: Sequelize.INTEGER,
	bodyWaterInPercent: Sequelize.REAL,
	bodyFatInPercent: Sequelize.REAL,
	bodyMassIndex: Sequelize.INTEGER,
	weightInGrams: Sequelize.INTEGER,
	measurementTimeInSeconds: Sequelize.INTEGER,
	measurementTimeOffsetInSeconds: Sequelize.INTEGER
}, {
	freezeTableName: true,
	timestamps: true
});


// アクティビティファイル
const IOT_GarminActivityFilesModel = sqlite3.define('IOT_GarminActivityFiles', {
	idIOT_GarminActivityFiles: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true,
		allowNull: false
	},
	userId: Sequelize.STRING(255),
	userAccessToken: Sequelize.STRING(255),
	summaryId: Sequelize.STRING(255),
	fileType: Sequelize.STRING(255),
	callbackURL: Sequelize.STRING(255),
	startTimeInSeconds: Sequelize.INTEGER,
	activityId: Sequelize.INTEGER,
	activityName: Sequelize.STRING(255),
	manual: Sequelize.BOOLEAN
}, {
	freezeTableName: true,
	timestamps: true
});


// export
module.exports = { Sequelize, Op, sqlite3, elrawModel, eldataModel, esmdataModel, esmrawModel, electricEnergyModel, huerawModel, arpModel, owmModel, netatmoModel, IOT_QuestionnaireAnswersModel, IOT_MajorResultsModel, IOT_MinorResultsModel, IOT_MinorkeyMeansModel, roomEnvModel, jmaRawModel, jmaAbstModel, weatherForecastModel, popsForecastModel, tempForecastModel, switchBotRawModel, switchBotDataModel, IOT_GarminDailiesModel, IOT_GarminStressDetailsModel, IOT_GarminEpochsModel, IOT_GarminSleepsModel, IOT_GarminUserMetricsModel, IOT_GarminActivitiesModel, IOT_GarminActivityDetailsModel, IOT_GarminMoveIQActivitiesModel, IOT_GarminAllDayRespirationModel, IOT_GarminPulseoxModel, IOT_GarminBodyCompsModel, IOT_GarminActivityFilesModel };

//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
