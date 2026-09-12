/**
 * 错误样式皮肤：黑底终端质感 —— 扫描线、噪点、径向冷光，
 * 歌词带故障抖动与青绿/紫装饰符号，强调色取播放器的 #3ec8b8。
 */

import { drawNoise, drawScanlines, mulberry32, seedFromString } from '../common';
import type { VideoFrameContext, VideoSkin } from '../types';

/** 故障撕裂线：随机高度的青绿/紫细线，逐帧确定性 */
function drawTearLines(c: VideoFrameContext): void {
  const { ctx, width, height, timeSec } = c;
  const frame = Math.floor(timeSec * 30);
  const rand = mulberry32(seedFromString(`error-tear:${frame}`));
  const count = rand() < 0.35 ? 3 : 1;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const y = rand() * height;
    const h = Math.max(1, height * (0.001 + rand() * 0.003));
    ctx.fillStyle = rand() < 0.6 ? 'rgba(62,200,184,0.5)' : 'rgba(157,140,255,0.45)';
    ctx.fillRect(0, y, width, h);
  }
  ctx.restore();
}

export const errorSkin: VideoSkin = {
  key: 'error',
  label: '错误',
  theme: 'dark',
  layout: 'terminal',
  // 等宽字体通常不含中文字形，显式追加中文字体兜底，避免歌词出现方块
  fontFamily: "'JetBrains Mono', 'Menlo', 'Noto Sans SC', 'PingFang SC', monospace",
  background: '#000000',
  accent: '#3ec8b8',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.34)',
  textActive: '#3ec8b8',
  showCover: false,
  drawBackground(c) {
    const { ctx, width, height } = c;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    // 中央偏上的冷色径向光，模拟终端辉光
    const glow = ctx.createRadialGradient(
      width / 2,
      height * 0.45,
      0,
      width / 2,
      height * 0.45,
      Math.max(width, height) * 0.62
    );
    glow.addColorStop(0, 'rgba(62,200,184,0.09)');
    glow.addColorStop(0.55, 'rgba(62,200,184,0.03)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  },
  drawAtmosphere: drawTearLines,
  drawForeground(c) {
    drawScanlines(c, 0.14, Math.max(3, Math.round(c.height * 0.0035)));
    drawNoise(c, 0.04 + c.level * 0.05, Math.max(2, Math.round(c.width * 0.0022)));
  }
};
