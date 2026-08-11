import { describe, expect, it } from 'vitest';

import { parseLrcToILyric } from '../../src/renderer/utils/localMusicUtils';

describe('local word-timed LRC', () => {
  it('parses enhanced LRC with angle-bracket word timestamps', () => {
    const lyric = parseLrcToILyric(
      '[00:01.000]<00:01.000>你<00:01.250>好 <00:01.600>world<00:02.200>\n' + '[00:03.000]下一句'
    );

    expect(lyric?.hasWordByWord).toBe(true);
    expect(lyric?.lrcArray[0]).toMatchObject({ text: '你好 world', hasWordByWord: true });
    expect(lyric?.lrcArray[0].words).toEqual([
      { text: '你', startTime: 1000, duration: 250, space: false },
      { text: '好', startTime: 1250, duration: 350, space: true },
      { text: 'world', startTime: 1600, duration: 600, space: false }
    ]);
  });

  it('parses inline square-bracket word timestamps without treating them as extra lines', () => {
    const lyric = parseLrcToILyric(
      '[00:01.000]今[00:01.180]天 [00:01.500]fine[00:02.000]\n' + '[00:03.000]下一句'
    );

    expect(lyric?.lrcArray).toHaveLength(2);
    expect(lyric?.lrcArray[0].text).toBe('今天 fine');
    expect(
      lyric?.lrcArray[0].words?.map(({ text, startTime, duration }) => ({
        text,
        startTime,
        duration
      }))
    ).toEqual([
      { text: '今', startTime: 1000, duration: 180 },
      { text: '天', startTime: 1180, duration: 320 },
      { text: 'fine', startTime: 1500, duration: 500 }
    ]);
  });

  it('parses square-bracket time ranges with line-relative word offsets', () => {
    const lyric = parseLrcToILyric('[1000,1200][0,250]逐[250,350]字 [600,600]歌词');

    expect(lyric?.lrcArray[0].text).toBe('逐字 歌词');
    expect(
      lyric?.lrcArray[0].words?.map(({ startTime, duration }) => ({
        startTime,
        duration
      }))
    ).toEqual([
      { startTime: 1000, duration: 250 },
      { startTime: 1250, duration: 350 },
      { startTime: 1600, duration: 600 }
    ]);
  });
});
