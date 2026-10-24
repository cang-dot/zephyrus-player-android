/**
 * 字幕 → 歌词 的转换与手动匹配缓存的 key 约定
 *
 * 用途：
 * 1. B 站字幕（CC/AI 字幕）转换成本项目的 ILyric，接入统一歌词链路；
 * 2. 「手动匹配歌词」把用户选中的歌词写入 provider 歌词缓存，
 *    由 loadBestLyric 以最高优先级读取（用户显式选择优先于任何自动匹配）。
 */
import type { ILyric, ILyricText, SongResult } from '@/types/music';

export interface SubtitleLine {
  from: number;
  to: number;
  content: string;
}

/** 字幕行（秒）→ ILyric（整行时间轴，非逐字） */
export function subtitleLinesToLyric(lines: SubtitleLine[]): ILyric {
  const lrcArray: ILyricText[] = [...lines]
    .filter((line) => line.content && line.to > line.from)
    .sort((a, b) => a.from - b.from)
    .map((line) => ({
      text: line.content,
      trText: '',
      startTime: line.from,
      duration: Math.max(0, line.to - line.from)
    }));

  return {
    lrcTimeArray: lrcArray.map((line) => line.startTime ?? 0),
    lrcArray,
    hasWordByWord: false,
    format: 'lrc'
  };
}

/** 手动匹配结果的缓存 key（与 providerLyricCache 的 key 习惯一致） */
export function manualLyricCacheKey(song: Pick<SongResult, 'id' | 'platform' | 'platformId'>): string {
  const platform = song.platform || 'netease';
  const identity = song.platformId || String(song.id);
  return `manual:${platform}:${identity}`;
}

/** B 站字幕的缓存 key */
export function bilibiliSubtitleCacheKey(bvid: string): string {
  return `bilibili:subtitle:${bvid}`;
}

/** 去掉标题开头的【】（）() [] 装饰（避免正则转义带来的 lint 噪音） */
function stripBracketPrefix(value: string): string {
  const pairs: [string, string][] = [
    ['【', '】'],
    ['（', '）'],
    ['(', ')'],
    ['[', ']']
  ];
  for (const [open, close] of pairs) {
    if (value.startsWith(open)) {
      const end = value.indexOf(close, 1);
      if (end > 0) return value.slice(end + 1).trim();
    }
  }
  return value;
}

/** 「歌手 - 歌名」形式的默认搜索词 */
export function defaultLyricSearchKeyword(song: SongResult): string {
  const artist = (song.ar || song.artists || [])[0]?.name || '';
  const title = song.name || '';
  // B 站标题常带「【】」「-」「_」等装饰，这里只做轻量清洗
  const cleaned = stripBracketPrefix(title)
    .replace(/\s*[-_|]\s*(官方)?(MV|mv|音乐|视频|现场|live|LIVE)\s*$/, '')
    .trim();
  return artist ? `${artist} ${cleaned}` : cleaned;
}
