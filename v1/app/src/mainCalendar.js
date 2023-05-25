//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2020.10.30
//////////////////////////////////////////////////////////////////////
'use strict'

//////////////////////////////////////////////////////////////////////
// 基本ライブラリ
const path = require('path');
const fs = require('fs');
const axios = require('axios');

require('date-utils'); // for log


//////////////////////////////////////////////////////////////////////
const appname  = 'HEMS-Logger';
const isWin    = process.platform == "win32" ? true : false;
const userHome = process.env[ isWin ? "USERPROFILE" : "HOME"];
const databaseDir = path.join(userHome, appname);  // SQLite3ファイルの置き場


let config = {
	debug: false
}


//////////////////////////////////////////////////////////////////////
// arp管理
let sendIPCMessage = null;


let mainCalendar = {
	isRun: false,
	holidaysURL: 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv', // 内閣府
	// 保存先

	// interfaces

	start: function ( _sendIPCMessage ) {
		sendIPCMessage = _sendIPCMessage;

		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendarStart()'):0;

		//////////////////////////////////////////////////////////////////////
		// 基本設定，electronのファイル読み込み対策，developmentで変更できるようにした（けどつかってない）
		fs.readFile( path.join(databaseDir, "syukujitsu.csv"), "utf-8", (err, data) => {
			if (err) {
				console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendar() syukujitsu.csv is NOT found. error:', err);
				return;
			}
			sendIPCMessage('renewCalendar', data );
		});
	},

	getHolidays: function() {
		config.debug?console.log( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendar.getHolidays()'):0;

		axios.get( mainCalendar.holidaysURL ).then( (res) => {
			fs.writeFile( path.join(databaseDir, "syukujitsu.csv"), res.data, (err, data) => {
				if (err) {
					console.error( new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainCalendar() syukujitsu.csv is NOT saved. error:', err);
					return;
				}
				sendIPCMessage('renewCalendar', res.data );
			});
		});
	}
};


module.exports = mainCalendar;
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
