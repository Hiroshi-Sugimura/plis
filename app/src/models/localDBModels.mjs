//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.08.28
//  Last updated: 2021.09.24
//////////////////////////////////////////////////////////////////////
/**
 * @module localDBModels
 * @description ローカルのライフログデータベース（SQLite3/Sequelize）のモデル定義および初期化を行うモジュール。
 */
// Require all the stuff

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let Sequelize, Op;
try {
    ({ Sequelize, Op } = require('sequelize'));
} catch (e) {
    Sequelize = null;
    Op = {};
}
// Windows ARM や sqlite3未導入環境ではSequelizeのsqlite方言が使えないため、
// ここで安全にスタブへフォールバックする
/** @type {boolean} Sequelize/SQLiteが利用可能かどうか */
let canUseSequelizeSqlite = !!Sequelize;

// Sequelizeが使えない場合の軽量シム（fn, literal, col）
const SequelizeShim = {
    fn: function (name, arg) { return { type: 'fn', name, arg }; },
    literal: function (val) { return { type: 'literal', val }; },
    col: function (name) { return { type: 'col', name }; },
};
const env = process.env.NODE_ENV || "development";

import path from 'node:path';
import { fileURLToPath } from 'url';

const appname = 'PLIS';
const userHome = process.env[process.platform == "win32" ? "USERPROFILE" : "HOME"];
const configDir = path.join(userHome, appname);

// Setup sequelize db connection (fallback to stub when sqlite3 is unavailable)
let sqlite3;
if (canUseSequelizeSqlite) {
    try {
        sqlite3 = new Sequelize('database', '', '', {
            dialect: 'sqlite',
            storage: path.join(configDir, 'lifelog.db'),
            logging: false
        });
    } catch (e) {
        console.warn(new Date().toISOString(), '| localDBModels: Sequelize sqlite init failed, fallback to stub:', e.message);
        canUseSequelizeSqlite = false;
    }
}

/**
 * @func makeStubModel
 * @desc Sequelizeが利用できない場合に、各モデルのメソッドをモックするためのスタブを生成する。
 * @param {string} name モデル名
 * @returns {Object} データベース操作メソッドを模倣したオブジェクト
 */
function makeStubModel(name) {
    const stub = {
        create: async function () { return {}; },
        findAll: async function () { return []; },
        findOne: async function () { return null; },
        update: async function () { return [0]; },
        destroy: async function () { return 0; },
        bulkCreate: async function () { return []; },
        sync: async function () { return true; },
        define: function () { return this; }
    };
    return stub;
}

// When Sequelize sqlite is unavailable, provide a sqlite3 stub with sync()
if (!canUseSequelizeSqlite) {
    sqlite3 = {
        async sync() { return true; },
        async transaction() { return { commit: async () => { }, rollback: async () => { } }; }
    };
}

// freezeTableNameはモデルに渡した名前を実テーブルにマッピングする際に複数形に変換してしまうのを抑制する
// timestamps: falseを入れておくと，createdAt, updatedAtが勝手に追加されない

//////////////////////////////////////////////////////////////////////
/**
 * @typedef {import('sequelize').Model} Model
 */

//----------------------------------------------------------------------
// ECHONET Lite 関連
/** @type {Model} ECHONET Lite の受信ログ（解析済み） */
const eldataModel = canUseSequelizeSqlite ? sqlite3.define('eldata', {
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
}) : makeStubModel('eldata');


