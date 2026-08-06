import { cloneDeep } from 'lodash';
import { createDiscreteApi } from 'naive-ui';

import i18n from '@/../i18n/renderer';
import { isCrossPlatformSong } from '@/api/crossPlatformSearch';
import { type GDMusicLyricResponse, getLyricByPlatform, searchFromGDMusic } from '@/api/gdmusic';
import { resolveKugouNeteaseMatch } from '@/api/kugouPlayback';
import { getMusicLrc, getMusicUrl, getParsingMusicUrl } from '@/api/music';
import { fetchQqLyric } from '@/api/platformQrApi';
import { readProviderLyricCache, writeProviderLyricCache } from '@/api/providerLyricCache';
import { playbackRequestManager } from '@/services/playbackRequestManager';
import { SongSourceConfigManager } from '@/services/SongSourceConfigManager';
import type { ILyric, ILyricText, LyricFormat, LyricSource, SongResult } from '@/types/music';
import { getImgUrl, isElectron } from '@/utils';
import { getImageLinearBackground } from '@/utils/linearColor';
import { mergeAuxiliaryLyrics, parseTimedLyrics } from '@/utils/timedLyrics';

const { message } = createDiscreteApi(['message']);

type DiskCacheResolveResult = {
  url?: string;
  cached?: boolean;
  queued?: boolean;
};

/** 保持 useLyrics().parseLyrics 的旧返回结构，底层统一走新解析器。 */
const parseLyrics = (lyricsString: string): { lyrics: ILyricText[]; times: number[] } => {
  const parsed = parseTimedLyrics(lyricsString);
  return { lyrics: parsed.lrcArray, times: parsed.lrcTimeArray };
};

const getSongArtistText = (songData: SongResult): string => {
  if (songData?.ar?.length) {
    return songData.ar.map((artist) => artist.name).join(' / ');
  }

  if (songData?.song?.artists?.length) {
    return songData.song.artists.map((artist) => artist.name).join(' / ');
  }

  return '';
};

const resolveCachedPlaybackUrl = async (
  url: string | null | undefined,
  songData: SongResult
): Promise<string | null | undefined> => {
  if (!url || !isElectron || !/^https?:\/\//i.test(url)) {
    return url;
  }

  try {
    const result = (await window.electron.ipcRenderer.invoke('resolve-cached-music-url', {
      songId: Number(songData.id),
      source: songData.source,
      url,
      title: songData.name,
      artist: getSongArtistText(songData)
    })) as DiskCacheResolveResult;

    if (result?.url) {
      return result.url;
    }
  } catch (error) {
    console.warn('解析缓存播放地址失败，回退到在线地址:', error);
  }

  return url;
};

/**
 * 获取歌曲播放URL（独立函数）
 */
