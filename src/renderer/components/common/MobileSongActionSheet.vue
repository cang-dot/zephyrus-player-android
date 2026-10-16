<template>
  <Teleport to="body" :disabled="embedded">
    <transition name="sheet-up" :css="!embedded">
      <div
        v-if="show"
        class="mobile-sheet-overlay"
        :class="[`origin-${origin}`, { embedded }]"
        @click="$emit('update:show', false)"
      >
        <div class="mobile-action-sheet" :style="panelStyle" @click.stop>
          <!-- 歌曲信息头（紧凑，可拖拽下滑关闭） -->
          <div
            class="sheet-song-preview"
            @pointerdown="onSheetPointerDown"
            @pointermove="onSheetPointerMove"
            @pointerup="onSheetPointerUp"
            @pointercancel="onSheetPointerCancel"
          >
            <n-image
              :src="getImgUrl(coverUrl, '200y200')"
              class="sheet-song-cover"
              preview-disabled
              :img-props="{ crossorigin: coverCrossOriginAttr(coverUrl) }"
            />
            <div class="sheet-song-info">
              <div class="sheet-song-name">{{ item.name }}</div>
              <div class="sheet-song-artist">
                {{ artistNames || '未知艺术家' }}
              </div>
            </div>
          </div>

          <!-- 快捷行：下载 / 喜爱 / 分享 -->
          <div class="sheet-quick-row">
            <button
              type="button"
              class="sheet-quick-btn"
              :class="{ downloading: isDownloadingSong }"
              @click="handleDownload"
            >
              <i v-if="isDownloadingSong" class="ri-loader-4-line is-spinning"></i>
              <i v-else class="ri-download-2-line"></i>
              <span>{{ isDownloadingSong ? downloadProgressText : '下载' }}</span>
            </button>
            <button type="button" class="sheet-quick-btn" @click="handleAction('favorite')">
              <i
                :class="[
                  isFavorite ? 'ri-heart-fill' : 'ri-heart-line',
                  { 'favorite-icon': isFavorite }
                ]"
              />
              <span>{{
                isFavorite ? t('songItem.menu.unfavorite') : t('songItem.menu.favorite')
              }}</span>
            </button>
            <button type="button" class="sheet-quick-btn" @click="handleShareSong">
              <i class="ri-share-forward-line"></i>
              <span>分享</span>
            </button>
          </div>
          <div class="sheet-divider"></div>

          <div v-if="audioParamSegments.length" class="sheet-audio-params">
            <span v-for="segment in audioParamSegments" :key="segment">{{ segment }}</span>
            <button type="button" class="sheet-audio-edit" @click.stop="metadataEditorShow = true">
              <i class="ri-edit-line" />{{ t('songItem.metadataEditor.edit') }}
            </button>
          </div>

          <div class="sheet-actions">
            <button class="sheet-action-btn" @click="handleAction('play')">
              <i class="ri-play-circle-line"></i>
              <span>{{ t('songItem.menu.play') }}</span>
            </button>
            <button class="sheet-action-btn" @click="handleAction('playNext')">
              <i class="ri-play-list-2-line"></i>
              <span>{{ t('songItem.menu.playNext') }}</span>
            </button>
            <inline-playlist-picker
              :song="item"
              :expanded="playlistExpanded"
              back-layer-id="song-action-playlist-picker"
              @update:expanded="playlistExpanded = $event"
              @added="$emit('update:show', false)"
            />
            <button
              v-if="isCrossPlatformItem"
              class="sheet-action-btn"
              @click="handleAction('matchNetease')"
            >
              <i class="ri-netease-cloud-music-line"></i>
              <span>{{ t('songItem.menu.matchNetease') }}</span>
            </button>
            <button class="sheet-action-btn" @click="handleAction('matchLyric')">
              <i class="ri-file-text-line"></i>
              <span>{{ t('songItem.menu.matchLyric') }}</span>
            </button>
            <button
              v-if="firstArtistId"
              class="sheet-action-btn sheet-navigation-btn"
              @click="handleAction('gotoArtist')"
            >
              <i class="ri-user-line"></i>
              <span class="sheet-action-copy">
                <small>{{ t('search.search.artist') }}</small>
                <strong>{{ artistNames || '未知艺术家' }}</strong>
              </span>
              <i class="ri-arrow-right-s-line sheet-action-arrow" />
            </button>
            <button
              v-if="album?.name && (album?.id || isServerItem)"
              class="sheet-action-btn sheet-navigation-btn"
              @click="handleAction('gotoAlbum')"
            >
              <i class="ri-disc-line"></i>
              <span class="sheet-action-copy">
                <small>{{ t('search.search.album') }}</small>
                <strong>{{ album.name || '未知专辑' }}</strong>
              </span>
              <i class="ri-arrow-right-s-line sheet-action-arrow" />
            </button>
            <button
              v-if="canRemove"
              class="sheet-action-btn sheet-action-danger"
              @click="handleAction('remove')"
            >
              <i class="ri-delete-bin-line"></i>
              <span>{{ t('songItem.menu.removeFromPlaylist') }}</span>
            </button>
          </div>
        </div>
      </div>
    </transition>
    <song-metadata-editor v-model:show="metadataEditorShow" :song="item" />
    <poster-share-modal v-model:visible="showPosterModal" :lyrics="[]" :subject="posterSubject" />
  </Teleport>
