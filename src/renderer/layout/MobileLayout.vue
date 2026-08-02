<template>
  <div
    id="layout-main"
    class="mobile-layout mobile"
    :class="{ 'has-safe-area': isPhone, 'nav-compact': isCompactNav, 'nav-default': !isCompactNav }"
    @touchstart="onLayoutTouchStart"
    @touchend="onLayoutTouchEnd"
  >
    <!-- 浮动顶栏（所有页面统一显示） -->
    <mobile-header />

    <!-- 共享悬浮卡片 — 所有页面复用同一元素 -->
    <floating-hero-card />

    <!-- 主内容区域（铺满全屏，顶栏透明叠加） -->
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

    <!-- 底部导航菜单 — glow-menu 浮动风格 -->
    <Transition name="glow-nav-in">
      <div
        v-if="shouldShowBottomMenu"
        class="mobile-glow-nav-wrap"
        :class="{ 'compact-mode': isCompactNav }"
      >
        <div class="mobile-glow-nav-glow" :style="{ background: navGlowStyle }" />
        <div class="mobile-glow-nav">
          <router-link
            v-for="item in menuStore.menus"
            :key="item.path"
            :to="item.path"
            class="glow-nav-item"
            :class="{ active: isActive(item.path) }"
          >
            <div
              class="glow-item-radial"
              :style="isActive(item.path) ? { background: activeGlowStyle } : {}"
            />
            <div class="glow-item-content">
              <i class="iconfont glow-item-icon" :class="item.meta.icon" />
              <Transition name="label-pop">
                <span v-if="isActive(item.path)" class="glow-item-label">{{
                  t(item.meta.title)
                }}</span>
              </Transition>
            </div>
          </router-link>
        </div>
      </div>
    </Transition>
    <!-- 其他弹窗/抽屉 -->
    <playlist-drawer v-model="showPlaylistDrawer" :song="currentSong" :song-id="currentSongId" />
    <playing-list-drawer />
  </div>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core';
import { computed, defineAsyncComponent, onMounted, provide, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import { useHeroCard } from '@/composables/useHeroCard';
import homeRouter from '@/router/home';
import otherRouter from '@/router/other';
import { useMenuStore } from '@/store/modules/menu';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import type { SongResult } from '@/types/music';

import FloatingHeroCard from './components/FloatingHeroCard.vue';
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
const settingsStore = useSettingsStore();
const { t } = useI18n();
const { hideHeroCard } = useHeroCard();

// 底栏布局模式：default | compact
const navLayoutMode = computed(() => settingsStore.setData?.bottomNavLayout || 'default');
const isCompactNav = computed(() => navLayoutMode.value === 'compact');

// 路由切换时默认隐藏共享悬浮卡片（list 页面会自行显示）
watch(
  () => route.path,
  () => {
    if (route.path !== '/list') {
      hideHeroCard();
    }
  },
  { immediate: true }
);

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
  // 紧凑模式下播放栏更靠下，手势触发区域下调
  const gestureThreshold = isCompactNav.value ? 100 : 160;
  const windowHeight = window.innerHeight;
  if (touchStartY < windowHeight - gestureThreshold) return;

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

const isActive = (itemPath: string) => route.path === itemPath;

// 动态强调色辉光 — 根据当前路由的 accent-color 生成径向渐变
const navGlowStyle = computed(() => {
  const c = 'var(--accent-color, #888)';
  const rgb = 'var(--accent-color-rgb, 136, 136, 136)';
  return `radial-gradient(ellipse at 50% 50%, rgba(${rgb}, 0.25) 0%, rgba(${rgb}, 0.08) 40%, transparent 70%)`;
});

const activeGlowStyle = computed(() => {
  const rgb = 'var(--accent-color-rgb, 136, 136, 136)';
  return `radial-gradient(circle, rgba(${rgb}, 0.28) 0%, rgba(${rgb}, 0.1) 50%, transparent 100%)`;
});

// 提供给 MobilePlayBar 使用，用于调整播放栏位置
provide('shouldShowMobileMenu', shouldShowBottomMenu);
provide('isCompactNav', isCompactNav);

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

  /* 内容铺满全屏 — 顶栏透明叠加在上面 */
  padding-top: 0;

  /* 首页模块化设计占满全屏 */
  &:has(.modular-home) {
    overflow: hidden;
  }

  /* 底部不做 padding — 内容延伸到最底下，浮动导航叠加在上 */
}

.mobile-page {
  @apply h-full;
}

/* ═══ Glow Nav — 浮动辉光底栏（Apple 弹簧风格） ═══ */
/* 弹簧曲线 */
$spring: cubic-bezier(0.34, 1.56, 0.64, 1);
$spring-smooth: cubic-bezier(0.32, 0.72, 0, 1);

