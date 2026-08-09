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
            <div class="playlist-morph-action" :class="{ expanded: playlistExpanded }">
              <button class="sheet-action-btn playlist-morph-trigger" @click="togglePlaylistMorph">
                <i class="ri-folder-add-line"></i>
                <span>{{ t('songItem.menu.addToPlaylist') }}</span>
                <i class="ri-arrow-down-s-line playlist-morph-arrow" />
              </button>
              <div class="playlist-morph-content">
                <div v-if="playlistLoading" class="playlist-morph-state">
                  <i class="ri-loader-4-line is-spinning" />
                </div>
                <button
                  v-for="playlist in playlists"
                  v-else
                  :key="playlist.id"
                  type="button"
                  class="playlist-morph-row"
                  @click="addToPlaylist(playlist)"
                >
                  <n-image
                    :src="getImgUrl(playlist.coverImgUrl || playlist.picUrl, '100y100')"
                    preview-disabled
                    :img-props="{ crossorigin: 'anonymous' }"
                  />
                  <span
                    ><strong>{{ playlist.name }}</strong
                    ><small
                      >{{ playlist.trackCount || 0 }} {{ t('comp.playlistDrawer.count') }}</small
                    ></span
                  >
                  <i class="ri-add-line" />
                </button>
                <div v-if="!playlistLoading && !playlists.length" class="playlist-morph-state">
                  {{ t('common.noData') }}
                </div>
              </div>
            </div>
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
import { NImage, useMessage } from 'naive-ui';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { updatePlaylistTracks } from '@/api/music';
import { isServerSongResult } from '@/api/serverSongs';
import { getUserPlaylist } from '@/api/user';
import { useLocalPlaylistStore } from '@/store/modules/localPlaylist';
import { useUserStore } from '@/store/modules/user';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';
import { getLoginErrorMessage, hasPermission } from '@/utils/auth';

const { t } = useI18n();
const message = useMessage();
const userStore = useUserStore();
const localPlaylistStore = useLocalPlaylistStore();

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
const isServerItem = computed(() => isServerSongResult(props.item));
const coverUrl = computed(
  () => props.item.picUrl || props.item.al?.picUrl || props.item.album?.picUrl || ''
);
const playlistExpanded = ref(false);
const playlistLoading = ref(false);
const playlists = ref<any[]>([]);

const loadPlaylists = async () => {
  if (playlists.value.length) return;
  if (!userStore.user?.userId || !hasPermission(true)) {
    message.error(getLoginErrorMessage(true));
    return;
  }
  playlistLoading.value = true;
  try {
    const response = await getUserPlaylist(userStore.user.userId, 999);
    playlists.value = (response.data?.playlist || []).filter(
      (playlist: any) => playlist.userId === userStore.user?.userId
    );
  } catch (error) {
    console.error('获取歌单失败:', error);
    message.error(t('comp.playlistDrawer.getPlaylistFailed'));
  } finally {
    playlistLoading.value = false;
  }
};

const togglePlaylistMorph = async () => {
  playlistExpanded.value = !playlistExpanded.value;
  if (playlistExpanded.value) await loadPlaylists();
};

const addToPlaylist = async (playlist: any) => {
  const song = props.item;
  const isNonNetease =
    song.platform === 'server' ||
    song.playMusicUrl?.startsWith('local://') ||
    (song.platform && song.platform !== 'netease');

  if (isNonNetease) {
    const added = localPlaylistStore.addToLocalPlaylist(playlist.id, playlist.name, song);
    message[added ? 'success' : 'info'](
      added ? `已添加到「${playlist.name}」（仅本地展示）` : `歌曲已在「${playlist.name}」中`
    );
  } else {
    try {
      const response = await updatePlaylistTracks({
        op: 'add',
        pid: playlist.id,
        tracks: String(song.id)
      });
      if (response.status !== 200) throw new Error(response.data?.msg);
      message.success(t('comp.playlistDrawer.addSuccess'));
    } catch (error: any) {
      message.error(error?.message || t('comp.playlistDrawer.addFailed'));
      return;
    }
  }
  emit('update:show', false);
};

watch(
  () => props.show,
  (show) => {
    if (!show) playlistExpanded.value = false;
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

.playlist-morph-action {
  margin: 0 8px;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 18px;
  background: transparent;
  transition:
    max-height 440ms cubic-bezier(0.32, 0.72, 0, 1),
    border-color 220ms ease,
    background 220ms ease,
    box-shadow 300ms ease;

  &.expanded {
    border-color: var(--m-glass-border);
    background: var(--m-glass-bg);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(24px) saturate(170%);
  }
}

.playlist-morph-trigger {
  padding-right: 12px;

  span {
    flex: 1;
    text-align: left;
  }
}

.sheet-action-btn .playlist-morph-arrow {
  width: 18px;
  transition: transform 360ms cubic-bezier(0.32, 0.72, 0, 1);

  .expanded & {
    transform: rotate(180deg);
  }
}

.playlist-morph-content {
  display: grid;
  gap: 5px;
  max-height: 0;
  padding: 0 8px;
  overflow: hidden;
  opacity: 0;
  transition:
    max-height 440ms cubic-bezier(0.32, 0.72, 0, 1),
    padding 440ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 180ms ease;

  .expanded & {
    max-height: min(42dvh, 360px);
    padding: 2px 8px 9px;
    overflow-y: auto;
    opacity: 1;
    overscroll-behavior: contain;
  }
}

.playlist-morph-row {
  display: flex;
  min-height: 56px;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: 0;
  border-radius: 14px;
  background: color-mix(in srgb, var(--m-surface-alt) 42%, transparent);
  color: var(--m-text-primary);
  text-align: left;

  :deep(.n-image) {
    width: 42px;
    height: 42px;
    flex: 0 0 42px;
    overflow: hidden;
    border-radius: 12px;
  }

  :deep(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  > span {
    display: grid;
    min-width: 0;
    flex: 1;
    gap: 2px;

    strong,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      color: var(--m-text-muted);
      font-size: 11px;
    }
  }

  > i {
    color: var(--accent-color);
    font-size: 18px;
  }
}

.playlist-morph-state {
  display: grid;
  min-height: 68px;
  place-items: center;
  color: var(--m-text-muted);
  font-size: 12px;
}

.is-spinning {
  animation: playlist-spin 900ms linear infinite;
}

@keyframes playlist-spin {
  to {
    transform: rotate(360deg);
  }
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
  .sheet-cancel-btn,
  .playlist-morph-action,
  .playlist-morph-content,
  .playlist-morph-arrow {
    transition-duration: 0ms;
  }

  .sheet-action-btn:active,
  .sheet-cancel-btn:active {
    transform: none;
  }
}
</style>
