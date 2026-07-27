<template>
  <transition name="sheet-up">
    <div v-if="show" class="mobile-sheet-overlay" @click="$emit('update:show', false)">
      <div class="mobile-action-sheet" @click.stop>
        <!-- 歌曲预览 -->
        <div class="sheet-song-preview">
          <n-image
            :src="getImgUrl(item.picUrl || item.al?.picUrl, '200y200')"
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

        <!-- 操作列表 -->
        <div class="sheet-actions">
          <button class="sheet-action-btn" @click="handleAction('play')">
            <i class="ri-play-circle-line"></i>
            <span>{{ t('songItem.menu.play') }}</span>
          </button>
          <button class="sheet-action-btn" @click="handleAction('playNext')">
            <i class="ri-play-list-2-line"></i>
            <span>{{ t('songItem.menu.playNext') }}</span>
          </button>
          <button class="sheet-action-btn" @click="handleAction('addToPlaylist')">
            <i class="ri-folder-add-line"></i>
            <span>{{ t('songItem.menu.addToPlaylist') }}</span>
          </button>
          <button class="sheet-action-btn" @click="handleAction('favorite')">
            <i :class="isFavorite ? 'ri-heart-fill text-red-500' : 'ri-heart-line'"></i>
            <span>{{ isFavorite ? t('songItem.menu.unfavorite') : t('songItem.menu.favorite') }}</span>
          </button>
          <button v-if="canRemove" class="sheet-action-btn sheet-action-danger" @click="handleAction('remove')">
            <i class="ri-delete-bin-line"></i>
            <span>{{ t('songItem.menu.removeFromPlaylist') }}</span>
          </button>
        </div>

        <!-- 取消按钮 -->
        <button class="sheet-cancel-btn" @click="$emit('update:show', false)">
          {{ t('comp.playlistDrawer.cancelCreate') === 'comp.playlistDrawer.cancelCreate' ? '取消' : t('comp.playlistDrawer.cancelCreate') }}
        </button>
      </div>
    </div>
  </transition>
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
}>();

const artistNames = computed(() => {
  const artists = props.item.ar || props.item.artists || [];
  if (Array.isArray(artists)) {
    return artists.map((a: any) => a.name).join(' / ');
  }
  return String(artists || '');
});

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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.mobile-action-sheet {
  width: 100%;
  max-width: 500px;
  background: var(--d-surface, #fff);
  border-radius: 20px 20px 0 0;
  padding: 16px 0 8px;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
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
  transition: background 0.15s;

  &:active {
    background: var(--d-surface-hover, rgba(0, 0, 0, 0.04));
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
  transition: background 0.15s;

  &:active {
    background: var(--d-border, rgba(0, 0, 0, 0.08));
  }
}

/* Transition */
.sheet-up-enter-active,
.sheet-up-leave-active {
  transition: opacity 0.25s ease;

  .mobile-action-sheet {
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }
}

.sheet-up-enter-from,
.sheet-up-leave-to {
  opacity: 0;

  .mobile-action-sheet {
    transform: translateY(100%);
  }
}
</style>
