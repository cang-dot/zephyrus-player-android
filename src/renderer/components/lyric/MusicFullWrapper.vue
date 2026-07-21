<template>
  <component
    v-if="!isFullScreenStyle"
    :is="componentToUse"
    v-bind="$attrs"
    :player-style="playerStyle"
    :key="playerStyle"
    ref="musicFullRef"
  />
  <Teleport v-else to="#layout-main">
    <component :is="componentToUse" v-bind="$attrs" :player-style="playerStyle" :key="playerStyle" ref="musicFullRef" />
  </Teleport>
</template>

<script setup lang="ts">
import { computed, markRaw, onMounted, onUnmounted, ref } from 'vue';

import EerieMobilePlayer from '@/components/lyric/EerieMobilePlayer.vue';
import FrenzyMobilePlayer from '@/components/lyric/FrenzyMobilePlayer.vue';
import MagazineMobilePlayer from '@/components/lyric/MagazineMobilePlayer.vue';
import MusicFull from '@/components/lyric/MusicFull.vue';
import MusicFullMobile from '@/components/lyric/MusicFullMobile.vue';
import NeonMobilePlayer from '@/components/lyric/NeonMobilePlayer.vue';
import StageMobilePlayer from '@/components/lyric/StageMobilePlayer.vue';
import { getStyle } from '@/playerStyles';
import { DEFAULT_LYRIC_CONFIG } from '@/types/lyric';
import { isMobile } from '@/utils';

// 响应式配置状态
const playerStyle = ref<string>(DEFAULT_LYRIC_CONFIG.playerStyle);

// 从 localStorage 读取配置
function loadConfig() {
  const saved = localStorage.getItem('music-full-config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      playerStyle.value = parsed.playerStyle || DEFAULT_LYRIC_CONFIG.playerStyle;
    } catch {
      playerStyle.value = DEFAULT_LYRIC_CONFIG.playerStyle;
    }
  }
}

// 初始化加载
loadConfig();

// 监听 localStorage 变化
function handleStorageChange(e: StorageEvent) {
  if (e.key === 'music-full-config') {
    loadConfig();
  }
}

// 自定义事件监听
function handleConfigUpdate() {
  loadConfig();
}

onMounted(() => {
  window.addEventListener('storage', handleStorageChange);
  window.addEventListener('music-full-config-updated', handleConfigUpdate);
});

onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange);
  window.removeEventListener('music-full-config-updated', handleConfigUpdate);
});

// 全屏样式判断：桌面端某些样式需要 Teleport 到 #layout-main，
// 移动端组件自带 teleport/n-drawer，不需要外层 teleport。
const isFullScreenStyle = computed(() => {
  if (isMobile.value) return false;
  const style = getStyle(playerStyle.value);
  return style?.isFullScreen ?? false;
});

const componentToUse = computed(() => {
  const style = getStyle(playerStyle.value);

  // 移动端（竖屏与横屏）：默认样式使用 MusicFullMobile，
  // 非默认样式使用各自专属的移动端组件（自带全屏滚动歌词+样式背景+控件自动隐藏）。
  if (isMobile.value) {
    if (style) {
      switch (style.key) {
        case 'default':
          return markRaw(MusicFullMobile);
        case 'magazine':
          return markRaw(MagazineMobilePlayer);
        case 'stage':
          return markRaw(StageMobilePlayer);
        case 'frenzy':
          return markRaw(FrenzyMobilePlayer);
        case 'eerie':
          return markRaw(EerieMobilePlayer);
        case 'neon':
          return markRaw(NeonMobilePlayer);
      }
    }
    return markRaw(MusicFullMobile);
  }

  // 桌面端：直接使用原始组件
  if (style) {
    return markRaw(style.component);
  }
  return markRaw(MusicFull);
});

const musicFullRef = ref<InstanceType<typeof MusicFull>>();

defineExpose({
  musicFullRef
});
</script>
