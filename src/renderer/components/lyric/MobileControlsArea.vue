<template>
  <div
    ref="rootRef"
    class="mobile-controls no-toggle"
    :class="{
      visible,
      'fullscreen-mode': isFullscreen,
      'shared-surface-content': sharedSurface,
      'surface-interaction-active': playerSurfaceFeedback.active.value,
      'song-transitioning': isSongTransitioning,
      'landscape-mode': isLandscape,
      docked: dockActive
    }"
    :style="{ ...transitionStyles, ...dockStyle }"
    @click="handleSurfaceTap"
    @touchstart.stop="emitInteract"
    @touchend.stop
    @mousedown.stop="emitInteract"
  >
    <div
      ref="infoRowRef"
      class="player-info-row"
      :class="{ 'info-compact': defaultStyleCompact }"
      :style="immersiveRowStyle"
    >
      <div
        v-if="!defaultStyleCompact"
        class="player-info-main"
        :style="infoSwipeStyle"
        @pointerdown="onInfoPointerDown"
        @pointermove="onInfoPointerMove"
        @pointerup="onInfoPointerUp"
        @pointercancel="onInfoPointerCancel"
      >
        <div
          class="player-info-cover-stack"
          :class="{ 'is-cover-crossfading': isCoverCrossfading }"
          @pointerdown.stop="coverGesture.onPointerDown"
          @pointermove.stop="coverGesture.onPointerMove"
          @pointerup.stop="coverGesture.onPointerUp"
          @pointercancel.stop="coverGesture.onPointerCancel"
          @contextmenu.stop="coverGesture.onContextMenu"
        >
          <img class="player-info-cover player-info-cover-current" :src="currentCoverUrl" alt="" />
          <img
            v-if="isCoverCrossfading && transitionCoverUrl"
            class="player-info-cover player-info-cover-next"
            :src="transitionCoverUrl"
            alt=""
            aria-hidden="true"
          />
        </div>
        <div class="player-info-copy">
          <strong>{{ songTitle }}</strong>
          <span>{{ artistText }}</span>
        </div>
      </div>
      <div class="player-info-actions">
        <button
          type="button"
          class="player-info-action"
          :class="{ active: isFavorite }"
          aria-label="收藏歌曲"
          @click="handleFavorite"
        >
          <i :class="isFavorite ? 'ri-heart-3-fill' : 'ri-heart-3-line'" />
        </button>
        <button
          type="button"
          class="player-info-action"
          aria-label="播放设置"
          @click="handleShowSettings"
        >
          <i class="ri-more-2-fill" />
        </button>
      </div>
    </div>

    <!-- 进度条 -->
    <div class="progress-container">
      <div
        class="apple-style-progress"
        :class="{ scrubbing: isScrubbing }"
        data-no-lyrics-swipe
        @pointerdown="handleScrubPointerDown"
        @pointermove="handleScrubPointerMove"
        @pointerup="handleScrubPointerUp"
        @pointercancel="handleScrubPointerCancel"
        @mousemove="handleProgressHover"
        @mouseleave="handleProgressLeave"
      >
        <div class="progress-track">
          <div class="climax-track" v-if="styleEngine.climaxSegments.length > 0 && allTime > 0">
            <div
              v-for="(seg, i) in styleEngine.climaxSegments"
              :key="'cl-' + i"
              class="climax-segment"
              :class="{ 'climax-active': nowTime >= seg.start && nowTime <= seg.end }"
              :style="{
                left: (seg.start / allTime) * 100 + '%',
                width: Math.max(0.5, ((seg.end - seg.start) / allTime) * 100) + '%'
              }"
            ></div>
          </div>
          <!-- 上一首进度填充：crossfade 期间继续滑到尽头，结束后渐变为轨道色再隐藏 -->
          <div
            v-if="!transitionStore.isCrossfadingUI || !transitionStore.currentSongEnded"
            class="progress-fill"
            :class="{ 'fading-out': transitionStore.currentSongEnded }"
            :style="currentFillStyle"
          ></div>
          <!-- 下一首进度填充：crossfade 期间从左侧正常滑动 -->
          <div
            v-if="transitionStore.isCrossfadingUI"
            class="progress-fill-next"
            :style="nextFillStyle"
          ></div>
        </div>
      </div>
      <!-- 悬停预览：歌词行 + 时间（桌面端 pointer:fine 专属） -->
      <transition name="hover-tip-fade">
        <div
          v-if="showHoverTooltip && (hoverLyric || hoverTimeStr)"
          class="progress-hover-tooltip"
          :style="{ left: hoverLeft }"
        >
          <div v-if="hoverLyric" class="tooltip-lyric">{{ hoverLyric }}</div>
          <div class="tooltip-time">{{ hoverTimeStr }}</div>
        </div>
      </transition>
      <div class="time-info">
        <span class="current-time">{{ secondToMinute(displayNowTime) }}</span>
        <span v-if="isSongTransitioning" class="transition-status" aria-live="polite">
          智能过渡中
        </span>
        <span v-else-if="listenTips.length > 0" class="listen-together-status" aria-live="polite">{{
          listenTips[listenTipIndex % listenTips.length]
        }}</span>
        <span v-else class="transition-status-placeholder" aria-hidden="true"></span>
        <span class="total-time">{{ secondToMinute(allTime) }}</span>
      </div>
    </div>

    <!-- 控制按钮 -->
    <div class="control-buttons">
      <div class="side-button" @click="handleTogglePlayMode">
        <i :class="[playModeIcon, { 'intelligence-active': playMode === 3 }]"></i>
      </div>
      <div
        v-if="isLandscape"
        class="side-button"
        :class="{ 'queue-active': queueButtonActive }"
        aria-label="播放列表"
        @click="handleShowPlaylist"
      >
        <i class="iconfont icon-list"></i>
      </div>
      <div v-if="isLandscape" class="side-button" aria-label="播放设置" @click="handleShowSettings">
        <i class="ri-equalizer-3-line"></i>
      </div>
      <div class="main-button prev" @click="handlePrev">
        <i class="ri-skip-back-fill"></i>
      </div>
      <div class="main-button play-pause" @click="handleTogglePlay">
        <i :class="playIcon"></i>
      </div>
      <div class="main-button next" @click="handleNext">
        <i class="ri-skip-forward-fill"></i>
      </div>
      <div
        v-if="!isLandscape"
        class="side-button"
        :class="{ 'queue-active': queueButtonActive }"
        aria-label="播放列表"
        @click="handleShowPlaylist"
      >
        <i class="iconfont icon-list"></i>
      </div>
    </div>

    <!-- 信息栏克隆飞行层（AM）：从行矩形飞向顶栏槽位，落点前淡出交接给真顶栏 -->
    <div
      v-if="infoFlightVisible"
      class="info-flight-clone"
      :style="infoFlightStyle"
      aria-hidden="true"
    >
      <img class="info-flight-cover" :src="currentCoverUrl" alt="" />
      <div class="info-flight-copy">
        <strong>{{ songTitle }}</strong>
        <span>{{ artistText }}</span>
      </div>
    </div>
  </div>
  <cover-preview-modal
    v-model:visible="coverGesture.visible.value"
    :src="previewCoverUrl"
    :title="songTitle"
  />
