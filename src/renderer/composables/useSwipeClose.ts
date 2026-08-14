/**
 * 下滑关闭手势 composable
 * 用于播放界面（非滚动歌词模式、非横屏）时，快速向下滑关闭播放界面
 */
export function useSwipeClose(options: { shouldClose: () => boolean; onClose: () => void }) {
  let touchStartY = 0;
  let touchStartX = 0;
  let touchStartTime = 0;

  const onTouchStart = (e: TouchEvent) => {
    if (!options.shouldClose()) return;
    const touch = e.touches[0];
    touchStartY = touch.clientY;
    touchStartX = touch.clientX;
    touchStartTime = Date.now();
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!options.shouldClose()) return;
    const touch = e.changedTouches[0];
    const deltaY = touch.clientY - touchStartY;
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const elapsed = Date.now() - touchStartTime;

    // 关闭只在明确的下滑意图成立后触发，避免歌词滚动或轻触误关。
    const velocity = deltaY / Math.max(1, elapsed);
    if (deltaY > 84 && deltaX < deltaY * 0.8 && elapsed < 520 && velocity > 0.42) {
      options.onClose();
    }
  };

  return { onTouchStart, onTouchEnd };
}
