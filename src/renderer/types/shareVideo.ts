/**
 * 视频分享（效果展示视频导出）类型定义
 *
 * 与图片分享（`types/share.ts` 的海报链路）并列：图片分享走选歌词生成海报，
 * 视频分享把当前播放器样式在选定歌曲时间段内的效果直接渲染成视频文件，
 * 不依赖用户手动录屏。
 */

/** 导出比例 */
export type VideoAspectRatio = '16:9' | '9:16' | '3:4' | '4:3';

/** 导出清晰度档位（短边像素） */
export type VideoQualityTier = '720p' | '1080p';

/** 单个比例选项 */
export interface VideoAspectOption {
  key: VideoAspectRatio;
  label: string;
  /** 该比例的宽高比数值，供缩略预览矩形计算宽高 */
  ratio: number;
}

/** 比例可选列表：顺序即 UI 呈现顺序 */
export const VIDEO_ASPECT_OPTIONS: ReadonlyArray<VideoAspectOption> = [
  { key: '16:9', label: '16:9', ratio: 16 / 9 },
  { key: '9:16', label: '9:16', ratio: 9 / 16 },
  { key: '3:4', label: '3:4', ratio: 3 / 4 },
  { key: '4:3', label: '4:3', ratio: 4 / 3 }
];

/** 清晰度档位表：短边像素 */
export const VIDEO_QUALITY_TIERS: ReadonlyArray<{ key: VideoQualityTier; shortEdge: number }> = [
  { key: '720p', shortEdge: 720 },
  { key: '1080p', shortEdge: 1080 }
];

/** 编码帧率（固定，避免可变帧率带来的音画漂移） */
export const VIDEO_EXPORT_FPS = 30;

/** 选定的歌曲时间段（秒） */
export interface VideoSegment {
  /** 起始时间，单位秒 */
  startSec: number;
  /** 结束时间，单位秒 */
  endSec: number;
}

/** 导出配置 */
export interface VideoShareConfig {
  ratio: VideoAspectRatio;
  quality: VideoQualityTier;
  segment: VideoSegment;
  /** 是否叠加应用水印/深链二维码 */
  watermark: boolean;
}

/** 导出阶段 */
export type VideoExportStage =
  | 'idle'
  | 'preparing'
  | 'audio'
  | 'rendering'
  | 'finalizing'
  | 'done'
  | 'canceled'
  | 'error';

/** 导出进度 */
export interface VideoExportProgress {
  stage: VideoExportStage;
  /** 总体进度 0~1 */
  ratio: number;
  /** 已渲染帧数 */
  renderedFrames: number;
  /** 总帧数 */
  totalFrames: number;
  /** 面向用户的补充说明（可选） */
  message?: string;
}

/** 导出结果 */
export interface VideoExportResult {
  blob: Blob;
  /** 容器格式 */
  container: 'mp4' | 'webm';
  mimeType: string;
  /** 文件后缀，与容器一致 */
  extension: 'mp4' | 'webm';
  width: number;
  height: number;
  /** 实际时长（秒） */
  durationSec: number;
  /** 实际帧数 */
  frames: number;
}

/**
 * 由比例与清晰度档位换算出实际导出像素尺寸。
 * 短边取档位值，长边按比例取整到偶数（H.264 等编码器要求宽高为偶数）。
 */
export function resolveVideoSize(
  ratio: VideoAspectRatio,
  quality: VideoQualityTier
): { width: number; height: number } {
  const shortEdge = VIDEO_QUALITY_TIERS.find((t) => t.key === quality)?.shortEdge ?? 1080;
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

  switch (ratio) {
    case '9:16':
      return { width: even(shortEdge), height: even((shortEdge * 16) / 9) };
    case '3:4':
      return { width: even(shortEdge), height: even((shortEdge * 4) / 3) };
    case '4:3':
      return { width: even((shortEdge * 4) / 3), height: even(shortEdge) };
    case '16:9':
    default:
      return { width: even((shortEdge * 16) / 9), height: even(shortEdge) };
  }
}

/** 时间段最少时长（秒）：过短的片段没有展示意义 */
export const VIDEO_MIN_SEGMENT_SEC = 3;

/** 时间段最大时长（秒）：控制导出耗时与内存占用 */
export const VIDEO_MAX_SEGMENT_SEC = 60;

/** 把秒格式化为 m:ss */
export function formatSegmentTime(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
