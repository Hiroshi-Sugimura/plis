//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2018.03.16
//  Last updated: 2021.09.25
//////////////////////////////////////////////////////////////////////
/**
 * @module main
 */

'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');
require('date-utils'); // for log
const { objectSort, getNow, getToday, isObjEmpty, mergeDeeply } = require('./mainSubmodule');


//////////////////////////////////////////////////////////////////////
// 基本設定，electronのファイル読み込み対策，developmentで変更できるようにした（けどつかってない）
const appname = 'PLIS';
const appDir = process.env.NODE_ENV === 'development' ? __dirname : __dirname;
const isWin = process.platform == "win32" ? true : false;
const isMac = process.platform == "darwin" ? true : false;
const userHome = process.env[isWin ? "USERPROFILE" : "HOME"];
const isDevelopment = process.env.NODE_ENV == 'development'
const databaseDir = path.join(userHome, appname);  // SQLite3ファイルの置き場

//////////////////////////////////////////////////////////////////////
// 追加ライブラリ
const { app, BrowserWindow, ipcMain, Menu, shell, clipboard } = require('electron');
app.disableHardwareAcceleration(); // electron設定とmain window
const Store = require('electron-store');

const openAboutWindow = require('about-window').default;  // このアプリについて

const { sqlite3 } = require('./models/localDBModels');   // DBデータと連携
const mainSystem = require('./mainSystem');  // System configの管理
const mainAutoAssessment = require('./mainAutoAssessment');  // 成績付け
const mainUser = require('./mainUser');     // User configの管理
const mainArp = require('./mainArp');     // arpの管理
const mainEL = require('./mainEL');      // ELの管理
const mainESM = require('./mainESM'); // スマートメータの管理
const mainHue = require('./mainHue');     // hueの管理
const mainIkea = require('./mainIkea');    // Ikeaの管理
const mainNetatmo = require('./mainNetatmo');  // netatmoの管理
const mainOwm = require('./mainOwm');      // open weather mapの管理
const mainOmron = require('./mainOmron');    // Omron/USBの管理
const mainHALlocal = require('./mainHALlocal'); // HAL，独立で動く部分
const mainHALsync = require('./mainHALsync');  // HAL，連携する部分
const mainJma = require('./mainJma');    // 天気予報、気象庁
const mainSwitchBot = require('./mainSwitchBot'); // SwitchBot
const mainCalendar = require('./mainCalendar'); // カレンダー準備
const mainCo2s = require('./mainCo2s');  // usb-ud-co2センサー
const licenses = require('./modules.json');  // モジュールのライセンス

/** electronのmain window */
let mainWindow = null;

/** NICリスト */
let localaddresses = [];

/** 管理しているデバイスやサービスのリストにユーザが名前を付けたい */
// [{ type: '', id: '', ip: '', mac: '', alias, '' }]
let managedThings = [];

const store = new Store();

/** config */
let config = {};

/** persist */
let persist = {};

//////////////////////////////////////////////////////////////////////
// local function
//////////////////////////////////////////////////////////////////////
/**
 * @func
 * @desc IPC通信の定式
 * @param {string} cmdStr
 * @param {string} argStr
 */
