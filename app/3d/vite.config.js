import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: '../src/public/js/3d', // 出力先をindex.htmから見えるパスに変更
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/main.js'),
      name: 'SubAvatar',
      formats: ['es'],
      fileName: () => 'main.js'
    },
    rollupOptions: {
      output: {
        // assetFileNames以外は不要
      }
    }
  }
});