</template>

<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import CoverPreviewModal from '@/components/player/CoverPreviewModal.vue';
import { useControlsDock } from '@/composables/useControlsDock';
import { useCoverPreviewGesture } from '@/composables/useCoverPreviewGesture';
import {
  decideImmersiveDragSettle,
  IMMERSIVE_HEADER_SLOT,
  immersiveSurfaceMode,
  prefersReducedMotion,
  readImmersiveSafeTop,
  requestImmersiveClose,
  requestImmersiveOpen,
  rubberbandClamp01,
  springTo,
  useImmersiveLyrics
} from '@/composables/useImmersiveLyrics';
import { usePlayerSurfaceFeedback } from '@/composables/usePlayerSurfaceFeedback';
import {
  allTime,
  artistList,
  getLyricTextAtTime,
  nowTime,
  pause,
  play,
  playMusic
} from '@/hooks/MusicHook';
import { usePlayMode } from '@/hooks/usePlayMode';
import { audioService } from '@/services/audioService';
import { useListenTogetherStore } from '@/store/modules/listenTogether';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { useTransitionStore } from '@/store/modules/transition';
import { getImgUrl, secondToMinute } from '@/utils';
import { parseRepresentativeCssColor } from '@/utils/playerInk';

const { t } = useI18n();

const transitionStore = useTransitionStore();
const listenTogetherStore = useListenTogetherStore();
const isSongTransitioning = computed(() => transitionStore.isCrossfadingUI);

// ==================== 一起听轮播提示 ====================

/** 每秒刷新一次，驱动“一起听了 XX:XX”计时文本 */
const listenedTick = ref(0);
let tipRotateTimer: ReturnType<typeof setInterval> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
const listenTipIndex = ref(0);

const otherMemberName = computed(() => {
  const others = (listenTogetherStore.members || []).filter(
    (m) => m.id !== listenTogetherStore.peerId && m.online
  );
  return others[0]?.name || listenTogetherStore.hostName || '';
});

const listenedDurationText = computed(() => {
  void listenedTick.value; // 依赖 tick 触发重算
  const started = listenTogetherStore.sessionStartedAt || 0;
  if (!started) return '';
  const totalSec = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
});

const listenTips = computed<string[]>(() => {
  if (listenTogetherStore.status !== 'active') return [];
  const name = otherMemberName.value;
  const tips: string[] = [];
  if (name) {
    tips.push(t('listenTogether.tip.listening', { name }));
  }
  const dur = listenedDurationText.value;
  if (dur) {
    tips.push(t('listenTogether.tip.duration', { time: dur }));
  }
  return tips;
});

onMounted(() => {
  // 4s 轮播切换提示文案
  tipRotateTimer = setInterval(() => {
    listenTipIndex.value += 1;
  }, 4_000);
  // 1s 刷新“一起听了”计时
  tickTimer = setInterval(() => {
    listenedTick.value += 1;
  }, 1_000);
});

