<template>
  <div
    id="layout-main"
    class="mobile-layout mobile"
    :class="{
      'has-safe-area': isPhone,
      'nav-compact': isCompactNav,
      'nav-default': !isCompactNav,
      'player-transitioning': playerTransition.progress.value > 0,
      'player-full': playerTransition.state.value === 'open'
    }"
    :style="{
      '--mobile-dock-content-inset': `${mobileDockContentInset}px`,
      '--player-open-progress': String(playerTransition.progress.value)
    }"
  >
    <!-- 浮动顶栏（所有页面统一显示） -->
    <mobile-header />

    <!-- 主内容区域（铺满全屏，顶栏透明叠加） -->
    <div
      class="mobile-content"
      :class="{ 'has-bottom-menu': shouldShowBottomMenu, 'has-player': isPlay }"
      :style="pageSwipeStyle"
      @click.capture="onPageClickCapture"
      @pointerdown="onContentPointerDown"
      @pointermove="onContentPointerMove"
      @pointerup="onContentPointerUp"
      @pointercancel="onContentPointerCancel"
    >
      <router-view v-slot="{ Component }" class="mobile-page">
        <Transition
          :name="pageTransitionName"
          :mode="pageTransitionDirection ? undefined : 'out-in'"
          :css="!gestureNavigationInProgress"
        >
          <keep-alive :include="keepAliveInclude">
            <component :is="Component" />
          </keep-alive>
        </Transition>
      </router-view>
    </div>

    <div
      ref="dockRef"
      class="mobile-bottom-dock"
      :class="{
        visible: shouldShowBottomMenu,
        'has-player': isPlay,
        'player-collapsed': isPlay && miniPlayerIdleCollapsed,
        'player-open': isPlay && !miniPlayerIdleCollapsed,
        'playlist-mounted': isPlay && playlistSurfaceMounted,
        'playlist-open': isPlay && playlistSurfaceExpanded,
        'player-transitioning': playerTransition.progress.value > 0,
        'player-full': playerTransition.state.value === 'open'
      }"
      :style="dockTransitionStyle"
      @click.capture="onDockClickCapture"
      @pointerdown="onDockPointerDown"
      @pointermove="onDockPointerMove"
      @pointerup="onDockPointerUp"
      @pointercancel="onDockPointerCancel"
    >
      <!-- 播放条与导航共用同一个 Dock 玻璃表面。 -->
      <mobile-play-bar v-if="isPlay" @idle-collapse-change="miniPlayerIdleCollapsed = $event" />

      <!-- 普通页面的播放列表只在 Dock 内形变，不与全屏播放器共用承载容器。 -->
      <playing-list-drawer v-if="isPlay && !playerStore.musicFull" embedded />

      <Transition name="glow-nav-in" :css="playerTransition.state.value === 'idle'">
        <div
          v-if="shouldShowBottomMenu"
          class="mobile-glow-nav-wrap"
          :class="{
            'compact-mode': isCompactNav,
            'has-player-slot': isPlay && miniPlayerIdleCollapsed
          }"
        >
          <div class="mobile-glow-nav">
            <router-link
              v-for="item in menuStore.menus"
              :key="item.path"
              :to="menuTarget(item.path)"
              class="glow-nav-item"
              :class="{ active: isActive(item.path) }"
              @click="prepareMenuTransition(item.path)"
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
    </div>
    <mobile-player-bottom-surface v-if="isPlay" />
    <!-- 其他弹窗/抽屉 -->
    <playlist-drawer v-model="showPlaylistDrawer" :song="currentSong" :song-id="currentSongId" />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  provide,
  ref,
  watch
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import homeRouter from '@/router/home';
import otherRouter from '@/router/other';
import { useMenuStore } from '@/store/modules/menu';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import type { SongResult } from '@/types/music';
import {
  shouldCommitMobilePageSwipe,
  shouldOpenMobilePlayer
} from '@/utils/mobileGestureThresholds';

import MobileHeader from './components/MobileHeader.vue';
const MobilePlayBar = defineAsyncComponent(() => import('@/components/player/MobilePlayBar.vue'));
const MobilePlayerBottomSurface = defineAsyncComponent(
  () => import('@/components/player/MobilePlayerBottomSurface.vue')
);
const PlayingListDrawer = defineAsyncComponent(
  () => import('@/components/player/PlayingListDrawer.vue')
);
const PlaylistDrawer = defineAsyncComponent(() => import('@/components/common/PlaylistDrawer.vue'));

