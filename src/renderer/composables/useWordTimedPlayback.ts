import { computed, ref, watch } from 'vue';

import { resolveAmllSource } from '@/api/amllLyrics';
import { correctionTime, lrcArray, nowIndex, nowTime, playMusic } from '@/hooks/MusicHook';
import {
  getTtmlBackgroundLines,
  type TtmlBackgroundLine,
  type TtmlLine,
  type TtmlWord
} from '@/services/ttmlParser';
import { useAmllStore } from '@/store/modules/amll';
import type { IWordData, LyricFormat } from '@/types/music';

export interface WordPlaybackToken {
  text: string;
  key: string;
  begin: number;
  end: number;
}

export interface WordAuxiliaryToken extends WordPlaybackToken {
  slot: number;
  sourceKey: string;
  agent?: string;
}

function currentTtmlWord(words: TtmlWord[], time: number): TtmlWord | null {
  let candidate: TtmlWord | null = null;
  for (const word of words) {
    if (time >= word.begin) candidate = word;
    else break;
  }
  return candidate && time <= candidate.end ? candidate : null;
}

function currentTtmlLine(lines: TtmlLine[], time: number): TtmlLine | null {
  let candidate: TtmlLine | null = null;
  for (const line of lines) {
    if (time >= line.begin) candidate = line;
    else break;
  }
  return candidate && time <= candidate.end ? candidate : null;
}

function currentProviderWord(words: IWordData[], timeMs: number): IWordData | null {
  let candidate: IWordData | null = null;
  for (const word of words) {
    if (timeMs >= word.startTime) candidate = word;
    else break;
  }
  return candidate && timeMs <= candidate.startTime + candidate.duration ? candidate : null;
}

function auxiliarySourceKey(line: TtmlBackgroundLine): string {
  return `${line.agent || 'nested'}:${line.begin}:${line.end}:${line.text}`;
}

export function useWordTimedPlayback() {
  const amllStore = useAmllStore();
  const lyric = computed(() => amllStore.ttmlLyric);
  const correctedTime = computed(() => Math.max(0, nowTime.value + correctionTime.value));
  const expectedTtmlSource = computed(() => {
    const song = playMusic.value;
    const source = song ? resolveAmllSource(song) : null;
    return source ? `${source.platform}:${source.songId}` : null;
  });
  const ttmlMatchesSong = computed(
    () => Boolean(lyric.value) && amllStore.currentSource === expectedTtmlSource.value
  );
  const primaryLines = computed(
    () =>
      (ttmlMatchesSong.value ? lyric.value?.lines.filter((line) => !line.isBackground) : []) || []
  );
  const currentLine = computed(() => currentTtmlLine(primaryLines.value, correctedTime.value));
  const ttmlMainToken = computed<WordPlaybackToken | null>(() => {
    const line = currentLine.value;
    if (!line) return null;
    const word = currentTtmlWord(line.words, correctedTime.value);
    const text = word?.text.trim();
    if (!word || !text) return null;
    return {
      text,
      begin: word.begin,
      end: word.end,
      key: `ttml:${line.key || line.begin}:${word.begin}:${text}`
    };
  });

  const providerLine = computed(() => lrcArray.value[nowIndex.value] || null);
  const providerHasWordTiming = computed(() =>
    lrcArray.value.some((line) => Boolean(line.words?.length))
  );
  const providerMainToken = computed<WordPlaybackToken | null>(() => {
    const line = providerLine.value;
    if (!line?.words?.length) return null;
    const word = currentProviderWord(line.words, correctedTime.value * 1000);
    const text = word?.text.trim();
    if (!word || !text) return null;
    return {
      text,
      begin: word.startTime / 1000,
      end: (word.startTime + word.duration) / 1000,
      key: `provider:${line.startTime || 0}:${word.startTime}:${text}`
    };
  });

  const useTtmlMain = ref(false);
  const pendingTtmlSwitch = ref(false);

  watch(expectedTtmlSource, () => {
    useTtmlMain.value = false;
    pendingTtmlSwitch.value = false;
  });
  watch(
    [ttmlMatchesSong, providerHasWordTiming],
    ([hasTtml, hasProviderTiming]) => {
      if (!hasTtml) {
        useTtmlMain.value = false;
        pendingTtmlSwitch.value = false;
      } else if (!hasProviderTiming) {
        useTtmlMain.value = true;
        pendingTtmlSwitch.value = false;
      } else if (!useTtmlMain.value) {
        pendingTtmlSwitch.value = true;
      }
    },
    { immediate: true }
  );
  watch(nowIndex, (_current, previous) => {
    if (pendingTtmlSwitch.value && previous !== undefined) {
      useTtmlMain.value = true;
      pendingTtmlSwitch.value = false;
    }
  });

  const usingTtml = computed(() => useTtmlMain.value && ttmlMatchesSong.value);
  const currentMainToken = computed(() =>
    usingTtml.value ? ttmlMainToken.value : providerMainToken.value
  );
  const auxiliaryTokens = computed<WordAuxiliaryToken[]>(() => {
    if (!usingTtml.value || !lyric.value) return [];
    const seen = new Set<string>();
    const tokens: WordAuxiliaryToken[] = [];
    let slot = 0;
    for (const line of getTtmlBackgroundLines(lyric.value, correctedTime.value)) {
      const source = auxiliarySourceKey(line);
      if (seen.has(source)) continue;
      seen.add(source);
      const currentSlot = slot;
      slot += 1;
      const word = currentTtmlWord(line.words, correctedTime.value);
      const text = word?.text.trim();
      if (word && text) {
        tokens.push({
          text,
          begin: word.begin,
          end: word.end,
          key: `${source}:${word.begin}:${text}`,
          sourceKey: source,
          agent: line.agent,
          slot: currentSlot
        });
      }
      if (slot === 3) break;
    }
    return tokens;
  });

  const source = computed<LyricFormat | 'none'>(() => {
    if (usingTtml.value) return 'ttml';
    return playMusic.value?.lyric?.format || (providerHasWordTiming.value ? 'yrc' : 'none');
  });
  const available = computed(() => Boolean(currentMainToken.value));
  const stableAnimationKey = computed(
    () => currentMainToken.value?.key || `${source.value}-unavailable`
  );

  return {
    lyric,
    loading: computed(() => amllStore.loading),
    error: computed(() => amllStore.error),
    available,
    source,
    usingTtml,
    currentLine,
    currentMainToken,
    auxiliaryTokens,
    stableAnimationKey
  };
}