onBeforeUnmount(() => {
  if (tipRotateTimer) clearInterval(tipRotateTimer);
  if (tickTimer) clearInterval(tickTimer);
});
const isCoverCrossfading = computed(
  () => isSongTransitioning.value && transitionStore.currentSongEnded
);
const transitionColor = (value: string, fallback: string) => {
  const parsed = parseRepresentativeCssColor(value);
  return parsed ? `rgb(${parsed.r}, ${parsed.g}, ${parsed.b})` : fallback;
};
const transitionStyles = computed(() => ({
  '--song-current-accent': transitionStore.currentAccentColor || '#ffffff',
  '--song-current-background': transitionColor(transitionStore.currentBackgroundColor, '#171717'),
  '--song-next-accent': transitionStore.nextAccentColor || '#ffffff',
  '--song-next-background': transitionColor(transitionStore.nextBackgroundColor, '#171717'),
  '--song-transition-duration': `${Math.max(0.2, transitionStore.duration || 8)}s`
}));

// ==================== Crossfade 进度条动画 ====================

/** 上一首进度填充样式：正常显示 nowTime/allTime */
const displayNowTime = computed(() => dragPreviewTime.value ?? nowTime.value);

const currentFillStyle = computed(() => {
  return { width: `${(displayNowTime.value / Math.max(1, allTime.value)) * 100}%` };
});

/** 下一首进度填充样式：使用 nextAccentColor，宽度跟随 nextProgress */
const nextFillStyle = computed(() => {
  const color = transitionStore.nextAccentColor || '#ffffff';
  return {
    width: `${transitionStore.nextProgress}%`,
    boxShadow: `0 0 8px ${color}80`
  };
});

const props = defineProps<{
  visible?: boolean;
  isFullscreen?: boolean;
  sharedSurface?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  showPlaylist: [];
  showSettings: [];
  interact: [];
}>();

const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const playerSurfaceFeedback = usePlayerSurfaceFeedback();
const { playMode, playModeIcon, togglePlayMode } = usePlayMode();

const rootRef = ref<HTMLElement | null>(null);

// ==================== 横屏横条 + 下移贴底 ====================

const isLandscape = useMediaQuery('(orientation: landscape)');

const controlsPinned = ref(false);
// default 样式(仅共享底面):歌曲信息只保留大封面下方一处,信息行收成收藏/更多按钮行
const defaultStyleCompact = ref(false);
const refreshPinned = () => {
  try {
    const raw = localStorage.getItem('music-full-config');
    const cfg = raw ? JSON.parse(raw) : {};
    controlsPinned.value = cfg.alwaysShowPlayerControls === true;
    defaultStyleCompact.value =
      props.sharedSurface === true && (cfg.playerStyle || 'default') === 'default';
  } catch {
    controlsPinned.value = false;
  }
};
window.addEventListener('music-full-config-updated', refreshPinned);
refreshPinned();
onBeforeUnmount(() => {
  window.removeEventListener('music-full-config-updated', refreshPinned);
});

const progressBarEl = () =>
  rootRef.value?.querySelector<HTMLElement>('.apple-style-progress') || null;

const { dockStyle, dockActive, scheduleMeasure } = useControlsDock(progressBarEl, {
  hidden: () => !props?.visible,
  // sharedSurface（default 样式共享容器）由 BottomSurface 做容器级 dock，
  // 自身再 dock 会双重位移且互相干扰测量（收起面板后控件悬空）
  enabled: () => !controlsPinned.value && !props.sharedSurface
});

watch(
  () => props?.visible,
  (visible) => {
    if (visible) scheduleMeasure();
  }
);

/** dock 状态下容器仍有进度条露在屏幕内，点击任意处唤回完整控件 */
function handleSurfaceTap(event: MouseEvent) {
  event.stopPropagation();
  if (dockActive.value) emitInteract();
}

const playState = computed(() => playerStore.isPlay);
const playIcon = computed(() => (playState.value ? 'ri-pause-fill' : 'ri-play-fill'));
const songTitle = computed(() => playMusic.value?.name || 'Zephyrus');
const artistText = computed(() => artistList.value.map((artist) => artist.name).join(' / '));
const currentCoverUrl = computed(() =>
  getImgUrl(
    transitionStore.currentCoverUrl || playMusic.value?.picUrl || '/images/default_cover.png',
    '100y100'
  )
);
const previewCoverUrl = computed(
  () => transitionStore.currentCoverUrl || playMusic.value?.picUrl || '/images/default_cover.png'
);
const coverGesture = useCoverPreviewGesture(previewCoverUrl);
const transitionCoverUrl = computed(() =>
  transitionStore.nextCoverUrl ? getImgUrl(transitionStore.nextCoverUrl, '100y100') : ''
);
const isFavorite = computed(() =>
  playerStore.favoriteList.some((id) => String(id) === String(playMusic.value?.id))
);

// 播放控制（使用 MusicHook 直接控制音频）
function handleTogglePlay() {
  if (playState.value) {
    pause();
  } else {
    play();
  }
  emitInteract();
}

function handlePrev() {
  playerStore.prevPlay();
  emitInteract();
}

function handleNext() {
  playerStore.nextPlay();
  emitInteract();
}

