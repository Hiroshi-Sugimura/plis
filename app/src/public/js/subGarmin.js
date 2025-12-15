//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2023.10.08
//	Garmin関係の処理
//////////////////////////////////////////////////////////////////////
'use strict'


////////////////////////////////////////////////////////////////////////////////
// HTMLロードしたら準備
/**
 * @namespace subGarmin
 */
window.addEventListener('DOMContentLoaded', function () {
	console.log('## DOMContentLoaded subGarmin.js');

	//----------------------------------------------------------------------------------------------
	// デバイス情報のrenew
	let stateGarmin;  // Garminデータの状態を保持

	// divGarmin要素の取得とエラーハンドリング
	let divGarmin = document.getElementById('divGarmin');
	if (!divGarmin) {
		console.error('divGarmin element not found! Creating fallback element...');
		// フォールバック要素を作成
		divGarmin = document.createElement('div');
		divGarmin.id = 'divGarmin';
		divGarmin.className = 'garmin-container';

		// ウェアブルタブ内に追加
		const wearableTab = document.getElementById('divWearable_tab');
		if (wearableTab) {
			wearableTab.appendChild(divGarmin);
		} else {
			// ウェアラブルタブも見つからない場合はbody直下に追加
			document.body.appendChild(divGarmin);
		}
	}

	//----------------------------------------------------------------------------------------------
	// 各種データをHTML化する関数群（事前に定義）

	/**
	 * @func getActivitiesHtml
	 * @desc Activitiesデータをテーブルで表示
	 * @param {Object} data - Activitiesデータ
	 * @return {string} HTML文字列
	 */
	const getActivitiesHtml = function (data) {
		let doc = '<h3>Activities</h3>';
		if (data) {
			doc += `<div class="p"><table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>
            <tr><td>startTimeInSeconds</td><td>${data.startTimeInSeconds || 'N/A'}</td></tr>
            <tr><td>startTimeOffsetInSeconds</td><td>${data.startTimeOffsetInSeconds || 'N/A'}</td></tr>
            <tr><td>activityType</td><td>${data.activityType || 'N/A'}</td></tr>
            <tr><td>averageHeartRateInBeatsPerMinute</td><td>${data.averageHeartRateInBeatsPerMinute || 'N/A'}</td></tr>
            <tr><td>steps</td><td>${data.steps || 'N/A'}</td></tr>
            <tr><td>distanceInMeters</td><td>${data.distanceInMeters || 'N/A'}</td></tr>
            </tbody></table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	/**
	 * @func getActivityDetailsHtml
	 * @desc ActivityDetailsデータをテーブルで表示
	 */
	const getActivityDetailsHtml = function (data) {
		let doc = '<h3>Activity Details</h3>';
		if (data) {
			doc += `<div class="p"><table>
            <tr><td>summary</td><td>${data.summary || 'N/A'}</td></tr>
            <tr><td>samples</td><td>${data.samples || 'N/A'}</td></tr>
            <tr><td>laps</td><td>${data.laps || 'N/A'}</td></tr>
            </table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	/**
	 * @func getBodyCompsHtml
	 * @desc BodyCompsデータをテーブルで表示
	 */
	const getBodyCompsHtml = function (data) {
		let doc = '<h3>Body Comps</h3>';
		if (data) {
			doc += `<div class="p"><table>
            <tr><td>weightInGrams</td><td>${data.weightInGrams || 'N/A'}</td></tr>
            <tr><td>bodyFatInPercent</td><td>${data.bodyFatInPercent || 'N/A'}</td></tr>
            <tr><td>bodyMassIndex</td><td>${data.bodyMassIndex || 'N/A'}</td></tr>
            </table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	/**
	 * @func getDailiesHtml
	 * @desc Dailiesデータをテーブルで表示
	 */
	const getDailiesHtml = function (data) {
		let doc = '<h3>Dailies</h3>';
		if (data) {
			doc += `<div class="p"><table>
            <tr><td>calendarDate</td><td>${data.calendarDate || 'N/A'}</td></tr>
            <tr><td>steps</td><td>${data.steps || 'N/A'}</td></tr>
            <tr><td>distanceInMeters</td><td>${data.distanceInMeters || 'N/A'}</td></tr>
            <tr><td>activeKilocalories</td><td>${data.activeKilocalories || 'N/A'}</td></tr>
            <tr><td>averageHeartRateInBeatsPerMinute</td><td>${data.averageHeartRateInBeatsPerMinute || 'N/A'}</td></tr>
            <tr><td>maxHeartRateInBeatsPerMinute</td><td>${data.maxHeartRateInBeatsPerMinute || 'N/A'}</td></tr>
            <tr><td>restingHeartRateInBeatsPerMinute</td><td>${data.restingHeartRateInBeatsPerMinute || 'N/A'}</td></tr>
            <tr><td>averageStressLevel</td><td>${data.averageStressLevel || 'N/A'}</td></tr>
            </table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	/**
	 * @func getEpochsHtml
	 * @desc Epochsデータをテーブルで表示
	 */
	const getEpochsHtml = function (data) {
		let doc = '<h3>Epochs</h3>';
		if (data) {
			doc += `<div class="p"><table>
            <tr><td>startTimeInSeconds</td><td>${data.startTimeInSeconds || 'N/A'}</td></tr>
            <tr><td>durationInSeconds</td><td>${data.durationInSeconds || 'N/A'}</td></tr>
            <tr><td>steps</td><td>${data.steps || 'N/A'}</td></tr>
            </table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	/**
	 * @func getMoveIQActivitiesHtml
	 * @desc MoveIQActivitiesデータをテーブルで表示
	 */
	const getMoveIQActivitiesHtml = function (data) {
		let doc = '<h3>MoveIQActivities</h3>';
		if (data) {
			doc += `<div class="p"><table>
            <tr><td>calendarDate</td><td>${data.calendarDate || 'N/A'}</td></tr>
            <tr><td>activityType</td><td>${data.activityType || 'N/A'}</td></tr>
            <tr><td>durationInSeconds</td><td>${data.durationInSeconds || 'N/A'}</td></tr>
            </table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	/**
	 * @func getPulseoxHtml
	 * @desc Pulseoxデータをテーブルで表示
	 */
	const getPulseoxHtml = function (data) {
		let doc = '<h3>Pulseox</h3>';
		if (data) {
			doc += `<div class="p"><table>
            <tr><td>calendarDate</td><td>${data.calendarDate || 'N/A'}</td></tr>
            <tr><td>onDemand</td><td>${data.onDemand || 'N/A'}</td></tr>
            </table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	/**
	 * @func getSleepsHtml
	 * @desc Sleepsデータをテーブルで表示
	 */
	const getSleepsHtml = function (data) {
		let doc = '<h3>Sleeps</h3>';
		// 配列チェックを削除し、オブジェクトとして処理
		if (data && typeof data === 'object' && !Array.isArray(data)) {
			doc += `<div class="p"><table>
            <tr><td>calendarDate</td><td>${data.calendarDate || 'N/A'}</td></tr>
            <tr><td>durationInSeconds</td><td>${data.durationInSeconds || 'N/A'}</td></tr>
            <tr><td>deepSleepDurationInSeconds</td><td>${data.deepSleepDurationInSeconds || 'N/A'}</td></tr>
            <tr><td>lightSleepDurationInSeconds</td><td>${data.lightSleepDurationInSeconds || 'N/A'}</td></tr>
            <tr><td>remSleepInSeconds</td><td>${data.remSleepInSeconds || 'N/A'}</td></tr>
            <tr><td>awakeDurationInSeconds</td><td>${data.awakeDurationInSeconds || 'N/A'}</td></tr>
            </table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	/**
	 * @func getStressDetailsHtml
	 * @desc StressDetailsデータをテーブルで表示
	 */
	const getStressDetailsHtml = function (data) {
		let doc = '<h3>StressDetails</h3>';
		if (data) {
			doc += `<div class="p"><table>`;
			for (const key in data) {
				doc += `<tr><td>${key}</td><td>${data[key]}</td></tr>`;
			}
			doc += `</table></div>`;
		} else {
			doc += `<div class='p'>No data</div>`;
		}
		return doc;
	};

	/**
	 * @func getUserMetricsHtml
	 * @desc UserMetricsデータをテーブルで表示
	 */
	const getUserMetricsHtml = function (data) {
		let doc = '<h3>UserMetrics</h3>';
		if (data) {
			doc += `<div class="p"><table>
            <tr><td>calendarDate</td><td>${data.calendarDate || 'N/A'}</td></tr>
            <tr><td>vo2Max</td><td>${data.vo2Max || 'N/A'}</td></tr>
            <tr><td>fitnessAge</td><td>${data.fitnessAge || 'N/A'}</td></tr>
            </table></div>`
		} else {
			doc += `<div class='p'>No data</div>`
		}
		return doc;
	};

	//----------------------------------------------------------------------------------------------
	// メイン表示関数

	/**
	 * @func window.showGarminData
	 * @desc mainからの情報でGarmin関係のhtmlを変更する
	 * @param {Object} arg - Garminデータ
	 * @return {void}
	 */
	window.showGarminData = function (arg) {
		console.log('=== showGarminData called ===');
		console.log('Received arg:', arg);
		console.log('Available keys:', Object.keys(arg || {}));

		if (arg) {
			localStorage.setItem('garminDataDebug', JSON.stringify(arg));
			console.log('✓ Data saved to localStorage');
		}

		// 【追加】Wearableタブがアクティブかチェック
		const wearableTab = document.getElementById('wearable');
		if (!wearableTab || !wearableTab.checked) {
			console.log('ℹ️ Wearable tab not active, saving data for later');
			localStorage.setItem('garminDataPending', JSON.stringify(arg));
			return;
		}

		stateGarmin = arg; // データを保持
		if (!arg) {
			divGarmin.innerHTML = `<div class="p">No data.<br>クラウドサービスHALと連携してください。</div>`;
			return;
		}



		// Chart.jsの利用可能性チェック
		if (typeof Chart === 'undefined') {
			console.error('❌ Chart.js not loaded. Check script path.');
			return;
		}

		console.log('✅ Chart.js is available:', Chart.version);

		// Canvas要素の存在確認
		const canvasIds = ['sleepChart', 'stressChart', 'heartRateChart', 'activityChart', 'pulseoxChart', 'userMetricsChart', 'moveIQChart'];
		const foundCanvas = canvasIds.filter(id => document.getElementById(id));
		console.log('✅ Found canvas elements:', foundCanvas);

		if (foundCanvas.length === 0) {
			console.log('❌ No canvas elements found, retrying in 500ms...');
			setTimeout(() => window.showGarminData(arg), 500);
			return;
		}

		// ==== ボディバッテリーデータチェック ====
		checkBodyBatteryData(arg);

		// ==== グラフ作成（少し遅延させる） ====
		setTimeout(() => {
			console.log('📊 Creating charts...');
			createSleepChart(arg.Sleeps);
			createStressChart(arg.StressDetails);
			createHeartRateChart(arg.Dailies);
			createActivityChart(arg.Activities);
			createPulseoxChart(arg.Pulseox);
			createUserMetricsChart(arg.UserMetrics);
			createMoveIQChart(arg.MoveIQActivities);
		}, 100);

    // ★★★ 追加: 新しいアバターコントローラーに全データを渡す ★★★
        if (window.avatarController) {
            window.avatarController.handleGarminData(arg);
        }


    };

	// === グラフ作成関数群 ===

	function createSleepChart(sleepData) {
		const canvas = document.getElementById('sleepChart');
		if (!canvas) {
			return;
		}

		const ctx = canvas.getContext('2d');

		// 既存のグラフがあれば破棄
		if (window.sleepChartInstance) {
			window.sleepChartInstance.destroy();
		}

		if (sleepData && sleepData.deepSleepDurationInSeconds) {
			const deepSleep = Math.round((sleepData.deepSleepDurationInSeconds || 0) / 60);
			const lightSleep = Math.round((sleepData.lightSleepDurationInSeconds || 0) / 60);
			const remSleep = Math.round((sleepData.remSleepInSeconds || 0) / 60);

			window.sleepChartInstance = new Chart(ctx, {
				type: 'doughnut',
				data: {
					labels: ['深い睡眠', '浅い睡眠', 'REM睡眠'],
					datasets: [{
						data: [deepSleep, lightSleep, remSleep],
						backgroundColor: [
							'rgba(54, 162, 235, 0.8)',
							'rgba(255, 206, 86, 0.8)',
							'rgba(75, 192, 192, 0.8)'
						],
						borderWidth: 2
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						title: {
							display: true,
							text: `睡眠分析 (${sleepData.calendarDate || '日付不明'})`
						},
						legend: {
							position: 'bottom'
						}
					}
				}
			});

			// 睡眠情報の更新
			updateSleepInfo(sleepData, deepSleep + lightSleep + remSleep);
		} else {
			// データなしの場合
			createNoDataChart(ctx, '睡眠データがありません');
		}
	}

	function createStressChart(stressDetails) {
		const canvas = document.getElementById('stressChart');
		if (!canvas) {
			return;
		}

		const ctx = canvas.getContext('2d');

		// 既存のグラフがあれば破棄
		if (window.stressChartInstance) {
			window.stressChartInstance.destroy();
		}

		if (stressDetails) {
			let stressValues = null;
			let bodyBatteryValues = null;

			// ストレスデータの解析
			if (stressDetails.timeOffsetStressLevelValues) {
				if (typeof stressDetails.timeOffsetStressLevelValues === 'string') {
					try {
						stressValues = JSON.parse(stressDetails.timeOffsetStressLevelValues);
					} catch (e) {
						// パースエラー
					}
				} else if (typeof stressDetails.timeOffsetStressLevelValues === 'object') {
					stressValues = stressDetails.timeOffsetStressLevelValues;
				}
			}

			// ボディバッテリーデータの解析
			if (stressDetails.timeOffsetBodyBatteryValues) {
				if (typeof stressDetails.timeOffsetBodyBatteryValues === 'string') {
					try {
						bodyBatteryValues = JSON.parse(stressDetails.timeOffsetBodyBatteryValues);
					} catch (e) {
						// パースエラー
					}
				} else if (typeof stressDetails.timeOffsetBodyBatteryValues === 'object') {
					bodyBatteryValues = stressDetails.timeOffsetBodyBatteryValues;
				}
			}

			if (stressValues || bodyBatteryValues) {
				// 0時〜24時の1日分のデータ配列を準備（15分間隔 = 96個）
				const hoursInDay = 24;
				const intervalsPerHour = 4; // 15分間隔
				const totalIntervals = hoursInDay * intervalsPerHour;

				const stressData = new Array(totalIntervals).fill(null);
				const bodyBatteryData = new Array(totalIntervals).fill(null);
				const timeLabels = [];

				// ラベル作成（0:00, 0:15, 0:30, ..., 23:45）
				for (let i = 0; i < totalIntervals; i++) {
					const totalMinutes = i * 15;
					const hours = Math.floor(totalMinutes / 60);
					const minutes = totalMinutes % 60;
					timeLabels.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
				}

				// ストレスデータを配列にマッピング
				if (stressValues) {
					Object.keys(stressValues).forEach(timeOffset => {
						const value = stressValues[timeOffset];
						if (value >= 0) { // -1, -2は無効値
							const offsetSeconds = parseInt(timeOffset);
							const intervalIndex = Math.floor(offsetSeconds / 900); // 900秒 = 15分

							if (intervalIndex >= 0 && intervalIndex < totalIntervals) {
								stressData[intervalIndex] = value;
							}
						}
					});
				}

				// ボディバッテリーデータを配列にマッピング
				if (bodyBatteryValues) {
					Object.keys(bodyBatteryValues).forEach(timeOffset => {
						const value = bodyBatteryValues[timeOffset];
						if (value > 0 && value <= 100) { // 有効なボディバッテリー範囲
							const offsetSeconds = parseInt(timeOffset);
							const intervalIndex = Math.floor(offsetSeconds / 900); // 900秒 = 15分

							if (intervalIndex >= 0 && intervalIndex < totalIntervals) {
								bodyBatteryData[intervalIndex] = Number(value);
							}
						}
					});
				}

				// 有効なデータ点の数をカウント
				const validStressCount = stressData.filter(v => v !== null).length;
				const validBodyBatteryCount = bodyBatteryData.filter(v => v !== null).length;

				if (validStressCount > 0 || validBodyBatteryCount > 0) {
					// データセット配列の準備
					const datasets = [];

					// ストレスデータセット（左Y軸）
					if (validStressCount > 0) {
						datasets.push({
							label: 'ストレスレベル',
							data: stressData,
							borderColor: 'rgba(255, 99, 132, 1)',
							backgroundColor: 'rgba(255, 99, 132, 0.1)',
							tension: 0.3,
							pointRadius: 2,
							pointHoverRadius: 4,
							spanGaps: true,
							yAxisID: 'y',
							fill: false
						});
					}

					// ボディバッテリーデータセット（右Y軸）
					if (validBodyBatteryCount > 0) {
						datasets.push({
							label: 'ボディバッテリー',
							data: bodyBatteryData,
							borderColor: 'rgba(76, 175, 80, 1)',
							backgroundColor: 'rgba(76, 175, 80, 0.1)',
							tension: 0.3,
							pointRadius: 2,
							pointHoverRadius: 4,
							spanGaps: true,
							yAxisID: 'y1',
							fill: false
						});
					}

					window.stressChartInstance = new Chart(ctx, {
						type: 'line',
						data: {
							labels: timeLabels,
							datasets: datasets
						},
						options: {
							responsive: true,
							maintainAspectRatio: false,
							interaction: {
								intersect: false,
								mode: 'index'
							},
							scales: {
								y: {
									type: 'linear',
									display: validStressCount > 0,
									position: 'left',
									title: {
										display: validStressCount > 0,
										text: 'ストレスレベル',
										color: 'rgba(255, 99, 132, 1)'
									},
									beginAtZero: true,
									max: 100,
									ticks: {
										color: 'rgba(255, 99, 132, 0.8)'
									},
									grid: {
										color: 'rgba(255, 99, 132, 0.1)'
									}
								},
								y1: {
									type: 'linear',
									display: validBodyBatteryCount > 0,
									position: 'right',
									title: {
										display: validBodyBatteryCount > 0,
										text: 'ボディバッテリー (%)',
										color: 'rgba(76, 175, 80, 1)'
									},
									beginAtZero: true,
									max: 100,
									ticks: {
										color: 'rgba(76, 175, 80, 0.8)',
										callback: function (value) {
											return value + '%';
										}
									},
									grid: {
										drawOnChartArea: false,
										color: 'rgba(76, 175, 80, 0.1)'
									}
								},
								x: {
									title: { display: true, text: '時刻' },
									ticks: {
										maxTicksLimit: 12,
										callback: function (value, index) {
											if (index % 8 === 0) {
												return this.getLabelForValue(value);
											}
											return '';
										}
									}
								}
							},
							plugins: {
								title: {
									display: true,
									text: `ストレス & ボディバッテリー推移 (${stressDetails.calendarDate || '日付不明'})`
								},
								subtitle: {
									display: true,
									text: `ストレス: ${validStressCount}データ点 | ボディバッテリー: ${validBodyBatteryCount}データ点`
								},
								legend: {
									display: true,
									position: 'top',
									labels: {
										usePointStyle: true,
										pointStyle: 'line'
									}
								},
								tooltip: {
									callbacks: {
										label: function (context) {
											if (context.parsed.y === null) {
												return 'データなし';
											}

											if (context.datasetIndex === 0) {
												return `ストレスレベル: ${context.parsed.y}`;
											} else {
												const value = context.parsed.y;
												let status = '';
												if (value >= 70) status = ' (高レベル)';
												else if (value >= 30) status = ' (中レベル)';
												else status = ' (低レベル)';
												return `ボディバッテリー: ${value}%${status}`;
											}
										}
									},
									filter: function (tooltipItem) {
										return tooltipItem.parsed.y !== null;
									}
								}
							}
						}
					});

					// 統計情報の更新
					updateStressAndBodyBatteryInfo(stressData, bodyBatteryData);
				} else {
					createNoDataChart(ctx, '有効なストレス・ボディバッテリーデータがありません');
				}
			} else {
				createNoDataChart(ctx, 'ストレス・ボディバッテリーデータの解析に失敗しました');
			}
		} else {
			createNoDataChart(ctx, 'ストレス・ボディバッテリーデータがありません');
		}
	}

	function createActivityChart(activities) {
		const canvas = document.getElementById('activityChart');
		if (!canvas) {
			return;
		}

		const ctx = canvas.getContext('2d');

		// 既存のグラフがあれば破棄
		if (window.activityChartInstance) {
			window.activityChartInstance.destroy();
		}

		// 【修正】Activitiesが単一オブジェクトの場合の処理
		if (activities && typeof activities === 'object') {
			// 今日のデータを取得
			const steps = activities.steps || 0;
			const distanceInMeters = activities.distanceInMeters || 0;
			const distance = distanceInMeters / 1000; // メートルからkmに変換
			const calories = activities.activeKilocalories || 0;
			const durationInSeconds = activities.durationInSeconds || 0;
			const activeMinutes = Math.round(durationInSeconds / 60);

			// 簡易的に今日のデータのみでグラフを作成
			window.activityChartInstance = new Chart(ctx, {
				type: 'bar',
				data: {
					labels: ['今日'],
					datasets: [
						{
							label: '歩数 (steps)',
							data: [steps],
							backgroundColor: 'rgba(54, 162, 235, 0.7)',
							borderColor: 'rgba(54, 162, 235, 1)',
							borderWidth: 2,
							yAxisID: 'y'
						},
						{
							label: '距離 (km)',
							data: [distance],
							backgroundColor: 'rgba(255, 99, 132, 0.7)',
							borderColor: 'rgba(255, 99, 132, 1)',
							borderWidth: 2,
							yAxisID: 'y1',
							type: 'line',
							tension: 0.3
						},
						{
							label: '消費カロリー (kcal)',
							data: [calories],
							backgroundColor: 'rgba(75, 192, 192, 0.7)',
							borderColor: 'rgba(75, 192, 192, 1)',
							borderWidth: 2,
							yAxisID: 'y',
							type: 'line',
							tension: 0.3
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					interaction: {
						intersect: false,
						mode: 'index'
					},
					scales: {
						y: {
							type: 'linear',
							display: true,
							position: 'left',
							title: {
								display: true,
								text: '歩数 / カロリー',
								color: 'rgba(54, 162, 235, 1)'
							},
							beginAtZero: true,
							ticks: {
								color: 'rgba(54, 162, 235, 0.8)'
							},
							grid: {
								color: 'rgba(54, 162, 235, 0.1)'
							}
						},
						y1: {
							type: 'linear',
							display: true,
							position: 'right',
							title: {
								display: true,
								text: '距離 (km)',
								color: 'rgba(255, 99, 132, 1)'
							},
							beginAtZero: true,
							ticks: {
								color: 'rgba(255, 99, 132, 0.8)',
								callback: function (value) {
									return value.toFixed(1) + 'km';
								}
							},
							grid: {
								drawOnChartArea: false,
								color: 'rgba(255, 99, 132, 0.1)'
							}
						},
						x: {
							title: { display: true, text: '日付' }
						}
					},
					plugins: {
						title: {
							display: true,
							text: `アクティビティデータ (今日のみ)`
						},
						legend: {
							display: true,
							position: 'top'
						},
						tooltip: {
							callbacks: {
								label: function (context) {
									const datasetLabel = context.dataset.label;
									const value = context.parsed.y;

									if (datasetLabel.includes('歩数')) {
										return `${datasetLabel}: ${value.toLocaleString()} 歩`;
									} else if (datasetLabel.includes('距離')) {
										return `${datasetLabel}: ${value.toFixed(1)} km`;
									} else if (datasetLabel.includes('カロリー')) {
										return `${datasetLabel}: ${value} kcal`;
									}
									return `${datasetLabel}: ${value}`;
								}
							}
						}
					}
				}
			});

			// アクティビティ情報の更新
			updateActivityInfo({
				steps: steps,
				distance: distance,
				calories: calories,
				activeMinutes: activeMinutes
			});

		} else {
			// データなしの場合
			createNoDataChart(ctx, 'アクティビティデータがありません');

			// 情報表示もリセット
			updateActivityInfo({
				steps: 0,
				distance: 0,
				calories: 0,
				activeMinutes: 0
			});
		}
	}

	function createHeartRateChart(dailies) {
		const canvas = document.getElementById('heartRateChart');
		if (!canvas) {
			return;
		}

		const ctx = canvas.getContext('2d');

		// 既存のグラフがあれば破棄
		if (window.heartRateChartInstance) {
			window.heartRateChartInstance.destroy();
		}

		if (dailies && (dailies.averageHeartRateInBeatsPerMinute || dailies.restingHeartRateInBeatsPerMinute)) {
			const avgHR = dailies.averageHeartRateInBeatsPerMinute || 0;
			const restingHR = dailies.restingHeartRateInBeatsPerMinute || 0;
			const maxHR = dailies.maxHeartRateInBeatsPerMinute || 0;

			window.heartRateChartInstance = new Chart(ctx, {
				type: 'bar',
				data: {
					labels: ['安静時', '平均', '最大'],
					datasets: [{
						label: '心拍数 (bpm)',
						data: [restingHR, avgHR, maxHR],
						backgroundColor: [
							'rgba(75, 192, 192, 0.8)',
							'rgba(54, 162, 235, 0.8)',
							'rgba(255, 99, 132, 0.8)'
						],
						borderWidth: 2
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						title: {
							display: true,
							text: `心拍数データ (${dailies.calendarDate || '日付不明'})`
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							title: { display: true, text: '心拍数 (bpm)' }
						}
					}
				}
			});

			// 【追加】心拍数情報の更新
			const restingElement = document.getElementById('restingHeartRate');
			const avgElement = document.getElementById('avgHeartRate');
			const maxElement = document.getElementById('maxHeartRate');

			if (restingElement) restingElement.textContent = restingHR;
			if (avgElement) avgElement.textContent = avgHR;
			if (maxElement) maxElement.textContent = maxHR;

		} else {
			createNoDataChart(ctx, '心拍数データがありません');
		}
	}

	// === 新規追加: Pulseox（血中酸素濃度）グラフ ===
	function createPulseoxChart(pulseoxData) {
		const canvas = document.getElementById('pulseoxChart');
		if (!canvas) {
			return;
		}

		const ctx = canvas.getContext('2d');

		// 既存のグラフがあれば破棄
		if (window.pulseoxChartInstance) {
			window.pulseoxChartInstance.destroy();
		}

		if (pulseoxData && pulseoxData.timeOffsetSpo2Values) {
			let spo2Values = null;

			// データの解析
			if (typeof pulseoxData.timeOffsetSpo2Values === 'string') {
				try {
					spo2Values = JSON.parse(pulseoxData.timeOffsetSpo2Values);
				} catch (e) {
					// パースエラー
				}
			} else if (typeof pulseoxData.timeOffsetSpo2Values === 'object') {
				spo2Values = pulseoxData.timeOffsetSpo2Values;
			}

			if (spo2Values) {
				// 0時〜24時の1日分のデータ配列を準備（15分間隔 = 96個）
				const hoursInDay = 24;
				const intervalsPerHour = 4; // 15分間隔
				const totalIntervals = hoursInDay * intervalsPerHour;

				const spo2Data = new Array(totalIntervals).fill(null);
				const timeLabels = [];

				// ラベル作成（0:00, 0:15, 0:30, ..., 23:45）
				for (let i = 0; i < totalIntervals; i++) {
					const totalMinutes = i * 15;
					const hours = Math.floor(totalMinutes / 60);
					const minutes = totalMinutes % 60;
					timeLabels.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
				}

				// SpO2データを配列にマッピング
				Object.keys(spo2Values).forEach(timeOffset => {
					const value = spo2Values[timeOffset];
					if (value > 0 && value <= 100) { // 有効なSpO2範囲
						const offsetSeconds = parseInt(timeOffset);
						const intervalIndex = Math.floor(offsetSeconds / 900); // 900秒 = 15分

						if (intervalIndex >= 0 && intervalIndex < totalIntervals) {
							spo2Data[intervalIndex] = value;
						}
					}
				});

				// 有効なデータ点の数をカウント
				const validDataCount = spo2Data.filter(v => v !== null).length;

				if (validDataCount > 0) {
					// 統計情報の計算
					const validValues = spo2Data.filter(v => v !== null);
					const avgSpO2 = Math.round(validValues.reduce((a, b) => a + b, 0) / validValues.length);
					const minSpO2 = Math.min(...validValues);
					const maxSpO2 = Math.max(...validValues);

					window.pulseoxChartInstance = new Chart(ctx, {
						type: 'line',
						data: {
							labels: timeLabels,
							datasets: [{
								label: 'SpO2 (%)',
								data: spo2Data,
								borderColor: 'rgba(54, 162, 235, 1)',
								backgroundColor: 'rgba(54, 162, 235, 0.1)',
								tension: 0.3,
								pointRadius: 2,
								pointHoverRadius: 4,
								spanGaps: true,
								fill: true
							}]
						},
						options: {
							responsive: true,
							maintainAspectRatio: false,
							interaction: {
								intersect: false,
								mode: 'index'
							},
							scales: {
								y: {
									beginAtZero: false,
									min: 85,
									max: 100,
									title: {
										display: true,
										text: '血中酸素濃度 (%)'
									},
									ticks: {
										callback: function (value) {
											return value + '%';
										}
									}
								},
								x: {
									title: { display: true, text: '時刻' },
									ticks: {
										maxTicksLimit: 12,
										callback: function (value, index) {
											// 2時間ごとに表示（8間隔 = 2時間）
											if (index % 8 === 0) {
												return this.getLabelForValue(value);
											}
											return '';
										}
									}
								}
							},
							plugins: {
								title: {
									display: true,
									text: `血中酸素濃度 (SpO2) - ${pulseoxData.calendarDate || '日付不明'}`
								},
								subtitle: {
									display: true,
									text: `平均: ${avgSpO2}% | 最小: ${minSpO2}% | 最大: ${maxSpO2}% | データ点: ${validDataCount}`
								},
								legend: {
									display: true,
									position: 'top'
								},
								tooltip: {
									callbacks: {
										label: function (context) {
											if (context.parsed.y === null) {
												return 'データなし';
											}

											const value = context.parsed.y;
											let status = '';
											if (value >= 95) status = ' (正常)';
											else if (value >= 90) status = ' (やや低い)';
											else status = ' (低い)';
											return `SpO2: ${value}%${status}`;
										}
									},
									filter: function (tooltipItem) {
										return tooltipItem.parsed.y !== null;
									}
								}
							}
						}
					});

					// 【追加】血中酸素濃度情報の更新
					const avgElement = document.getElementById('avgSpO2');
					const minElement = document.getElementById('minSpO2');
					const maxElement = document.getElementById('maxSpO2');

					if (avgElement) avgElement.textContent = `${avgSpO2}%`;
					if (minElement) minElement.textContent = `${minSpO2}%`;
					if (maxElement) maxElement.textContent = `${maxSpO2}%`;

				} else {
					createNoDataChart(ctx, '有効なSpO2データがありません');
				}
			} else {
				createNoDataChart(ctx, 'SpO2データの解析に失敗しました');
			}
		} else {
			createNoDataChart(ctx, 'SpO2データがありません');
		}
	}

	// === 新規追加: UserMetrics（フィットネス指標）グラフ ===
	function createUserMetricsChart(userMetrics) {
		const canvas = document.getElementById('userMetricsChart');
		if (!canvas) {
			return;
		}

		const ctx = canvas.getContext('2d');

		// 既存のグラフがあれば破棄
		if (window.userMetricsChartInstance) {
			window.userMetricsChartInstance.destroy();
		}

		if (userMetrics && userMetrics.vo2Max) {
			const vo2Max = userMetrics.vo2Max || 0;
			const fitnessAge = userMetrics.fitnessAge || null;

			// VO2Maxのレベル判定（一般的な基準）
			let vo2MaxLevel = '';
			let vo2MaxColor = '';

			if (vo2Max >= 55) {
				vo2MaxLevel = '優秀';
				vo2MaxColor = 'rgba(76, 175, 80, 0.8)';
			} else if (vo2Max >= 45) {
				vo2MaxLevel = '良好';
				vo2MaxColor = 'rgba(54, 162, 235, 0.8)';
			} else if (vo2Max >= 35) {
				vo2MaxLevel = '平均';
				vo2MaxColor = 'rgba(255, 206, 86, 0.8)';
			} else {
				vo2MaxLevel = '要改善';
				vo2MaxColor = 'rgba(255, 99, 132, 0.8)';
			}

			window.userMetricsChartInstance = new Chart(ctx, {
				type: 'doughnut',
				data: {
					labels: ['VO2Max', '残り'],
					datasets: [{
						data: [vo2Max, 100 - vo2Max],
						backgroundColor: [
							vo2MaxColor,
							'rgba(200, 200, 200, 0.2)'
						],
						borderWidth: 2
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						title: {
							display: true,
							text: `フィットネス指標 - ${userMetrics.calendarDate || '日付不明'}`
						},
						subtitle: {
							display: true,
							text: `VO2Max: ${vo2Max} (${vo2MaxLevel})${fitnessAge ? ` | フィットネス年齢: ${fitnessAge}歳` : ''}`
						},
						legend: {
							display: false
						},
						tooltip: {
							callbacks: {
								label: function (context) {
									if (context.dataIndex === 0) {
										return `VO2Max: ${vo2Max} ml/kg/min (${vo2MaxLevel})`;
									}
									return '';
								}
							}
						}
					}
				}
			});

			// VO2Max情報の更新
			const vo2MaxElement = document.getElementById('vo2MaxValue');
			const fitnessAgeElement = document.getElementById('fitnessAgeValue');

			if (vo2MaxElement) vo2MaxElement.textContent = `${vo2Max} (${vo2MaxLevel})`;
			if (fitnessAgeElement && fitnessAge) fitnessAgeElement.textContent = `${fitnessAge}歳`;

		} else {
			createNoDataChart(ctx, 'フィットネス指標データがありません');
		}
	}

	// === 新規追加: MoveIQActivities（自動検出アクティビティ）グラフ ===
	function createMoveIQChart(moveIQData) {
		const canvas = document.getElementById('moveIQChart');
		if (!canvas) {
			return;
		}

		const ctx = canvas.getContext('2d');

		// 既存のグラフがあれば破棄
		if (window.moveIQChartInstance) {
			window.moveIQChartInstance.destroy();
		}

		if (moveIQData && moveIQData.activityType) {
			const activityType = moveIQData.activityType || 'Unknown';
			const durationInMinutes = Math.round((moveIQData.durationInSeconds || 0) / 60);

			// アクティビティタイプの日本語変換
			const activityTypeMap = {
				'walking': '歩行',
				'running': 'ランニング',
				'cycling': 'サイクリング',
				'swimming': '水泳',
				'elliptical': 'エリプティカル',
				'sedentary': '座位',
				'generic': '一般',
			};

			const activityTypeJp = activityTypeMap[activityType.toLowerCase()] || activityType;

			// 色の設定
			const colorMap = {
				'walking': 'rgba(54, 162, 235, 0.8)',
				'running': 'rgba(255, 99, 132, 0.8)',
				'cycling': 'rgba(75, 192, 192, 0.8)',
				'swimming': 'rgba(153, 102, 255, 0.8)',
				'elliptical': 'rgba(255, 159, 64, 0.8)',
				'sedentary': 'rgba(201, 203, 207, 0.8)',
				'generic': 'rgba(255, 206, 86, 0.8)',
			};

			const activityColor = colorMap[activityType.toLowerCase()] || 'rgba(100, 100, 100, 0.8)';

			window.moveIQChartInstance = new Chart(ctx, {
				type: 'bar',
				data: {
					labels: [activityTypeJp],
					datasets: [{
						label: '時間 (分)',
						data: [durationInMinutes],
						backgroundColor: [activityColor],
						borderColor: [activityColor.replace('0.8', '1')],
						borderWidth: 2
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					indexAxis: 'y', // 横棒グラフ
					plugins: {
						title: {
							display: true,
							text: `自動検出アクティビティ - ${moveIQData.calendarDate || '日付不明'}`
						},
						legend: {
							display: false
						},
						tooltip: {
							callbacks: {
								label: function (context) {
									return `${context.parsed.x}分間`;
								}
							}
						}
					},
					scales: {
						x: {
							beginAtZero: true,
							title: {
								display: true,
								text: '時間 (分)'
							}
						}
					}
				}
			});

			// アクティビティ情報の更新
			const activityTypeElement = document.getElementById('moveIQActivityType');
			const activityDurationElement = document.getElementById('moveIQDuration');

			if (activityTypeElement) activityTypeElement.textContent = activityTypeJp;
			if (activityDurationElement) activityDurationElement.textContent = `${durationInMinutes}分`;

		} else {
			createNoDataChart(ctx, '自動検出アクティビティデータがありません');
		}
	}

	// === ユーティリティ関数群 ===

	function updateActivityInfo(activityData) {
		const elements = {
			'steps': activityData.steps ? `${activityData.steps.toLocaleString()}歩` : '--',
			'distance': activityData.distance ? `${activityData.distance.toFixed(1)}km` : '--',
			'calories': activityData.calories ? `${activityData.calories}kcal` : '--',
			'activeTime': activityData.activeMinutes ? `${activityData.activeMinutes}分` : '--'
		};

		Object.entries(elements).forEach(([id, value]) => {
			const element = document.getElementById(id);
			if (element) element.textContent = value;
		});
	}

	function updateSleepInfo(sleepData, totalSleepMinutes) {
		const elements = {
			'totalSleep': `${Math.floor(totalSleepMinutes / 60)}時間${totalSleepMinutes % 60}分`,
			'deepSleep': `${Math.round((sleepData.deepSleepDurationInSeconds || 0) / 60)}分`,
			'lightSleep': `${Math.round((sleepData.lightSleepDurationInSeconds || 0) / 60)}分`,
			'remSleep': `${Math.round((sleepData.remSleepInSeconds || 0) / 60)}分`,
			'awakeTime': `${Math.round((sleepData.awakeDurationInSeconds || 0) / 60)}分`
		};

		Object.entries(elements).forEach(([id, value]) => {
			const element = document.getElementById(id);
			if (element) element.textContent = value;
		});
	}

	function createNoDataChart(ctx, message) {
		new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: ['データなし'],
				datasets: [{
					data: [1],
					backgroundColor: ['rgba(200, 200, 200, 0.5)'],
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: message
					},
					legend: {
						display: false
					}
				}
			}
		});
	}

	function updateStressAndBodyBatteryInfo(stressData, bodyBatteryData) {
		// ストレス情報の更新
		const validStressData = stressData.filter(v => v !== null && v >= 0);
		if (validStressData.length > 0) {
			const avgStress = Math.round(validStressData.reduce((a, b) => a + b, 0) / validStressData.length);
			const maxStress = Math.max(...validStressData);

			const avgElement = document.getElementById('avgStress');
			const maxElement = document.getElementById('maxStress');

			if (avgElement) avgElement.textContent = avgStress;
			if (maxElement) maxElement.textContent = maxStress;
		}

		// ボディバッテリー情報の更新
		const validBodyBatteryData = bodyBatteryData.filter(v => v !== null);
		if (validBodyBatteryData.length > 0) {
			const currentBB = validBodyBatteryData[validBodyBatteryData.length - 1]; // 最新値

			const currentElement = document.getElementById('currentBodyBattery');
			if (currentElement) currentElement.textContent = `${currentBB}%`;
		}
	}

	function checkBodyBatteryData(arg) {
		// StressDetailsからボディバッテリーデータを確認
		if (arg.StressDetails && arg.StressDetails.timeOffsetBodyBatteryValues) {
			let bodyBatteryValues = null;
			try {
				if (typeof arg.StressDetails.timeOffsetBodyBatteryValues === 'string') {
					bodyBatteryValues = JSON.parse(arg.StressDetails.timeOffsetBodyBatteryValues);
				} else {
					bodyBatteryValues = arg.StressDetails.timeOffsetBodyBatteryValues;
				}

				if (bodyBatteryValues) {
					const values = Object.values(bodyBatteryValues).filter(v => v > 0 && v <= 100);
					// データ確認のみ
				}
			} catch (error) {
				// エラー処理
			}
		}
	}

}); // DOMContentLoaded の終了
