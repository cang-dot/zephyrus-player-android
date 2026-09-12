/**
 * 视频分享 Composable
 *
 * 负责「配置 → 离线导出 → 保存/分享」全流程：
 * 自动带入当前播放的歌曲、歌词、播放位置与播放器样式，
 * 用户只需选择比例、时间段与清晰度。
 */

import { computed, ref, shallowRef, watch } from 'vue';

import { allTime, lrcArray, nowTime } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import {
  VIDEO_MAX_SEGMENT_SEC,
  VIDEO_MIN_SEGMENT_SEC,
  type VideoExportProgress,
  type VideoExportResult,
  type VideoShareConfig
} from '@/types/shareVideo';
import { getImgUrl } from '@/utils';
import { saveVideoToGallery, shareVideoFile } from '@/utils/shareUtil';
import type { AudioSourceRef } from '@/utils/videoAudio';
import { isVideoExportSupported } from '@/utils/videoCodecSupport';
import { exportStyleVideo } from '@/utils/videoEngine';

/** 默认导出时长（秒） */
const DEFAULT_DURATION_SEC = 15;

/** 时间段快捷预设 */
export type SegmentPreset = 'current' | 'head' | 'climax';

export function useVideoShare(resolveStyleKey: () => string) {
  const playerStore = usePlayerStore();

  /** 从本地配置读取视频分享默认偏好（设置页「分享设置」写入） */
  function readShareVideoDefaults(): {
    ratio?: VideoShareConfig['ratio'];
    quality?: VideoShareConfig['quality'];
    watermark?: boolean;
  } {
    try {
      const saved = localStorage.getItem('music-full-config');
      if (!saved) return {};
      const parsed = JSON.parse(saved) as Record<string, unknown>;
      const ratio = parsed.shareDefaultVideoRatio;
      const quality = parsed.shareDefaultVideoQuality;
      return {
        ratio:
          ratio === '16:9' || ratio === '9:16' || ratio === '3:4' || ratio === '4:3'
            ? ratio
            : undefined,
        quality: quality === '720p' || quality === '1080p' ? quality : undefined,
        watermark:
          typeof parsed.shareDefaultVideoWatermark === 'boolean'
            ? parsed.shareDefaultVideoWatermark
            : undefined
      };
    } catch {
      // 配置损坏时静默回退到内置默认
      return {};
    }
  }

  const defaults = readShareVideoDefaults();

  const config = ref<VideoShareConfig>({
    ratio: defaults.ratio ?? '9:16',
    quality: defaults.quality ?? '1080p',
    segment: { startSec: 0, endSec: DEFAULT_DURATION_SEC },
    watermark: defaults.watermark ?? true
  });

  /** 把当前比例/清晰度/水印写回本地配置，作为下次打开的默认偏好 */
  function persistShareVideoDefaults() {
    try {
      const latest = JSON.parse(localStorage.getItem('music-full-config') || '{}') as Record<
        string,
        unknown
      >;
      localStorage.setItem(
        'music-full-config',
        JSON.stringify({
          ...latest,
          shareDefaultVideoRatio: config.value.ratio,
          shareDefaultVideoQuality: config.value.quality,
          shareDefaultVideoWatermark: config.value.watermark
        })
      );
      window.dispatchEvent(new CustomEvent('music-full-config-updated'));
    } catch {
      // 存储不可用时仅影响下次默认值，不中断导出流程
    }
  }

  // 面板内调整比例/清晰度/水印时写回持久化
  watch(
    () => [config.value.ratio, config.value.quality, config.value.watermark] as const,
    () => persistShareVideoDefaults()
  );

  const exporting = ref(false);
  const progress = shallowRef<VideoExportProgress | null>(null);
  const result = shallowRef<VideoExportResult | null>(null);
  const errorMessage = ref('');

  let controller: AbortController | null = null;

  /** 环境是否具备 WebCodecs 编码能力 */
  const supported = computed(() => isVideoExportSupported());

  /** 歌曲总时长（秒）；未知时为 0 */
  const songDuration = computed(() => Math.max(0, allTime.value || 0));

  /** 当前播放位置（秒） */
  const playbackPosition = computed(() => Math.max(0, nowTime.value || 0));

  /** 片段时长（秒） */
  const segmentDurationSec = computed(() =>
    Math.max(0, config.value.segment.endSec - config.value.segment.startSec)
  );

  /** 是否存在可导出的歌词 */
  const hasLyrics = computed(() => lrcArray.value.length > 0);

  const canExport = computed(
    () =>
      supported.value &&
      !exporting.value &&
      segmentDurationSec.value >= VIDEO_MIN_SEGMENT_SEC &&
      !!playerStore.currentSong
  );

  /** 作者文本 */
  const artistText = computed(() => {
    const song = playerStore.currentSong;
    const list = (song?.ar || song?.artists || []) as Array<{ name?: string }>;
    const names = list.map((a) => a.name).filter((n): n is string => !!n);
    return names.length ? names.join(' / ') : '未知艺术家';
  });

  // ==================== 辅助 ====================

  function coverUrlOf(song: SongResult): string {
    const pic = song.picUrl || song.al?.picUrl || '';
    return pic ? getImgUrl(pic, '500y500') : '';
  }

  /**
   * 解析音频来源。
   * 播放地址统一走 fetch 拉取——远端 CDN 允许跨域时可直接使用；
   * 拉取失败会被上层降级为无声视频，不会中断导出。
   */
  function resolveAudioSource(song: SongResult): AudioSourceRef | null {
    const url = song.playMusicUrl || song.externalUrl || '';
    return url ? { kind: 'remote', url } : null;
  }

  /** 把时间段夹到歌曲范围内，并保证不短于最小时长 */
  function clampSegment(startSec: number, endSec: number): { startSec: number; endSec: number } {
    const total = songDuration.value;
    const hardEnd = total > 0 ? total : Number.MAX_SAFE_INTEGER;
    let start = Math.max(0, Math.min(startSec, hardEnd - VIDEO_MIN_SEGMENT_SEC));
    if (start < 0) start = 0;
    const maxEnd = Math.min(hardEnd, start + VIDEO_MAX_SEGMENT_SEC);
    let end = Math.max(start + VIDEO_MIN_SEGMENT_SEC, Math.min(endSec, maxEnd));
    if (total > 0) end = Math.min(end, total);
    if (end - start < VIDEO_MIN_SEGMENT_SEC) end = Math.min(hardEnd, start + VIDEO_MIN_SEGMENT_SEC);
    return { startSec: start, endSec: end };
  }

  // ==================== 时间段 ====================

  /** 打开面板时按歌曲时长重置时间段 */
  function resetSegment(preset: SegmentPreset = 'current') {
    const total = songDuration.value;
    if (preset === 'climax') {
      const climax = playerStore.currentSong?.climaxSegments?.[0];
      if (climax) {
        config.value.segment = clampSegment(climax.start, climax.start + DEFAULT_DURATION_SEC);
        return;
      }
      // 无高潮数据时退化为从头开始
      config.value.segment = clampSegment(0, DEFAULT_DURATION_SEC);
      return;
    }
    const start = preset === 'head' ? 0 : Math.min(playbackPosition.value, Math.max(0, total - 1));
    config.value.segment = clampSegment(start, start + DEFAULT_DURATION_SEC);
  }

  function setSegmentStart(startSec: number) {
    config.value.segment = clampSegment(
      startSec,
      startSec + Math.max(VIDEO_MIN_SEGMENT_SEC, segmentDurationSec.value)
    );
  }

  function setSegmentEnd(endSec: number) {
    config.value.segment = { startSec: config.value.segment.startSec, endSec };
    config.value.segment = clampSegment(config.value.segment.startSec, endSec);
  }

  function setSegmentDuration(durationSec: number) {
    config.value.segment = clampSegment(
      config.value.segment.startSec,
      config.value.segment.startSec + durationSec
    );
  }

  // ==================== 导出 ====================

  async function start() {
    const song = playerStore.currentSong;
    if (!canExport.value || !song) return;

    errorMessage.value = '';
    result.value = null;
    exporting.value = true;
    progress.value = { stage: 'preparing', ratio: 0, renderedFrames: 0, totalFrames: 0 };

    // 导出为离线渲染，暂停实时播放以免争抢编解码与音频资源
    try {
      playerStore.setPlayMusic(false);
    } catch {
      // 暂停失败不影响导出
    }

    controller = new AbortController();
    try {
      const output = await exportStyleVideo({
        styleKey: resolveStyleKey(),
        config: config.value,
        song: {
          id: song.id,
          title: song.name || '未知歌曲',
          artist: artistText.value,
          coverUrl: coverUrlOf(song)
        },
        lyrics: lrcArray.value,
        audioSource: resolveAudioSource(song),
        onProgress: (p) => {
          progress.value = p;
        },
        signal: controller.signal
      });
      result.value = output;
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      errorMessage.value = aborted ? '' : e instanceof Error ? e.message : '导出失败，请重试';
      progress.value = {
        stage: aborted ? 'canceled' : 'error',
        ratio: 0,
        renderedFrames: 0,
        totalFrames: 0,
        message: errorMessage.value
      };
    } finally {
      exporting.value = false;
      controller = null;
    }
  }

  function cancel() {
    controller?.abort();
  }

  /** 重置导出结果（重新配置时调用） */
  function clearResult() {
    result.value = null;
    errorMessage.value = '';
    progress.value = null;
  }

  // ==================== 保存 / 分享 ====================

  async function save(): Promise<boolean> {
    if (!result.value) return false;
    return saveVideoToGallery(result.value.blob, result.value.extension);
  }

  async function share(): Promise<boolean> {
    if (!result.value) return false;
    return shareVideoFile(result.value.blob, result.value.extension, result.value.mimeType);
  }

  return {
    // 状态
    config,
    exporting,
    progress,
    result,
    errorMessage,
    // 派生
    supported,
    songDuration,
    playbackPosition,
    segmentDurationSec,
    hasLyrics,
    canExport,
    artistText,
    // 操作
    resetSegment,
    setSegmentStart,
    setSegmentEnd,
    setSegmentDuration,
    start,
    cancel,
    clearResult,
    save,
    share
  };
}
