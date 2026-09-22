import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import AutoImport from 'unplugin-auto-import/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression';
import VueDevTools from 'vite-plugin-vue-devtools';

export default defineConfig({
  base: './',
  envDir: resolve('.'),
  // 项目src
  root: resolve('src/renderer'),
  resolve: {
    alias: {
      '@': resolve('src/renderer'),
      '@renderer': resolve('src/renderer'),
      '@i18n': resolve('src/i18n')
    }
  },
  plugins: [
    vue(),
    // deploy_web.py 上传时会跳过所有 .gz 文件，gzip 产物对当前部署链路无用；
    // 且压缩阶段在大资源（24MB 词典 / 80MB 字体）上极慢，并观察到间歇性挂起
    // （构建进程长时间 0 CPU、dist 停在被清空态）。设 VITE_DISABLE_GZIP=1 跳过。
    ...(process.env.VITE_DISABLE_GZIP === '1' ? [] : [viteCompression()]),
    VueDevTools(),
    AutoImport({
      imports: [
        'vue',
        {
          'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar']
        }
      ]
    }),
    Components({
      resolvers: [NaiveUiResolver()]
    })
  ],
  publicDir: resolve('resources'),
  server: {
    host: '0.0.0.0',
    proxy: {}
  }
});
