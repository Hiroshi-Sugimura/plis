//////////////////////////////////////////////////////////////////////
//	Copyright (C) SUGIMURA Lab. 2024
//	VRMアバター表示・制御モジュール（Wearableタブ用）
//////////////////////////////////////////////////////////////////////
'use strict';

// 【修正】CDNをローカルファイルに変更
import * as THREE from '../libs/three.module.js';
import { OrbitControls } from '../libs/OrbitControls.js';
import { GLTFLoader } from '../libs/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '../libs/three-vrm.module.js';

const subAvatar = {};

let scene, camera, renderer, controls;
let currentVRM = null;
let clock = new THREE.Clock();
let autoExpression = false;
let isInitialized = false;
let eventListenersAttached = false;

/**
 * @func initThreeJS
 * @desc Three.jsの初期化
 */
subAvatar.initThreeJS = function() {
    console.log('🚀 initThreeJS called');
    
    if (isInitialized) {
        console.log('⚠️ Three.js already initialized');
        return;
    }

    const viewport = document.getElementById('avatarViewportWearable');
    console.log('🔍 viewport element:', viewport);
    
    if (!viewport) {
        console.error('❌ avatarViewportWearable not found');
        return;
    }

    // シーン作成
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    console.log('✅ Scene created');

    // カメラ設定
    camera = new THREE.PerspectiveCamera(
        30,
        viewport.clientWidth / viewport.clientHeight,
        0.1,
        100
    );
    camera.position.set(0, 1.4, 2.5);
    console.log('✅ Camera created');

    // レンダラー設定
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    viewport.appendChild(renderer.domElement);
    console.log('✅ Renderer created and appended to viewport');

    // ライト設定
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0x666666);
    scene.add(ambientLight);
    console.log('✅ Lights added');

    // グリッド表示
    const gridHelper = new THREE.GridHelper(10, 10);
    scene.add(gridHelper);
    console.log('✅ Grid helper added');

    // OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.0, 0);
    controls.update();
    console.log('✅ OrbitControls initialized');

    // リサイズ対応
    const resizeObserver = new ResizeObserver(() => {
        const width = viewport.clientWidth;
        const height = viewport.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });
    resizeObserver.observe(viewport);
    console.log('✅ ResizeObserver attached');

    isInitialized = true;

    // アニメーションループ
    subAvatar.animate();

    console.log('✅ Three.js initialized (Wearable tab)');
};

/**
 * @func animate
 * @desc アニメーションループ
 */
subAvatar.animate = function() {
    if (!isInitialized) return;

    requestAnimationFrame(subAvatar.animate);

    const deltaTime = clock.getDelta();

    // VRMアップデート
    if (currentVRM) {
        currentVRM.update(deltaTime);
        
        // 自動表情変化（デモ用）
        if (autoExpression) {
            subAvatar.autoUpdateExpression();
        }
    }

    controls.update();
    renderer.render(scene, camera);
};

/**
 * @func loadVRM
 * @desc VRMファイルを読み込む
 * @param {File} file - VRMファイル
 */
