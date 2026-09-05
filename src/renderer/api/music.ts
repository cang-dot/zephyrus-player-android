import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getMusicDB } from '@/hooks/MusicHook';
import { useSettingsStore, useUserStore } from '@/store';
import type { ILyric } from '@/types/lyric';
import type { SongResult } from '@/types/music';
import request from '@/utils/request';

import { MusicParser, type MusicParseResult } from './musicParser';
import { getUnlockKey, getUnlockSongUrl } from './unlockKey';

// 将 FM 歌曲移至垃圾桶（不喜欢）
export const fmTrash = (id: number) => {
  return request.post('/fm_trash', null, {
    params: { id, timestamp: Date.now() }
  });
};

// 获取音乐音质详情
export const getMusicQualityDetail = (id: number) => {
  return request.get('/song/music/detail', { params: { id } });
};

// 根据音乐Id获取音乐播放URl
export const getMusicUrl = async (id: number, isDownloaded: boolean = false) => {
  const userStore = useUserStore();
  const settingStore = useSettingsStore();
  // 判断是否登录
  try {
    if (userStore.user && isDownloaded && userStore.user.vipType !== 0) {
      const url = '/song/download/url/v1';
      // 注意：token 与 os=pc 之间必须有 "; " 分隔符，否则 os=pc 会被拼进 MUSIC_U 值导致凭据失效
      const token = localStorage.getItem('token') || '';
      const res = await request.get(url, {
        params: {
          id,
          level: settingStore.setData.musicQuality || 'higher',
          encodeType: settingStore.setData.musicQuality == 'lossless' ? 'flac' : 'aac',
          cookie: `${token}; os=pc;`
        }
      });

      if (res.data.data.url) {
        return { data: { data: [{ ...res.data.data }] } };
      }
    }
  } catch (error) {
    console.error('error', error);
  }

  const result = await request.get('/song/url/v1', {
    params: {
      id,
      level: settingStore.setData.musicQuality || 'higher',
      encodeType: settingStore.setData.musicQuality == 'lossless' ? 'flac' : 'aac'
    }
  });

  // 如果拿到 URL 则直接返回
  if (result?.data?.data?.[0]?.url && !result.data.data[0].freeTrialInfo) {
    return result;
  }

  // 未拿到 URL 或试听片段 → 尝试用解锁口令走服务器代理
  const unlockToken = getUnlockKey();
  if (unlockToken) {
    const quality = settingStore.setData.musicQuality || 'higher';
    const unlockResult = await getUnlockSongUrl(id, unlockToken, quality);
    if (unlockResult.url) {
      return {
        data: {
          data: [
            {
              url: unlockResult.url,
              br: unlockResult.br || 0,
              size: unlockResult.size || 0,
              type: 'unlock',
              level: quality
            }
          ]
        }
      };
    }
  }

  return result;
};

// 获取歌曲详情
export const getMusicDetail = (ids: Array<number>, cookie?: string) => {
  return request.get('/song/detail', { params: { ids: ids.join(','), cookie } });
};

// 根据音乐Id获取音乐歌词
export const getMusicLrc = async (id: number) => {
  const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000; // 10天的毫秒数
  const db = await getMusicDB();

  try {
    // 尝试获取缓存的歌词
    const cachedLyric = await db.getData('music_lyric', id);
    if (cachedLyric?.createTime && Date.now() - cachedLyric.createTime < TEN_DAYS_MS) {
      return { ...cachedLyric };
    }

    // 获取新的歌词数据
    const res = await request.get<ILyric>('/lyric/new', { params: { id } });

    // 只有在成功获取新数据后才删除旧缓存并添加新缓存
    if (res?.data) {
      if (cachedLyric) {
        await db.deleteData('music_lyric', id);
      }
      db.addData('music_lyric', { id, data: res.data, createTime: Date.now() });
    }

    return res;
  } catch (error) {
    console.error('获取歌词失败:', error);
    const staleLyric = await db.getData('music_lyric', id).catch(() => null);
    if (staleLyric?.data) {
      console.info(`网络不可用，使用过期歌词缓存: ${id}`);
      return { ...staleLyric };
    }
    throw error; // 向上抛出错误，让调用者处理
  }
};

/**
 * 获取解析后的音乐URL
 * @param id 歌曲ID
 * @param data 歌曲数据
 * @returns 解析结果
 */
export const getParsingMusicUrl = async (
  id: number,
  data: SongResult
): Promise<MusicParseResult> => {
  return await MusicParser.parseMusic(id, data);
};

// 收藏歌曲
export const likeSong = (id: number, like: boolean = true) => {
  return request.get('/like', { params: { id, like } });
};

