<script setup lang="ts">
/**
 * 歌名展示拆分：main + suffix 两段行内文本。
 * suffix（结尾括号后缀 / 春晓中英连写的英文段）同字号、淡一级颜色；
 * `hideSuffix` 为 true 时只显示 main（播放页大标题）。
 * 内容为纯行内文本，不破坏父容器的 text-overflow / line-clamp。
 */
import { computed } from 'vue';

import { splitSongTitle } from '@/utils/songTitle';

const props = withDefaults(
  defineProps<{
    name: string;
    songId?: string | number | null;
    hideSuffix?: boolean;
  }>(),
  { songId: null, hideSuffix: false }
);

const parts = computed(() => splitSongTitle(props.name, props.songId));
</script>

<template>
  <span class="song-title-text">
    <span class="song-title-main">{{ parts.main }}</span>
    <span v-if="!hideSuffix && parts.suffix" class="song-title-suffix">{{ parts.suffix }}</span>
  </span>
</template>

<style scoped>
.song-title-suffix {
  opacity: 0.62;
}
</style>
