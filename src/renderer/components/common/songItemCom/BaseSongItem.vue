<template>
  <div
    class="song-item"
    :class="{ 'is-active': isActive }"
    @click="handleItemClick"
    @contextmenu.prevent="handleItemContextMenu"
    @touchstart.passive="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchmove.passive="handleTouchMove"
    @touchcancel="cancelLongPress"
  >
    <slot name="index"></slot>
    <slot name="select" v-if="selectable"></slot>
    <slot name="image"></slot>
    <slot name="content"></slot>
    <slot name="operating"></slot>

    <!-- 桌面端右键菜单 -->
    <song-item-dropdown
      v-if="isElectron"
      :item="item"
      :show="showDropdown"
      :x="dropdownX"
      :y="dropdownY"
      :is-favorite="isFavorite"
      :is-dislike="isDislike"
      :can-remove="canRemove"
      @update:show="showDropdown = $event"
      @play="requestPlay"
      @play-next="handlePlayNext"
      @download="downloadMusic(item)"
      @download-lyric="downloadLyric(item)"
      @bind-local-lyric="bindLocalLyric"
      @toggle-favorite="toggleFavorite"
      @toggle-dislike="toggleDislike"
      @goto-artist="handleArtistClick"
      @goto-album="handleAlbumClick"
      @remove="$emit('remove-song', $event)"
    />

    <!-- 移动端长按菜单 -->
    <mobile-song-action-sheet
      v-if="!isElectron"
      :item="item"
      :show="showActionSheet"
      :is-favorite="isFavorite"
      :can-remove="canRemove"
      @update:show="showActionSheet = $event"
      @play="requestPlay"
      @play-next="handlePlayNext"
      @add-to-playlist="handleAddToPlaylist"
      @favorite="toggleFavorite"
      @goto-artist="handleArtistClick($event)"
      @goto-album="handleAlbumClick($event)"
      @remove="$emit('remove-song', item.id)"
    />
  </div>
</template>

<script lang="ts" setup>
import { inject, ref } from 'vue';

import { isLocalSong, useLocalMusic } from '@/hooks/useLocalMusic';
import { useSongItem } from '@/hooks/useSongItem';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { isElectron } from '@/utils';
import { selectLyricFile, setLocalLyricPath } from '@/utils/localLyricStorage';

import MobileSongActionSheet from '../MobileSongActionSheet.vue';
import SongItemDropdown from './SongItemDropdown.vue';

const props = defineProps<{
  item: SongResult;
  selectable?: boolean;
  selected?: boolean;
  canRemove?: boolean;
  isNext?: boolean;
  index?: number;
}>();

const emits = defineEmits<{
  play: [item: SongResult];
  select: [id: string | number, selected: boolean];
  'remove-song': [id: string | number];
  'bind-local-lyric': [];
}>();

const playerStore = usePlayerStore();

// 使用公共逻辑
const {
  playLoading,
  isPlaying,
  isFavorite,
  isDislike,
  artists,
  showDropdown,
  dropdownX,
  dropdownY,
  isActive,
  handleImageLoad,
  playMusicEvent,
  toggleFavorite,
  toggleDislike,
  handlePlayNext,
  handleContextMenu,
  handleMenuClick,
  handleArtistClick,
  handleAlbumClick,
  activate,
  downloadMusic,
  downloadLyric
} = useSongItem(props);
const { loadLocalLyrics } = useLocalMusic();

const requestPlay = () => {
  emits('play', props.item);
};

const handleItemClick = () => {
  if (props.selectable) return;
  if (Date.now() < suppressClickUntil) return;
  activate();
  requestPlay();
};

// 处理图片加载
const imageLoad = async (event: Event) => {
  const target = event.target as HTMLImageElement;
  if (!target) return;
  await handleImageLoad(target);
};

// 切换选择状态
const toggleSelect = () => {
  emits('select', props.item.id, !props.selected);
};

// 绑定本地歌词文件
const bindLocalLyric = async () => {
  if (!isElectron) return;
  const songId = props.item.id?.toString();
  if (!songId) return;

  const filePath = await selectLyricFile();
  if (!filePath) return;

  setLocalLyricPath(songId, filePath);

  // 如果当前正在播放这首歌，立即重新加载歌词
  if (playerStore.playMusic?.id?.toString() === songId) {
    if (isLocalSong(playerStore.playMusic)) {
      const lyrics = await loadLocalLyrics(playerStore.playMusic);
      playerStore.playMusic.lyric = lyrics;
    }
  }
};

// 移动端长按菜单
const showActionSheet = ref(false);
let longPressTimer: number | null = null;
let suppressClickUntil = 0;

const handleTouchStart = () => {
  if (isElectron) return;
  cancelLongPress();
  longPressTimer = window.setTimeout(() => {
    suppressClickUntil = Date.now() + 700;
    activate();
    showActionSheet.value = true;
    longPressTimer = null;
  }, 500);
};

const cancelLongPress = () => {
  if (longPressTimer) {
    window.clearTimeout(longPressTimer);
    longPressTimer = null;
  }
};

const handleTouchEnd = () => cancelLongPress();
const handleTouchMove = () => cancelLongPress();

const openItemMenu = (event: MouseEvent) => {
  if (isElectron) {
    handleMenuClick(event);
    return;
  }
  showActionSheet.value = true;
};

const handleItemContextMenu = (event: MouseEvent) => {
  if (isElectron) {
    handleContextMenu(event);
    return;
  }
  suppressClickUntil = Date.now() + 700;
  showActionSheet.value = true;
};

// 移动端添加到歌单
const openPlaylistDrawer = inject<(songOrId: number | SongResult) => void>('openPlaylistDrawer');
const handleAddToPlaylist = () => {
  openPlaylistDrawer?.(props.item);
};
defineExpose({
  imageLoad,
  toggleSelect,
  handleArtistClick,
  handleAlbumClick,
  openItemMenu,
  playMusicEvent,
  handleItemClick,
  toggleFavorite,
  handlePlayNext,
  playLoading,
  isPlaying,
  isFavorite,
  isDislike,
  artists,
  isActive
});
</script>

<style lang="scss" scoped>
.song-item {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  @apply rounded-[var(--d-radius-lg)] p-3 flex items-center bg-transparent;
  color: var(--d-text-primary);
  cursor: pointer;
  transition:
    background-color 160ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:active {
    transform: scale(0.99);
  }

  &.is-active {
    background: var(--d-surface-hover);
  }
}

.text-ellipsis {
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .song-item {
    transition: background-color 120ms ease;
  }

  .song-item:active {
    transform: none;
  }
}
</style>
