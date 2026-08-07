import { describe, expect, it } from 'vitest';

import { type TtmlLyric, ttmlToTimedLines } from '../../src/renderer/services/ttmlParser';
import { extractQrcLyricContent, parseQrcLyrics } from '../../src/renderer/utils/qrcParser';
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
});
