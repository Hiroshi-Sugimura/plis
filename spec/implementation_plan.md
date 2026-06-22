# Fitbit 直接連携およびデータ集約 実装計画書

PLISアプリ内にFitbit APIとの直接連携機能（OAuth 2.0）を実装し、Fitbitから取得できるすべての健康データ（プロフィール、歩数・活動量、睡眠、心拍数、体重・体脂肪）を取得してローカルDBに保存し、UI上に可視化するための実装計画を以下に示します。

---

## User Review Required

> [!IMPORTANT]
> - **認証方式（OAuth 2.0 リダイレクト用のローカルサーバー起動）**:
>   - ユーザーがFitbit連携を実行すると、PLISアプリは一時的（認証時のみ）にローカルWebサーバー（デフォルト: ポート `5000`）を起動します。
>   - システムブラウザでFitbitの認可画面を開き、認証が完了すると `http://localhost:5000/callback` にリダイレクトされます。アプリは認可コードを検知してアクセストークンとリフレッシュトークンを取得し、ローカルサーバーを即座にシャットダウンします。
> - **取得するデータ範囲**:
>   - 取得可能な以下の全てのFitbitデータを取得・集約します：
>     1. **Profile**: ユーザープロフィール（ニックネーム、生年月日、性別、身長、体重など）
>     2. **Dailies**: 日次の歩数、消費カロリー、活動距離、アクティブ時間（レベル別）など
>     3. **Sleeps**: 睡眠期間、睡眠効率、睡眠ステージ（深い、浅い、レム、覚醒）など
>     4. **HeartRates**: 安静時心拍数、および心拍数ゾーン（脂肪燃焼、有酸素など）
>     5. **Weights**: 体重、BMI、体脂肪率
> - **保存形式**:
>   - トークン情報（AccessToken, RefreshToken）は `storeSingleton.mjs` を通じてローカルに保存されます。

---

## Open Questions

> [!NOTE]
> - **初回同期のデータ期間**:
>   - 初回連携時、または同期実行時に過去何日分のデータを遡って取得するかが課題となります。初期実装では直近 **30日間** のデータを遡って取得・保存する設計とします。期間の変更要望があればご指示ください。

---

## Proposed Changes

### 1. データベース・モデルの拡張

#### [MODIFY] [localDBModels.mjs](file:///Users/sugimura/Documents/plis/app/src/models/localDBModels.mjs)
- Fitbit用の各テーブル定義を末尾に追加し、エクスポート対象に加えます。
  - `IOT_FitbitProfilesModel` (プロフィールデータ)
  - `IOT_FitbitDailiesModel` (日次活動データ)
  - `IOT_FitbitSleepsModel` (睡眠データ)
  - `IOT_FitbitHeartRatesModel` (心拍データ)
  - `IOT_FitbitWeightsModel` (体重・体脂肪データ)

---

### 2. メインプロセス (Node.js) の実装と連携

#### [NEW] [mainFitbit.mjs](file:///Users/sugimura/Documents/plis/app/src/mainFitbit.mjs)
- Fitbit連携のコアロジックを管理する新規モジュールを作成します。
  - `store` からFitbit設定 (`config.Fitbit`) の取得と保存。
  - `http` モジュールを用いた、認可コード取得用の一時的なローカル callback サーバー（`localhost:5000` 等）の立ち上げ。
  - 認可コードからアクセストークンおよびリフレッシュトークンの取得・更新処理。
  - Fitbit API（`/1/user/-/profile.json`, `/1/user/-/activities/date/...` 等）からデータをダウンロードし、ローカルDBへ格納する同期処理 (`syncData()`)。
  - `node-cron` を使用した日次バックグラウンド自動同期。

#### [MODIFY] [main.mjs](file:///Users/sugimura/Documents/plis/app/src/main.mjs)
- `mainFitbit.mjs` をインポートし、`ipcMain.handle('already', ...)` で `mainFitbit.start(sendIPCMessage)` を呼び出すように追加します。
- レンダラーからの以下のIPCハンドラーを追加・中継します：
  - `getFitbitConfig`: 設定の取得
  - `saveFitbitConfig`: 設定の保存
  - `startFitbitAuth`: OAuth認証サーバーの起動とブラウザ遷移
  - `syncFitbitData`: 手動同期の実行

---

### 3. レンダラープロセス (HTML / JS / CSS) の実装と連携

#### [NEW] [subFitbit.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subFitbit.js)
- FitbitのUI制御を担当する新規モジュールを作成します。
  - 設定画面UI（クライアントID、クライアントシークレット、ポート等の入力フォームと「認証」ボタン、手動同期ボタン）。
  - ダッシュボードUI（歩数、睡眠スコア、安静時心拍数、体重の最新状況カード）。
  - グラフUI（Chart.js を利用して、歩数・睡眠時間・心拍ゾーン・体重の履歴を可視化）。
  - 各種状態の同期と `to-renderer` 経由のデータ受信ハンドラ（`window.showFitbitData`）。

#### [MODIFY] [index.html](file:///Users/sugimura/Documents/plis/app/src/public/index.html)
- 設定タブに「Fitbit設定」用のセクションを追加します。
- メイン画面（またはGarminの隣など）に「Fitbitダッシュボード / グラフ」を表示するためのHTML要素を追加します。

#### [MODIFY] [index.js](file:///Users/sugimura/Documents/plis/app/src/public/js/index.js)
- メインプロセスから送られてくるIPCメッセージ（`showFitbitData`, `renewFitbitConfigView`, `fitbitAuthStatus`）の受信ケースを追加し、`subFitbit.js` の関数を呼び出します。

#### [MODIFY] [index.css](file:///Users/sugimura/Documents/plis/app/src/public/css/index.css)
- Fitbit UI用のスタイル（Fitbit ofテーマカラーであるティール調 `#00B0B9` を基調としたカードデザイン、入力フォーム、グリッドレイアウトなど）を定義します。

---

## Verification Plan

### Automated Tests
- なし

### Manual Verification
1. **設定・連携機能**:
   - 設定画面でFitbitの `ClientID` と `ClientSecret` を入力し、保存。
   - 「Fitbit連携」ボタンをクリックし、システムブラウザ（Safari等）が開くことを確認。
   - 認可画面でログインおよびアクセス権を承諾。
   - 連携成功のブラウザ画面が表示され、PLISアプリ側で「連携成功」の状態になることを確認。
2. **データ同期**:
   - 「手動同期」ボタンをクリックし、Fitbit APIからデータが取得され、ローカルDB (`lifelog.db`) に保存されることを確認。
   - 取得データがダッシュボードおよびグラフに反映されることを確認。
3. **自動同期**:
   - バックグラウンドでの定期実行（cron）によってエラーなくトークンが更新され、データが最新状態に保たれることを確認。
