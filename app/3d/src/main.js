// =================================================================================================
// VRM アバター制御メインスクリプト - V14.6 (初期待機ポーズ導入版)
// 初期ロード状態と低ストレス状態を分離し、ユーザーの認識を容易にする
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
let mixer; // アニメーションミキサー

// ポーズデータの定義 (角度はラジアン)
const PI = Math.PI;

// 腕を下ろすための基準となる回転値
const ARM_Z_ROTATION = PI * 0.35; // 約 63度

const POSE_DATA = {
    // ----------------------------------------------------------------------------------
    // ★★★ 肘の軸特定テスト: initialAwaiting (ロード直後に適用されます) ★★★
    // ----------------------------------------------------------------------------------
    // ----------------------------------------------------------------------------------
    // ★ 初期待機ポーズ (お腹に手を当てる：自己への意識と安心感の醸成)
    // ----------------------------------------------------------------------------------
    // ----------------------------------------------------------------------------------
    // ★★★ 肘の軸特定テスト: initialAwaiting (ロード直後に適用されます) ★★★
    // ----------------------------------------------------------------------------------
    'initialAwaiting': {
        'spine': { x: 0.02 },
        'chest': { x: 0.0 },

        // 腕を下げた状態にする (検証しやすくするため)
        'rightUpperArm': { z: ARM_Z_ROTATION, x: PI * 0.01 },
        'leftUpperArm': { z: PI * -0.45,x: -0.3,y: -0.8},

        // ★ 手首（Hand）を追加して、手の平をお腹の方に向ける
        // y または z を動かして「添える」感じにします
       // 'rightHand': { y: -0.6 ,x: -0.9,z: 0.5 },
        'leftHand': { y: 0.6 ,x: -0.9,z: -0.5 },

        // ★★★ 肘のテスト
       // 'rightLowerArm': { y:1.8,x:0.3 },
        'leftLowerArm': { y:-2.0,x:-0.3 },


    },
    // ----------------------------------------------------------------------------------
    // A. 低ストレス (Low Arousal / Positive Valence) - データ受信後の基準姿勢 (両腕垂下)
    // ----------------------------------------------------------------------------------
    'lowStress': {
        // 体幹: ニュートラル
        'spine': { x: PI * 0.002 },
        'chest': { x: PI * 0.002 },

        // 腕: 符号を反転させた、自然な垂下ポーズ
        'rightUpperArm': { z: ARM_Z_ROTATION, x: PI * 0.01 },
        'leftUpperArm': { z: -ARM_Z_ROTATION, x: PI * 0.01 },
    },

    // ----------------------------------------------------------------------------------
    // B. 中ストレス (Low Arousal / Negative Valence) - 疲労・脱力
    // ----------------------------------------------------------------------------------
    'midStress': {
        // 体幹: 疲労によるわずかな前屈（重力に負ける）
        'spine': { x: PI * 0.008 },
        'chest': { x: PI * 0.005 },

        // 肩: 強く下げる（脱力・重さを表現）
        'rightUpperArm': { z: ARM_Z_ROTATION, x: PI * 0.01 },
        'leftUpperArm': { z: -ARM_Z_ROTATION, x: PI * 0.01 },


        // ポーズはデフォルトのまま、表情に注力
        'blendShape': {
        'Angry': 0.55,  // わずかな眉間の緊張（高覚醒・不快）
        'Sorrow': 0.40, // 疲労のニュアンスを追加
        'Blink': 0.25,   // 目は開けておく（まだ活動中）
        'Joy': 0.0,
        'Fun': 0.0
    }

    },


    // ----------------------------------------------------------------------------------
    // C. 高ストレス (High Arousal / Negative Valence) - 緊張・硬直
    // ----------------------------------------------------------------------------------
    'highStress': {
        // 体幹: 緊張による硬直
        'spine': { x: PI * 0.008 },
        'chest': { x: PI * 0.005 },

        // 肩: 強く上げる（緊張・硬直を表現）
        'rightUpperArm': { z: ARM_Z_ROTATION, x: PI * 0.01 },
        'leftUpperArm': { z: -ARM_Z_ROTATION, x: PI * 0.01 },

        //表情関係のロジック
        'blendShape': {
        'Blink': 1.0,   // 完全閉眼：外界をシャットダウン
        'Sorrow': 0.85,  // 深い悲しみ：エネルギーの枯渇を代弁
        'Angry': 0.15,  // 抵抗の放棄：怒る気力もない状態
        'U': 0.20       // わずかな脱力：溜息や呼吸の浅さを演出
    }
    }
};

