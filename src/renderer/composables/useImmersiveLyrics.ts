import { computed, type CSSProperties, onUnmounted, type Ref, ref } from 'vue';

import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { usePlayerStore } from '@/store/modules/player';
import {
  decideImmersiveDragSettle,
  prefersReducedMotion,
  projectMomentum,
  rubberbandClamp01,
  springTo
} from '@/utils/immersiveMotion';

export {
  decideImmersiveDragSettle,
  prefersReducedMotion,
  projectMomentum,
  rubberbandClamp01,
  springTo
};

export type ImmersiveVariant = 'slide' | 'scale' | 'rise';
export type ImmersiveSurfaceMode = 'lyrics' | 'settings' | 'playlist';

/** 沉浸顶栏槽位（克隆飞行落点）：与 .immersive-header-wrap 的 padding 严格一致 */
export const IMMERSIVE_HEADER_SLOT = { inset: 20, size: 44, radius: 10, topInset: 66 };

const progress = ref(0);
const variant = ref<ImmersiveVariant>('slide');
/** 沉浸页内容区：顶栏「更多」/底部「播放列表/评论区」在沉浸态改为就地替换歌词区（切换型） */
export const immersiveSurfaceMode = ref<ImmersiveSurfaceMode>('lyrics');

const active = computed(() => progress.value > 0.001);

type ImmersiveOpener = () => void;
let opener: ImmersiveOpener | null = null;

export function registerImmersiveOpener(fn: ImmersiveOpener | null): void {
  opener = fn;
}

/** 身份注销：仅当当前注册者仍是 fn 才清空（防 renderKey 重挂「先挂新后卸旧」竞态清掉新 opener） */
export function unregisterImmersiveOpener(fn: ImmersiveOpener): void {
  if (opener === fn) opener = null;
}

export function requestImmersiveOpen(): boolean {
  if (!opener) return false;
  opener();
  return true;
}

/** 沉浸关闭分发（镜像 opener）：信息栏下拖提交关闭时由共享层调用，
    由当前挂载样式组件注册的 closer 复位状态——免去逐宿主 emit 接线 */
let closer: (() => void) | null = null;

export function registerImmersiveCloser(fn: () => void): void {
  closer = fn;
}

export function unregisterImmersiveCloser(fn: () => void): void {
  if (closer === fn) closer = null;
}

export function requestImmersiveClose(): boolean {
  if (!closer) return false;
  closer();
  return true;
}

export function resetImmersiveLyrics(): void {
  progress.value = 0;
  variant.value = 'slide';
  immersiveSurfaceMode.value = 'lyrics';
}

export function useImmersiveLyrics() {
  ensureImmersiveCloseSync();
  return { progress, variant, active, immersiveSurfaceMode };
}

/** 沉浸页内容区切换：再点同一模式即回歌词（按钮为切换型） */
export function toggleImmersiveSurface(mode: Exclude<ImmersiveSurfaceMode, 'lyrics'>): void {
  immersiveSurfaceMode.value = immersiveSurfaceMode.value === mode ? 'lyrics' : mode;
}

// ── 沉浸关闭时内容区复位 ──
// 注意：播放列表面板的可见性走 PlayingListDrawer 的 forceVisible prop，
// 与 playListDrawerVisible 旗标彻底解耦——此前同步旗标会触发旧抽屉语义
// （打开抽屉→播放器收起为迷你条）并经由 BottomSurface 的 watch 翻回模式。
let immersiveCloseSyncRegistered = false;
function ensureImmersiveCloseSync(): void {
  if (immersiveCloseSyncRegistered || typeof window === 'undefined') return;
  immersiveCloseSyncRegistered = true;
  watch(
    () => usePlayerStore().fullLyricsVisible,
    (visible) => {
      if (!visible && immersiveSurfaceMode.value !== 'lyrics') {
        immersiveSurfaceMode.value = 'lyrics';
      }
    }
  );
  // 队列面板展开期间钉住控件栏：进入时确保常显并清掉在途的 3s 隐藏定时器，
  // 离开时重新武装自动隐藏（hideControls/resetControlsHideTimer 内也有同源守卫兜底）
  watch(immersiveSurfaceMode, (mode, prev) => {
    const transition = useMobilePlayerTransition();
    if (mode === 'playlist' && prev !== 'playlist') {
      transition.showControls(false);
      return;
    }
    if (prev === 'playlist' && mode !== 'playlist') {
      transition.resetControlsHideTimer();
    }
  });
}

