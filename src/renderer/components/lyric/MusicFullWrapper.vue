<template>
  <component
    v-if="!isFullScreenStyle"
    :is="componentToUse"
    v-bind="$attrs"
    :player-style="playerStyle"
    :key="renderKey"
    ref="musicFullRef"
  />
  <Teleport v-else to="#layout-main">
    <component
      :is="componentToUse"
      v-bind="$attrs"
      :player-style="playerStyle"
      :key="renderKey"
      ref="musicFullRef"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core';
import { computed, markRaw, onMounted, onUnmounted, ref, watch } from 'vue';

import EerieMobilePlayer from '@/components/lyric/EerieMobilePlayer.vue';
import FrenzyMobilePlayer from '@/components/lyric/FrenzyMobilePlayer.vue';
import MagazineMobilePlayer from '@/components/lyric/MagazineMobilePlayer.vue';
import MusicFull from '@/components/lyric/MusicFull.vue';
import MusicFullMobile from '@/components/lyric/MusicFullMobile.vue';
import NeonMobilePlayer from '@/components/lyric/NeonMobilePlayer.vue';
import RainMobilePlayer from '@/components/lyric/RainMobilePlayer.vue';
import StageMobilePlayer from '@/components/lyric/StageMobilePlayer.vue';
import StarChartPlayer from '@/components/lyric/StarChartPlayer.vue';
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

// 横竖屏检测（仅移动端使用）
const { width, height } = useWindowSize();
const isLandscape = computed(() => width.value > height.value);

// 全屏样式判断：桌面端某些样式需要 Teleport 到 #layout-main，
// 移动端组件自带 teleport/n-drawer，不需要外层 teleport。
const isFullScreenStyle = computed(() => {
  if (isMobile.value) return false;
  const style = getStyle(playerStyle.value);
  return style?.isFullScreen ?? false;
});

// 移动端专用组件映射
const mobileStyleComponents: Record<string, any> = {
  magazine: markRaw(MagazineMobilePlayer),
  stage: markRaw(StageMobilePlayer),
  starChart: markRaw(StarChartPlayer),
  frenzy: markRaw(FrenzyMobilePlayer),
  eerie: markRaw(EerieMobilePlayer),
  neon: markRaw(NeonMobilePlayer),
  rain: markRaw(RainMobilePlayer)
};

const componentToUse = computed(() => {
  const style = getStyle(playerStyle.value);

  // 移动端
  if (isMobile.value) {
    // 非默认样式使用各自专属的移动端组件（竖屏+横屏）
    if (style && mobileStyleComponents[style.key]) {
      return mobileStyleComponents[style.key];
    }

    // 默认样式使用 MusicFullMobile
    return markRaw(MusicFullMobile);
  }

  // 桌面端：直接使用原始组件
  if (style) {
    return markRaw(style.component);
  }
  return markRaw(MusicFull);
});

// 当从竖屏切换到横屏（或反之）时，需要强制重新渲染组件
// 通过 watch isLandscape 触发 key 变化（已在 template 中用 :key 绑定）
const renderKey = computed(() => `${playerStyle.value}-${isLandscape.value ? 'l' : 'p'}`);

const musicFullRef = ref<InstanceType<typeof MusicFull>>();

defineExpose({
  musicFullRef
});
</script>
