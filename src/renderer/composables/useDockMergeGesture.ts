import { readonly, ref } from 'vue';

/**
 * 底栏滚动合并的手势进度（0 = 展开态，1 = 合并态，>1 = 过冲阻尼伸长）。
 * 单一真值驱动 dock 容器/指示胶囊/迷你栏的逐帧插值——用户的滑动直接
 * 对应收起动画的某一帧；松手后弹簧收敛到 0 或 1。
 */
const mergeProgress = ref(0);
let frame = 0;
let generation = 0;

const cancelAnimation = () => {
  generation += 1;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
};

const setMergeProgress = (value: number) => {
  cancelAnimation();
  mergeProgress.value = Math.min(1.18, Math.max(0, value));
};

/** 弹簧收敛到目标（带初速）；完成可选回调 */
const animateMergeProgress = (target: 0 | 1, velocity = 0, complete?: () => void) => {
  cancelAnimation();
  const gen = ++generation;
  let value = mergeProgress.value;
  let speed = velocity;
  let previous = performance.now();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = (now: number) => {
    if (gen !== generation) return;
    const dt = Math.min(0.032, Math.max(0.001, (now - previous) / 1000));
    previous = now;
    if (reduced) {
      value += (target - value) * Math.min(1, dt / 0.16);
    } else {
      // 刚度高于播放面弹簧（-600/-40）：合并/展开行程短，需要更快到位
      speed += (-600 * (value - target) - 40 * speed) * dt;
      value += speed * dt;
    }
    mergeProgress.value = Math.min(1, Math.max(0, value));
    if (Math.abs(value - target) < 0.004 && (reduced || Math.abs(speed) < 0.05)) {
      mergeProgress.value = target;
      frame = 0;
      if (gen === generation) complete?.();
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
};

export function useDockMergeGesture() {
  return {
    mergeProgress: readonly(mergeProgress),
    setMergeProgress,
    animateMergeProgress,
    cancelMergeAnimation: cancelAnimation
  };
}
