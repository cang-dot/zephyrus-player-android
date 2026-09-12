/**
 * 播放器样式视频导出引擎
 *
 * 把「当前播放器样式」在指定歌曲时间段内的效果离线逐帧渲染并编码成视频文件，
 * 全过程不依赖实时播放、不需要录屏。
 *
 * 渲染链路：
 *   Canvas 2D 逐帧绘制（皮肤 + 骨架）
 *     → mediabunny CanvasSource（WebCodecs VideoEncoder）
 *     → AudioBufferSource（WebCodecs AudioEncoder）
 *     → MP4(H.264/AAC) 或 WebM(VP9/VP8 + Opus)
 *
 * 硬约束 —— 逐帧确定性：所有绘制都是「时间」的纯函数，同一帧重复渲染像素一致。
 * 因此皮肤中不允许出现 Math.random()。
 */

import type { ILyricText } from '@/types/music';
import {
  resolveVideoSize,
  VIDEO_EXPORT_FPS,
  type VideoExportProgress,
  type VideoExportResult,
  type VideoShareConfig
} from '@/types/shareVideo';
import { buildSongDeepLink, generateQRCodeImage } from '@/utils/qrCodeUtil';

import { type AudioSourceRef,prepareSegmentAudio } from './videoAudio';
import { loadMuxer, resolveEncodePlan } from './videoCodecSupport';
import { buildTimeline, resolveLyricState } from './videoLyricTimeline';
import { resolveAccent } from './videoRenderers/common';
import { renderFrameLayout } from './videoRenderers/layout';
import { getSkin } from './videoRenderers/skins';
import type { VideoFrameContext } from './videoRenderers/types';

/** 导出输入 */
export interface StyleVideoExportInput {
  /** 播放器样式 key（9 种之一） */
  styleKey: string;
  config: VideoShareConfig;
  song: {
    id: string | number;
    title: string;
    artist: string;
    coverUrl: string;
  };
  /** 歌词原始结构（startTime / duration 单位为毫秒） */
  lyrics: ILyricText[];
  /** 音频来源；为 null 时导出无声视频 */
  audioSource: AudioSourceRef | null;
  onProgress?: (progress: VideoExportProgress) => void;
  signal?: AbortSignal;
}

/** 封面缺失时的主色兜底 */
const DEFAULT_DOMINANT = { r: 90, g: 96, b: 112 };

/** 二维码在视频中的像素边长系数（相对画面高度） */
const QR_SIZE_RATIO = 0.11;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('导出已取消', 'AbortError');
}

/**
 * 加载封面（必须带 crossOrigin）。
 * 不带 CORS 加载的图片会污染画布，导致 WebCodecs 读取画面时抛安全错误；
 * CDN 不支持跨域时返回 null，由皮肤退化为无封面 / 纯色背景渲染，导出仍可完成。
 */
function loadCoverForExport(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

// ==================== 数据准备 ====================

/** 从封面提取主色（24×24 采样平均），失败回退中性色 */
function dominantColorOf(image: HTMLImageElement | null): { r: number; g: number; b: number } {
  if (!image || typeof document === 'undefined') return DEFAULT_DOMINANT;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext('2d');
    if (!ctx) return DEFAULT_DOMINANT;
    ctx.drawImage(image, 0, 0, 24, 24);
    const { data } = ctx.getImageData(0, 0, 24, 24);
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    if (!count) return DEFAULT_DOMINANT;
    return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
  } catch {
    // getImageData 在污染画布上会抛错，退化为中性色即可
    return DEFAULT_DOMINANT;
  }
}

/** 离线音频包络：逐帧响度 + 强拍标记，用于节拍驱动动效 */
interface Envelope {
  levels: Float32Array;
  beats: Uint8Array;
}

