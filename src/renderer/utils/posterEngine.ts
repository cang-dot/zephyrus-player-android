/**
 * 海报 Canvas 生成引擎
 * 支持 9:16 (1080×1920) 比例
 * 两种布局：撕纸纹理文艺风 / 全屏封面沉浸风
 */

import {
  normalizePosterConfig,
  type PosterConfig,
  type PosterSongInfo,
  type PosterSubject,
  type SelectedLyric
} from '@/types/share';
import { ensureFontLoaded, getFontFamily } from '@/utils/fontLoader';
import {
  buildCollectionDeepLink,
  buildSongDeepLink,
  generateQRCodeImage,
  loadImage
} from '@/utils/qrCodeUtil';
import { truncateText } from '@/utils/text';

/** 海报尺寸 */
export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1920;

/** 各布局内容区（歌词/简介/曲目）纵向度量：top=内容起始 y，line/para=行高与段距，bottomPad=底部预留（二维码/水印） */
const LAYOUT_CONTENT_METRICS: Record<
  PosterConfig['layout'],
  { top: number; line: number; para: number; bottomPad: number; fontPx: number }
> = {
  'torn-paper': { top: 580, line: 58, para: 24, bottomPad: 220, fontPx: 42 },
  immersive: { top: 520, line: 60, para: 28, bottomPad: 220, fontPx: 44 },
  'performance-archive': { top: 1130, line: 78, para: 22, bottomPad: 160, fontPx: 60 },
  'seal-tour': { top: 1430, line: 78, para: 22, bottomPad: 160, fontPx: 60 }
};

/** 各布局在非长图/未开"全部内容"时的歌词条数上限（保持原海报构图） */
const LYRIC_CONTENT_LIMIT = 12;

/** 二维码尺寸 */
const QR_CODE_SIZE = 140;
/** 二维码边距 */
const QR_MARGIN = 24;

// ==================== 工具函数 ====================

/**
 * 从图片中提取主色调
 */
function extractDominantColor(img: HTMLImageElement): { r: number; g: number; b: number } {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, 32, 32);
  const data = ctx.getImageData(0, 0, 32, 32).data;
  let r = 0,
    g = 0,
    b = 0,
    count = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
}

/**
 * 颜色转 rgba 字符串
 */
function rgba(r: number, g: number, b: number, a: number = 1): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function resolvePosterAccentColor(config: PosterConfig): string {
  if (config.accentColorMode === 'custom') return config.accentColor;
  if (typeof document === 'undefined') return config.accentColor;
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() ||
    config.accentColor
  );
}

function getCurrentPosterDate(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
}

/** 将作者名按印章的方形字面均衡拆行，优先避免单独悬空的末行。 */
export function splitSealArtistName(artistName: string): string[] {
  const glyphs = Array.from(
    artistName
      .replace(/\b(?:feat\.?|ft\.?)\b.*$/i, '')
      .replace(/[\s/／、,&，·・]+/g, '')
      .trim()
  ).slice(0, 12);
  if (!glyphs.length) return ['佚名'];
  if (glyphs.length <= 2) return glyphs;

  const rowCount = glyphs.length <= 6 ? 2 : glyphs.length <= 9 ? 3 : 3;
  const baseSize = Math.floor(glyphs.length / rowCount);
  let remainder = glyphs.length % rowCount;
  const rows: string[] = [];
  let offset = 0;
  for (let row = 0; row < rowCount; row++) {
    const rowSize = baseSize + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    rows.push(glyphs.slice(offset, offset + rowSize).join(''));
    offset += rowSize;
  }
  return rows.filter(Boolean);
}