</template>

<script lang="ts" setup>
import { NImage } from 'naive-ui';
import type { CSSProperties } from 'vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { isServerSongResult } from '@/api/serverSongs';
import PosterShareModal from '@/components/share/PosterShareModal.vue';
import type {
  MobileSongActionGeometry,
  MobileSongActionOrigin
} from '@/composables/useMobileSongActionSurface';
import { usePosterShare } from '@/composables/usePosterShare';
import { playMusic } from '@/hooks/MusicHook';
import { useDownload } from '@/hooks/useDownload';
import { isLocalSong } from '@/hooks/useLocalMusic';
import { activeAudioFormat } from '@/services/nativeAudioPlayer';
import { useLocalMusicStore } from '@/store/modules/localMusic';
import type { SongResult } from '@/types/music';
import type { PosterSubject } from '@/types/share';
import { coverCrossOriginAttr, getImgUrl } from '@/utils';
import { formatAudioSegments } from '@/utils/audioFormat';

import InlinePlaylistPicker from './InlinePlaylistPicker.vue';
import SongMetadataEditor from './SongMetadataEditor.vue';

const { t } = useI18n();
const props = defineProps<{
  item: SongResult;
  show: boolean;
  embedded?: boolean;
  isFavorite?: boolean;
  canRemove?: boolean;
  origin?: MobileSongActionOrigin;
  sourceGeometry?: MobileSongActionGeometry | null;
  scopeGeometry?: MobileSongActionGeometry | null;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  play: [];
  'play-next': [];
  favorite: [];
  remove: [];
  'goto-artist': [id: number | string];
  'goto-album': [id: number | string];
  'match-netease': [];
  'match-lyric': [];
}>();

const artistNames = computed(() => {
  const artists = props.item.ar || props.item.artists || [];
  if (Array.isArray(artists)) {
    return artists.map((a: any) => a.name).join(' / ');
  }
  return String(artists || '');
});

// ==================== 下载(云歌曲/所有来源移动端入口) ====================
const { downloadMusic, mobileDownloadProgress } = useDownload();

const downloadProgressText = computed(() => {
  const entries = Object.entries(mobileDownloadProgress.value);
  if (!entries.length) return '准备下载…';
  return `下载中 ${entries[0][1]}%`;
});

const isDownloadingSong = computed(() => Object.keys(mobileDownloadProgress.value).length > 0);

const handleDownload = () => {
  if (isDownloadingSong.value) return;
  void downloadMusic(props.item as SongResult);
};

const firstArtistId = computed(() => {
  const artists = props.item.ar || props.item.artists || [];
  if (Array.isArray(artists) && artists.length > 0) {
    return artists[0]?.id;
  }
  return undefined;
});

// 跨平台歌曲（QQ/酷狗等）才显示「匹配网易云播放」
const isCrossPlatformItem = computed(() => {
  const song = props.item as any;
  return Boolean(song?.platform && song.platform !== 'netease' && song.platformId);
});

