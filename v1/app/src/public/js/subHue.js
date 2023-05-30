//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.30
//	hue関係の処理
//////////////////////////////////////////////////////////////////////
/**
 * @module subHue
 */
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subHue.js');

	//----------------------------------------------------------------------------------------------
	// Hue デバイス情報のrenew
	let facilitiesHue;  // デバイスリスト Hue
	let hueConnected = false; // hueとリンクしていないとコントロールさせない

	let txtHueLog = document.getElementById('txtHueLog');

	// control tab
	let H2ControlHue = document.getElementById('H2ControlHue');
	let divControlHue = document.getElementById('divControlHue');  // Hueのコントロール
	let divHueSuggest = document.getElementById('divHueSuggest');  // Hue設定がないときのサジェスト

	// config tab
	let inHueUse        = document.getElementById('inHueUse');
	let inHueKey        = document.getElementById('inHueKey');
	let btnHueConfigSet = document.getElementById('btnHueConfigSet');  // 設定ボタン
	let dlgHuePush      = document.getElementById('dlgHuePush');  // 設定サポートダイアログ


	/** 
	 * @func window.renewFacilitiesHue
	 * @desc mainからの情報で，hue関係のhtmlを変更する
	 * @param {void}
	 * @return {void}
	 */
	window.renewFacilitiesHue = function ( arg ) { //facilitiesHue = json = arg; // 機器情報確保
		facilitiesHue = arg;
		// console.log( 'window.renewFacilitiesHue() arg:', arg );

		if( !inHueUse.checked ) {  // 機能無効なのにrenewが来た
			return;
		}

		if ( !facilitiesHue || isObjEmpty(facilitiesHue ) ) {  // 機器情報なし
			doc ='<img src="./img/loadingRed.gif">接続中';
			divControlHue.innerHTML = doc;
			return; // 機器情報なければやらない、存在も消す
		}

		let doc = '';
		if( !hueConnected ) {  // 情報あるけど未接続
			doc ='<img src="./img/loadingRed.gif">接続中';

		}else{
			doc = '';

			for (const [key, value] of Object.entries(facilitiesHue))
			{
				let ip = key;
				let bridge  = value.bridge;
				let devices = value.devices;
				doc += "<div class='LinearLayoutChild'> <section>";
				doc += '<div class="tooltip"><img src="./img/hue_bridge.jpg" class="hue-dev" /><div class="description">' + bridge.model.serial + '&#013;&#010;' + bridge.ipaddress + '</div></div><br>' + bridge.name + '<br> </section> </div>';

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
							doc += `<a href='javascript: window.openHueRenameDlg("${key}");'><span class='fa-solid fa-gear hue-settings-btn'> </span></a>`;
							doc += "<div class='tooltip'><img src=\"./img/hue_on.png\" class='hue-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + devName + "<br>" +
								'<button onclick="HuePowButton(this)" value="' + key + ',off">OFF</button><br>';
						} else {
							doc += `<a href='javascript: window.openHueRenameDlg("${key}");'><span class='fa-solid fa-gear hue-settings-btn'> </span></a>`;
							doc += "<div class='tooltip'><img src=\"./img/hue_off.png\" class='hue-dev' /><div class='description'>" + makerCode + "&#013;&#010;" + ip + "</div></div><br>" + devName + "<br>" +
								'<button onclick="HuePowButton(this)" value="' + key + ',on">ON</button><br>';
						}
					}
					doc += "</section> </div>";  // ボタン設置
				}
			}
		}

		divControlHue.innerHTML = doc;
	};

	/** 
	 * @func window.renewHueLog
	 * @desc configタブのデバッグログ
	 * @param {void}
	 * @return {void}
	 */
	window.renewHueLog = function( text ) {
		txtHueLog.value = text;
	};

	/** 
	 * @func hueLinked
	 * @desc hueとリンクしたのでGUI表示する
	 * @param {void}
	 * @return {void}
	 */
	window.hueLinked = function (key) {
		hueConnected = true;
		dlgHuePush.close();
		window.addToast( 'Info', 'HueとLinkしました');
	};

	//----------------------------------------------------------------------------------------------
	/** 
	 * @func btnHueConfigSet_Click
	 * @desc Hue link unlink
	 * @param {void}
	 * @return {void}
	 */
	window.btnHueConfigSet_Click = function () {
		console.log( 'window.btnHueConfigSet_Click():', inHueUse.checked );

		// 使用しない
		if( inHueUse.checked == false ) {
			window.ipc.HueUseStop( inHueKey.value );;  // hueの監視をstopする
			hueConnected = false;

			divControlHue.innerHTML = '';
			return;
		}

		// 使用する
		if(inHueKey.value == '') { // キー無しで有効にしたらLinkボタンが必要
			window.ipc.HueUse('');
			dlgHuePush.showModal();
		}else{ // キー指定ありで有効にしたら，そのキーで開始
			window.addToast( 'Info', 'Hue 連携を開始しました。実際の通信まで2分程度お待ちください。');
			window.ipc.HueUse( inHueKey.value );
		}
	};

	/** 
	 * @func btnHueUseCancel_Click
	 * @desc キャンセルボタンを押したとき
	 * @param {void}
	 * @return {void}
	 */
	window.btnHueUseCancel_Click = function () {
		console.log('window.btnHueUseCancel_Click');
		inHueUse.checked = false;
		window.ipc.HueUseCancel( inHueKey.value );
		dlgHuePush.close();
	};

	/** 
	 * @func oncancel
	 * @desc エスケープキーでキャンセルしたとき
	 * @param {void}
	 * @return {void}
	 */
	dlgHuePush.oncancel = function () {
		console.log('dlgHuePush.oncancel');
		inHueUse.checked = false;
		window.ipc.HueUseCancel( inHueKey.value );
	};


	/** 
	 * @func HueConfigSaved
	 * @desc 設定完了通知で、設定ボタンの復活（連打防止）
	 * @param {void}
	 * @return {void}
	 */
	window.HueConfigSaved = function () {
		btnHueConfigSet.disabled    = false;
		btnHueConfigSet.textContent = '設定';

		window.addToast( 'Info', 'Hue 設定を保存しました。');
	};

	/** 
	 * @func renewHueConfigView
	 * @desc mainプロセスから設定値をもらったので画面を更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewHueConfigView = function (arg) {
		inHueUse.checked   = arg.enabled;
		inHueKey.value     = arg.key;
		btnHueConfigSet.disabled    = false;
		btnHueConfigSet.textContent = '設定';

		if( arg.enabled ) {  // 利用する場合
			H2ControlHue.style.display = 'block';
			divControlHue.style.display = '-webkit-flex';
			divHueSuggest.style.display = 'none';
		}else{  // 利用しない場合
			H2ControlHue.style.display = 'none';
			divControlHue.style.display = 'none';
			divHueSuggest.style.display = 'block';
		}
	};


	// -----------------------------------------------------
	// Hue control
	/** 
	 * @func HuePowButton
	 * @desc HuePowButton
	 * @param {void}
	 * @return {void}
	 */
	window.HuePowButton = function (btn) {
		let cmd = btn.value.split(",");

		let sendurl = "/lights/" + cmd[0] + "/state";

		switch (cmd[1]) {
			case 'on':
			window.ipc.HueControl( sendurl, {"on":true} );
			break;
			case 'off':
			window.ipc.HueControl( sendurl, {"on":false} );
			break;
			default:
			console.error('unknown cmd');
			console.error(cmd[1]);
		}
	};


	/** 
	 * @func hue rename dlgを開く
	 * @desc openHueRenameDlg
	 * @param {void}
	 * @return {void}
	 */
	window.openHueRenameDlg = function( id ) {
		let spanHueRenameBtn   = document.getElementById('spanHueRenameBtn');  // 更新ボタン
		let dlgHueRenameDialog = document.getElementById('dlgHueRenameDialog');  // 開くダイアログ

		spanHueRenameBtn.innerHTML = `<button type='button' onclick='window.HueRename("${id}");document.getElementById("dlgHueRenameDialog").close();'>更新</button>`;

		dlgHueRenameDialog.showModal();
	};

	/** 
	 * @func HueRename
	 * @desc Hue control
	 * @param {void}
	 * @return {void}
	 */
	// 
	window.HueRename = function ( id ) {
		let newName = document.getElementById('hueNewName').value;

		let sendurl = "/lights/" + id;

		if ( newName ) {
			window.ipc.HueControl( sendurl, {"name": newName} );
		}else{
			console.error('bad name:', newName );
		}
	};


} );
