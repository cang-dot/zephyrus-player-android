/**
 * 视频帧骨架排版
 *
 * 4 种骨架（stack / immersive / poster / terminal）覆盖 9 种样式：
 * 骨架负责「封面、歌名与作者、歌词块（含逐字高亮）、进度条、水印」的几何排布，
 * 皮肤只决定配色、字体与装饰层。骨架本身不产生随机性，保证逐帧稳定。
 *
 * 尺寸推导统一以画面短边为基准（unit），因此 16:9 / 9:16 / 3:4 / 4:3 四种比例
 * 与 720p / 1080p 两档清晰度都能得到一致观感。
 */

import { formatSegmentTime } from '@/types/shareVideo';

import {
  drawCoverRound,
  drawProgressBar,
  drawSungLine,
  drawWatermark,
  ellipsize,
  roundRectPath,
  withAlpha,
  wrapText
} from './common';
import type { LayoutBox, VideoFrameContext } from './types';

/** 画面基准度量 */
interface Metrics {
  /** 短边像素 */
  unit: number;
  /** 是否竖版（含正方形） */
  vertical: boolean;
  /** 安全边距 */
  pad: number;
}

function metricsOf(c: VideoFrameContext): Metrics {
  const unit = Math.min(c.width, c.height);
  return { unit, vertical: c.height >= c.width, pad: unit * 0.07 };
}

// ==================== 复用件 ====================

/** 带投影与描边的圆角封面 */
function drawCoverWithShadow(c: VideoFrameContext, x: number, y: number, size: number): void {
  if (!c.song.cover) return;
  const { ctx } = c;
  const radius = size * 0.055;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = size * 0.2;
  ctx.shadowOffsetY = size * 0.06;
  drawCoverRound(ctx, c.song.cover, x, y, size, radius);
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, x, y, size, size, radius);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = Math.max(1, size * 0.006);
  ctx.stroke();
  ctx.restore();
}

/**
 * 歌名 + 作者，返回绘制后的下一个 y。
 * scale 用于不同骨架的字号缩放（immersive / poster 用更小的信息条）。
 */
function drawTrackMeta(
  c: VideoFrameContext,
  centerX: number,
  y: number,
  align: CanvasTextAlign,
  maxWidth: number,
  scale = 1
): number {
  const { ctx, skin } = c;
  const { unit } = metricsOf(c);
  const titlePx = Math.max(12, Math.round(unit * 0.05 * scale));
  const artistPx = Math.max(10, Math.round(unit * 0.03 * scale));

  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.font = `600 ${titlePx}px ${skin.fontFamily}`;
  ctx.fillStyle = skin.textPrimary;
  if (skin.theme !== 'light') {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = titlePx * 0.5;
  }
  ctx.fillText(ellipsize(ctx, c.song.title || '未知歌曲', maxWidth), centerX, y);
  let cursor = y + titlePx * 1.3;

  ctx.shadowBlur = 0;
  ctx.font = `500 ${artistPx}px ${skin.fontFamily}`;
  ctx.fillStyle = skin.textSecondary;
  ctx.fillText(ellipsize(ctx, c.song.artist || '未知艺术家', maxWidth), centerX, cursor);
  cursor += artistPx * 1.6;
  ctx.restore();
  return cursor;
}

/** 歌词块排布参数 */
interface LyricOptions {
  /** 对齐锚点：align=center 为中心，left 为左边界，right 为右边界 */
  anchorX: number;
  /** 歌词块垂直中心 */
  centerY: number;
  maxWidth: number;
  /** 当前行字号（会按 maxRows 自动收缩） */
  fontPx: number;
  align: CanvasTextAlign;
  /** 当前行允许的最大行数，超出则按比例收缩字号，默认 3 */
  maxRows?: number;
}

/**
 * 计算当前行实际可用字号：在 maxWidth 下若换行数超过 maxRows，
 * 按 sqrt 比例收缩并复测，最多迭代 6 次。
 * 这样长句歌词不会撑爆版面，短句仍保持该骨架的原始字号。
 */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  basePx: number,
  family: string,
  maxRows: number
): number {
  let size = Math.max(14, Math.round(basePx));
  for (let i = 0; i < 6; i++) {
    ctx.font = `600 ${size}px ${family}`;
    const rows = wrapText(ctx, text, maxWidth).length;
    if (rows <= maxRows) break;
    size = Math.max(12, Math.round(size * Math.sqrt(maxRows / rows) * 0.98));
  }
  return size;
}

