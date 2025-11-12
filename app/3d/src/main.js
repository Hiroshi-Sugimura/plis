//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2024
//	VRMアバター表示・制御モジュール（Wearableタブ用）
//	多因子統合表情システム実装版
//////////////////////////////////////////////////////////////////////
'use strict';

// Three.jsをimport
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

/**
 * @module subAvatar
 * @desc VRMアバター表示・操作モジュール（Wearableタブ用）
 *       多因子統合表情システム：複数の生理指標を統合し、心身状態を表情として可視化
 */

const subAvatar = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    currentVRM: null,
    clock: new THREE.Clock(),
    autoExpression: false,
    isInitialized: false,
    eventListenersAttached: false,
    expressionUpdateTimer: 0,
    frameCount: 0,
    
    // 【新規】多因子統合表情システム
    currentEmotionState: {
        emotion: 'neutral',
        intensity: 0.5,
        timestamp: Date.now()
    },
    healthMetrics: null, // 最新の健康指標
    transitionSpeed: 0.1 // 表情遷移の滑らかさ（0〜1）
};

/**
 * @func initThreeJS
 * @desc Three.jsの初期化（最適化版）
 */
subAvatar.initThreeJS = function() {
    console.log('🚀 initThreeJS called');
    
    if (this.isInitialized) {
        console.log('⚠️ Three.js already initialized');
        return;
    }

    const viewport = document.getElementById('avatarViewportWearable');
    console.log('🔍 viewport element:', viewport);
    
    if (!viewport) {
        console.error('❌ avatarViewportWearable not found');
        return;
    }

    // 既存のCanvasを削除して新規作成
    const existingCanvas = document.getElementById('avatarCanvasWearable');
    if (existingCanvas) {
        existingCanvas.remove();
        console.log('🗑️ Removed existing canvas');
    }

    // シーン作成
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);
    console.log('✅ Scene created');

    // カメラ設定
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    
    this.camera = new THREE.PerspectiveCamera(
        30,
        width / height,
        0.1,
        100
    );
    this.camera.position.set(0, 1.4, 2.5);
    console.log('✅ Camera created');
    console.log('📏 Viewport size:', width, 'x', height);

    // レンダラー設定（GPU負荷最小化）
    this.renderer = new THREE.WebGLRenderer({ 
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
        precision: 'lowp',
        stencil: false,
        depth: true,
        preserveDrawingBuffer: false
    });
    
    // 先にサイズを設定してからDOMに追加
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.sortObjects = false;
    
    // CanvasにIDを設定
    this.renderer.domElement.id = 'avatarCanvasWearable';
    
    // DOMに追加
    viewport.appendChild(this.renderer.domElement);
    
    console.log('✅ Renderer created');
    console.log('📏 Canvas size:', this.renderer.domElement.width, 'x', this.renderer.domElement.height);

    // ライト設定
    const ambientLight = new THREE.AmbientLight(0x888888);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
    console.log('✅ Lights added');

    // グリッド表示（色を明るくして見やすく）
    const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0x444444);
    this.scene.add(gridHelper);
    console.log('✅ Grid helper added');

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.target.set(0, 1.0, 0);
    this.controls.update();
    console.log('✅ OrbitControls initialized');

    // リサイズ対応
    const resizeObserver = new ResizeObserver(() => {
        const w = viewport.clientWidth;
        const h = viewport.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        console.log('📏 Resized:', w, 'x', h);
    });
    resizeObserver.observe(viewport);
    console.log('✅ ResizeObserver attached');

    this.isInitialized = true;

    // アニメーションループ開始
    this.animate();

    console.log('✅ Three.js initialized (Wearable tab)');
    
    // 初回レンダリングを強制実行
    this.renderer.render(this.scene, this.camera);
    console.log('✅ Initial render executed');
};

/**
 * @func animate
 * @desc アニメーションループ（表情更新を追加）
 */
subAvatar.animate = function() {
    if (!this.isInitialized) return;

    requestAnimationFrame(() => this.animate());

    const deltaTime = this.clock.getDelta();

    // フレームレート制限（20fps）
    if (deltaTime < 1/20) return;

    // VRMアップデート
    if (this.currentVRM) {
        this.currentVRM.update(deltaTime);
        
        // 自動表情変化（5秒に1回更新）
        if (this.autoExpression) {
            this.expressionUpdateTimer = (this.expressionUpdateTimer || 0) + deltaTime;
            if (this.expressionUpdateTimer >= 5.0) {
                this.autoUpdateExpression();
                this.expressionUpdateTimer = 0;
            }
        }
    }

    this.renderer.render(this.scene, this.camera);
    
    // 統計情報を手動リセット
    if (this.frameCount % 60 === 0) {
        this.renderer.info.reset();
    }
    this.frameCount = (this.frameCount || 0) + 1;
};

