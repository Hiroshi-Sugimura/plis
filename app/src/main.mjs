//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2018.03.16
//  Last updated: 2021.09.25
//////////////////////////////////////////////////////////////////////
/**
 * @module main
 */


//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { app, BrowserView, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell, clipboard } from 'electron';

import { fileURLToPath } from "node:url";
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';


//////////////////////////////////////////////////////////////////////
app.disableHardwareAcceleration(); // electron設定とmain window
import { store } from './storeSingleton.mjs';
import { objectSort, getNow, getToday, isObjEmpty, mergeDeeply, formatDate } from './mainSubmodule.mjs';
import { logger } from './logger.mjs';
import oaw from 'about-window';  // このアプリについて Common JSモジュール対応、デフォルトエクスポート
const { default: openAboutWindow } = oaw;  // このアプリについて Common JSモジュール対応、オブジェクトのデストラクチャリング
import localDB from './models/localDBModels.mjs';   // DBデータと連携
const { sqlite3 } = localDB;
import { mainSystem } from './mainSystem.mjs';  // System configの管理
import { mainAutoAssessment } from './mainAutoAssessment.mjs';  // 成績付け
import { mainUser } from './mainUser.mjs';     // User configの管理
import { mainArp } from './mainArp.mjs';     // arpの管理
import { mainEL } from './mainEL.mjs';      // ELの管理
import { mainESM } from './mainESM.mjs'; // スマートメータの管理
import { mainHue } from './mainHue.mjs';     // hueの管理
import { mainIkea } from './mainIkea.mjs';    // Ikeaの管理
import { mainNetatmo } from './mainNetatmo.mjs';  // netatmoの管理
import { mainOwm } from './mainOwm.mjs';      // open weather mapの管理
import { mainOmron } from './mainOmron.mjs';    // Omron/USBの管理
import { mainHALlocal } from './mainHALlocal.mjs'; // HAL，独立で動く部分
import { mainHALsync } from './mainHALsync.mjs';  // HAL，連携する部分
import { mainJma } from './mainJma.mjs';    // 天気予報、気象庁
import { mainSwitchBot } from './mainSwitchBot.mjs'; // SwitchBot
import { mainCalendar } from './mainCalendar.mjs'; // カレンダー準備
import { mainCo2s } from './mainCo2s.mjs';  // usb-ud-co2センサー
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
let tray = null;
let isQuitting = false;

/** NICリスト */
let localaddresses = [];

/** 管理しているデバイスやサービスのリストにユーザが名前を付けたい */
// [{ type: '', id: '', ip: '', mac: '', alias, '' }]
let managedThings = [];

// const store = new Store(); // Use singleton

/** config */
let config = {};

/** persist */
let persist = {};

//////////////////////////////////////////////////////////////////////
// local function
//////////////////////////////////////////////////////////////////////
/**
 * @func sendIPCMessage
 * @desc レンダラープロセスへIPCメッセージを安全に送信する共通関数。ウィンドウ/ WebContentsが破棄済みの場合は何もしない。
 * @param {string} cmdStr - コマンド名（レンダラー側で判定するキー）
 * @param {*} argStr - 引数（構造化複製されそのままpostされる）
 * @returns {void}
 * @throws 送信中に例外が発生した場合は catch でログ出力のみ（再スローしない）
 */
let sendIPCMessage = function (cmdStr, argStr) {
	try {
		if (
			mainWindow != null &&
			!mainWindow.isDestroyed?.() &&
			mainWindow.webContents != null &&
			!mainWindow.webContents.isDestroyed?.()
		) {
			mainWindow.webContents.send('to-renderer', { cmd: cmdStr, arg: argStr });
		}
	} catch (error) {
		logger.error('main', 'sendIPCMessage() error:', error);
	}
};

//----------------------------------------------------------------------
// IPC通信 (Renderer -> Main)
//----------------------------------------------------------------------

// 起動時に一回だけ呼ばれる。
ipcMain.handle('already', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- already');

	sendIPCMessage("renewSystemConfigView", config);
	sendIPCMessage("renewUserConfigView", mainUser.getConfig());
	sendIPCMessage("renewLicenses", licenses);

	await Promise.all([
		mainEL.start(sendIPCMessage, localaddresses),
		mainArp.start(sendIPCMessage),
		mainHue.start(sendIPCMessage),
		mainOwm.start(sendIPCMessage),
		mainJma.start(sendIPCMessage),
		mainNetatmo.start(sendIPCMessage),
		mainIkea.start(sendIPCMessage),
		mainESM.start(sendIPCMessage),
		mainOmron.start(sendIPCMessage),
		mainCo2s.start(sendIPCMessage),
		mainSwitchBot.start(sendIPCMessage),
		mainCalendar.start(sendIPCMessage),
		mainHALsync.start(sendIPCMessage),
		mainAutoAssessment.start(sendIPCMessage)
	]);

	persist.HAL = await mainHALlocal.getLastData();
	sendIPCMessage("HALRenewResponse", persist.HAL);
});

