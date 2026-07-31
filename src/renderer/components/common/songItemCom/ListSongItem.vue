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
    class="list-song-item"
    ref="baseItem"
  >
    <!-- 选择框插槽-->
    <template #select>
      <div v-if="baseItem && selectable" class="song-item-select" @click.stop="onToggleSelect">
        <n-checkbox :checked="selected" />
      </div>
    </template>

    <!-- 图片插槽 -->
    <template #image>
      <n-image
        v-if="item.picUrl"
        :src="getImgUrl(item.picUrl, '100y100')"
        class="song-item-img"
        preview-disabled
        :img-props="{
          crossorigin: 'anonymous'
        }"
        @load="onImageLoad"
      />
    </template>

    <!-- 内容插槽 -->
    <template #content>
      <div class="song-item-content">
        <div class="song-item-content-wrapper">
          <n-ellipsis
            class="song-item-content-title text-ellipsis"
            line-clamp="1"
            :class="{ 'text-[var(--accent-color)]': isPlaying }"
          >
            {{ item.name }}
          </n-ellipsis>
          <div class="song-item-content-divider">-</div>
          <n-ellipsis class="song-item-content-name text-ellipsis" line-clamp="1">
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
    </template>

    <!-- 操作插槽 -->
    <template #operating>
      <div class="song-item-operating-list">
        <button class="song-item-operating-list-menu" type="button" @click.stop="onMenuClick">
          <i class="ri-more-2-fill"></i>
        </button>
      </div>
    </template>
  </base-song-item>
</template>

<script lang="ts" setup>
import { NCheckbox, NEllipsis, NImage } from 'naive-ui';
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

const onToggleSelect = () => {
  baseItem.value?.toggleSelect();
};
const onImageLoad = (event: Event) => baseItem.value?.imageLoad(event);
const onArtistClick = (id: number) => baseItem.value?.handleArtistClick(id);
const onMenuClick = (event: MouseEvent) => baseItem.value?.openItemMenu(event);
</script>

<style lang="scss" scoped>
.list-song-item {
  margin-bottom: 8px;
  padding: 8px;
  border: 1px solid var(--d-border-light);
  border-radius: var(--d-radius-md);

  .song-item-img {
    width: 2.5rem;
    height: 2.5rem;
    margin-right: 12px;
    border-radius: var(--d-radius-md);
  }

  .song-item-content {
    display: flex;
    align-items: center;
    flex: 1;

    &-wrapper {
      display: flex;
      align-items: center;
      flex: 1;
      font-size: var(--d-text-sm);
    }

    &-title {
      flex-shrink: 0;
      max-width: 45%;
      color: var(--d-text-primary);
    }

    &-divider {
      margin-left: 0.5rem;
      margin-right: 0.5rem;
      color: var(--d-text-muted);
    }

    &-name {
      flex: 1;
      min-width: 0;
      color: var(--d-text-secondary);
    }
  }

  .song-item-operating-list {
    display: flex;
    align-items: center;

    &-menu {
      cursor: pointer;
      border: 0;
      border-radius: 9999px;
      background: transparent;
      color: var(--d-text-secondary);
      display: flex;
      justify-content: center;
      align-items: center;
      width: 32px;
      height: 32px;
      transition:
        background-color 150ms ease,
        transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

      &:active {
        transform: scale(0.96);
      }

      i {
        font-size: 1.25rem;
        color: currentColor;
        transition: color 150ms ease;
      }

      &:hover {
        background: var(--d-surface-active);
        color: var(--accent-color);
      }
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .list-song-item .song-item-operating-list-menu {
    transition: background-color 120ms ease;
  }

  .list-song-item .song-item-operating-list-menu:active {
    transform: none;
  }
}
</style>