// —— 歌曲封面与信息横滑切歌：与迷你播放栏同款手势（轴判定/阻尼/投影速度阈值一致） ——
const infoSwipeOffset = ref(0);
const infoSwipeAnimating = ref(false);
const infoSwipeSwitching = ref(false);
let infoPointerId: number | null = null;
let infoStartX = 0;
let infoStartY = 0;
let infoStartTime = 0;
let infoAxis: 'none' | 'horizontal' | 'vertical' = 'none';
let infoSwipeTimer: number | undefined;

const getInfoSwipeLimit = () => Math.min(36, Math.max(28, window.innerWidth * 0.085));
const infoSwipeProgress = computed(() =>
  Math.min(Math.abs(infoSwipeOffset.value) / getInfoSwipeLimit(), 1)
);
const infoSwipeStyle = computed(() => ({
  transform: `translate3d(${infoSwipeOffset.value}px, 0, 0) scale(${1 - infoSwipeProgress.value * 0.012})`,
  opacity: String(1 - infoSwipeProgress.value * 0.12),
  transition: infoSwipeAnimating.value
    ? 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease'
    : 'none'
}));

const finishInfoSwipeAnimation = () => {
  infoSwipeAnimating.value = true;
  infoSwipeOffset.value = 0;
  if (infoSwipeTimer) window.clearTimeout(infoSwipeTimer);
  infoSwipeTimer = window.setTimeout(() => {
    infoSwipeAnimating.value = false;
    infoSwipeSwitching.value = false;
    infoAxis = 'none';
    infoSwipeTimer = undefined;
  }, 280);
};

const switchTrackWithAnimation = (direction: 'left' | 'right') => {
  infoSwipeSwitching.value = true;
  infoSwipeAnimating.value = true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (direction === 'left') handleNext();
    else handlePrev();
    finishInfoSwipeAnimation();
    return;
  }
  const travel = Math.min(getInfoSwipeLimit() * 1.2, 44);
  const exitOffset = direction === 'left' ? -travel : travel;
  infoSwipeOffset.value = exitOffset;
  if (infoSwipeTimer) window.clearTimeout(infoSwipeTimer);
  infoSwipeTimer = window.setTimeout(() => {
    if (direction === 'left') handleNext();
    else handlePrev();
    infoSwipeAnimating.value = false;
    infoSwipeOffset.value = -exitOffset * 0.42;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => finishInfoSwipeAnimation());
    });
  }, 150);
};

const releaseInfoPointer = (event: PointerEvent) => {
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  infoPointerId = null;
};

const onInfoPointerDown = (event: PointerEvent) => {
  if (!event.isPrimary || infoPointerId !== null) return;
  infoPointerId = event.pointerId;
  infoStartX = event.clientX;
  infoStartY = event.clientY;
  infoStartTime = Date.now();
  infoAxis = 'none';
  // 上拉唤起手势与横滑切歌共用指针，按轴分工（vertical → rise）
  riseCancelSpring?.();
  riseCancelSpring = null;
  riseGestureDriving.value = false;
  riseLastY = event.clientY;
  riseSamples = [];
};

