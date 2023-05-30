//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.11.28
//	Ikea関係の処理
//////////////////////////////////////////////////////////////////////
/**
 * @namespace subIkea
 */
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subIkea.js');

	//----------------------------------------------------------------------------------------------
	// Ikea デバイス情報のrenew
	let facilitiesHue;  // デバイスリスト Hue
	let ikeaConnected = false; // ikeaとリンクしていないとコントロールさせない

	let txtIkeaLog = document.getElementById('txtIkeaLog');

	// control tab
	let H2ControlIkea = document.getElementById('H2ControlIkea');
	let divControlIkea = document.getElementById('divControlIkea');  // Ikeaのコントロール

	// config tab
	let inIkeaUse        = document.getElementById('inIkeaUse');
	let inIkeaSecurityCode = document.getElementById('inIkeaSecurityCode');
	let inIkeaIdentity   = document.getElementById('inIkeaIdentity');
	let inIkeaPsk        = document.getElementById('inIkeaPsk');
	let btnIkeaConfigSet = document.getElementById('btnIkeaConfigSet');

	/** 
	 * @func renewFacilitiesIkea
	 * @desc mainからの情報で，ikea関係のhtmlを変更する
	 * @param {void}
	 * @return {void}
	 */
	window.renewFacilitiesIkea = function ( arg ) { //facilitiesIkea = json = arg; // 機器情報確保
		facilitiesIkea = arg;
		// console.log( 'window.renewFacilitiesIkea() arg:', arg );

		if( !inIkeaUse.checked ) {  // 機能無効なのにrenewが来た
			if( H2ControlIkea.style.display == '' ) {
				H2ControlIkea.style.display = 'none';
			}
			divControlIkea.innerHTML = '';
			return;
		}

		if (!facilitiesIkea || isObjEmpty(facilitiesIkea ) ) {  // 機器情報なし
			doc ='<img src="./img/loadingRed.gif">接続中';
			divControlIkea.innerHTML = doc;
			return; // 機器情報なければやらない、存在も消す
		}

		let doc = '';
		if( !ikeaConnected ) {  // 情報あるけど未接続
			doc ='<img src="./img/loadingRed.gif">接続中';

		}else{
			doc = '';

			for (const [key, value] of Object.entries(facilitiesIkea))
			{
				let ip = key;
				let bridge  = value.bridge;
				let devices = value.devices;
				doc += "<div class='LinearLayoutChild'> <section>";
				doc += '<div class="tooltip"><img src="./img/ikea_bridge.jpg" class="ikea-dev" /><div class="description">' + bridge.model.serial + '&#013;&#010;' + bridge.ipaddress + '</div></div><br>' + bridge.name + '<br> </section> </div>';

				for (const [key, value] of Object.entries(devices)) {
					if( key == 0 ) { continue; } // デバイスがないときも、無しというエントリーが入っているので無視する

					// key is light number
					// value is details
					let devName = key + ':' + value.name;
					let makerCode = value.manufacturername;
					doc += "<div class='LinearLayoutChild'> <section>";

					if (value.state) {
						let operatingStatus = value.state.on;
						if (operatingStatus == true) {
							doc += "<div class='tooltip'><img src=\"./img/ikea_on.png\" class='ikea-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + devName + "<br>" +
								'<button onclick="IkeaPowButton(this)" value="' + key + ',off">OFF</button><br>';
						} else {
							doc += "<div class='tooltip'><img src=\"./img/ikea_off.png\" class='ikea-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + devName + "<br>" +
								'<button onclick="IkeaPowButton(this)" value="' + key + ',on">ON</button><br>';
						}
					}
					doc += "</section> </div>";  // ボタン設置
				}
			}
		}

		divControlIkea.innerHTML = doc;
	}

	/** 
	 * @func renewIkeaLog
	 * @desc configタブのデバッグログ
	 * @param {void}
	 * @return {void}
	 */
	window.renewIkeaLog = function( text ) {
		txtIkeaLog.value = text;
	}

	/** 
	 * @func ikeaLinked
	 * @desc ikeaとリンクしたのでGUI表示する
	 * @param {void}
	 * @return {void}
	 */
	window.ikeaLinked = function () {
		if( H2ControlIkea.style.display == 'none' ) {
			H2ControlIkea.style.display = '';
		}

		if( divControlIkea.style.display == 'none' ) {
			divControlIkea.style.display = '';
		}

		ikeaConnected = true;
	}

	//----------------------------------------------------------------------------------------------
	/** 
	 * @func IkeaPowButton
	 * @desc IkeaPowButton
	 * @param {void}
	 * @return {void}
	 */
	window.IkeaPowButton = function (btn) {
		let cmd = btn.value.split(",");

		let sendurl = "/lights/" + cmd[0] + "/state";

		switch (cmd[1]) {
			case 'on':
			window.ipc.IkeaSend( sendurl, {"on":true} );
			break;
			case 'off':
			window.ipc.IkeaSend( sendurl, {"on":false} );
			break;
			default:
			console.error('unknown cmd');
			console.error(cmd[1]);
		}
	};

	/** 
	 * @func btnIkeaConfigSet_Click
	 * @desc 設定ボタン
	 * @param {void}
	 * @return {void}
	 */
	window.btnIkeaConfigSet_Click = function () {
		// console.log( 'window.ikeaUseCheck() checkBox:', checkBox.checked );

		// 使用しない
		if( !inIkeaUse.checked ) {
			window.ipc.IkeaUseStop(inIkeaSecurityCode.value, inIkeaIdentity.value, inIkeaPsk.value );  // ikeaの監視をstopする
			ikeaConnected = false;
			return;
		}

		// 使用する
		if( inIkeaSecurityCode.value != '' && inIkeaIdentity.value != '' && inIkeaPsk.value != '' ) {
			window.addToast( 'Info', 'Ikea 連携を開始しました。実際の通信まで2分程度お待ちください。');
			window.ipc.IkeaUse( inIkeaSecurityCode.value, inIkeaIdentity.value, inIkeaPsk.value );
		}else{
			inIkeaUse.checked = false;
			window.addToast( 'Info', 'Ikea 連携を開始できません。設定を確認してください。');
		}
	};


	/** 
	 * @func IkeaConfigSaved
	 * @desc 設定完了通知
	 * @param {void}
	 * @return {void}
	 */
	window.IkeaConfigSaved = function () {
		btnIkeaConfigSet.disabled    = false;
		btnIkeaConfigSet.textContent = '設定';

		window.addToast( 'Info', 'IKEA 設定を保存しました。');
	};

	/** 
	 * @func renewIkeaConfigView
	 * @desc renewIkeaConfigView
	 * @param {void}
	 * @return {void}
	 */
	window.renewIkeaConfigView = function( arg ) {
		inIkeaUse.checked = arg.enabled;
		inIkeaSecurityCode.value = arg.securityCode;
		inIkeaIdentity.value = arg.identity;
		inIkeaPsk.value = arg.psk;
		btnIkeaConfigSet.disabled    = false;
		btnIkeaConfigSet.textContent = '設定';

		if( arg.enabled ) {  // 利用する場合
			H2ControlIkea.style.display = 'block';
			divControlIkea.style.display = '-webkit-flex';
			divIkeaSuggest.style.display = 'none';
		}else{  // 利用しない場合
			H2ControlIkea.style.display = 'none';
			divControlIkea.style.display = 'none';
			divIkeaSuggest.style.display = 'block';
		}
	};

} );