export const getSongUrl = async (
  id: string | number,
  songData: SongResult,
  isDownloaded: boolean = false,
  requestId?: string
) => {
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

  // 动态导入 settingsStore
  const { useSettingsStore } = await import('@/store/modules/settings');
  const settingsStore = useSettingsStore();

  try {
    // 在开始处理前验证请求
    if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
      throw new Error('Request cancelled');
    }

    if (songData.playMusicUrl) {
      if (isDownloaded) return songData.playMusicUrl;
      return await resolveCachedPlaybackUrl(songData.playMusicUrl, songData);
    }

    // 酷狗歌单通常只提供“歌手 - 歌名.mp3”，优先用拆解后的信息匹配网易云。
    // 保留原始歌曲对象，匹配失败时仍可回退到酷狗音源。
    if (songData.platform === 'kugou' && songData.platformId) {
      try {
        const matchedSong = await resolveKugouNeteaseMatch(songData);
        if (matchedSong) {
          const matchedUrl = await getSongUrl(matchedSong.id, matchedSong, isDownloaded, requestId);
          if (matchedUrl) return matchedUrl;
        }
      } catch (error) {
        if ((error as Error).message === 'Request cancelled') throw error;
        console.warn('[kugouPlayback] 网易云播放地址失败，回退酷狗音源:', error);
      }
    }

    // ==================== 跨平台歌曲专用路径 ====================
    // 跨平台歌曲（非网易云）直接通过 MusicParser 解析，跳过网易云 API
    if (songData.platform && songData.platform !== 'netease' && songData.platformId) {
      const res = await getParsingMusicUrl(numericId || 0, cloneDeep(songData));

      // 验证请求
      if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
        throw new Error('Request cancelled');
      }

      if (res && res.data && res.data.data && res.data.data.url) {
        if (isDownloaded) return res.data.data as any;
        return await resolveCachedPlaybackUrl(res.data.data.url, songData);
      }

      // 跨平台解析失败，抛出错误（无法回退到网易云 API）
      throw new Error('跨平台歌曲解析失败');
    }

    // ==================== 自定义API最优先 ====================
    const globalSources = settingsStore.setData.enabledMusicSources || [];
    const useCustomApiGlobally = globalSources.includes('custom');

    const songConfig = SongSourceConfigManager.getConfig(id);
    const useCustomApiForSong = songConfig?.sources.includes('custom' as any) ?? false;

    // 如果全局或歌曲专属设置中启用了自定义API，则最优先尝试
    if ((useCustomApiGlobally || useCustomApiForSong) && settingsStore.setData.customApiPlugin) {
      try {
        const { parseFromCustomApi } = await import('@/api/parseFromCustomApi');
        const customResult = await parseFromCustomApi(
          numericId,
          cloneDeep(songData),
          settingsStore.setData.musicQuality || 'higher'
        );

        // 验证请求
        if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
          throw new Error('Request cancelled');
        }

        if (
          customResult &&
          customResult.data &&
          customResult.data.data &&
          customResult.data.data.url
        ) {
          if (isDownloaded) return customResult.data.data as any;
          return await resolveCachedPlaybackUrl(customResult.data.data.url, songData);
        } else {
          message.warning(i18n.global.t('player.reparse.customApiFailed'));
        }
      } catch (error) {
        console.error('调用自定义API时发生错误:', error);
        if ((error as Error).message === 'Request cancelled') {
          throw error;
        }
        message.error(i18n.global.t('player.reparse.customApiError'));
      }
    }

    // 如果有自定义音源设置，直接使用getParsingMusicUrl获取URL
    if (songConfig) {
      try {
        const res = await getParsingMusicUrl(numericId, cloneDeep(songData));

        // 验证请求
        if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
          throw new Error('Request cancelled');
        }

        if (res && res.data && res.data.data && res.data.data.url) {
          return await resolveCachedPlaybackUrl(res.data.data.url, songData);
        }
        console.warn('自定义音源解析失败，使用默认音源');
      } catch (error) {
        console.error('error', error);
        if ((error as Error).message === 'Request cancelled') {
          throw error;
        }
        console.error('自定义音源解析出错:', error);
      }
    }

    // 正常获取URL流程
    const { data } = await getMusicUrl(numericId, isDownloaded);

    // 验证请求
    if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
      throw new Error('Request cancelled');
    }

    if (data && data.data && data.data[0]) {
      const songDetail = data.data[0];
      const hasNoUrl = !songDetail.url;
      const isTrial = !!songDetail.freeTrialInfo;

      if (hasNoUrl || isTrial) {
        const res = await getParsingMusicUrl(numericId, cloneDeep(songData));
        // 验证请求
        if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
          throw new Error('Request cancelled');
        }
        if (isDownloaded) return res?.data?.data as any;
        const parsedUrl = res?.data?.data?.url || null;
        return await resolveCachedPlaybackUrl(parsedUrl, songData);
      }

      if (isDownloaded) return songDetail as any;
      return await resolveCachedPlaybackUrl(songDetail.url, songData);
    }

    const res = await getParsingMusicUrl(numericId, cloneDeep(songData));
    // 验证请求
    if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
      throw new Error('Request cancelled');
    }
    if (isDownloaded) return res?.data?.data as any;
    const parsedUrl = res?.data?.data?.url || null;
    return await resolveCachedPlaybackUrl(parsedUrl, songData);
  } catch (error) {
    if ((error as Error).message === 'Request cancelled') {
      throw error;
    }
    console.error('官方API请求失败，进入内置备用解析流程:', error);
    const res = await getParsingMusicUrl(numericId, cloneDeep(songData));
    if (isDownloaded) return res?.data?.data as any;
    const parsedUrl = res?.data?.data?.url || null;
    return await resolveCachedPlaybackUrl(parsedUrl, songData);
  }
};

/**
 * useSongUrl hook（兼容旧代码）
 */
export const useSongUrl = () => {
  return { getSongUrl };
};

