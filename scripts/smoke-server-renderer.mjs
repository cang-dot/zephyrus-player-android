/**
 * 服务端渲染层冒烟：打包产物 renderer.cjs 在 Node + @napi-rs/canvas 下出帧自检。
 *
 * 开发机执行（@napi-rs/canvas 位于用户级 node_modules）：
 *   NODE_PATH=C:\Users\Administrator\node_modules node scripts/smoke-server-renderer.mjs
 *
 * 输出 3 帧 PNG 到 OUT_DIR，用于人工核验中文字形、皮肤绘制与逐字高亮。
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

const require = createRequire(import.meta.url);
const renderer = require(path.resolve('server/render/renderer.cjs'));

const OUT_DIR = process.env.SMOKE_OUT || path.resolve('.server-smoke-out');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ==================== 字体注册（与部署清单一致） ====================
const FONTS = process.env.SMOKE_FONT_DIR || 'C:/Windows/Fonts';
const FONT_ALIASES = [
  [`${FONTS}/msyh.ttc`, 'Noto Serif SC'],
  [`${FONTS}/msyh.ttc`, 'Songti SC'],
  [`${FONTS}/msyh.ttc`, 'STSong'],
  [`${FONTS}/msyh.ttc`, 'PingFang SC'],
  [`${FONTS}/msyh.ttc`, 'Microsoft YaHei'],
  [`${FONTS}/msyh.ttc`, 'Noto Sans SC'],
  [`${FONTS}/arial.ttf`, 'Inter']
];
for (const [file, family] of FONT_ALIASES) {
  try {
    GlobalFonts.registerFromPath(file, family);
  } catch {
    // 缺字体时忽略，冒烟会以默认字形呈现
  }
}

// ==================== 假数据 ====================
const makeWords = (text, startMs, durationMs) => {
  const chars = Array.from(text);
  const per = durationMs / Math.max(1, chars.length);
  return chars.map((ch, i) => ({
    text: ch,
    startTime: Math.round(startMs + i * per),
    duration: Math.round(per)
  }));
};

const LYRICS = [
  { text: '路灯把影子拉长', trText: 'Streetlights stretch the shadows', startTime: 0, duration: 3200, words: makeWords('路灯把影子拉长', 0, 3200) },
  { text: '我数着回家的方向', trText: 'Counting the way back home', startTime: 3200, duration: 3400, words: makeWords('我数着回家的方向', 3200, 3400) },
  { text: '风穿过旧信纸', trText: '', startTime: 6600, duration: 3000, words: [] }
];

const SONG = { title: '夜航西飞', artist: '陈默 / 林一', cover: null, dominant: { r: 224, g: 164, b: 88 } };
const TIMELINE = renderer.buildTimeline(LYRICS);

/** 渲染单帧（与前端 videoEngine 帧循环同构） */
function renderFrame(skin, width, height, songTimeSec) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = skin.background;
  ctx.fillRect(0, 0, width, height);

  const frameCtx = {
    ctx,
    width,
    height,
    timeSec: songTimeSec,
    progress: 0.42,
    totalSec: 30,
    songTimeSec,
    level: 0.62,
    beat: true,
    song: SONG,
    lyric: renderer.resolveLyricState(TIMELINE, songTimeSec),
    skin,
    accent: renderer.resolveAccent(skin, SONG.dominant),
    watermark: true,
    qrImage: null
  };

  skin.drawBackground?.(frameCtx);
  skin.drawAtmosphere?.(frameCtx);
  renderer.renderFrameLayout(frameCtx);
  skin.drawForeground?.(frameCtx);
  return canvas;
}

// ==================== 主流程 ====================
const { width, height } = renderer.resolveVideoSize('9:16', '720p');
const skin = renderer.getSkin(process.env.SMOKE_STYLE || 'default');
const times = [0.5, 5.2, 12.0];

for (const t of times) {
  const canvas = renderFrame(skin, width, height, t);
  const file = path.join(OUT_DIR, `${skin.key}_t${t.toFixed(1)}.png`);
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
  console.log('frame written:', file);
}

console.log(`smoke ok: style=${skin.key} size=${width}x${height} frames=${times.length}`);
