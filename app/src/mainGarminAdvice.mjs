//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2024
//	Garminアドバイス生成モジュール
//  アンケート回答とGarminヘルスデータを組み合わせて個別アドバイスを生成
//////////////////////////////////////////////////////////////////////
'use strict'

// ES ModuleからCommonJSをインポート
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// デバッグ用ログ（モジュール読み込み時に必ず表示される）
console.log('========================================');
console.log('🚀 mainGarminAdvice.mjs is loading...');
console.log('========================================');

// 【修正】モデルのインポート
let localDBModels, mainSubmodule;
let IOT_QuestionnaireAnswersModel, IOT_GarminSleeps, IOT_GarminDailiesModel, IOT_GarminStressDetailsModel, IOT_GarminActivitiesModel, getToday;

try {
    localDBModels = require('./models/localDBModels.cjs');
    mainSubmodule = require('./mainSubmodule.cjs');
    
    console.log('🔍 Checking localDBModels structure...');
    console.log('localDBModels keys:', Object.keys(localDBModels));
    console.log('mainSubmodule keys:', Object.keys(mainSubmodule));
    
    // モデルの抽出（IOT_GarminSleepsModel の可能性もあるのでチェック）
    IOT_QuestionnaireAnswersModel = localDBModels.IOT_QuestionnaireAnswersModel;
    
    // GarminSleeps は複数の命名パターンがある可能性
    IOT_GarminSleeps = localDBModels.IOT_GarminSleeps || localDBModels.IOT_GarminSleepsModel;
    IOT_GarminDailiesModel = localDBModels.IOT_GarminDailiesModel || localDBModels.IOT_GarminDailies;
    IOT_GarminStressDetailsModel = localDBModels.IOT_GarminStressDetailsModel || localDBModels.IOT_GarminStressDetails;
    IOT_GarminActivitiesModel = localDBModels.IOT_GarminActivitiesModel || localDBModels.IOT_GarminActivities;
    
    getToday = mainSubmodule.getToday;
    
    console.log('🔍 Models availability check:');
    console.log('IOT_QuestionnaireAnswersModel:', typeof IOT_QuestionnaireAnswersModel);
    console.log('IOT_GarminSleeps:', typeof IOT_GarminSleeps);
    console.log('IOT_GarminDailiesModel:', typeof IOT_GarminDailiesModel);
    console.log('IOT_GarminStressDetailsModel:', typeof IOT_GarminStressDetailsModel);
    console.log('IOT_GarminActivitiesModel:', typeof IOT_GarminActivitiesModel);
    console.log('getToday:', typeof getToday);
    console.log('========================================');
    
} catch (error) {
    console.error('========================================');
    console.error('❌ Failed to load dependencies');
    console.error('Error:', error.message);
    console.error('========================================');
}

