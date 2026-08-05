/**
 * Transition Store — crossfade 过渡 UI 状态
 *
 * 在 Smart Mix crossfade 期间，为 PlayBar / MusicFull 等组件提供
 * 下一首的视觉信息（背景色、封面、歌名、艺术家），使 UI 能在
 * 音频过渡的同时做平滑的视觉渐变。
 *
 * 生命周期：
 *   audioService 'crossfade-start'  → begin(track)
 *   audioService 'crossfade-complete' → end()
 *   audioService 'crossfade-cancelled' → end()
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { Artist, SongResult } from '@/types/music';

export const useTransitionStore = defineStore('transition', () => {
  // ==================== State ====================

  /** 是否正在 crossfade 过渡（UI 层用） */
  const isCrossfadingUI = ref(false);

  /** 下一首背景色 */
  const nextBackgroundColor = ref<string>('');

  /** 下一首封面 URL */
  const nextCoverUrl = ref<string>('');

  /** 下一首歌曲名 */
  const nextName = ref<string>('');

  /** 下一首艺术家 */
  const nextArtist = ref<string>('');

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
   * @param track 下一首歌曲信息
   * @param crossfadeDuration 过渡时长（秒）
   * @param _currentProgress 上一首当前进度百分比 (0-100)（保留参数，不再使用）
   * @param _nextDuration 下一首总时长（秒）（保留参数，不再使用）
   * @param nextColor 下一首主体色
   * @param currentColor 上一首主体色
   */
  const begin = (
    track: SongResult,
    crossfadeDuration: number = 8,
    _currentProgress: number = 0,
    _nextDuration: number = 0,
    nextColor: string = '',
    currentColor: string = ''
  ) => {
    isCrossfadingUI.value = true;
    nextBackgroundColor.value = track.backgroundColor || '';
    nextCoverUrl.value = track.picUrl || '';
    nextName.value = track.name || '';
    duration.value = crossfadeDuration || 8;

    // 进度条动画状态
    nextProgress.value = 0;
    currentSongEnded.value = false;
    nextAccentColor.value = nextColor || track.backgroundColor || '#ffffff';
    currentAccentColor.value = currentColor || '#ffffff';

    // 解析艺术家名
    const artists: Artist[] | undefined =
      track.ar || track.song?.artists;
    if (artists && artists.length > 0) {
      nextArtist.value = artists.map((a) => a.name).join(' / ');
    } else {
      nextArtist.value = '';
    }
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
   * 由 MusicHook 在 'crossfade-complete' / 'crossfade-cancelled' 事件中调用
   */
  const end = () => {
    isCrossfadingUI.value = false;
    nextBackgroundColor.value = '';
    nextCoverUrl.value = '';
    nextName.value = '';
    nextArtist.value = '';
    duration.value = 8;
    nextProgress.value = 0;
    currentSongEnded.value = false;
    currentAccentColor.value = '#ffffff';
    nextAccentColor.value = '#ffffff';
  };

  return {
    // state
    isCrossfadingUI,
    nextBackgroundColor,
    nextCoverUrl,
    nextName,
    nextArtist,
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
    setCurrentSongEnded,
  };
});
