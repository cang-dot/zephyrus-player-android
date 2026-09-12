/**
 * 直接下载 chrome-headless-shell zip（绕过 @puppeteer/browsers 的安装器，
 * 解压用系统 tar——此前安装器解压步骤疑似被安全软件拦截）。
 *
 * 执行：node scripts/ensure-headless-shell.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const buildId = process.env.SHELL_BUILD || '153.0.8010.36';
const cacheDir = 'C:\\Users\\Administrator\\.cache\\chrome-headless-shell';
const url = `https://storage.googleapis.com/chrome-for-testing-public/${buildId}/win64/chrome-headless-shell-win64.zip`;

fs.mkdirSync(cacheDir, { recursive: true });
const zipPath = path.join(cacheDir, `shell-${buildId}.zip`);

if (!fs.existsSync(zipPath)) {
  console.log('downloading:', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(zipPath, buf);
  console.log('saved:', zipPath, `${(buf.length / 1048576).toFixed(1)} MB`);
} else {
  console.log('zip cached:', zipPath);
}

// 解压（Windows 自带 tar 是 libarchive，支持 zip）
const extractDir = path.join(cacheDir, `win64-${buildId}`);
if (!fs.existsSync(path.join(extractDir, 'chrome-headless-shell.exe'))) {
  fs.mkdirSync(extractDir, { recursive: true });
  const r = spawnSync('tar', ['-xf', zipPath, '-C', extractDir], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('unzip failed');
}
const exe = path.join(extractDir, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
if (!fs.existsSync(exe)) throw new Error('exe not found after extract: ' + exe);
console.log('executablePath:', exe);
