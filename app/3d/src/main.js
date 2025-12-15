// =================================================================================================
// VRM アバター制御メインスクリプト - V12.1 (UI互換性修正版)
// (ポーズ・表情制御ロジックを温存し、UI崩れ/DOMエラーを解消する初期化処理を修正)
// =================================================================================================

import * as THREE from 'three';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// グローバル変数
let currentVrm = null;
let renderer;
let camera;
let scene;
let controls;
let clock;
let isDragging = false;
let raycaster;
let mouse;

// アバター制御サブオブジェクト
const subAvatar = {
    // ----------------------------------------------------------------------------------
    // 【コアロジック温存】表情をラッセル円環モデルに基づいて設定する関数
    // ----------------------------------------------------------------------------------
    setExpression: (stressLevel, bodyBattery) => {
        if (!currentVrm) return;

        // Garminデータに基づいて快/不快と覚醒度を決定
        // (ここでは仮のロジック。V12.0ロジックをそのまま使用)
        const excitement = (100 - bodyBattery) / 100; // 低BBほど高覚醒/不快に近づける
        const pleasure = (100 - stressLevel) / 100; // 低ストレスほど快に近づける (0~1)

        // V12.0: ラッセル円環モデルに準拠したウェイト計算
        const weights = {
            // 快 (Pleasure)
            'joy': Math.max(0, pleasure * 0.5),      // 覚醒度を抑えるため 0.5 に制限
            'fun': Math.max(0, pleasure * 0.5),

            // 不快 (Displeasure)
            'sad': Math.max(0, 1 - pleasure),

            // 高覚醒 (Excitement) - 警告回避のためウェイトを0にするか、他の表情に置き換える
            'angry': 0, // ネガティブフィードバック回避
            'surprise': Math.max(0, excitement * 0.5),

            // 低覚醒 (Calmness / Fatigue)
            'sleep': Math.max(0, 1 - excitement),
            'blink': Math.max(0, excitement * 0.7) // 低BB/高ストレス時 (疲労/休息の訴え)
        };

        // V12.0: ウェイトをVRMに適用
        Object.keys(weights).forEach(key => {
            currentVrm.expressionManager.setValue(key, weights[key]);
        });

        currentVrm.expressionManager.update();
    },

    // ----------------------------------------------------------------------------------
    // 【コアロジック温存】ポーズを調整する関数
    // ----------------------------------------------------------------------------------
    setPose: (poseType) => {
        if (!currentVrm) return;

        // V12.0: ポーズロジックをそのまま維持 (例: calm, energeticなど)
        // ここにポーズ調整ロジック（LookAt、Bone操作など）を記述
    }
};

// =================================================================================================
// 1. 初期化処理
// =================================================================================================

/**
 * Three.js環境とアバタービューポートを初期化
 */
function initialize() {
    console.log('--- Sub Avatar Init V12.1 ---');
    clock = new THREE.Clock();

    // ----------------------------------------------------------
    // 【修正箇所 1】 DOM要素の取得
    // ----------------------------------------------------------
    const viewport = document.getElementById('avatarViewportWearable');
    const button = document.getElementById('btnLoadAvatarWearable');
    const fileInput = document.getElementById('fileAvatarInputWearable');

    if (!viewport) {
        console.error('❌ DOM Init Error: avatarViewportWearable not found in DOM.');
        return;
    }
    if (!button || !fileInput) {
        console.error('❌ Avatar Button Check: Buttons or Input not found in DOM.');
        // エラーを吐きつつ続行する場合があるため return はしない
    }

    // シーンのセットアップ
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, viewport.clientWidth / viewport.clientHeight, 0.1, 20);
    camera.position.set(0, 1.05, 2.1);

    // ライティング (アバター設計指針に沿った穏やかなライティング)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // レンダラーのセットアップ
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;

    // レンダラーDOMの挿入
    if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    viewport.appendChild(renderer.domElement);

    // コントロールのセットアップ
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.8, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 0.5;
    controls.maxDistance = 3;
    controls.enablePan = false; // PC上の操作を制限
    controls.enableZoom = false; // PC上の操作を制限

    // Raycaster初期化 (タッチ操作用)
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // GLTFLoader に VRMLoaderPlugin を登録
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    // イベントリスナー
    window.addEventListener('resize', onWindowResize);
    setupEventListeners(button, fileInput, loader);

    // 初期VRMロード (必要な場合)
    // loadInitialVrm(loader);

    // アニメーションループ開始
    animate();
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners(button, fileInput, loader) {
    if (button && fileInput) {
        // ----------------------------------------------------------
        // 【修正箇所 2】 ボタンとファイルインプットの連携
        // ----------------------------------------------------------
        button.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const url = URL.createObjectURL(file);
            loadVrm(url, loader);
        });
    }

    // マウス/タッチイベントリスナー (ポーズ調整などに利用)
    // ここにマウス・タッチイベントロジックを追加
    renderer.domElement.addEventListener('mousedown', () => isDragging = false, false);
    renderer.domElement.addEventListener('mousemove', () => isDragging = true, false);
    renderer.domElement.addEventListener('mouseup', onAvatarClick, false);
    renderer.domElement.addEventListener('touchstart', (event) => {
        isDragging = false;
        // タッチ座標を mouse.x, mouse.y に格納するロジック...
    }, false);
    renderer.domElement.addEventListener('touchend', onAvatarClick, false);
}

