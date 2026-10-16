import { computed, type CSSProperties, onUnmounted, type Ref,ref } from 'vue';

import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { usePlayerStore } from '@/store/modules/player';
import type { InterfaceLayoutScheme } from '@/types/lyric';
import { prefersReducedMotion, projectMomentum, springTo } from '@/utils/immersiveMotion';

export { prefersReducedMotion, projectMomentum, springTo };

export type ImmersiveVariant = 'slide' | 'scale' | 'rise';
export type ImmersiveSurfaceMode = 'lyrics' | 'settings' | 'playlist' | 'comments';

/** 沉浸顶栏槽位（克隆飞行落点）：与 .immersive-header-wrap 的 padding 严格一致 */
export const IMMERSIVE_HEADER_SLOT = { inset: 20, size: 44, radius: 10, topInset: 66 };

const progress = ref(0);
const variant = ref<ImmersiveVariant>('slide');
/** 沉浸页内容区：顶栏「更多」/底部「播放列表/评论区」在沉浸态改为就地替换歌词区（切换型） */
export const immersiveSurfaceMode = ref<ImmersiveSurfaceMode>('lyrics');

const active = computed(() => progress.value > 0.001);

// ── 界面布局方案（appleMusic=沉浸顶栏方案；zephyrus=横滑+底部面板，默认）──
function readInterfaceLayout(): InterfaceLayoutScheme {
  try {
    const raw = JSON.parse(localStorage.getItem('music-full-config') || '{}') as {
      interfaceLayout?: unknown;
    };
    return raw.interfaceLayout === 'appleMusic' ? 'appleMusic' : 'zephyrus';
  } catch {
    return 'zephyrus';
  }
}

const interfaceLayout = ref<InterfaceLayoutScheme>(
  typeof window === 'undefined' ? 'zephyrus' : readInterfaceLayout()
);
export const isAppleMusicLayout = computed(() => interfaceLayout.value === 'appleMusic');

if (typeof window !== 'undefined') {
  window.addEventListener('music-full-config-updated', () => {
    interfaceLayout.value = readInterfaceLayout();
  });
}

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

export function resetImmersiveLyrics(): void {
  progress.value = 0;
  variant.value = 'slide';
  immersiveSurfaceMode.value = 'lyrics';
}

export function useImmersiveLyrics() {
  return { progress, variant, active, immersiveSurfaceMode, interfaceLayout, isAppleMusicLayout };
}

/** 沉浸页内容区切换：再点同一模式即回歌词（按钮为切换型） */
export function toggleImmersiveSurface(mode: Exclude<ImmersiveSurfaceMode, 'lyrics'>): void {
  immersiveSurfaceMode.value = immersiveSurfaceMode.value === mode ? 'lyrics' : mode;
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
}) {
  const immersive = useImmersiveLyrics();
  const playerStore = usePlayerStore();

  const risePreviewing = computed(
    () => immersive.variant.value === 'rise' && immersive.progress.value > 0.001
  );
  const immersiveProgress = computed(() => immersive.progress.value);

  /**
   * rise 变体：歌词覆盖层从中间显现（缩放 + 上浮 + 淡入）。
   * progress≈0 时必须回退 undefined 走横滑样式——否则 rise 用过一次后
   * variant 残留，横滑预览会被 opacity 0 的 rise 样式压成空白。
   */
  const riseOverlayStyle = computed<CSSProperties | undefined>(() => {
    if (immersive.variant.value !== 'rise' || immersive.progress.value <= 0.001) return undefined;
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
    if (immersive.variant.value !== 'rise' || immersive.progress.value <= 0.001) return undefined;
    return { opacity: String(immersive.progress.value * 0.82), transition: 'none' };
  });

  const openerFn = () => {
    if (!isAppleMusicLayout.value) return;
    immersive.variant.value = 'rise';
    options.showFullLyrics.value = true;
    playerStore.setFullLyricsVisible(true);
    // 唤起控件栏：顶栏随控件栏显隐（上下滚动/点按再唤起）
    useMobilePlayerTransition().showControls();
  };
  registerImmersiveOpener(openerFn);
  onUnmounted(() => unregisterImmersiveOpener(openerFn));

  /** 关闭分发：rise 路径下沉镜像（进度弹簧回 0），其余走横滑动画；内容区复位歌词 */
  function closeImmersive() {
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
        0,
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
 * AM 顶栏下滑收起：包装层 pointer 手势（按钮放行），下拉跟手（阻尼位移反馈），
 * 松手 dy≥40px 或速度≥450px/s 提交 → 调用方以既有的关闭动画收起（同动画镜像），否则回弹。
 */
export function useImmersiveHeaderCollapse(onClose: () => void) {
  const dragOffset = ref(0);
  const dragging = ref(false);
  let pointerId = -1;
  let startY = 0;
  let prevY = 0;
  let prevTime = 0;
  let velocity = 0;
  let cancelAnim: (() => void) | null = null;

  function onHeaderPointerDown(event: PointerEvent) {
    if (!isAppleMusicLayout.value || !active.value) return;
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
  }

  function settle(event: PointerEvent, cancelled: boolean) {
    if (event.pointerId !== pointerId) return;
    pointerId = -1;
    dragging.value = false;
    const dy = dragOffset.value;
    const commit = !cancelled && (dy >= 40 || velocity > 450);
    if (commit) {
      dragOffset.value = 0;
      onClose();
      return;
    }
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
