<template>
  <div
    ref="songItemRef"
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
  </div>
</template>

<script lang="ts" setup>
import { inject, ref } from 'vue';

import {
  type MobileSongActionOrigin,
  useMobileSongActionSurface
} from '@/composables/useMobileSongActionSurface';
import { isLocalSong, useLocalMusic } from '@/hooks/useLocalMusic';
import { useSongItem } from '@/hooks/useSongItem';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { isElectron } from '@/utils';
import { selectLyricFile, setLocalLyricPath } from '@/utils/localLyricStorage';

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
const songItemRef = ref<HTMLElement | null>(null);
const songActionSurface = useMobileSongActionSurface();
const songActionOrigin = inject<MobileSongActionOrigin>('mobileSongActionOrigin', 'mini-player');

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
let longPressTimer: number | null = null;
let suppressClickUntil = 0;

const openMobileActionSheet = () => {
  songActionSurface.open({
    item: props.item,
    isFavorite: isFavorite.value,
    canRemove: props.canRemove,
    origin: songActionOrigin,
    sourceElement: songItemRef.value,
    callbacks: {
      play: requestPlay,
      playNext: handlePlayNext,
      favorite: toggleFavorite,
      remove: () => emits('remove-song', props.item.id),
      gotoArtist: handleArtistClick,
      gotoAlbum: handleAlbumClick
    }
  });
};

const handleTouchStart = () => {
  if (isElectron) return;
  cancelLongPress();
  longPressTimer = window.setTimeout(() => {
    suppressClickUntil = Date.now() + 700;
    activate();
    openMobileActionSheet();
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
  openMobileActionSheet();
};

const handleItemContextMenu = (event: MouseEvent) => {
  if (isElectron) {
    handleContextMenu(event);
    return;
  }
  suppressClickUntil = Date.now() + 700;
  openMobileActionSheet();
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
    background-color 90ms ease,
    transform 90ms cubic-bezier(0.23, 1, 0.32, 1);

  &:active {
    transform: scale(0.99);
  }

  &.is-active {
    /* 点击反馈只做轻微着色:不透明浅灰块叠在深色玻璃面上会变成刺眼白块 */
    background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.12);
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
