<template>
  <base-song-item
    :item="item"
    :selectable="selectable"
    :selected="selected"
    :can-remove="canRemove"
    :is-next="isNext"
    :index="index"
    @play="(...args) => $emit('play', ...args)"
    @select="(...args) => $emit('select', ...args)"
    @remove-song="(...args) => $emit('remove-song', ...args)"
    class="compact-song-item"
    ref="baseItem"
  >
    <!-- 索引插槽 -->
    <template #index>
      <div
        v-if="index !== undefined"
        class="song-item-index"
        :class="{ 'text-[var(--accent-color)]': isPlaying }"
      >
        {{ index + 1 }}
      </div>
    </template>

    <!-- 选择框插槽-->
    <template #select>
      <div v-if="baseItem && selectable" class="song-item-select" @click.stop="onToggleSelect">
        <n-checkbox :checked="selected" />
      </div>
    </template>

    <!-- 内容插槽 -->
    <template #content>
      <div class="song-item-content-compact">
        <div class="song-item-content-compact-wrapper">
          <div class="song-item-content-compact-title">
            <n-ellipsis
              class="text-ellipsis"
              line-clamp="1"
              :class="{ 'text-[var(--accent-color)]': isPlaying }"
            >
              {{ item.name }}
            </n-ellipsis>
          </div>
          <div class="song-item-content-compact-artist">
            <n-ellipsis line-clamp="1">
              <template v-for="(artist, index) in artists" :key="index">
                <span
                  class="cursor-pointer hover:text-[var(--accent-color)]"
                  @click.stop="onArtistClick(artist.id)"
                  >{{ artist.name }}</span
                >
                <span v-if="index < artists.length - 1"> / </span>
              </template>
            </n-ellipsis>
          </div>
        </div>
        <div class="song-item-content-compact-album">
          <n-ellipsis
            line-clamp="1"
            class="cursor-pointer hover:text-[var(--accent-color)]"
            @click.stop="onAlbumNameClick"
            >{{ item.al?.name || '-' }}</n-ellipsis
          >
        </div>
        <div class="song-item-content-compact-duration">
          {{ formatDuration(getDuration(item)) }}
        </div>
      </div>
    </template>

    <!-- 操作插槽 -->
    <template #operating>
      <div class="song-item-operating-compact">
        <button class="song-item-operating-menu" type="button" @click.stop="onMenuClick">
          <i class="ri-more-2-fill"></i>
        </button>
      </div>
    </template>
  </base-song-item>
</template>

<script lang="ts" setup>
import { NCheckbox, NEllipsis } from 'naive-ui';
import { computed, ref } from 'vue';

import type { SongResult } from '@/types/music';

import BaseSongItem from './BaseSongItem.vue';

const props = withDefaults(
  defineProps<{
    item: SongResult;
    favorite?: boolean;
    selectable?: boolean;
    selected?: boolean;
    canRemove?: boolean;
    isNext?: boolean;
    index?: number;
  }>(),
  {
    favorite: true,
    selectable: false,
    selected: false,
    canRemove: false,
    isNext: false,
    index: undefined
  }
);

defineEmits(['play', 'select', 'remove-song']);
const baseItem = ref<InstanceType<typeof BaseSongItem>>();

const isPlaying = computed(() => baseItem.value?.isPlaying || false);
const artists = computed(() => baseItem.value?.artists || []);

const onAlbumNameClick = () => {
  const albumId = props.item.al?.id ?? (props.item as any).album?.id ?? -1;
  baseItem.value?.handleAlbumClick(albumId);
};

const onToggleSelect = () => {
  baseItem.value?.toggleSelect();
};
const onArtistClick = (id: number) => baseItem.value?.handleArtistClick(id);
const onMenuClick = (event: MouseEvent) => baseItem.value?.openItemMenu(event);

// 格式化时长和获取时长方法
const getDuration = (item: SongResult): number => {
  if (item.duration) return item.duration;
  if (typeof item.dt === 'number') return item.dt;
  return 0;
};

const formatDuration = (ms: number): string => {
  if (!ms) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};
</script>

<style lang="scss" scoped>
.compact-song-item {
  @apply rounded-[var(--d-radius-lg)] p-2 h-12 mb-1;
  border-bottom: 1px solid var(--d-border-light);

  .song-item-index {
    @apply w-8 text-center text-sm;
    color: var(--d-text-secondary);
  }

  .song-item-select {
    @apply mr-3 cursor-pointer;
  }

  .song-item-content-compact {
    @apply flex-1 flex items-center gap-2;

    &-wrapper {
      @apply flex-[2] flex items-center gap-2 min-w-0;
    }

    &-title {
      @apply flex-[2.5] min-w-0 text-sm cursor-pointer flex items-center;
      color: var(--d-text-primary);
    }

    &-artist {
      @apply flex-[1.5] min-w-0 text-sm flex items-center;
      color: var(--d-text-secondary);
    }

    &-album {
      @apply flex-[1.5] min-w-0 text-sm flex items-center;
      color: var(--d-text-secondary);
    }

    &-duration {
      @apply w-14 flex-shrink-0 text-sm flex items-center justify-end;
      color: var(--d-text-secondary);
    }
  }

  .song-item-operating-compact {
    @apply border-none bg-transparent flex items-center justify-end min-w-[40px];

    .song-item-operating-menu {
      @apply cursor-pointer flex items-center justify-center w-8 h-8 rounded-full;
      border: 0;
      background: transparent;
      color: var(--d-text-secondary);
      transition:
        color 150ms ease,
        background-color 150ms ease,
        transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

      i {
        @apply text-xl;
      }

      &:hover {
        background: var(--d-surface-hover);
        color: var(--accent-color);

        i {
          color: var(--accent-color);
        }
      }

      &:active {
        transform: scale(0.96);
      }
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .compact-song-item .song-item-operating-menu {
    transition:
      color 120ms ease,
      background-color 120ms ease;
  }

  .compact-song-item .song-item-operating-menu:active {
    transform: none;
  }
}

// 全局应用
:deep(.text-ellipsis) {
  width: 100%;
}
</style>