/**
 * @func loadVRM
 * @desc VRMファイルを読み込む（最適化版）
 * @param {File} file - VRMファイル
 */
subAvatar.loadVRM = function(file) {
    console.log('📂 Loading VRM file:', file.name);

    const loadingIndicator = document.getElementById('avatarLoadingWearable');
    const placeholder = document.getElementById('avatarPlaceholderWearable');
    
    if (loadingIndicator) loadingIndicator.classList.remove('none');
    if (placeholder) placeholder.classList.add('none');

    const reader = new FileReader();
    reader.onload = (event) => {
        const arrayBuffer = event.target.result;

        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));

        loader.parse(
            arrayBuffer,
            '',
            (gltf) => {
                const vrm = gltf.userData.vrm;

                // 既存のVRMを削除
                if (this.currentVRM) {
                    this.scene.remove(this.currentVRM.scene);
                    this.disposeVRM(this.currentVRM);
                }

                // 新しいVRMを追加
                this.currentVRM = vrm;
                
                // モデルの品質を下げる（テクスチャ圧縮）
                vrm.scene.traverse((obj) => {
                    if (obj.isMesh) {
                        // マテリアルの最適化
                        if (obj.material) {
                            obj.material.precision = 'lowp';
                        }
                        // テクスチャの最適化
                        if (obj.material && obj.material.map) {
                            obj.material.map.minFilter = THREE.LinearFilter;
                            obj.material.map.magFilter = THREE.LinearFilter;
                            obj.material.map.generateMipmaps = false;
                        }
                        // フラストラムカリングを有効化
                        obj.frustumCulled = true;
                    }
                });

                // VRMUtilsを使用して回転を修正
                VRMUtils.rotateVRM0(vrm);

                this.scene.add(vrm.scene);

                // カメラ位置を調整
                this.resetCamera();

                // ファイル名表示
                const fileNameSpan = document.getElementById('avatarFileNameWearable');
                if (fileNameSpan) {
                    fileNameSpan.textContent = file.name;
                }

                if (loadingIndicator) loadingIndicator.classList.add('none');
                console.log('✅ VRM loaded successfully (Wearable tab)');
                
                // 利用可能な表情をログ出力
                if (vrm.expressionManager) {
                    console.log('😊 Available expressions:');
                    vrm.expressionManager.expressions.forEach(exp => {
                        console.log(`  - ${exp.expressionName}`);
                    });
                }
            },
            (error) => {
                console.error('❌ VRM load error:', error);
                if (loadingIndicator) loadingIndicator.classList.add('none');
                if (placeholder) placeholder.classList.remove('none');
                alert('VRMファイルの読み込みに失敗しました。');
            }
        );
    };

    reader.readAsArrayBuffer(file);
};

/**
 * @func disposeVRM
 * @desc VRMのメモリを解放
 * @param {VRM} vrm
 */
subAvatar.disposeVRM = function(vrm) {
    if (!vrm) return;
    
    vrm.scene.traverse((obj) => {
        if (obj.isMesh) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(mat => this.disposeMaterial(mat));
                } else {
                    this.disposeMaterial(obj.material);
                }
            }
        }
    });
};

/**
 * @func disposeMaterial
 * @desc マテリアルのメモリを解放
 * @param {Material} material
 */
subAvatar.disposeMaterial = function(material) {
    if (!material) return;
    
    // テクスチャを破棄
    Object.keys(material).forEach(prop => {
        if (material[prop] && typeof material[prop].dispose === 'function') {
            material[prop].dispose();
        }
    });
    
    material.dispose();
};

/**
 * @func resetCamera
 * @desc カメラ位置をリセット
 */
subAvatar.resetCamera = function() {
    this.camera.position.set(0, 1.4, 2.5);
    this.controls.target.set(0, 1.0, 0);
    this.controls.update();
    console.log('📷 Camera reset');
};

/**
 * @func toggleAutoExpression
 * @desc 自動表情変化のON/OFF
 */
