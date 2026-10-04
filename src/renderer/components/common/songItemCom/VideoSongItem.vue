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
    class="video-song-item"
    ref="baseItem"
  >
    <template #select>
      <div v-if="selectable" class="video-select" @click.stop="onToggleSelect">
        <n-checkbox :checked="selected" />
      </div>
    </template>

    <!-- 视频封面：圆角长矩形（16:9），与常规方形歌曲封面区分 -->
    <template #image>
      <div class="video-cover">
        <n-image
          v-if="item.picUrl"
          :src="getImgUrl(item.picUrl, '400y225')"
          class="video-cover-img"
          preview-disabled
          :img-props="{
            crossorigin: coverCrossOriginAttr(item.picUrl),
            // B 站图床拒绝带外域 Referer 的请求（403），禁用 Referer 才能加载
            referrerpolicy: 'no-referrer'
          }"
          @load="onImageLoad"
        />
        <div v-else class="video-cover-img video-cover-placeholder">
          <i class="ri-movie-2-line"></i>
        </div>
        <span class="video-cover-duration">{{ durationText }}</span>
        <span class="video-cover-play"><i class="ri-play-fill" /></span>
      </div>
    </template>

    <template #content>
      <div class="video-content">
        <div class="video-title">
          <n-ellipsis :line-clamp="2" :class="{ 'video-title-playing': isPlaying }">
            <song-title-text :name="item.name" :song-id="item.id" />
          </n-ellipsis>
        </div>
        <div class="video-meta">
          <span
            v-if="artists.length"
            class="video-author"
            @click.stop="onArtistClick(artists[0].id)"
          >
            <i class="ri-user-3-line" />{{ artists[0].name }}
          </span>
          <span class="video-source-tag">视频</span>
        </div>
      </div>
    </template>

    <template #operating>
      <div class="video-operating">
        <button class="video-more" type="button" @click.stop="onMenuClick">
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
import { coverCrossOriginAttr, getImgUrl } from '@/utils';

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

/** 时长角标（item.count 存放毫秒时长） */
const durationText = computed(() => {
  const ms = Number(props.item.count || props.item.duration || 0);
  if (!ms || ms <= 0) return '';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
});

const onImageLoad = (event: Event) => baseItem.value?.imageLoad(event);
const onToggleSelect = () => baseItem.value?.toggleSelect();
const onArtistClick = (id: number) => baseItem.value?.handleArtistClick(id);
const onMenuClick = (event: MouseEvent) => baseItem.value?.openItemMenu(event);
</script>

<style lang="scss" scoped>
.video-song-item {
  @apply flex items-center;
  /* 与 .song-item 的 p-3 对齐：左右 12px，视频行不再贴屏幕边缘 */
  padding: 10px 12px;
  border: 0;

  .video-select {
    @apply shrink-0 cursor-pointer;
    margin-right: 10px;
  }

  .video-cover {
    position: relative;
    @apply shrink-0;
    width: 128px;
    aspect-ratio: 16 / 9;
    margin-right: 12px;
    border-radius: var(--d-radius-md, 12px);
    overflow: hidden;
    background: var(--d-surface-hover, rgba(128, 128, 128, 0.12));

    .video-cover-img {
      display: block;
      width: 100%;
      height: 100%;

      :deep(img) {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .video-cover-placeholder {
      @apply flex items-center justify-center;
      color: rgba(var(--page-chrome-ink-rgb, 23, 23, 26), 0.42);
      font-size: 22px;
    }

    .video-cover-duration {
      position: absolute;
      right: 4px;
      bottom: 4px;
      padding: 0 4px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.62);
      color: #fff;
      font-size: 10px;
      line-height: 15px;
      font-variant-numeric: tabular-nums;
    }

    .video-cover-play {
      @apply flex items-center justify-center;
      position: absolute;
      left: 4px;
      bottom: 4px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.5);
      color: #fff;
      font-size: 11px;
    }
  }

  .video-content {
    @apply flex-1 min-w-0;
  }

  .video-title {
    font-size: 14px;
    line-height: 1.32;
    color: rgba(var(--page-chrome-ink-rgb, 23, 23, 26), 0.94);

    :deep(.video-title-playing) {
      color: var(--accent-color);
    }
  }

  .video-meta {
    @apply flex items-center;
    margin-top: 4px;
    gap: 6px;
    font-size: 12px;
    color: rgba(var(--page-chrome-ink-rgb, 23, 23, 26), 0.52);
  }

  .video-author {
    @apply inline-flex items-center;
    gap: 3px;
    min-width: 0;
    cursor: pointer;
  }

  .video-source-tag {
    flex-shrink: 0;
    padding: 0 4px;
    border-radius: 4px;
    background: rgba(251, 114, 153, 0.14);
    color: #fb7299;
    font-size: 10px;
    line-height: 15px;
  }

  .video-operating {
    @apply flex items-center shrink-0;
    margin-left: 8px;

    .video-more {
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
