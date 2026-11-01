import { computed, nextTick, ref } from 'vue';
import { describe, expect, it } from 'vitest';

import { ttmlToTimedLines, type TtmlLine, type TtmlLyric } from '@/services/ttmlParser';
import { providerLyricsToAmll, ttmlLyricsToAmll } from '@/utils/amllLyricAdapter';
import {
  cleanCreditKeywords,
  DEFAULT_LYRIC_CREDIT_KEYWORDS,
  findCreditLines,
  normalizeCreditConfig,
  projectCreditLyrics,
  projectCreditTtml
} from '@/utils/lyricCredits';
import type { ILyricText } from '@/types/music';

const enabled = normalizeCreditConfig({ hideIntroOutroCredits: true });
const rows = (...texts: string[]): ILyricText[] =>
  texts.map((text, i) => ({
    text,
    trText: `tr${i}`,
    romaText: `ro${i}`,
    startTime: i * 3000,
    duration: 2500,
    words: [{ text, startTime: i * 3000, duration: 2500 }]
  }));
const hidden = (texts: string[], config = enabled) =>
  [...findCreditLines(rows(...texts), config).hiddenIndices].sort((a, b) => a - b);

describe('intro/outro credit recognition', () => {
  it.each([
    '编曲: 人',
    '編曲：人',
    '錄音师 : 人',
    '制作：人',
    '製作:人',
    'lYrIcS ： Someone',
    ' 原词 / 作曲／編曲&混音＆母帶、錄音+Producer＋Vocals : 人'
  ])('matches complete equivalent fields: %s', (credit) => {
    expect(hidden([credit, '正文', credit])).toEqual([0, 2]);
  });
  it('normalizes traditional custom keywords and deduplicates without changing spelling', () => {
    const words = cleanCreditKeywords([' 編曲 ', '编曲', 'MUSIC', 'music', '', '  ', '製作統籌']);
    expect(words).toEqual(['編曲', 'MUSIC', '製作統籌']);
    expect(
      hidden(['编曲：甲', '正文', '制作统筹:乙'], { ...enabled, lyricCreditKeywords: words })
    ).toEqual([0, 2]);
  });
  it('preserves blank boundaries, titles, continuation lines, mid-song credits and unknown compound fields', () => {
    expect(
      hidden(['作词:甲', '', '标题', '作曲:乙', '正文', '混音：丙', '正文2', '', '录音:丁'])
    ).toEqual([0, 8]);
    for (const text of [
      '原作词：甲',
      '作词人名',
      '某某作曲:甲',
      '作曲/未知:甲',
      '作词/:甲',
      '作.*:甲'
    ]) {
      expect(hidden([text, '正文', text])).toEqual([]);
    }
    expect(hidden(['标题', '作曲:甲', '姓名'])).toEqual([]);
  });
  it('defaults off, preserves deliberate empty keywords, and handles all credits', () => {
    expect(normalizeCreditConfig().hideIntroOutroCredits).toBe(false);
    expect(normalizeCreditConfig().lyricCreditKeywords).toEqual(DEFAULT_LYRIC_CREDIT_KEYWORDS);
    expect(hidden(['作曲:甲'], normalizeCreditConfig())).toEqual([]);
    expect(hidden(['作曲:甲'], { ...enabled, lyricCreditKeywords: [] })).toEqual([]);
    const projection = projectCreditLyrics(rows('作曲:甲', '', '编曲:乙'), enabled);
    expect(projection.some((line) => line.text.trim())).toBe(false);
  });
  it('retains raw data, seek indexes, word timing, and the original ending boundary', () => {
    const source = rows('作曲:甲', '正文', '制作:乙');
    const before = JSON.stringify(source);
    const display = projectCreditLyrics(source, enabled);
    expect(display.map((line) => line.text)).toEqual(['', '正文', '']);
    expect(display[0]).toMatchObject({ words: [], trText: '', romaText: '', startTime: 0 });
    expect(display[1]).toBe(source[1]);
    expect(JSON.stringify(source)).toBe(before);
    const map = findCreditLines(source, enabled);
    expect(map.visibleToOriginal).toEqual([1]);
    expect(map.originalToVisible).toEqual([-1, 0, -1]);
    const amll = providerLyricsToAmll(display);
    expect(amll.map((line) => line.startTime)).toEqual([0, 3000, 6000]);
    expect(amll[1].endTime).toBe(6000);
    expect(amll[2].words.map((word) => word.word).join('')).toBe('');
  });
  it('recomputes without modifying playback state when settings or async sources change', async () => {
    const source = ref(rows('作词:甲', '正文', '制作:乙'));
    const config = ref(normalizeCreditConfig());
    const position = ref(4500);
    const display = computed(() => projectCreditLyrics(source.value, config.value));
    config.value = enabled;
    await nextTick();
    expect(display.value[0].text).toBe('');
    source.value = rows('新歌标题', '编曲:甲', '正文');
    expect(display.value[1].text).toBe('编曲:甲');
    source.value = [];
    expect(display.value).toEqual([]);
    expect(position.value).toBe(4500);
  });
});

