import { computed, type CSSProperties, onUnmounted, type Ref,ref } from 'vue';

import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { usePlayerStore } from '@/store/modules/player';
import { prefersReducedMotion, projectMomentum, springTo } from '@/utils/immersiveMotion';

export { prefersReducedMotion, projectMomentum, springTo };

export type ImmersiveVariant = 'slide' | 'scale' | 'rise';
export type ImmersiveSurfaceMode = 'lyrics' | 'settings' | 'playlist';

const progress = ref(0);
const variant = ref<ImmersiveVariant>('slide');
/** 沉浸页内容区：顶栏「更多」/底部「播放列表」在沉浸态改为就地替换歌词区（切换型） */
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

export function resetImmersiveLyrics(): void {
  progress.value = 0;
  variant.value = 'slide';
  immersiveSurfaceMode.value = 'lyrics';
}

export function useImmersiveLyrics() {
  return { progress, variant, active, immersiveSurfaceMode };
}

/** 沉浸页内容区切换：再点同一模式即回歌词（按钮为切换型） */
export function toggleImmersiveSurface(mode: Exclude<ImmersiveSurfaceMode, 'lyrics'>): void {
  immersiveSurfaceMode.value = immersiveSurfaceMode.value === mode ? 'lyrics' : mode;
}

/**
 * 播放器样式组件的沉浸歌词接入（8 个彩色样式共用）：
 * 注册 rise 打开回调（信息栏上拉手势经 requestImmersiveOpen 调用）、
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
