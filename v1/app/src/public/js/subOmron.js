//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.30
//	omron関係の処理
//////////////////////////////////////////////////////////////////////
/**
 * @module subOmron
 */
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subOmron.js');

	let facilitiesOmron; // 宅内情報（omron）
	let H3Omron = document.getElementById('H3Omron');
	let divOmronAbst	= document.getElementById('divOmronAbst');
	let divOmronSuggest = document.getElementById('divOmronSuggest');

	// config
	let inOmronUse        = document.getElementById('inOmronUse'); // omron; use or not check box
	let inOmronPlace      = document.getElementById('inOmronPlace'); // omron; place
	let btnOmronConfigSet = document.getElementById('btnOmronConfigSet'); // 設定ボタン

	// header
	let spanOmronPlace  = document.getElementById('spanOmronPlace');
	let spanOmronTime   = document.getElementById('spanOmronTime');

	// abst data
	let spanOmronTemperature     = document.getElementById('spanOmronTemperature');
	let spanOmronHumidity        = document.getElementById('spanOmronHumidity');
	let spanOmronPressure        = document.getElementById('spanOmronPressure');
	let spanOmronNoise           = document.getElementById('spanOmronNoise');
	let spanOmronAnbientLight    = document.getElementById('spanOmronAnbientLight');
	let spanOmronDiscomfortIndex = document.getElementById('spanOmronDiscomfortIndex');
	let spanOmronHeatStroke      = document.getElementById('spanOmronHeatStroke');
	let spanOmronHeat_stroke_desc = document.getElementById('spanOmronHeat_stroke_desc');

	//----------------------------------------------------------------------------------------------
	/** 
	 * @func renewOmron
	 * @desc Omron デバイス情報のrenew
	 * @param {void}
	 * @return {void}
	 */
	window.renewOmron = function( arg ) {
		facilitiesOmron = arg;

		// console.log('renewOmron() facilitiesOmron:', facilitiesOmron );  // ログ5s毎なので多すぎるから、必要な時だけ有効にして

		if( inOmronUse.checked == false || Object.keys(facilitiesOmron).length === 0 ) {
			return;
		}

		// 熱中症警戒度の意味
		let heat_stroke_color = '';
		let heat_stroke_desc = '';
		if (facilitiesOmron.heat_stroke < 25) {
			heat_stroke_color = 'has-background-success-light';
			heat_stroke_desc = '注意';
		} else if (facilitiesOmron.heat_stroke < 28) {
			heat_stroke_color = 'has-background-warning-light';
			heat_stroke_desc = '警戒';
		} else if (facilitiesOmron.heat_stroke < 31) {
			heat_stroke_color = 'has-background-warning';
			heat_stroke_desc = '厳重警戒';
		} else {
			heat_stroke_color = 'has-background-danger';
			heat_stroke_desc = '危険';
		}

		spanOmronPlace.innerHTML = inOmronPlace.value;
		spanOmronTime.innerHTML  = facilitiesOmron.time;

		spanOmronTemperature.innerHTML     = facilitiesOmron.temperature;
		spanOmronHumidity.innerHTML        = facilitiesOmron.humidity;
		spanOmronPressure.innerHTML        = facilitiesOmron.pressure;
		spanOmronNoise.innerHTML           = facilitiesOmron.noise;
		spanOmronAnbientLight.innerHTML    = facilitiesOmron.anbient_light;
		spanOmronDiscomfortIndex.innerHTML = facilitiesOmron.discomfort_index;
		spanOmronHeatStroke.innerHTML      = facilitiesOmron.heat_stroke;
		spanOmronHeat_stroke_desc.innerHTML = heat_stroke_desc;
	};


	/** 
	 * @func disconnectedOmron
	 * @desc Omron USBと切断
	 * @param {void}
	 * @return {void}
	 */
	window.disconnectedOmron = function () {
		H3Omron.style.display = 'none';
		canRoomEnvChartOmron.style.display = 'none';
		divOmronSuggest.style.display = 'block';
		inOmronUse.checked = false;
	};

	/** 
	 * @func omronDocSectionClicked
	 * @desc 左のボタンからグラフ制御
	 * @param {void}
	 * @return {void}
	 */
	window.omronDocSectionClicked = function (t) {
		// console.log('t:', t);

		console.log('data:', myChartOmron._metasets);
		myChartOmron._metasets.forEach( (v) => {
			if( v.label != t ) {
				v.hidden = true;
			}else{
				v.hidden = false;
			}
		});
		myChartOmron.update();
	};


	//----------------------------------------------------------------------------------------------
	// Omron config

	/** 
	 * @func btnOmronConfigSet_Click
	 * @desc 設定ボタン
	 * @param {void}
	 * @return {void}
	 */
	window.btnOmronConfigSet_Click = function(checkBox) {
		if( inOmronUse.checked == false ) {
			renewOmron();
			window.ipc.OmronStop( inOmronPlace.value );  // OWMの監視をstopする
			return; // falseなら外すだけ
		}

		window.ipc.OmronUse( inOmronPlace.value );

	};

	/** 
	 * @func OmronConfigSaved
	 * @desc 設定完了通知
	 * @param {void}
	 * @return {void}
	 */
	window.OmronConfigSaved = function () {
		btnOmronConfigSet.disabled    = false;
		btnOmronConfigSet.textContent = '設定';

		window.addToast( 'Info', 'Omron 設定を保存しました。');
	};

	/** 
	 * @func renewOmronConfigView
	 * @desc mainプロセスから設定値をもらったので画面を更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewOmronConfigView = function( arg ) {
		inOmronUse.checked = arg.enabled;
		inOmronPlace.value = arg.place;

		if( inOmronUse.checked ) { // 利用するので表示する
			H3Omron.style.display = 'block';
			divOmronAbst.style.display = 'block';
			canRoomEnvChartOmron.style.display = 'block';
			divOmronSuggest.style.display = 'none';
		}else{
			H3Omron.style.display = 'none';
			divOmronAbst.style.display = 'none';
			canRoomEnvChartOmron.style.display = 'none';
			divOmronSuggest.style.display = 'block';
		}
	};


	//----------------------------------------------------------------------------------------------
	// Omron chart

	// 内部変数
	let oTemperature = [];
	let oHumidity = [];
	let oPressure = [];
	let oAnbientLight = [];
	let oNoise = [];
	// let oCO2 = [];  // 表示しない
	// let oTVOC = []; //表示しない
	let oDiscomfortIndex = [];
	let oHeatStroke = [];

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
	 * @func newLegendClickHandler
	 * @desc newLegendClickHandler
	 * @param {void}
	 * @return {void}
	 */
	let newLegendClickHandler = function(e, legendItem) {
		let index = legendItem.datasetIndex;
		let ci = this.chart;
		let meta = ci.getDatasetMeta(index);

		meta.hidden = meta.hidden === null? !ci.data.datasets[index].hidden : null;

		ci.update();	// データセットを非表示にしました。チャートを再表示してください。

		console.log( 'newLegendClickHandler() legendItem:', legendItem );

		switch( legendItem.text ) {
			case "温度 [℃]":
			if( legendItem.hidden ) {
				const omronDocTempSec = document.getElementById('omronDocTempSec');
				omronDocTempSec.classList.add("temp_color");
				omronDocTempSec.classList.remove("disabled_color");
			}else{
				const omronDocTempSec = document.getElementById('omronDocTempSec');
				omronDocTempSec.classList.remove("temp_color");
				omronDocTempSec.classList.add("disabled_color");
			}
			break;

			case "湿度 [%RH]":
			if( legendItem.hidden ) {
				const omronDocHumSec = document.getElementById('omronDocHumSec');
				omronDocHumSec.classList.add("hum_color");
				omronDocHumSec.classList.remove("disabled_color");
			}else{
				const omronDocHumSec = document.getElementById('omronDocHumSec');
				omronDocHumSec.classList.remove("hum_color");
				omronDocHumSec.classList.add("disabled_color");
			}
			break;

			case "気圧 [hPa]":
			if( legendItem.hidden ) {
				const omronDocPressSec = document.getElementById('omronDocPressSec');
				omronDocPressSec.classList.add("pressure_color");
				omronDocPressSec.classList.remove("disabled_color");
			}else{
				const omronDocPressSec = document.getElementById('omronDocPressSec');
				omronDocPressSec.classList.remove("pressure_color");
				omronDocPressSec.classList.add("disabled_color");
			}
			break;

			case "光 [lx]":
			if( legendItem.hidden ) {
				const omronDocAnbientSec = document.getElementById('omronDocAnbientSec');
				omronDocAnbientSec.classList.add("anbientLight_color");
				omronDocAnbientSec.classList.remove("disabled_color");
			}else{
				const omronDocAnbientSec = document.getElementById('omronDocAnbientSec');
				omronDocAnbientSec.classList.remove("anbientLight_color");
				omronDocAnbientSec.classList.add("disabled_color");
			}
			break;

			case "騒音 [dB]":
			if( legendItem.hidden ) {
				const omronDocNoiseSec = document.getElementById('omronDocNoiseSec');
				omronDocNoiseSec.classList.add("noise_color");
				omronDocNoiseSec.classList.remove("disabled_color");
			}else{
				const omronDocNoiseSec = document.getElementById('omronDocNoiseSec');
				omronDocNoiseSec.classList.remove("noise_color");
				omronDocNoiseSec.classList.add("disabled_color");
			}
			break;

			// eCO2は数値が頼れないので表示しない
			case "eCO2 [ppm]":
			/*
			if( legendItem.hidden ) {
				const omronDocCo2Sec = document.getElementById('omronDocCo2Sec');
				omronDocCo2Sec.classList.add("co2_color");
				omronDocCo2Sec.classList.remove("disabled_color");
			}else{
				const omronDocCo2Sec = document.getElementById('omronDocCo2Sec');
				omronDocCo2Sec.classList.remove("co2_color");
				omronDocCo2Sec.classList.add("disabled_color");
			}
			*/
			break;

			// eTVOCはあまり参考にならない
			case "eTVOC [ppb]":
			/*
			if( legendItem.hidden ) {
				const omronDocTvocSec = document.getElementById('omronDocTvocSec');
				omronDocTvocSec.classList.add("tvoc_color");
				omronDocTvocSec.classList.remove("disabled_color");
			}else{
				const omronDocTvocSec = document.getElementById('omronDocTvocSec');
				omronDocTvocSec.classList.remove("tvoc_color");
				omronDocTvocSec.classList.add("disabled_color");
			}
			*/
			break;

			case "不快指数":
			if( legendItem.hidden ) {
				const omronDocDiscomfortSec = document.getElementById('omronDocDiscomfortSec');
				omronDocDiscomfortSec.classList.add("discomfort_color");
				omronDocDiscomfortSec.classList.remove("disabled_color");
			}else{
				const omronDocDiscomfortSec = document.getElementById('omronDocDiscomfortSec');
				omronDocDiscomfortSec.classList.remove("discomfort_color");
				omronDocDiscomfortSec.classList.add("disabled_color");
			}
			break;

			case "熱中症警戒度":
			if( legendItem.hidden ) {
				const omronDocHeatStrokeSec = document.getElementById('omronDocHeatStrokeSec');
				omronDocHeatStrokeSec.classList.add("heatStroke_color");
				omronDocHeatStrokeSec.classList.remove("disabled_color");
			}else{
				const omronDocHeatStrokeSec = document.getElementById('omronDocHeatStrokeSec');
				omronDocHeatStrokeSec.classList.remove("heatStroke_color");
				omronDocHeatStrokeSec.classList.add("disabled_color");
			}
			break;

			default:
			break;
		}
	};


	// HTML内部とリンク
	const canRoomEnvChartOmron = document.getElementById('canRoomEnvChartOmron');  // 部屋環境グラフ
	const ctxOmron = canRoomEnvChartOmron.getContext('2d');
	let myChartOmron = null;

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
				title: { display: true, text: 'Temperature[℃], Humidity[%RH], Noize[dB], DiscomfortIndex, HeatStroke' }
			},
			"y-axis-right": {
				type: "linear",
				position: "right",
				// suggestedMax: 1100,
				min: 0,
				title: { display: true, text: 'Air-pressure[hPa], Anbient Light[lx], eTOC[ppb]' }
				// title: { display: true, text: 'Air-pressure[hPa], Anbient Light[lx], CO2[ppm], eTOC[ppb]' }  // CO2表示しない
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
					callback: function( value, index, ticks ) {
						return moment.tz(value, 'Asia/Tokyo').format('HH:mm');
					}
				}
			}
		}
	};

	// 表示データ（動的）
	let datasetsOmron = [];

	/** 
	 * @func renewCanvasOmron
	 * @desc renewCanvasOmron
	 * @param {void}
	 * @return {void}
	 */
	let renewCanvasOmron = function() {
		canRoomEnvChartOmron.style.display = 'block';

		if( myChartOmron ) {
			// すでにチャートがあればアップデートだけ
			myChartOmron.data.datasets = datasetsOmron;
			myChartOmron.update();
		}else{
			// 初回起動はチャートオブジェクトを作る
			myChartOmron = new Chart( ctxOmron, {
				type: 'line',
				data: {
					// labels: LABEL_X,
					datasets: datasetsOmron
				},
				options: complexChartOption
			});
		}
	};


	//////////////////////////////////////////////////////////////////
	/** 
	 * @func renewRoomEnvOmron
	 * @desc データをもらって画面更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewRoomEnvOmron = function ( _envDataArray ) {
		let envDataArray = JSON.parse( _envDataArray );
		// console.log( 'window.renewRoomEnvOnron()', envDataArray );

		datasetsOmron = [];

		if( envDataArray ) {
			oTemperature = [];
			oHumidity = [];
			oPressure = [];
			oAnbientLight = [];
			oNoise = [];
			// oCO2 = [];  // 表示しない
			// oTVOC = [];
			oDiscomfortIndex = [];
			oHeatStroke = [];

			for( const d of envDataArray ) {
				oTemperature.push( { x:moment(d.time), y:d.temperature} );
				oHumidity.push( { x:moment(d.time), y:d.humidity} );
				oPressure.push( { x:moment(d.time), y:d.pressure} );
				oAnbientLight.push( { x:moment(d.time), y:d.anbientLight} );
				oNoise.push( { x:moment(d.time), y:d.noise} );
				// oCO2.push( { x:moment(d.time), y:d.CO2} );  // 表示しない
				// oTVOC.push( { x:moment(d.time), y:d.TVOC} ); // 表示しない
				oDiscomfortIndex.push( { x:moment(d.time), y:d.discomfortIndex} );
				oHeatStroke.push( { x:moment(d.time), y:d.heatStroke} );
			}

			datasetsOmron.push(
				{ label: '温度 [℃]',    type: 'line', data: oTemperature, borderColor: "rgba(255,178,178,1.0)", backgroundColor: "rgba(255,178,178,1.0)",
					radius:1.5, borderWidth:1, yAxisID: 'y-axis-left', xAxisID:'x', borderDash: [2,1] },
				{ label: '湿度 [%RH]',   type: 'line', data: oHumidity, borderColor: "rgba(255,178,255,1.0)", backgroundColor: "rgba(255,178,255,1.0)",
					radius:1.5, borderWidth:1, yAxisID: 'y-axis-left',  xAxisID:'x', borderDash: [2,1]},
				{ label: '気圧 [hPa]',   type: 'line', data: oPressure, borderColor: "rgba(178,178,255,1.0)", backgroundColor: "rgba(178,178,255,1.0)",
					radius:1.5, borderWidth:1, yAxisID: 'y-axis-right', xAxisID:'x', borderDash: [2,1]},
				{ label: '光 [lx]',      type: 'line', data: oAnbientLight, borderColor: "rgba(255,196,137,1.0)", backgroundColor: "rgba(178,178,255,1.0)",
					radius:1.5, borderWidth:1, yAxisID: 'y-axis-right', xAxisID:'x', borderDash: [2,1]},
				{ label: '騒音 [dB]',    type: 'line', data: oNoise, borderColor: "rgba(70,70,220,1.0)", backgroundColor: "rgba(70,70,220,1.0)",
					radius:1.5, borderWidth:1, yAxisID: 'y-axis-left', xAxisID:'x', borderDash: [2,1] },
				// eCO2は数値が頼れないので表示しない
				// { label: 'eCO2 [ppm]',   type: 'line', data: oCO2, borderColor: "rgba(50,100,0,1.0)", backgroundColor: "rgba(50,100,0,1.0)",
				// radius:1.5, borderWidth:1, yAxisID: 'y-axis-right', xAxisID:'x', borderDash: [2,1]},
				// { label: 'eTVOC [ppb]',  type: 'line', data: oTVOC, borderColor: "rgba(178,255,255,1.0)", backgroundColor: "rgba(255,137,196,1.0)",
				// radius:1.5, borderWidth:1, yAxisID: 'y-axis-right', xAxisID:'x', borderDash: [2,1]},
				{ label: '不快指数',     type: 'line', data: oDiscomfortIndex, borderColor: "rgba(196,137,255,1.0)", backgroundColor: "rgba(150,81,77,1.0)",
					radius:1.5, borderWidth:1, yAxisID: 'y-axis-left', xAxisID:'x', borderDash: [2,1]},
				{ label: '熱中症警戒度', type: 'line', data: oHeatStroke, borderColor: "rgba(137,196,255,1.0)", backgroundColor: "rgba(44,79,84,1.0)",
					radius:1.5, borderWidth:1, yAxisID: 'y-axis-left', xAxisID:'x', borderDash: [2,1] }
				);
		}

		renewCanvasOmron();
	};

} );