subAvatar.toggleAutoExpression = function() {
    this.autoExpression = !this.autoExpression;
    const statusSpan = document.getElementById('autoExpressionStatusWearable');
    if (statusSpan) {
        statusSpan.textContent = this.autoExpression ? 'ON' : 'OFF';
    }
    
    // ONにした直後に1回実行
    if (this.autoExpression) {
        this.autoUpdateExpression();
    }
    
    console.log(`😊 Auto expression: ${this.autoExpression ? 'ON' : 'OFF'}`);
};

// ========================================
// 多因子統合表情システム
// ========================================

/**
 * @func getLatestGarminData
 * @desc localStorageから最新のGarminデータを取得
 * @returns {Object|null} Garminデータ
 */
subAvatar.getLatestGarminData = function() {
    try {
        const garminDataStr = localStorage.getItem('garminData');
        if (!garminDataStr) return null;
        
        const garminData = JSON.parse(garminDataStr);
        
        // データ構造を整形して返す（小文字のキーに対応）
        const result = {
            steps: garminData.dailies?.totalSteps,
            stressAverage: garminData.dailies?.stressAverage,
            restingHeartRate: garminData.dailies?.restingHeartRate,
            maxHeartRate: garminData.dailies?.maxHeartRate,
            averageHeartRate: garminData.dailies?.averageHeartRate,
            sleepTimeSeconds: garminData.sleeps?.sleepTimeSeconds,
            deepSleepSeconds: garminData.sleeps?.deepSleepSeconds,
            remSleepSeconds: garminData.sleeps?.remSleepSeconds,
            activeTimeSeconds: garminData.dailies?.activeTimeSeconds,
            bodyBatteryCharged: garminData.dailies?.bodyBatteryChargedValue,
            bodyBatteryDrained: garminData.dailies?.bodyBatteryDrainedValue,
            totalKilocalories: garminData.dailies?.totalKilocalories,
            averageSpO2: garminData.sleeps?.averageSpO2,
            lowestSpO2: garminData.sleeps?.lowestSpO2,
            stressDetails: garminData.stressDetails // 時系列ストレスデータ
        };
        
        return result;
    } catch (error) {
        console.error('❌ Failed to parse Garmin data:', error);
        return null;
    }
};

/**
 * @func normalizeMetrics
 * @desc 各生理指標を0〜100のスコアに正規化
 * @param {Object} data - 生データ
 * @returns {Object} 正規化されたスコア
 */
subAvatar.normalizeMetrics = function(data) {
    const metrics = {};
    
    // 1. ストレススコア（低いほど良い: 0-100 → 100-0）
    if (data.stressAverage !== undefined && data.stressAverage !== null) {
        metrics.stress = {
            score: 100 - data.stressAverage, // 逆転（ストレス低い = スコア高い）
            raw: data.stressAverage,
            weight: 0.3, // 重み: 30%
            label: 'ストレス'
        };
    }
    
    // 2. 睡眠スコア（7-9時間を100点とする）
    if (data.sleepTimeSeconds !== undefined && data.sleepTimeSeconds !== null) {
        const sleepHours = data.sleepTimeSeconds / 3600;
        let sleepScore;
        
        if (sleepHours >= 7 && sleepHours <= 9) {
            sleepScore = 100; // 理想的
        } else if (sleepHours >= 6 && sleepHours < 7) {
            sleepScore = 70; // やや短い
        } else if (sleepHours < 6) {
            sleepScore = Math.max(0, 40 - (6 - sleepHours) * 10); // 不足（最低0点）
        } else {
            sleepScore = Math.max(0, 70 - (sleepHours - 9) * 10); // 過剰（最低0点）
        }
        
        metrics.sleep = {
            score: sleepScore,
            raw: sleepHours,
            weight: 0.25, // 重み: 25%
            label: '睡眠'
        };
    }
    
    // 3. 活動スコア（歩数ベース: 10,000歩を100点とする）
    if (data.steps !== undefined && data.steps !== null) {
        const activityScore = Math.min(100, (data.steps / 10000) * 100);
        
        metrics.activity = {
            score: activityScore,
            raw: data.steps,
            weight: 0.2, // 重み: 20%
            label: '活動量'
        };
    }
    
    // 4. 心拍スコア（安静時心拍数: 60未満を100点とする）
    if (data.restingHeartRate !== undefined && data.restingHeartRate !== null) {
        let heartScore;
        
        if (data.restingHeartRate < 60) {
            heartScore = 100; // 優秀
        } else if (data.restingHeartRate < 70) {
            heartScore = 80; // 良好
        } else if (data.restingHeartRate < 80) {
            heartScore = 60; // 普通
        } else {
            heartScore = Math.max(0, 60 - (data.restingHeartRate - 80) * 2); // やや高い
        }
        
        metrics.heartRate = {
            score: heartScore,
            raw: data.restingHeartRate,
            weight: 0.15, // 重み: 15%
            label: '心拍数'
        };
    }
    
    // 5. ボディバッテリースコア（充電値を使用）
    if (data.bodyBatteryCharged !== undefined && data.bodyBatteryCharged !== null) {
        metrics.bodyBattery = {
            score: data.bodyBatteryCharged, // そのまま使用（0-100）
            raw: data.bodyBatteryCharged,
            weight: 0.1, // 重み: 10%
            label: 'ボディバッテリー'
        };
    }
    
    return metrics;
};

