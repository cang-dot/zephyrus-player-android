<template>
  <div
    id="layout-main"
    class="mobile-layout mobile"
    :class="{ 'has-safe-area': isPhone }"
    @touchstart="onLayoutTouchStart"
    @touchend="onLayoutTouchEnd"
  >
    <!-- 浮动顶栏（所有页面统一显示） -->
    <mobile-header />

    <!-- 主内容区域（铺满全屏，顶部留出浮动顶栏空间） -->
    <div
      class="mobile-content"
      :class="{ 'has-bottom-menu': shouldShowBottomMenu, 'has-player': isPlay }"
    >
      <router-view v-slot="{ Component }" class="mobile-page">
        <Transition name="page-fade" mode="out-in">
          <keep-alive :include="keepAliveInclude">
            <component :is="Component" />
          </keep-alive>
        </Transition>
      </router-view>
    </div>

    <!-- 底部播放条 -->
    <mobile-play-bar v-if="isPlay" />

    <!-- 底部导航菜单 -->
    <div v-if="shouldShowBottomMenu" class="mobile-bottom-menu">
      <app-menu class="mobile-menu" :menus="menuStore.menus" />
    </div>
    <!-- 其他弹窗/抽屉 -->
    <playlist-drawer v-model="showPlaylistDrawer" :song="currentSong" :song-id="currentSongId" />
    <playing-list-drawer />
  </div>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core';
import { computed, defineAsyncComponent, onMounted, provide, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import homeRouter from '@/router/home';
import otherRouter from '@/router/other';
import { useMenuStore } from '@/store/modules/menu';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';

import AppMenu from './components/AppMenu.vue';
import MobileHeader from './components/MobileHeader.vue';
const MobilePlayBar = defineAsyncComponent(() => import('@/components/player/MobilePlayBar.vue'));
const PlayingListDrawer = defineAsyncComponent(
  () => import('@/components/player/PlayingListDrawer.vue')
);
const PlaylistDrawer = defineAsyncComponent(() => import('@/components/common/PlaylistDrawer.vue'));

const props = defineProps<{
  isPhone: boolean;
}>();

const route = useRoute();
const playerStore = usePlayerStore();
const menuStore = useMenuStore();

// 横竖屏检测
const { width, height } = useWindowSize();
const isLandscape = computed(() => width.value > height.value);

// 首页使用模块化设计，不显示顶栏
const isHomePage = computed(() => route.path === '/');

// safe-area-inset-top 完全由 CSS env() 驱动，无需 JS 测量或动态切换
// WebView 自动根据系统栏状态计算：
// - 竖屏：返回状态栏高度（含挖孔避让）
// - 横屏沉浸：返回挖孔安全区域高度

// 上滑打开播放界面的手势检测（绑在根元素上，覆盖迷你播放栏区域）
let touchStartY = 0;
let touchStartX = 0;
let touchStartTime = 0;

const onLayoutTouchStart = (e: TouchEvent) => {
  if (!isPlay.value || playerStore.musicFull) return;
  const touch = e.touches[0];
  touchStartY = touch.clientY;
  touchStartX = touch.clientX;
  touchStartTime = Date.now();
};

const onLayoutTouchEnd = (e: TouchEvent) => {
  if (!isPlay.value || playerStore.musicFull) return;
  // 仅当手势起点在迷你播放栏区域（屏幕底部160px内）时才触发
  const windowHeight = window.innerHeight;
  if (touchStartY < windowHeight - 160) return;

  const touch = e.changedTouches[0];
  const deltaY = touch.clientY - touchStartY;
  const deltaX = Math.abs(touch.clientX - touchStartX);
  const elapsed = Date.now() - touchStartTime;

  // 快速上滑：Y位移为负（向上），且大于50px，横向位移小于纵向位移，时间小于600ms
  if (deltaY < -50 && deltaX < Math.abs(deltaY) && elapsed < 600) {
    playerStore.setMusicFull(true);
  }
};

// 提供是否有安全区域
provide('hasSafeArea', props.isPhone);

// 是否有播放的歌曲
const isPlay = computed(() => playerStore.playMusic && playerStore.playMusic.id);

// 是否显示底部菜单
const shouldShowBottomMenu = computed(() => {
  const menuPaths = menuStore.menus.map((item: any) => item.path);
  return menuPaths.includes(route.path) && !playerStore.musicFull;
});

// 提供给 MobilePlayBar 使用，用于调整播放栏位置
provide('shouldShowMobileMenu', shouldShowBottomMenu);

// Keep-alive 配置
const keepAliveInclude = computed(() => {
  const allRoutes = [...homeRouter, ...otherRouter];
  return allRoutes
    .filter((item) => item.meta?.keepAlive)
    .map((item) =>
      typeof item.name === 'string' ? item.name.charAt(0).toUpperCase() + item.name.slice(1) : ''
    )
    .filter(Boolean);
});

// 歌单抽屉
const showPlaylistDrawer = ref(false);
const currentSongId = ref<number | undefined>();
const currentSong = ref<SongResult | undefined>();

// 提供打开歌单抽屉的方法
const openPlaylistDrawer = (songOrId: number | SongResult, isOpen: boolean = true) => {
  if (typeof songOrId === 'number') {
    currentSongId.value = songOrId;
    currentSong.value = undefined;
  } else {
    currentSong.value = songOrId;
    currentSongId.value = typeof songOrId.id === 'number' ? songOrId.id : undefined;
  }
  showPlaylistDrawer.value = isOpen;
  playerStore.setMusicFull(false);
  playerStore.setPlayListDrawerVisible(!isOpen);
};

provide('openPlaylistDrawer', openPlaylistDrawer);
</script>

<style lang="scss" scoped>
.mobile-layout {
  @apply w-screen flex flex-col;
  @apply overflow-hidden;
  height: 100vh;
  height: 100dvh;
  position: relative;
  background: var(--m-bg, var(--bg-color));
}

.mobile-content {
  @apply flex-1 overflow-auto;
  height: 100%;

  /* 顶部留出浮动顶栏空间 */
  padding-top: calc(var(--safe-area-inset-top, 0px) + 56px);

  /* 首页模块化设计占满全屏 */
  &:has(.modular-home) {
    overflow: hidden;
    padding-top: 0;
  }

  /* 播放栏为 fixed 叠加层，仅需在有播放栏时补偿 */
  &.has-player:not(.has-bottom-menu) {
    padding-bottom: 76px;
  }
  &.has-bottom-menu.has-player {
    padding-bottom: 140px;
  }
}

.mobile-page {
  @apply h-full;
}

/* 底部菜单固定在底部 */
.mobile-bottom-menu {
  background: var(--m-bg, var(--bg-color));
  border-top: 1px solid var(--m-border, transparent);
  flex-shrink: 0;
}

.mobile-menu {
  @apply w-full;
}

/* Apple-style page fade transition */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.page-fade-enter-from {
  opacity: 0;
  transform: scale(0.96);
}

.page-fade-leave-to {
  opacity: 0;
  transform: scale(1.02);
}

@media (prefers-reduced-motion: reduce) {
  .page-fade-enter-active,
  .page-fade-leave-active {
    transition: opacity 0.2s ease;
    transform: none;
  }
  .page-fade-enter-from,
  .page-fade-leave-to {
    transform: none;
  }
}
</style>