subAvatar.loadVRM = function(file) {
    console.log('📂 Loading VRM file:', file.name);

    const loadingIndicator = document.getElementById('avatarLoadingWearable');
    const placeholder = document.getElementById('avatarPlaceholderWearable');
    
    if (loadingIndicator) loadingIndicator.classList.remove('none');
    if (placeholder) placeholder.classList.add('none');

    const reader = new FileReader();
    reader.onload = function(event) {
        const arrayBuffer = event.target.result;

        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));

        loader.parse(
            arrayBuffer,
            '',
            (gltf) => {
                const vrm = gltf.userData.vrm;

                // 既存のVRMを削除
                if (currentVRM) {
                    scene.remove(currentVRM.scene);
                    VRMUtils.deepDispose(currentVRM.scene);
                }

                // 新しいVRMを追加
                currentVRM = vrm;
                scene.add(vrm.scene);

                // カメラ位置を調整
                subAvatar.resetCamera();

                // ファイル名表示
                const fileNameSpan = document.getElementById('avatarFileNameWearable');
                if (fileNameSpan) {
                    fileNameSpan.textContent = file.name;
                }

                if (loadingIndicator) loadingIndicator.classList.add('none');
                console.log('✅ VRM loaded successfully (Wearable tab)');
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
 * @func resetCamera
 * @desc カメラ位置をリセット
 */
subAvatar.resetCamera = function() {
    camera.position.set(0, 1.4, 2.5);
    controls.target.set(0, 1.0, 0);
    controls.update();
    console.log('📷 Camera reset');
};

/**
 * @func toggleAutoExpression
 * @desc 自動表情変化のON/OFF
 */
subAvatar.toggleAutoExpression = function() {
    autoExpression = !autoExpression;
    const statusSpan = document.getElementById('autoExpressionStatusWearable');
    if (statusSpan) {
        statusSpan.textContent = autoExpression ? 'ON' : 'OFF';
    }
    console.log(`😊 Auto expression: ${autoExpression ? 'ON' : 'OFF'}`);
};

/**
 * @func autoUpdateExpression
 * @desc 健康データに応じて表情を自動変更（未実装・デモ用）
 */
subAvatar.autoUpdateExpression = function() {
    if (!currentVRM || !currentVRM.expressionManager) return;
    
    // TODO: Garminデータやアドバイスに応じて表情を変える
};

/**
 * @func attachEventListeners
 * @desc イベントリスナーを設定
 */
subAvatar.attachEventListeners = function() {
    console.log('🔗 attachEventListeners called');
    console.log('🔍 eventListenersAttached:', eventListenersAttached);
    
    if (eventListenersAttached) {
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
        
        // クリックイベント
        btnLoadAvatar.addEventListener('click', function(e) {
            console.log('🖱️ Load button clicked!');
            console.log('🔍 Event:', e);
            console.log('🔍 This:', this);
            console.log('🔍 fileInput:', fileInput);
            
            try {
                fileInput.click();
                console.log('✅ fileInput.click() executed');
            } catch (error) {
                console.error('❌ Error calling fileInput.click():', error);
            }
        });

        // ファイル選択イベント
        fileInput.addEventListener('change', function(event) {
            console.log('📁 File input changed!');
            console.log('🔍 Event:', event);
            console.log('🔍 Files:', event.target.files);
            
            const file = event.target.files[0];
            console.log('🔍 Selected file:', file);
            
            if (file && file.name.endsWith('.vrm')) {
                console.log('✅ Valid VRM file, loading...');
                subAvatar.loadVRM(file);
            } else {
                console.warn('⚠️ Invalid file selected');
                alert('VRMファイルを選択してください。');
            }
        });

        console.log('✅ Avatar file input listener attached');
    } else {
        console.error('❌ btnLoadAvatarWearable or fileInput not found');
        console.error('❌ btnLoadAvatar:', btnLoadAvatar);
        console.error('❌ fileInput:', fileInput);
    }

    // カメラリセットボタン
    const btnResetCamera = document.getElementById('btnResetCameraWearable');
    console.log('🔍 btnResetCamera:', btnResetCamera);
    
    if (btnResetCamera) {
        btnResetCamera.addEventListener('click', () => {
            console.log('📷 Reset camera button clicked');
            subAvatar.resetCamera();
        });
        console.log('✅ Camera reset button listener attached');
    }

    // 自動表情ON/OFFボタン
    const btnToggleAutoExpression = document.getElementById('btnToggleAutoExpressionWearable');
    console.log('🔍 btnToggleAutoExpression:', btnToggleAutoExpression);
    
    if (btnToggleAutoExpression) {
        btnToggleAutoExpression.addEventListener('click', () => {
            console.log('😊 Toggle expression button clicked');
            subAvatar.toggleAutoExpression();
        });
        console.log('✅ Auto expression button listener attached');
    }

    eventListenersAttached = true;
    console.log('✅ All event listeners attached, eventListenersAttached set to true');
};

// ===== 初期化 =====

// Wearableタブ監視（ページロード時とタブ切り替え時の両方に対応）
function setupWearableTabListener() {
    console.log('🔍 setupWearableTabListener called');
    
    const wearableTab = document.getElementById('wearable');
    console.log('🔍 wearableTab:', wearableTab);
    
    if (wearableTab) {
        console.log('✅ Wearable tab found:', wearableTab);
        console.log('🔍 wearableTab.checked:', wearableTab.checked);
        
        // タブ切り替え時
        wearableTab.addEventListener('change', function() {
            console.log('📱 Wearable tab change event triggered');
            console.log('🔍 this.checked:', this.checked);
            
            if (this.checked) {
                console.log('📱 Wearable tab activated!');
                
                setTimeout(() => {
                    console.log('⏰ setTimeout 200ms - calling attachEventListeners');
                    subAvatar.attachEventListeners();
                    
                    if (!isInitialized) {
                        console.log('⏰ setTimeout 200ms - calling initThreeJS');
                        subAvatar.initThreeJS();
                    } else {
                        console.log('⚠️ Three.js already initialized, skipping initThreeJS');
                    }
                }, 200);
            }
        });
        
        // 既にWearableタブがアクティブな場合
        if (wearableTab.checked) {
            console.log('📱 Wearable tab is already active on load');
            setTimeout(() => {
                console.log('⏰ setTimeout 300ms - initial setup');
                subAvatar.attachEventListeners();
                subAvatar.initThreeJS();
            }, 300);
        } else {
            console.log('⚠️ Wearable tab is not active on load');
        }
    } else {
        console.warn('⚠️ Wearable tab not found, retrying in 500ms...');
        setTimeout(setupWearableTabListener, 500);
    }
}

// DOMContentLoaded後に実行
if (document.readyState === 'loading') {
    console.log('📄 Document is loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('## DOMContentLoaded subAvatar.js');
        setupWearableTabListener();
    });
} else {
    console.log('## Document already loaded, setting up immediately');
    setupWearableTabListener();
}

window.subAvatar = subAvatar;
console.log('✅ subAvatar exported to window');
console.log('🔍 window.subAvatar:', window.subAvatar);