/**
 * @func calculateOverallScore
 * @desc 正規化された指標から総合スコアを算出
 * @param {Object} metrics - 正規化されたスコア
 * @returns {Object} 総合スコアと詳細
 */
subAvatar.calculateOverallScore = function(metrics) {
    let totalScore = 0;
    let totalWeight = 0;
    const details = [];
    
    Object.keys(metrics).forEach(key => {
        const metric = metrics[key];
        totalScore += metric.score * metric.weight;
        totalWeight += metric.weight;
        
        // 評価文を生成
        let evaluation;
        if (metric.score >= 80) {
            evaluation = '良好';
        } else if (metric.score >= 60) {
            evaluation = '普通';
        } else if (metric.score >= 40) {
            evaluation = 'やや低い';
        } else {
            evaluation = '要注意';
        }
        
        details.push({
            label: metric.label,
            score: Math.round(metric.score),
            raw: metric.raw,
            evaluation
        });
    });
    
    // 正規化（0-100）
    const normalizedScore = totalWeight > 0 ? totalScore / totalWeight : 50;
    
    return {
        overallScore: Math.round(normalizedScore),
        details,
        timestamp: Date.now()
    };
};

/**
 * @func determineEmotion
 * @desc 総合スコアから表情を決定
 * @param {number} score - 総合スコア（0-100）
 * @returns {Object} { emotion, intensity }
 */
subAvatar.determineEmotion = function(score) {
    let emotion, intensity;
    
    if (score >= 80) {
        emotion = 'happy';
        intensity = 1.0; // とても嬉しい
    } else if (score >= 65) {
        emotion = 'happy';
        intensity = 0.6; // 嬉しい
    } else if (score >= 50) {
        emotion = 'neutral';
        intensity = 0.5; // 普通
    } else if (score >= 35) {
        emotion = 'sad';
        intensity = 0.6; // やや悲しい
    } else {
        emotion = 'sad';
        intensity = 1.0; // 悲しい
    }
    
    return { emotion, intensity };
};

/**
 * @func generateAdvice
 * @desc 健康状態に基づいた行動提案を生成
 * @param {Object} result - 総合スコア結果
 * @returns {string} 推奨アクション
 */
subAvatar.generateAdvice = function(result) {
    const advice = [];
    
    result.details.forEach(detail => {
        if (detail.score < 60) {
            switch (detail.label) {
                case 'ストレス':
                    advice.push('深呼吸やストレッチで心を落ち着けましょう');
                    break;
                case '睡眠':
                    advice.push('今日は早めに休息を取りましょう');
                    break;
                case '活動量':
                    advice.push('軽い散歩やストレッチで体を動かしましょう');
                    break;
                case '心拍数':
                    advice.push('リラックスできる時間を持ちましょう');
                    break;
                case 'ボディバッテリー':
                    advice.push('エネルギー回復のため休息が必要です');
                    break;
            }
        }
    });
    
    if (advice.length === 0) {
        advice.push('良好な状態です。このまま健康的な生活を続けましょう！');
    }
    
    return advice.join('、');
};

/**
 * @func autoUpdateExpression
 * @desc 健康データに応じて表情を自動変更（多因子統合版）
 */