const props = defineProps<{
  isPhone: boolean;
}>();

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const menuStore = useMenuStore();
const settingsStore = useSettingsStore();
const { t } = useI18n();
const playerTransition = useMobilePlayerTransition();
const playerTransitionStartedWithMenu = ref(false);
const dockRef = ref<HTMLElement | null>(null);
const playerTransitionOrigin = ref<{
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  borderRadius: number;
} | null>(null);
const syncPlayerSurfaceProgress = () => {
  const progress = playerTransition.progress.value;
  const reveal = Math.min(1, Math.max(0, (progress - 0.035) / 0.62));
  document.documentElement.style.setProperty('--player-open-progress', String(progress));
  document.documentElement.style.setProperty('--player-surface-reveal', String(reveal));
  document.documentElement.style.setProperty('--player-ripple-radius', `${progress * 150}vmax`);
  document.body.classList.toggle(
    'mobile-player-surface-active',
    progress > 0 || playerTransition.state.value !== 'idle'
  );
};
watch(
  () => [playerTransition.progress.value, playerTransition.state.value] as const,
  syncPlayerSurfaceProgress,
  { immediate: true }
);
onBeforeUnmount(() => {
  document.documentElement.style.removeProperty('--player-open-progress');
  document.documentElement.style.removeProperty('--player-surface-reveal');
  document.documentElement.style.removeProperty('--player-ripple-radius');
  document.body.classList.remove('mobile-player-surface-active');
});
watch(
  () => playerTransition.state.value,
  (state, previous) => {
    if ((state === 'dragging' || state === 'opening') && previous === 'idle') {
      playerTransitionStartedWithMenu.value = shouldShowBottomMenu.value;
      const source = shouldShowBottomMenu.value
        ? dockRef.value
        : document.querySelector<HTMLElement>('.mobile-play-bar .mobile-mini-controls');
      const rect = source?.getBoundingClientRect();
      if (rect) {
        playerTransitionOrigin.value = {
          left: rect.left,
          right: window.innerWidth - rect.right,
          bottom: window.innerHeight - rect.bottom,
          width: rect.width,
          height: rect.height,
          borderRadius: shouldShowBottomMenu.value ? 32 : rect.height / 2
        };
        playerTransition.setSourceRect({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          borderRadius: shouldShowBottomMenu.value ? 32 : rect.height / 2
        });
      }
    }
  },
  { flush: 'sync' }
);
const dockTransitionStyle = computed(() => {
  const progress = playerTransition.progress.value;
  if (progress <= 0) return undefined;
  const startedWithMenu = playerTransitionStartedWithMenu.value;
  const fallbackHeight = startedWithMenu ? 112 : 56;
  const origin = playerTransitionOrigin.value ?? {
    left: startedWithMenu ? 12 : 0,
    right: startedWithMenu ? 12 : 0,
    bottom: startedWithMenu ? 12 : 8,
    width: window.innerWidth - (startedWithMenu ? 24 : 0),
    height: fallbackHeight,
    borderRadius: startedWithMenu ? 32 : 28
  };
  return {
    height: `${origin.height + (window.innerHeight - origin.height) * progress}px`,
    right: `${origin.right * (1 - progress)}px`,
    bottom: `${origin.bottom * (1 - progress)}px`,
    left: `${origin.left * (1 - progress)}px`,
    borderRadius: `${origin.borderRadius * (1 - progress)}px`,
    '--player-transition-surface-opacity': String(1 - progress)
  };
});

type PageTransitionDirection = 'next' | 'prev';

const pageTransitionDirection = ref<PageTransitionDirection | null>(null);
const menuRouteMemory = ref<Record<string, string>>({});
const miniPlayerIdleCollapsed = ref(false);
const playlistSurfaceMounted = ref(false);
const playlistSurfaceExpanded = ref(false);
const pageSwipeOffset = ref(0);
const pageSwipeAnimating = ref(false);
const gestureNavigationInProgress = ref(false);
const pageTransitionName = computed(() =>
  pageTransitionDirection.value ? `page-slide-${pageTransitionDirection.value}` : 'page-fade'
);
const pageSwipeStyle = computed(() => ({
  transform: pageSwipeOffset.value ? `translate3d(${pageSwipeOffset.value}px, 0, 0)` : undefined,
  transition: 'none',
  willChange: pageSwipeOffset.value || pageSwipeAnimating.value ? 'transform' : undefined
}));

