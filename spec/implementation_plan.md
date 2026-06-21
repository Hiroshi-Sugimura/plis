# 天気情報のカレンダー連携表示・詳細モーダル実装計画書

取得した天気情報（実績値・予報値）を「カレンダー」タブに統合表示し、アイコンをクリックすることでその日の気象データの全詳細をポップアップで確認できる新機能を実装します。

---

## User Review Required

> [!IMPORTANT]
> - **日本の基準と世界の基準の自動判別**:
>   - 原則として「日本国内はJMA（気象庁）」、「海外ロケーションはOpenWeatherMap（OWM）」を自動で優先ソースとして採用します。
>   - OpenWeatherMapの設定（`zipcode`）に国コードが含まれているか（例: `90210,us` や `London,uk`）、またはJMAが有効かどうかによって判別を行います。
> - **未来は予測、過去は実績の対応**:
>   - 未来（本日以降）: OWM/JMAの「天気予報（予測）」データを取得して表示します。
>   - 過去（昨日以前）: OWMの「天気実績ログ（`weatherTable`）」またはJMAの「予報データログ」を参照して、その日に実際に記録された気象情報を表示します。
> - **詳細ポップアップ**:
>   - 天気アイコンをクリックすると、その日全体の詳細な観測値・予報値（気温、湿度、気圧、風速、風向、雲量など）をまとめたダイアログが表示されます。

---

## Open Questions

特になし。

---

## Proposed Changes

### 1. データベースおよびバックエンド（メインプロセス）の改修

#### [MODIFY] [mainOwm.mjs](file:///Users/sugimura/Documents/plis/app/src/mainOwm.mjs)
- **グローバル対応と予報APIの取得**:
  - `zipcode` の解析ロジックを改善し、国コードが指定されていなければ自動で `,jp` を付与し、かつ海外の国コード（例: `,us` `,uk`）や都市名が入っている場合も正しくAPIが呼べるようにURL組み立てを修正します。
  - 従来の「現在の天気」APIに加え、「5日間/3時間予報」API（`api.openweathermap.org/data/2.5/forecast`）を定期的に（1時間毎）呼び出す処理を追加。
  - 取得した予報JSONデータをパースし、`persist.forecast` に格納して永続化します。これにより、海外のロケーションにおける「未来の予測」データを担保します。

#### [MODIFY] [mainCalendar.mjs](file:///Users/sugimura/Documents/plis/app/src/mainCalendar.mjs)
- **天気データ連携用APIの実装**:
  - IPCハンドラー `'CalendarGetWeather'` を新規実装します。
  - レンダラー（フロントエンド）から年・月を受け取り、その月の全日付における天気サマリー（アイコンタイプ、気象元、全詳細データ）をオブジェクト化して返します。
  - **ソース選択ロジック**: JMAが有効でかつ国内ロケーション（OWM設定が日本国内、またはJMA地域設定あり）の場合はJMAデータを優先。海外ロケーションまたはJMA無効時はOWMデータを優先します。
  - **実績値と予報値の抽出ロジック**:
    - **過去（実績）**: `weatherTable`（OWM実績記録）や `weatherForecastTable`（JMA予測ログ）から日付で検索し、最も近い時間のレコードを抽出。
    - **未来（予測）**: JMA予報データ（最新）または OWM予報キャッシュ（`persist.forecast`）から、該当日の正午前後の予測値を抽出。

#### [MODIFY] [main.mjs](file:///Users/sugimura/Documents/plis/app/src/main.mjs)
- `'CalendarGetWeather'` IPCハンドラーを登録し、`mainCalendar` に中継するコードを追加します。

### 2. フロントエンド（HTML・UI表示）の改修

#### [MODIFY] [preload.js](file:///Users/sugimura/Documents/plis/app/src/preload.js)
- `ipcRenderer.invoke('CalendarGetWeather', arg)` を公開し、フロントエンドから非同期で天気データを取得できるようにバインドします。

#### [MODIFY] [index.htm](file:///Users/sugimura/Documents/plis/app/src/public/index.htm)
- カレンダー日付セルのスタイル定義（`.calendar td` 等のCSS）に、天気アイコン表示用の余白やホバー時のクリックエフェクトを定義。
- 天気詳細を表示するための新規 `<dialog id="calendarWeatherDialog">` を定義します。

#### [MODIFY] [subCalendar.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subCalendar.js)
- カレンダー生成処理（`showProcess`）の中で、`window.ipc.CalendarGetWeather({ year, month })` を非同期で呼び出し、その月の天気情報を取得。
- セル生成（`createProcess`）時に、該当日に対応する天気アイコン（晴れ、曇り、雨、雪のFontAwesomeアイコン）を数字の直下に挿入。
- アイコンの親要素に `onclick="window.showWeatherDetail('${dateStr}')"` を設定。
- `window.showWeatherDetail(dateStr)` 関数を実装：
  - 選択された日付の天気詳細データを取り出し、綺麗に構造化したテーブルHTMLを組み立ててダイアログ内のコンテナに注入。
  - `calendarWeatherDialog.showModal()` を呼び出してポップアップ表示します。

---

## Verification Plan

### Automated Tests
- なし（手動UI連携テスト）

### Manual Verification
- **アプリ起動とカレンダー表示の確認**:
  - `npm run mac` でアプリを起動し、カレンダー画面に天気アイコンが表示されることを確認。
- **天気ソース自動判定テスト**:
  - OWMの設定（郵便番号）が `100-0001`（日本）の際、カレンダーの天気が「JMA（気象庁）」ソースから取得されることを確認。
  - OWMの設定を `90210,us`（アメリカ）等に変更して保存した際、カレンダーの天気が「OWM（OpenWeatherMap）」ソースに自動で切り替わることを確認。
- **過去と未来のデータ切り替えテスト**:
  - 本日以前の日付のアイコンをクリックし、実績値（OWM観測の気温や湿度など）がダイアログに表示されることを確認。
  - 本日以降の未来の日付のアイコンをクリックし、予報値（予報された天気や降水確率など）が表示されることを確認。
- **詳細ダイアログの動作確認**:
  - 天気アイコンをクリックした際、詳細情報がテーブル状に綺麗に並んだダイアログが正しくポップアップし、「閉じる」ボタンで閉じられることを確認。
