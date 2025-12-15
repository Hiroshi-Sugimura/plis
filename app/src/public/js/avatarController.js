//////////////////////////////////////////////////////////////////////
//  Copyright (C) SUGIMURA Lab. 2023.12.14
//  Garminデータに基づきアバターの表情・アクションを制御するロジック
//  subGarmin.js から呼び出される
//  **カスタム設計指針に基づき、表情キー名を修正済み**
//////////////////////////////////////////////////////////////////////
'use strict'

/**
 * @namespace subAvatarController
 * @desc subGarmin.jsから渡されたデータに基づきアバターを制御する
 */
const subAvatarController = {

    /**
     * @func handleGarminData
     * @desc subGarmin.jsから最新の全Garminデータを受け取り、アバターの制御を行う
     * @param {Object} arg - Garminデータオブジェクト
     * @returns {void}
     */
    handleGarminData: function (arg) {
        // 注: window.subAvatar が main.js で完全にロードされた後に実行されることを想定
        if (!arg || typeof window.subAvatar === 'undefined' || !window.subAvatar.currentVrm) {
            return;
        }

        console.log('## AvatarController: Processing Garmin Data');

        // 1. 睡眠データの処理
        this.processSleep(arg.Sleeps);

        // 2. アクティビティデータの処理
        this.processActivity(arg.Activities);

        // 3. ストレス・ボディバッテリーデータの処理
        this.processStressAndBodyBattery(arg.StressDetails);
    },


    // ===================================================================
    // 制御ロジック
    // ===================================================================

    /**
     * すべての感情表情ウェイトをリセットするヘルパー関数
     */
    _resetAllEmotionExpressions: function() {
        // VRM ExpressionMapに登録されている感情表情をリセット
        window.subAvatar.setExpression('happy', 0.0);
        window.subAvatar.setExpression('sad', 0.0);
        window.subAvatar.setExpression('angry', 0.0);
        window.subAvatar.setExpression('relaxed', 0.0);
        window.subAvatar.setExpression('Surprised', 0.0);
        // neutral/blinkは、制御ロジック内で個別に調整
    },


    /**
     * @func processSleep
     * @desc 睡眠データに基づきアバターの表情を制御
     * @param {Object} sleepData - Sleepsデータ
     */
    processSleep: function (sleepData) {
        if (!sleepData || !sleepData.deepSleepDurationInSeconds) return;

        const deepSleep = (sleepData.deepSleepDurationInSeconds || 0) / 60;
        const lightSleep = (sleepData.lightSleepDurationInSeconds || 0) / 60;
        const remSleep = (sleepData.remSleepInSeconds || 0) / 60;
        const totalSleepMinutes = deepSleep + lightSleep + remSleep;

        // 制御が競合しないように、ここではアクティビティとBBに影響を与えないよう、
        // 強い感情表現に限定する (実際にはBB制御が最終決定権を持つことが多い)

        // 既存のロジックを保持しつつ、キー名を修正
        if (totalSleepMinutes < 300) { // 5時間未満の場合
            // 睡眠不足
            window.subAvatar.setExpression('sad', 0.8);
        } else if (totalSleepMinutes > 480) { // 8時間以上の場合
            // 良好
            window.subAvatar.setExpression('happy', 0.5);
        } else {
            // 標準
            window.subAvatar.setExpression('neutral', 1.0);
        }
    },

    /**
     * @func processActivity
     * @desc 歩数データに基づきアバターの表情を制御
     * @param {Object} activityData - Activitiesデータ
     */
    processActivity: function (activityData) {
        if (!activityData || !activityData.steps) return;

        const steps = activityData.steps || 0;

        // **修正点**: 'fun' を登録キー名の 'relaxed' に変更 (達成度に応じて穏やかな表情を出す)

        if (steps < 8000) {
            // 目標未達: relaxed を進捗に応じて出す
            window.subAvatar.setExpression('relaxed', steps / 8000);
        } else {
            // 達成
            window.subAvatar.setExpression('happy', 1.0);
        }
    },

    /**
     * @func processStressAndBodyBattery
     * @desc ストレス・ボディバッテリーに基づきアバターの表情を制御
     * ***アバター設計の核となる「ネガティブフィードバック回避」ロジックを適用***
     * @param {Object} stressDetails - StressDetailsデータ
     */
    processStressAndBodyBattery: function (stressDetails) {
        if (!stressDetails || !stressDetails.timeOffsetBodyBatteryValues) return;

        // ボディバッテリーデータの解析 (省略なし)
        let bodyBatteryValues = null;
        if (typeof stressDetails.timeOffsetBodyBatteryValues === 'string') {
            try {
                bodyBatteryValues = JSON.parse(stressDetails.timeOffsetBodyBatteryValues);
            } catch (e) { return; }
        } else {
            bodyBatteryValues = stressDetails.timeOffsetBodyBatteryValues;
        }

        const validBodyBatteryData = Object.values(bodyBatteryValues).filter(v => v !== null);
        if (validBodyBatteryData.length === 0) return;

        const currentBB = validBodyBatteryData[validBodyBatteryData.length - 1]; // 最新値

        // 1. 全てリセット
        this._resetAllEmotionExpressions();
        window.subAvatar.setExpression('neutral', 1.0);
        window.subAvatar.setExpression('blink', 0.0); // まばたきをリセット

        // 2. ユーザーカスタム指示に基づいた制御ロジック
        if (currentBB < 20) {
            // BB危険域: 「ストレスが高い状態だが、まだ回復は可能」のメッセージを視覚化
            // * 感情の覚醒度を抑える: sad 0.7 ではなく、穏やかな疲労表現へ
            // * 警告色を避けて休息の必要性を訴える

            // 表情制御：疲労感 (sad 0.1) と、休息を促す穏やかさ (relaxed 0.3) を組み合わせる
            window.subAvatar.setExpression('sad', 0.1);
            window.subAvatar.setExpression('relaxed', 0.3);

            // 休息の必要性: 軽く目を閉じることで、視覚的に「休息の必要性」を訴える
            window.subAvatar.setExpression('blink', 0.3);

            // メッセージ例 (コンソールログ)
            console.warn(`[Avatar Controller] WARNING: あなたのエネルギーは回復が必要です (BB=${currentBB})。`);
            console.warn("まだ回復は可能。今すぐ、最も簡単な行動（休憩など）を検討してください。");

            // ポーズ制御 (実装されていれば)
            // window.subAvatar.setPose(RELAXED_POSE);

        } else if (currentBB < 50) {
            // BB低い状態: 現状の描写と未来への指針のバランス

            // わずかな疲労感
            window.subAvatar.setExpression('sad', 0.1);
            window.subAvatar.setExpression('neutral', 0.0); // ニュートラルを少し解除

        } else if (currentBB > 80) {
            // BBが高い状態: 肯定的な表現
            window.subAvatar.setExpression('happy', 0.8);
            window.subAvatar.setExpression('neutral', 0.0); // ニュートラルをオフ

        } else {
            // 標準状態 (50〜80)
            window.subAvatar.setExpression('neutral', 1.0);
        }

        // ストレスレベルの制御も同様に追加可能
        // ...
    }

};

// グローバルに公開
window.avatarController = subAvatarController;
