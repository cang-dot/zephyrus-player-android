/**
 * 狂躁样式皮肤：白底 + 故障色块 + CRT 扫描线，
 * 黑字为主、红字点缀，高潮时整体抖动。
 */

import { drawScanlines, mulberry32, seedFromString } from '../common';
import type { VideoFrameContext, VideoSkin } from '../types';

/** 故障色块：确定性位移的横向条带，仅在"激活"帧出现（避免持续闪烁眩晕） */
function drawGlitchBands(c: VideoFrameContext): void {
  const { ctx, width, height, timeSec, level, beat } = c;
  const frame = Math.floor(timeSec * 30);
  const rand = mulberry32(seedFromString(`frenzy:${frame}`));
  // 基础强度随响度上升；强拍额外触发一次
  const intensity = Math.min(1, 0.1 + level * 0.35 + (beat ? 0.3 : 0));
  const bands = Math.round(2 + intensity * 4);
  ctx.save();
  for (let i = 0; i < bands; i++) {
    if (rand() > intensity) continue;
    const y = rand() * height;
    const h = height * (0.004 + rand() * 0.022);
    // 条带不横贯整宽，配合轻微位移，更接近信号撕裂而不是污渍
    const w = width * (0.3 + rand() * 0.7);
    const x = (rand() - 0.5) * width * 0.1 * intensity;
    const tone = rand();
    ctx.fillStyle =
      tone < 0.4
        ? 'rgba(255,42,42,0.28)'
        : tone < 0.7
          ? 'rgba(62,200,184,0.22)'
          : 'rgba(26,26,26,0.16)';
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

export const frenzySkin: VideoSkin = {
  key: 'frenzy',
  label: '狂躁',
  theme: 'light',
  layout: 'poster',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  background: '#ffffff',
  accent: '#ff2a2a',
  textPrimary: '#1a1a1a',
  textSecondary: 'rgba(26,26,26,0.42)',
  textActive: '#ff2a2a',
  showCover: false,
  drawBackground(c) {
    c.ctx.fillStyle = '#ffffff';
    c.ctx.fillRect(0, 0, c.width, c.height);
  },
  drawAtmosphere: drawGlitchBands,
  drawForeground(c) {
    drawScanlines(
      c,
      0.03 + c.level * 0.03,
      Math.max(3, Math.round(c.height * 0.006)),
      c.timeSec * 90
    );
    // 高潮时叠一层轻微色偏闪光
    if (c.beat || c.level > 0.72) {
      const strength = Math.min(0.22, c.level * 0.24);
      c.ctx.save();
      c.ctx.globalCompositeOperation = 'overlay';
      c.ctx.fillStyle = `rgba(120,190,255,${strength.toFixed(3)})`;
      c.ctx.fillRect(0, 0, c.width, c.height);
      c.ctx.restore();
    }
  }
};
