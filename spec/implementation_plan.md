# UI/UX改善（グラフ表示検証＆XSS対策強化）実装計画書

UI表示の堅牢性を高めるためのXSS対策（`innerHTML`から`textContent`への変更）と、グラフ表示のX軸レスポンシブ動作の検証状況についてまとめます。

## 現状の調査結果

### 1. グラフ表示（X軸レスポンシブ＆キリの良い数字）の検証状況
- **調査内容**:
  各UIモジュール（`subEL.js`, `subESM.js`, `subNetatmo.js`, `subOmron.js`, `subCo2s.js`, `subSwitchBot.js`）における Chart.js のX軸設定を調査しました。
- **結果**:
  すべてのグラフにおいて、X軸の設定で `autoSkip: true`, `source: 'labels'` および 30分間隔アライメント用のラベル定義（`LABEL_X_30` 等）がすでに適切に設定されていることを確認しました。
  これにより、レスポンシブ動作でウィンドウサイズが縮小した際、時間は重ならずに自動で間引かれつつ、キリの良い数字（アライメント）が維持されます。本件に関する追加のコード修正は不要です。

### 2. XSS対策の追加検証と課題
- **課題**:
  UIを表示するレンダラープロセス（JavaScriptファイル）の一部において、センサー値や外部APIから取得した文字列、設定画面の入力欄から取得した文字列をHTMLに埋め込む際、`innerHTML` が使用されている箇所が存在します。
  プレーンテキストを表示するだけで良い場所への `innerHTML` の使用は、将来的なXSS脆弱性の温床となるため、一律で `textContent` に置き換え、セキュリティを強化します。

---

## User Review Required

> [!NOTE]
> - 今回の修正は、プレーンテキストを扱う部分の `innerHTML` を `textContent` に置き換えるリファクタリングが中心となります。表示上の変化や、動的にボタンなどのHTMLマークアップを生成している箇所への影響はありません（動的HTML生成箇所は `innerHTML` のまま維持します）。

---

## Proposed Changes

以下に示すUIスクリプト内のプレーンテキスト代入箇所で、`innerHTML` を安全な `textContent` に書き換えます。

### レンダラープロセス（UI表示制御）の安全化

#### [MODIFY] [index.js](file:///Users/sugimura/Documents/plis/app/src/public/js/index.js)
- 検索マッチ件数表示（96行目、570行目）および自IPアドレス表示（365行目）の `innerHTML` を `textContent` に変更。

#### [MODIFY] [subCo2s.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subCo2s.js)
- 設置場所および各センサー値（55-60行目）の `innerHTML` を `textContent` に変更。

#### [MODIFY] [subESM.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subESM.js)
- 設置場所、IP、バージョン、各スマートメーター測定値（85-87, 90, 95-96, 100-101行目）の `innerHTML` を `textContent` に変更。

#### [MODIFY] [subNetatmo.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subNetatmo.js)
- ホーム名、更新時刻、各センサー値（73-79行目）の `innerHTML` を `textContent` に変更。

#### [MODIFY] [subHAL.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subHAL.js)
- プロファイル名、更新日時、ポイント、ランク、各スコア、およびクラウドから取得したコメント欄（131-149, 151行目）の `innerHTML` を `textContent` に変更。

#### [MODIFY] [subSwitchBot.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subSwitchBot.js)
- 取得時間表示（928, 962行目）の `innerHTML` を `textContent` に変更（動的にHTMLカラータグを挿入している62行目は現状維持）。

#### [MODIFY] [subClock.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subClock.js)
- 時計表示部（42行目）の `innerHTML` を `textContent` に変更。

---

## Verification Plan

### Automated / Manual Verification
- **JSDoc動作確認**:
  - `docs` ディレクトリで `npm run start` を実行し、APIマニュアル生成に問題がないことを確認します。
- **起動・表示確認**:
  - `npm run mac` を実行してアプリを起動し、各種センサー値やダッシュボードの表示が崩れず、正常に値が表示されていることを目視で確認します。
