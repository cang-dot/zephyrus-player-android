import axios from 'axios';

import type { Artist, SongResult } from '@/types/music';
import { isSpotifyLoggedIn } from '@/services/spotifyAuth';
import { searchTracks as searchTracksDirect } from '@/services/spotifyApi';

const gatewayBaseURL = (import.meta.env.VITE_MUSIC_GATEWAY || 'https://mucang.xyz/zephyrus/api')
  .replace(/\/+$/, '')
  .replace(/\/platform$/i, '');

interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  duration: number;
  picUrl?: string;
  externalUrl: string;
}

function toArtist(name: string, index: number): Artist {
  return {
    name,
    id: index,
    picId: 0,
    img1v1Id: 0,
    briefDesc: '',
    picUrl: '',
    img1v1Url: '',
    albumSize: 0,
    alias: [],
    trans: '',
    musicSize: 0,
    topicPerson: 0
  };
}

/**
 * 搜索 Spotify 曲库
 *
 * 优先使用 Spotify Web API（需要用户已登录），
 * 未登录时回退到网关代理搜索。
 */
export async function searchSpotifyViaGateway(keyword: string, limit = 20): Promise<SongResult[]> {
  if (!keyword.trim()) return [];

  // 如果用户已登录 Spotify，直接使用 Web API
  if (isSpotifyLoggedIn()) {
    try {
      const results = await searchTracksDirect(keyword, limit);
      if (results.length > 0) return results;
    } catch (error) {
      console.warn('[Spotify] 直接 API 搜索失败，回退到网关:', error);
    }
  }

  // 回退到网关代理
  try {
    const response = await axios.get<{ code: number; data?: { tracks?: SpotifyTrack[] } }>(
      `${gatewayBaseURL}/platform/spotify/search`,
      { params: { keyword, limit }, timeout: 12000 }
    );
    if (response.data.code !== 200) return [];

    return (response.data.data?.tracks || []).map((track) => {
      const artists = track.artists.map(toArtist);
      const album = {
        name: track.album,
        id: 0,
        type: '',
        size: 0,
        picId: 0,
        blurPicUrl: track.picUrl || '',
        companyId: 0,
        pic: 0,
        picUrl: track.picUrl || '',
        publishTime: 0,
        description: '',
        tags: '',
        company: '',
        briefDesc: '',
        artist: artists[0] || toArtist('', 0),
        songs: [],
        alias: [],
        status: 0,
        copyrightId: 0,
        commentThreadId: '',
        artists,
        subType: '',
        transName: null,
        onSale: false,
        mark: 0,
        picId_str: ''
      };
      return {
        id: `spotify:${track.id}`,
        name: track.name,
        picUrl: track.picUrl || '',
        ar: artists,
        artists,
        al: album,
        album,
        count: track.duration,
        duration: track.duration,
        platform: 'spotify',
        platformId: track.id,
        externalUrl: track.externalUrl
      } satisfies SongResult;
    });
  } catch (error) {
    console.warn('[Spotify] 搜索不可用:', error);
    return [];
  }
}

export function openSpotifyTrack(url: string): void {
  if (!url) return;
  if (window.api?.openExternal) {
    void window.api.openExternal(url);
    return;
  }
  if (typeof (window as any).AndroidNative !== 'undefined' && (window as any).AndroidNative.openExternal) {
    (window as any).AndroidNative.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
