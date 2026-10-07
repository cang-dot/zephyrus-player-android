import { Router } from 'vue-router';

import { beginPlaylistOpen } from '@/composables/usePlaylistOpenTransition';
import { useMusicStore } from '@/store/modules/music';

export interface MusicListSourceContext {
  platform: 'netease' | 'qq' | 'kugou';
  accountId: string;
  sourceId: string;
  kind: 'playlist' | 'album';
}

/**
 * 导航到音乐列表页面的通用方法
 * @param router Vue路由实例
 * @param options 导航选项
 *   - transition: 携带来源卡片矩形/封面时启动背景扩展过渡（歌单页同款），
 *     各列表入口统一经此触发，无需各自手写 beginPlaylistOpen
 */
export function navigateToMusicList(
  router: Router,
  options: {
    id?: string | number;
    type?: 'album' | 'playlist' | 'dailyRecommend' | string;
    name: string;
    songList?: any[];
    listInfo?: any;
    canRemove?: boolean;
    sourceContext?: MusicListSourceContext;
    transition?: {
      rect?: { x: number; y: number; w: number; h: number } | null;
      coverUrl?: string;
      /** 过渡形态：color 色块（默认）/ cover 封面克隆飞行 */
      mode?: 'cover' | 'color';
    };
  }
) {
  const musicStore = useMusicStore();
  const { id, type, name, songList, listInfo, canRemove = false, sourceContext, transition } = options;
  const contextualListInfo = sourceContext
    ? { ...listInfo, _sourceContext: sourceContext }
    : listInfo;

  // 背景扩展过渡（在路由跳转前启动，覆盖层先于页面出现）
  if (transition?.rect && transition.rect.w > 0 && transition.rect.h > 0) {
    beginPlaylistOpen({
      rect: transition.rect,
      coverUrl: transition.coverUrl,
      mode: transition.mode
    });
  }

  // 如果是每日推荐，不需要设置 musicStore，直接从 recommendStore 获取
  if (type !== 'dailyRecommend') {
    if (songList) {
      musicStore.setCurrentMusicList(songList, name, contextualListInfo, canRemove);
    } else {
      musicStore.setBasicListInfo(name, contextualListInfo, canRemove);
    }
  } else {
    // 确保 musicStore 的数据被清空，避免显示旧的列表
    musicStore.clearCurrentMusicList();
  }

  // 路由跳转
  if (id !== undefined && id !== null && id !== '') {
    router.push({
      name: 'musicList',
      params: { id },
      query: {
        type,
        ...(sourceContext
          ? {
              from: 'platform',
              platform: sourceContext.platform,
              accountId: sourceContext.accountId,
              sourceId: sourceContext.sourceId
            }
          : {})
      }
    });
  } else {
    router.push({
      name: 'musicList',
      query: { type: 'dailyRecommend' }
    });
  }
}
