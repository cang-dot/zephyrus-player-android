<template>
  <div class="mobile-home">
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
import { computed, onMounted } from 'vue';

import { usePlayHistoryStore } from '@/store/modules/playHistory';
import { useRecommendStore } from '@/store/modules/recommend';

import HomeHeroCarousel from './HomeHeroCarousel.vue';
import PlaylistGridSection from './PlaylistGridSection.vue';
import RecentPlayRow from './RecentPlayRow.vue';
import SongRecommendCards from './SongRecommendCards.vue';

const recommendStore = useRecommendStore();
const playHistoryStore = usePlayHistoryStore();

const recentSongs = computed(() => playHistoryStore.musicHistory.slice(0, 30));

onMounted(() => {
  // 每日推荐跨天过期会自动刷新，这里只负责触发
  Promise.resolve(recommendStore.refreshIfStale()).catch(() => {});
});
</script>

<style scoped lang="scss">
.mobile-home {
  min-height: 100%;
  overflow-x: clip;
  /* 底部让位由 pager-page 的统一 padding-bottom（--mobile-dock-content-inset）负责，这里只留呼吸位 */
  padding: var(--mobile-topbar-inset, 60px) 0 10px;
  color: var(--m-text-primary, #20211f);
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
