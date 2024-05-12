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
}



function createWindow () {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
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
