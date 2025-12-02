//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
// 'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
import { fileURLToPath } from "node:url";
import path from 'node:path';
import fs from 'fs';
import axios from 'axios';
import Store from 'electron-store';
import cron from 'node-cron';
import { mergeDeeply } from './mainSubmodule.cjs';


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

/**
 * @typedef {Object} CalendarConfig
 * @property {boolean} [debug=false] デバッグログを出すかどうか
 */

/**
 * @typedef {Object} CalendarPersist
 * @description 将来的な拡張用。現在は祝日CSVのキャッシュなどを想定。
 */

/** @type {CalendarPersist} */
let persist = {};


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
	 * 初期化して監視を開始する。
	 * - 祝日CSVが無ければダウンロード
	 * - Rendererへカレンダーデータを送信
	 * - 毎日0:00に更新イベントを発火
	 * @param {(channel:string, ...args:any[])=>void} _sendIPCMessage IPCへメッセージを送る関数
	 * @returns {void}
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
	 * 保存せずに停止し、監視を解除する。
	 * @returns {void}
	 */
	stopWithoutSave: function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendar.stop()') : 0;

		if (mainCalendar.observationTask) {
			mainCalendar.observationTask.stop();
			mainCalendar.observationTask = null;
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendar.stopObserve() is stopped.') : 0;
		} else {
			config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendar.stopObserve() has already stopped.') : 0;
		}

		mainCalendar.isRun = false;
	},


	/**
	 * 設定をマージして保存する。_configがnull/undefinedの場合は現状を保存のみ。
	 * @param {Partial<CalendarConfig>=} _config 上書きする設定
	 * @returns {Promise<void>}
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
	 * 現在の設定値を返す。
	 * @returns {CalendarConfig}
	 */
	getConfig: function () {
		return config;
	},

	/**
	 * 現在の永続データを返す。
	 * @returns {CalendarPersist}
	 */
	getPersist: function () {
		return persist;
	},


	//////////////////////////////////////////////////////////////////////
	// 内部関数
	/**
	 * 祝日データを内閣府サイトから取得し、ユーザフォルダに syukujitsu.csv として保存する。
	 * 成功時は Renderer に renewCalendar を送信する。
	 * @returns {void}
	 */
	getHolidays: function () {
		config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendar.getHolidays()') : 0;

		axios.get(mainCalendar.holidaysURL).then((res) => {
			const csv = res.data;
			// ディレクトリが存在しない場合は作成
			if (!fs.existsSync(databaseDir)) {
				fs.mkdirSync(databaseDir, { recursive: true });
			}
			fs.writeFile(path.join(databaseDir, "syukujitsu.csv"), csv, (err) => {
				if (err) {
					console.error(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendar.getHolidays() syukujitsu.csv is NOT saved. error:', err);
					return;
				}
				sendIPCMessage('renewCalendar', csv);
			});
		});
	}

};


// module.exports = mainCalendar;
export { mainCalendar };
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
