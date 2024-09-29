//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.30
//	AutoAssessment関係の処理
//////////////////////////////////////////////////////////////////////
'use strict'

////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
/**
 * @namespace subautoAssessment
 */
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subautoAssessment.js');

	// config
	let selAutoAssessmentDebugMode = document.getElementById('selAutoAssessmentDebugMode'); // AutoAssessment; debug flag
	let btnAutoAssessmentConfigSet = document.getElementById('btnAutoAssessmentConfigSet'); // 設定ボタン


	//----------------------------------------------------------------------------------------------
	// AutoAssessment config

	/**
	 * @func
	 * @desc 設定ボタン
	 * @param {void}
	 * @return {void}
	 */
	window.btnAutoAssessmentConfigSet_Click = function () {
		window.ipc.AutoAssessmentConfig(selAutoAssessmentDebugMode.value == 'true' ? true : false);
	};

	/**
	 * @func
	 * @desc 設定完了通知
	 * @param {void}
	 * @return {void}
	 */
	window.autoAssessmentConfigSaved = function () {
		btnAutoAssessmentConfigSet.disabled = false;
		btnAutoAssessmentConfigSet.textContent = '設定';

		window.addToast('Info', 'AutoAssessment 設定を保存しました。');
	};

	/**
	 * @func
	 * @desc mainプロセスから設定値をもらったので画面を更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewAutoAssessmentConfigView = function (arg) {
		selAutoAssessmentDebugMode.value = arg.debug;
	};


	/**
	 * @func window.autoAssessmentDebugLog
	 * @desc Owmモジュールがデバッグなら出力する
	 * @param {any} ...values
	 */
	window.autoAssessmentDebugLog = function (...values) {
		selAutoAssessmentDebugMode.value == 'true' ? console.log(...values) : 0;
	};

});
