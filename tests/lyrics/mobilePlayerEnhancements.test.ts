import { describe, expect, it } from 'vitest';

import { shouldShakeTtmlFinalWord } from '@/composables/useWordTimedPlayback';
import {
  MOBILE_AMLL_OPTIMIZE_OPTIONS,
  providerLyricsToAmll,
  ttmlLyricsToAmll
} from '@/utils/amllLyricAdapter';
import { appendArtworkRetry, normalizeArtworkUrl, resolveArtworkSource } from '@/utils/artwork';
import { normalizePlatformQrProvider, normalizePlatformQrStatus } from '@/utils/platformQr';
import {
  choosePlayerInkTone,
  contrastRatio,
  mixRgb,
  parseCssColor,
  parseRepresentativeCssColor
} from '@/utils/playerInk';
import {
  orderPlaylistCards,
  playlistCardKey,
  readPlaylistCardMru,
  touchPlaylistCardMru
} from '@/utils/playlistCardMru';

describe('mobile player enhancements', () => {
  it('chooses the higher contrast ink and keeps the previous tone near the threshold', () => {
    const dark = parseCssColor('#101014')!;
    const light = parseCssColor('rgb(242, 230, 160)')!;
    expect(choosePlayerInkTone(dark)).toBe('light');
    expect(choosePlayerInkTone(light)).toBe('dark');
    expect(contrastRatio(light, { r: 23, g: 23, b: 26 })).toBeGreaterThan(
      contrastRatio(light, { r: 255, g: 255, b: 255 })
    );
    expect(choosePlayerInkTone({ r: 120, g: 120, b: 120 }, 'dark')).toBe('dark');
    expect(mixRgb(dark, light, 0.5)).toEqual({ r: 129, g: 123, b: 90 });
    expect(parseRepresentativeCssColor('linear-gradient(to bottom, #000000, #ffffff)')).toEqual({
      r: 128,
      g: 128,
      b: 128
    });
  });

  it('moves the exact clicked card to the front without merging platform ids', () => {
    const cards = [
      { platform: 'netease', accountId: 'n:1', type: 'playlist', id: 42 },
      { platform: 'qq', accountId: 'q:1', type: 'playlist', id: 42 },
      { platform: 'local', accountId: 'local', type: 'playlist', id: 'local-songs' }
    ];
    const state = touchPlaylistCardMru(readPlaylistCardMru(null), cards[1]);
    expect(orderPlaylistCards(cards, state)).toEqual([cards[1], cards[0], cards[2]]);
    expect(playlistCardKey(cards[0])).not.toBe(playlistCardKey(cards[1]));
    expect(readPlaylistCardMru(JSON.stringify(state))).toEqual(state);
  });

  it('converts provider and TTML timelines to immutable AMLL lyric lines', () => {
    const provider = providerLyricsToAmll([
      {
        text: 'hello world',
        trText: '你好，世界',
        startTime: 1000,
        duration: 1200,
        words: [
          { text: 'hello', startTime: 1000, duration: 500, space: true },
          { text: 'world', startTime: 1500, duration: 700 }
        ]
      }
    ]);
    expect(provider[0]).toMatchObject({
      __zephyrusSourceIndex: 0,
      startTime: 1000,
      endTime: 2200,
      translatedLyric: '你好，世界'
    });
    expect(provider[0].words.map((word) => word.word).join('')).toBe('hello world');

    const ttml = ttmlLyricsToAmll({
      duration: 4,
      timingMode: 'word',
      primaryAgent: 'v1',
      agents: [
        { id: 'v1', type: 'person', name: '野肆乐队' },
        { id: 'v2', type: 'person', name: '伴唱' }
      ],
      parts: [],
      meta: {},
      lines: [
        {
          begin: 1,
          end: 2,
          text: 'main',
          words: [{ text: 'main', begin: 1, end: 2 }],
          agent: 'v1',
          isBackground: true,
          translations: [],
          romanizations: [],
          background: [
            {
              begin: 1.5,
              end: 3,
              text: 'backing',
              words: [{ text: 'backing', begin: 1.5, end: 3 }],
              translations: [],
              romanizations: []
            }
          ]
        },
        {
          begin: 3,
          end: 4,
          text: 'duet',
          words: [{ text: 'duet', begin: 3, end: 4 }],
          agent: 'v2',
          isBackground: true,
          translations: [],
          romanizations: [],
          background: []
        }
      ]
    });
    expect(ttml).toHaveLength(3);
    expect(ttml[0]).toMatchObject({
      __zephyrusSourceIndex: 0,
      isBG: false,
      isDuet: false,
      startTime: 1000,
      endTime: 2000
    });
    expect(ttml[1]).toMatchObject({
      __zephyrusSourceIndex: 1,
      isBG: true,
      isDuet: false,
      startTime: 1500,
      endTime: 3000
    });
    expect(ttml[1].words[0]).toMatchObject({ startTime: 1500, endTime: 3000 });
    expect(MOBILE_AMLL_OPTIMIZE_OPTIONS.syncMainAndBackgroundLines).toBe(true);
    expect(ttml[2]).toMatchObject({
      __zephyrusSourceIndex: 2,
      isBG: false,
      isDuet: true,
      startTime: 3000,
      endTime: 4000
    });
  });

  it('normalizes artwork sources and creates cache-busting retry URLs', () => {
    expect(resolveArtworkSource({ al: { picUrl: '//img.example.test/cover.jpg' } })).toBe(
      '//img.example.test/cover.jpg'
    );
    expect(normalizeArtworkUrl('//img.example.test/cover.jpg')).toBe(
      'https://img.example.test/cover.jpg'
    );
    expect(normalizeArtworkUrl('http://img.example.test/cover.jpg')).toBe(
      'https://img.example.test/cover.jpg'
    );
    expect(appendArtworkRetry('https://img.example.test/cover.jpg?size=500', 2)).toBe(
      'https://img.example.test/cover.jpg?size=500&zephyrus_retry=2'
    );
  });

  it('normalizes QQ and WeChat login providers and unknown gateway states', () => {
    expect(normalizePlatformQrProvider('qq', 'wechat')).toBe('wechat');
    expect(normalizePlatformQrProvider('qq', undefined, 'wechat')).toBe('wechat');
    expect(normalizePlatformQrProvider('kugou', 'wechat')).toBe('kugou');
    expect(normalizePlatformQrStatus('scanned')).toBe('scanned');
    expect(normalizePlatformQrStatus('cancelled')).toBe('error');
  });

  it('shakes only a climax TTML line final word with an unusually long duration', () => {
    const words = [
      { text: '前', begin: 1, end: 1.4 },
      { text: '中', begin: 1.4, end: 1.9 },
      { text: '拖', begin: 1.9, end: 5.2 }
    ];
    expect(shouldShakeTtmlFinalWord(words, words[2], true)).toBe(true);
    expect(shouldShakeTtmlFinalWord(words, words[1], true)).toBe(false);
    expect(shouldShakeTtmlFinalWord(words, words[2], false)).toBe(false);
    expect(
      shouldShakeTtmlFinalWord(
        [
          { text: '前', begin: 1, end: 2 },
          { text: '尾', begin: 2, end: 4 }
        ],
        { begin: 2, end: 4 },
        true
      )
    ).toBe(false);
  });
});
