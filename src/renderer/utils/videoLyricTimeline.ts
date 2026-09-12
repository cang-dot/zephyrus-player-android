/**
 * 歌词时间轴解析
 *
 * 负责两件事：
 * 1. 把播放器的毫秒制歌词结构（ILyricText，startTime/duration 为毫秒）转换成
 *    视频引擎使用的秒制时间轴；
 * 2. 解析任意歌曲时刻对应的歌词状态（当前行、上下文行、行进度、已唱字符数）。
 *
 * 独立成模块的原因：它是「时间 → 画面」的唯一映射，需要能被离线测试直接复用，
 * 从而保证「抽帧验证」检验的就是线上同一套逻辑。
 */

import type { ILyricText } from '@/types/music';

import type { VideoFrameLyric, VideoLyricLine, VideoWord } from './videoRenderers/types';

/** 当歌词行缺少 duration 时，末行的兜底时长（秒） */
const LAST_LINE_FALLBACK_SEC = 4;
/** 单行最短时长（秒），避免零长度导致除零 */
const MIN_LINE_SEC = 0.8;

/** 毫秒制歌词 → 秒制时间轴 */
export function buildTimeline(lyrics: ILyricText[]): VideoLyricLine[] {
  const valid = lyrics.filter(
    (line) => typeof line.startTime === 'number' && Number.isFinite(line.startTime)
  );

  return valid.map((line, i) => {
    const startMs = line.startTime as number;
    const startSec = startMs / 1000;
    const nextStartMs = i + 1 < valid.length ? (valid[i + 1].startTime as number) : null;
    // 无 duration 时用下一行起点补齐；末行用固定兜底
    const fallback = nextStartMs !== null ? (nextStartMs - startMs) / 1000 : LAST_LINE_FALLBACK_SEC;
    const durationSec =
      typeof line.duration === 'number' && line.duration > 0
        ? line.duration / 1000
        : Math.max(MIN_LINE_SEC, fallback);

    const words: VideoWord[] = (line.words ?? [])
      .filter((w) => Number.isFinite(w.startTime))
      .map((w) => {
        const wordStart = w.startTime / 1000;
        return {
          text: w.text,
          startSec: wordStart,
          endSec: wordStart + Math.max(0.05, (w.duration || 0) / 1000)
        };
      });

    return {
      text: line.text ?? '',
      trText: line.trText ?? '',
      startSec,
      endSec: startSec + durationSec,
      words
    };
  });
}

/**
 * 当前行已唱字符数。
 * 有逐字数据时按逐字时间轴推进（便于做逐字高亮）；
 * 没有时按行进度线性推进，保证任何歌词都有可用的高亮位置。
 */
export function computeSungChars(
  line: VideoLyricLine | null,
  songTimeSec: number,
  lineProgress: number
): number {
  if (!line) return 0;
  const total = Array.from(line.text).length;
  if (!line.words.length) return lineProgress * total;

  let sung = 0;
  for (const word of line.words) {
    const wordChars = Array.from(word.text).length;
    if (songTimeSec >= word.endSec) {
      sung += wordChars;
    } else if (songTimeSec > word.startSec) {
      const span = Math.max(1e-3, word.endSec - word.startSec);
      sung += wordChars * ((songTimeSec - word.startSec) / span);
      break;
    } else {
      break;
    }
  }
  return Math.min(total, sung);
}

/** 解析某一时刻的歌词状态；-1 索引表示前奏 */
export function resolveLyricState(
  timeline: VideoLyricLine[],
  songTimeSec: number
): VideoFrameLyric {
  let index = -1;
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].startSec <= songTimeSec) index = i;
    else break;
  }

  const current = index >= 0 ? timeline[index] : null;
  const prev = index - 1 >= 0 ? timeline[index - 1] : null;
  const next = index + 1 < timeline.length ? timeline[index + 1] : null;
  const span = current ? Math.max(0.05, current.endSec - current.startSec) : 1;
  const lineProgress = current
    ? Math.min(1, Math.max(0, (songTimeSec - current.startSec) / span))
    : 0;

  return {
    index,
    current,
    prev,
    next,
    lineProgress,
    sungChars: computeSungChars(current, songTimeSec, lineProgress)
  };
}
