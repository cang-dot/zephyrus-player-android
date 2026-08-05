<template>
  <setting-section :title="'Spotify'">
    <!-- 未登录状态 -->
    <div v-if="!spotifyStore.loggedIn" class="spotify-login-section">
      <div class="spotify-brand">
        <div class="spotify-logo">
          <i class="ri-spotify-fill"></i>
        </div>
        <div class="spotify-info">
          <h3 class="spotify-title">Spotify</h3>
          <p class="spotify-desc">
            连接 Spotify 账号，搜索曲库、浏览歌单、播放音乐
          </p>
        </div>
      </div>
      <button
        class="spotify-login-btn"
        :disabled="spotifyStore.authLoading"
        @click="handleLogin"
      >
        <span v-if="spotifyStore.authLoading" class="loading-spinner" />
        <i v-else class="ri-spotify-fill" />
        <span>{{ spotifyStore.authLoading ? '等待授权...' : '使用 Spotify 登录' }}</span>
      </button>
      <p v-if="spotifyStore.authError" class="spotify-error">
        <i class="ri-error-warning-line"></i>
        {{ spotifyStore.authError }}
      </p>
      <p class="spotify-hint">
        <i class="ri-information-line"></i>
        需要 Spotify Premium 订阅才能播放完整歌曲
      </p>
    </div>

    <!-- 已登录状态 -->
    <div v-else class="spotify-profile">
      <!-- 用户信息卡片 -->
      <div class="user-card">
        <img
          v-if="spotifyStore.user?.images?.[0]?.url"
          :src="spotifyStore.user.images[0].url"
          class="user-avatar"
          alt="avatar"
        />
        <div v-else class="user-avatar-placeholder">
          <i class="ri-user-line"></i>
        </div>
        <div class="user-info">
          <div class="user-name">{{ spotifyStore.user?.display_name || 'Spotify 用户' }}</div>
          <div class="user-email">{{ spotifyStore.user?.email || '' }}</div>
          <div class="user-badges">
            <span class="badge" :class="{ premium: spotifyStore.isPremium }">
              <i :class="spotifyStore.isPremium ? 'ri-vip-crown-fill' : 'ri-user-line'" />
              {{ spotifyStore.isPremium ? 'Premium' : 'Free' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 歌单预览 -->
      <div v-if="spotifyStore.playlists.length > 0" class="playlists-preview">
        <div class="section-label">
          <i class="ri-music-2-line"></i>
          <span>我的歌单 ({{ spotifyStore.playlists.length }})</span>
        </div>
        <div class="playlists-list">
          <div
            v-for="pl in spotifyStore.playlists.slice(0, 5)"
            :key="pl.id"
            class="playlist-item"
            @click="openPlaylist(pl)"
          >
            <img
              v-if="pl.images?.[0]?.url"
              :src="pl.images[0].url"
              class="playlist-cover"
              alt="cover"
            />
            <div v-else class="playlist-cover-placeholder">
              <i class="ri-music-2-line"></i>
            </div>
            <div class="playlist-info">
              <div class="playlist-name">{{ pl.name }}</div>
              <div class="playlist-tracks">{{ pl.tracks.total }} 首</div>
            </div>
          </div>
        </div>
        <button v-if="spotifyStore.playlists.length > 5" class="show-more-btn" @click="refreshPlaylists">
          <i class="ri-refresh-line"></i>
          刷新歌单
        </button>
      </div>

      <!-- 操作按钮 -->
      <div class="spotify-actions">
        <button class="action-btn" @click="refreshPlaylists" :disabled="spotifyStore.loadingPlaylists">
          <i class="ri-refresh-line"></i>
          {{ spotifyStore.loadingPlaylists ? '加载中...' : '刷新歌单' }}
        </button>
        <button class="action-btn danger" @click="handleLogout">
          <i class="ri-logout-circle-line"></i>
          退出登录
        </button>
      </div>
    </div>
  </setting-section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useMessage } from 'naive-ui';

import { useSpotifyStore } from '@/store/modules/spotify';
import type { SpotifyPlaylist } from '@/services/spotifyApi';

import SettingSection from '../SettingSection.vue';

const spotifyStore = useSpotifyStore();
const message = useMessage();

onMounted(() => {
  if (spotifyStore.loggedIn && spotifyStore.playlists.length === 0) {
    spotifyStore.fetchPlaylists();
  }
});

function handleLogin() {
  spotifyStore.login();
  message.info('正在跳转到 Spotify 授权页面...');
}

function handleLogout() {
  spotifyStore.logout();
  message.success('已退出 Spotify 登录');
}

function refreshPlaylists() {
  spotifyStore.fetchPlaylists();
}

function openPlaylist(_playlist: SpotifyPlaylist) {
  // 后续可以导航到歌单详情页
  message.info(`歌单「${_playlist.name}」功能开发中`);
}
</script>

<style scoped>
.spotify-login-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  gap: 16px;
}

.spotify-brand {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.spotify-logo {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: #1db954;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: #fff;
}

.spotify-info {
  text-align: left;
}

.spotify-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.spotify-desc {
  font-size: 13px;
  color: var(--m-text-secondary, #999);
  margin: 4px 0 0;
}

.spotify-login-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 32px;
  border-radius: 999px;
  border: none;
  background: #1db954;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.spotify-login-btn:hover:not(:disabled) {
  background: #1ed760;
  transform: scale(1.02);
}

.spotify-login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spotify-error {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #ef4444;
  font-size: 13px;
  margin: 0;
}

.spotify-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--m-text-secondary, #999);
  font-size: 12px;
  margin: 0;
}

/* === 已登录 === */
.spotify-profile {
  padding: 0;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 16px;
  background: var(--m-surface, rgba(0, 0, 0, 0.03));
  margin-bottom: 16px;
}

.user-avatar,
.user-avatar-placeholder {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.user-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  background: #1db954;
  color: #fff;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 2px;
}

.user-email {
  font-size: 13px;
  color: var(--m-text-secondary, #999);
  margin-bottom: 6px;
}

.user-badges {
  display: flex;
  gap: 6px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--m-surface-hover, rgba(0, 0, 0, 0.06));
  color: var(--m-text-secondary, #999);
}

.badge.premium {
  background: rgba(29, 185, 84, 0.12);
  color: #1db954;
}

/* === 歌单预览 === */
.playlists-preview {
  margin-bottom: 16px;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--m-text-primary, #333);
}

.playlists-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.playlist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.playlist-item:hover {
  background: var(--m-surface-hover, rgba(0, 0, 0, 0.04));
}

.playlist-cover,
.playlist-cover-placeholder {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.playlist-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: var(--m-surface-hover, rgba(0, 0, 0, 0.06));
  color: var(--m-text-secondary, #999);
}

.playlist-info {
  flex: 1;
  min-width: 0;
}

.playlist-name {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-tracks {
  font-size: 12px;
  color: var(--m-text-secondary, #999);
}

.show-more-btn {
  width: 100%;
  padding: 8px;
  border: none;
  background: transparent;
  color: var(--m-text-secondary, #999);
  font-size: 13px;
  cursor: pointer;
  border-radius: 8px;
  margin-top: 4px;
}

.show-more-btn:hover {
  background: var(--m-surface-hover, rgba(0, 0, 0, 0.04));
}

/* === 操作 === */
.spotify-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--m-border, rgba(0, 0, 0, 0.08));
  background: transparent;
  color: var(--m-text-primary, #333);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover:not(:disabled) {
  background: var(--m-surface-hover, rgba(0, 0, 0, 0.04));
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.danger {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.2);
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.06);
}
</style>
