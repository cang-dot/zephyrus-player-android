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
