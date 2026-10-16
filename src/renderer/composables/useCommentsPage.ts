import { usePlayerStore } from '@/store/modules/player';

import { useLyricSwipeGesture } from './useLyricSwipeGesture';

/**
 * 评论页手势接线（三页布局：评论/播放界面/歌词）。
 * 各样式播放器用它创建评论侧手势实例，并把返回的四个
 * onPointer* 以 capture 方式绑到样式根节点上，
 * 再挂载 <MobileCommentsOverlay :gesture="..." />。
 *
 * @param extraSuppressed 额外抑制条件（AppleMusic 方案弃用横滑，由调用方传
 *   `() => interfaceLayout !== 'zephyrus'` 让评论手势完全惰性）
 */
export function useCommentsPage(extraSuppressed?: () => boolean) {
  const playerStore = usePlayerStore();
  return useLyricSwipeGesture({
    isOpen: () => playerStore.fullCommentsVisible,
    onOpen: () => playerStore.setFullCommentsVisible(true),
    onClose: () => playerStore.setFullCommentsVisible(false),
    role: 'comments',
    // 歌词页打开期间抑制评论手势，防止双浮层同帧动画
    suppressed: () => playerStore.fullLyricsVisible || (extraSuppressed?.() ?? false)
  });
}
