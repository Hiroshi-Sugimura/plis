//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2013.09.27.
//	Last updated: 2022.08.24
//////////////////////////////////////////////////////////////////////
/**
 * @namespace window
 * @desc index.js
 */
'use strict'

////////////////////////////////////////////////////////////////////////////////
// 内部
function isObjEmpty(obj) {
	return Object.keys(obj).length === 0;
}


////////////////////////////////////////////////////////////////////////////////
// HTMLがロードされたら実行，EventListenerとしてはDOMContentLoadedのあとloadする。
// このシステムとしてはindex.jsが最後実行してほしいのでloadとし、
// 他のサブモジュールをDOMContentLoadedにする
window.addEventListener('load', onLoad);

function onLoad() {
	console.log('## onLoad index.js');

	// 内部変数
	let licenses;      // 使用モジュールのライセンス
	let halData;       // HALのデータ

	// ライセンス
	let divLicenses = document.getElementById('divLicenses'); // ライセンス表記

	// debug
	let myIPaddr = document.getElementById('myIPaddr');
	let txtErrLog = document.getElementById('txtErrLog');

	let syncBtn = document.getElementById('syncBtn');

	//////////////////////////////////////////////////////////////////
	// MainProcessからのメッセージ振り分け
	window.ipc.on('to-renderer', (event, obj) => {
		// console.log( '->', obj );
		let c = JSON.parse(obj);    // obj = {cmd, arg} の形式でくる

		switch (c.cmd) {
			//----------------------------------------------
			// システム関連
			case "renewSystemConfigView":  // システム設定の画面表示変更
			console.log( 'main -> renewSystemConfigView:', c.arg );
			window.renewSystemConfigView( c.arg );
			break;

			//----------------------------------------------
			// ユーザプロファイル関連
			case "renewUserConfigView":  // user profileの画面表示変更
			console.log( 'main -> renewUserConfigView:', c.arg );
			window.renewUserConfigView( c.arg );
			break;

			//----------------------------------------------
			// HAL関連
			case "renewHALConfigView": // HAL情報（APIKey）
			console.log( 'main -> renewHALConfigView:', c.arg );
			window.renewHALConfigView( c.arg );
			break;

			case "renewHAL": // HALのデータをもらった（評価値）
			console.log( 'main -> renewHAL:', c.arg );
			halData = c.arg;
			window.renewHAL( halData.MajorResults, halData.MinorResults, halData.MinorkeyMeans);
			break;

			case "HALgetApiTokenResponse": // HAL API トークン取得の応答
			console.log( 'main -> HALgetApiTokenResponse:', c.arg );
			getHalApiTokenCallback(c.arg);
			break;

			case "HALsetApiTokenResponse": // HAL API トークン設定の応答
			console.log( 'main -> HALsetApiTokenResponse:', c.arg );
			window.HALsetApiTokenResponse( c.arg );
			break;

			case "HALdeleteApiTokenResponse": // HAL API トークン設定削除の応答
			console.log( 'main -> HALdeleteApiTokenResponse:', c.arg );
			window.HALdeleteApiTokenResponse();
			break;

			case "HALgetUserProfileResponse": // HAL ユーザープロファイル取得の応答 c.arg.profile or c.arg.error
			console.log( 'main -> HALgetUserProfileResponse:', c.arg );
			window.HALgetUserProfileResponse(c.arg);
			break;

			case "HALsyncResponse":  // HAL cloud: 同期の応答、同期処理終了
			console.log( 'main -> HALsyncResponse:', c.arg );
			window.HALsyncResponse(c.arg);
			break;


			//----------------------------------------------
			// EL関連
			case "fclEL":
			console.log( 'main -> fclEL:', c.arg );
			window.renewFacilitiesEL( c.arg );
			break;

			case "renewELConfigView":
			console.log( 'main -> renewELConfigView' );
			window.renewELConfigView( c.arg );
			break;


			//----------------------------------------------
			// 電力スマメ関連
			case "fclESM":
			console.log( 'main -> fclESM:', c.arg );
			window.renewESM( c.arg );
			break;

			case "ESMLinked":
			console.log( 'main -> ESMLinked:' );
			window.addToast( 'Info', '電力スマートメータとLinkしました');
			break;

			case "renewESMConfigView":
			console.log( 'main -> renewESMConfigView', c.arg );
			window.renewESMConfigView( c.arg );
			break;

			case "renewTodayElectricEnergy":  // WI-SUNのスマートメータ
			window.renewEnergy( c.arg );
			break;

			//----------------------------------------------
			// Philips hue関連
			case "fclHue":
			console.log( 'main -> fclHue:', c.arg );
			window.renewHueLog( JSON.stringify(c.arg, null, '  ') );
			window.renewFacilitiesHue( c.arg );
			break;

			case "HueLinked": // HueとLinkできた
			console.log( 'main -> HueLinked:', c.arg );
			window.hueLinked(c.arg);
			break;

			case "renewHueConfigView":
			console.log( 'main -> renewHueConfigView:', c.arg );
			window.renewHueConfigView( c.arg );
			break;


			//----------------------------------------------
			// Ikea関連
			case "renewIkeaConfigView":
			console.log( 'main -> renewIkeaConfigView', c.arg );
			window.renewIkeaConfigView( c.arg );
			break;


			//----------------------------------------------
			// OpenWeatherMap関連
			case "renewOwm": // OpenWeatherMapのデータをもらった
			console.log( 'main -> renewOwm:', c.arg );
			window.renewOwm( c.arg );
			break;

			case "renewOwmConfigView":  // Configを画面に表示
			console.log( 'main -> renewOwmConfigView:', c.arg );
			window.renewOwmConfigView( c.arg );
			break;


			//----------------------------------------------
			// 気象庁関連
			case "renewJmaAbst": // JMAのデータをもらった
			console.log( 'main -> renewJmaAbst:', c.arg );
			window.renewJmaAbst( c.arg );
			break;

			case "renewJmaDetail":
			console.log( 'main -> renewJmaDetail:', c.arg );
			window.renewJmaDetail( c.arg );
			break;

			case "renewJmaConfigView":
			console.log( 'main -> renewJmaConfigView', c.arg );
			window.renewJmaConfigView( c.arg );
			break;


			//----------------------------------------------
			// Netatmo関連
			case "renewNetatmo": // Netatmoのデータをもらった
			// console.log( 'main -> renewNetatmo:', c.arg );  // ログ多すぎる
			window.renewNetatmo( c.arg );
			break;

			case "renewNetatmoConfigView": // Netatmoの設定データをもらった
			console.log( 'main -> renewNetatmoConfigView:', c.arg );
			window.renewNetatmoConfigView( c.arg );
			break;


			//----------------------------------------------
			// Omron関連
			case "renewOmron": // Omronのデータをもらった
			// console.log( 'main -> renewOmron:', c.arg );  // ログ多過ぎるので必要な時だけ有効にする
			window.renewOmron(c.arg);
			break;

			case "omronDisconnected": // Omron切断
			console.log( 'main -> omronDisconnected:' );  // ログ多過ぎるので必要な時だけ有効にする
			window.disconnectedOmron();
			break;

			case "renewOmronConfigView": // Omronの設定データをもらった
			console.log( 'main -> renewOmronConfigView:', c.arg );
			window.renewOmronConfigView( c.arg );
			break;


			//----------------------------------------------
			// SwitchBot関連
			case "fclSwitchBot":
			console.log( 'main -> fclSwitchBot:', c.arg );
			window.renewFacilitiesSwitchBot( c.arg );
			break;

			case "renewSwitchBotConfigView":
			console.log( 'main -> renewSwitchBotConfigView:', c.arg );
			window.renewSwitchBotConfigView( c.arg );
			break;

			case "renewRoomEnvSwitchBot":
			// console.log( 'main -> renewRoomEnvSwitchBot:', c.arg );
			console.log( 'main -> renewRoomEnvSwitchBot' );
			window.renewRoomEnvSwitchBot( c.arg );
			break;


			//----------------------------------------------
			// 部屋環境グラフ
			case "renewRoomEnvNetatmo":
			// console.log( 'main -> newRoomEnvNetatmo:', c.arg);   // ログ多すぎる
			console.log( 'main -> newRoomEnvNetatmo' );
			window.renewRoomEnvNetatmo( c.arg );
			break;

			case "renewRoomEnvOmron":
			// console.log( 'main -> newRoomEnvOmron:', c.arg);   // ログ多すぎる
			console.log( 'main -> newRoomEnvOmron');
			window.renewRoomEnvOmron( c.arg );
			break;

			case "renewTodayElectricEnergy_submeter":  // Ether サブメータ
			window.renewEnergySubmeter( c.arg );
			break;


			//----------------------------------------------
			// PLIS全体
			case "myIPaddr":
			console.log( 'main -> myIPaddr:', c.arg );
			myIPaddr.innerHTML = 'My IP address list: ' + c.arg;
			break;

			case "renewCalendar":
			console.log('main -> renewCalendar:' );
			// console.log('main -> renewCalendar:', c.arg);
			window.renewCalendar( c.arg );
			break;

			case "configSaved": // 設定保存の応答
			console.log( 'main -> configSaved:', c.arg );
			if (c.arg.error) {
				alert(c.arg.error);
			}
			switch( c.arg ) {
				case "System": window.SystemConfigSaved(); break;
				case "User": window.UserConfigSaved(); break;
				case "OWM": window.OwmConfigSaved(); break;
				case "JMA": window.JmaConfigSaved(); break;
				case "Hue": window.HueConfigSaved(); break;
				case "Ikea": window.IkeaConfigSaved(); break;
				case "Netatmo": window.NetatmoConfigSaved(); break;
				case "Omron": window.OmronConfigSaved(); break;
				case "EL": window.ELConfigSaved(); break;
				case "ESM": window.ESMConfigSaved(); break;
				case "SwitchBot": window.SwitchBotConfigSaved(); break;

				default:
				// window.alert('設定を保存しました。');
				window.addToast( 'Info', '${c.arg} 設定を保存しました。');
				break;
			}
			break;

			case "renewLicenses": // ライセンス表示の更新
			licenses = c.arg;
			renewLicenses();
			break;

			case "Info":
			console.log( 'main -> Info:', c.arg );
			window.addToast( 'Info', c.arg );
			break;

			case "Error":
			console.log( 'main -> Error:', c.arg );
			window.addToast( 'Error', c.arg );
			break;

			default:
			txtErrLog.value = JSON.stringify(c, null, '  ');
			console.log('main -> unknown cmd:', c.cmd, "arg:", c.arg);
			break;
		}
	});

	////////////////////////////////////////////////////////////////////////////////
	// user profile関係

	let renewLicenses = function() {
		// console.log( licenses );
		let doc = `<table class="sorttbl" id="tblLicenses">`
			// + `<tr><th onclick="w3.sortHTML('#tblLicenses','.item','td:nth-child(1)')">Name <i class="fa fa-sort"></i></th>`
			// + `<th onclick="w3.sortHTML('#tblLicenses','.item','td:nth-child(2)')">Licenses <i class="fa fa-sort"></i></th>`
			// +` <th onclick="w3.sortHTML('#tblLicenses','.item','td:nth-child(3)')">Publisher <i class="fa fa-sort"></i></th>`
			// +`<th onclick="w3.sortHTML('#tblLicenses','.item','td:nth-child(4)')">Repository <i class="fa fa-sort"></i></th><tr>`;
			+ `<tr><th>Name</th>` + `<th>Licenses</th>` +` <th>Publisher</th>` +`<th>Repository</th><tr>`;

		let keys = Object.keys(licenses);
		for( let k of keys ) {
			doc += `<tr class="item"><td>${k}</td><td>${licenses[k].licenses}</td><td>${licenses[k].publisher}</td><td>${licenses[k].repository}</td><tr>`;
		}

		doc += '</table>';

		divLicenses.innerHTML = doc;
	};


	//////////////////////////////////////////////////////////////////////
	// ボタン

	// テキストエリアを見せたり隠したり
	window.pushHideButton = function( field ) {
		let txtPass = document.getElementById( field );
		let btnEye  = document.getElementById( field + "ButtonEye");
		if (txtPass.type === "text") {
			txtPass.type = "password";
			btnEye.classList.remove( "fa-eye-slash");
			btnEye.classList.add( "fa-eye");
		} else {
			txtPass.type = "text";
			btnEye.classList.add( "fa-eye-slash");
			btnEye.classList.remove( "fa-eye");
		}
	};

	// この関数の最後に呼ぶ
	// 準備できたことをmainプロセスに伝える
	window.ipc.already();
};
