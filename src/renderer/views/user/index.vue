<template>
  <div class="user-page">
    <template v-if="infoLoading">
      <div class="skeleton-wrap">
        <div class="skeleton-card skeleton-shimmer" style="height: 180px" />
        <div class="skeleton-grid">
          <div v-for="i in 4" :key="i" class="skeleton-item skeleton-shimmer" />
        </div>
      </div>
    </template>
    <template v-else>
    <div ref="scrollRef" class="user-scroll" @scroll.passive="onScroll">
      <!-- Sticky morphing hero card -->
        <div v-if="user" class="hero-card" :class="{ compact: isCompact }">
          <div class="hero-bg" />
          <!-- Profile row: avatar + name + signature -->
          <div class="hero-top">
            <div class="avatar-wrap">
              <img
                class="avatar-img"
                :src="getImgUrl(user.avatarUrl, '72y72')"
                alt=""
              />
              <div v-if="currentLoginType" class="login-badge">
                {{ t('login.title.' + currentLoginType) }}
              </div>
            </div>
            <div class="profile-info">
              <h1 class="profile-name">{{ user.nickname }}</h1>
              <p class="profile-signature">{{ userDetail?.profile?.signature || '这个人很懒，什么都没有留下' }}</p>
            </div>
          </div>
          <!-- Stats row: collapses on scroll -->
          <div class="stats-row">
            <div class="stat-item">
              <span class="stat-value">{{ userDetail?.profile?.followeds || 0 }}</span>
              <span class="stat-label">{{ t('user.profile.followers') }}</span>
            </div>
            <div class="stat-divider" />
            <div class="stat-item clickable" @click="showFollowList">
              <span class="stat-value">{{ userDetail?.profile?.follows || 0 }}</span>
              <span class="stat-label">{{ t('user.profile.following') }}</span>
            </div>
            <div class="stat-divider" />
            <div class="stat-item">
              <span class="stat-value">{{ userDetail?.level || 0 }}</span>
              <span class="stat-label">{{ t('user.profile.level') }}</span>
            </div>
          </div>
        <!-- Tab bar: glow tabs, always visible, stays inside the card -->
        <GlowTabs
          v-model="currentTab"
          :tabs="tabs.map(tab => ({ key: tab.key, label: t(tab.label) }))"
          full-width
          class="tab-bar-glow"
        />
        </div>

        <!-- Content area -->
        <div v-if="user" class="content-area" :class="setAnimationClass('animate__fadeIn')">
          <!-- Playlist grid -->
          <div v-if="currentTab !== 'platforms'" class="playlist-grid">
            <button
              v-if="isElectron && currentTab === 'created'"
              class="import-card"
              @click="goToImportPlaylist"
            >
              <div class="import-icon-wrap">
                <i class="ri-add-line" />
              </div>
              <span class="import-label">{{ t('comp.playlist.import.button') }}</span>
            </button>
            <div
              v-for="(item, index) in currentList"
              :key="index"
              class="playlist-card"
              @click="handleItemClick(item)"
            >
              <div class="playlist-cover-wrap">
                <n-image
                  :src="getImgUrl(getCoverUrl(item), '200y200')"
                  class="playlist-cover"
                  lazy
                  preview-disabled
                />
              </div>
              <div class="playlist-info">
                <div class="playlist-name truncate">{{ item.name }}</div>
                <div class="playlist-desc truncate">{{ getItemDescription(item) }}</div>
              </div>
            </div>
          </div>

          <!-- Platform accounts -->
          <PlatformAccounts v-if="currentTab === 'platforms'" />

          <!-- Listen ranking -->
          <div class="ranking-section">
            <h2 class="section-title">{{ t('user.ranking.title') }}</h2>
            <div class="ranking-list">
              <div
                v-for="(item, index) in recordList"
                :key="item.id"
                class="ranking-item"
              >
                <span class="ranking-num">{{ index + 1 }}</span>
                <n-image
                  :src="getImgUrl(item.picUrl || item.al?.picUrl, '40y40')"
                  class="ranking-cover"
                  lazy
                  preview-disabled
                />
                <div class="ranking-info">
                  <div class="ranking-song-name truncate">{{ item.name }}</div>
                  <div class="ranking-artist truncate">{{ getArtistNames(item) }}</div>
                </div>
                <button
                  class="ranking-action"
                  :class="{ fav: isFavorited(item.id) }"
                  @click.stop="toggleFavorite(item)"
                >
                  <i :class="isFavorited(item.id) ? 'ri-heart-3-fill' : 'ri-heart-3-line'" />
                </button>
                <button
                  class="ranking-action"
                  @click.stop="handlePlayRecord(item)"
                >
                  <i class="ri-play-fill" />
                </button>
              </div>
              <div v-if="!recordList || recordList.length === 0" class="ranking-empty">
                {{ t('user.ranking.empty') || '暂无听歌记录' }}
              </div>
            </div>
          </div>
        </div>

        <div class="bottom-spacer" />
        <PlayBottom />
      </div>

      <!-- Login prompt -->
      <div
        v-if="!isLoggedIn"
        class="login-container"
        :class="setAnimationClass('animate__fadeIn')"
      >
        <login-component @login-success="handleLoginSuccess" />
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getUserAlbumSublist, getUserDetail, getUserPlaylist, getUserRecord } from '@/api/user';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlayBottom from '@/components/common/PlayBottom.vue';
import GlowTabs from '@/components/common/GlowTabs.vue';
import PlatformAccounts from '@/components/user/PlatformAccounts.vue';
import { usePlayerStore } from '@/store/modules/player';
import { useUserStore } from '@/store/modules/user';
import { getImgUrl, isElectron, setAnimationClass } from '@/utils';
import { checkLoginStatus as checkAuthStatus } from '@/utils/auth';
import LoginComponent from '@/views/login/index.vue';

