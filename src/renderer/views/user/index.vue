<template>
  <div class="user-page">
    <template v-if="infoLoading">
      <div class="skeleton-wrap">
        <!-- Hero card skeleton -->
        <div class="skel-hero-card">
          <div class="skel-hero-top">
            <div class="skel-avatar">
              <i class="ri-loader-4-line skel-spin" />
            </div>
            <div class="skel-profile">
              <div class="skel-text-mask skel-name" />
              <div class="skel-text-mask skel-sig" />
            </div>
          </div>
          <div class="skel-stats-row">
            <div class="skel-text-mask skel-stat" />
            <div class="skel-text-mask skel-stat" />
            <div class="skel-text-mask skel-stat" />
          </div>
          <div class="skel-tab-bar">
            <div class="skel-text-mask skel-tab" />
            <div class="skel-text-mask skel-tab" />
            <div class="skel-text-mask skel-tab" />
          </div>
        </div>
        <!-- Playlist grid skeleton -->
        <div class="skel-grid">
          <div v-for="i in 4" :key="i" class="skel-playlist-card">
            <div class="skel-cover">
              <i class="ri-music-2-line skel-spin" />
            </div>
            <div class="skel-text-mask skel-pl-name" />
            <div class="skel-text-mask skel-pl-desc" />
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <div ref="scrollRef" class="user-scroll" :class="{ 'picker-open': showAccountOverlay }" @scroll.passive="onScroll">
        <!-- Sticky morphing hero card -->
        <div
          v-if="user"
          class="hero-card"
          :class="{ compact: isCompact, 'account-picker-open': showAccountOverlay }"
        >
          <div class="hero-bg" />
          <!-- Profile row: avatar + name + signature (stays sharp) -->
          <div class="hero-top">
            <div
              class="avatar-wrap"
              :class="{ 'is-long-pressing': isLongPressing }"
              @pointerdown="startAvatarPress"
              @pointermove="moveAvatarPress"
              @pointerup="finishAvatarPress"
              @pointercancel="finishAvatarPress"
            >
              <img
                v-if="user.avatarUrl"
                class="avatar-img"
                :src="getImgUrl(user.avatarUrl, '72y72')"
                alt=""
              />
              <div v-else class="avatar-placeholder">
                <i class="ri-user-3-line" />
              </div>
              <div v-if="loginBadgeText" class="login-badge">
                {{ loginBadgeText }}
              </div>
              <!-- 长按提示 -->
              <div v-if="accounts.length > 1" class="long-press-hint">
                <i class="ri-arrow-up-s-line" />
              </div>
            </div>
            <div class="profile-info">
              <h1 class="profile-name">{{ user.nickname }}</h1>
              <p class="profile-signature">
                {{ userDetail?.profile?.signature || '这个人很懒，什么都没有留下' }}
              </p>
            </div>
          </div>

          <!-- 内联账号切换列表：长按后从下方渐显，卡片向下拉长 -->
          <div class="account-picker-inline" :class="{ open: showAccountOverlay }">
            <button
              v-for="account in otherAccounts"
              :key="account.accountId"
              type="button"
              class="account-picker-row"
              @click="selectAccountInline(account)"
            >
              <div class="account-picker-avatar-wrap">
                <img
                  v-if="account.avatarUrl"
                  :src="account.avatarUrl"
                  alt=""
                  class="account-picker-avatar"
                />
                <div v-else class="account-picker-avatar-placeholder">
                  <i class="ri-user-3-line" />
                </div>
                <span class="account-picker-badge">
                  <platform-logo :platform="account.platform" :size="12" />
                </span>
              </div>
              <div class="account-picker-info">
                <span class="account-picker-name">{{ account.nickname }}</span>
                <span class="account-picker-desc">{{ platformName(account.platform) }}{{ account.vip ? ' · ' + (account.vipLabel || 'VIP') : '' }}</span>
              </div>
            </button>
            <button type="button" class="account-picker-add" @click="goToLogin">
              <i class="ri-add-line" />
              <span>{{ t('user.accountSwitcher.addAccount') }}</span>
            </button>
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
          <glow-tabs
            v-model="currentTab"
            :tabs="visibleTabs.map((tab) => ({ key: tab.key, label: t(tab.label) }))"
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
              :class="{ 'is-opening': openingPlaylistId === String(item.id) }"
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
          <platform-accounts v-if="currentTab === 'platforms'" />

          <!-- Listen ranking -->
          <div v-if="currentTab !== 'platforms'" class="ranking-section">
            <h2 class="section-title">{{ t('user.ranking.title') }}</h2>
            <div class="ranking-list">
              <div v-for="(item, index) in displayRecordList" :key="item.id" class="ranking-item">
                <span class="ranking-num">{{ index + 1 }}</span>
                <song-item class="ranking-song-item" :item="item" mini @play="handlePlayRecord" />
              </div>
              <div v-if="!displayRecordList.length" class="ranking-empty">
                {{ t('user.ranking.empty') || '暂无听歌记录' }}
              </div>
            </div>
          </div>
        </div>

        <div class="bottom-spacer" />
        <play-bottom />
      </div>

      <!-- 点击遮罩关闭账号选择 -->
      <div
        v-if="showAccountOverlay"
        class="account-picker-backdrop"
        @click="showAccountOverlay = false"
      />

      <!-- Login prompt -->
      <div v-if="!isLoggedIn" class="login-container" :class="setAnimationClass('animate__fadeIn')">
        <login-component @login-success="handleLoginSuccess" />
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { resolveNeteaseMatch } from '@/api/kugouPlayback';
import { fetchPlatformAccountData, fetchPlatformPlaylistTracks } from '@/api/platformQrApi';
import { getUserAlbumSublist, getUserDetail, getUserPlaylist, getUserRecord } from '@/api/user';
import playlistPlaceholder from '@/assets/icon_512.png';
import GlowTabs from '@/components/common/GlowTabs.vue';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlayBottom from '@/components/common/PlayBottom.vue';
import SongItem from '@/components/common/SongItem.vue';
import PlatformLogo from '@/components/common/PlatformLogo.vue';
import PlatformAccounts from '@/components/user/PlatformAccounts.vue';
import { useMusicStore } from '@/store/modules/music';
import { type MusicPlatform, type PlatformAccount, usePlatformAccountsStore } from '@/store/modules/platformAccounts';
import { usePlayerStore } from '@/store/modules/player';
import { useUserStore } from '@/store/modules/user';
import { getImgUrl, isElectron, setAnimationClass } from '@/utils';
import { checkLoginStatus as checkAuthStatus } from '@/utils/auth';
import LoginComponent from '@/views/login/index.vue';

