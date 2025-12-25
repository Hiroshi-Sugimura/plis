# PLISプロジェクト コーディング規約

## 1. 概要

本ドキュメントはPLIS（Platform for Life Improvement and Support）プロジェクトのコーディング規約を定めます。
Electron + Node.js環境での実装を想定し、ESM（ES Modules）とCommonJS（Node.js CJS）の混在環境で動作するコードを対象としています。

**最終更新**: 2025-12-25
**バージョン**: 1.0

---

## 2. ファイル構造

### 2.1 ファイル構成

```
/app/
  /src/
    ├── main.mjs              # Electronメインプロセス（ESM）
    ├── preload.js            # プリロードスクリプト（CommonJS）
    ├── mainXxxx.mjs          # 機能別モジュール（ESM）
    ├── mainSubmodule.cjs     # 共有ユーティリティ（CommonJS）
    ├── dateformat.mjs        # Polyfill / Utility（ESM）
    ├── models/
    │   └── localDBModels.cjs # データベースモデル（CommonJS）
    ├── public/               # レンダラープロセス資産
    │   ├── index.html
    │   └── js/
    │       ├── renderXxxx.js # レンダラーロジック（CommonJS）
    └── icons/
```

### 2.2 モジュール命名規則

- **メインプロセスモジュール**: `main*.mjs` （ESM形式）
  - 例: `mainEL.mjs`, `mainHue.mjs`, `mainNetatmo.mjs`
  - 機能単位で細分化し、責任を明確にする

- **ユーティリティモジュール**: `*Submodule.cjs` または `*Utils.cjs` （CommonJS）
  - 複数モジュールで共有される汎用機能
  - 例: `mainSubmodule.cjs`

- **レンダラープロセスモジュール**: `render*.js` または `sub*.js` （CommonJS）
  - 例: `renderMain.js`, `subEL.js`

- **ポリフィル・パッチ**: 機能名 + `.mjs` （ESM）
  - 例: `dateformat.mjs`

### 2.3 ファイルヘッダー

すべてのJavaScriptファイルは、以下のヘッダーで開始してください：

```javascript
//////////////////////////////////////////////////////////////////////
//  Copyright (C) [著者名] [YYYY.MM.DD]
//  Last updated: [YYYY.MM.DD]
//////////////////////////////////////////////////////////////////////
/**
 * @module [モジュール名]
 * @description [モジュールの説明]
 */
```

**例**:
```javascript
//////////////////////////////////////////////////////////////////////
//  Copyright (C) Hiroshi SUGIMURA 2020.10.30
//  Last updated: 2025.12.25
//////////////////////////////////////////////////////////////////////
/**
 * @module mainHue
 * @description Philips Hue照明コントローラの管理。
 * Bridge接続、デバイス状態同期、IPC通信を担当する。
 */
```

---

## 3. モジュール・インポート/エクスポート

### 3.1 ESM（ES6 Modules）形式

新規作成・メインプロセスモジュールはESM形式（`.mjs`）を使用してください。

**インポート例**:
```javascript
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'fs';
import Store from 'electron-store';
import cron from 'node-cron';

// 相対インポート：同じ階層以下
import { mainSystem } from './mainSystem.mjs';
import { objectSort, getNow, getToday } from './mainSubmodule.cjs';

// CommonJS化したモジュールのインポート
import localDB from './models/localDBModels.cjs';
const { sqlite3, eldataModel } = localDB;
```

**エクスポート例**:
```javascript
// 単一オブジェクトエクスポート
export { mainEL };

// または複数エクスポート
export { functionA, functionB, constantC };
```

### 3.2 CommonJS（Node.js CJS）形式

レガシーコード、プリロードスクリプト、ユーティリティはCommonJS形式（`.cjs` または `.js`）を使用します。

**インポート例**:
```javascript
const Store = require('electron-store');
const cron = require('node-cron');
const { objectSort, getNow } = require('./mainSubmodule.cjs');

// ESM/Mixedモジュールのインポート（デフォルトエクスポート対応時）
const oaw = require('about-window');
const { default: openAboutWindow } = oaw;
```

**エクスポート例**:
```javascript
module.exports = {
  objectSort,
  getNow,
  getToday,
  isObjEmpty,
  mergeDeeply
};
```

### 3.3 ファイル拡張子の使用規則

| 拡張子 | 用途 | モジュールシステム |
|--------|------|------------------|
| `.mjs` | ESMメインモジュール | ESM (import/export) |
| `.cjs` | CommonJS互換モジュール | CommonJS (require/module.exports) |
| `.js` | レンダラープロセス、プリロード等 | CommonJS (require/module.exports) |

### 3.4 ESM と CommonJS の相互運用

CommonJSモジュールをESMから利用する場合：

