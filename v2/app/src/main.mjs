//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2018.03.16
//  Last updated: 2021.09.25
//////////////////////////////////////////////////////////////////////
/**
 * @module main
 */


//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { app, BrowserView, BrowserWindow, Menu, ipcMain, shell, clipboard } from 'electron';

import { fileURLToPath } from "node:url";
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import os from 'os';
import fs from 'node:fs/promises';
import { exec } from 'child_process';
import * as dateUtils from 'date-utils';

//////////////////////////////////////////////////////////////////////
// 追加ライブラリ
app.disableHardwareAcceleration(); // electron設定とmain window
import Store from 'electron-store';
import { objectSort, getNow, getToday, isObjEmpty, mergeDeeply } from './mainSubmodule.cjs';
import * as openAboutWindow from 'about-window';  // このアプリについて
import { sqlite3 } from './models/localDBModels.cjs';   // DBデータと連携
import {mainSystem} from './mainSystem.mjs';  // System configの管理
import {mainAutoAssessment} from './mainAutoAssessment.mjs';  // 成績付け
import {mainUser} from './mainUser.mjs';     // User configの管理
import {mainArp} from './mainArp.mjs';     // arpの管理
import {mainEL} from './mainEL.mjs';      // ELの管理
import {mainESM} from './mainESM.mjs'; // スマートメータの管理
import {mainHue} from './mainHue.mjs';     // hueの管理
import {mainIkea} from './mainIkea.mjs';    // Ikeaの管理
import {mainNetatmo} from './mainNetatmo.mjs';  // netatmoの管理
import {mainOwm} from './mainOwm.mjs';      // open weather mapの管理
import {mainOmron} from './mainOmron.mjs';    // Omron/USBの管理
import {mainHALlocal} from './mainHALlocal.mjs'; // HAL，独立で動く部分
import {mainHALsync} from './mainHALsync.mjs';  // HAL，連携する部分
import {mainJma} from './mainJma.mjs';    // 天気予報、気象庁
import {mainSwitchBot} from './mainSwitchBot.mjs'; // SwitchBot
import {mainCalendar} from './mainCalendar.mjs'; // カレンダー準備
import {mainCo2s} from './mainCo2s.mjs';  // usb-ud-co2センサー
import licenses from './modules.json' with { type: "json" };


//////////////////////////////////////////////////////////////////////
// 基本設定，electronのファイル読み込み対策，developmentで変更できるようにした（けどつかってない）
const appname = 'PLIS';
const appDir = process.env.NODE_ENV === 'development' ? __dirname : __dirname;
const isWin = process.platform == "win32" ? true : false;
const isMac = process.platform == "darwin" ? true : false;
const userHome = process.env[isWin ? "USERPROFILE" : "HOME"];
const isDevelopment = process.env.NODE_ENV == 'development'
const databaseDir = path.join(userHome, appname);  // SQLite3ファイルの置き場


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
	config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| main.ipcMain <- IkeaSend, arg:\x1b[32m', arg, '\x1b[0m') : 0;
	mainIkea.control(arg.key, arg.type, arg.command);
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



function createWindow () {
	mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			nodeIntegration: false, // default:false
			contextIsolation: true, // default:true
			worldSafeExecuteJavaScript: true,
			preload: path.join(__dirname, 'preload.js')
				// preload: path.join(__dirname, 'preload.js')
		},
		icon: path.join(__dirname, "assets/icon.png")
	});
	mainWindow.loadFile('src/tabbar.html');

	mainWindow.webContents.on('did-finish-load', () => {
		setupView('https://electronjs.org');
		setupViewLocal('src/local.html');
	});

	mainWindow.on('resize', () => {
		mainWindow.getBrowserViews().forEach((view) => {
			resizeView(view);
		})
	});

	createMenu();
}

function setupView(url) {
	const view = new BrowserView();
	mainWindow.addBrowserView(view);
	resizeView(view);
	view.webContents.loadURL(url);
}

function setupViewLocal(file) {
	const view = new BrowserView({
		webPreferences: {
			preload: path.join(__dirname, 'local_preload.js')
		}
	});
	mainWindow.addBrowserView(view);
	resizeView(view);
	view.webContents.loadFile(file);
	view.setBackgroundColor('white');
	// view.webContents.openDevTools({ mode: 'detach' });
}

function resizeView(view) {
	const bound = mainWindow.getBounds();
	const height = process.platform !== 'win32' ? 60 : 40
		view.setBounds({ x: 0, y: height, width: bound.width, height: bound.height - height });
}

app.whenReady().then(() => {
	createWindow();

	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', function () {
	if (process.platform !== 'darwin') app.quit();
});

function createMenu() {
	const template = [
		{
			label: 'View',
			submenu: [
				{
					label: 'open dev tool',
					click() {
						mainWindow.webContents.openDevTools({ mode: 'detach' });
					}
				},
				{ role: 'quit' }
				]
		}
		];
	if (!app.isPackaged) {
		template.unshift({
			label: 'Debug',
			submenu: [
				{ role: 'forceReload' }
				]
		});
	}
	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}

function switchView(url) {
	const views = mainWindow.getBrowserViews().filter(view => view.webContents.getURL().includes(url));
	console.assert(views.length === 1);
	mainWindow.setTopBrowserView(views[0]);
}

ipcMain.handle('tab1', e => {
	console.log('tab1');
	switchView('electronjs');
});

ipcMain.handle('tab2', e => {
	console.log('tab2');
	switchView('local.html');
});

ipcMain.handle('switch-to-electronjs', (e, message) => {
	console.log('from local.mjs', message);
	switchView('electronjs');
});

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
