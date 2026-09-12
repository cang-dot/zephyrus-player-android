<template>
  <div
    id="layout-main"
    class="mobile-layout mobile"
    :class="{
      'has-safe-area': isPhone,
      'nav-default': true,
      'player-transitioning': playerMorphing,
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
      :class="{
        'has-bottom-menu': shouldShowBottomMenu,
        'has-player': isPlay,
        'player-background-suspended': backgroundSuspended,
        'page-swipe-dragging': pageSwipeDragging
      }"
      :inert="backgroundSuspended"
      @click.capture="onPageClickCapture"
      @pointerdown="onContentPointerDown"
      @pointermove="onContentPointerMove"
      @pointerup="onContentPointerUp"
      @pointercancel="onContentPointerCancel"
      @touchmove="onContentTouchMove"
    >
      <!-- Tab pager：四页常驻（首次激活挂载），横滑时当前页与相邻页 1:1 双页跟手 -->
      <div v-show="isBottomMenuRoute" class="tab-pager">
        <div
          v-for="(tab, index) in menuStore.menus"
          :key="tab.path"
          class="pager-page"
          :style="pagerPageStyle(index)"
        >
          <template v-if="pagerMounted[tab.path]">
            <component :is="tabComponent(tab.path)" />
          </template>
        </div>
      </div>

      <!-- 二级页（非底栏路由） -->
      <div v-if="!isBottomMenuRoute && !backgroundUnmounted" class="secondary-page-host">
        <router-view v-slot="{ Component }">
          <Transition :name="pageTransitionName" :css="!gestureNavigationInProgress">
            <keep-alive :include="keepAliveInclude">
              <component :is="Component" />
            </keep-alive>
          </Transition>
        </router-view>
      </div>
    </div>

    <!-- 非播放界面打开播放列表/歌曲信息时，底栏之外的页面由半透明遮罩覆盖，
         点击遮罩返回上一级，直到只剩迷你播放栏/底栏后遮罩消失。 -->
    <Transition name="dock-surface-fade">
      <div
        v-if="dockSurfaceMaskVisible"
        class="dock-surface-mask"
        @click="onDockSurfaceMaskClick"
      />
    </Transition>

    <div
      class="mobile-bottom-dock"
      :class="{
        visible:
          shouldShowBottomMenu ||
          (playerTransitionStartedWithMenu && playerTransition.state.value !== 'idle'),
        'has-player': isPlay,
        'player-collapsed': isPlay && miniPlayerIdleCollapsed,
        'player-open': isPlay && !miniPlayerIdleCollapsed,
        'playlist-mounted': isPlay && playlistSurfaceMounted,
        'playlist-open': isPlay && playlistSurfaceExpanded,
        'song-sheet-open': songSheetDockActive,
        'player-transitioning': playerMorphing,
        'player-source-dock': playerTransitionStartedWithMenu,
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
          v-if="isBottomMenuRoute"
          class="mobile-glow-nav-wrap"
          :class="{
            'has-player-slot': isPlay && miniPlayerIdleCollapsed
          }"
        >
          <div
            class="mobile-glow-nav nav-gesture-zone"
            :class="{ 'nav-dragging': navGlow.enlarged }"
            @pointerdown="onNavPointerDown"
            @pointermove="onNavPointerMove"
            @pointerup="onNavPointerUp"
            @pointercancel="onNavPointerCancel"
            @click.capture="onNavClickCapture"
          >
            <router-link
              v-for="item in menuStore.menus"
              :key="item.path"
              :to="menuTarget(item.path)"
              :data-path="item.path"
              draggable="false"
              @dragstart.prevent
              @contextmenu.prevent
              class="glow-nav-item"
              :class="{
                active: isActive(item.path),
                'hover-pick': navGlow.enlarged && pickPath === item.path
              }"
              @click="prepareMenuTransition(item.path)"
            >
              <div
                class="glow-item-radial"
                :style="isActive(item.path) ? { background: activeGlowStyle } : {}"
              />
              <div class="glow-item-content">
                <i class="iconfont glow-item-icon" :class="item.meta.icon" />
                <Transition name="label-pop">
                  <span
                    v-if="(isActive(item.path) && !navGlow.enlarged) || pickPath === item.path"
                    class="glow-item-label"
                    >{{ t(item.meta.title) }}</span
                  >
                </Transition>
              </div>
            </router-link>

            <!-- 按住/横拖的跟手辉光:单个浮层,从按住项亮起,拖动后放大并完全跟随手指 -->
            <div
              v-if="navGlow.visible"
              class="nav-glow-float"
              :class="{ dragging: navGlow.enlarged, closing: navGlow.closing }"
              :style="navGlowFloatStyle"
            >
              <div class="nav-glow-float-inner" :style="{ background: activeGlowStyle }" />
            </div>
          </div>
        </div>
      </Transition>
    </div>
    <mobile-player-bottom-surface v-if="isPlay" />
    <mobile-song-action-sheet
      v-if="mobileSongActionRequest && !isPlay"
      :item="mobileSongActionRequest.item"
      :show="songActionSurface.visible.value"
      :is-favorite="mobileSongActionRequest.isFavorite"
      :can-remove="mobileSongActionRequest.canRemove"
      :origin="mobileSongActionRequest.origin"
      :source-geometry="songActionSurface.sourceGeometry.value"
      :scope-geometry="songActionSurface.scopeGeometry.value"
      @update:show="(visible) => !visible && songActionSurface.close()"
      @play="invokeSongAction('play')"
      @play-next="invokeSongAction('playNext')"
      @favorite="invokeSongAction('favorite')"
      @remove="invokeSongAction('remove')"
      @goto-artist="(id) => invokeSongAction('gotoArtist', id)"
      @goto-album="(id) => invokeSongAction('gotoAlbum', id)"
    />
  </div>