//////////////////////////////////////////////////////////////////////
/** @type {Model} ECHONET Lite の生パケットログ */
const elrawModel = canUseSequelizeSqlite ? sqlite3.define('elraw', {
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
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('elraw');



//////////////////////////////////////////////////////////////////////
//----------------------------------------------------------------------
// スマートメータ (ECHONET Lite) 関連
/** @type {Model} スマートメータ（低圧スマート電力量メータ）のログ */
const esmdataModel = canUseSequelizeSqlite ? sqlite3.define('esmdata', {
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
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('esmdata');


//////////////////////////////////////////////////////////////////////
/** @type {Model} スマートメータ（低圧スマート電力量メータ）の生パケットログ */
const esmrawModel = canUseSequelizeSqlite ? sqlite3.define('esmraw', {
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
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('esmraw');

//////////////////////////////////////////////////////////////////////
/** @type {Model} 瞬時電力量、積算電力量などの集計データ */
const electricEnergyModel = canUseSequelizeSqlite ? sqlite3.define('electricEnergyTable', {
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
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('ElectricEnergy');



//////////////////////////////////////////////////////////////////////
/** @type {Model} Philips Hue の生データログ */
const huerawModel = canUseSequelizeSqlite ? sqlite3.define('huerawModel', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    rawdata: {
        type: Sequelize.STRING
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('huerawModel');



//////////////////////////////////////////////////////////////////////
/** @type {Model} ARPテーブルのログ */
const arpModel = canUseSequelizeSqlite ? sqlite3.define('arpTable', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    detail: {
        type: Sequelize.STRING
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('arpTable');

//----------------------------------------------------------------------
// OpenWeatherMap 関連
/** @type {Model} OpenWeatherMap API からの生レスポンスログ */
const owmModel = canUseSequelizeSqlite ? sqlite3.define('owmTable', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    detail: {
        type: Sequelize.STRING
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('owmTable');

/** @type {Model} 取得した気象データ（気温、湿度、気圧など）を抽出・正規化したログ */
const weatherModel = canUseSequelizeSqlite ? sqlite3.define('weatherTable', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    dateTime: {
        type: Sequelize.DATE
    },
    srcType: {
        type: Sequelize.STRING
    },
    place: {
        type: Sequelize.STRING
    },
    weather: {
        type: Sequelize.STRING
    },
    temperature: {
        type: Sequelize.DOUBLE
    },
    humidity: {
        type: Sequelize.DOUBLE
    },
    pressure: {
        type: Sequelize.DOUBLE
    },
    windSpeed: {
        type: Sequelize.DOUBLE
    },
    windDirection: {
        type: Sequelize.DOUBLE
    },
    cloudCover: {
        type: Sequelize.DOUBLE
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('weatherTable');



//////////////////////////////////////////////////////////////////////
//----------------------------------------------------------------------
// Netatmo 関連
/** @type {Model} Netatmo API からの生デバイスデータログ */
const netatmoModel = canUseSequelizeSqlite ? sqlite3.define('netatmoTable', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    detail: {
        type: Sequelize.STRING
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('netatmoTable');


//----------------------------------------------------------------------
// SwitchBot 関連
/** @type {Model} SwitchBot API からの生デバイスデータログ */
const switchBotRawModel = canUseSequelizeSqlite ? sqlite3.define('switchBotRawTable', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    detail: {
        type: Sequelize.TEXT
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('switchBotRawTable');

/** @type {Model} SwitchBot デバイスの抽出・正規化されたデータログ */
const switchBotDataModel = canUseSequelizeSqlite ? sqlite3.define('switchBotDataTable', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    deviceId: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    deviceType: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    deviceName: {
        type: Sequelize.TEXT
    },
    property: {
        type: Sequelize.TEXT
    },
    value: {
        type: Sequelize.TEXT
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('switchBotDataTable');


//----------------------------------------------------------------------
// IKEA TRADFRI 関連
/** @type {Model} IKEA ゲートウェイからの生データログ */
const ikeaRawModel = canUseSequelizeSqlite ? sqlite3.define('ikeaRawTable', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    detail: {
        type: Sequelize.TEXT
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('ikeaRawTable');

/** @type {Model} IKEA デバイスの抽出・正規化されたデータログ */
const ikeaDataModel = canUseSequelizeSqlite ? sqlite3.define('ikeaDataTable', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    deviceId: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    deviceType: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    deviceName: {
        type: Sequelize.TEXT
    },
    alive: {
        type: Sequelize.BOOLEAN
    },
    power: {
        type: Sequelize.INTEGER
    },
    battery: {
        type: Sequelize.INTEGER
    },
    list: {
        type: Sequelize.TEXT
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('ikeaDataTable');


//----------------------------------------------------------------------
// アンケート・評価・成績関連
/** @type {Model} ユーザーからのアンケート回答記録 */
const IOT_QuestionnaireAnswersModel = canUseSequelizeSqlite ? sqlite3.define('IOT_QuestionnaireAnswers', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
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
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_QuestionnaireAnswers');


/** @type {Model} 主要な評価結果（総合スコア、分野別スコア等） */
const IOT_MajorResultsModel = canUseSequelizeSqlite ? sqlite3.define('IOT_MajorResults', {
    idIOT_MajorResults: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
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
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_MajorResults');


/** @type {Model} 詳細な評価結果（設問ごとのスコア等） */
const IOT_MinorResultsModel = canUseSequelizeSqlite ? sqlite3.define('IOT_MinorResults', {
    idIOT_MinorResults: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
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
        type: Sequelize.DOUBLE
    },
    r_1_2: {
        type: Sequelize.DOUBLE
    },
    r_1_3: {
        type: Sequelize.DOUBLE
    },
    r_1_4: {
        type: Sequelize.DOUBLE
    },
    r_1_5: {
        type: Sequelize.DOUBLE
    },
    r_1_6: {
        type: Sequelize.DOUBLE
    },
    r_1_7: {
        type: Sequelize.DOUBLE
    },
    r_1_8: {
        type: Sequelize.DOUBLE
    },
    r_1_9: {
        type: Sequelize.DOUBLE
    },
    r_2_1: {
        type: Sequelize.DOUBLE
    },
    r_2_2: {
        type: Sequelize.DOUBLE
    },
    r_2_3: {
        type: Sequelize.DOUBLE
    },
    r_2_4: {
        type: Sequelize.DOUBLE
    },
    r_2_5: {
        type: Sequelize.DOUBLE
    },
    r_2_6: {
        type: Sequelize.DOUBLE
    },
    r_2_7: {
        type: Sequelize.DOUBLE
    },
    r_2_8: {
        type: Sequelize.DOUBLE
    },
    r_3_1: {
        type: Sequelize.DOUBLE
    },
    r_3_2: {
        type: Sequelize.DOUBLE
    },
    r_3_3: {
        type: Sequelize.DOUBLE
    },
    r_3_4: {
        type: Sequelize.DOUBLE
    },
    r_3_5: {
        type: Sequelize.DOUBLE
    },
    r_3_6: {
        type: Sequelize.DOUBLE
    },
    r_3_7: {
        type: Sequelize.DOUBLE
    },
    r_3_8: {
        type: Sequelize.DOUBLE
    },
    r_4_1: {
        type: Sequelize.DOUBLE
    },
    r_4_2: {
        type: Sequelize.DOUBLE
    },
    r_4_3: {
        type: Sequelize.DOUBLE
    },
    r_4_4: {
        type: Sequelize.DOUBLE
    },
    r_4_5: {
        type: Sequelize.DOUBLE
    },
    r_4_6: {
        type: Sequelize.DOUBLE
    },
    r_4_7: {
        type: Sequelize.DOUBLE
    },
    r_4_8: {
        type: Sequelize.DOUBLE
    },
    r_5_1: {
        type: Sequelize.DOUBLE
    },
    r_5_2: {
        type: Sequelize.DOUBLE
    },
    r_5_3: {
        type: Sequelize.DOUBLE
    },
    r_5_4: {
        type: Sequelize.DOUBLE
    },
    r_5_5: {
        type: Sequelize.DOUBLE
    },
    r_5_6: {
        type: Sequelize.DOUBLE
    },
    r_5_7: {
        type: Sequelize.DOUBLE
    },
    r_5_8: {
        type: Sequelize.DOUBLE
    },
    r_5_9: {
        type: Sequelize.DOUBLE
    },
    r_6_1: {
        type: Sequelize.DOUBLE
    },
    r_6_2: {
        type: Sequelize.DOUBLE
    },
    r_6_3: {
        type: Sequelize.DOUBLE
    },
    r_6_4: {
        type: Sequelize.DOUBLE
    },
    r_6_5: {
        type: Sequelize.DOUBLE
    },
    r_6_6: {
        type: Sequelize.DOUBLE
    },
    r_6_7: {
        type: Sequelize.DOUBLE
    },
    r_6_8: {
        type: Sequelize.DOUBLE
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_MinorResults');


/** @type {Model} 評価指標の基準値や平均値等 */
const IOT_MinorkeyMeansModel = canUseSequelizeSqlite ? sqlite3.define('IOT_MinorkeyMeans', {
    idIOT_MinorkeyMeans: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    version: {
        type: Sequelize.STRING(16),
        allowNull: false
    },
    majorKey: {
        type: Sequelize.INTEGER
    },
    minorKey: {
        type: Sequelize.INTEGER
    },
    key: {
        type: Sequelize.VIRTUAL,
        get() {
            return `r_${this.getDataValue('majorKey')}_${this.getDataValue('minorKey')}`;
        },
        set(value) {
            if (!value) return;
            const parts = value.split('_');
            this.setDataValue('majorKey', parseInt(parts[1], 10));
            this.setDataValue('minorKey', parseInt(parts[2], 10));
        }
    },
    val: {
        type: Sequelize.DOUBLE,
        field: 'means'
    }
}, {
    freezeTableName: true,
    timestamps: false
}) : makeStubModel('IOT_MinorkeyMeans');


/** @type {Object[]} 評価指標のデフォルト値リスト */
const MinorkeyMeansValues = [
    { version: '1', key: 'r_1_1', val: 56.5925925925926 },
    { version: '1', key: 'r_1_2', val: 59.8518518518519 },
    { version: '1', key: 'r_1_3', val: 49.3333333333333 },
    { version: '1', key: 'r_1_4', val: 51.5555555555556 },
    { version: '1', key: 'r_1_5', val: 62.2962962962963 },
    { version: '1', key: 'r_1_6', val: 40.5925925925926 },
    { version: '1', key: 'r_1_7', val: 68.3703703703704 },
    { version: '1', key: 'r_1_8', val: 63.8518518518519 },
    { version: '1', key: 'r_1_9', val: 63.8518518518519 },
    { version: '1', key: 'r_2_1', val: 67.5925925925926 },
    { version: '1', key: 'r_2_2', val: 78.4814814814815 },
    { version: '1', key: 'r_2_3', val: 74.3703703703704 },
    { version: '1', key: 'r_2_4', val: 51.5555555555556 },
    { version: '1', key: 'r_2_5', val: 75.3333333333333 },
    { version: '1', key: 'r_2_6', val: 65.4074074074074 },
    { version: '1', key: 'r_2_7', val: 76.5185185185185 },
    { version: '1', key: 'r_2_8', val: 63.8518518518519 },
    { version: '1', key: 'r_2_9', val: 77.2592592592593 },
    { version: '1', key: 'r_3_1', val: 68 },
    { version: '1', key: 'r_3_2', val: 59.9074074074074 },
    { version: '1', key: 'r_3_3', val: 50.8148148148148 },
    { version: '1', key: 'r_3_4', val: 43.1111111111111 },
    { version: '1', key: 'r_3_5', val: 71.3333333333333 },
    { version: '1', key: 'r_3_6', val: 65.5555555555556 },
    { version: '1', key: 'r_3_7', val: 68.4444444444444 },
    { version: '1', key: 'r_3_8', val: 52 },
    { version: '1', key: 'r_4_1', val: 65.7037037037037 },
    { version: '1', key: 'r_4_2', val: 52.8888888888889 },
    { version: '1', key: 'r_4_3', val: 55.4074074074074 },
    { version: '1', key: 'r_4_4', val: 43.4074074074074 },
    { version: '1', key: 'r_4_5', val: 50.1481481481481 },
    { version: '1', key: 'r_4_6', val: 65.4074074074074 },
    { version: '1', key: 'r_4_7', val: 48.7407407407407 },
    { version: '1', key: 'r_4_8', val: 70.0740740740741 },
    { version: '1', key: 'r_5_1', val: 70.8148148148148 },
    { version: '1', key: 'r_5_2', val: 55.037037037037 },
    { version: '1', key: 'r_5_3', val: 55.7777777777778 },
    { version: '1', key: 'r_5_4', val: 61.7037037037037 },
    { version: '1', key: 'r_5_5', val: 55.037037037037 },
    { version: '1', key: 'r_5_6', val: 72.8888888888889 },
    { version: '1', key: 'r_5_7', val: 60.0740740740741 },
    { version: '1', key: 'r_5_8', val: 69.8518518518519 },
    { version: '1', key: 'r_5_9', val: 81.7037037037037 },
    { version: '1', key: 'r_6_1', val: 56.5925925925926 },
    { version: '1', key: 'r_6_2', val: 56.6666666666667 },
    { version: '1', key: 'r_6_3', val: 49.9259259259259 },
    { version: '1', key: 'r_6_4', val: 79.5555555555556 },
    { version: '1', key: 'r_6_5', val: 63.3333333333333 },
    { version: '1', key: 'r_6_6', val: 63.8518518518519 },
    { version: '1', key: 'r_6_7', val: 77.2592592592593 },
    { version: '1', key: 'r_6_8', val: 76.5185185185185 }
];


//----------------------------------------------------------------------
// 環境・ユーザー状態関連
/** @type {Model} 部屋の環境データ（気温、湿度、CO2、騒音等、Netatmoやセンサーから集約） */
const roomEnvModel = canUseSequelizeSqlite ? sqlite3.define('roomEnv', {
    id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    dateTime: {
        // type: Sequelize.DATE,
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('dateTime', val.toISOString());
            } else {
                this.setDataValue('dateTime', val);
            }
        }
    },
    srcType: {  // netatmo, omron, and so on.
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
    pressure: {
        type: Sequelize.FLOAT
    },
    beep: {
        type: Sequelize.INTEGER
    },
    CO2: {
        type: Sequelize.INTEGER
    },
    TVOC: {
        type: Sequelize.INTEGER
    },
    noise: {
        type: Sequelize.INTEGER
    },
    etvoc: {
        type: Sequelize.INTEGER
    },
    sico: {
        type: Sequelize.FLOAT
    },
    vibration: {
        type: Sequelize.INTEGER
    },
    anbientLight: {
        type: Sequelize.INTEGER
    },
    light: {
        type: Sequelize.INTEGER
    },
    discomfortIndex: {
        type: Sequelize.FLOAT
    },
    heatStroke: {
        type: Sequelize.FLOAT
    },
    lightColor: {
        type: Sequelize.INTEGER
    },
    image: {
        type: Sequelize.TEXT
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('roomEnv');


/** @type {Model} ユーザーの現在の状態ログ */
const userStateModel = canUseSequelizeSqlite ? sqlite3.define('userState', {
    id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    dateTime: {
        // type: Sequelize.DATE,
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('dateTime', val.toISOString());
            } else {
                this.setDataValue('dateTime', val);
            }
        }
    },
    srcType: {  // garmin, fitbit, apple watch, ...
        type: Sequelize.STRING(32),
        allowNull: false
    },
    place: {  // location
        type: Sequelize.STRING(128)
    },
    steps: {  // steps
        type: Sequelize.INTEGER
    },
    distance: { // distance
        type: Sequelize.INTEGER
    },
    calories: { // Total calories
        type: Sequelize.INTEGER
    },
    heartRate: { // heart rate
        type: Sequelize.INTEGER
    },
    stress: { // stress
        type: Sequelize.INTEGER
    },
    bodyBattery: { // Body Battery (garmin)
        type: Sequelize.INTEGER
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('userState');


//////////////////////////////////////////////////////////////////////
// 	owmModel,
// 	netatmoModel,
// 	switchBotRawModel,
// 	switchBotDataModel,
// 	ikeaRawModel,
// 	ikeaDataModel,
// 	IOT_QuestionnaireAnswersModel,
// 	IOT_MajorResultsModel,
// 	IOT_MinorResultsModel,
// 	IOT_MinorkeyMeansModel,
// 	MinorkeyMeansValues,
// 	roomEnvModel,
// 	userStateModel
// };


//////////////////////////////////////////////////////////////////////
// 気象庁防災情報XML関連
/** @type {Model} 気象庁防災情報XMLの生データログ */
const jmaRawModel = canUseSequelizeSqlite ? sqlite3.define('jmaRawTable', {
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
        type: Sequelize.STRING
    },
    requestAreaCode: {
        type: Sequelize.STRING
    },
    json: {
        type: Sequelize.TEXT
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('jmaRawTable');


/** @type {Model} 気象庁防災情報XMLの概況データ */
const jmaAbstModel = canUseSequelizeSqlite ? sqlite3.define('jmaAbstTable', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    reportDatetime: {
        type: Sequelize.STRING
    },
    publishingOffice: {
        type: Sequelize.STRING
    },
    requestAreaCode: {
        type: Sequelize.STRING
    },
    headlineText: {
        type: Sequelize.TEXT
    },
    text: {
        type: Sequelize.TEXT
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('jmaAbstTable');


/** @type {Model} 天気予報データ */
const weatherForecastModel = canUseSequelizeSqlite ? sqlite3.define('weatherForecastTable', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    reportDatetime: {
        type: Sequelize.STRING
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
        type: Sequelize.TEXT
    },
    weatherCodes: {
        type: Sequelize.TEXT
    },
    weathers: {
        type: Sequelize.TEXT
    },
    winds: {
        type: Sequelize.TEXT
    },
    waves: {
        type: Sequelize.TEXT
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('weatherForecastTable');


/** @type {Model} 降水確率予報データ */
const popsForecastModel = canUseSequelizeSqlite ? sqlite3.define('popsForecastTable', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    reportDatetime: {
        type: Sequelize.STRING
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
        type: Sequelize.TEXT
    },
    pops: {
        type: Sequelize.TEXT
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('popsForecastTable');


/** @type {Model} 気温予報データ */
const tempForecastModel = canUseSequelizeSqlite ? sqlite3.define('tempForecastTable', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    reportDatetime: {
        type: Sequelize.STRING
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
        type: Sequelize.TEXT
    },
    temps: {
        type: Sequelize.TEXT
    },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('tempForecastTable');


//----------------------------------------------------------------------
// Garmin 関連
/** @type {Model} Garmin アクティビティログ */
const IOT_GarminActivitiesModel = canUseSequelizeSqlite ? sqlite3.define('IOT_GarminActivities', {
    idIOT_GarminActivities: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    garminId: { type: Sequelize.STRING },
    garminAccessToken: { type: Sequelize.STRING },
    summaryId: { type: Sequelize.STRING },
    activityId: { type: Sequelize.STRING },
    durationInSeconds: { type: Sequelize.INTEGER },
    startTimeInSeconds: { type: Sequelize.BIGINT },
    startTimeOffsetInSeconds: { type: Sequelize.INTEGER },
    activityType: { type: Sequelize.STRING },
    averageHeartRateInBeatsPerMinute: { type: Sequelize.INTEGER },
    averageRunCadenceInStepsPerMinute: { type: Sequelize.INTEGER },
    averageSpeedInMetersPerSecond: { type: Sequelize.DOUBLE },
    averagePaceInMinutesPerKilometer: { type: Sequelize.DOUBLE },
    activeKilocalories: { type: Sequelize.INTEGER },
    deviceName: { type: Sequelize.STRING },
    distanceInMeters: { type: Sequelize.DOUBLE },
    maxHeartRateInBeatsPerMinute: { type: Sequelize.INTEGER },
    maxPaceInMinutesPerKilometer: { type: Sequelize.DOUBLE },
    maxRunCadenceInStepsPerMinute: { type: Sequelize.INTEGER },
    maxSpeedInMetersPerSecond: { type: Sequelize.DOUBLE },
    steps: { type: Sequelize.INTEGER }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_GarminActivities');

/** @type {Model} Garmin アクティビティの詳細データ（ラップ情報等） */
const IOT_GarminActivityDetailsModel = canUseSequelizeSqlite ? sqlite3.define('IOT_GarminActivityDetails', {
    idIOT_GarminActivityDetails: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    garminId: { type: Sequelize.STRING },
    garminAccessToken: { type: Sequelize.STRING },
    summaryId: { type: Sequelize.STRING },
    activityId: { type: Sequelize.STRING },
    summary: { type: Sequelize.TEXT },
    samples: { type: Sequelize.TEXT },
    laps: { type: Sequelize.TEXT },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_GarminActivityDetails');

/** @type {Model} Garmin 呼吸数（終日）データ */
const IOT_GarminAllDayRespirationModel = canUseSequelizeSqlite ? sqlite3.define('IOT_GarminAllDayRespiration', {
    idIOT_GarminAllDayRespiration: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    garminId: { type: Sequelize.STRING },
    garminAccessToken: { type: Sequelize.STRING },
    summaryId: { type: Sequelize.STRING },
    activityId: { type: Sequelize.STRING },
    durationInSeconds: { type: Sequelize.INTEGER },
    startTimeInSeconds: { type: Sequelize.BIGINT },
    startTimeOffsetInSeconds: { type: Sequelize.INTEGER },
    timeOffsetEpochToBreaths: { type: Sequelize.TEXT },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_GarminAllDayRespiration');

/** @type {Model} Garmin 体組成（筋肉量、骨量、体脂肪率等）データ */
const IOT_GarminBodyCompsModel = canUseSequelizeSqlite ? sqlite3.define('IOT_GarminBodyComps', {
    idIOT_GarminBodyComps: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    garminId: { type: Sequelize.STRING },
    garminAccessToken: { type: Sequelize.STRING },
    summaryId: { type: Sequelize.STRING },
    muscleMassInGrams: { type: Sequelize.INTEGER },
    boneMassInGrams: { type: Sequelize.INTEGER },
    bodyWaterInPercent: { type: Sequelize.DOUBLE },
    bodyFatInPercent: { type: Sequelize.DOUBLE },
    bodyMassIndex: { type: Sequelize.DOUBLE },
    weightInGrams: { type: Sequelize.INTEGER },
    measurementTimeInSeconds: { type: Sequelize.BIGINT },
    measurementTimeOffsetInSeconds: { type: Sequelize.INTEGER },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_GarminBodyComps');

/** @type {Model} Garmin 日次活動記録（歩数、心拍、ストレス等） */
const IOT_GarminDailiesModel = canUseSequelizeSqlite ? sqlite3.define('IOT_GarminDailies', {
    idIOT_GarminDailies: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    garminId: { type: Sequelize.STRING },
    garminAccessToken: { type: Sequelize.STRING },
    summaryId: { type: Sequelize.STRING },
    calendarDate: { type: Sequelize.STRING },
    startTimeInSeconds: { type: Sequelize.BIGINT },
    startTimeOffsetInSeconds: { type: Sequelize.INTEGER },
    activityType: { type: Sequelize.STRING },
    durationInSeconds: { type: Sequelize.INTEGER },
    steps: { type: Sequelize.INTEGER },
    distanceInMeters: { type: Sequelize.DOUBLE },
    activeTimeInSeconds: { type: Sequelize.INTEGER },
    activeKilocalories: { type: Sequelize.INTEGER },
    bmrKilocalories: { type: Sequelize.INTEGER },
    cunsumedCalories: { type: Sequelize.INTEGER },
    moderateIntensityDurationInSeconds: { type: Sequelize.INTEGER },
    vigorousIntensityDurationInSeconds: { type: Sequelize.INTEGER },
    floorsClimbed: { type: Sequelize.INTEGER },
    minHeartRateInBeatsPerMinute: { type: Sequelize.INTEGER },
    averageHeartRateInBeatsPerMinute: { type: Sequelize.INTEGER },
    maxHeartRateInBeatsPerMinute: { type: Sequelize.INTEGER },
    restStressDurationInSeconds: { type: Sequelize.INTEGER },
    timeOffsetHeartRateSamples: { type: Sequelize.TEXT },
    averageStressLevel: { type: Sequelize.INTEGER },
    maxStressLevel: { type: Sequelize.INTEGER },
    stressDurationInSeconds: { type: Sequelize.INTEGER },
    activityStressDurationInSeconds: { type: Sequelize.INTEGER },
    lowStressDurationInSeconds: { type: Sequelize.INTEGER },
    mediumStressDurationInSeconds: { type: Sequelize.INTEGER },
    highStressDurationInSeconds: { type: Sequelize.INTEGER },
    stressQualifier: { type: Sequelize.STRING },
    stepsGoal: { type: Sequelize.INTEGER },
    netKilocaloriesGoal: { type: Sequelize.INTEGER },
    intensityDurationGoalInSeconds: { type: Sequelize.INTEGER },
    floorsClimbedGoal: { type: Sequelize.INTEGER },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_GarminDailies');

/** @type {Model} Garmin 指定期間（エポック）の活動サマリーデータ */
const IOT_GarminEpochsModel = canUseSequelizeSqlite ? sqlite3.define('IOT_GarminEpochs', {
    idIOT_GarminEpochs: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    garminId: { type: Sequelize.STRING },
    garminAccessToken: { type: Sequelize.STRING },
    summaryId: { type: Sequelize.STRING },
    startTimeInSeconds: { type: Sequelize.BIGINT },
    startTimeOffsetInSeconds: { type: Sequelize.INTEGER },
    activityType: { type: Sequelize.STRING },
    durationInSeconds: { type: Sequelize.INTEGER },
    activeTimeInSeconds: { type: Sequelize.INTEGER },
    steps: { type: Sequelize.INTEGER },
    distanceInMeters: { type: Sequelize.DOUBLE },
    activeKilocalories: { type: Sequelize.INTEGER },
    met: { type: Sequelize.DOUBLE },
    intensity: { type: Sequelize.STRING },
    meanMotionIntensity: { type: Sequelize.DOUBLE },
    maxMotionIntensity: { type: Sequelize.DOUBLE },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_GarminEpochs');

/** @type {Model} Garmin Move IQ（自動検知アクティビティ）データ */
const IOT_GarminMoveIQActivitiesModel = canUseSequelizeSqlite ? sqlite3.define('IOT_GarminMoveIQActivities', {
    idIOT_GarminMoveIQActivities: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    garminId: { type: Sequelize.STRING },
    garminAccessToken: { type: Sequelize.STRING },
    summaryId: { type: Sequelize.STRING },
    calendarDate: { type: Sequelize.STRING },
    startTimeInSeconds: { type: Sequelize.BIGINT },
    offsetInSeconds: { type: Sequelize.INTEGER },
    durationInSeconds: { type: Sequelize.INTEGER },
    activityType: { type: Sequelize.STRING },
    activitySubType: { type: Sequelize.STRING },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_GarminMoveIQActivities');

/** @type {Model} Garmin パルスオキシメータ（血中酸素トラッキング）データ */
const IOT_GarminPulseoxModel = canUseSequelizeSqlite ? sqlite3.define('IOT_GarminPulseox', {
    idIOT_GarminPulseox: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    garminId: { type: Sequelize.STRING },
    garminAccessToken: { type: Sequelize.STRING },
    summaryId: { type: Sequelize.STRING },
    calendarDate: { type: Sequelize.STRING },
    startTimeInSeconds: { type: Sequelize.BIGINT },
    durationInSeconds: { type: Sequelize.INTEGER },
    startTimeOffsetInSeconds: { type: Sequelize.INTEGER },
    timeOffsetSpo2Values: { type: Sequelize.TEXT },
    onDemand: { type: Sequelize.BOOLEAN },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_GarminPulseox');

/** @type {Model} Garmin 睡眠トラッキング（睡眠段階、スコア等）データ */
const IOT_GarminSleepsModel = canUseSequelizeSqlite ? sqlite3.define('IOT_GarminSleeps', {
    idIOT_GarminSleeps: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    garminId: { type: Sequelize.STRING },
    garminAccessToken: { type: Sequelize.STRING },
    summaryId: { type: Sequelize.STRING },
    calendarDate: { type: Sequelize.STRING },
    startTimeInSeconds: { type: Sequelize.BIGINT },
    startTimeOffsetInSeconds: { type: Sequelize.INTEGER },
    durationInSeconds: { type: Sequelize.INTEGER },
    unmeasurableSleepInSeconds: { type: Sequelize.INTEGER },
    deepSleepDurationInSeconds: { type: Sequelize.INTEGER },
    lightSleepDurationInSeconds: { type: Sequelize.INTEGER },
    remSleepInSeconds: { type: Sequelize.INTEGER },
    awakeDurationInSeconds: { type: Sequelize.INTEGER },
    sleepLevelsMap: { type: Sequelize.TEXT },
    validation: { type: Sequelize.STRING },
    timeOffsetSleepRespiration: { type: Sequelize.TEXT },
    timeOffsetSleepSpo2: { type: Sequelize.TEXT },
    overallSleepScore: { type: Sequelize.INTEGER },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_GarminSleeps');

/** @type {Model} Garmin ストレス詳細・Body Battery データ */
const IOT_GarminStressDetailsModel = canUseSequelizeSqlite ? sqlite3.define('IOT_GarminStressDetails', {
    idIOT_GarminStressDetails: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    garminId: { type: Sequelize.STRING },
    garminAccessToken: { type: Sequelize.STRING },
    summaryId: { type: Sequelize.STRING },
    startTimeInSeconds: { type: Sequelize.BIGINT },
    startTimeOffsetInSeconds: { type: Sequelize.INTEGER },
    durationInSeconds: { type: Sequelize.INTEGER },
    calendarDate: { type: Sequelize.STRING },
    timeOffsetStressLevelValues: { type: Sequelize.TEXT },
    timeOffsetBodyBatteryValues: { type: Sequelize.TEXT },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_GarminStressDetails');

/** @type {Model} Garmin ユーザー指標（最大酸素摂取量、フィットネス年齢等） */
const IOT_GarminUserMetricsModel = canUseSequelizeSqlite ? sqlite3.define('IOT_GarminUserMetrics', {
    idIOT_GarminUserMetrics: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    garminId: { type: Sequelize.STRING },
    garminAccessToken: { type: Sequelize.STRING },
    summaryId: { type: Sequelize.STRING },
    calendarDate: { type: Sequelize.STRING },
    vo2Max: { type: Sequelize.DOUBLE },
    fitnessAge: { type: Sequelize.INTEGER },
    createdAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('createdAt', val.toISOString());
            } else {
                this.setDataValue('createdAt', val);
            }
        }
    },
    updatedAt: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
        set(val) {
            if (val instanceof Date) {
                this.setDataValue('updatedAt', val.toISOString());
            } else {
                this.setDataValue('updatedAt', val);
            }
        }
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_GarminUserMetrics');


/** データベースモデルを公開するオブジェクト */
export default {
    /** 
     * @type {import('sequelize').Sequelize} Sequelize クラス本体
     * @type {import('sequelize').Op} オペレーター (And, Or, Between 等)
     * @type {import('sequelize').Sequelize} 接続済みの Sequelize インスタンス
     */
    Sequelize, Op, sqlite3,
    eldataModel,
    elrawModel,
    esmdataModel,
    esmrawModel,
    electricEnergyModel,
    huerawModel,
    arpModel,
    owmModel,
    netatmoModel,
    switchBotRawModel,
    switchBotDataModel,
    ikeaRawModel,
    ikeaDataModel,
    IOT_QuestionnaireAnswersModel,
    IOT_MajorResultsModel,
    IOT_MinorResultsModel,
    IOT_MinorkeyMeansModel,
    MinorkeyMeansValues,
    roomEnvModel,
    userStateModel,
    jmaRawModel,
    jmaAbstModel,
    weatherForecastModel,
    popsForecastModel,
    tempForecastModel,
    weatherModel,
    IOT_GarminActivitiesModel,
    IOT_GarminActivityDetailsModel,
    IOT_GarminAllDayRespirationModel,
    IOT_GarminBodyCompsModel,
    IOT_GarminDailiesModel,
    IOT_GarminEpochsModel,
    IOT_GarminMoveIQActivitiesModel,
    IOT_GarminPulseoxModel,
    IOT_GarminSleepsModel,
    IOT_GarminStressDetailsModel,
    IOT_GarminUserMetricsModel
};

