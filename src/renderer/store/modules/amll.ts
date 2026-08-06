/** Current AMLL TTML lyric state. */

import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

import { getAmllLyricForSong, resolveAmllSource } from '@/api/amllLyrics';
import type { TtmlLyric } from '@/services/ttmlParser';

import { usePlayerStore } from './player';

export const useAmllStore = defineStore('amll', () => {
  const ttmlLyric = ref<TtmlLyric | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentSource = ref<string | null>(null);
  let requestId = 0;

  async function loadForSong(song: Parameters<typeof resolveAmllSource>[0] | null | undefined) {
    const source = song ? resolveAmllSource(song) : null;
    const sourceKey = source ? `${source.platform}:${source.songId}` : null;
    requestId += 1;
    const activeRequest = requestId;

    if (!source) {
      ttmlLyric.value = null;
      currentSource.value = null;
      error.value = null;
      loading.value = false;
      return;
    }
    if (sourceKey === currentSource.value && ttmlLyric.value) return;

    loading.value = true;
    error.value = null;
    currentSource.value = sourceKey;
    ttmlLyric.value = null;
    try {
      const result = await getAmllLyricForSong(song!);
      if (activeRequest !== requestId) return;
      ttmlLyric.value = result;
      if (!result) error.value = 'AMLL TTML lyric not found';
    } catch (loadError) {
      if (activeRequest !== requestId) return;
      ttmlLyric.value = null;
      error.value = loadError instanceof Error ? loadError.message : 'Failed to load AMLL lyric';
    } finally {
      if (activeRequest === requestId) loading.value = false;
    }
  }

  function clear() {
    requestId += 1;
    ttmlLyric.value = null;
    currentSource.value = null;
    loading.value = false;
    error.value = null;
  }

  const hasTtml = computed(() => Boolean(ttmlLyric.value?.lines.length));
  const playerStore = usePlayerStore();

  watch(
    () => playerStore.currentSong,
    (song) => {
      if (!song) clear();
      else void loadForSong(song);
    },
    { immediate: true }
  );

  return {
    ttmlLyric,
    loading,
    error,
    hasTtml,
    currentSource,
    loadForSong,
    clear
  };
});
