/**
 * Zephyrus 云端歌曲 API
 *
 * 从服务器 JSON 文件加载云端托管歌曲（封禁歌曲/独立音乐等）
 * 数据格式：songs.json 列出所有可用歌曲，含音频直链、封面、歌词URL、高潮时段
 */

const API_BASE = 'https://www.mucang.xyz';
const SONGS_JSON_URL = `${API_BASE}/server-music/songs.json`;

/** 云端歌曲数据结构 */
export interface ServerSong {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArtist?: string;
  composer?: string;
  genre?: string;
  year?: string;
  track?: string;
  duration: number;
  picUrl: string;
  audioUrl: string;
  lyricsUrl?: string;
  climax?: { start: number; end: number };
}

/** 内存缓存 */
let cachedSongs: ServerSong[] | null = null;

/**
 * 加载云端歌曲列表（带内存缓存）
 */
async function loadServerSongs(): Promise<ServerSong[]> {
  if (cachedSongs) return cachedSongs;

  try {
    const res = await fetch(SONGS_JSON_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cachedSongs = data.songs || [];
    return cachedSongs;
  } catch (err) {
    console.error('[ServerSongs] 加载云端歌曲列表失败:', err);
    return [];
  }
}

/**
 * 搜索云端歌曲
 * @param keyword 搜索关键词
 * @param limit 最大返回数
 */
export async function searchServerSongs(
  keyword: string,
  limit: number = 20
): Promise<ServerSong[]> {
  if (!keyword?.trim()) return [];

  const all = await loadServerSongs();
  const kw = keyword.toLowerCase().trim();

  const matched = all.filter((song) => {
    const nameMatch = song.name.toLowerCase().includes(kw);
    const artistMatch = song.artists.some((a) => a.toLowerCase().includes(kw));
    const albumMatch = song.album?.toLowerCase().includes(kw);
    return nameMatch || artistMatch || albumMatch;
  });

  return matched.slice(0, limit);
}

/**
 * 获取单首云端歌曲详情（含歌词文本）
 */
export async function getServerSongDetail(
  songId: string
): Promise<ServerSong & { lyricsText?: string }> {
  const all = await loadServerSongs();
  const song = all.find((s) => s.id === songId);
  if (!song) throw new Error(`Song not found: ${songId}`);

  // 懒加载歌词文本
  let lyricsText: string | undefined;
  if (song.lyricsUrl) {
    try {
      const res = await fetch(song.lyricsUrl);
      if (res.ok) {
        lyricsText = await res.text();
      }
    } catch {
      // 歌词加载失败不阻塞播放
    }
  }

  return { ...song, lyricsText };
}

/**
 * 清除缓存（用于手动刷新）
 */
export function clearServerSongsCache(): void {
  cachedSongs = null;
}