const album = computed(() => props.item.al || props.item.album || props.item.song?.album);
const isServerItem = computed(() => isServerSongResult(props.item));
const coverUrl = computed(
  () => props.item.picUrl || props.item.al?.picUrl || props.item.album?.picUrl || ''
);
// 本地歌曲展示音频参数：静态容器元数据 + 当前播放时的引擎实际解码格式。
const localMusicStore = useLocalMusicStore();
const audioParamSegments = computed(() => {
  if (!isLocalSong(props.item)) return [] as string[];
  const entry = localMusicStore.musicList.find((meta) => meta.id === String(props.item.id));
  const runtime =
    playMusic?.value && String(playMusic.value.id) === String(props.item.id)
      ? activeAudioFormat.value
      : null;
  return formatAudioSegments({
    mime: runtime?.sampleMimeType || entry?.mime,
    sampleRate: runtime?.sampleRate || entry?.sampleRate,
    channelCount: runtime?.channelCount,
    bitrate: runtime?.bitrate || entry?.bitrate,
    fileSize: entry?.fileSize
  });
});
const playlistExpanded = ref(false);
const metadataEditorShow = ref(false);

// ==================== 分享歌曲海报（歌曲信息模式） ====================
const { showPosterModal, posterSubject, openPosterForSubject } = usePosterShare();

function handleShareSong() {
  const song = props.item;
  const subject: PosterSubject = {
    kind: 'song',
    songId: song.id,
    songName: song.name || '未知歌曲',
    artists: artistNames.value || '未知艺术家',
    coverUrl: coverUrl.value ? getImgUrl(coverUrl.value, '500y500') : ''
  };
  // 不收起菜单：菜单宿主是 v-if 挂载，收起即卸载组件，
  // 挂载在组件内的海报弹窗会被连带销毁。海报为全屏高层级浮层，可直接覆盖菜单。
  openPosterForSubject(subject);
}
const origin = computed(() => props.origin ?? 'mini-player');
const embedded = computed(() => props.embedded === true);
const sheetStyle = computed<CSSProperties>(() => {
  const style: Record<string, string> = {};
  if (props.sourceGeometry) {
    style['--action-source-left'] = `${props.sourceGeometry.left}px`;
    style['--action-source-top'] = `${props.sourceGeometry.top}px`;
    style['--action-source-width'] = `${props.sourceGeometry.width}px`;
    style['--action-source-height'] = `${props.sourceGeometry.height}px`;
    style['--action-source-radius'] = `${props.sourceGeometry.borderRadius}px`;
  }
  if (origin.value === 'playing-list' && props.scopeGeometry) {
    const scope = props.scopeGeometry;
    style['--action-final-left'] = `${scope.left}px`;
    style['--action-final-top'] = `${scope.top}px`;
    style['--action-final-width'] = `${scope.width}px`;
    style['--action-final-height'] = `${scope.height}px`;
    style['--action-final-radius'] = `${Math.max(20, scope.borderRadius)}px`;
  }
  return style as CSSProperties;
});

// 把手与预览区可拖拽下滑关闭：跟手位移，超过阈值或快速下滑即关闭，否则弹回。
const sheetDragOffset = ref(0);
const sheetDragging = ref(false);
let sheetPointerId: number | null = null;
let sheetPointerStartY = 0;
let sheetPointerStartTime = 0;

const panelStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = { ...sheetStyle.value };
  if (sheetDragOffset.value > 0) {
    style.transform = `translate3d(0, ${sheetDragOffset.value}px, 0)`;
    style.transition = sheetDragging.value
      ? 'none'
      : 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)';
  }
  return style;
});

const releaseSheetPointer = (event: PointerEvent) => {
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  sheetPointerId = null;
};

const onSheetPointerDown = (event: PointerEvent) => {
  if (!event.isPrimary || sheetPointerId !== null) return;
  sheetPointerId = event.pointerId;
  sheetPointerStartY = event.clientY;
  sheetPointerStartTime = performance.now();
  sheetDragging.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};

const onSheetPointerMove = (event: PointerEvent) => {
  if (sheetPointerId !== event.pointerId) return;
  event.preventDefault();
  const delta = event.clientY - sheetPointerStartY;
  sheetDragOffset.value = delta > 0 ? delta : delta * 0.16;
};

const onSheetPointerUp = (event: PointerEvent) => {
  if (sheetPointerId !== event.pointerId) return;
  const elapsed = Math.max(1, performance.now() - sheetPointerStartTime);
  const velocity = sheetDragOffset.value / elapsed;
  releaseSheetPointer(event);
  sheetDragging.value = false;
  if (sheetDragOffset.value > 72 || velocity > 0.55) {
    emit('update:show', false);
    return;
  }
  sheetDragOffset.value = 0;
};

