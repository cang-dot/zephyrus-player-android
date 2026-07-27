/**
 * 下滑关闭手势 composable
 * 用于播放界面（非滚动歌词模式、非横屏）时，快速向下滑关闭播放界面
 */
export function useSwipeClose(options: {
  shouldClose: () => boolean;
  onClose: () => void;
}) {
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

    // 快速下滑：Y位移为正（向下），且大于60px，横向位移小于纵向位移，时间小于500ms
    if (deltaY > 60 && deltaX < deltaY && elapsed < 500) {
      options.onClose();
    }
  };

  return { onTouchStart, onTouchEnd };
}