subAvatar.autoUpdateExpression = function() {
    if (!this.currentVRM || !this.currentVRM.expressionManager) {
        console.warn('⚠️ VRM or expressionManager not available');
        return;
    }
    
    // 1. Garminデータ取得
    const rawData = this.getLatestGarminData();
    if (!rawData) {
        console.warn('⚠️ No Garmin data available');
        return;
    }
    
    // 2. 指標の正規化
    const metrics = this.normalizeMetrics(rawData);
    
    // 3. 総合スコア算出
    const result = this.calculateOverallScore(metrics);
    this.healthMetrics = result; // 保存してUI表示に使用
    
    // 4. 表情決定
    const targetEmotion = this.determineEmotion(result.overallScore);
    
    // 5. 滑らかな遷移（急激な変化を避ける）
    const currentEmotion = this.currentEmotionState;
    const timeDiff = (Date.now() - currentEmotion.timestamp) / 1000; // 秒
    
    // 時間経過に応じて徐々に目標表情に近づける
    if (currentEmotion.emotion !== targetEmotion.emotion) {
        // 表情が変わる場合、時間をかけて遷移
        if (timeDiff > 2.0) { // 2秒以上経過していれば変更
            this.currentEmotionState = {
                emotion: targetEmotion.emotion,
                intensity: targetEmotion.intensity,
                timestamp: Date.now()
            };
        }
    } else {
        // 同じ表情の場合、強度のみ調整
        const newIntensity = currentEmotion.intensity + 
            (targetEmotion.intensity - currentEmotion.intensity) * this.transitionSpeed;
        this.currentEmotionState.intensity = newIntensity;
    }
    
    // 6. 表情適用
    this.setExpression(this.currentEmotionState);
    
    // 7. 行動提案生成
    const advice = this.generateAdvice(result);
    
    // 8. ログ出力
    console.log('😊 Expression updated:');
    console.log(`  Overall Score: ${result.overallScore}/100`);
    console.log(`  Emotion: ${this.currentEmotionState.emotion} (${Math.round(this.currentEmotionState.intensity * 100)}%)`);
    console.log('  Details:');
    result.details.forEach(d => {
        console.log(`    - ${d.label}: ${d.score}/100 (${d.evaluation}) [raw: ${d.raw}]`);
    });
    console.log(`  Advice: ${advice}`);
    
    // 9. UIに表示（オプション）
    this.updateHealthStatusUI(result, advice);
};

/**
 * @func updateHealthStatusUI
 * @desc 健康状態をUIに表示
 * @param {Object} result - 総合スコア結果
 * @param {string} advice - 行動提案
 */
subAvatar.updateHealthStatusUI = function(result, advice) {
    // TODO: HTMLに健康状態表示エリアを追加する場合、ここで更新
    // 例: document.getElementById('healthStatus').textContent = ...
    
    console.log('📊 Health Status UI update (implementation pending)');
};

/**
 * @func setExpression
 * @desc VRMアバターに表情を設定
 * @param {Object} emotionState - { emotion, intensity }
 */
subAvatar.setExpression = function(emotionState) {
    if (!this.currentVRM || !this.currentVRM.expressionManager) return;
    
    const expressionManager = this.currentVRM.expressionManager;
    
    // 全ての表情をリセット
    expressionManager.expressions.forEach(expression => {
        expressionManager.setValue(expression.expressionName, 0);
    });
    
    // VRM表情名のマッピング
    const expressionMap = {
        'happy': ['happy', 'joy', 'smile'],
        'sad': ['sad', 'sorrow', 'angry'],
        'neutral': ['neutral', 'relaxed']
    };
    
    // 対応する表情を探して設定
    const targetExpressions = expressionMap[emotionState.emotion] || ['neutral'];
    
    for (const targetName of targetExpressions) {
        const expression = expressionManager.expressions.find(exp => 
            exp.expressionName.toLowerCase().includes(targetName)
        );
        
        if (expression) {
            expressionManager.setValue(expression.expressionName, emotionState.intensity);
            console.log(`  ✅ Applied: ${expression.expressionName} = ${Math.round(emotionState.intensity * 100)}%`);
            break;
        }
    }
    
    // まばたき（自然な演出）
    const blinkExpression = expressionManager.expressions.find(exp => 
        exp.expressionName.toLowerCase().includes('blink')
    );
    
    if (blinkExpression && Math.random() < 0.05) { // 5%の確率
        expressionManager.setValue(blinkExpression.expressionName, 1.0);
        setTimeout(() => {
            expressionManager.setValue(blinkExpression.expressionName, 0);
        }, 150);
    }
};

// ========================================
// イベントリスナー
// ========================================

/**
 * @func attachEventListeners
 * @desc イベントリスナーを設定
 */
