/**
 * 视频渲染共享原语
 *
 * 只放「与样式无关」的绘制与数学工具：
 * - 确定性随机（种子固定 → 逐帧可复现）
 * - 圆角矩形 / 文本换行与截断 / 等比裁切绘制
 * - 进度条、水印、二维码等跨样式复用件
 */

import type { LayoutBox, VideoFrameContext, VideoSkin } from './types';

// ==================== 确定性随机 ====================

/**
 * mulberry32：固定种子 → 固定序列。
 * 视频逐帧渲染时必须可复现，凡需要随机感处皆用它，禁止 Math.random()。
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 字符串 → 32 位种子（FNV-1a），用于把「粒子序号+样式名」变成稳定种子 */
export function seedFromString(text: string): number {
  let seed = 2166136261;
  for (const ch of Array.from(text)) {
    seed ^= ch.codePointAt(0) || 0;
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

/** 取 0~1 之间的确定性伪随机值（同一 key 恒等） */
export function hash01(key: string): number {
  return mulberry32(seedFromString(key))();
}

/** 平滑插值：把 t 从 [a,b] 映射到 0~1 并做 clamp */
export function ramp(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0;
  return Math.min(1, Math.max(0, (t - a) / (b - a)));
}

/** easeOutCubic */
export function easeOut(t: number): number {
  const p = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - p, 3);
}

/** easeInOutSine */
export function easeInOut(t: number): number {
  const p = Math.min(1, Math.max(0, t));
  return -(Math.cos(Math.PI * p) - 1) / 2;
}

// ==================== 颜色 ====================

export function rgba(r: number, g: number, b: number, a = 1): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

/** 给 hex 颜色附加透明度；非法输入原样返回 */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = Number.parseInt(m[1], 16);
  return rgba((n >> 16) & 255, (n >> 8) & 255, n & 255, alpha);
}

/** hex → {r,g,b}；非法输入返回中性灰 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { r: 128, g: 128, b: 128 };
  const n = Number.parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * 解析强调色：皮肤声明 followCoverAccent 时取封面主色，
 * 并把亮度提到可读区间（过暗的封面主色会让进度条看不见）。
 */
export function resolveAccent(
  skin: VideoSkin,
  dominant: { r: number; g: number; b: number } | null
): string {
  if (!skin.followCoverAccent || !dominant) return skin.accent;
  const max = Math.max(dominant.r, dominant.g, dominant.b);
  const factor = max < 120 ? 120 / Math.max(1, max) : max > 215 ? 215 / max : 1;
  return rgba(dominant.r * factor, dominant.g * factor, dominant.b * factor, 1);
}

/** 明暗调整：amount > 0 提亮，< 0 压暗 */
export function shade(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (v: number) =>
    amount >= 0 ? v + (255 - v) * amount : v * (1 + amount);
  return rgba(mix(r), mix(g), mix(b));
}

// ==================== 图形 ====================

/** 圆角矩形路径（不依赖 ctx.roundRect，兼容老 WebView） */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** 填充圆角矩形 */
export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fill();
}

/** 竖向线性渐变填充整块画布 */
export function fillVerticalGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stops: Array<[number, string]>
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  for (const [offset, color] of stops) grad.addColorStop(offset, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

// ==================== 文本 ====================

/** 按字符换行（支持 CJK 与西文混排） */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  let current = '';
  for (const ch of Array.from(text)) {
    if (ch === '\n') {
      if (current) lines.push(current);
      current = '';
      continue;
    }
    const probe = current + ch;
    if (ctx.measureText(probe).width > maxWidth && current) {
      lines.push(current);
      current = ch;
    } else {
      current = probe;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** 单行截断并追加省略号 */
export function ellipsize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}……`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}……`;
}

/**
 * 逐字高亮换行绘制：把一行歌词按「已唱字符数」切成高亮/未唱两段。
 * 返回实际绘制行数，便于调用方推进行高。
 */
export function drawSungLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  sungChars: number,
  colX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  align: CanvasTextAlign,
  sungColor: string,
  restColor: string
): number {
  const chars = Array.from(text);
  let row = 0;
  let offset = 0;
  while (offset < chars.length) {
    // 本行可容纳的字符范围
    let end = offset;
    let width = 0;
    while (end < chars.length) {
      const w = ctx.measureText(chars[end]).width;
      if (width + w > maxWidth && end > offset) break;
      width += w;
      end++;
    }
    const rowChars = chars.slice(offset, end);
    const rowText = rowChars.join('');
    const y = startY + row * lineHeight;
    const sungInRow = Math.max(0, Math.min(rowChars.length, sungChars - offset));

    if (sungInRow <= 0) {
      ctx.fillStyle = restColor;
      ctx.textAlign = align;
      ctx.fillText(rowText, colX, y);
    } else if (sungInRow >= rowChars.length) {
      ctx.fillStyle = sungColor;
      ctx.textAlign = align;
      ctx.fillText(rowText, colX, y);
    } else {
      const sungText = rowChars.slice(0, sungInRow).join('');
      const restText = rowChars.slice(sungInRow).join('');
      const sungWidth = ctx.measureText(sungText).width;
      const restWidth = ctx.measureText(restText).width;
      const totalWidth = sungWidth + restWidth;
      // 依据对齐方式反推行首 x
      const startX =
        align === 'center'
          ? colX - totalWidth / 2
          : align === 'right'
            ? colX - totalWidth
            : colX;
      ctx.textAlign = 'left';
      ctx.fillStyle = sungColor;
      ctx.fillText(sungText, startX, y);
      ctx.fillStyle = restColor;
      ctx.fillText(restText, startX + sungWidth, y);
    }
    offset = end;
    row++;
  }
  return Math.max(1, row);
}

