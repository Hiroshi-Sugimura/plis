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
```

### 4.2 変数・関数

`camelCase` を使用してください：

```javascript
let sendIPCMessage = null;
let config = {};
let persist = {};

function objectSort(obj) { /* ... */ }
function getNow() { /* ... */ }
function mergeDeeply(target, source) { /* ... */ }
```

### 4.3 クラス・型定義

`PascalCase` を使用してください：

```javascript
class EchonetDevice { /* ... */ }

/**
 * @typedef {Object} HueConfig
 * @property {boolean} enabled
 * @property {string} key
 */
```

### 4.4 モジュール・オブジェクト

`camelCase` を使用してください：

```javascript
let mainHue = {
  isRun: false,
  config: null,
  start: async function (_sendIPCMessage) { /* ... */ },
  stop: function () { /* ... */ }
};

let mainEL = {
  objList: ['05ff01'],
  localaddresses: null,
  elsocket: null
};
```

### 4.5 プライベートメンバー

規約として、前置き `_` を付けてください（言語レベルのプライベートではなく）：

```javascript
let mainModule = {
  _internalState: {},  // プライベート
  _processData: function () { /* ... */ },  // プライベート
  publicMethod: function () { /* ... */ }   // パブリック
};
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

### 9.1 メインプロセス → レンダラープロセス

```javascript
/**
 * レンダラーへ設定変更を通知。
 * @param {string} channel IPC チャネル名（camelCase）
 * @param {any} data 送信データ
 */
function sendIPCMessage(channel, data) {
  if (typeof sendIPCMessage !== 'function') {
    console.warn('IPC not initialized');
    return;
  }
  // メインプロセス内で _sendIPCMessage が登録される
  sendIPCMessage(channel, data);
}

// 使用例
sendIPCMessage('renewELConfigView', config);
sendIPCMessage('fclEL', persist);
sendIPCMessage('configSaved', 'EL');
```

### 9.2 プリロードスクリプトでのIPC公開

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipc', {
  /**
   * @function
   * @desc レンダラーが準備完了をメインプロセスへ通知
   */
  notifyReady: () => {
    ipcRenderer.invoke('already', '');
  },

  /**
   * @function
   * @desc URLを既定ブラウザで開く
   * @param {string} url
   */
  openURL: (url) => {
    ipcRenderer.invoke('URLopen', url);
  },

  // その他のチャネル...
});
```

### 9.3 チャネル命名規則

- **camelCase** を使用
- 送受信元を示す接頭辞は不要（文脈から明白）
- 操作を表す動詞から開始：`renew*`, `fcl*`, `config*` など

```
// よい例
renew<ModuleName>ConfigView    # 設定画面更新
renew<ModuleName>              # データ更新
fcl<ModuleName>                # ファシリティ（機器状態）更新
configSaved                     # 設定保存完了通知
<ModulePrefix>Error             # エラー通知
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
