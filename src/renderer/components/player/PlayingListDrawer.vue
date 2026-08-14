<template>
  <!-- 透明遮罩层，点击任意位置关闭 -->
  <div
    v-if="internalVisible && !embedded"
    class="fixed-overlay"
    :class="{ 'playback-overlay': isPlaybackPlaylist }"
    @click="closePanel"
  ></div>

  <!-- 使用animate.css进行动画效果 -->
  <div
    v-if="internalVisible"
    class="playlist-panel"
    :class="[
      'animate__animated',
      panelAnimationClass,
      {
        'playback-playlist': isPlaybackPlaylist,
        embedded,
        'embedded-settled': embedded && embeddedSettled,
        'embedded-closing': embedded && closing,
        dragging: panelDragging
      }
    ]"
    :style="panelDragStyle"
    @animationend="onAnimationEnd"
  >
    <div
      class="playlist-panel-header"
      @pointerdown="onPanelPointerDown"
      @pointermove="onPanelPointerMove"
      @pointerup="onPanelPointerUp"
      @pointercancel="onPanelPointerCancel"
    >
      <div class="title">{{ t('player.playBar.playList') }}</div>
      <div class="header-actions">
        <n-tooltip trigger="hover">
          <template #trigger>
            <div class="action-btn" @click="handleClearPlaylist">
              <i class="iconfont ri-delete-bin-line"></i>
            </div>
          </template>
          {{ t('player.playList.clearAll') }}
        </n-tooltip>
        <div class="close-btn" @click="closePanel">
          <i class="iconfont ri-close-line"></i>
        </div>
      </div>
    </div>
    <div class="playlist-panel-content">
      <div v-if="playList.length === 0" class="empty-playlist">
        <i class="iconfont ri-music-2-line"></i>
        <p>{{ t('player.playList.empty') }}</p>
      </div>
      <n-virtual-list v-else ref="playListRef" :item-size="62" item-resizable :items="playList">
        <template #default="{ item }">
          <div class="music-play-list-content">
            <div class="flex items-center justify-between">
              <song-item
                :key="item.id"
                class="flex-1"
                :item="item"
                mini
                :can-remove="true"
                @play="playerStore.setPlay"
                @remove-song="handleDeleteSong(item)"
              />
            </div>
          </div>
        </template>
      </n-virtual-list>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDialog, useMessage } from 'naive-ui';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import SongItem from '@/components/common/SongItem.vue';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { isMobile } from '@/utils';

const props = withDefaults(
  defineProps<{
    /** Mobile dock mode: the parent dock supplies the glass surface and geometry. */
    embedded?: boolean;
    /** Full-screen mobile player mode: portrait sheet or landscape side drawer. */
    fullscreen?: boolean;
  }>(),
  { embedded: false, fullscreen: false }
);

const { t } = useI18n();
const message = useMessage();
const dialog = useDialog();
const playerStore = usePlayerStore();
const embedded = computed(() => props.embedded && isMobile.value);
const playList = computed(() => playerStore.playList as SongResult[]);
const isPlaybackPlaylist = computed(() => props.fullscreen && isMobile.value);
const isLandscape = ref(false);
const updateOrientation = () => {
  isLandscape.value = window.matchMedia('(orientation: landscape)').matches;
};
const panelAnimationClass = computed(() => {
  if (embedded.value) return '';
  if (!isMobile.value || (isPlaybackPlaylist.value && isLandscape.value)) {
    return closing.value ? 'animate__slideOutRight' : 'animate__slideInRight';
  }
  return closing.value ? 'animate__slideOutDown' : 'animate__slideInUp';
});

// 内部状态控制组件的可见性
const internalVisible = ref(false);
const closing = ref(false);
const embeddedSettled = ref(false);
const panelDragging = ref(false);
const panelDragOffset = ref(0);
let panelPointerId: number | null = null;
let panelPointerStart = 0;
let panelPointerStartTime = 0;
let embeddedCloseTimer: ReturnType<typeof setTimeout> | undefined;

