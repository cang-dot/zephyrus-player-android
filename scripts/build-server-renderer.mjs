/**
 * 把视频皮肤渲染层打包为服务端可用的 CommonJS 模块。
 *
 * 产物：server/render/renderer.cjs（配合 @napi-rs/canvas 在 Node 逐帧渲染）。
 * 开发机执行：node scripts/build-server-renderer.mjs
 * 部署：server/render/ 整目录随 Paramiko 同步到服务器。
 */

import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(rootDir, 'server', 'render');

fs.mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(rootDir, 'src/renderer/utils/videoRenderers/serverEntry.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: path.join(outDir, 'renderer.cjs'),
  // 渲染层的 @/* 别名由 tsconfig.web.json 的 paths 解析
  tsconfig: path.join(rootDir, 'tsconfig.web.json'),
  // 原生 canvas 库在服务端 node_modules 中，不进 bundle
  external: ['@napi-rs/canvas'],
  minify: false,
  sourcemap: false,
  logLevel: 'info'
});

console.log('[build-server-renderer] written:', path.join(outDir, 'renderer.cjs'));
