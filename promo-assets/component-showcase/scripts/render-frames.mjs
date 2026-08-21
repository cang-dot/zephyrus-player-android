import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'out/frames');
const port = 4189;
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port)], { cwd: root, stdio: 'pipe', shell: true });
try {
  await new Promise((resolveReady) => {
    const timer = setInterval(async () => { try { const r = await fetch(`http://127.0.0.1:${port}`); if (r.ok) { clearInterval(timer); resolveReady(); } } catch {} }, 100);
  });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.__ZEPHYRUS_SHOWCASE__?.ready());
  for (let frame = 0; frame < 900; frame += 1) {
    await page.evaluate((f) => window.__ZEPHYRUS_SHOWCASE__?.seekToFrame(f), frame);
    await page.screenshot({ path: join(out, `frame-${String(frame).padStart(4, '0')}.png`) });
  }
  await browser.close();
} finally { server.kill(); }