const isSideDrawer = computed(
  () => isMobile.value && isPlaybackPlaylist.value && isLandscape.value
);
const panelDragStyle = computed(() => {
  if (!panelDragOffset.value) return undefined;
  return {
    transform: isSideDrawer.value
      ? `translate3d(${panelDragOffset.value}px, 0, 0)`
      : `translate3d(0, ${panelDragOffset.value}px, 0)`,
    transition: panelDragging.value ? 'none' : undefined
  };
});

const onPanelPointerDown = (event: PointerEvent) => {
  if (
    !isMobile.value ||
    !event.isPrimary ||
    (event.target as Element).closest('button, .action-btn, .close-btn')
  ) {
    return;
  }
  panelDragging.value = true;
  panelPointerId = event.pointerId;
  panelPointerStart = isSideDrawer.value ? event.clientX : event.clientY;
  panelPointerStartTime = Date.now();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};

const onPanelPointerMove = (event: PointerEvent) => {
  if (!panelDragging.value || event.pointerId !== panelPointerId) return;
  const current = isSideDrawer.value ? event.clientX : event.clientY;
  const delta = current - panelPointerStart;
  panelDragOffset.value = delta >= 0 ? delta : delta * 0.16;
};

const releasePanelPointer = (event: PointerEvent) => {
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  panelPointerId = null;
};

const onPanelPointerUp = (event: PointerEvent) => {
  if (!panelDragging.value || event.pointerId !== panelPointerId) return;
  const elapsed = Math.max(1, Date.now() - panelPointerStartTime);
  const velocity = panelDragOffset.value / elapsed;
  const shouldClose = panelDragOffset.value > 72 || velocity > 0.55;
  releasePanelPointer(event);
  panelDragging.value = false;
  panelDragOffset.value = 0;
  if (shouldClose) {
    if (navigator.vibrate) navigator.vibrate(8);
    closePanel();
  }
};

const onPanelPointerCancel = (event: PointerEvent) => {
  if (!panelDragging.value || event.pointerId !== panelPointerId) return;
  releasePanelPointer(event);
  panelDragging.value = false;
  panelDragOffset.value = 0;
};

// 当前是否显示播放列表面板
const show = computed({
  get: () => playerStore.playListDrawerVisible,
  set: (value) => {
    playerStore.setPlayListDrawerVisible(value);
  }
});

// 监听外部可见性变化
watch(
  show,
  (newValue) => {
    if (newValue) {
      // 打开面板
      internalVisible.value = true;
      closing.value = false;
      embeddedSettled.value = false;
      // 在下一个渲染周期后滚动到当前歌曲
      nextTick(() => {
        scrollToCurrentSong();
        if (embedded.value) {
          requestAnimationFrame(() => {
            embeddedSettled.value = true;
          });
        }
      });
    } else {
      if (embedded.value) {
        closing.value = true;
        embeddedSettled.value = false;
        if (embeddedCloseTimer) clearTimeout(embeddedCloseTimer);
        embeddedCloseTimer = setTimeout(() => {
          internalVisible.value = false;
          closing.value = false;
          panelDragOffset.value = 0;
          embeddedCloseTimer = undefined;
        }, 300);
        return;
      }
      // 如果已经是关闭状态，不需要处理
      if (!internalVisible.value) return;

      // 开始关闭动画，等 animationend 后再隐藏
      closing.value = true;
    }
  },
  { immediate: true }
);

// 播放列表引用
const playListRef = ref<any>(null);

// 关闭面板
const closePanel = () => {
  show.value = false;
};

// 动画结束后隐藏组件
const onAnimationEnd = () => {
  if (closing.value) {
    internalVisible.value = false;
  }
};