```javascript
// CommonJSモジュルは {default} で取得
import localDB from './models/localDBModels.cjs';
const { sqlite3, eldataModel } = localDB;

// または createRequire を使用
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const someLib = require('some-library');
```

ESMモジュールをCommonJSから利用する場合は、非同期インポートが必要：

```javascript
// 非推奨（同期的な相互運用は難しい）
// ESMモジュールはCommonJSから直接requireできない

// 代替案：ESM形式で記述し直すか、ラッパーを用意
```

---

## 4. 命名規則

### 4.1 定数

`UPPER_SNAKE_CASE` を使用してください：

```javascript
const DEFAULT_PORT = 3610;
const MAX_RETRY_COUNT = 5;
const DATABASE_DIR = path.join(userHome, appname);
const HAL_API_BASE_URL = 'https://hal.sugi-lab.net/api';
const SOCKET_TIMEOUT_MS = 5000;
const UPLOAD_UNIT_NUM = 100;
const appname = 'PLIS';
```

**定数の分類**:

| パターン | 説明 | 例 |
|---------|------|-----|
| `URL_*` | Web API エンドポイント | `HAL_API_BASE_URL`, `WEATHER_API_ENDPOINT` |
| `*_MS` / `*_SEC` | 時間単位定数 | `SOCKET_TIMEOUT_MS`, `RETRY_INTERVAL_SEC` |
| `MAX_*` / `MIN_*` | 上限・下限 | `MAX_RETRY_COUNT`, `MIN_PORT` |
| `DEFAULT_*` | デフォルト値 | `DEFAULT_PORT`, `DEFAULT_LANGUAGE` |

### 4.2 変数・関数

`camelCase` を使用してください：

```javascript
// スカラー値・プリミティブ
let isRun = false;
let config = {};
let persist = {};
let sendIPCMessage = null;

// 関数
function objectSort(obj) { /* ... */ }
function getNow() { /* ... */ }
function mergeDeeply(target, source) { /* ... */ }
function isObjEmpty(obj) { /* ... */ }
```

**変数命名の規約**:

| パターン | 説明 | 例 |
|---------|------|-----|
| `is*` / `has*` | ブール値 | `isRun`, `isEnabled`, `hasError`, `isDone` |
| `get*` | ゲッター関数（値を取得） | `getNow()`, `getConfig()`, `getToday()` |
| `set*` | セッター関数（値を設定） | `setConfig()`, `setTimeout()` |
| `on*` | イベントハンドラ | `onReceived()`, `onConnected()`, `onChange()` |
| `handle*` | 処理関数 | `handleError()`, `handleMessage()` |
| `send*` | 送信関数 | `sendIPCMessage()`, `sendData()` |
| `*List` | 配列・リスト | `objList`, `deviceList`, `errorList` |
| `*Map` / `*Dict` | マップ・辞書 | `facilityMap`, `configDict` |
| `*Data` | データオブジェクト | `roomEnvData`, `eldataModel` |
| `*Job` / `*Task` | スケジュール・タスク | `observationJob`, `uploadTask` |

### 4.3 クラス・型定義

`PascalCase` を使用してください：

```javascript
class EchonetDevice { /* ... */ }
class HueBridge { /* ... */ }

/**
 * @typedef {Object} HueConfig
 * @property {boolean} enabled
 * @property {string} key
 */

/**
 * @typedef {Object} NetworkSettings
 * @property {string} ipAddress
 * @property {number} port
 */
```

### 4.4 モジュール・オブジェクト

`camelCase` を使用してください。モジュール名は `main*` で始まる：

```javascript
let mainHue = {
  // 状態管理メンバー
  isRun: false,
  client: null,
  observationJob: null,

  // 設定・永続データ
  config: null,
  persist: {},

  // パブリックメソッド
  start: async function (_sendIPCMessage) { /* ... */ },
  stop: function () { /* ... */ },
  setConfig: async function (_config) { /* ... */ },

  // 内部メソッド
  _initialize: function () { /* ... */ },
  _processData: function (data) { /* ... */ }
};

let mainEL = {
  objList: ['05ff01'],      // ELオブジェクトリスト
  localaddresses: null,     // ローカルアドレス
  elsocket: null,           // ソケット参照
  isRun: false,             // 実行中フラグ
  disableIPv6: false        // IPv6無効フラグ
};
```

**モジュールメンバーの命名順序**:

1. **状態メンバー**: `isRun`, `connected`, `initialized`
2. **リソース参照**: `client`, `socket`, `connection`, `job`, `task`
3. **設定・データ**: `config`, `persist`, `data`
4. **コールバック**: `callback`, `listener`, `handler`
5. **パブリックメソッド**: `start()`, `stop()`, `setConfig()`
6. **プライベートメソッド**: `_initialize()`, `_process*()`, `_validate*()`

### 4.5 プライベートメンバー

規約として、前置き `_` を付けてください（言語レベルのプライベートではなく）：