subAvatar.attachEventListeners = function() {
    console.log('🔗 attachEventListeners called');
    console.log('🔍 eventListenersAttached:', this.eventListenersAttached);
    
    if (this.eventListenersAttached) {
        console.log('⚠️ Event listeners already attached');
        return;
    }

    console.log('🔗 Attaching event listeners...');

    // ファイル選択ボタン
    const btnLoadAvatar = document.getElementById('btnLoadAvatarWearable');
    const fileInput = document.getElementById('fileAvatarInputWearable');

    console.log('🔍 btnLoadAvatar:', btnLoadAvatar);
    console.log('🔍 btnLoadAvatar exists:', !!btnLoadAvatar);
    console.log('🔍 fileInput:', fileInput);
    console.log('🔍 fileInput exists:', !!fileInput);

    if (btnLoadAvatar && fileInput) {
        console.log('✅ Both elements found, attaching listeners...');
        
        btnLoadAvatar.addEventListener('click', (e) => {
            console.log('🖱️ Load button clicked!');
            console.log('🔍 Event:', e);
            console.log('🔍 This:', e.currentTarget);
            console.log('🔍 fileInput:', fileInput);
            fileInput.click();
            console.log('✅ fileInput.click() executed');
        });

        fileInput.addEventListener('change', (event) => {
            console.log('📁 File input changed!');
            console.log('🔍 Event:', event);
            console.log('🔍 Files:', event.target.files);
            
            const file = event.target.files[0];
            console.log('🔍 Selected file:', file);
            
            if (file && file.name.endsWith('.vrm')) {
                console.log('✅ Valid VRM file, loading...');
                this.loadVRM(file);
            } else {
                console.log('❌ Invalid file type');
                alert('VRMファイルを選択してください。');
            }
        });

        console.log('✅ Avatar file input listener attached');
    } else {
        console.error('❌ btnLoadAvatarWearable or fileInput not found');
        console.log('❌ btnLoadAvatar:', btnLoadAvatar);
        console.log('❌ fileInput:', fileInput);
    }

    // カメラリセットボタン
    const btnResetCamera = document.getElementById('btnResetCameraWearable');
    console.log('🔍 btnResetCamera:', btnResetCamera);
    
    if (btnResetCamera) {
        btnResetCamera.addEventListener('click', () => this.resetCamera());
        console.log('✅ Camera reset button listener attached');
    }

    // 自動表情ON/OFFボタン
    const btnToggleAutoExpression = document.getElementById('btnToggleAutoExpressionWearable');
    console.log('🔍 btnToggleAutoExpression:', btnToggleAutoExpression);
    
    if (btnToggleAutoExpression) {
        btnToggleAutoExpression.addEventListener('click', () => this.toggleAutoExpression());
        console.log('✅ Auto expression button listener attached');
    }

    this.eventListenersAttached = true;
    console.log('✅ All event listeners attached, eventListenersAttached set to true');
};

// ========================================
// 初期化
// ========================================

/**
 * @func setupWearableTabListener
 * @desc Wearableタブの切り替えを監視
 */
function setupWearableTabListener() {
    console.log('🔍 setupWearableTabListener called');
    
    const wearableTab = document.getElementById('wearable');
    console.log('🔍 wearableTab:', wearableTab);
    
    if (wearableTab) {
        console.log('✅ Wearable tab found:', wearableTab);
        
        wearableTab.addEventListener('change', function() {
            console.log('📱 Wearable tab change event triggered');
            console.log('🔍 this.checked:', this.checked);
            
            if (this.checked) {
                console.log('📱 Wearable tab activated!');
                
                // 少し遅延させてDOM要素が確実に存在するようにする
                setTimeout(() => {
                    console.log('⏰ setTimeout 200ms - calling attachEventListeners');
                    subAvatar.attachEventListeners();
                }, 200);
                
                setTimeout(() => {
                    console.log('⏰ setTimeout 200ms - calling initThreeJS');
                    subAvatar.initThreeJS();
                }, 200);
            }
        });
        
        console.log('🔍 wearableTab.checked:', wearableTab.checked);
        
        // ページロード時に既にWearableタブがアクティブな場合
        if (wearableTab.checked) {
            console.log('✅ Wearable tab is already active on load');
            setTimeout(() => {
                subAvatar.attachEventListeners();
                subAvatar.initThreeJS();
            }, 300);
        } else {
            console.log('⚠️ Wearable tab is not active on load');
        }
    } else {
        console.log('❌ Wearable tab not found, retrying in 500ms...');
        setTimeout(setupWearableTabListener, 500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('## DOMContentLoaded subAvatar.js');
    console.log('🔍 setupWearableTabListener called');
    setupWearableTabListener();
});

// グローバルにエクスポート
window.subAvatar = subAvatar;
console.log('✅ subAvatar exported to window');
console.log('🔍 window.subAvatar:', window.subAvatar);

export default subAvatar;