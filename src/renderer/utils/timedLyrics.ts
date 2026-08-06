import type { ILyric, ILyricText, IWordData, LyricFormat, LyricSource } from '@/types/music';

import { extractQrcLyricContent } from './qrcParser';
import { parseLyrics } from './yrcParser';

export interface TimedLyricOptions {
  format?: LyricFormat;
  source?: LyricSource;
}

function emptyLyric(options: TimedLyricOptions = {}): ILyric {
  return {
    lrcTimeArray: [],
    lrcArray: [],
    hasWordByWord: false,
    format: options.format,
    source: options.source
  };
}

function detectFormat(payload: string, requested?: LyricFormat): LyricFormat {
  if (requested) return requested;
  return /^\s*\[\d+,\d+\]/m.test(payload) ? 'yrc' : 'lrc';
}

export function parseTimedLyrics(payload: string, options: TimedLyricOptions = {}): ILyric {
  if (!payload || typeof payload !== 'string') return emptyLyric(options);
  const content = options.format === 'qrc' ? extractQrcLyricContent(payload) : payload;
  const result = parseLyrics(content);
  if (!result.success) return emptyLyric(options);

  let hasWordByWord = false;
  const lrcArray: ILyricText[] = result.data.lyrics.map((line) => {
    const words = line.words.length ? (line.words as IWordData[]) : undefined;
    if (words?.length) hasWordByWord = true;
    return {
      text: line.fullText,
      trText: '',
      romaText: '',
      words,
      hasWordByWord: Boolean(words?.length),
      startTime: line.startTime,
      duration: line.duration
    };
  });

  return {
    lrcArray,
    lrcTimeArray: lrcArray.map((line) => Number(line.startTime || 0) / 1000),
    hasWordByWord,
    format: detectFormat(content, options.format),
    source: options.source
  };
}

function findAuxiliaryLine(
  primary: ILyricText,
  primaryIndex: number,
  auxiliary: ILyricText[],
  equalLength: boolean
): ILyricText | undefined {
  const startTime = primary.startTime;
  if (startTime !== undefined && startTime >= 0) {
    let closest: ILyricText | undefined;
    let closestDifference = 301;
    for (const line of auxiliary) {
      if (line.startTime === undefined || line.startTime < 0) continue;
      const difference = Math.abs(line.startTime - startTime);
      if (difference < closestDifference) {
        closest = line;
        closestDifference = difference;
      }
    }
    if (closestDifference <= 300) return closest;
  }
  return equalLength ? auxiliary[primaryIndex] : undefined;
}

export function mergeAuxiliaryLyrics(
  primary: ILyric,
  payload: string | null | undefined,
  field: 'trText' | 'romaText',
  format?: LyricFormat
): ILyric {
  if (!payload) return primary;
  const auxiliary = parseTimedLyrics(payload, { format }).lrcArray;
  if (!auxiliary.length) return primary;
  const equalLength = auxiliary.length === primary.lrcArray.length;
  primary.lrcArray.forEach((line, index) => {
    const match = findAuxiliaryLine(line, index, auxiliary, equalLength);
    line[field] = line.text && match?.text ? match.text : '';
  });
  return primary;
}
