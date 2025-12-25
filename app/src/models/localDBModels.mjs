//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.08.28
//  Last updated: 2021.09.24
//////////////////////////////////////////////////////////////////////
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
// eldata
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
// elraw
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
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('elraw');



//////////////////////////////////////////////////////////////////////
// esm data (電力スマートメータ 解析後データ)
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
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('esmdata');


//////////////////////////////////////////////////////////////////////
// esm raw (電力スマートメータ 通信生データ)
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
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('esmraw');

//////////////////////////////////////////////////////////////////////
// Electric Energy
// 基本はスマートメータのデータ、他にはスマート分電盤や他のIoT機器による分電盤計測値等
const electricEnergyModel = canUseSequelizeSqlite ? sqlite3.define('ElectricEnergy', {
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
// hueraw
const huerawModel = canUseSequelizeSqlite ? sqlite3.define('huerawModel', {
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
}) : makeStubModel('huerawModel');



//////////////////////////////////////////////////////////////////////
// arpTable
const arpModel = canUseSequelizeSqlite ? sqlite3.define('arpTable', {
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
}) : makeStubModel('arpTable');

//////////////////////////////////////////////////////////////////////
// open weather map
const owmModel = canUseSequelizeSqlite ? sqlite3.define('owmTable', {
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
}) : makeStubModel('owmTable');


//////////////////////////////////////////////////////////////////////
// netatmo
const netatmoModel = canUseSequelizeSqlite ? sqlite3.define('netatmoTable', {
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
}) : makeStubModel('netatmoTable');


//////////////////////////////////////////////////////////////////////
// switchBot
const switchBotRawModel = canUseSequelizeSqlite ? sqlite3.define('switchBotRawTable', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    detail: {
        type: Sequelize.TEXT
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('switchBotRawTable');

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
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('switchBotDataTable');



//////////////////////////////////////////////////////////////////////
// IKEA
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
}) : makeStubModel('ikeaRawTable');


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
}) : makeStubModel('ikeaDataTable');




//////////////////////////////////////////////////////////////////////
// IOT_QuestionnaireAnswersModel
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
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_QuestionnaireAnswers');


//////////////////////////////////////////////////////////////////////
// IOT_MajorResultsModel
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
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_MajorResults');


//////////////////////////////////////////////////////////////////////
// IOT_MinorResultsModel
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
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('IOT_MinorResults');


//////////////////////////////////////////////////////////////////////
// IOT_MinorkeyMeansModel
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


//////////////////////////////////////////////////////////////////////
// roomEnv
const roomEnvModel = canUseSequelizeSqlite ? sqlite3.define('roomEnv', {
    id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    dateTime: {
        // type: Sequelize.DATE,
        type: 'TIMESTAMP',
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false
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
    light: {
        type: Sequelize.INTEGER
    },
    lightColor: {
        type: Sequelize.INTEGER
    },
    image: {
        type: Sequelize.TEXT
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('roomEnv');


//////////////////////////////////////////////////////////////////////
// userState
const userStateModel = canUseSequelizeSqlite ? sqlite3.define('userState', {
    id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    dateTime: {
        // type: Sequelize.DATE,
        type: 'TIMESTAMP',
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false
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
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('userState');


//////////////////////////////////////////////////////////////////////
// initial data
//////////////////////////////////////////////////////////////////////

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


// module.exports = {
// 	Sequelize, Op, sqlite3,
// 	eldataModel,
// 	elrawModel,
// 	esmdataModel,
// 	esmrawModel,
// 	electricEnergyModel,
// 	huerawModel,
// 	arpModel,
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
// jmaRaw
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
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('jmaRawTable');


//////////////////////////////////////////////////////////////////////
// jmaAbst
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
    }
}, {
    freezeTableName: true,
    timestamps: true
}) : makeStubModel('jmaAbstTable');


//////////////////////////////////////////////////////////////////////
// weatherForecast
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
}) : makeStubModel('weatherForecastTable');


//////////////////////////////////////////////////////////////////////
// popsForecast
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
}) : makeStubModel('popsForecastTable');


//////////////////////////////////////////////////////////////////////
// tempForecast
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
}) : makeStubModel('tempForecastTable');


export default {
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
    tempForecastModel
};
