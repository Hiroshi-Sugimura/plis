//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2013.09.27.
//	Last updated: 2022.08.04
//////////////////////////////////////////////////////////////////////
/**
 * @module preload
 * @desc Electronのメインプロセスとレンダラープロセス間の通信を仲介するpreloadスクリプト
 * セキュリティ上の理由で、レンダラープロセスは直接Node.jsのAPIにアクセスできないため、
 * contextBridgeを使用して安全にIPCメッセージのやり取りを行う
 */
'use strict'

// ElectronのcontextBridgeとipcRendererを読み込み
const { contextBridge, ipcRenderer } = require('electron');

// レンダラープロセスから利用可能なIPCメソッドをwindow.ipcオブジェクトとして公開
contextBridge.exposeInMainWorld('ipc', {
    
    //======================================================
    // レンダラープロセス → メインプロセス への通信メソッド群

    /**
     * @func already
     * @desc レンダラープロセスの準備完了をメインプロセスに通知
     * @param {void}
     * @return {void}
     */
    already: () => {
        ipcRenderer.invoke('already', '');
    },

    /**
     * @func URLopen
     * @desc 指定したURLを外部ブラウザで開く
     * @param {string} url - 開くURL
     * @return {void}
     */
    URLopen: (url) => {
        ipcRenderer.invoke('URLopen', url);
    },

    //----------------------------------------------------------------------------------------------
    // ページ内検索機能

    /**
     * @func PageInSearch
     * @desc ページ内検索を開始
     * @param {string} text - 検索テキスト
     * @return {void}
     */
    PageInSearch: (text) => {
        ipcRenderer.invoke('PageInSearch', text);
    },

    /**
     * @func PageInSearchNext
     * @desc ページ内検索で次の検索結果に移動
     * @param {string} text - 検索テキスト
     * @return {void}
     */
    PageInSearchNext: (text) => {
        ipcRenderer.invoke('PageInSearchNext', text);
    },

    /**
     * @func PageInSearchPrev
     * @desc ページ内検索で前の検索結果に移動
     * @param {string} text - 検索テキスト
     * @return {void}
     */
    PageInSearchPrev: (text) => {
        ipcRenderer.invoke('PageInSearchPrev', text);
    },

    /**
     * @func PageInSearchStop
     * @desc ページ内検索を停止
     * @param {void}
     * @return {void}
     */
    PageInSearchStop: () => {
        ipcRenderer.invoke('PageInSearchStop');
    },

    //----------------------------------------------------------------------------------------------
    // カレンダー機能

    /**
     * @func CalendarRenewHolidays
     * @desc カレンダーの祝日情報を更新
     * @param {void}
     * @return {void}
     */
    CalendarRenewHolidays: () => {
        ipcRenderer.invoke('CalendarRenewHolidays', '');
    },

    //----------------------------------------------------------------------------------------------
    // システム設定

    /**
     * @func SystemSetConfig
     * @desc システム設定を保存
     * @param {string} _screenMode - 画面モード設定
     * @param {boolean} _debug - デバッグモード有効/無効
     * @param {number} _elLogExpireDays - ELログ保持日数
     * @param {number} _resultExpireDays - 結果データ保持日数
     * @param {string} _IPver - IPバージョン設定
     * @param {string} _IPv4 - IPv4アドレス
     * @param {string} _IPv6 - IPv6アドレス
     * @return {void}
     */
    SystemSetConfig: (_screenMode, _debug, _elLogExpireDays, _resultExpireDays, _IPver, _IPv4, _IPv6) => {
        ipcRenderer.invoke('SystemSetConfig', { 
            screenMode: _screenMode, 
            debug: _debug, 
            ellogExpireDays: _elLogExpireDays, 
            resultExpireDays: _resultExpireDays, 
            IPver: _IPver, 
            IPv4: _IPv4, 
            IPv6: _IPv6 
        });
    },

    /**
     * @func ScreenMode
     * @desc 画面モードを変更
     * @param {string} _screenMode - 画面モード設定
     * @return {void}
     */
    ScreenMode: (_screenMode) => {
        ipcRenderer.invoke('ScreenMode', { screenMode: _screenMode });
    },

    //----------------------------------------------------------------------------------------------
    // ユーザープロファイル関連

    /**
     * @func userProfileSave
     * @desc ユーザープロファイルを保存
     * @param {string} _nickname - ニックネーム
     * @param {number} _age - 年齢
     * @param {number} _height - 身長
     * @param {number} _weight - 体重
     * @param {number} _ampere - アンペア数
     * @return {void}
     */
    userProfileSave: (_nickname, _age, _height, _weight, _ampere) => {
        ipcRenderer.invoke('userProfileSave', { 
            nickname: _nickname, 
            age: _age, 
            height: _height, 
            weight: _weight, 
            ampere: _ampere 
        });
    },

    //----------------------------------------------------------------------------------------------
    // HAL（Health AI Lab）関連

    /**
     * @func HALsetApiTokenRequest
     * @desc HAL APIトークンを設定
     * @param {string} HALtoken - HAL APIトークン
     * @return {void}
     */
    HALsetApiTokenRequest: (HALtoken) => {
        ipcRenderer.invoke('HALsetApiTokenRequest', HALtoken);
    },

    /**
     * @func HALgetApiTokenRequest
     * @desc HAL APIトークンを取得
     * @param {void}
     * @return {void}
     */
    HALgetApiTokenRequest: () => {
        ipcRenderer.invoke('HALgetApiTokenRequest', '');
    },

    /**
     * @func HALdeleteApiToken
     * @desc HAL APIトークンを削除
     * @param {void}
     * @return {void}
     */
    HALdeleteApiToken: () => {
        ipcRenderer.invoke('HALdeleteApiToken', '');
    },

    /**
     * @func HALSyncRequeset
     * @desc HALとのデータ同期を要求
     * @param {void}
     * @return {void}
     */
    HALSyncRequeset: () => {
        ipcRenderer.invoke('HALSyncRequeset', '');
    },

    /**
     * @func HALrenew
     * @desc HALデータを更新
     * @param {void}
     * @return {void}
     */
    HALrenew: () => {
        ipcRenderer.invoke('HALrenew', '');
    },

    /**
     * @func HALsubmitQuestionnaire
     * @desc HALにアンケートデータを送信
     * @param {Object} submitData - 送信データ
     * @return {void}
     */
    HALsubmitQuestionnaire: (submitData) => {
        ipcRenderer.invoke('HALsubmitQuestionnaire', '');
    },

    /**
     * @func HALgetUserProfileRequest
     * @desc HALユーザープロファイルを取得
     * @param {void}
     * @return {void}
     */
    HALgetUserProfileRequest: () => {
        ipcRenderer.invoke('HALgetUserProfileRequest', '');
    },

    /**
     * @func DatabaseStatus
     * @desc データベースの状態を確認
     * @param {void}
     * @return {void}
     */
    DatabaseStatus: () => {
        ipcRenderer.invoke('DatabaseStatus', '');
    },

    //----------------------------------------------------------------------------------------------
    // AutoAssessment（自動評価）関連

    /**
     * @func AutoAssessmentConfig
     * @desc 自動評価機能の設定を保存
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    AutoAssessmentConfig: (_debug) => {
        ipcRenderer.invoke('AutoAssessmentConfig', {
            debug: _debug
        });
    },

    //----------------------------------------------------------------------------------------------
    // ESM（電力スマートメータ）関連

    /**
     * @func ESMUse
     * @desc 電力スマートメータの使用を開始
     * @param {string} _dongleType - ドングルタイプ
     * @param {string} _connectionType - 接続タイプ
     * @param {string} _id - ID
     * @param {string} _password - パスワード
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    ESMUse: (_dongleType, _connectionType, _id, _password, _debug) => {
        ipcRenderer.invoke('ESMUse', {
            dongleType: _dongleType,
            connectionType: _connectionType,
            id: _id,
            password: _password,
            debug: _debug
        });
    },

    /**
     * @func ESMnotUse
     * @desc 電力スマートメータの使用を停止
     * @param {string} _dongleType - ドングルタイプ
     * @param {string} _connectionType - 接続タイプ
     * @param {string} _id - ID
     * @param {string} _password - パスワード
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    ESMnotUse: (_dongleType, _connectionType, _id, _password, _debug) => {
        ipcRenderer.invoke('ESMnotUse', {
            dongleType: _dongleType,
            connectionType: _connectionType,
            id: _id,
            password: _password,
            debug: _debug
        });
    },

    //----------------------------------------------------------------------------------------------
    // Philips Hue関連

    /**
     * @func HueUse
     * @desc Philips Hueの使用を開始
     * @param {string} _key - Hue APIキー
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    HueUse: (_key, _debug) => {
        ipcRenderer.invoke('HueUse', { key: _key, debug: _debug });
    },

    /**
     * @func HueUseCancel
     * @desc Philips Hueの使用開始をキャンセル
     * @param {string} _key - Hue APIキー
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    HueUseCancel: (_key, _debug) => {
        ipcRenderer.invoke('HueUseCancel', { key: _key, debug: _debug });
    },

    /**
     * @func HueUseStop
     * @desc Philips Hueの使用を停止
     * @param {string} _key - Hue APIキー
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    HueUseStop: (_key, _debug) => {
        ipcRenderer.invoke('HueUseStop', { key: _key, debug: _debug });
    },

    /**
     * @func HueControl
     * @desc Philips Hueデバイスを制御
     * @param {string} _url - 制御用URL
     * @param {Object} _json - 制御用JSONデータ
     * @return {void}
     */
    HueControl: (_url, _json) => {
        console.log(_url, _json);
        ipcRenderer.invoke('HueControl', { url: _url, json: _json });
    },

    //----------------------------------------------------------------------------------------------
    // IKEA TRÅDFRI関連

    /**
     * @func IkeaUse
     * @desc IKEA TRÅDFRIの使用を開始
     * @param {string} _securityCode - セキュリティコード
     * @param {string} _identity - アイデンティティ
     * @param {string} _psk - Pre-Shared Key
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    IkeaUse: (_securityCode, _identity, _psk, _debug) => {
        ipcRenderer.invoke('IkeaUse', { 
            securityCode: _securityCode, 
            identity: _identity, 
            psk: _psk, 
            debug: _debug 
        });
    },

    /**
     * @func IkeaUseStop
     * @desc IKEA TRÅDFRIの使用を停止
     * @param {string} _securityCode - セキュリティコード
     * @param {string} _identity - アイデンティティ
     * @param {string} _psk - Pre-Shared Key
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    IkeaUseStop: (_securityCode, _identity, _psk, _debug) => {
        ipcRenderer.invoke('IkeaUseStop', { 
            securityCode: _securityCode, 
            identity: _identity, 
            psk: _psk, 
            debug: _debug 
        });
    },

    /**
     * @func IkeaSend
     * @desc IKEA TRÅDFRIデバイスにコマンドを送信
     * @param {string} key - デバイスキー
     * @param {string} type - デバイスタイプ
     * @param {Object} command - 送信コマンド
     * @return {void}
     */
    IkeaSend: (key, type, command) => {
        // console.log(key, type, command);
        ipcRenderer.invoke('IkeaSend', { key: key, type: type, command: command });
    },

    //----------------------------------------------------------------------------------------------
    // OpenWeatherMap関連

    /**
     * @func OwmUse
     * @desc OpenWeatherMapの使用を開始
     * @param {string} _APIKey - OpenWeatherMap APIキー
     * @param {string} _zipcode - 郵便番号
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    OwmUse: (_APIKey, _zipcode, _debug) => {
        ipcRenderer.invoke('OwmUse', { APIKey: _APIKey, zipcode: _zipcode, debug: _debug });
    },

    /**
     * @func OwmStop
     * @desc OpenWeatherMapの使用を停止
     * @param {string} _APIKey - OpenWeatherMap APIキー
     * @param {string} _zipcode - 郵便番号
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    OwmStop: (_APIKey, _zipcode, _debug) => {
        ipcRenderer.invoke('OwmStop', { APIKey: _APIKey, zipcode: _zipcode, debug: _debug });
    },

    //----------------------------------------------------------------------------------------------
    // JMA（気象庁）関連

    /**
     * @func JmaConfigSave
     * @desc 気象庁の設定を保存
     * @param {string} _areaName - 地域名
     * @param {string} _areaCode - 地域コード
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    JmaConfigSave: (_areaName, _areaCode, _debug) => {
        ipcRenderer.invoke('JmaConfigSave', { area: _areaName, code: _areaCode, debug: _debug });
    },

    //----------------------------------------------------------------------------------------------
    // Netatmo関連

    /**
     * @func NetatmoUse
     * @desc Netatmoの使用を開始
     * @param {string} _id - クライアントID
     * @param {string} _secret - クライアントシークレット
     * @param {string} _username - ユーザー名
     * @param {string} _password - パスワード
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    NetatmoUse: (_id, _secret, _username, _password, _debug) => {
        ipcRenderer.invoke('NetatmoUse', { 
            id: _id, 
            secret: _secret, 
            username: _username, 
            password: _password, 
            debug: _debug 
        });
    },

    /**
     * @func NetatmoStop
     * @desc Netatmoの使用を停止
     * @param {string} _id - クライアントID
     * @param {string} _secret - クライアントシークレット
     * @param {string} _username - ユーザー名
     * @param {string} _password - パスワード
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    NetatmoStop: (_id, _secret, _username, _password, _debug) => {
        ipcRenderer.invoke('NetatmoStop', { 
            id: _id, 
            secret: _secret, 
            username: _username, 
            password: _password, 
            debug: _debug 
        });
    },

    //----------------------------------------------------------------------------------------------
    // OMRON環境センサ関連

    /**
     * @func OmronUse
     * @desc OMRON環境センサの使用を開始
     * @param {string} _place - 設置場所
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    OmronUse: (_place, _debug) => {
        ipcRenderer.invoke('OmronUse', { place: _place, debug: _debug });
    },

    /**
     * @func OmronStop
     * @desc OMRON環境センサの使用を停止
     * @param {string} _place - 設置場所
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    OmronStop: (_place, _debug) => {
        ipcRenderer.invoke('OmronStop', { place: _place, debug: _debug });
    },

    //----------------------------------------------------------------------------------------------
    // I/O DATA UD-CO2S関連

    /**
     * @func Co2sUse
     * @desc I/O DATA UD-CO2Sの使用を開始
     * @param {string} _place - 設置場所
     * @return {void}
     */
    Co2sUse: (_place) => {
        ipcRenderer.invoke('Co2sUse', { place: _place });
    },

    /**
     * @func Co2sStop
     * @desc I/O DATA UD-CO2Sの使用を停止
     * @param {string} _place - 設置場所
     * @return {void}
     */
    Co2sStop: (_place) => {
        ipcRenderer.invoke('Co2sStop', { place: _place });
    },

    //----------------------------------------------------------------------------------------------
    // SwitchBot関連

    /**
     * @func SwitchBotUse
     * @desc SwitchBotの使用を開始
     * @param {string} _token - SwitchBot APIトークン
     * @param {string} _secret - SwitchBot APIシークレット
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    SwitchBotUse: (_token, _secret, _debug) => {
        ipcRenderer.invoke('SwitchBotUse', { token: _token, secret: _secret, debug: _debug });
    },

    /**
     * @func SwitchBotStop
     * @desc SwitchBotの使用を停止
     * @param {string} _token - SwitchBot APIトークン
     * @param {string} _secret - SwitchBot APIシークレット
     * @param {boolean} _debug - デバッグモード有効/無効
     * @return {void}
     */
    SwitchBotStop: (_token, _secret, _debug) => {
        ipcRenderer.invoke('SwitchBotStop', { token: _token, secret: _secret, debug: _debug });
    },

    /**
     * @func SwitchBotControl
     * @desc SwitchBotデバイスを制御
     * @param {string} _id - デバイスID
     * @param {string} _command - 制御コマンド
     * @param {string} _param - 制御パラメータ
     * @return {void}
     */
    SwitchBotControl: (_id, _command, _param) => {
        // console.log( 'SwitchBotControl', { id:_id, command: _command, param:_param} );
        ipcRenderer.invoke('SwitchBotControl', { id: _id, command: _command, param: _param });
    },

    //----------------------------------------------------------------------------------------------
    // ECHONET Lite関連

    /**
     * @func ELUse
     * @desc ECHONET Liteの使用を開始
     * @param {void}
     * @return {void}
     */
    ELUse: () => {
        ipcRenderer.invoke('ELUse');
    },

    /**
     * @func ELStop
     * @desc ECHONET Liteの使用を停止
     * @param {void}
     * @return {void}
     */
    ELStop: () => {
        ipcRenderer.invoke('ELStop');
    },

    /**
     * @func ELUseOldSearch
     * @desc ECHONET Lite旧バージョン検索を有効化
     * @param {void}
     * @return {void}
     */
    ELUseOldSearch: () => {
        ipcRenderer.invoke('ELUseOldSearch');
    },

    /**
     * @func ELStopOldSearch
     * @desc ECHONET Lite旧バージョン検索を無効化
     * @param {void}
     * @return {void}
     */
    ELStopOldSearch: () => {
        ipcRenderer.invoke('ELStopOldSearch');
    },

    /**
     * @func Elsend
     * @desc ECHONET Liteメッセージを送信
     * @param {string} ip - 送信先IPアドレス
     * @param {string} sendmsg - 送信メッセージ
     * @return {void}
     */
    Elsend: (ip, sendmsg) => {
        ipcRenderer.invoke('Elsend', { ip: ip, msg: sendmsg });
    },

    /**
     * @func ElsendOPC1
     * @desc ECHONET Lite OPC=1でメッセージを送信
     * @param {string} ip - 送信先IPアドレス
     * @param {string} seoj - 送信元ECHONET Liteオブジェクト
     * @param {string} deoj - 送信先ECHONET Liteオブジェクト
     * @param {string} esv - ECHONET Liteサービス
     * @param {string} epc - ECHONET Liteプロパティ
     * @param {string} edt - ECHONET Liteデータ
     * @return {void}
     */
    ElsendOPC1: (ip, seoj, deoj, esv, epc, edt) => {
        ipcRenderer.invoke('ElsendOPC1', { 
            ip: ip, 
            seoj: seoj, 
            deoj: deoj, 
            esv: esv, 
            epc: epc, 
            edt: edt 
        });
    },

    /**
     * @func ELsearch
     * @desc ECHONET Liteデバイス検索を実行
     * @param {void}
     * @return {void}
     */
    ELsearch: () => {
        ipcRenderer.invoke('ELSearch', '');
    },

    //----------------------------------------------------------------------------------------------
    // 【新規追加】Garminアドバイス関連

    /**
     * @func getGarminAdvice
     * @desc Garminデータとアンケートに基づくアドバイスを取得
     * @param {Object} arg - { date?: string } 対象日付（省略時は今日）
     * @return {Promise<void>}
     */
    getGarminAdvice: (arg) => {
        return ipcRenderer.invoke('getGarminAdvice', arg);
    },


    //======================================================
    // メインプロセス → レンダラープロセス への通信受信

    /**
     * @func on
     * @desc メインプロセスからのメッセージを受信するイベントリスナーを登録
     * @param {string} channel - 受信チャンネル名
     * @param {function} callback - 受信時のコールバック関数
     * @return {void}
     */
    on: (channel, callback) => {
        try {
            // メインプロセスからのメッセージを受信
            ipcRenderer.on(channel, (event, obj) => {
                try {
                    // コールバック関数を実行
                    callback(channel, obj);
                } catch (error) {
                    console.error('Error: preload.on.ipcRenderer.on()');
                    console.error(error);
                    console.error('channel:', channel, 'obj:', obj);
                }
            });
        } catch (error) {
            console.error('Error: preload.on()');
            console.error(error);
            console.error('channel:', channel);
        }
    }

});
