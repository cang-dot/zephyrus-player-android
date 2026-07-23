/**
 * useTapToggle — 移动端点击屏幕切换控件显隐 + 双击检测
 *
 * 使用方式：
 * const { controlsVisible, handleTapToggle } = useTapToggle({
 *   onDoubleClick: () => { showFullLyrics.value = true; }
 * });
 *
 * 在模板中：
 * <div @click="handleTapToggle">
 *   <div v-show="controlsVisible" class="control-bar">...</div>
 * </div>
 *
 * 行为：
 * - 单击屏幕（非交互区域）→ 切换控件显隐（300ms 延迟以区分双击）
 * - 双击屏幕（非交互区域）→ 调用 onDoubleClick 回调
 * - 点击控件本身不触发切换（通过 .no-toggle 类标记）
 * - 所有平台 3 秒无操作自动隐藏
 */
import { type Ref, ref } from 'vue';

import { isMobile } from '@/utils';

export function useTapToggle(options?: {
  /** 自动隐藏延迟（毫秒），默认 3000 */
  autoHideDelay?: number;
  /** 初始状态，移动端默认 false，非移动端默认 true */
  initialVisible?: boolean;
  /** 双击回调 */
  onDoubleClick?: () => void;
  /** 双击检测窗口（毫秒），默认 300 */
  doubleTapDelay?: number;
}): {
  controlsVisible: Ref<boolean>;
  handleTapToggle: (e: TouchEvent | MouseEvent) => void;
  showControls: () => void;
  hideControls: () => void;
  resetHideTimer: () => void;
} {
  const autoHideDelay = options?.autoHideDelay ?? 3000;
  const initial = options?.initialVisible ?? (isMobile.value ? false : true);
  const onDoubleClick = options?.onDoubleClick;
  const doubleTapDelay = options?.doubleTapDelay ?? 300;

  const controlsVisible = ref(initial);
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let tapTimer: ReturnType<typeof setTimeout> | null = null;

  /** 显示控件，启动自动隐藏计时器（所有平台） */
  function showControls() {
    controlsVisible.value = true;
    resetHideTimer();
  }

  /** 隐藏控件 */
  function hideControls() {
    controlsVisible.value = false;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  /** 重置自动隐藏计时器 */
  function resetHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
    }
    hideTimer = setTimeout(() => {
      controlsVisible.value = false;
    }, autoHideDelay);
  }

  /** 点击屏幕：区分单击/双击 */
  function handleTapToggle(e: TouchEvent | MouseEvent) {
    // 排除点击的是标记为 .no-toggle 的元素或其后代
    const target = e.target as HTMLElement;
    if (target?.closest('.no-toggle')) return;

    if (tapTimer) {
      // 300ms 内第二次点击 → 双击
      clearTimeout(tapTimer);
      tapTimer = null;
      if (onDoubleClick) {
        onDoubleClick();
      }
    } else {
      // 第一次点击 → 延迟 300ms 执行单击动作
      tapTimer = setTimeout(() => {
        // 单击动作：切换控件
        if (controlsVisible.value) {
          hideControls();
        } else {
          showControls();
        }
        tapTimer = null;
      }, doubleTapDelay);
    }
  }

  return {
    controlsVisible,
    handleTapToggle,
    showControls,
    hideControls,
    resetHideTimer
  };
}
