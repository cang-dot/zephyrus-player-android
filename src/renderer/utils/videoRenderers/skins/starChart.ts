/**
 * 星盘样式皮肤：纯黑底 + 星点 + 缓慢自转的星盘轨迹，
 * 衬线白字配玻璃卡，强调色跟随封面。
 */

import { fillVerticalGradient, mulberry32, seedFromString } from '../common';
import type { VideoSkin } from '../types';

const STARS = 170;

export const starChartSkin: VideoSkin = {
  key: 'starChart',
  label: '星盘',
  theme: 'dark',
  layout: 'stack',
  fontFamily: "'Noto Serif SC', 'STSong', serif",
  background: '#050505',
  accent: '#9aa7c8',
  followCoverAccent: true,
  textPrimary: '#f7f7f5',
  textSecondary: 'rgba(255,255,255,0.46)',
  textActive: '#ffffff',
  showCover: true,
  drawBackground(c) {
    const { ctx, width, height, timeSec } = c;
    fillVerticalGradient(ctx, width, height, [
      [0, '#050505'],
      [0.6, '#080810'],
      [1, '#04040a']
    ]);

    // 星盘：以画面中心为极点的同心圆 + 放射刻度，极缓自转
    const cx = width / 2;
    const cy = height * 0.42;
    const rot = timeSec * 0.12;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(200,210,235,0.18)';
    ctx.lineWidth = Math.max(1, width * 0.002);
    for (let ring = 1; ring <= 3; ring++) {
      const radius = Math.min(width, height) * (0.16 + ring * 0.12);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const inner = Math.min(width, height) * 0.16;
      const outer = Math.min(width, height) * 0.52;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();

    // 星点：位置固定，亮度按相位缓慢闪烁
    ctx.save();
    for (let i = 0; i < STARS; i++) {
      const rand = mulberry32(seedFromString(`star:${i}`));
      const x = rand() * width;
      const y = rand() * height;
      const base = 0.4 + rand() * 0.6;
      const twinkle = 0.5 + 0.5 * Math.sin(timeSec * (0.7 + rand() * 1.4) + i);
      const size = Math.max(1, width * (0.0018 + rand() * 0.0034));
      const alpha = Math.min(1, base * twinkle);
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
};