/**
 * 绘制「上一行 / 当前行（逐字高亮）/ 翻译 / 下一行」组成的歌词块。
 * 会先测量总高再居中绘制，并回调皮肤的 drawLyricBackdrop 以便铺衬底。
 * 返回歌词块外接矩形。
 */
function drawLyricBlock(c: VideoFrameContext, opt: LyricOptions): LayoutBox {
  const { ctx, skin } = c;
  const line = c.lyric.current;
  const currentText = line?.text?.trim() ?? '';
  const prevText = c.lyric.prev?.text?.trim() ?? '';
  const nextText = c.lyric.next?.text?.trim() ?? '';
  const trText = line?.trText?.trim() ?? '';

  const maxRows = opt.maxRows ?? 3;

  // 测量换行；当前行字号按可用宽度自适应
  ctx.save();
  const fontPx = currentText
    ? fitFontSize(ctx, currentText, opt.maxWidth, opt.fontPx, skin.fontFamily, maxRows)
    : Math.max(14, Math.round(opt.fontPx));
  const contextPx = Math.max(12, Math.round(fontPx * 0.54));
  const trPx = Math.max(11, Math.round(fontPx * 0.4));
  const lineHeight = Math.round(fontPx * 1.32);
  const contextLine = Math.round(contextPx * 1.34);
  const gap = Math.round(fontPx * 0.6);

  ctx.font = `600 ${fontPx}px ${skin.fontFamily}`;
  const currentRows = currentText ? wrapText(ctx, currentText, opt.maxWidth) : [];
  ctx.font = `500 ${contextPx}px ${skin.fontFamily}`;
  const prevRows = prevText ? wrapText(ctx, prevText, opt.maxWidth * 0.88) : [];
  const nextRows = nextText ? wrapText(ctx, nextText, opt.maxWidth * 0.88) : [];
  ctx.font = `400 ${trPx}px ${skin.fontFamily}`;
  const trRows = trText ? wrapText(ctx, trText, opt.maxWidth * 0.92) : [];
  ctx.restore();

  const rows = Math.max(1, currentRows.length);
  const prevH = prevRows.length * contextLine;
  const currentH = rows * lineHeight;
  const trH = trRows.length ? trRows.length * Math.round(trPx * 1.4) + Math.round(gap * 0.35) : 0;
  const nextH = nextRows.length ? nextRows.length * contextLine + gap * 0.7 : 0;
  const totalH = prevH + (prevRows.length ? gap * 0.7 : 0) + currentH + trH + nextH;

  const boxX =
    opt.align === 'center'
      ? opt.anchorX - opt.maxWidth / 2
      : opt.align === 'right'
        ? opt.anchorX - opt.maxWidth
        : opt.anchorX;
  const box: LayoutBox = {
    x: boxX,
    y: opt.centerY - totalH / 2,
    width: opt.maxWidth,
    height: totalH
  };

  c.skin.drawLyricBackdrop?.(c, box);

  let y = box.y;

  // 上一行
  if (prevRows.length) {
    ctx.save();
    ctx.font = `500 ${contextPx}px ${skin.fontFamily}`;
    ctx.fillStyle = skin.textSecondary;
    ctx.globalAlpha = 0.6;
    ctx.textAlign = opt.align;
    ctx.textBaseline = 'top';
    for (const row of prevRows) {
      ctx.fillText(ellipsize(ctx, row, opt.maxWidth * 0.88), opt.anchorX, y);
      y += contextLine;
    }
    ctx.restore();
    y += gap * 0.7;
  }

  // 当前行：有逐字数据时按字符高亮，否则整行高亮
  ctx.save();
  ctx.textBaseline = 'top';
  if (currentText) {
    ctx.font = `600 ${fontPx}px ${skin.fontFamily}`;
    if (skin.theme !== 'light') {
      ctx.shadowColor = withAlpha(skin.textActive === '#ffffff' ? '#ffffff' : skin.textActive, 0.25);
      ctx.shadowBlur = fontPx * 0.45;
    }
    const drawn = drawSungLine(
      ctx,
      currentText,
      c.lyric.sungChars,
      opt.anchorX,
      y,
      opt.maxWidth,
      lineHeight,
      opt.align,
      skin.textActive,
      skin.textPrimary
    );
    y += Math.max(rows, drawn) * lineHeight;
  } else {
    // 前奏：呼吸的 ♪ 占位
    const breathe = 0.3 + 0.25 * Math.sin(c.timeSec * 2.4);
    ctx.globalAlpha = breathe;
    ctx.font = `600 ${fontPx}px ${skin.fontFamily}`;
    ctx.fillStyle = skin.textPrimary;
    ctx.textAlign = opt.align;
    ctx.fillText('♪', opt.anchorX, y);
    y += lineHeight;
  }
  ctx.restore();

  // 翻译
  if (trRows.length) {
    y += Math.round(gap * 0.35);
    ctx.save();
    ctx.font = `400 ${trPx}px ${skin.fontFamily}`;
    ctx.fillStyle = skin.textSecondary;
    ctx.globalAlpha = 0.85;
    ctx.textAlign = opt.align;
    ctx.textBaseline = 'top';
    for (const row of trRows) {
      ctx.fillText(ellipsize(ctx, row, opt.maxWidth * 0.92), opt.anchorX, y);
      y += Math.round(trPx * 1.4);
    }
    ctx.restore();
  }

  // 下一行
  if (nextRows.length) {
    y += gap * 0.7;
    ctx.save();
    ctx.font = `500 ${contextPx}px ${skin.fontFamily}`;
    ctx.fillStyle = skin.textSecondary;
    ctx.globalAlpha = 0.42;
    ctx.textAlign = opt.align;
    ctx.textBaseline = 'top';
    for (const row of nextRows) {
      ctx.fillText(ellipsize(ctx, row, opt.maxWidth * 0.88), opt.anchorX, y);
      y += contextLine;
    }
    ctx.restore();
  }

  return box;
}

