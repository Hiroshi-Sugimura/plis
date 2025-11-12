//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2018.03.16
//  Last updated: 2021.09.25
//////////////////////////////////////////////////////////////////////
/**
 * @module main
 * @description PLISアプリケーションのメインプロセス
 * Electronアプリケーションの中核となるファイルで、UI（レンダラープロセス）と
 * 各種IoTデバイス・サービスとの連携を管理する
 */

// 基本ライブラリ - Electronの必要なモジュールをインポート
import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from 'electron';  // BrowserWindowを追加

// Node.js標準モジュール
import { fileURLToPath } from "node:url";
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';
import * as dateUtils from 'date-utils';  // 日付操作ユーティリティ

// 追加ライブラリ - Electronの設定とサードパーティライブラリ
app.disableHardwareAcceleration(); // GPU加速を無効化（安定性向上のため）
import Store from 'electron-store';  // 設定ファイルの永続化
import { objectSort, getNow, getToday, isObjEmpty, mergeDeeply } from './mainSubmodule.cjs';
import { default as openAboutWindow } from 'about-window';  // アプリケーション情報ダイアログ（ESモジュール対応）
import { sqlite3 } from './models/localDBModels.cjs';   // ローカルデータベース管理
// 各種機能モジュールのインポート
import { mainSystem } from './mainSystem.mjs';  // システム設定管理
import { mainAutoAssessment } from './mainAutoAssessment.mjs';  // 自動評価機能
import { mainUser } from './mainUser.mjs';     // ユーザー設定管理
import { mainArp } from './mainArp.mjs';     // ARPテーブル監視
import { mainEL } from './mainEL.mjs';      // ECHONET Lite通信管理
import { mainESM } from './mainESM.mjs'; // スマートメーター連携
import { mainHue } from './mainHue.mjs';     // Philips Hue照明制御
import { mainIkea } from './mainIkea.mjs';    // IKEA TRÅDFRIスマート照明制御
import { mainNetatmo } from './mainNetatmo.mjs';  // Netatmo気象ステーション
import { mainOwm } from './mainOwm.mjs';      // OpenWeatherMap天気予報API
import { mainOmron } from './mainOmron.mjs';    // オムロンUSBセンサー管理
import { mainHALlocal } from './mainHALlocal.mjs'; // HALローカルデータ処理
import { mainHALsync } from './mainHALsync.mjs';  // HALクラウド同期機能
import { mainJma } from './mainJma.mjs';    // 気象庁天気予報API
import { mainSwitchBot } from './mainSwitchBot.mjs'; // SwitchBotデバイス制御
import { mainCalendar } from './mainCalendar.mjs'; // カレンダー・祝日管理
import { mainCo2s } from './mainCo2s.mjs';  // CO2センサー（USB-UD-CO2）
import { mainGarminAdvice } from './mainGarminAdvice.mjs'; // 【新規追加】Garminアドバイス生成
import licenses from './modules.json' with { type: "json" };  // ライセンス情報

//////////////////////////////////////////////////////////////////////
// アプリケーション基本設定
// 開発環境と本番環境の切り替え、OS判定、パス設定などを行う
//////////////////////////////////////////////////////////////////////
const appname = 'PLIS';  // アプリケーション名
const isDevelopment = process.env.NODE_ENV === 'development';  // 開発モード判定
const appDir = isDevelopment ? __dirname : __dirname;  // 開発環境・本番環境のアプリディレクトリ
const isWin = process.platform === 'win32';  // Windows判定
const isMac = process.platform === 'darwin';  // macOS判定
const userHome = process.env[isWin ? "USERPROFILE" : "HOME"];  // ユーザーホームディレクトリ

// SQLite3データベースの保存先を環境に応じて設定
// 開発環境: Electronが提供するuserDataディレクトリ
// 本番環境: ユーザーホームディレクトリ配下
const databaseDir = isDevelopment ? 
    path.join(app.getPath('userData'), appname) : 
    path.join(userHome, appname);

//////////////////////////////////////////////////////////////////////
// グローバル変数定義
//////////////////////////////////////////////////////////////////////
/** Electronのメインウィンドウオブジェクト */
let mainWindow = null;

/** ローカルネットワークインターフェースのIPアドレス一覧 */
let localaddresses = [];

/** 
 * 管理対象デバイス・サービスのリスト
 * ユーザーが各デバイスに名前（エイリアス）を付けて管理
 * 形式: [{ type: '', id: '', ip: '', mac: '', alias: '' }]
 */
let managedThings = [];

