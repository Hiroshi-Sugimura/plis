# 天気カレンダー連携機能 タスクリスト

## 📋 タスク

### 1. バックエンド（メインプロセス）の実装
- [x] [mainOwm.mjs](file:///Users/sugimura/Documents/plis/app/src/mainOwm.mjs) の改修
  - OWM郵便番号（zipcode）のグローバル解析対応
  - 5日間/3時間予報（forecast）APIの定期的取得および `persist.forecast` への格納
- [x] [mainCalendar.mjs](file:///Users/sugimura/Documents/plis/app/src/mainCalendar.mjs) の改修
  - 天気ソース（JMA / OWM）の自動選択ロジックの実装
  - 指定された年月の各日付について、過去（実績値）・未来（予報値）のデータをクエリして返す `'CalendarGetWeather'` APIの実装
- [x] [main.mjs](file:///Users/sugimura/Documents/plis/app/src/main.mjs) に `'CalendarGetWeather'` IPCハンドラーを追加

### 2. フロントエンド（UI・操作制御）の実装
- [x] [preload.js](file:///Users/sugimura/Documents/plis/app/src/preload.js) に `CalendarGetWeather` 呼び出し用関数を露出
- [x] [index.htm](file:///Users/sugimura/Documents/plis/app/src/public/index.htm) に詳細表示用のダイアログ `<dialog id="calendarWeatherDialog">` を追加
- [x] [subCalendar.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subCalendar.js) の改修
  - カレンダー描画時に `CalendarGetWeather` で天気情報を非同期取得
  - 各日付に FontAwesome の天気アイコン（Sunny, Cloudy, Rainy, Snowy）を表示
  - アイコンクリック時に `window.showWeatherDetail` を介して詳細情報をダイアログに表示する処理を実装

### 3. 検証と記録
- [x] アプリ起動確認（`npm run mac`）
- [x] 天気アイコン表示および詳細ポップアップの目視検証
- [x] `spec/todo.md` の更新
- [x] `spec/walkthrough.md` の更新
