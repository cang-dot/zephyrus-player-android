import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * AppLayout.vue 被 router/index 静态引用;任何经 store/router 的测试导入链都会
 * 把这个 .vue 拖进 node 环境的转译(vitest 未装 vue 插件,直接解析失败)。
 * 测试只关心被测的纯逻辑模块,布局桩仅声明路由所需的空壳。
 */
const AppLayoutStub = fileURLToPath(
  new URL('./tests/stubs/AppLayoutStub.ts', import.meta.url)
);

export default defineConfig({
  resolve: {
    alias: {
      '@/layout/AppLayout.vue': AppLayoutStub,
      '@': fileURLToPath(new URL('./src/renderer', import.meta.url))
    }
  },
  test: {
    environment: 'happy-dom'
  }
});
