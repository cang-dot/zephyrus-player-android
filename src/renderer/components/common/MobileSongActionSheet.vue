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
          <div
            class="sheet-handle"
            @pointerdown="onSheetPointerDown"
            @pointermove="onSheetPointerMove"
            @pointerup="onSheetPointerUp"
            @pointercancel="onSheetPointerCancel"
          />
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
              :img-props="{ crossorigin: 'anonymous' }"
            />
            <div class="sheet-song-info">
              <div class="sheet-song-name">{{ item.name }}</div>
              <div class="sheet-song-artist">
                {{ artistNames || '未知艺术家' }}
              </div>
            </div>
          </div>

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
            <inline-playlist-picker
              :song="item"
              :expanded="playlistExpanded"
              back-layer-id="song-action-playlist-picker"
              @update:expanded="playlistExpanded = $event"
              @added="$emit('update:show', false)"
            />
            <button class="sheet-action-btn" @click="handleShareSong">
              <i class="ri-share-forward-line"></i>
              <span>分享歌曲</span>
            </button>
            <button class="sheet-action-btn" @click="handleAction('favorite')">
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
import { isLocalSong } from '@/hooks/useLocalMusic';
import { activeAudioFormat } from '@/services/nativeAudioPlayer';
import { useLocalMusicStore } from '@/store/modules/localMusic';
import type { SongResult } from '@/types/music';
import type { PosterSubject } from '@/types/share';
import { getImgUrl } from '@/utils';
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
  'goto-artist': [id: number];
  'goto-album': [id: number];
}>();

const artistNames = computed(() => {
  const artists = props.item.ar || props.item.artists || [];
  if (Array.isArray(artists)) {
    return artists.map((a: any) => a.name).join(' / ');
  }
  return String(artists || '');
});

const firstArtistId = computed(() => {
  const artists = props.item.ar || props.item.artists || [];
  if (Array.isArray(artists) && artists.length > 0) {
    return artists[0]?.id;
  }
  return undefined;
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
.mobile-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
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
  width: 100%;
  max-height: min(70dvh, 600px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--cover-border, rgba(128, 128, 128, 0.12));
  border-bottom: 0;
  border-radius: 24px 24px 0 0;
  padding: 6px 0 max(6px, var(--safe-area-inset-bottom, 0px));
  background: var(--m-surface-raised, var(--d-surface, #fff));
  box-shadow: 0 -16px 48px rgba(0, 0, 0, 0.18);
}

.sheet-handle {
  width: 32px;
  height: 4px;
  flex-shrink: 0;
  margin: 0 auto 4px;
  border-radius: 9999px;
  background: var(--d-border, rgba(128, 128, 128, 0.24));
  touch-action: none;
  cursor: grab;
}

.sheet-song-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 16px 12px;
  border-bottom: 1px solid var(--d-border, rgba(0, 0, 0, 0.06));
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
  padding: 6px 0;
  overflow-y: auto;
  overscroll-behavior: contain;
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
