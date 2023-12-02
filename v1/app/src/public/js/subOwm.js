//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.30
//	OpenWeatherMap 関係の処理
//////////////////////////////////////////////////////////////////////
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
/**
 * @namespace subOwm
 */
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subOwm.js');

	let weather;       // 天気情報（OpenWeatherMap）

	let divWeather = document.getElementById('divWeather'); // open weather mapのセンサデータ
	let divWeatherSuggest = document.getElementById('divWeatherSuggest');
	let divWeatherConfigInfo = document.getElementById('divWeatherConfigInfo');  // open weather map

	// config
	let inOwmUse = document.getElementById('inOwmUse');  // use
	let inOwmAPIKey = document.getElementById('inOwmAPIKey');  // open weather map
	let inOwmZipCode = document.getElementById('inOwmZipCode');
	let selOwmDebugMode = document.getElementById('selOwmDebugMode');  // debug flag

	let btnOwmConfigSet = document.getElementById('btnOwmConfigSet');  // 設定ボタン

	let dlgOwmHelp = document.getElementById('dlgOwmHelp');  // 設定方法の説明ダイアログ


	//----------------------------------------------------------------------------------------------
	/** 
	 * @func 
	 * @desc OpenWeatherMap デバイス情報のrenew
	 * @param {object} arg - config
	 * @return {void}
	 */
	window.renewOwm = function (arg) {
		window.OwmDebugLog('window.renewOwm() arg:', arg);
		weather = arg;
		if (inOwmUse.checked == false || inOwmAPIKey.value == '' || weather == {}) {
			return;
		}

		try {
			let weatherDoc = "<h3><i class='fa-solid fa-cloud-sun'></i> 気象データ by Open Weather Map： " + weather.name + ", " + weather.sys.country
				+ ' <span class="f_right"><a href="#" onClick="document.getElementById(\'configTab\').checked=true; location.hash=\'OpenWeatherMapConfig\'; document.getElementById(\'OWMConfigDetails\').open=true;"><i class="fa-solid fa-gear right"></i></a></span></h3>'
				+ " <div class='LinearLayoutParent'>";

			weatherDoc += "<div class='LinearLayoutChild'> <section>"
				+ "<img src='http://openweathermap.org/img/wn/" + weather.weather[0].icon + "@2x.png' class='weather-icon'><br class='omitable'>"
				+ "天気: " + weather.weather[0].main + "<br></section> </div>";
			weatherDoc += "<div class='LinearLayoutChild'> <section>"
				+ "<i class='fas fa-temperature-high mr-2 env-icon'></i><br class='omitable'>"
				+ "気温: " + weather.main.temp + "℃<br class='omitable'> (最高:" + weather.main.temp_max + ", 最低:" + weather.main.temp_min + ")" + "</section> </div>";
			weatherDoc += "<div class='LinearLayoutChild'> <section>"
				+ "<i class='fa-solid fa-tent-arrow-down-to-line env-icon'></i><br class='omitable'>"
				+ "気圧: " + weather.main.pressure + " hPa<br>" + "</section> </div>";
			weatherDoc += "<div class='LinearLayoutChild'> <section>"
				+ "<i class='fas fa-tint mr-2 env-icon'></i><br class='omitable'>"
				+ "湿度: " + weather.main.humidity + " %<br>" + "</section> </div>";
			weatherDoc += "<div class='LinearLayoutChild'> <section>"
				+ "<i class='fa-solid fa-wind env-icon'></i><br class='omitable'>"
				+ "風: " + weather.wind.speed + " m/s<br>" + "</section> </div>";
			weatherDoc += "<div class='LinearLayoutChild'> <section>"
				+ "<i class='fa-solid fa-location-arrow env-icon'></i><br class='omitable'>"
				+ "風向: " + weather.wind.deg + "° <br class='omitable'>(0:北、CW)<br>" + "</section> </div>";
			weatherDoc += "<div class='LinearLayoutChild'> <section>"
				+ "<i class='fa-brands fa-soundcloud env-icon'></i><br class='omitable'>"
				+ "雲量: " + weather.clouds.all + "%</section> </div>";
			weatherDoc += "</div>"; // LinearLayoutParent

			divWeather.innerHTML = weatherDoc;
			divWeatherConfigInfo.innerHTML = '';
		} catch (e) {
			// window.OwmDebugLog('renewOwm()');
			window.addToast('Error', 'OpenWeatherMap連携エラー<br>' + weather.message);
			console.error(weather);
			console.dir(e);
			divWeather.innerHTML = '<p> <strong class="error">Error: 設定を認識しましたが通信に失敗しました。もう一度APIを設定しなおしてください。通信結果: ' + weather.message + '</strong> </p>';
			divWeatherConfigInfo.innerHTML = '<p> <strong class="error">Error: 設定を認識しましたが通信に失敗しました。もう一度APIを設定しなおしてください。</strong> </p>';
		}
	};


	//----------------------------------------------------------------------------------------------
	/** 
	 * @func 
	 * @desc 設定ボタン
	 * @param {void}
	 * @return {void}
	 */
	window.btnOwmConfigSet_Click = function () {
		btnOwmConfigSet.disabled = true;
		btnOwmConfigSet.textContent = '保存中…';

		if (!inOwmUse.checked) {
			window.ipc.OwmStop(inOwmAPIKey.value,
				inOwmZipCode.value,
				selOwmDebugMode.value == 'true' ? true : false);  // OWMの監視をstopする
			renewOwm();
			return; // falseなら外すだけ
		}

		// true にした時のチェック
		if (inOwmAPIKey.value == '' || inOwmZipCode.value == '') { // 情報不足で有効にしたら解説ダイアログ
			inOwmUse.checked = false;
			dlgOwmHelp.showModal();
		} else {  // 全情報ありなので利用開始
			window.ipc.OwmUse(inOwmAPIKey.value,
				inOwmZipCode.value,
				selOwmDebugMode.value == 'true' ? true : false);
		}
	};

	/** 
	 * @func 
	 * @desc 設定完了
	 * @param {void}
	 * @return {void}
	 */
	window.OwmConfigSaved = function () {
		btnOwmConfigSet.disabled = false;
		btnOwmConfigSet.textContent = '設定';

		window.addToast('Info', 'OWM 設定を保存しました。');
	};

	/** 
	 * @func 
	 * @desc mainプロセスから設定値をもらったので画面を更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewOwmConfigView = function (arg) {
		btnOwmConfigSet.disabled = false;
		btnOwmConfigSet.textContent = '設定';
		inOwmUse.checked = arg.enabled;
		inOwmAPIKey.value = arg.APIKey;
		inOwmZipCode.value = arg.zipcode;
		selOwmDebugMode.value = arg.debug;

		if (inOwmUse.checked) {
			divWeather.style.display = 'block';
			divWeatherSuggest.style.display = 'none';
		} else {
			divWeather.style.display = 'none';
			divWeatherSuggest.style.display = 'block';
		}
	};


	/** 
	 * @func window.OwmDebugLog
	 * @desc Owmモジュールがデバッグなら出力する
	 * @param {...} values
	 */
	window.OwmDebugLog = function (param0, ...values) {
		selOwmDebugMode.value == 'true' ? console.log(param0, ...values) : 0;
	};


	//----------------------------------------------------------------------------------------------
	// OWM chart

});
