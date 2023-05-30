//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.30
//	User Config関係の処理
//////////////////////////////////////////////////////////////////////
/**
 * @module subUser
 */
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subUser.js');

	let inUserNickname   = document.getElementById('inUserNickname');  // ニックネーム
	let inUserAge        = document.getElementById('inUserAge');  // 年齢
	let inUserHeight     = document.getElementById('inUserHeight');  // 身長
	let inUserWeight     = document.getElementById('inUserWeight');  // 体重
	let inUserAmpere     = document.getElementById('inUserAmpere');  // 契約アンペア

	let btnUserProfileSet = document.getElementById('btnUserProfileSet');  // user profileのボタン

	//----------------------------------------------------------------------------------------------
	/** 
	 * @func btnUserProfileSet_Click
	 * @desc User Profileの設定ボタンクリック
	 * @param {void}
	 * @return {void}
	 */
	window.btnUserProfileSet_Click = function() {
		console.log( 'window.btnUserProfileSet_Click:', inUserNickname.value, inUserAge.value, inUserHeight.value, inUserWeight.value, inUserAmpere.value );
		window.ipc.userProfileSave( inUserNickname.value, inUserAge.value, inUserHeight.value, inUserWeight.value, inUserAmpere.value );  // userconfigの保存
	};


	/** 
	 * @func UserConfigSaved
	 * @desc 保存通知
	 * @param {void}
	 * @return {void}
	 */
	window.UserConfigSaved = async function ( arg ) {
		window.addToast( 'Info', 'User 設定を保存しました。');
	};

	/** 
	 * @func renewUserConfigView
	 * @desc 保存通知
	 * HALと連携していたらHALからプロファイルを取得
	 * 連携してなければconfigファイルの中に書いてあるもの
	 * 通常、起動時にrenewConfigで取得されているはず？
	 * @param {void}
	 * @return {void}
	 */
	window.renewUserConfigView = async function ( arg ) {
		console.log( 'renewUserProfile(): profile:', arg );

		// HALと連携していたらHALからプロファイルを取得
		// 連携してなければconfigファイルの中に書いてあるもの
		// user profile
		inUserNickname.value  = arg.nickname;
		inUserAge.value       = arg.age;
		inUserHeight.value    = arg.height;
		inUserWeight.value    = arg.weight;
		inUserAmpere.value    = arg.ampere;
	};

} );
