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
    class="plain-song-item"
    ref="baseItem"
  >
    <!-- 选择模式用复选框替序号 -->
    <template #select>
      <div v-if="selectable" class="plain-select" @click.stop="onToggleSelect">
        <n-checkbox :checked="selected" />
      </div>
    </template>

    <!-- 序号位：播放中显示圆点，否则显示序号 -->
    <template #index>
      <div class="plain-index">
        <span v-if="isPlaying" class="plain-playing-dot" aria-label="playing" />
        <template v-else>{{ (index ?? 0) + 1 }}</template>
      </div>
    </template>

    <!-- 小封面 -->
    <template #image>
      <n-image
        v-if="item.picUrl"
        :src="getImgUrl(item.picUrl, '100y100')"
        class="plain-cover"
        preview-disabled
        :img-props="{
          crossorigin: 'anonymous'
        }"
        @load="onImageLoad"
      />
    </template>

    <template #content>
      <div class="plain-content">
        <div class="plain-title">
          <n-ellipsis line-clamp="1" :class="{ 'plain-title-playing': isPlaying }">
            <song-title-text :name="item.name" :song-id="item.id" />
          </n-ellipsis>
        </div>
        <div v-if="artists.length" class="plain-artist">
          <n-ellipsis line-clamp="1">
            <template v-for="(artist, i) in artists" :key="i">
              <span class="plain-artist-name" @click.stop="onArtistClick(artist.id)">{{
                artist.name
              }}</span>
              <span v-if="i < artists.length - 1"> / </span>
            </template>
          </n-ellipsis>
        </div>
      </div>
    </template>

    <template #operating>
      <div class="plain-operating">
        <button class="plain-more" type="button" @click.stop="onMenuClick">
          <i class="ri-more-2-fill"></i>
        </button>
      </div>
    </template>
  </base-song-item>
</template>

<script lang="ts" setup>
import { NCheckbox, NEllipsis, NImage } from 'naive-ui';
import { computed, ref } from 'vue';

import SongTitleText from '@/components/common/SongTitleText.vue';
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

const onImageLoad = (event: Event) => baseItem.value?.imageLoad(event);
const onToggleSelect = () => baseItem.value?.toggleSelect();
const onArtistClick = (id: number) => baseItem.value?.handleArtistClick(id);
const onMenuClick = (event: MouseEvent) => baseItem.value?.openItemMenu(event);
</script>

<style lang="scss" scoped>
.plain-song-item {
  @apply flex items-center;
  padding: 12px 2px;
  /* 容器自身零描边、零底色；分割线由外层 .song-item-wrap 的伪元素绘制（正好在容器交界） */
  border: 0;

  .plain-index {
    @apply flex items-center justify-center shrink-0;
    width: 30px;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
    color: rgba(var(--page-chrome-ink-rgb, 23, 23, 26), 0.55);
  }

  .plain-playing-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent-color, currentColor);
  }

  .plain-cover {
    @apply shrink-0;
    width: 44px;
    height: 44px;
    margin-right: 12px;
    border-radius: 7px;
    overflow: hidden;

    :deep(img) {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .plain-select {
    @apply shrink-0 cursor-pointer;
    margin-right: 10px;
  }

  .plain-content {
    @apply flex-1 min-w-0;
  }

  .plain-title {
    font-size: 15px;
    line-height: 1.3;
    color: rgba(var(--page-chrome-ink-rgb, 23, 23, 26), 0.94);

    :deep(.plain-title-playing) {
      color: var(--accent-color);
    }
  }

  .plain-artist {
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.3;
    color: rgba(var(--page-chrome-ink-rgb, 23, 23, 26), 0.52);
  }

  .plain-artist-name {
    cursor: pointer;
  }

  .plain-operating {
    @apply flex items-center shrink-0;
    margin-left: 12px;

    .plain-more {
      @apply flex items-center justify-center rounded-full;
      width: 32px;
      height: 32px;
      border: 0;
      background: transparent;
      color: rgba(var(--page-chrome-ink-rgb, 23, 23, 26), 0.55);
      cursor: pointer;

      i {
        @apply text-xl;
      }

      &:active {
        transform: scale(0.94);
      }
    }
  }
}
</style>
