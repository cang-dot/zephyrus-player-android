<template>
  <div class="iq-panel">
    <div class="iq-head">
      <div class="iq-title">{{ t('player.queuePanel.continuePlaying') }}</div>
      <div v-if="sourceName" class="iq-subtitle">
        {{ t('player.queuePanel.fromSource', { name: sourceName }) }}
      </div>
    </div>
    <div ref="listRef" class="iq-list">
      <TransitionGroup name="queue" tag="div" class="iq-rows">
        <div
          v-for="(song, index) in playList"
          :key="song.id"
          class="iq-row"
          :class="{ current: isCurrent(song), dragging: dragIndex === index }"
          @click.stop="handleRowClick(song)"
          @touchstart="onRowTouchStart($event, index)"
          @touchmove.passive="onRowTouchMove"
          @touchend="onRowTouchEnd"
          @touchcancel="onRowTouchCancel"
          @contextmenu.prevent="onRowContextMenu($event, index)"
        >
          <!-- 拖拽位移挂在 body 内层：TransitionGroup 的 FLIP 会改写行本身的 transform -->
          <div class="iq-row-body" :style="dragRowStyle(index)">
            <img class="iq-cover" :src="getImgUrl(song.picUrl, '100y100')" loading="lazy" alt="" />
            <div class="iq-copy">
              <div class="iq-name">
                <span
                  v-if="isCurrent(song)"
                  class="iq-eq"
                  :class="{ paused: !playerStore.isPlaying }"
                  aria-hidden="true"
                  ><i></i><i></i><i></i
                ></span>
                <span class="iq-name-text">{{ song.name }}</span>
              </div>
              <div class="iq-artist">{{ artistText(song) }}</div>
            </div>
            <div
              class="iq-handle"
              :class="{ dragging: dragIndex === index }"
              @pointerdown.stop="onHandlePointerDown($event, index)"
              @pointermove.stop="onHandlePointerMove"
              @pointerup.stop="onHandlePointerUp"
              @pointercancel.stop="onHandlePointerCancel"
              @touchstart.stop
              @click.stop
            >
              <i class="iconfont icon-list"></i>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <context-song-menu
      :visible="!!menuSong"
      :cover-url="menuSong ? getImgUrl(menuSong.picUrl, '200y200') : ''"
      :song-name="menuSong?.name || ''"
      :song-artist="menuSong ? artistText(menuSong) : ''"
      :quick-actions="menuQuickActions"
      :items="menuItems"
      :card-action-id="'gotoAlbum'"
      :anchor-rect="menuAnchorRect"
      @action="handleMenuAction"
      @close="closeMenu"
    />
  </div>
</template>

<script lang="ts" setup>
/**
 * 沉浸页队列面板（Apple Music 式）：小节头（继续播放/来自歌单）+ 队列列表。
 * 行单击播放；手柄拖拽排序（reorder 增量交换，TransitionGroup 让位动画）；
 * 手柄单击弹出 ContextSongMenu（喜爱/下一首/移除 + 播放/查看歌手 + 清空队列）。
 */
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ContextSongMenu, {
  type ContextMenuAction,
  type ContextMenuAnchorRect
} from '@/components/common/ContextSongMenu.vue';
import { immersiveSurfaceMode } from '@/composables/useImmersiveLyrics';
import { usePlayerSurfaceFeedback } from '@/composables/usePlayerSurfaceFeedback';
import { playMusic } from '@/hooks/MusicHook';
import { useArtist } from '@/hooks/useArtist';
import { useOverlayNavigate } from '@/hooks/useOverlayNavigate';
import { usePlayerStore } from '@/store/modules/player';
import { usePlaylistStore } from '@/store/modules/playlist';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';

const ROW_H = 64;

const { t } = useI18n();
const playlistStore = usePlaylistStore();
const playerStore = usePlayerStore();
const playerSurfaceFeedback = usePlayerSurfaceFeedback();
const navigate = useOverlayNavigate().navigate;
const { navigateToArtist } = useArtist();

const playList = computed(() => playlistStore.playList);
const sourceName = computed(() => playlistStore.playListSourceName || '');

function isCurrent(song: SongResult): boolean {
  return String(playMusic.value?.id) === String(song.id);
}

