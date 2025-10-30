const { app, BrowserWindow } = require('electron');
const path = require('path');

// GPU機能を有効化
app.commandLine.appendSwitch('enable-accelerated-2d-canvas', 'true');
app.commandLine.appendSwitch('enable-webgl2-compute-context', 'true');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      hardwareAcceleration: true,
      webSecurity: false  // blob:file:// URLを許可
    }
  });

  // CSPヘッダーを設定
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' blob: data: file:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' blob: data: file:; " +
          "connect-src 'self' blob: data: file:; " +
          "media-src 'self' blob: data: file:;"
        ]
      }
    });
  });

  // index.htmlを読み込む（修正）
  mainWindow.loadFile(path.join(__dirname, 'public', 'index.htm'));
  
  // DevToolsを開く（デバッグ用）
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// アプリの準備ができたらウィンドウを作成
app.whenReady().then(createWindow);

// すべてのウィンドウが閉じられたらアプリを終了（macOS以外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// アプリがアクティブになったらウィンドウを作成（macOS）
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});