</template>

<script setup lang="ts">
import {
  type Component,
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  readonly,
  ref,
  watch
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import MobileSongActionSheet from '@/components/common/MobileSongActionSheet.vue';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { useMobileSongActionSurface } from '@/composables/useMobileSongActionSurface';
import homeRouter from '@/router/home';
import otherRouter from '@/router/other';
import { installMobileBackBridge, registerMobileBackLayer } from '@/services/mobileBackStack';
import { useMenuStore } from '@/store/modules/menu';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
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

const props = defineProps<{
  isPhone: boolean;
}>();

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();
const menuStore = useMenuStore();
const { t } = useI18n();
const playerTransition = useMobilePlayerTransition();
const songActionSurface = useMobileSongActionSurface();
const mobileSongActionRequest = computed(() => songActionSurface.request.value);
// 歌曲信息与播放列表共用 Dock 玻璃容器：页面长按时若列表未展开，先记为
// "独立打开"并临时展开容器；关闭歌曲信息时随之收起，播放列表则保持原状。
const songSheetStandalone = ref(false);
const songSheetDockActive = computed(
  () => isPlay.value && !playerStore.musicFull && songActionSurface.visible.value
);
watch(
  () => songActionSurface.visible.value,
  (visible) => {
    if (playerStore.musicFull || !isPlay.value) return;
    if (visible) {
      songSheetStandalone.value = !playerStore.playListDrawerVisible;
      if (songSheetStandalone.value) playerStore.setPlayListDrawerVisible(true);
      return;
    }
    if (songSheetStandalone.value) {
      songSheetStandalone.value = false;
      if (playerStore.playListDrawerVisible) playerStore.setPlayListDrawerVisible(false);
    }
  }
);
const dockSurfaceMaskVisible = computed(
  () => isPlay.value && !playerStore.musicFull && playerStore.playListDrawerVisible
);
const onDockSurfaceMaskClick = () => {
  if (songActionSurface.visible.value) {
    songActionSurface.close();
    return;
  }
  playerStore.setPlayListDrawerVisible(false);
};
// 打开播放界面前先直接收起播放列表与歌曲信息弹层，避免转场割裂；
// 收起后底部容器在播放界面内也不会重新展开播放列表。
watch(
  () => playerStore.musicFull,
  (full) => {
    if (!full) return;
    songSheetStandalone.value = false;
    if (playerStore.playListDrawerVisible) playerStore.setPlayListDrawerVisible(false);
    if (songActionSurface.visible.value) songActionSurface.close();
  }
);
const invokeSongAction = (
  action: 'play' | 'playNext' | 'favorite' | 'remove' | 'gotoArtist' | 'gotoAlbum',
  id?: number
) => {
  const callback = songActionSurface.request.value?.callbacks?.[action] as
    | ((id?: number) => void | Promise<void>)
    | undefined;
  if (callback) void callback(id);
};
const playerMorphing = computed(() =>
  ['dragging', 'opening', 'closing'].includes(playerTransition.state.value)
);
const playerTransitionStartedWithMenu = ref(false);
// Destroying the route tree on the same frame that the player settles open can
// block Android WebView for seconds. content-visibility releases its rendering
// work while keeping the already-created page available for a fast close.
const backgroundUnmounted = computed(() => false);
const backgroundSuspended = computed(
  () => playerTransition.state.value === 'open' && playerTransition.progress.value > 0.98
);
let playerSourceReleaseFrame = 0;
let playerSurfaceClassReleaseTimer: ReturnType<typeof setTimeout> | undefined;
let lastPlayerSurfaceProgress = '';
let lastPlayerSurfaceReveal = '';
const capturePlayerTransitionOrigin = () => {
  if (playerSourceReleaseFrame) {
    cancelAnimationFrame(playerSourceReleaseFrame);
    playerSourceReleaseFrame = 0;
  }
  playerTransitionStartedWithMenu.value = isBottomMenuRoute.value;
  const identity = document
    .querySelector<HTMLElement>('.mobile-play-bar .mini-song-info')
    ?.getBoundingClientRect();
  playerTransition.setIdentitySourceRect(
    identity && identity.width > 0 && identity.height > 0
      ? {
          left: identity.left,
          top: identity.top,
          width: identity.width,
          height: identity.height,
          borderRadius: identity.height / 2
        }
      : null
  );
  const cover = document
    .querySelector<HTMLElement>('.mobile-play-bar .mini-song-cover')
    ?.getBoundingClientRect();
  playerTransition.setSourceRect(
    cover && cover.width > 0 && cover.height > 0
      ? {
          left: cover.left,
          top: cover.top,
          width: cover.width,
          height: cover.height,
          borderRadius: Math.min(cover.width, cover.height) / 2
        }
      : null
  );
};
provide('capturePlayerTransitionOrigin', capturePlayerTransitionOrigin);
provide('playerTransitionStartedWithMenu', playerTransitionStartedWithMenu);
const syncPlayerSurfaceProgress = () => {
  const progress = playerTransition.progress.value;
  const state = playerTransition.state.value;
  const reveal = Math.min(1, Math.max(0, (progress - 0.035) / 0.62));
  const surfaceActive = progress > 0 || state !== 'idle';
  const progressValue = String(progress);
  const revealValue = String(reveal);
  if (progressValue !== lastPlayerSurfaceProgress) {
    document.documentElement.style.setProperty('--player-open-progress', progressValue);
    lastPlayerSurfaceProgress = progressValue;
  }
  if (revealValue !== lastPlayerSurfaceReveal) {
    document.documentElement.style.setProperty('--player-surface-reveal', revealValue);
    lastPlayerSurfaceReveal = revealValue;
  }
  if (surfaceActive) {
    if (playerSurfaceClassReleaseTimer) clearTimeout(playerSurfaceClassReleaseTimer);
    playerSurfaceClassReleaseTimer = undefined;
    document.body.classList.add('mobile-player-surface-active');
  } else if (
    document.body.classList.contains('mobile-player-surface-active') &&
    !playerSurfaceClassReleaseTimer
  ) {
    // Naive UI keeps its teleported drawer alive briefly for the leave phase.
    // Keep the zero-opacity transition class until that phase has completed,
    // otherwise the full-screen surface can become opaque for one black frame.
    playerSurfaceClassReleaseTimer = setTimeout(() => {
      playerSurfaceClassReleaseTimer = undefined;
      document.body.classList.remove('mobile-player-surface-active');
    }, 360);
  }
  document.body.classList.toggle(
    'mobile-player-surface-morphing',
    state === 'dragging' || state === 'opening' || state === 'closing'
  );
};
watch(
  () => [playerTransition.progress.value, playerTransition.state.value] as const,
  syncPlayerSurfaceProgress,
  { immediate: true }
);
onBeforeUnmount(() => {
  if (playerSourceReleaseFrame) cancelAnimationFrame(playerSourceReleaseFrame);
  if (playerSurfaceClassReleaseTimer) clearTimeout(playerSurfaceClassReleaseTimer);
  document.documentElement.style.removeProperty('--player-open-progress');
  document.documentElement.style.removeProperty('--player-surface-reveal');
  document.body.classList.remove('mobile-player-surface-active');
  document.body.classList.remove('mobile-player-surface-morphing');
});
watch(
  () => playerTransition.state.value,
  (state, previous) => {
    if ((state === 'dragging' || state === 'opening') && previous === 'idle') {
      capturePlayerTransitionOrigin();
    }
  },
  { flush: 'sync' }
);
watch(
  () => [playerStore.musicFull, playerTransition.state.value] as const,
  ([isFull, state]) => {
    if (isFull || state !== 'idle' || !playerTransitionStartedWithMenu.value) return;
    if (playerSourceReleaseFrame) cancelAnimationFrame(playerSourceReleaseFrame);
    // Keep the source identity active through the frame where musicFull flips
    // so it lands back in the existing mini player instead of flashing.
    playerSourceReleaseFrame = requestAnimationFrame(() => {
      playerSourceReleaseFrame = 0;
      playerTransitionStartedWithMenu.value = false;
    });
  },
  { flush: 'post' }
);
const dockTransitionStyle = computed(() => {
  if (!playerTransitionStartedWithMenu.value) return undefined;
  return { opacity: '1' };
});

type PageTransitionDirection = 'next' | 'prev';

const pageTransitionDirection = ref<PageTransitionDirection | null>(null);
const menuRouteMemory = ref<Record<string, string>>({});
const miniPlayerIdleCollapsed = ref(false);
const playlistSurfaceMounted = ref(false);
const playlistSurfaceExpanded = ref(false);
const gestureNavigationInProgress = ref(false);
const pageTransitionName = computed(() =>
  pageTransitionDirection.value ? `page-slide-${pageTransitionDirection.value}` : 'page-fade'
);

// ==================== Tab pager（四页常驻 + 双页跟手） ====================
const pagerMounted = ref<Record<string, boolean>>({});
const pagerIndex = ref(0);
const pagerOffset = ref(0); // 拖动/弹簧偏移（px），叠加在各页基准位上
const pageSwipeAnimating = ref(false);
const pagerComponents: Record<string, Component> = {};
let lastPageSwipeVelocity = 0;

// 常驻页不走 keep-alive 生命周期，页内组件（如 GlowTabs 顶栏注册）需要
// 感知「当前显示的是哪个 pager 页」来决定可见性，不能依赖挂载时的 route.path
const pagerActivePath = computed(() => menuStore.menus[pagerIndex.value]?.path || route.path);
provide('mobilePagerActivePath', readonly(pagerActivePath));

const mountPagerPage = (path: string) => {
  if (pagerMounted.value[path]) return;
  pagerMounted.value = { ...pagerMounted.value, [path]: true };
};

/** 预挂载相邻页：拖动开始前相邻页必须已渲染，才能贴边跟手 */
const mountAdjacentPagerPages = (index: number) => {
  const paths = menuStore.menus.map((item: any) => item.path);
  [index - 1, index, index + 1].forEach((i) => {
    if (paths[i]) mountPagerPage(paths[i]);
  });
};

const tabComponent = (path: string) => {
  if (!pagerComponents[path]) {
    const routeDef = homeRouter.find((item) => item.path === path);
    pagerComponents[path] = routeDef
      ? defineAsyncComponent(routeDef.component as () => Promise<Component>)
      : (undefined as unknown as Component);
  }
  return pagerComponents[path];
};

const pagerPageStyle = (index: number) => ({
  // 位置必须相对当前页（index - pagerIndex）：动画结束 done 回调会设置
  // pagerIndex=targetIndex、pagerOffset=0，若不减 pagerIndex，目标页会弹回
  // index*屏宽 的容器外位置，导致任何切换动画结束后都显示首页
  transform: `translate3d(calc(${(index - pagerIndex.value) * 100}% + ${pagerOffset.value}px), 0, 0)`
});

// 初始化：挂载当前页与相邻页
pagerIndex.value = Math.max(
  0,
  menuStore.menus.findIndex((item: any) => item.path === route.path)
);
mountAdjacentPagerPages(pagerIndex.value);

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
    // 底栏 tab 路由变化（点底栏/返回）：双页弹簧平移到目标页
    const targetIndex = menuStore.menus.findIndex((item: any) => item.path === path);
    if (targetIndex >= 0 && targetIndex !== pagerIndex.value) {
      const target = menuStore.menus[targetIndex];
      if (target) mountPagerPage(target.path);
      mountAdjacentPagerPages(targetIndex);
      const distance = -(targetIndex - pagerIndex.value) * window.innerWidth;
      const velocity = lastPageSwipeVelocity;
      lastPageSwipeVelocity = 0;
      animatePageOffset(distance, velocity, () => {
        pagerIndex.value = targetIndex;
        pagerOffset.value = 0;
        mountAdjacentPagerPages(targetIndex);
      });
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
const pageSwipeDragging = ref(false);
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
    const start = pagerOffset.value;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 160);
      pagerOffset.value = start + (target - start) * (1 - Math.pow(1 - progress, 3));
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
  let value = pagerOffset.value;
  let velocity = initialVelocity * 1000;
  let previous = performance.now();
  pageSwipeAnimating.value = true;
  const tick = (now: number) => {
    const dt = Math.min(0.032, Math.max(0.001, (now - previous) / 1000));
    previous = now;
    const acceleration = -420 * (value - target) - 38 * velocity;
    velocity += acceleration * dt;
    value += velocity * dt;
    pagerOffset.value = value;
    if (Math.abs(value - target) < 0.5 && Math.abs(velocity) < 5) {
      pagerOffset.value = target;
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
  // 立即捕获仅限触摸:触摸需防止嵌套滚动容器在方向锁定前取消水平手势。
  // 鼠标立即捕获会把真实点击的 click 目标重定向到容器,
  // 导致 pager 内所有 @click(歌单卡等)在电脑端全部失效。
  if (event.pointerType !== 'mouse') {
    const target = event.currentTarget as HTMLElement;
    if (!target.hasPointerCapture(event.pointerId)) target.setPointerCapture(event.pointerId);
  }
};

const onContentPointerMove = (event: PointerEvent) => {
  if (!pagePointerActive || event.pointerId !== pagePointerId) return;
  const deltaX = event.clientX - pagePointerStartX;
  const deltaY = event.clientY - pagePointerStartY;

  if (pagePointerAxis === 'none' && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 6) {
    pagePointerAxis = Math.abs(deltaX) > Math.abs(deltaY) * 1.04 ? 'horizontal' : 'vertical';
    if (pagePointerAxis === 'horizontal') {
      pageSwipeDragging.value = true;
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
  // 1:1 跟手：当前页与相邻页一起平移（各页 transform 由 pagerOffset 驱动）
  pagerOffset.value = hasAdjacent ? deltaX : deltaX * 0.24;
  if (hasAdjacent) {
    const dragTargetIndex = movingToNext ? currentIndex + 1 : currentIndex - 1;
    const adjacentPath = menuStore.menus[dragTargetIndex]?.path;
    if (adjacentPath) mountPagerPage(adjacentPath);
  }
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
  pageSwipeDragging.value = false;
  if (!commit) {
    // 取消：双页从当前位置弹回原位（速度接力）
    animatePageOffset(0, recentPageVelocity());
    return;
  }

  triggerPageHaptic();
  lastPageSwipeVelocity = velocity;
  // 提交：双页向目标方向弹簧平移（offset 为负 = 前进），路由同步；页面常驻无重挂载空白
  const distance = -(targetIndex - pagerIndex.value) * window.innerWidth;
  animatePageOffset(distance, velocity, () => {
    // 滑动手势是"先动画后路由"：若 push 失败/未生效（底栏图标由 route.path
    // 驱动，会停留在旧 tab 高亮），动画收尾时校验路由，未跟上则弹回原页，
    // 保证视觉与路由永远一致，避免"页面切走了但图标没变"的脱节
    if (route.path !== target.path) {
      animatePageOffset(0, 0);
      return;
    }
    pagerIndex.value = targetIndex;
    pagerOffset.value = 0;
    mountAdjacentPagerPages(targetIndex);
    gestureNavigationInProgress.value = false;
  });
  void router.push(menuTarget(target.path)).catch((error: unknown) => {
    console.warn('[MobilePager] 页面切换失败:', error);
  });
};

const onContentPointerCancel = (event: PointerEvent) => {
  if (!pagePointerActive || event.pointerId !== pagePointerId) return;
  releasePagePointer(event);
  pagePointerActive = false;
  pagePointerAxis = 'none';
  pageSwipeDragging.value = false;
  resetPageSwipe();
};

// pointer 事件的 preventDefault 无法阻止浏览器触摸滚动（规范限定）。
// touch-action: pan-y 下 Android WebView 判定垂直滚动意图后会触发
// pointercancel 中断指针流，手势表现为"跟手一点就弹回"。因此在水平
// 意图锁定后由非被动 touchmove preventDefault 阻止浏览器接管滚动。
const onContentTouchMove = (event: TouchEvent) => {
  if (pagePointerAxis === 'horizontal') event.preventDefault();
};

onBeforeUnmount(() => {
  if (pageTransitionTimer) clearTimeout(pageTransitionTimer);
  if (pageSwipeAnimationFrame) cancelAnimationFrame(pageSwipeAnimationFrame);
  if (pageClickTimer) clearTimeout(pageClickTimer);
  if (playlistSurfaceUnmountTimer) clearTimeout(playlistSurfaceUnmountTimer);
  if (playlistSurfaceFrame) cancelAnimationFrame(playlistSurfaceFrame);
});

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
    // 播放列表/歌曲信息展开时，Dock 上的纵向滑动属于列表滚动，
    // 不能触发"上滑打开播放界面"的形变（否则顶栏在遮罩上闪烁、底栏上浮）。
    playerStore.playListDrawerVisible ||
    songActionSurface.visible.value ||
    (event.target instanceof Element && event.target.closest('.mobile-play-bar'))
  )
    return;
  dockPointerId = event.pointerId;
  dockStartX = event.clientX;
  dockStartY = event.clientY;
  dockAxis = 'none';
  dockSamples = [{ y: event.clientY, time: performance.now() }];
  suppressDockClick = false;
  capturePlayerTransitionOrigin();
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
    if (shouldOpen) playerTransition.animateTo(1, -velocity);
    else playerTransition.close(-velocity);
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

// ── 底栏辉光跟手横滑选页:按住图标辉光立即扩大,横拖时辉光跟手预览目标项
//    (不切页),松手提交;普通轻点完全交给 router-link 原生行为。 ──
const pickPath = ref('');
// 跟手辉光浮层:按下出现在原项,横拖后放大并 1:1 跟随手指,松手收拢
const navGlow = reactive({
  visible: false,
  enlarged: false,
  closing: false,
  x: 0,
  y: 0,
  w: 64,
  h: 40
});
let navGlowHideTimer: ReturnType<typeof setTimeout> | undefined;
let navGlowNavLeft = 0;
let navGlowNavTop = 0;

const navGlowFloatStyle = computed(() => ({
  width: `${navGlow.w}px`,
  height: `${navGlow.h}px`,
  transform: `translate3d(${navGlow.x - navGlow.w / 2}px, ${navGlow.y - navGlow.h / 2}px, 0)`,
  opacity: navGlow.closing ? '0' : '1'
}));

function showNavGlowAt(clientX: number, clientY: number, itemEl: HTMLElement | null) {
  const nav = document.querySelector<HTMLElement>('.mobile-glow-nav');
  if (!nav) return;
  const navRect = nav.getBoundingClientRect();
  navGlowNavLeft = navRect.left;
  navGlowNavTop = navRect.top;
  const rect = itemEl
    ? itemEl.getBoundingClientRect()
    : { left: clientX - 32, top: clientY - 20, width: 64, height: 40 };
  if (navGlowHideTimer) {
    clearTimeout(navGlowHideTimer);
    navGlowHideTimer = undefined;
  }
  navGlow.visible = true;
  navGlow.closing = false;
  navGlow.enlarged = false;
  navGlow.w = rect.width;
  navGlow.h = rect.height;
  navGlow.x = rect.left + rect.width / 2 - navRect.left;
  navGlow.y = rect.top + rect.height / 2 - navRect.top;
}

function hideNavGlow() {
  if (!navGlow.visible) return;
  navGlow.closing = true;
  if (navGlowHideTimer) clearTimeout(navGlowHideTimer);
  navGlowHideTimer = setTimeout(() => {
    navGlow.visible = false;
    navGlow.closing = false;
    navGlow.enlarged = false;
    navGlowHideTimer = undefined;
  }, 220);
}

let navPickPointerId: number | null = null;
let navPickStartX = 0;
let navPickStartY = 0;
let navDragging = false;
let navSuppressClick = false;
let navSuppressResetFrame = 0;

const navItemPathFromPoint = (x: number, y: number): string => {
  const el = document
    .elementFromPoint(x, y)
    ?.closest('.glow-nav-item') as HTMLElement | null;
  return el?.dataset.path || '';
};

/** 横拖时选「离手指最近的一项」:图标与项之间的间隙不丢预览 */
const navNearestItemPath = (x: number, y: number): string => {
  const items = Array.from(
    document.querySelectorAll<HTMLElement>('.mobile-glow-nav .glow-nav-item')
  );
  let best = '';
  let bestDist = Infinity;
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    const cx = Math.min(Math.max(x, rect.left), rect.right);
    const cy = Math.min(Math.max(y, rect.top), rect.bottom);
    const dist = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    if (dist < bestDist) {
      bestDist = dist;
      best = item.dataset.path || '';
    }
  }
  return best;
};

const releaseNavSuppress = () => {
  if (!navSuppressClick) return;
  navSuppressClick = false;
  if (navSuppressResetFrame) {
    cancelAnimationFrame(navSuppressResetFrame);
    navSuppressResetFrame = 0;
  }
};

const scheduleNavSuppressReset = () => {
  if (navSuppressResetFrame) cancelAnimationFrame(navSuppressResetFrame);
  // WebView 可能不派发合成 click:一帧后自动解除抑制,不污染下一次点击
  navSuppressResetFrame = requestAnimationFrame(() => {
    navSuppressResetFrame = 0;
    navSuppressClick = false;
  });
};

const onNavPointerDown = (event: PointerEvent) => {
  if (!event.isPrimary || playerStore.musicFull) return;
  navPickPointerId = event.pointerId;
  navPickStartX = event.clientX;
  navPickStartY = event.clientY;
  navDragging = false;
  // 按住即在该项亮起辉光;click 保持放行,轻点仍走 router-link
  const itemEl = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest('.glow-nav-item') as HTMLElement | null;
  pickPath.value = itemEl?.dataset.path || '';
  showNavGlowAt(event.clientX, event.clientY, itemEl);
};

const onNavPointerMove = (event: PointerEvent) => {
  if (event.pointerId !== navPickPointerId) return;
  const dx = event.clientX - navPickStartX;
  const dy = event.clientY - navPickStartY;
  if (!navDragging) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
    if (Math.abs(dy) > Math.abs(dx) * 1.2) {
      // 纵向意图:取消预览,交回 Dock(上滑打开播放界面);click 不拦
      navPickPointerId = null;
      pickPath.value = '';
      hideNavGlow();
      return;
    }
    // 明确横向:进入拖选,拦下合成 click,改由 pointerup 提交
    navDragging = true;
    navSuppressClick = true;
    const host = event.currentTarget as HTMLElement;
    if (!host.hasPointerCapture(event.pointerId)) {
      try {
        host.setPointerCapture(event.pointerId);
      } catch {
        // 指针可能已释放
      }
    }
  }
  event.preventDefault();
  // 辉光放大并横向完全跟手;y 轴锁定在起始项中心线高度
  navGlow.enlarged = true;
  navGlow.x = event.clientX - navGlowNavLeft;
  pickPath.value = navNearestItemPath(event.clientX, event.clientY);
};

const onNavPointerRelease = (event: PointerEvent) => {
  if (event.pointerId !== navPickPointerId) return;
  const host = event.currentTarget as HTMLElement;
  if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
  navPickPointerId = null;
  if (navDragging) {
    navDragging = false;
    const target = pickPath.value;
    pickPath.value = '';
    navGlow.enlarged = false;
    hideNavGlow();
    if (target && !isActive(target)) {
      prepareMenuTransition(target);
      router.push(menuTarget(target));
    }
    scheduleNavSuppressReset();
  } else {
    // 未进入拖选:收拢辉光,放行 router-link 原生 click
    pickPath.value = '';
    hideNavGlow();
  }
};

const onNavPointerUp = (event: PointerEvent) => onNavPointerRelease(event);
const onNavPointerCancel = (event: PointerEvent) => {
  if (event.pointerId !== navPickPointerId) return;
  navPickPointerId = null;
  navDragging = false;
  pickPath.value = '';
  hideNavGlow();
};

const onNavClickCapture = (event: MouseEvent) => {
  if (!navSuppressClick) return;
  event.preventDefault();
  event.stopPropagation();
  releaseNavSuppress();
};

// 提供是否有安全区域
provide('hasSafeArea', props.isPhone);

// 是否有播放的歌曲
const isPlay = computed(() => playerStore.playMusic && playerStore.playMusic.id);

// 是否显示底部菜单
const isBottomMenuRoute = computed(() => {
  const menuPaths = menuStore.menus.map((item: any) => item.path);
  return menuPaths.includes(route.path);
});
const shouldShowBottomMenu = computed(() => isBottomMenuRoute.value && !playerStore.musicFull);
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
provide('playlistSurfaceMounted', playlistSurfaceMounted);
provide('playlistSurfaceExpanded', playlistSurfaceExpanded);
provide('playlistSongSheetActive', songSheetDockActive);

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

const backLayerDisposers: Array<() => void> = [];

onMounted(() => {
  installMobileBackBridge();
  backLayerDisposers.push(
    registerMobileBackLayer({
      id: 'mobile-song-action-surface',
      priority: 980,
      isActive: () => songActionSurface.visible.value,
      onBack: songActionSurface.close
    }),
    registerMobileBackLayer({
      id: 'player-settings',
      priority: 520,
      isActive: () => playerStore.playerSettingsVisible,
      onBack: () => playerStore.setPlayerSettingsVisible(false)
    }),
    registerMobileBackLayer({
      id: 'player-scrolling-lyrics',
      priority: 500,
      isActive: () => playerStore.fullLyricsVisible,
      onBack: () => playerStore.setFullLyricsVisible(false)
    }),
    registerMobileBackLayer({
      id: 'playing-list',
      priority: 480,
      isActive: () => playerStore.playListDrawerVisible,
      onBack: () => playerStore.setPlayListDrawerVisible(false)
    }),
    registerMobileBackLayer({
      id: 'artist-drawer',
      priority: 360,
      isActive: () => settingsStore.showArtistDrawer,
      onBack: () => settingsStore.setShowArtistDrawer(false)
    }),
    registerMobileBackLayer({
      id: 'full-player',
      priority: 200,
      isActive: () => playerStore.musicFull,
      onBack: () =>
        playerTransition.close(0, () => {
          playerStore.setMusicFull(false);
        }),
      onProgress: (progress) => {
        playerTransition.setDragging(1 - progress);
      },
      onCancel: () => {
        playerTransition.animateTo(1, 0);
      }
    })
  );
});

onBeforeUnmount(() => {
  backLayerDisposers.splice(0).forEach((dispose) => dispose());
});
</script>

<style lang="scss" scoped>
:global(:root) {
  --player-glass-background: color-mix(
    in srgb,
    var(--accent-color, #777) 7%,
    rgba(18, 18, 20, 0.16)
  );
  --player-glass-background-active: color-mix(
    in srgb,
    var(--accent-color, #777) 10%,
    rgba(18, 18, 20, 0.22)
  );
  --player-glass-background-fallback: color-mix(
    in srgb,
    var(--accent-color, #777) 14%,
    rgba(24, 24, 26, 0.52)
  );
  --player-glass-border: color-mix(in srgb, #fff 10%, transparent);
  --player-glass-border-active: color-mix(in srgb, var(--accent-color, #777) 18%, #fff 12%);
  --player-glass-text: rgba(255, 255, 255, 0.94);
  --player-glass-text-secondary: rgba(255, 255, 255, 0.76);
  --player-glass-filter: blur(12px) saturate(118%);
  --player-glass-feedback-duration: 220ms;
}

@media (prefers-reduced-motion: reduce) {
  :global(:root) {
    --player-glass-feedback-duration: 80ms;
  }
}

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

.mobile-layout[data-theme='dark'],
.dark .mobile-layout {
  --player-glass-border: transparent;
  --player-glass-border-active: transparent;
  --m-glass-border: transparent;
  --cover-border: transparent;
  --cover-border-strong: transparent;
}

.mobile-content {
  @apply flex-1;
  height: 100%;
  position: relative;
  overflow: hidden;
  touch-action: pan-y;
  overscroll-behavior-x: contain;
  transform: translate3d(0, 0, 0);

  /* 内容铺满全屏 — 顶栏透明叠加在上面 */
  padding-top: 0;
}

/* Tab pager：四页 absolute 并排，各自独立滚动，轨道平移决定可见性 */
.tab-pager {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.pager-page {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  background: var(--m-bg, #141414);
  will-change: transform;
  padding-bottom: var(--mobile-dock-content-inset, 0px);
}

/* 二级页宿主：独立滚动容器（原共享滚动改每页自治） */
.secondary-page-host {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
}

.mobile-content.player-background-suspended {
  content-visibility: hidden;
  pointer-events: none;
  user-select: none;
}

.mobile-content.page-swipe-dragging :deep(.cover-card:active),
.mobile-content.page-swipe-dragging :deep(.artist-card:active),
.mobile-content.page-swipe-dragging :deep(.media-card:active) {
  transform: none;
}

.dock-surface-mask {
  position: fixed;
  inset: 0;
  z-index: 198;
  background: rgba(0, 0, 0, 0.42);
}

.dock-surface-fade-enter-active,
.dock-surface-fade-leave-active {
  transition: opacity 220ms ease;
}

.dock-surface-fade-enter-from,
.dock-surface-fade-leave-to {
  opacity: 0;
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
  isolation: isolate;
  pointer-events: none;
  transition:
    height 420ms cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 420ms cubic-bezier(0.32, 0.72, 0, 1);

  &::before {
    position: absolute;
    inset: 0;
    z-index: -1;
    border: 1px solid var(--m-glass-border);
    border-radius: inherit;
    background: var(--m-glass-bg);
    box-shadow:
      0 14px 34px rgba(0, 0, 0, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    content: '';
    opacity: 0;
    pointer-events: none;
    backdrop-filter: blur(30px) saturate(175%);
    -webkit-backdrop-filter: blur(30px) saturate(175%);
  }

  &.visible {
    height: 54px;
    pointer-events: auto;
  }

  /* The compact player can exist on routes without the bottom navigation.
     Keep its actual controls targetable even when the dock shell is only a
     zero-height gesture surface. */
  &.has-player:not(.player-full) {
    pointer-events: auto;
  }

  &.visible::before {
    opacity: 1;
  }

  &.player-transitioning {
    z-index: 100150;
    overflow: visible;
    pointer-events: auto;
    transition: none !important;
  }

  &.player-transitioning::before {
    opacity: clamp(0, calc(1 - var(--player-open-progress, 0) * 3), 1);
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
    opacity: clamp(0, calc(1 - var(--player-open-progress, 0) * 3), 1);
    pointer-events: none;
  }

  &.player-transitioning > :deep(.mobile-play-bar) {
    z-index: 1;
    transition: none !important;
    opacity: 1;
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
  }

  &.playlist-open::before {
    box-shadow:
      0 18px 48px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.22);
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

  /* 歌曲信息复用容器时收紧高度，贴合内容，避免玻璃下方留白。 */
  &.playlist-open.song-sheet-open {
    height: min(48dvh, 430px);
    min-height: 280px;
  }

  &.playlist-open.visible.song-sheet-open {
    height: min(48dvh, 430px);
  }

  &.playlist-mounted:not(.visible).song-sheet-open :deep(.playlist-panel.embedded) {
    height: calc(min(48dvh, 430px) - 56px);
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
:global(body.mobile-player-surface-active #mobile-drawer-target.default-player-v2),
:global(body.mobile-player-surface-active .error-mobile-player),
:global(body.mobile-player-surface-active .stage-mobile-player),
:global(body.mobile-player-surface-active .rain-mobile-player),
:global(body.mobile-player-surface-active .star-chart-player),
:global(body.mobile-player-surface-active .frenzy-mobile-player),
:global(body.mobile-player-surface-active .eerie-mobile-player),
:global(body.mobile-player-surface-active .neon-mobile-player),
:global(body.mobile-player-surface-active .smoke-mobile-player) {
  opacity: var(--player-surface-reveal, 1) !important;
  transition: none !important;
  animation: none !important;
  -webkit-mask-image: none;
  mask-image: none;
  will-change: opacity;
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

.nav-gesture-zone {
  touch-action: none;
}

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
    -webkit-touch-callout: none;
    user-select: none;
    -webkit-user-drag: none;
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

/* 按住/横拖的跟手辉光浮层:外层 1:1 跟手(拖动时无位移过渡),内层负责放大过渡 */
.nav-glow-float {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  border-radius: 9999px;
  pointer-events: none;
  transition:
    opacity 0.22s ease,
    transform 0.28s $spring;
  will-change: transform;
}

.nav-glow-float.dragging {
  transition: opacity 0.2s ease;
}

.nav-glow-float.closing {
  opacity: 0;
}

.nav-glow-float-inner {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  transform: scale(1);
  transition: transform 0.26s $spring;
}

.nav-glow-float.dragging .nav-glow-float-inner {
  transform: scale(1.16);
}

/* 拖动期间:各项(含当前页)回到未选中态,辉光完全由浮动层承载 */
.mobile-glow-nav.nav-dragging .glow-nav-item.active .glow-item-radial {
  opacity: 0;
}

.mobile-glow-nav.nav-dragging .glow-nav-item.active .glow-item-icon {
  color: var(--cover-text-muted, rgba(255, 255, 255, 0.45));
  transform: none;
}

/* 拖动中辉光悬停到的项:复用 hover 动画(轻微放大+颜色加深) */
.mobile-glow-nav.nav-dragging .glow-nav-item.hover-pick .glow-item-icon {
  color: var(--cover-text-primary, rgba(255, 255, 255, 0.8));
  transform: scale(1.05);
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

/* Apple-style page transition: 弹簧曲线。
   转场期间页面绝对定位并自带上背景：新旧页并排贴合（无 out-in 空白、无块流堆叠） */
.page-fade-enter-active,
.page-fade-leave-active,
.page-slide-next-enter-active,
.page-slide-next-leave-active,
.page-slide-prev-enter-active,
.page-slide-prev-leave-active {
  position: absolute;
  inset: 0;
  background: var(--m-bg, #141414);
}

.page-fade-enter-active {
  transition:
    opacity 0.32s $spring-smooth,
    transform 0.42s $spring;
  z-index: 2;
}

.page-fade-leave-active {
  transition:
    opacity 0.28s $spring-smooth,
    transform 0.3s $spring-smooth;
  z-index: 1;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.97);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(1.02);
}

/* 底栏页面之间的横向切换：全幅推挤，下一页紧贴本页旁边，方向与手指移动一致。 */
.page-slide-next-enter-active,
.page-slide-next-leave-active,
.page-slide-prev-enter-active,
.page-slide-prev-leave-active {
  transition:
    transform 300ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 220ms ease;
}

.page-slide-next-enter-active,
.page-slide-prev-enter-active {
  z-index: 2;
}

.page-slide-next-enter-from {
  transform: translate3d(100%, 0, 0);
}

.page-slide-next-leave-to {
  transform: translate3d(-38%, 0, 0);
}

.page-slide-prev-enter-from {
  transform: translate3d(-100%, 0, 0);
}

.page-slide-prev-leave-to {
  transform: translate3d(38%, 0, 0);
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