/** 設定データの永続化ストレージ */
const store = new Store();

/** アプリケーション設定オブジェクト */
let config = {};

/** 一時的なデータ保存用オブジェクト */
let persist = {};

//////////////////////////////////////////////////////////////////////
// ローカル関数定義
//////////////////////////////////////////////////////////////////////
/**
 * @func sendIPCMessage
 * @desc メインプロセスからレンダラープロセスへのIPC通信を行う
 * UIの更新やデータ送信に使用される標準的な通信方法
 * @param {string} cmdStr - 送信するコマンド名
 * @param {string} argStr - コマンドに付随する引数データ
 */
let sendIPCMessage = function (cmdStr, argStr) {
    try {
        // メインウィンドウが存在し、WebContentsが利用可能な場合のみ送信
        if (mainWindow != null && mainWindow.webContents != null) {
            mainWindow.webContents.send('to-renderer', JSON.stringify({ cmd: cmdStr, arg: argStr }));
        }
    } catch (error) {
        console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.sendIPCMessage() error:\x1b[32m', error, '\x1b[0m');
        // 通信エラー時の緊急対応：ウィンドウをリロード（根本的な解決ではない暫定措置）
        mainWindow.reload();
    }
};

//////////////////////////////////////////////////////////////////////
// Electronレンダラープロセスとの通信処理
// UIからの操作要求を受信し、適切な処理を実行する
//////////////////////////////////////////////////////////////////////

// レンダラープロセス（UI）の準備完了通知を受信
ipcMain.handle('already', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- already') : 0;

    // UI準備完了後、各機能モジュールを開始
    sendIPCMessage("renewSystemConfigView", config);
    sendIPCMessage("renewUserConfigView", mainUser.getConfig());
    sendIPCMessage("renewLicenses", licenses);

    // 各種IoTデバイス・サービスの監視開始
    mainEL.start(sendIPCMessage, localaddresses);
    mainArp.start(sendIPCMessage);
    mainHue.start(sendIPCMessage);
    mainOwm.start(sendIPCMessage);
    mainJma.start(sendIPCMessage);
    mainNetatmo.start(sendIPCMessage);
    mainIkea.start(sendIPCMessage);
    mainESM.start(sendIPCMessage);
    mainOmron.start(sendIPCMessage);
    mainCo2s.start(sendIPCMessage);
    mainSwitchBot.start(sendIPCMessage);
    mainCalendar.start(sendIPCMessage);
    mainHALsync.start(sendIPCMessage);
    mainAutoAssessment.start(sendIPCMessage);

    // HALローカルの最新情報を取得してUIに送信
    persist.HAL = await mainHALlocal.getLastData();
    sendIPCMessage("HALRenewResponse", persist.HAL);
});

// 設定データの保存要求
ipcMain.handle('configSave', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- configSave, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    await saveConfig();
    sendIPCMessage("configSaved", 'All');  // 保存完了をUIに通知
});

// 外部ブラウザでURLを開く
ipcMain.handle('URLopen', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- URLopen, arg:', arg) : 0;
    shell.openExternal(arg);
});

// System / Calendar 祝日再取得
ipcMain.handle('CalendarRenewHolidays', async (event, arg) => {
    mainCalendar.getHolidays();
});

// System設定関連
ipcMain.handle('SystemSetConfig', (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- SystemSetConfig, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    config.screenMode = arg.screenMode;
    config.debug = arg.debug;
    config.ellogExpireDays = arg.ellogExpireDays;
    config.resultExpireDays = arg.resultExpireDays;
    config.IPver = arg.IPver;
    config.IPv4 = arg.IPv4;
    config.IPv6 = arg.IPv6;

    switch (config.screenMode) {
        case 'fullscreen':
            mainWindow.setFullScreen(true);
            break;
        case 'window':
        default:
            mainWindow.setFullScreen(false);
            break;
    }

    config.windowWidth = mainWindow.getSize()[0];
    config.windowHeight = mainWindow.getSize()[1];

    mainSystem.setConfig(arg);
});

// screen modeだけの変更
ipcMain.handle('ScreenMode', (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ScreenMode, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    config.screenMode = arg.screenMode;
    switch (config.screenMode) {
        case 'fullscreen':
            mainWindow.setFullScreen(true);
            break;
        case 'window':
        default:
            mainWindow.setFullScreen(false);
            break;
    }

    config.windowWidth = mainWindow.getSize()[0];
    config.windowHeight = mainWindow.getSize()[1];

    mainSystem.setConfig(config);
});