// アバター制御サブオブジェクト
const subAvatar = {
    // ----------------------------------------------------------------------------------
    // 【Valence軸】表情設定 (不快度)
    // ----------------------------------------------------------------------------------
    setExpression: (stressLevel) => {
        if (!currentVrm) return;
        const manager = currentVrm.expressionManager;

        // --- 1. 計算用の重み（ウェイト）を作成 ---

        // 中ストレス重み (40〜80で 0.0〜1.0 に変化)
        let midWeight = Math.max(0, (stressLevel - 40) / 40);

        // 高ストレス重み (80〜100で 0.0〜1.0 に変化)
        let highWeight = Math.max(0, (stressLevel - 80) / 20);

        // --- 2. ブレンドシェイプの適用 ---

        // 眉間の緊張 (Angry): 中ストレスで最大になり、高ストレス（閉眼時）は少し脱力させる
        const angryVal = Math.min(0.6, midWeight) * (1.0 - highWeight * 0.5);
        manager.setValue('angry', angryVal);

        // 苦しみ・悲しみ (Sad): ストレスが上がるほど「眉が下がって辛そう」にする
        const sadVal = Math.min(1.0, midWeight + highWeight);
        manager.setValue('sad', sadVal);

        // 休息のシャットダウン (Blink): 80を超えたら「目を閉じる」
        // これが「終わってる」を表現する最大のトリガー
        manager.setValue('blink', highWeight);

        // わずかな脱力口 (U): 高ストレス時に溜息をつくような口元にする（オプション）
        if (manager.getExpression('u')) {
            manager.setValue('u', highWeight * 0.2);
        }

        // --- 3. 反映 ---
        manager.update();

        console.log(`[Expression Sync] Stress: ${stressLevel} | Angry: ${angryVal.toFixed(2)} | Sad: ${sadVal.toFixed(2)} | Blink: ${highWeight.toFixed(2)}`);
    },

    // ----------------------------------------------------------------------------------
    // 【Arousal軸】ポーズ設定 (緊張/弛緩)
    // ----------------------------------------------------------------------------------
    setPose: (poseName) => {
        if (!currentVrm || !mixer) return;

        const targetPose = POSE_DATA[poseName] || POSE_DATA['initialAwaiting'];
        const tracks = [];
        const humanoid = currentVrm.humanoid;

        // LookAt 制御を完全に無効化 (静的維持のため)
        currentVrm.lookAt.target = null;

        // Hipsボーンを取得
        const hips = humanoid.getNormalizedBoneNode('hips');

        // Hipsの位置は原則変更しない (立ち姿勢を維持)
        const HIPS_DEFAULT_Y = 0.8;
        if (hips) {
            hips.position.y = HIPS_DEFAULT_Y;
        }

        // ポーズアニメーションデータの生成
        Object.keys(targetPose).forEach(boneName => {
            const rotations = targetPose[boneName];
            const node = humanoid.getNormalizedBoneNode(boneName);

            if (node) {
                const targetQuaternion = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(rotations.x || 0, rotations.y || 0, rotations.z || 0, node.rotation.order)
                );

                const trackName = `${node.name}.quaternion`;
                const times = [0, 0.5]; // 0.5秒かけてポーズに移行
                const values = [
                    node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w,
                    targetQuaternion.x, targetQuaternion.y, targetQuaternion.z, targetQuaternion.w
                ];

                tracks.push(new THREE.QuaternionKeyframeTrack(trackName, times, values));
            }
        });

        if (tracks.length > 0) {
            mixer.stopAllAction();

            const clip = new THREE.AnimationClip(`pose_${poseName}`, 0.5, tracks);
            const action = mixer.clipAction(clip);

            action.setLoop(THREE.LoopOnce);
            action.clampWhenFinished = true;
            action.enable = true;

            // アニメーション終了時のリスナーを追加し、ボーン値を手動で固定
            mixer.addEventListener('finished', function onFinished(e) {
                Object.keys(targetPose).forEach(boneName => {
                    const rotations = targetPose[boneName];
                    const bone = humanoid.getNormalizedBoneNode(boneName);
                    if (bone) {
                        bone.rotation.set(rotations.x || 0, rotations.y || 0, rotations.z || 0, bone.rotation.order);
                    }
                });

                // Hipsの位置も再度固定 (0.8に維持)
                if (hips) {
                    hips.position.y = HIPS_DEFAULT_Y;
                }

                mixer.removeEventListener('finished', onFinished);
            });

            action.play();
        }

        currentVrm.update(0);
    }
};

