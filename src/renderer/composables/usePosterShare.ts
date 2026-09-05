/**
 * 歌词海报分享 Composable
 * 统一管理海报分享的状态和事件处理
 * 供所有移动端播放器组件使用
 */

import { ref } from 'vue';

import type { PosterSubject, SelectedLyric } from '@/types/share';

export function usePosterShare() {
  const showPosterModal = ref(false);
  const selectedLyrics = ref<SelectedLyric[]>([]);
  /** 外部主题（歌单/专辑页入口）；空 = 播放器歌曲海报 */
  const posterSubject = ref<PosterSubject | undefined>(undefined);

  function handleGeneratePoster(lyrics: SelectedLyric[]) {
    posterSubject.value = undefined;
    selectedLyrics.value = lyrics;
    showPosterModal.value = true;
  }

  /** 直接打开某个主题（歌单/专辑/歌曲）的海报，无需摘录歌词 */
  function openPosterForSubject(subject: PosterSubject) {
    selectedLyrics.value = [];
    posterSubject.value = subject;
    showPosterModal.value = true;
  }

  return {
    showPosterModal,
    selectedLyrics,
    posterSubject,
    handleGeneratePoster,
    openPosterForSubject
  };
}
