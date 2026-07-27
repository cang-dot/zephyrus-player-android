/**
 * 本地歌单 Store
 *
 * 管理附加到网易云歌单的本地歌曲（本地文件、云端托管、跨平台歌曲）
 * 这些歌曲仅在本地展示，不会同步到网易云
 * 使用 localStorage 持久化
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { SongResult } from '@/types/music';

/** 本地歌单条目 */
interface LocalPlaylistEntry {
  /** 对应的网易云歌单 ID */
  neteaseId: number;
  /** 歌单名称 */
  name: string;
  /** 歌单封面 */
  coverImgUrl?: string;
  /** 本地附加歌曲列表 */
  localSongs: SongResult[];
  /** 最后更新时间 */
  updatedAt: number;
}

const STORAGE_KEY = 'local-playlist-store';

/** 从 localStorage 恢复数据 */
function loadFromStorage(): Map<number, LocalPlaylistEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    const map = new Map<number, LocalPlaylistEntry>();
    for (const [k, v] of Object.entries(obj)) {
      map.set(Number(k), v as LocalPlaylistEntry);
    }
    return map;
  } catch {
    return new Map();
  }
}

/** 持久化到 localStorage */
function saveToStorage(map: Map<number, LocalPlaylistEntry>) {
  try {
    const obj: Record<string, LocalPlaylistEntry> = {};
    map.forEach((v, k) => {
      obj[k] = v;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.error('[LocalPlaylist] 持久化失败:', e);
  }
}

export const useLocalPlaylistStore = defineStore('localPlaylist', () => {
  /** 本地歌单数据（neteasePlaylistId → Entry） */
  const entries = ref<Map<number, LocalPlaylistEntry>>(loadFromStorage());

  /**
   * 获取某网易云歌单的本地附加歌曲
   */
  function getLocalSongs(neteasePlaylistId: number): SongResult[] {
    const entry = entries.value.get(neteasePlaylistId);
    return entry?.localSongs || [];
  }

  /**
   * 添加歌曲到本地歌单
   * @param neteasePlaylistId 网易云歌单 ID
   * @param playlistName 歌单名称
   * @param song 要添加的歌曲
   */
  function addToLocalPlaylist(
    neteasePlaylistId: number,
    playlistName: string,
    song: SongResult
  ): boolean {
    let entry = entries.value.get(neteasePlaylistId);
    if (!entry) {
      entry = {
        neteaseId: neteasePlaylistId,
        name: playlistName,
        localSongs: [],
        updatedAt: Date.now()
      };
      entries.value.set(neteasePlaylistId, entry);
    }

    // 去重（按 id 和 platform 判断）
    const exists = entry.localSongs.some(
      (s) => s.id === song.id && (s.platform || 'netease') === (song.platform || 'netease')
    );
    if (exists) {
      return false; // 已存在
    }

    // 精简存储（只保留必要字段）
    const minifiedSong: SongResult = {
      ...song,
      // 清除大体积字段
      lyric: undefined,
      song: undefined,
      backgroundColor: undefined,
      primaryColor: undefined,
      playLoading: undefined,
      isFirstPlay: undefined
    };

    entry.localSongs.push(minifiedSong);
    entry.updatedAt = Date.now();
    entries.value = new Map(entries.value); // 触发响应式
    saveToStorage(entries.value);
    return true;
  }

  /**
   * 从本地歌单移除歌曲
   */
  function removeFromLocalPlaylist(
    neteasePlaylistId: number,
    songId: string | number,
    platform?: string
  ) {
    const entry = entries.value.get(neteasePlaylistId);
    if (!entry) return;

    entry.localSongs = entry.localSongs.filter(
      (s) =>
        !(
          s.id === songId &&
          (s.platform || 'netease') === (platform || 'netease')
        )
    );
    entry.updatedAt = Date.now();

    // 如果歌单已空，移除整个条目
    if (entry.localSongs.length === 0) {
      entries.value.delete(neteasePlaylistId);
    }

    entries.value = new Map(entries.value);
    saveToStorage(entries.value);
  }

  /**
   * 检查歌曲是否已在本地歌单中
   */
  function isInLocalPlaylist(
    neteasePlaylistId: number,
    songId: string | number,
    platform?: string
  ): boolean {
    const entry = entries.value.get(neteasePlaylistId);
    if (!entry) return false;
    return entry.localSongs.some(
      (s) =>
        s.id === songId && (s.platform || 'netease') === (platform || 'netease')
    );
  }

  /**
   * 获取有本地附加歌曲的歌单 ID 列表
   */
  function getPlaylistIdsWithLocalSongs(): number[] {
    const ids: number[] = [];
    entries.value.forEach((entry, id) => {
      if (entry.localSongs.length > 0) {
        ids.push(id);
      }
    });
    return ids;
  }

  return {
    entries,
    getLocalSongs,
    addToLocalPlaylist,
    removeFromLocalPlaylist,
    isInLocalPlaylist,
    getPlaylistIdsWithLocalSongs
  };
});
