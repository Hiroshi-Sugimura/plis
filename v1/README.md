# README for developper



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
