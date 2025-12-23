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

            const stressLevel = calculateCurrentStressLevel(arg);
            const avatarFeedback = deriveAvatarFeedback(stressLevel);
            const logValue = stressLevel === null || stressLevel === undefined ? '不明' : stressLevel;
            console.log('🪞 アバター同期: エネルギーストレス -> ' + logValue, avatarFeedback);

            if (typeof window.updateAvatarState === 'function') {
                try {
                    window.updateAvatarState(stressLevel, avatarFeedback);
                } catch (error) {
                    console.warn('updateAvatarState failed:', error);
                }
            }

            if (window.avatarController && typeof window.avatarController.handleGarminData === 'function') {
                try {
                    window.avatarController.handleGarminData(arg, avatarFeedback);
                } catch (error) {
                    console.warn('avatarController.handleGarminData failed:', error);
                }
            }
        }, 100);
    };

    // === グラフ作成関数群 ===

    function createSleepChart(sleepData) {
        const canvas = document.getElementById('sleepChart');
        if (!canvas) {
            return;
        }

        destroyExistingChart(canvas);
        const ctx = canvas.getContext('2d');

        if (sleepData && sleepData.deepSleepDurationInSeconds) {
            const deepSleep = Math.round((sleepData.deepSleepDurationInSeconds || 0) / 60);
            const lightSleep = Math.round((sleepData.lightSleepDurationInSeconds || 0) / 60);
            const remSleep = Math.round((sleepData.remSleepInSeconds || 0) / 60);

            new Chart(ctx, {
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

            updateSleepInfo(sleepData, deepSleep + lightSleep + remSleep);
        } else {
            createNoDataChart(canvas, '睡眠データがありません');
        }
    }

    function createStressChart(stressDetails) {
        const canvas = document.getElementById('stressChart');
        if (!canvas) {
            return;
        }

        destroyExistingChart(canvas);
        const ctx = canvas.getContext('2d');

        if (!stressDetails) {
            createNoDataChart(canvas, 'ストレス・ボディバッテリーデータがありません');
            updateStressAndBodyBatteryInfo([], []);
            return;
        }

        let stressValues = null;
        let bodyBatteryValues = null;

        if (stressDetails.timeOffsetStressLevelValues) {
            if (typeof stressDetails.timeOffsetStressLevelValues === 'string') {
                try {
                    stressValues = JSON.parse(stressDetails.timeOffsetStressLevelValues);
                } catch (e) {
                    stressValues = null;
                }
            } else if (typeof stressDetails.timeOffsetStressLevelValues === 'object') {
                stressValues = stressDetails.timeOffsetStressLevelValues;
            }
        }

        if (stressDetails.timeOffsetBodyBatteryValues) {
            if (typeof stressDetails.timeOffsetBodyBatteryValues === 'string') {
                try {
                    bodyBatteryValues = JSON.parse(stressDetails.timeOffsetBodyBatteryValues);
                } catch (e) {
                    bodyBatteryValues = null;
                }
            } else if (typeof stressDetails.timeOffsetBodyBatteryValues === 'object') {
                bodyBatteryValues = stressDetails.timeOffsetBodyBatteryValues;
            }
        }

        if (!stressValues && !bodyBatteryValues) {
            createNoDataChart(canvas, 'ストレス・ボディバッテリーデータの解析に失敗しました');
            updateStressAndBodyBatteryInfo([], []);
            return;
        }

        const hoursInDay = 24;
        const intervalsPerHour = 4;
        const totalIntervals = hoursInDay * intervalsPerHour;

        const stressData = new Array(totalIntervals).fill(null);
        const bodyBatteryData = new Array(totalIntervals).fill(null);
        const timeLabels = [];

        for (let i = 0; i < totalIntervals; i++) {
            const totalMinutes = i * 15;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            timeLabels.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
        }

        if (stressValues) {
            Object.keys(stressValues).forEach(timeOffset => {
                const value = stressValues[timeOffset];
                const numeric = Number(value);
                if (numeric >= 0) {
                    const offsetSeconds = parseInt(timeOffset, 10);
                    const intervalIndex = Math.floor(offsetSeconds / 900);
                    if (intervalIndex >= 0 && intervalIndex < totalIntervals) {
                        stressData[intervalIndex] = numeric;
                    }
                }
            });
        }

        if (bodyBatteryValues) {
            Object.keys(bodyBatteryValues).forEach(timeOffset => {
                const value = bodyBatteryValues[timeOffset];
                const numeric = Number(value);
                if (numeric > 0 && numeric <= 100) {
                    const offsetSeconds = parseInt(timeOffset, 10);
                    const intervalIndex = Math.floor(offsetSeconds / 900);
                    if (intervalIndex >= 0 && intervalIndex < totalIntervals) {
                        bodyBatteryData[intervalIndex] = numeric;
                    }
                }
            });
        }

        const validStressCount = stressData.filter(v => v !== null).length;
        const validBodyBatteryCount = bodyBatteryData.filter(v => v !== null).length;

        if (validStressCount === 0 && validBodyBatteryCount === 0) {
            createNoDataChart(canvas, '有効なストレス・ボディバッテリーデータがありません');
            updateStressAndBodyBatteryInfo([], []);
            return;
        }

        const datasets = [];

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

        new Chart(ctx, {
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
                                }
                                const value = context.parsed.y;
                                let status = '';
                                if (value >= 70) status = ' (高レベル)';
                                else if (value >= 30) status = ' (中レベル)';
                                else status = ' (低レベル)';
                                return `ボディバッテリー: ${value}%${status}`;
                            }
                        },
                        filter: function (tooltipItem) {
                            return tooltipItem.parsed.y !== null;
                        }
                    }
                }
            }
        });

        updateStressAndBodyBatteryInfo(stressData, bodyBatteryData);
    }

    function createActivityChart(activities) {
        const canvas = document.getElementById('activityChart');
        if (!canvas) {




return;
        }

        destroyExistingChart(canvas);
        const ctx = canvas.getContext('2d');

        if (activities && typeof activities === 'object') {
            const steps = activities.steps || 0;
            const distanceInMeters = activities.distanceInMeters || 0;
            const distance = distanceInMeters / 1000;
            const calories = activities.activeKilocalories || 0;
            const durationInSeconds = activities.durationInSeconds || 0;
            const activeMinutes = Math.round(durationInSeconds / 60);

            new Chart(ctx, {
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

            updateActivityInfo({
                steps: steps,
                distance: distance,
                calories: calories,
                activeMinutes: activeMinutes
            });

        } else {
            createNoDataChart(canvas, 'アクティビティデータがありません');

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

        destroyExistingChart(canvas);
        const ctx = canvas.getContext('2d');

        if (dailies && (dailies.averageHeartRateInBeatsPerMinute || dailies.restingHeartRateInBeatsPerMinute)) {
            const avgHR = dailies.averageHeartRateInBeatsPerMinute || 0;
            const restingHR = dailies.restingHeartRateInBeatsPerMinute || 0;
            const maxHR = dailies.maxHeartRateInBeatsPerMinute || 0;

            new Chart(ctx, {
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

            const restingElement = document.getElementById('restingHeartRate');
            const avgElement = document.getElementById('avgHeartRate');
            const maxElement = document.getElementById('maxHeartRate');

            if (restingElement) restingElement.textContent = restingHR;
            if (avgElement) avgElement.textContent = avgHR;
            if (maxElement) maxElement.textContent = maxHR;

        } else {
            createNoDataChart(canvas, '心拍数データがありません');
        }
    }

    function createPulseoxChart(pulseoxData) {
        const canvas = document.getElementById('pulseoxChart');
        if (!canvas) {
            return;
        }

        destroyExistingChart(canvas);
        const ctx = canvas.getContext('2d');

        if (pulseoxData && pulseoxData.timeOffsetSpo2Values) {
            let spo2Values = null;

            if (typeof pulseoxData.timeOffsetSpo2Values === 'string') {
                try {
                    spo2Values = JSON.parse(pulseoxData.timeOffsetSpo2Values);
                } catch (e) {
                    spo2Values = null;
                }
            } else if (typeof pulseoxData.timeOffsetSpo2Values === 'object') {
                spo2Values = pulseoxData.timeOffsetSpo2Values;
            }

            if (spo2Values) {
                const hoursInDay = 24;
                const intervalsPerHour = 4;
                const totalIntervals = hoursInDay * intervalsPerHour;

                const spo2Data = new Array(totalIntervals).fill(null);
                const timeLabels = [];

                for (let i = 0; i < totalIntervals; i++) {
                    const totalMinutes = i * 15;
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;
                    timeLabels.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
                }

                Object.keys(spo2Values).forEach(timeOffset => {
                    const value = spo2Values[timeOffset];
                    const numeric = Number(value);
                    if (numeric > 0 && numeric <= 100) {
                        const offsetSeconds = parseInt(timeOffset, 10);
                        const intervalIndex = Math.floor(offsetSeconds / 900);
                        if (intervalIndex >= 0 && intervalIndex < totalIntervals) {
                            spo2Data[intervalIndex] = numeric;
                        }
                    }
                });

                const validDataCount = spo2Data.filter(v => v !== null).length;

                if (validDataCount > 0) {
                    const validValues = spo2Data.filter(v => v !== null);
                    const avgSpO2 = Math.round(validValues.reduce((a, b) => a + b, 0) / validValues.length);
                    const minSpO2 = Math.min(...validValues);
                    const maxSpO2 = Math.max(...validValues);

                    new Chart(ctx, {
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

                    const avgElement = document.getElementById('avgSpO2');
                    const minElement = document.getElementById('minSpO2');
                    const maxElement = document.getElementById('maxSpO2');

                    if (avgElement) avgElement.textContent = `${avgSpO2}%`;
                    if (minElement) minElement.textContent = `${minSpO2}%`;
                    if (maxElement) maxElement.textContent = `${maxSpO2}%`;

                } else {
                    createNoDataChart(canvas, '有効なSpO2データがありません');
                }
            } else {
                createNoDataChart(canvas, 'SpO2データの解析に失敗しました');
            }
        } else {
            createNoDataChart(canvas, 'SpO2データがありません');
        }
    }

    function createUserMetricsChart(userMetrics) {
        const canvas = document.getElementById('userMetricsChart');
        if (!canvas) {
            return;
        }

        destroyExistingChart(canvas);
        const ctx = canvas.getContext('2d');

        if (userMetrics && userMetrics.vo2Max) {
            const vo2Max = userMetrics.vo2Max || 0;
            const fitnessAge = userMetrics.fitnessAge || null;

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

            new Chart(ctx, {
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
                                label: function () {
                                    return `VO2Max: ${vo2Max} ml/kg/min (${vo2MaxLevel})`;
                                }
                            }
                        }
                    }
                }
            });

            const vo2MaxElement = document.getElementById('vo2MaxValue');
            const fitnessAgeElement = document.getElementById('fitnessAgeValue');

            if (vo2MaxElement) vo2MaxElement.textContent = `${vo2Max} (${vo2MaxLevel})`;
            if (fitnessAgeElement && fitnessAge) fitnessAgeElement.textContent = `${fitnessAge}歳`;

        } else {
            createNoDataChart(canvas, 'フィットネス指標データがありません');
        }
    }

    function createMoveIQChart(moveIQData) {
        const canvas = document.getElementById('moveIQChart');
        if (!canvas) {
            return;
        }

        destroyExistingChart(canvas);
        const ctx = canvas.getContext('2d');

        if (moveIQData && moveIQData.activityType) {
            const activityType = moveIQData.activityType || 'Unknown';
            const durationInMinutes = Math.round((moveIQData.durationInSeconds || 0) / 60);

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

            new Chart(ctx, {
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
                    indexAxis: 'y',
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

            const activityTypeElement = document.getElementById('moveIQActivityType');



const activityDurationElement = document.getElementById('moveIQDuration');

            if (activityTypeElement) activityTypeElement.textContent = activityTypeJp;
            if (activityDurationElement) activityDurationElement.textContent = `${durationInMinutes}分`;

        } else {
            createNoDataChart(canvas, '自動検出アクティビティデータがありません');
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

    function createNoDataChart(canvasElement, message) {
        const canvas = typeof canvasElement === 'string' ? document.getElementById(canvasElement) : canvasElement;
        if (!canvas) {
            return;
        }

        destroyExistingChart(canvas);
        const ctx = canvas.getContext('2d');

        if (typeof Chart === 'undefined') {
            return;
        }

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
        const validStressData = stressData.filter(v => v !== null && v >= 0);
        if (validStressData.length > 0) {
            const avgStress = Math.round(validStressData.reduce((a, b) => a + b, 0) / validStressData.length);
            const maxStress = Math.max(...validStressData);

            const avgElement = document.getElementById('avgStress');
            const maxElement = document.getElementById('maxStress');

            if (avgElement) avgElement.textContent = avgStress;
            if (maxElement) maxElement.textContent = maxStress;
        } else {
            const avgElement = document.getElementById('avgStress');
            const maxElement = document.getElementById('maxStress');
            if (avgElement) avgElement.textContent = '--';
            if (maxElement) maxElement.textContent = '--';
        }

        const validBodyBatteryData = bodyBatteryData.filter(v => v !== null);
        if (validBodyBatteryData.length > 0) {
            const currentBB = validBodyBatteryData[validBodyBatteryData.length - 1];
            const currentElement = document.getElementById('currentBodyBattery');
            if (currentElement) currentElement.textContent = `${currentBB}%`;
        } else {
            const currentElement = document.getElementById('currentBodyBattery');
            if (currentElement) currentElement.textContent = '--';
        }
    }

    function checkBodyBatteryData(arg) {
        if (arg.StressDetails && arg.StressDetails.timeOffsetBodyBatteryValues) {
            let bodyBatteryValues = null;
            try {
                if (typeof arg.StressDetails.timeOffsetBodyBatteryValues === 'string') {
                    bodyBatteryValues = JSON.parse(arg.StressDetails.timeOffsetBodyBatteryValues);
                } else {
                    bodyBatteryValues = arg.StressDetails.timeOffsetBodyBatteryValues;
                }

                if (bodyBatteryValues) {
                    Object.values(bodyBatteryValues).filter(v => v > 0 && v <= 100);
                }
            } catch (error) {
                console.warn('Body battery parse error:', error);
            }
        }
    }

    function destroyExistingChart(canvasOrId) {
        if (typeof Chart === 'undefined') {
            return;
        }
        const canvasId = typeof canvasOrId === 'string' ? canvasOrId : (canvasOrId && canvasOrId.id);
        if (!canvasId) {
            return;
        }
        const existing = Chart.getChart(canvasId);
        if (existing) {
            existing.destroy();
        }
    }

    function parseFlexibleSeries(rawSeries) {
        if (!rawSeries) {
            return [];
        }
        let series = rawSeries;
        if (typeof series === 'string') {
            try {
                series = JSON.parse(series);
            } catch (error) {
                return [];
            }
        }

        const points = [];
        if (Array.isArray(series)) {
            series.forEach((item, index) => {
                if (!item || typeof item !== 'object') {
                    return;
                }
                const offsetCandidate = item.offset || item.timeOffset || item.timeOffsetSeconds || index;
                const valueCandidate = item.value !== undefined ? item.value :
                    item.stressLevel !== undefined ? item.stressLevel :
                        item.bodyBattery !== undefined ? item.bodyBattery :
                            item.spo2 !== undefined ? item.spo2 : item.data;
                const offset = Number(offsetCandidate);
                const value = Number(valueCandidate);
                if (!Number.isNaN(value)) {
                    points.push({
                        offset: Number.isNaN(offset) ? index : offset,
                        value: value
                    });
                }
            });
        } else if (typeof series === 'object') {
            Object.keys(series).forEach(key => {
                const offset = Number(key);
                let value = series[key];
                if (value && typeof value === 'object') {
                    if (value.value !== undefined) value = value.value;
                    else if (value.stressLevel !== undefined) value = value.stressLevel;
                    else if (value.bodyBattery !== undefined) value = value.bodyBattery;
                    else if (value.spo2 !== undefined) value = value.spo2;
                }
                const numericValue = Number(value);
                if (!Number.isNaN(numericValue)) {
                    points.push({
                        offset: Number.isNaN(offset) ? points.length : offset,
                        value: numericValue
                    });
                }
            });
        }
        points.sort((a, b) => a.offset - b.offset);
        return points;
    }

    function calculateCurrentStressLevel(garminData) {
        if (!garminData) {




return null;
        }

        const stressDetails = garminData.StressDetails;
        if (stressDetails && stressDetails.timeOffsetStressLevelValues) {
            const points = parseFlexibleSeries(stressDetails.timeOffsetStressLevelValues)
                .filter(point => point.value !== null && point.value !== undefined && point.value >= 0);
            if (points.length > 0) {
                const latest = points[points.length - 1].value;
                return Math.min(100, Math.max(0, latest));
            }
        }

        const dailies = garminData.Dailies;
        if (dailies) {
            const average = Number(dailies.averageStressLevel);
            if (!Number.isNaN(average)) {
                return Math.min(100, Math.max(0, average));
            }
            const maxValue = Number(dailies.maxStressLevel);
            if (!Number.isNaN(maxValue)) {
                return Math.min(100, Math.max(0, maxValue));
            }
        }

        return null;
    }

    function deriveAvatarFeedback(stressLevel) {
        const calmState = {
            expression: 'calm',
            tone: 'low',
            message: 'あなたのエネルギーは静かに整っています。呼吸のリズムを保ちましょう。',
            recoveryCue: '維持'
        };

        if (stressLevel === null || stressLevel === undefined || Number.isNaN(stressLevel)) {
            return calmState;
        }

        if (stressLevel >= 71) {
            return {
                expression: 'eyes-closed',
                tone: 'high',
                message: 'あなたのエネルギーは目を閉じて刺激を遮断しようとしています。今なら深呼吸と短い休息でまだ回復可能です。',
                recoveryCue: '休息優先',
                stressLevel: stressLevel
            };
        }

        if (stressLevel >= 31) {
            return {
                expression: 'strain',
                tone: 'medium',
                message: 'あなたのエネルギーは眉間にシワを寄せて耐えています。小さなブレイクで整えれば十分に巻き返せます。',
                recoveryCue: '短い休憩',
                stressLevel: stressLevel
            };
        }

        return {
            expression: 'bright',
            tone: 'low',
            message: 'あなたのエネルギーは柔らかく輝いています。この調子で穏やかなリズムを続けましょう。',
            recoveryCue: '継続',
            stressLevel: stressLevel
        };
    }

}); // DOMContentLoaded の終了
