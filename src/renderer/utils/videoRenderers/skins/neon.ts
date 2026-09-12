/**
 * 陈旧样式皮肤：老旧墙面质感（噪点/斑驳）+ 泛黄覆层 + 四周褪色暗角，
 * 铜金色强调，对应播放器的 #c9a96e 主色。
 */

import { mulberry32, rgba, seedFromString, withAlpha } from '../common';
import type { VideoFrameContext, VideoSkin } from '../types';

/** 墙面噪点：以块为单位铺满，逐帧种子固定（纹理不闪烁，符合"静态旧墙"语义） */
function drawWallTexture(c: VideoFrameContext): void {
  const { ctx, width, height } = c;
  const cell = Math.max(2, Math.round(width * 0.004));
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const rand = mulberry32(seedFromString('neon-wall'));
  ctx.save();
  for (let i = 0; i < cols * rows; i++) {
    const v = rand();
    if (v > 0.42) continue;
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * cell;
    const alpha = 0.2 + v * 0.55;
    // 明暗双色交替，才能形成斑驳墙面的颗粒感
    ctx.fillStyle = v < 0.2 ? rgba(96, 84, 66, alpha) : rgba(26, 22, 18, alpha);
    ctx.fillRect(x, y, cell, cell);
  }
  ctx.restore();
}

export const neonSkin: VideoSkin = {
  key: 'neon',
  label: '陈旧',
  theme: 'dark',
  layout: 'stack',
  fontFamily: "'Noto Serif SC', 'Songti SC', serif",
  background: '#2a2620',
  accent: '#c9a96e',
  textPrimary: '#e8d5a8',
  textSecondary: 'rgba(201,169,110,0.5)',
  textActive: '#f6e6bf',
  showCover: false,
  drawBackground(c) {
    const { ctx, width, height, timeSec } = c;
    ctx.fillStyle = '#2a2620';
    ctx.fillRect(0, 0, width, height);
    drawWallTexture(c);

    // 泛黄覆层：两团偏暖的柔光，极缓慢游走，避免整段画面死板
    const ax = width * (0.3 + Math.sin(timeSec * 0.25) * 0.08);
    const ay = height * (0.4 + Math.cos(timeSec * 0.19) * 0.07);
    const warmA = ctx.createRadialGradient(ax, ay, 0, ax, ay, Math.max(width, height) * 0.58);
    warmA.addColorStop(0, 'rgba(201,169,110,0.11)');
    warmA.addColorStop(1, 'rgba(201,169,110,0)');
    ctx.fillStyle = warmA;
    ctx.fillRect(0, 0, width, height);

    const bx = width * (0.72 + Math.sin(timeSec * 0.21 + 1.6) * 0.08);
    const by = height * (0.6 + Math.cos(timeSec * 0.17 + 0.8) * 0.07);
    const warmB = ctx.createRadialGradient(bx, by, 0, bx, by, Math.max(width, height) * 0.5);
    warmB.addColorStop(0, 'rgba(180,140,80,0.09)');
    warmB.addColorStop(1, 'rgba(180,140,80,0)');
    ctx.fillStyle = warmB;
    ctx.fillRect(0, 0, width, height);
  },
  drawForeground(c) {
    // 四周褪色光效：multiply 让边缘压暗并染上铜色
    const { ctx, width, height } = c;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const grad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.3,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.72
    );
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.72, withAlpha('#5c4a2e', 0.55));
    grad.addColorStop(1, '#5c4a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
};