//----------------------------------
// Profile関連
ipcMain.handle('userProfileSave', (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- userProfileSave, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    mainUser.setConfig(arg);
});

//----------------------------------
// HAL関連
// HAL API トークン設定：APIトークンをセットして、実際にプロファイルを受信できたら設定値として保存
ipcMain.handle('HALsetApiTokenRequest', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- HALsetApiTokenRequest.') : 0;
    mainHALsync.setHalApiTokenRequest(arg);
});

// ローカルの HAL API トークン取得
ipcMain.handle('HALgetApiTokenRequest', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- HALgetApiTokenRequest token:\x1b[32m', mainHALsync.config.halApiToken, '\x1b[0m') : 0;
    sendIPCMessage("HALgetApiTokenResponse", mainHALsync.config.halApiToken);
});

// HAL API トークン設定削除
ipcMain.handle('HALdeleteApiToken', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- HALdeleteApiToken.') : 0;
    mainHALsync.deleteHalApiToken();
});

// HAL同期ボタンとその応答
ipcMain.handle('HALSyncRequeset', (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- HALSyncRequeset.') : 0;
    mainHALsync.startSync();
});

// HAL cloud ユーザープロファイル取得
ipcMain.handle('HALgetUserProfileRequest', (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- HALgetUserProfileRequest.') : 0;
    mainHALsync.getHalUserProfileRequest();
});

// HAL local更新
ipcMain.handle('HALrenew', async (event, arg) => {
    persist.HAL = await mainHALlocal.getLastData();
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- HALrenew, halData: <skip>') : 0;
    sendIPCMessage("HALRenewResponse", persist.HAL);
});

// HAL local アンケート保存
ipcMain.handle('HALsubmitQuestionnaire', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- HALsubmitQuestionnaire, arg:', arg) : 0;
    mainHALlocal.submitQuestionnaire(arg,
        () => { sendIPCMessage('Info', 'アンケートを保存しました。'); },
        () => { sendIPCMessage('Error', { datetime: new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), moduleName: 'main', stackLog: error.message }); });
});

//----------------------------------
// AutoAssessment関連
ipcMain.handle('AutoAssessmentConfig', (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- AutoAssessmentConfig, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    mainAutoAssessment.setConfig(arg);
});

//----------------------------------
// EL関連
ipcMain.handle('ELUse', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ELUse, arg:', arg) : 0;
    await mainEL.setConfig({ enabled: true });
    mainEL.start(sendIPCMessage, localaddresses);
});

ipcMain.handle('ELStop', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ELStop, arg', arg) : 0;
    await mainEL.setConfig({ enabled: false });
    mainEL.stop();
});

ipcMain.handle('ELUseOldSearch', (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ELUseOldSearch, arg:', arg) : 0;
    mainEL.setConfig({ oldSearch: true });
});

ipcMain.handle('ELStopOldSearch', (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ELStopOldSearch, arg', arg) : 0;
    mainEL.setConfig({ oldSearch: false });
});

ipcMain.handle('Elsend', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- Elsend, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    mainEL.sendMsg(arg.ip, arg.msg);
});

ipcMain.handle('ElsendOPC1', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ElsendOPC1, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    mainEL.sendOPC1(arg.ip, arg.seoj, arg.deoj, arg.esv, arg.epc, arg.edt);
});

ipcMain.handle('ELSearch', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ELSearch.') : 0;
    mainEL.search();
});

//----------------------------------
// ESM関連
ipcMain.handle('ESMUse', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ESMUse, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    arg.enabled = true;
    arg.connected = false;
    arg.EPANDESC = {};
    await mainESM.setConfig(arg);
    mainESM.start(sendIPCMessage);
});

ipcMain.handle('ESMnotUse', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ESMnotUse, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    arg.enabled = false;
    await mainESM.setConfig(arg);
    await mainESM.stop();
});

//----------------------------------
// Hue関連
ipcMain.handle('HueUse', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- HueUse, key:\x1b[32m', arg.key, '\x1b[0m') : 0;
    arg.enabled = true;
    await mainHue.setConfig(arg);
    mainHue.start(sendIPCMessage);
});

ipcMain.handle('HueUseCancel', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- HueUseCancel, key:\x1b[32m', arg.key, '\x1b[0m') : 0;
    arg.enabled = false;
    await mainHue.setConfig(arg);
    await mainHue.stop();
});

ipcMain.handle('HueUseStop', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- HueUseStop, key:\x1b[32m', arg.key, '\x1b[0m') : 0;
    arg.enabled = false;
    await mainHue.setConfig(arg);
    await mainHue.stop();
});

ipcMain.handle('HueControl', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- HueControl, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    mainHue.control(arg.url, JSON.stringify(arg.json));
});

//----------------------------------
// Ikea 関連
ipcMain.handle('IkeaUse', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- IkeaUse, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    arg.enabled = true;
    await mainIkea.setConfig(arg);
    mainIkea.start(sendIPCMessage);
});

ipcMain.handle('IkeaUseStop', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- IkeaUseStop, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    arg.enabled = false;
    await mainIkea.setConfig(arg);
    await mainIkea.stop();
});

