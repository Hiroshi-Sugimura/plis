//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2022.10.01
//	esm関係の処理
//////////////////////////////////////////////////////////////////////
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
/**
 * @namespace subESM
 */
window.addEventListener('DOMContentLoaded', function () {
	console.dir('## DOMContentLoaded subESM.js');

	let facilitiesESM; // 宅内情報（esm）

	// config
	let inESMUse = document.getElementById('inESMUse');  // config: 有効・無効
	let inDongleType = document.getElementById('inDongleType');
	let inConnectionType = document.getElementById('inConnectionType');
	let inESMId = document.getElementById('inESMId');
	let inESMPassword = document.getElementById('inESMPassword');
	let inUserAmpere = document.getElementById('inUserAmpere');
	let inESMUserAmpere = document.getElementById('inESMUserAmpere');
	let btnESMConfigSet = document.getElementById('btnESMConfigSet');
	let divESMSuggest = document.getElementById('divESMSuggest');  // 利用していないときに、利用の仕方へ誘導

	// top tab
	let H3ESM = document.getElementById('H3ESM');	// タイトル
	let divESMAbst = document.getElementById('divESMAbst');  // esmのセンサデータ
	let divESMChart = document.getElementById('divESMChart');  // チャート
	// abst
	let spanESMPlace = document.getElementById('spanESMPlace');	 // 設置場所
	let spanESMIP = document.getElementById('spanESMIP');		 // IP
	let spanESMVersion = document.getElementById('spanESMVersion'); // Version
	let spanESMWatt = document.getElementById('spanESMWatt');	 // 瞬時電力
	let spanESMAmpereR = document.getElementById('spanESMAmpereR'); // 瞬時電流R
	let spanESMAmpereT = document.getElementById('spanESMAmpereT'); // 瞬時電流T
	let spanESMComWattNorm = document.getElementById('spanESMComWattNorm'); // 積算電力量正方向
	let spanESMComWattRev = document.getElementById('spanESMComWattRev'); // 積算電力量逆方向

	// Control Tab : ECHONET
	let H2ControlEL = document.getElementById('H2ControlEL');
	let divControlESM = document.getElementById('divControlESM');

	//----------------------------------------------------------------------------------------------
	/** 
	 * @func convRT
	 * @desc R相、T相を数値に
	 * @memberof subESM
	 * @param {void}
	 * @return {void}
	 */
	let convRT = function (str) {
		let n = str.split('[')[0];
		return parseFloat(n).toFixed(2);
	};

	/** 
	 * @func window.renewESM
	 * @desc ESM デバイス情報のrenew
	 * @param {void}
	 * @return {void}
	 */
	window.renewESM = function (arg) {
		// console.log( 'window.renewESM() arg:', arg );
		facilitiesESM = arg;

		if (inESMUse.checked == false || Object.keys(facilitiesESM).length === 0) {  // 利用していない場合はSuggestを表示
			return;
		}

		// 利用している人はグラフなど表示

		// Control Tabの表示機能有効


		for (let ip of arg.IPs) {
			for (let eoj of arg[ip].EOJs) {
				if (eoj == '低圧スマート電力量メータ01(028801)') {
					let obj = arg[ip][eoj];

					spanESMPlace.innerHTML = obj['設置場所(81)'];
					spanESMIP.innerHTML = ip;
					spanESMVersion.innerHTML = obj['規格Version情報(82)'];

					if (obj['瞬時電力計測値(E7)']) {
						spanESMWatt.innerHTML = obj['瞬時電力計測値(E7)'].split('W')[0];
					}

					if (obj['瞬時電流計測値(E8)']) {
						let amp = JSON.parse(obj['瞬時電流計測値(E8)'].split('(')[0]);
						spanESMAmpereR.innerHTML = convRT(amp.RPhase);
						spanESMAmpereT.innerHTML = convRT(amp.TPhase);
					}

					if (!isObjEmpty(arg[ip].Means)) {
						spanESMComWattNorm.innerHTML = parseFloat(arg[ip].Means['積算電力量計測値（正方向計測値）[kWh]']).toFixed(2);
						spanESMComWattRev.innerHTML = parseFloat(arg[ip].Means['積算電力量計測値（逆方向計測値）[kWh]']).toFixed(2);
					}

				}
			}
		}
	};

	/** 
	 * @func window.esmDocSectionClicked
	 * @desc 左のボタンからグラフ制御
	 * @param {void}
	 * @return {void}
	 */
	window.esmDocSectionClicked = function (t) {
		myChartESM._metasets.forEach((v) => {
			if (v.label != t) {
				v.hidden = true;
			} else {
				v.hidden = false;
			}
		});
		myChartESM.update();
	};

	/** 
	 * @func window.disconnectedESM
	 * @desc ESM USBと切断
	 * @param {void}
	 * @return {void}
	 */
	window.disconnectedESM = function () {
		H3ESM.style.display = 'none';
		canEnergyChart.style.display = 'none';
		divESMSuggest.style.display = 'block';
		inESMUse.checked = false;
	};

	//----------------------------------------------------------------------------------------------
	/** 
	 * @func window.btnESMConfigSet_Click
	 * @desc ESM config
	 * @param {void}
	 * @return {void}
	 */
	window.btnESMConfigSet_Click = function (checkBox) {
		if (inESMUse.checked == false) {
			window.ipc.ESMnotUse(inDongleType.value, inESMId.value, inESMPassword.value);  // ESM 連携停止
			window.addToast('Info', '電力スマートメーターとの連携を解除しました。');
			renewESM();
			return; // falseなら外すだけ
		}

		// true にした時のチェック
		if (inDongleType.value == '' || inESMId.value == '' || inESMPassword.value == '') { // 情報不足で有効にしたら解説ダイアログ
			inESMUse.checked = false;
			esmHelpDialog.showModal();
		} else {  // 全情報あり
			window.ipc.ESMUse(inDongleType.value, inConnectionType.value, inESMId.value, inESMPassword.value);
			window.addToast('Info', '電力スマートメーターとの連携を開始しました。実際の通信まで2分程度お待ちください。');
		}
	};

	/** 
	 * @func window.ESMConfigSaved
	 * @desc 設定完了
	 * @param {void}
	 * @return {void}
	 */
	window.ESMConfigSaved = function () {
		btnESMConfigSet.disabled = false;
		btnESMConfigSet.textContent = '設定';

		window.addToast('Info', 'ESM 設定を保存しました。');
	};

	/** 
	 * @func window.renewESMConfigView
	 * @desc mainプロセスから設定値をもらったので画面を更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewESMConfigView = function (arg) {
		inESMUse.checked = arg.enabled ? true : false;
		inDongleType.value = arg.dongleType;
		inConnectionType.value = arg.connectionType;
		inESMId.value = arg.id;
		inESMPassword.value = arg.password;
		inUserAmpere.value = arg.userAmpere;
		inESMUserAmpere.value = arg.userAmpere;

		if (inESMUse.checked) {  // 利用するのでデータ表示
			H3ESM.style.display = 'block';
			divESMAbst.style.display = 'block';
			divESMChart.style.display = 'block';
			divESMSuggest.style.display = 'none';
		} else {
			H3ESM.style.display = 'none';
			divESMAbst.style.display = 'none';
			divESMChart.style.display = 'none';
			divESMSuggest.style.display = 'block';
		}

	};


	//----------------------------------------------------------------------------------------------
	// ESM chart

	// 内部変数、定時積算電力はグラフに表示しない
	let ocommulativeAmountNormal = [];
	let ocommulativeAmountReverse = [];
	let oinstantaneousCurrentsR = [];
	let oinstantaneousCurrentsT = [];
	let oinstantaneousPower = [];

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

	// HTML内部とリンク
	const canEnergyChart = document.getElementById('canEnergyChart'); // エネルギーチャート
	const ctxESM = canEnergyChart.getContext('2d');
	let myChartESM = null;

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
						yMin: 30,
						yMax: 30,
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
				suggestedMax: 3000,
				min: 0,
				title: { display: true, text: 'Commulative amounts energy [kWh]' },
				grid: {
					color: 'rgba(127,127,255,0.1)',
					borderColor: 'blue'
				}
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
				title: { display: true, text: 'Ampere [A]' },
				grid: {
					color: 'rgba(255,127,127,0.3)',
					borderColor: 'red'
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
	let datasetsESM = [];

	/** 
	 * @func renewCanvasESM
	 * @desc renewCanvasESM
	 * @memberof subESM
	 * @param {void}
	 * @return {void}
	 */
	let renewCanvasESM = function () {
		if (myChartESM) { myChartESM.destroy(); }  // chartがすでにctxを使っていると、リエントラントで"Canvas is already in use."のエラーが出る

		myChartESM = new Chart(ctxESM, {
			type: 'line',
			data: {
				// labels: LABEL_X,
				datasets: datasetsESM
			},
			options: complexChartOption
		});
	};


	//////////////////////////////////////////////////////////////////
	/** 
	 * @func window.renewEnergy
	 * @desc データをもらって画面更新
	 * @param {void}
	 * @return {void}
	 */
	window.renewEnergy = function (_envDataArray) {
		// console.log( 'window.renewEnergy() _envDataArray', _envDataArray );
		let envDataArray = JSON.parse(_envDataArray);

		if (inUserAmpere.value != '') {  // 契約アンペアの指定があればアノテーションする
			complexChartOption.plugins.annotation.annotations.line1.yMin = parseInt(inUserAmpere.value);
			complexChartOption.plugins.annotation.annotations.line1.yMax = parseInt(inUserAmpere.value);
			complexChartOption.scales["y-axis-right"].suggestedMax = parseInt(inUserAmpere.value) + 10;
		}

		// 現在時刻で Breaker のラベル位置を変更
		let datetime = new Date();
		if (datetime.getHours() > 12) {
			complexChartOption.plugins.annotation.annotations.line1.label.position = 'start';
		} else {
			complexChartOption.plugins.annotation.annotations.line1.label.position = 'end';
		}

		datasetsESM = [];

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
				// 定時は表示しない
				// ocommulativeAmountsFixedTimeNormalPower.push( { x:moment(d.time), y:d.commulativeAmountsFixedTimeNormalPower} );
				// ocommulativeAmountsFixedTimeRiversePower.push( { x:moment(d.time), y:d.commulativeAmountsFixedTimeRiversePower} );
			}

			datasetsESM.push(
				{
					label: '瞬時電力 [W]', type: 'bar', data: oinstantaneousPower, borderColor: "rgba(110,110,110, 1.0)", backgroundColor: "rgba(110, 110, 110, 0.9)",
					radius: 1.5, borderWidth: 1, yAxisID: 'y-axis-left-w', borderDash: [2, 1]
				},
				{
					label: '瞬時電流R [A]', type: 'line', data: oinstantaneousCurrentsR, borderColor: "rgba(255,70,70,1.0)", backgroundColor: "rgba(255,70,70,1.0)",
					radius: 1.5, borderWidth: 1, yAxisID: 'y-axis-right', borderDash: [2, 1]
				},
				{
					label: '瞬時電流T [A]', type: 'bar', data: oinstantaneousCurrentsT, borderColor: "rgba(255,196,137,1.0)", backgroundColor: "rgba(255, 196, 137, 1.0)",
					radius: 1.5, borderWidth: 1, yAxisID: 'y-axis-right', borderDash: [2, 1]
				},
				{
					label: '積算電力量正方向 [kWh]', type: 'line', data: ocommulativeAmountNormal, borderColor: "rgba(70,70,178,1.0)", backgroundColor: "rgba(70,70,255,1.0)",
					radius: 1.5, borderWidth: 1, yAxisID: 'y-axis-left-kwh', borderDash: [2, 1]
				},
				{
					label: '積算電力量逆方向 [kWh]', type: 'line', data: ocommulativeAmountReverse, borderColor: "rgba(178,178,255,1.0)", backgroundColor: "rgba(178,178,255,1.0)",
					radius: 1.5, borderWidth: 1, yAxisID: 'y-axis-left-kwh', borderDash: [2, 1]
				}
				// 定時は表示しない
				// { label: '定時積算電力量計測値正方向 [kWh]',    type: 'line', data: ocommulativeAmountsFixedTimeNormalPower, borderColor: "rgba(178,255,178,1.0)", backgroundColor: "rgba(178,255,178,1.0)",
				// radius:1.5, borderWidth:1, yAxisID: 'y-axis-left', borderDash: [2,1] },
				// { label: '定時積算電力量計測値逆方向 [kWh]',    type: 'line', data: ocommulativeAmountsFixedTimeRiversePower, borderColor: "rgba(178,255,178,1.0)", backgroundColor: "rgba(178,255,178,1.0)",
				// radius:1.5, borderWidth:1,  yAxisID: 'y-axis-left', borderDash: [2,1] }
			);

			renewCanvasESM();
		}
	};
});