const onInfoPointerMove = (event: PointerEvent) => {
  if (infoPointerId !== event.pointerId || infoSwipeSwitching.value) return;
  const deltaX = event.clientX - infoStartX;
  const deltaY = event.clientY - infoStartY;
  if (infoAxis === 'none' && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 8) {
    infoAxis = Math.abs(deltaX) > Math.abs(deltaY) * 1.08 ? 'horizontal' : 'vertical';
  }
  if (infoAxis === 'vertical') {
    onInfoRiseMove(event);
    return;
  }
  if (infoAxis !== 'horizontal') return;
  if (!(event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  event.preventDefault();
  const maxDrag = getInfoSwipeLimit();
  infoSwipeOffset.value = maxDrag * Math.tanh(deltaX / maxDrag);
};

const onInfoPointerUp = (event: PointerEvent) => {
  if (infoPointerId !== event.pointerId) return;
  const wasRise = riseGestureDriving.value;
  const deltaX = event.clientX - infoStartX;
  const elapsed = Math.max(1, Date.now() - infoStartTime);
  const projectedX = deltaX + (deltaX / elapsed) * 110;
  const swipeLimit = getInfoSwipeLimit();
  const commitThreshold = Math.min(40, Math.max(32, swipeLimit));
  const projectedThreshold = Math.min(58, Math.max(48, swipeLimit * 1.45));
  const commit =
    !wasRise &&
    infoAxis === 'horizontal' &&
    (Math.abs(deltaX) >= commitThreshold || Math.abs(projectedX) >= projectedThreshold);
  releaseInfoPointer(event);
  if (wasRise) {
    settleImmersiveRise(false);
    return;
  }
  if (commit) switchTrackWithAnimation(deltaX < 0 ? 'left' : 'right');
  else finishInfoSwipeAnimation();
};

const onInfoPointerCancel = (event: PointerEvent) => {
  if (infoPointerId !== event.pointerId) return;
  releaseInfoPointer(event);
  if (riseGestureDriving.value) {
    settleImmersiveRise(true);
    return;
  }
  finishInfoSwipeAnimation();
};

// ── 信息栏上下拖拽 显隐歌词区（其他样式；进度写入 useImmersiveLyrics 单一真值）──
// 双向跟手：关闭态上拖=升起预览，打开态下拖=下沉预览；中途反转直接重跟踪（§3）。
// 打开态信息栏保持可见（见 immersiveRowStyle），是下拖关闭的把手。
const immersive = useImmersiveLyrics();
const riseGestureDriving = ref(false);
let riseCancelSpring: (() => void) | null = null;
let riseLastY = 0;
let riseSamples: { y: number; time: number }[] = [];

const riseDistance = () => Math.max(180, Math.min(280, window.innerHeight * 0.28));

const canDragLyricsSurface = () =>
  props.sharedSurface === true &&
  !defaultStyleCompact.value &&
  !playerStore.fullCommentsVisible &&
  immersiveSurfaceMode.value === 'lyrics' &&
  !playerStore.fullLyricsVisible &&
  immersive.progress.value <= 0.01;

function riseVelocity(): number {
  if (riseSamples.length < 2) return 0;
  const last = riseSamples[riseSamples.length - 1];
  const first = riseSamples.find((s) => last.time - s.time <= 90) || riseSamples[0];
  return ((first.y - last.y) / Math.max(1, last.time - first.time)) * 1000;
}

function onInfoRiseMove(event: PointerEvent) {
  // 门槛只作首次激活判定——每次 move 重查会让起步几像素后的状态把后续拖拽拒掉
  if (!riseGestureDriving.value) {
    if (!canDragLyricsSurface()) return;
    riseGestureDriving.value = true;
    immersive.variant.value = 'rise';
    // 拖拽期间钉住控件栏（信息栏随控件栏显隐，3s 自动隐藏不能掐断拖拽）
    emitInteract();
  }
  const target = event.currentTarget as HTMLElement;
  if (!target.hasPointerCapture(event.pointerId)) {
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      /* 老内核可能不支持，忽略 */
    }
  }
  event.preventDefault();
  riseSamples.push({ y: event.clientY, time: event.timeStamp || performance.now() });
  if (riseSamples.length > 6) riseSamples.shift();
  const step = riseLastY - event.clientY;
  riseLastY = event.clientY;
  if (step === 0) return;
  // 双向 1:1 跟手，两端 rubber-band（§9）——负值不再累积成死行程
  immersive.progress.value = rubberbandClamp01(
    immersive.progress.value + step / riseDistance()
  );
}

/** 松手：按动量投影决定提交方向，速度交接给弹簧（§5/§6/§7 打开与关闭镜像对称） */
function settleImmersiveRise(cancelled: boolean) {
  riseGestureDriving.value = false;
  const wasOpen = playerStore.fullLyricsVisible;
  const start = immersive.progress.value;
  const velocity = (cancelled ? 0 : riseVelocity()) / riseDistance();
  const target = decideImmersiveDragSettle({
    progress: start,
    velocity,
    isOpen: wasOpen,
    cancelled,
    commitVelocity: 620 / riseDistance()
  });
  const finish = () => {
    riseCancelSpring = null;
    if (target === 1 && !wasOpen) {
      // opener 缺失（重挂竞态等）：回弹归零，避免停在半开状态
      if (requestImmersiveOpen()) return;
      if (prefersReducedMotion()) {
        immersive.progress.value = 0;
        return;
      }
      springTo(
        (value) => {
          immersive.progress.value = value;
        },
        immersive.progress.value,
        0,
        0
      );
      return;
    }
    if (target === 0 && wasOpen) requestImmersiveClose();
  };
  if (prefersReducedMotion()) {
    immersive.progress.value = target;
    finish();
    return;
  }
  riseCancelSpring = springTo(
    (value) => {
      immersive.progress.value = value;
    },
    start,
    target,
    velocity,
    finish
  );
}

/** 底栏列表钮高亮：沉浸页内容区正展示播放列表面板时 */
const queueButtonActive = computed(
  () => playerStore.fullLyricsVisible && immersiveSurfaceMode.value === 'playlist'
);

/**
 * 信息栏让位（AppleMusic）：激活/展开即整行隐藏，由克隆飞行层接管位移；
 * 展开后下拖关闭的把手是顶部沉浸栏（useStyleImmersiveHeaderCollapse）。
 */
const immersiveRowStyle = computed(() => {
  const p = immersive.progress.value;
  if (p <= 0.001) return undefined;
  return {
    opacity: '0',
    transition: 'none',
    pointerEvents: 'none'
  } as Record<string, string>;
});

// ── 信息栏克隆飞行（AM）：整行内容从行矩形飞向顶栏槽位，落点前交叉给真顶栏 ──
const infoRowRef = ref<HTMLElement | null>(null);
interface InfoFlightRects {
  source: { left: number; top: number; width: number; height: number };
  targetTop: number;
}
const infoFlightRects = ref<InfoFlightRects | null>(null);

function captureInfoFlightRects() {
  if (!infoRowRef.value) {
    infoFlightRects.value = null;
    return;
  }
  const rect = infoRowRef.value.getBoundingClientRect();
  if (rect.width < 80 || rect.height < 24) {
    infoFlightRects.value = null;
    return;
  }
  infoFlightRects.value = {
    source: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    targetTop: readImmersiveSafeTop() + IMMERSIVE_HEADER_SLOT.topInset
  };
}

// rise 驱动期间保持矩形；完全关闭后清理
watch(
  () => immersive.progress.value,
  (p) => {
    if (immersive.variant.value !== 'rise') return;
    if (p > 0.001 && !infoFlightRects.value) captureInfoFlightRects();
    if (p <= 0.001) infoFlightRects.value = null;
  }
);

const infoFlightVisible = computed(
  () =>
    !!infoFlightRects.value &&
    immersive.variant.value === 'rise' &&
    immersive.progress.value > 0.001 &&
    immersive.progress.value < 0.999
);

const infoFlightStyle = computed<Record<string, string>>(() => {
  const rects = infoFlightRects.value;
  if (!rects) return {} as Record<string, string>;
  const p = Math.max(0, Math.min(1, immersive.progress.value));
  const lerp = (a: number, b: number) => a + (b - a) * p;
  const targetLeft = IMMERSIVE_HEADER_SLOT.inset;
  const targetWidth = Math.max(240, window.innerWidth - IMMERSIVE_HEADER_SLOT.inset * 2);
  return {
    position: 'fixed',
    left: `${lerp(rects.source.left, targetLeft).toFixed(2)}px`,
    top: `${lerp(rects.source.top, rects.targetTop).toFixed(2)}px`,
    width: `${lerp(rects.source.width, targetWidth).toFixed(2)}px`,
    height: `${lerp(rects.source.height, IMMERSIVE_HEADER_SLOT.size + 4).toFixed(2)}px`,
    opacity: (1 - Math.max(0, Math.min(1, (p - 0.85) / 0.15))).toFixed(3),
    zIndex: '60',
    pointerEvents: 'none',
    transform: 'translateZ(0)',
    transition: 'none'
  };
});

onBeforeUnmount(() => {
  if (infoSwipeTimer) window.clearTimeout(infoSwipeTimer);
  riseCancelSpring?.();
  riseCancelSpring = null;
});

function handleTogglePlayMode() {
  togglePlayMode();
  emitInteract();
}

function handleShowPlaylist() {
  playerSurfaceFeedback.pulse();
  emit('showPlaylist');
}

async function handleFavorite() {
  const id = playMusic.value?.id;
  if (id === undefined || id === null) return;
  if (isFavorite.value) await playerStore.removeFromFavorite(id);
  else await playerStore.addToFavorite(id);
  emitInteract();
}

function handleShowSettings() {
  playerSurfaceFeedback.pulse();
  emit('showSettings');
}

function emitInteract() {
  playerSurfaceFeedback.pulse();
  emit('interact');
}

// ==================== 进度条交互 ====================
// 无圆点设计：条本体即拖柄——pointerdown 直接进入跟手拖动（不再区分 click/drag，
// 也不会出现「想拖动却被判定为点击而跳转进度」）。指针捕获保证拖出条外仍跟手。
const isScrubbing = ref(false);
const dragPreviewTime = ref<number | null>(null);
let scrubPointerId = -1;

// ==================== 进度条悬停预览（桌面端 pointer:fine 专属） ====================
const isPointerFine = window.matchMedia?.('(pointer: fine)').matches ?? false;
const showHoverTooltip = ref(false);
const hoverLyric = ref<string | null>(null);
const hoverTimeStr = ref('');
const hoverLeft = ref('50%');

const handleProgressHover = (e: MouseEvent) => {
  if (!isPointerFine || isScrubbing.value || allTime.value <= 0) return;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const timeSec = percent * allTime.value;
  hoverTimeStr.value = secondToMinute(timeSec);
  hoverLyric.value = getLyricTextAtTime(timeSec);
  // 左右钳制，避免 tooltip 溢出屏幕
  hoverLeft.value = `${Math.min(88, Math.max(12, percent * 100))}%`;
  showHoverTooltip.value = true;
};

const handleProgressLeave = () => {
  showHoverTooltip.value = false;
};

const getSeekTime = (clientX: number, target: HTMLElement): number | null => {
  const rect = target.closest('.apple-style-progress')?.getBoundingClientRect();
  if (!rect) return null;
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return ratio * allTime.value;
};

const commitSeek = (time: number | null) => {
  if (time === null) return;
  audioService.seek(time);
  emitInteract();
};

const handleScrubPointerDown = (e: PointerEvent) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (allTime.value <= 0) return;
  isScrubbing.value = true;
  showHoverTooltip.value = false;
  scrubPointerId = e.pointerId;
  const bar = e.currentTarget as HTMLElement;
  try {
    bar.setPointerCapture(e.pointerId);
  } catch {
    /* 老内核可能不支持 */
  }
  dragPreviewTime.value = getSeekTime(e.clientX, bar);
  emitInteract();
};

