/**
 * trackFeatureService — 智能接法的特征预取与实时监测（folia automix 移植）
 *
 * 两路证据：
 *   1. 下一首首段特征（intro）：Range 请求头部 ~400KB → decodeToMono8k →
 *      analyzeIntro。MP3/ADTS 帧流可独立解码；MP4 容器若 moov 在尾则解码
 *      失败 → 缓存 null（chooser 判无证据走 plainBlend，与 folia 哲学一致）。
 *   2. 当前曲尾段特征（outro）：当前曲的尾部字节无法独立解码，改为播放中
 *      实时记录输出 RMS（audioService.getOutputRms），触发前用最近窗口回归。
 *      iOS 直通等无分析图路径拿不到 RMS → null 兜底。
 *
 * 缓存按 songId 只增不减（单会话内特征极小，无淘汰必要）。
 */

import { upgradeToHttps } from '@/services/audioAnalysisGate';
import { audioService } from '@/services/audioService';
import { decodeToMono8k } from '@/utils/audio/decodeToMono8k';
import {
  analyzeIntro,
  type IntroFeatures,
  type OutroFeatures,
  outroFeaturesFromHistory} from '@/utils/audio/trackFeatures';

/** intro 预取字节量：≈25s @128kbps，覆盖前导静音 + 开场能量判定窗 */
const INTRO_RANGE_BYTES = 409600;
/** outro 实时监测采样间隔（秒） */
const OUTRO_SAMPLE_INTERVAL_SEC = 1;
/** outro 历史保留窗（秒） */
const OUTRO_HISTORY_SEC = 30;

export class TrackFeatureService {
  private introCache = new Map<string | number, IntroFeatures | null>();
  private introInflight = new Map<string | number, Promise<void>>();
  private outroHistoryDb: number[] = [];
  private outroTimer: number | null = null;
  private outroTrackId: string | number | null = null;

  /** 预取下一首首段特征；失败缓存 null，不抛出（特征是尽力而为的旁路） */
  public async prefetchIntroFeatures(songId: string | number, url: string | undefined): Promise<void> {
    if (!songId || this.introCache.has(songId)) return;
    const inflight = this.introInflight.get(songId);
    if (inflight) return inflight;

    const task = (async (): Promise<void> => {
      try {
        if (!url) {
          this.introCache.set(songId, null);
          return;
        }
        const response = await fetch(upgradeToHttps(url), {
          headers: { Range: `bytes=0-${INTRO_RANGE_BYTES - 1}` },
          signal: AbortSignal.timeout?.(8000)
        });
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength < 8192) throw new Error('intro range too small');
        const pcm = await decodeToMono8k(buffer);
        // decodeAudioData 会解整个 buffer；分析只用开头 10s
        const analysisWindow = Math.min(pcm.length, 10 * 8000);
        this.introCache.set(songId, analyzeIntro(pcm.subarray(0, analysisWindow) as Float32Array, 8000));
      } catch {
        // Range 不支持/容器不可独立解码/网络失败：无证据
        this.introCache.set(songId, null);
      } finally {
        this.introInflight.delete(songId);
      }
    })();
    this.introInflight.set(songId, task);
    return task;
  }

  public getIntroFeatures(songId: string | number | null | undefined): IntroFeatures | null {
    if (songId === null || songId === undefined) return null;
    return this.introCache.get(songId) ?? null;
  }

  /** 开始记录当前曲输出电平（smartMix 准备阶段调用）；换歌自动重置 */
  public startOutroMonitor(trackId: string | number): void {
    if (this.outroTimer !== null && this.outroTrackId === trackId) return;
    this.stopOutroMonitor();
    this.outroTrackId = trackId;
    this.outroHistoryDb = [];
    this.outroTimer = window.setInterval(() => {
      const rms = audioService.getOutputRms();
      if (rms === null) return; // 无分析图路径：历史保持空，getOutroFeatures 返回 null
      this.outroHistoryDb.push(20 * Math.log10(Math.max(rms, 1e-6)));
      const maxLen = Math.round(OUTRO_HISTORY_SEC / OUTRO_SAMPLE_INTERVAL_SEC);
      if (this.outroHistoryDb.length > maxLen) {
        this.outroHistoryDb.splice(0, this.outroHistoryDb.length - maxLen);
      }
    }, OUTRO_SAMPLE_INTERVAL_SEC * 1000);
  }

  public stopOutroMonitor(): void {
    if (this.outroTimer !== null) window.clearInterval(this.outroTimer);
    this.outroTimer = null;
  }

  /** 当前曲尾段特征；历史不足或无分析图时返回 null */
  public getOutroFeatures(): OutroFeatures | null {
    if (this.outroHistoryDb.length === 0) return null;
    return outroFeaturesFromHistory(this.outroHistoryDb, OUTRO_SAMPLE_INTERVAL_SEC);
  }

  /** 当前曲已监测时长（秒），设置页/日志诊断用 */
  public getOutroMonitorAgeSec(): number {
    return this.outroHistoryDb.length * OUTRO_SAMPLE_INTERVAL_SEC;
  }

  /** 切歌后清理 outro 历史（intro 缓存保留，跨会话可复用） */
  public resetOutro(): void {
    this.outroHistoryDb = [];
  }
}

export const trackFeatureService = new TrackFeatureService();