let sendIPCMessage = function (cmdStr, argStr) {
	try {
		if (mainWindow != null && mainWindow.webContents != null) {
			mainWindow.webContents.send('to-renderer', JSON.stringify({ cmd: cmdStr, arg: argStr }));
		}
	} catch (error) {
		console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.sendIPCMessage() error:\x1b[32m', error, '\x1b[0m');
		mainWindow.reload();  // sendIPCMessage がミスする。本来はミスの原因を直す必要があるが、ここでは暫定で対応
	}
};

//////////////////////////////////////////////////////////////////////
// Communication for Electron's Renderer process
//////////////////////////////////////////////////////////////////////
// PLIS全体

// Renderer準備完了
ipcMain.handle('already', async (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- already') : 0;

	// 起動したので機能スタート
	sendIPCMessage("renewSystemConfigView", config);
	sendIPCMessage("renewUserConfigView", mainUser.getConfig());
	sendIPCMessage("renewLicenses", licenses);

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

	persist.HAL = await mainHALlocal.getLastData();
	sendIPCMessage("HALRenewResponse", persist.HAL);
});


// 設定保存
ipcMain.handle('configSave', async (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- configSave, arg:\x1b[32m', arg, '\x1b[0m') : 0;
	// await HALConfigSave(  );  // ここまだ
	await saveConfig();
	sendIPCMessage("configSaved", 'All');  // 保存したので画面に通知
});

// URLを外部ブラウザで開く
ipcMain.handle('URLopen', async (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- URLopen, arg:', arg) : 0;
	shell.openExternal(arg);
});


// ページ内検索
ipcMain.handle('PageInSearch', (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- PageInSearch, arg:', arg) : 0;
	try {
		const requestId = mainWindow.webContents.findInPage(arg, {
			forward: true,
			findNext: false,
			matchCase: false
		});
	} catch (error) {
		sendIPCMessage('Error', { datetime: new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), moduleName: 'main.PageInSearch', stackLog: error.message });
	}
});

ipcMain.handle('PageInSearchNext', (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- PageInSearchNext, arg:', arg) : 0;
	const requestId = mainWindow.webContents.findInPage(arg, {
		forward: true,
		findNext: true,
		matchCase: false
	});
});

ipcMain.handle('PageInSearchPrev', (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- PageInSearchPrev, arg:', arg) : 0;
	const requestId = mainWindow.webContents.findInPage(arg, {
		forward: false,
		findNext: true,
		matchCase: false
	});
});

ipcMain.handle('PageInSearchStop', (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- PageInSearchStop') : 0;
	mainWindow.webContents.stopFindInPage('clearSelection');
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
	// config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- HALrenew, halData:', persist.HAL) : 0;
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
// EL関連
ipcMain.handle('ELUse', async (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ELUse, arg:', arg) : 0;
	await mainEL.setConfig({ enabled: true });  // arg = undef
	mainEL.start(sendIPCMessage, localaddresses);
});

ipcMain.handle('ELStop', async (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ELStop, arg', arg) : 0;
	await mainEL.setConfig({ enabled: false });  // arg = undef
	mainEL.stop();
});

ipcMain.handle('ELUseOldSearch', (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ELUseOldSearch, arg:', arg) : 0;
	mainEL.setConfig({ oldSearch: true });  // arg = undef
});

ipcMain.handle('ELStopOldSearch', (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ELStopOldSearch, arg', arg) : 0;
	mainEL.setConfig({ oldSearch: false });  // arg = undef
});

ipcMain.handle('Elsend', async (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- Elsend, arg:\x1b[32m', arg, '\x1b[0m') : 0;
	mainEL.sendMsg(arg.ip, arg.msg);
})

// arg = {ip, seoj, deoj, esv, epc, edt}
ipcMain.handle('ElsendOPC1', async (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ElsendOPC1, arg:\x1b[32m', arg, '\x1b[0m') : 0;
	mainEL.sendOPC1(arg.ip, arg.seoj, arg.deoj, arg.esv, arg.epc, arg.edt);
})

ipcMain.handle('ELSearch', async (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ELSearch.') : 0;
	mainEL.search();
})


//----------------------------------
// ESM関連
// スマートメータ利用開始
ipcMain.handle('ESMUse', async (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ESMUse, arg:\x1b[32m', arg, '\x1b[0m') : 0;
	// 他の設定もあるので config.ESM = c.arg への置き換えは不可
	arg.enabled = true;
	arg.connected = false;  // 再設定のために，接続経験なしにする
	arg.EPANDESC = {};  // 再設定のために，接続経験なしにする
	await mainESM.setConfig(arg);
	mainESM.start(sendIPCMessage);
});

// スマートメータ利用停止
ipcMain.handle('ESMnotUse', async (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- ESMnotUse, arg:\x1b[32m', arg, '\x1b[0m') : 0;
	arg.enabled = false;
	await mainESM.setConfig(arg);
	await mainESM.stop();
});

//----------------------------------
// Hue関連
// Hue利用開始
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

// Hue関係のコントロール
ipcMain.handle('HueControl', async (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- HueControl, arg:\x1b[32m', arg, '\x1b[0m') : 0;
	mainHue.control(arg.url, JSON.stringify(arg.json));
})

//----------------------------------
// Ikea 関連
// Ikea 利用開始
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

// Ikea関係のコントロール
ipcMain.handle('IkeaSend', async (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- IkeaSend, ip:\x1b[32m', 'out of control', '\x1b[0marg:\x1b[32m', arg, '\x1b[0m') : 0;
})

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
	mainJma.gets();  // エリアが変わったかもしれないので一回getする
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
	await mainOmron.setConfig(arg); // Omron
	mainOmron.start(sendIPCMessage);
});

ipcMain.handle('OmronStop', async (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- OmronStop, arg:\x1b[32m', arg, '\x1b[0m') : 0;
	arg.enabled = false;
	await mainOmron.setConfig(arg); // Omron
	mainOmron.stop();
});

//----------------------------------
// I/O DATA CO2S関連
ipcMain.handle('Co2sUse', async (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- Co2sUse, arg:\x1b[32m', arg, '\x1b[0m') : 0;
	arg.enabled = true;
	await mainCo2s.setConfig(arg); // Omron
	mainCo2s.start(sendIPCMessage);
});

ipcMain.handle('Co2sStop', async (event, arg) => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- Co2sStop, arg:\x1b[32m', arg, '\x1b[0m') : 0;
	arg.enabled = false;
	await mainCo2s.setConfig(arg); // Co2s
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


//////////////////////////////////////////////////////////////////////
// foreground
// ここがEntrypointと考えても良い
/**
 * @func createWindow
 * @desc Add two numbers together. (JSDoc test)
 * @param {number} a - The first number. (JSDoc test)
 * @param {number} b - The second number. (JSDoc test)
 * @returns {number} The sum of the two numbers. (JSDoc test)
 */
async function createWindow() {
	try {
		mainWindow = new BrowserWindow({
			fullscreen: config ? config.screenMode == 'fullscreen' : false,
			width: config.windowWidth,
			height: config.windowHeight,
			webPreferences: {
				nodeIntegration: false, // default:false
				contextIsolation: true, // default:true
				worldSafeExecuteJavaScript: true,
				preload: path.join(__dirname, 'preload.js')
			},
			icon: path.join(__dirname, "assets/icon.png")
		});
		menuInitialize();
		// mainWindow.loadURL(path.join(__dirname, 'public', 'index.htm'));  // MacだとloadURL聞かない
		mainWindow.loadFile(path.join(__dirname, 'public', 'index.htm'));

		if (config.debug) { // debugモード:true ならDebugGUIひらく
			mainWindow.webContents.openDevTools();
		}

		// PageInSearchして発見したときに呼ばれる
		mainWindow.webContents.on('found-in-page', (event, result) => {
			// console.log('event:', event, 'result:', result);
			if (result.finalUpdate) {
				mainWindow.webContents.stopFindInPage('keepSelection');
				sendIPCMessage('foundResultShow', result);
			}
		});

		// 閉じるときに呼ばれる
		mainWindow.on('close', async () => {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.on.close') : 0;
			config.windowWidth = mainWindow.getSize()[0];
			config.windowHeight = mainWindow.getSize()[1];

			await mainSystem.setConfig(config);
		});

		// 閉じた後でよばれる
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
if (require('electron-squirrel-startup')) return;

// Entry point
app.on('ready', async () => {
	console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '----------', appname, '----------');

	// 二重起動防止
	const lock = app.requestSingleInstanceLock();
	if (lock) {
		// lockが取得できたという事は1回目起動
		app.on('second-instance', (event, args) => {  // 2回目起動を検知したら、1回目起動しておいたウィンドウを全面にだす
			if (mainWindow === null) return;
			if (mainWindow.isMinimized()) { mainWindow.restore(); }
			mainWindow.focus();
		});
	} else {
		// 2回目起動はすぐ殺す
		await app.quit();
	}

	// System開始、設定値読み出し
	await mainSystem.start(sendIPCMessage);
	config = mainSystem.getConfig();

	await mainUser.start(sendIPCMessage);

	persist = await store.get('persist', persist);

	// NIC情報を集める
	let interfaces = os.networkInterfaces();
	for (let k in interfaces) {
		for (let k2 in interfaces[k]) {
			let address = interfaces[k][k2];
			if (address.family == 'IPv4' && !address.internal) {
				localaddresses.push(address.address);
			}
		}
	}
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.on.ready ipver:', config.IPver, 'ipv4:', config.IPv4, 'ipv6:', config.IPv6) : 0;

	// 初回起動時はショートカットをデスクトップに配置、初回起動かどうかはconfigファイルの有無で判定
	// windowsのみ
	// electron-squirrel-startupにした
	// if (isWin && !fs.existsSync(path.join(store.path, 'config.json'))) {
	// console.log( '初回起動' );
	// createShortCut();
	// }

	await mainHALlocal.initialize(); // HALのDBを準備して最終データを取得しておく
	await sqlite3.sync().then(() => {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.on.ready. Local lifelog DB is ready.') : 0;
	});		// 起動時DBの準備，SQLite の初期化の完了を待つ

	createWindow();
});

// アプリケーションがアクティブになった時の処理（Mac only）
app.on("activate", () => {
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.on.activate') : 0;
	// メインウィンドウが消えている場合は再度メインウィンドウを作成する
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
					// await HALConfigSave(  );  // ここまだ
					await saveConfig();
					sendIPCMessage("configSaved", 'All');  // 保存したので画面に通知

					store.openInEditor();
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
		submenu: [  // 基本機能だけど、用意しておかないとMac開発時にショートカットが効かない
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
				click: function () { mainWindow.webContents.setZoomFactor(mainWindow.webContents.getZoomFactor() - 0.1); }
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
 * @desc menuInitialize
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
	// windows用
	if (isWin) {
		let dist = path.join(userHome, 'Desktop', 'PLIS.lnk');		// 作成したいショートカットのパス (末尾の.lnkが必要)
		let source = path.join(userHome, 'AppData', 'Local', 'PLIS', 'PLIS.exe'); // リンク元としたいディレクトリorファイルパス（本体）

		// ショートカット作成コマンド
		let command = `$WshShell = New-Object -ComObject WScript.Shell; $ShortCut = $WshShell.CreateShortcut("${dist}"); $ShortCut.TargetPath = "${source}"; $ShortCut.Save();`;

		// 第2引数でPowershellを指定して実行
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
 * @desc saveConfig
 * @async
 * @param {void}
 * @return void
 * @throw error
 */
async function saveConfig() {
	let _config = {};
	_config.system = mainSystem.getConfig();  // system
	_config.HAL = mainHALsync.getConfig();  // HAL sync
	_config.Hue = mainHue.getConfig();  // Hue
	_config.Ikea = mainIkea.getConfig();  // Ikea
	_config.OWM = mainOwm.getConfig();  // Owm
	_config.ESM = mainESM.getConfig();  // スマメ
	_config.Netatmo = mainNetatmo.getConfig();  // netatmo
	_config.EL = mainEL.getConfig();  // EL
	_config.Omron = mainOmron.getConfig(); // Omron
	_config.Co2s = mainCo2s.getConfig(); // Co2s
	_config.JMA = mainJma.getConfig(); // JMA
	_config.SwitchBot = mainSwitchBot.getConfig(); // SwitchBot
	_config.Calendar = mainCalendar.getConfig(); // Calendar settings
	_config.system = mainSystem.getConfig(); // system settings
	_config.user = mainUser.getConfig(); // user settings
	await store.set('config', _config);
};

/**
 * @func savePersist
 * @desc savePersist
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
	// calendarはpersistなし
	// userはpersistなし
	// systemはpersistなし
	await store.set('persist', persist);
};


//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
