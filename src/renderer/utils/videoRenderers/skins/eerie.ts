/**
 * 诡谲样式皮肤：深黑底 + 暗化封面 + 缓慢漂移的幽光，
 * 文字带冷色光晕，营造若隐若现的不安感。
 */

import { drawCoverFill, mulberry32, seedFromString } from '../common';
import type { VideoFrameContext, VideoSkin } from '../types';

const WISPS = 7;

/** 幽光：缓慢游走的大团模糊光斑，位置由正弦驱动的闭合轨迹决定（逐帧确定性） */
function drawWisps(c: VideoFrameContext): void {
  const { ctx, width, height, timeSec, level } = c;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < WISPS; i++) {
    const rand = mulberry32(seedFromString(`eerie-wisp:${i}`));
    const radiusX = width * (0.18 + rand() * 0.24);
    const radiusY = height * (0.12 + rand() * 0.2);
    const cx = width * (0.2 + rand() * 0.6);
    const cy = height * (0.2 + rand() * 0.6);
    const speed = 0.14 + rand() * 0.22;
    const angle = timeSec * speed + rand() * Math.PI * 2;
    const x = cx + Math.cos(angle) * radiusX;
    const y = cy + Math.sin(angle * 0.7) * radiusY;
    const size = width * (0.22 + rand() * 0.3);
    const alpha = 0.07 + level * 0.11;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, size / 2);
    grad.addColorStop(0, `rgba(150,170,200,${alpha.toFixed(3)})`);
    grad.addColorStop(1, 'rgba(150,170,200,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export const eerieSkin: VideoSkin = {
  key: 'eerie',
  label: '诡谲',
  theme: 'dark',
  layout: 'immersive',
  fontFamily: "'Noto Serif SC', 'Songti SC', serif",
  background: '#050507',
  accent: '#9d8cff',
  textPrimary: 'rgba(240,240,245,0.92)',
  textSecondary: 'rgba(220,220,235,0.4)',
  textActive: '#ffffff',
  showCover: false,
  drawBackground(c) {
    const { ctx, width, height } = c;
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, width, height);
    if (c.song.cover) {
      ctx.save();
      ctx.filter = `blur(${Math.round(height * 0.09)}px) brightness(0.28) saturate(0.7)`;
      const w = width * 1.3;
      const h = height * 1.3;
      drawCoverFill(ctx, c.song.cover, (width - w) / 2, (height - h) / 2, w, h);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(3,3,6,0.55)';
    ctx.fillRect(0, 0, width, height);
  },
  drawAtmosphere: drawWisps,
  drawForeground(c) {
    // 重暗角：把观众注意力压向中央的文字
    const { ctx, width, height } = c;
    const grad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.12,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.66
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
};
