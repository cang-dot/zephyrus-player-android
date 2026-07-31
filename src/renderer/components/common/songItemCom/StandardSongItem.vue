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
    class="standard-song-item"
    ref="baseItem"
  >
    <!-- 选择框插槽-->
    <template #select>
      <div v-if="baseItem && selectable" class="song-item-select" @click.stop="onToggleSelect">
        <n-checkbox :checked="selected" />
      </div>
    </template>

    <!-- 鍥剧墖鎻掓Ы -->
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

    <!-- 鍐呭鎻掓Ы -->
    <template #content>
      <div class="song-item-content">
        <div class="song-item-content-title">
          <n-ellipsis
            class="text-ellipsis"
            line-clamp="1"
            :class="{ 'text-[var(--accent-color)]': isPlaying }"
            >{{ item.name }}</n-ellipsis
          >
        </div>
        <div class="song-item-content-name">
          <n-ellipsis class="text-ellipsis" line-clamp="1">
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
        <div v-if="item.al?.name" class="song-item-content-album">
          <n-ellipsis class="text-ellipsis" line-clamp="1">{{ item.al.name }}</n-ellipsis>
        </div>
      </div>
    </template>

    <!-- 鎿嶄綔鎻掓Ы -->
    <template #operating>
      <div class="song-item-operating">
        <button class="song-item-operating-menu" type="button" @click.stop="onMenuClick">
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

// 从playerStore和baseItem鑾峰彇鍝嶅簲寮忕姸鎬
const isPlaying = computed(() => baseItem.value?.isPlaying || false);
const artists = computed(() => baseItem.value?.artists || []);

// 鍖呰鏂规硶锛岄伩鍏嶇洿鎺ヨ闂彲鑳戒负undefined的ref
const onToggleSelect = () => {
  baseItem.value?.toggleSelect();
};
const onImageLoad = (event: Event) => baseItem.value?.imageLoad(event);
const onArtistClick = (id: number) => baseItem.value?.handleArtistClick(id);
const onMenuClick = (event: MouseEvent) => baseItem.value?.openItemMenu(event);
</script>

<style lang="scss" scoped>
.standard-song-item {
  .song-item-img {
    @apply w-12 h-12 mr-4;
    border-radius: var(--d-radius-lg);
  }

  .song-item-content {
    @apply flex-1;

    &-title {
      font-size: var(--d-text-base);
      color: var(--d-text-primary);
    }

    &-name {
      font-size: var(--d-text-xs);
      color: var(--d-text-secondary);
    }

    &-album {
      font-size: var(--d-text-xs);
      color: var(--d-text-muted);
      @apply mt-0.5;
    }
  }

  .song-item-operating {
    @apply flex items-center ml-4;
    background: transparent;
    border: none;

    &-menu {
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

  .song-item-select {
    @apply mr-3 cursor-pointer;
  }
}

@media (prefers-reduced-motion: reduce) {
  .standard-song-item .song-item-operating-menu {
    transition:
      color 120ms ease,
      background-color 120ms ease;
  }

  .standard-song-item .song-item-operating-menu:active {
    transform: none;
  }
}
</style>
