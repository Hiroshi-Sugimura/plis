//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2026.06.22
//	Fitbit関係の処理
//////////////////////////////////////////////////////////////////////
'use strict';

/**
 * @namespace subFitbit
 */
window.addEventListener('DOMContentLoaded', function () {
	console.log('## DOMContentLoaded subFitbit.js');

	const inFitbitUse = document.getElementById('inFitbitUse');
	const inFitbitClientId = document.getElementById('inFitbitClientId');
	const inFitbitClientSecret = document.getElementById('inFitbitClientSecret');
	const inFitbitRedirectPort = document.getElementById('inFitbitRedirectPort');
	const spanFitbitStatusText = document.getElementById('spanFitbitStatusText');
	const divFitbitProfile = document.getElementById('divFitbitProfile');
	const spanFitbitUser = document.getElementById('spanFitbitUser');
	const imgFitbitAvatar = document.getElementById('imgFitbitAvatar');
	const btnFitbitSync = document.getElementById('btnFitbitSync');

	const divFitbit = document.getElementById('divFitbit');
	const divFitbitSuggest = document.getElementById('divFitbitSuggest');
	const H2Fitbit = document.getElementById('H2Fitbit');

	// グラフインスタンスの保持
	window.fitbitSleepChartInstance = null;
	window.fitbitHeartChartInstance = null;
	window.fitbitActivityChartInstance = null;
	window.fitbitWeightChartInstance = null;

	//----------------------------------------------------------------------------------------------
	// UIイベントハンドラー

	/**
	 * @func window.btnFitbitConfigSave_Click
	 * @desc Fitbit設定の保存
	 */
	window.btnFitbitConfigSave_Click = function () {
		const config = {
			isEnabled: inFitbitUse.checked,
			clientId: inFitbitClientId.value,
			clientSecret: inFitbitClientSecret.value,
			redirectPort: parseInt(inFitbitRedirectPort.value) || 5000
		};
		window.ipc.FitbitSetConfig(config);
		alert('Fitbit設定を保存しました。');
	};

	/**
	 * @func window.btnFitbitAuth_Click
	 * @desc Fitbit連携認証プロセスの開始
	 */
	window.btnFitbitAuth_Click = function () {
		const config = {
			isEnabled: inFitbitUse.checked,
			clientId: inFitbitClientId.value,
			clientSecret: inFitbitClientSecret.value,
			redirectPort: parseInt(inFitbitRedirectPort.value) || 5000
		};
		// 認証前に設定を保存
		window.ipc.FitbitSetConfig(config);
		window.ipc.FitbitStartAuth();
	};

	/**
	 * @func window.btnFitbitSync_Click
	 * @desc Fitbitとの手動同期要求
	 */
	window.btnFitbitSync_Click = function () {
		window.ipc.FitbitSync();
		alert('Fitbitとの手動同期を開始しました。');
	};

	/**
	 * @func window.renewFitbitConfigView
	 * @desc 設定状態をUIに反映
	 * @param {Object} config - Fitbit設定オブジェクト
	 */
	window.renewFitbitConfigView = function (config) {
		inFitbitUse.checked = config.isEnabled;
		inFitbitClientId.value = config.clientId || '';
		inFitbitClientSecret.value = config.clientSecret || '';
		inFitbitRedirectPort.value = config.redirectPort || 5000;

		if (config.accessToken) {
			spanFitbitStatusText.innerText = '連携済み';
			spanFitbitStatusText.style.color = 'green';
			btnFitbitSync.classList.remove('none');
		} else {
			spanFitbitStatusText.innerText = '未連携';
			spanFitbitStatusText.style.color = 'gray';
			btnFitbitSync.classList.add('none');
		}

		if (config.isEnabled) {
			H2Fitbit.classList.remove('none');
			if (config.accessToken) {
				divFitbit.classList.remove('none');
				divFitbitSuggest.classList.add('none');
			} else {
				divFitbit.classList.add('none');
				divFitbitSuggest.classList.remove('none');
			}
		} else {
			H2Fitbit.classList.add('none');
			divFitbit.classList.add('none');
			divFitbitSuggest.classList.add('none');
		}
	};

	/**
	 * @func window.fitbitAuthStatus
	 * @desc 認証フロー結果の受取と表示
	 */
	window.fitbitAuthStatus = function (arg) {
		if (arg.status === 'success') {
			alert('Fitbitと正常に連携できました！データを自動同期しています。');
		} else {
			alert('Fitbitとの連携に失敗しました: ' + arg.message);
		}
	};

	/**
	 * @func window.showFitbitData
	 * @desc 取得されたFitbitデータの描画
	 * @param {Object} data - Fitbit健康データセット
	 */
	window.showFitbitData = function (data) {
		console.log('showFitbitData called:', data);
		if (!data) return;

		// 1. プロフィール表示
		if (data.profile) {
			divFitbitProfile.classList.remove('none');
			spanFitbitUser.innerText = `${data.profile.displayName} (${data.profile.fullName || ''})`;
			if (data.profile.avatar) {
				imgFitbitAvatar.src = data.profile.avatar;
				imgFitbitAvatar.classList.remove('none');
			} else {
				imgFitbitAvatar.classList.add('none');
			}
		} else {
			divFitbitProfile.classList.add('none');
		}

		// 2. 各グラフのレンダリング
		drawSleepChart(data.sleeps);
		drawHeartRateChart(data.heartrates);
		drawActivityChart(data.dailies);
		drawWeightChart(data.weights);
	};

	//----------------------------------------------------------------------------------------------
	// グラフ描画用内部関数

	function drawSleepChart(sleeps) {
		const canvas = document.getElementById('fitbitSleepChart');
		if (!canvas) return;
		const ctx = canvas.getContext('2d');

		if (window.fitbitSleepChartInstance) {
			window.fitbitSleepChartInstance.destroy();
		}

		if (!sleeps || sleeps.length === 0) {
			document.getElementById('fitbitTotalSleep').innerText = '--';
			document.getElementById('fitbitDeepSleep').innerText = '--';
			document.getElementById('fitbitLightSleep').innerText = '--';
			document.getElementById('fitbitRemSleep').innerText = '--';
			document.getElementById('fitbitAwakeTime').innerText = '--';
			document.getElementById('fitbitSleepEfficiency').innerText = '--';
			return;
		}

		const latestSleep = sleeps[sleeps.length - 1];

		document.getElementById('fitbitTotalSleep').innerText = `${(latestSleep.duration / 3600000).toFixed(1)} 時間`;
		document.getElementById('fitbitDeepSleep').innerText = `${latestSleep.deepMinutes || 0} 分`;
		document.getElementById('fitbitLightSleep').innerText = `${latestSleep.lightMinutes || 0} 分`;
		document.getElementById('fitbitRemSleep').innerText = `${latestSleep.remMinutes || 0} 分`;
		document.getElementById('fitbitAwakeTime').innerText = `${latestSleep.wakeMinutes || 0} 分`;
		document.getElementById('fitbitSleepEfficiency').innerText = `${latestSleep.efficiency || 0} %`;

		window.fitbitSleepChartInstance = new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: ['深い睡眠', '浅い睡眠', 'レム睡眠', '覚醒時間'],
				datasets: [{
					data: [
						latestSleep.deepMinutes || 0,
						latestSleep.lightMinutes || 0,
						latestSleep.remMinutes || 0,
						latestSleep.wakeMinutes || 0
					],
					backgroundColor: [
						'rgba(26, 82, 118, 0.8)',
						'rgba(52, 152, 219, 0.8)',
						'rgba(155, 89, 182, 0.8)',
						'rgba(231, 76, 60, 0.8)'
					],
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: `睡眠分析 (${latestSleep.dateOfSleep})`
					},
					legend: {
						position: 'bottom'
					}
				}
			}
		});
	}

	function drawHeartRateChart(heartrates) {
		const canvas = document.getElementById('fitbitHeartChart');
		if (!canvas) return;
		const ctx = canvas.getContext('2d');

		if (window.fitbitHeartChartInstance) {
			window.fitbitHeartChartInstance.destroy();
		}

		if (!heartrates || heartrates.length === 0) {
			document.getElementById('fitbitRestingHR').innerText = '--';
			document.getElementById('fitbitFatBurnTime').innerText = '--';
			document.getElementById('fitbitCardioTime').innerText = '--';
			document.getElementById('fitbitPeakTime').innerText = '--';
			return;
		}

		const latestHR = heartrates[heartrates.length - 1];

		document.getElementById('fitbitRestingHR').innerText = `${latestHR.restingHeartRate || 0} bpm`;
		document.getElementById('fitbitFatBurnTime').innerText = `${latestHR.fatBurnMinutes || 0} 分`;
		document.getElementById('fitbitCardioTime').innerText = `${latestHR.cardioMinutes || 0} 分`;
		document.getElementById('fitbitPeakTime').innerText = `${latestHR.peakMinutes || 0} 分`;

		window.fitbitHeartChartInstance = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: ['脂肪燃焼', '有酸素', 'ピーク'],
				datasets: [{
					label: '滞在時間 (分)',
					data: [
						latestHR.fatBurnMinutes || 0,
						latestHR.cardioMinutes || 0,
						latestHR.peakMinutes || 0
					],
					backgroundColor: [
						'rgba(241, 196, 15, 0.8)',
						'rgba(230, 126, 34, 0.8)',
						'rgba(211, 47, 47, 0.8)'
					],
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: `心拍ゾーン時間 (${latestHR.calendarDate})`
					},
					legend: {
						display: false
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: '分'
						}
					}
				}
			}
		});
	}

	function drawActivityChart(dailies) {
		const canvas = document.getElementById('fitbitActivityChart');
		if (!canvas) return;
		const ctx = canvas.getContext('2d');

		if (window.fitbitActivityChartInstance) {
			window.fitbitActivityChartInstance.destroy();
		}

		if (!dailies || dailies.length === 0) {
			document.getElementById('fitbitSteps').innerText = '--';
			document.getElementById('fitbitDistance').innerText = '--';
			document.getElementById('fitbitCalories').innerText = '--';
			return;
		}

		const last7Dailies = dailies.slice(-7);
		const labels = last7Dailies.map(d => d.calendarDate.slice(5)); // MM-DD
		const steps = last7Dailies.map(d => d.steps);

		const todayData = last7Dailies[last7Dailies.length - 1];
		document.getElementById('fitbitSteps').innerText = `${todayData.steps.toLocaleString()} 歩`;
		document.getElementById('fitbitDistance').innerText = `${todayData.distance.toFixed(2)} km`;
		document.getElementById('fitbitCalories').innerText = `${todayData.caloriesOut.toLocaleString()} kcal`;

		window.fitbitActivityChartInstance = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: labels,
				datasets: [{
					label: '歩数',
					data: steps,
					backgroundColor: 'rgba(0, 176, 185, 0.6)',
					borderColor: 'rgba(0, 176, 185, 1)',
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: '直近7日間の歩数推移'
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: '歩数'
						}
					}
				}
			}
		});
	}

	function drawWeightChart(weights) {
		const canvas = document.getElementById('fitbitWeightChart');
		if (!canvas) return;
		const ctx = canvas.getContext('2d');

		if (window.fitbitWeightChartInstance) {
			window.fitbitWeightChartInstance.destroy();
		}

		if (!weights || weights.length === 0) {
			document.getElementById('fitbitLatestWeight').innerText = '--';
			document.getElementById('fitbitLatestBMI').innerText = '--';
			document.getElementById('fitbitLatestFat').innerText = '--';
			return;
		}

		const last7Weights = weights.slice(-7);
		const labels = last7Weights.map(w => w.calendarDate.slice(5)); // MM-DD
		const weightsData = last7Weights.map(w => w.weight);
		const bmiData = last7Weights.map(w => w.bmi);

		const latest = last7Weights[last7Weights.length - 1];
		document.getElementById('fitbitLatestWeight').innerText = latest.weight ? latest.weight.toFixed(1) : '--';
		document.getElementById('fitbitLatestBMI').innerText = latest.bmi ? latest.bmi.toFixed(1) : '--';
		document.getElementById('fitbitLatestFat').innerText = latest.fat ? latest.fat.toFixed(1) : '--';

		window.fitbitWeightChartInstance = new Chart(ctx, {
			type: 'line',
			data: {
				labels: labels,
				datasets: [
					{
						label: '体重 (kg)',
						data: weightsData,
						borderColor: 'rgba(46, 204, 113, 1)',
						backgroundColor: 'rgba(46, 204, 113, 0.2)',
						yAxisID: 'yWeight',
						tension: 0.3
					},
					{
						label: 'BMI',
						data: bmiData,
						borderColor: 'rgba(155, 89, 182, 1)',
						backgroundColor: 'rgba(155, 89, 182, 0.2)',
						yAxisID: 'yBMI',
						tension: 0.3
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: '直近の体重・BMI推移'
					}
				},
				scales: {
					yWeight: {
						type: 'linear',
						position: 'left',
						title: {
							display: true,
							text: '体重 (kg)'
						}
					},
					yBMI: {
						type: 'linear',
						position: 'right',
						title: {
							display: true,
							text: 'BMI'
						},
						grid: {
							drawOnChartArea: false
						}
					}
				}
			}
		});
	}

	// 起動時に1回設定データをリクエスト
	setTimeout(() => {
		if (window.ipc && typeof window.ipc.FitbitGetConfig === 'function') {
			window.ipc.FitbitGetConfig();
		}
	}, 1000);
});