// 清空播放列表
const handleClearPlaylist = () => {
  if (playList.value.length === 0) {
    message.info(t('player.playList.alreadyEmpty'));
    return;
  }

  if (isMobile.value) {
    closePanel();
  }

  dialog.warning({
    title: t('player.playList.clearConfirmTitle'),
    content: t('player.playList.clearConfirmContent'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    style: { zIndex: 999999999 }, // 确保对话框显示在遮罩之上
    onPositiveClick: () => {
      // 清空播放列表
      playerStore.clearPlayAll();
      message.success(t('player.playList.cleared'));
    }
  });
};

// 处理键盘事件
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && internalVisible.value) {
    closePanel();
  }
};

// 添加和移除键盘事件监听
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  updateOrientation();
  window.addEventListener('resize', updateOrientation);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('resize', updateOrientation);
  if (embeddedCloseTimer) clearTimeout(embeddedCloseTimer);
});

// 滚动到当前播放歌曲
const scrollToCurrentSong = () => {
  // 延长等待时间，确保列表已渲染完成
  setTimeout(() => {
    if (playListRef.value && playList.value.length > 0) {
      const index = playerStore.playListIndex;
      playListRef.value.scrollTo({
        top: (index > 3 ? index - 3 : 0) * 62
      });
    }
  }, 100);
};

// 删除歌曲
const handleDeleteSong = (song: SongResult) => {
  playerStore.removeFromPlayList(song.id as number);
};
</script>

<style lang="scss" scoped>
.fixed-overlay {
  @apply fixed inset-0 z-[999999];
  pointer-events: auto; // 允许点击关闭
  cursor: default;
}

.playlist-panel {
  @apply fixed right-0 z-[9999999] rounded-l-xl overflow-hidden;
  width: 350px;
  height: 70vh;
  top: 15vh; // 距离顶部15%
  animation-duration: 0.4s !important; // 动画持续时间

  @apply bg-light dark:bg-dark shadow-2xl dark:border dark:border-gray-700;

  &.embedded {
    position: absolute;
    z-index: 2;
    inset: 0 0 68px;
    width: auto;
    height: auto;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    animation: none !important;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    opacity: 0;
    transform: translate3d(0, 14px, 0) scaleY(0.08);
    transform-origin: center bottom;
    transition:
      transform 420ms cubic-bezier(0.32, 0.72, 0, 1),
      opacity 180ms ease;

    &.embedded-settled {
      opacity: 1;
      transform: translate3d(0, 0, 0) scaleY(1);
    }

    &.embedded-closing {
      opacity: 0;
      transform: translate3d(0, 14px, 0) scaleY(0.08);
    }

    .playlist-panel-header {
      min-height: 42px;
      padding-right: 14px;
      padding-left: 14px;
      border-bottom-color: color-mix(in srgb, var(--m-glass-border) 58%, transparent);
    }

    .playlist-panel-content {
      height: calc(100% - 42px);
      padding: 0 8px 8px;
    }

    .music-play-list-content {
      border-radius: 14px;
    }
  }

  &-header {
    @apply flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-900;
    background: transparent;
    touch-action: none;
    cursor: grab;

    .title {
      @apply text-base font-medium text-gray-800 dark:text-gray-200;
    }

    .header-actions {
      @apply flex items-center;
    }

    .action-btn,
    .close-btn {
      @apply w-8 h-8 flex items-center justify-center rounded-full cursor-pointer mx-1 text-gray-800 dark:text-gray-200;
      @apply hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors;

      .iconfont {
        @apply text-xl;
      }
    }

    .action-btn {
      @apply text-gray-500 dark:text-gray-400;
      &:hover {
        @apply text-red-500 dark:text-red-400;
      }
    }
  }

  &-content {
    @apply h-[calc(70vh-60px)] overflow-hidden;
  }
}

.empty-playlist {
  @apply flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500;

  .iconfont {
    @apply text-5xl mb-4;
  }

  p {
    @apply text-sm;
  }
}