/**
 * VRMファイルをロードする
 */
function loadVrm(url, loader) {
    // プレースホルダーを隠し、ローディングインジケータを表示するロジック
    document.getElementById('avatarPlaceholderWearable')?.classList.add('none');
    document.getElementById('avatarLoadingWearable')?.classList.remove('none');

    loader.load(
        url,
        (gltf) => {
            const vrm = gltf.userData.vrm;

            // 既存VRMのクリーンアップ
            if (currentVrm) {
                scene.remove(currentVrm.scene);
                VRMUtils.deepDispose(currentVrm.scene);
            }

            currentVrm = vrm;
            scene.add(currentVrm.scene);

            // Hipsを基準にしたサイズ調整とカメラ設定 (以前のロジックを維持)
            VRMUtils.removeUnnecessaryJoints(vrm.scene);

            // V12.0: LookAt制御を有効化
            vrm.lookAt.target = camera;

            // ローディング終了後の処理
            document.getElementById('avatarLoadingWearable')?.classList.add('none');
        },
        (progress) => {
            // ローディング中の進捗表示ロジック
            // console.log('Loading VRM:', Math.round(progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
            console.error('VRMロードエラー:', error);
            // エラー時の処理
            document.getElementById('avatarLoadingWearable')?.classList.add('none');
            document.getElementById('avatarPlaceholderWearable')?.classList.remove('none');
        }
    );
}

// ----------------------------------------------------------
// その他のイベントやヘルパー関数
// ----------------------------------------------------------

function onWindowResize() {
    const viewport = document.getElementById('avatarViewportWearable');
    if (viewport) {
        const width = viewport.clientWidth;
        const height = viewport.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
}

function onAvatarClick(event) {
    if (!currentVrm) return;
    if (isDragging) return; // ドラッグ操作だった場合は無視

    // クリックされた場合の特別なアクションロジック (例: ポーズ切り替え)
    console.log('Avatar Clicked.');
    // raycastingロジックをここに実装
}

// =================================================================================================
// 2. アニメーションループ
// =================================================================================================

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // VRMの更新
    if (currentVrm) {
        currentVrm.update(delta);
    }

    controls.update(); // コントロールの更新
    renderer.render(scene, camera);
}

// ----------------------------------------------------------
// 外部からの呼び出しインターフェース (データ連携用)
// ----------------------------------------------------------

// 外部JSファイルから呼び出される関数
window.updateAvatarState = (stressLevel, bodyBattery) => {
    // データを受信し、表情ロジックを起動
    subAvatar.setExpression(stressLevel, bodyBattery);

    // ポーズの調整ロジックを起動 (必要に応じて)
    // subAvatar.setPose(calculatePoseType(stressLevel, bodyBattery));
};

// 起動
document.addEventListener('DOMContentLoaded', initialize);

// 外部にアバター制御オブジェクトを公開 (デバッグ用)
window.subAvatar = subAvatar;