function analyzeEnvelope(buffer: AudioBuffer, totalFrames: number): Envelope {
  const levels = new Float32Array(totalFrames);
  const beats = new Uint8Array(totalFrames);
  const data = buffer.getChannelData(0);
  const windowSize = Math.max(1, Math.floor(buffer.length / Math.max(1, totalFrames)));

  for (let i = 0; i < totalFrames; i++) {
    const start = i * windowSize;
    const end = Math.min(data.length, start + windowSize);
    let sum = 0;
    for (let j = start; j < end; j++) sum += data[j] * data[j];
    levels[i] = Math.sqrt(sum / Math.max(1, end - start));
  }

  // 用 P95 归一化，避免个别爆音把整体压暗
  const sorted = Float32Array.from(levels).sort();
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || 1;
  const scale = Math.max(1e-4, p95);
  for (let i = 0; i < totalFrames; i++) levels[i] = Math.min(1, levels[i] / scale);

  // 强拍：相对邻域均值显著突增
  const half = Math.max(2, Math.round(VIDEO_EXPORT_FPS * 0.35));
  for (let i = 0; i < totalFrames; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(totalFrames - 1, i + half); j++) {
      sum += levels[j];
      count++;
    }
    const avg = sum / Math.max(1, count);
    beats[i] = levels[i] > 0.3 && levels[i] > avg * 1.32 ? 1 : 0;
  }

  return { levels, beats };
}

/** 无音轨时的合成节拍：让动效不至于完全静止（确定性正弦） */
function syntheticEnvelope(totalFrames: number): Envelope {
  const levels = new Float32Array(totalFrames);
  const beats = new Uint8Array(totalFrames);
  const period = VIDEO_EXPORT_FPS * 0.5;
  for (let i = 0; i < totalFrames; i++) {
    const phase = (i % period) / period;
    levels[i] = 0.32 + 0.22 * Math.sin(phase * Math.PI * 2);
    beats[i] = phase < 0.08 ? 1 : 0;
  }
  return { levels, beats };
}

// ==================== 主流程 ====================

/**
 * 导出「当前播放器样式」的效果展示视频。
 *
 * @throws 当环境不支持 WebCodecs 编码，或指定清晰度无可用编码方案时抛出
 */