const handleScrubPointerMove = (e: PointerEvent) => {
  if (!isScrubbing.value || e.pointerId !== scrubPointerId) return;
  dragPreviewTime.value = getSeekTime(e.clientX, e.currentTarget as HTMLElement);
};

const handleScrubPointerUp = (e: PointerEvent) => {
  if (e.pointerId !== scrubPointerId) return;
  commitSeek(dragPreviewTime.value);
  isScrubbing.value = false;
  scrubPointerId = -1;
  dragPreviewTime.value = null;
};

const handleScrubPointerCancel = (e: PointerEvent) => {
  if (e.pointerId !== scrubPointerId) return;
  isScrubbing.value = false;
  scrubPointerId = -1;
  dragPreviewTime.value = null;
};
</script>

<style scoped lang="scss">
.mobile-controls {
  position: absolute;
  bottom: 0;
  left: 14px;
  right: 14px;
  z-index: 30;
  padding: 14px 16px calc(var(--safe-area-inset-bottom, 0px) + 16px);
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  /* 无毛玻璃底后保证浅色背景上的可读性 */
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35);
  opacity: 0;
  transition:
    opacity 0.3s ease,
    border-color var(--player-glass-feedback-duration, 220ms) ease,
    background-color var(--player-glass-feedback-duration, 220ms) ease,
    box-shadow var(--player-glass-feedback-duration, 220ms) ease;
  pointer-events: none;

  &.surface-interaction-active {
    background: transparent;
    box-shadow: none;
  }

  &.visible {
    opacity: 1;
    pointer-events: auto;
  }

  /* 下移贴底状态：不再淡出，进度条保持可见（样式组件内嵌路径） */
  &.docked {
    opacity: 1;
    pointer-events: auto;
  }

  /* 横屏横条：进度条横贯顶部，下方一行 = 信息区 + 控制按钮 */
  &.landscape-mode {
    display: grid;
    grid-template-areas:
      'progress progress'
      'info actions';
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 14px;
    row-gap: 10px;
    padding: 12px 14px calc(var(--safe-area-inset-bottom, 0px) + 10px);

    &:not(.shared-surface-content) {
      left: 12px;
      right: 12px;
      border: 1px solid rgba(var(--player-ink-rgb, 255, 255, 255), 0.1);
      border-radius: 18px;
    }

    .progress-container {
      grid-area: progress;
      margin-bottom: 0;
    }

    .time-info {
      display: none;
    }

    .player-info-row {
      grid-area: info;
      margin-bottom: 0;
      min-height: 44px;

      .player-info-actions {
        display: none;
      }
    }

    .control-buttons {
      grid-area: actions;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
    }
  }

  &.fullscreen-mode {
    padding-bottom: calc(var(--safe-area-inset-bottom, 0px) + 18px);
  }

  &.shared-surface-content {
    position: relative;
    inset: auto;
    width: 100%;
    padding: 12px 16px 14px;
    border: 0;
    border-radius: inherit;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

.player-info-row,
.progress-container,
.control-buttons {
  /* 控制面内容随整层统一揭示(单一纯淡入窗口,无位移/无分段接力) */
  opacity: clamp(0, calc((var(--player-open-progress, 1) - 0.3) * 2.5), 1);
}

.player-info-row {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  /* 竖直上拉唤起沉浸歌词：阻止浏览器把手势判给滚动 */
  touch-action: none;
}

/* 信息栏克隆飞行层（AM）：位置/尺寸由内联样式逐帧驱动 */
.info-flight-clone {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
}

.info-flight-cover {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
  flex: none;
}

.info-flight-copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.info-flight-copy strong {
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-flight-copy span {
  overflow: hidden;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.62);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* default 样式共享底面:去掉信息主体后整行右对齐收窄,只留收藏/更多 */
.player-info-row.info-compact {
  justify-content: flex-end;
  min-height: 36px;
  margin-bottom: 6px;
}

.player-info-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  /* 横滑切歌手势由指针事件接管，禁用浏览器横向默认行为 */
  touch-action: pan-y;
  will-change: transform;
}

.player-info-cover-stack {
  position: relative;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  overflow: hidden;
  border-radius: 10px;
  isolation: isolate;
}

.player-info-cover {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.player-info-cover-current {
  z-index: 0;
}

.player-info-cover-next {
  z-index: 1;
  opacity: 0;
  will-change: opacity;
}

.player-info-cover-stack.is-cover-crossfading .player-info-cover-next {
  animation: song-cover-crossfade 280ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
}

@keyframes song-cover-crossfade {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes song-progress-color-cycle {
  0%,
  100% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }
}

@keyframes transition-status-shiny {
  from {
    background-position: 220% 0;
  }

  to {
    background-position: -40% 0;
  }
}

.player-info-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
  text-align: left;
}

.player-info-copy strong,
.player-info-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-info-copy strong {
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.96);
  font-size: 16px;
  font-weight: 700;
  transition: color 180ms ease;
}