ipcMain.handle('IkeaSend', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- IkeaSend, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    mainIkea.control(arg.key, arg.type, arg.command);
});

//----------------------------------
// Open Weather Map関連
ipcMain.handle('OwmUse', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- OwmUse, key:\x1b[32m', arg.APIKey, '\x1b[0mzipCode:\x1b[32m', arg.zipcode, '\x1b[0m') : 0;
    arg.enabled = true;
    await mainOwm.setConfig(arg);
    mainOwm.start(sendIPCMessage);
});

ipcMain.handle('OwmStop', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- OwmStop, key:\x1b[32m', arg.APIKey, '\x1b[0mzipCode:\x1b[32m', arg.zipcode, '\x1b[0m') : 0;
    arg.enabled = false;
    await mainOwm.setConfig(arg);
    mainOwm.stop();
});

//----------------------------------
// JMA関連
ipcMain.handle('JmaConfigSave', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- JmaConfigSave, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    await mainJma.setConfig(arg);
    mainJma.gets();
});

//----------------------------------
// Netatmo関連
ipcMain.handle('NetatmoUse', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- NetatmoUse, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    arg.enabled = true;
    await mainNetatmo.setConfig(arg);
    mainNetatmo.start(sendIPCMessage);
});

ipcMain.handle('NetatmoStop', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- NetatmoStop, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    arg.enabled = false;
    await mainNetatmo.setConfig(arg);
    mainNetatmo.stop();
});

//----------------------------------
// Omron関連
ipcMain.handle('OmronUse', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- OmronUse, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    arg.enabled = true;
    await mainOmron.setConfig(arg);
    mainOmron.start(sendIPCMessage);
});

ipcMain.handle('OmronStop', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- OmronStop, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    arg.enabled = false;
    await mainOmron.setConfig(arg);
    mainOmron.stop();
});

//----------------------------------
// I/O DATA CO2S関連
ipcMain.handle('Co2sUse', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- Co2sUse, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    arg.enabled = true;
    await mainCo2s.setConfig(arg);
    mainCo2s.start(sendIPCMessage);
});

ipcMain.handle('Co2sStop', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- Co2sStop, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    arg.enabled = false;
    await mainCo2s.setConfig(arg);
    mainCo2s.stop();
});

//----------------------------------
// SwitchBot関連
ipcMain.handle('SwitchBotUse', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- SwitchBotUse, token:\x1b[32m', arg.token, '\x1b[0m') : 0;
    arg.enabled = true;
    await mainSwitchBot.setConfig(arg);
    mainSwitchBot.start(sendIPCMessage);
});

ipcMain.handle('SwitchBotStop', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- SwitchBotStop, token:\x1b[32m', arg.token, '\x1b[0m') : 0;
    arg.enabled = false;
    await mainSwitchBot.setConfig(arg);
    await mainSwitchBot.stop();
});

ipcMain.handle('SwitchBotControl', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- SwitchBotControl, arg:\x1b[32m', arg, '\x1b[0m') : 0;
    mainSwitchBot.control(arg.id, arg.command, arg.param);
});

//----------------------------------
// 【新規追加】Garminアドバイス関連
//----------------------------------

/**
 * @func getGarminAdvice
 * @desc Garminデータとアンケートに基づくアドバイス生成
 * アンケート回答と各種Garminヘルスデータ（睡眠、活動、ストレス）を組み合わせて
 * ユーザー個別の健康アドバイスを生成する
 * @param {Object} arg - { date?: string } 対象日付（省略時は今日）
 * @return {void} sendIPCMessage経由でUIにアドバイスを送信
 */
ipcMain.handle('getGarminAdvice', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- getGarminAdvice, arg:', arg) : 0;
    
    try {
        // 対象日付の決定（引数がない場合は今日）
        const date = arg?.date || getToday();
        
        // アドバイス生成処理を実行
        const advices = await mainGarminAdvice.generateAdvice(date);
        
        // 生成されたアドバイスをUIに送信
        sendIPCMessage("showGarminAdvice", advices);
        
        // デバッグモード時：生成されたアドバイスの件数をログ出力
        if (config.debug) {
            const adviceCount = 
                (advices.sleep?.length || 0) + 
                (advices.activity?.length || 0) + 
                (advices.stress?.length || 0) +
                (advices.overall?.length || 0);
            
            console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), 
                '| main.ipcMain -> getGarminAdvice success, total advice count:', adviceCount,
                '(sleep:', advices.sleep?.length || 0,
                ', activity:', advices.activity?.length || 0,
                ', stress:', advices.stress?.length || 0,
                ', overall:', advices.overall?.length || 0, ')');
        }
        
    } catch (error) {
        // エラー発生時のログ出力とUI通知
        console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), 
            '| main.ipcMain getGarminAdvice error:', error);
        console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), 
            '| Error stack:', error.stack);
        
        // UIにエラーメッセージを送信
        sendIPCMessage('Error', { 
            datetime: getToday(), 
            moduleName: 'GarminAdvice', 
            stackLog: error.message 
        });
    }
});