// 設定保存
ipcMain.handle('configSave', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- configSave, arg:', arg);
	await saveConfig();
	sendIPCMessage("configSaved", 'All');
});

// URLを開く
ipcMain.handle('URLopen', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- URLopen, arg:', arg);
	shell.openExternal(arg);
});

// ページ内検索
ipcMain.handle('PageInSearch', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- PageInSearch, arg:', arg);
	try {
		mainWindow.webContents.findInPage(arg, {
			forward: true,
			findNext: false,
			matchCase: false
		});
	} catch (error) {
		sendIPCMessage('Error', { datetime: formatDate(new Date(), "YYYY-MM-DD HH24:MI:SS"), moduleName: 'main.PageInSearch', stackLog: error.message });
	}
});

ipcMain.handle('PageInSearchNext', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- PageInSearchNext, arg:', arg);
	mainWindow.webContents.findInPage(arg, { forward: true, findNext: true });
});

ipcMain.handle('PageInSearchPrev', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- PageInSearchPrev, arg:', arg);
	mainWindow.webContents.findInPage(arg, { forward: false, findNext: true });
});

ipcMain.handle('PageInSearchStop', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- PageInSearchStop');
	mainWindow.webContents.stopFindInPage('clearSelection');
});

ipcMain.handle('CalendarRenewHolidays', async (event, arg) => {
	mainCalendar.getHolidays();
});

ipcMain.handle('SystemSetConfig', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- SystemSetConfig, arg:', arg);
	config.screenMode = arg.screenMode;
	config.debug = arg.debug;
	config.ellogExpireDays = arg.ellogExpireDays;
	config.resultExpireDays = arg.resultExpireDays;
	config.IPver = arg.IPver;
	config.IPv4 = arg.IPv4;
	config.IPv6 = arg.IPv6;
	config.backgroundMode = arg.backgroundMode;
	config.autoLaunch = arg.autoLaunch;
	config.autoLaunchHidden = arg.autoLaunchHidden;

	app.setLoginItemSettings({
		openAtLogin: config.autoLaunch,
		openAsHidden: config.autoLaunchHidden,
		path: process.execPath,
		args: config.autoLaunchHidden ? ['--hidden'] : []
	});

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

ipcMain.handle('ScreenMode', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- ScreenMode, arg:', arg);
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

ipcMain.handle('userProfileSave', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- userProfileSave, arg:', arg);
	mainUser.setConfig(arg);
});

ipcMain.handle('HALsetApiTokenRequest', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- HALsetApiTokenRequest.');
	mainHALsync.setHalApiTokenRequest(arg);
});

ipcMain.handle('HALgetApiTokenRequest', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- HALgetApiTokenRequest token:', mainHALsync.config.halApiToken);
	sendIPCMessage("HALgetApiTokenResponse", mainHALsync.config.halApiToken);
});

ipcMain.handle('HALdeleteApiToken', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- HALdeleteApiToken.');
	mainHALsync.deleteHalApiToken();
});

ipcMain.handle('HALSyncRequeset', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- HALSyncRequeset.');
	mainHALsync.startSync();
});

ipcMain.handle('HALgetUserProfileRequest', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- HALgetUserProfileRequest.');
	mainHALsync.getHalUserProfileRequest();
});

ipcMain.handle('HALrenew', async (event, arg) => {
	persist.HAL = await mainHALlocal.getLastData();
	logger.debug('main', config.debug, 'ipcMain <- HALrenew, halData: <skip>');
	sendIPCMessage("HALRenewResponse", persist.HAL);
});

ipcMain.handle('HALsubmitQuestionnaire', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- HALsubmitQuestionnaire, arg:', arg);
	mainHALlocal.submitQuestionnaire(arg,
		() => { sendIPCMessage('Info', 'アンケートを保存しました。'); },
		(err) => { sendIPCMessage('Error', { datetime: formatDate(new Date(), "YYYY-MM-DD HH24:MI:SS"), moduleName: 'main', stackLog: err.message }); });
});