defineOptions({ name: 'User' });

const { t } = useI18n();
const userStore = useUserStore();
const playerStore = usePlayerStore();
const router = useRouter();
const { userDetail, recordList } = storeToRefs(userStore);
const infoLoading = ref(false);
const albumLoading = ref(false);
const mounted = ref(true);
const message = useMessage();

const scrollRef = ref<HTMLElement | null>(null);
const isCompact = ref(false);
let rafId = 0;

const onScroll = () => {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    const el = scrollRef.value;
    if (el) {
      isCompact.value = el.scrollTop > 10;
    }
    rafId = 0;
  });
};

const tabs = [
  { key: 'created', label: 'user.tabs.created' },
  { key: 'favorite', label: 'user.tabs.favorite' },
  { key: 'album', label: 'user.tabs.album' },
  { key: 'platforms', label: 'user.tabs.platforms' }
];
const currentTab = ref('created');

const user = computed(() => userStore.user);

const createdPlaylists = computed(() => {
  if (!user.value) return [];
  return userStore.playList.filter((item) => item.creator?.userId === user.value!.userId);
});

const favoritePlaylists = computed(() => {
  if (!user.value) return [];
  return userStore.playList.filter((item) => item.creator?.userId !== user.value!.userId);
});

const currentList = computed(() => {
  if (currentTab.value === 'album') {
    return userStore.albumList;
  }
  return currentTab.value === 'created' ? createdPlaylists.value : favoritePlaylists.value;
});

const getCoverUrl = (item: any) => {
  return item.coverImgUrl || item.picUrl || '';
};

const getItemDescription = (item: any) => {
  if (currentTab.value === 'album') {
    const artist = item.artist?.name || '';
    const size = item.size ? ` · ${item.size}首` : '';
    return `${artist}${size}`;
  } else {
    return `${t('user.playlist.trackCount', { count: item.trackCount })}，${t('user.playlist.playCount', { count: item.playCount })}`;
  }
};

const handleItemClick = (item: any) => {
  if (currentTab.value === 'album') {
    openAlbum(item);
  } else {
    openPlaylist(item);
  }
};

const goToImportPlaylist = () => {
  router.push('/playlist/import');
};

const isFavorited = (songId: number) => {
  return playerStore.favoriteList.some((item: any) => item.id === songId);
};

const toggleFavorite = async (item: any) => {
  const songId = parseInt(item.id);
  if (playerStore.favoriteList.some((s: any) => s.id === songId)) {
    await playerStore.removeFromFavorite(songId);
  } else {
    await playerStore.addToFavorite(songId);
  }
};

const getArtistNames = (item: any) => {
  if (item.ar) return item.ar.map((a: any) => a.name).join(', ');
  if (item.artists) return item.artists.map((a: any) => a.name).join(', ');
  return '';
};

const handlePlayRecord = (item: any) => {
  const tracks = recordList.value || [];
  playerStore.setPlayList(tracks);
  playerStore.setPlay(item);
};

onBeforeUnmount(() => {
  mounted.value = false;
});

const checkLoginStatus = () => {
  if (userStore.user && userStore.loginType) {
    return true;
  }
  const loginInfo = checkAuthStatus();
  if (!loginInfo.isLoggedIn) {
    return false;
  }
  return true;
};

const loadPage = async () => {
  if (!mounted.value) return;
  if (!checkLoginStatus()) return;
  await loadData();
};