```javascript
let mainModule = {
  // パブリック
  isRun: false,
  start: function () { /* ... */ },
  stop: function () { /* ... */ },

  // プライベート（内部使用のみ）
  _internalState: {},
  _processData: function () { /* ... */ },
  _validateInput: function (input) { /* ... */ },
  _formatOutput: function (data) { /* ... */ }
};
```

### 4.6 IPC チャネル名の命名規則

IPC通信で使用するチャネル名は **`camelCase`** で統一してください：

```javascript
// 設定関連
'renewXxxConfigView'      // UI更新：設定画面を最新状態で表示
'configSaved'             // 完了通知：設定が保存された

// データ更新関連
'renewXxx'                // UI更新：デバイスデータを更新
'fclXxx'                  // UI更新：ファシリティ（機器状態）を更新

// イベント通知
'xxxConnected'            // 接続完了
'xxxDisconnected'         // 接続断
'xxxError'                // エラー発生

// リクエスト・レスポンス
'queryXxxStatus'          // クエリ送信
'responseXxxStatus'       // クエリ応答
```

**詳細パターン**:

| チャネル形式 | 用途 | 具体例 |
|----------|------|--------|
| `renew<Module><Subject>` | UI に<Subject>の最新値を反映 | `renewELConfigView`, `renewHueState`, `renewNetatmoData` |
| `fcl<Module>` | ファシリティ（機器状態）更新 | `fclEL`, `fclHue`, `fclIkea` |
| `<module>Connected` | 接続・リンク完了 | `HueLinked`, `NetatmoConnected`, `esmConnected` |
| `<module>Disconnected` | 接続断・リンク解除 | `HueUnlinked`, `NetatmoDisconnected` |
| `<module>Error` | エラー発生通知 | `NetatmoAuthError`, `ElSearchError`, `HueConnectionError` |
| `configSaved` | 設定保存完了（通常、引数でモジュール名を指定） | `configSaved` (arg: 'EL') |
| `createXxx` | UI要素生成 | `createCalendar`, `createMenu` |
| `renewXxx` | UI要素更新 | `renewCalendar`, `renewSystemInfo` |
| `show<Data>` | データ表示 | `showGarmin`, `showWeather` |

**NG パターン**:

```javascript
// ❌ 避けるべき命名
'updateEL'                // 曖昧。何の更新？
'EL_update'               // snake_caseは使用しない
'update-el'               // ケバブケースは使用しない
'UpdateEL'                // PascalCaseは使用しない
'EL-connected'            // ケバブケースは使用しない
'el:connected'            // コロン区切りは使用しない
```

**具体例（実装済みの規約例）**:

```javascript
// 良い例
sendIPCMessage('renewELConfigView', config);     // 設定画面更新
sendIPCMessage('fclEL', persist);                // ELデータ更新
sendIPCMessage('HueLinked', newKey);             // Hue接続完了
sendIPCMessage('renewNetatmoConfigView', config);// Netatmo設定更新
sendIPCMessage('NetatmoAuthError', errorMsg);    // Netatmoエラー通知
sendIPCMessage('configSaved', 'EL');             // 設定保存完了（モジュール名付き）
sendIPCMessage('renewCalendar', holidayData);    // カレンダー更新
sendIPCMessage('createCalendar', data);          // カレンダー生成
sendIPCMessage('showGarmin', garminData);        // Garminデータ表示
```

### 4.7 ファイル名

**メインプロセスモジュール**: `main<FeatureName>.mjs`

```
mainEL.mjs              # ECHONET Lite
mainHue.mjs             # Philips Hue
mainNetatmo.mjs         # Netatmo Weather Station
mainArp.mjs             # ARP（Address Resolution Protocol）
mainSubmodule.cjs       # Shared Utilities
mainAutoAssessment.mjs  # Auto Assessment Logic
```

**レンダラープロセス**: `<function>.js` または `sub<FeatureName>.js`

```
renderMain.js           # メインレンダラー
subEL.js                # EL関連レンダラー
subHue.js               # Hue関連レンダラー
```

---

## 5. JSDocコメント規約

### 5.1 モジュールドキュメント

すべてのモジュールの先頭に `@module` ディレクティブを記述：

```javascript
/**
 * @module mainEL
 * @description ECHONET Lite（EL）デバイスの管理。
 * スマートメータ、空調機器など複数のELデバイスを探索・監視し、
 * 操作状態をレンダラーへ同期する。
 */
```

### 5.2 型定義（@typedef）

設定オブジェクト、永続データはtypedefで定義してください：