let pageTransitionTimer: ReturnType<typeof setTimeout> | undefined;
let pageSwipeAnimationFrame = 0;
let playlistSurfaceUnmountTimer: ReturnType<typeof setTimeout> | undefined;
let playlistSurfaceFrame = 0;

watch(
  () => [playerStore.playListDrawerVisible, playerStore.musicFull] as const,
  ([visible, musicFull]) => {
    const shouldExpandDock = visible && !musicFull;
    if (playlistSurfaceUnmountTimer) clearTimeout(playlistSurfaceUnmountTimer);
    if (playlistSurfaceFrame) cancelAnimationFrame(playlistSurfaceFrame);
    if (shouldExpandDock) {
      playlistSurfaceMounted.value = true;
      playlistSurfaceExpanded.value = false;
      playlistSurfaceFrame = requestAnimationFrame(() => {
        playlistSurfaceFrame = requestAnimationFrame(() => {
          playlistSurfaceExpanded.value = true;
          playlistSurfaceFrame = 0;
        });
      });
      return;
    }
    playlistSurfaceExpanded.value = false;
    playlistSurfaceUnmountTimer = setTimeout(() => {
      playlistSurfaceMounted.value = false;
      playlistSurfaceUnmountTimer = undefined;
    }, 480);
  },
  { immediate: true }
);

const schedulePageTransitionReset = () => {
  if (pageTransitionTimer) clearTimeout(pageTransitionTimer);
  pageTransitionTimer = setTimeout(() => {
    pageTransitionDirection.value = null;
    pageTransitionTimer = undefined;
  }, 320);
};

const prepareMenuTransition = (targetPath: string) => {
  const currentIndex = menuStore.menus.findIndex((item: any) => item.path === route.path);
  const targetIndex = menuStore.menus.findIndex((item: any) => item.path === targetPath);
  if (currentIndex === -1 || targetIndex === -1 || currentIndex === targetIndex) return;
  pageTransitionDirection.value = targetIndex > currentIndex ? 'next' : 'prev';
  schedulePageTransitionReset();
};

const inferMenuTransition = (targetPath: string, fromPath: string) => {
  const currentIndex = menuStore.menus.findIndex((item: any) => item.path === fromPath);
  const targetIndex = menuStore.menus.findIndex((item: any) => item.path === targetPath);
  if (currentIndex === -1 || targetIndex === -1 || currentIndex === targetIndex) return;
  pageTransitionDirection.value = targetIndex > currentIndex ? 'next' : 'prev';
  schedulePageTransitionReset();
};

watch(
  () => route.path,
  (path, previousPath) => {
    if (path !== previousPath && !pageTransitionDirection.value) {
      inferMenuTransition(path, previousPath);
    }
  }
);

watch(
  () => route.fullPath,
  (fullPath) => {
    if (menuStore.menus.some((item: any) => item.path === route.path)) {
      menuRouteMemory.value = { ...menuRouteMemory.value, [route.path]: fullPath };
    }
  },
  { immediate: true }
);

const menuTarget = (path: string) => menuRouteMemory.value[path] || path;

// 页面横滑：只有在底栏页面且明确判断为横向意图后才接管手势，垂直滚动保持原生行为。
let pagePointerStartX = 0;
let pagePointerStartY = 0;
let pagePointerAxis: 'none' | 'horizontal' | 'vertical' = 'none';
let pagePointerActive = false;
let pagePointerId: number | null = null;
const suppressPageClick = ref(false);
let pageClickTimer: ReturnType<typeof setTimeout> | undefined;

const setPageClickSuppressed = () => {
  suppressPageClick.value = true;
  if (pageClickTimer) clearTimeout(pageClickTimer);
  pageClickTimer = setTimeout(() => {
    suppressPageClick.value = false;
    pageClickTimer = undefined;
  }, 360);
};

const onPageClickCapture = (event: MouseEvent) => {
  if (!suppressPageClick.value) return;
  event.preventDefault();
  event.stopPropagation();
  suppressPageClick.value = false;
};

const isPageSwipeTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return true;
  return !target.closest(
    'input, textarea, select, [role="slider"], [data-no-page-swipe], [data-horizontal-scroll], .n-slider, .n-carousel'
  );
};

type PointerSample = { x: number; time: number };
let pagePointerSamples: PointerSample[] = [];

const pushPagePointerSample = (x: number) => {
  const time = performance.now();
  pagePointerSamples.push({ x, time });
  pagePointerSamples = pagePointerSamples.filter((sample) => time - sample.time <= 100);
};

