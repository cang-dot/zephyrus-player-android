/**
 * 下滑关闭手势 composable
 * 用于播放界面（非滚动歌词模式、非横屏）时，快速向下滑关闭播放界面
 *
 * Apple fluid 语义：
 * - 拖动期间输出 1:1 归一进度（swipeProgress 0-1），消费方可做跟手位移/变暗
 * - 松手按「进度或速度」判定提交/取消，动画从当前值接续（可中途反向）
 * - 旧消费者只解构 onTouchStart/onTouchEnd 时行为与旧版一致（阈值语义保持）
 */
import { onUnmounted, ref } from 'vue';

/** 提交阈值：拖动进度（分母为屏高 × 0.2）或释放速度（px/ms）任一达标 */
const COMMIT_PROGRESS = 0.3;
const COMMIT_VELOCITY = 0.45;
/** 进度归一分母系数（相对屏幕高度） */
const PROGRESS_DENOMINATOR = 0.2;

export function useSwipeClose(options: { shouldClose: () => boolean; onClose: () => void }) {
  const swipeProgress = ref(0);

  let tracking = false;
  let verticalIntent = false;
  let startY = 0;
  let startX = 0;
  let startTime = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0; // px/ms，向下为正
  let animFrame = 0;

  const sampleVelocity = (y: number, now: number) => {
    const dt = now - lastTime;
    if (dt >= 100 || dt <= 0) {
      velocity = (y - lastY) / Math.max(1, dt);
      lastY = y;
      lastTime = now;
    }
  };

  const cancelAnimationFrame = () => {
    if (animFrame) window.cancelAnimationFrame(animFrame);
    animFrame = 0;
  };

  const animateProgress = (target: number, duration: number, done?: () => void) => {
    cancelAnimationFrame();
    const from = swipeProgress.value;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / Math.max(1, duration));
      const eased = 1 - Math.pow(1 - t, 3);
      swipeProgress.value = from + (target - from) * eased;
      if (t < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        animFrame = 0;
        done?.();
      }
    };
    animFrame = requestAnimationFrame(step);
  };

  const stopTracking = () => {
    tracking = false;
    window.removeEventListener('touchmove', onWindowTouchMove);
    window.removeEventListener('touchend', onWindowTouchEnd);
    window.removeEventListener('touchcancel', onWindowTouchEnd);
  };

  const finish = () => {
    const shouldCommit =
      verticalIntent && (swipeProgress.value >= COMMIT_PROGRESS || velocity >= COMMIT_VELOCITY);
    if (shouldCommit) {
      // 甩得越快，滑出越快（速度近似接力）
      const duration = Math.max(140, Math.min(320, 320 - velocity * 220));
      // 提交路径不清零进度：跟手消费者（如错误样式的渐隐）需要在 onClose
      // 之后仍读到提交值，以跳过二次离场动画；下次手势开始时会重新归零。
      animateProgress(1.25, duration, () => {
        options.onClose();
      });
    } else if (swipeProgress.value > 0.001) {
      // 取消：从当前值弹回
      animateProgress(0, 300);
    } else {
      swipeProgress.value = 0;
    }
    stopTracking();
  };

  const onWindowTouchMove = (e: TouchEvent) => {
    if (!tracking) return;
    const touch = e.touches[0];
    const now = performance.now();
    const deltaY = touch.clientY - startY;
    const deltaX = Math.abs(touch.clientX - startX);
    if (!verticalIntent) {
      // 纵向意图锁定（与旧版 deltaX < deltaY*0.8 语义一致）
      if (deltaY > 12 && deltaX < deltaY * 0.8) verticalIntent = true;
      else if (deltaX > deltaY * 1.1 && deltaX > 12) {
        stopTracking();
        return;
      } else return;
    }
    sampleVelocity(touch.clientY, now);
    const max = window.innerHeight * PROGRESS_DENOMINATOR;
    swipeProgress.value = Math.min(1, Math.max(0, deltaY / max));
  };

  const onWindowTouchEnd = () => {
    if (!tracking) return;
    finish();
  };

  const onTouchStart = (e: TouchEvent) => {
    if (!options.shouldClose()) return;
    cancelAnimationFrame();
    const touch = e.touches[0];
    startY = touch.clientY;
    startX = touch.clientX;
    startTime = performance.now();
    lastY = startY;
    lastTime = startTime;
    velocity = 0;
    verticalIntent = false;
    swipeProgress.value = 0;
    tracking = true;
    // 跟踪移到 window：手指移出元素后仍持续 1:1 跟手
    window.addEventListener('touchmove', onWindowTouchMove, { passive: true });
    window.addEventListener('touchend', onWindowTouchEnd);
    window.addEventListener('touchcancel', onWindowTouchEnd);
  };

  const onTouchEnd = () => {
    // 元素上的 touchend 兜底（window 监听通常已先处理）
    if (tracking) finish();
  };

  onUnmounted(() => {
    cancelAnimationFrame();
    stopTracking();
  });

  return { onTouchStart, onTouchEnd, swipeProgress };
}
