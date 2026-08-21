/**
 * Transition Store — crossfade 过渡 UI 状态
 *
 * 在 Smart Mix crossfade 期间，为 PlayBar / MusicFull 等组件提供
 * 下一首的视觉信息（背景色、封面、歌名、艺术家），使 UI 能在
 * 音频过渡的同时做平滑的视觉渐变。
 *
 * 生命周期：
 *   audioService 'crossfade-start'  → begin(snapshot)
 *   audioService 'crossfade-complete' → end()
 *   audioService 'crossfade-cancelled' → end()
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

export type TransitionVisualSnapshot = {
  transitionId: number;
  duration: number;
  current: {
    title: string;
    artist: string;
    primaryColor: string;
    backgroundColor: string;
    coverUrl: string;
  };
  next: {
    trackId: string;
    title: string;
    artist: string;
    primaryColor: string;
    backgroundColor: string;
    coverUrl: string;
  };
  nextProgress: number;
};

export type TransitionVisualInput = Omit<TransitionVisualSnapshot, 'transitionId'> & {
  transitionId?: number;
};

export const useTransitionStore = defineStore('transition', () => {
  // ==================== State ====================

  /** 是否正在 crossfade 过渡（UI 层用） */
  const isCrossfadingUI = ref(false);

  /** 当前过渡序列，避免旧歌曲的异步完成回调清掉新过渡 */
  const transitionId = ref(0);

  /** 当前歌曲背景色 */
  const currentBackgroundColor = ref<string>('');

  /** 下一首背景色 */
  const nextBackgroundColor = ref<string>('');

  /** 下一首封面 URL */
  const nextCoverUrl = ref<string>('');

  /** 当前歌曲封面 URL，在过渡期间作为叠化底图保留 */
  const currentCoverUrl = ref<string>('');

  /** 下一首歌曲名 */
  const nextName = ref<string>('');

  /** 下一首艺术家 */
  const nextArtist = ref<string>('');

  /** 下一首稳定 ID */
  const nextTrackId = ref<string>('');

  /** 过渡时长（秒），由 crossfade-start 事件携带 */
  const duration = ref<number>(8);

  // ==================== 进度条动画状态 ====================

  /** 下一首实时进度百分比 (0-100)，由 MusicHook 进度 interval 更新 */
  const nextProgress = ref<number>(0);

  /** 上一首是否已播放到尽头（用于触发渐变隐藏） */
  const currentSongEnded = ref<boolean>(false);

  /** 上一首的主体色（进度条填充色，用于结束时渐变为轨道背景色） */
  const currentAccentColor = ref<string>('#ffffff');

  /** 下一首的主体色（用于下一首进度条填充） */
  const nextAccentColor = ref<string>('#ffffff');

  // ==================== Actions ====================

  /**
   * 开始过渡：设置下一首信息并标记 UI 过渡状态
   * 由 MusicHook 在 'crossfade-start' 事件中调用
   *
   * @param input 当前歌曲和下一首歌曲的完整视觉快照
   */
  const begin = (input: TransitionVisualInput) => {
    const nextId = input.transitionId ?? transitionId.value + 1;
    transitionId.value = Math.max(transitionId.value + 1, nextId);
    isCrossfadingUI.value = true;
    currentBackgroundColor.value = input.current.backgroundColor || '';
    currentCoverUrl.value = input.current.coverUrl || '';
    nextBackgroundColor.value = input.next.backgroundColor || '';
    nextCoverUrl.value = input.next.coverUrl || '';
    nextName.value = input.next.title || '';
    nextArtist.value = input.next.artist || '';
    nextTrackId.value = input.next.trackId || '';
    duration.value = input.duration || 8;

    // 进度条动画状态
    nextProgress.value = Math.max(0, Math.min(100, input.nextProgress || 0));
    currentSongEnded.value = false;
    nextAccentColor.value = input.next.primaryColor || '#ffffff';
    currentAccentColor.value = input.current.primaryColor || '#ffffff';

    return nextId;
  };

  /** 更新下一首实时进度百分比 */
  const updateNextProgress = (pct: number) => {
    nextProgress.value = Math.max(0, Math.min(100, pct));
  };

  /** 标记上一首已播放到尽头 */
  const setCurrentSongEnded = () => {
    currentSongEnded.value = true;
  };

  /**
   * 结束过渡：清除 UI 过渡状态
   * 由 SmartMix 在新歌曲状态提交后，或由 crossfade-cancelled 调用
   */
  const end = (expectedNextTrackId?: string | number) => {
    if (expectedNextTrackId !== undefined && String(expectedNextTrackId) !== nextTrackId.value) {
      return;
    }
    isCrossfadingUI.value = false;
    currentBackgroundColor.value = '';
    currentCoverUrl.value = '';
    nextBackgroundColor.value = '';
    nextCoverUrl.value = '';
    nextName.value = '';
    nextArtist.value = '';
    nextTrackId.value = '';
    duration.value = 8;
    nextProgress.value = 0;
    currentSongEnded.value = false;
    currentAccentColor.value = '#ffffff';
    nextAccentColor.value = '#ffffff';
  };

  return {
    // state
    isCrossfadingUI,
    transitionId,
    currentBackgroundColor,
    currentCoverUrl,
    nextBackgroundColor,
    nextCoverUrl,
    nextName,
    nextArtist,
    nextTrackId,
    duration,
    // 进度条动画 state
    nextProgress,
    currentSongEnded,
    currentAccentColor,
    nextAccentColor,
    // actions
    begin,
    end,
    updateNextProgress,
    setCurrentSongEnded
  };
});