const recentPageVelocity = () => {
  if (pagePointerSamples.length < 2) return 0;
  const first = pagePointerSamples[0];
  const last = pagePointerSamples[pagePointerSamples.length - 1];
  return (last.x - first.x) / Math.max(1, last.time - first.time);
};

const animatePageOffset = (target: number, initialVelocity = 0, done?: () => void) => {
  if (pageSwipeAnimationFrame) cancelAnimationFrame(pageSwipeAnimationFrame);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    pageSwipeAnimating.value = true;
    const start = pageSwipeOffset.value;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 160);
      pageSwipeOffset.value = start + (target - start) * (1 - Math.pow(1 - progress, 3));
      if (progress < 1) pageSwipeAnimationFrame = requestAnimationFrame(tick);
      else {
        pageSwipeAnimationFrame = 0;
        pageSwipeAnimating.value = false;
        done?.();
      }
    };
    pageSwipeAnimationFrame = requestAnimationFrame(tick);
    return;
  }
  let value = pageSwipeOffset.value;
  let velocity = initialVelocity * 1000;
  let previous = performance.now();
  pageSwipeAnimating.value = true;
  const tick = (now: number) => {
    const dt = Math.min(0.032, Math.max(0.001, (now - previous) / 1000));
    previous = now;
    const acceleration = -420 * (value - target) - 38 * velocity;
    velocity += acceleration * dt;
    value += velocity * dt;
    pageSwipeOffset.value = value;
    if (Math.abs(value - target) < 0.5 && Math.abs(velocity) < 5) {
      pageSwipeOffset.value = target;
      pageSwipeAnimating.value = false;
      pageSwipeAnimationFrame = 0;
      done?.();
      return;
    }
    pageSwipeAnimationFrame = requestAnimationFrame(tick);
  };
  pageSwipeAnimationFrame = requestAnimationFrame(tick);
};

const onContentPointerDown = (event: PointerEvent) => {
  if (
    !event.isPrimary ||
    (event.button !== 0 && event.pointerType === 'mouse') ||
    !shouldShowBottomMenu.value ||
    playerStore.musicFull ||
    !isPageSwipeTarget(event.target)
  ) {
    pagePointerAxis = 'none';
    pagePointerActive = false;
    return;
  }
  pagePointerStartX = event.clientX;
  pagePointerStartY = event.clientY;
  pagePointerAxis = 'none';
  pagePointerActive = true;
  pagePointerId = event.pointerId;
  pagePointerSamples = [{ x: event.clientX, time: performance.now() }];
  if (pageSwipeAnimationFrame) cancelAnimationFrame(pageSwipeAnimationFrame);
  pageSwipeAnimating.value = false;
};