```javascript
/**
 * @typedef {Object} ELConfig
 * @property {boolean} enabled 機能有効フラグ
 * @property {boolean} debug デバッグログ出力
 * @property {string} IPv4 IPv4アドレス（'auto'で自動検出）
 * @property {string} IPv6 IPv6アドレス（'auto'で自動検出）
 */

/**
 * @typedef {Object} ELPersist
 * @property {Record<string, any>} facilities 探索済みELデバイス群
 * @property {Record<string, any>} parsed 解析済み設備構造
 */

/** @type {ELConfig} */
let config = { enabled: true, debug: false, IPv4: 'auto', IPv6: 'auto' };

/** @type {ELPersist} */
let persist = { facilities: {}, parsed: {} };
```

### 5.3 関数・メソッドドキュメント

- 説明、パラメータ、戻り値を明記
- 非同期関数は `@async` を追加
- エラーの可能性がある場合は `@throws` を追加

```javascript
/**
 * 現在時刻を "YYYY-MM-DD HH24:MI:SS" 形式で返す。
 * @function
 * @returns {string} フォーマット済み日時文字列
 * @example
 * const now = getNow();
 * console.log(now); // "2025-12-25 14:30:45"
 */
function getNow() {
  // ...
}

/**
 * ELネットワーク探索を開始する。重複起動時は現在状態をUIへ再送。
 * @async
 * @param {(channel:string, ...args:any[])=>void} _sendIPCMessage IPC送信関数
 * @returns {Promise<void>}
 * @throws {Error} ソケットバインド失敗時
 */
start: async function (_sendIPCMessage) {
  // ...
}

/**
 * 設定をディープマージして保存する。
 * @param {Partial<SystemConfig>} [_config] 上書き対象の設定オブジェクト
 * @returns {Promise<void>}
 */
setConfig: async function (_config) {
  // ...
}
```

### 5.4 コールバック関数の定義

頻繁に受け渡されるコールバックはtypedefで定義：

```javascript
/**
 * @callback SendIPCMessage
 * @param {string} channel IPC通信チャネル名
 * @param {any} [payload] 送信ペイロード（省略可）
 * @returns {void}
 */

/**
 * @callback ChangeCallback
 * @param {Record<string, any>} newData 変更されたデータ
 * @returns {void}
 */
```

### 5.5 インラインコメント

複雑なロジックに対しては、行末コメントまたはブロックコメントで説明：

```javascript
// 重複起動対策：既に実行中なら現在状態をUIへ再送して終了
if (mainEL.isRun) {
  sendIPCMessage('renewELConfigView', config);
  return;
}

// ELオブジェクト初期化：スーパー（コントローラ）として自分を登録
const myELObj = {
  "80": [0x30],  // 動作状態
  "81": [0xff],  // 設置場所
  "8a": [0x00, 0x00, 0x77]  // メーカーコード
};
```

---

## 6. エラーハンドリング

### 6.1 基本的なパターン

```javascript
// 非同期処理のエラーハンドリング
try {
  const result = await someAsyncFunction();
  // ...
} catch (error) {
  console.error(
    new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"),
    '| mainModule.method() error:',
    error
  );
  // 必要に応じてユーザーへIPC通知
  if (sendIPCMessage) {
    sendIPCMessage('ErrorOccurred', { module: 'mainModule', message: error.message });
  }
}
```

### 6.2 デバッグログ付きエラーハンドリング

デバッグフラグに基づいて条件付きログ出力：

```javascript
if (config.debug) {
  console.log(
    new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"),
    '| mainEL.start() exploring devices...'
  );
}

config.debug ? console.error('...', error) : 0;  // ワンライナー形式
```

### 6.3 ファイルI/O

```javascript
fs.readFile(filePath, 'utf-8', (err, data) => {
  if (err) {
    console.error(
      new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"),
      '| file not found:',
      err
    );
    // フォールバック処理
    mainCalendar.getHolidays();  // リモート取得へ
    return;
  }
  // 成功時の処理
  processData(data);
});
```

---

## 7. 設定・永続データ管理

### 7.1 Config パターン

各モジュールは`config`オブジェクトを持ち、electron-storeで永続化：

```javascript
/**
 * @typedef {Object} NetatmoConfig
 * @property {boolean} enabled 機能有効フラグ
 * @property {string} clientId OAuth2 Client ID
 * @property {string} clientSecret OAuth2 Client Secret
 * @property {string} refreshToken 現在のRefresh Token
 * @property {boolean} debug デバッグ出力
 */
let config = {
  enabled: false,
  clientId: '',
  clientSecret: '',
  refreshToken: '',
  debug: false
};

// 起動時にストアから読み込み
config.enabled = store.get('config.Netatmo.enabled', config.enabled);
config.clientId = store.get('config.Netatmo.clientId', config.clientId);
// ... 以下同様
```

### 7.2 Persist パターン

状態・結果データは`persist`オブジェクトで管理：

```javascript
/**
 * @typedef {Object} NetatmoPersist
 * @property {any[]} [devices] デバイス情報の配列
 * @property {number} [lastUpdated] 最終更新UNIXタイム
 */
let persist = {};

// 起動時に読み込み
persist = store.get('persist.Netatmo', {});
```

