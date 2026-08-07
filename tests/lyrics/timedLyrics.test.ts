import { DOMParser as XmlDomParser } from '@xmldom/xmldom';
import { describe, expect, it, vi } from 'vitest';

import {
  parseTtml,
  type TtmlLyric,
  ttmlToTimedLines
} from '../../src/renderer/services/ttmlParser';
import { extractQrcLyricContent, parseQrcLyrics } from '../../src/renderer/utils/qrcParser';
import { getTimedLyricLineProgress } from '../../src/renderer/utils/timedLyricProgress';
import { mergeAuxiliaryLyrics, parseTimedLyrics } from '../../src/renderer/utils/timedLyrics';

describe('timed lyric parsing', () => {
  it('preserves NetEase YRC word timing and spaces', () => {
    const lyric = parseTimedLyrics('[1000,1200](1000,400,0)你(1400,300,0)好 (1700,500,0)world', {
      format: 'yrc',
      source: 'netease'
    });

    expect(lyric.format).toBe('yrc');
    expect(lyric.hasWordByWord).toBe(true);
    expect(lyric.lrcArray[0].text).toBe('你好 world');
    expect(lyric.lrcArray[0].words).toEqual([
      { text: '你', startTime: 1000, duration: 400, space: false },
      { text: '好', startTime: 1400, duration: 300, space: true },
      { text: 'world', startTime: 1700, duration: 500, space: false }
    ]);
  });

  it('extracts QRC XML and accepts two-field word timing', () => {
    const xml =
      '<QrcInfos><LyricInfo><Lyric_1 LyricContent="[2000,1000](2000,400)Hello (2400,600)QRC" /></LyricInfo></QrcInfos>';

    expect(extractQrcLyricContent(xml)).toContain('(2000,400)Hello');
    const result = parseQrcLyrics(xml);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lyrics[0].fullText).toBe('Hello QRC');
      expect(result.data.lyrics[0].words).toHaveLength(2);
    }
  });

  it('clamps word duration and discards words outside the line', () => {
    const lyric = parseTimedLyrics(
      '[5000,1000](4500,200,0)before(5200,1200,0)inside(6100,100,0)after',
      { format: 'yrc' }
    );

    expect(lyric.lrcArray[0].words).toEqual([
      { text: 'inside', startTime: 5200, duration: 800, space: false }
    ]);
  });

  it('merges translation and romanization within 300ms', () => {
    const lyric = parseTimedLyrics('[00:01.00]main\n[00:03.00]second', {
      format: 'lrc',
      source: 'netease'
    });
    mergeAuxiliaryLyrics(lyric, '[00:01.25]translated', 'trText', 'lrc');
    mergeAuxiliaryLyrics(lyric, '[00:01.31]romanized', 'romaText', 'lrc');

    expect(lyric.lrcArray[0].trText).toBe('translated');
    expect(lyric.lrcArray[0].romaText).toBe('');
  });

  it('uses index fallback only when line counts match', () => {
    const equalLength = parseTimedLyrics('[00:01.00]one\n[00:02.00]two');
    mergeAuxiliaryLyrics(equalLength, '[00:10.00]uno\n[00:20.00]dos', 'trText', 'lrc');
    expect(equalLength.lrcArray.map((line) => line.trText)).toEqual(['uno', 'dos']);

    const differentLength = parseTimedLyrics('[00:01.00]one\n[00:02.00]two');
    mergeAuxiliaryLyrics(differentLength, '[00:10.00]uno', 'trText', 'lrc');
    expect(differentLength.lrcArray.map((line) => line.trText)).toEqual(['', '']);
  });

  it('keeps every TTML word when adapting lines for scrolling lyrics', () => {
    const lyric: TtmlLyric = {
      lines: [
        {
          begin: 1,
          end: 1.48,
          text: '歌颂我 world',
          words: [
            { text: '歌', begin: 1, end: 1.08 },
            { text: '颂', begin: 1.08, end: 1.16 },
            { text: '我 ', begin: 1.16, end: 1.24 },
            { text: 'world', begin: 1.24, end: 1.48 }
          ],
          isBackground: false,
          background: [],
          translations: [{ text: 'Praise me, world', role: 'translation' }],
          romanizations: [{ text: 'ge song wo', role: 'roman' }]
        },
        {
          begin: 1.1,
          end: 1.3,
          text: '和声',
          words: [{ text: '和声', begin: 1.1, end: 1.3 }],
          isBackground: true,
          background: [],
          translations: [],
          romanizations: []
        }
      ],
      duration: 1.48,
      timingMode: 'word',
      agents: [],
      parts: [],
      meta: {}
    };

    const lines = ttmlToTimedLines(lyric);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      text: '歌颂我 world',
      trText: 'Praise me, world',
      romaText: 'ge song wo',
      hasWordByWord: true,
      startTime: 1000,
      duration: 480
    });
    expect(lines[0].words).toEqual([
      { text: '歌', startTime: 1000, duration: 80, space: false },
      { text: '颂', startTime: 1080, duration: 80, space: false },
      { text: '我', startTime: 1160, duration: 80, space: true },
      { text: 'world', startTime: 1240, duration: 240, space: false }
    ]);
  });

  it('keeps timing from direct TTML word spans used by AMLL lyrics', () => {
    let lyric: ReturnType<typeof parseTtml>;
    vi.stubGlobal('DOMParser', XmlDomParser);
    try {
      lyric = parseTtml(
        '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:04.233" end="00:05.642"><span begin="00:04.233" end="00:04.362">Start</span> <span begin="00:04.362" end="00:04.832">my</span> <span begin="00:04.832" end="00:05.642">car</span></p></div></body></tt>'
      );
    } finally {
      vi.unstubAllGlobals();
    }

    expect(lyric?.timingMode).toBe('word');
    expect(lyric?.lines[0].words).toEqual([
      { text: 'Start ', begin: 4.233, end: 4.362, role: 'main' },
      { text: 'my ', begin: 4.362, end: 4.832, role: 'main' },
      { text: 'car', begin: 4.832, end: 5.642, role: 'main' }
    ]);
    expect(ttmlToTimedLines(lyric!)[0].words).toEqual([
      { text: 'Start', startTime: 4233, duration: 129, space: true },
      { text: 'my', startTime: 4362, duration: 470, space: true },
      { text: 'car', startTime: 4832, duration: 810, space: false }
    ]);
  });

  it('maps word timings to one continuous line progress', () => {
    const words = [
      { text: '人', startTime: 1000, duration: 200 },
      { text: '民', startTime: 1200, duration: 200, space: true },
      { text: 'artist', startTime: 1600, duration: 600 }
    ];

    expect(getTimedLyricLineProgress(words, 900)).toBe(0);
    expect(getTimedLyricLineProgress(words, 1100)).toBeCloseTo(0.5 / 9);
    expect(getTimedLyricLineProgress(words, 1300)).toBeCloseTo(2 / 9);
    expect(getTimedLyricLineProgress(words, 1500)).toBeCloseTo(3 / 9);
    expect(getTimedLyricLineProgress(words, 1900)).toBeCloseTo(6 / 9);
    expect(getTimedLyricLineProgress(words, 2300)).toBe(1);
  });
});