async function loadQqProviderLyric(platformId: string): Promise<ILyric | null> {
  const cacheKey = `qq:${platformId}`;
  const cached = await readProviderLyricCache(cacheKey);
  if (cached?.fresh) return cached.lyric;

  try {
    const payload = await fetchQqLyric(platformId);
    if (!payload) return cached?.lyric || null;
    const lyric = parseTimedLyrics(payload.lyric, { format: payload.format, source: 'qq' });
    mergeAuxiliaryLyrics(lyric, payload.translation, 'trText', payload.format);
    mergeAuxiliaryLyrics(lyric, payload.romanization, 'romaText', payload.format);
    if (!lyric.lrcArray.length) return cached?.lyric || null;
    await writeProviderLyricCache(cacheKey, lyric);
    return lyric;
  } catch (error) {
    console.warn('[loadCrossPlatformLyric] QQ QRC 加载失败，使用后备歌词:', error);
    return cached?.lyric || null;
  }
}

function createProviderLyric(
  lyric: string,
  translation: string | undefined,
  romanization: string | undefined,
  format: LyricFormat,
  source: LyricSource
): ILyric {
  const result = parseTimedLyrics(lyric, { format, source });
  mergeAuxiliaryLyrics(result, translation, 'trText', format);
  mergeAuxiliaryLyrics(result, romanization, 'romaText', format);
  return result;
}

/**
 * 加载跨平台歌曲歌词
 *
 * 跨平台歌曲（platform + platformId）无法通过网易云 API 获取歌词，
 * 改用 GD 音乐台获取歌词。
 *
 * 策略：
 * 1. 对于 GD 支持的平台（joox/kuwo/netease），直接用 platformId 获取歌词
 * 2. 对于不支持的平台（qq/migu/kugou），用歌名+歌手在 joox 搜索，
 *    精确匹配后用匹配歌曲的 lyric_id 获取歌词
 *
 * @param song 歌曲数据（包含 platform、platformId、name、ar/artists）
 * @returns 歌词数据，失败返回空歌词
 */
