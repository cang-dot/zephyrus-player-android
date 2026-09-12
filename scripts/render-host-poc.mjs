/**
 * 真复用渲染 POC：无头浏览器加载渲染宿主页（真实播放器样式组件），
 * 虚拟时钟逐帧步进 + 截图，验证「画面 = 播放器样式本体」。
 *
 * 开发机执行：
 *   NODE_PATH=C:\Users\Administrator\node_modules node scripts/render-host-poc.mjs
 *
 * 前置：puppeteer-core + 本机 Edge/Chrome；自动拉起 vite dev server。
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const OUT_DIR = process.env.POC_OUT || path.resolve('.render-poc-out');
const BASE_URL = process.env.DEV_URL || 'http://localhost:5199';
const BROWSER = process.env.BROWSER_PATH || null; // 缺省自动探测 Edge/Chrome
const STYLES = (process.env.POC_STYLES || 'error,default').split(',');
const FRAMES_PER_STYLE = Number(process.env.POC_FRAMES || 5);

fs.mkdirSync(OUT_DIR, { recursive: true });

function findBrowser() {
  if (BROWSER) return BROWSER;
  const candidates = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
  ];
  return candidates.find((p) => fs.existsSync(p));
}

/** 测试歌词（LRC 文本，MusicHook 自动解析） */
const LYRIC_TEXT = [
  '[00:00.00]路灯把影子拉长',
  '[00:03.20]我数着回家的方向',
  '[00:06.60]风穿过旧信纸',
  '[00:09.60]把名字吹散在夜里',
  '[00:13.20]而我还在这里'
].join('\n');

const PAYLOAD = {
  song: {
    id: 990001,
    name: '夜航西飞',
    ar: [{ id: 1, name: '陈默 / 林一' }],
    al: { id: 2, name: '夜航', picUrl: '' },
    picUrl: '',
    dt: 240000,
    playMusicUrl: '',
    lyric: LYRIC_TEXT
  },
  startSec: 5
};

async function waitForServer(url, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // 尚未就绪
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('dev server 未就绪');
}