//////////////////////////////////////////////////////////////////////
// foreground
// ここがEntrypointと考えても良い
/**
 * @func createWindow
 * @desc メインウィンドウと3Dウィンドウを作成し、アプリケーションUIを初期化する
 * Electronのブラウザウィンドウを構築し、HTMLをロードする
 * @async
 * @param {void}
 * @return {void}
 * @throw {Error} ウィンドウ作成時のエラー
 */
async function createWindow() {
    try {
        // メインウィンドウ作成
        mainWindow = new BrowserWindow({
            fullscreen: config ? config.screenMode == 'fullscreen' : false,
            width: config.windowWidth,
            height: config.windowHeight,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: false,
                worldSafeExecuteJavaScript: true,
                preload: path.join(__dirname, 'preload.js')
            },
            icon: path.join(__dirname, "assets/icon.png")
        });
        menuInitialize();
        mainWindow.loadFile(path.join(__dirname, 'public', 'index.htm'));

        if (config.debug) {
            mainWindow.webContents.openDevTools();
        }

        mainWindow.webContents.on('found-in-page', (event, result) => {
            if (result.finalUpdate) {
                mainWindow.webContents.stopFindInPage('keepSelection');
                sendIPCMessage('foundResultShow', result);
            }
        });

        mainWindow.on('close', async () => {
            config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.on.close') : 0;
            config.windowWidth = mainWindow.getSize()[0];
            config.windowHeight = mainWindow.getSize()[1];
            await mainSystem.setConfig(config);
        });

        mainWindow.on('closed', () => {
            console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.on.closed');
            mainWindow = null;
        });

        // SQLite のデータベースのレコードの削除処理
        await mainHALlocal.truncatelogs();

    } catch (error) {
        console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.createWindow() error:\x1b[32m', error, '\x1b[0m');
    }
};

//=============================================================================
// 起動
// ready: Electronの初期化完了後に実行される
// activate: Mac only, MacはWindowが無くてもプロセスを終了しないでおいておくことができ、その際の再度起動の時よばれる
// did-become-active: Mac only

// windows用デスクトップとスタートメニューにショートカットを追加する
// if (require('electron-squirrel-startup')) return;

// Entry point
app.on('ready', async () => {
    console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '----------', appname, '----------');
    
    console.log('========================================');
    console.log('🔍 Checking mainGarminAdvice import...');
    console.log('mainGarminAdvice type:', typeof mainGarminAdvice);
    console.log('mainGarminAdvice.generateAdvice type:', typeof mainGarminAdvice?.generateAdvice);
    console.log('========================================');
    
    try {
        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 1: Starting initialization');
        
        // 開発環境での詳細ログ出力
        if (isDevelopment) {
            console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Development mode detected');
            console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| App directory:', appDir);
            console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Database directory:', databaseDir);
            console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| User home:', userHome);
            console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Electron userData path:', app.getPath('userData'));
        }

        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 2: Checking single instance lock');
        
        // 二重起動防止
        const lock = app.requestSingleInstanceLock();
        if (lock) {
            console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 3: Lock acquired successfully');
            app.on('second-instance', (event, args) => {
                if (mainWindow === null) return;
                if (mainWindow.isMinimized()) { mainWindow.restore(); }
                mainWindow.focus();
            });
        } else {
            console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 3: Lock failed, another instance running');
            await app.quit();
            return;
        }

        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 4: Starting mainSystem');
        await mainSystem.start(sendIPCMessage);
        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 5: mainSystem started successfully');
        
        config = mainSystem.getConfig();
        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 6: Config loaded');

        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 7: Starting mainUser');
        await mainUser.start(sendIPCMessage);
        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 8: mainUser started successfully');

        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 9: Loading persist data');
        persist = await store.get('persist', persist);
        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 10: Persist data loaded');

        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 11: Gathering network interfaces');
        let interfaces = os.networkInterfaces();
        for (let k in interfaces) {
            for (let k2 in interfaces[k]) {
                let address = interfaces[k][k2];
                if (address.family == 'IPv4' && !address.internal) {
                    localaddresses.push(address.address);
                }
            }
        }
        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 12: Network interfaces gathered');

        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 13: Initializing HAL local database');
        await mainHALlocal.initialize();
        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 14: HAL local database initialized');

        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 15: Starting SQLite sync');
        await sqlite3.sync().then(() => {
            config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.on.ready. Local lifelog DB is ready.') : 0;
        });
        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 16: SQLite sync completed');

        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 16.5: Testing database connection');
        try {
            const testData = await mainHALlocal.getLastData();
            console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| HAL database test: SUCCESS');
            
            const tables = await sqlite3.query("SELECT name FROM sqlite_master WHERE type='table'", { type: sqlite3.QueryTypes.SELECT });
            console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| SQLite3 tables:', tables.map(t => t.name));
            console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| SQLite3 connection test: SUCCESS');
            
            if (fs.existsSync(databaseDir)) {
                const files = fs.readdirSync(databaseDir);
                console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Database directory files:', files);
            } else {
                console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Database directory does not exist, creating...');
                fs.mkdirSync(databaseDir, { recursive: true });
            }
            
        } catch (dbError) {
            console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Database test FAILED:', dbError);
            console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Database error details:', dbError.message);
        }

        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 17: Creating main window');
        createWindow();
        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| Step 18: Application startup completed');

    } catch (error) {
        console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| ERROR in app.ready:', error);
        console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| ERROR stack:', error.stack);
    }
});