export const loadCrossPlatformLyric = async (song: SongResult): Promise<ILyric> => {
  const emptyLyric: ILyric = { lrcTimeArray: [], lrcArray: [], hasWordByWord: false };

  if (!isCrossPlatformSong(song)) {
    return emptyLyric;
  }

  const platform = song.platform!;
  const platformId = song.platformId!;

  // GD 音乐台直接支持的平台
  const GD_SUPPORTED = ['joox', 'kuwo', 'netease'];

  try {
    let lyricData: GDMusicLyricResponse | null = null;

    if (platform === 'qq') {
      const qqLyric = await loadQqProviderLyric(platformId);
      if (qqLyric?.lrcArray.length) return qqLyric;
    }

    // 1. 直接用 platformId 获取歌词（仅限 GD 支持的平台）
    if (GD_SUPPORTED.includes(platform)) {
      lyricData = await getLyricByPlatform(platform, platformId);
    }

    // 2. 对于不支持的平台，通过搜索匹配后获取歌词
    if (!lyricData) {
      const songName = song.name || '';
      const artistNames = (song.ar || song.artists || []).map((a) => a.name).filter(Boolean);

      if (!songName) {
        return emptyLyric;
      }

      const searchQuery =
        artistNames.length > 0 ? `${songName} ${artistNames.join(' ')}` : songName;

      // 在 joox 搜索，取前 10 条结果做精确匹配
      const items = await searchFromGDMusic('joox', searchQuery, 10, 1);

      if (items && items.length > 0) {
        // 归一化比较
        const normalize = (s: string) =>
          (s || '')
            .toLowerCase()
            .replace(/[\s\-_/\x28\x29\x5b\x5d【】（）.,，。、！？!?;；:：'"`~·]+/g, '')
            .trim();

        const targetName = normalize(songName);
        const targetArtists = artistNames.map(normalize);

        // 找到歌名一致且歌手匹配的结果
        const matched = items.find((item) => {
          const itemName = normalize(item.name);
          if (itemName !== targetName) return false;

          const itemArtists = (item.artist || []).map(normalize);
          // 至少一个歌手匹配
          return targetArtists.some((ta) =>
            itemArtists.some((ia) => ia === ta || ia.includes(ta) || ta.includes(ia))
          );
        });

        if (matched && matched.lyric_id) {
          lyricData = await getLyricByPlatform('joox', String(matched.lyric_id));
        }
      }
    }

    if (!lyricData) {
      console.warn('[loadCrossPlatformLyric] 未获取到歌词:', { platform, platformId });
      return emptyLyric;
    }

    // 解析歌词（复用现有解析逻辑）
    const providerFormat: LyricFormat = lyricData.yrc ? 'yrc' : 'lrc';
    return createProviderLyric(
      lyricData.yrc || lyricData.lyric || '',
      lyricData.tlyric,
      lyricData.yromrc,
      providerFormat,
      'fallback'
    );
  } catch (error) {
    console.error('[loadCrossPlatformLyric] 加载失败:', error);
    return emptyLyric;
  }
};

/**
 * 加载歌词（独立函数）
 */
export const loadLrc = async (id: string | number): Promise<ILyric> => {
  try {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

    // 本地歌曲（字符串 ID，parseInt 返回 NaN）直接返回空，不走网易云 API
    if (typeof id === 'string' && isNaN(numericId)) {
      return { lrcTimeArray: [], lrcArray: [], hasWordByWord: false };
    }

    let lyricData: any;

    if (isElectron) {
      try {
        lyricData = await window.electron.ipcRenderer.invoke('get-cached-lyric', numericId);
      } catch (error) {
        console.warn('读取磁盘歌词缓存失败:', error);
      }
    }

    if (!lyricData) {
      const { data } = await getMusicLrc(numericId);
      lyricData = data;

      if (isElectron && lyricData) {
        void window.electron.ipcRenderer
          .invoke('cache-lyric', numericId, lyricData)
          .catch((error) => console.warn('写入磁盘歌词缓存失败:', error));
      }
    }

    const data = lyricData ?? {};
    const hasYrc = Boolean(data?.yrc?.lyric);
    return createProviderLyric(
      hasYrc ? data.yrc.lyric : data?.lrc?.lyric || '',
      data?.ytlrc?.lyric || data?.tlyric?.lyric,
      data?.yromalrc?.lyric || data?.romalrc?.lyric,
      hasYrc ? 'yrc' : 'lrc',
      'netease'
    );
  } catch (err) {
    console.error('Error loading lyrics:', err);
    return {
      lrcTimeArray: [],
      lrcArray: [],
      hasWordByWord: false
    };
  }
};

/**
 * useLyrics hook（兼容旧代码）
 */
export const useLyrics = () => {
  return { loadLrc, loadCrossPlatformLyric, parseLyrics };
};

/**
 * 获取歌曲详情
 */
export const useSongDetail = () => {
  const { getSongUrl } = useSongUrl();

  const getSongDetail = async (playMusic: SongResult, requestId?: string) => {
    // 验证请求
    if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
      throw new Error('Request cancelled');
    }

    // 云端托管歌曲：已有直链 URL，跳过网易云 URL 获取
    if (playMusic.platform === 'server' && playMusic.playMusicUrl) {
      playMusic.createdAt = Date.now();
      // 云端歌曲不会过期（设为 1 年后）
      playMusic.expiredAt = playMusic.createdAt + 365 * 24 * 3600 * 1000;

      const { backgroundColor, primaryColor } =
        playMusic.backgroundColor && playMusic.primaryColor
          ? playMusic
          : await getImageLinearBackground(getImgUrl(playMusic?.picUrl, '30y30'));

      if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
        throw new Error('Request cancelled');
      }

      playMusic.playLoading = false;
      return {
        ...playMusic,
        playMusicUrl: playMusic.playMusicUrl,
        backgroundColor,
        primaryColor
      } as SongResult;
    }

    if (playMusic.expiredAt && playMusic.expiredAt < Date.now()) {
      // 本地音乐（local:// 协议）不会过期，跳过清除
      if (!playMusic.playMusicUrl?.startsWith('local://')) {
        console.info(`歌曲已过期，重新获取: ${playMusic.name}`);
        playMusic.playMusicUrl = undefined;
      }
    }

    try {
      const playMusicUrl =
        playMusic.playMusicUrl || (await getSongUrl(playMusic.id, playMusic, false, requestId));

      // 验证请求
      if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
        throw new Error('Request cancelled');
      }

      playMusic.createdAt = Date.now();
      // 半小时后过期
      playMusic.expiredAt = playMusic.createdAt + 1800000;
      const { backgroundColor, primaryColor } =
        playMusic.backgroundColor && playMusic.primaryColor
          ? playMusic
          : await getImageLinearBackground(getImgUrl(playMusic?.picUrl, '30y30'));

      // 验证请求
      if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
        throw new Error('Request cancelled');
      }

      playMusic.playLoading = false;
      return { ...playMusic, playMusicUrl, backgroundColor, primaryColor } as SongResult;
    } catch (error) {
      if ((error as Error).message === 'Request cancelled') {
        throw error;
      }
      console.error('获取音频URL失败:', error);
      playMusic.playLoading = false;
      throw error;
    }
  };

  return { getSongDetail };
};