.mobile-glow-nav-wrap {
  position: fixed;
  bottom: calc(var(--safe-area-inset-bottom, 0px) + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  /* 紧凑模式切换：通过 left/right/transform/width 的弹簧过渡实现位置移动，不创建新元素 */
  transition:
    left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    right 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    max-width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 外层径向辉光 — 动态强调色 */
.mobile-glow-nav-glow {
  position: absolute;
  inset: -6px -12px;
  border-radius: 9999px;
  opacity: 0.7;
  filter: blur(10px);
  pointer-events: none;
  z-index: 0;
  transition: opacity 0.5s $spring-smooth;
}

/* 导航容器 — 毛玻璃胶囊（降低高度） */
.mobile-glow-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border-radius: 9999px;
  background: var(--cover-surface, rgba(20, 20, 22, 0.72));
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid var(--cover-border, rgba(255, 255, 255, 0.08));
  box-shadow:
    0 6px 24px rgba(0, 0, 0, 0.25),
    0 1px 4px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  position: relative;
  z-index: 1;
}

/* 单个导航项 — 纯图标，选中时才显示文字 */
.glow-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  min-width: 36px;
  padding: 0 8px;
  border-radius: 9999px;
  cursor: pointer;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  transition:
    padding 0.45s $spring,
    min-width 0.45s $spring,
    transform 0.3s $spring;

  &:active {
    transform: scale(0.88);
  }

  /* 选中项扩大以容纳文字 */
  &.active {
    padding: 0 14px;
    min-width: auto;
  }
}

/* 径向辉光背景 — 动态强调色 */
.glow-item-radial {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  opacity: 0;
  transform: scale(0.6);
  transition:
    opacity 0.4s $spring-smooth,
    transform 0.5s $spring;
  pointer-events: none;
}

.glow-nav-item.active .glow-item-radial {
  opacity: 1;
  transform: scale(1.1);
}

/* 内容容器 */
.glow-item-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 5px;
  transform-style: preserve-3d;
  perspective: 600px;
}

/* 图标 */
.glow-item-icon {
  font-size: 19px;
  color: var(--cover-text-muted, rgba(255, 255, 255, 0.45));
  transition:
    color 0.35s $spring-smooth,
    transform 0.45s $spring;
}

/* 选中态：图标弹跳放大 + 强调色 */
.glow-nav-item.active .glow-item-icon {
  color: var(--accent-color, #fff);
  transform: scale(1.15);
}

/* hover 态 */
.glow-nav-item:hover:not(.active) .glow-item-icon {
  color: var(--cover-text-primary, rgba(255, 255, 255, 0.8));
  transform: scale(1.05);
}

/* 文字标签 — 仅选中时弹出 */
.glow-item-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-color, #fff);
  white-space: nowrap;
  letter-spacing: 0.01em;
}

/* 文字弹入弹出动画 */
.label-pop-enter-active {
  transition:
    opacity 0.35s $spring-smooth,
    transform 0.45s $spring,
    max-width 0.45s $spring;
}
.label-pop-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.25s $spring-smooth,
    max-width 0.25s $spring-smooth;
}
.label-pop-enter-from {
  opacity: 0;
  transform: translateX(-8px) scale(0.6);
  max-width: 0;
}
.label-pop-leave-to {
  opacity: 0;
  transform: translateX(-8px) scale(0.6);
  max-width: 0;
}

/* Glow nav 入场动画 */
.glow-nav-in-enter-active {
  transition:
    opacity 0.4s $spring-smooth,
    transform 0.5s $spring;
}
.glow-nav-in-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.3s $spring-smooth;
}
.glow-nav-in-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(40px);
}
.glow-nav-in-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

/* Apple-style page transition: 弹簧曲线 */
.page-fade-enter-active {
  transition:
    opacity 0.35s $spring-smooth,
    transform 0.5s $spring;
}
.page-fade-leave-active {
  transition:
    opacity 0.25s $spring-smooth,
    transform 0.3s $spring-smooth;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.97);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(1.02);
}

/* ═══════════════════════════════════════════════════
   底栏布局模式
   ═══════════════════════════════════════════════════ */

/* —— 默认模式：底栏加宽到与迷你播放栏同宽 —— */
.nav-default .mobile-glow-nav-wrap {
  /* 加宽到与迷你播放栏同宽（100vw - 24px，对应 mx-3） */
  width: calc(100vw - 24px);
  max-width: 500px;
}

.nav-default .mobile-glow-nav {
  width: 100%;
  justify-content: space-around;
}

.nav-default .glow-nav-item {
  flex: 1;
}

/* —— 紧凑模式：底栏靠右，左侧为精简播放栏 ——
   通过同一元素的 left/right/transform/width 变化实现平滑过渡，不创建新 DOM
*/
.nav-compact .mobile-glow-nav-wrap.compact-mode {
  left: auto;
  right: 12px;
  transform: none;
  width: auto;
  max-width: 55vw;
  /* 右对齐：当导航项显示文字导致宽度变化时，向左扩展而非向右溢出 */
  align-items: flex-end;
}

.nav-compact .mobile-glow-nav-wrap.compact-mode .mobile-glow-nav-glow {
  inset: -6px -10px;
}

/* 紧凑模式下导航项收紧 */
.nav-compact .mobile-glow-nav-wrap.compact-mode .glow-nav-item {
  flex: 0 0 auto;
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