### 7.3 Store への保存・読み込み

```javascript
// 読み込み
const value = await store.get('config.Module.key', defaultValue);

// 保存
await store.set('config.Module', config);

// 削除
try { store.delete('config.OldKey'); } catch (_) { }
```

---

## 8. 非同期処理・スケジューリング

### 8.1 async/await の使用

```javascript
/**
 * 非同期初期化と監視開始。
 * @async
 * @returns {Promise<void>}
 */
start: async function (_sendIPCMessage) {
  sendIPCMessage = _sendIPCMessage;

  try {
    config.enabled = await store.get('config.Module.enabled', false);

    if (!config.enabled) {
      return;
    }

    // 非同期処理
    await mainModule.initialize();
    mainModule.isRun = true;

  } catch (error) {
    console.error('Initialization failed:', error);
  }
}
```

### 8.2 定期ジョブ（node-cron）

```javascript
/**
 * @type {cron.ScheduledTask|null}
 */
let observationJob = null;

/**
 * 毎日0:00に実行するジョブを開始。
 */
function startDailyJob() {
  observationJob = cron.schedule('0 0 * * *', async () => {
    config.debug ? console.log('Daily job running') : 0;

    try {
      await performDailyTask();
    } catch (error) {
      console.error('Daily job error:', error);
    }
  });

  observationJob.start();
}

/**
 * ジョブを停止する。
 */
function stopJob() {
  if (observationJob) {
    observationJob.stop();
    observationJob = null;
  }
}
```

### 8.3 複数非同期処理の待機

```javascript
try {
  await Promise.all([
    mainEL.start(sendIPCMessage),
    mainHue.start(sendIPCMessage),
    mainNetatmo.start(sendIPCMessage)
  ]);
} catch (error) {
  console.error('Parallel initialization failed:', error);
}
```

---

## 9. IPC通信（Electron）

IPC（Inter-Process Communication）は Electron でメインプロセスとレンダラープロセス間の通信に使われます。
チャネル名・メッセージ形式を統一して、保守性を高めてください。

### 9.1 チャネル命名規則（詳細版）

**基本ルール**:

- **形式**: `camelCase` （先頭は小文字）
- **接頭辞**: モジュール名またはアクション種別
- **言語**: 日本語混在禁止（英数のみ）

**チャネル接頭辞の分類**:

| 接頭辞 | 意味 | 使用元 | 例 |
|--------|------|--------|-----|
| `renew*` | UI画面を最新状態で表示/更新 | Main→Renderer | `renewELConfigView`, `renewHueState` |
| `fcl*` | ファシリティ（機器状態）を更新 | Main→Renderer | `fclEL`, `fclHue`, `fclIkea` |
| `create*` | UI要素を新規生成 | Main→Renderer | `createCalendar`, `createMenu` |
| `show*` | データを表示 | Main→Renderer | `showGarmin`, `showWeather` |
| `*Connected` | デバイス接続/リンク完了 | Main→Renderer | `HueLinked`, `NetatmoConnected` |
| `*Disconnected` | デバイス接続断/リンク解除 | Main→Renderer | `HueUnlinked`, `NetatmoDisconnected` |
| `*Error` | エラー発生を通知 | Main→Renderer | `NetatmoAuthError`, `ElSearchError` |
| `*Request` / `query*` | 情報をリクエスト | Renderer→Main | `querySystemStatus`, `getDeviceList` |
| `config*` | 設定関連の統一チャネル | Bidirectional | `configSaved` (引数で詳細指定) |

**具体的なチャネル名リファレンス**:

```javascript
// 設定関連
'renewELConfigView'         // EL設定画面を更新
'renewHueConfigView'        // Hue設定画面を更新
'renewNetatmoConfigView'    // Netatmo設定画面を更新
'renewSystemConfigView'     // システム設定画面を更新
'configSaved'               // 設定保存完了通知（引数："EL", "Hue", etc.）

// データ更新（ファシリティ = 機器状態）
'fclEL'                     // EL機器状態を更新
'fclHue'                    // Hue照明状態を更新
'fclIkea'                   // IKEA照明状態を更新
'renewNetatmo'              // Netatmo環境データを更新
'renewOmron'                // Omronセンサデータを更新
'renewCo2s'                 // CO2センサデータを更新

// イベント・接続状態
'HueLinked'                 // Hueブリッジをリンク完了
'HueUnlinked'               // Hueブリッジをアンリンク
'NetatmoConnected'          // Netatmoに接続完了
'NetatmoAuthError'          // Netatmo認証エラー
'ElSearchError'             // EL探索エラー
'omronDisconnected'         // Omronセンサ接続断

// UI要素操作
'createCalendar'            // カレンダーUIを生成
'renewCalendar'             // カレンダーUIを更新
'showGarmin'                // Garminデータを表示

// その他
'URLopen'                   // URLをブラウザで開く
'PageInSearch'              // ページ内検索を実行
'already'                   // Renderer準備完了通知
```

