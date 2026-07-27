<template>
  <div
    class="song-item"
    @contextmenu.prevent="handleContextMenu"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @dblclick.stop="playMusicEvent(item)"
    @touchstart.passive="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchmove="handleTouchEnd"
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
      @play="playMusicEvent(item)"
      @play-next="handlePlayNext"
      @download="downloadMusic(item)"
      @download-lyric="downloadLyric(item)"
      @bind-local-lyric="bindLocalLyric"
      @toggle-favorite="toggleFavorite"
      @toggle-dislike="toggleDislike"
      @remove="$emit('remove-song', $event)"
    />

    <!-- 移动端长按菜单 -->
    <mobile-song-action-sheet
      v-if="!isElectron && showActionSheet"
      :item="item"
      :show="showActionSheet"
      :is-favorite="isFavorite"
      :can-remove="canRemove"
      @update:show="showActionSheet = $event"
      @play="playMusicEvent(item); $emit('play', item)"
      @play-next="handlePlayNext"
      @add-to-playlist="handleAddToPlaylist"
      @favorite="toggleFavorite"
      @remove="$emit('remove-song', item.id)"
    />
  </div>
</template>

<script lang="ts" setup>
import { inject, ref } from 'vue';

import { useSongItem } from '@/hooks/useSongItem';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { getImgUrl, isElectron } from '@/utils';
import { readLocalLyricFile, selectLyricFile, setLocalLyricPath } from '@/utils/localLyricStorage';
import { parseTtml } from '@/utils/ttmlParser';
import { parseLyrics } from '@/utils/yrcParser';

import SongItemDropdown from './SongItemDropdown.vue';
import MobileSongActionSheet from '../MobileSongActionSheet.vue';

const props = defineProps<{
  item: SongResult;
  selectable?: boolean;
  selected?: boolean;
  canRemove?: boolean;
  isNext?: boolean;
  index?: number;
}>();

const emits = defineEmits(['play', 'select', 'remove-song', 'bind-local-lyric']);

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
  isHovering,
  handleImageLoad,
  playMusicEvent,
  toggleFavorite,
  toggleDislike,
  handlePlayNext,
  handleContextMenu,
  handleMenuClick,
  handleArtistClick,
  handleAlbumClick,
  handleMouseEnter,
  handleMouseLeave,
  downloadMusic,
  downloadLyric
} = useSongItem(props);

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
    const { loadLocalLyrics } = await import('@/hooks/useLocalMusic');
    const { isLocalSong } = await import('@/hooks/useLocalMusic');
    if (isLocalSong(playerStore.playMusic)) {
      const lyrics = await loadLocalLyrics(playerStore.playMusic);
      playerStore.playMusic.lyric = lyrics;
    }
  }
};

// 移动端长按菜单
const showActionSheet = ref(false);
let longPressTimer: number | null = null;

const handleTouchStart = () => {
  if (isElectron) return;
  longPressTimer = window.setTimeout(() => {
    showActionSheet.value = true;
  }, 500);
};

const handleTouchEnd = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
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
  handleMenuClick,
  playMusicEvent,
  toggleFavorite,
  handlePlayNext,
  playLoading,
  isPlaying,
  isFavorite,
  isDislike,
  artists,
  isHovering
});
</script>

<style lang="scss" scoped>
.song-item {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  @apply rounded-[var(--d-radius-lg)] p-3 flex items-center transition bg-transparent;
  color: var(--d-text-primary);
}

.text-ellipsis {
  width: 100%;
}
</style>