function artistText(song: SongResult): string {
  return (song.ar || song.artists || []).map((a: any) => a.name).join(' / ');
}

function handlePlay(song: SongResult) {
  void playerStore.setPlay(song);
}

// ── 打开时滚动到当前曲 ──
const immersiveModeActive = computed(() => immersiveSurfaceMode.value === 'playlist');
const listRef = ref<HTMLElement | null>(null);
watch(immersiveModeActive, async (active) => {
  if (!active) return;
  await nextTick();
  const el = listRef.value;
  if (!el) return;
  el.scrollTop = Math.max(0, playlistStore.playListIndex * ROW_H - ROW_H * 2);
});

// ── 手柄拖拽排序 + 单击手柄菜单 + 行任意处长按菜单 ──
const dragIndex = ref(-1);
const dragOrigin = ref(-1);
const dragStartY = ref(0);
const dragY = ref(0);
const dragPointerId = ref(-1);
let dragMoved = false;
const menuSong = ref<SongResult | null>(null);
const menuAnchorRect = ref<ContextMenuAnchorRect | null>(null);

function openMenuForIndex(index: number, rect: DOMRect) {
  menuAnchorRect.value = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
  menuSong.value = playList.value[index] || null;
}

function onHandlePointerDown(event: PointerEvent, index: number) {
  dragIndex.value = index;
  dragOrigin.value = index;
  dragPointerId.value = event.pointerId;
  dragStartY.value = event.clientY;
  dragY.value = 0;
  dragMoved = false;
  const target = event.currentTarget as HTMLElement;
  try {
    target.setPointerCapture(event.pointerId);
  } catch {
    /* 老内核可能不支持 */
  }
}

function onHandlePointerMove(event: PointerEvent) {
  if (event.pointerId !== dragPointerId.value || dragIndex.value < 0) return;
  const dy = event.clientY - dragStartY.value;
  if (Math.abs(dy) > 6) dragMoved = true;
  dragY.value = dy;
  const len = playList.value.length;
  const target = Math.max(0, Math.min(len - 1, dragOrigin.value + Math.round(dy / ROW_H)));
  if (target !== dragIndex.value) {
    playlistStore.reorderPlayList(dragIndex.value, target);
    dragIndex.value = target;
  }
}

function onHandlePointerUp(event: PointerEvent) {
  if (event.pointerId !== dragPointerId.value) return;
  const index = dragOrigin.value;
  const song = playList.value[index] || null;
  const wasTap = !dragMoved;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  dragPointerId.value = -1;
  dragIndex.value = -1;
  dragOrigin.value = -1;
  dragY.value = 0;
  if (wasTap && song) {
    openMenuForIndex(index, rect);
  }
}

function onHandlePointerCancel(event: PointerEvent) {
  if (event.pointerId !== dragPointerId.value) return;
  dragPointerId.value = -1;
  dragIndex.value = -1;
  dragOrigin.value = -1;
  dragY.value = 0;
}

/** 行长按 500ms 唤起菜单（任意位置）。
    事件流用 touch 而非 pointer——与 BaseSongItem 的歌曲列表长按完全同款（iOS 实证可靠）：
    pointer 版在 iOS 会因系统手势接管收到 pointercancel，touch 版只有真实 touchcancel。
    把手区 @touchstart.stop 独占（拖拽/单击手柄语义），桌面右键走 contextmenu。 */
const ROW_LONG_PRESS_MS = 500;
/** 长按唤起后的 click 压制窗口：iOS 松手时可能向原按压目标派发幽灵 click，按时间窗吞掉 */
let rowPressTimer: ReturnType<typeof setTimeout> | null = null;
let rowSuppressClickUntil = 0;
let rowPressStartX = 0;
let rowPressStartY = 0;
let rowPressSurface: HTMLElement | null = null;

function clearRowPressTimer() {
  if (rowPressTimer) {
    clearTimeout(rowPressTimer);
    rowPressTimer = null;
  }
}