// アプリケーションがアクティブになった時の処理（Mac only）
app.on("activate", () => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.on.activate') : 0;
    if (mainWindow === null) {
        createWindow();
    }
});

//=============================================================================
// 通常終了（Windowが全て閉じられたのでアプリ終了とする場合）
// window-all-closed -> before-quit -> will-quit -> quit -> BrowserWindow.closed
// 強制終了、外部要因からの終了（終了命令がきたので、Windowを閉じて終了とする場合）
// before-quit -> window-all-closed -> will-quit -> quit -> BrowserWindow.closed

// windowが全部閉じられた、SIGTERM, SIGINTの場合はbefore-quitがこれより先に動く
app.on('window-all-closed', () => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.on.window-all-closed') : 0;
    app.quit();	// macだろうとプロセスはkillしちゃう
});

// アプリを終了する直前、app.quitが呼ばれたときに動く
app.once('before-quit', async () => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.on.before-quit') : 0;
    await saveConfig();
    await savePersist();

    await mainArp.stopWithoutSave();
    await mainEL.stopWithoutSave();
    await mainESM.stopWithoutSave();
    await mainHue.stopWithoutSave();
    await mainNetatmo.stopWithoutSave();
    await mainOwm.stopWithoutSave();
    await mainJma.stopWithoutSave();
    await mainOmron.stopWithoutSave();
    await mainCo2s.stopWithoutSave();
    await mainIkea.stopWithoutSave();
    await mainSwitchBot.stopWithoutSave();
    await mainCalendar.stopWithoutSave();
    await mainUser.stop();
    await mainSystem.stop();
});

// 終了する直前、quitの前
app.once('will-quit', async () => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.on.will-quit') : 0;
});

// 終了処理、quitのあとBrowserWindow.closedが本当の最後に呼ばれる
app.once('quit', async () => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.on.quit') : 0;
});

