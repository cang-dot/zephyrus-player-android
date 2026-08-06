import { computed } from 'vue';

import { nowTime } from '@/hooks/MusicHook';
import {
  getTtmlBackgroundLines,
  type TtmlBackgroundLine,
  type TtmlLine,
  type TtmlWord
} from '@/services/ttmlParser';
import { useAmllStore } from '@/store/modules/amll';

export interface TtmlPlaybackToken {
  text: string;
  key: string;
  begin: number;
  end: number;
}

export interface TtmlAuxiliaryToken extends TtmlPlaybackToken {
  slot: number;
  sourceKey: string;
  agent?: string;
}

function currentWord(words: TtmlWord[], time: number): TtmlWord | null {
  let candidate: TtmlWord | null = null;
  for (const word of words) {
    if (time >= word.begin) candidate = word;
    else break;
  }
  return candidate && time <= candidate.end ? candidate : null;
}

function currentPrimaryLine(lines: TtmlLine[], time: number): TtmlLine | null {
  let candidate: TtmlLine | null = null;
  for (const line of lines) {
    if (time >= line.begin) candidate = line;
    else break;
  }
  return candidate && time <= candidate.end ? candidate : null;
}

function sourceKey(line: TtmlBackgroundLine): string {
  return `${line.agent || 'nested'}:${line.begin}:${line.end}:${line.text}`;
}

export function useTtmlPlayback() {
  const amllStore = useAmllStore();
  const lyric = computed(() => amllStore.ttmlLyric);
  const primaryLines = computed(
    () => lyric.value?.lines.filter((line) => !line.isBackground) || []
  );
  const currentLine = computed(() => currentPrimaryLine(primaryLines.value, nowTime.value));
  const currentMainToken = computed<TtmlPlaybackToken | null>(() => {
    const line = currentLine.value;
    if (!line) return null;
    const word = currentWord(line.words, nowTime.value);
    const text = word?.text.trim();
    if (!word || !text) return null;
    return {
      text,
      begin: word.begin,
      end: word.end,
      key: `${line.key || line.begin}:${word.begin}:${text}`
    };
  });

  const auxiliaryTokens = computed<TtmlAuxiliaryToken[]>(() => {
    const activeLyric = lyric.value;
    if (!activeLyric) return [];
    const seen = new Set<string>();
    const tokens: TtmlAuxiliaryToken[] = [];
    let slot = 0;
    for (const line of getTtmlBackgroundLines(activeLyric, nowTime.value)) {
      const source = sourceKey(line);
      if (seen.has(source)) continue;
      seen.add(source);
      const currentSlot = slot;
      slot += 1;
      const word = currentWord(line.words, nowTime.value);
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

  const available = computed(() => amllStore.hasTtml && Boolean(currentMainToken.value));
  const stableAnimationKey = computed(() => currentMainToken.value?.key || 'ttml-unavailable');

  return {
    lyric,
    loading: computed(() => amllStore.loading),
    error: computed(() => amllStore.error),
    available,
    currentLine,
    currentMainToken,
    auxiliaryTokens,
    stableAnimationKey
  };
}