/** 底部进度条 + 时间轴 */
function drawBottomBar(c: VideoFrameContext): void {
  const m = metricsOf(c);
  const barY = c.height - m.pad * 1.5;
  const track =
    c.skin.theme === 'light' ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.18)';
  drawProgressBar(c, { x: m.pad, y: barY, width: c.width - m.pad * 2, height: 0 }, c.accent, track);

  const { ctx, skin } = c;
  const timePx = Math.max(10, Math.round(m.unit * 0.022));
  ctx.save();
  ctx.font = `500 ${timePx}px ${skin.fontFamily}`;
  ctx.fillStyle = skin.textSecondary;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.fillText(formatSegmentTime(c.timeSec), m.pad, barY - timePx * 0.6);
  ctx.textAlign = 'right';
  ctx.fillText(formatSegmentTime(c.totalSec), c.width - m.pad, barY - timePx * 0.6);
  ctx.restore();
}

// ==================== 骨架 ====================

/** stack：封面 + 歌名作者 + 居中歌词（default / stage / smoke / starChart / neon） */
function drawStackLayout(c: VideoFrameContext): void {
  const m = metricsOf(c);
  const hasCover = c.skin.showCover && !!c.song.cover;
  const bottomReserve = m.pad * 2.4;

  if (m.vertical) {
    if (hasCover) {
      let cursorY = c.height * 0.12;
      const size = Math.min(c.width * 0.46, c.height * 0.23);
      drawCoverWithShadow(c, (c.width - size) / 2, cursorY, size);
      cursorY += size + m.unit * 0.05;
      cursorY = drawTrackMeta(c, c.width / 2, cursorY, 'center', c.width - m.pad * 2);

      const lyricsTop = cursorY + m.unit * 0.035;
      const lyricsBottom = c.height - bottomReserve;
      drawLyricBlock(c, {
        anchorX: c.width / 2,
        centerY: (lyricsTop + lyricsBottom) / 2,
        maxWidth: c.width - m.pad * 2,
        fontPx: m.unit * 0.062,
        align: 'center'
      });
    } else {
      // 无封面：歌词居中，歌名紧随其上方，避免中部出现大片空档
      const box = drawLyricBlock(c, {
        anchorX: c.width / 2,
        centerY: c.height * 0.52,
        maxWidth: c.width - m.pad * 2,
        fontPx: m.unit * 0.062,
        align: 'center'
      });
      const metaHeight = m.unit * 0.05 * 1.3 + m.unit * 0.03 * 1.6;
      drawTrackMeta(
        c,
        c.width / 2,
        box.y - metaHeight - m.unit * 0.06,
        'center',
        c.width - m.pad * 2
      );
    }
  } else {
    // 横屏：左封面 + 右歌词
    const coverSize = Math.min(c.height * 0.46, c.width * 0.26);
    const coverX = m.pad * 1.3;
    const coverY = c.height * 0.5 - coverSize * 0.62;
    if (hasCover) {
      drawCoverWithShadow(c, coverX, coverY, coverSize);
      drawTrackMeta(
        c,
        coverX + coverSize / 2,
        coverY + coverSize + m.unit * 0.045,
        'center',
        coverSize * 1.5,
        0.8
      );
    } else {
      drawTrackMeta(c, m.pad, c.height * 0.1, 'left', c.width * 0.5, 0.9);
    }

    const lyricsX = hasCover ? coverX + coverSize + m.pad * 1.2 : m.pad;
    const lyricsW = c.width - lyricsX - m.pad;
    drawLyricBlock(c, {
      anchorX: lyricsX + lyricsW / 2,
      centerY: c.height * 0.47,
      maxWidth: lyricsW,
      fontPx: m.unit * 0.058,
      align: 'center'
    });
  }

  drawBottomBar(c);
  if (c.watermark) drawWatermark(c);
}

