<template>
  <base-song-item
    ref="baseItem"
    class="home-song-card"
    :item="item"
    :selectable="selectable"
    :selected="selected"
    :can-remove="canRemove"
    :is-next="isNext"
    :index="index"
    @play="(...args) => $emit('play', ...args)"
    @select="(...args) => $emit('select', ...args)"
    @remove-song="(...args) => $emit('remove-song', ...args)"
  >
    <template #image>
      <n-image
        v-if="item.picUrl"
        :src="getImgUrl(item.picUrl, '200y200')"
        class="home-song-cover"
        preview-disabled
        :img-props="{
          crossorigin: 'anonymous',
          loading: 'lazy',
          alt: item.name
        }"
      />
    </template>

    <template #content>
      <div class="song-info">
        <n-ellipsis class="song-name" :class="{ 'is-playing': isPlaying }">
          {{ item.name }}
        </n-ellipsis>
        <n-ellipsis class="artist-name">
          <template v-for="(artist, artistIndex) in artists" :key="artist.id || artistIndex">
            <span class="artist-link" @click.stop="onArtistClick(artist.id)">
              {{ artist.name }}
            </span>
            <span v-if="artistIndex < artists.length - 1"> / </span>
          </template>
        </n-ellipsis>
      </div>
    </template>

    <template #operating>
      <button class="more-btn" type="button" @click.stop="onMenuClick">
        <i class="ri-more-2-fill" />
      </button>
    </template>
  </base-song-item>
</template>

<script lang="ts" setup>
import { NEllipsis, NImage } from 'naive-ui';
import { computed, ref } from 'vue';

import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';

import BaseSongItem from './BaseSongItem.vue';

withDefaults(
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

const onArtistClick = (id: number) => baseItem.value?.handleArtistClick(id);
const onMenuClick = (event: MouseEvent) => baseItem.value?.openItemMenu(event);
</script>

<style lang="scss" scoped>
.home-song-card {
  gap: 12px;
  min-height: 68px;
  padding: 8px 10px;
  border-radius: var(--d-radius-lg);
  transition:
    background-color 180ms ease,
    transform 160ms cubic-bezier(0.23, 1, 0.32, 1);

  &:active {
    transform: scale(0.99);
  }
}

.home-song-cover {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: var(--d-radius-lg);
  background: var(--d-surface-hover);

  :deep(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 220ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  .home-song-card.is-active & :deep(img) {
    transform: scale(1.035);
  }
}

.song-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.song-name {
  color: var(--d-text-primary);
  font-size: var(--d-text-base);
  font-weight: 600;
  transition: color 150ms ease;

  &.is-playing {
    color: var(--accent-color);
  }
}

.artist-name {
  margin-top: 2px;
  color: var(--d-text-secondary);
  font-size: var(--d-text-xs);
}

.artist-link {
  cursor: pointer;
  transition: color 150ms ease;

  &:hover {
    color: var(--accent-color);
  }
}

.more-btn {
  display: flex;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--d-text-secondary);
  cursor: pointer;
  transition:
    color 150ms ease,
    background-color 150ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  i {
    font-size: 20px;
  }

  &:hover {
    background: var(--d-surface-hover);
    color: var(--accent-color);
  }

  &:active {
    transform: scale(0.96);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-song-card,
  .home-song-cover :deep(img),
  .song-name,
  .artist-link,
  .more-btn {
    transition-duration: 0ms;
  }

  .home-song-card:active,
  .more-btn:active {
    transform: none;
  }
}
</style>