// menu
const menuItems = [
    {
        label: appname,
        submenu: [
            {
                label: 'Show your database',
                accelerator: isMac ? 'Command+s' : 'Control+s',
                click: async function () { shell.showItemInFolder(databaseDir); }
            },
            {
                label: 'Preferences...',
                accelerator: isMac ? 'Command+,' : 'Control+,',
                click: async function () {
                    await saveConfig();
                    sendIPCMessage("configSaved", 'All');
                    shell.showItemInFolder(store.path);
                }
            },
            { type: "separator" },
            {
                label: 'Quit',
                accelerator: isMac ? 'Command+Q' : 'Alt+F4',
                click: function () { app.quit(); }
            }]
    }, {
        label: 'Edit',
        submenu: [
            {
                label: 'Cut',
                accelerator: isMac ? 'Command+X' : 'Control+X',
                selector: 'cut:'
            },
            {
                label: 'Copy',
                accelerator: isMac ? 'Command+C' : 'Control+C',
                selector: 'copy:'
            },
            {
                label: 'Paste',
                accelerator: isMac ? 'Command+V' : 'Control+V',
                selector: 'paste:'
            },
            { type: "separator" },
            {
                label: "Undo",
                accelerator: isMac ? 'Command+Z' : 'Control+Z',
                selector: "undo:"
            },
            {
                label: "Redo",
                accelerator: isMac ? 'Shift+Command+Z' : 'Shift+Control+Z',
                selector: "redo:"
            },
            {
                label: "Select All",
                accelerator: isMac ? 'Command+A' : 'Control+A',
                selector: "selectAll:"
            },
            { type: "separator" },
            {
                label: 'Search in page',
                accelerator: isMac ? 'Command+F' : 'Control+F',
                click: function (item, focusedWindow) { sendIPCMessage("openSearch", '') }
            }
        ]
    }, {
        label: 'View',
        submenu: [
            {
                label: 'Reload',
                accelerator: isMac ? 'Command+R' : 'Control+R',
                click: function (item, focusedWindow) { if (focusedWindow) focusedWindow.reload() }
            },
            {
                label: 'Toggle Full Screen',
                accelerator: isMac ? 'Ctrl+Command+F' : 'F11',
                click: function () { mainWindow.setFullScreen(!mainWindow.isFullScreen()); }
            },
            { type: "separator" },
            {
                label: 'Zoom (+)',
                accelerator: isMac ? 'Command+plus' : 'Control+plus',
                click: function () { mainWindow.webContents.setZoomFactor(mainWindow.webContents.getZoomFactor() + 0.1); }
            },
            {
                label: 'Zoom (-)',
                accelerator: isMac ? 'Command+-' : 'Control+-',
                click: function () {
                    if (mainWindow.webContents.getZoomFactor() >= 0.2) {
                        mainWindow.webContents.setZoomFactor(mainWindow.webContents.getZoomFactor() - 0.1);
                    } else {
                        sendIPCMessage('Error', { datetime: new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), moduleName: 'main', stackLog: 'Minimum zoom' });
                    }
                }
            },
            {
                label: 'Zoom (Reset)',
                accelerator: isMac ? 'Command+0' : 'Control+0',
                click: function () { mainWindow.webContents.setZoomFactor(1); }
            },
            {
                label: 'Create shortcut',
                click: function () { createShortCut(); }
            }]
    }, {
        label: 'Information',
        submenu: [
            {
                label: 'About PLIS',
                click: function () {
                    openAboutWindow({
                        icon_path: path.join(__dirname, 'icons', 'plis_linux_icon.png'),
                        copyright: 'Copyright (c) 2023 Sugimura Lab.',
                        package_json_dir: __dirname
                    });
                }
            },
            {
                label: 'About PLIS (External contents)',
                click: function () { shell.openExternal('https://plis.sugi-lab.net/'); }
            },
            {
                label: 'User manual (External contents)',
                click: function () { shell.openExternal('https://plis.sugi-lab.net/userManual.html'); }
            },
            {
                label: 'Developper manual (External contents)',
                click: function () { shell.openExternal('https://hiroshi-sugimura.github.io/plis//v1/docs/jsdoc/'); }
            },
            {
                label: 'Terms (External contents)',
                click: function () { shell.openExternal('https://plis.sugi-lab.net/terms.html'); }
            },
            {
                label: 'Privacy Policy (External contents)',
                click: function () { shell.openExternal('https://plis.sugi-lab.net/privacyPolicy.html'); }
            },
            {
                label: 'EURA (External contents)',
                click: function () { shell.openExternal('https://plis.sugi-lab.net/eula.html'); }
            },
            { type: "separator" },
            {
                label: 'Developer Tools',
                accelerator: isMac ? 'Ctrl+Command+I' : 'Control+Shift+I',
                click: function () { mainWindow.toggleDevTools(); }
            }
        ]
    }];

/**
 * @func menuInitialize
 * @desc アプリケーションメニューを初期化
 * @async
 * @param {void}
 * @return void
 * @throw error
 */
