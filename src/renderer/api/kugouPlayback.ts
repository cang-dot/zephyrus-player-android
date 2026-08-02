import type { Artist, SongResult } from '@/types/music';

import { getSearch } from './search';

const matchCache = new Map<string, Promise<SongResult | null>>();

const normalizeText = (value: unknown) =>
  String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\.(?:mp3|flac|wav|m4a|aac|ogg|ape)$/i, '')
    .replace(/[\s\-–—_.·•()[\]{}（）【】]/g, '');

const getArtists = (song: any): Artist[] => song?.ar || song?.artists || [];

const toNeteaseSong = (song: any): SongResult => {
  const artists = getArtists(song);
  const album = song.al || song.album || {};
  return {
    ...song,
    id: song.id,
    name: song.name || '未知歌曲',
    picUrl: song.picUrl || album.picUrl || '',
    ar: artists,
    artists,
    al: album,
    album,
    count: 0,
    source: 'netease',
    platform: 'netease'
  } as SongResult;
};

function scoreCandidate(source: SongResult, candidate: any): number {
  const sourceTitle = normalizeText(source.name);
  const candidateTitle = normalizeText(candidate.name);
  if (!sourceTitle || !candidateTitle) return 0;

  let score = 0;
  if (sourceTitle === candidateTitle) score += 70;
  else if (
    sourceTitle.length >= 4 &&
    (candidateTitle.includes(sourceTitle) || sourceTitle.includes(candidateTitle))
  ) {
    score += 45;
  }

  const sourceArtists = getArtists(source)
    .map((artist) => normalizeText(artist.name))
    .filter(Boolean);
  const candidateArtists = getArtists(candidate)
    .map((artist) => normalizeText(artist.name))
    .filter(Boolean);
  if (sourceArtists.length) {
    const artistMatched = sourceArtists.some((sourceArtist) =>
      candidateArtists.some(
        (candidateArtist) =>
          candidateArtist === sourceArtist ||
          candidateArtist.includes(sourceArtist) ||
          sourceArtist.includes(candidateArtist)
      )
    );
    if (artistMatched) score += 30;
  }

  const sourceDuration = Number(source.dt || source.duration || 0);
  const candidateDuration = Number(candidate.dt || candidate.duration || 0);
  if (sourceDuration > 0 && candidateDuration > 0) {
    const difference = Math.abs(sourceDuration - candidateDuration);
    if (difference <= 3000) score += 10;
    else if (difference <= 8000) score += 5;
  }

  const sourceAlbum = normalizeText(source.al?.name || source.album?.name);
  const candidateAlbum = normalizeText(candidate.al?.name || candidate.album?.name);
  if (sourceAlbum && candidateAlbum && sourceAlbum === candidateAlbum) score += 5;

  return score;
}

async function searchKugouSongOnNetease(song: SongResult): Promise<SongResult | null> {
  const artists = getArtists(song)
    .map((artist) => artist.name)
    .filter(Boolean)
    .slice(0, 2);
  const keyword = [artists.join(' '), song.name].filter(Boolean).join(' ').trim();
  if (!keyword) return null;

  const response = await getSearch({ keywords: keyword, type: 1, limit: 8, offset: 0 });
  const candidates = response?.data?.result?.songs;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const best = candidates.reduce((winner: { song: any; score: number } | null, candidate: any) => {
    const score = scoreCandidate(song, candidate);
    return !winner || score > winner.score ? { song: candidate, score } : winner;
  }, null);

  const hasArtist = artists.length > 0;
  const minimumScore = hasArtist ? 85 : 75;
  return best && best.score >= minimumScore ? toNeteaseSong(best.song) : null;
}

export function resolveKugouNeteaseMatch(song: SongResult): Promise<SongResult | null> {
  if (song.platform !== 'kugou') return Promise.resolve(null);
  return resolveNeteaseMatch(song);
}

/**
 * 通用网易云匹配（酷狗/QQ 等平台歌曲用名字+歌手匹配网易云，获取封面与音源）
 */
export function resolveNeteaseMatch(song: SongResult): Promise<SongResult | null> {
  if (!song?.name) return Promise.resolve(null);
  const artistKey = getArtists(song)
    .map((artist) => normalizeText(artist.name))
    .join(',');
  const key = `${normalizeText(song.name)}|${artistKey}`;
  const cached = matchCache.get(key);
  if (cached) return cached;

  const pending = searchKugouSongOnNetease(song).catch((error) => {
    console.warn('[kugouPlayback] 网易云匹配失败:', error);
    matchCache.delete(key);
    return null;
  });
  matchCache.set(key, pending);
  return pending;
}

export function clearKugouMatchCache(): void {
  matchCache.clear();
}