/** immersive：全屏氛围铺底 + 顶部小字信息 + 居中大字（rain / eerie） */
function drawImmersiveLayout(c: VideoFrameContext): void {
  const m = metricsOf(c);
  drawTrackMeta(c, c.width / 2, m.pad * 0.95, 'center', c.width - m.pad * 2, 0.7);

  drawLyricBlock(c, {
    anchorX: c.width / 2,
    centerY: c.height * 0.5,
    maxWidth: c.width - m.pad * 2.2,
    fontPx: m.unit * 0.074,
    align: 'center'
  });

  drawBottomBar(c);
  if (c.watermark) drawWatermark(c);
}

/** poster：亮底超大粗字，信息条缩到最小（frenzy） */
function drawPosterLayout(c: VideoFrameContext): void {
  const m = metricsOf(c);
  drawTrackMeta(c, m.pad, m.pad * 0.9, 'left', c.width - m.pad * 2, 0.66);

  drawLyricBlock(c, {
    anchorX: c.width / 2,
    centerY: c.height * 0.5,
    maxWidth: c.width - m.pad * 2,
    fontPx: m.unit * 0.1,
    align: 'center',
    // 大字风格最多两行，超出自动收缩
    maxRows: 2
  });

  drawBottomBar(c);
  if (c.watermark) drawWatermark(c);
}

/** terminal：等宽终端风格，顶部状态行 + 左对齐歌词（error） */
function drawTerminalLayout(c: VideoFrameContext): void {
  const m = metricsOf(c);
  const { ctx, skin } = c;
  const statusPx = Math.max(11, Math.round(m.unit * 0.026));

  // 顶部状态行
  ctx.save();
  ctx.font = `500 ${statusPx}px ${skin.fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = withAlpha(skin.accent, 0.85);
  const status = `> now_playing: ${c.song.title || 'unknown'} — ${c.song.artist || 'unknown'}`;
  ctx.fillText(ellipsize(ctx, status, c.width - m.pad * 2), m.pad, m.pad * 0.9);
  ctx.restore();

  // 歌词块（左对齐；衬底由 skin.drawLyricBackdrop 绘制）
  const lyricsAnchor = m.pad * 1.6;
  const lyricsWidth = c.width - lyricsAnchor - m.pad * 1.6;
  drawLyricBlock(c, {
    anchorX: lyricsAnchor,
    centerY: c.height * 0.48,
    maxWidth: lyricsWidth,
    fontPx: m.unit * 0.056,
    align: 'left'
  });

  drawBottomBar(c);
  if (c.watermark) drawWatermark(c);
}

/** 按皮肤声明的骨架渲染整帧内容层（背景与前景由引擎包在外层） */
export function renderFrameLayout(c: VideoFrameContext): void {
  switch (c.skin.layout) {
    case 'immersive':
      drawImmersiveLayout(c);
      break;
    case 'poster':
      drawPosterLayout(c);
      break;
    case 'terminal':
      drawTerminalLayout(c);
      break;
    case 'stack':
    default:
      drawStackLayout(c);
      break;
  }
}