### 9.2 チャネル引数の規約

**形式**:

```javascript
// 単一の値の場合
sendIPCMessage('renewELConfigView', config);

// 複数の値の場合（オブジェクトで渡す）
sendIPCMessage('fclEL', {
  facilities: facilityData,
  parsed: parsedData,
  timestamp: Date.now()
});

// 通知系（引数なし、またはモジュール名のみ）
sendIPCMessage('configSaved', 'EL');  // モジュール名を指定
sendIPCMessage('HueLinked', newKey);
```

**引数の型規約**:

| チャネル種別 | 推奨引数型 | 例 |
|-----------|-----------|-----|
| `renew*ConfigView` | Object | `{ ...config }` |
| `fcl*` | Object | `{ facilities, parsed, lastUpdate }` |
| `*Connected` | string \| Object | `newKey` または `{ token, expiresAt }` |
| `*Error` | string \| Object | `"Error message"` または `{ module, message, code }` |
| `configSaved` | string | `"EL"` （モジュール名） |
| `show*` | Object \| Array | データオブジェクト |

### 9.3 メインプロセス内での IPC 送信

メインプロセスのモジュールでは、IPC送信関数をコールバック経由で受け取る：

```javascript
/**
 * @callback SendIPCMessage
 * @param {string} channel チャネル名（camelCase）
 * @param {any} [payload] 送信ペイロード
 * @returns {void}
 */
let sendIPCMessage = null;

/**
 * モジュール初期化とリスナー登録。
 * @async
 * @param {SendIPCMessage} _sendIPCMessage IPC送信関数
 * @returns {Promise<void>}
 */
start: async function (_sendIPCMessage) {
  sendIPCMessage = _sendIPCMessage;  // コールバック登録

  // 重複起動対策
  if (mainModule.isRun) {
    sendIPCMessage('renewModuleConfigView', config);
    sendIPCMessage('fclModule', persist);
    return;
  }

  // 初期化処理...
  mainModule.isRun = true;
  sendIPCMessage('configSaved', 'Module');
}

/**
 * IPC送信のガード付き実行。
 * @param {string} channel
 * @param {any} data
 * @returns {void}
 */
function _emitIPC(channel, data) {
  if (typeof sendIPCMessage === 'function') {
    sendIPCMessage(channel, data);
  } else {
    config.debug ? console.warn('IPC not initialized:', channel) : 0;
  }
}
```

### 9.4 プリロードスクリプトでの IPC 公開

プリロードスクリプトで、Renderer から呼び出し可能なIPC関数を公開：

```javascript
const { contextBridge, ipcRenderer } = require('electron');

/**
 * Renderer 向けIPC公開API
 * @namespace ipc
 */
contextBridge.exposeInMainWorld('ipc', {
  // 初期化・準備関連
  /**
   * Rendererが準備完了をMain に通知
   * @function
   */
  notifyReady: () => {
    ipcRenderer.invoke('already', '');
  },

  // URL操作
  /**
   * URLをブラウザで開く
   * @function
   * @param {string} url
   */
  openURL: (url) => {
    ipcRenderer.invoke('URLopen', url);
  },

  // ページ内検索
  /**
   * ページ内検索を実行
   * @function
   * @param {string} text 検索テキスト
   */
  search: (text) => {
    ipcRenderer.invoke('PageInSearch', text);
  },

  /**
   * 次を検索
   * @function
   * @param {string} text 検索テキスト
   */
  searchNext: (text) => {
    ipcRenderer.invoke('PageInSearchNext', text);
  },

  /**
   * 前を検索
   * @function
   * @param {string} text 検索テキスト
   */
  searchPrev: (text) => {
    ipcRenderer.invoke('PageInSearchPrev', text);
  },

  /**
   * 検索を停止
   * @function
   */
  searchStop: () => {
    ipcRenderer.invoke('PageInSearchStop');
  },

  // リスナー登録
  /**
   * Main からのメッセージをリッスン
   * @function
   * @param {string} channel チャネル名
   * @param {(event, data) => void} callback コールバック
   */
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, data) => callback(data));
  },

  /**
   * One-time リスナー登録
   * @function
   * @param {string} channel チャネル名
   * @param {(event, data) => void} callback コールバック
   */
  once: (channel, callback) => {
    ipcRenderer.once(channel, (event, data) => callback(data));
  }
});
```

**Renderer での使用例**:

```javascript
// チャネルをリッスン
window.ipc.on('renewELConfigView', (config) => {
  updateConfigUI(config);
});

window.ipc.on('fclEL', (data) => {
  updateELDevices(data);
});

window.ipc.on('configSaved', (moduleName) => {
  showNotification(`${moduleName} settings saved`);
});

// Main にリクエスト送信
window.ipc.openURL('https://example.com');
window.ipc.search('keyword');
```

