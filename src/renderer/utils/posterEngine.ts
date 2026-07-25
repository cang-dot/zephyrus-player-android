/**
 * 海报 Canvas 生成引擎
 * 支持 9:16 (1080×1920) 比例
 * 两种布局：撕纸纹理文艺风 / 全屏封面沉浸风
 */

import type { PosterConfig, PosterSongInfo, SelectedLyric } from '@/types/share';
import { ensureFontLoaded, getFontFamily } from '@/utils/fontLoader';
import { buildSongDeepLink, generateQRCodeImage, loadImage } from '@/utils/qrCodeUtil';

/** 海报尺寸 */
export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1920;

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
 * 计算颜色的亮度 (0-255)
 */
function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 颜色转 rgba 字符串
 */
function rgba(r: number, g: number, b: number, a: number = 1): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
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

/**
 * 在撕纸区域上绘制纸张纹理
 */
function drawPaperTexture(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  // 基础纸张色
  ctx.fillStyle = '#f5f1eb';
  ctx.fill();

  // 添加噪点纹理
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 20;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, x, y);
}

// ==================== 布局一：撕纸纹理文艺风 ====================

/**
 * 绘制布局一：撕纸纹理文艺风
 */
async function drawTornPaperLayout(
  ctx: CanvasRenderingContext2D,
  config: PosterConfig,
  songInfo: PosterSongInfo,
  lyrics: SelectedLyric[]
): Promise<void> {
  const W = POSTER_WIDTH;
  const H = POSTER_HEIGHT;

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
  ctx.font = `bold 56px ${fontFamily}`;
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
  ctx.font = `36px ${fontFamily}`;
  ctx.fillStyle = rgba(dominantColor.r, dominantColor.g, dominantColor.b, 0.7);
  ctx.fillText(songInfo.artists, titleX, lineY + 20);
  ctx.restore();

  // 6. 歌词区域
  const lyricColor =
    config.lyricColorMode === 'cover'
      ? rgba(dominantColor.r, dominantColor.g, dominantColor.b, 0.9)
      : config.customLyricColor;

  ctx.save();
  ctx.font = `42px ${fontFamily}`;
  ctx.fillStyle = lyricColor;
  ctx.textBaseline = 'top';

  const lyricStartY = coverY + coverSize + 120;
  const lyricMaxWidth = W - 160;
  let currentY = lyricStartY;

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
      ctx.fillText(line, startX, currentY);
      currentY += 58;
    }
    currentY += 24; // 歌词间距
  }
  ctx.restore();

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
      // 跟随封面
      try {
        const img = await loadImage(songInfo.coverUrl);
        ctx.save();
        ctx.filter = 'blur(40px) brightness(0.3) saturate(1.2)';
        ctx.drawImage(img, -40, -40, W + 80, H + 80);
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
  lyrics: SelectedLyric[]
): Promise<void> {
  const W = POSTER_WIDTH;
  const H = POSTER_HEIGHT;

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
    // 放大绘制以覆盖模糊边缘
    const scale = 1.15;
    const drawW = W * scale;
    const drawH = H * scale;
    const offsetX = (W - drawW) / 2;
    const offsetY = (H - drawH) / 2;
    ctx.drawImage(coverImg, offsetX, offsetY, drawW, drawH);
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
  ctx.font = `bold 52px ${fontFamily}`;
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
  ctx.font = `38px ${fontFamily}`;
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
  ctx.font = `44px ${fontFamily}`;
  ctx.fillStyle = textColor;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const lyricStartY = artistY + 120;
  const lyricMaxWidth = W - 160;
  let currentY = lyricStartY;

  for (const lyric of lyrics) {
    const text = lyric.text;
    if (!text || text.trim() === '') continue;

    const lines = wrapText(ctx, text, lyricMaxWidth);
    for (const line of lines) {
      ctx.fillText(line, W / 2, currentY);
      currentY += 60;
    }
    currentY += 28;
  }
  ctx.restore();

  // 6. 二维码
  if (config.showQRCode) {
    await drawQRCode(ctx, songInfo, W, H);
  }

  // 7. 水印
  drawWatermark(ctx, config, W, H);
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
    const deepLink = buildSongDeepLink(songInfo.songId);
    const qrImg = await generateQRCodeImage(deepLink, QR_CODE_SIZE);

    // 白色背景圆角
    const qrX = W - QR_CODE_SIZE - QR_MARGIN - 12;
    const qrY = H - QR_CODE_SIZE - QR_MARGIN - 12;
    const padding = 12;
    const bgSize = QR_CODE_SIZE + padding * 2;

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

// ==================== 主入口 ====================

/**
 * 生成海报
 * @param config 海报配置
 * @param songInfo 歌曲信息
 * @param lyrics 选中的歌词
 * @returns 生成的 Canvas 元素
 */
export async function generatePoster(
  config: PosterConfig,
  songInfo: PosterSongInfo,
  lyrics: SelectedLyric[]
): Promise<HTMLCanvasElement> {
  // 创建 Canvas
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');

  // 确保字体已加载
  await ensureFontLoaded(config.fontId);

  // 根据布局选择渲染函数
  if (config.layout === 'torn-paper') {
    await drawTornPaperLayout(ctx, config, songInfo, lyrics);
  } else {
    await drawImmersiveLayout(ctx, config, songInfo, lyrics);
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