function onRowTouchStart(event: TouchEvent, index: number) {
  if (event.touches.length !== 1) {
    clearRowPressTimer();
    return;
  }
  const touch = event.touches[0];
  rowPressStartX = touch.clientX;
  rowPressStartY = touch.clientY;
  rowPressSurface = event.currentTarget as HTMLElement;
  clearRowPressTimer();
  rowPressTimer = setTimeout(() => {
    rowPressTimer = null;
    if (!rowPressSurface) return;
    rowSuppressClickUntil = performance.now() + 700;
    playerSurfaceFeedback.pulse();
    openMenuForIndex(index, rowPressSurface.getBoundingClientRect());
  }, ROW_LONG_PRESS_MS);
}

function onRowTouchMove(event: TouchEvent) {
  if (!rowPressTimer) return;
  const touch = event.touches[0];
  if (!touch) return;
  const dx = touch.clientX - rowPressStartX;
  const dy = touch.clientY - rowPressStartY;
  if (Math.hypot(dx, dy) > 10) clearRowPressTimer();
}

function onRowTouchEnd() {
  clearRowPressTimer();
}

function onRowTouchCancel() {
  clearRowPressTimer();
}

function handleRowClick(song: SongResult) {
  if (performance.now() < rowSuppressClickUntil) return;
  handlePlay(song);
}

/** iOS 长按在计时器前后派发 contextmenu：同步开菜单并压掉收尾 click（桌面右键同路） */
function onRowContextMenu(event: MouseEvent, index: number) {
  clearRowPressTimer();
  rowSuppressClickUntil = performance.now() + 700;
  playerSurfaceFeedback.pulse();
  openMenuForIndex(index, (event.currentTarget as HTMLElement).getBoundingClientRect());
}

/** 被拖行的跟手位移：挂在行内 body 上（行本身让给 TransitionGroup 的 FLIP） */
function dragRowStyle(index: number): Record<string, string> | undefined {
  if (dragIndex.value !== index) return undefined;
  const offset = dragY.value - (dragIndex.value - dragOrigin.value) * ROW_H;
  return {
    transform: `translate3d(0, ${offset.toFixed(1)}px, 0)`,
    transition: 'none'
  };
}

// ── 手柄菜单 ──
const menuFavorite = computed(() =>
  menuSong.value
    ? playerStore.favoriteList.some((id) => String(id) === String(menuSong.value?.id))
    : false
);

const menuQuickActions = computed<ContextMenuAction[]>(() => [
  {
    id: 'favorite',
    icon: menuFavorite.value ? 'ri-heart-fill' : 'ri-heart-line',
    label: menuFavorite.value ? t('songItem.menu.unfavorite') : t('songItem.menu.favorite'),
    active: menuFavorite.value
  },
  {
    id: 'playNext',
    icon: 'ri-play-list-2-line',
    label: t('songItem.menu.playNext')
  },
  {
    id: 'remove',
    icon: 'ri-delete-bin-line',
    label: t('songItem.menu.removeFromPlaylist'),
    danger: true
  }
]);

const menuItems = computed<ContextMenuAction[][]>(() => [
  [
    { id: 'play', icon: 'ri-play-circle-line', label: t('songItem.menu.play') },
    { id: 'gotoArtist', icon: 'ri-user-line', label: t('search.search.artist') }
  ],
  [
    {
      id: 'clearQueue',
      icon: 'ri-delete-bin-line',
      label: t('player.queuePanel.clearQueue'),
      danger: true
    }
  ]
]);

function handleMenuAction(id: string) {
  const song = menuSong.value;
  menuSong.value = null;
  if (!song) return;
  switch (id) {
    case 'favorite':
      if (menuFavorite.value) void playerStore.removeFromFavorite(song.id);
      else void playerStore.addToFavorite(song.id);
      break;
    case 'playNext':
      playlistStore.addToNextPlay(song);
      break;
    case 'remove':
      playerStore.removeFromPlayList(song.id);
      break;
    case 'play':
      void playerStore.setPlay(song);
      break;
    case 'gotoArtist': {
      const artistId = (song.ar || song.artists || [])?.[0]?.id;
      if (artistId !== undefined && artistId !== null) {
        playerStore.setMusicFull(false);
        navigateToArtist(Number(artistId), {
          name: (song.ar || song.artists || [])?.[0]?.name || ''
        });
      }
      break;
    }
    case 'gotoAlbum': {
      playerStore.setMusicFull(false);
      const albumId = song.al?.id ?? song.album?.id;
      const albumName = song.al?.name ?? song.album?.name;
      if (albumId && albumId !== -1) navigate(`/music-list/${albumId}?type=album`);
      else if (albumName)
        navigate(`/music-list/${encodeURIComponent(albumName)}?type=server-album`);
      break;
    }
    case 'clearQueue':
      playerStore.clearPlayAll();
      break;
  }
}

