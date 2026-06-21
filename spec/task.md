# SwitchBot オフラインデバイス・グレーアウト機能 タスクリスト

## 📋 タスク

### 1. フロントエンド（UI・カード描画）の実装
- [x] [subSwitchBot.js](file:///Users/sugimura/Documents/plis/app/src/public/js/subSwitchBot.js) の改修
  - `devState` の存在チェックとオフライン判定（`isOffline`）の実装
  - オフライン時のクラッシュ防止用ダミーステータスの動的適用
  - カードコンテナ（`<section class="dev">`）へのグレーアウト＋操作無効（pointer-events）インラインスタイルの適用
  - デバイス名横への `(オフライン)` テキスト表示の実装（各デバイスタイプ対応）

### 2. 検証と記録
- [x] アプリ起動確認（`npm run mac`）
- [x] オフラインデバイスが正しくグレーアウトされ操作不能になっているかの目視検証
- [x] `spec/todo.md` の更新
- [x] `spec/walkthrough.md` の更新
