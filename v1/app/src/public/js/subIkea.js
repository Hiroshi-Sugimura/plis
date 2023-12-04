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
	 * @param {Object} arg
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
			let icon = '';
			let name = value.name;
			let type = value.type;
			let info = value.deviceInfo;
			let makerCode = info.manufacturer;

			let alive = '';  // 接続状態
			if (value.alive) {
				alive = `<i class='fa-solid fa-link'></i>`
			} else {
				alive = `<i class='fa-solid fa-link-slash'></i>`
			}

			let battery = '';  // バッテリー充電量
			if (info?.battery >= 85) {
				battery = `<span class='icon_layers'><i class='fa-solid fa-battery-full icon_layers_icon'></i><span class='icon_layers_counter_green'>${info.battery}</span></span>`
			} else if (info?.battery >= 70) {
				battery = `<span class='icon_layers'><i class='fa-solid fa-battery-three-quarters icon_layers_icon'></i><span class='icon_layers_counter_green'>${info.battery}</span></span>`
			} else if (info?.battery >= 40) {
				battery = `<span class='icon_layers'><i class='fa-solid fa-battery-half icon_layers_icon'></i><span class='icon_layers_counter_green'>${info.battery}</span></span>`
			} else if (info?.battery >= 20) {
				battery = `<span class='icon_layers'><i class='fa-solid fa-battery-quater icon_layers_icon'></i><span class='icon_layers_counter'>${info.battery}</span></span>`
			} else {
				battery = `<span class='icon_layers'><i class='fa-solid fa-battery-empty icon_layers_icon'></i><span class='icon_layers_counter'>${info.battery}</span></span>`
			}

			let power = '';  // 電源種類
			switch (info?.power) {
				case 0: power = 'Unknown'; break;
				case 1: power = 'InternalBattery'; break;
				case 2: power = 'ExternalBattery'; break;
				case 3: power = 'Battery'; break;
				case 4: power = 'PowerOverEthernet'; break;
				case 5: power = 'USB'; break;
				case 6: power = 'AC_Power'; break;
				// default
				case 7:
				default:
					power = 'Solar'; break;
			}

			let control = ''; // 制御できるものがあれば

			doc += "<div class='LinearLayoutChild'> <section class='dev'>";

			switch (type) {
				case 0:  // remote controller
					// console.log('subIkea.js, remo-con value:', value);
					doc += `<div class='tooltip'><i class="fa-solid fa-toggle-off ikea-dev"></i><div class='description'>${makerCode}&#013;&#010;</div></div>${alive} ${battery}<br>${name}<br>`;
					break;

				case 1: // slaveRemote
					console.log('subIkea.js, slaveRemote:', value);
					break;

				case 2: // bulb, light
					// console.log('subIkea.js, bulb key:', key, ', value:', value);
					// console.log('color:', value.lightList[0].color);
					// console.log('colorTemperature:', value.lightList[0].colorTemperature);
					// console.log('dimmer:', value.lightList[0].dimmer);

					if (value.lightList[0].onOff) { // true = on
						icon = 'fa-regular fa-lightbulb';
						control = `<button onClick="window.btnIkeaBulbOnOff_Click('${key}', 'light', 'off');"><i class="fa-solid fa-power-off"></i> OFF</button>`;
					} else { // false = off
						icon = 'fa-solid fa-lightbulb';
						control = `<button onClick="window.btnIkeaBulbOnOff_Click('${key}', 'light', 'on');"><i class="fa-solid fa-power-off"></i> ON</button>`;
					}

					doc += `<div class='tooltip'><i class='${icon} ikea-dev'></i><div class='description'>${makerCode}&#013;&#010;</div></div>${alive}<br>${name}<br>${control}`;
					break;

				case 3: // plug
					console.log('subIkea.js, plug:', value);
					break;

				case 4: // motion sensor
					console.log('subIkea.js, plug:', value);
					break;

				case 6: // signal repeater
					// console.log('subIkea.js, signal repeater value:', value);
					doc += `<div class='tooltip'><i class="fa-solid fa-wifi ikea-dev"></i><div class='description'>${makerCode}&#013;&#010;</div></div>${alive}<br>${name}<br>`;
					break;

				case 7: // blind
					// console.log('subIkea.js, blind value:', value);
					control = `<input type='range' id="inIkeaBlindApertureRange_${key}" value='${value.blindList[0].position}' min='0' max='100' step='5' onChange='window.inIkeaBlindApertureRange_Change("${key}", this.value);'><br>`
						+ `開度: <input type='number' id="inIkeaBlindApertureNumber_${key}" value='${value.blindList[0].position}' min='0' max='100' step='5' onChange='window.inIkeaBlindApertureNumber_Change("${key}", this.value);'>`

					doc += `<div class='tooltip'><i class="fa-solid fa-warehouse ikea-dev"></i><div class='description'>${makerCode}&#013;&#010;</div></div>${alive} ${battery}<br>${name}<br>${control}<br>`;
					break;

				case 8: // sound remote
					console.log('subIkea.js, sound remote:', value);
					break;

				case 10: // air purifier
					console.log('subIkea.js, air purifier:', value);
					break;

				default:
					console.log('subIkea.js, default value:', value);
					break;
			}
			doc += "</section> </div>";  // ボタン設置
		}

		divControlIkea.innerHTML = doc;
	};

	/**
	 * @func window.renewIkeaLog
	 * @desc configタブのデバッグログ
	 * @param {string} text
	 */
	window.renewIkeaLog = function (text) {
		txtIkeaLog.value = text;
	};


	//----------------------------------------------------------------------------------------------
	// IKEA デバイス制御

	/** 
	 * @func window.btnIkeaBulbOnOff_Click
	 * @desc Ikea 照明のON/OFF
	 * @param key - device id
	 * @param command - on or off
	 */
	window.btnIkeaBulbOnOff_Click = function (key, type, command) {
		switch (command) {
			case 'on':
				window.ipc.IkeaSend(key, type, { "onOff": true });
				break;
			case 'off':
				window.ipc.IkeaSend(key, type, { "onOff": false });
				break;
		}
	};


	/** 
	 * @func window.inIkeaBlindApertureRange_Change
	 * @desc Ikea ブラインドの開け閉めステップ
	 * @param key - device id
	 * @param value - [0-100]
	 */
	window.inIkeaBlindApertureRange_Change = function (key, value) {
		let number = document.getElementById("inIkeaBlindApertureNumber_" + key);
		number.value = value;

		window.ipc.IkeaSend(key, 'blind', { "position": value });
	};

	/** 
	 * @func window.inIkeaBlindApertureNumber_Change
	 * @desc Ikea ブラインドの開け閉めステップ
	 * @param key - device id
	 * @param value - [0-100]
	 */
	window.inIkeaBlindApertureNumber_Change = function (key, value) {
		let range = document.getElementById("inIkeaBlindApertureRange_" + key);
		range.value = value;

		window.ipc.IkeaSend(key, 'blind', { "position": value });
	};

	//----------------------------------------------------------------------------------------------
	// IKEA 設定

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