function closeMenu() {
  menuSong.value = null;
}
</script>

<style lang="scss" scoped>
.iq-panel {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  color: var(--player-ink, #fff);
  /* iOS 长按文本选择/图片系统 callout 会接管触摸并派发 pointercancel，
     杀掉行长按的 500ms 计时器——禁选中禁 callout（对齐 BaseSongItem 方案） */
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.iq-head {
  flex: none;
  padding: 14px 20px 8px;
}

.iq-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.iq-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.55);
}

.iq-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px 12px calc(var(--safe-area-inset-bottom, 0px) + 12px);
}

.iq-rows {
  position: relative;
}

.iq-row {
  position: relative;
  height: 64px;
  cursor: pointer;
}

/* 行视觉（flex/底色/圆角）都在 body 内层：拖拽时 body 跟手位移并浮顶，
   行本身静止让位给 TransitionGroup FLIP */
.iq-row-body {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 100%;
  padding: 0 8px;
  border-radius: 12px;
}

.iq-row:active .iq-row-body {
  background: rgba(var(--player-ink-rgb, 255, 255, 255), 0.06);
}

.iq-row.current .iq-row-body {
  background: rgba(var(--player-ink-rgb, 255, 255, 255), 0.06);
}

/* 拖拽中：整行浮在其他行之上（transition:none 同时压掉本行的 FLIP 让位动画，
   让落位瞬时完成、由 body 位移保证始终跟手） */
.iq-row.dragging {
  z-index: 10;
  transition: none;
}

/* 实色卡片（与 ContextSongMenu 同底色）；深底卡在亮色主题上需把墨色翻转为白 */
.iq-row.dragging .iq-row-body {
  background: #242426;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
  will-change: transform;
  --player-ink: #fff;
  --player-ink-rgb: 255, 255, 255;
}

.iq-cover {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
  flex: none;
}

.iq-copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.iq-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.iq-name-text {
  overflow: hidden;
  font-size: 15px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.iq-row.current .iq-name-text {
  color: var(--accent-color, var(--player-ink, #fff));
}

.iq-artist {
  overflow: hidden;
  font-size: 12px;
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.55);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 播放中动画（三条 eq 柱） */
.iq-eq {
  display: inline-flex;
  flex: none;
  align-items: flex-end;
  gap: 2px;
  height: 14px;

  i {
    width: 3px;
    height: 100%;
    border-radius: 1px;
    background: var(--accent-color, var(--player-ink, #fff));
    animation: iq-eq-bounce 0.9s ease-in-out infinite;

    &:nth-child(2) {
      animation-delay: 0.25s;
    }

    &:nth-child(3) {
      animation-delay: 0.5s;
    }
  }

  &.paused i {
    animation-play-state: paused;
    transform: scaleY(0.35);
  }
}

@keyframes iq-eq-bounce {
  0%,
  100% {
    transform: scaleY(0.35);
  }
  50% {
    transform: scaleY(1);
  }
}

.iq-handle {
  display: grid;
  flex: none;
  width: 36px;
  height: 36px;
  place-items: center;
  touch-action: none;
  cursor: grab;

  /* 复用控件栏播放列表按钮的 icon-list，压暗作拖拽把手 */
  i {
    font-size: 16px;
    color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.35);
  }

  &.dragging {
    background: rgba(var(--player-ink-rgb, 255, 255, 255), 0.1);
    cursor: grabbing;
  }
}

/* 拖拽排序：其余行让位动画 */
.queue-move {
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.queue-enter-active,
.queue-leave-active {
  transition: opacity 150ms ease;
}

.queue-enter-from,
.queue-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .queue-move,
  .queue-enter-active,
  .queue-leave-active,
  .iq-eq i {
    animation: none;
    transition: none;
  }
}
</style>
