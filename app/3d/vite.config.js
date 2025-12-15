// app/3d/vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Viteプロジェクトのルートを app/3d ディレクトリに設定
  root: resolve(__dirname),

  build: {
    // 出力先: app/3d から見て ../src/public/js/3d に出力
    // (既存の app/src/public/js の中に新しいディレクトリを作成します)
    outDir: resolve(__dirname, '../src/public/js/3d'),
    emptyOutDir: true,

    // アプリケーションとしてビルドする設定
    rollupOptions: {
      // エントリーポイント: app/3d/src/main.js を指定
      input: resolve(__dirname, 'src/main.js'),
      output: {
        entryFileNames: 'main.js',
      }
    }
  }
});