// ==================== 图像 ====================

/** 等比裁切填满目标框（cover 语义） */
export function drawCoverFill(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return;
  const sourceRatio = iw / ih;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = iw;
  let sh = ih;
  if (sourceRatio > targetRatio) {
    sw = ih * targetRatio;
    sx = (iw - sw) / 2;
  } else {
    sh = iw / targetRatio;
    sy = (ih - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
}

/** 圆角裁切绘制封面 */
export function drawCoverRound(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  size: number,
  radius: number
): void {
  ctx.save();
  roundRectPath(ctx, x, y, size, size, radius);
  ctx.clip();
  drawCoverFill(ctx, image, x, y, size, size);
  ctx.restore();
}

// ==================== 跨样式复用件 ====================

/** 底部进度条（含已播放/缓冲语义：这里简化为已完成比例） */
export function drawProgressBar(
  c: VideoFrameContext,
  box: LayoutBox,
  color: string,
  trackColor: string
): void {
  const { ctx } = c;
  const height = Math.max(3, Math.round(c.height * 0.005));
  const y = box.y;
  ctx.save();
  ctx.fillStyle = trackColor;
  fillRoundRect(ctx, box.x, y, box.width, height, height / 2);
  ctx.fillStyle = color;
  const filled = Math.max(height, box.width * Math.min(1, Math.max(0, c.progress)));
  fillRoundRect(ctx, box.x, y, filled, height, height / 2);
  ctx.restore();
}

/** 水印：左下角文字 + 右下角二维码（开启时） */
export function drawWatermark(c: VideoFrameContext): void {
  const { ctx, width, height } = c;
  const pad = Math.round(height * 0.025);
  const fontPx = Math.max(12, Math.round(height * 0.022));

  ctx.save();
  ctx.font = `500 ${fontPx}px ${c.skin.fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = c.skin.theme === 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)';
  ctx.fillText('Zephyrus Player', pad, height - pad);
  ctx.restore();

  if (c.qrImage) {
    const size = Math.round(height * 0.11);
    const qx = width - size - pad;
    const qy = height - size - pad;
    const inset = Math.round(size * 0.06);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    fillRoundRect(ctx, qx - inset, qy - inset, size + inset * 2, size + inset * 2, inset * 1.6);
    ctx.restore();
    ctx.drawImage(c.qrImage, qx, qy, size, size);
  }
}

/** 全屏暗角（vignette），强度 0~1 */
export function drawVignette(c: VideoFrameContext, strength: number): void {
  if (strength <= 0) return;
  const { ctx, width, height } = c;
  const grad = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.28,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.95, strength)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

/** 扫描线（CRT / 终端风） */
/** 扫描线（CRT / 终端风）；offset 可用于滚动 */
export function drawScanlines(
  c: VideoFrameContext,
  alpha: number,
  step: number,
  offset = 0
): void {
  if (alpha <= 0 || step <= 0) return;
  const { ctx, width, height } = c;
  const shift = ((offset % step) + step) % step;
  const barHeight = Math.max(1, Math.round(step * 0.35));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  for (let y = -step + shift; y < height; y += step) {
    if (y + barHeight < 0) continue;
    ctx.fillRect(0, y, width, barHeight);
  }
  ctx.restore();
}

/**
 * 确定性噪点：以「网格序号 + 帧序号」为种子生成灰度噪点，
 * 强度由 strength 控制。为避免每帧遍历百万像素，按块绘制。
 */
export function drawNoise(c: VideoFrameContext, strength: number, cell = 3): void {
  if (strength <= 0) return;
  const { ctx, width, height } = c;
  // 噪点按 12Hz 变化：既保留颗粒闪烁感，又避免每帧全屏跳变拖垮码率
  const frame = Math.floor(c.timeSec * 12);
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const rand = mulberry32(seedFromString(`noise:${c.skin.key}:${frame}`));
  ctx.save();
  ctx.globalAlpha = Math.min(1, strength);
  for (let i = 0; i < cols * rows; i++) {
    const v = rand();
    if (v > 0.5) continue;
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * cell;
    ctx.fillStyle = v < 0.25 ? '#000' : '#fff';
    ctx.fillRect(x, y, cell, cell);
  }
  ctx.restore();
}