.music-play-list-content {
  @apply hover:bg-light-100 dark:hover:bg-dark-100;
}

// 移动端适配
@media (max-width: 768px) {
  .fixed-overlay {
    z-index: 190;
    background: rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);

    &.playback-overlay {
      z-index: 10000020;
      background: rgba(0, 0, 0, 0.22);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
  }

  .playlist-panel {
    position: fixed;
    z-index: 198;
    right: 12px;
    left: 12px;
    width: auto;
    height: min(62dvh, 500px);
    top: auto;
    bottom: calc(var(--safe-area-inset-bottom, 0px) + 14px);
    border-radius: 32px;
    border-left: none;
    border: 1px solid var(--player-glass-border, rgba(255, 255, 255, 0.24));
    box-shadow: 0 -5px 16px rgba(0, 0, 0, 0.1);
    background: var(--player-glass-background, rgba(20, 20, 22, 0.22));
    backdrop-filter: var(--player-glass-filter, blur(12px) saturate(145%));
    -webkit-backdrop-filter: var(--player-glass-filter, blur(12px) saturate(145%));
    padding-bottom: 58px;
    transform-origin: center bottom;

    @supports not (backdrop-filter: blur(1px)) {
      background: var(--player-glass-background-fallback, rgba(24, 24, 26, 0.52));
    }

    &.animate__slideInUp {
      animation-name: mobile-playlist-morph-in !important;
    }

    &.animate__slideOutDown {
      animation-name: mobile-playlist-morph-out !important;
    }

    &-header {
      @apply relative px-4;
    }

    &.dragging .playlist-panel-header {
      cursor: grabbing;
    }

    &-content {
      height: calc(min(62dvh, 500px) - 64px);
      @apply px-4;
    }

    &.playback-playlist {
      z-index: 10000021;
      height: min(68dvh, 540px);
      padding-bottom: 0;
      border-radius: 30px;
      box-shadow: 0 -10px 42px rgba(0, 0, 0, 0.2);

      .playlist-panel-content {
        height: calc(min(68dvh, 540px) - 54px);
        padding-bottom: 10px;
      }
    }

    &.embedded {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 68px;
      left: 0;
      width: auto;
      height: auto;
      padding-bottom: 0;
      border: 0;
      border-radius: 0;

      .playlist-panel-content {
        height: calc(100% - 42px);
      }
    }
  }

  @media (orientation: landscape) {
    .playlist-panel.playback-playlist {
      top: calc(var(--safe-area-inset-top, 0px) + 12px);
      right: calc(var(--safe-area-inset-right, 0px) + 12px);
      bottom: calc(var(--safe-area-inset-bottom, 0px) + 12px);
      left: auto;
      width: min(70vw, 420px);
      height: auto;
      padding-bottom: 0;
      border-radius: 28px;
      transform-origin: right center;

      .playlist-panel-content {
        height: calc(
          100dvh - var(--safe-area-inset-top, 0px) - var(--safe-area-inset-bottom, 0px) - 76px
        );
      }
    }
  }
}

@keyframes mobile-playlist-morph-in {
  0% {
    opacity: 0;
    transform: translate3d(0, 52px, 0) scale(0.96);
  }
  72% {
    opacity: 1;
    transform: translate3d(0, -4px, 0) scale(1.004);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes mobile-playlist-morph-out {
  from {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
  to {
    opacity: 0;
    transform: translate3d(0, 44px, 0) scale(0.97);
  }
}

@media (prefers-reduced-motion: reduce) {
  .playlist-panel {
    animation-duration: 140ms !important;

    &.animate__slideInUp,
    &.animate__slideInRight {
      animation-name: playlist-fade-in !important;
    }

    &.animate__slideOutDown,
    &.animate__slideOutRight {
      animation-name: playlist-fade-out !important;
    }
  }
}

@keyframes playlist-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes playlist-fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
</style>
