<div align="center">
  <img src="https://github.com/Hiroshi-Sugimura/plis/blob/main/img/plis_main_yoko_w.png?raw=true" alt="PLIS Logo" width="600">

  # PLIS
  **Platform for Life Improvement and Support**

  [![GitHub release](https://img.shields.io/github/v/release/Hiroshi-Sugimura/plis)](https://github.com/Hiroshi-Sugimura/plis/releases)
  [![License](https://img.shields.io/github/license/Hiroshi-Sugimura/plis)](https://github.com/Hiroshi-Sugimura/plis/blob/main/LICENSE)
  [![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue.svg)](#)
</div>

---

## 📖 プロジェクト概要
**PLIS** は、生活の質（QoL）を向上させ、快適な暮らしをサポートするためのオープンなプラットフォームです。家庭内の様々なIoT機器やセンサデータを統合し、可視化・制御するための基盤を提供します。

### ✨ 主な機能
- 📊 **多彩なグラフ表示**: 室温、湿度、CO2濃度、消費電力などを30分単位で精緻に可視化。
- 🏠 **マルチデバイス対応**: SwitchBot, Netatmo, Omron, IKEA Tradfri, Hue など、主要なIoT機器を統合制御。
- ⚡ **ECHONET Lite 対応**: 家電製品との高度な連携を低遅延で実現。
- 🖥️ **クロスプラットフォーム**: Windows と macOS の両方で動作。
- 🔐 **プライバシー重視**: データはローカルに蓄積され、ユーザーがコントロール可能。

---

## � マニュアル・ドキュメント
プロジェクトを最大限に活用するためのリソースです。

- � **[User's Manual (WEB)](https://plis.sugi-lab.net/)** - 一般ユーザー向け操作ガイド
- 🛠️ **[Developer's Manual (JSDoc)](https://hiroshi-sugimura.github.io/plis/jsdoc/)** - 開発者向け技術ドキュメント

---

## ⚖️ ライセンス (Licenses)
PLISは個人利用を前提に提供しております。そのまま販売するなどの直接的な商用利用行為は禁止します。

### 1. PLIS 本体のライセンス
アプリケーション及びソースコードは **[MITライセンス](https://github.com/Hiroshi-Sugimura/plis/blob/main/LICENSE)** にて配布しています。

> [!TIP]
> **MITライセンスの要約 (日本語解説)**
> - コピー利用、配布、変更、商用利用、有料販売など自由に利用可能です。
> - **必須条件**: 著作権表示（Copyright (c) 年 作者名）と、ライセンスの全文（英語原文）をソースコードや同梱ファイルに掲載してください。
> - **保証無し**: 本ソフトウェアを利用して生じた問題に対して、作成者は一切の責任を負いません。

### 2. サードパーティモジュールのライセンス
利用している外部モジュール群の詳細は、下記ファイルにまとめています。
- 📜 **[Modules.json](https://hiroshi-sugimura.github.io/plis/app/src/modules.json)**

> [!NOTE]
> 各モジュールのライセンスは開発者によって変更される可能性があるため、商用開発に利用する場合は各自で最新の状態を確認してください。

---

## 🛠️ API および 認証について (APIs and certifications)
多種多様なIoT商品のプロトコルを利用していますが、メーカー側のAPI変更や廃止により機能が制限される場合があります。

> [!WARNING]
> **商用利用に関する重要な注意**
> - **ECHONET Lite**: 商用ソフトウェアとして販売する場合は、エコーネットコンソーシアムの認証を受ける必要があります。
> - **API利用権**: 商用開発時には、API利用やプロトコル利用の権利を開発者が確認・保証する必要があります。

---

## 📜 更新履歴 (Logs)

### 最新バージョン
- **v2.3.1**
  - グラフの時間軸修正（常に30分刻みを維持しつつレスポンシブ対応）
  - IPv6対応を更新
  - ログ出力の最適化（減少）

<details>
<summary>過去の変更履歴を表示</summary>

- **v2.3.0**
  - Netatmoのログ減少、強制終了で設定が飛ぶbug fix、Ikeaのバグ修正、Hueのバグ修正、mjs統一、requestsをaxiosに置き換え、logger未定義修正、重複Toast修正、EL高速化、ログ抑制
- **v2.2.0**
  - バックグラウンドモード追加、スタートアップ登録機能追加、CO2Sのdebug
- **v2.1.0**
  - Garminグラフ追加、パッケージ化を方法を最新にした、グラフレスポンシブ対応、EL通信を修正、Netatmoを新API対応、全体少し高速化、レンダラのクラッシュ対応、HAL.sync対応
- **v2.0.1**
  - パッケージバージョンアップ、EL検索を同期処理にした
- **v2.0.0**
  - Electronのバージョンアップ対応、ESModulesに対応、electron-forge V6対応
- **v1.1.6**
  - SwitchBotのバッテリーアイコン修正、内部パッケージ更新、CO2のボタン・Toast・Win update対応、電力スマメのDisable時バグ修復、auto assessment / HAL初期化バグ修正
- **v1.1.5**
  - SwitchBot APIカウンタ導入、macキーボードショートカット問題解決、メニュー整理、UIアップデート（SwitchBot, IKEA）、IKEA制御追加、各モジュールDebugログ
- **v1.1.4**
  - EL旧型探索、HAL同期機能、グラフ表示バグ修正、カレンダー日替わり自動更新、スマメ安定動作オプション、SwitchBot API v1.1対応、Config直接ペースト対応（Electronコア変更影響）、EL電力量センサクラス対応、IKEA表示/エラー対応、HAL Garmin連携、得点付け機能追加、内部モジュール最新化
- **v1.1.3**
  - 解析不能ELパケット受信時のエラー処理改善
- **v1.1.2**
  - SwitchBot Plug Mini対応、エラー画面出力整理、Moduleライセンス表デザイン変更/リンク、about PLIS、ページ内検索暫定対応、EL v1.0サーチ、ログ削除、パッケージ更新、拡大縮小対応
- **v1.1.1**
  - Store配布開始
- **v1.1.0**
  - 外部モジュール・権利関係ドキュメント整備、カレンダー自動取得
- **v1.0.1**
  - ショートカット作成バグの修正
- **v1.0.0**
  - 初期リリース完成
- **v0.4.0**
  - JSDoc対応開始
- **v0.3.0**
  - エアコンのモード設定機能追加
- **v0.2.0**
  - Mac動作確認完了
- **v0.1.0**
  - Windows動作確認完了
- **v0.0.1**
  - HEMS-Loggerからリポジトリ移行、ソースコード公開開始 (2023.05.26)

</details>

---

Copyright © 2023 Sugimura Laboratory All Rights Reserved.
