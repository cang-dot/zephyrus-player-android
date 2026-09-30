export function shouldCommitMobilePageSwipe(
  distance: number,
  viewportWidth: number,
  velocity: number,
  hasAdjacentPage = true
) {
  if (!hasAdjacentPage) return false;
  return Math.abs(distance) >= Math.max(1, viewportWidth) * 0.14 || Math.abs(velocity) >= 0.24;
}

export function shouldOpenMobilePlayer(progress: number, velocityTowardOpen: number) {
  // progress 0.5 = 顶边走过胶囊→限高矩形行程的一半
  return progress >= 0.5 || velocityTowardOpen >= 0.55;
}

/** 手势行程：顶边从胶囊顶到限高圆角矩形顶的距离占比（0.85 = 弹簧展开段起点） */
export const MORPH_SETTLE_PROGRESS = 0.85;
/** 限高圆角矩形距屏幕四边的边距（px） */
export const MORPH_SCREEN_MARGIN = 10;
/** 阻尼伸长的最大视觉像素（顶边越过限高的橡皮筋幅度） */
export const MORPH_STRETCH_PIXELS = 44;

/**
 * iOS 式橡皮筋：越界越多跟随越少（WWDC Designing Fluid Interfaces 采样公式）。
 * 返回阻尼后的位移像素。
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  const d = Math.max(1, dimension);
  return (overshoot * d * constant) / (d + constant * Math.abs(overshoot));
}
