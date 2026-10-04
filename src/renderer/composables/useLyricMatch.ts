/**
 * 「匹配歌词」面板的全局单例状态
 *
 * 入口来自长按菜单与播放设置（歌曲信息旁），面板本体全局挂载一次即可。
 */
import { ref, shallowRef } from 'vue';

import type { SongResult } from '@/types/music';

const visible = ref(false);
const targetSong = shallowRef<SongResult | null>(null);

/** 打开匹配歌词面板；不传歌曲时由面板取当前播放歌曲 */
export function openLyricMatch(song?: SongResult | null): void {
  targetSong.value = song || null;
  visible.value = true;
}

export function closeLyricMatch(): void {
  visible.value = false;
}

export function useLyricMatch() {
  return { visible, targetSong, openLyricMatch, closeLyricMatch };
}
