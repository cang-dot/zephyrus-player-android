/**
 * 沉浸歌词过渡的纯动效工具（apple-design《Designing Fluid Interfaces》映射）。
 * 不含任何 Vue/store 依赖，便于单测与复用。
 */

/**
 * 动量投影（§6）：v(px/s) → 松手后仍会滑行的距离。
 * d 取 0.99（skill 的"snappier"档）：0.998 的滚动档系数 499，
 * 对 200px 级的上拉行程来说几乎任何松手都会越过判定阈，手感过敏。
 */
export function projectMomentum(velocity: number, decelerationRate = 0.99): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * 解析式临界阻尼弹簧（与 useLyricSwipeGesture.animateTo 同式：ω=18，
 * 即 damping 1.0 / response ≈0.35s），返回取消函数。
 */
export function springTo(
  set: (value: number) => void,
  from: number,
  target: number,
  initialVelocity: number,
  onComplete?: () => void,
  tolerance = 0.005
): () => void {
  let frame = 0;
  const startedAt = performance.now();
  const displacement = from - target;
  const omega = 18;
  const frameFn = (now: number) => {
    const elapsed = Math.min(0.55, (now - startedAt) / 1000);
    const decay = Math.exp(-omega * elapsed);
    const value =
      target + (displacement + (initialVelocity + omega * displacement) * elapsed) * decay;
    set(value);
    if (elapsed >= 0.55 || (Math.abs(value - target) < tolerance && now - startedAt > 120)) {
      set(target);
      onComplete?.();
      return;
    }
    frame = requestAnimationFrame(frameFn);
  };
  frame = requestAnimationFrame(frameFn);
  return () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
}

/** prefers-reduced-motion：跳过弹簧直接落点（调用方自行保证降级表现为交叉淡入） */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * progress 维度的软边界（§9 rubber-band）：越界阻尼随深度递增，
 * 不再硬 clamp——消除"下拖累积负值死行程"与上顶过冲。
 */
export function rubberbandClamp01(value: number, constant = 0.55): number {
  const soft = (overshoot: number) => (overshoot * constant) / (1 + constant * overshoot);
  if (value < 0) return -soft(-value);
  if (value > 1) return 1 + soft(value - 1);
  return value;
}

/**
 * 信息栏上下拖拽的落点决策（§6 动量投影 + 速度阈值）：
 * - 关闭态（isOpen=false）：投影 ≥0.55 或上拖速度过阈 → 打开（1），否则回弹（0）；
 * - 打开态：镜像判定（投影 ≤0.45 或下拖速度过阈 → 关闭）；
 * - 系统打断（cancelled）一律回原状态，与 useImmersiveHeaderCollapse 语义对齐。
 * velocity 为 progress/s（向上为正）；commitVelocity 同单位，默认 ≈620px/s ÷ 260px 行程。
 */
export function decideImmersiveDragSettle(input: {
  progress: number;
  velocity: number;
  isOpen: boolean;
  cancelled?: boolean;
  commitVelocity?: number;
}): 0 | 1 {
  const { progress, velocity, isOpen, cancelled = false } = input;
  if (cancelled) return isOpen ? 1 : 0;
  const commitVelocity = input.commitVelocity ?? 620 / 260;
  const projected = progress + projectMomentum(velocity);
  if (isOpen) {
    return projected <= 0.45 || velocity < -commitVelocity ? 0 : 1;
  }
  return projected >= 0.55 || velocity > commitVelocity ? 1 : 0;
}
