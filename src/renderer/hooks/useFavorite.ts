/**
 * 收藏 Hook
 */
import { computed } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';

export function useFavorite() {
  const playerStore = usePlayerStore();

  const songId = computed(() => {
    const id = playMusic.value?.id;
    if (!id) return null;
    return typeof id === 'string' ? parseInt(id, 10) : id;
  });

  const isFavorite = computed(() => {
    const id = songId.value;
    if (!id) return false;
    return playerStore.favoriteList.includes(id);
  });

  const toggleFavorite = () => {
    const id = songId.value;
    if (!id) return;
    if (isFavorite.value) {
      playerStore.removeFromFavorite(id);
    } else {
      playerStore.addToFavorite(id);
    }
  };

  return {
    isFavorite,
    toggleFavorite
  };
}