const loadData = async () => {
  try {
    if (!userDetail.value || !recordList.value?.length) {
      infoLoading.value = true;
    }
    if (!user.value) {
      console.warn('用户数据不存在，尝试重新获取');
      return;
    }
    const promises = [getUserDetail(user.value.userId), getUserRecord(user.value.userId)];
    if (userStore.playList.length === 0) {
      promises.push(getUserPlaylist(user.value.userId));
    }
    const results = await Promise.all(promises);
    if (!mounted.value) return;
    userDetail.value = results[0].data;
    const recordData = results[1].data;
    const recordListData = recordData?.allData || recordData?.weekData || [];
    recordList.value = recordListData.map((item: any) => ({
      ...item,
      ...(item.song || {}),
      picUrl: item.song?.al?.picUrl || item.picUrl || ''
    }));
    if (results.length > 2 && results[2].data?.playlist) {
      userStore.playList = results[2].data.playlist;
    }
  } catch (error: any) {
    console.error('加载用户页面失败:', error);
    if (error.response?.status === 401 || error.response?.status === 301) {
      userStore.handleLogout();
      router.push('/login');
    } else {
      message.error(t('user.message.loadFailed'));
    }
  } finally {
    if (mounted.value) {
      infoLoading.value = false;
    }
  }
};

const loadAlbumList = async () => {
  if (userStore.albumList.length > 0) return;
  try {
    albumLoading.value = true;
    const res = await getUserAlbumSublist({ limit: 100, offset: 0 });
    if (!mounted.value) return;
    userStore.albumList = res.data.data || [];
  } catch (error: any) {
    console.error('加载专辑列表失败:', error);
    message.error('加载专辑列表失败');
  } finally {
    if (mounted.value) {
      albumLoading.value = false;
    }
  }
};

watch(
  () => router.currentRoute.value.path,
  (newPath) => {
    if (newPath === '/user') {
      checkLoginStatus();
      loadData();
    }
  }
);

watch(
  () => userStore.user,
  (newUser) => {
    if (!mounted.value) return;
    if (newUser) {
      checkLoginStatus();
      loadPage();
    }
  }
);

watch(currentTab, async (newTab) => {
  if (newTab === 'album') {
    await userStore.initializeCollectedAlbums();
    if (userStore.albumList.length === 0) {
      loadAlbumList();
    }
  }
});

onMounted(() => {
  checkLoginStatus() && loadData();
});

const openPlaylist = (item: any) => {
  navigateToMusicList(router, {
    id: item.id,
    type: 'playlist',
    name: item.name,
    listInfo: item,
    canRemove: true
  });
};

const openAlbum = async (item: any) => {
  navigateToMusicList(router, {
    id: item.id,
    type: 'album',
    name: item.name,
    listInfo: {
      ...item,
      coverImgUrl: item.picUrl || item.coverImgUrl
    },
    canRemove: false
  });
};

const showFollowList = () => {
  if (!user.value) return;
  router.push('/user/follows');
};

const handleLoginSuccess = () => {
  checkLoginStatus();
  loadData();
};

const isLoggedIn = computed(() => userStore.user);
const currentLoginType = computed(() => userStore.loginType);
</script>

<style lang="scss" scoped>
.user-page {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: var(--cover-bg, var(--m-bg, var(--bg-color)));
}

.user-scroll {
width: 100%;
height: 100%;
overflow-y: auto;
overflow-x: hidden;
-webkit-overflow-scrolling: touch;
scrollbar-width: none;
/* 为固定悬浮卡片留出空间 */
padding-top: calc(var(--safe-area-inset-top, 0px) + 280px);
&::-webkit-scrollbar { display: none; }
}

/* Skeleton */
.skeleton-wrap { padding: 16px; }
.skeleton-card { border-radius: 20px; margin-bottom: 16px; }
.skeleton-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
  .skeleton-item { height: 200px; border-radius: 16px; }
}

/* Safe area spacer */
.safe-top {
  height: 0;
  display: none;
}

/* ========================================
   Hero Card — the morphing floating card
   One element that transforms on scroll.
   No new elements created.
   ======================================== */
.hero-card {
position: fixed;
top: calc(var(--safe-area-inset-top, 0px) + 52px);
left: 16px;
right: 16px;
z-index: 50;
border-radius: 22px;
overflow: hidden;
transition: border-radius 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
            box-shadow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
            top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  &.compact {
    border-radius: 18px;
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.08);
    top: calc(var(--safe-area-inset-top, 0px) + 56px);
  }
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--cover-surface, rgba(255, 255, 255, 0.55));
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  opacity: 1;
  transition: opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  .hero-card.compact & {
    opacity: 1;
  }
}

