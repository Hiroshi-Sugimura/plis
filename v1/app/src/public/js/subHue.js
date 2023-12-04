//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.30
//	hue関係の処理
//////////////////////////////////////////////////////////////////////
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
/**
 * @namespace subHue
 */
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
	let inHueUse = document.getElementById('inHueUse');  // Hue使うフラグ
	let inHueKey = document.getElementById('inHueKey'); // HueのKey
	let selHueDebugMode = document.getElementById('selHueDebugMode');  // デバッグモード
	let btnHueConfigSet = document.getElementById('btnHueConfigSet');  // 設定ボタン
	let dlgHuePush = document.getElementById('dlgHuePush');  // 設定サポートダイアログ


	/** 
	 * @func window.renewFacilitiesHue
	 * @desc mainからの情報で，hue関係のhtmlを変更する
	 * @param {void}
	 * @return {void}
	 */
	window.renewFacilitiesHue = function (arg) { //facilitiesHue = json = arg; // 機器情報確保
		facilitiesHue = arg;
		// console.log( 'window.renewFacilitiesHue() arg:', arg );

		if (!inHueUse.checked) {  // 機能無効なのにrenewが来た
			return;
		}

		if (!facilitiesHue || isObjEmpty(facilitiesHue)) {  // 機器情報なし
			doc = '<img src="./img/loadingRed.gif">接続中';
			divControlHue.innerHTML = doc;
			return; // 機器情報なければやらない、存在も消す
		}

		let doc = '';
		if (!hueConnected) {  // 情報あるけど未接続
			doc = '<img src="./img/loadingRed.gif">接続中';

		} else {
			doc = '';

			for (const [key, value] of Object.entries(facilitiesHue)) {
				let ip = key;
				let bridge = value.bridge;
				let devices = value.devices;

				H2ControlHue.innerHTML = `Philips Hue : ${bridge.name}`;

				for (const [key, value] of Object.entries(devices)) {
					if (key == 0) { continue; } // デバイスがないときも、無しというエントリーが入っているので無視する

					// key is light number
					// value is details
					let devName = key + ':' + value.name;
					let makerCode = value.manufacturername;
					doc += "<div class='LinearLayoutChild'> <section class='dev'>";

					if (value.state) {
						let operatingStatus = value.state.on;
						if (operatingStatus == true) {
							doc += `<a href='javascript: window.openHueRenameDlg("${key}");'><span class='fa-solid fa-gear hue-settings-btn'> </span></a>`;
							doc += `<div class='tooltip'><i class='fa-regular fa-lightbulb hue-dev'></i><div class='description'>${makerCode}&#013;&#010;${ip}</div></div><br>${devName}<br>`
								+ `<button onclick='HuePowButton(this)' value='${key},off'><i class="fa-solid fa-power-off"></i> OFF</button><br>`;
						} else {
							doc += `<a href='javascript: window.openHueRenameDlg("${key}");'><span class='fa-solid fa-gear hue-settings-btn'> </span></a>`;
							doc += `<div class='tooltip'><i class='fa-solid fa-lightbulb hue-dev'></i><div class='description'>${makerCode}&#013;&#010;${ip}</div></div><br>${devName}<br>`
								+ `<button onclick='HuePowButton(this)' value='${key},on'><i class="fa-solid fa-power-off"></i> ON</button><br>`;
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
	window.renewHueLog = function (text) {
		txtHueLog.value = text;
	};

	/** 
	 * @func window.hueLinked
	 * @desc hueとリンクしたのでGUI表示する
	 * @param {void}
	 * @return {void}
	 */
	window.hueLinked = function (key) {
		hueConnected = true;
		dlgHuePush.close();
		window.addToast('Info', 'HueとLinkしました');
	};

	//----------------------------------------------------------------------------------------------
	/** 
	 * @func window.btnHueConfigSet_Click
	 * @desc Hue link unlink
	 */
	window.btnHueConfigSet_Click = function () {
		window.HueDebugLog('window.btnHueConfigSet_Click():', inHueUse.checked);

		// 使用しない
		if (inHueUse.checked == false) {
			window.ipc.HueUseStop(inHueKey.value,
				selHueDebugMode.value == 'true' ? true : false);  // hueの監視をstopする
			hueConnected = false;

			divControlHue.innerHTML = '';
			return;
		}

		// 使用する
		if (inHueKey.value == '') { // キー無しで有効にしたらLinkボタンが必要
			window.ipc.HueUse('',
				selHueDebugMode.value == 'true' ? true : false);
			dlgHuePush.showModal();
		} else { // キー指定ありで有効にしたら，そのキーで開始
			window.addToast('Info', 'Hue 連携を開始しました。実際の通信まで2分程度お待ちください。');
			window.ipc.HueUse(inHueKey.value,
				selHueDebugMode.value == 'true' ? true : false);
		}
	};

	/** 
	 * @func windo.btnHueUseCancel_Click
	 * @desc キャンセルボタンを押したとき
	 */
	window.btnHueUseCancel_Click = function () {
		window.HueDebugLog('window.btnHueUseCancel_Click');
		inHueUse.checked = false;
		window.ipc.HueUseCancel(inHueKey.value,
			selHueDebugMode.value == 'true' ? true : false);
		dlgHuePush.close();
	};

	/** 
	 * @func dlgHuePush_oncancel
	 * @memberof subHue
	 * @desc エスケープキーでキャンセルしたとき
	 */
	dlgHuePush.oncancel = function () {
		window.HueDebugLog('dlgHuePush.oncancel');
		inHueUse.checked = false;
		window.ipc.HueUseCancel(inHueKey.value,
			selHueDebugMode.value == 'true' ? true : false);
	};


	/** 
	 * @func window.HueConfigSaved
	 * @desc 設定完了通知で、設定ボタンの復活（連打防止）
	 */
	window.HueConfigSaved = function () {
		btnHueConfigSet.disabled = false;
		btnHueConfigSet.textContent = '設定';

		window.addToast('Info', 'Hue 設定を保存しました。');
	};

	/** 
	 * @func window.renewHueConfigView
	 * @desc mainプロセスから設定値をもらったので画面を更新
	 * @param {Object} arg
	 */
	window.renewHueConfigView = function (arg) {
		inHueUse.checked = arg.enabled;
		inHueKey.value = arg.key;
		selHueDebugMode.value = arg.debug;
		btnHueConfigSet.disabled = false;
		btnHueConfigSet.textContent = '設定';

		if (arg.enabled) {  // 利用する場合
			H2ControlHue.style.display = 'block';
			divControlHue.style.display = '-webkit-flex';
			divHueSuggest.style.display = 'none';
		} else {  // 利用しない場合
			H2ControlHue.style.display = 'none';
			divControlHue.style.display = 'none';
			divHueSuggest.style.display = 'block';
		}
	};


	/** 
	 * @func window.HueDebugPrint
	 * @desc Hueモジュールがデバッグなら出力する
	 * @param {...} values
	 */
	window.HueDebugLog = function (param0, ...values) {
		selHueDebugMode.value == 'true' ? console.log(param0, ...values) : 0;
	};


	// -----------------------------------------------------
	// Hue control
	/** 
	 * @func window.HuePowButton
	 * @desc HuePowButton
	 * @param {Button} btn
	 */
	window.HuePowButton = function (btn) {
		let cmd = btn.value.split(",");

		let sendurl = "/lights/" + cmd[0] + "/state";

		switch (cmd[1]) {
			case 'on':
				window.ipc.HueControl(sendurl, { "on": true });
				break;
			case 'off':
				window.ipc.HueControl(sendurl, { "on": false });
				break;
			default:
				console.error('unknown cmd');
				console.error(cmd[1]);
		}
	};


	/** 
	 * @func window.openHueRenameDlg
	 * @desc hue rename dlgを開く
	 * openHueRenameDlg
	 * @param {void}
	 * @return {void}
	 */
	window.openHueRenameDlg = function (id) {
		let spanHueRenameBtn = document.getElementById('spanHueRenameBtn');  // 更新ボタン
		let dlgHueRenameDialog = document.getElementById('dlgHueRenameDialog');  // 開くダイアログ

		spanHueRenameBtn.innerHTML = `<button type='button' onclick='window.HueRename("${id}");document.getElementById("dlgHueRenameDialog").close();'>更新</button>`;

		dlgHueRenameDialog.showModal();
	};

	/** 
	 * @func window.HueRename
	 * @desc Hue control
	 * @param {void}
	 * @return {void}
	 */
	// 
	window.HueRename = function (id) {
		let newName = document.getElementById('hueNewName').value;

		let sendurl = "/lights/" + id;

		if (newName) {
			window.ipc.HueControl(sendurl, { "name": newName });
		} else {
			console.error('bad name:', newName);
		}
	};


});
