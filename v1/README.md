<img src='https://hiroshi-sugimura.github.io/plis/v1/img/plis_main_yoko.png' alt='logo'>

# README for PLIS developpers

このWebサイトはPLIS開発者のための情報をまとめています。
開発にドキュメントが追い付いていかないことが多々ありますがご了承ください。

# Source Code

ソースコードはMITライセンスで、Githubで提供してます。

[Github](https://github.com/Hiroshi-Sugimura/plis)

# Database Schima (ER diagram)

PLISが実行されるPCでは、通信ログをデータベースで記録しています。
このDBのスキーマは次のようになっています。

<embed src='../lifelog.pdf' width='220' height='317'>

[Download](https://github.com/Hiroshi-Sugimura/plis/v1/docs/lifelog.pdf)


# License

PLISは各種モジュールや各社のIoTサービス及びプロトコルを利用しています。
従って、PLISのソースコードを利用した商用ソフトウェア開発をする場合は、PLISのライセンスのみならず、各社のライセンスやプロトコルの認証などを必要とします。
下記に外観を示します。

## PLIS

PLISのアプリケーション及びソースコードはMITライセンスにて配布しています。

[LICENSE file](https://github.com/Hiroshi-Sugimura/plis/LICENSE)

正確には原文を読んで欲しいのですが、簡単に表現すれば次のようになります。

```
コピー利用、配布、変更の追加、変更を加えたもの再配布、商用利用、有料販売など自由に利用可能

このソフトウェアの著作権表示（「Copyright (c) 年 作者名」）と、このライセンスの全文（英語の原文）を、
ソースコードや、ソースコードに同梱したライセンス表示用の別ファイルなどに掲載すること。
（ユーザが確認可能な場所に書いてください）

保証無し。このソフトを利用して問題が起きた際に、私たちは一切の責任を負いません。
```

## Other modules

PLISは他のモジュールを含んでおり、それらのライセンスに関しては各モジュールのライセンスをご確認ください。
利用しているモジュール群は下記ファイルにまとめています。

[Modules.json](https://hiroshi-sugimura.github.io/plis/v1/app/src/modules.json)

基本的にはPLIS作成時において、利用している全モジュールが著作権をクリアしていることを確認しているつもりですが、各モジュール開発者がバージョンアップによってライセンスを変更した場合に追従できていない可能性はあります。
およその場合は、個人利用＆非商用において問題になることはないと思いますが、PLISのソースコードを利用して商用ソフトウェアを開発する場合には各社で知財を確認して保証する必要があります。


## APIs and certifications

PLISでは多種多様なIoT商品のAPI及びプロトコルを利用していますが、もしも商品提供している会社側のAPIが変更や廃止となった場合に、その機能が利用できなくなることがあります。


# Logs

- 0.4.0 JSDoc対応開始
- 0.3.0 エアコンのモード設定機能追加
- 0.2.0 Mac動作確認
- 0.1.0 Windows動作確認
- 0.0.1 HEMS-LoggerからPLISにリポジトリ移行、ソースコード公開開始。2023.05.26

# Copyright

Copyright © 2023-Now Sugimura Laboratory, KAIT All Rights Reserved.

# Development Environment

## PLISの開発

このソフトはNode.js、Electronをベースにしています。

1. Node.js（LTS板がおすすめ）をインストールしておく
2. ```~/<github>/plis/v1/app``` で ```npm i``` を実行しておく
3. Windowsなら```npm run win```、Macなら```npm run mac```で起動する
4. Buildする場合、```npm run make```でコンパイルできる。


## API Documentsの自動生成

このAPIマニュアルはJSDocで自動生成しています。

1. ```~/<github>/plis/v1/docs```で```npm i```を実行してJSDocをインストールする
2. ```npm start```で生成する。

## lifelog.dbのER図自動生成

lifelog.dbのER図はA5:SQL Mk-2で自動生成しています。

1. A5:SQL Mk-2をインストールしておく
[A5:SQL Mk-2 (x64, for Win)](ms-windows-store://pdp/?productid=9NSBB9XTJW86)
2. PLISを実行し、```~/PLIS/lifelog.db```をA5で開く
3. さらに、```~/<github>/plis/v1/docs/lifelog.aSer```を開く


# Work around

- node-gyp (windows + sqlite3モジュールで発生しやすい)

開発開始時、下記のようなエラーが出ることが良くあるが、これは開発環境がきちんと整っていない場合に出る。

```
o Checking your system
o Locating application
o Loading configuration
x Preparing native dependencies: 0 / 1
  x node-gyp failed to rebuild '~\plis\v1\app\node_modules\sqlite3'
- Running generateAssets hook

node-gyp failed to rebuild sqlite3
```

- 解決方法
Visual Studio 2022の場合

コマンドを実行して
```npm config edit```
適当な空行に下記を追加
```msvs_version=2022```

コマンドを実行して
```npm config edit -g```
適当な空行に下記を追加
```msvs_version=2022```
