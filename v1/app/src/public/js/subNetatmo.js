//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.30
//	netatmo関係の処理
//////////////////////////////////////////////////////////////////////
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subNetatmo.js');

	let facilitiesNetatmo; // 宅内情報（netatmo）

	let H3Netatmo = document.getElementById('H3Netatmo');
	let divNetatmoAbst = document.getElementById('divNetatmoAbst');  // netatmoのセンサデータAbst
	let divNetatmoSuggest = document.getElementById('divNetatmoSuggest');

	// config
	let inNetatmoUse        = document.getElementById('inNetatmoUse');  // checkbox
	let inNetatmoID         = document.getElementById('inNetatmoID');  // netatmo
	let inNetatmoSecret     = document.getElementById('inNetatmoSecret');
	let inNetatmoUsername   = document.getElementById('inNetatmoUsername');
	let inNetatmoPassword   = document.getElementById('inNetatmoPassword');
	let btnNetatmoConfigSet = document.getElementById('btnNetatmoConfigSet');

	// abst
	let spanNetatmoHomename		= document.getElementById('spanNetatmoHomename');
	let spanNetatmoTime			= document.getElementById('spanNetatmoTime');
	let spanNetatmoTemperature	= document.getElementById('spanNetatmoTemperature');
	let spanNetatmoHumidity		= document.getElementById('spanNetatmoHumidity');
	let spanNetatmoPressure		= document.getElementById('spanNetatmoPressure');
	let spanNetatmoCO2			= document.getElementById('spanNetatmoCO2');
	let spanNetatmoNoise		= document.getElementById('spanNetatmoNoise');

	// graph
	let divNetatmoChart			= document.getElementById('divNetatmoChart');
	const canRoomEnvChartNetatmo = document.getElementById('canRoomEnvChartNetatmo');  // 部屋環境グラフ
	const ctxNetatmo = canRoomEnvChartNetatmo.getContext('2d');


	//----------------------------------------------------------------------------------------------
	// Netatmo デバイス情報のrenew
	window.renewNetatmo = function( arg ) {
		facilitiesNetatmo = arg;

		// console.log('renewNetatmo()', facilitiesNetatmo);
		if( inNetatmoUse.checked == false || !facilitiesNetatmo || Object.keys(facilitiesNetatmo).length === 0 ) {
			return;
		}

		let netatmo_time = new Date();
		netatmo_time.setTime( parseInt(facilitiesNetatmo[0].dashboard_data.time_utc)*1000 );  // 秒をミリ秒へ

		spanNetatmoHomename.innerHTML		= facilitiesNetatmo[0].home_name;
		spanNetatmoTime.innerHTML			= netatmo_time.toLocaleString();
		spanNetatmoTemperature.innerHTML	= facilitiesNetatmo[0].dashboard_data.Temperature;
		spanNetatmoHumidity.innerHTML		= facilitiesNetatmo[0].dashboard_data.Humidity;
		spanNetatmoPressure.innerHTML		= facilitiesNetatmo[0].dashboard_data.Pressure;
		spanNetatmoCO2.innerHTML			= facilitiesNetatmo[0].dashboard_data.CO2;
		spanNetatmoNoise.innerHTML			= facilitiesNetatmo[0].dashboard_data.Noise;
	}

	// 左のボタンからグラフ制御
	window.netatmoDocSectionClicked = function (t) {
		console.log('t:', t);

		console.log('data:', myChartNetatmo._metasets);
		myChartNetatmo._metasets.forEach( (v) => {
			if( v.label != t ) {
				v.hidden = true;
			}else{
				v.hidden = false;
			}
		});
		myChartNetatmo.update();
	};

	//----------------------------------------------------------------------------------------------
	// Netatmo config

	// 設定ボタン
	window.btnNetatmoConfigSet_Click = function(checkBox) {
		if( inNetatmoUse.checked == false ) {
			window.ipc.NetatmoStop( inNetatmoID.value, inNetatmoSecret.value, inNetatmoUsername.value, inNetatmoPassword.value );  // OWMの監視をstopする
			renewNetatmo();
			return; // falseなら外すだけ
		}

		if( inNetatmoID.value == '' || inNetatmoSecret.value == '' || inNetatmoUsername.value == '' || inNetatmoPassword.value == '' ) { // 情報不足で有効にしたら解説ダイアログ
			inNetatmoUse.checked = false;
			netatmoHelpDialog.showModal();
		}else{  // キー指定ありで有効にしたら，そのキーで開始
			window.ipc.NetatmoUse( inNetatmoID.value, inNetatmoSecret.value, inNetatmoUsername.value, inNetatmoPassword.value );
		}
	};

	// 設定完了通知
	window.NetatmoConfigSaved = function () {
		btnNetatmoConfigSet.disabled    = false;
		btnNetatmoConfigSet.textContent = '設定';

		window.addToast( 'Info', 'Netatmo 設定を保存しました。');
	};

	// mainプロセスから設定値をもらったので画面を更新
	window.renewNetatmoConfigView = function( arg ) {
		inNetatmoUse.checked = arg.enabled;
		inNetatmoID.value = arg.id;
		inNetatmoSecret.value = arg.secret;
		inNetatmoUsername.value = arg.username;
		inNetatmoPassword.value = arg.password;

		if( inNetatmoUse.checked ) {  // Netatmo有効なので画面表示
			H3Netatmo.style.display         = 'block';
			divNetatmoAbst.style.display    = 'block';
			divNetatmoChart.style.display   = 'block';
			canRoomEnvChartNetatmo.style.display = 'block';
			divNetatmoSuggest.style.display = 'none';
		}else {
			H3Netatmo.style.display         = 'none';
			divNetatmoAbst.style.display    = 'none';
			divNetatmoChart.style.display   = 'none';
			canRoomEnvChartNetatmo.style.display = 'none';
			divNetatmoSuggest.style.display = 'block';
		}
	};

	//----------------------------------------------------------------------------------------------
	// Netatmo chart

	// 内部変数
	let nTemperature = [];
	let nHumidity = [];
	let nPressure = [];
	let nCO2 = [];
	let nNoise = [];

	const LABEL_X = [
		'00:00', '00:15', '00:30', '00:45', '01:00', '01:15', '01:30', '01:45', '02:00', '02:15', '02:30', '02:45',
		'03:00', '03:15', '03:30', '03:45', '04:00', '04:15', '04:30', '04:45', '05:00', '05:15', '05:30', '05:45',
		'06:00', '06:15', '06:30', '06:45', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45',
		'09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45',
		'12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45',
		'15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45',
		'18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45',
		'21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '22:45', '23:00', '23:15', '23:30', '23:45', '24:00'];

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
				const netatmoDocTempSec = document.getElementById('netatmoDocTempSec');
				netatmoDocTempSec.classList.add("temp_color");
				netatmoDocTempSec.classList.remove("disabled_color");
			}else{
				const netatmoDocTempSec = document.getElementById('netatmoDocTempSec');
				netatmoDocTempSec.classList.remove("temp_color");
				netatmoDocTempSec.classList.add("disabled_color");
			}
			break;

			case "湿度 [%]":
			if( legendItem.hidden ) {
				const netatmoDocTempSec = document.getElementById('netatmoDocHumSec');
				netatmoDocTempSec.classList.add("hum_color");
				netatmoDocTempSec.classList.remove("disabled_color");
			}else{
				const netatmoDocTempSec = document.getElementById('netatmoDocHumSec');
				netatmoDocTempSec.classList.remove("hum_color");
				netatmoDocTempSec.classList.add("disabled_color");
			}
			break;

			case "気圧 [mb]":
			if( legendItem.hidden ) {
				const netatmoDocTempSec = document.getElementById('netatmoDocPressSec');
				netatmoDocTempSec.classList.add("pressure_color");
				netatmoDocTempSec.classList.remove("disabled_color");
			}else{
				const netatmoDocTempSec = document.getElementById('netatmoDocPressSec');
				netatmoDocTempSec.classList.remove("pressure_color");
				netatmoDocTempSec.classList.add("disabled_color");
			}
			break;

			case "騒音 [dB]":
			if( legendItem.hidden ) {
				const netatmoDocTempSec = document.getElementById('netatmoDocNoiseSec');
				netatmoDocTempSec.classList.add("noise_color");
				netatmoDocTempSec.classList.remove("disabled_color");
			}else{
				const netatmoDocTempSec = document.getElementById('netatmoDocNoiseSec');
				netatmoDocTempSec.classList.remove("noise_color");
				netatmoDocTempSec.classList.add("disabled_color");
			}
			break;

			case "CO2 [ppm]":
			if( legendItem.hidden ) {
				const netatmoDocTempSec = document.getElementById('netatmoDocCo2Sec');
				netatmoDocTempSec.classList.add("co2_color");
				netatmoDocTempSec.classList.remove("disabled_color");
			}else{
				const netatmoDocTempSec = document.getElementById('netatmoDocCo2Sec');
				netatmoDocTempSec.classList.remove("co2_color");
				netatmoDocTempSec.classList.add("disabled_color");
			}
			break;

			default:
			break;
		}
	};


	let myChartNetatmo = null;

	// 表示データ（動的）
	let datasetsNetatmo = [];

	// 複数軸用の、軸オプション
	let complexChartOption = {
		responsive: true,
		plugins: {
			legend: {
				display: true,
				// position: 'right'
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
				title: { display: true, text: 'Temperature[℃], Humidity[%], Noise[dB]' }
			},
			"y-axis-right": {
				type: "linear",
				position: "right",
				// suggestedMax: 1100,
				min: 0,
				title: { display: true, text: 'Air-pressure[mb], CO2[ppm]' }
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


	// 内部関数
	let renewCanvasNetatmo = function() {
		if( myChartNetatmo ) { myChartNetatmo.destroy(); }  // chartがすでにctxを使っていると、リエントラントで"Canvas is already in use."のエラーが出る

		myChartNetatmo = new Chart( ctxNetatmo, {
			type: 'bar',
			data: {
				// labels: LABEL_X,
				datasets: datasetsNetatmo
			},
			options: complexChartOption
		});
	};

	// データをもらって画面更新
	window.renewRoomEnvNetatmo = function ( _envDataArray ) {
		let envDataArray = JSON.parse( _envDataArray );
		// console.log( 'window.renewRoomEnvNetatmo()', _envDataArray );
		datasetsNetatmo = [];

		if( envDataArray ) {
			nTemperature = [];
			nHumidity = [];
			nPressure = [];
			nCO2 = [];
			nNoise = [];

			for( const d of envDataArray ) {
				nTemperature.push( { x:moment(d.time), y:d.temperature} );
				nHumidity.push( { x:moment(d.time), y:d.humidity} );
				nPressure.push( { x:moment(d.time), y:d.pressure} );
				nCO2.push( { x:moment(d.time), y:d.CO2} );
				nNoise.push( { x:moment(d.time), y:d.noise} );
			}

			datasetsNetatmo.push(
				{ label: '温度 [℃]', type: 'line', data: nTemperature, borderColor: "rgba(255,178,178,1.0)", backgroundColor: "rgba(255,178,178,1.0)",
					radius:'1', borderWidth:2, xAxisID: 'x', yAxisID: 'y-axis-left' },
				{ label: '湿度 [%]',  type: 'line', data: nHumidity, borderColor: "rgba(255,178,255,1.0)", backgroundColor: "rgba(255,178,255,1.0)",
					radius:'1', borderWidth:2, xAxisID:'x',yAxisID: 'y-axis-left'},
				{ label: '気圧 [mb]', type: 'line', data: nPressure, borderColor: "rgba(178,178,255,1.0)", backgroundColor: "rgba(178,178,255,1.0)",
					radius:'1', borderWidth:2,xAxisID:'x', yAxisID: 'y-axis-right'},
				{ label: 'CO2 [ppm]', type: 'line', data: nCO2, borderColor: "rgba(50,100,0,1.0)", backgroundColor: "rgba(50,100,0,1.0)",
					radius:'1', borderWidth:2, xAxisID:'x',yAxisID: 'y-axis-right'},
				{ label: '騒音 [dB]', type: 'line', data: nNoise, borderColor: "rgba(70,70,220,1.0)", backgroundColor: "rgba(70,70,220,1.0)",
					radius:'1', borderWidth:2,xAxisID:'x', yAxisID: 'y-axis-left' }
				);
		}

		renewCanvasNetatmo();
	};



} );
