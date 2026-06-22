//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2026.06.22
//////////////////////////////////////////////////////////////////////
/**
 * @module mainFitbit
 * @description Fitbit APIとの直接連携（OAuth 2.0）およびデータ収集を管理するモジュール。
 */

import { store } from './storeSingleton.mjs';
import http from 'http';
import { shell } from 'electron';
import axios from 'axios';
import cron from 'node-cron';
import localDB from './models/localDBModels.mjs';
import { getToday, mergeDeeply, formatDate } from './mainSubmodule.mjs';
import { logger } from './logger.mjs';

const {
    IOT_FitbitProfilesModel,
    IOT_FitbitDailiesModel,
    IOT_FitbitSleepsModel,
    IOT_FitbitHeartRatesModel,
    IOT_FitbitWeightsModel
} = localDB;

/**
 * Fitbit 連携設定
 * @typedef {Object} FitbitConfig
 * @property {string} clientId クライアントID
 * @property {string} clientSecret クライアントシークレット
 * @property {number} redirectPort リダイレクトポート (デフォルト: 5000)
 * @property {string} accessToken アクセストークン
 * @property {string} refreshToken リフレッシュトークン
 * @property {number} tokenExpiresAt トークン期限切れ時刻 (ミリ秒)
 * @property {string} encodedId ユーザーのFitbitID
 * @property {boolean} isEnabled 有効化フラグ
 * @property {boolean} debug デバッグフラグ
 */
let config = /** @type {FitbitConfig} */ ({
    clientId: '',
    clientSecret: '',
    redirectPort: 5000,
    accessToken: '',
    refreshToken: '',
    tokenExpiresAt: 0,
    encodedId: '',
    isEnabled: false,
    debug: false
});

let sendIPCMessage = null;
let authServer = null;
let syncCronTask = null;

