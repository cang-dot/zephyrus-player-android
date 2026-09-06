<template>
  <div class="inline-playlist-picker" :class="{ expanded }">
    <button type="button" class="inline-playlist-trigger" @click="toggle">
      <i class="ri-folder-add-line" />
      <span>{{ t('songItem.menu.addToPlaylist') }}</span>
      <i class="ri-arrow-down-s-line inline-playlist-arrow" />
    </button>

    <div class="inline-playlist-content" :aria-hidden="!expanded">
      <div v-if="loading" class="inline-playlist-state">
        <i class="ri-loader-4-line is-spinning" />
      </div>
      <button
        v-for="playlist in playlists"
        v-else
        :key="playlist.id"
        type="button"
        class="inline-playlist-row"
        @click="addToPlaylist(playlist)"
      >
        <n-image
          :src="getImgUrl(playlist.coverImgUrl || playlist.picUrl, '100y100')"
          preview-disabled
          :img-props="{ crossorigin: 'anonymous' }"
        />
        <span>
          <strong>{{ playlist.name }}</strong>
          <small>{{ playlist.trackCount || 0 }} {{ t('comp.playlistDrawer.count') }}</small>
        </span>
        <i class="ri-add-line" />
      </button>
      <div v-if="!loading && !playlists.length" class="inline-playlist-state">
        {{ t('common.noData') }}
      </div>
      <!-- 创建新歌单:任何页面通用入口 -->
      <button v-if="!loading" type="button" class="inline-playlist-row create-row" @click="createAndAdd">
        <span class="create-icon"><i class="ri-add-line" /></span>
        <span>
          <strong>{{ t('comp.playlistDrawer.createPlaylist') || '创建新歌单' }}</strong>
          <small>{{ t('comp.playlistDrawer.createAndAdd') || '新建并添加这首歌' }}</small>
        </span>
      </button>
      <div v-if="creating" class="inline-playlist-create">
        <input
          v-model="newPlaylistName"
          type="text"
          maxlength="40"
          :placeholder="t('comp.playlistDrawer.namePlaceholder') || '给新歌单起个名字'"
          @keyup.enter="confirmCreate"
        />
        <button type="button" :disabled="!newPlaylistName.trim() || createBusy" @click="confirmCreate">
          {{ createBusy ? t('common.loading') : t('common.confirm') || '确定' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NImage, useMessage } from 'naive-ui';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { createPlaylist, updatePlaylistTracks } from '@/api/music';
import { getUserPlaylist } from '@/api/user';
import { registerMobileBackLayer } from '@/services/mobileBackStack';
import { useLocalPlaylistStore } from '@/store/modules/localPlaylist';
import { useUserStore } from '@/store/modules/user';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';
import { getLoginErrorMessage, hasPermission } from '@/utils/auth';

const props = defineProps<{
  song: SongResult;
  expanded: boolean;
  backLayerId: string;
}>();

const emit = defineEmits<{
  'update:expanded': [value: boolean];
  added: [];
}>();

const { t } = useI18n();
const message = useMessage();
const userStore = useUserStore();
const localPlaylistStore = useLocalPlaylistStore();
const loading = ref(false);
const playlists = ref<any[]>([]);
let unregisterBackLayer: (() => void) | undefined;

const loadPlaylists = async () => {
  if (playlists.value.length) return;
  if (!userStore.user?.userId || !hasPermission(true)) {
    message.error(getLoginErrorMessage(true));
    return;
  }
  loading.value = true;
  try {
    const response = await getUserPlaylist(userStore.user.userId, 999);
    playlists.value = (response.data?.playlist || []).filter(
      (playlist: any) => playlist.userId === userStore.user?.userId
    );
  } catch (error) {
    console.error('获取歌单失败:', error);
    message.error(t('comp.playlistDrawer.getPlaylistFailed'));
  } finally {
    loading.value = false;
  }
};

const toggle = async () => {
  const next = !props.expanded;
  emit('update:expanded', next);
  if (next) await loadPlaylists();
};

// ==================== 创建新歌单 ====================
const creating = ref(false);
const createBusy = ref(false);
const newPlaylistName = ref('');

const createAndAdd = () => {
  creating.value = true;
  newPlaylistName.value = '';
};

const confirmCreate = async () => {
  const name = newPlaylistName.value.trim();
  if (!name || createBusy.value) return;
  createBusy.value = true;
  try {
    const response = await createPlaylist({ name, privacy: 0 });
    const playlistId = response.data?.data?.id || response.data?.playlist?.id;
    if (!playlistId) throw new Error(response.data?.message || '创建歌单失败');
    playlists.value.unshift({
      id: playlistId,
      name,
      trackCount: 0,
      coverImgUrl: '',
      picUrl: ''
    });
    creating.value = false;
    newPlaylistName.value = '';
    // 创建后直接把当前歌加入新歌单
    await addToPlaylist({ id: playlistId, name });
  } catch (error: any) {
    message.error(error?.message || '创建歌单失败');
  } finally {
    createBusy.value = false;
  }
};

const addToPlaylist = async (playlist: any) => {
  const song = props.song;
  const useLocalStorage =
    song.platform === 'server' ||
    song.playMusicUrl?.startsWith('local://') ||
    (song.platform && song.platform !== 'netease');

  if (useLocalStorage) {
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

  emit('update:expanded', false);
  emit('added');
};

onMounted(() => {
  unregisterBackLayer = registerMobileBackLayer({
    id: props.backLayerId,
    priority: 1080,
    isActive: () => props.expanded,
    onBack: () => emit('update:expanded', false)
  });
});

onBeforeUnmount(() => unregisterBackLayer?.());
</script>

<style scoped lang="scss">
.inline-playlist-picker {
  position: relative;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 18px;
  transition:
    border-color 220ms ease,
    background-color 220ms ease;

  &.expanded {
    border-color: color-mix(in srgb, var(--accent-color, #888) 16%, transparent);
    background: color-mix(in srgb, var(--accent-color, #888) 8%, transparent);
  }
}

.inline-playlist-trigger {
  display: flex;
  width: 100%;
  min-height: 44px;
  align-items: center;
  gap: 14px;
  padding: 11px 8px 11px 16px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;

  > i:first-child {
    width: 22px;
    color: var(--d-text-secondary, #aaa);
    font-size: 20px;
    text-align: center;
  }

  > span {
    min-width: 0;
    flex: 1;
  }
}

.inline-playlist-arrow {
  color: var(--d-text-muted, #999);
  font-size: 16px;
  transition: transform 360ms cubic-bezier(0.32, 0.72, 0, 1);

  .expanded & {
    transform: rotate(180deg);
  }
}

.inline-playlist-content {
  display: grid;
  max-height: 0;
  gap: 5px;
  padding: 0 8px;
  overflow: hidden;
  opacity: 0;
  transition:
    max-height 420ms cubic-bezier(0.32, 0.72, 0, 1),
    padding 420ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 160ms ease;

  .expanded & {
    max-height: min(38dvh, 340px);
    padding: 2px 8px 9px;
    overflow-y: auto;
    opacity: 1;
    overscroll-behavior: contain;
  }
}

.inline-playlist-row {
  display: flex;
  min-height: 56px;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: 0;
  border-radius: 14px;
  background: color-mix(in srgb, var(--m-surface-alt, #888) 32%, transparent);
  color: inherit;
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
  }

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: var(--d-text-muted, #999);
    font-size: 11px;
  }

  > i {
    color: var(--accent-color);
    font-size: 18px;
  }
}

.inline-playlist-state {
  display: grid;
  min-height: 68px;
  place-items: center;
  color: var(--d-text-muted, #999);
  font-size: 12px;
}

/* 创建新歌单行:虚线描边卡,与列表行同圆角语言 */
.create-row {
  border: 1px dashed color-mix(in srgb, var(--d-text-muted, #999) 45%, transparent);
  background: transparent;

  .create-icon {
    display: grid;
    width: 42px;
    height: 42px;
    flex: 0 0 42px;
    place-items: center;
    border-radius: 12px;
    background: color-mix(in srgb, var(--accent-color, #888) 14%, transparent);

    i {
      color: var(--accent-color);
      font-size: 20px;
    }
  }
}

.inline-playlist-create {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  padding: 4px 0 2px;

  input {
    min-width: 0;
    padding: 9px 12px;
    border: 1px solid color-mix(in srgb, var(--d-text-muted, #999) 40%, transparent);
    border-radius: 12px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 13px;
    outline: none;

    &:focus {
      border-color: var(--accent-color, #888);
    }
  }

  button {
    padding: 0 16px;
    border: 0;
    border-radius: 12px;
    background: var(--accent-color, #888);
    color: #141414;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
    }
  }
}

.is-spinning {
  animation: inline-playlist-spin 900ms linear infinite;
}

@keyframes inline-playlist-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .inline-playlist-picker,
  .inline-playlist-arrow,
  .inline-playlist-content {
    transition-duration: 80ms;
  }
}
</style>