### 9.5 NG チャネル命名パターン

以下は避けてください：

```javascript
// ❌ 避けるべき
'updateEL'                  // 曖昧。何の更新？
'EL_update'                 // snake_caseは使用しない
'update-el'                 // ケバブケースは使用しない
'UpdateEL'                  // PascalCaseは使用しない
'EL:connected'              // コロン区切りは使用しない
'el message'                // スペース含むのは使用しない
'renewElConfigView'         // モジュール名は大文字で始める
```

---

## 10. デバッグログ

### 10.1 デバッグログの出力

すべてのモジュールは`config.debug`フラグで条件付きログ出力：

```javascript
// 長形式
if (config.debug) {
  console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| mainEL.start()');
}

// ワンライナー形式（簡潔だが可読性注意）
config.debug ? console.log(new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"), '| process started') : 0;
```

### 10.2 ログ出力フォーマット

```
[YYYY-MM-DDTHH24:MI:SS] | moduleFunction() message
```

**例**:
```
2025-12-25T14:30:45 | mainEL.start()
2025-12-25T14:30:46 | mainEL.start() device discovered: 192.168.1.100
```

### 10.3 エラーログ

エラーは常に（debugフラグに関わらず）出力：

```javascript
console.error(
  new Date().toFormat("YYYY-MM-DDTHH24:MI:SS"),
  '| mainEL.communication() error:',
  error
);
```

---

## 11. ファイルI/O

### 11.1 ファイル読み込み

```javascript
// ユーザーホームディレクトリを参照
const appname = 'PLIS';
const isWin = process.platform === 'win32';
const userHome = process.env[isWin ? 'USERPROFILE' : 'HOME'];
const databaseDir = path.join(userHome, appname);

// ファイル存在確認
if (!fs.existsSync(databaseDir)) {
  fs.mkdirSync(databaseDir, { recursive: true });
}

// 読み込み（コールバック形式）
fs.readFile(path.join(databaseDir, 'config.json'), 'utf-8', (err, data) => {
  if (err) {
    console.error('File read error:', err);
    return;
  }
  // 処理続行
});
```

### 11.2 ファイル書き込み

```javascript
fs.writeFile(
  path.join(databaseDir, 'output.csv'),
  csvData,
  { encoding: 'utf-8' },
  (err) => {
    if (err) {
      console.error('File write error:', err);
      return;
    }
    config.debug ? console.log('File saved') : 0;
  }
);
```

---

## 12. スタイル・フォーマッティング

### 12.1 インデント

- **タブ（Tab）** を使用
- タブは4スペース相当の幅で表示

### 12.2 行の長さ

- 推奨：80〜100文字以内
- やむを得ず超える場合は120文字程度

### 12.3 セミコロン

- **省略可**（JavaScript慣例に従う）
- ただし、バグリスクがある場所は使用推奨：
  - ASI（自動セミコロン挿入）による副作用の恐れ
  - 複雑な式の境界

### 12.4 スペース

```javascript
// 関数定義：スペースなし
function functionName(param1, param2) {
  // 関数本体
}

// オブジェクトリテラル：スペースあり
let obj = { key: 'value', num: 42 };

// 演算子周囲：スペースあり
let result = a + b;
if (condition === true) { /* ... */ }

// カンマ後：スペースあり
let arr = [1, 2, 3];
```

### 12.5 括弧スタイル

```javascript
// 関数定義の場合
function foo(x) {
  return x * 2;
}

// if文の場合
if (condition) {
  // ブロック
} else {
  // ブロック
}

// オブジェクトメソッドの場合
let obj = {
  method: function() {
    // 処理
  }
};
```

---

## 13. パッケージ・バージョン管理

### 13.1 package.json 構造

```json
{
  "name": "plis-app",
  "version": "2.0.0",
  "description": "Platform for Life Improvement and Support",
  "main": "src/main.mjs",
  "type": "module",
  "scripts": {
    "start": "electron-forge start",
    "make": "electron-forge make",
    "publish": "electron-forge publish"
  },
  "dependencies": {
    "electron-store": "^8.0.0",
    "node-cron": "^3.0.0",
    "echonet-lite": "^latest"
  },
  "devDependencies": {
    "electron": "latest",
    "electron-forge": "latest"
  }
}
```

### 13.2 ESM / CommonJS 混在対応

メインの`package.json`で型を明示：

```json
{
  "type": "module",
  "exports": {
    ".": "./src/main.mjs",
    "./utils": "./src/mainSubmodule.cjs"
  }
}
```

---

## 14. テスト・品質保証

### 14.1 テストファイルの命名

