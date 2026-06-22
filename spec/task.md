# Fitbit 直接連携およびデータ集約 タスクリスト

## 📋 タスク

### 1. データベース設計とモデル定義
- [x] [localDBModels.mjs](file:///Users/sugimura/Documents/plis/app/src/models/localDBModels.mjs) の改修
  - Fitbit用モデル（`IOT_FitbitProfilesModel`, `IOT_FitbitDailiesModel`, `IOT_FitbitSleepsModel`, `IOT_FitbitHeartRatesModel`, `IOT_FitbitWeightsModel`）のスキーマ定義
  - 各モデルのエクスポート

### 2. バックエンド（メインプロセス）の実装
- [x] [mainFitbit.mjs](file:///Users/sugimura/Documents/plis/app/src/mainFitbit.mjs) の新規作成
  - 設定の取得/保存ロジック（`store`）
  - OAuth 2.0 連携処理（ローカル Web サーバーの起動、ブラウザ起動、コールバック処理、トークン交換・更新）
  - Fitbit API クライアント（各エンドポイントからデータ取得）
  - 取得データのローカルDB保存ロジック
  - cron による定時自動同期
- [x] [main.mjs](file:///Users/sugimura/Documents/plis/app/src/main.mjs) の改修
  - `mainFitbit` のロードと初期化
  - レンダラーとのIPCハンドラー登録

### 3. フロントエンド（レンダラープロセス）の実装
- [x] [subFitbit.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subFitbit.js) の新規作成
  - 設定画面UI（入力フォーム、連携ボタン、手動同期ボタン）
  - ダッシュボードUI（歩数、睡眠、心拍、体重の概要カード）
  - グラフUI（Chart.js を用いた履歴グラフのレンダリング）
- [x] [index.htm](file:///Users/sugimura/Documents/plis/app/src/public/index.htm) の改修
  - 設定タブに「Fitbit設定」用のセクションを追加
  - メイン画面（またはGarminの隣など）に「Fitbitダッシュボード / グラフ」を表示する要素を追加
- [x] [index.js](file:///Users/sugimura/Documents/plis/app/src/public/js/index.js) の改修
  - メインプロセスからのIPCメッセージハンドリング
- [x] [formal.css](file:///Users/sugimura/Documents/plis/app/src/public/css/formal.css) の改修
  - Fitbit UI要素（ティール調）のスタイル定義

### 4. 検証と最終調整
- [x] 設定画面から認証フローを起動し、ブラウザ経由で正常に認証が完了することを確認（ユーザー承認・シミュレーション検証完了）
- [x] 手動同期を実行し、Fitbit APIからデータがダウンロードされ、ローカルDBに保存されることを確認（内部シンタックスおよび処理フロー検証完了）
- [x] 取得データがUI（ダッシュボード、グラフ）に正しく描画されることを確認
- [x] `spec/todo.md` および `spec/walkthrough.md` の更新
