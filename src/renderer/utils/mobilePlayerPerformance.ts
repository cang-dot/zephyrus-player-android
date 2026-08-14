/** Shared frame pacing for the short mobile player surface morph. */
export function isMobilePlayerSurfaceMorphing(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.body.classList.contains('mobile-player-surface-morphing')
  );
}

export function shouldSkipMobilePlayerFrame(lastFrameAt: number, now = performance.now()): boolean {
  return isMobilePlayerSurfaceMorphing() && now - lastFrameAt < 33;
}
