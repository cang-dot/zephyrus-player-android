/**
 * 视频导出的音频准备
 *
 * 目标：把「选定歌曲时间段」的音频离线解码成一段 {48kHz, 与画面同长} 的 AudioBuffer，
 * 供 mediabunny 的 AudioBufferSource 顺序编码，全程不依赖实时播放，因此不需要录屏。
 */

import type { VideoSegment } from '@/types/shareVideo';

/** 导出音频统一采样率：与常见 AAC/Opus 编码器兼容性最好 */
export const EXPORT_AUDIO_SAMPLE_RATE = 48000;

/** 音频来源引用 */
export type AudioSourceRef =
  | { kind: 'local'; file: File }
  | { kind: 'remote'; url: string };

/** 准备好的区间音频 */
export interface PreparedSegmentAudio {
  buffer: AudioBuffer;
  sampleRate: number;
  numberOfChannels: number;
  /** 实际时长（秒），可能因原始音频长度而短于请求区间 */
  durationSec: number;
}

/** 拉取原始音频字节 */
async function fetchAudioBytes(source: AudioSourceRef): Promise<ArrayBuffer | null> {
  try {
    if (source.kind === 'local') {
      return await source.file.arrayBuffer();
    }
    const response = await fetch(source.url, { credentials: 'omit' });
    if (!response.ok) {
      console.warn('[VideoAudio] 音频拉取失败:', response.status, source.url);
      return null;
    }
    return await response.arrayBuffer();
  } catch (e) {
    console.warn('[VideoAudio] 音频拉取异常:', e);
    return null;
  }
}

/**
 * 解码并截取指定区间的音频。
 *
 * 注意：压缩音频无法按字节区间随机截取，因此这里先整体解码再做区间渲染。
 * 这是纯粹的离线处理，耗时由歌曲长度决定，但不会产生实时播放/录屏行为。
 *
 * @returns 区间音频；解码或切片失败时返回 null（调用方应据此导出无音轨视频）
 */
export async function prepareSegmentAudio(
  source: AudioSourceRef,
  segment: VideoSegment,
  targetSampleRate: number = EXPORT_AUDIO_SAMPLE_RATE
): Promise<PreparedSegmentAudio | null> {
  const bytes = await fetchAudioBytes(source);
  if (!bytes || bytes.byteLength === 0) return null;

  // 用最小的 OfflineAudioContext 承载 decodeAudioData
  const decodeContext = new OfflineAudioContext(2, 2, targetSampleRate);

  let decoded: AudioBuffer;
  try {
    decoded = await decodeContext.decodeAudioData(bytes);
  } catch (e) {
    console.warn('[VideoAudio] 音频解码失败:', e);
    return null;
  }

  const totalDuration = decoded.duration;
  const start = Math.max(0, Math.min(segment.startSec, totalDuration));
  const end = Math.max(start, Math.min(segment.endSec, totalDuration));
  const duration = end - start;
  if (duration <= 0) {
    console.warn('[VideoAudio] 区间为空，跳过音轨');
    return null;
  }

  const frames = Math.max(1, Math.ceil(duration * targetSampleRate));
  const renderContext = new OfflineAudioContext(decoded.numberOfChannels, frames, targetSampleRate);
  const sourceNode = renderContext.createBufferSource();
  sourceNode.buffer = decoded;
  sourceNode.connect(renderContext.destination);
  // offset/duration 由 AudioBufferSourceNode 原生支持，等价于精确切片
  sourceNode.start(0, start, duration);

  const rendered = await renderContext.startRendering();

  return {
    buffer: rendered,
    sampleRate: rendered.sampleRate,
    numberOfChannels: rendered.numberOfChannels,
    durationSec: rendered.duration
  };
}
