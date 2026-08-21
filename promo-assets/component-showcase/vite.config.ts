import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const repoRoot = resolve(import.meta.dirname, '../..');

export default defineConfig({
  root: import.meta.dirname,
  plugins: [vue(), Components({ resolvers: [NaiveUiResolver()] })],
  resolve: {
    alias: {
      '@': resolve(repoRoot, 'src/renderer'),
      '@i18n': resolve(repoRoot, 'src/i18n')
    }
  },
  publicDir: resolve(import.meta.dirname, 'public'),
  server: { port: 4189, strictPort: true },
  build: { outDir: resolve(import.meta.dirname, 'dist'), emptyOutDir: true }
});
