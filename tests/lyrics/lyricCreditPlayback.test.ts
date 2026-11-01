import { computed, effectScope, nextTick, ref, reactive } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TtmlLyric } from '@/services/ttmlParser';
import type { ILyricText } from '@/types/music';
import { normalizeCreditConfig, projectCreditLyrics } from '@/utils/lyricCredits';

const state = vi.hoisted(() => ({ hooks: null as any, store: null as any, config: null as any }));

vi.mock('@/store/modules/amll', () => ({ useAmllStore: () => state.store }));
vi.mock('@/api/amllLyrics', () => ({
  resolveAmllSource: (song: { id: string }) => ({ platform: 'netease', songId: song.id })
}));
vi.mock('@/services/lyricCreditConfig', () => ({
  get lyricCreditConfig() {
    return state.config;
  }
}));

describe('credit display playback integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/hooks/MusicHook', () => state.hooks);
    state.config = ref(normalizeCreditConfig({ hideIntroOutroCredits: true }));
    const raw = ref<ILyricText[]>(
      ['作词：甲', '正文', '制作:乙'].map((text, i) => ({
        text,
        trText: 'translation',
        startTime: i * 4000,
        duration: 3000,
        words: [{ text, startTime: i * 4000, duration: 3000 }]
      }))
    );
    state.hooks = {
      lrcArray: raw,
      displayLrcArray: computed(() => projectCreditLyrics(raw.value, state.config.value)),
      lrcTimeArray: ref([0, 4, 8]),
      nowTime: ref(1),
      nowIndex: ref(0),
      correctionTime: ref(0),
      playMusic: ref({ id: 'song1', lyric: { format: 'yrc' } })
    };
    state.store = reactive({
      ttmlLyric: null as TtmlLyric | null,
      currentSource: null,
      loading: false,
      error: null
    });
  });
  it('hides provider words and auxiliary text immediately without changing time, seek indexes or source', async () => {
    const { useWordTimedPlayback } = await import('@/composables/useWordTimedPlayback');
    const scope = effectScope();
    const p = scope.run(useWordTimedPlayback)!;
    expect(p.currentDisplayLine.value).toBeNull();
    expect(p.currentMainToken.value).toBeNull();
    state.hooks.nowIndex.value = 1;
    state.hooks.nowTime.value = 4.5;
    expect(p.currentDisplayLine.value?.text).toBe('正文');
    expect(p.currentMainToken.value?.text).toBe('正文');
    state.hooks.nowIndex.value = 2;
    state.hooks.nowTime.value = 8.5;
    expect(p.currentDisplayLine.value).toBeNull();
    expect(p.currentMainToken.value).toBeNull();
    state.config.value = normalizeCreditConfig();
    expect(p.currentDisplayLine.value?.text).toBe('制作:乙');
    expect(state.hooks.nowTime.value).toBe(8.5);
    expect(p.displayTimes.value).toEqual([0, 4, 8]);
    expect(state.hooks.lrcArray.value[2].text).toBe('制作:乙');
    scope.stop();
  });
  it('cleans TTML groups, honors original ends and async replacement/song switches', async () => {
    state.hooks.nowTime.value = 0;
    const { useWordTimedPlayback } = await import('@/composables/useWordTimedPlayback');
    const scope = effectScope();
    const p = scope.run(useWordTimedPlayback)!;
    const makeTtml = (texts: string[]): TtmlLyric => ({
      lines: texts.map((text, i) => ({
        text,
        begin: i * 4,
        end: i * 4 + 2,
        words: [{ text, begin: i * 4, end: i * 4 + 2 }],
        isBackground: false,
        translations: [],
        romanizations: [],
        background: [
          {
            text: 'backing',
            begin: i * 4,
            end: i * 4 + 2,
            words: [{ text: 'backing', begin: i * 4, end: i * 4 + 2 }],
            translations: [],
            romanizations: []
          }
        ]
      })),
      duration: 12,
      timingMode: 'word',
      agents: [],
      parts: [],
      meta: {}
    });
    state.store.currentSource = 'netease:song1';
    state.store.ttmlLyric = makeTtml(['編曲:甲', '正文', '錄音：乙']);
    await nextTick();
    expect(p.usingTtml.value).toBe(true);
    state.hooks.nowTime.value = 1;
    expect(p.currentDisplayLine.value).toBeNull();
    expect(p.auxiliaryLines.value).toEqual([]);
    state.hooks.nowTime.value = 4.5;
    expect(p.currentDisplayLine.value?.text).toBe('正文');
    expect(p.auxiliaryTokens.value).toHaveLength(1);
    state.hooks.nowTime.value = 6.1;
    expect(p.currentDisplayLine.value).toBeNull();
    state.hooks.nowTime.value = 9;
    expect(p.currentDisplayLine.value).toBeNull();
    expect(p.auxiliaryTokens.value).toEqual([]);
    state.store.ttmlLyric = makeTtml(['作词:甲', '制作:乙']);
    expect(p.hasDisplayLyrics.value).toBe(false);
    expect(p.source.value).toBe('ttml');
    state.hooks.playMusic.value = { id: 'song2' };
    state.hooks.lrcArray.value = [];
    state.hooks.lrcTimeArray.value = [];
    await nextTick();
    expect(p.usingTtml.value).toBe(false);
    expect(p.displayLines.value).toEqual([]);
    scope.stop();
  });
});