ipcMain.handle('AutoAssessmentConfig', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- AutoAssessmentConfig, arg:', arg);
	mainAutoAssessment.setConfig(arg);
});

ipcMain.handle('ELUse', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- ELUse, arg:', arg);
	await mainEL.setConfig({ enabled: true });
	mainEL.start(sendIPCMessage, localaddresses);
});

ipcMain.handle('ELStop', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- ELStop, arg:', arg);
	await mainEL.setConfig({ enabled: false });
	mainEL.stop();
});

ipcMain.handle('ELUseOldSearch', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- ELUseOldSearch, arg:', arg);
	mainEL.setConfig({ oldSearch: true });
});

ipcMain.handle('ELStopOldSearch', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- ELStopOldSearch, arg:', arg);
	mainEL.setConfig({ oldSearch: false });
});

ipcMain.handle('Elsend', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- Elsend, arg:', arg);
	mainEL.sendMsg(arg.ip, arg.msg);
});

ipcMain.handle('ElsendOPC1', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- ElsendOPC1, arg:', arg);
	mainEL.sendOPC1(arg.ip, arg.seoj, arg.deoj, arg.esv, arg.epc, arg.edt);
});

ipcMain.handle('ELSearch', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- ELSearch.');
	mainEL.search();
});

ipcMain.handle('ESMUse', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- ESMUse, arg:', arg);
	arg.enabled = true;
	arg.connected = false;
	arg.EPANDESC = {};
	await mainESM.setConfig(arg);
	mainESM.start(sendIPCMessage);
});

ipcMain.handle('ESMnotUse', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- ESMnotUse, arg:', arg);
	arg.enabled = false;
	await mainESM.setConfig(arg);
	await mainESM.stop();
});

ipcMain.handle('HueUse', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- HueUse, key:', arg.key);
	arg.enabled = true;
	await mainHue.setConfig(arg);
	mainHue.start(sendIPCMessage);
});

ipcMain.handle('HueUseCancel', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- HueUseCancel, key:', arg.key);
	arg.enabled = false;
	await mainHue.setConfig(arg);
	await mainHue.stop();
});

ipcMain.handle('HueUseStop', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- HueUseStop, key:', arg.key);
	arg.enabled = false;
	await mainHue.setConfig(arg);
	await mainHue.stop();
});

ipcMain.handle('HueControl', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- HueControl, arg:', arg);
	mainHue.control(arg.url, JSON.stringify(arg.json));
});

ipcMain.handle('IkeaUse', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- IkeaUse, arg:', arg);
	arg.enabled = true;
	await mainIkea.setConfig(arg);
	mainIkea.start(sendIPCMessage);
});

ipcMain.handle('IkeaUseStop', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- IkeaUseStop, arg:', arg);
	arg.enabled = false;
	await mainIkea.setConfig(arg);
	await mainIkea.stop();
});

ipcMain.handle('IkeaSend', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- IkeaSend, arg:', arg);
	mainIkea.control(arg.key, arg.type, arg.command);
});

ipcMain.handle('OwmUse', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- OwmUse, key:', arg.APIKey, 'zipCode:', arg.zipcode);
	arg.enabled = true;
	await mainOwm.setConfig(arg);
	mainOwm.start(sendIPCMessage);
});

ipcMain.handle('OwmStop', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- OwmStop, key:', arg.APIKey, 'zipCode:', arg.zipcode);
	arg.enabled = false;
	await mainOwm.setConfig(arg);
	mainOwm.stop();
});

ipcMain.handle('JmaConfigSave', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- JmaConfigSave, arg:', arg);
	await mainJma.setConfig(arg);
	mainJma.gets();
});

ipcMain.handle('NetatmoUse', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- NetatmoUse, arg:', arg);
	arg.enabled = true;
	await mainNetatmo.setConfig(arg);
	mainNetatmo.start(sendIPCMessage);
});

ipcMain.handle('NetatmoStop', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- NetatmoStop, arg:', arg);
	arg.enabled = false;
	await mainNetatmo.setConfig(arg);
	mainNetatmo.stop();
});

ipcMain.handle('OmronUse', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- OmronUse, arg:', arg);
	arg.enabled = true;
	await mainOmron.setConfig(arg);
	mainOmron.start(sendIPCMessage);
});

ipcMain.handle('OmronStop', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- OmronStop, arg:', arg);
	arg.enabled = false;
	await mainOmron.setConfig(arg);
	mainOmron.stop();
});

