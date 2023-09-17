//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2023.08.17
//	Log関係の処理
//////////////////////////////////////////////////////////////////////
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
/**
 * @namespace subLog
 */
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subLog.js');

	// config

	// log data
	// {datetime, moduleName, stackLog}
	let errorArray = [];


	// DOM
	let txtErrLog = document.getElementById('txtErrLog');

	//----------------------------------------------------------------------------------------------
	/** 
	 * @func 
	 * @desc エラーログを表示
	 * @param {void}
	 * @return {void}
	 */
	window.addError = function (errorMsg) {
		// errorArray 100行にする
		let a1 = errorMsg.split(' | ');
		let a2 = a1.split(':');
		errorArray.push({ datetime: a1[0], moduleName: a2[0], stackLog: a2[1] });

		if (errorArray.length > 100) {
			errorArray.length = 100;
		}
	};

	//
	window.renewLogText = function () {
		let t = ""

		errorArray.forEach( (elem) => {
			t += elem.datetime + ' | ' + elem.moduleName + ': ' + stackLog;
		});

		errorArray.value = t;
	};

});