.player-info-copy span {
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.64);
  font-size: 12px;
  transition: color 180ms ease;
}

.player-info-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
}

.player-info-action {
  display: grid;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.78);
  font-size: 20px;
  place-items: center;
}

.player-info-action.active {
  color: var(--accent-color, #fff);
}

.player-info-action:active {
  transform: scale(0.9);
}

.progress-container {
  position: relative;
  margin-bottom: 10px;
}

/* 进度条悬停预览 tooltip（桌面端 pointer:fine 专属） */
.progress-hover-tooltip {
  position: absolute;
  bottom: calc(100% + 12px);
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  max-width: min(60vw, 420px);
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.78);
  color: #fff;
  pointer-events: none;
  white-space: nowrap;

  .tooltip-lyric {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12px;
    line-height: 1.4;
    opacity: 0.92;
  }

  .tooltip-time {
    font-size: 11px;
    line-height: 1.2;
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
  }
}

.hover-tip-fade-enter-active,
.hover-tip-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.hover-tip-fade-enter-from,
.hover-tip-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}

.time-info {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  opacity: 0.6;
  margin-top: 8px;
}

.total-time {
  justify-self: end;
}

.transition-status,
.listen-together-status,
.transition-status-placeholder {
  position: relative;
  min-width: 76px;
  height: 18px;
  overflow: hidden;
  text-align: center;
}