/**
 * 简介缓存：歌曲级按歌名，专辑简介按专辑 ID，歌手简介按歌手 ID。
 * 空串也缓存——表示"查过但没有"，调用方靠链路下一级兜底。
 */
const baikeDescCache = new Map<string, string>();
const wikiDescCache = new Map<string, string>();
const anysearchDescCache = new Map<string, string>();
const albumDescriptionCache = new Map<string, string>();
const artistBriefDescCache = new Map<string, string>();

/** 百科类结果域名（与服务端 anysearch_song.js 同款过滤） */
const ENCY_URL_PATTERNS = [/baike\.baidu\.com/, /zh\.wikipedia\.org/];

/** 从 AnySearch 结果中提取百科类简介：过滤歌词站噪音 + 歌手名校验 + 截断 */
function extractAnySearchDescription(results: any[], artist: string): string {
  for (const item of results) {
    const url = String(item?.url || '');
    if (!ENCY_URL_PATTERNS.some((p) => p.test(url))) continue;
    const text = String(item?.content || item?.snippet || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length < 20) continue;
    // 歌手名校验：防止命中同名小说/电影等错误词条
    if (artist && !text.includes(artist)) continue;
    return text.slice(0, 200);
  }
  return '';
}

/**
 * Android 原生直连 AnySearch：CapacitorHttp 走原生 HTTP，不受 CORS 限制，
 * 匿名额度按设备 IP 独立计算，避免共享服务器 IP 被限流。
 */
async function fetchAnySearchIntroDirect(name: string, artist: string): Promise<string> {
  try {
    const res = await CapacitorHttp.post({
      url: 'https://api.anysearch.com/v1/search',
      headers: { 'Content-Type': 'application/json' },
      data: {
        query: `${name} ${artist} 歌曲 简介`,
        max_results: 8,
        zone: 'cn',
        language: 'zh-CN'
      },
      readTimeout: 10000,
      connectTimeout: 5000
    });
    if (res.status !== 200) return '';
    const results = (res.data as any)?.data?.results || [];
    return extractAnySearchDescription(results, artist);
  } catch {
    return '';
  }
}

/**
 * 获取歌曲简介（海报信息模式使用），五级兜底链：
 * 1. AnySearch 聚合搜索（Android 原生直连 api.anysearch.com——原生 HTTP 不受 CORS 限制，
 *    匿名额度按设备 IP 独立计算；非原生平台或直连失败时降级走服务器代理 /anysearch/song。
 *    服务端同款过滤：百科域名结果 + 歌手名校验）；
 * 2. 百度百科歌曲词条：/baike/song（服务端做歧义校验，摘要须含歌手名）；
 * 3. 维基百科词条导语：/wiki/extract（baike 未命中时兜底，如《杀死那个石家庄人》baidu 命中同名小说）；
 * 4. 专辑简介：/album description；
 * 5. 歌手简介：/artist/desc briefDesc。
 * 说明：/song/wiki/summary 在当前 API 版本（4.32.0）仅返回音乐百科标签块、无简介文本。
 * 请求失败或均无简介时返回空字符串（调用方降级为无简介，不抛错）。
 */
