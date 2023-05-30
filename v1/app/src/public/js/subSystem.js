//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.30
//	System Config関係の処理
//////////////////////////////////////////////////////////////////////
/**
 * @namespace subSystem
 */
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subSystem.js');

	// config
	let inScreenMode = document.getElementById('inScreenMode');  // スクリーンモード
	let inDebugMode = document.getElementById('inDebugMode');  // デバッグモード

	let inEllogExpireDays = document.getElementById('inEllogExpireDays');  // 家電操作ログの記録日数
	let inResultExpireDays = document.getElementById('inResultExpireDays');  // 成績データの記録日数
	let btnSystemConfigSet = document.getElementById('btnSystemConfigSet');  // 設定ボタン

	let inIPver = document.getElementById('inIPver');  // IPverの選択
	let inIPv4 = document.getElementById('inIPv4');  // IPv4のマルチキャストアドレス
	let inIPv6 = document.getElementById('inIPv6');  // IPv46のマルチキャストアドレス
	let btnNetworkConfigSet = document.getElementById('btnNetworkConfigSet'); // 設定ボタン（場所が違うだけで、systemと同じ動作）


	//----------------------------------------------------------------------------------------------
	/** 
	 * @func btnSystemConfigSet_Click
	 * @desc Systemの設定ボタンクリック
	 * @param {void}
	 * @return {void}
	 */
	window.btnSystemConfigSet_Click = function () {
		console.log('window.btnSystemConfigSet_Click');

		// 家電操作ログ保存日数、エラーチェック
		let ellogExpireDays = inEllogExpireDays.value;
		if (ellogExpireDays) {
			if (/[^\d]/.test(ellogExpireDays)) {
				window.addToast('Error', '家電操作ログの保存期間は数値のみで指定してください。');
				return;
			}
			ellogExpireDays = parseInt(ellogExpireDays, 10);
			if (ellogExpireDays < 0 || ellogExpireDays > 9999) {
				window.addToast('Error', '家電操作ログの保存期間は 0 ～ 9999 の範囲で指定してください。');
				return;
			}
		} else {
			window.addToast('Error', '家電操作ログの保存期間の設定は必須です。');
			return;
		}

		// 成績データ保存日数、エラーチェック
		let resultExpireDays = inResultExpireDays.value;
		if (resultExpireDays) {
			if (/[^\d]/.test(resultExpireDays)) {
				window.addToast('Error', '成績データの保存期間は数値のみで指定してください。');
				return;
			}
			resultExpireDays = parseInt(resultExpireDays, 10);
			if (resultExpireDays < 0 || resultExpireDays > 9999) {
				window.addToast('Error', '成績データの保存期間は 0 ～ 9999 の範囲で指定してください。');
				return;
			}
		} else {
			window.addToast('Error', '成績データの保存期間の設定は必須です。');
			return;
		}

		window.ipc.SystemSetConfig(inScreenMode.value, inDebugMode.value == 'true' ? true : false, inEllogExpireDays.value, inResultExpireDays.value, parseInt(inIPver.value), inIPv4.value, inIPv6.value);  // system configの保存
	};

	/** 
	 * @func btnNetworkConfigSet_Click
	 * @desc Networkの設定ボタンクリック
	 * @param {void}
	 * @return {void}
	 */
	window.btnNetworkConfigSet_Click = function () {
		console.log('window.btnSystemConfigSet_Click');
		window.ipc.SystemSetConfig(inScreenMode.value, inDebugMode.value == 'true' ? true : false, inEllogExpireDays.value, inResultExpireDays.value, parseInt(inIPver.value), inIPv4.value, inIPv6.value);  // system configの保存
	};

	/** 
	 * @func SystemConfigSaved
	 * @desc 保存通知
	 * @param {void}
	 * @return {void}
	 */
	window.SystemConfigSaved = async function (arg) {
		window.addToast('Info', 'System 設定を保存しました。');
	};

	/** 
	 * @func renewSystemConfigView
	 * @desc renewSystemConfigView
	 * @param {void}
	 * @return {void}
	 */
	window.renewSystemConfigView = async function (arg) {
		// console.log( 'window.renewSystemConfigView(): arg:', arg );
		btnSystemConfigSet.disabled = false;
		btnSystemConfigSet.textContent = '設定';

		inScreenMode.value = arg.screenMode;
		inDebugMode.value = arg.debug;
		inEllogExpireDays.value = arg.ellogExpireDays;
		inResultExpireDays.value = arg.resultExpireDays;
		inIPver.value = arg.IPver;
		inIPv4.value = arg.IPv4;
		inIPv6.value = arg.IPv4;
	};

	/** 
	 * @func URLopen
	 * @desc URLを外部ブラウザで開く
	 * @param {void}
	 * @return {void}
	 */
	window.URLopen = function (url) {
		console.log('url:', url);
		window.ipc.URLopen(url);
	};

});