let mainFitbit = {
    get config() { return config; },
    isRun: false,

    /**
     * 初期化処理
     * @param {(ch:string,...args:any[])=>void} _sendIPCMessage
     */
    start: async function (_sendIPCMessage) {
        sendIPCMessage = _sendIPCMessage;

        if (mainFitbit.isRun) {
            sendIPCMessage("renewFitbitConfigView", config);
            return;
        }
        mainFitbit.isRun = true;

        // 設定の読み込み
        const storedConfig = await store.get('config.Fitbit', {});
        config = mergeDeeply(config, storedConfig);
        logger.debug('mainFitbit', config.debug, 'start() Fitbit Config loaded');

        sendIPCMessage("renewFitbitConfigView", config);

        // cron 定期同期設定 (毎日午前3時に同期)
        if (syncCronTask) {
            syncCronTask.stop();
        }
        syncCronTask = cron.schedule('0 3 * * *', () => {
            logger.debug('mainFitbit', config.debug, 'Cron triggered Fitbit sync.');
            if (config.isEnabled && config.accessToken) {
                mainFitbit.syncData();
            }
        });
        syncCronTask.start();

        // 起動時に有効であれば最新データをUIへ送る
        if (config.isEnabled) {
            mainFitbit.sendLatestDataToUI();
        }
    },

    /**
     * 設定の保存
     * @param {Object} newConfig
     */
    saveConfig: async function (newConfig) {
        config = mergeDeeply(config, newConfig);
        await store.set('config.Fitbit', config);
        logger.debug('mainFitbit', config.debug, 'saveConfig() config updated');
        sendIPCMessage("renewFitbitConfigView", config);
    },

    /**
     * OAuth 2.0 認証プロセスの開始
     */
    startAuthFlow: async function () {
        if (!config.clientId || !config.clientSecret) {
            throw new Error('クライアントIDとクライアントシークレットを入力してください。');
        }

        const port = config.redirectPort || 5000;
        const redirectUri = `http://localhost:${port}/callback`;

        // 既存のサーバーがあれば閉じる
        if (authServer) {
            authServer.close();
        }

        // 一時ローカルWebサーバーの立ち上げ
        authServer = http.createServer(async (req, res) => {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            if (urlObj.pathname === '/callback') {
                const code = urlObj.searchParams.get('code');
                if (code) {
                    try {
                        await mainFitbit.exchangeCodeForToken(code, redirectUri);
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end('<h1>Fitbit連携に成功しました！</h1><p>このタブを閉じて、PLISアプリに戻ってください。</p>');
                        sendIPCMessage('fitbitAuthStatus', { status: 'success' });
                    } catch (error) {
                        logger.error('mainFitbit', 'Token exchange failed:', error);
                        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(`<h1>Fitbit連携に失敗しました</h1><p>エラー: ${error.message}</p>`);
                        sendIPCMessage('fitbitAuthStatus', { status: 'error', message: error.message });
                    } finally {
                        authServer.close();
                        authServer = null;
                    }
                } else {
                    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end('<h1>認可コードが検出されませんでした。</h1>');
                    authServer.close();
                    authServer = null;
                }
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        authServer.listen(port, () => {
            logger.debug('mainFitbit', config.debug, `Auth callback server listening on port ${port}`);
        });

        // システムブラウザで認証URLを開く
        const authUrl = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=activity%20heartrate%20location%20nutrition%20profile%20settings%20sleep%20social%20weight&expires_in=604800`;
        shell.openExternal(authUrl);
    },

    /**
     * 認可コードをアクセストークンに引き換える
     * @param {string} code
     * @param {string} redirectUri
     */
    exchangeCodeForToken: async function (code, redirectUri) {
        const tokenUrl = 'https://api.fitbit.com/oauth2/token';
        const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', config.clientId);
        params.append('redirect_uri', redirectUri);
        params.append('code', code);

        const response = await axios.post(tokenUrl, params, {
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const data = response.data;
        config.accessToken = data.access_token;
        config.refreshToken = data.refresh_token;
        config.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
        config.encodedId = data.user_id;
        config.isEnabled = true;

        await store.set('config.Fitbit', config);
        sendIPCMessage("renewFitbitConfigView", config);

        logger.debug('mainFitbit', config.debug, 'Token exchange successful.');

        // 連携成功後に一度同期を行う
        await mainFitbit.syncData();
    },

    /**
     * トークンの有効期限を確認し、必要なら自動更新する
     */
    refreshAccessTokenIfNeeded: async function () {
        // 残り時間5分未満なら更新
        if (Date.now() + 300000 >= config.tokenExpiresAt) {
            logger.debug('mainFitbit', config.debug, 'Access token expired or expiring soon. Refreshing...');
            const tokenUrl = 'https://api.fitbit.com/oauth2/token';
            const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

            const params = new URLSearchParams();
            params.append('grant_type', 'refresh_token');
            params.append('refresh_token', config.refreshToken);

            try {
                const response = await axios.post(tokenUrl, params, {
                    headers: {
                        'Authorization': `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

                const data = response.data;
                config.accessToken = data.access_token;
                config.refreshToken = data.refresh_token;
                config.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

                await store.set('config.Fitbit', config);
                sendIPCMessage("renewFitbitConfigView", config);
                logger.debug('mainFitbit', config.debug, 'Token refresh successful.');
            } catch (error) {
                logger.error('mainFitbit', 'Token refresh failed:', error.response?.data || error.message);
                throw new Error('Fitbitのトークン更新に失敗しました。再度認証してください。');
            }
        }
    },

    /**
     * FitbitデータをAPI経由で同期しローカルDBに保存する
     */
    syncData: async function () {
        if (!config.isEnabled || !config.accessToken) {
            logger.debug('mainFitbit', config.debug, 'syncData() skipped: Fitbit is disabled or not authorized.');
            return;
        }

        try {
            await mainFitbit.refreshAccessTokenIfNeeded();

            // プロフィール取得
            await mainFitbit.syncProfile();

            // 過去7日分の各健康データを取得・保存
            const dates = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                dates.push(formatDate(d)); // YYYY-MM-DD
            }

            for (const dateStr of dates) {
                logger.debug('mainFitbit', config.debug, `Syncing Fitbit data for date: ${dateStr}`);
                await Promise.all([
                    mainFitbit.syncDailyActivity(dateStr),
                    mainFitbit.syncSleep(dateStr),
                    mainFitbit.syncHeartRate(dateStr),
                    mainFitbit.syncWeightAndFat(dateStr)
                ]);
            }

            logger.debug('mainFitbit', config.debug, 'Fitbit sync completed successfully.');
            await mainFitbit.sendLatestDataToUI();

        } catch (error) {
            logger.error('mainFitbit', 'Sync error:', error);
        }
    },

    /**
     * プロフィールの同期
     */
    syncProfile: async function () {
        try {
            const url = `https://api.fitbit.com/1/user/-/profile.json`;
            const response = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${config.accessToken}` }
            });
            const u = response.data.user;

            await IOT_FitbitProfilesModel.findOrCreate({
                where: { encodedId: u.encodedId },
                defaults: {
                    encodedId: u.encodedId,
                    displayName: u.displayName || '',
                    fullName: u.fullName || '',
                    gender: u.gender || '',
                    dateOfBirth: u.dateOfBirth || '',
                    height: parseFloat(u.height) || 0,
                    weight: parseFloat(u.weight) || 0,
                    avatar: u.avatar150 || u.avatar || '',
                    timezone: u.timezone || 'Asia/Tokyo'
                }
            }).then(async ([record, created]) => {
                if (!created) {
                    await record.update({
                        displayName: u.displayName || '',
                        fullName: u.fullName || '',
                        gender: u.gender || '',
                        dateOfBirth: u.dateOfBirth || '',
                        height: parseFloat(u.height) || 0,
                        weight: parseFloat(u.weight) || 0,
                        avatar: u.avatar150 || u.avatar || '',
                        timezone: u.timezone || 'Asia/Tokyo'
                    });
                }
            });
        } catch (e) {
            logger.error('mainFitbit', 'syncProfile() error:', e.response?.data || e.message);
        }
    },

    /**
     * 日次活動データの同期
     * @param {string} date YYYY-MM-DD
     */
    syncDailyActivity: async function (date) {
        try {
            const url = `https://api.fitbit.com/1/user/-/activities/date/${date}.json`;
            const response = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${config.accessToken}` }
            });
            const s = response.data.summary;
            const g = response.data.goals || {};

            await IOT_FitbitDailiesModel.findOrCreate({
                where: { encodedId: config.encodedId, calendarDate: date },
                defaults: {
                    encodedId: config.encodedId,
                    calendarDate: date,
                    steps: parseInt(s.steps) || 0,
                    distance: parseFloat(s.distances?.find(d => d.activity === 'total')?.distance) || 0,
                    caloriesOut: parseInt(s.caloriesOut) || 0,
                    caloriesBMR: parseInt(s.caloriesBMR) || 0,
                    activityCalories: parseInt(s.activityCalories) || 0,
                    fairlyActiveMinutes: parseInt(s.fairlyActiveMinutes) || 0,
                    lightlyActiveMinutes: parseInt(s.lightlyActiveMinutes) || 0,
                    veryActiveMinutes: parseInt(s.veryActiveMinutes) || 0,
                    sedentaryMinutes: parseInt(s.sedentaryMinutes) || 0,
                    stepsGoal: parseInt(g.steps) || 0,
                    caloriesOutGoal: parseInt(g.caloriesOut) || 0,
                    distanceGoal: parseFloat(g.distance) || 0,
                    activeMinutesGoal: parseInt(g.activeMinutes) || 0
                }
            }).then(async ([record, created]) => {
                if (!created) {
                    await record.update({
                        steps: parseInt(s.steps) || 0,
                        distance: parseFloat(s.distances?.find(d => d.activity === 'total')?.distance) || 0,
                        caloriesOut: parseInt(s.caloriesOut) || 0,
                        caloriesBMR: parseInt(s.caloriesBMR) || 0,
                        activityCalories: parseInt(s.activityCalories) || 0,
                        fairlyActiveMinutes: parseInt(s.fairlyActiveMinutes) || 0,
                        lightlyActiveMinutes: parseInt(s.lightlyActiveMinutes) || 0,
                        veryActiveMinutes: parseInt(s.veryActiveMinutes) || 0,
                        sedentaryMinutes: parseInt(s.sedentaryMinutes) || 0,
                        stepsGoal: parseInt(g.steps) || 0,
                        caloriesOutGoal: parseInt(g.caloriesOut) || 0,
                        distanceGoal: parseFloat(g.distance) || 0,
                        activeMinutesGoal: parseInt(g.activeMinutes) || 0
                    });
                }
            });
        } catch (e) {
            logger.error('mainFitbit', `syncDailyActivity(${date}) error:`, e.response?.data || e.message);
        }
    },

    /**
     * 睡眠データの同期
     * @param {string} date YYYY-MM-DD
     */
    syncSleep: async function (date) {
        try {
            const url = `https://api.fitbit.com/1.2/user/-/sleep/date/${date}.json`;
            const response = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${config.accessToken}` }
            });
            const sleepLogs = response.data.sleep || [];

            for (const log of sleepLogs) {
                const levels = log.levels?.summary || {};
                await IOT_FitbitSleepsModel.findOrCreate({
                    where: { encodedId: config.encodedId, logId: log.logId },
                    defaults: {
                        encodedId: config.encodedId,
                        logId: log.logId,
                        dateOfSleep: log.dateOfSleep,
                        duration: log.duration,
                        efficiency: log.efficiency,
                        startTime: log.startTime,
                        endTime: log.endTime,
                        minutesAsleep: log.minutesAsleep,
                        minutesAwake: log.minutesAwake,
                        timeInBed: log.timeInBed,
                        isMainSleep: log.isMainSleep,
                        deepMinutes: levels.deep?.minutes || 0,
                        lightMinutes: levels.light?.minutes || 0,
                        remMinutes: levels.rem?.minutes || 0,
                        wakeMinutes: levels.wake?.minutes || levels.awake?.minutes || 0
                    }
                }).then(async ([record, created]) => {
                    if (!created) {
                        await record.update({
                            dateOfSleep: log.dateOfSleep,
                            duration: log.duration,
                            efficiency: log.efficiency,
                            startTime: log.startTime,
                            endTime: log.endTime,
                            minutesAsleep: log.minutesAsleep,
                            minutesAwake: log.minutesAwake,
                            timeInBed: log.timeInBed,
                            isMainSleep: log.isMainSleep,
                            deepMinutes: levels.deep?.minutes || 0,
                            lightMinutes: levels.light?.minutes || 0,
                            remMinutes: levels.rem?.minutes || 0,
                            wakeMinutes: levels.wake?.minutes || levels.awake?.minutes || 0
                        });
                    }
                });
            }
        } catch (e) {
            logger.error('mainFitbit', `syncSleep(${date}) error:`, e.response?.data || e.message);
        }
    },

    /**
     * 心拍データの同期
     * @param {string} date YYYY-MM-DD
     */
    syncHeartRate: async function (date) {
        try {
            const url = `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d.json`;
            const response = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${config.accessToken}` }
            });
            const dataList = response.data['activities-heart'] || [];
            if (dataList.length === 0) return;

            const val = dataList[0].value;
            const zones = val.heartRateZones || [];

            await IOT_FitbitHeartRatesModel.findOrCreate({
                where: { encodedId: config.encodedId, calendarDate: date },
                defaults: {
                    encodedId: config.encodedId,
                    calendarDate: date,
                    restingHeartRate: val.restingHeartRate || 0,
                    outOfRangeMinutes: zones.find(z => z.name === 'Out of Range')?.minutes || 0,
                    fatBurnMinutes: zones.find(z => z.name === 'Fat Burn')?.minutes || 0,
                    cardioMinutes: zones.find(z => z.name === 'Cardio')?.minutes || 0,
                    peakMinutes: zones.find(z => z.name === 'Peak')?.minutes || 0
                }
            }).then(async ([record, created]) => {
                if (!created) {
                    await record.update({
                        restingHeartRate: val.restingHeartRate || 0,
                        outOfRangeMinutes: zones.find(z => z.name === 'Out of Range')?.minutes || 0,
                        fatBurnMinutes: zones.find(z => z.name === 'Fat Burn')?.minutes || 0,
                        cardioMinutes: zones.find(z => z.name === 'Cardio')?.minutes || 0,
                        peakMinutes: zones.find(z => z.name === 'Peak')?.minutes || 0
                    });
                }
            });
        } catch (e) {
            logger.error('mainFitbit', `syncHeartRate(${date}) error:`, e.response?.data || e.message);
        }
    },

    /**
     * 体重・体脂肪データの同期
     * @param {string} date YYYY-MM-DD
     */
    syncWeightAndFat: async function (date) {
        try {
            // 体重の取得
            const weightUrl = `https://api.fitbit.com/1/user/-/body/log/weight/date/${date}.json`;
            const weightRes = await axios.get(weightUrl, {
                headers: { 'Authorization': `Bearer ${config.accessToken}` }
            });
            const weightLogs = weightRes.data.weight || [];

            // 体脂肪の取得
            const fatUrl = `https://api.fitbit.com/1/user/-/body/log/fat/date/${date}.json`;
            const fatRes = await axios.get(fatUrl, {
                headers: { 'Authorization': `Bearer ${config.accessToken}` }
            });
            const fatLogs = fatRes.data.fat || [];

            // 同日のログを集約
            const weightLog = weightLogs[0];
            const fatLog = fatLogs[0];

            if (weightLog || fatLog) {
                await IOT_FitbitWeightsModel.findOrCreate({
                    where: { encodedId: config.encodedId, calendarDate: date },
                    defaults: {
                        encodedId: config.encodedId,
                        calendarDate: date,
                        weight: weightLog ? parseFloat(weightLog.weight) : null,
                        bmi: weightLog ? parseFloat(weightLog.bmi) : null,
                        fat: fatLog ? parseFloat(fatLog.fat) : null,
                        source: weightLog?.source || fatLog?.source || 'API'
                    }
                }).then(async ([record, created]) => {
                    if (!created) {
                        await record.update({
                            weight: weightLog ? parseFloat(weightLog.weight) : record.weight,
                            bmi: weightLog ? parseFloat(weightLog.bmi) : record.bmi,
                            fat: fatLog ? parseFloat(fatLog.fat) : record.fat,
                            source: weightLog?.source || fatLog?.source || record.source
                        });
                    }
                });
            }
        } catch (e) {
            logger.error('mainFitbit', `syncWeightAndFat(${date}) error:`, e.response?.data || e.message);
        }
    },

    /**
     * 最新のFitbitデータをDBから取得してUIに送信する
     */
    sendLatestDataToUI: async function () {
        if (!sendIPCMessage) return;

        try {
            const profile = await IOT_FitbitProfilesModel.findOne({
                where: { encodedId: config.encodedId },
                order: [['updatedAt', 'DESC']]
            });

            const dailies = await IOT_FitbitDailiesModel.findAll({
                where: { encodedId: config.encodedId },
                order: [['calendarDate', 'ASC']],
                limit: 30
            });

            const sleeps = await IOT_FitbitSleepsModel.findAll({
                where: { encodedId: config.encodedId },
                order: [['dateOfSleep', 'ASC']],
                limit: 30
            });

            const heartrates = await IOT_FitbitHeartRatesModel.findAll({
                where: { encodedId: config.encodedId },
                order: [['calendarDate', 'ASC']],
                limit: 30
            });

            const weights = await IOT_FitbitWeightsModel.findAll({
                where: { encodedId: config.encodedId },
                order: [['calendarDate', 'ASC']],
                limit: 30
            });

            const fitbitData = {
                profile: profile ? profile.dataValues : null,
                dailies: dailies.map(d => d.dataValues),
                sleeps: sleeps.map(s => s.dataValues),
                heartrates: heartrates.map(h => h.dataValues),
                weights: weights.map(w => w.dataValues)
            };

            sendIPCMessage('showFitbitData', fitbitData);
        } catch (error) {
            logger.error('mainFitbit', 'sendLatestDataToUI() error:', error);
        }
    }
};

export { mainFitbit };
