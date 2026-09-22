import { DOMParser as XmlDomParser } from '@xmldom/xmldom';
import { describe, expect, it, vi } from 'vitest';

import {
  parseLrcToILyric,
  parseLyricContent,
  parseTtmlToILyric
} from '../../src/renderer/utils/localMusicUtils';

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

describe('local embedded TTML lyrics', () => {
  const ttmlSample =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" timing="word">' +
    '<body><div><p begin="00:01.000" end="00:02.200">' +
    '<span begin="00:01.000" end="00:01.250">你</span><span begin="00:01.250" end="00:01.600">好 </span>' +
    '<span begin="00:01.600" end="00:02.200">world</span></p>' +
    '<p begin="00:03.000" end="00:04.000"><span begin="00:03.000" end="00:04.000">下一句</span></p>' +
    '</div></body></tt>';

  it('auto-detects TTML metadata and parses it into word-timed ILyric', () => {
    vi.stubGlobal('DOMParser', XmlDomParser);
    try {
      const lyric = parseTtmlToILyric(ttmlSample);

      expect(lyric?.format).toBe('ttml');
      expect(lyric?.hasWordByWord).toBe(true);
      expect(lyric?.lrcTimeArray).toEqual([1, 3]);
      expect(lyric?.lrcArray[0]).toMatchObject({ text: '你好world', hasWordByWord: true });
      expect(lyric?.lrcArray[0].words?.map(({ text, startTime }) => ({ text, startTime }))).toEqual(
        [
          { text: '你', startTime: 1000 },
          { text: '好', startTime: 1250 },
          { text: 'world', startTime: 1600 }
        ]
      );
      expect(lyric?.lrcArray[1]).toMatchObject({ text: '下一句', hasWordByWord: true });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('never feeds TTML content into the LRC parser', () => {
    expect(parseLrcToILyric(ttmlSample)).toBeNull();
  });

  it('parses bound .ttml lyric files through parseLyricContent', () => {
    vi.stubGlobal('DOMParser', XmlDomParser);
    try {
      const lyric = parseLyricContent(ttmlSample, 'C:/music/歌曲.ttml');
      expect(lyric?.format).toBe('ttml');
      expect(lyric?.lrcArray).toHaveLength(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('returns null for malformed TTML instead of falling back to LRC', () => {
    vi.stubGlobal('DOMParser', XmlDomParser);
    try {
      expect(
        parseTtmlToILyric(
          '<?xml version="1.0"?><tt xmlns="http://www.w3.org/ns/ttml"><body></body></tt>'
        )
      ).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