```
test-*.mjs      # ESM形式のテストファイル
test-*.js       # CommonJS形式のテストファイル
*.test.mjs      # ユニットテスト
*.spec.mjs      # インテグレーションテスト
```

### 14.2 テストドキュメント

テスト関数もJSDocで記述：

```javascript
/**
 * ELネットワーク探索のテスト
 * @test
 * @description 複数のELデバイスが正常に探索されることを検証
 */
async function testELDiscovery() {
  // テストコード
}
```

---

## 15. 設定ファイル（Forge、Webpack等）

### 15.1 forge.config.cjs

Electron Forgeの設定ファイル。CommonJS形式で記述：

```javascript
/**
 * @file forge.config.cjs
 * @module forge.config
 * @description Electron Forge 設定（ビルド・署名・パッケージング）
 */

module.exports = {
  packagerConfig: { /* ... */ },
  makers: [ /* ... */ ],
  publishers: [ /* ... */ ],
  plugins: [ /* ... */ ]
};
```

### 15.2 設定コメント

複雑な設定項目は説明コメントを付加：

```javascript
osxSign: {
  identity: process.env.APPLE_IDENTITY,    // Apple Developer ID
  hardenedRuntime: true,                   // Hardened Runtime有効化
  entitlements: "macOS/entitlements.plist" // 権限定義ファイル
}
```

---

## 16. 例外・トラブルシューティング

### 16.1 よくある違反パターン

❌ **避けるべき**:

```javascript
// ❌ グローバル変数の過度な使用
var globalState = {};  // var の使用は非推奨

// ❌ マジックナンバー
setTimeout(() => { /* ... */ }, 5000);  // なぜ5秒？

// ❌ 不明確な変数名
let d = new Date();
let x = config.a;
let fn = () => {};

// ❌ デバッグコードの残存
console.log("DEBUG:", someVar);  // 本番環境に残さない
debugger;  // 本番環境に残さない

// ❌ 例外処理なし
const data = JSON.parse(userInput);  // 失敗可能

// ❌ 非同期処理の不適切な待機
fetch(url).then(r => r.json());  // 戻り値を使用していない
```

✅ **推奨パターン**:

```javascript
// ✅ 明確な定数定義
const SOCKET_TIMEOUT_MS = 5000;

// ✅ わかりやすい変数名
let now = new Date();
let isEnabled = config.enabled;
let formatDate = (date) => { /* ... */ };

// ✅ デバッグログをフラグで制御
config.debug ? console.log("State:", state) : 0;

// ✅ 例外処理
try {
  const data = JSON.parse(userInput);
  // 処理
} catch (error) {
  console.error('Parse error:', error);
}

// ✅ 非同期処理の適切な待機
const data = await fetch(url).then(r => r.json());
```

### 16.2 Lint ツール（推奨）

将来的な導入を検討：

```json
{
  "devDependencies": {
    "eslint": "^8.0.0",
    "eslint-config-airbnb": "^19.0.0",
    "prettier": "^2.8.0"
  }
}
```

---

## 17. ドキュメント作成

### 17.1 README.md

モジュールごとに簡潔なREADMEを配置（必要に応じて）：

```markdown
# mainEL - ECHONET Lite管理モジュール

## 説明
ECHONET Liteプロトコルを使用したスマートメータ・空調等の管理。

## 使用例
\`\`\`javascript
import { mainEL } from './mainEL.mjs';
await mainEL.start(sendIPCMessage);
\`\`\`

## 設定項目
- `enabled`: 機能有効フラグ
- `debug`: デバッグ出力

## 永続データ
- `facilities`: 探索済みELデバイス
```

### 17.2 JSDoc生成

JSDocコメントからHTMLドキュメントを生成：

```bash
jsdoc -c jsdoc.json src/**/*.mjs
```

---

## 18. レビューチェックリスト

コード変更時、以下をチェック：

- [ ] JSDocコメントは完全か（@module, @param, @returns など）
- [ ] 新規関数に説明コメントがあるか
- [ ] エラーハンドリングがあるか
- [ ] デバッグログの出力条件は正しいか
- [ ] config/persistの型定義はあるか
- [ ] ESM/CommonJSの区別は適切か
- [ ] Storeへの保存・読み込みが適切か
- [ ] IPC通信のチャネル名は命名規則に従っているか
- [ ] ファイル拡張子（.mjs / .cjs / .js）は適切か
- [ ] グローバル変数は最小限か

---

## 19. 関連ドキュメント

- [Electronドキュメント](https://www.electronjs.org/)
- [Node.js fs Module](https://nodejs.org/api/fs.html)
- [node-cronドキュメント](https://github.com/node-cron/node-cron)
- [JSDoc](https://jsdoc.app/)
- [ES6 Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)

---

**最終更新**: 2025-12-25
**作成者**: AI Assistant (Copilot)
**バージョン**: 1.0.0