// =================================================================================================
// 1. 初期化処理 (変更なし)
// =================================================================================================

function initialize() {
    console.log('--- Sub Avatar Init V14.6 (Initial Awaiting Introduced) ---');
    clock = new THREE.Clock();

    const viewport = document.getElementById('avatarViewportWearable');
    const button = document.getElementById('btnLoadAvatarWearable');
    const fileInput = document.getElementById('fileAvatarInputWearable');

    if (!viewport) { console.error('❌ DOM Init Error.'); return; }

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, viewport.clientWidth / viewport.clientHeight, 0.1, 20);
    camera.position.set(0, 1.45, 0.8);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;

    if (renderer.domElement.parentNode) { renderer.domElement.parentNode.removeChild(renderer.domElement); }
    viewport.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.45, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 0.5;
    controls.maxDistance = 3;
    controls.enablePan = false;
    controls.enableZoom = false;

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    window.addEventListener('resize', onWindowResize);
    setupEventListeners(button, fileInput, loader);

    animate();
}

function setupEventListeners(button, fileInput, loader) {
    if (button && fileInput) {
        button.addEventListener('click', () => { fileInput.click(); });
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            loadVrm(url, loader);
        });
    }

    renderer.domElement.addEventListener('mousedown', () => isDragging = false, false);
    renderer.domElement.addEventListener('mousemove', () => isDragging = true, false);
    renderer.domElement.addEventListener('mouseup', onAvatarClick, false);
    renderer.domElement.addEventListener('touchend', onAvatarClick, false);
}

function loadVrm(url, loader) {
    document.getElementById('avatarPlaceholderWearable')?.classList.add('none');
    document.getElementById('avatarLoadingWearable')?.classList.remove('none');

    loader.load(
        url,
        (gltf) => {
            const vrm = gltf.userData.vrm;

            if (currentVrm) { scene.remove(currentVrm.scene); VRMUtils.deepDispose(currentVrm.scene); }

            currentVrm = vrm;


            console.log("ボーン名リスト:", vrm.humanoid.humanBones);

            scene.add(currentVrm.scene);

            mixer = new THREE.AnimationMixer(vrm.scene);
            VRMUtils.removeUnnecessaryJoints(vrm.scene);

            vrm.lookAt.target = null;

            document.getElementById('avatarLoadingWearable')?.classList.add('none');

            const viewport = document.getElementById('avatarViewportWearable');
            if (viewport && renderer && camera) {
                renderer.setSize(viewport.clientWidth, viewport.clientHeight);
                camera.aspect = viewport.clientWidth / viewport.clientHeight;
                camera.updateProjectionMatrix();

                currentVrm.update(0);
                // ★★★ 変更点: 初期待機ポーズを設定 ★★★
                subAvatar.setPose('initialAwaiting');
                renderer.render(scene, camera);
            }

        },
        (progress) => { /* ロード進捗 */ },
        (error) => {
            console.error('VRMロードエラー:', error);
            document.getElementById('avatarLoadingWearable')?.classList.add('none');
            document.getElementById('avatarPlaceholderWearable')?.classList.remove('none');
        }
    );
}

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
    if (isDragging) return;
    console.log('Avatar Clicked.');
}