export const getSongWikiSummary = async (id: number | string): Promise<string> => {
  try {
    // 注意：request 响应拦截器原样返回 axios response，body 在 .data 中
    const detail = await request.get('/song/detail', { params: { ids: id } });
    const song = detail?.data?.songs?.[0];
    if (!song) return '';
    const name = String(song.name || '').trim();
    const artistName = String(song.ar?.[0]?.name || '').trim();

    // 1. AnySearch 聚合搜索（原生直连优先，失败降级服务器代理）
    if (name) {
      const cachedAny = anysearchDescCache.get(name);
      if (cachedAny !== undefined) {
        if (cachedAny) return cachedAny;
      } else {
        let desc = '';
        if (Capacitor.isNativePlatform()) {
          desc = await fetchAnySearchIntroDirect(name, artistName);
        }
        if (!desc) {
          try {
            const res = await request.get('/anysearch/song', {
              params: { name, artist: artistName }
            });
            desc = String(res?.data?.description || '').trim();
          } catch {
            desc = '';
          }
        }
        anysearchDescCache.set(name, desc);
        if (desc) return desc;
      }
    }

    // 2. 百度百科歌曲词条
    if (name) {
      const cachedBaike = baikeDescCache.get(name);
      if (cachedBaike !== undefined) {
        if (cachedBaike) return cachedBaike;
      } else {
        try {
          const res = await request.get('/baike/song', { params: { name, artist: artistName } });
          const abstract = String(res?.data?.abstract || '').trim();
          baikeDescCache.set(name, abstract);
          if (abstract) return abstract;
        } catch {
          baikeDescCache.set(name, '');
        }
      }
    }

    // 3. 维基百科词条导语（服务器代理，客户端直连会被墙）
    if (name) {
      const cachedWiki = wikiDescCache.get(name);
      if (cachedWiki !== undefined) {
        if (cachedWiki) return cachedWiki;
      } else {
        try {
          const res = await request.get('/wiki/extract', { params: { title: name } });
          const extract = String(res?.data?.extract || '').trim();
          wikiDescCache.set(name, extract);
          if (extract) return extract;
        } catch {
          wikiDescCache.set(name, '');
        }
      }
    }

    // 4. 专辑简介
    const albumId = song.al?.id;
    if (albumId) {
      const albumKey = String(albumId);
      const cachedAlbum = albumDescriptionCache.get(albumKey);
      if (cachedAlbum) return cachedAlbum;
      if (cachedAlbum === undefined) {
        const res = await request.get('/album', { params: { id: albumId } });
        const desc = String(res?.data?.album?.description || '').trim();
        albumDescriptionCache.set(albumKey, desc);
        if (desc) return desc;
      }
    }

    // 5. 歌手简介兜底
    const artistId = song.ar?.[0]?.id;
    if (artistId) {
      const artistKey = String(artistId);
      const cachedArtist = artistBriefDescCache.get(artistKey);
      if (cachedArtist !== undefined) return cachedArtist;
      try {
        const res = await request.get('/artist/desc', { params: { id: artistId } });
        const brief = String(res?.data?.briefDesc || '').trim();
        artistBriefDescCache.set(artistKey, brief);
        if (brief) return brief;
      } catch {
        artistBriefDescCache.set(artistKey, '');
      }
    }
    return '';
  } catch (error) {
    console.warn('[music] 获取歌曲简介失败:', error);
    return '';
  }
};

// 将每日推荐中的歌曲标记为不感兴趣，并获取一首新歌
export const dislikeRecommendedSong = (id: number | string) => {
  return request.get('/recommend/songs/dislike', {
    params: { id }
  });
};
// 获取用户喜欢的音乐列表
export const getLikedList = (uid: number) => {
  return request.get('/likelist', {
    params: { uid, noLogin: true }
  });
};

// 创建歌单
export const createPlaylist = (params: { name: string; privacy: number }) => {
  return request.post('/playlist/create', params);
};

// 添加或删除歌单歌曲
export const updatePlaylistTracks = (params: {
  op: 'add' | 'del';
  pid: number;
  tracks: string;
}) => {
  return request.post('/playlist/tracks', params);
};

/**
 * 根据类型获取列表数据
 * @param type 列表类型 album/playlist
 * @param id 列表ID
 */
export function getMusicListByType(type: string, id: string) {
  if (type === 'album') {
    return getAlbumDetail(id);
  } else if (type === 'playlist') {
    return getPlaylistDetail(id);
  }
  return Promise.reject(new Error('未知列表类型'));
}

/**
 * 获取专辑详情
 * @param id 专辑ID
 */
export function getAlbumDetail(id: string) {
  return request({
    url: '/album',
    method: 'get',
    params: {
      id
    }
  });
}

/**
 * 获取歌单详情
 * @param id 歌单ID
 */
export function getPlaylistDetail(id: string) {
  return request({
    url: '/playlist/detail',
    method: 'get',
    params: {
      id
    }
  });
}

export function subscribePlaylist(params: { t: number; id: number }) {
  return request({
    url: '/playlist/subscribe',
    method: 'post',
    params
  });
}

/**
 * 收藏/取消收藏专辑
 * @param params t: 1 收藏, 2 取消收藏; id: 专辑id
 */
export function subscribeAlbum(params: { t: number; id: number }) {
  return request({
    url: '/album/sub',
    method: 'post',
    params
  });
}

/**
 * 获取历史日推可用日期列表
 */
export function getHistoryRecommendDates() {
  return request({
    url: '/history/recommend/songs',
    method: 'get'
  });
}

/**
 * 获取历史日推详情数据
 * @param date 日期，格式：YYYY-MM-DD
 */
export function getHistoryRecommendSongs(date: string) {
  return request({
    url: '/history/recommend/songs/detail',
    method: 'get',
    params: { date }
  });
}

/**
 * 心动模式/智能播放
 * @param params id: 歌曲id, pid: 歌单id, sid: 要开始播放的歌曲id(可选)
 */
export function getIntelligenceList(params: { id: number; pid: number; sid?: number }) {
  return request({
    url: '/playmode/intelligence/list',
    method: 'get',
    params
  });
}
