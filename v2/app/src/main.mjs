import { app, BrowserView, BrowserWindow, Menu, ipcMain } from 'electron';
import { fileURLToPath } from "node:url";
import path from 'node:path';
import os from 'os';
import fs from 'node:fs/promises';
import { exec } from 'child_process';
import * as dateUtils from 'date-utils';

let mainWindow;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
// const mainHue = require('./mainHue');     // hueの管理
// const mainIkea = require('./mainIkea');    // Ikeaの管理
// const mainNetatmo = require('./mainNetatmo');  // netatmoの管理
// const mainOwm = require('./mainOwm');      // open weather mapの管理
// const mainOmron = require('./mainOmron');    // Omron/USBの管理
// const mainHALlocal = require('./mainHALlocal'); // HAL，独立で動く部分
// const mainHALsync = require('./mainHALsync');  // HAL，連携する部分
// const mainJma = require('./mainJma');    // 天気予報、気象庁
// const mainSwitchBot = require('./mainSwitchBot'); // SwitchBot
// const mainCalendar = require('./mainCalendar'); // カレンダー準備
// const mainCo2s = require('./mainCo2s');  // usb-ud-co2センサー
// const licenses = require('./modules.json');  // モジュールのライセンス




// NIC情報を集める
/** NICリスト */
let localaddresses = [];

let interfaces = os.networkInterfaces();
for (let k in interfaces) {
	for (let k2 in interfaces[k]) {
		let address = interfaces[k][k2];
		if (address.family == 'IPv4' && !address.internal) {
			localaddresses.push(address.address);
		}
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
