# PLIS プロジェクト ToDo リスト

本ドキュメントは、PLIS（Platform for Life Improvement and Support）の開発・メンテナンスにおけるタスク管理用のToDoリストです。

## 📋 優先タスク (直近のバグ修正・安定化)

### 1. ECHONET Lite / IPv6対応の安定化
- [ ] **IPv6重複登録の検証**
  - [ ] 同一ネットワーク内にIPv4とIPv6が混在する場合に、デバイスが重複して登録される事象が発生していないか検証。
  - [ ] 重複防止ロジックが正常に機能しているか [mainEL.mjs](file:///Users/sugimura/Documents/plis/app/src/mainEL.mjs) の確認。
- [ ] **IPv6エラーハンドリング**
  - [ ] 一部のローカル環境で発生しているIPv6関連のエラー原因調査とフォールバック処理の実装。

### 2. サードパーティAPI連携の調整
- [ ] **Netatmoのタイムアウト対策**
  - [ ] Netatmo APIの接続タイムアウト発生時の自動リトライ・エラーログ出力の動作確認（[mainNetatmo.mjs](file:///Users/sugimura/Documents/plis/app/src/mainNetatmo.mjs)）。
- [ ] **SwitchBot API バージョン確認**
  - [ ] 現在利用している `switchbot-handler` で API v1.1 が安定して動作しているかの動作検証（[mainSwitchBot.mjs](file:///Users/sugimura/Documents/plis/app/src/mainSwitchBot.mjs)）。

---

## 🎨 UI/UX 改善タスク

### 1. グラフ表示の調整
- [ ] **X軸レスポンシブ動作の検証**
  - [ ] 30分刻みの時間軸描画において、ウィンドウサイズを変更した際に表示崩れや見切れる問題が発生しないか検証。
  - [ ] キリの良い時間での表示が維持されているか確認。

### 2. セキュリティおよび堅牢性
- [ ] **XSS対策の再確認**
  - [ ] 外部センサーやAPIから取得した文字列をレンダラーに描画する際、サニタイズ処理が漏れなく適用されているかのレビュー（[js/index.js](file:///Users/sugimura/Documents/plis/app/src/public/js/index.js) および `sub*.js`）。

---

## 🛠️ 開発環境・ドキュメンテーション

### 1. ドキュメント更新
- [ ] **JSDocの更新**
  - [ ] 最近のESM移行やモジュール変更に伴うJSDocコメントの乖離を修正。
  - [ ] `docs` ディレクトリで `npm start` を実行し、APIマニュアル（`docs/jsdoc`）を最新に更新。
- [ ] **READMEの整理**
  - [ ] 開発環境構築手順の最新化（Node.js推奨バージョンなどの記載見直し）。

### 2. 依存関係のメンテナンス
- [ ] **パッケージのアップデート検証**
  - [ ] `npm-check-updates`（`ncu`）を実行し、安全にアップデート可能なライブラリを更新。特に `electron` や `sequelize` などの主要パッケージの挙動確認。
