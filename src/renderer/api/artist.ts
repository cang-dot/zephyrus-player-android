import request from '@/utils/request';

// 获取歌手详情
export const getArtistDetail = (id) => {
  return request.get('/artist/detail', { params: { id } });
};

// 获取歌手简介（briefDesc）
export const getArtistDesc = (id: number | string) => {
  return request.get('/artist/desc', { params: { id } });
};

// 收藏歌手（t=1 收藏 / t=2 取消）
export const subscribeArtist = (id: number | string, t: 1 | 2 = 1) => {
  return request.get('/artist/sub', { params: { id, t } });
};

// 获取歌手热门歌曲
export const getArtistTopSongs = (params) => {
  return request.get('/artist/songs', {
    params: {
      ...params,
      order: 'hot'
    }
  });
};

// 获取歌手专辑
export const getArtistAlbums = (params) => {
  return request.get('/artist/album', { params });
};

// 获取关注歌手新歌
export const getArtistNewSongs = (limit: number = 20) => {
  return request.get<any>('/artist/new/song', { params: { limit } });
};

// 获取收藏的歌手列表（用于本地回显收藏态）
export const getArtistSublist = (limit: number = 100, offset: number = 0) => {
  return request.get('/artist/sublist', { params: { limit, offset } });
};
