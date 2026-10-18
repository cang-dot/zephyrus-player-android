/**
 * structureAnalyzer.worker.ts — Web Worker：离线歌曲结构分析（自动高潮定位）
 *
 * 协议（与 bpmAnalyzer.worker 同款）：
 *   主线程 → postMessage({ type: 'analyze', arrayBuffer }, [transfer])
 *   Worker → postMessage({ type: 'result', segments: {start,end}[], confidence })
 *          | postMessage({ type: 'error', error })
 *
 * 流程：OfflineAudioContext 解码重采样到 8kHz 单声道 →
 *       帧特征（RMS 能量 + 12 维色度，FFT）→ 棋盘核新颖度 →
 *       边界峰值挑选 → 段聚类定位副歌（无重复时能量兜底）。
 * 纯算法在 utils/audio/structureAnalysis.ts，可单测。
 */
import {
  computeFrameFeatures,
  computeNovelty,
  pickBoundaries,
  selectChorusSegments,
  type Segment
} from '../utils/audio/structureAnalysis';

const DOWNSAMPLE_RATE = 8000;

interface AnalyzeMessage {
  type: 'analyze';
  arrayBuffer: ArrayBuffer;
  /** 歌曲时长（秒），来自元数据；缺失时用解码结果 */
  duration?: number;
  /** 主线程 pending 匹配 id，原样回传 */
  __id?: number;
}

self.onmessage = async (e: MessageEvent<AnalyzeMessage>) => {
  const { type, arrayBuffer, duration, __id } = e.data;
  if (type !== 'analyze') return;

  try {
    const tempCtx = new OfflineAudioContext(1, 1, DOWNSAMPLE_RATE);
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    const pcm = audioBuffer.getChannelData(0);
    const songDuration = duration && duration > 1 ? duration : audioBuffer.duration;

    const features = computeFrameFeatures(pcm, DOWNSAMPLE_RATE, 1.0, 0.5);
    const novelty = computeNovelty(features, 4);
    const boundaries = pickBoundaries(novelty, features.hopSec, songDuration, 12);
    const { segments, confidence } = selectChorusSegments(features, boundaries, songDuration);

    const result: { type: 'result'; segments: Segment[]; confidence: number; __id?: number } = {
      type: 'result',
      segments,
      confidence,
      __id
    };
    (self as unknown as Worker).postMessage(result);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
      __id
    });
  }
};

export {};
