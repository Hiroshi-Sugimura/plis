//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
/**
 * @module mainCalendar
 */
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cron = require('node-cron');  
require('date-utils'); // for log


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


let mainCalendar = {
	isRun: false,  // 多重起動防止
	holidaysURL: 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv', // 内閣府
	observationTask: null,  // cronオブジェクト

	//////////////////////////////////////////////////////////////////////
	// interfaces
	/**
	 * @func start
	 * @desc 初期化と機能開始
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
	 */
	start: function (_sendIPCMessage) {
		sendIPCMessage = _sendIPCMessage;

		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendarStart()') : 0;

		if (mainCalendar.isRun) return;
		mainCalendar.isRun = true;

		//////////////////////////////////////////////////////////////////////
		// 基本設定，electronのファイル読み込み対策，developmentで変更できるようにした（けどつかってない）
		fs.readFile(path.join(databaseDir, "syukujitsu.csv"), "utf-8", (err, data) => {
			if (err) {
				console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendar() syukujitsu.csv is NOT found. error:', err);
				console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| ', err);
				mainCalendar.getHolidays();  // カレンダーデータ無いから取得する
				return;
			}
			sendIPCMessage('renewCalendar', data);
		});

		mainCalendar.observationTask = cron.schedule('0 0 * * *', async () => { // 毎日0時0分
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendarStart.observationTask') : 0;
			sendIPCMessage('renewCalendar', data);
		});
	},

	/**
	 * @func stop
	 * @desc stop observationJob
	 */
	stop: function () {
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

	//////////////////////////////////////////////////////////////////////
	// 内部関数
	/**
	 * @func getHolidays
	 * @desc 祝日データを内閣府からHTTPで取得して、ストレージにファイルとして保存する
	 * @async
	 * @param {void} 
	 * @return void
	 * @throw error
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


module.exports = mainCalendar;
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
