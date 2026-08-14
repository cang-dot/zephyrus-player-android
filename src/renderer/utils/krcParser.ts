import type { IWordData } from '@/types/music';

import { type LyricLine, type ParsedLyrics, type ParseResult } from './yrcParser';

const KRC_LINE_PATTERN = /^\[(\d+),(\d+)\]([\s\S]*)$/;
const KRC_WORD_PATTERN = /<(\d+),(\d+)(?:,\d+)?>([\s\S]*?)(?=<\d+,\d+(?:,\d+)?>|$)/g;

function applySpacing(words: IWordData[], fullText: string): IWordData[] {
  let cursor = 0;
  return words.map((word) => {
    const index = fullText.indexOf(word.text, cursor);
    if (index < 0) return word;
    const end = index + word.text.length;
    cursor = end;
    return { ...word, space: end < fullText.length && /\s/.test(fullText[end]) };
  });
}

export function parseKrcLyrics(payload: string): ParseResult<ParsedLyrics> {
  const lines: LyricLine[] = [];
  for (const rawLine of String(payload || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)) {
    const match = rawLine.trim().match(KRC_LINE_PATTERN);
    if (!match) continue;
    const startTime = Number(match[1]);
    const duration = Number(match[2]);
    const content = match[3];
    if (!Number.isFinite(startTime) || !Number.isFinite(duration) || duration < 0) continue;

    KRC_WORD_PATTERN.lastIndex = 0;
    const rawText: string[] = [];
    const words: IWordData[] = [];
    let wordMatch: RegExpExecArray | null;
    while ((wordMatch = KRC_WORD_PATTERN.exec(content)) !== null) {
      const relativeStart = Number(wordMatch[1]);
      const wordDuration = Number(wordMatch[2]);
      const rawWord = wordMatch[3].replace(/\u00a0/g, ' ');
      rawText.push(rawWord);
      const text = rawWord.trim();
      if (!text || !Number.isFinite(relativeStart) || !Number.isFinite(wordDuration)) continue;
      const absoluteStart = startTime + Math.max(0, relativeStart);
      const lineEnd = startTime + duration;
      if (absoluteStart > lineEnd) continue;
      words.push({
        text,
        startTime: absoluteStart,
        duration: Math.max(0, Math.min(wordDuration, lineEnd - absoluteStart))
      });
    }

    const fullText = rawText
      .join('')
      .replace(/\u00a0/g, ' ')
      .trim();
    if (!fullText) continue;
    lines.push({
      startTime,
      duration,
      fullText,
      words: applySpacing(words, fullText)
    });
  }

  return { success: true, data: { metadata: [], lyrics: lines } };
}
