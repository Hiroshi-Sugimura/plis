//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.11.28
//	Ikea関係の処理
//////////////////////////////////////////////////////////////////////
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
/**
 * @namespace subIkea
 */
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subIkea.js');

	//----------------------------------------------------------------------------------------------
	// Ikea デバイス情報のrenew
	let facilitiesIkea;  // デバイスリスト Ikea
	let txtIkeaLog = document.getElementById('txtIkeaLog');

	// control tab
	let H2ControlIkea = document.getElementById('H2ControlIkea');
	let divControlIkea = document.getElementById('divControlIkea');  // Ikeaのコントロール

	// config tab
	let inIkeaUse = document.getElementById('inIkeaUse');
	let inIkeaSecurityCode = document.getElementById('inIkeaSecurityCode');
	let inIkeaIdentity = document.getElementById('inIkeaIdentity');
	let inIkeaPsk = document.getElementById('inIkeaPsk');
	let btnIkeaConfigSet = document.getElementById('btnIkeaConfigSet');

	/** 
	 * @func window.renewFacilitiesIkea
	 * @desc mainからの情報で，ikea関係のhtmlを変更する
	 * @param {void}
	 * @return {void}
	 */
	window.renewFacilitiesIkea = function (arg) { //facilitiesIkea = json = arg; // 機器情報確保
		facilitiesIkea = arg;
		// console.log('window.renewFacilitiesIkea() arg:', arg);

		if (!inIkeaUse.checked) {  // 機能無効なのにrenewが来た
			if (H2ControlIkea.style.display == '') {
				H2ControlIkea.style.display = 'none';
			}
			divControlIkea.innerHTML = '';
			return;
		}

		if (!facilitiesIkea || isObjEmpty(facilitiesIkea)) {  // 機器情報なし
			doc = '<img src="./img/loadingRed.gif">接続中';
			divControlIkea.innerHTML = doc;
			return; // 機器情報なければやらない、存在も消す
		}

		let doc = '';

		for (const [key, value] of Object.entries(facilitiesIkea)) {
			// console.log('subIkea.js, key:', key, 'value:', value);

			if (key == 0) { continue; } // デバイスがないときも、無しというエントリーが入っているので無視する

			// key is light number
			// value is details
			let name = value.name;
			let alive = value.alive;
			let type = value.type;
			let info = value.deviceInfo;
			let makerCode = info.manufacturer;
			let power = info.power;
			let battery = info.battery;

			doc += "<div class='LinearLayoutChild'> <section>";

			switch (type) {
				case 0:  // remote controller
					// console.log('subIkea.js, remo-con value:', value);
					doc += `<div class='tooltip'><i class="fa-solid fa-toggle-off ikea-dev"></i><div class='description'>${makerCode}&#013;&#010;</div></div><br>${name}<br>alive:${alive}<br>battery:${battery}<br>power:${power}<br>`;
					break;
				case 2: // bulb
					// console.log('subIkea.js, bulb value:', value);
					doc += `<div class='tooltip'><i class="fa-regular fa-lightbulb ikea-dev"></i><div class='description'>${makerCode}&#013;&#010;</div></div><br>${name}<br>alive:${alive}<br>power:${power}<br>`;
					break;
				case 6: // signal repeater
					// console.log('subIkea.js, signal repeater value:', value);
					doc += `<div class='tooltip'><i class="fa-solid fa-wifi ikea-dev"></i><div class='description'>${makerCode}&#013;&#010;</div></div><br>${name}<br>alive:${alive}<br>power:${power}<br>`;
					break;
				case 7: // blind
					// console.log('subIkea.js, bulb value:', value);
					doc += `<div class='tooltip'><i class="fa-regular fa-lightbulb ikea-dev"></i><div class='description'>${makerCode}&#013;&#010;</div></div><br>${name}<br>alive:${alive}<br>battery:${battery}<br>power:${power}<br>`;
					break;

				default:
					console.log('subIkea.js, default value:', value);
					break;
			}
			doc += "</section> </div>";  // ボタン設置
		}

		divControlIkea.innerHTML = doc;
	}

	/** 
	 * @func window.renewIkeaLog
	 * @desc configタブのデバッグログ
	 * @param {void}
	 * @return {void}
	 */
	window.renewIkeaLog = function (text) {
		txtIkeaLog.value = text;
	}


	//----------------------------------------------------------------------------------------------
	/** 
	 * @func window.IkeaPowButton
	 * @desc IkeaPowButton
	 * @param {void}
	 * @return {void}
	 */
	window.IkeaPowButton = function (btn) {
		let cmd = btn.value.split(",");

		let sendurl = "/lights/" + cmd[0] + "/state";

		switch (cmd[1]) {
			case 'on':
				window.ipc.IkeaSend(sendurl, { "on": true });
				break;
			case 'off':
				window.ipc.IkeaSend(sendurl, { "on": false });
				break;
			default:
				console.error('unknown cmd');
				console.error(cmd[1]);
		}
	};

	/** 
	 * @func window.btnIkeaConfigSet_Click
	 * @desc 設定ボタン
	 * @param {void}
	 * @return {void}
	 */
	window.btnIkeaConfigSet_Click = function () {
		// console.log( 'window.ikeaUseCheck() checkBox:', checkBox.checked );

		// 使用しない
		if (!inIkeaUse.checked) {
			window.ipc.IkeaUseStop(inIkeaSecurityCode.value, inIkeaIdentity.value, inIkeaPsk.value);  // ikeaの監視をstopする
			return;
		}

		// 使用する
		if (inIkeaSecurityCode.value != '' && inIkeaIdentity.value != '' && inIkeaPsk.value != '') {
			window.addToast('Info', 'Ikea 連携を開始しました。実際の通信まで2分程度お待ちください。');
			window.ipc.IkeaUse(inIkeaSecurityCode.value, inIkeaIdentity.value, inIkeaPsk.value);
		} else {
			inIkeaUse.checked = false;
			window.addToast('Info', 'Ikea 連携を開始できません。設定を確認してください。');
		}
	};


	/** 
	 * @func window.IkeaConfigSaved
	 * @desc 設定完了通知
	 * @param {void}
	 * @return {void}
	 */
	window.IkeaConfigSaved = function () {
		btnIkeaConfigSet.disabled = false;
		btnIkeaConfigSet.textContent = '設定';

		window.addToast('Info', 'IKEA 設定を保存しました。');
	};

	/** 
	 * @func window.renewIkeaConfigView
	 * @desc renewIkeaConfigView
	 * @param {void}
	 * @return {void}
	 */
	window.renewIkeaConfigView = function (arg) {
		inIkeaUse.checked = arg.enabled;
		inIkeaSecurityCode.value = arg.securityCode;
		inIkeaIdentity.value = arg.identity;
		inIkeaPsk.value = arg.psk;
		btnIkeaConfigSet.disabled = false;
		btnIkeaConfigSet.textContent = '設定';

		if (arg.enabled) {  // 利用する場合
			H2ControlIkea.style.display = 'block';
			divControlIkea.style.display = '-webkit-flex';
			divIkeaSuggest.style.display = 'none';
		} else {  // 利用しない場合
			H2ControlIkea.style.display = 'none';
			divControlIkea.style.display = 'none';
			divIkeaSuggest.style.display = 'block';
		}
	};

});
