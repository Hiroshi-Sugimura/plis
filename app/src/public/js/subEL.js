//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.08.30
//	ECHONET Lite関係
//////////////////////////////////////////////////////////////////////
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
/**
 * @namespace subEL
 */
window.addEventListener('DOMContentLoaded', function () {
	console.log('## DOMContentLoaded subEL.js');

	let facilitiesEL;   // デバイスリスト EL

	// config tab
	let inELUse = document.getElementById('inELUse'); // check box; use or not
	let inELUseOldSearch = document.getElementById('inELUseOldSearch'); // check box; use old search or not
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
	 * @func
	 * @memberof window
	 * @desc EL デバイス情報のrenew、mainからの情報で，EL関係のhtmlを変更する
	 * @param {void}
	 * @return {void}
	 */
	window.renewFacilitiesEL = function (arg) { // facilitiesEL = json = arg; // 機器情報確保
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
				// ガード: 不正なEOJ要素はスキップ（null/型不正/括弧内6桁なし）
				if (!eoj || typeof eoj !== 'string' || !/\([0-9a-fA-F]{6}\)/.test(eoj)) {
					return;
				}
				// console.log('-- IP', ip, 'EOJ', eoj);
				try {
					let obj = eoj.split(/\(|\)/);  // マルかっこで分割
					if (obj[1] === '0ef001') { return; } // Node Profileはコントローラとしては無視, eachではcontinueではなくreturn

					doc += "<div class='LinearLayoutChild'> <section class='dev'>"
						+ `<span id='ELSettingsButton' class='fa-solid fa-gear el-settings-btn' onclick='window.ELSettings("${ip}", "${eoj}");'> </span>`
						+ window.createControlELButton(facilitiesEL, ip, eoj)
						+ "</section> </div>";  // ボタン設置

				} catch (error) {
					console.error('Error: subEL.window.renewFacilitiesEL() control tab, error:', error);
					console.error('ip:', ip, 'eoj:', eoj);
					// detailDocはまだ定義されていないため、エラーログのみ出力
				}
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
				// ガード: 不正なEOJ要素はスキップ
				if (!eoj || typeof eoj !== 'string' || !/\([0-9a-fA-F]{6}\)/.test(eoj)) {
					return;
				}
				try {
					let obj = eoj.split(/\(|\)/);  // (と)で分割

					// icon
					detailDoc += "<tr><td class='opc'><img src=\"./img/" + obj[1].substring(0, 2) + ".png\" width=50 /><br />" + obj[0] + "</td>";
					detailDoc += '<td class="edt">\n<dl>';

					// EDT
					if (!facilitiesEL[ip] || !facilitiesEL[ip][eoj] || !Array.isArray(facilitiesEL[ip][eoj].EPCs)) {
						return;
					}
					let EPCs = facilitiesEL[ip][eoj].EPCs;

					EPCs.forEach((epc) => {
						detailDoc += "<dt>" + epc + "</dt><dd>" + facilitiesEL[ip][eoj][epc] + "</dd>\n";
					});
					detailDoc += '</dl></td></tr>';
				} catch (error) {
					console.error('Error: subEL.window.renewFacilitiesEL() details tab error:', error);
					console.error('ip:', ip, 'eoj:', eoj);
					detailDoc += '</dl></td></tr>';
				}
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
		btnELConfigSet.textContent = '適用と保存';

		// EL use or not
		if (inELUse.checked == false) {
			window.ipc.ELStop();  // ELをstopする
			facilitiesEL = {};
			divControlEL.innerHTML = '';
		} else {
			window.ipc.ELUse();
		}

		// old search or not
		if (inELUseOldSearch.checked == false) {
			window.ipc.ELStopOldSearch();  // ELをstopする
		} else {
			window.ipc.ELUseOldSearch();
		}

	};


	/**
	 * @func window.ELConfigSaved
	 * @desc 設定完了通知
	 * @param {void}
	 * @return {void}
	 */
	window.ELConfigSaved = function () {
		btnELConfigSet.disabled = false;
		btnELConfigSet.textContent = '適用と保存';

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
		inELUseOldSearch.checked = arg.oldSearch;

		btnELConfigSet.disabled = false;
		btnELConfigSet.textContent = '適用と保存';

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
	 * @memberof subEL
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

	// HTML内部とリンク
	const ctxSubESM = canSubEnergyChart.getContext('2d');
	let myChartSubESM = null;

	// 30分刻みの固定ラベル
	const LABEL_X_30 = [
		'00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30', '04:00', '04:30', '05:00', '05:30',
		'06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
		'12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
		'18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30', '24:00'];

	// 複数軸用の、軸オプション
	let complexChartOption = {
		responsive: true,
		plugins: {
			legend: {
				display: true,
				position: 'top',
				onClick: newLegendClickHandler
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
					},
					stepSize: 30
				},
				labels: LABEL_X_30,
				min: '00:00',
				max: '24:00',
				ticks: {
					autoSkip: true,
					source: 'labels',
					minRotation: 90,
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
	 * @memberof subEL
	 * @desc 内部関数
	 * @param {void}
	 * @returns {number} The sum of the two numbers. (JSDoc test)
	 */
	let renewCanvasSubESM = function () {
		// タイトルとチャート表示
		divSubESMH3.style.display = 'block';
		divSubESM.style.display = 'block';
		canSubEnergyChart.style.display = 'block';

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

			for (const d of envDataArray) {
				ocommulativeAmountNormal.push({ x: moment(d.time), y: d.commulativeAmountNormal });
				ocommulativeAmountReverse.push({ x: moment(d.time), y: d.commulativeAmountReverse });
				oinstantaneousCurrentsR.push({ x: moment(d.time), y: d.instantaneousCurrentsR });
				oinstantaneousCurrentsT.push({ x: moment(d.time), y: d.instantaneousCurrentsT });
				oinstantaneousPower.push({ x: moment(d.time), y: d.instantaneousPower });
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
			);

			renewCanvasSubESM();
		}
	};


	//----------------------------------------------------------------------------------------------
	// ECHONET Lite チャート用の設定

	let complexChartOptionEL = {
		responsive: true,
		plugins: {
			legend: {
				display: true,
				position: 'top'
			}
		},
		scales: {
			"y-axis-left": {
				type: "linear",
				position: "left",
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
					},
					stepSize: 30
				},
				labels: LABEL_X_30,
				min: '00:00',
				max: '24:00',
				ticks: {
					autoSkip: true,
					source: 'labels',
					minRotation: 90,
					maxRotation: 90,
					callback: function (value, index, ticks) {
						return moment.tz(value, 'Asia/Tokyo').format('HH:mm');
					}
				},
				grid: {
					color: 'rgba(0,0,0,0.3)',
					borderColor: 'rgba(0,0,0,1.0)'
				}
			}
		}
	};

	let complexPowerChartOptionEL = {
		responsive: true,
		plugins: {
			legend: {
				display: true,
				position: 'top'
			}
		},
		scales: {
			"y-axis-left-w": {
				type: "linear",
				position: "left",
				suggestedMax: 1000,
				min: 0,
				title: { display: true, text: 'Watt [W]' },
				grid: {
					color: 'rgba(255,0,0,0.1)',
					borderColor: 'rgba(255,0,0,1.0)'
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
					},
					stepSize: 30
				},
				labels: LABEL_X_30,
				min: '00:00',
				max: '24:00',
				ticks: {
					autoSkip: true,
					source: 'labels',
					minRotation: 90,
					maxRotation: 90,
					callback: function (value, index, ticks) {
						return moment.tz(value, 'Asia/Tokyo').format('HH:mm');
					}
				},
				grid: {
					color: 'rgba(0,0,0,0.3)',
					borderColor: 'rgba(0,0,0,1.0)'
				}
			}
		}
	};

	// ECHONET Lite チャート
	let myChartEL = null;
	let myPowerChartEL = null;
	let datasetsEL = [];
	let datasetsELPower = [];

	const canRoomEnvChartEL = document.getElementById('canRoomEnvChartEL');
	const canRoomPowerChartEL = document.getElementById('canRoomPowerChartEL');
	const ctxEL = canRoomEnvChartEL.getContext('2d');
	const ctxELPower = canRoomPowerChartEL.getContext('2d');
	const H3EL = document.getElementById('H3EL');
	const H3ELPower = document.getElementById('H3ELPower');

	const pointStyleList = ['circle', 'triangle', 'cross', 'rect', 'star', 'dash', 'rectRounded', 'crossRot', 'rectRot', 'line'];

	let renewCanvasEL = function () {
		H3EL.style.display = 'block';
		canRoomEnvChartEL.style.display = 'block';
		if (myChartEL) {
			myChartEL.data.datasets = datasetsEL;
			myChartEL.update();
		} else {
			myChartEL = new Chart(ctxEL, {
				type: 'line',
				data: {
					datasets: datasetsEL
				},
				options: complexChartOptionEL
			});
		}
	};

	let renewPowerCanvasEL = function () {
		H3ELPower.style.display = 'block';
		canRoomPowerChartEL.style.display = 'block';
		if (myPowerChartEL) {
			myPowerChartEL.data.datasets = datasetsELPower;
			myPowerChartEL.update();
		} else {
			myPowerChartEL = new Chart(ctxELPower, {
				type: 'line',
				data: {
					datasets: datasetsELPower
				},
				options: complexPowerChartOptionEL
			});
		}
	};

	window.renewRoomEnvEL = function (_envDataObj) {
		let envDataObj = JSON.parse(_envDataObj);
		datasetsEL = [];
		let pointStyle = 0;
		let spanELEnvTime = document.getElementById('spanELEnvTime');
		spanELEnvTime.textContent = moment().format("YYYY-MM-DD HH:mm:ss取得");

		if (envDataObj && envDataObj.airconditionerList) {
			for (const ac of envDataObj.airconditionerList) {
				let envDataArray = envDataObj[ac];
				if (envDataArray) {
					let oTemperature = [];
					let oHumidity = [];
					for (const d of envDataArray) {
						if (d.temperature !== null) {
							oTemperature.push({ x: moment(d.time), y: d.temperature });
						}
						if (d.humidity !== null) {
							oHumidity.push({ x: moment(d.time), y: d.humidity });
						}
					}

					if (oTemperature.length > 0) {
						datasetsEL.push({
							label: ac + '：温度 [℃]', type: 'line', data: oTemperature, borderColor: "rgba(255,70,70,1.0)", backgroundColor: "rgba(255,178,178,1.0)",
							radius: 4, borderWidth: 1, yAxisID: 'y-axis-left', xAxisID: 'x', pointStyle: pointStyleList[pointStyle]
						});
					}
					if (oHumidity.length > 0) {
						datasetsEL.push({
							label: ac + '：湿度 [%RH]', type: 'line', data: oHumidity, borderColor: "rgba(70,70,255,1.0)", backgroundColor: "rgba(178,178,255,1.0)",
							radius: 4, borderWidth: 1, yAxisID: 'y-axis-right', xAxisID: 'x', pointStyle: pointStyleList[pointStyle]
						});
					}
					pointStyle = pointStyle == 9 ? 0 : pointStyle + 1;
				}
			}
		}

		if (datasetsEL.length > 0) {
			renewCanvasEL();
		} else {
			H3EL.style.display = 'none';
			canRoomEnvChartEL.style.display = 'none';
		}
	};

	window.renewPowerEL = function (_powerDataObj) {
		let powerDataObj = JSON.parse(_powerDataObj);
		datasetsELPower = [];
		let pointStyle = 0;
		let spanELPowerTime = document.getElementById('spanELPowerTime');
		spanELPowerTime.textContent = moment().format("YYYY-MM-DD HH:mm:ss取得");

		if (powerDataObj && powerDataObj.deviceList) {
			for (const dev of powerDataObj.deviceList) {
				let powerDataArray = powerDataObj[dev];
				if (powerDataArray) {
					let oPower = [];
					for (const d of powerDataArray) {
						if (d.power !== null) {
							oPower.push({ x: moment(d.time), y: d.power });
						}
					}

					if (oPower.length > 0) {
						datasetsELPower.push({
							label: dev + '：電力 [W]', type: 'line', data: oPower, borderColor: "rgba(255,70,70,1.0)", backgroundColor: "rgba(255,178,178,1.0)",
							radius: 4, borderWidth: 1, yAxisID: 'y-axis-left-w', xAxisID: 'x', pointStyle: pointStyleList[pointStyle]
						});
					}
					pointStyle = pointStyle == 9 ? 0 : pointStyle + 1;
				}
			}
		}

		if (datasetsELPower.length > 0) {
			renewPowerCanvasEL();
		} else {
			H3ELPower.style.display = 'none';
			canRoomPowerChartEL.style.display = 'none';
		}
	};

});
