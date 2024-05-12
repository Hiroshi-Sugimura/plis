//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
// 'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { fileURLToPath } from "node:url";
// const path = require('path');
import path from 'node:path';
// const fs = require('fs');
// import fs from 'node:fs/promises';
import fs from 'fs';
// const axios = require('axios');
import axios from 'axios';
// const Store = require('electron-store');
import Store from 'electron-store';
// const cron = require('node-cron');
import cron from 'node-cron';
// require('date-utils'); // for log
import * as dateUtils from 'date-utils';


const store = new Store();

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

//////////////////////////////////////////////////////////////////////
const appname = 'PLIS';
const isWin = process.platform == "win32" ? true : false;
const userHome = process.env[isWin ? "USERPROFILE" : "HOME"];
const databaseDir = path.join(userHome, appname);  // SQLite3ファイルの置き場


let config = {
	debug: false
}


//////////////////////////////////////////////////////////////////////
// メッセージ管理
let sendIPCMessage = null;

/**
 * @module mainCalendar
 * @desc カレンダーオブジェクト
 */
let mainCalendar = {
	isRun: false,  // 多重起動防止
	holidayData: null,  // 祝日データ
	holidaysURL: 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv', // 内閣府からダウンロードする祝日ファイルのURI
	observationTask: null,  // cronオブジェクト

	//////////////////////////////////////////////////////////////////////
	// interfaces
	/**
	 * @func start
	 * @desc 初期化と機能開始
	 * @param {IPCMessage} _sendIPCMessage
	 * @throw error
	 */
	start: function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		config.debug = store.get('config.Calendar.debug', false);

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendarStart()') : 0;

		if (mainCalendar.isRun) {
			sendIPCMessage('createCalendar', mainCalendar.holidayData);  // re-rentry
			return;
		}
		mainCalendar.isRun = true;

		// 祝日データの確認
		fs.readFile(path.join(databaseDir, "syukujitsu.csv"), "utf-8", (err, data) => {
			if (err) {
				console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendar() syukujitsu.csv is NOT found. error:', err);
				console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| ', err);
				mainCalendar.getHolidays();  // カレンダーデータ無いから取得する
				return;
			}
			mainCalendar.holidayData = data;
			sendIPCMessage('createCalendar', mainCalendar.holidayData);
		});


		// 日替わりでカレンダー更新
		mainCalendar.observationTask = cron.schedule('0 0 * * *', async () => { // 毎日0時0分
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendarStart.observationTask') : 0;
			sendIPCMessage('renewCalendar');
		});

		mainCalendar.observationTask.start();
	},

	/**
	 * @func stopWithoutSave
	 * @desc 保存しないで終了。監視をやめる
	 */
	stopWithoutSave: function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendar.stop()') : 0;

		if (mainCalendar.observationJob) {
			mainCalendar.observationJob.stop();
			mainCalendar.observationJob = null;
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendar.stopObserve() is stopped.') : 0;
		} else {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendar.stopObserve() has already stopped.') : 0;
		}

		mainCalendar.isRun = false;
	},


	/**
	 * @async
	 * @func setConfig
	 * @desc 設定を変更して保存。_config=nullなら設定保存のみ
	 * @param {Object} _config
	 */
	setConfig: async function (_config) {
		if (_config) {
			config = mergeDeeply(config, _config);
		}
		await store.set('config.Calendar', config);
		sendIPCMessage("renewCalendarConfigView", config);
		sendIPCMessage("configSaved", 'Calendar');  // 保存したので画面に通知
	},

	/**
	 * @func getConfig
	 * @return {Object} config
	 * @desc 現在の設定値を返す
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * @async
	 * @func getPersist
	 * @return {Object} persist
	 * @desc 現在の状況を返す
	 */
	getPersist: function () {
		return persist;
	},


	//////////////////////////////////////////////////////////////////////
	// 内部関数
	/**
	 * @async
	 * @func getHolidays
	 * @desc 祝日データを内閣府からHTTPで取得して、ストレージにファイルとして保存する
	 */
	getHolidays: function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendar.getHolidays()') : 0;

		axios.get(mainCalendar.holidaysURL).then((res) => {
			fs.writeFile(path.join(databaseDir, "syukujitsu.csv"), res.data, (err, data) => {
				if (err) {
					console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendar.getHolidays() syukujitsu.csv is NOT saved. error:', err);
					return;
				}
				sendIPCMessage('renewCalendar', res.data);
			});
		});
	}

};


// module.exports = mainCalendar;
export {mainCalendar};
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