function menuInitialize() {
    let menu = Menu.buildFromTemplate(menuItems);
    Menu.setApplicationMenu(menu);
    mainWindow.setMenu(menu);
};

/**
 * @func createShortCut
 * @desc デスクトップにショートカット作成、スタートメニューに登録
 * @async
 * @param {void}
 * @return void
 * @throw error
 */
function createShortCut() {
    if (isWin) {
        let dist = path.join(userHome, 'Desktop', 'PLIS.lnk');
        let source = path.join(userHome, 'AppData', 'Local', 'PLIS', 'PLIS.exe');

        let command = `$WshShell = New-Object -ComObject WScript.Shell; $ShortCut = $WshShell.CreateShortcut("${dist}"); $ShortCut.TargetPath = "${source}"; $ShortCut.Save();`;

        exec(command, { "shell": "powershell.exe" }, (error, stdout, stderror) => {
            if (error) {
                console.error(error);
            }
        });
    } else {
        console.log('not Win');
    }
};

/**
 * @func saveConfig
 * @desc 各モジュールの設定を保存
 * @async
 * @param {void}
 * @return void
 * @throw error
 */
async function saveConfig() {
    let _config = {};
    _config.system = mainSystem.getConfig();
    _config.HAL = mainHALsync.getConfig();
    _config.Hue = mainHue.getConfig();
    _config.Ikea = mainIkea.getConfig();
    _config.OWM = mainOwm.getConfig();
    _config.ESM = mainESM.getConfig();
    _config.Netatmo = mainNetatmo.getConfig();
    _config.EL = mainEL.getConfig();
    _config.Omron = mainOmron.getConfig();
    _config.Co2s = mainCo2s.getConfig();
    _config.JMA = mainJma.getConfig();
    _config.SwitchBot = mainSwitchBot.getConfig();
    _config.Calendar = mainCalendar.getConfig();
    _config.AutoAssessment = mainAutoAssessment.getConfig();
    _config.system = mainSystem.getConfig();
    _config.user = mainUser.getConfig();
    await store.set('config', _config);
};

/**
 * @func savePersist
 * @desc 各モジュールの永続データを保存
 * @async
 * @param {void}
 * @return void
 * @throw error
 */
async function savePersist() {
    persist.Arp = mainArp.getPersist();
    persist.EL = mainEL.getPersist();
    persist.ESM = mainESM.getPersist();
    persist.Hue = mainHue.getPersist();
    persist.Netatmo = mainNetatmo.getPersist();
    persist.OWM = mainOwm.getPersist();
    persist.JMA = mainJma.getPersist();
    persist.Omron = mainOmron.getPersist();
    persist.Co2s = mainCo2s.getPersist();
    persist.Ikea = mainIkea.getPersist();
    persist.SwitchBot = mainSwitchBot.getPersist();
    persist.HAL = mainHALsync.getPersist();
    await store.set('persist', persist);
};

// デバッグ・診断機能
ipcMain.handle('DatabaseStatus', async (event, arg) => {
    config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- DatabaseStatus') : 0;
    
    try {
        const status = {
            sqlite3: false,
            halLocal: false,
            databasePath: databaseDir,
            storePath: store.path,
            timestamp: new Date().toFormat("YYYY-MM-DDTHH24:MI:SS")
        };
        
        // SQLite3接続テスト
        try {
            const tables = await sqlite3.query("SELECT name FROM sqlite_master WHERE type='table'", { type: sqlite3.QueryTypes.SELECT });
            status.sqlite3 = true;
            status.sqlite3Tables = tables.map(t => t.name);
        } catch (e) {
            status.sqlite3Error = e.message;
        }
        
        // HALローカルデータベーステスト
        try {
            const lastData = await mainHALlocal.getLastData();
            status.halLocal = true;
            status.halLocalRecords = lastData ? Object.keys(lastData).length : 0;
        } catch (e) {
            status.halLocalError = e.message;
        }
        
        // ファイルシステムの確認
        try {
            if (fs.existsSync(databaseDir)) {
                const files = fs.readdirSync(databaseDir);
                status.databaseFiles = files;
            } else {
                status.databaseDirExists = false;
            }
        } catch (e) {
            status.fileSystemError = e.message;
        }
        
        // 結果をコンソールに出力（デバッグ用）
        console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| DatabaseStatus result:', JSON.stringify(status, null, 2));
        
        // UIに結果を送信
        sendIPCMessage("DatabaseStatusResponse", status);
        
        return status;
        
    } catch (error) {
        console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| DatabaseStatus error:', error);
        throw error;
    }
});
