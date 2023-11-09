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
	 * @func addError
	 * @desc エラーログを表示
	 * @param {Object} errorMsg ={datetime, moduleName, stackLog}
	 * @return {void}
	 */
	window.addError = function (errorMsg) {
		// errorArray 100行にする
		window.addToast('Error', errorMsg.stackLog);

		errorArray.push(errorMsg);

		if (errorArray.length > 100) {
			errorArray.length = 100;
		}

		window.renewLogText();
	};

	/** 
	 * @func renewLogText
	 * @desc エラーログを表示
	 * @return {text}
	 */
	window.renewLogText = function () {
		let t = ""

		errorArray.forEach((elem) => {
			t = elem.datetime + ' | ' + elem.moduleName + ': ' + elem.stackLog + '\n' + t;
		});

		txtErrLog.value = t;
	};

});