defineOptions({ name: 'User' });

const { t } = useI18n();
const userStore = useUserStore();
const accountStore = usePlatformAccountsStore();
const musicStore = useMusicStore();
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

// ===== 长按头像弹出账号切换 =====
const showAccountOverlay = ref(false);
const isLongPressing = ref(false);
let avatarPressTimer: ReturnType<typeof setTimeout> | null = null;
let avatarPressStartX = 0;
let avatarPressStartY = 0;
let avatarPressMoved = false;

const AVATAR_LONG_PRESS_MS = 500;
const AVATAR_PRESS_THRESHOLD = 10;

const clearAvatarPressTimer = () => {
  if (avatarPressTimer) {
    clearTimeout(avatarPressTimer);
    avatarPressTimer = null;
  }
};

const startAvatarPress = (event: PointerEvent) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  avatarPressStartX = event.clientX;
  avatarPressStartY = event.clientY;
  avatarPressMoved = false;
  clearAvatarPressTimer();
  avatarPressTimer = setTimeout(() => {
    if (!avatarPressMoved && accounts.value.length > 1) {
      isLongPressing.value = true;
      // 触觉反馈
      if (navigator.vibrate) navigator.vibrate(15);
      showAccountOverlay.value = true;
      // 阻止页面滚动
      if (scrollRef.value) scrollRef.value.style.overflow = 'hidden';
    }
  }, AVATAR_LONG_PRESS_MS);
};

