import { computed, type CSSProperties, onUnmounted, type Ref,ref } from 'vue';

import { usePlayerStore } from '@/store/modules/player';
import { prefersReducedMotion, projectMomentum, springTo } from '@/utils/immersiveMotion';

export { prefersReducedMotion, projectMomentum, springTo };

/**
 * 沉浸歌词过渡的跨组件单一真值（模式同 mergeProgress/sheetProgress）：
 * progress 0→1 驱动顶部栏入场、底部信息栏让位、rise 变体的歌词覆盖层显现。
 *
 * 写入方（同一时刻只有一个在驱动）：
 * - 默认样式：DefaultMobilePlayerV2 在预览/展开期间镜像手势进度；
 * - 其他样式：MobileControlsArea 的信息栏上拉手势逐帧写入，提交后由样式组件接管。
 */
export type ImmersiveVariant = 'slide' | 'scale' | 'rise';

const progress = ref(0);
const variant = ref<ImmersiveVariant>('slide');

const active = computed(() => progress.value > 0.001);

type ImmersiveOpener = () => void;
let opener: ImmersiveOpener | null = null;

/** 当前播放器样式注册 rise 路径的打开回调；卸载时传 null 注销 */
export function registerImmersiveOpener(fn: ImmersiveOpener | null): void {
  opener = fn;
}

export function requestImmersiveOpen(): boolean {
  if (!opener) return false;
  opener();
  return true;
}

export function resetImmersiveLyrics(): void {
  progress.value = 0;
  variant.value = 'slide';
}

export function useImmersiveLyrics() {
  return { progress, variant, active };
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

  /** rise 变体：歌词覆盖层从中间显现（缩放 + 上浮 + 淡入），progress 逐帧驱动 */
  const riseOverlayStyle = computed<CSSProperties | undefined>(() => {
    if (immersive.variant.value !== 'rise') return undefined;
    const p = immersive.progress.value;
    return {
      opacity: String(p),
      transform: `scale(${(0.92 + 0.08 * p).toFixed(4)}) translate3d(0, ${((1 - p) * 24).toFixed(2)}px, 0)`,
      transformOrigin: '50% 60%',
      transition: 'none',
      willChange: 'transform, opacity'
    };
  });

  /** rise 变体的背景遮罩：与横滑 backdropStyle 同为 0.82 封顶 */
  const riseMaskStyle = computed<CSSProperties | undefined>(() => {
    if (immersive.variant.value !== 'rise') return undefined;
    return { opacity: String(immersive.progress.value * 0.82), transition: 'none' };
  });

  registerImmersiveOpener(() => {
    immersive.variant.value = 'rise';
    options.showFullLyrics.value = true;
    playerStore.setFullLyricsVisible(true);
  });
  onUnmounted(() => registerImmersiveOpener(null));

  /** 关闭分发：rise 路径下沉镜像（进度弹簧回 0），其余走横滑动画 */
  function closeImmersive() {
    if (immersive.variant.value === 'rise' && immersive.progress.value > 0.001) {
      if (prefersReducedMotion()) {
        immersive.progress.value = 0;
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
          options.showFullLyrics.value = false;
          playerStore.setFullLyricsVisible(false);
        }
      );
      return;
    }
    options.openAnimated();
  }

  /** 手势 onClose 复位：横滑关掉由 rise 打开的页面时，进度一并归零 */
  function resetOnGestureClose() {
    if (immersive.variant.value === 'rise') immersive.progress.value = 0;
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
