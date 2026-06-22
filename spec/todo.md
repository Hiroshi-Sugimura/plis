# PLIS プロジェクト ToDo リスト

本ドキュメントは、PLIS（Platform for Life Improvement and Support）の開発・メンテナンスにおけるタスク管理用のToDoリストです。

## 📋 優先タスク (直近 of the PLIS)

### 1. Fitbit健康データ直接連携機能の追加
- [x] **直接連携APIクライアントおよびOAuth 2.0フローの実装**
  - [x] メインプロセスでの一時ローカルWebサーバー起動によるOAuth 2.0認可コード受取処理の実装（[mainFitbit.mjs](file:///Users/sugimura/Documents/plis/app/src/mainFitbit.mjs)）。
  - [x] Fitbit API（プロフィール、日次活動量、睡眠、心拍ゾーン、体重・体脂肪率）から全データを取得する同期処理の実装。
  - [x] `storeSingleton.mjs` を利用したアクセストークンおよびリフレッシュトークンの安全な保存・自動更新処理の実装。
  - [x] `node-cron` を利用した午前3時の日次自動同期処理の追加。
- [x] **データベースモデル定義の追加**
  - [x] SQLite3/SequelizeによるFitbitデータ格納用5テーブル（IOT_FitbitProfiles, IOT_FitbitDailies, IOT_FitbitSleeps, IOT_FitbitHeartRates, IOT_FitbitWeights）のスキーマ定義追加（[localDBModels.mjs](file:///Users/sugimura/Documents/plis/app/src/models/localDBModels.mjs)）。
- [x] **フロントエンド表示画面およびグラフUIの実装**
  - [x] Fitbit設定画面アコーディオン（Client ID/Secret設定フォーム、連携ステータス、手動同期ボタン）の追加（[index.htm](file:///Users/sugimura/Documents/plis/app/src/public/index.htm)）。
  - [x] ウェアラブルタブ内へのFitbitデータ表示コンテナ（睡眠、心拍ゾーン、歩数・活動量、体重・BMI）の追加。
  - [x] レンダラー側の制御スクリプト（Chart.jsによる4グラフの描画とインスタンス管理）の実装（[subFitbit.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subFitbit.js)）。
  - [x] `preload.js` へのFitbit関連IPCブリッジAPIの追加（[preload.js](file:///Users/sugimura/Documents/plis/app/src/preload.js)）。
  - [x] `index.js` でのIPCメッセージ受信中継処理の追加（[index.js](file:///Users/sugimura/Documents/plis/app/src/public/js/index.js)）。
  - [x] Fitbitのテーマカラー（ティール `#00B0B9`）に合わせたスタイル定義の追加（[formal.css](file:///Users/sugimura/Documents/plis/app/src/public/css/formal.css)）。

### 2. ECHONET Lite / IPv6対応の安定化
- [x] **IPv6重複登録の検証**（※ライブラリ側で対応するため対象外としてクローズ）
- [x] **IPv6エラーハンドリング**（※ライブラリ側で対応するため対象外としてクローズ）

### 3. サードパーティAPI連携の調整
- [x] **Netatmoのタイムアウト対策**
  - [x] Netatmo APIの接続タイムアウト発生時の自動リトライ・エラーログ出力の動作確認（[mainNetatmo.mjs](file:///Users/sugimura/Documents/plis/app/src/mainNetatmo.mjs)）。
- [x] **SwitchBot API バージョン確認**
  - [x] 現在利用している `switchbot-handler` で API v1.1 が安定して動作しているかの動作検証（[mainSwitchBot.mjs](file:///Users/sugimura/Documents/plis/app/src/mainSwitchBot.mjs)）。

### 4. ECHONET Lite 電動窓（0265）対応
- [x] **電動窓クラス（0265）の検知・可視化・制御の実装**
  - [x] メインプロセスでの自動検知および定期状態監視（[mainEL.mjs](file:///Users/sugimura/Documents/plis/app/src/mainEL.mjs)）。
  - [x] レンダラープロセスでの電源、開閉動作、開度（スライダー）、速度制御インターフェースの実装（[subELcontrol.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subELcontrol.js)）。
  - [x] 電動窓専用アイコン画像（`0265.png`）の追加。

---

## 🎨 UI/UX 改善タスク

### 1. グラフ表示の調整
- [x] **X軸レスポンシブ動作の検証**
  - [x] 30分刻みの時間軸描画において、ウィンドウサイズを変更した際に表示崩れや見切れる問題が発生しないか検証。
  - [x] キリの良い時間での表示が維持されているか確認。

### 2. カレンダーと天気情報の連携
- [x] **カレンダーへの天気アイコン表示・クリック詳細表示**
  - [x] 日本国内（JMA優先）と海外（OWM優先）の自動ソース判別ロジックの実装（[mainCalendar.mjs](file:///Users/sugimura/Documents/plis/app/src/mainCalendar.mjs)）。
  - [x] 過去実績値（データベース）と未来予測値（気象庁予報・OWM5日間予報）の出し分けロジックの実装。
  - [x] カレンダーセル内へのFontAwesome天気アイコンの表示、およびクリック時の詳細記録ポップアップモーダルの実装。

### 3. SwitchBot オフラインデバイスのグレーアウト
- [x] **オフラインデバイスの可視化と制御の無効化**
  - [x] ステータス未取得のデバイスをオフラインと判定し、カード全体のグレーアウトおよび操作無効（pointer-events: none）を適用。
  - [x] オフライン時の未定義エラー回避（クラッシュ防止ガード）の実装（[subSwitchBot.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subSwitchBot.js)）。
  - [x] デバイス名の横に赤字で `(オフライン)` の明示的警告テキストを追記。

### 4. セキュリティおよび堅牢性
- [x] **XSS対策の再確認**
  - [x] 外部センサーやAPIから取得した文字列をレンダラーに描画する際、サニタイズ処理が漏れなく適用されているかのレビュー（[js/index.js](file:///Users/sugimura/Documents/plis/app/src/public/js/index.js) および `sub*.js`）。

---

## 🛠️ 開発環境・ドキュメンテーション

### 1. ドキュメント更新
- [x] **JSDocの更新**
  - [x] 最近のESM移行やモジュール変更に伴うJSDocコメントの乖離を修正。
  - [x] `docs` ディレクトリで `npm start` を実行し、APIマニュアル（`docs/jsdoc`）を最新に更新。
- [x] **READMEの整理**
  - [x] 開発環境構築手順 of 最新化（Node.js推奨バージョンなどの記載見直し）。

### 2. 依存関係のメンテナンス
- [x] **パッケージのアップデート検証**
  - [x] `npm-check-updates`（`ncu`）を実行し、安全にアップデート可能なライブラリを更新。特に `electron` や `sequelize` などの主要パッケージの挙動確認。