// =================================================================================================
// 2. アニメーションループ (変更なし)
// =================================================================================================

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (currentVrm) {
        currentVrm.update(delta);
    }

    if (mixer) {
        mixer.update(delta);
    }

    controls.update();
    renderer.render(scene, camera);
}

// ----------------------------------------------------------
// 外部からの呼び出しインターフェース (データ連携用)
// ----------------------------------------------------------

/**
 * 外部JSファイルから呼び出される関数 (メインの制御ロジック)
 * @param {number} stressLevel 0-100
 */
window.updateAvatarState = (stressLevel) => {
    // 1. 表情の更新 (Valence軸)
    subAvatar.setExpression(stressLevel);

    // 2. ポーズの切り替えロジック (Arousal軸と連動)
    let poseName = 'lowStress'; // データが来た後のデフォルトは lowStress

    const HIGH_THRESHOLD = 80;
    const MID_THRESHOLD = 40;

    if (stressLevel >= HIGH_THRESHOLD) {
        poseName = 'highStress'; // 高覚醒・高不快
    } else if (stressLevel >= MID_THRESHOLD) {
        poseName = 'midStress'; // 低覚醒・中不快 (疲労)
    } else {
        poseName = 'lowStress'; // 低覚醒・快適 (基準)
    }

    // ポーズの適用 (Arousal軸の表現)
    subAvatar.setPose(poseName);

    // 3. フィードバックメッセージと行動トリガーの決定
    let feedbackMessage = "";
    let actionTrigger = "";

    if (poseName === 'highStress') {
        feedbackMessage = `【高ストレス状態】${new Date().toLocaleTimeString()}：強い緊張と不快感を示しています。`;
        actionTrigger = ">> **【行動】深呼吸や環境変更が必要です。**";
    } else if (poseName === 'midStress') {
        feedbackMessage = `【中ストレス状態】${new Date().toLocaleTimeString()}：疲労が蓄積し、エネルギーが低下しています。`;
        actionTrigger = ">> **【行動】短い休憩や水分補給を推奨します。**";
    } else {
        feedbackMessage = `【低ストレス状態】${new Date().toLocaleTimeString()}：安定した快適な状態です。`;
        actionTrigger = ">> **【行動】この良い状態を維持しましょう。**";
    }

    // 4. コンソールに出力 (これまで通り)
    console.log("--- アバターからのフィードバック ---");
    console.log(`ストレス値: ${stressLevel}, ポーズ名: ${poseName}`);
    console.log(feedbackMessage);
    console.log(actionTrigger);
    console.log("----------------------------------");

    // 5. HTML要素への書き出し (開発者ツールで確認)
    const msgElement = document.getElementById('avatarFeedbackMessage');
    const actionElement = document.getElementById('avatarActionTrigger');

    if (msgElement) {
        msgElement.innerHTML = feedbackMessage;
    } else {
        console.warn("⚠️ HTML要素 #avatarFeedbackMessage が見つかりません。DOM構造を確認してください。");
    }

    if (actionElement) {
        actionElement.innerHTML = actionTrigger;
    } else {
        console.warn("⚠️ HTML要素 #avatarActionTrigger が見つかりません。DOM構造を確認してください。");
    }
};

// 起動
document.addEventListener('DOMContentLoaded', initialize);

// 外部にアバター制御オブジェクトを公開 (デバッグ用)
window.subAvatar = subAvatar;
