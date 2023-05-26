# README for PLIS developper

# Source Code

https://github.com/Hiroshi-Sugimura/plis

## License

PLISのソースコードはMITライセンスにて配布しています。

https://github.com/Hiroshi-Sugimura/plis/LICENSE

正確には原文を読んで欲しいのですが、簡単に表現すれば次のようになります。

```
コピー利用、配布、変更の追加、変更を加えたもの再配布、商用利用、有料販売など自由に利用可能

このソフトウェアの著作権表示（「Copyright (c) 年 作者名」）と、このライセンスの全文（英語の原文）を、
ソースコードや、ソースコードに同梱したライセンス表示用の別ファイルなどに掲載すること。
（ユーザが確認可能な場所に書いてください）

保証無し。このソフトを利用して問題が起きた際に、私たちは一切の責任を負いません。
```

なお、他のモジュールのライセンスに関しては各モジュールのライセンスをご確認ください。
利用しているモジュール群は下記ファイルにまとめています。

https://hiroshi-sugimura.github.io/plis/v1/app/src/modules.json



# API manual

https://hiroshi-sugimura.github.io/plis/v1/docs/jsdoc/index.html

# Logs

- 0.4.0 JSDoc対応開始
- 0.3.0 エアコンのモード設定機能追加
- 0.2.0 Mac動作確認
- 0.1.0 Windows動作確認
- 0.0.1 HEMS-LoggerからPLISにリポジトリ移行、ソースコード公開開始。2023.05.26

# Work around

- node-gyp (windows + sqlite3モジュールで発生しやすい)

エラー内容

```
? Checking your system
? Locating application
? Loading configuration
? Preparing native dependencies: 0 / 1
  ? node-gyp failed to rebuild 'C:\Users\HiroshiSUGIMURA\Documents\plis\v1\app\node_modules\sqlite3'
?? Running generateAssets hook

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
