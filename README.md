<img src='https://github.com/Hiroshi-Sugimura/plis/blob/main/img/plis_main_yoko_w.png' alt='logo'>

PLIS (Platform for Life Improvement and Support)

# User's Manual

- [This page (User's Manual)](https://plis.sugi-lab.net/)

# Developper's Manual

- [for PLIS developper's README](https://hiroshi-sugimura.github.io/plis/jsdoc/)


# Licenses

ライセンスや著作権に関する概要は下記に記しておきます。詳細はご自身でよく確認してお使いください。
PLISは個人利用を前提に提供しております。
そのまま販売するなどの直接的な商用利用行為は禁止します。


## License of the PLIS

PLISのアプリケーション及びソースコードはMITライセンスにて配布しています。

[LICENSE file](https://github.com/Hiroshi-Sugimura/plis/blob/main/LICENSE)

正確には原文を読んで欲しいのですが、簡単に表現すれば次のようになります。

```
コピー利用、配布、変更の追加、変更を加えたもの再配布、商用利用、有料販売など自由に利用可能

このソフトウェアの著作権表示（「Copyright (c) 年 作者名」）と、このライセンスの全文（英語の原文）を、
ソースコードや、ソースコードに同梱したライセンス表示用の別ファイルなどに掲載すること。
（ユーザが確認可能な場所に書いてください）

保証無し。このソフトを利用して問題が起きた際に、私たちは一切の責任を負いません。
```

## Licenses of Other modules

PLISは他のモジュールを含んでおり、それらのライセンスに関しては各モジュールのライセンスをご確認ください。
利用しているモジュール群は下記ファイルにまとめています。

[Modules.json](https://hiroshi-sugimura.github.io/plis/app/src/modules.json)

基本的にはPLIS作成時において、利用している全モジュールが著作権をクリアしていることを確認しているつもりですが、各モジュール開発者がバージョンアップによってライセンスを変更した場合に追従できていない可能性はあります。
およその場合は、個人利用＆非商用において問題になることはないと思いますが、PLISのソースコードを利用して商用ソフトウェアを開発する場合には各社で知財を確認して保証する必要があります。


## APIs and certifications

PLISでは多種多様なIoT商品のAPI及びプロトコルを利用していますが、もしも商品提供している会社側のAPIが変更や廃止となった場合に、その機能が利用できなくなることがあります。
およそ、個人利用＆非商用において問題になることはないと思いますが、PLISのソースコードを利用して商用ソフトウェアを開発する場合には開発者がAPI利用やプロトコル利用の権利を確認して保証する必要があります。

### 現時点で判明している商用利用に関する注意

- ECHONET Liteプロトコル利用に関して、商用ソフトウェアを開発・販売する場合はエコーネットコンソーシアムにて認証を受ける必要があります。


# Logs

- 2.0.0 Electronのバージョンアップ対応、ESModulesに対応、electron-forge V6対応
- 1.1.6 SwitchBotのバッテリー1/4のアイコン修正、内部パッケージ更新、CO2のボタンが効くようにした、CO2のToast修正、CO2のWin update対応、電力スマメのDisable時を設定が消えるbug fix、auto assessmentのbug fix、HAL有効時のMinorkeyMeansValues初期化bug fix
- 1.1.5 SwitchBot APIのカウンタ導入、まずはエラー表示のみ。macのキーボードショートカット問題解決、メニューにセパレータ追加など整理、Editメニュー追加。ソースコード整理。ユーザインタフェース関連アップデート（SwitchBot、IKEA）。IKEA制御追加。各モジュールのDebugログ。
- 1.1.4 EL旧型探索機能追加、HAL同期機能の追加、グラフ表示のバグ修正、カレンダーの日替わり自動更新、スマメ安定動作オプション追加、SwitchBot　API ver.1.1対応（かわりに制御機能がデグレした可能性あり）、ElectronのコアバージョンアップによってClipboard利用が厳しくなったのでしばらくはconfig.jsonに直接pasteしてください、再起動時にELの設定がdisableになるバグ修正、ELの電力量センサクラス対応（ただしELconvモジュールが計測値計算できていないので電力量が表示おかしい）、ELcontrolのデフォルト表記を修正、IKEA tradfriに表示対応とエラー対応、Detailsを見やすくした、HALとのGarminデータ連携機能追加、SwitchBotでのエラーログ処理、SwitchBotで詳細修得できなかったデバイスの格納を避ける、SwitchBotのデバイス数が多くなった時にAPI制限に引っかかるので状態取得を毎分から2分30秒に変更、SwitchBotの制御復活、HALと電力スマメのSecretTextの見た目処理、ELの電力量センサにてデータ未取得時のsplitの保護、得点付け機能追加、内部モジュール最新
- 1.1.3 解析不能ELパケットを受信したときにダイアログではなくエラーメッセージとする。
- 1.1.2 SwtichBot Plug Mini対応、エラーの画面出力整理、エラーログのルート作成、Moduleライセンスの表デザイン変更・URLリンク、about PLIS対応、ページ内検索暫定対応、EL ver. 1.0系サーチ対応、無駄なログ削除、パッケージ更新、拡大縮小
- 1.1.1 Store配布
- 1.1.0 外部モジュールのアップグレード、権利関係のドキュメント整備、カレンダー無い場合に自動取得
- 1.0.1 ショートカット作成バグの修正
- 1.0.0 一通り完成したのでpublish
- 0.4.0 JSDoc対応開始
- 0.3.0 エアコンのモード設定機能追加
- 0.2.0 Mac動作確認
- 0.1.0 Windows動作確認
- 0.0.1 HEMS-LoggerからPLISにリポジトリ移行、ソースコード公開開始。2023.05.26


# Copyright

Copyright © 2023 Sugimura Laboratory All Rights Reserved.
