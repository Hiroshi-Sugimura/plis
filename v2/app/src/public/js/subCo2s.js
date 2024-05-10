//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2023.08.26
//	co2s関係の処理
//////////////////////////////////////////////////////////////////////
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
/**
 * @namespace subCo2s
 */
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subCo2s.js');

	let facilitiesCo2s; // 宅内情報（Co2s）
	let H3Co2s = document.getElementById('H3Co2s');
	let divCo2sAbst = document.getElementById('divCo2sAbst');
	let divCo2sSuggest = document.getElementById('divCo2sSuggest');

	// config
	let inCo2sUse = document.getElementById('inCo2sUse'); // Co2s; use or not check box
	let inCo2sPlace = document.getElementById('inCo2sPlace'); // Co2s; place
	let btnCo2sConfigSet = document.getElementById('btnCo2sConfigSet'); // 設定ボタン

	// header
	let spanCo2sPlace = document.getElementById('spanCo2sPlace');
	let spanCo2sTime = document.getElementById('spanCo2sTime');

	// abst data
	let spanCo2sTemperature = document.getElementById('spanCo2sTemperature');
	let spanCo2sHumidity = document.getElementById('spanCo2sHumidity');
	let spanCo2sCo2 = document.getElementById('spanCo2sCo2');


	//----------------------------------------------------------------------------------------------
	/**
	 * @func
	 * @desc Co2s デバイス情報のrenew
	 * @param {void}
	 * @return {void}
	 */
	window.renewCo2s = function (arg) {
		facilitiesCo2s = arg;

		// console.log('renewCo2s() facilitiesCo2s:', facilitiesCo2s );  // ログ5s毎なので多すぎるから、必要な時だけ有効にして

		if (inCo2sUse.checked == false || Object.keys(facilitiesCo2s).length === 0) {
			return;
		}

		console.log(facilitiesCo2s);

		spanCo2sPlace.innerHTML = inCo2sPlace.value;
		spanCo2sTime.innerHTML = facilitiesCo2s.time;

		spanCo2sTemperature.innerHTML = facilitiesCo2s.temperature;
		spanCo2sHumidity.innerHTML = facilitiesCo2s.humidity;
		spanCo2sCo2.innerHTML = facilitiesCo2s.co2;
	};


	/**
	 * @func
	 * @desc Co2s USBと切断
	 * @param {void}
	 * @return {void}
	 */
	window.disconnectedCo2s = function () {
		H3Co2s.style.display = 'none';
		canRoomEnvChartCo2s.style.display = 'none';
		divCo2sSuggest.style.display = 'block';
		inCo2sUse.checked = false;
	};

	/**
	 * @func
	 * @desc 左のボタンからグラフ制御
	 * @param {void}
	 * @return {void}
	 */
	window.co2sDocSectionClicked = function (t) {
		// console.log('t:', t);

		console.log('data:', myChartCo2s._metasets);
		myChartCo2s._metasets.forEach((v) => {
			if (v.label != t) {
				v.hidden = true;
			} else {
				v.hidden = false;
			}
		});
		myChartCo2s.update();
	};


	//----------------------------------------------------------------------------------------------
	// Co2s config

	/**
	 * @func
	 * @desc 設定ボタン
	 * @param {void}
	 * @return {void}
	 */
	window.btnCo2sConfigSet_Click = function (checkBox) {
		if (inCo2sUse.checked == false) {
			renewCo2s();
			window.ipc.Co2sStop(inCo2sPlace.value);  // OWMの監視をstopする
			return; // falseなら外すだけ
		}

		window.ipc.Co2sUse(inCo2sPlace.value);

	};

	/**
	 * @func
	 * @desc 設定完了通知
	 * @param {void}
	 * @return {void}
	 */
	window.Co2sConfigSaved = function () {
		btnCo2sConfigSet.disabled = false;
		btnCo2sConfigSet.textContent = '設定';

		window.addToast('Info', 'Co2s 設定を保存しました。');
	};

	/**
	 * @func
	 * @desc mainプロセスから設定値をもらったので画面を更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewCo2sConfigView = function (arg) {
		inCo2sUse.checked = arg.enabled;
		inCo2sPlace.value = arg.place;

		if (inCo2sUse.checked) { // 利用するので表示する
			H3Co2s.style.display = 'block';
			divCo2sAbst.style.display = 'block';
			canRoomEnvChartCo2s.style.display = 'block';
			divCo2sSuggest.style.display = 'none';
		} else {
			H3Co2s.style.display = 'none';
			divCo2sAbst.style.display = 'none';
			canRoomEnvChartCo2s.style.display = 'none';
			divCo2sSuggest.style.display = 'block';
		}
	};


	//----------------------------------------------------------------------------------------------
	// Co2s chart

	// 内部変数
	let oTemperature = [];
	let oHumidity = [];
	let oCO2 = [];

	/*
	const LABEL_X = [
		'00:00', '00:15', '00:30', '00:45', '01:00', '01:15', '01:30', '01:45', '02:00', '02:15', '02:30', '02:45',
		'03:00', '03:15', '03:30', '03:45', '04:00', '04:15', '04:30', '04:45', '05:00', '05:15', '05:30', '05:45',
		'06:00', '06:15', '06:30', '06:45', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45',
		'09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45',
		'12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45',
		'15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45',
		'18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45',
		'21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '22:45', '23:00', '23:15', '23:30', '23:45', '24:00']; */

	/**
	 * @func
	 * @desc newLegendClickHandler
	 * @memberof subCo2s
	 * @param {void}
	 * @return {void}
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
					const Co2sDocTempSec = document.getElementById('Co2sDocTempSec');
					Co2sDocTempSec.classList.add("temp_color");
					Co2sDocTempSec.classList.remove("disabled_color");
				} else {
					const Co2sDocTempSec = document.getElementById('Co2sDocTempSec');
					Co2sDocTempSec.classList.remove("temp_color");
					Co2sDocTempSec.classList.add("disabled_color");
				}
				break;

			case "湿度 [%RH]":
				if (legendItem.hidden) {
					const Co2sDocHumSec = document.getElementById('Co2sDocHumSec');
					Co2sDocHumSec.classList.add("hum_color");
					Co2sDocHumSec.classList.remove("disabled_color");
				} else {
					const Co2sDocHumSec = document.getElementById('Co2sDocHumSec');
					Co2sDocHumSec.classList.remove("hum_color");
					Co2sDocHumSec.classList.add("disabled_color");
				}
				break;

			// eCO2は数値が頼れないので表示しない
			case "eCO2 [ppm]":
				if (legendItem.hidden) {
					const Co2sDocCo2Sec = document.getElementById('Co2sDocCo2Sec');
					Co2sDocCo2Sec.classList.add("co2_color");
					Co2sDocCo2Sec.classList.remove("disabled_color");
				} else {
					const Co2sDocCo2Sec = document.getElementById('Co2sDocCo2Sec');
					Co2sDocCo2Sec.classList.remove("co2_color");
					Co2sDocCo2Sec.classList.add("disabled_color");
				}
				break;

			default:
				break;
		}
	};


	// HTML内部とリンク
	const canRoomEnvChartCo2s = document.getElementById('canRoomEnvChartCo2s');  // 部屋環境グラフ
	const ctxCo2s = canRoomEnvChartCo2s.getContext('2d');
	let myChartCo2s = null;

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
				// suggestedMax: 110,
				min: 0,
				title: { display: true, text: 'Temperature[℃], Humidity[%RH]' }
			},
			"y-axis-right": {
				type: "linear",
				position: "right",
				// suggestedMax: 1100,
				min: 0,
				title: { display: true, text: 'CO2[ppm]' }  // CO2表示しない
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
					autoSkip: false,
					maxTicksLimit: 49,   // 24h * 2 + 1
					maxRotation: 90,
					callback: function (value, index, ticks) {
						return moment.tz(value, 'Asia/Tokyo').format('HH:mm');
					}
				}
			}
		}
	};

	// 表示データ（動的）
	let datasetsCo2s = [];

	/**
	 * @func
	 * @desc renewCanvasCo2s
	 * @memberof subCo2s
	 * @param {void}
	 * @return {void}
	 */
	let renewCanvasCo2s = function () {
		canRoomEnvChartCo2s.style.display = 'block';

		if (myChartCo2s) {
			// すでにチャートがあればアップデートだけ
			myChartCo2s.data.datasets = datasetsCo2s;
			myChartCo2s.update();
		} else {
			// 初回起動はチャートオブジェクトを作る
			myChartCo2s = new Chart(ctxCo2s, {
				type: 'line',
				data: {
					// labels: LABEL_X,
					datasets: datasetsCo2s
				},
				options: complexChartOption
			});
		}
	};


	//////////////////////////////////////////////////////////////////
	/**
	 * @func
	 * @desc データをもらって画面更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewRoomEnvCo2s = function (_envDataArray) {
		let envDataArray = JSON.parse(_envDataArray);
		// console.log( 'window.renewRoomEnvOnron()', envDataArray );

		datasetsCo2s = [];

		if (envDataArray) {
			oTemperature = [];
			oHumidity = [];
			oCO2 = [];

			for (const d of envDataArray) {
				oTemperature.push({ x: moment(d.time), y: d.temperature });
				oHumidity.push({ x: moment(d.time), y: d.humidity });
				oCO2.push({ x: moment(d.time), y: d.CO2 });
			}

			datasetsCo2s.push(
				{
					label: '温度 [℃]', type: 'line', data: oTemperature, borderColor: "rgba(255,178,178,1.0)", backgroundColor: "rgba(255,178,178,1.0)",
					radius: 1.5, borderWidth: 1, yAxisID: 'y-axis-left', xAxisID: 'x', borderDash: [2, 1]
				},
				{
					label: '湿度 [%]', type: 'line', data: oHumidity, borderColor: "rgba(255,178,255,1.0)", backgroundColor: "rgba(255,178,255,1.0)",
					radius: 1.5, borderWidth: 1, yAxisID: 'y-axis-left', xAxisID: 'x', borderDash: [2, 1]
				},
				{
					label: 'CO2 [ppm]', type: 'line', data: oCO2, borderColor: "rgba(50,100,0,1.0)", backgroundColor: "rgba(50,100,0,1.0)",
					radius: 1.5, borderWidth: 1, yAxisID: 'y-axis-right', xAxisID: 'x', borderDash: [2, 1]
				}
			);
		}

		renewCanvasCo2s();
	};

});
