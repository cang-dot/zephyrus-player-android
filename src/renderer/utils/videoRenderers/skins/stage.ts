/**
 * 舞台样式皮肤：深棕黑底 + 封面模糊提亮 + 缓慢升腾的烟雾
 * 与金色调强调，对应播放器的 rgb(180,150,100) 主色。
 */

import { drawCoverFill, fillVerticalGradient, mulberry32, seedFromString } from '../common';
import type { VideoFrameContext, VideoSkin } from '../types';

const SMOKE_PUFFS = 14;

/** 升腾烟雾：每团烟雾由序号派生固定初值，位置随时间解析推进（逐帧确定性） */
function drawSmoke(c: VideoFrameContext, alpha: number, color: string): void {
  const { ctx, width, height, timeSec } = c;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < SMOKE_PUFFS; i++) {
    const rand = mulberry32(seedFromString(`stage-smoke:${i}`));
    const baseX = rand() * width;
    const size = width * (0.16 + rand() * 0.26);
    const speed = 0.018 + rand() * 0.03;
    const drift = (rand() - 0.5) * width * 0.06;
    // 自下而上循环
    const phase = ((timeSec * speed + rand()) % 1.35) - 0.18;
    const y = height * (1.1 - phase);
    const x = baseX + drift * phase;
    const fade = Math.sin(Math.min(1, Math.max(0, phase / 1.2)) * Math.PI);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, size / 2);
    grad.addColorStop(0, color.replace('ALPHA', String(alpha * fade)));
    grad.addColorStop(1, color.replace('ALPHA', '0'));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export const stageSkin: VideoSkin = {
  key: 'stage',
  label: '舞台',
  theme: 'light',
  layout: 'stack',
  fontFamily: "'Noto Serif SC', 'Songti SC', serif",
  background: '#1a1510',
  accent: '#b49664',
  textPrimary: 'rgba(255,255,255,0.95)',
  textSecondary: 'rgba(255,255,255,0.55)',
  textActive: '#f4e3c0',
  showCover: true,
  drawBackground(c) {
    const { ctx, width, height, timeSec } = c;
    ctx.fillStyle = '#1a1510';
    ctx.fillRect(0, 0, width, height);
    if (c.song.cover) {
      ctx.save();
      // 舞台灯效：随音频响度微调亮度，形成"追光"呼吸感
      const brightness = 0.72 + c.level * 0.35;
      ctx.filter = `blur(${Math.round(height * 0.055)}px) brightness(${brightness.toFixed(2)}) saturate(1.5)`;
      const scale = 1.2 + 0.07 * (0.5 + 0.5 * Math.sin(timeSec * 0.19));
      const w = width * scale;
      const h = height * scale;
      const dx = Math.sin(timeSec * 0.15) * width * 0.04;
      const dy = Math.cos(timeSec * 0.12) * height * 0.04;
      drawCoverFill(ctx, c.song.cover, (width - w) / 2 + dx, (height - h) / 2 + dy, w, h);
      ctx.restore();
    }
    fillVerticalGradient(ctx, width, height, [
      [0, 'rgba(26,21,16,0.42)'],
      [0.55, 'rgba(22,17,12,0.58)'],
      [1, 'rgba(12,9,6,0.9)']
    ]);
  },
  drawAtmosphere(c) {
    drawSmoke(c, 0.1 + c.level * 0.08, 'rgba(214,190,150,ALPHA)');
  }
};
