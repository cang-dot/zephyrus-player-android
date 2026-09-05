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

import DefaultMobilePlayerV2 from '@/components/lyric/DefaultMobilePlayerV2.vue';
import LyricModePlayer from '@/components/lyric/LyricModePlayer.vue';
import MusicFull from '@/components/lyric/MusicFull.vue';
import { migrateLegacyPlayerStyle } from '@/config/playerPresets';
import { getStyle } from '@/playerStyles';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig } from '@/types/lyric';
import { isMobilePlayerStyleKey } from '@/types/playerStyle';
import { isMobile } from '@/utils';

// 响应式配置状态
const playerStyle = ref<LyricConfig['playerStyle']>(DEFAULT_LYRIC_CONFIG.playerStyle);
const playerMode = ref<LyricConfig['playerMode']>('classic');

/**
 * 读取配置并执行旧样式迁移:
 * - playerStyle='classic' → 经典模式
 * - playerStyle=旧样式 key(stage/frenzy/…) → 对应模式+三类预设(一次性写回)
 * - playerMode 已存在则直接使用(迁移只发生一次)
 */
function loadConfig() {
  const saved = localStorage.getItem('music-full-config');
  if (!saved) {
    playerStyle.value = DEFAULT_LYRIC_CONFIG.playerStyle;
    playerMode.value = 'classic';
    return;
  }
  try {
    const parsed = JSON.parse(saved) as Record<string, unknown>;
    const savedStyle = typeof parsed.playerStyle === 'string' ? parsed.playerStyle : '';
    const savedMode = typeof parsed.playerMode === 'string' ? parsed.playerMode : '';

    if (savedMode === 'classic' || savedMode === 'lyric') {
      playerMode.value = savedMode;
      playerStyle.value = savedMode === 'classic' ? 'classic' : 'default';
      return;
    }

    if (savedStyle === 'classic') {
      playerMode.value = 'classic';
      playerStyle.value = 'classic';
      parsed.playerMode = 'classic';
      localStorage.setItem('music-full-config', JSON.stringify(parsed));
      return;
    }

    if (isMobilePlayerStyleKey(savedStyle)) {
      // 旧样式迁移:映射为基础模式+三类预设并写回
      const migration = migrateLegacyPlayerStyle(savedStyle);
      playerMode.value = migration.mode;
      playerStyle.value = migration.mode === 'classic' ? 'classic' : 'default';
      parsed.playerMode = migration.mode;
      parsed.lyricPresetId = migration.lyric;
      parsed.backgroundPresetId = migration.background;
      parsed.climaxPresetId = migration.climax;
      // 保留 playerStyle 原值供旧桌面组件判断,新链路只认 playerMode
      localStorage.setItem('music-full-config', JSON.stringify(parsed));
      return;
    }

    playerStyle.value = DEFAULT_LYRIC_CONFIG.playerStyle;
    playerMode.value = 'classic';
  } catch {
    playerStyle.value = DEFAULT_LYRIC_CONFIG.playerStyle;
    playerMode.value = 'classic';
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

const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
watch(
  () => [isMobile.value, playerStore.currentSong?.id] as const,
  ([mobile, songId]) => {
    if (mobile && songId) void styleEngine.loadClimaxData(String(songId));
  },
  { immediate: true }
);

const componentToUse = computed(() => {
  // 移动端:按基础模式路由(经典 = DefaultMobilePlayerV2,大字歌词 = 预设化基座)
  if (isMobile.value) {
    return playerMode.value === 'lyric' ? markRaw(LyricModePlayer) : markRaw(DefaultMobilePlayerV2);
  }

  // 桌面端:直接使用原始组件
  const style = getStyle(playerStyle.value);
  if (style) {
    return markRaw(style.component);
  }
  return markRaw(MusicFull);
});

// 当从竖屏切换到横屏（或反之）时，需要强制重新渲染组件
// 通过 watch isLandscape 触发 key 变化（已在 template 中用 :key 绑定）
const renderKey = computed(
  () => `${playerMode.value}-${playerStyle.value}-${isLandscape.value ? 'l' : 'p'}`
);

const musicFullRef = ref<InstanceType<typeof MusicFull>>();

defineExpose({
  musicFullRef
});
</script>
