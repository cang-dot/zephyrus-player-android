import { Router } from 'vue-router';

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
  }
) {
  const musicStore = useMusicStore();
  const { id, type, name, songList, listInfo, canRemove = false, sourceContext } = options;
  const contextualListInfo = sourceContext
    ? { ...listInfo, _sourceContext: sourceContext }
    : listInfo;

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
