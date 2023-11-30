//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.30
//	SwitchBot関係の処理
//////////////////////////////////////////////////////////////////////
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
/**
 * @namespace subSwitchBot
 */
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subSwitchBot.js');

	let facilitiesSwitchBot; // 宅内情報（switchBot）

	let H3SwitchBot = document.getElementById('H3SwitchBot');
	let H3SwitchBotPower = document.getElementById('H3SwitchBotPower');

	// config
	let inSwitchBotUse = document.getElementById('inSwitchBotUse'); // switchBot; use or not
	let inSwitchBotToken = document.getElementById('inSwitchBotToken'); // switchBot; token
	let inSwitchBotSecret = document.getElementById('inSwitchBotSecret'); // switchBot; secret
	let btnSwitchBotConfigSet = document.getElementById('btnSwitchBotConfigSet'); // switchBot; 設定ボタン

	// control tab
	let H2ControlSwitchBot = document.getElementById('H2ControlSwitchBot');  // ヘッダ
	let divControlSwitchBot = document.getElementById('divControlSwitchBot');  // SwitchBotのコントロール
	const canRoomEnvChartSwitchBot = document.getElementById('canRoomEnvChartSwitchBot');  // 部屋環境グラフ
	let divSwitchBotSuggest = document.getElementById('divSwitchBotSuggest'); // switchBot; サジェスト

	// dialog
	let dlgSwitchBotSettingsDialog = document.getElementById('dlgSwitchBotSettingsDialog');  // switchBotの汎用ダイアログ
	let divSwitchBotSettingsContents = document.getElementById('divSwitchBotSettingsContents');  // switchBotの汎用ダイアログのコンテンツ

	//----------------------------------------------------------------------------------------------
	/**
	 * @func
	 * @desc SwitchBot デバイス情報のrenew
	 * @param {Object} arg
	 * @return {void}
	 */
	window.renewFacilitiesSwitchBot = function (arg) {
		// console.log('window.renewFacilitiesSwitchBot() arg:', arg);
		facilitiesSwitchBot = arg;

		if (!inSwitchBotUse.checked) {  // 機能無効なのにrenewが来た
			return;
		}
		let doc = '';

		if (!facilitiesSwitchBot || isObjEmpty(facilitiesSwitchBot)) {  // 機器情報なし
			doc = '<img src="./img/loadingRed.gif">接続中、又は機器情報取得中';
			divControlSwitchBot.innerHTML = doc;
			return; // 機器情報なければやらない、存在も消す
		}

		spanSwitchBotTime.innerHTML = `${moment().format("YYYY/MM/DD HH:mm:ss")} 取得, ${arg.count} calls/day`;

		let devs = facilitiesSwitchBot.deviceList; // array
		for (const d of devs) {
			let devState = facilitiesSwitchBot[d.deviceId];
			let icon = '';
			let subicon = '';
			let cloudIcon = '';
			let batteryIcon = '';
			let control = '';
			let temp = '';
			let color = '#000000';
			// console.log('window.renewFacilitiesSwitchBot() d:', d, 'devState:', devState);
			doc += "<div class='LinearLayoutChild'> <section>";

			switch (d.deviceType) {
				case 'Bot':
					switch (devState.power) {
						case 'on':
							icon = `<span class='icon_layers'><i class='fa-regular fa-square switchBot-dev icon_layers_icon'></i><span class='icon_layers_text_black'>ON</span></span>`
							control = `<button onClick="window.SwitchBotBot('${d.deviceId}', 'turnOff', 'default');">OFF</button>`;
							break;
						case 'off':
							icon = `<span class='icon_layers'><i class='fa-regular fa-square switchBot-dev icon_layers_icon'></i><span class='icon_layers_text_black'>OFF</span></span>`
							control = `<button onClick="window.SwitchBotBot('${d.deviceId}', 'turnOn', 'default');">ON</button>`;
							break;
					}

					if (d.enableCloudService) {  // クラウドモード
						cloudIcon = `<i class='fa-solid fa-cloud'></i>`
					} else {
						cloudIcon = `<span class='icon_layers'><i class='fa-solid fa-cloud icon_layers_icon'></i><span class='icon_layers_text'>&#10060;</span></span>`
					}
					doc += `<div class="tooltip">${icon}<div class="description">${d.deviceId}</div></div>${cloudIcon}<br>${d.deviceName}<br>${control}`;
					break;

				case 'Curtain':
					doc += `<div class="tooltip"><i class="fa-solid fa-person-booth switchBot-dev"></i><div class="description">${d.deviceId}</div></div><br>${d.deviceName}<br>Position:${devState.slidePosition}`;
					break;

				case 'Hub':
				case 'Hub Plus':
				case 'Hub Mini':
					doc += `<div class="tooltip"><i class="fa-solid fa-cube switchBot-dev"></i><div class="description">${d.deviceId}</div></div><br>${d.deviceName}`;
					break;

				case 'Meter':
				case 'MeterPlus':
					if (devState.battery >= 85) {
						batteryIcon = `<span class='icon_layers'><i class='fa-solid fa-battery-full icon_layers_icon'></i><span class='icon_layers_counter'>${devState.battery}</span></span>`
					} else if (devState.battery >= 70) {
						batteryIcon = `<span class='icon_layers'><i class='fa-solid fa-battery-three-quarters icon_layers_icon'></i><span class='icon_layers_counter'>${devState.battery}</span></span>`
					} else if (devState.battery >= 40) {
						batteryIcon = `<span class='icon_layers'><i class='fa-solid fa-battery-half icon_layers_icon'></i><span class='icon_layers_counter'>${devState.battery}</span></span>`
					} else if (devState.battery >= 20) {
						batteryIcon = `<span class='icon_layers'><i class='fa-solid fa-battery-quater icon_layers_icon'></i><span class='icon_layers_counter'>${devState.battery}</span></span>`
					} else {
						batteryIcon = `<span class='icon_layers'><i class='fa-solid fa-battery-empty icon_layers_icon'></i><span class='icon_layers_counter'>${devState.battery}</span></span>`
					}

					doc += `<div class="tooltip"><i class="fa-solid fa-temperature-half switchBot-dev"></i><div class="description">${d.deviceId}</div></div>${batteryIcon}<br>${d.deviceName}<br><i class="fa-solid fa-temperature-three-quarters"></i> ${devState.temperature} ℃<br><i class="fa-solid fa-droplet"></i> ${devState.humidity} ％`;
					break;

				case 'Lock':
					doc += `<div class="tooltip"><i class="fa-solid fa-lock switchBot-dev"></i><div class="description">${d.deviceId}</div></div><br>${d.deviceName}<br>LockState:${d.lockState}<br>DoorState:${devState.doorState}`;
					break;

				case 'Keypad':  // 指紋認証鍵
				case 'Keypad Touch':
					doc += `<div class="tooltip"><i class="fa-solid fa-fingerprint switchBot-dev"></i><div class="description">${d.deviceId}</div></div><br>${d.deviceName}`;
					break;

				case 'Remote':  // リモートボタン
					if (d.enableCloudService) {  // クラウドモード
						cloudIcon = `<i class='fa-solid fa-cloud'></i>`
					} else {
						cloudIcon = `<span class='icon_layers'><i class='fa-solid fa-cloud icon_layers_icon'></i><span class='icon_layers_text'>&#10060;</span></span>`
					}

					doc += `<div class="tooltip"><i class="fa-solid fa-toggle-off switchBot-dev"></i><div class="description">${d.deviceId}</div></div>${cloudIcon}<br>${d.deviceName}`;
					break;

				case 'Motion Sensor':
					switch (devState.brightness) {
						case "bright": subicon = "fa-regular fa-sun"; break;  // 明るい
						case "dim": subicon = "fa-solid fa-moon"; break;  // 暗い
					}

					if (d.enableCloudService) {  // クラウドモード
						cloudIcon = `<i class='fa-solid fa-cloud'></i>`
					} else {
						cloudIcon = `<span class='icon_layers'><i class='fa-solid fa-cloud icon_layers_icon'></i><span class='icon_layers_text'>&#10060;</span></span>`
					}

					if (devState.battery >= 85) {
						batteryIcon = `<span class='icon_layers'><i class='fa-solid fa-battery-full icon_layers_icon'></i><span class='icon_layers_counter'>${devState.battery}</span></span>`
					} else if (devState.battery >= 70) {
						batteryIcon = `<span class='icon_layers'><i class='fa-solid fa-battery-three-quarters icon_layers_icon'></i><span class='icon_layers_counter'>${devState.battery}</span></span>`
					} else if (devState.battery >= 40) {
						batteryIcon = `<span class='icon_layers'><i class='fa-solid fa-battery-half icon_layers_icon'></i><span class='icon_layers_counter'>${devState.battery}</span></span>`
					} else if (devState.battery >= 20) {
						batteryIcon = `<span class='icon_layers'><i class='fa-solid fa-battery-quater icon_layers_icon'></i><span class='icon_layers_counter'>${devState.battery}</span></span>`
					} else {
						batteryIcon = `<span class='icon_layers'><i class='fa-solid fa-battery-empty icon_layers_icon'></i><span class='icon_layers_counter'>${devState.battery}</span></span>`
					}

					doc += `<div class="tooltip"><i class="fa-solid fa-person-rays switchBot-dev"></i><i class="${subicon} switchBot-dev"></i><div class="description">${d.deviceId}</div></div>${cloudIcon} ${batteryIcon}<br>${d.deviceName}<br>MoveDetected: ${devState.moveDetected}`;
					break;

				case 'Contact Sensor':  // 開閉センサ
					/* APIマニュアルにはあるけど、実際はセンサデータとれてない。常にbrightになる。
					switch(devState.brightness){
						case "bright": subicon = "fa-regular fa-sun"; break;  // 明るい
						case "dim":    subicon = "fa-solid fa-moon"; break;  // 暗い
					} */

					switch (devState.openState) {
						case "open":  // 開いた
						case "timeOutNotClose": icon = "fa-door-open"; break;  // 開きっぱなし
						case "close": icon = "fa-door-closed"; break;  // 閉まった
					}
					if (d.enableCloudService) {  // クラウドモード
						cloudIcon = `<i class='fa-solid fa-cloud'></i>`
					} else {
						cloudIcon = `<span class='icon_layers'><i class='fa-solid fa-cloud icon_layers_icon'></i><span class='icon_layers_text'>&#10060;</span></span>`
					}

					if (devState.battery >= 85) {
						batteryIcon = `<span class='icon_layers'><i class='fa-solid fa-battery-full icon_layers_icon'></i><span class='icon_layers_counter'>${devState.battery}</span></span>`
					} else if (devState.battery >= 70) {
						batteryIcon = `<span class='icon_layers'><i class='fa-solid fa-battery-three-quarters icon_layers_icon'></i><span class='icon_layers_counter'>${devState.battery}</span></span>`
					} else if (devState.battery >= 40) {
						batteryIcon = `<span class='icon_layers'><i class='fa-solid fa-battery-half icon_layers_icon'></i><span class='icon_layers_counter'>${devState.battery}</span></span>`
					} else if (devState.battery >= 20) {
						batteryIcon = `<span class='icon_layers'><i class='fa-solid fa-battery-quater icon_layers_icon'></i><span class='icon_layers_counter'>${devState.battery}</span></span>`
					} else {
						batteryIcon = `<span class='icon_layers'><i class='fa-solid fa-battery-empty icon_layers_icon'></i><span class='icon_layers_counter'>${devState.battery}</span></span>`
					}

					doc += `<div class="tooltip"><i class="fa-solid ${icon} switchBot-dev"></i><div class="description">${d.deviceId}</div></div>${cloudIcon} ${batteryIcon}<br>${d.deviceName}<br>MoveDetected: ${devState.moveDetected}`;
					break;

				case 'Ceiling Light':
				case 'Ceiling Light Pro':
					doc += `<div class="tooltip"><i class="fa-regular fa-lightbulb switchBot-dev"></i><div class="description">${d.deviceId}</div></div><br>${d.deviceName}`;
					break;

				case 'Plug Mini (US)':
				case 'Plug Mini (JP)':
					if (devState.power == 'on') {
						control = `<button onClick="window.SwitchBotPlug('${d.deviceId}', 'turnOff', 'default');">OFF</button>`;
						icon = 'fa-plug-circle-bolt';
					} else {
						control = `<button onClick="window.SwitchBotPlug('${d.deviceId}', 'turnOff', 'default');">ON</button>`;
						icon = 'fa-plug';
					}

					if (d.enableCloudService) {  // クラウドモード
						cloudIcon = `<i class='fa-solid fa-cloud'></i>`
					} else {
						cloudIcon = `<span class='icon_layers'><i class='fa-solid fa-cloud icon_layers_icon'></i><span class='icon_layers_text'>&#10060;</span></span>`
					}

					doc += `<div class="tooltip"><i class="fa-solid ${icon} switchBot-dev"></i><div class="description">${d.deviceId}</div></div>${cloudIcon}<br>${d.deviceName}<br>`;
					doc += `${control}<br>`;
					doc += `${devState.voltage} [V]<br> ${devState.electricCurrent} [A]<br>${devState.weight} [W]<br>`;
					doc += `<i class="fa-regular fa-clock"></i> ${devState.electricityOfDay} min<br>`;
					break;

				case 'Plug':
					if (devState.power == 'on') {
						control = `<button onClick="window.SwitchBotPlug('${d.deviceId}', 'turnOff', 'default');">OFF</button>`;
						icon = 'fa-plug-circle-bolt';
					} else {
						control = `<button onClick="window.SwitchBotPlug('${d.deviceId}', 'turnOn', 'default');">OFF</button>`;
						icon = 'fa-plug';
					}

					if (d.enableCloudService) {  // クラウドモード
						cloudIcon = `<i class='fa-solid fa-cloud'></i>`
					} else {
						cloudIcon = `<span class='icon_layers'><i class='fa-solid fa-cloud icon_layers_icon'></i><span class='icon_layers_text'>&#10060;</span></span>`
					}

					doc += `<div class="tooltip"><i class="fa-solid ${icon} switchBot-dev"></i><div class="description">${d.deviceId}</div></div>${cloudIcon}<br>${d.deviceName}<br>${control}`;
					break;

				case 'Strip Light':
					doc += `<div class="tooltip"><i class="fa-brands fa-strip-s switchBot-dev"></i><div class="description">${d.deviceId}</div></div><br>${d.deviceName}`;
					break;

				case 'Color Bulb':
					switch (devState.power) {
						case 'on':
							control = `<button onClick='window.SwitchBotBulb("${d.deviceId}", "turnOff", "default");'>OFF</button><br>`;
							icon = 'fa-regular fa-lightbulb';
							break;
						case 'off':
							control = `<button onClick='window.SwitchBotBulb("${d.deviceId}", "turnOn", "default");'>ON</button><br>`;
							icon = 'fa-solid fa-lightbulb';
							break;
					}

					if (d.enableCloudService) {  // クラウドモード
						cloudIcon = `<i class='fa-solid fa-cloud'></i>`
					} else {
						cloudIcon = `<span class='icon_layers'><i class='fa-solid fa-cloud icon_layers_icon'></i><span class='icon_layers_text'>&#10060;</span></span>`
					}


					// 色を16進表記にかえる r:g:b -> $rrggbb
					temp = devState.color.split(/:/);
					color = `#${toHexString(temp[0])}${toHexString(temp[1])}${toHexString(temp[2])}`;

					// color時に、colorTemperatureが0になるみたいだけど、値域としておかしいので補正
					devState.colorTemperature = devState.colorTemperature == 0 ? 2700 : devState.colorTemperature;

					control += `<form class='inline'>Brightness: `  // brightness
						+ `<input type='number' id="inSwitchBotBulbBriNumber_${d.deviceId}" value='${devState.brightness}' min='0' max='100' step='5' onChange='window.inSwitchBotBulbBriNumber_Change("${d.deviceId}", this.value);'><br>`
						+ `<input type='range'  id="inSwitchBotBulbBriRange_${d.deviceId}"  value='${devState.brightness}' min='0' max='100' step='5' onChange='window.inSwitchBotBulbBriRange_Change("${d.deviceId}", this.value);'>`
						+ `</form>`
						+ `<button type='button' onclick='window.btnSwitchBotBulbUpdateBrightnessSettings("${d.deviceId}");'>送信</button>`
						+ `<br>`
						+ `<form class='inline'>Color: `  // color
						+ `<input type='color' id="inSwitchBotBulbColor_${d.deviceId}" value='${color}' />`
						+ `</form>`
						+ `<button type='button' onclick='window.btnSwitchBotBulbUpdateColorSettings("${d.deviceId}");'>送信</button>`
						+ `<br>`
						+ `<form class='inline'>Color temperature: `  // colorTemperature
						+ `<input type='number' id="inSwitchBotBulbTempNumber_${d.deviceId}" value='${devState.colorTemperature}' min='2700' max='6500' step='100' onChange='window.inSwitchBotBulbTempNumber_Change("${d.deviceId}", this.value);'><br>`
						+ `<input type='range'  id="inSwitchBotBulbTempNumber_${d.deviceId}" value='${devState.colorTemperature}' min='2700' max='6500' step='100' onChange='window.inSwitchBotBulbTempRange_Change("${d.deviceId}", this.value);'>`
						+ `</form>`
						+ `<button type='button' onclick='window.btnSwitchBotBulbUpdateColorTemperatureSettings("${d.deviceId}");'>送信</button>`;

					doc += `<div class="tooltip"><i class="${icon} switchBot-dev"></i><div class="description">${d.deviceId}</div></div>${cloudIcon}<br>${d.deviceName}<br>${control}`;
					break;

				case 'Robot Vacuum Cleaner S1':
				case 'Robot Vacuum Cleaner S1 Plus':
					doc += `<div class="tooltip"><i class="fa-solid fa-circle-notch switchBot-dev"></i><div class="description">${d.deviceId}</div></div><br>${d.deviceName}`;
					break;

				case 'Humidifier':  // 加湿器
					switch (devState.power) {
						case 'on': subicon = 'fa-plug-circle-bolt'; break;
						case 'off': subicon = 'fa-plug'; break;
					}

					if (d.enableCloudService) {  // クラウドモード
						cloudIcon = `<i class='fa-solid fa-cloud'></i>`
					} else {
						cloudIcon = `<span class='icon_layers'><i class='fa-solid fa-cloud icon_layers_icon'></i><span class='icon_layers_text'>&#10060;</span></span>`
					}

					doc += `<div class="tooltip"><i class="fa-solid fa-droplet switchBot-dev"></i><i class="fa-solid ${subicon} switchBot-dev"></i><div class="description">${d.deviceId}</div></div>${cloudIcon}<br>${d.deviceName}<br><i class="fa-solid fa-temperature-three-quarters"></i> ${devState.temperature} ℃<br><i class="fa-solid fa-droplet"></i> ${devState.humidity} ％<br>lackWater: ${devState.lackWater}`;
					break;

				case 'Indoor Cam':
					doc += `<div class="tooltip"><i class="fa-solid fa-video switchBot-dev"></i><div class="description">${d.deviceId}</div></div><br>${d.deviceName}`;
					break;

				case 'Pan/Tilt Cam':
				case 'Pan/Tilt Cam 2K':
					doc += `<div class="tooltip"><i class="fa-solid fa-video switchBot-dev"></i><div class="description">${d.deviceId}</div></div><br>${d.deviceName}`;
					break;

				default:
					// console.log('subSwitchBot, unknown device, d:', d );
					doc += `<div class="tooltip"><i class="fa-solid fa-circle-nodes switchBot-dev"></i><div class="description">${d.deviceId}</div></div><br>${d.deviceName}`;
					break;
			}

			doc += "</section> </div>";  // ボタン設置
		}

		divControlSwitchBot.innerHTML = doc;
	};

	/**
	 * @func
	 * @desc 10進数表記文字を16進数に変換
	 */
	function toHexString(v) {
		let ret = parseInt(v);
		ret = ret.toString(16);
		ret = '0' + ret;
		ret = ret.substr(-2);
		return ret;
	};

	/**
	 * @func
	 * @desc 16進数表記文字を10進数に変換
	 */
	function toDecString(v) {
		return parseInt(v, 16);;
	};


	//----------------------------------------------------------------------------------------------
	/**
	 * @func
	 * @desc SwitchBot config
	 */
	window.btnSwitchBotConfigSet_Click = function () {
		btnSwitchBotConfigSet.disabled = true;
		btnSwitchBotConfigSet.textContent = '設定中...';

		if (!inSwitchBotUse.checked || inSwitchBotToken.value == '' || inSwitchBotSecret.value == '') {
			window.ipc.SwitchBotStop(inSwitchBotToken.value, inSwitchBotSecret.value);  // SwitchBot の監視を stopする
			renewFacilitiesSwitchBot(facilitiesSwitchBot);
			return; // falseなら外すだけ
		}

		window.ipc.SwitchBotUse(inSwitchBotToken.value, inSwitchBotSecret.value);
	};

	/**
	 * @func
	 * @desc 設定完了通知で、設定ボタンの復活（連打防止）
	 */
	window.SwitchBotConfigSaved = function () {
		btnSwitchBotConfigSet.disabled = false;
		btnSwitchBotConfigSet.textContent = '設定';

		window.addToast('Info', 'SwitchBot 設定を保存しました。');
	};

	let spanSwitchBotTime = document.getElementById('spanSwitchBotTime');       // abst

	/**
	 * @func
	 * @desc mainプロセスから設定値をもらったので画面を更新
	 * @param {Object} arg
	 */
	window.renewSwitchBotConfigView = function (arg) {
		// console.log('window.renewSwitchBotConfigView arg:', arg);
		inSwitchBotUse.checked = arg.enabled;
		inSwitchBotToken.value = arg.token;
		inSwitchBotSecret.value = arg.secret;
		btnSwitchBotConfigSet.disabled = false;
		btnSwitchBotConfigSet.textContent = '設定';

		if (arg.enabled) {  // 利用する場合
			H2ControlSwitchBot.style.display = 'block';
			divControlSwitchBot.style.display = '-webkit-flex';
			canRoomEnvChartSwitchBot.style.display = 'block';
			divSwitchBotSuggest.style.display = 'none';
		} else {  // 利用しない場合
			H2ControlSwitchBot.style.display = 'none';
			divControlSwitchBot.style.display = 'none';
			canRoomEnvChartSwitchBot.style.display = 'none';
			divSwitchBotSuggest.style.display = 'block';
		}
	};

	//----------------------------------------------------------------------------------------------
	/**
	 * @func
	 * @desc SwitchBot control for Plug
	 * @param {string} id
	 * @param {string} command
	 * @param {string} param
	 */
	window.SwitchBotPlug = function (id, command, param) {
		console.log('window.SwitchBotPlug() id:', id, 'command:', command, 'param:', param);
		window.ipc.SwitchBotControl(id, command, param);
	};

	/**
	 * @func
	 * @desc SwitchBot control for Bot
	 * @param {string} id
	 * @param {string} command
	 * @param {string} param
	 */
	window.SwitchBotBot = function (id, command, param) {
		console.log('window.SwitchBotBot() id:', id, 'command:', command, 'param:', param);
		window.ipc.SwitchBotControl(id, command, param);
	};

	/**
	 * @func
	 * @desc SwitchBot control for Bulb
	 * @param {string} id
	 * @param {string} command
	 * @param {string} param
	 */
	window.SwitchBotBulb = function (id, command, param) {
		console.log('window.SwitchBotBulb() id:', id, 'command:', command, 'param:', param);
		window.ipc.SwitchBotControl(id, command, param);
	};

	// ----- Brightness
	/**
	 * @func
	 * @desc SwitchBot control for Bulb, Range change
	 * @param {string} id
	 * @param {string} param
	 */
	window.inSwitchBotBulbBriRange_Change = function (id, value) {
		// console.log(id, value)
		let obj = document.getElementById("inSwitchBotBulbBriNumber_" + id);
		obj.value = value;
	};

	/**
	 * @func
	 * @desc SwitchBot control for Bulb, Number change
	 * @param {string} id
	 * @param {string} param
	 */
	window.inSwitchBotBulbBriNumber_Change = function (id, value) {
		// console.log(id, value)
		let obj = document.getElementById("inSwitchBotBulbBriRange_" + id);
		obj.value = value;
	};

	/**
	 * @func
	 * @desc SwitchBot control for Bulb, Brigntness change
	 * @param {string} id
	 */
	window.btnSwitchBotBulbUpdateBrightnessSettings = function (id) {
		let obj = document.getElementById("inSwitchBotBulbBriNumber_" + id);
		window.ipc.SwitchBotControl(id, "setBrightness", obj.value);
	};


	// ----- Color
	/**
	 * @func
	 * @desc SwitchBot control for Bulb, Brigntness change
	 * @param {string} id
	 */
	window.btnSwitchBotBulbUpdateColorSettings = function (id) {
		let obj = document.getElementById("inSwitchBotBulbColor_" + id);
		let r = toDecString(obj.value.substr(1, 2));
		let g = toDecString(obj.value.substr(3, 2));
		let b = toDecString(obj.value.substr(5, 2));
		let col = `${r}:${g}:${b}`;
		window.ipc.SwitchBotControl(id, "setColor", col);
	};


	// ----- Color temp
	/**
	 * @func
	 * @desc SwitchBot control for Bulb, Range change
	 * @param {string} id
	 * @param {string} param
	 */
	window.inSwitchBotBulbTempRange_Change = function (id, value) {
		// console.log(id, value)
		let obj = document.getElementById("inSwitchBotBulbTempNumber_" + id);
		obj.value = value;
	};

	/**
	 * @func
	 * @desc SwitchBot control for Bulb, Number change
	 * @param {string} id
	 * @param {string} param
	 */
	window.inSwitchBotBulbTempNumber_Change = function (id, value) {
		// console.log(id, value)
		let obj = document.getElementById("inSwitchBotBulbTempRange_" + id);
		obj.value = value;
	};

	/**
	 * @func
	 * @desc SwitchBot control for Bulb, Brigntness change
	 * @param {string} id
	 */
	window.btnSwitchBotBulbUpdateColorTemperatureSettings = function (id) {
		let obj = document.getElementById("inSwitchBotBulbTempNumber_" + id);
		window.ipc.SwitchBotControl(id, "setColorTemperature", obj.value);
	};


	//----------------------------------------------------------------------------------------------
	// SwitchBot chart
	let spanSwitchBotEnvTime = document.getElementById('spanSwitchBotEnvTime');    // env
	let spanSwitchBotPowerTime = document.getElementById('spanSwitchBotPowerTime');  // power

	/**
	 * @func
	 * @desc newLegendClickHandler
	 * @memberof subSwitchBot
	 * @param {object} e
	 * @param {object} legendItem
	 */
	let newLegendClickHandler = function (e, legendItem) {
		let index = legendItem.datasetIndex;
		let ci = this.chart;
		let meta = ci.getDatasetMeta(index);

		meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;

		ci.update();	// データセットを非表示にしました。チャートを再表示してください。

		console.log('newLegendClickHandler() legendItem:', legendItem);

		switch (legendItem.text) {
			case "温度 [℃]":
				if (legendItem.hidden) {
					const switchBotDocTempSec = document.getElementById('switchBotDocTempSec');
					switchBotDocTempSec.classList.add("temp_color");
					switchBotDocTempSec.classList.remove("disabled_color");
				} else {
					const switchBotDocTempSec = document.getElementById('switchBotDocTempSec');
					switchBotDocTempSec.classList.remove("temp_color");
					switchBotDocTempSec.classList.add("disabled_color");
				}
				break;

			case "湿度 [%RH]":
				if (legendItem.hidden) {
					const switchBotDocHumSec = document.getElementById('switchBotDocHumSec');
					switchBotDocHumSec.classList.add("hum_color");
					switchBotDocHumSec.classList.remove("disabled_color");
				} else {
					const switchBotDocHumSec = document.getElementById('switchBotDocHumSec');
					switchBotDocHumSec.classList.remove("hum_color");
					switchBotDocHumSec.classList.add("disabled_color");
				}
				break;

			default:
				break;
		}
	};


	/**
	 * @func
	 * @desc newPowerLegendClickHandler
	 * @memberof subSwitchBot
	 * @param {object} e
	 * @param {object} legendItem
	 */
	let newPowerLegendClickHandler = function (e, legendItem) {
		let index = legendItem.datasetIndex;
		let ci = this.chart;
		let meta = ci.getDatasetMeta(index);

		meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;

		ci.update();	// データセットを非表示にしました。チャートを再表示してください。

		console.log('newPowerLegendClickHandler() legendItem:', legendItem);

		switch (legendItem.text) {
			case "ワット [W]":
				const switchBotDocWattSec = document.getElementById('switchBotDocWattSec');
				if (legendItem.hidden) {
					switchBotDocWattSec.classList.add("watt_color");
					switchBotDocWattSec.classList.remove("disabled_color");
				} else {
					switchBotDocWattSec.classList.remove("watt_color");
					switchBotDocWattSec.classList.add("disabled_color");
				}
				break;

			case "ボルト [V]":
				const switchBotDocVoltSec = document.getElementById('switchBotDocVoltSec');
				if (legendItem.hidden) {
					switchBotDocVoltSec.classList.add("vold_color");
					switchBotDocVoltSec.classList.remove("disabled_color");
				} else {
					switchBotDocVoltSec.classList.remove("volt_color");
					switchBotDocVoltSec.classList.add("disabled_color");
				}
				break;

			case "アンペア [A]":
				const switchBotDocAmpereSec = document.getElementById('switchBotDocAmpereSec');
				if (legendItem.hidden) {
					switchBotDocAmpereSec.classList.add("ampere_color");
					switchBotDocAmpereSec.classList.remove("disabled_color");
				} else {
					switchBotDocAmpereSec.classList.remove("ampere_color");
					switchBotDocAmpereSec.classList.add("disabled_color");
				}
				break;

			default:
				break;
		}
	};


	// HTML内部とリンク
	const ctxSwitchBot = canRoomEnvChartSwitchBot.getContext('2d');
	const ctxSwitchBotPower = canRoomPowerChartSwitchBot.getContext('2d');
	let myChartSwitchBot = null;
	let myPowerChartSwitchBot = null;

	// 複数軸用の、軸オプション
	let complexChartOption = {
		responsive: true,
		plugins: {
			legend: {
				display: true,
				position: 'top',
				onClick: newLegendClickHandler
			}
		},
		scales: {
			"y-axis-left": {
				type: "linear",   // linear固定
				position: "left", // どちら側に表示される軸か？
				suggestedMax: 50,
				min: 0,
				title: { display: true, text: 'Temperature[℃]' },
				grid: {
					color: 'rgba(255,0,0,0.1)',
					borderColor: 'rgba(255,0,0,1.0)'
				}
			},
			"y-axis-right": {
				type: "linear",
				position: "right",
				suggestedMax: 100,
				min: 0,
				title: { display: true, text: 'Humidity[%]' },
				grid: {
					borderColor: 'rgba(0,0,255,1.0)'
				}
			},
			"x": {
				type: 'time',
				time: {
					unit: 'minutes',
					parser: 'HH:mm',
					displayFormats: {
						minute: 'HH:mm',
						hour: 'HH:mm'
					}
				},
				min: '00:00',
				max: '24:00',
				ticks: {
					// autoSkip: false,
					maxTicksLimit: 24 * 2 + 1,   // 24h * 30min + 00:00
					maxRotation: 90,
					// stepSize: 120,
					beginAtZero: true,
					callback: function (value, index, ticks) {
						return moment.tz(value, 'Asia/Tokyo').format('HH:mm');
						// return ( index % 60 == 0 ? moment.tz(value, 'Asia/Tokyo').format('HH:mm') : '' );
					}
				},
				grid: {
					color: 'rgba(0,0,0,0.3)',
					borderColor: 'rgba(0,0,0,1.0)'
				}
			}
		}
	};

	// 複数軸用の、軸オプション (Power)
	let complexPowerChartOption = {
		responsive: true,
		plugins: {
			legend: {
				display: true,
				position: 'top',
				onClick: newPowerLegendClickHandler
			}
		},
		scales: {
			"y-axis-left-w": {  // watt
				type: "linear",   // linear固定
				position: "left", // どちら側に表示される軸か？
				suggestedMax: 3000,
				min: 0,
				title: { display: true, text: 'Watt [W]' },
				grid: {
					color: 'rgba(255,0,0,0.1)',
					borderColor: 'rgba(255,0,0,1.0)'
				}
			},
			"y-axis-left-a": {  // ampere
				type: "linear",   // linear固定
				position: "left", // どちら側に表示される軸か？
				suggestedMax: 30,
				min: 0,
				title: { display: true, text: 'Ampere [A]' },
				grid: {
					color: 'rgba(255,0,0,0.1)',
					borderColor: 'rgba(255,0,0,1.0)'
				}
			},
			"y-axis-right": {
				type: "linear",
				position: "right",
				suggestedMax: 110,
				min: 0,
				title: { display: true, text: 'Voltage [V]' },
				grid: {
					borderColor: 'rgba(0,0,255,1.0)'
				}
			},
			"x": {
				type: 'time',
				time: {
					unit: 'minutes',
					parser: 'HH:mm',
					displayFormats: {
						minute: 'HH:mm',
						hour: 'HH:mm'
					}
				},
				min: '00:00',
				max: '24:00',
				ticks: {
					// autoSkip: false,
					maxTicksLimit: 24 * 2 + 1,   // 24h * 30min + 00:00
					maxRotation: 90,
					// stepSize: 120,
					beginAtZero: true,
					callback: function (value, index, ticks) {
						return moment.tz(value, 'Asia/Tokyo').format('HH:mm');
						// return ( index % 60 == 0 ? moment.tz(value, 'Asia/Tokyo').format('HH:mm') : '' );
					}
				},
				grid: {
					color: 'rgba(0,0,0,0.3)',
					borderColor: 'rgba(0,0,0,1.0)'
				}
			}
		}
	};

	// 表示データ（動的）
	let datasetsSwitchBot = [];  //
	let datasetsSwitchBotPower = [];

	/**
	 * @func
	 * @desc renewCanvasSwitchBot
	 * @memberof subSwitchBot
	 */
	let renewCanvasSwitchBot = function () {
		H3SwitchBot.style.display = 'block';
		if (myChartSwitchBot) {
			// すでにチャートがあればアップデートだけ
			myChartSwitchBot.data.datasets = datasetsSwitchBot;
			myChartSwitchBot.update();
		} else {
			// 初回起動はチャートオブジェクトを作る
			myChartSwitchBot = new Chart(ctxSwitchBot, {
				type: 'line',
				data: {
					// labels: LABEL_X,
					datasets: datasetsSwitchBot
				},
				options: complexChartOption
			});
		}
	};


	/**
	 * @func
	 * @desc renewPowerCanvasSwitchBot
	 * @memberof subSwitchBot
	 */
	let renewPowerCanvasSwitchBot = function () {
		H3SwitchBotPower.style.display = 'block';
		if (myPowerChartSwitchBot) {
			// すでにチャートがあればアップデートだけ
			myPowerChartSwitchBot.data.datasets = datasetsSwitchBotPower;
			myPowerChartSwitchBot.update();
		} else {
			// 初回起動はチャートオブジェクトを作る
			myPowerChartSwitchBot = new Chart(ctxSwitchBotPower, {
				type: 'line',
				data: {
					// labels: LABEL_X,
					datasets: datasetsSwitchBotPower
				},
				options: complexPowerChartOption
			});
		}
	};


	const pointStyleList = ['circle', 'triangle', 'cross', 'rect', 'star', 'dash', 'rectRounded', 'crossRot', 'rectRot', 'line'];

	//////////////////////////////////////////////////////////////////
	/**
	 * @func
	 * @desc データをもらって画面更新
	 * @param {json} _envDataObj
	 */
	window.renewRoomEnvSwitchBot = function (_envDataObj) {
		let envDataObj = JSON.parse(_envDataObj);

		datasetsSwitchBot = [];  // データを一旦空に戻す env
		let pointStyle = 0; // ポイントスタイル 0..9

		for (const meter of envDataObj.meterList) {
			let envDataArray = envDataObj[meter];
			// console.log( 'window.renewRoomEnvSwitchBot() meter:', meter, ', envDataArray:', envDataArray );

			spanSwitchBotEnvTime.innerHTML = moment().format("YYYY/MM/DD HH:mm:ss取得");

			if (envDataArray) {
				let oTemperature = new Array();
				let oHumidity = new Array();

				for (const d of envDataArray) {
					oTemperature.push({ x: moment(d.time), y: d.temperature });
					oHumidity.push({ x: moment(d.time), y: d.humidity });
				}

				datasetsSwitchBot.push(
					{
						label: meter + '：温度 [℃]', type: 'line', data: oTemperature, borderColor: "rgba(255,70,70,1.0)", backgroundColor: "rgba(255,178,178,1.0)",
						radius: 4, borderWidth: 1, yAxisID: 'y-axis-left', xAxisID: 'x', pointStyle: pointStyleList[pointStyle]
					},
					{
						label: meter + '：湿度 [%RH]', type: 'line', data: oHumidity, borderColor: "rgba(70,70,255,1.0)", backgroundColor: "rgba(178,178,255,1.0)",
						radius: 4, borderWidth: 1, yAxisID: 'y-axis-right', xAxisID: 'x', pointStyle: pointStyleList[pointStyle]
					}
				);

				pointStyle = pointStyle == 9 ? 0 : pointStyle += 1;  // 9なら0に戻る、でなければ次のスタイルへ
			}
		}
		renewCanvasSwitchBot();

		datasetsSwitchBotPower = []// データを一旦空に戻す power
		pointStyle = 0; // ポイントスタイル 0..9

		for (const plug of envDataObj.plugMiniList) {
			let envDataArray = envDataObj[plug];
			// console.log( 'window.renewRoomEnvSwitchBot() plug:', plug, ', envDataArray:', envDataArray );

			spanSwitchBotPowerTime.innerHTML = moment().format("YYYY/MM/DD HH:mm:ss取得");

			if (envDataArray) {
				let oWatt = new Array();
				let oVoltage = new Array();
				let oAmpere = new Array();

				for (const d of envDataArray) {
					oWatt.push({ x: moment(d.time), y: d.watt });
					oVoltage.push({ x: moment(d.time), y: d.voltage });
					oAmpere.push({ x: moment(d.time), y: d.ampere });
				}

				datasetsSwitchBotPower.push(
					{
						label: plug + '：電力 [W]', type: 'line', data: oWatt, borderColor: "rgba(255,70,70,1.0)", backgroundColor: "rgba(255,178,178,1.0)",
						radius: 4, borderWidth: 1, yAxisID: 'y-axis-left-w', xAxisID: 'x', pointStyle: pointStyleList[pointStyle]
					},
					{
						label: plug + '：電圧 [V]', type: 'line', data: oVoltage, borderColor: "rgba(70,70,255,1.0)", backgroundColor: "rgba(178,178,255,1.0)",
						radius: 4, borderWidth: 1, yAxisID: 'y-axis-right', xAxisID: 'x', pointStyle: pointStyleList[pointStyle]
					},
					{
						label: plug + '：電流 [A]', type: 'line', data: oAmpere, borderColor: "rgba(70,70,255,1.0)", backgroundColor: "rgba(178,178,255,1.0)",
						radius: 4, borderWidth: 1, yAxisID: 'y-axis-left-a', xAxisID: 'x', pointStyle: pointStyleList[pointStyle]
					}
				);

				pointStyle = pointStyle == 9 ? 0 : pointStyle += 1;  // 9なら0に戻る、でなければ次のスタイルへ
			}
		}

		renewPowerCanvasSwitchBot();
	};

});
