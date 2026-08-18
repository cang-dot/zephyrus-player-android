import type { LyricLine, LyricWord, OptimizeLyricOptions } from '@applemusic-like-lyrics/core';

import type { TtmlBackgroundLine, TtmlLine, TtmlLyric, TtmlWord } from '@/services/ttmlParser';
import type { ILyricText, IWordData } from '@/types/music';

const MIN_LINE_DURATION = 1000;

export type IndexedAmllLyricLine = LyricLine & { __zephyrusSourceIndex: number };

export const MOBILE_AMLL_OPTIMIZE_OPTIONS = Object.freeze({
  normalizeSpaces: false,
  resetLineTimestamps: false,
  convertExcessiveBackgroundLines: false,
  // AMLL groups a background line under its preceding main line and uses the
  // main line's range for the group lifecycle. Expanding the line-level range
  // keeps longer background vocals active without changing either word track.
  syncMainAndBackgroundLines: true,
  cleanUnintentionalOverlaps: false,
  tryAdvanceStartTime: false
}) satisfies OptimizeLyricOptions;

function finiteMs(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function ensureEnd(startTime: number, endTime: number): number {
  return Math.max(startTime + 1, endTime);
}

function providerWords(line: ILyricText, startTime: number, endTime: number): LyricWord[] {
  if (!line.words?.length) return [{ word: line.text, startTime, endTime }];

  return line.words.map((word: IWordData) => {
    const wordStart = finiteMs(word.startTime, startTime);
    const wordEnd = ensureEnd(wordStart, wordStart + finiteMs(word.duration, 1));
    return {
      word: `${word.text}${word.space ? ' ' : ''}`,
      startTime: wordStart,
      endTime: wordEnd
    };
  });
}

export function providerLyricsToAmll(lines: readonly ILyricText[]): LyricLine[] {
  return lines
    .map((line, index) => {
      const nextStart = finiteMs(lines[index + 1]?.startTime, -1);
      const startTime = finiteMs(line.startTime);
      const duration = finiteMs(line.duration);
      const inferredEnd =
        nextStart > startTime ? nextStart : startTime + Math.max(duration, MIN_LINE_DURATION);
      const endTime = ensureEnd(startTime, inferredEnd);

      return {
        words: providerWords(line, startTime, endTime),
        translatedLyric: line.trText || '',
        romanLyric: line.romaText || '',
        startTime,
        endTime,
        isBG: Boolean(line.isBG),
        isDuet: false
      } satisfies LyricLine;
    })
    .filter((line) => line.words.some((word) => word.word.trim()))
    .map((line, index) => ({ ...line, __zephyrusSourceIndex: index }));
}

function ttmlWords(
  words: readonly TtmlWord[],
  fallbackText: string,
  startTime: number,
  endTime: number
): LyricWord[] {
  const converted = words
    .map((word) => {
      const wordStart = finiteMs(word.begin * 1000, startTime);
      const wordEnd = ensureEnd(wordStart, finiteMs(word.end * 1000, wordStart + 1));
      return { word: word.text, startTime: wordStart, endTime: wordEnd } satisfies LyricWord;
    })
    .filter((word) => word.word.length > 0);

  return converted.length ? converted : [{ word: fallbackText, startTime, endTime }];
}

function ttmlLineToAmll(
  line: TtmlLine | TtmlBackgroundLine,
  options: { isBG: boolean; isDuet: boolean; sourceIndex: number }
): IndexedAmllLyricLine {
  const startTime = finiteMs(line.begin * 1000);
  const endTime = ensureEnd(startTime, finiteMs(line.end * 1000, startTime + MIN_LINE_DURATION));
  return {
    __zephyrusSourceIndex: options.sourceIndex,
    words: ttmlWords(line.words, line.text, startTime, endTime),
    translatedLyric: line.translations[0]?.text || '',
    romanLyric: line.romanizations[0]?.text || '',
    startTime,
    endTime,
    isBG: options.isBG,
    isDuet: options.isDuet
  };
}

export function ttmlLyricsToAmll(lyric: TtmlLyric): LyricLine[] {
  const result: LyricLine[] = [];
  let sourceIndex = 0;

  for (const line of lyric.lines) {
    result.push(
      ttmlLineToAmll(line, {
        // A top-level line with a non-primary agent is a duet voice in AMLL.
        // Only nested x-bg spans are background vocals.
        isBG: false,
        isDuet: Boolean(lyric.primaryAgent && line.agent && line.agent !== lyric.primaryAgent),
        sourceIndex: sourceIndex++
      })
    );

    for (const background of line.background) {
      result.push(
        ttmlLineToAmll(background, {
          isBG: true,
          isDuet: false,
          sourceIndex: sourceIndex++
        })
      );
    }
  }

  return result;
}

export function lyricLineText(line: LyricLine): string {
  return line.words
    .map((word) => word.word)
    .join('')
    .trim();
}