const onSheetPointerCancel = (event: PointerEvent) => {
  if (sheetPointerId !== event.pointerId) return;
  releaseSheetPointer(event);
  sheetDragging.value = false;
  sheetDragOffset.value = 0;
};

watch(
  () => props.show,
  (show) => {
    if (show) {
      sheetDragOffset.value = 0;
      sheetDragging.value = false;
    } else {
      playlistExpanded.value = false;
    }
  }
);

const handleAction = (action: string) => {
  emit('update:show', false);
  switch (action) {
    case 'play':
      emit('play');
      break;
    case 'playNext':
      emit('play-next');
      break;
    case 'matchNetease':
      emit('match-netease');
      break;
    case 'matchLyric':
      emit('match-lyric');
      break;
    case 'favorite':
      emit('favorite');
      break;
    case 'gotoArtist':
      if (firstArtistId.value) emit('goto-artist', firstArtistId.value);
      break;
    case 'gotoAlbum':
      if (album.value?.name && (album.value?.id || isServerItem.value)) {
        emit('goto-album', album.value.id || -1);
      }
      break;
    case 'remove':
      emit('remove');
      break;
  }
};
</script>

<style lang="scss" scoped>
.sheet-action-btn.is-spinning .ri-loader-4-line {
  animation: sheet-spin 900ms linear infinite;
}

@keyframes sheet-spin {
  to {
    transform: rotate(360deg);
  }
}

.sheet-action-btn.downloading {
  opacity: 0.7;
  cursor: default;
}

.mobile-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  /* 锚定在触发行附近（--action-source-top 由触发几何注入），无几何时居中偏下 */
  padding-top: max(12px, calc(var(--action-source-top, 50vh) - 32px));
  padding-left: 12px;
  padding-right: 12px;
}

/* In the playing-list variant the sheet borrows the very same glass surface:
 * it fills the playlist panel and swaps in the song action elements instead
 * of spawning its own container. Dismissal is handled by the page-level mask
 * outside the dock and by the action rows themselves. */