async function main() {
  const browserPath = findBrowser();
  if (!browserPath) throw new Error('未找到 Edge/Chrome，请用 BROWSER_PATH 指定');

  // 1) 拉起 dev server：node 直接 spawn vite（node→node，避开 npm.cmd/cmd 链路——
  //    安全软件会拦截隐藏窗口启动 .cmd 的行为）
  const vite = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'dev', '--port', '5199', '--strictPort'],
    { cwd: process.cwd(), stdio: 'ignore' }
  );
  process.on('exit', () => vite.kill());
  await waitForServer(`${BASE_URL}/render-host.html`, 120000);
  console.log('dev server ready');

  // 1.5) 预检：宿主页入口能否被 Vite 正常编译（500 时 Vite 会在响应体里给出错误堆栈）
  for (const mod of ['/render-host/main.ts']) {
    const res = await fetch(`${BASE_URL}${mod}`);
    if (!res.ok) {
      console.error(`[${mod} transform error]`, (await res.text()).slice(0, 1200));
      vite.kill();
      throw new Error(`${mod} 编译失败`);
    }
  }

  // 2) 无头浏览器
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    protocolTimeout: 180000,
    args: [
      '--enable-unsafe-swiftshader',
      '--disable-gpu-sandbox',
      // 本机代理（HTTP_PROXY）会劫持 localhost 请求返回 502，必须绕过
      '--no-proxy-server',
      '--no-first-run',
      '--hide-scrollbars'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 720, height: 1280, deviceScaleFactor: 1 });
    page.on('pageerror', (err) => console.warn('[pageerror]', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.warn(`[console.${msg.type()}]`, msg.text().slice(0, 200));
      }
    });
    page.on('response', (res) => {
      if (res.status() >= 400) console.warn(`[http ${res.status()}]`, res.url().slice(0, 200));
    });

    for (const style of STYLES) {
      page.__style = style;
      // 页面脚本执行前注入数据与环境（每样式一次，随导航生效）
      await page.evaluateOnNewDocument((data, styleKey) => {
        window.__RENDER_DATA = data;
        // 跳过所有首次引导类弹窗（无头 profile 是全新的）
        localStorage.setItem('photosensitivity-warning-acked', 'true');
        localStorage.setItem('onboarding-completed', 'true');
        localStorage.setItem('disclaimer_agreed_timestamp', Date.now().toString());
        let cfg = {};
        try {
          cfg = JSON.parse(localStorage.getItem('music-full-config') || '{}');
        } catch {
          cfg = {};
        }
        cfg.playerStyle = styleKey;
        localStorage.setItem('music-full-config', JSON.stringify(cfg));
      }, PAYLOAD, style);

      // beginFrame 模式下页面的 load 事件由帧驱动，goto 永远不会「完成」——
      // 只等 DOM 解析完成，后续初始化用虚拟时间小步驱动
      await page.goto(`${BASE_URL}/render-host.html?style=${style}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      }).catch(() => undefined);

      // 虚拟时钟：CDP Emulation.setVirtualTimePolicy——rAF/定时器/performance.now
      // 全部随 budget 确定性推进，帧间隔与动画相位完全可控（离线渲染核心）
      const cdp = await page.createCDPSession();
      await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });

      // 小步驱动页面初始化直到真实组件挂载完成（musicFull 打开 + 接口就绪）
      const waitReady = async (timeoutMs) => {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
          await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: 100 });
          await new Promise((resolve) => {
            cdp.once('Emulation.virtualTimeBudgetExpired', resolve);
            setTimeout(resolve, 2000);
          });
          const ready = await page.evaluate(
            () => Boolean(window.__renderHost && window.__renderHost.isReady)
          );
          if (ready) return;
        }
        throw new Error('isReady 未就绪');
      };

      try {
        await waitReady(30000);
      } catch {
        const diag = await page.evaluate(() => ({
          url: location.href,
          hasData: Boolean(window.__RENDER_DATA),
          hasApp: Boolean(document.querySelector('#app > *')),
          hostKeys: Object.keys(window.__renderHost || {}),
          bodySnippet: document.body.innerHTML.slice(0, 300)
        }));
        console.error('[diag]', JSON.stringify(diag, null, 2));
        throw new Error('isReady 未就绪');
      }

      for (let i = 0; i < FRAMES_PER_STYLE; i++) {
        const t = 5.0 + i * 0.5;
        await page.evaluate((tt) => window.__renderHost.seek(tt), t);
        // 推进 1/30 秒虚拟时间：页面内 rAF、定时器、动画同步前进后自动暂停
        await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: 33 });
        await new Promise((resolve) => {
          cdp.once('Emulation.virtualTimeBudgetExpired', resolve);
          setTimeout(resolve, 2000); // 兜底：事件未触发时也不挂死
        });
        // 虚拟时间暂停时合成器不产帧，page.screenshot 会挂死——
        // 切回真实时间让合成器产一帧后立即截图，再重新暂停
        await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'realtime' });
        // 等 rAF 连续两跳：确认渲染管线在真实时钟下恢复
        await page.evaluate(
          () =>
            new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(() => r(null)))
            )
        );
        const file = path.join(OUT_DIR, `${style}_f${i}_t${t.toFixed(1)}.png`);
        // 截图偶发超时（合成器忙），等 300ms 重试一次
        try {
          await page.screenshot({ path: file, timeout: 15000 });
        } catch {
          await new Promise((r) => setTimeout(r, 300));
          await page.screenshot({ path: file, timeout: 30000 });
        }
        await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
        console.log('shot:', file);
      }
    }
  } finally {
    await browser.close();
    vite.kill();
  }

  console.log('POC done →', OUT_DIR);
}

main().catch((err) => {
  console.error('POC failed:', err);
  process.exit(1);
});
