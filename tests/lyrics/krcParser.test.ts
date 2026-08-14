import { describe, expect, it } from 'vitest';

import { parseKrcLyrics } from '../../src/renderer/utils/krcParser';
import { isPlaceholderLyricText, isUsableLyric } from '../../src/renderer/utils/lyricValidation';
import { parseTimedLyrics } from '../../src/renderer/utils/timedLyrics';

describe('Kugou KRC lyrics', () => {
  it('preserves relative word timing and full English words', () => {
    const lyric = parseTimedLyrics(
      '[9696,42716]<0,210,0>The<210,1200,0> system<1410,600,0> moves',
      { format: 'krc', source: 'kugou' }
    );

    expect(lyric.hasWordByWord).toBe(true);
    expect(lyric.lrcArray[0].text).toBe('The system moves');
    expect(lyric.lrcArray[0].words).toEqual([
      { text: 'The', startTime: 9696, duration: 210, space: true },
      { text: 'system', startTime: 9906, duration: 1200, space: true },
      { text: 'moves', startTime: 11106, duration: 600, space: false }
    ]);
  });

  it('ignores metadata and malformed lines', () => {
    const result = parseKrcLyrics('[ar:artist]\ninvalid\n[1000,500]<0,500,0>valid');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lyrics.map((line) => line.fullText)).toEqual(['valid']);
  });
});

describe('lyric availability validation', () => {
  it('rejects provider placeholders and credit-only payloads', () => {
    const qq = parseTimedLyrics('[749,2797](749,2797,0)版权方要求暂不展示歌词', {
      format: 'yrc',
      source: 'qq'
    });
    const netease = parseTimedLyrics(
      '[00:00.00]作词：重塑雕像的权利\n[00:00.01]作曲：重塑雕像的权利'
    );
    expect(isUsableLyric(qq)).toBe(false);
    expect(isUsableLyric(netease)).toBe(false);
    expect(isPlaceholderLyricText('该歌曲暂无歌词')).toBe(true);
  });

  it('keeps a real one-line lyric', () => {
    expect(isUsableLyric(parseTimedLyrics('[00:01.00]This is a real lyric.'))).toBe(true);
  });
});
