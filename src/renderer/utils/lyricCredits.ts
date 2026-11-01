import { Converter } from 'opencc-js/t2cn';

import type { TtmlLyric } from '@/services/ttmlParser';
import type { ILyricText } from '@/types/music';

export const DEFAULT_LYRIC_CREDIT_KEYWORDS = [
  ...'作词 填词 词 作曲 曲 编曲 原词 原曲 原唱 演唱 歌手 制作人 制作 监制 出品人 出品 出品公司 发行 发行公司 发行人 录音 录音师 录音室 混音 混音师 混音室 母带 母带处理 母带工程师 和声 和声编写 和声设计 吉他 贝斯 鼓 钢琴 键盘 弦乐 弦乐编写 管弦乐 配器 音乐总监 版权 版权提供 制作统筹'.split(
    ' '
  ),
  ...'Lyrics|Original Lyrics|Lyricist|Composer|Composition|Music|Arranger|Arrangement|Producer|Executive Producer|Vocals|Original Singer|Recording|Recorded by|Mixing|Mixed by|Mastering|Mastered by|Backing Vocals|Guitar|Bass|Drums|Piano|Keyboard|Strings|Publisher|Label'.split(
    '|'
  )
];

export interface LyricCreditConfig {
  hideIntroOutroCredits: boolean;
  lyricCreditKeywords: string[];
}

const toSimplified = Converter({ from: 'tw', to: 'cn' });
export const normalizeCreditKeyword = (text: string): string =>
  toSimplified(text.trim()).toLowerCase();

export function cleanCreditKeywords(words: readonly string[]): string[] {
  const seen = new Set<string>();
  return words
    .filter((word) => typeof word === 'string')
    .map((word) => word.trim())
    .filter((word) => {
      const key = normalizeCreditKeyword(word);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeCreditConfig(value: Partial<LyricCreditConfig> = {}): LyricCreditConfig {
  return {
    hideIntroOutroCredits: value.hideIntroOutroCredits === true,
    lyricCreditKeywords: Array.isArray(value.lyricCreditKeywords)
      ? cleanCreditKeywords(value.lyricCreditKeywords)
      : [...DEFAULT_LYRIC_CREDIT_KEYWORDS]
  };
}

export function findCreditLines(lines: readonly { text: string }[], config: LyricCreditConfig) {
  const hiddenIndices = new Set<number>();
  if (config.hideIntroOutroCredits && config.lyricCreditKeywords.length) {
    const keywords = new Set(config.lyricCreditKeywords.map(normalizeCreditKeyword));
    const matches = (text: string) => {
      const colon = text.search(/[:：]/u);
      if (colon < 0) return false;
      return text
        .slice(0, colon)
        .split(/[/／&＆、+＋]/u)
        .every((field) => keywords.has(normalizeCreditKeyword(field)));
    };
    for (const direction of [1, -1]) {
      for (
        let index = direction === 1 ? 0 : lines.length - 1;
        index >= 0 && index < lines.length;
        index += direction
      ) {
        const text = lines[index].text.trim();
        if (!text) continue;
        if (!matches(text)) break;
        hiddenIndices.add(index);
      }
    }
  }
  const visibleToOriginal = lines
    .map((_, index) => index)
    .filter((index) => !hiddenIndices.has(index));
  const originalToVisible = lines.map(() => -1);
  visibleToOriginal.forEach((original, visible) => {
    originalToVisible[original] = visible;
  });
  return { hiddenIndices, visibleToOriginal, originalToVisible };
}

/** Empty display rows retain the original timeline and indexes. Never mutate source lyrics. */
export function projectCreditLyrics(lines: ILyricText[], config: LyricCreditConfig): ILyricText[] {
  const { hiddenIndices } = findCreditLines(lines, config);
  if (!hiddenIndices.size) return lines;
  return lines.map((line, index) =>
    hiddenIndices.has(index)
      ? {
          ...line,
          text: '',
          trText: '',
          romaText: '',
          words: [],
          hasWordByWord: false,
          creditHidden: true
        }
      : line
  );
}

export function projectCreditTtml(
  lyric: TtmlLyric | null,
  config: LyricCreditConfig
): TtmlLyric | null {
  if (!lyric) return null;
  const mains = lyric.lines.filter((line) => !line.isBackground);
  const { hiddenIndices } = findCreditLines(mains, config);
  if (!hiddenIndices.size) return lyric;
  const hidden = new Set(mains.filter((_, index) => hiddenIndices.has(index)));
  let hiddenParent = false;
  let originalIndex = 0;
  return {
    ...lyric,
    lines: lyric.lines.map((line) => {
      const creditOriginalIndex = originalIndex;
      originalIndex += 1 + line.background.length;
      if (!line.isBackground) hiddenParent = hidden.has(line);
      return hiddenParent
        ? {
            ...line,
            creditOriginalIndex,
            creditHidden: true,
            text: '',
            words: [],
            background: [],
            translations: [],
            romanizations: []
          }
        : {
            ...line,
            creditOriginalIndex,
            background: line.background.map((background, index) => ({
              ...background,
              creditOriginalIndex: creditOriginalIndex + index + 1
            }))
          };
    })
  };
}