describe('TTML credit groups', () => {
  const line = (text: string, begin: number): TtmlLine => ({
    text,
    begin,
    end: begin + 2,
    words: [{ text, begin, end: begin + 2 }],
    translations: [{ text: 'translation', lang: 'en' }],
    romanizations: [{ text: 'roman', lang: 'en' }],
    background: [
      {
        text: 'backing',
        begin,
        end: begin + 3,
        words: [{ text: 'backing', begin, end: begin + 3 }],
        translations: [],
        romanizations: []
      }
    ]
  });
  it('hides main, nested backing, translations, romanization, and standalone attached backgrounds', () => {
    const lyric = {
      lines: [
        line('編曲：甲', 0),
        { ...line('backing', 1), isBackground: true },
        line('正文', 4),
        line('錄音:乙', 8)
      ],
      duration: 12,
      timingMode: 'word',
      agents: [],
      parts: [],
      meta: {}
    } as TtmlLyric;
    const before = JSON.stringify(lyric);
    const projected = projectCreditTtml(lyric, enabled)!;
    expect(projected.lines[0]).toMatchObject({
      text: '',
      words: [],
      background: [],
      translations: [],
      romanizations: [],
      begin: 0,
      end: 2
    });
    expect(projected.lines[1].text).toBe('');
    expect(projected.lines[2]).toMatchObject({ text: lyric.lines[2].text, creditOriginalIndex: 4 });
    expect(ttmlToTimedLines(projected).map((row) => row.startTime)).toEqual([0, 4000, 8000]);
    expect(
      ttmlLyricsToAmll(projected).some((row) =>
        row.words.some((word) => word.word.includes('編曲'))
      )
    ).toBe(false);
    expect(JSON.stringify(lyric)).toBe(before);
    expect(projectCreditTtml(null, enabled)).toBeNull();
  });
});

describe('shared persisted credit configuration', () => {
  it('merges only feature fields and synchronizes events, including empty lists and defaults', async () => {
    localStorage.setItem(
      'music-full-config',
      JSON.stringify({ playerStyle: 'smoke', showTranslation: false })
    );
    const { lyricCreditConfig, saveLyricCreditConfig } =
      await import('@/services/lyricCreditConfig');
    saveLyricCreditConfig({ hideIntroOutroCredits: true, lyricCreditKeywords: [] });
    expect(lyricCreditConfig.value).toEqual({
      hideIntroOutroCredits: true,
      lyricCreditKeywords: []
    });
    expect(JSON.parse(localStorage.getItem('music-full-config')!)).toMatchObject({
      playerStyle: 'smoke',
      showTranslation: false
    });
    saveLyricCreditConfig({ lyricCreditKeywords: [...DEFAULT_LYRIC_CREDIT_KEYWORDS] });
    expect(lyricCreditConfig.value.hideIntroOutroCredits).toBe(true);
    localStorage.setItem(
      'music-full-config',
      JSON.stringify({ hideIntroOutroCredits: false, lyricCreditKeywords: ['編曲'] })
    );
    window.dispatchEvent(new CustomEvent('music-full-config-updated'));
    expect(lyricCreditConfig.value.hideIntroOutroCredits).toBe(false);
    window.dispatchEvent(new StorageEvent('storage', { key: 'music-full-config' }));
    expect(lyricCreditConfig.value.lyricCreditKeywords).toEqual(['編曲']);
  });
});
