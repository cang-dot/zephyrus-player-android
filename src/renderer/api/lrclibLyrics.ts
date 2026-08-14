import type { SongResult } from '@/types/music';
import { isUsableLyric } from '@/utils/lyricValidation';
import { parseTimedLyrics } from '@/utils/timedLyrics';

interface LrclibResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

function artistText(song: SongResult): string {
  return (song.ar || song.artists || [])
    .map((artist) => artist.name)
    .filter(Boolean)
    .join(', ');
}

function durationSeconds(song: SongResult): number {
  const value = Number(song.dt || song.duration || 0);
  return value > 1000 ? Math.round(value / 1000) : Math.round(value);
}

export async function fetchLrclibLyric(song: SongResult) {
  if (!song.name) return null;
  const params = new URLSearchParams({
    track_name: song.name,
    artist_name: artistText(song),
    album_name: song.al?.name || song.album?.name || ''
  });
  const duration = durationSeconds(song);
  if (duration > 0) params.set('duration', String(duration));

  try {
    const response = await fetch(`https://lrclib.net/api/get?${params}`);
    if (!response.ok) return null;
    const result = (await response.json()) as LrclibResult;
    if (result.instrumental) return null;
    const content = result.syncedLyrics || result.plainLyrics || '';
    const lyric = parseTimedLyrics(content, { format: 'lrc', source: 'lrclib' });
    return isUsableLyric(lyric) ? lyric : null;
  } catch {
    return null;
  }
}