export async function exportStyleVideo(input: StyleVideoExportInput): Promise<VideoExportResult> {
  const { config, song, lyrics, audioSource, onProgress, signal } = input;
  const skin = getSkin(input.styleKey);

  const report = (
    stage: VideoExportProgress['stage'],
    ratio: number,
    renderedFrames: number,
    totalFrames: number,
    message?: string
  ) => {
    onProgress?.({ stage, ratio, renderedFrames, totalFrames, message });
  };

  report('preparing', 0.01, 0, 0);

  const { width, height } = resolveVideoSize(config.ratio, config.quality);
  const fps = VIDEO_EXPORT_FPS;
  const durationSec = Math.max(0.5, config.segment.endSec - config.segment.startSec);
  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  const frameDuration = 1 / fps;

  // 1) 编码方案
  const plan = await resolveEncodePlan(width, height);
  if (!plan) {
    throw new Error('当前设备不支持所选清晰度的视频编码，请改用 720p 或更换设备');
  }
  throwIfAborted(signal);

  // mediabunny 按需加载：只有真正导出时才拉取编码器实现，避免计入首屏主包
  const {
    AudioBufferSource,
    BufferTarget,
    CanvasSource,
    Mp4OutputFormat,
    Output,
    Quality,
    WebMOutputFormat
  } = await loadMuxer();
  const exportQuality = new Quality('high');

  // 2) 素材：封面 + 二维码
  const cover = await loadCoverForExport(song.coverUrl);
  throwIfAborted(signal);

  let qrImage: HTMLImageElement | null = null;
  if (config.watermark) {
    const qrSize = Math.round(height * QR_SIZE_RATIO);
    const dataUrl = await generateQRCodeImage(buildSongDeepLink(song.id), qrSize).catch(() => null);
    if (dataUrl) {
      const img = new Image();
      img.src = typeof dataUrl === 'string' ? dataUrl : String(dataUrl);
      await img.decode().catch(() => undefined);
      qrImage = img;
    }
  }

  const dominant = dominantColorOf(cover);
  const timeline = buildTimeline(lyrics);

  // 3) 音频（失败则降级为无声视频）
  report('audio', 0.06, 0, totalFrames);
  let audioBuffer: AudioBuffer | null = null;
  if (audioSource) {
    const prepared = await prepareSegmentAudio(audioSource, config.segment);
    audioBuffer = prepared?.buffer ?? null;
  }
  throwIfAborted(signal);

  // 4) 画布与输出
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');

  const output = new Output({
    format: plan.container === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target: new BufferTarget()
  });

  const videoSource = new CanvasSource(canvas, {
    codec: plan.videoCodec,
    quality: exportQuality
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  const audioSourceEncoder = audioBuffer
    ? new AudioBufferSource({ codec: plan.audioCodec, quality: exportQuality })
    : null;
  if (audioSourceEncoder) output.addAudioTrack(audioSourceEncoder);

  await output.start();

  const envelope = audioBuffer
    ? analyzeEnvelope(audioBuffer, totalFrames)
    : syntheticEnvelope(totalFrames);

  try {
    // 5) 逐帧渲染
    const accent = resolveAccent(skin, cover ? dominant : null);
    for (let frame = 0; frame < totalFrames; frame++) {
      throwIfAborted(signal);

      const timeSec = frame * frameDuration;
      const songTimeSec = config.segment.startSec + timeSec;

      // 每帧重置绘制状态，避免上一帧的 filter / alpha 泄漏
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      ctx.fillStyle = skin.background;
      ctx.fillRect(0, 0, width, height);

      const frameContext: VideoFrameContext = {
        ctx,
        width,
        height,
        timeSec,
        progress: totalFrames <= 1 ? 1 : frame / (totalFrames - 1),
        totalSec: durationSec,
        songTimeSec,
        level: envelope.levels[frame] ?? 0,
        beat: envelope.beats[frame] === 1,
        song: {
          title: song.title,
          artist: song.artist,
          cover,
          dominant: cover ? dominant : null
        },
        lyric: resolveLyricState(timeline, songTimeSec),
        skin,
        accent,
        watermark: config.watermark,
        qrImage
      };

      skin.drawBackground?.(frameContext);
      skin.drawAtmosphere?.(frameContext);
      renderFrameLayout(frameContext);
      skin.drawForeground?.(frameContext);

      await videoSource.add(timeSec, frameDuration);

      if (frame % 5 === 0 || frame === totalFrames - 1) {
        const ratio = 0.1 + 0.85 * ((frame + 1) / totalFrames);
        report('rendering', ratio, frame + 1, totalFrames);
        // 让出主线程，保证进度条与取消按钮可响应
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    videoSource.close();

    // 6) 音频一次性写入（AudioBufferSource 顺序拼接）
    if (audioBuffer && audioSourceEncoder) {
      report('finalizing', 0.96, totalFrames, totalFrames);
      await audioSourceEncoder.add(audioBuffer);
      audioSourceEncoder.close();
    }

    report('finalizing', 0.98, totalFrames, totalFrames);
    await output.finalize();

    const buffer = output.target.buffer;
    if (!buffer) throw new Error('视频封装失败：输出缓冲区为空');

    const mimeType = plan.container === 'mp4' ? 'video/mp4' : 'video/webm';
    report('done', 1, totalFrames, totalFrames);

    return {
      blob: new Blob([buffer], { type: mimeType }),
      container: plan.container,
      mimeType,
      extension: plan.extension,
      width,
      height,
      durationSec,
      frames: totalFrames
    };
  } catch (error) {
    // 任何失败都尝试取消输出，避免编码器资源悬挂
    try {
      await output.cancel();
    } catch {
      // 输出已结束或未启动时取消会抛错，忽略即可
    }
    throw error;
  }
}
