<template>
  <div class="mobile-home" :class="{ 'has-home-bg': homeBgActive }">
    <!-- 主页自定义背景层（solid/cover/image；auto=MD3 取色时不渲染） -->
    <div v-if="homeBgActive" class="home-bg-layer" :style="homeBgStyle" aria-hidden="true"></div>

    <!-- hero 提升为直接子节点：宽屏双栏下贯穿整行，窄屏单列仍是首块 -->
    <home-hero-carousel class="animate-item" />

    <div class="home-col home-col-main">
      <recent-play-row v-if="recentSongs.length" class="animate-item" />
    </div>

    <div class="home-col home-col-side">
      <song-recommend-cards class="animate-item" />
      <playlist-grid-section class="animate-item" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core';
import { computed, onMounted } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import { useRecommendStore } from '@/store/modules/recommend';
import { useSettingsStore } from '@/store/modules/settings';

import HomeHeroCarousel from './HomeHeroCarousel.vue';
import PlaylistGridSection from './PlaylistGridSection.vue';
import RecentPlayRow from './RecentPlayRow.vue';
import SongRecommendCards from './SongRecommendCards.vue';

const recommendStore = useRecommendStore();
const playHistoryStore = usePlayHistoryStore();
const settingsStore = useSettingsStore();

const recentSongs = computed(() => playHistoryStore.musicHistory.slice(0, 30));

// ── 主页自定义背景（设置项：主页背景）──
const homeBgMode = computed(() => String(settingsStore.setData?.homeBackgroundMode || 'auto'));
const homeBgColor = computed(() => String(settingsStore.setData?.homeBackgroundColor || '#f5f1eb'));
const homeBgBlur = computed(() => {
  const value = Number(settingsStore.setData?.homeBackgroundBlur);
  return Number.isFinite(value) ? Math.min(40, Math.max(0, value)) : 0;
});
const homeBgBrightness = computed(() => {
  const value = Number(settingsStore.setData?.homeBackgroundBrightness);
  return Number.isFinite(value) && value > 0 ? Math.min(150, Math.max(50, value)) : 100;
});
// 自选图存独立 localStorage key（base64 不进 appSettings，避免全量序列化膨胀）
const homeBgImage = useStorage('home-background-image', '');

const homeBgActive = computed(() => {
  if (homeBgMode.value === 'solid') return true;
  if (homeBgMode.value === 'cover') return !!playMusic?.value?.picUrl;
  if (homeBgMode.value === 'image') return !!homeBgImage.value;
  return false;
});

const homeBgStyle = computed(() => {
  if (!homeBgActive.value) return undefined;
  if (homeBgMode.value === 'solid') {
    return { background: homeBgColor.value };
  }
  const url =
    homeBgMode.value === 'cover'
      ? String(playMusic?.value?.picUrl || '')
      : String(homeBgImage.value);
  if (!url) return undefined;
  const style: Record<string, string> = {
    backgroundImage: `url("${url}")`,
    filter: `blur(${homeBgBlur.value}px) brightness(${homeBgBrightness.value}%)`
  };
  // 模糊边缘外扩，避免四周露出模糊白边
  if (homeBgBlur.value > 0) style.transform = 'scale(1.12)';
  return style;
});

onMounted(() => {
  // 每日推荐跨天过期会自动刷新，这里只负责触发
  Promise.resolve(recommendStore.refreshIfStale()).catch(() => {});
});
</script>

<style scoped lang="scss">
.mobile-home {
  position: relative;
  min-height: 100%;
  overflow-x: clip;
  /* 底部留足底栏+迷你栏高度的冗余（inset 不含 safe-area，额外补 12px 呼吸位），
     防止最后一张卡片被悬浮的底栏与迷你栏遮盖 */
  padding: var(--mobile-topbar-inset, 60px) 0
    calc(var(--mobile-dock-content-inset, 144px) + var(--safe-area-inset-bottom, 0px) + 12px);
  color: var(--m-text-primary, #20211f);
}

/* ── 主页自定义背景层 ── */
.home-bg-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  pointer-events: none;
}

/* 背景激活时内容整体抬升到背景之上 */
.mobile-home.has-home-bg > *:not(.home-bg-layer) {
  position: relative;
  z-index: 1;
}

/* 宽视口（≥4:3，含手机横屏/平板/电脑窗口）双栏：hero 整行贯穿 + 主列最近播放，侧列推荐+歌单 */
@media (min-aspect-ratio: 4/3) {
  .mobile-home {
    display: grid;
    gap: 18px;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    align-items: start;
    padding-right: 0;
  }

  /* hero 轮播独占整行，卡片不再被侧栏挤压截断 */
  .hero-carousel {
    grid-column: 1 / -1;
    width: 100%;
  }

  /* 侧列不做独立滚动：内容自然撑开，随页面一起滚动 */
}
</style>