const onContentPointerMove = (event: PointerEvent) => {
  if (!pagePointerActive || event.pointerId !== pagePointerId) return;
  const deltaX = event.clientX - pagePointerStartX;
  const deltaY = event.clientY - pagePointerStartY;

  if (pagePointerAxis === 'none' && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 10) {
    pagePointerAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    if (pagePointerAxis === 'horizontal') {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
  }
  if (pagePointerAxis !== 'horizontal') return;

  event.preventDefault();
  if (Math.abs(deltaX) >= 16) setPageClickSuppressed();
  pushPagePointerSample(event.clientX);

  const currentIndex = menuStore.menus.findIndex((item: any) => item.path === route.path);
  const movingToNext = deltaX < 0;
  const hasAdjacent = movingToNext ? currentIndex < menuStore.menus.length - 1 : currentIndex > 0;
  pageSwipeOffset.value = hasAdjacent ? deltaX : deltaX * 0.24;
};

const resetPageSwipe = () => {
  animatePageOffset(0, recentPageVelocity());
};

const triggerPageHaptic = () => {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(12);
};

const releasePagePointer = (event: PointerEvent) => {
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  pagePointerId = null;
};

const onContentPointerUp = (event: PointerEvent) => {
  if (!pagePointerActive || event.pointerId !== pagePointerId) return;
  const deltaX = event.clientX - pagePointerStartX;
  pushPagePointerSample(event.clientX);
  const velocity = recentPageVelocity();
  const currentIndex = menuStore.menus.findIndex((item: any) => item.path === route.path);
  const direction = deltaX < 0 ? 'next' : 'prev';
  const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
  const target = menuStore.menus[targetIndex];
  const commit =
    pagePointerAxis === 'horizontal' &&
    Boolean(target) &&
    shouldCommitMobilePageSwipe(deltaX, window.innerWidth, velocity, Boolean(target));

  releasePagePointer(event);
  pagePointerActive = false;
  pagePointerAxis = 'none';
  if (!commit) {
    resetPageSwipe();
    return;
  }

  pageTransitionDirection.value = null;
  gestureNavigationInProgress.value = true;
  triggerPageHaptic();
  const exitTarget = direction === 'next' ? -window.innerWidth : window.innerWidth;
  animatePageOffset(exitTarget, velocity, async () => {
    try {
      await router.push(menuTarget(target.path));
      pageSwipeOffset.value = direction === 'next' ? window.innerWidth : -window.innerWidth;
      await nextTick();
      animatePageOffset(0, velocity * 0.35, () => {
        gestureNavigationInProgress.value = false;
      });
    } catch (error) {
      console.warn('[MobilePager] 页面切换失败:', error);
      gestureNavigationInProgress.value = false;
      animatePageOffset(0);
    }
  });
};

const onContentPointerCancel = (event: PointerEvent) => {
  if (!pagePointerActive || event.pointerId !== pagePointerId) return;
  releasePagePointer(event);
  pagePointerActive = false;
  pagePointerAxis = 'none';
  resetPageSwipe();
};

onBeforeUnmount(() => {
  if (pageTransitionTimer) clearTimeout(pageTransitionTimer);
  if (pageSwipeAnimationFrame) cancelAnimationFrame(pageSwipeAnimationFrame);
  if (pageClickTimer) clearTimeout(pageClickTimer);
  if (playlistSurfaceUnmountTimer) clearTimeout(playlistSurfaceUnmountTimer);
  if (playlistSurfaceFrame) cancelAnimationFrame(playlistSurfaceFrame);
});

// 底栏布局模式：default | compact
const navLayoutMode = computed(() => settingsStore.setData?.bottomNavLayout || 'default');
const isCompactNav = computed(() => navLayoutMode.value === 'compact');

// safe-area-inset-top 完全由 CSS env() 驱动，无需 JS 测量或动态切换
// WebView 自动根据系统栏状态计算：
// - 竖屏：返回状态栏高度（含挖孔避让）
// - 横屏沉浸：返回挖孔安全区域高度

// Dock 的纵向手势与迷你播放栏横向切歌分离。只有确认纵向意图后才捕获指针。
let dockPointerId: number | null = null;
let dockStartX = 0;
let dockStartY = 0;
let dockAxis: 'none' | 'horizontal' | 'vertical' = 'none';
let dockSamples: Array<{ y: number; time: number }> = [];
let suppressDockClick = false;

const dockVelocity = () => {
  if (dockSamples.length < 2) return 0;
  const first = dockSamples[0];
  const last = dockSamples[dockSamples.length - 1];
  return (last.y - first.y) / Math.max(1, last.time - first.time);
};

const onDockPointerDown = (event: PointerEvent) => {
  if (
    !event.isPrimary ||
    !isPlay.value ||
    playerStore.musicFull ||
    (event.target instanceof Element && event.target.closest('.mobile-play-bar'))
  )
    return;
  dockPointerId = event.pointerId;
  dockStartX = event.clientX;
  dockStartY = event.clientY;
  dockAxis = 'none';
  dockSamples = [{ y: event.clientY, time: performance.now() }];
  suppressDockClick = false;
};

const onDockPointerMove = (event: PointerEvent) => {
  if (dockPointerId !== event.pointerId) return;
  const deltaX = event.clientX - dockStartX;
  const deltaY = event.clientY - dockStartY;
  if (dockAxis === 'none' && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 8) {
    dockAxis = Math.abs(deltaY) > Math.abs(deltaX) * 1.08 ? 'vertical' : 'horizontal';
    if (dockAxis === 'vertical') {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      suppressDockClick = true;
    }
  }
  if (dockAxis !== 'vertical') return;
  event.preventDefault();
  const now = performance.now();
  dockSamples.push({ y: event.clientY, time: now });
  dockSamples = dockSamples.filter((sample) => now - sample.time <= 100);
  playerTransition.setDragging(
    Math.min(1, Math.max(0, -deltaY / Math.max(240, window.innerHeight * 0.68))),
    (-dockVelocity() * 1000) / Math.max(1, window.innerHeight)
  );
};

const releaseDockPointer = (event: PointerEvent, cancelled = false) => {
  if (dockPointerId !== event.pointerId) return;
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  const velocity = dockVelocity();
  const shouldOpen =
    !cancelled &&
    dockAxis === 'vertical' &&
    shouldOpenMobilePlayer(playerTransition.progress.value, -velocity);
  if (dockAxis === 'vertical') {
    if (shouldOpen) playerStore.setMusicFull(true);
    playerTransition.animateTo(shouldOpen ? 1 : 0, -velocity);
    if (shouldOpen && navigator.vibrate) navigator.vibrate(8);
  }
  dockPointerId = null;
  dockAxis = 'none';
};

const onDockPointerUp = (event: PointerEvent) => releaseDockPointer(event);
const onDockPointerCancel = (event: PointerEvent) => releaseDockPointer(event, true);
const onDockClickCapture = (event: MouseEvent) => {
  if (!suppressDockClick) return;
  event.preventDefault();
  event.stopPropagation();
  suppressDockClick = false;
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
const mobileDockContentInset = computed(() => {
  if (!shouldShowBottomMenu.value) return isPlay.value ? 82 : 20;
  if (!isPlay.value || miniPlayerIdleCollapsed.value) return 76;
  return 134;
});

const isActive = (itemPath: string) => route.path === itemPath;

const activeGlowStyle = computed(() => {
  const rgb = 'var(--accent-color-rgb, 136, 136, 136)';
  return `radial-gradient(circle, rgba(${rgb}, 0.28) 0%, rgba(${rgb}, 0.1) 50%, transparent 100%)`;
});

// 提供给 MobilePlayBar 使用，用于调整播放栏位置
provide('shouldShowMobileMenu', shouldShowBottomMenu);
provide('isCompactNav', isCompactNav);
provide('playlistSurfaceMounted', playlistSurfaceMounted);
provide('playlistSurfaceExpanded', playlistSurfaceExpanded);

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
  --mobile-dock-inset: 12px;
  --mobile-dock-gap: 12px;
}

.mobile-content {
  @apply flex-1 overflow-auto;
  height: 100%;
  touch-action: pan-y;
  overscroll-behavior-x: contain;
  transform: translate3d(0, 0, 0);

  /* 内容铺满全屏 — 顶栏透明叠加在上面 */
  padding-top: 0;

  /* 首页模块化设计占满全屏 */
  &:has(.modular-home) {
    overflow: hidden;
  }

  /* 底部不做 padding — 内容延伸到最底下，浮动导航叠加在上 */
}

.mobile-bottom-dock {
  position: fixed;
  right: var(--mobile-dock-inset);
  bottom: calc(var(--safe-area-inset-bottom, 0px) + var(--mobile-dock-gap));
  left: var(--mobile-dock-inset);
  z-index: 199;
  height: 0;
  border: 1px solid transparent;
  border-radius: 30px;
  background: transparent;
  box-shadow: none;
  pointer-events: none;
  transition:
    height 420ms cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 420ms cubic-bezier(0.32, 0.72, 0, 1),
    background-color 240ms ease,
    box-shadow 320ms ease;

  &.visible {
    height: 54px;
    border-color: var(--m-glass-border);
    background: var(--m-glass-bg);
    box-shadow:
      0 14px 34px rgba(0, 0, 0, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(30px) saturate(175%);
    -webkit-backdrop-filter: blur(30px) saturate(175%);
    pointer-events: auto;
  }

  &.player-transitioning {
    z-index: 9997;
    overflow: hidden;
    border-color: transparent;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    pointer-events: auto;
    transition: none;
  }

  &.player-transitioning::before {
    position: absolute;
    inset: 0;
    z-index: 0;
    border: 1px solid color-mix(in srgb, #fff 18%, transparent);
    border-radius: inherit;
    background: color-mix(in srgb, var(--accent-color, #555) 13%, var(--m-glass-bg));
    box-shadow:
      0 18px 48px rgba(0, 0, 0, 0.22),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
    content: '';
    opacity: var(--player-transition-surface-opacity, 1);
    pointer-events: none;
    backdrop-filter: blur(32px) saturate(180%);
    -webkit-backdrop-filter: blur(32px) saturate(180%);
  }

  &.player-full {
    overflow: visible;
    pointer-events: none;
  }

  &.player-full::before {
    opacity: 0;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  &.player-full > :deep(.mobile-play-bar) {
    pointer-events: none;
  }

  &.player-transitioning .mobile-glow-nav-wrap {
    opacity: calc(1 - var(--player-open-progress, 0));
    pointer-events: none;
  }

  &.player-transitioning > :deep(.mobile-play-bar) {
    z-index: 1;
  }

  &.visible.player-open {
    height: 112px;
    border-radius: 32px;
  }

  &.playlist-open {
    height: min(62dvh, 500px);
    min-height: 310px;
    border-radius: 32px;
    overflow: hidden;
    pointer-events: auto;
    background: var(--m-glass-bg);
    border-color: var(--m-glass-border);
    box-shadow:
      0 18px 48px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(30px) saturate(175%);
    -webkit-backdrop-filter: blur(30px) saturate(175%);
  }

  /* Without navigation, the MobilePlayBar itself is the visible morphing surface. */
  &.playlist-mounted:not(.visible) {
    border-color: transparent;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    overflow: visible;
  }

  &.playlist-open.visible {
    height: min(62dvh, 500px);
  }

  &.playlist-mounted :deep(.mobile-play-bar.play-bar-mini.is-menu-show) {
    z-index: 201;
  }

  &.playlist-mounted :deep(.playlist-panel.embedded) {
    z-index: 100001;
  }

  &.playlist-mounted.visible :deep(.playlist-panel.embedded) {
    bottom: 112px;
  }

  &.playlist-mounted:not(.visible) :deep(.playlist-panel.embedded) {
    position: fixed;
    top: auto;
    right: 12px;
    bottom: calc(var(--safe-area-inset-bottom, 0px) + 64px);
    left: 12px;
    height: calc(min(62dvh, 500px) - 56px);
  }

  :deep(.mobile-play-bar.play-bar-mini.is-menu-show) {
    position: absolute !important;
    top: auto !important;
    right: 6px;
    bottom: 48px !important;
    left: 6px !important;
    width: calc(100% - 12px) !important;
  }

  &.player-collapsed :deep(.mobile-play-bar.play-bar-mini.idle-collapsed) {
    top: auto !important;
    right: 2px !important;
    bottom: 2px !important;
    left: auto !important;
    width: 50px !important;
  }

  &:not(.visible):not(.has-player):not(.playlist-open) {
    position: static;
  }

  :deep(.mobile-play-bar) {
    pointer-events: auto;
  }
}

/* Teleported players share the same rAF progress as the Dock surface. */
:global(body.mobile-player-surface-active .n-drawer-container:has(#mobile-drawer-target)),
:global(body.mobile-player-surface-active .stage-mobile-player),
:global(body.mobile-player-surface-active .rain-mobile-player),
:global(body.mobile-player-surface-active .star-chart-player),
:global(body.mobile-player-surface-active .frenzy-mobile-player),
:global(body.mobile-player-surface-active .eerie-mobile-player),
:global(body.mobile-player-surface-active .magazine-mobile-player),
:global(body.mobile-player-surface-active .neon-mobile-player),
:global(body.mobile-player-surface-active .smoke-mobile-player) {
  opacity: var(--player-surface-reveal, 1) !important;
  transition: none !important;
  animation: none !important;
  -webkit-mask-image: radial-gradient(
    circle at 50% 100%,
    #000 0,
    #000 calc(var(--player-ripple-radius, 150vmax) - 18px),
    rgba(0, 0, 0, 0.45) calc(var(--player-ripple-radius, 150vmax) - 8px),
    transparent var(--player-ripple-radius, 150vmax)
  );
  mask-image: radial-gradient(
    circle at 50% 100%,
    #000 0,
    #000 calc(var(--player-ripple-radius, 150vmax) - 18px),
    rgba(0, 0, 0, 0.45) calc(var(--player-ripple-radius, 150vmax) - 8px),
    transparent var(--player-ripple-radius, 150vmax)
  );
}

:global(body.mobile-player-surface-active .player-style-surface .mobile-controls),
:global(body.mobile-player-surface-active #mobile-drawer-target .unified-controls),
:global(body.mobile-player-surface-active #mobile-drawer-target .landscape-main-controls),
:global(body.mobile-player-surface-active .player-style-surface .top-controls),
:global(body.mobile-player-surface-active .player-style-surface > .song-header),
:global(body.mobile-player-surface-active #mobile-drawer-target > .control-btn.absolute) {
  display: none !important;
}

@media (prefers-reduced-motion: reduce) {
  :global(body.mobile-player-surface-active .n-drawer-container:has(#mobile-drawer-target)),
  :global(body.mobile-player-surface-active .player-style-surface) {
    -webkit-mask-image: none;
    mask-image: none;
  }
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
  bottom: calc(var(--safe-area-inset-bottom, 0px) + var(--mobile-dock-gap));
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

.mobile-bottom-dock .mobile-glow-nav-wrap {
  position: absolute;
  bottom: 3px;
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
  background: transparent;
  border: 0;
  box-shadow: none;
  position: relative;
  z-index: 1;
  transform: none;
}

/* 单个导航项 — 纯图标，选中时才显示文字 */
.glow-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  min-width: 40px;
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
  font-size: 23px;
  color: var(--cover-text-muted, rgba(255, 255, 255, 0.45));
  transition:
    color 0.35s $spring-smooth,
    transform 0.45s $spring;
}

/* 选中态：图标弹跳放大 + 强调色 */
.glow-nav-item.active .glow-item-icon {
  color: var(--accent-color, #fff);
  transform: scale(1.1);
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

/* 底栏页面之间的横向切换，方向与手指移动一致。 */
.page-slide-next-enter-active,
.page-slide-next-leave-active,
.page-slide-prev-enter-active,
.page-slide-prev-leave-active {
  transition:
    transform 280ms cubic-bezier(0.22, 0.84, 0.24, 1.08),
    opacity 220ms ease;
}

.page-slide-next-enter-from {
  opacity: 0.7;
  transform: translate3d(100%, 0, 0);
}

.page-slide-next-leave-to {
  opacity: 0.45;
  transform: translate3d(-24%, 0, 0);
}

.page-slide-prev-enter-from {
  opacity: 0.7;
  transform: translate3d(-100%, 0, 0);
}

.page-slide-prev-leave-to {
  opacity: 0.45;
  transform: translate3d(24%, 0, 0);
}

/* ═══════════════════════════════════════════════════
   底栏布局模式
   ═══════════════════════════════════════════════════ */

/* —— 默认模式：底栏加宽到与迷你播放栏同宽 —— */
.nav-default .mobile-glow-nav-wrap {
  /* 加宽到与迷你播放栏同宽（100vw - 24px，对应 mx-3） */
  width: calc(100vw - (var(--mobile-dock-inset) * 2));
  max-width: 500px;
}

.nav-default .mobile-glow-nav {
  width: 100%;
  justify-content: space-around;
}

.nav-default .glow-nav-item {
  flex: 1;
}

/* The circular player is adjacent to navigation, but never becomes a fifth route. */
.mobile-glow-nav-wrap.has-player-slot {
  left: var(--mobile-dock-inset);
  right: calc(var(--mobile-dock-inset) + 62px);
  width: auto;
  max-width: none;
  transform: none;
  align-items: stretch;
}

.mobile-bottom-dock.player-open .mobile-glow-nav-wrap {
  left: var(--mobile-dock-inset);
  right: var(--mobile-dock-inset);
  width: auto;
  max-width: none;
  transform: none;
}

.mobile-glow-nav-wrap.has-player-slot .mobile-glow-nav {
  width: 100%;
  justify-content: space-around;
}

.mobile-glow-nav-wrap.has-player-slot .glow-nav-item {
  flex: 1 1 0;
}

/* —— 紧凑模式：底栏靠右，左侧为精简播放栏 ——
   通过同一元素的 left/right/transform/width 变化实现平滑过渡，不创建新 DOM
*/
.nav-compact .mobile-glow-nav-wrap.compact-mode {
  left: auto;
  right: var(--mobile-dock-inset);
  transform: none;
  width: auto;
  max-width: 55vw;
  /* 右对齐：当导航项显示文字导致宽度变化时，向左扩展而非向右溢出 */
  align-items: flex-end;
}

.nav-compact .mobile-glow-nav-wrap.compact-mode.has-player-slot {
  left: var(--mobile-dock-inset);
  right: calc(var(--mobile-dock-inset) + 62px);
  width: auto;
  max-width: none;
  transform: none;
  align-items: stretch;
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

  .page-slide-next-enter-active,
  .page-slide-next-leave-active,
  .page-slide-prev-enter-active,
  .page-slide-prev-leave-active {
    transition: opacity 0.2s ease;
    transform: none;
  }

  .page-slide-next-enter-from,
  .page-slide-next-leave-to,
  .page-slide-prev-enter-from,
  .page-slide-prev-leave-to {
    transform: none;
  }
}
</style>
