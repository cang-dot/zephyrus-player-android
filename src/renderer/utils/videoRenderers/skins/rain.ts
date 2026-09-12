/**
 * 雨夜样式皮肤：深蓝黑底 + 大幅模糊的封面 + 斜向雨丝。
 * 参数对齐播放器设置默认值：角度 15°、长度 40、强度 50、白色、透明度 0.6。
 */

import { drawCoverFill, mulberry32, seedFromString } from '../common';
import type { VideoFrameContext, VideoSkin } from '../types';

const DROPS = 260;
/** 与播放器 rainAngle 默认值一致 */
const ANGLE_DEG = 15;
const DROP_COLOR = '255,255,255';
const DROP_ALPHA = 0.6;
const DROP_LENGTH = 40;
const DROP_INTENSITY = 0.5;

/** 雨丝：每滴的横向起点与速度由序号派生，纵向位置 = (初始相位 + t*speed) mod 1（逐帧确定性） */
function drawRain(c: VideoFrameContext): void {
  const { ctx, width, height, timeSec, level } = c;
  const rad = (ANGLE_DEG * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = Math.cos(rad);
  const overhang = Math.abs(dx) * height;
  const count = Math.round(DROPS * (0.5 + DROP_INTENSITY));
  const len = height * (DROP_LENGTH / 100) * 0.42;

  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const rand = mulberry32(seedFromString(`rain:${i}`));
    const speed = 0.28 + rand() * 0.75;
    const phase = (timeSec * speed * 0.5 + rand()) % 1;
    // 沿倾斜方向推进，落到画面外即回收
    const progress = phase;
    const startY = progress * (height + len) - len;
    const startX = rand() * (width + overhang) - overhang / 2 + dx * (progress * height);
    const wobble = Math.sin(timeSec * 2 + i) * width * 0.002;
    const tailX = startX - dx * len + wobble;
    const tailY = startY - dy * len;

    // 远处的雨更细更淡
    const depth = 0.35 + rand() * 0.65;
    const alpha = DROP_ALPHA * depth * (0.7 + level * 0.3);
    ctx.strokeStyle = `rgba(${DROP_COLOR},${alpha.toFixed(3)})`;
    ctx.lineWidth = Math.max(1, width * 0.0014 * depth);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
  }
  ctx.restore();
}

export const rainSkin: VideoSkin = {
  key: 'rain',
  label: '雨夜',
  theme: 'dark',
  layout: 'immersive',
  fontFamily: "'Noto Serif SC', 'Songti SC', serif",
  background: '#0a0a0f',
  accent: '#8ab4d8',
  followCoverAccent: true,
  textPrimary: 'rgba(255,255,255,0.95)',
  textSecondary: 'rgba(255,255,255,0.5)',
  textActive: '#ffffff',
  showCover: false,
  drawBackground(c) {
    const { ctx, width, height } = c;
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);
    if (c.song.cover) {
      ctx.save();
      ctx.filter = `blur(${Math.round(height * 0.07)}px) brightness(0.4) saturate(1.2)`;
      const w = width * 1.25;
      const h = height * 1.25;
      drawCoverFill(ctx, c.song.cover, (width - w) / 2, (height - h) / 2, w, h);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(6,8,14,0.45)';
    ctx.fillRect(0, 0, width, height);
  },
  drawAtmosphere: drawRain
};
