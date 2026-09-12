/**
 * 默认样式皮肤：封面模糊铺垫 + 大圆角封面 + 衬线居中歌词。
 * 强调色跟随封面主色，整体偏冷调的沉浸感。
 */

import { drawCoverFill, fillVerticalGradient } from '../common';
import type { VideoSkin } from '../types';

export const defaultSkin: VideoSkin = {
  key: 'default',
  label: '默认',
  theme: 'light',
  layout: 'stack',
  fontFamily: "'Noto Serif SC', 'Songti SC', serif",
  background: '#0c0c11',
  accent: '#93a7c4',
  followCoverAccent: true,
  textPrimary: 'rgba(255,255,255,0.95)',
  textSecondary: 'rgba(255,255,255,0.58)',
  textActive: '#ffffff',
  showCover: true,
  drawBackground(c) {
    const { ctx, width, height, timeSec } = c;
    ctx.fillStyle = '#0c0c11';
    ctx.fillRect(0, 0, width, height);
    if (c.song.cover) {
      ctx.save();
      ctx.filter = `blur(${Math.round(height * 0.05)}px) brightness(0.42) saturate(1.15)`;
      // 缓慢的推近与漂移：避免整段视频背景完全静止
      const scale = 1.14 + 0.06 * (0.5 + 0.5 * Math.sin(timeSec * 0.22));
      const w = width * scale;
      const h = height * scale;
      const dx = Math.sin(timeSec * 0.16) * width * 0.03;
      const dy = Math.cos(timeSec * 0.13) * height * 0.03;
      drawCoverFill(ctx, c.song.cover, (width - w) / 2 + dx, (height - h) / 2 + dy, w, h);
      ctx.restore();
    }
    fillVerticalGradient(ctx, width, height, [
      [0, 'rgba(10,10,16,0.30)'],
      [0.52, 'rgba(10,10,16,0.52)'],
      [1, 'rgba(5,5,9,0.88)']
    ]);
  }
};
