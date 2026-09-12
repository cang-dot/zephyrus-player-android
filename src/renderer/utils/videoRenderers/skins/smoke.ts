/**
 * 烟雾样式皮肤：近黑底 + 浓密烟雾包裹歌词，银灰调。
 * 烟雾密度与响度相关，安静段落近乎清透、高潮时翻涌。
 */

import { fillVerticalGradient, mulberry32, seedFromString } from '../common';
import type { VideoFrameContext, VideoSkin } from '../types';

const PUFFS = 28;

function drawSmokeLayer(c: VideoFrameContext): void {
  const { ctx, width, height, timeSec, level } = c;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < PUFFS; i++) {
    const rand = mulberry32(seedFromString(`smoke:${i}`));
    const size = width * (0.2 + rand() * 0.4);
    const speed = 0.03 + rand() * 0.05;
    const phase = ((timeSec * speed + rand()) % 1.4) - 0.2;
    const y = height * (1.08 - phase);
    const x = rand() * width + Math.sin(phase * Math.PI * 2 + i) * width * 0.05;
    const fade = Math.sin(Math.min(1, Math.max(0, phase / 1.3)) * Math.PI);
    const alpha = (0.14 + level * 0.18) * fade;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, size / 2);
    grad.addColorStop(0, `rgba(200,205,215,${alpha})`);
    grad.addColorStop(1, 'rgba(200,205,215,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export const smokeSkin: VideoSkin = {
  key: 'smoke',
  label: '烟雾',
  theme: 'dark',
  layout: 'stack',
  fontFamily: "'Noto Serif SC', 'Songti SC', serif",
  background: '#07070a',
  accent: '#b8bcc6',
  textPrimary: 'rgba(255,255,255,0.93)',
  textSecondary: 'rgba(255,255,255,0.42)',
  textActive: '#ffffff',
  showCover: false,
  drawBackground(c) {
    fillVerticalGradient(c.ctx, c.width, c.height, [
      [0, '#050508'],
      [0.55, '#0a0a0f'],
      [1, '#040406']
    ]);
  },
  drawAtmosphere: drawSmokeLayer,
  drawForeground(c) {
    // 边缘雾化：四周更浓，中心留给歌词
    const { ctx, width, height } = c;
    const grad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.18,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.68
    );
    grad.addColorStop(0, 'rgba(8,8,12,0)');
    grad.addColorStop(1, 'rgba(4,4,7,0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
};
