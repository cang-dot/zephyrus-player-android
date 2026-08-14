import type { ILyric, ILyricText } from '@/types/music';

const PLACEHOLDER_PATTERNS = [
  /^(?:暂无|暂不|暂未|没有|无)(?:相关)?歌词$/i,
  /^该歌曲(?:暂无|暂不|暂未|没有|无)(?:相关)?歌词$/i,
  /^(?:纯音乐|instrumental)$/i,
  /该歌曲(?:为)?(?:没有填词的)?纯音乐/i,
  /(?:版权方|版权)要求.*(?:不|暂不)展示歌词/i,
  /(?:因版权|由于版权).*无法.*歌词/i,
  /lyrics?\s*(?:not found|unavailable)/i,
  /no\s+lyrics?/i
];

const CREDIT_PATTERN =
  /^(?:作词|作曲|编曲|制作人|词|曲|混音|母带|录音|和声|吉他|贝斯|鼓|监制|出品|发行)\s*[:：]/i;

function normalize(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\s\u200b-\u200d\ufeff]+/g, '')
    .replace(/[.,，。!！?？:：;；'"“”‘’()（）[\]【】]/g, '')
    .toLowerCase();
}

export function isPlaceholderLyricText(value: string): boolean {
  const text = normalize(value);
  return !text || PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
}

export function isCreditOnlyLine(line: ILyricText): boolean {
  return CREDIT_PATTERN.test(String(line.text || '').trim());
}

export function getMeaningfulLyricLines(lyric: ILyric | null | undefined): ILyricText[] {
  if (!lyric?.lrcArray?.length) return [];
  const nonEmpty = lyric.lrcArray.filter((line) => !isPlaceholderLyricText(line.text));
  if (!nonEmpty.length || nonEmpty.every(isCreditOnlyLine)) return [];
  return nonEmpty.filter((line) => !isCreditOnlyLine(line));
}

export function isUsableLyric(lyric: ILyric | null | undefined): lyric is ILyric {
  return getMeaningfulLyricLines(lyric).length > 0;
}
