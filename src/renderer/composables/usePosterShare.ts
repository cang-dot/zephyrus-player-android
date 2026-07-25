/**
 * 歌词海报分享 Composable
 * 统一管理海报分享的状态和事件处理
 * 供所有移动端播放器组件使用
 */

import { ref } from 'vue';

import type { SelectedLyric } from '@/types/share';

export function usePosterShare() {
  const showPosterModal = ref(false);
  const selectedLyrics = ref<SelectedLyric[]>([]);

  function handleGeneratePoster(lyrics: SelectedLyric[]) {
    selectedLyrics.value = lyrics;
    showPosterModal.value = true;
  }

  return {
    showPosterModal,
    selectedLyrics,
    handleGeneratePoster
  };
}
