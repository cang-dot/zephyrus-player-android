<template>
  <Teleport to="body">
    <transition name="sheet-up">
      <div v-if="show" class="mobile-sheet-overlay" @click="$emit('update:show', false)">
        <div class="mobile-action-sheet" @click.stop>
          <div class="sheet-handle" />
          <div class="sheet-song-preview">
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
              v-if="album?.id"
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
            <button class="sheet-action-btn" @click="handleAction('addToPlaylist')">
              <i class="ri-folder-add-line"></i>
              <span>{{ t('songItem.menu.addToPlaylist') }}</span>
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

          <button class="sheet-cancel-btn" @click="$emit('update:show', false)">
            {{ t('common.cancel') }}
          </button>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { NImage } from 'naive-ui';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';

const { t } = useI18n();

const props = defineProps<{
  item: SongResult;
  show: boolean;
  isFavorite?: boolean;
  canRemove?: boolean;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  play: [];
  'play-next': [];
  'add-to-playlist': [];
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
const coverUrl = computed(
  () => props.item.picUrl || props.item.al?.picUrl || props.item.album?.picUrl || ''
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
    case 'addToPlaylist':
      emit('add-to-playlist');
      break;
    case 'favorite':
      emit('favorite');
      break;
    case 'gotoArtist':
      if (firstArtistId.value) emit('goto-artist', firstArtistId.value);
      break;
    case 'gotoAlbum':
      if (album.value?.id) emit('goto-album', album.value.id);
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

.mobile-action-sheet {
  width: 100%;
  max-width: 500px;
  max-height: min(82dvh, 680px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--cover-border, rgba(128, 128, 128, 0.12));
  border-bottom: 0;
  border-radius: 24px 24px 0 0;
  padding: 8px 0 max(8px, var(--safe-area-inset-bottom, 0px));
  background: var(--m-surface-raised, var(--d-surface, #fff));
  box-shadow: 0 -16px 48px rgba(0, 0, 0, 0.18);
}

.sheet-handle {
  width: 38px;
  height: 4px;
  flex-shrink: 0;
  margin: 0 auto 6px;
  border-radius: 9999px;
  background: var(--d-border, rgba(128, 128, 128, 0.24));
}

.sheet-song-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 20px 16px;
  border-bottom: 1px solid var(--d-border, rgba(0, 0, 0, 0.06));
}

.sheet-song-cover {
  width: 56px;
  height: 56px;
  border-radius: 12px;
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
  font-size: 16px;
  font-weight: 600;
  color: var(--d-text-primary, #1a1a1a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-song-artist {
  font-size: 13px;
  color: var(--d-text-secondary, #999);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-actions {
  padding: 8px 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.sheet-action-btn {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 14px 20px;
  border: none;
  background: transparent;
  font-size: 15px;
  color: var(--d-text-primary, #1a1a1a);
  cursor: pointer;
  min-height: 50px;
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
    font-size: 22px;
    width: 24px;
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
    font-size: 11px;
    font-weight: 500;
  }

  strong {
    overflow: hidden;
    font-size: 14px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.sheet-action-btn .sheet-action-arrow {
  width: 18px;
  color: var(--d-text-muted, #999);
  font-size: 18px;
}

.sheet-cancel-btn {
  display: block;
  width: calc(100% - 32px);
  margin: 8px 16px;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: var(--d-surface-hover, rgba(0, 0, 0, 0.04));
  font-size: 15px;
  font-weight: 500;
  color: var(--d-text-secondary, #666);
  cursor: pointer;
  transition:
    background-color 150ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:active {
    background: var(--d-border, rgba(0, 0, 0, 0.08));
    transform: scale(0.98);
  }
}

/* Transition */
.sheet-up-enter-active,
.sheet-up-leave-active {
  transition: opacity 180ms ease;

  .mobile-action-sheet {
    transition: transform 260ms cubic-bezier(0.32, 0.72, 0, 1);
  }
}

.sheet-up-enter-from,
.sheet-up-leave-to {
  opacity: 0;

  .mobile-action-sheet {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sheet-up-enter-active,
  .sheet-up-leave-active,
  .sheet-up-enter-active .mobile-action-sheet,
  .sheet-up-leave-active .mobile-action-sheet,
  .sheet-action-btn,
  .sheet-cancel-btn {
    transition-duration: 0ms;
  }

  .sheet-action-btn:active,
  .sheet-cancel-btn:active {
    transform: none;
  }
}
</style>