.transition-status,
.listen-together-status {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0;
  white-space: nowrap;
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.82);
  background-image: linear-gradient(
    110deg,
    rgba(var(--player-ink-rgb, 255, 255, 255), 0.42) 0%,
    rgba(var(--player-ink-rgb, 255, 255, 255), 0.78) 38%,
    rgba(255, 255, 255, 0.98) 50%,
    rgba(var(--player-ink-rgb, 255, 255, 255), 0.78) 62%,
    rgba(var(--player-ink-rgb, 255, 255, 255), 0.42) 100%
  );
  background-size: 220% 100%;
  background-position: 220% 0;
  background-repeat: no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: transition-status-shiny 1.35s linear infinite;
}

.apple-style-progress {
  position: relative;
  height: 6px;
  background: rgba(var(--player-ink-rgb, 255, 255, 255), 0.15);
  border-radius: 3px;
  cursor: pointer;
  /* 无圆点设计：条本体即拖柄，触摸拖动期间不允许滚动手势接管指针 */
  touch-action: none;
  /* 拖动微动效：按下即放大变亮（apple-design §1 反馈在 pointer-down），
     只动 transform/背景色，居中origin对称增厚；放大走弹性曲线（带过冲） */
  transform-origin: 50% 50%;
  transition:
    transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.apple-style-progress.scrubbing {
  transform: scaleY(1.5);
  background-color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.3);
}

.apple-style-progress.scrubbing .progress-fill {
  filter: brightness(1.18);
}

.progress-track {
  position: relative;
  width: 100%;
  height: 100%;
}

.progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--accent-color, #fff);
  border-radius: 3px;
  transition:
    width 0.1s linear,
    filter 200ms cubic-bezier(0.32, 0.72, 0, 1);
  z-index: 1;

  /* 上一首播放到尽头后：主体色渐变为轨道背景色，然后隐藏 */
  &.fading-out {
    background: rgba(var(--player-ink-rgb, 255, 255, 255), 0.15) !important;
    box-shadow: none;
    transition:
      background 0.6s ease,
      box-shadow 0.6s ease;
  }
}

.progress-fill-next {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-radius: 3px;
  z-index: 1;
  pointer-events: none;
  transition: width 0.1s linear;
}

.song-transitioning .progress-fill,
.song-transitioning .progress-fill-next {
  background: linear-gradient(
    90deg,
    var(--song-current-accent, #ffffff),
    var(--song-next-background, #171717),
    var(--song-next-accent, #ffffff),
    var(--song-current-background, #171717),
    var(--song-current-accent, #ffffff)
  );
  background-size: 300% 100%;
  will-change: background-position;
  animation: song-progress-color-cycle 1.8s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .transition-status,
  .listen-together-status {
    background-image: none;
    background-position: 50% 0;
    color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.82);
    -webkit-text-fill-color: currentColor;
  }

  .transition-status,
  .listen-together-status,
  .song-transitioning .progress-fill,
  .song-transitioning .progress-fill-next {
    animation: none;
  }
}

.climax-track {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.climax-segment {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(255, 200, 50, 0.35);
  border-radius: 3px;

  &.climax-active {
    background: rgba(255, 200, 50, 0.7);
  }
}

.control-buttons {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: center;
  justify-items: center;
  gap: 0;
  width: 100%;
}

.side-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 20px;
  color: var(--text-color-active, #fff);
  opacity: 0.7;

  /* 沉浸页内容区正展示播放列表面板时的高亮态 */
  &.queue-active {
    background: rgba(var(--player-ink-rgb, 255, 255, 255), 0.16);
    opacity: 1;
  }

  &:active {
    opacity: 1;
  }
}

.main-button {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease;
  border-radius: 50%;

  i {
    font-size: 28px;
    color: var(--text-color-active, #fff);
  }

  &.play-pause i {
    font-size: 40px;
  }

  &:active {
    transform: scale(1.1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-controls {
    transition-duration: 100ms;
  }

  /* 拖动反馈降级：保留变亮（非前庭），去掉缩放 */
  .apple-style-progress {
    transition: background-color 200ms ease;
  }

  .apple-style-progress.scrubbing {
    transform: none;
  }
}
</style>
