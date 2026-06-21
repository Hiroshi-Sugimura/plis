# サードパーティAPI連携の調整 実装計画書 (改訂版)

Netatmo および SwitchBot API 連携における通信タイムアウト対策、サーバー負荷軽減、およびユーザーへの親切なエラー通知・対処方法の提示機能を実装します。

## 改善方針

### 1. サーバー負荷対策 (Netatmo)
- **ポーリング間隔の変更**:
  - Netatmo ウェザーステーションのデータ更新間隔は約10分であるため、現在の「1分毎」のポーリングから **「10分毎（`*/10 * * * *`）」** に変更し、外部サーバーへの負荷を大幅に削減します。
  - アプリ起動時および設定保存時には即時取得を行います（手動同期と同等の動作）。

### 2. リトライ失敗時および通信切断時の挙動とUI通知
一時的な接続エラー（タイムアウト等）と、ユーザーの再操作が必要な認証エラー（トークン無効等）を明確に区別し、ユーザーに対処方法を提示します。

#### ① 一時的な通信エラー (タイムアウト、オフライン等) の場合
- **内部処理**: 最大3回リトライ後、エラーをログに記録してその回のcron処理を終了します。次の10分後に自動で再試行します。
- **画面表示**: UIへ `NetatmoConnectionError` を通知し、以下のメッセージをトースト表示します。
  - *「Netatmoサーバーとの通信に一時的に失敗しました。インターネット接続環境、またはNetatmoのサーバー稼働状況を確認してください（自動で再試行を継続します）。」*

#### ② ユーザー側の対処が必要なエラー (Refresh Tokenの無効化など) の場合
- **内部処理**: リフレッシュトークンを自動でクリアし、cron観測ジョブを停止します。
- **画面表示**: UIへ `NetatmoAuthError` を通知し、以下の具体的な解決策をトーストで表示します。
  - *「Netatmoの認証期限が切れました。認証情報（Refresh Token）が無効です。Netatmo開発者ポータルで新しいRefresh Tokenを生成し、アプリの設定画面で再設定を行ってください。」*

---

## Proposed Changes

### 1. Netatmo 連携の安定化と負荷軽減

#### [MODIFY] [mainNetatmo.mjs](file:///Users/sugimura/Documents/plis/app/src/mainNetatmo.mjs)
- `cron.schedule` のポーリング間隔を `*/10 * * * *`（10分おき）に変更します。
- `refreshAccessToken` の `axios.post` に `timeout: 10000` (10秒) を設定します。
- `fetchStationsData` において、通信エラー（タイムアウト、接続エラー）発生時に最大3回（2秒間隔）のリトライ処理を実装します。
- リトライにすべて失敗した場合は `NetatmoConnectionError` IPCイベントをUIへ送信します。
- 認証エラー（`invalid_grant`等）発生時は、トークンをクリアした上で `NetatmoAuthError` IPCイベントを送信します。

#### [MODIFY] [subNetatmo.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subNetatmo.js)
- `NetatmoConnectionError` のイベント受信処理を追加し、接続切断の警告と自動再試行の旨を分かりやすくトーストで表示します。
- `NetatmoAuthError` 受信時のエラーメッセージ表示を、具体的な対処手順（開発者ポータルでの再生成）を含んだ親切な表記に改善します。

### 2. SwitchBot 連携の安定化

#### [MODIFY] [index.js (switchbot-handler)](file:///Users/sugimura/Documents/plis/app/src/node_modules/switchbot-handler/index.js)
- `SwitchBotHandler` クラスの `axios.create` に `timeout: 10000` (10秒) を追加します。

---

## Verification Plan

### Automated / Manual Verification
- **JSDocビルド確認**:
  - `docs` ディレクトリで `npm run start` を実行し、修正後のJSDoc生成で警告やエラーが出ないことを確認します。
- **起動・動作検証**:
  - `npm run mac` を起動し、Netatmoのデータ取得が10分おきのスケジュールで動作していること、初期起動時に即時取得が行われることを確認します。
- **エラー処理のシミュレーション検証**:
  - Wi-Fiを切断、または設定にダミーの無効なRefresh Tokenを設定した際、想定通りのエラーメッセージ（接続確認、または再認証の対処法）が画面上に表示されるか検証します。