const moveAvatarPress = (event: PointerEvent) => {
  if (Math.hypot(event.clientX - avatarPressStartX, event.clientY - avatarPressStartY) > AVATAR_PRESS_THRESHOLD) {
    avatarPressMoved = true;
    clearAvatarPressTimer();
  }
};

const finishAvatarPress = () => {
  clearAvatarPressTimer();
  // 延迟重置以允许点击事件正常处理
  setTimeout(() => {
    isLongPressing.value = false;
  }, 100);
};

// 关闭账号选择时恢复滚动
watch(showAccountOverlay, (visible) => {
  if (!visible && scrollRef.value) {
    scrollRef.value.style.overflow = '';
  }
});

const handleOverlaySelect = (account: PlatformAccount) => {
  handleAccountChange(account);
};

const otherAccounts = computed(() =>
  accounts.value.filter((a) => a.accountId !== activeAccountId.value)
);

const PLATFORM_NAMES: Record<MusicPlatform, string> = {
  netease: '网易云',
  qq: 'QQ 音乐',
  kugou: '酷狗音乐',
  spotify: 'Spotify'
};

const platformName = (platform: MusicPlatform) => PLATFORM_NAMES[platform] || platform;

const selectAccountInline = (account: PlatformAccount) => {
  showAccountOverlay.value = false;
  handleAccountChange(account);
};

const goToLogin = () => {
  showAccountOverlay.value = false;
  router.push('/login');
};

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

const { accounts, activeAccountId, activeAccount, activeAccountCache } = storeToRefs(accountStore);
const activePlatform = computed(() => activeAccount.value?.platform || 'netease');
const visibleTabs = computed(() =>
  tabs.filter((tab) => tab.key !== 'album' || activePlatform.value !== 'kugou')
);
const user = computed(() => {
  if (activeAccount.value) {
    return {
      userId: Number(activeAccount.value.userId) || activeAccount.value.userId,
      nickname: activeAccount.value.nickname,
      avatarUrl: activeAccount.value.avatarUrl,
      vipType: activeAccount.value.vip ? 11 : 0
    };
  }
  return userStore.user;
});

const cachedPlaylists = computed(() => (activeAccountCache.value?.playlists || []) as any[]);
const cachedFavorites = computed(() => (activeAccountCache.value?.favorites || []) as any[]);
const cachedAlbums = computed(() => (activeAccountCache.value?.albums || []) as any[]);
const displayRecordList = computed(() => {
  if (activePlatform.value === 'netease') return recordList.value;
  return (activeAccountCache.value?.history || []) as any[];
});

const createdPlaylists = computed(() => {
  if (!user.value) return [];
  if (activePlatform.value !== 'netease') return cachedPlaylists.value;
  return userStore.playList.filter((item) => item.creator?.userId === user.value!.userId);
});

const favoritePlaylists = computed(() => {
  if (!user.value) return [];
  if (activePlatform.value === 'kugou') {
    const merged = [...cachedFavorites.value, ...cachedAlbums.value];
    return merged.filter(
      (item, index, list) =>
        list.findIndex((candidate) => String(candidate.id) === String(item.id)) === index
    );
  }
  if (activePlatform.value !== 'netease') return cachedFavorites.value;
  return userStore.playList.filter((item) => item.creator?.userId !== user.value!.userId);
});

const currentList = computed(() => {
  if (currentTab.value === 'created') {
    return createdPlaylists.value;
  }
  if (currentTab.value === 'album') {
    return activePlatform.value === 'netease' ? userStore.albumList : cachedAlbums.value;
  }
  return currentTab.value === 'created' ? createdPlaylists.value : favoritePlaylists.value;
});