function createSeededRandom(seedText: string): () => number {
  let seed = 2166136261;
  for (const char of Array.from(seedText)) {
    seed ^= char.codePointAt(0) || 0;
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Canvas 矢量绘制的仿真印章边缘，保持缩放清晰并避免引入外部素材许可。 */
function drawDistressedSealEdge(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
  color: string,
  seedText: string
): void {
  const random = createSeededRandom(seedText);
  const half = size / 2;
  const left = centerX - half;
  const top = centerY - half;
  const points: Array<[number, number]> = [];
  const segments = 14;
  const jitter = () => (random() - 0.5) * 8;

  for (let i = 0; i <= segments; i++) {
    points.push([left + (size * i) / segments, top + jitter()]);
  }
  for (let i = 1; i <= segments; i++) {
    points.push([left + size + jitter(), top + (size * i) / segments]);
  }
  for (let i = 1; i <= segments; i++) {
    points.push([left + size - (size * i) / segments, top + size + jitter()]);
  }
  for (let i = 1; i < segments; i++) {
    points.push([left + jitter(), top + size - (size * i) / segments]);
  }

  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fillStyle = 'rgba(241,238,232,0.88)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 14;
  ctx.lineJoin = 'round';
  ctx.setLineDash([38, 5, 17, 3, 29, 7, 11, 3]);
  ctx.lineDashOffset = -Math.floor(random() * 28);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 4;
  ctx.setLineDash([24, 4, 44, 7, 13, 3]);
  ctx.strokeRect(left + 15, top + 15, size - 30, size - 30);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

/**
 * 文本换行处理
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let currentLine = '';
  // 按字符分割（支持中文）
  const chars = Array.from(text);
  for (const char of chars) {
    const testLine = currentLine + char;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ==================== 撕纸效果生成 ====================

/**
 * 生成不规则撕纸边缘路径
 * @param ctx Canvas 上下文
 * @param x 起始 x
 * @param y 起始 y
 * @param width 宽度
 * @param height 高度
 * @param tearDepth 撕裂深度 (像素)
 */
function createTornPaperPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  tearDepth: number = 8
): void {
  const segments = Math.max(8, Math.floor(width / 20));
  const stepX = width / segments;

  ctx.beginPath();
  ctx.moveTo(x, y);

  // 上边
  for (let i = 0; i <= segments; i++) {
    const px = x + i * stepX;
    const py = y + (Math.random() - 0.5) * tearDepth;
    ctx.lineTo(px, py);
  }

  // 右边
  const rightSegments = Math.max(6, Math.floor(height / 20));
  const stepY = height / rightSegments;
  for (let i = 1; i <= rightSegments; i++) {
    const px = x + width + (Math.random() - 0.5) * tearDepth;
    const py = y + i * stepY;
    ctx.lineTo(px, py);
  }

  // 下边
  for (let i = segments; i >= 0; i--) {
    const px = x + i * stepX;
    const py = y + height + (Math.random() - 0.5) * tearDepth;
    ctx.lineTo(px, py);
  }

  // 左边
  for (let i = rightSegments; i >= 0; i--) {
    const px = x + (Math.random() - 0.5) * tearDepth;
    const py = y + i * stepY;
    ctx.lineTo(px, py);
  }

  ctx.closePath();
}

// ==================== 布局一：撕纸纹理文艺风 ====================

/**
 * 绘制布局一：撕纸纹理文艺风
 */
async function drawTornPaperLayout(
  ctx: CanvasRenderingContext2D,
  config: PosterConfig,
  songInfo: PosterSongInfo,
  lyrics: SelectedLyric[],
  H: number = POSTER_HEIGHT,
  tracks: TracksCardPayload | null = null
): Promise<void> {
  const W = POSTER_WIDTH;

  // 1. 绘制背景
  await drawTornPaperBackground(ctx, config, songInfo, W, H);

  // 2. 加载封面图片
  let coverImg: HTMLImageElement | null = null;
  try {
    coverImg = await loadImage(songInfo.coverUrl);
  } catch {
    console.warn('[PosterEngine] 封面图片加载失败');
  }

  // 3. 提取封面主色调
  let dominantColor = { r: 60, g: 60, b: 80 };
  if (coverImg) {
    dominantColor = extractDominantColor(coverImg);
  }

  // 4. 封面撕纸区域
  const coverSize = 340;
  const coverX = config.coverPosition === 'left' ? 80 : W - coverSize - 80;
  const coverY = 120;

  if (coverImg) {
    // 撕纸裁剪
    ctx.save();
    createTornPaperPath(ctx, coverX, coverY, coverSize, coverSize, 10);
    ctx.clip();
    ctx.drawImage(coverImg, coverX, coverY, coverSize, coverSize);
    ctx.restore();

    // 撕纸边缘描边
    ctx.save();
    createTornPaperPath(ctx, coverX, coverY, coverSize, coverSize, 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // 5. 歌曲名 (书法体)
  await ensureFontLoaded(config.fontId);
  const fontFamily = getFontFamily(config.fontId);
  const titleColor =
    config.lyricColorMode === 'cover'
      ? rgba(dominantColor.r, dominantColor.g, dominantColor.b)
      : config.customLyricColor;

  const titleX = config.coverPosition === 'left' ? coverX + coverSize + 40 : coverX - 40;
  const titleAlign = config.coverPosition === 'left' ? 'left' : 'right';

  ctx.save();
  ctx.font = `${config.fontWeight || 600} 56px ${fontFamily}`;
  ctx.fillStyle = titleColor;
  ctx.textAlign = titleAlign as CanvasTextAlign;
  ctx.textBaseline = 'top';

  const titleMaxWidth = W - coverSize - 240;
  const titleLines = wrapText(ctx, songInfo.songName, titleMaxWidth);
  titleLines.forEach((line, i) => {
    ctx.fillText(line, titleX, coverY + 20 + i * 70);
  });

  // 分隔线
  const lineY = coverY + 20 + titleLines.length * 70 + 10;
  ctx.strokeStyle = rgba(dominantColor.r, dominantColor.g, dominantColor.b, 0.4);
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (titleAlign === 'left') {
    ctx.moveTo(titleX, lineY);
    ctx.lineTo(titleX + Math.min(titleMaxWidth, 300), lineY);
  } else {
    ctx.moveTo(titleX - Math.min(titleMaxWidth, 300), lineY);
    ctx.lineTo(titleX, lineY);
  }
  ctx.stroke();

  // 歌手名
  ctx.font = `${config.fontWeight || 600} 36px ${fontFamily}`;
  ctx.fillStyle = rgba(dominantColor.r, dominantColor.g, dominantColor.b, 0.7);
  ctx.fillText(songInfo.artists, titleX, lineY + 20);
  ctx.restore();

  // 6. 歌词区域
  const lyricColor =
    config.lyricColorMode === 'cover'
      ? rgba(dominantColor.r, dominantColor.g, dominantColor.b, 0.9)
      : config.customLyricColor;

  ctx.save();
  ctx.font = `${config.fontWeight || 600} 42px ${fontFamily}`;
  ctx.fillStyle = lyricColor;
  ctx.textBaseline = 'top';

  const lyricStartY = coverY + coverSize + 120;
  const lyricMaxWidth = W - 160;
  const contentBottom = H - 220; // 底部预留二维码/水印
  let currentY = lyricStartY;
  let truncated = false;

  for (const lyric of lyrics) {
    const text = lyric.text;
    if (!text || text.trim() === '') continue;

    const lines = wrapText(ctx, text, lyricMaxWidth);

    // 根据对齐方式设置 textAlign
    let align: CanvasTextAlign = 'left';
    let startX = 80;
    switch (config.lyricAlign) {
      case 'center':
        align = 'center';
        startX = W / 2;
        break;
      case 'right':
        align = 'right';
        startX = W - 80;
        break;
      case 'left':
        align = 'left';
        startX = 80;
        break;
      case 'staggered':
        // 错落分布：奇数行左对齐，偶数行右对齐偏移
        align = lyric.index % 2 === 0 ? 'left' : 'right';
        startX = lyric.index % 2 === 0 ? 80 + Math.random() * 60 : W - 80 - Math.random() * 60;
        break;
    }

    ctx.textAlign = align;
    for (const line of lines) {
      if (currentY + 58 > contentBottom) {
        truncated = true;
        break;
      }
      ctx.fillText(line, startX, currentY);
      currentY += 58;
    }
    if (truncated) break;
    currentY += 24; // 歌词间距
  }

  // 内容超出画布：在底部标记省略
  if (truncated) {
    ctx.font = `${config.fontWeight || 600} 36px ${fontFamily}`;
    ctx.fillStyle = rgba(dominantColor.r, dominantColor.g, dominantColor.b, 0.6);
    ctx.fillText('……', W / 2, Math.min(currentY + 10, contentBottom));
  }
  ctx.restore();

  // 曲目列表毛玻璃卡片（歌单/专辑信息模式）
  if (tracks) {
    await drawTracksCard(ctx, config, tracks, 80, currentY + 36, W - 160, H - 200);
  }

  // 7. 二维码
  if (config.showQRCode) {
    await drawQRCode(ctx, songInfo, W, H);
  }

  // 8. 水印
  drawWatermark(ctx, config, W, H);
}

/**
 * 绘制撕纸布局的背景
 */
async function drawTornPaperBackground(
  ctx: CanvasRenderingContext2D,
  config: PosterConfig,
  songInfo: PosterSongInfo,
  W: number,
  H: number
): Promise<void> {
  switch (config.backgroundMode) {
    case 'cover': {
      // 跟随封面（等比例放大填满画布，不拉伸变形；超出部分裁剪）
      try {
        const img = await loadImage(songInfo.coverUrl);
        ctx.save();
        ctx.filter = 'blur(40px) brightness(0.3) saturate(1.2)';
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        const coverScale = Math.max(W / iw, H / ih);
        const drawW = iw * coverScale;
        const drawH = ih * coverScale;
        ctx.drawImage(img, (W - drawW) / 2, (H - drawH) / 2, drawW, drawH);
        ctx.restore();
        // 暗色遮罩
        ctx.fillStyle = 'rgba(20, 20, 25, 0.5)';
        ctx.fillRect(0, 0, W, H);
      } catch {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, W, H);
      }
      break;
    }
    case 'solid': {
      ctx.fillStyle = config.solidBgColor;
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'gradient': {
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      const colors = config.gradientBgColors;
      colors.forEach((color, i) => {
        gradient.addColorStop(i / (colors.length - 1), color);
      });
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);
      break;
    }
  }
}

// ==================== 布局二：全屏封面沉浸风 ====================

/**
 * 绘制布局二：全屏封面沉浸风
 */
async function drawImmersiveLayout(
  ctx: CanvasRenderingContext2D,
  config: PosterConfig,
  songInfo: PosterSongInfo,
  lyrics: SelectedLyric[],
  H: number = POSTER_HEIGHT,
  tracks: TracksCardPayload | null = null
): Promise<void> {
  const W = POSTER_WIDTH;

  // 1. 全屏模糊封面背景
  let coverImg: HTMLImageElement | null = null;
  try {
    coverImg = await loadImage(songInfo.coverUrl);
  } catch {
    console.warn('[PosterEngine] 封面图片加载失败');
  }

  if (coverImg) {
    ctx.save();
    ctx.filter = `blur(${config.blurAmount}px) brightness(0.7) saturate(1.3)`;
    // 等比例放大填满画布（不拉伸变形；超出部分裁剪）
    const iw = coverImg.naturalWidth || coverImg.width;
    const ih = coverImg.naturalHeight || coverImg.height;
    const coverScale = Math.max(W / iw, H / ih);
    const drawW = iw * coverScale;
    const drawH = ih * coverScale;
    ctx.drawImage(coverImg, (W - drawW) / 2, (H - drawH) / 2, drawW, drawH);
    ctx.restore();
  } else {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);
  }

  // 2. 暗色遮罩
  const overlayAlpha = config.overlayOpacity / 100;
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${overlayAlpha * 0.7})`);
  gradient.addColorStop(0.4, `rgba(0, 0, 0, ${overlayAlpha})`);
  gradient.addColorStop(1, `rgba(0, 0, 0, ${overlayAlpha * 1.1})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // 3. 歌曲名 (居中)
  await ensureFontLoaded(config.fontId);
  const fontFamily = getFontFamily(config.fontId);
  const textColor = config.textColor;

  ctx.save();
  ctx.font = `${config.fontWeight || 600} 52px ${fontFamily}`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 4;

  const titleMaxWidth = W - 160;
  const titleLines = wrapText(ctx, songInfo.songName, titleMaxWidth);
  let titleY = 280;
  titleLines.forEach((line) => {
    ctx.fillText(line, W / 2, titleY);
    titleY += 68;
  });
  ctx.restore();

  // 4. 歌手名
  ctx.save();
  ctx.font = `${config.fontWeight || 600} 38px ${fontFamily}`;
  ctx.fillStyle = rgba(255, 255, 255, 0.75);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 2;

  const artistX = config.artistPosition === 'center' ? W / 2 : W - 80;
  const artistAlign = config.artistPosition === 'center' ? 'center' : 'right';
  ctx.textAlign = artistAlign as CanvasTextAlign;
  ctx.textBaseline = 'top';
  const artistY = titleY + 20;
  ctx.fillText(songInfo.artists, artistX, artistY);
  ctx.restore();

  // 5. 歌词逐行显示
  ctx.save();
  ctx.font = `${config.fontWeight || 600} 44px ${fontFamily}`;
  ctx.fillStyle = textColor;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const lyricStartY = artistY + 120;
  const lyricMaxWidth = W - 160;
  const contentBottom = H - 220; // 底部预留二维码/水印
  let currentY = lyricStartY;
  let truncated = false;

  for (const lyric of lyrics) {
    const text = lyric.text;
    if (!text || text.trim() === '') continue;

    const lines = wrapText(ctx, text, lyricMaxWidth);
    for (const line of lines) {
      if (currentY + 60 > contentBottom) {
        truncated = true;
        break;
      }
      ctx.fillText(line, W / 2, currentY);
      currentY += 60;
    }
    if (truncated) break;
    currentY += 28;
  }

  // 内容超出画布：在底部标记省略
  if (truncated) {
    ctx.font = `${config.fontWeight || 600} 34px ${fontFamily}`;
    ctx.fillStyle = rgba(255, 255, 255, 0.6);
    ctx.textAlign = 'center';
    ctx.fillText('……', W / 2, Math.min(currentY + 10, contentBottom));
  }
  ctx.restore();

  // 曲目列表毛玻璃卡片（歌单/专辑信息模式）
  if (tracks) {
    await drawTracksCard(ctx, config, tracks, 80, currentY + 36, W - 160, H - 200);
  }

  // 6. 二维码
  if (config.showQRCode) {
    await drawQRCode(ctx, songInfo, W, H);
  }

  // 7. 水印
  drawWatermark(ctx, config, W, H);
}

function coverFilter(config: PosterConfig): string {
  switch (config.imageFilter) {
    case 'high-contrast':
      return 'grayscale(0.35) contrast(1.65) saturate(0.85)';
    case 'low-saturation':
      return 'saturate(0.35) contrast(1.15)';
    default:
      return 'grayscale(1) contrast(1.25)';
  }
}

function drawCoverFill(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const sourceRatio = image.naturalWidth / image.naturalHeight || 1;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawArchiveLyrics(
  ctx: CanvasRenderingContext2D,
  lyrics: SelectedLyric[],
  family: string,
  weight: number,
  color: string,
  startY: number,
  maxY: number
): number {
  ctx.save();
  ctx.font = `${weight} 60px ${family}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  let y = startY;
  for (const lyric of lyrics) {
    if (!lyric.text.trim()) continue;
    for (const line of wrapText(ctx, lyric.text, POSTER_WIDTH - 150)) {
      if (y + 78 > maxY) break;
      ctx.fillText(line, 74, y);
      y += 78;
    }
    y += 22;
    if (y >= maxY) break;
  }
  ctx.restore();
  return y;
}

/** 黑白影像、书法标题与档案信息构成的演出海报。 */
async function drawPerformanceArchiveLayout(
  ctx: CanvasRenderingContext2D,
  config: PosterConfig,
  songInfo: PosterSongInfo,
  lyrics: SelectedLyric[],
  H: number = POSTER_HEIGHT,
  tracks: TracksCardPayload | null = null
): Promise<void> {
  const family = getFontFamily(config.fontId);
  const accentColor = resolvePosterAccentColor(config);
  ctx.fillStyle = '#090909';
  ctx.fillRect(0, 0, POSTER_WIDTH, H);

  try {
    const cover = await loadImage(songInfo.coverUrl);
    ctx.save();
    ctx.filter = coverFilter(config);
    drawCoverFill(ctx, cover, 0, 0, POSTER_WIDTH, 1070);
    ctx.restore();
  } catch {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, POSTER_WIDTH, 1070);
  }

  const fade = ctx.createLinearGradient(0, 650, 0, 1130);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, '#090909');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 620, POSTER_WIDTH, 520);

  ctx.save();
  ctx.fillStyle = accentColor;
  ctx.font = `${config.fontWeight} 132px ${family}`;
  ctx.textAlign = config.titleOrientation === 'vertical' ? 'right' : 'left';
  ctx.textBaseline = 'top';
  if (config.titleOrientation === 'vertical') {
    Array.from(songInfo.songName)
      .slice(0, 7)
      .forEach((char, index) => ctx.fillText(char, 980, 90 + index * 140));
  } else {
    const lines = wrapText(ctx, songInfo.songName, 820);
    lines.slice(0, 3).forEach((line, index) => {
      const offset = config.titleOrientation === 'staggered' ? (index % 2) * 84 : 0;
      ctx.fillText(line, 62 + offset, 82 + index * 142);
    });
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `700 34px ${family}`;
  ctx.textAlign = 'left';
  ctx.fillText(songInfo.artists, 72, 930);
  ctx.font = `500 24px ${family}`;
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fillText('ZEPHYRUS MUSIC ARCHIVE', 72, 978);
  ctx.textAlign = 'right';
  ctx.fillText(getCurrentPosterDate(), 1008, 978);
  ctx.textAlign = 'left';
  ctx.fillStyle = accentColor;
  ctx.fillRect(72, 1034, 936, 5);

  const lyricEndY = drawArchiveLyrics(
    ctx,
    lyrics,
    family,
    config.fontWeight,
    '#ffffff',
    1130,
    H - 140
  );
  // 二维码占位（qrY - padding 顶部 ≈ H-188）：开启二维码时曲目卡片需在其上方留出间距
  const tracksMaxBottom = config.showQRCode ? H - 220 : H - 140;
  if (tracks) {
    await drawTracksCard(
      ctx,
      config,
      tracks,
      74,
      lyricEndY + 30,
      POSTER_WIDTH - 148,
      tracksMaxBottom
    );
  }
  if (config.showQRCode) await drawQRCode(ctx, songInfo, POSTER_WIDTH, H);
  drawWatermark(ctx, config, POSTER_WIDTH, H);
}

/** 高对比图像、错位竖题与中央印章构成的巡演海报。 */
async function drawSealTourLayout(
  ctx: CanvasRenderingContext2D,
  config: PosterConfig,
  songInfo: PosterSongInfo,
  lyrics: SelectedLyric[],
  H: number = POSTER_HEIGHT,
  tracks: TracksCardPayload | null = null
): Promise<void> {
  const family = getFontFamily(config.fontId);
  const accentColor = resolvePosterAccentColor(config);
  ctx.fillStyle = '#f1eee8';
  ctx.fillRect(0, 0, POSTER_WIDTH, H);
  try {
    const cover = await loadImage(songInfo.coverUrl);
    ctx.save();
    ctx.filter = coverFilter({ ...config, imageFilter: 'high-contrast' });
    drawCoverFill(ctx, cover, 0, 0, 760, 1160);
    ctx.restore();
  } catch {
    ctx.fillStyle = '#c9c2b7';
    ctx.fillRect(0, 0, 760, 1160);
  }

  ctx.fillStyle = '#111';
  ctx.font = `${config.fontWeight} 116px ${family}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  Array.from(songInfo.songName)
    .slice(0, 7)
    .forEach((char, index) => ctx.fillText(char, 910 + (index % 2) * 26, 96 + index * 132));

  const sealX = 650;
  const sealY = 760;
  const sealSize = 238;
  ctx.save();
  drawDistressedSealEdge(ctx, sealX, sealY, sealSize, accentColor, songInfo.artists);
  ctx.fillStyle = accentColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const sealRows = splitSealArtistName(songInfo.artists);
  const longestRow = Math.max(...sealRows.map((row) => Array.from(row).length));
  const sealFontSize = Math.min(64, 168 / longestRow, 156 / sealRows.length);
  const rowHeight = Math.min(68, 162 / sealRows.length);
  ctx.font = `${config.fontWeight} ${sealFontSize}px ${family}`;
  sealRows.forEach((row, index) => {
    const y = sealY + (index - (sealRows.length - 1) / 2) * rowHeight;
    ctx.fillText(row, sealX, y, 174);
  });
  ctx.restore();

  ctx.fillStyle = '#121212';
  ctx.font = `700 28px ${family}`;
  ctx.textAlign = 'left';
  const archiveRows = [
    getCurrentPosterDate(),
    songInfo.artists,
    config.eventLabel || 'LIVE ARCHIVE'
  ];
  archiveRows.forEach((row, index) => {
    const y = 1210 + index * 62;
    ctx.fillStyle = index === 0 ? accentColor : '#121212';
    ctx.fillText(row, 70, y);
    ctx.strokeStyle = 'rgba(18,18,18,0.2)';
    ctx.beginPath();
    ctx.moveTo(70, y + 42);
    ctx.lineTo(1010, y + 42);
    ctx.stroke();
  });

  const fullContent = Boolean(config.longImage && config.showFullContent);
  const shortLyrics = fullContent ? lyrics : lyrics.slice(0, 3);
  const lyricEndY = drawArchiveLyrics(
    ctx,
    shortLyrics,
    family,
    config.fontWeight,
    '#121212',
    1430,
    H - 140
  );
  if (tracks) {
    // 二维码占位：开启二维码时曲目卡片需在其上方留出间距
    const sealTracksMaxBottom = config.showQRCode ? H - 220 : H - 140;
    await drawTracksCard(
      ctx,
      config,
      tracks,
      70,
      lyricEndY + 30,
      POSTER_WIDTH - 140,
      sealTracksMaxBottom
    );
  }
  if (config.showQRCode) await drawQRCode(ctx, songInfo, POSTER_WIDTH, H);
  drawWatermark(ctx, config, POSTER_WIDTH, H);
}

// ==================== 公共绘制函数 ====================

/**
 * 绘制二维码到海报右下角
 */
async function drawQRCode(
  ctx: CanvasRenderingContext2D,
  songInfo: PosterSongInfo,
  W: number,
  H: number
): Promise<void> {
  try {
    const kind = (songInfo as PosterSubject).kind || 'song';
    const deepLink =
      kind === 'song'
        ? buildSongDeepLink(songInfo.songId)
        : buildCollectionDeepLink(kind as 'playlist' | 'album', songInfo.songId);
    const qrImg = await generateQRCodeImage(deepLink, QR_CODE_SIZE);

    // 白色背景圆角
    const qrX = W - QR_CODE_SIZE - QR_MARGIN - 12;
    const qrY = H - QR_CODE_SIZE - QR_MARGIN - 12;
    const padding = 12;

    ctx.save();
    // 圆角背景
    const r = 12;
    ctx.beginPath();
    ctx.moveTo(qrX - padding + r, qrY - padding);
    ctx.lineTo(qrX + QR_CODE_SIZE + padding - r, qrY - padding);
    ctx.quadraticCurveTo(
      qrX + QR_CODE_SIZE + padding,
      qrY - padding,
      qrX + QR_CODE_SIZE + padding,
      qrY - padding + r
    );
    ctx.lineTo(qrX + QR_CODE_SIZE + padding, qrY + QR_CODE_SIZE + padding - r);
    ctx.quadraticCurveTo(
      qrX + QR_CODE_SIZE + padding,
      qrY + QR_CODE_SIZE + padding,
      qrX + QR_CODE_SIZE + padding - r,
      qrY + QR_CODE_SIZE + padding
    );
    ctx.lineTo(qrX - padding + r, qrY + QR_CODE_SIZE + padding);
    ctx.quadraticCurveTo(
      qrX - padding,
      qrY + QR_CODE_SIZE + padding,
      qrX - padding,
      qrY + QR_CODE_SIZE + padding - r
    );
    ctx.lineTo(qrX - padding, qrY - padding + r);
    ctx.quadraticCurveTo(qrX - padding, qrY - padding, qrX - padding + r, qrY - padding);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();

    // 绘制二维码
    ctx.drawImage(qrImg, qrX, qrY, QR_CODE_SIZE, QR_CODE_SIZE);
  } catch (e) {
    console.error('[PosterEngine] 二维码生成失败:', e);
  }
}

/**
 * 绘制水印（左下角 logo 图标或软件名文字）
 */
function drawWatermark(
  ctx: CanvasRenderingContext2D,
  config: PosterConfig,
  W: number,
  H: number
): void {
  void W;
  const opacity = config.watermarkOpacity / 100;
  if (opacity <= 0) return;

  ctx.save();

  if (config.watermarkType === 'logo') {
    // 绘制 logo 图标（圆角）
    const logoSize = 48;
    const logoX = 30;
    const logoY = H - logoSize - 30;
    const radius = 12;

    ctx.globalAlpha = opacity;
    // 圆角矩形裁剪
    ctx.beginPath();
    ctx.moveTo(logoX + radius, logoY);
    ctx.lineTo(logoX + logoSize - radius, logoY);
    ctx.quadraticCurveTo(logoX + logoSize, logoY, logoX + logoSize, logoY + radius);
    ctx.lineTo(logoX + logoSize, logoY + logoSize - radius);
    ctx.quadraticCurveTo(
      logoX + logoSize,
      logoY + logoSize,
      logoX + logoSize - radius,
      logoY + logoSize
    );
    ctx.lineTo(logoX + radius, logoY + logoSize);
    ctx.quadraticCurveTo(logoX, logoY + logoSize, logoX, logoY + logoSize - radius);
    ctx.lineTo(logoX, logoY + radius);
    ctx.quadraticCurveTo(logoX, logoY, logoX + radius, logoY);
    ctx.closePath();
    ctx.clip();

    // 尝试绘制 logo 图片
    const logoImg = (window as any).__zephyrusLogoImg as HTMLImageElement | undefined;
    if (logoImg) {
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    } else {
      // 后备：渐变色块
      const grad = ctx.createLinearGradient(logoX, logoY, logoX + logoSize, logoY + logoSize);
      grad.addColorStop(0, '#6366f1');
      grad.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = grad;
      ctx.fillRect(logoX, logoY, logoSize, logoSize);
    }
  } else {
    // 绘制文字水印
    ctx.font = '24px sans-serif';
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Zephyrus Player', 30, H - 30);
  }

  ctx.restore();
}

// ==================== Subject 与内容行 ====================

/** 兼容旧调用方（PosterSongInfo 无 kind）：默认视为歌曲海报 */
function normalizeSubject(subject: PosterSubject | PosterSongInfo): PosterSubject {
  const normalized = 'kind' in subject ? subject : { ...subject, kind: 'song' as const };
  // 歌单/专辑场景调用方可能只传 title：布局绘制统一消费 songName，此处回退
  if (!normalized.songName) {
    normalized.songName = normalized.title || '';
  }
  return normalized;
}

/** 曲目列表条数：默认取 config.trackLimit（10）；长图+全部 = 40 */
const TRACK_LIMIT_FULL = 40;
/** 详细列表样式（需逐首加载封面）的硬上限 */
const TRACK_LIMIT_DETAILED = 15;
/** 长图+全部模式下简介的防御性字数上限 */
const DESC_LIMIT_FULL = 500;
/** 曲目卡片内边距与行度量 */
const TRACKS_CARD = {
  padding: 24,
  radius: 28,
  compact: { row: 52, gap: 10 },
  detailed: { row: 88, gap: 10 }
};

/**
 * 根据模式解析实际绘制的文本内容行（歌词摘录 / 简介行）。
 * 曲目列表不在此转换，由布局函数以毛玻璃卡片单独绘制（见 drawTracksCard）。
 * - 歌词摘录模式（lyrics 非空）：非长图/未开"全部内容"时截取前 LYRIC_CONTENT_LIMIT 句；
 *   非长图模式下绘制阶段还会按画布高度二次截断（超出画布画不下）。
 * - 信息模式（lyrics 为空）：song 取简介（按 config.descLimit 截断，默认 30）；
 *   playlist/album 取简介（曲目走卡片）。长图+全部内容：简介放宽至 500 字防御。
 */
function resolveContentLines(
  config: PosterConfig,
  subject: PosterSubject,
  lyrics: SelectedLyric[]
): SelectedLyric[] {
  const full = Boolean(config.longImage && config.showFullContent);
  if (lyrics.length > 0) {
    return config.longImage && !full ? lyrics.slice(0, LYRIC_CONTENT_LIMIT) : lyrics;
  }

  const lines: SelectedLyric[] = [];
  const desc = truncateText(subject.description, full ? DESC_LIMIT_FULL : (config.descLimit ?? 30));
  if (desc) lines.push({ index: 0, text: desc });
  return lines;
}

/** 曲目卡片绘制参数；无曲目/歌曲主题时为 null */
interface TracksCardPayload {
  tracks: NonNullable<PosterSubject['tracks']>;
  limit: number;
  style: 'compact' | 'detailed';
}

function resolveTracksCardPayload(
  config: PosterConfig,
  subject: PosterSubject,
  hasLyrics: boolean
): TracksCardPayload | null {
  if (hasLyrics || subject.kind === 'song') return null;
  const tracks = subject.tracks || [];
  if (!tracks.length) return null;
  const full = Boolean(config.longImage && config.showFullContent);
  const style: 'compact' | 'detailed' =
    config.trackListStyle === 'detailed' ? 'detailed' : 'compact';
  const hardMax = style === 'detailed' ? TRACK_LIMIT_DETAILED : TRACK_LIMIT_FULL;
  const limit = Math.min(config.trackLimit ?? 10, hardMax, tracks.length);
  return { tracks, limit, style };
}

/** 卡片行度量：实际绘制行数（含溢出省略行）与卡片总高 */
function tracksCardLayout(
  payload: TracksCardPayload,
  availableHeight: number
): { rows: number; rowHeight: number; rowGap: number; cardHeight: number; overflow: boolean } {
  const { padding } = TRACKS_CARD;
  const { row: rowHeight, gap: rowGap } = TRACKS_CARD[payload.style];
  let rows = payload.limit;
  let overflow = payload.tracks.length > rows;
  if (availableHeight > 0) {
    // 非长图：卡片需在画布内完整呈现，放不下时截行并追加省略行
    const inner = availableHeight - padding * 2;
    const fitRows = Math.max(1, Math.floor((inner + rowGap) / (rowHeight + rowGap)));
    if (rows > fitRows) {
      rows = overflow ? Math.max(1, fitRows - 1) : fitRows;
      overflow = payload.tracks.length > rows;
    }
  }
  const cardHeight =
    padding * 2 + rows * rowHeight + (rows - 1) * rowGap + (overflow ? rowHeight : 0);
  return { rows, rowHeight, rowGap, cardHeight, overflow };
}

/** 卡片完整高度（无画布约束），供长图度量 */
function tracksCardFullHeight(payload: TracksCardPayload): number {
  const { padding } = TRACKS_CARD;
  const { row: rowHeight, gap: rowGap } = TRACKS_CARD[payload.style];
  const rows = Math.min(payload.limit, payload.tracks.length);
  const overflow = payload.tracks.length > rows;
  return padding * 2 + rows * rowHeight + (rows - 1) * rowGap + (overflow ? rowHeight : 0);
}

/** 圆角矩形路径（兼容未支持 ctx.roundRect 的 WebView） */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** 单行文本绘制：超宽自动省略号截断，返回实际文本 */
function fillTextWithEllipsis(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
): void {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}……`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  ctx.fillText(`${clipped}……`, x, y);
}

/**
 * 曲目列表玻璃卡片：透出海报背景（画布自采样模糊）+ 白色提亮 + 圆角描边，
 * 支持 compact（序号+单行）与 detailed（封面+两行）两种呈现（可切换）。
 */
async function drawTracksCard(
  ctx: CanvasRenderingContext2D,
  config: PosterConfig,
  payload: TracksCardPayload,
  x: number,
  y: number,
  width: number,
  maxBottom: number
): Promise<void> {
  const { padding, radius } = TRACKS_CARD;
  const layout = tracksCardLayout(payload, maxBottom - y);
  const cardHeight = layout.cardHeight;
  const family = getFontFamily(config.fontId);
  // seal-tour 为浅色布局，透出背景的玻璃卡上需用深色文字保证可读
  const isLight = config.layout === 'seal-tour';
  const textPrimary = isLight ? 'rgba(20, 20, 20, 0.92)' : 'rgba(255, 255, 255, 0.94)';
  const textSecondary = isLight ? 'rgba(20, 20, 20, 0.55)' : 'rgba(255, 255, 255, 0.55)';

  // 玻璃底：透出海报背景（画布自采样模糊）+ 白色提亮层
  ctx.save();
  roundedRectPath(ctx, x, y, width, cardHeight, radius);
  ctx.clip();
  try {
    const overscan = 48; // 放大采样，抵消模糊边缘的虚化暗边
    ctx.filter = 'blur(24px)';
    ctx.drawImage(
      ctx.canvas,
      x,
      y,
      width,
      cardHeight,
      x - overscan,
      y - overscan,
      width + overscan * 2,
      cardHeight + overscan * 2
    );
    ctx.filter = 'none';
  } catch {
    // 自采样不可用时仅保留提亮层
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fillRect(x, y, width, cardHeight);
  ctx.restore();

  // 描边
  ctx.save();
  roundedRectPath(ctx, x, y, width, cardHeight, radius);
  ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // 曲目行
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const innerX = x + padding;
  let rowY = y + padding;
  const drawn = Math.min(layout.rows, payload.tracks.length);

  if (payload.style === 'detailed') {
    // 详细：封面缩略图 + 曲名/歌手两行
    for (let i = 0; i < drawn; i++) {
      const track = payload.tracks[i];
      const coverSize = 64;
      try {
        const thumb = await loadImage(
          track.picUrl
            ? `${track.picUrl}${track.picUrl.includes('?') ? '&' : '?'}param=100y100`
            : ''
        );
        ctx.save();
        roundedRectPath(
          ctx,
          innerX,
          rowY + (layout.rowHeight - coverSize) / 2,
          coverSize,
          coverSize,
          12
        );
        ctx.clip();
        ctx.drawImage(
          thumb,
          innerX,
          rowY + (layout.rowHeight - coverSize) / 2,
          coverSize,
          coverSize
        );
        ctx.restore();
      } catch {
        ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)';
        roundedRectPath(
          ctx,
          innerX,
          rowY + (layout.rowHeight - coverSize) / 2,
          coverSize,
          coverSize,
          12
        );
        ctx.fill();
      }
      const textX = innerX + coverSize + 20;
      ctx.font = `600 26px ${family}`;
      ctx.fillStyle = textPrimary;
      fillTextWithEllipsis(ctx, track.name, textX, rowY + 8, x + width - padding - textX);
      ctx.font = `400 20px ${family}`;
      ctx.fillStyle = textSecondary;
      fillTextWithEllipsis(ctx, track.artist, textX, rowY + 44, x + width - padding - textX);
      rowY += layout.rowHeight + layout.rowGap;
    }
  } else {
    // 紧凑：序号 + 曲名 - 歌手 单行
    for (let i = 0; i < drawn; i++) {
      const track = payload.tracks[i];
      const rowCenterY = rowY + layout.rowHeight / 2;
      ctx.font = `600 24px ${family}`;
      ctx.fillStyle = textSecondary;
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1).padStart(2, '0'), innerX, rowCenterY - 14);
      const textX = innerX + 52;
      ctx.font = `${config.fontWeight || 600} 28px ${family}`;
      ctx.fillStyle = textPrimary;
      fillTextWithEllipsis(
        ctx,
        `${track.name} - ${track.artist}`,
        textX,
        rowCenterY - 16,
        x + width - padding - textX
      );
      rowY += layout.rowHeight + layout.rowGap;
    }
  }

  // 溢出省略
  if (layout.overflow) {
    ctx.font = `500 26px ${family}`;
    ctx.fillStyle = textSecondary;
    ctx.textAlign = 'center';
    ctx.fillText('……', x + width / 2, rowY + 8);
  }
  ctx.restore();
}

/** 估算内容区总高度（含换行），供长图画布高度计算。换行宽度取各布局最小值，宁高勿矮。 */
function estimateContentHeight(
  ctx: CanvasRenderingContext2D,
  config: PosterConfig,
  contentLines: SelectedLyric[]
): number {
  const metrics = LAYOUT_CONTENT_METRICS[config.layout];
  ctx.font = `${config.fontWeight || 600} ${metrics.fontPx}px ${getFontFamily(config.fontId)}`;
  let total = 0;
  for (const line of contentLines) {
    if (!line.text.trim()) continue;
    const wrapped = wrapText(ctx, line.text, POSTER_WIDTH - 160);
    total += wrapped.length * metrics.line + metrics.para;
  }
  return total;
}

/** 计算画布高度：非长图固定 1920；长图 = max(1920, 内容区 + 基础头部/底部)。 */
function resolvePosterHeight(config: PosterConfig, contentHeight: number): number {
  if (!config.longImage) return POSTER_HEIGHT;
  const metrics = LAYOUT_CONTENT_METRICS[config.layout];
  return Math.max(POSTER_HEIGHT, Math.round(metrics.top + contentHeight + metrics.bottomPad));
}

// ==================== 主入口 ====================

/**
 * 生成海报
 * @param config 海报配置
 * @param subject 海报主题（歌曲/歌单/专辑；旧调用方传 PosterSongInfo 时按歌曲处理）
 * @param lyrics 选中的歌词（空 = 信息模式：简介/曲目）
 * @returns 生成的 Canvas 元素
 */
export async function generatePoster(
  config: PosterConfig,
  subject: PosterSubject | PosterSongInfo,
  lyrics: SelectedLyric[] = []
): Promise<HTMLCanvasElement> {
  const normalizedConfig = normalizePosterConfig(config);
  const normalizedSubject = normalizeSubject(subject);
  // 实际绘制的文本内容行（歌词摘录或简介行），长图截条数在此决定
  const contentLines = resolveContentLines(normalizedConfig, normalizedSubject, lyrics);
  // 曲目毛玻璃卡片（歌单/专辑信息模式独有）
  const tracksCard = resolveTracksCardPayload(
    normalizedConfig,
    normalizedSubject,
    lyrics.length > 0
  );

  // 计算画布高度（长图 = 内容自适应：文本行 + 曲目卡片）
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = POSTER_WIDTH;
  measureCanvas.height = POSTER_HEIGHT;
  const measureCtx = measureCanvas.getContext('2d');
  const linesHeight = measureCtx
    ? estimateContentHeight(measureCtx, normalizedConfig, contentLines)
    : 0;
  const TRACKS_CARD_GAP = 36;
  const totalContentHeight =
    linesHeight + (tracksCard ? TRACKS_CARD_GAP + tracksCardFullHeight(tracksCard) : 0);
  const H = resolvePosterHeight(normalizedConfig, totalContentHeight);

  // 创建 Canvas
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');

  // 确保字体已加载
  await ensureFontLoaded(normalizedConfig.fontId);

  // 根据布局选择渲染函数
  switch (normalizedConfig.layout) {
    case 'performance-archive':
      await drawPerformanceArchiveLayout(
        ctx,
        normalizedConfig,
        normalizedSubject,
        contentLines,
        H,
        tracksCard
      );
      break;
    case 'seal-tour':
      await drawSealTourLayout(
        ctx,
        normalizedConfig,
        normalizedSubject,
        contentLines,
        H,
        tracksCard
      );
      break;
    case 'immersive':
      await drawImmersiveLayout(
        ctx,
        normalizedConfig,
        normalizedSubject,
        contentLines,
        H,
        tracksCard
      );
      break;
    default:
      await drawTornPaperLayout(
        ctx,
        normalizedConfig,
        normalizedSubject,
        contentLines,
        H,
        tracksCard
      );
  }

  return canvas;
}

/**
 * 将 Canvas 转为 Data URL (PNG)
 */
export function canvasToDataURL(canvas: HTMLCanvasElement, quality: number = 0.95): string {
  return canvas.toDataURL('image/png', quality);
}

/**
 * 将 Canvas 转为 Blob
 */
export function canvasToBlob(canvas: HTMLCanvasElement, quality: number = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas 转 Blob 失败'));
      },
      'image/png',
      quality
    );
  });
}