ipcMain.handle('Co2sUse', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- Co2sUse, arg:', arg);
	arg.enabled = true;
	await mainCo2s.setConfig(arg);
	mainCo2s.start(sendIPCMessage);
});

ipcMain.handle('Co2sStop', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- Co2sStop, arg:', arg);
	arg.enabled = false;
	await mainCo2s.setConfig(arg);
	mainCo2s.stop();
});

ipcMain.handle('SwitchBotUse', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- SwitchBotUse, token:', arg.token);
	arg.enabled = true;
	await mainSwitchBot.setConfig(arg);
	mainSwitchBot.start(sendIPCMessage);
});

ipcMain.handle('SwitchBotStop', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- SwitchBotStop, token:', arg.token);
	arg.enabled = false;
	await mainSwitchBot.setConfig(arg);
	await mainSwitchBot.stop();
});

ipcMain.handle('SwitchBotControl', async (event, arg) => {
	logger.debug('main', config.debug, 'ipcMain <- SwitchBotControl, arg:', arg);
	mainSwitchBot.control(arg.id, arg.command, arg.param);
});


//----------------------------------------------------------------------
// Life Cycle Events
//----------------------------------------------------------------------

async function createWindow() {
	try {
		mainWindow = new BrowserWindow({
			show: false,
			fullscreen: config ? config.screenMode == 'fullscreen' : false,
			width: config.windowWidth,
			height: config.windowHeight,
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
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

		mainWindow.on('close', async (event) => {
			logger.debug('main', config.debug, 'mainWindow.on.close');
			if (!isQuitting && config.backgroundMode) {
				event.preventDefault();
				mainWindow.hide();
				return;
			}
			config.windowWidth = mainWindow.getSize()[0];
			config.windowHeight = mainWindow.getSize()[1];
			await mainSystem.setConfig(config);
		});

		mainWindow.on('closed', () => {
			logger.debug('main', config.debug, 'mainWindow.on.closed');
			mainWindow = null;
		});

		createTray();

		await mainHALlocal.truncatelogs();

		mainWindow.webContents.on('render-process-gone', (event, details) => {
			logger.error('main', 'render-process-gone:', details?.reason, details);
			safeRecreateWindow();
		});

		mainWindow.on('unresponsive', () => {
			logger.error('main', 'window unresponsive');
		});

		mainWindow.webContents.on('gpu-process-crashed', (event, killed) => {
			logger.error('main', 'gpu-process-crashed. killed:', killed);
		});

	} catch (error) {
		logger.error('main', 'createWindow() error:', error);
	}
}

function safeRecreateWindow() {
	try {
		if (mainWindow && !mainWindow.isDestroyed?.()) {
			mainWindow.destroy();
		}
	} catch (e) {
		logger.error('main', 'safeRecreateWindow destroy error:', e);
	} finally {
		createWindow();
	}
}

if (process.platform === 'win32') {
	const { createRequire } = await import('module');
	const require = createRequire(import.meta.url);
	if (require('electron-squirrel-startup')) app.quit();
}

app.on('ready', async () => {
	logger.info('main', `---------- ${appname} ----------`);

	const lock = app.requestSingleInstanceLock();
	if (lock) {
		app.on('second-instance', (event, args) => {
			if (mainWindow === null) return;
			if (mainWindow.isMinimized()) { mainWindow.restore(); }
			mainWindow.focus();
		});
	} else {
		await app.quit();
	}

	await mainSystem.start(sendIPCMessage);
	config = mainSystem.getConfig();
	await mainUser.start(sendIPCMessage);
	persist = await store.get('persist', persist);

	let interfaces = os.networkInterfaces();
	for (let k in interfaces) {
		for (let k2 in interfaces[k]) {
			let address = interfaces[k][k2];
			if (address.family == 'IPv4' && !address.internal) {
				localaddresses.push(address.address);
			}
		}
	}
	logger.debug('main', config.debug, `on.ready ipver:${config.IPver} ipv4:${config.IPv4} ipv6:${config.IPv6}`);

	await mainHALlocal.initialize();
	await sqlite3.sync().then(() => {
		logger.debug('main', config.debug, 'on.ready. Local lifelog DB is ready.');
	});

	createWindow();

	const loginItemSettings = app.getLoginItemSettings();
	const wasOpenedAtLogin = loginItemSettings.wasOpenedAtLogin;
	const isHiddenStart = process.argv.includes('--hidden') || (wasOpenedAtLogin && config.autoLaunchHidden);

	if (mainWindow) {
		if (isHiddenStart) {
			logger.info('main', 'Start as Hidden');
		} else {
			mainWindow.show();
		}
	}
});

function createTray() {
	if (tray) return;

	let icon;
	if (isMac) {
		const icon16 = path.join(__dirname, 'icons', 'plis_16x16.png');
		const icon32 = path.join(__dirname, 'icons', 'plis_32x32@2x.png');
		icon = nativeImage.createFromPath(icon16);
		try {
			const icon2x = nativeImage.createFromPath(icon32);
			if (!icon2x.isEmpty()) {
				icon.addRepresentation({
					scaleFactor: 2.0,
					buffer: icon2x.toPNG()
				});
			}
		} catch (e) {
			logger.error('main', 'Tray icon 2x load error:', e);
		}
	} else {
		icon = path.join(__dirname, 'icons', 'plis_linux_icon.png');
	}

	tray = new Tray(icon);
	tray.setToolTip(appname);

	const contextMenu = Menu.buildFromTemplate([
		{
			label: '表示/非表示',
			click: () => {
				if (mainWindow && !mainWindow.isDestroyed()) {
					if (mainWindow.isVisible()) {
						mainWindow.hide();
					} else {
						mainWindow.show();
					}
				} else {
					createWindow();
				}
			}
		},
		{
			label: '終了',
			click: () => {
				isQuitting = true;
				app.quit();
			}
		}
	]);

	tray.setContextMenu(contextMenu);
	tray.on('double-click', () => {
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.show();
		}
	});
}

app.on("activate", () => {
	logger.debug('main', config.debug, 'app.on.activate');
	if (mainWindow === null) {
		createWindow();
		mainWindow.show();
	} else {
		mainWindow.show();
	}
});

app.on('window-all-closed', () => {
	logger.debug('main', config.debug, 'app.on.window-all-closed');
	if (config.backgroundMode) return;
	app.quit();
});

app.once('before-quit', async () => {
	isQuitting = true;
	logger.debug('main', config.debug, 'app.on.before-quit');
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

app.once('will-quit', async () => {
	logger.debug('main', config.debug, 'app.on.will-quit');
});

app.once('quit', async () => {
	logger.debug('main', config.debug, 'app.on.quit');
});

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
						sendIPCMessage('Error', { datetime: formatDate(new Date(), "YYYY-MM-DD HH24:MI:SS"), moduleName: 'main', stackLog: 'Minimum zoom' });
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

function menuInitialize() {
	let menu = Menu.buildFromTemplate(menuItems);
	Menu.setApplicationMenu(menu);
	mainWindow.setMenu(menu);
}

function createShortCut() {
	if (isWin) {
		let dist = path.join(userHome, 'Desktop', 'PLIS.lnk');
		let source = path.join(userHome, 'AppData', 'Local', 'PLIS', 'PLIS.exe');
		let command = `$WshShell = New-Object -ComObject WScript.Shell; $ShortCut = $WshShell.CreateShortcut("${dist}"); $ShortCut.TargetPath = "${source}"; $ShortCut.Save();`;
		exec(command, { "shell": "powershell.exe" }, (error, stdout, stderror) => {
			if (error) {
				logger.error('main', 'createShortCut error:', error);
			}
		});
	} else {
		logger.debug('main', config.debug, 'createShortCut: not Win');
	}
}

async function saveConfig() {
	let currentConfig = await store.get('config', {});
	let _config = {
		system: mainSystem.getConfig(),
		HAL: mainHALsync.getConfig(),
		Hue: mainHue.getConfig(),
		Ikea: mainIkea.getConfig(),
		OWM: mainOwm.getConfig(),
		ESM: mainESM.getConfig(),
		Netatmo: mainNetatmo.getConfig(),
		EL: mainEL.getConfig(),
		Omron: mainOmron.getConfig(),
		Co2s: mainCo2s.getConfig(),
		JMA: mainJma.getConfig(),
		SwitchBot: mainSwitchBot.getConfig(),
		Calendar: mainCalendar.getConfig(),
		AutoAssessment: mainAutoAssessment.getConfig(),
		user: mainUser.getConfig()
	};
	// 既存の設定とマージして、メモリ上の空データでディスクの設定を消さないようにする
	let newConfig = mergeDeeply(currentConfig, _config);
	await store.set('config', newConfig);
}

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
}
