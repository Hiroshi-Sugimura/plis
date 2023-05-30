//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.30
//	ECHONET Lite関係
//////////////////////////////////////////////////////////////////////
/**
 * @namespace subEL
 */
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
window.addEventListener('DOMContentLoaded', function () {
	console.log('## DOMContentLoaded subEL.js');

	let facilitiesEL;   // デバイスリスト EL

	// config tab
	let inELUse = document.getElementById('inELUse'); // check box; use or not
	let btnELConfigSet = document.getElementById('btnELConfigSet'); // 設定ボタン
	let ELSettingsContents = document.getElementById('ELSettingsContents');	// dialog

	// control tab
	let H2ControlEL = document.getElementById('H2ControlEL');
	let divControlEL = document.getElementById('divControlEL');
	let divDetails = document.getElementById('divDetails_content');	// details
	let divELSuggest = document.getElementById('divELSuggest');	// 使用していない時のサジェスト

	let toIP = document.getElementById('toIP');
	let eltestSEOJ = document.getElementById('eltestSEOJ');
	let eltestDEOJ = document.getElementById('eltestDEOJ');
	let eltestESV = document.getElementById('eltestESV');
	let eltestEPC = document.getElementById('eltestEPC');
	let eltestDETAILs = document.getElementById('eltestDETAILs');
	let elsend = document.getElementById('elsend');

	let multicastSearch = document.getElementById('multicastSearch');

	let txtELLog = document.getElementById('txtELLog');

	// サブメータのグラフ関連
	let facilitiesSubESM;  // サブメータのデータだけ
	let divSubESMH3 = document.getElementById('divSubESMH3');  // サブメータのH3タイトル
	divSubESMH3.style.display = 'none';  // 初期値非表示
	let divSubESM = document.getElementById('divSubESM');  // サブメータのセンサデータ
	divSubESM.style.display = 'none';  // 初期値非表示
	let canSubEnergyChart = document.getElementById('canSubEnergyChart'); // エネルギーチャート
	canSubEnergyChart.style.display = 'none';  // 初期値非表示

	let inUserAmpere = document.getElementById('inUserAmpere'); // 契約アンペア


	//----------------------------------------------------------------------------------------------
	/** 
	 * @memberof window#
	 * @desc EL デバイス情報のrenew、mainからの情報で，EL関係のhtmlを変更する
	 * @param {void}
	 * @return {void}
	 */
	window.renewFacilitiesEL = function (arg) { //facilitiesHue = json = arg; // 機器情報確保
		txtELLog.value = JSON.stringify(arg, null, '  ');

		facilitiesEL = arg; // 機器情報確保

		if (!inELUse.checked) {  // 機能無効
			// console.log('-- inELUse.checked', inELUse.checked);
			return;
		}

		// 機能有効
		if (!facilitiesEL || isObjEmpty(facilitiesEL)) {  // 機器情報なし
			// console.log('-- facilitiesEL', facilitiesEL);
			doc = '<div class="p"><img src="./img/loadingRed.gif">接続中</div>';
			divControlEL.innerHTML = doc;
			return; // 機器情報なければやらない、存在も消す
		}

		let IPs = facilitiesEL.IPs;

		// -------------------------------------------------
		// controlタブ
		let doc = '';  // Controlのタブ内に書かれる文字
		IPs.forEach((ip) => {
			// console.log('-- IP', ip);

			let EOJs = facilitiesEL[ip].EOJs;
			EOJs.forEach((eoj) => {
				// console.log('-- IP', ip, 'EOJ', eoj);
				let obj = eoj.split(/\(|\)/);  // マルかっこで分割
				if (obj[1] === '0ef001') { return; } // Node Profileはコントローラとしては無視, eachではcontinueではなくreturn

				doc += "<div class='LinearLayoutChild'> <section>"
					+ `<span id='ELSettingsButton' class='fa-solid fa-gear el-settings-btn' onclick='window.ELSettings("${ip}", "${eoj}");'> </span>`
					+ window.createControlELButton(facilitiesEL, ip, eoj)
					+ "</section> </div>";  // ボタン設置
			});
		});

		divControlEL.innerHTML = doc;


		// -------------------------------------------------
		// detailsタブ
		let detailDoc = "";  // Detailsのタブ内に書かれる文字
		IPs.forEach((ip) => {
			detailDoc += "<h2>" + ip + "</h2>";
			detailDoc += "<table border=0 class='el-details'>";

			let EOJs = facilitiesEL[ip].EOJs;
			EOJs.forEach((eoj) => {
				let obj = eoj.split(/\(|\)/);  // (と)で分割

				// icon
				detailDoc += "<tr><td class='opc'><img src=\"./img/" + obj[1].substring(0, 2) + ".png\" width=50 /><br />" + obj[0] + "</td>";
				detailDoc += '<td class="edt">\n<dl>';

				// EDT
				let EPCs = facilitiesEL[ip][eoj].EPCs;

				EPCs.forEach((epc) => {
					detailDoc += "<dt>" + epc + "</dt><dd>" + facilitiesEL[ip][eoj][epc] + "</dd>\n";
				});
				detailDoc += '</dl></td></tr>';
			});
			detailDoc += "</table>";
		});
		divDetails.innerHTML = detailDoc;


		// もしサブメータがあれば
		for (let ip of IPs) {
			for (let eoj of facilitiesEL[ip].EOJs) {
				if (eoj == 'スマート電力量サブメータ01(028d01)') {
					window.renewSubESM(facilitiesEL[ip]);
				}
			}
		}
	}

	//----------------------------------------------------------------------------------------------
	/** 
	 * @func window.btnELConfigSet_Click
	 * @desc ECHONET Lite Config
	 * @param {void}
	 * @return {void}
	 */
	window.btnELConfigSet_Click = function () {
		console.log('window.btnELConfigSet_Click() inELUse:', inELUse.checked);
		btnELConfigSet.disabled = false;
		btnELConfigSet.textContent = '設定';

		if (inELUse.checked == false) {
			window.ipc.ELStop();  // ELをstopする
			facilitiesEL = {};
			divControlEL.innerHTML = '';
			return;
		}

		window.ipc.ELUse();
	};


	/** 
	 * @func window.ELConfigSaved
	 * @desc 設定完了通知
	 * @param {void}
	 * @return {void}
	 */
	window.ELConfigSaved = function () {
		btnELConfigSet.disabled = false;
		btnELConfigSet.textContent = '設定';

		window.addToast('Info', 'EL 設定を保存しました。');
	};

	/** 
	 * @func window.renewELConfigView
	 * @desc mainプロセスから設定値をもらったので画面を更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewELConfigView = function (arg) {
		inELUse.checked = arg.enabled;

		btnELConfigSet.disabled = false;
		btnELConfigSet.textContent = '設定';

		if (arg.enabled) {  // 利用する場合
			H2ControlEL.style.display = 'block';
			divControlEL.style.display = '-webkit-flex';
			divELSuggest.style.display = 'none';
		} else {  // 利用しない場合
			H2ControlEL.style.display = 'none';
			divControlEL.style.display = 'none';
			divELSuggest.style.display = 'block';
		}
	};



	//----------------------------------------------------------------------------------------------
	/** 
	 * @type {HTMLElement}
	 * @listens multicastSearch#click
	 * @event multicastSearch#click
	 * @desc ECHONET Lite Conntrol, マルチキャストボタン
	 */
	multicastSearch.addEventListener('click', function () {
		window.ipc.ELsearch();
	});


	//----------------------------------------------------------------------------------------------
	// サブメータ関連

	/** 
	 * @func convRT
	 * @desc R相、T相を数値に
	 * @memberof subEL#
	 * @param {void}
	 * @return {void}
	 */
	let convRT = function (str) {
		let n = str.split('[')[0];
		return parseFloat(n).toFixed(2);
	};


	/** 
	 * @fires window.renewSubESM
	 * @desc window.renewSubESM
	 * @param {void}
	 * @return {void}
	 */
	window.renewSubESM = function (arg) {
		console.log('window.renewSubESM() arg:', arg);
		facilitiesSubESM = arg;

		if (Object.keys(facilitiesSubESM).length === 0) {  // 利用していない場合はSuggestを表示
			divSubESM.innerHTML = '';
			return;
		}

		// 利用している場合はタイトルと概要を表示
		divSubESMH3.style.display = 'block';
		divSubESM.style.display = 'block';

		let esmDoc = "<div class='LinearLayoutParent'>";

		for (let eoj of arg.EOJs) {
			if (eoj == 'スマート電力量サブメータ01(028d01)') {
				let obj = arg[eoj];

				esmDoc += `<section> <div class='tooltip'><img src='./img/electric.png' class='esm-icon'/><div class='description'>設置場所: ${obj['設置場所(81)']} &#013; &#010; Version: ${obj['規格Version情報(82)']}</div></div><br>`;

				esmDoc += `<div class='LinearLayoutChild_Env'> <section class='watt_color' id='subesmDocWattSec'><i class="fa-solid fa-bolt"></i> <small>瞬時電力</small><br>${arg.Means['瞬時電力計測値[W]']} W</section></div>`;

				if (obj['瞬時電流計測値(E8)']) {
					let amp = JSON.parse(obj['瞬時電流計測値(E8)'].split('(')[0]);
					esmDoc += `<div class='LinearLayoutChild_Env'> <section class='ampereR_color' id='subesmDocAmpereRSec'><i class="fa-solid fa-bolt"></i> <small>瞬時電流R相</small><br>${convRT(amp.RPhase)} A</section></div>`;
					esmDoc += `<div class='LinearLayoutChild_Env'> <section class='ampereT_color' id='subesmDocAmpereTSec'><i class="fa-solid fa-bolt"></i> <small>瞬時電流T相</small><br>${convRT(amp.TPhase)} A</section></div>`;
				} else {
					esmDoc += `<div class='LinearLayoutChild_Env'> <section class='ampereR_color' id='subesmDocAmpereRSec'><i class="fa-solid fa-bolt"></i> <small>瞬時電流R相</small><br>取得中 A</section></div>`;
					esmDoc += `<div class='LinearLayoutChild_Env'> <section class='ampereT_color' id='subesmDocAmpereTSec'><i class="fa-solid fa-bolt"></i> <small>瞬時電流T相</small><br>取得中 A</section></div>`;
				}

				esmDoc += `<div class='LinearLayoutChild_Env'> <section class='comWattNorm_color' id='subesmDocComWattNormSec'><i class="fa-solid fa-bolt"></i> <small>積算電力量（正）</small><br>`
					+ `${parseFloat(arg.Means['積算電力量計測値（正方向計測値）[kWh]']).toFixed(2)} kWh</section></div>`;
				esmDoc += `<div class='LinearLayoutChild_Env'> <section class='comWattRev_color'  id='subesmDocComWattRevSec'> <i class="fa-solid fa-bolt"></i> <small>積算電力量（逆）</small><br>`
					+ `${parseFloat(arg.Means['積算電力量計測値（逆方向計測値）[kWh]']).toFixed(2)} kWh</section></div>`;

				esmDoc += `</div>`;
			}
		}
		esmDoc += "</section>";

		esmDoc += "</div>"; // LinearLayoutParent
		divSubESM.innerHTML = esmDoc;
	};


	//----------------------------------------------------------------------------------------------
	// ESM chart

	// 内部変数、定時積算電力はグラフに表示しない
	let ocommulativeAmountNormal = [];
	let ocommulativeAmountReverse = [];
	let oinstantaneousCurrentsR = [];
	let oinstantaneousCurrentsT = [];
	let oinstantaneousPower = [];
	// let ocommulativeAmountsFixedTimeNormalPower = [];  // 定時必要無し
	// let ocommulativeAmountsFixedTimeRiversePower = [];

	/*
	const LABEL_X = [
		'00:00', '00:15', '00:30', '00:45', '01:00', '01:15', '01:30', '01:45', '02:00', '02:15', '02:30', '02:45',
		'03:00', '03:15', '03:30', '03:45', '04:00', '04:15', '04:30', '04:45', '05:00', '05:15', '05:30', '05:45',
		'06:00', '06:15', '06:30', '06:45', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45',
		'09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45',
		'12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45',
		'15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45',
		'18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45',
		'21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '22:45', '23:00', '23:15', '23:30', '23:45', '24:00'];
*/
	// HTML内部とリンク
	const ctxSubESM = canSubEnergyChart.getContext('2d');
	let myChartSubESM = null;

	// 複数軸用の、軸オプション
	let complexChartOption = {
		responsive: true,
		plugins: {
			legend: {
				display: true,
				position: 'top'
			},
			autocolors: false,
			annotation: {
				annotations: {
					line1: {
						type: 'line',
						yScaleID: 'y-axis-right',
						yMin: 20,
						yMax: 20,
						borderColor: 'rgb(255, 99, 132)',
						borderWidth: 2,
						borderDash: [2, 3],
						label: {
							display: true,
							content: 'Breaker',
							position: 'end'
						}
					}
				}
			}
		},
		scales: {
			"y-axis-left-kwh": {
				type: "linear",   // linear固定
				position: "left", // どちら側に表示される軸か？
				// suggestedMax: 110,
				min: 0,
				title: { display: true, text: 'Commulative amounts energy [kWh]' }
			},
			"y-axis-left-w": {
				type: "linear",   // linear固定
				position: "left", // どちら側に表示される軸か？
				suggestedMax: 3000,
				min: 0,
				title: { display: true, text: 'Instantaneous electric power [W]' }
			},
			"y-axis-right": {
				type: "linear",
				position: "right",
				suggestedMax: 30,
				min: 0,
				title: { display: true, text: 'Ampere [A]' }
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
	let datasetsSubESM = [];

	/**
	 * @func renewCanvasSubESM
	 * @desc 内部関数
	 * @param {void}
	 * @returns {number} The sum of the two numbers. (JSDoc test)
	 */
	let renewCanvasSubESM = function () {
		// タイトルとチャート表示
		divSubESMH3.style.display = 'block';
		divSubESM.style.display = 'block';
		canSubEnergyChart.style.display = 'block';

		let esmDoc = "<div class='LinearLayoutParent'>";

		if (myChartSubESM) { myChartSubESM.destroy(); }  // chartがすでにctxを使っていると、リエントラントで"Canvas is already in use."のエラーが出る

		myChartSubESM = new Chart(ctxSubESM, {
			type: 'line',
			data: {
				// labels: LABEL_X,
				datasets: datasetsSubESM
			},
			options: complexChartOption
		});
	};


	//////////////////////////////////////////////////////////////////
	/** 
	 * @func window.renewEnergySubmeter
	 * @desc データをもらって画面更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewEnergySubmeter = function (_envDataArray) {
		// console.log('window.renewEnergySubmeter(); _envDataArray', _envDataArray);
		let envDataArray = JSON.parse(_envDataArray);

		if (inUserAmpere.value != '') {  // 契約アンペアの指定があればアノテーションする
			complexChartOption.plugins.annotation.annotations.line1.yMin = parseInt(inUserAmpere.value);
			complexChartOption.plugins.annotation.annotations.line1.yMax = parseInt(inUserAmpere.value);
			complexChartOption.scales["y-axis-right"].suggestedMax = parseInt(inUserAmpere.value) + 10;
		}

		datasetsSubESM = [];

		if (envDataArray) {
			ocommulativeAmountNormal = [];
			ocommulativeAmountReverse = [];
			oinstantaneousCurrentsR = [];
			oinstantaneousCurrentsT = [];
			oinstantaneousPower = [];
			// ocommulativeAmountsFixedTimeNormalPower = [];  // 定時必要無し
			// ocommulativeAmountsFixedTimeRiversePower = [];

			for (const d of envDataArray) {
				ocommulativeAmountNormal.push({ x: moment(d.time), y: d.commulativeAmountNormal });
				ocommulativeAmountReverse.push({ x: moment(d.time), y: d.commulativeAmountReverse });
				oinstantaneousCurrentsR.push({ x: moment(d.time), y: d.instantaneousCurrentsR });
				oinstantaneousCurrentsT.push({ x: moment(d.time), y: d.instantaneousCurrentsT });
				oinstantaneousPower.push({ x: moment(d.time), y: d.instantaneousPower });
				// 定時必要無し
				// ocommulativeAmountsFixedTimeNormalPower.push( d.commulativeAmountsFixedTimeNormalPower );
				// ocommulativeAmountsFixedTimeRiversePower.push( d.commulativeAmountsFixedTimeRiversePower );
			}

			datasetsSubESM.push(
				{
					label: '瞬時電力 [W]', type: 'line', data: oinstantaneousPower, borderColor: "rgba(178,255,178,1.0)", backgroundColor: "rgba(178,255,178,1.0)",
					radius: 1.5, borderWidth: 1, yAxisID: 'y-axis-left-w', borderDash: [2, 1]
				},
				{
					label: '瞬時電流R相 [A]', type: 'line', data: oinstantaneousCurrentsR, borderColor: "rgba(178,178,255,1.0)", backgroundColor: "rgba(178,178,255,1.0)",
					radius: 1.5, borderWidth: 1, yAxisID: 'y-axis-right', borderDash: [2, 1]
				},
				{
					label: '瞬時電流T相 [A]', type: 'line', data: oinstantaneousCurrentsT, borderColor: "rgba(255,196,137,1.0)", backgroundColor: "rgba(178,178,255,1.0)",
					radius: 1.5, borderWidth: 1, yAxisID: 'y-axis-right', borderDash: [2, 1]
				},
				{
					label: '積算電力量（正） [kWh]', type: 'line', fill: true, data: ocommulativeAmountNormal, borderColor: "rgba(255,178,178,1.0)", backgroundColor: "rgba(255,178,178,.2)",
					radius: 1.5, borderWidth: 1, yAxisID: 'y-axis-left-kwh', borderDash: [2, 1]
				},
				{
					label: '積算電力量（逆） [kWh]', type: 'line', fill: true, data: ocommulativeAmountReverse, borderColor: "rgba(255,178,255,1.0)", backgroundColor: "rgba(255,178,255,0.5)",
					radius: 1.5, borderWidth: 1, yAxisID: 'y-axis-left-kwh', borderDash: [2, 1]
				}
				// 定時無し
				// { label: '定時積算電力量（正） [kWh]',    type: 'line', data: ocommulativeAmountsFixedTimeNormalPower, borderColor: "rgba(178,255,178,1.0)", backgroundColor: "rgba(178,255,178,1.0)",
				// radius:1.5, borderWidth:1, yAxisID: 'y-axis-left', borderDash: [2,1] },
				// { label: '定時積算電力量（逆） [kWh]',    type: 'line', data: ocommulativeAmountsFixedTimeRiversePower, borderColor: "rgba(178,255,178,1.0)", backgroundColor: "rgba(178,255,178,1.0)",
				// radius:1.5, borderWidth:1, yAxisID: 'y-axis-left', borderDash: [2,1] }
			);

			renewCanvasSubESM();
		}
	};

});
