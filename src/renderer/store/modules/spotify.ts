/**
 * Spotify Store — Pinia 状态管理
 *
 * 管理：登录状态、用户信息、歌单列表、播放状态
 * 提供：登录/登出、搜索、获取歌单、播放控制
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  getPlaylistTracks,
  getUserPlaylists,
  searchTracks as apiSearchTracks,
  startPlayback,
  pausePlayback,
  skipToNext,
  skipToPrevious,
  seekToPosition,
  getCurrentUser,
  getSavedTracks,
  type SpotifyPlaylist,
  type SpotifyUser
} from '@/services/spotifyApi';
import {
  getValidAccessToken,
  isSpotifyLoggedIn,
  spotifyLogout,
  startSpotifyAuth,
  handleSpotifyCallback
} from '@/services/spotifyAuth';

import type { SongResult } from '@/types/music';

export const useSpotifyStore = defineStore(
  'spotify',
  () => {
    // ==================== 状态 ====================
    const loggedIn = ref(false);
    const user = ref<SpotifyUser | null>(null);
    const isPremium = computed(() => user.value?.product === 'premium');
    const playlists = ref<SpotifyPlaylist[]>([]);
    const loadingPlaylists = ref(false);
    const authLoading = ref(false);
    const authError = ref<string | null>(null);

    // ==================== Actions ====================

    /** 初始化：检查登录状态，如果已登录则获取用户信息 */
    async function init() {
      loggedIn.value = isSpotifyLoggedIn();
      if (loggedIn.value) {
        await fetchUserInfo();
      }
    }

    /** 获取当前登录用户信息 */
    async function fetchUserInfo() {
      try {
        const token = await getValidAccessToken();
        if (!token) {
          loggedIn.value = false;
          return;
        }
        user.value = await getCurrentUser();
        loggedIn.value = true;
      } catch (error) {
        console.error('[Spotify] 获取用户信息失败:', error);
        loggedIn.value = false;
        user.value = null;
      }
    }

    /** 启动 Spotify 登录流程 */
    async function login() {
      authLoading.value = true;
      authError.value = null;
      try {
        await startSpotifyAuth();
      } catch (error) {
        authError.value = error instanceof Error ? error.message : '登录失败';
        authLoading.value = false;
      }
    }

    /** 处理 OAuth 回调（由 Android Native 或 window.__handleSpotifyCallback 触发） */
    async function handleCallback(callbackUrl: string) {
      authLoading.value = true;
      authError.value = null;
      try {
        const success = await handleSpotifyCallback(callbackUrl);
        if (success) {
          loggedIn.value = true;
          await fetchUserInfo();
        } else {
          authError.value = '授权失败';
        }
      } catch (error) {
        authError.value = error instanceof Error ? error.message : '回调处理失败';
      } finally {
        authLoading.value = false;
      }
    }

    /** 登出 */
    function logout() {
      spotifyLogout();
      loggedIn.value = false;
      user.value = null;
      playlists.value = [];
    }

    /** 搜索歌曲 */
    async function search(query: string, limit = 20): Promise<SongResult[]> {
      if (!loggedIn.value) return [];
      try {
        return await apiSearchTracks(query, limit);
      } catch (error) {
        console.error('[Spotify] 搜索失败:', error);
        return [];
      }
    }

    /** 获取用户歌单 */
    async function fetchPlaylists() {
      if (!loggedIn.value) return;
      loadingPlaylists.value = true;
      try {
        playlists.value = await getUserPlaylists();
      } catch (error) {
        console.error('[Spotify] 获取歌单失败:', error);
      } finally {
        loadingPlaylists.value = false;
      }
    }

    /** 获取歌单内的歌曲 */
    async function fetchPlaylistTracks(playlistId: string): Promise<SongResult[]> {
      if (!loggedIn.value) return [];
      try {
        return await getPlaylistTracks(playlistId);
      } catch (error) {
        console.error('[Spotify] 获取歌单曲目失败:', error);
        return [];
      }
    }

    /** 获取收藏的歌曲 */
    async function fetchSavedTracks(limit = 50): Promise<SongResult[]> {
      if (!loggedIn.value) return [];
      try {
        return await getSavedTracks(limit);
      } catch (error) {
        console.error('[Spotify] 获取收藏失败:', error);
        return [];
      }
    }

    // ==================== 播放控制 ====================

    /** 播放指定歌曲 */
    async function playTrack(trackUri: string) {
      if (!isPremium.value) {
        throw new Error('Spotify 播放需要 Premium 订阅');
      }
      await startPlayback(trackUri);
    }

    /** 恢复播放 */
    async function resumePlayback() {
      if (!isPremium.value) return;
      await startPlayback();
    }

    /** 暂停 */
    async function pause() {
      if (!isPremium.value) return;
      await pausePlayback();
    }

    /** 下一首 */
    async function next() {
      if (!isPremium.value) return;
      await skipToNext();
    }

    /** 上一首 */
    async function previous() {
      if (!isPremium.value) return;
      await skipToPrevious();
    }

    /** 跳转到指定位置 */
    async function seek(positionMs: number) {
      if (!isPremium.value) return;
      await seekToPosition(positionMs);
    }

    return {
      // 状态
      loggedIn,
      user,
      isPremium,
      playlists,
      loadingPlaylists,
      authLoading,
      authError,
      // 初始化
      init,
      // 认证
      login,
      handleCallback,
      logout,
      fetchUserInfo,
      // 数据
      search,
      fetchPlaylists,
      fetchPlaylistTracks,
      fetchSavedTracks,
      // 播放
      playTrack,
      resumePlayback,
      pause,
      next,
      previous,
      seek
    };
  },
  {
    persist: {
      key: 'spotify-store',
      storage: localStorage,
      pick: ['loggedIn']
    }
  }
);
