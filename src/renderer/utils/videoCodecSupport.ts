/**
 * 视频导出编码能力探测
 *
 * 导出链优先 WebCodecs（mediabunny 内部封装 VideoEncoder/AudioEncoder 与封装容器），
 * 按「MP4 + H.264/AAC → WebM + VP9/Opus → WebM + VP8/Opus」的顺序挑选第一组可用组合。
 * 全部不可用时返回 null，由 UI 明确告知用户当前环境不支持，而不是静默产出损坏文件。
 *
 * mediabunny 走按需加载：视频导出是低频功能，不应把编码器实现打进首屏主包。
 */

import type { AudioCodec, VideoCodec } from 'mediabunny';

/** mediabunny 模块类型（纯类型引用，不产生运行时导入） */
type MediabunnyModule = typeof import('mediabunny');

let muxerModule: Promise<MediabunnyModule> | null = null;

/** 按需加载并缓存 mediabunny；videoEngine 复用同一 Promise，避免重复加载 */
export function loadMuxer(): Promise<MediabunnyModule> {
  muxerModule ??= import('mediabunny');
  return muxerModule;
}

/** 一组可用的编码方案 */
export interface VideoEncodePlan {
  /** 封装容器 */
  container: 'mp4' | 'webm';
  /** 文件后缀 */
  extension: 'mp4' | 'webm';
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  /** 是否由软件编码兜底（VP8 在部分设备上回退软编，导出会明显变慢） */
  softFallback: boolean;
}

/** 候选优先级：越靠前越优先 */
const CANDIDATES: ReadonlyArray<VideoEncodePlan> = [
  { container: 'mp4', extension: 'mp4', videoCodec: 'avc', audioCodec: 'aac', softFallback: false },
  { container: 'webm', extension: 'webm', videoCodec: 'vp9', audioCodec: 'opus', softFallback: false },
  { container: 'webm', extension: 'webm', videoCodec: 'vp8', audioCodec: 'opus', softFallback: true }
];

/**
 * 当前环境是否具备视频导出的最低前提（WebCodecs 编码器 + Web Audio）。
 * 只做能力判断，不加载 mediabunny；具体编码器可用性交给 {@link resolveEncodePlan}。
 */
export function isVideoExportSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { VideoEncoder?: unknown; AudioEncoder?: unknown };
  return typeof w.VideoEncoder === 'function' && typeof w.AudioEncoder === 'function';
}

/** 探测缓存：同一尺寸不重复探测（探测本身会创建编码器，开销不低） */
const planCache = new Map<string, VideoEncodePlan | null>();

/**
 * 按优先级挑出当前设备可用的编码方案。
 *
 * @param width 导出宽度（像素）
 * @param height 导出高度（像素）
 * @param numberOfChannels 音频声道数
 * @param sampleRate 音频采样率
 * @returns 可用方案；全部不可用返回 null
 */
export async function resolveEncodePlan(
  width: number,
  height: number,
  numberOfChannels = 2,
  sampleRate = 48000
): Promise<VideoEncodePlan | null> {
  const cacheKey = `${width}x${height}@${numberOfChannels}/${sampleRate}`;
  const cached = planCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let resolved: VideoEncodePlan | null = null;

  try {
    const { canEncodeAudio, canEncodeVideo, Quality } = await loadMuxer();
    // 统一走 high：细节由分辨率决定
    const quality = new Quality('high');

    for (const candidate of CANDIDATES) {
      try {
        const videoOk = await canEncodeVideo(candidate.videoCodec, { width, height, quality });
        if (!videoOk) continue;

        const audioOk = await canEncodeAudio(candidate.audioCodec, {
          numberOfChannels,
          sampleRate,
          quality
        });
        if (!audioOk) continue;

        resolved = { ...candidate };
        break;
      } catch {
        // 单个候选探测异常不影响后续候选
        continue;
      }
    }
  } catch {
    // mediabunny 加载失败（老旧 WebView）等同于当前无可用编码方案
    resolved = null;
  }

  planCache.set(cacheKey, resolved);
  return resolved;
}

/** 清空探测缓存（设置页切换清晰度后可主动调用，一般无需手动触发） */
export function clearEncodePlanCache(): void {
  planCache.clear();
}
