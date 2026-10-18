/**
 * structureAnalyzer.worker.ts — Web Worker：歌曲结构分析（自动高潮定位）
 *
 * 协议（与 bpmAnalyzer.worker 同款，但解码在主线程——Chromium 的 Worker
 * 作用域没有 OfflineAudioContext，decodeAudioData 必须在主线程完成）：
 *   主线程 → postMessage({ type: 'analyze', pcm: Float32Array(8kHz 单声道), duration, __id }, [pcm.buffer])
 *   Worker → postMessage({ type: 'result', segments, confidence, __id })
 *          | postMessage({ type: 'error', error, __id })
 * 纯算法在 utils/audio/structureAnalysis.ts，可单测。
 */
import {
  computeFrameFeatures,
  selectChorusSegments,
  type Segment
} from '../utils/audio/structureAnalysis';

interface AnalyzeMessage {
  type: 'analyze';
  /** 8kHz 单声道 PCM（主线程解码重采样后 transfer 过来） */
  pcm: Float32Array;
  /** 歌曲时长（秒） */
  duration?: number;
  /** 主线程 pending 匹配 id，原样回传 */
  __id?: number;
}

self.onmessage = (e: MessageEvent<AnalyzeMessage>) => {
  const { type, pcm, duration, __id } = e.data;
  if (type !== 'analyze') return;

  try {
    const songDuration = duration && duration > 1 ? duration : (pcm.length / 8000);
    const features = computeFrameFeatures(pcm, 8000, 1.0, 0.5);
    const { segments, confidence } = selectChorusSegments(features, songDuration);

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