const getCoverUrl = (item: any) => {
  const coverUrl = item.coverImgUrl || item.picUrl || '';
  if (coverUrl) return coverUrl;

  const trackCount = Number(item.trackCount ?? item.songCount ?? item.count ?? 0);
  return trackCount === 0 ? playlistPlaceholder : '';
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

const handlePlayRecord = (item: any) => {
  const tracks = displayRecordList.value || [];
  playerStore.setPlayList(tracks);
  playerStore.setPlay(item);
};

const handleAccountChange = async (account: PlatformAccount) => {
  // 先切换 store 中的活跃账号
  accountStore.setActiveAccount(account.accountId);

  userDetail.value = null;
  recordList.value = [];

  if (account.platform === 'netease') {
    userStore.setUser({
      userId: Number(account.userId) || 0,
      nickname: account.nickname,
      avatarUrl: account.avatarUrl,
      vipType: account.vip ? 11 : 0
    });
    userStore.setLoginType(account.loginMethod);
  }

  await loadData();
};

onBeforeUnmount(() => {
  mounted.value = false;
  clearAvatarPressTimer();
});

const checkLoginStatus = () => {
  if (accounts.value.length > 0 || (userStore.user && userStore.loginType)) {
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

let platformDataRequestId = 0;
const platformDataRequests = new Map<string, Promise<void>>();
const platformPlaylistTracksCache = new Map<string, any[]>();
const openingPlaylistId = ref<string | null>(null);

const loadPlatformAccountData = async (account: PlatformAccount) => {
  const pendingRequest = platformDataRequests.get(account.accountId);
  if (pendingRequest) return pendingRequest;

  const request = loadPlatformAccountDataInternal(account);
  platformDataRequests.set(account.accountId, request);
  try {
    await request;
  } finally {
    if (platformDataRequests.get(account.accountId) === request) {
      platformDataRequests.delete(account.accountId);
    }
  }
};

const loadPlatformAccountDataInternal = async (account: PlatformAccount) => {
  const requestId = ++platformDataRequestId;
  const cachedData = accountStore.activeAccountCache;
  recordList.value = (cachedData?.history || []) as any[];

  if (!account.cookie || (account.platform !== 'qq' && account.platform !== 'kugou')) {
    return;
  }

  try {
    const data = await fetchPlatformAccountData(account.platform, account.cookie);
    if (
      !mounted.value ||
      requestId !== platformDataRequestId ||
      activeAccountId.value !== account.accountId
    ) {
      return;
    }

    const userInfo = data.userInfo || {};
    const nextUserId = String(userInfo.userId || account.userId);
    const nextNickname = userInfo.nickname || account.nickname;
    const nextAvatarUrl = userInfo.avatarUrl || account.avatarUrl;
    const nextVip = userInfo.vip == null ? account.vip : Boolean(userInfo.vip);
    const nextVipLabel = userInfo.vipLabel || account.vipLabel;
    const profileChanged =
      nextUserId !== account.userId ||
      nextNickname !== account.nickname ||
      nextAvatarUrl !== account.avatarUrl ||
      nextVip !== account.vip ||
      nextVipLabel !== account.vipLabel;

    if (profileChanged) {
      accountStore.addOrUpdateAccount({
        accountId: account.accountId,
        platform: account.platform,
        userId: nextUserId,
        nickname: nextNickname,
        avatarUrl: nextAvatarUrl,
        vip: nextVip,
        vipLabel: nextVipLabel,
        cookie: account.cookie,
        loginMethod: account.loginMethod
      });
    }

    accountStore.cacheAccountData(account.accountId, 'playlists', data.playlists);
    accountStore.cacheAccountData(account.accountId, 'favorites', data.favorites);
    accountStore.cacheAccountData(account.accountId, 'albums', data.albums);
    accountStore.cacheAccountData(account.accountId, 'history', data.history);
    recordList.value = data.history;
  } catch (error: any) {
    console.error(`${account.platform} 账号数据加载失败:`, error);
    const hasCachedData = Boolean(
      cachedData?.playlists?.length || cachedData?.favorites?.length || cachedData?.history?.length
    );
    if (!hasCachedData && mounted.value && requestId === platformDataRequestId) {
      message.error(error?.message || `${account.nickname} 的账号数据加载失败`);
    }
  }
};

/**
 * QQ/酷狗歌曲没有封面时，用「歌手+歌名」匹配网易云并补上封面
 */
const enrichSongsWithNeteaseCover = async (songs: any[]): Promise<any[]> => {
  // 酷狗/QQ 的 CDN 封面不带 CORS 头，crossorigin 加载会变黑图，
  // 因此只要有网易云匹配结果就用网易云封面（网易云 CDN 带 CORS）。
  const needCover = songs.filter((song) => {
    const pic = song?.picUrl || song?.al?.picUrl || '';
    return !pic || /y\.gtimg\.cn|imgessl\.kugou\.com|imgcache\.qq\.com/.test(pic);
  });
  if (!needCover.length) return songs;
  let cursor = 0;
  const workers = Array.from({ length: 4 }, async () => {
    while (cursor < needCover.length) {
      const song = needCover[cursor++];
      try {
        const matched = await resolveNeteaseMatch(song);
        if (matched?.picUrl) {
          const index = songs.indexOf(song);
          if (index !== -1) {
            songs[index] = {
              ...song,
              picUrl: matched.picUrl,
              al: { ...(song.al || {}), picUrl: matched.picUrl },
              album: { ...(song.album || {}), picUrl: matched.picUrl }
            };
          }
        }
      } catch {
        // 匹配失败时保持原样
      }
    }
  });
  await Promise.all(workers);
  return songs;
};

const loadData = async () => {
  try {
    if (activePlatform.value === 'netease' && (!userDetail.value || !recordList.value?.length)) {
      infoLoading.value = true;
    }
    if (!user.value) {
      console.warn('用户数据不存在，尝试重新获取');
      return;
    }

    if (activePlatform.value !== 'netease') {
      const account = activeAccount.value;
      if (account) {
        await loadPlatformAccountData(account);
      }
      return;
    }

    const neteaseUserId = Number(user.value.userId);
    const cachedNeteasePlaylists = (activeAccountCache.value?.playlists || []) as any[];
    userStore.playList = cachedNeteasePlaylists;

    const promises = [getUserDetail(neteaseUserId), getUserRecord(neteaseUserId)];
    if (cachedNeteasePlaylists.length === 0) {
      promises.push(getUserPlaylist(neteaseUserId));
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
      if (activeAccountId.value) {
        accountStore.cacheAccountData(activeAccountId.value, 'playlists', results[2].data.playlist);
      }
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
  () => activeAccountId.value,
  (accountId, previousAccountId) => {
    if (!accountId || accountId === previousAccountId) return;
    const account = activeAccount.value;
    if (account) handleAccountChange(account);
  }
);

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
  if (newTab === 'album' && activePlatform.value === 'netease') {
    await userStore.initializeCollectedAlbums();
    if (userStore.albumList.length === 0) {
      loadAlbumList();
    }
  }
});

onMounted(() => {
  checkLoginStatus() && loadData();
  // 默认往下滚动一点，让内容区直接呈现而不是停在 Hero 顶部
  nextTick(() => {
    nextTick(() => {
      if (scrollRef.value) {
        scrollRef.value.scrollTop = 52;
      }
    });
  });
});

const openPlaylist = async (item: any) => {
  const account = activeAccount.value;
  if (account?.platform === 'qq' && account.cookie) {
    const listId = String(item.id || item.tid || item.dirId || item.dirid || '').trim();
    const cacheKey = `${account.accountId}:${listId}`;
    openingPlaylistId.value = String(item.id || listId);
    try {
      // 先进歌单页（显示加载中），再异步拉取曲目与封面
      const cachedSongs = platformPlaylistTracksCache.get(cacheKey);
      musicStore.setCurrentMusicList(cachedSongs || [], item.name, item, false);
      router.push({
        name: 'musicList',
        params: { id: item.id },
        query: { type: 'playlist', from: 'platform' }
      });

      if (!cachedSongs?.length) {
        const result = await fetchPlatformPlaylistTracks('qq', account.cookie, listId);
        let songs = result.songs;
        songs = await enrichSongsWithNeteaseCover(songs);
        platformPlaylistTracksCache.set(cacheKey, songs);
        if (activeAccountId.value !== account.accountId) return;
        if (!songs.length) {
          message.warning('这个 QQ 歌单暂时没有可播放的歌曲');
          return;
        }
        musicStore.setCurrentMusicList(songs, item.name, item, false);
      }
    } catch (error: any) {
      console.error('加载 QQ 歌单失败:', error);
      message.error(error?.message || 'QQ 歌单加载失败');
    } finally {
      openingPlaylistId.value = null;
    }
    return;
  }
  if (account?.platform === 'kugou' && account.cookie) {
    const listId = String(
      item.listId ||
        item.list_id ||
        item.globalCollectionId ||
        item.global_collection_id ||
        item.id ||
        ''
    ).trim();
    const cacheKey = `${account.accountId}:${listId}`;
    openingPlaylistId.value = String(item.id || listId);
    try {
      let songs = platformPlaylistTracksCache.get(cacheKey) || [];
      if (!songs.length) {
        const result = await fetchPlatformPlaylistTracks('kugou', account.cookie, listId);
        songs = result.songs;
        songs = await enrichSongsWithNeteaseCover(songs);
        platformPlaylistTracksCache.set(cacheKey, songs);
      }
      if (activeAccountId.value !== account.accountId) return;
      if (!songs.length) {
        message.warning('这个酷狗歌单暂时没有可播放的歌曲');
        return;
      }
      navigateToMusicList(router, {
        id: item.id,
        type: 'playlist',
        name: item.name,
        songList: songs,
        listInfo: item,
        canRemove: false
      });
    } catch (error: any) {
      console.error('加载酷狗歌单失败:', error);
      message.error(error?.message || '酷狗歌单加载失败');
    } finally {
      openingPlaylistId.value = null;
    }
    return;
  }

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

const isLoggedIn = computed(() => accounts.value.length > 0 || userStore.user);
const currentLoginType = computed(() => activeAccount.value?.loginMethod || userStore.loginType);
const loginBadgeText = computed(() => {
  if (!currentLoginType.value) return '';
  if (activePlatform.value === 'netease') {
    if (currentLoginType.value === 'uid') return 'UID 登录';
    if (currentLoginType.value === 'qr') return '扫码登录';
    return '网易云登录';
  }
  if (currentLoginType.value === 'qr') return '扫码登录';
  if (currentLoginType.value === 'uid') return 'UID 登录';
  return '账号登录';
});

watch(visibleTabs, (nextTabs) => {
  if (!nextTabs.some((tab) => tab.key === currentTab.value)) currentTab.value = 'favorite';
});
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
  padding-top: calc(var(--safe-area-inset-top, 0px) + 336px);
  &::-webkit-scrollbar {
    display: none;
  }
}

/* Skeleton — 新骨架屏：图片转圈 + 文字遮罩 */
.skeleton-wrap {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 16px;
  /* 避开顶栏，与 hero-card 对齐 */
  padding-top: calc(var(--safe-area-inset-top, 0px) + 52px);
  &::-webkit-scrollbar {
    display: none;
  }
}

.skel-hero-card {
  border-radius: 22px;
  padding: 20px;
  margin-bottom: 16px;
  background: var(--cover-surface, var(--d-surface, rgba(255, 255, 255, 0.55)));
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}

.skel-hero-top {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.skel-avatar {
  display: flex;
  width: 64px;
  height: 64px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--cover-surface-alt, rgba(128, 128, 128, 0.08));
  flex-shrink: 0;

  i {
    font-size: 26px;
    color: var(--cover-text-muted, var(--d-text-muted, #9a9590));
  }
}

.skel-profile {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skel-name {
  width: 120px;
  height: 20px;
}

.skel-sig {
  width: 180px;
  height: 14px;
}

.skel-stats-row {
  display: flex;
  gap: 0;
  padding: 10px 0;
  border-top: 1px solid var(--cover-border, rgba(128, 128, 128, 0.1));
  margin-bottom: 12px;
}

.skel-stat {
  flex: 1;
  height: 36px;
  margin: 0 8px;
}

.skel-tab-bar {
  display: flex;
  gap: 8px;
}

.skel-tab {
  flex: 1;
  height: 32px;
  border-radius: 8px;
}

.skel-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.skel-playlist-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skel-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cover-surface-alt, rgba(128, 128, 128, 0.08));

  i {
    font-size: 28px;
    color: var(--cover-text-muted, var(--d-text-muted, #9a9590));
    opacity: 0.5;
  }
}

.skel-pl-name {
  width: 70%;
  height: 13px;
}

.skel-pl-desc {
  width: 50%;
  height: 11px;
}

/* 文字遮罩骨架 — shimmer 渐变扫光 */
.skel-text-mask {
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--cover-surface-alt, rgba(128, 128, 128, 0.08)) 25%,
    var(--cover-surface-hover, rgba(128, 128, 128, 0.14)) 50%,
    var(--cover-surface-alt, rgba(128, 128, 128, 0.08)) 75%
  );
  background-size: 200% 100%;
  animation: skel-shimmer 1.6s ease-in-out infinite;
}

.skel-spin {
  animation: skel-rotate 1.2s linear infinite;
}

@keyframes skel-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@keyframes skel-rotate {
  to {
    transform: rotate(360deg);
  }
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
  transition:
    border-radius 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
    top 260ms cubic-bezier(0.34, 1.56, 0.64, 1);

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
  transition: opacity 220ms cubic-bezier(0.34, 1.56, 0.64, 1);

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
  transition:
    padding 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
    gap 260ms cubic-bezier(0.34, 1.56, 0.64, 1);

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
  transition:
    width 240ms cubic-bezier(0.34, 1.56, 0.64, 1),
    height 240ms cubic-bezier(0.34, 1.56, 0.64, 1);

  .hero-card.compact & {
    width: 36px;
    height: 36px;
  }
}

.avatar-placeholder {
  display: flex;
  width: 64px;
  height: 64px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--cover-surface-alt, var(--d-surface-alt));
  color: var(--accent-color);
  font-size: 24px;
  transition:
    width 220ms cubic-bezier(0.23, 1, 0.32, 1),
    height 220ms cubic-bezier(0.23, 1, 0.32, 1);

  .hero-card.compact & {
    width: 36px;
    height: 36px;
    font-size: 17px;
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
  transition:
    opacity 160ms ease,
    transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);

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
  letter-spacing: 0;
  color: var(--cover-text-primary, var(--m-text-primary, var(--text-color, #2c2c2c)));
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: font-size 240ms cubic-bezier(0.34, 1.56, 0.64, 1);

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
  transition:
    opacity 160ms ease,
    max-height 240ms cubic-bezier(0.34, 1.56, 0.64, 1),
    margin-top 240ms cubic-bezier(0.34, 1.56, 0.64, 1);

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
  transition:
    opacity 200ms ease,
    max-height 240ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
    padding-top 240ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
    padding-bottom 240ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
    border-color 180ms ease;

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
  &.clickable {
    cursor: pointer;
  }
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
  overflow: hidden;
  transition:
    margin 240ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
    opacity 240ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
    max-height 240ms cubic-bezier(0.25, 0.46, 0.45, 0.94);

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

.playlist-platform-tabs {
  grid-column: 1 / -1;
  min-width: 0;
  margin-bottom: 2px;
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
  transition: transform var(--m-duration-press, 90ms) cubic-bezier(0.23, 1, 0.32, 1);
  &:active {
    transform: scale(0.96);
  }
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
  transition: background 160ms ease;
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
  transition: transform var(--m-duration-press, 90ms) cubic-bezier(0.23, 1, 0.32, 1);
  &.is-opening {
    opacity: 0.68;
    transform: scale(0.98);
  }
  &:active {
    transform: scale(0.96);
  }
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
  :deep(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
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
  letter-spacing: 0;
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
  transition: background 160ms ease;

  &:hover {
    background: var(--cover-surface-hover, rgba(128, 128, 128, 0.06));
  }
}

.ranking-song-item {
  min-width: 0;
  flex: 1;
  padding: 4px;
}

.ranking-num {
  width: 24px;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  flex-shrink: 0;
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

/* ===== 长按头像视觉反馈 ===== */
.avatar-wrap {
  touch-action: auto;
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);

  &.is-long-pressing {
    transform: scale(0.92);
  }
}

.long-press-hint {
  position: absolute;
  top: -2px;
  right: -2px;
  display: flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent-color, #888);
  color: #fff;
  font-size: 14px;
  opacity: 0;
  transform: scale(0.5);
  transition:
    opacity 200ms ease,
    transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;

  .hero-card:not(.compact) & {
    opacity: 0.7;
    transform: scale(1);
    animation: long-press-pulse 2s ease-in-out infinite;
  }
}

@keyframes long-press-pulse {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(0.9) translateY(0);
  }
  50% {
    opacity: 0.8;
    transform: scale(1) translateY(-2px);
  }
}

/* ===== 内联账号选择器 ===== */

/* 打开时：统计栏 + 标签栏渐隐收缩，内容区渐隐 */
.hero-card.account-picker-open {
  .stats-row {
    opacity: 0;
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    border-color: transparent;
  }

  .tab-bar-glow {
    opacity: 0;
    max-height: 0;
    margin: 0;
  }
}

.user-scroll.picker-open .content-area {
  opacity: 0.15;
  pointer-events: none;
  transition: opacity 320ms ease;
}

/* 透明遮罩，在 hero-card 下方（z-index 45 < 50），点击卡片外区域关闭 */
.account-picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 45;
}

/* 内联账号列表区域：始终在 DOM 中，用 max-height + opacity 过渡 */
.account-picker-inline {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 20px;
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition:
    max-height 300ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 240ms ease,
    padding 300ms cubic-bezier(0.4, 0, 0.2, 1);

  &.open {
    max-height: 500px;
    opacity: 1;
    padding: 0 20px 12px;
  }
}

.account-picker-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:active {
    transform: scale(0.97);
  }
}

.account-picker-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.account-picker-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.account-picker-avatar-placeholder {
  display: flex;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--cover-surface-hover, rgba(128, 128, 128, 0.08));
  color: var(--accent-color);
  font-size: 20px;
}

.account-picker-badge {
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--cover-surface, var(--d-surface));
  border-radius: 50%;
  background: var(--cover-surface, var(--d-surface));
}

.account-picker-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.account-picker-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--cover-text-primary, var(--d-text-primary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-picker-desc {
  font-size: 12px;
  color: var(--cover-text-muted, var(--d-text-muted));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-picker-add {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:active {
    transform: scale(0.97);
  }

  > i {
    display: flex;
    width: 48px;
    height: 48px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1.5px dashed rgba(var(--accent-color-rgb, 136, 136, 136), 0.35);
    color: var(--accent-color);
    font-size: 20px;
    flex-shrink: 0;
  }

  > span {
    font-size: 14px;
    font-weight: 500;
    color: var(--cover-text-secondary, var(--d-text-secondary));
  }
}

/* 不再使用 Vue Transition，改用 CSS max-height 过渡 */

@media (prefers-reduced-motion: reduce) {
  .hero-card,
  .hero-top,
  .avatar-img,
  .profile-name,
  .profile-signature,
  .stats-row,
  .tab-bar-glow,
  .avatar-placeholder,
  .avatar-wrap,
  .long-press-hint,
  .account-picker-inline {
    transition: none;
  }

  .skel-spin {
    animation-duration: 3s;
  }

  .skel-text-mask {
    animation: none;
  }

  .long-press-hint {
    animation: none;
  }

  .account-picker-row:active,
  .account-picker-add:active {
    transform: none;
  }
}
</style>