/* Profile row: avatar + name + signature */
.hero-top {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 20px 12px;
  transition: padding 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
              gap 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  .hero-card.compact & {
    padding: 10px 16px 8px;
    gap: 10px;
  }
}

.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.avatar-img {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
              height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  .hero-card.compact & {
    width: 36px;
    height: 36px;
  }
}

.login-badge {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 9px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
  background: var(--accent-color, #888);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: opacity 0.2s ease,
              transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  .hero-card.compact & {
    opacity: 0;
    transform: translateX(-50%) scale(0.3);
  }
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-name {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--cover-text-primary, var(--m-text-primary, var(--text-color, #2c2c2c)));
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: font-size 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  .hero-card.compact & {
    font-size: 17px;
    font-weight: 600;
  }
}

.profile-signature {
  font-size: 13px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  margin: 4px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 1;
  max-height: 20px;
  transition: opacity 0.25s ease,
              max-height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
              margin-top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  .hero-card.compact & {
    opacity: 0;
    max-height: 0;
    margin-top: 0;
  }
}

/* Stats row — fades out and collapses */
.stats-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0;
  padding: 10px 20px;
  border-top: 1px solid var(--cover-border, rgba(128, 128, 128, 0.1));
  opacity: 1;
  max-height: 80px;
  overflow: hidden;
  transition: opacity 0.25s ease,
              max-height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
              padding-top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
              padding-bottom 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
              border-color 0.3s ease;

  .hero-card.compact & {
    opacity: 0;
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    border-color: transparent;
  }
}

.stat-item {
  flex: 1;
  text-align: center;
  &.clickable { cursor: pointer; }
}

.stat-value {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: var(--cover-text-primary, var(--m-text-primary, var(--text-color, #2c2c2c)));
}

.stat-label {
  display: block;
  font-size: 11px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  margin-top: 2px;
}

.stat-divider {
  width: 1px;
  height: 24px;
  background: var(--cover-border, rgba(128, 128, 128, 0.15));
}

/* Tab bar — glow tabs, stays inside the card */
.tab-bar-glow {
  margin: 4px 4px 8px;
  transition: margin 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  .hero-card.compact & {
    margin: 0 16px 6px;
  }
}

/* Content area */
.content-area {
  padding: 0 16px;
}

/* Playlist grid */
.playlist-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.import-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  &:active { transform: scale(0.96); }
}

.import-icon-wrap {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: var(--cover-surface-alt, rgba(128, 128, 128, 0.08));
  font-size: 32px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  transition: background 0.2s ease;
}

.import-card:hover .import-icon-wrap {
  background: var(--cover-surface-hover, rgba(128, 128, 128, 0.12));
}

.import-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--cover-text-secondary, var(--m-text-secondary, #6b6560));
  text-align: center;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-card {
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  &:active { transform: scale(0.96); }
}

.playlist-cover-wrap {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 12px var(--cover-shadow, rgba(0, 0, 0, 0.06));
}

.playlist-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  :deep(img) { width: 100%; height: 100%; object-fit: cover; }
}

.playlist-info {
  margin-top: 8px;
}

.playlist-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--cover-text-primary, var(--m-text-primary, var(--text-color, #2c2c2c)));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-desc {
  font-size: 11px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Ranking section */
.ranking-section {
  margin-top: 8px;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--cover-text-primary, var(--m-text-primary, var(--text-color, #2c2c2c)));
  margin: 0 0 12px;
}

.ranking-list {
  display: flex;
  flex-direction: column;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: var(--cover-surface-hover, rgba(128, 128, 128, 0.06));
  }
}

.ranking-num {
  width: 24px;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  flex-shrink: 0;
}

.ranking-cover {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  :deep(img) { width: 100%; height: 100%; object-fit: cover; }
}

.ranking-info {
  flex: 1;
  min-width: 0;
}

.ranking-song-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--cover-text-primary, var(--m-text-primary, var(--text-color, #2c2c2c)));
}

.ranking-artist {
  font-size: 12px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  margin-top: 2px;
}

.ranking-action {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &.fav {
    color: #ef4444;
  }

  &:active {
    transform: scale(0.88);
  }
}

.ranking-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  font-size: 14px;
}

/* Login container */
.login-container {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.bottom-spacer {
  height: calc(var(--safe-area-inset-bottom, 0px) + 140px);
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--cover-surface-alt, rgba(128, 128, 128, 0.08)) 25%,
    var(--cover-surface-hover, rgba(128, 128, 128, 0.12)) 50%,
    var(--cover-surface-alt, rgba(128, 128, 128, 0.08)) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-card,
  .hero-top,
  .avatar-img,
  .profile-name,
  .profile-signature,
  .stats-row,
  .tab-bar-glow {
    transition: none;
  }
}
</style>
