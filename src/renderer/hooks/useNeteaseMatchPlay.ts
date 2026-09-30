import { useMessage } from 'naive-ui';

import { resolveNeteaseMatch } from '@/api/kugouPlayback';
import { isCrossPlatformSong } from '@/api/crossPlatformSearch';
import { useI18n } from 'vue-i18n';

import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';

/**
 * 匹配网易云播放：把跨平台歌曲（QQ/酷狗等）按歌名+歌手+时长匹配成网易云版本，
 * 原位替换播放队列中的这首歌并起播——后续切歌/历史/封面都走网易云链路。
 */
export function useMatchNeteasePlay() {
  const playerStore = usePlayerStore();
  const message = useMessage();
  const { t } = useI18n();

  const playAsNetease = async (song: SongResult): Promise<boolean> => {
    if (!isCrossPlatformSong(song)) return false;
    try {
      const matched = await resolveNeteaseMatch(song);
      if (!matched) {
        message.warning(t('songItem.message.noNeteaseMatch'));
        return false;
      }
      playerStore.replacePlayListSong(song, matched);
      const result = await playerStore.setPlay(matched);
      if (result === false) {
        message.error(t('player.playFailed'));
        return false;
      }
      return true;
    } catch (error) {
      console.error('[matchNeteasePlay] 匹配网易云播放失败:', error);
      message.error(t('player.playFailed'));
      return false;
    }
  };

  return { playAsNetease };
}