.mobile-sheet-overlay.embedded {
  position: absolute;
  inset: 0;
  z-index: 4;
  align-items: stretch;
  justify-content: stretch;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  pointer-events: auto;

  .mobile-action-sheet {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    max-height: none;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .sheet-actions {
    flex: 1 1 auto;
    min-height: 0;
  }
}

.mobile-action-sheet {
  width: min(340px, 100%);
  max-height: min(72dvh, 640px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 0;
  border-radius: 16px;
  padding: 4px 0 max(4px, var(--safe-area-inset-bottom, 0px));
  /* 实色底（无毛玻璃），墨色沿用页面/播放器令牌避免错配 */
  --sheet-ink-rgb: var(--page-chrome-ink-rgb, 23, 23, 26);
  background: color-mix(
    in srgb,
    var(--page-chrome-bg, var(--d-surface, #fff)) 92%,
    rgba(var(--sheet-ink-rgb), 0.08) 8%
  );
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.36);
  --d-text-primary: rgba(var(--sheet-ink-rgb), 0.94);
  --d-text-secondary: rgba(var(--sheet-ink-rgb), 0.62);
  --d-text-muted: rgba(var(--sheet-ink-rgb), 0.45);
  --d-border: rgba(var(--sheet-ink-rgb), 0.14);
  --d-surface-hover: rgba(var(--sheet-ink-rgb), 0.08);
}

/* 深色主题且页面未注入 chrome 墨色时，兜底墨色改浅色，
   修掉「暗底暗字」不可读（无 chrome 页面上的长按菜单）。 */
.dark .mobile-action-sheet {
  --sheet-ink-rgb: var(--page-chrome-ink-rgb, 240, 236, 228);
}

/* 全屏播放器共享底面内的同一菜单：那里的表面恒为封面暗玻璃、墨色由
   --player-ink-rgb 驱动（同面其它文字亦然）。此处固定跟随播放器墨色，
   避免「亮底歌单页 + 暗玻璃」组合下菜单文字被页面墨色带深而不可读。 */
.shared-player-bottom-surface .mobile-action-sheet {
  --sheet-ink-rgb: var(--player-ink-rgb, 255, 255, 255);
}

.sheet-song-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 8px;
  touch-action: none;
  cursor: grab;
}

.sheet-song-cover {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;

  :deep(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.sheet-song-info {
  flex: 1;
  min-width: 0;
}

.sheet-song-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--d-text-primary, #1a1a1a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-song-artist {
  font-size: 12px;
  color: var(--d-text-secondary, #999);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-audio-params {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin-top: 8px;
  padding: 0 16px 10px;
  span {
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--d-surface-hover, rgba(128, 128, 128, 0.12));
    color: var(--d-text-secondary, #999);
    font-size: 10px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .sheet-audio-edit {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border: 1px solid color-mix(in srgb, var(--accent-color) 32%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent-color) 12%, transparent);
    color: var(--accent-color);
    font-size: 10px;
    font-weight: 500;

    i {
      font-size: 11px;
    }

    &:active {
      transform: scale(0.96);
    }
  }
}

.sheet-actions {
  padding: 2px 0 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* 快捷行（下载/喜爱/分享）：三项均分图标+文字 */
.sheet-quick-row {
  display: flex;
  align-items: stretch;
  padding: 2px 6px 6px;
  border-bottom: 1px solid var(--d-border, rgba(0, 0, 0, 0.06));
}

.sheet-quick-btn {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--d-text-primary, #1a1a1a);
  font-size: 12px;
  cursor: pointer;

  i {
    font-size: 20px;
    color: var(--d-text-primary, #1a1a1a);
  }

  &.downloading {
    opacity: 0.7;
    cursor: default;
  }

  &:active {
    background: var(--d-surface-hover, rgba(0, 0, 0, 0.05));
  }

  .favorite-icon {
    color: var(--accent-color);
  }
}

.sheet-divider {
  height: 1px;
  margin: 0 12px;
  background: var(--d-border, rgba(0, 0, 0, 0.06));
}

.sheet-action-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 11px 16px;
  border: none;
  background: transparent;
  font-size: 14px;
  color: var(--d-text-primary, #1a1a1a);
  cursor: pointer;
  min-height: 44px;
  transition:
    background-color 150ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:active {
    background: var(--d-surface-hover, rgba(0, 0, 0, 0.04));
    transform: scale(0.99);
  }

  .favorite-icon {
    color: var(--accent-color);
  }

  i {
    font-size: 20px;
    width: 22px;
    text-align: center;
    color: var(--d-text-secondary, #666);
  }

  &.sheet-action-danger {
    color: #ef4444;

    i {
      color: #ef4444;
    }
  }
}

.sheet-navigation-btn {
  align-items: center;
}

.sheet-action-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  text-align: left;

  small {
    color: var(--d-text-muted, #999);
    font-size: 10px;
    font-weight: 500;
  }

  strong {
    overflow: hidden;
    font-size: 13px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.sheet-action-btn .sheet-action-arrow {
  width: 16px;
  color: var(--d-text-muted, #999);
  font-size: 16px;
}

/* Transition */
.sheet-up-enter-active {
  /* 300ms matches the panel keyframe so Vue waits for the rebound to finish */
  transition: opacity 300ms ease;
}

.sheet-up-leave-active {
  transition: opacity 180ms ease;
}

.sheet-up-enter-active .mobile-action-sheet {
  animation: sheet-up-in 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

.sheet-up-leave-active .mobile-action-sheet {
  transition: transform 260ms cubic-bezier(0.32, 0.72, 0, 1);
}

.sheet-up-enter-from,
.sheet-up-leave-to {
  opacity: 0;

  .mobile-action-sheet {
    transform: translateY(100%) scale(0.9);
  }
}

.origin-playing-list .mobile-action-sheet {
  transform-origin: right bottom;
}

@keyframes sheet-up-in {
  from {
    transform: translateY(100%) scale(0.9);
  }

  72% {
    transform: translateY(0) scale(1.02);
  }

  to {
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sheet-up-enter-active,
  .sheet-up-leave-active,
  .sheet-up-enter-active .mobile-action-sheet,
  .sheet-up-leave-active .mobile-action-sheet,
  .sheet-action-btn {
    transition-duration: 0ms;
  }

  .sheet-up-enter-active .mobile-action-sheet {
    animation-duration: 0ms;
  }

  .sheet-action-btn:active {
    transform: none;
  }
}
</style>
