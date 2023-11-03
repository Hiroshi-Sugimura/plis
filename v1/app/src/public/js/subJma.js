//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.30
//	気象庁（JMA, Japan Meteorological Agency）関係の処理
//////////////////////////////////////////////////////////////////////
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
/**
 * @namespace subJma
 */
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subJma.js');

	let weatherAbst;       // 天気情報（JMA、概要）
	let abstTargetArea = '東京';
	let abstPublishingOffice = '気象庁';
	let abstReportDatetime = '';

	let weatherDetail;       // 天気情報（JMA、詳細）
	let detailPublishingOffice = '気象庁';
	let detailReportDatetime = '';

	let divJma = document.getElementById('divJma'); // 気象庁の表示エリア
	let btnJmaConfigSet = document.getElementById('btnJmaConfigSet');  // 設定ボタン
	let inJmaArea = document.getElementById('inJmaArea');
	let divJmaCode = document.getElementById('divJmaCode');

	let areaCodes = {
		"群馬県": "100000",
		"埼玉県": "110000",
		"千葉県": "120000",
		"東京都": "130000",
		"神奈川県": "140000",
		"新潟県": "150000",
		"富山県": "160000",
		"石川県": "170000",
		"福井県": "180000",
		"山梨県": "190000",
		"長野県": "200000",
		"岐阜県": "210000",
		"静岡県": "220000",
		"愛知県": "230000",
		"三重県": "240000",
		"滋賀県": "250000",
		"京都府": "260000",
		"大阪府": "270000",
		"兵庫県": "280000",
		"奈良県": "290000",
		"和歌山県": "300000",
		"鳥取県": "310000",
		"島根県": "320000",
		"岡山県": "330000",
		"広島県": "340000",
		"山口県": "350000",
		"徳島県": "360000",
		"香川県": "370000",
		"愛媛県": "380000",
		"高知県": "390000",
		"福岡県": "400000",
		"佐賀県": "410000",
		"長崎県": "420000",
		"熊本県": "430000",
		"大分県": "440000",
		"宮崎県": "450000",
		"奄美地方": "460040",
		"鹿児島県（奄美地方除く）": "460100",
		"沖縄本島地方": "471000",
		"大東島地方": "472000",
		"宮古島地方": "473000",
		"八重山地方": "474000",
		"青森県": "20000",
		"岩手県": "30000",
		"宮城県": "40000",
		"秋田県": "50000",
		"山形県": "60000",
		"福島県": "70000",
		"茨城県": "80000",
		"栃木県": "90000"
	};

	// JMAのweatherCodeとアイコンの対応表, 2022-09-12 取得
	// https://www.jma.go.jp/bosai/forecast/ にて Forecast.Const.TELOPS を実行すると取得できる。
	let TELOPS = {
		"100": [
			"100.svg",
			"500.svg",
			"100",
			"晴",
			"CLEAR"
		],
		"101": [
			"101.svg",
			"501.svg",
			"100",
			"晴時々曇",
			"PARTLY CLOUDY"
		],
		"102": [
			"102.svg",
			"502.svg",
			"300",
			"晴一時雨",
			"CLEAR, OCCASIONAL SCATTERED SHOWERS"
		],
		"103": [
			"102.svg",
			"502.svg",
			"300",
			"晴時々雨",
			"CLEAR, FREQUENT SCATTERED SHOWERS"
		],
		"104": [
			"104.svg",
			"504.svg",
			"400",
			"晴一時雪",
			"CLEAR, SNOW FLURRIES"
		],
		"105": [
			"104.svg",
			"504.svg",
			"400",
			"晴時々雪",
			"CLEAR, FREQUENT SNOW FLURRIES"
		],
		"106": [
			"102.svg",
			"502.svg",
			"300",
			"晴一時雨か雪",
			"CLEAR, OCCASIONAL SCATTERED SHOWERS OR SNOW FLURRIES"
		],
		"107": [
			"102.svg",
			"502.svg",
			"300",
			"晴時々雨か雪",
			"CLEAR, FREQUENT SCATTERED SHOWERS OR SNOW FLURRIES"
		],
		"108": [
			"102.svg",
			"502.svg",
			"300",
			"晴一時雨か雷雨",
			"CLEAR, OCCASIONAL SCATTERED SHOWERS AND/OR THUNDER"
		],
		"110": [
			"110.svg",
			"510.svg",
			"100",
			"晴後時々曇",
			"CLEAR, PARTLY CLOUDY LATER"
		],
		"111": [
			"110.svg",
			"510.svg",
			"100",
			"晴後曇",
			"CLEAR, CLOUDY LATER"
		],
		"112": [
			"112.svg",
			"512.svg",
			"300",
			"晴後一時雨",
			"CLEAR, OCCASIONAL SCATTERED SHOWERS LATER"
		],
		"113": [
			"112.svg",
			"512.svg",
			"300",
			"晴後時々雨",
			"CLEAR, FREQUENT SCATTERED SHOWERS LATER"
		],
		"114": [
			"112.svg",
			"512.svg",
			"300",
			"晴後雨",
			"CLEAR,RAIN LATER"
		],
		"115": [
			"115.svg",
			"515.svg",
			"400",
			"晴後一時雪",
			"CLEAR, OCCASIONAL SNOW FLURRIES LATER"
		],
		"116": [
			"115.svg",
			"515.svg",
			"400",
			"晴後時々雪",
			"CLEAR, FREQUENT SNOW FLURRIES LATER"
		],
		"117": [
			"115.svg",
			"515.svg",
			"400",
			"晴後雪",
			"CLEAR,SNOW LATER"
		],
		"118": [
			"112.svg",
			"512.svg",
			"300",
			"晴後雨か雪",
			"CLEAR, RAIN OR SNOW LATER"
		],
		"119": [
			"112.svg",
			"512.svg",
			"300",
			"晴後雨か雷雨",
			"CLEAR, RAIN AND/OR THUNDER LATER"
		],
		"120": [
			"102.svg",
			"502.svg",
			"300",
			"晴朝夕一時雨",
			"OCCASIONAL SCATTERED SHOWERS IN THE MORNING AND EVENING, CLEAR DURING THE DAY"
		],
		"121": [
			"102.svg",
			"502.svg",
			"300",
			"晴朝の内一時雨",
			"OCCASIONAL SCATTERED SHOWERS IN THE MORNING, CLEAR DURING THE DAY"
		],
		"122": [
			"112.svg",
			"512.svg",
			"300",
			"晴夕方一時雨",
			"CLEAR, OCCASIONAL SCATTERED SHOWERS IN THE EVENING"
		],
		"123": [
			"100.svg",
			"500.svg",
			"100",
			"晴山沿い雷雨",
			"CLEAR IN THE PLAINS, RAIN AND THUNDER NEAR MOUTAINOUS AREAS"
		],
		"124": [
			"100.svg",
			"500.svg",
			"100",
			"晴山沿い雪",
			"CLEAR IN THE PLAINS, SNOW NEAR MOUTAINOUS AREAS"
		],
		"125": [
			"112.svg",
			"512.svg",
			"300",
			"晴午後は雷雨",
			"CLEAR, RAIN AND THUNDER IN THE AFTERNOON"
		],
		"126": [
			"112.svg",
			"512.svg",
			"300",
			"晴昼頃から雨",
			"CLEAR, RAIN IN THE AFTERNOON"
		],
		"127": [
			"112.svg",
			"512.svg",
			"300",
			"晴夕方から雨",
			"CLEAR, RAIN IN THE EVENING"
		],
		"128": [
			"112.svg",
			"512.svg",
			"300",
			"晴夜は雨",
			"CLEAR, RAIN IN THE NIGHT"
		],
		"130": [
			"100.svg",
			"500.svg",
			"100",
			"朝の内霧後晴",
			"FOG IN THE MORNING, CLEAR LATER"
		],
		"131": [
			"100.svg",
			"500.svg",
			"100",
			"晴明け方霧",
			"FOG AROUND DAWN, CLEAR LATER"
		],
		"132": [
			"101.svg",
			"501.svg",
			"100",
			"晴朝夕曇",
			"CLOUDY IN THE MORNING AND EVENING, CLEAR DURING THE DAY"
		],
		"140": [
			"102.svg",
			"502.svg",
			"300",
			"晴時々雨で雷を伴う",
			"CLEAR, FREQUENT SCATTERED SHOWERS AND THUNDER"
		],
		"160": [
			"104.svg",
			"504.svg",
			"400",
			"晴一時雪か雨",
			"CLEAR, SNOW FLURRIES OR OCCASIONAL SCATTERED SHOWERS"
		],
		"170": [
			"104.svg",
			"504.svg",
			"400",
			"晴時々雪か雨",
			"CLEAR, FREQUENT SNOW FLURRIES OR SCATTERED SHOWERS"
		],
		"181": [
			"115.svg",
			"515.svg",
			"400",
			"晴後雪か雨",
			"CLEAR, SNOW OR RAIN LATER"
		],
		"200": [
			"200.svg",
			"200.svg",
			"200",
			"曇",
			"CLOUDY"
		],
		"201": [
			"201.svg",
			"601.svg",
			"200",
			"曇時々晴",
			"MOSTLY CLOUDY"
		],
		"202": [
			"202.svg",
			"202.svg",
			"300",
			"曇一時雨",
			"CLOUDY, OCCASIONAL SCATTERED SHOWERS"
		],
		"203": [
			"202.svg",
			"202.svg",
			"300",
			"曇時々雨",
			"CLOUDY, FREQUENT SCATTERED SHOWERS"
		],
		"204": [
			"204.svg",
			"204.svg",
			"400",
			"曇一時雪",
			"CLOUDY, OCCASIONAL SNOW FLURRIES"
		],
		"205": [
			"204.svg",
			"204.svg",
			"400",
			"曇時々雪",
			"CLOUDY FREQUENT SNOW FLURRIES"
		],
		"206": [
			"202.svg",
			"202.svg",
			"300",
			"曇一時雨か雪",
			"CLOUDY, OCCASIONAL SCATTERED SHOWERS OR SNOW FLURRIES"
		],
		"207": [
			"202.svg",
			"202.svg",
			"300",
			"曇時々雨か雪",
			"CLOUDY, FREQUENT SCCATERED SHOWERS OR SNOW FLURRIES"
		],
		"208": [
			"202.svg",
			"202.svg",
			"300",
			"曇一時雨か雷雨",
			"CLOUDY, OCCASIONAL SCATTERED SHOWERS AND/OR THUNDER"
		],
		"209": [
			"200.svg",
			"200.svg",
			"200",
			"霧",
			"FOG"
		],
		"210": [
			"210.svg",
			"610.svg",
			"200",
			"曇後時々晴",
			"CLOUDY, PARTLY CLOUDY LATER"
		],
		"211": [
			"210.svg",
			"610.svg",
			"200",
			"曇後晴",
			"CLOUDY, CLEAR LATER"
		],
		"212": [
			"212.svg",
			"212.svg",
			"300",
			"曇後一時雨",
			"CLOUDY, OCCASIONAL SCATTERED SHOWERS LATER"
		],
		"213": [
			"212.svg",
			"212.svg",
			"300",
			"曇後時々雨",
			"CLOUDY, FREQUENT SCATTERED SHOWERS LATER"
		],
		"214": [
			"212.svg",
			"212.svg",
			"300",
			"曇後雨",
			"CLOUDY, RAIN LATER"
		],
		"215": [
			"215.svg",
			"215.svg",
			"400",
			"曇後一時雪",
			"CLOUDY, SNOW FLURRIES LATER"
		],
		"216": [
			"215.svg",
			"215.svg",
			"400",
			"曇後時々雪",
			"CLOUDY, FREQUENT SNOW FLURRIES LATER"
		],
		"217": [
			"215.svg",
			"215.svg",
			"400",
			"曇後雪",
			"CLOUDY, SNOW LATER"
		],
		"218": [
			"212.svg",
			"212.svg",
			"300",
			"曇後雨か雪",
			"CLOUDY, RAIN OR SNOW LATER"
		],
		"219": [
			"212.svg",
			"212.svg",
			"300",
			"曇後雨か雷雨",
			"CLOUDY, RAIN AND/OR THUNDER LATER"
		],
		"220": [
			"202.svg",
			"202.svg",
			"300",
			"曇朝夕一時雨",
			"OCCASIONAL SCCATERED SHOWERS IN THE MORNING AND EVENING, CLOUDY DURING THE DAY"
		],
		"221": [
			"202.svg",
			"202.svg",
			"300",
			"曇朝の内一時雨",
			"CLOUDY OCCASIONAL SCCATERED SHOWERS IN THE MORNING"
		],
		"222": [
			"212.svg",
			"212.svg",
			"300",
			"曇夕方一時雨",
			"CLOUDY, OCCASIONAL SCCATERED SHOWERS IN THE EVENING"
		],
		"223": [
			"201.svg",
			"601.svg",
			"200",
			"曇日中時々晴",
			"CLOUDY IN THE MORNING AND EVENING, PARTLY CLOUDY DURING THE DAY,"
		],
		"224": [
			"212.svg",
			"212.svg",
			"300",
			"曇昼頃から雨",
			"CLOUDY, RAIN IN THE AFTERNOON"
		],
		"225": [
			"212.svg",
			"212.svg",
			"300",
			"曇夕方から雨",
			"CLOUDY, RAIN IN THE EVENING"
		],
		"226": [
			"212.svg",
			"212.svg",
			"300",
			"曇夜は雨",
			"CLOUDY, RAIN IN THE NIGHT"
		],
		"228": [
			"215.svg",
			"215.svg",
			"400",
			"曇昼頃から雪",
			"CLOUDY, SNOW IN THE AFTERNOON"
		],
		"229": [
			"215.svg",
			"215.svg",
			"400",
			"曇夕方から雪",
			"CLOUDY, SNOW IN THE EVENING"
		],
		"230": [
			"215.svg",
			"215.svg",
			"400",
			"曇夜は雪",
			"CLOUDY, SNOW IN THE NIGHT"
		],
		"231": [
			"200.svg",
			"200.svg",
			"200",
			"曇海上海岸は霧か霧雨",
			"CLOUDY, FOG OR DRIZZLING ON THE SEA AND NEAR SEASHORE"
		],
		"240": [
			"202.svg",
			"202.svg",
			"300",
			"曇時々雨で雷を伴う",
			"CLOUDY, FREQUENT SCCATERED SHOWERS AND THUNDER"
		],
		"250": [
			"204.svg",
			"204.svg",
			"400",
			"曇時々雪で雷を伴う",
			"CLOUDY, FREQUENT SNOW AND THUNDER"
		],
		"260": [
			"204.svg",
			"204.svg",
			"400",
			"曇一時雪か雨",
			"CLOUDY, SNOW FLURRIES OR OCCASIONAL SCATTERED SHOWERS"
		],
		"270": [
			"204.svg",
			"204.svg",
			"400",
			"曇時々雪か雨",
			"CLOUDY, FREQUENT SNOW FLURRIES OR SCATTERED SHOWERS"
		],
		"281": [
			"215.svg",
			"215.svg",
			"400",
			"曇後雪か雨",
			"CLOUDY, SNOW OR RAIN LATER"
		],
		"300": [
			"300.svg",
			"300.svg",
			"300",
			"雨",
			"RAIN"
		],
		"301": [
			"301.svg",
			"701.svg",
			"300",
			"雨時々晴",
			"RAIN, PARTLY CLOUDY"
		],
		"302": [
			"302.svg",
			"302.svg",
			"300",
			"雨時々止む",
			"SHOWERS THROUGHOUT THE DAY"
		],
		"303": [
			"303.svg",
			"303.svg",
			"400",
			"雨時々雪",
			"RAIN,FREQUENT SNOW FLURRIES"
		],
		"304": [
			"300.svg",
			"300.svg",
			"300",
			"雨か雪",
			"RAINORSNOW"
		],
		"306": [
			"300.svg",
			"300.svg",
			"300",
			"大雨",
			"HEAVYRAIN"
		],
		"308": [
			"308.svg",
			"308.svg",
			"300",
			"雨で暴風を伴う",
			"RAINSTORM"
		],
		"309": [
			"303.svg",
			"303.svg",
			"400",
			"雨一時雪",
			"RAIN,OCCASIONAL SNOW"
		],
		"311": [
			"311.svg",
			"711.svg",
			"300",
			"雨後晴",
			"RAIN,CLEAR LATER"
		],
		"313": [
			"313.svg",
			"313.svg",
			"300",
			"雨後曇",
			"RAIN,CLOUDY LATER"
		],
		"314": [
			"314.svg",
			"314.svg",
			"400",
			"雨後時々雪",
			"RAIN, FREQUENT SNOW FLURRIES LATER"
		],
		"315": [
			"314.svg",
			"314.svg",
			"400",
			"雨後雪",
			"RAIN,SNOW LATER"
		],
		"316": [
			"311.svg",
			"711.svg",
			"300",
			"雨か雪後晴",
			"RAIN OR SNOW, CLEAR LATER"
		],
		"317": [
			"313.svg",
			"313.svg",
			"300",
			"雨か雪後曇",
			"RAIN OR SNOW, CLOUDY LATER"
		],
		"320": [
			"311.svg",
			"711.svg",
			"300",
			"朝の内雨後晴",
			"RAIN IN THE MORNING, CLEAR LATER"
		],
		"321": [
			"313.svg",
			"313.svg",
			"300",
			"朝の内雨後曇",
			"RAIN IN THE MORNING, CLOUDY LATER"
		],
		"322": [
			"303.svg",
			"303.svg",
			"400",
			"雨朝晩一時雪",
			"OCCASIONAL SNOW IN THE MORNING AND EVENING, RAIN DURING THE DAY"
		],
		"323": [
			"311.svg",
			"711.svg",
			"300",
			"雨昼頃から晴",
			"RAIN, CLEAR IN THE AFTERNOON"
		],
		"324": [
			"311.svg",
			"711.svg",
			"300",
			"雨夕方から晴",
			"RAIN, CLEAR IN THE EVENING"
		],
		"325": [
			"311.svg",
			"711.svg",
			"300",
			"雨夜は晴",
			"RAIN, CLEAR IN THE NIGHT"
		],
		"326": [
			"314.svg",
			"314.svg",
			"400",
			"雨夕方から雪",
			"RAIN, SNOW IN THE EVENING"
		],
		"327": [
			"314.svg",
			"314.svg",
			"400",
			"雨夜は雪",
			"RAIN,SNOW IN THE NIGHT"
		],
		"328": [
			"300.svg",
			"300.svg",
			"300",
			"雨一時強く降る",
			"RAIN, EXPECT OCCASIONAL HEAVY RAINFALL"
		],
		"329": [
			"300.svg",
			"300.svg",
			"300",
			"雨一時みぞれ",
			"RAIN, OCCASIONAL SLEET"
		],
		"340": [
			"400.svg",
			"400.svg",
			"400",
			"雪か雨",
			"SNOWORRAIN"
		],
		"350": [
			"300.svg",
			"300.svg",
			"300",
			"雨で雷を伴う",
			"RAIN AND THUNDER"
		],
		"361": [
			"411.svg",
			"811.svg",
			"400",
			"雪か雨後晴",
			"SNOW OR RAIN, CLEAR LATER"
		],
		"371": [
			"413.svg",
			"413.svg",
			"400",
			"雪か雨後曇",
			"SNOW OR RAIN, CLOUDY LATER"
		],
		"400": [
			"400.svg",
			"400.svg",
			"400",
			"雪",
			"SNOW"
		],
		"401": [
			"401.svg",
			"801.svg",
			"400",
			"雪時々晴",
			"SNOW, FREQUENT CLEAR"
		],
		"402": [
			"402.svg",
			"402.svg",
			"400",
			"雪時々止む",
			"SNOWTHROUGHOUT THE DAY"
		],
		"403": [
			"403.svg",
			"403.svg",
			"400",
			"雪時々雨",
			"SNOW,FREQUENT SCCATERED SHOWERS"
		],
		"405": [
			"400.svg",
			"400.svg",
			"400",
			"大雪",
			"HEAVYSNOW"
		],
		"406": [
			"406.svg",
			"406.svg",
			"400",
			"風雪強い",
			"SNOWSTORM"
		],
		"407": [
			"406.svg",
			"406.svg",
			"400",
			"暴風雪",
			"HEAVYSNOWSTORM"
		],
		"409": [
			"403.svg",
			"403.svg",
			"400",
			"雪一時雨",
			"SNOW, OCCASIONAL SCCATERED SHOWERS"
		],
		"411": [
			"411.svg",
			"811.svg",
			"400",
			"雪後晴",
			"SNOW,CLEAR LATER"
		],
		"413": [
			"413.svg",
			"413.svg",
			"400",
			"雪後曇",
			"SNOW,CLOUDY LATER"
		],
		"414": [
			"414.svg",
			"414.svg",
			"400",
			"雪後雨",
			"SNOW,RAIN LATER"
		],
		"420": [
			"411.svg",
			"811.svg",
			"400",
			"朝の内雪後晴",
			"SNOW IN THE MORNING, CLEAR LATER"
		],
		"421": [
			"413.svg",
			"413.svg",
			"400",
			"朝の内雪後曇",
			"SNOW IN THE MORNING, CLOUDY LATER"
		],
		"422": [
			"414.svg",
			"414.svg",
			"400",
			"雪昼頃から雨",
			"SNOW, RAIN IN THE AFTERNOON"
		],
		"423": [
			"414.svg",
			"414.svg",
			"400",
			"雪夕方から雨",
			"SNOW, RAIN IN THE EVENING"
		],
		"425": [
			"400.svg",
			"400.svg",
			"400",
			"雪一時強く降る",
			"SNOW, EXPECT OCCASIONAL HEAVY SNOWFALL"
		],
		"426": [
			"400.svg",
			"400.svg",
			"400",
			"雪後みぞれ",
			"SNOW, SLEET LATER"
		],
		"427": [
			"400.svg",
			"400.svg",
			"400",
			"雪一時みぞれ",
			"SNOW, OCCASIONAL SLEET"
		],
		"450": [
			"400.svg",
			"400.svg",
			"400",
			"雪で雷を伴う",
			"SNOW AND THUNDER"
		]
	};


	//----------------------------------------------------------------------------------------------
	// 
	/** 
	 * @func window.renewJmaAbst
	 * @desc JMA 表示更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewJmaAbst = function (arg) {
		weatherAbst = '';
		abstTargetArea = arg.targetArea;
		abstPublishingOffice = arg.publishingOffice;
		abstReportDatetime = arg.reportDatetime;

		weatherAbst += '<div class="p"><section>' + arg.text.replace(/\n+/g, '<br>') + '</section></div>';
		window.renewJma();
	};

	/** 
	 * @func window.renewJmaDetail
	 * @desc JMA 詳細表示
	 * @param {void}
	 * @return {void}
	 */
	window.renewJmaDetail = function (arg) {
		weatherDetail = '';

		let weather = arg.weather;
		let pops = arg.pops;
		let temps = arg.temperature;
		let timeArray = JSON.parse(weather[0].timeDefines);
		timeArray = timeArray.map((t) => { return new Date(t).toLocaleString(); });
		let timeArrayLength = timeArray.length;

		//---------------------------------------------
		// weather
		// weatherDetail += '<H3>天気予報 (' + new Date(weather[0].reportDatetime).toLocaleString() + '以降)</H3>';
		// console.log('window.renewJmaDetail weather');
		weatherDetail += '<div class="p">';
		weatherDetail += '<table><tbody>';
		// テーブルヘッダ
		weatherDetail += `<tr><th class="forecast">Area</th><th class="forecast">予測</th>`; for (let i = 0; i < timeArrayLength; i += 1) { weatherDetail += `<th class="forecast">${timeArray[i]}</th>` }; weatherDetail += `</tr>`;

		for (let a in weather) {
			let wcs = JSON.parse(weather[a].weatherCodes);
			let wes = JSON.parse(weather[a].weathers);

			// 左のAreaヘッダを打ち抜きにする。通常３段だが、波情報がないエリアは2段
			// console.log('window.renewJmaDetail weather.weather');
			if (weather[a].waves) {
				weatherDetail += `<tr><th rowspan="3" class="forecast">${weather[a].targetArea}</th>`;
			} else {
				weatherDetail += `<tr><th rowspan="2" class="forecast">${weather[a].targetArea}</th>`;
			}

			// 天気行
			// console.log('window.renewJmaDetail weather.weather');
			// weatherDetail += `<tr><th rowspan="3">${weather[a].targetArea}<br>${weather[a].code}</th>`;
			weatherDetail += `<th class="forecast">天気 <i class='fa-solid fa-cloud-sun'></i></th>`;
			for (let i = 0; i < timeArrayLength; i += 1) {
				weatherDetail += `<td class="forecast"><img src="https://www.jma.go.jp/bosai/forecast/img/${TELOPS[wcs[i]][0]}"><br>`; //code表示
				// weatherDetail += `<td class="forecast">${wcs[i]}<br>`; //codeからアイコン取得して表示
				weatherDetail += `${wes[i]}</td>`;
			}
			weatherDetail += `</tr>`;

			// 波
			// console.log('window.renewJmaDetail weather.waves');
			if (weather[a].waves) {  // 京都とか、波情報がない
				let wvs = JSON.parse(weather[a].waves);
				weatherDetail += `<tr>`;
				weatherDetail += `<th class="forecast">波 <i class="fa-solid fa-water"></i></th>`;
				for (let i = 0; i < timeArrayLength; i += 1) { weatherDetail += `<td class="forecast">${wvs[i].replace(/　ただし/, "<br>ただし").replace(/　うねり/, "<br>うねり")}</td>`; }
				weatherDetail += `</tr>`;
			}

			// 風
			// console.log('window.renewJmaDetail weather.winds');
			let wns = JSON.parse(weather[a].winds);
			weatherDetail += `<tr>`;
			weatherDetail += `<th class="forecast">風 <i class='fa-solid fa-wind'></i></th>`;
			for (let i = 0; i < timeArrayLength; i += 1) { weatherDetail += `<td class="forecast">${wns[i].replace(/　海上/, "<br>海上")}</td>`; }
			weatherDetail += `</tr>`;
		}
		weatherDetail += '</tbody></table></div>';

		//---------------------------------------------
		// pops、降水量
		// console.log('window.renewJmaDetail pops');
		timeArray = JSON.parse(pops[0].timeDefines);
		timeArray = timeArray.map((t) => { return new Date(t).toLocaleString(); });
		timeArrayLength = timeArray.length;

		weatherDetail += '<H3>降水量予測 (' + new Date(pops[0].reportDatetime).toLocaleString() + '以降)</H3>';
		weatherDetail += '<div class="p">';
		weatherDetail += '<table><tbody>';
		// テーブルヘッダ
		weatherDetail += `<tr><th class="forecast">Area</th>`; for (let i = 0; i < timeArrayLength; i += 1) { weatherDetail += `<th class="forecast">${timeArray[i]}</th>`; } weatherDetail += `</tr>`;
		for (let a in pops) {
			if (pops[a].pops) {  // エリアは定義されているけど降水量データがない場合もある
				let pa = JSON.parse(pops[a].pops);
				weatherDetail += `<tr><th class="forecast">${weather[a].targetArea}</th>`;
				// weatherDetail += `<tr><th class="forecast">${weather[a].targetArea}<br>${weather[a].code}</th>`;
				for (let i = 0; i < timeArrayLength; i += 1) { weatherDetail += `<td class="forecast center">${pa[0]}%</td>`; }
				weatherDetail += `</tr>`;
			}
		}
		weatherDetail += '</tbody></table>';
		weatherDetail += '</div>';


		//---------------------------------------------
		// temps、気温
		// console.log('window.renewJmaDetail temps');
		timeArray = JSON.parse(temps[0].timeDefines);
		timeArray = timeArray.map((t) => { return new Date(t).toLocaleString(); });
		timeArrayLength = timeArray.length;

		weatherDetail += '<H3>気温予測 (' + new Date(temps[0].reportDatetime).toLocaleString() + '以降)</H3>';
		weatherDetail += '<div class="p">';
		weatherDetail += '<table><tbody>';
		// テーブルヘッダ
		weatherDetail += `<tr><th class="forecast">Area</th>`; for (let i = 0; i < timeArrayLength; i += 1) { weatherDetail += `<th class="forecast">${timeArray[i]}</th>`; } weatherDetail += `</tr>`;
		for (let a in temps) {
			if (temps[a].temps) {  // エリアは定義されているけど降水量データがない場合もある
				let te = JSON.parse(temps[a].temps);
				weatherDetail += `<tr><th class="forecast">${weather[a].targetArea}</th>`;
				// weatherDetail += `<tr><th class="forecast">${weather[a].targetArea}<br>${weather[a].code}</th>`;
				for (let i = 0; i < timeArrayLength; i += 1) { weatherDetail += `<td class="forecast center">${te[0]}℃</td>`; }
				weatherDetail += `</tr>`;
			}
		}
		weatherDetail += '</tbody></table>';
		weatherDetail += '<div>';


		window.renewJma();
	};


	/** 
	 * @func 
	 * @desc 天気予報の更新、全体(上記renewJmaDetailのEntry)
	 * @param {void}
	 * @return {void}
	 */
	window.renewJma = function () {
		// return;  // @@@ まだ途中

		divJma.innerHTML = `<h3>天気予報 (${new Date(abstReportDatetime).toLocaleString()}取得) <span class="f_right"><i class="fa-solid fa-gear right" onClick="document.getElementById(\'configTab\').checked=true; location.hash=\'jmaConfig\'; document.getElementById(\'jmaConfigDetail\').open=true;"></i></span></h3>`;
		divJma.innerHTML += weatherDetail;
		divJma.innerHTML += `<H3>総評 <small>(${abstPublishingOffice})</small></H3>`;
		divJma.innerHTML += weatherAbst;
		divJma.innerHTML += '<small class="f_right">出典：気象庁　（https://www.jma.go.jp/jma/index.html）</small>';
	};

	//----------------------------------------------------------------------------------------------
	/** 
	 * @func 
	 * @desc jma config
	 * @param {void}
	 * @return {void}
	 */
	window.btnJmaConfigSet_Click = function () {
		btnJmaConfigSet.disabled = true;
		btnJmaConfigSet.textContent = '保存中…';

		// console.log('areaName:', inJmaArea.options[inJmaArea.selectedIndex].text, 'areaCode:', inJmaArea.value );
		window.ipc.JmaConfigSave(inJmaArea.options[inJmaArea.selectedIndex].text, inJmaArea.value);
	};

	/** 
	 * @func 
	 * @desc 設定完了
	 * @param {void}
	 * @return {void}
	 */
	window.JmaConfigSaved = function () {
		btnJmaConfigSet.disabled = false;
		btnJmaConfigSet.textContent = '設定';

		window.addToast('Info', 'JMA 設定を保存しました。');
	};

	/** 
	 * @func 
	 * @desc mainプロセスから設定値をもらったので画面を更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewJmaConfigView = function (arg) {
		inJmaArea.value = arg.code;
		divJmaCode.innerHTML = inJmaArea.value;
	};


	/** 
	 * @func 
	 * @desc セレクトボックスの変更
	 * @param {void}
	 * @return {void}
	 */
	window.inJmaArea_Change = function () {
		divJmaCode.innerHTML = inJmaArea.value;
	};

	/** 
	 * @func 
	 * @desc make jma selector
	 * @param {void}
	 * @return {void}
	 */
	window.makeJmaArea = function () {
		// console.log('window.makeJmaArea()');
		for (let i in areaCodes) {
			inJmaArea.add(new Option(i, areaCodes[i]));
		}
	};

	window.makeJmaArea();
});