/** 顶栏槽位的绝对顶端（安全区 + 让位高度），克隆飞行落点用；取不到时回退 0 */
export function readImmersiveSafeTop(): number {
  if (typeof window === 'undefined') return 0;
  const scopes = [document.getElementById('layout-main'), document.documentElement];
  for (const scope of scopes) {
    if (!scope) continue;
    const raw = getComputedStyle(scope).getPropertyValue('--safe-area-inset-top').trim();
    const value = parseFloat(raw);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

/**
 * 播放器样式组件的沉浸歌词接入（8 个彩色样式共用）：
 * 注册 rise 打开回调（信息栏上拉手势经 requestImmersiveOpen 调用，仅 AppleMusic 方案）、
 * 提供 rise 变体的覆盖层样式与关闭分发（横滑路径保持原状）。
 */
export function useStyleImmersiveLyrics(options: {
  showFullLyrics: Ref<boolean>;
  /** 横滑路径的程序化打开（useLyricSwipeGesture.animateOpen） */
  openAnimated: () => void;
  /** 横滑预览进行中（宿主传入歌词横滑手势的 previewing）：
      rise 样式在其期间让位，否则 rise 打开后横滑关闭的位移预览会被压成无动画瞬消 */
  swipePreviewing?: () => boolean;
}) {
  const immersive = useImmersiveLyrics();
  const playerStore = usePlayerStore();

  const riseStyleAllowed = computed(
    () =>
      immersive.variant.value === 'rise' &&
      immersive.progress.value > 0.001 &&
      !(options.swipePreviewing?.() ?? false)
  );
  const risePreviewing = computed(() => riseStyleAllowed.value);
  const immersiveProgress = computed(() => immersive.progress.value);

  /**
   * rise 变体：歌词覆盖层从中间显现（缩放 + 上浮 + 淡入），下沉关闭复用同一进度。
   * progress≈0 时必须回退 undefined 走横滑样式——否则 rise 用过一次后
   * variant 残留，横滑预览会被 opacity 0 的 rise 样式压成空白。
   */
  const riseOverlayStyle = computed<CSSProperties | undefined>(() => {
    if (!riseStyleAllowed.value) return undefined;
    const p = immersive.progress.value;
    return {
      opacity: String(p),
      transform: `scale(${(0.92 + 0.08 * p).toFixed(4)}) translate3d(0, ${((1 - p) * 24).toFixed(2)}px, 0)`,
      transformOrigin: '50% 60%',
      transition: 'none',
      willChange: 'transform, opacity'
    };
  });

  /** rise 变体的背景遮罩：与横滑 backdropStyle 同为 0.82 封顶；同样带 progress 守卫 */
  const riseMaskStyle = computed<CSSProperties | undefined>(() => {
    if (!riseStyleAllowed.value) return undefined;
    return { opacity: String(immersive.progress.value * 0.82), transition: 'none' };
  });

  const openerFn = () => {
    immersive.variant.value = 'rise';
    options.showFullLyrics.value = true;
    playerStore.setFullLyricsVisible(true);
    // 唤起控件栏：顶栏随控件栏显隐（上下滚动/点按再唤起）
    useMobilePlayerTransition().showControls();
  };
  registerImmersiveOpener(openerFn);
  onUnmounted(() => unregisterImmersiveOpener(openerFn));

  /** closer：仅复位状态（进度/变体由手势或弹簧先行落定），信息栏下拖提交时经注册表调达 */
  const closerFn = () => {
    immersiveSurfaceMode.value = 'lyrics';
    options.showFullLyrics.value = false;
    playerStore.setFullLyricsVisible(false);
    immersive.progress.value = 0;
    immersive.variant.value = 'slide';
  };
  registerImmersiveCloser(closerFn);
  onUnmounted(() => unregisterImmersiveCloser(closerFn));

  /** 关闭分发：rise 路径下沉镜像（进度弹簧回 0，可带速度交接），其余走横滑动画 */
  function closeImmersive(sinkVelocityPxPerSec = 0) {
    if (immersive.variant.value === 'rise' && immersive.progress.value > 0.001) {
      if (prefersReducedMotion()) {
        immersive.progress.value = 0;
        immersiveSurfaceMode.value = 'lyrics';
        options.showFullLyrics.value = false;
        playerStore.setFullLyricsVisible(false);
        return;
      }
      springTo(
        (value) => {
          immersive.progress.value = value;
        },
        immersive.progress.value,
        0,
        // 下沉速度 px/s（向下为正）→ progress/s（进度减小方向为负）
        -sinkVelocityPxPerSec / 280,
        () => {
          immersiveSurfaceMode.value = 'lyrics';
          options.showFullLyrics.value = false;
          playerStore.setFullLyricsVisible(false);
        }
      );
      return;
    }
    options.openAnimated();
  }

  /** 手势路径（横滑开/关）复位：进度与变体一并回 slide，防 rise 残留 */
  function resetOnGestureClose() {
    immersive.progress.value = 0;
    immersive.variant.value = 'slide';
  }

  return {
    immersive,
    risePreviewing,
    immersiveProgress,
    riseOverlayStyle,
    riseMaskStyle,
    closeImmersive,
    resetOnGestureClose
  };
}

/**
 * 8 彩色样式的顶栏下沉把手：在通用 useImmersiveHeaderCollapse 上接进度映射——
 * 下拖时歌词覆盖层跟手下沉（progress 1→0，软边界），松手回弹时进度弹簧回 1，
 * 提交时 closeImmersive 从当前进度带速度落定（拖拽与关闭动画无断档）。
 */
export function useStyleImmersiveHeaderCollapse(
  onClose: (sinkVelocityPxPerSec?: number) => void
) {
  const immersive = useImmersiveLyrics();
  let sinkCancelSpring: (() => void) | null = null;
  onUnmounted(() => {
    sinkCancelSpring?.();
    sinkCancelSpring = null;
  });
  const collapse = useImmersiveHeaderCollapse(onClose, {
    onSinkPreview: (ratio) => {
      sinkCancelSpring?.();
      sinkCancelSpring = null;
      immersive.progress.value = rubberbandClamp01(1 - ratio);
    },
    onSinkCancel: (velocityPxPerSec) => {
      if (immersive.progress.value >= 0.999) return;
      if (prefersReducedMotion()) {
        immersive.progress.value = 1;
        return;
      }
      // 回弹方向与手指相反，速度阻尼交接（对齐本钩子 dragOffset 回弹的 0.4 系数）
      sinkCancelSpring = springTo(
        (value) => {
          immersive.progress.value = value;
        },
        immersive.progress.value,
        1,
        (velocityPxPerSec * 0.4) / 280
      );
    }
  });
  return {
    ...collapse,
    onHeaderPointerDown: (event: PointerEvent) => {
      // 面板模式（播放列表/设置）不抢：内容区替换态顶栏仅作静态栏
      if (immersiveSurfaceMode.value !== 'lyrics') return;
      // 横滑打开的态没有进度值（progress=0）：播种成 1 并切 rise 变体，
      // 下沉预览/回弹才有真实映射（关闭提交复用 closeImmersive 的 rise 路径）
      if (usePlayerStore().fullLyricsVisible && immersive.progress.value <= 0.001) {
        immersive.variant.value = 'rise';
        immersive.progress.value = 1;
      }
      collapse.onHeaderPointerDown(event);
    }
  };
}

/**
 * AM 顶栏下滑收起：包装层 pointer 手势（按钮放行），下拉跟手（阻尼位移反馈），
 * 松手 dy≥40px 或速度≥450px/s 提交 → 调用方以既有的关闭动画收起（同动画镜像），否则回弹。
 * hooks（8 彩色样式用）：onSinkPreview 让歌词覆盖层跟手下沉（进度映射），
 * onSinkCancel 在回弹时把进度弹簧回展开态——顶栏作为把手的完整跟手关闭。
 */
export function useImmersiveHeaderCollapse(
  onClose: (sinkVelocityPxPerSec?: number) => void,
  hooks?: {
    onSinkPreview?: (ratio: number) => void;
    onSinkCancel?: (velocityPxPerSec: number) => void;
  }
) {
  const dragOffset = ref(0);
  const dragging = ref(false);
  let pointerId = -1;
  let startY = 0;
  let prevY = 0;
  let prevTime = 0;
  let velocity = 0;
  let cancelAnim: (() => void) | null = null;

  /** 下沉满程：与信息栏上拉 riseDistance 同式，两个把手手感一致 */
  const sinkDistance = () => Math.max(180, Math.min(280, window.innerHeight * 0.28));

  function onHeaderPointerDown(event: PointerEvent) {
    // 打开态即可拖（不按 progress 判定——横滑打开的态 progress 恒为 0）
    if (!usePlayerStore().fullLyricsVisible) return;
    if (event.pointerType === 'mouse') return;
    if (event.target instanceof Element && event.target.closest('button, a, input')) return;
    cancelAnim?.();
    cancelAnim = null;
    pointerId = event.pointerId;
    startY = prevY = event.clientY;
    prevTime = event.timeStamp || performance.now();
    velocity = 0;
    dragOffset.value = 0;
    dragging.value = true;
    const target = event.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      /* 老内核可能不支持，忽略 */
    }
  }

  function onHeaderPointerMove(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    const now = event.timeStamp || performance.now();
    const dt = now - prevTime;
    if (dt > 0) {
      velocity = velocity * 0.6 + ((event.clientY - prevY) / dt) * 1000 * 0.4;
    }
    prevY = event.clientY;
    prevTime = now;
    const dy = event.clientY - startY;
    // 只认下拉；上拖轻阻尼归零
    dragOffset.value = dy > 0 ? Math.min(72, dy * 0.55) : Math.max(0, dy * 0.2);
    // 跟手下沉预览（原始位移/满程，未阻尼；软边界由映射方 rubber-band）
    hooks?.onSinkPreview?.(dy / sinkDistance());
  }

  function settle(event: PointerEvent, cancelled: boolean) {
    if (event.pointerId !== pointerId) return;
    pointerId = -1;
    dragging.value = false;
    const dy = dragOffset.value;
    const commit = !cancelled && (dy >= 40 || velocity > 450);
    if (commit) {
      // 速度交接（§5）：下拉速度交给下沉弹簧，消除拖拽反馈与关闭动画的断档；
      // dragOffset 随关闭淡出弹回 0（硬归零会在半透明顶栏上跳出 72px 台阶）
      cancelAnim = springTo(
        (value) => {
          dragOffset.value = value;
        },
        dy,
        0,
        -velocity * 0.4,
        () => {
          cancelAnim = null;
        },
        0.5
      );
      onClose(velocity);
      return;
    }
    hooks?.onSinkCancel?.(velocity);
    if (prefersReducedMotion() || dy === 0) {
      dragOffset.value = 0;
      return;
    }
    cancelAnim = springTo(
      (value) => {
        dragOffset.value = value;
      },
      dy,
      0,
      -velocity * 0.4,
      () => {
        cancelAnim = null;
      },
      0.5
    );
  }

  function onHeaderPointerUp(event: PointerEvent) {
    settle(event, false);
  }

  function onHeaderPointerCancel(event: PointerEvent) {
    settle(event, true);
  }

  onUnmounted(() => {
    cancelAnim?.();
    cancelAnim = null;
  });

  return {
    dragOffset,
    dragging,
    onHeaderPointerDown,
    onHeaderPointerMove,
    onHeaderPointerUp,
    onHeaderPointerCancel
  };
}
