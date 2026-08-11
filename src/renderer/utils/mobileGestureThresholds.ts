export function shouldCommitMobilePageSwipe(
  distance: number,
  viewportWidth: number,
  velocity: number,
  hasAdjacentPage = true
) {
  if (!hasAdjacentPage) return false;
  return Math.abs(distance) >= Math.max(1, viewportWidth) * 0.35 || Math.abs(velocity) >= 0.55;
}

export function shouldOpenMobilePlayer(progress: number, velocityTowardOpen: number) {
  return progress >= 0.38 || velocityTowardOpen >= 0.55;
}