let mainGarminAdvice = {
    /**
     * @func generateAdvice
     * @desc アンケートとGarminデータからアドバイスを生成
     * @async
     * @param {string} date - 対象日付 (YYYY-MM-DD形式)
     * @return {Object} アドバイス内容
     */
    generateAdvice: async function(date) {
        console.log('========================================');
        console.log('🔍 mainGarminAdvice.generateAdvice START');
        console.log('Timestamp:', new Date().toISOString());
        console.log('========================================');
        
        // モデルの存在チェック
        if (!IOT_QuestionnaireAnswersModel) {
            throw new Error('IOT_QuestionnaireAnswersModel is not loaded. Check localDBModels.cjs export names.');
        }
        if (!IOT_GarminSleeps) {
            throw new Error('IOT_GarminSleeps is not loaded. Check localDBModels.cjs export names.');
        }
        if (!IOT_GarminDailiesModel) {
            throw new Error('IOT_GarminDailiesModel is not loaded. Check localDBModels.cjs export names.');
        }
        if (!IOT_GarminStressDetailsModel) {
            throw new Error('IOT_GarminStressDetailsModel is not loaded. Check localDBModels.cjs export names.');
        }
        
        // dateが指定されていない場合はgetTodayを使用
        if (!date) {
            if (typeof getToday === 'function') {
                date = getToday();
            } else {
                // フォールバック: 自前で日付を生成
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                date = `${year}-${month}-${day}`;
            }
        }
        
        console.log('Target date:', date);
        
        let advices = {
            sleep: [],
            activity: [],
            stress: [],
            overall: []
        };

        try {
            // ===== データ取得 =====
            console.log('📊 Fetching data from database...');
            
            // アンケートデータ取得
            console.log('  Fetching questionnaire data...');
            const questionnaireData = await IOT_QuestionnaireAnswersModel.findOne({
                where: { date: date },
                order: [['createdAt', 'DESC']]
            });
            console.log('  📝 Questionnaire data:', questionnaireData ? 'Found' : 'Not found');

            // Garminデータ取得（並行実行）
            console.log('  Fetching Garmin data...');
            const [sleepData, dailyData, stressData] = await Promise.all([
                IOT_GarminSleeps.findOne({
                    where: { calendarDate: date },
                    order: [['createdAt', 'DESC']]
                }),
                IOT_GarminDailiesModel.findOne({
                    where: { calendarDate: date },
                    order: [['createdAt', 'DESC']]
                }),
                IOT_GarminStressDetailsModel.findOne({
                    where: { calendarDate: date },
                    order: [['createdAt', 'DESC']]
                })
            ]);

            console.log('  🛌 Sleep data:', sleepData ? 'Found' : 'Not found');
            console.log('  📈 Daily data:', dailyData ? 'Found' : 'Not found');
            console.log('  💓 Stress data:', stressData ? 'Found' : 'Not found');

            // データが何もない場合
            if (!sleepData && !dailyData && !stressData) {
                console.warn('⚠️ No Garmin data found for date:', date);
                advices.overall.push({
                    level: 'info',
                    title: 'データが見つかりませんでした',
                    message: `${date}のGarminデータが記録されていません。デバイスを同期してください。`,
                    priority: []
                });
                return advices;
            }

            // ===== 各種アドバイス生成 =====
            if (sleepData) {
                console.log('💤 Analyzing sleep data...');
                advices.sleep = this.analyzeSleep(sleepData, questionnaireData);
                console.log(`  ✅ Generated ${advices.sleep.length} sleep advices`);
            }

            if (dailyData) {
                console.log('🚶 Analyzing activity data...');
                advices.activity = this.analyzeActivity(dailyData, questionnaireData);
                console.log(`  ✅ Generated ${advices.activity.length} activity advices`);
            }

            if (stressData) {
                console.log('😌 Analyzing stress data...');
                advices.stress = this.analyzeStress(stressData, questionnaireData);
                console.log(`  ✅ Generated ${advices.stress.length} stress advices`);
            }

            // ===== 総合アドバイス生成 =====
            console.log('🌟 Generating overall advice...');
            advices.overall = this.generateOverallAdvice(advices, questionnaireData);
            console.log(`  ✅ Generated ${advices.overall.length} overall advices`);

            const totalCount = 
                advices.sleep.length + 
                advices.activity.length + 
                advices.stress.length + 
                advices.overall.length;
            
            console.log('========================================');
            console.log(`🎉 Total advices generated: ${totalCount}`);
            console.log('========================================');
            
            return advices;

        } catch (error) {
            console.error('========================================');
            console.error('❌ Error in generateAdvice');
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('========================================');
            throw error;
        }
    },

    /**
     * @func analyzeSleep
     * @desc 睡眠データを分析してアドバイスを生成
     * @param {Object} sleepData - IOT_GarminSleepsモデルのデータ
     * @param {Object} questionnaireData - アンケート回答データ
     * @return {Array} アドバイスの配列
     */
    analyzeSleep: function(sleepData, questionnaireData) {
        let advices = [];
        
        // 睡眠時間の計算（秒→時間）
        const totalSleepHours = (sleepData.durationInSeconds || 0) / 3600;
        const deepSleepMinutes = (sleepData.deepSleepDurationInSeconds || 0) / 60;
        const lightSleepMinutes = (sleepData.lightSleepDurationInSeconds || 0) / 60;
        const remSleepMinutes = (sleepData.remSleepInSeconds || 0) / 60;
        const awakeMinutes = (sleepData.awakeDurationInSeconds || 0) / 60;

        console.log('  📊 Sleep metrics:', {
            totalHours: totalSleepHours.toFixed(1),
            deepMinutes: deepSleepMinutes.toFixed(0),
            lightMinutes: lightSleepMinutes.toFixed(0),
            remMinutes: remSleepMinutes.toFixed(0),
            awakeMinutes: awakeMinutes.toFixed(0)
        });

        // アンケート q_4_1: 睡眠時間の回答（0-100スコア）
        const sleepQuestionScore = questionnaireData?.q_4_1 || null;

        // === 睡眠時間のチェック ===
        if (totalSleepHours < 6) {
            advices.push({
                level: 'warning',
                category: 'sleep',
                title: '睡眠時間が不足しています',
                message: `昨日の睡眠時間は${totalSleepHours.toFixed(1)}時間でした。7時間以上の睡眠を目標にしましょう。`,
                tips: [
                    '就寝時間を30分早めてみましょう',
                    '寝る1時間前にスマートフォンの使用を控えましょう',
                    'カフェインは午後3時以降控えめに',
                    '寝室を暗く静かな環境に整えましょう'
                ]
            });
        } else if (totalSleepHours >= 7 && totalSleepHours <= 9) {
            advices.push({
                level: 'success',
                category: 'sleep',
                title: '十分な睡眠時間です',
                message: `${totalSleepHours.toFixed(1)}時間の睡眠が取れています。この習慣を継続しましょう。`,
                tips: []
            });
        } else if (totalSleepHours > 9) {
            advices.push({
                level: 'info',
                category: 'sleep',
                title: '睡眠時間が長めです',
                message: `${totalSleepHours.toFixed(1)}時間眠っています。睡眠の質を確認してみましょう。`,
                tips: [
                    '日中に眠気を感じる場合は睡眠の質を見直しましょう',
                    '規則正しい就寝・起床時間を心がけましょう'
                ]
            });
        }

        // === 深い睡眠のチェック ===
        const deepSleepRatio = (deepSleepMinutes / (totalSleepHours * 60)) * 100;
        if (deepSleepMinutes < 60 || deepSleepRatio < 13) {  // 深い睡眠は総睡眠の13-23%が理想
            advices.push({
                level: 'info',
                category: 'sleep',
                title: '深い睡眠の質を改善しましょう',
                message: `深い睡眠は${deepSleepMinutes.toFixed(0)}分（${deepSleepRatio.toFixed(0)}%）でした。深い睡眠は疲労回復に重要です。`,
                tips: [
                    '日中に適度な運動を取り入れましょう',
                    '寝室の温度を18-22℃に保ちましょう',
                    '就寝前の入浴で体温を上げると効果的です',
                    '午後のカフェイン摂取を避けましょう'
                ]
            });
        }

        // === REM睡眠のチェック ===
        const remSleepRatio = (remSleepMinutes / (totalSleepHours * 60)) * 100;
        if (remSleepMinutes < 60 || remSleepRatio < 20) {  // REM睡眠は総睡眠の20-25%が理想
            advices.push({
                level: 'info',
                category: 'sleep',
                title: 'REM睡眠を増やしましょう',
                message: `REM睡眠は${remSleepMinutes.toFixed(0)}分（${remSleepRatio.toFixed(0)}%）でした。記憶の定着に重要です。`,
                tips: [
                    '規則正しい睡眠スケジュールを維持しましょう',
                    'アルコールを控えるとREM睡眠が増えます',
                    'ストレス管理を心がけましょう'
                ]
            });
        }

        // === 中途覚醒のチェック ===
        if (awakeMinutes > 30) {
            advices.push({
                level: 'warning',
                category: 'sleep',
                title: '中途覚醒が多いです',
                message: `夜間の覚醒時間が${awakeMinutes.toFixed(0)}分ありました。睡眠の質の改善が必要です。`,
                tips: [
                    '就寝前のカフェイン・アルコールを控えましょう',
                    '寝室の音や光を遮断しましょう',
                    '就寝前のリラックスタイムを設けましょう',
                    '頻繁な場合は医師に相談しましょう'
                ]
            });
        }

        // === アンケートとの整合性チェック ===
        if (sleepQuestionScore !== null) {
            // スコアが高い（良いと回答）のに実測は短い
            if (sleepQuestionScore >= 70 && totalSleepHours < 6) {
                advices.push({
                    level: 'notice',
                    category: 'sleep',
                    title: '主観と実測に差があります',
                    message: `アンケートでは十分と回答されていますが、実測では${totalSleepHours.toFixed(1)}時間でした。`,
                    tips: [
                        '睡眠時間と質の両方を意識してみましょう',
                        '日中の眠気がある場合は睡眠時間を増やしましょう'
                    ]
                });
            }
            // スコアが低い（悪いと回答）のに実測は十分
            else if (sleepQuestionScore < 50 && totalSleepHours >= 7) {
                advices.push({
                    level: 'info',
                    category: 'sleep',
                    title: '睡眠の質に注目しましょう',
                    message: `睡眠時間は${totalSleepHours.toFixed(1)}時間確保されていますが、満足度が低いようです。`,
                    tips: [
                        '深い睡眠とREM睡眠の割合を確認しましょう',
                        '睡眠環境（温度、音、光）を見直しましょう',
                        'ストレスや不安がある場合は専門家に相談しましょう'
                    ]
                });
            }
        }

        return advices;
    },

    /**
     * @func analyzeActivity
     * @desc 活動データを分析してアドバイスを生成
     * @param {Object} dailyData - IOT_GarminDailiesModelのデータ
     * @param {Object} questionnaireData - アンケート回答データ
     * @return {Array} アドバイスの配列
     */
    analyzeActivity: function(dailyData, questionnaireData) {
        let advices = [];
        
        const steps = dailyData.steps || 0;
        const distanceInKm = (dailyData.distanceInMeters || 0) / 1000;
        const activeCalories = dailyData.activeKilocalories || 0;
        const activeMinutes = (dailyData.activeTimeInSeconds || 0) / 60;

        console.log('  📊 Activity metrics:', {
            steps: steps,
            distanceKm: distanceInKm.toFixed(1),
            calories: activeCalories,
            activeMinutes: activeMinutes.toFixed(0)
        });

        // アンケート q_4_3: 歩行距離の回答
        const walkingQuestionScore = questionnaireData?.q_4_3 || null;

        // === 歩数のチェック ===
        if (steps < 3000) {
            advices.push({
                level: 'warning',
                category: 'activity',
                title: '活動量がかなり不足しています',
                message: `昨日の歩数は${steps.toLocaleString()}歩でした。まずは5,000歩を目標にしましょう。`,
                tips: [
                    '近所への外出時は歩いて行きましょう',
                    '家の中でもこまめに動くよう意識しましょう',
                    '座りっぱなしを避け、1時間に1回立ち上がりましょう',
                    '無理のない範囲で少しずつ増やしていきましょう'
                ]
            });
        } else if (steps >= 3000 && steps < 5000) {
            advices.push({
                level: 'warning',
                category: 'activity',
                title: '活動量が不足しています',
                message: `昨日の歩数は${steps.toLocaleString()}歩でした。8,000歩を目標にしましょう。`,
                tips: [
                    '階段を積極的に使いましょう',
                    '一駅手前で降りて歩いてみましょう',
                    '買い物は少し遠いお店を選んでみましょう'
                ]
            });
        } else if (steps >= 5000 && steps < 8000) {
            advices.push({
                level: 'info',
                category: 'activity',
                title: 'もう少しで目標達成です',
                message: `昨日の歩数は${steps.toLocaleString()}歩でした。あと少しで8,000歩です！`,
                tips: [
                    '昼休みに10分の散歩を習慣化しましょう',
                    '通勤・通学時に少し遠回りしてみましょう'
                ]
            });
        } else if (steps >= 8000 && steps < 10000) {
            advices.push({
                level: 'success',
                category: 'activity',
                title: '良好な活動量です！',
                message: `昨日は${steps.toLocaleString()}歩も歩きました。健康維持に最適です。`,
                tips: []
            });
        } else if (steps >= 10000) {
            advices.push({
                level: 'success',
                category: 'activity',
                title: '素晴らしい活動量です！',
                message: `昨日は${steps.toLocaleString()}歩も歩きました。この調子で継続しましょう。`,
                tips: [
                    '今の活動レベルを維持しましょう',
                    '無理のない範囲で習慣化していきましょう'
                ]
            });
        }

        // === 活動時間のチェック ===
        if (activeMinutes < 30) {
            advices.push({
                level: 'info',
                category: 'activity',
                title: '活動時間を増やしましょう',
                message: `アクティブな時間は${activeMinutes.toFixed(0)}分でした。1日30分以上の活動を目指しましょう。`,
                tips: [
                    '週に3回、20分のウォーキングから始めましょう',
                    '好きな音楽を聴きながら運動すると継続しやすいです',
                    '友人や家族と一緒に歩くと楽しく続けられます'
                ]
            });
        }

        // === 消費カロリーのチェック ===
        if (activeCalories < 200) {
            advices.push({
                level: 'info',
                category: 'activity',
                title: '消費カロリーを増やしましょう',
                message: `活動による消費カロリーは${activeCalories}kcalでした。`,
                tips: [
                    '軽い運動でも継続すれば効果があります',
                    '階段の上り下りは効果的なカロリー消費になります'
                ]
            });
        }

        // === アンケートとの整合性チェック ===
        if (walkingQuestionScore !== null) {
            // 主観的には歩いているつもりだが実測は少ない
            if (walkingQuestionScore >= 70 && steps < 5000) {
                advices.push({
                    level: 'notice',
                    category: 'activity',
                    title: '実測値が期待より少ないです',
                    message: `アンケートでは活動的と回答されていますが、歩数は${steps.toLocaleString()}歩でした。`,
                    tips: [
                        '活動量を客観的に把握しましょう',
                        '意識的に歩く機会を増やしましょう'
                    ]
                });
            }
        }

        return advices;
    },

    /**
     * @func analyzeStress
     * @desc ストレスデータを分析してアドバイスを生成
     * @param {Object} stressData - IOT_GarminStressDetailsModelのデータ
     * @param {Object} questionnaireData - アンケート回答データ
     * @return {Array} アドバイスの配列
     */
    analyzeStress: function(stressData, questionnaireData) {
        let advices = [];
        
        // === ストレスレベルのデータ解析 ===
        let stressValues = null;
        if (stressData.timeOffsetStressLevelValues) {
            try {
                stressValues = typeof stressData.timeOffsetStressLevelValues === 'string' 
                    ? JSON.parse(stressData.timeOffsetStressLevelValues) 
                    : stressData.timeOffsetStressLevelValues;
            } catch (e) {
                console.error('  ⚠️ Failed to parse stress values:', e);
            }
        }

        if (stressValues) {
            const validStress = Object.values(stressValues).filter(v => v >= 0);
            if (validStress.length > 0) {
                const avgStress = validStress.reduce((a, b) => a + b, 0) / validStress.length;
                const maxStress = Math.max(...validStress);
                const minStress = Math.min(...validStress);

                console.log('  📊 Stress metrics:', {
                    avg: avgStress.toFixed(0),
                    max: maxStress,
                    min: minStress,
                    dataPoints: validStress.length
                });

                // === 平均ストレスレベルのチェック ===
                if (avgStress > 60) {
                    advices.push({
                        level: 'warning',
                        category: 'stress',
                        title: 'ストレスレベルが高めです',
                        message: `平均ストレスレベルは${avgStress.toFixed(0)}でした。リラックスする時間を作りましょう。`,
                        tips: [
                            '深呼吸を5分間行いましょう（4秒吸って、7秒止めて、8秒吐く）',
                            '瞑想やヨガを試してみましょう',
                            '好きな音楽を聴いたり、趣味の時間を作りましょう',
                            '十分な睡眠を確保しましょう',
                            '継続する場合は専門家に相談しましょう'
                        ]
                    });
                } else if (avgStress >= 40 && avgStress <= 60) {
                    advices.push({
                        level: 'info',
                        category: 'stress',
                        title: 'ストレスレベルは中程度です',
                        message: `平均ストレスレベルは${avgStress.toFixed(0)}でした。適度なリラックスを心がけましょう。`,
                        tips: [
                            '定期的に休憩を取りましょう',
                            '軽い運動でストレス解消しましょう'
                        ]
                    });
                } else {
                    advices.push({
                        level: 'success',
                        category: 'stress',
                        title: 'ストレス管理が良好です',
                        message: `ストレスレベルが低く保たれています（平均${avgStress.toFixed(0)}）。この生活リズムを維持しましょう。`,
                        tips: []
                    });
                }

                // === ピークストレスのチェック ===
                if (maxStress > 80) {
                    advices.push({
                        level: 'warning',
                        category: 'stress',
                        title: '一時的に高いストレスがありました',
                        message: `最大ストレスレベルは${maxStress}でした。特定の状況でストレスが高まっているようです。`,
                        tips: [
                            'ストレスの原因を特定しましょう',
                            '避けられるストレス要因は減らしましょう',
                            'ストレスを感じたら深呼吸で落ち着きましょう'
                        ]
                    });
                }
            }
        }

        // === ボディバッテリーのチェック ===
        let bodyBatteryValues = null;
        if (stressData.timeOffsetBodyBatteryValues) {
            try {
                bodyBatteryValues = typeof stressData.timeOffsetBodyBatteryValues === 'string'
                    ? JSON.parse(stressData.timeOffsetBodyBatteryValues)
                    : stressData.timeOffsetBodyBatteryValues;
            } catch (e) {
                console.error('  ⚠️ Failed to parse body battery values:', e);
            }
        }

        if (bodyBatteryValues) {
            const validBB = Object.values(bodyBatteryValues).filter(v => v > 0 && v <= 100);
            if (validBB.length > 0) {
                const currentBB = validBB[validBB.length - 1]; // 最新値
                const startBB = validBB[0]; // 開始時
                const minBB = Math.min(...validBB);
                const maxBB = Math.max(...validBB);
                const avgBB = validBB.reduce((a, b) => a + b, 0) / validBB.length;

                console.log('  📊 Body Battery metrics:', {
                    current: currentBB,
                    start: startBB,
                    min: minBB,
                    max: maxBB,
                    avg: avgBB.toFixed(0)
                });

                // === 現在のエネルギーレベル ===
                if (currentBB < 25) {
                    advices.push({
                        level: 'warning',
                        category: 'stress',
                        title: 'エネルギーレベルが低下しています',
                        message: `現在のボディバッテリーは${currentBB}%です。休息が必要です。`,
                        tips: [
                            '今日は早めに就寝しましょう',
                            '昼寝（15-20分）が効果的です',
                            '激しい運動は控えめにしましょう',
                            '水分補給を忘れずに'
                        ]
                    });
                } else if (currentBB >= 25 && currentBB < 50) {
                    advices.push({
                        level: 'info',
                        category: 'stress',
                        title: 'エネルギーが中程度です',
                        message: `ボディバッテリーは${currentBB}%です。適度な休息を取りましょう。`,
                        tips: [
                            '無理をせず、適度に休憩を取りましょう',
                            '質の良い睡眠で回復しましょう'
                        ]
                    });
                } else if (currentBB >= 70) {
                    advices.push({
                        level: 'success',
                        category: 'stress',
                        title: 'エネルギーレベルが高いです',
                        message: `ボディバッテリーは${currentBB}%です。活動的に過ごせます。`,
                        tips: []
                    });
                }

                // === 回復力のチェック ===
                const recovery = currentBB - minBB;
                if (recovery < 20 && minBB < 30) {
                    advices.push({
                        level: 'warning',
                        category: 'stress',
                        title: '回復力が低下しています',
                        message: `エネルギーの回復が十分ではありません（最低${minBB}%から${currentBB}%）。`,
                        tips: [
                            '睡眠の質を見直しましょう',
                            'ストレス源を特定して対処しましょう',
                            '規則正しい生活リズムを心がけましょう'
                        ]
                    });
                }
            }
        }

        return advices;
    },

    /**
     * @func generateOverallAdvice
     * @desc 総合的なアドバイスを生成
     * @param {Object} advices - { sleep: [], activity: [], stress: [] }
     * @param {Object} questionnaireData - アンケート回答データ
     * @return {Array} 総合アドバイスの配列
     */
    generateOverallAdvice: function(advices, questionnaireData) {
        let overall = [];
        
        // 警告レベルのアドバイス数をカウント
        const warningCount = 
            advices.sleep.filter(a => a.level === 'warning').length +
            advices.activity.filter(a => a.level === 'warning').length +
            advices.stress.filter(a => a.level === 'warning').length;

        const successCount = 
            advices.sleep.filter(a => a.level === 'success').length +
            advices.activity.filter(a => a.level === 'success').length +
            advices.stress.filter(a => a.level === 'success').length;

        console.log('  📊 Overall metrics:', {
            warnings: warningCount,
            successes: successCount
        });

        // === 複数の問題がある場合 ===
        if (warningCount >= 3) {
            overall.push({
                level: 'warning',
                title: '生活習慣の見直しが必要です',
                message: '複数の項目で改善が必要です。焦らず、まずは1つずつ取り組んでいきましょう。',
                priority: [
                    '1. 十分な睡眠時間の確保（7時間以上）',
                    '2. 適度な運動習慣（1日8,000歩）',
                    '3. ストレス管理とリラックスタイム'
                ]
            });
        } 
        // === 少し問題がある場合 ===
        else if (warningCount >= 1) {
            overall.push({
                level: 'info',
                title: 'もう少しで理想的な状態です',
                message: `${warningCount}つの項目で改善の余地があります。少しずつ改善していきましょう。`,
                priority: []
            });
        }
        // === 全て良好な場合 ===
        else if (warningCount === 0 && successCount >= 2) {
            overall.push({
                level: 'success',
                title: '素晴らしい健康状態です！',
                message: 'すべての指標が良好です。この生活習慣を継続しましょう。',
                priority: [
                    '現在の良い習慣を維持しましょう',
                    '無理のない範囲で継続することが大切です',
                    '健康的な生活を楽しみましょう'
                ]
            });
        }
        // === データがあまりない場合 ===
        else {
            overall.push({
                level: 'info',
                title: '健康管理を始めましょう',
                message: 'Garminデバイスで日々の健康データを記録し、改善点を見つけましょう。',
                priority: [
                    'まずは現状を把握することから始めましょう',
                    '毎日のデータ記録を習慣化しましょう',
                    '小さな改善の積み重ねが大切です'
                ]
            });
        }

        return overall;
    }
};

export { mainGarminAdvice };