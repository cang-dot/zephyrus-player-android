<template>
  <div class="user-page">
    <template v-if="infoLoading">
      <page-loading-placeholder
        class="user-loading-placeholder"
        variant="user"
        :label="t('common.loading')"
      />
    </template>
    <template v-else>
      <div class="user-scroll">
        <!-- Personal center: profile, listening statistics and connected platforms. -->
        <div class="content-area" :class="setAnimationClass('animate__fadeIn')">
          <section ref="profileGlassRef" class="profile-glass" data-no-page-swipe>
            <div
              class="profile-main"
              role="button"
              tabindex="0"
              :aria-label="t('user.profileEdit.title')"
              @click="openProfileEditor"
              @keydown.enter.prevent="openProfileEditor"
              @keydown.space.prevent="openProfileEditor"
            >
              <div class="profile-avatar-button">
                <img
                  v-if="user?.avatarUrl"
                  class="profile-avatar"
                  :src="getImgUrl(user.avatarUrl, '144y144')"
                  :alt="user.nickname"
                />
                <span v-else class="profile-avatar profile-avatar-placeholder">
                  <i class="ri-user-3-line" />
                </span>
              </div>
              <div class="profile-copy">
                <h1>{{ user?.nickname || t('user.accountSwitcher.loginHint') }}</h1>
                <p>{{ displaySignature }}</p>
                <span v-if="user" class="platform-badge">{{ platformName(activePlatform) }}</span>
              </div>
              <i class="ri-arrow-right-s-line profile-entry-arrow" aria-hidden="true" />
            </div>
            <div class="profile-stats">
              <div class="profile-stat-clickable" @click="showFollowerList">
                <strong>{{ userDetail?.profile?.followeds || 0 }}</strong>
                <span>{{ t('user.profile.followers') }}</span>
              </div>
              <div class="profile-stat-clickable" @click="showFollowList">
                <strong>{{ userDetail?.profile?.follows || 0 }}</strong>
                <span>{{ t('user.profile.following') }}</span>
              </div>
              <div>
                <strong>{{ userDetail?.level || 0 }}</strong>
                <span>{{ t('user.profile.level') }}</span>
              </div>
              <div>
                <strong>{{ totalPlayCount }}</strong>
                <span>{{ t('user.statistics.plays') }}</span>
              </div>
            </div>
          </section>

          <section class="ranking-section glass-section">
            <h2 class="section-title">{{ t('user.ranking.title') }}</h2>
            <div class="ranking-list">
              <div
                v-for="(item, index) in displayRecordList.slice(0, 20)"
                :key="`${item.id}-${index}`"
                class="ranking-item"
                role="button"
                tabindex="0"
                @click="handlePlayRecord(item)"
                @keydown.enter.prevent="handlePlayRecord(item)"
              >
                <span class="ranking-num">{{ index + 1 }}</span>
                <song-item
                  class="ranking-song-item"
                  :item="item"
                  mini
                  @click.stop
                  @play="handlePlayRecord"
                />
              </div>
              <div v-if="!displayRecordList.length" class="ranking-empty">
                {{ t('user.ranking.empty') }}
              </div>
            </div>
          </section>
        </div>

        <div class="bottom-spacer" />
        <play-bottom />
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { fetchPlatformAccountData } from '@/api/platformQrApi';
import { getUserDetail, getUserPlaylist, getUserRecord } from '@/api/user';
import PageLoadingPlaceholder from '@/components/common/PageLoadingPlaceholder.vue';
import PlayBottom from '@/components/common/PlayBottom.vue';
import SongItem from '@/components/common/SongItem.vue';
import { platformDisplayName, useLocalProfileStore } from '@/store/modules/localProfile';
import { type PlatformAccount, usePlatformAccountsStore } from '@/store/modules/platformAccounts';
import { usePlayerStore } from '@/store/modules/player';
import { useUserStore } from '@/store/modules/user';
import { getImgUrl, setAnimationClass } from '@/utils';
import { checkLoginStatus as checkAuthStatus } from '@/utils/auth';

defineOptions({ name: 'User' });

const { t } = useI18n();
const userStore = useUserStore();
const accountStore = usePlatformAccountsStore();
const localProfileStore = useLocalProfileStore();
const playerStore = usePlayerStore();
const router = useRouter();
const route = useRoute();
const { userDetail, recordList } = storeToRefs(userStore);
const infoLoading = ref(false);
const mounted = ref(true);
const message = useMessage();
const profileGlassRef = ref<HTMLElement | null>(null);

const { accounts, activeAccountId, activeAccount, activeAccountCache } = storeToRefs(accountStore);
const activePlatform = computed(() => activeAccount.value?.platform || 'netease');

// 显示解耦：离线资料覆盖层 > 激活账号 > 旧版 user store
const user = computed(() => {
  const base = activeAccount.value
    ? {
        userId: Number(activeAccount.value.userId) || activeAccount.value.userId,
        nickname: activeAccount.value.nickname,
        avatarUrl: activeAccount.value.avatarUrl,
        vipType: activeAccount.value.vip ? 11 : 0
      }
    : userStore.user;
  if (!base) return null;
  return {
    ...base,
    nickname: localProfileStore.displayNickname || base.nickname,
    avatarUrl: localProfileStore.displayAvatarUrl || base.avatarUrl
  };
});

const displaySignature = computed(
  () =>
    localProfileStore.displaySignature ||
    userDetail.value?.profile?.signature ||
    t('user.detail.noSignature')
);

const platformName = (platform: PlatformAccount['platform']) => platformDisplayName(platform);

const openProfileEditor = () => {
  if (accounts.value.length || userStore.user) {
    router.push('/user/profile/edit');
  } else {
    router.push({ path: '/user/accounts', query: { panel: 'login' } });
  }
};

const displayRecordList = computed(() => {
  if (activePlatform.value === 'netease') return recordList.value;
  return (activeAccountCache.value?.history || []) as any[];
});

const totalPlayCount = computed(() =>
  displayRecordList.value.reduce(
    (total, item) => total + Number(item.playCount || item.playCountScore || 0),
    0
  )
);

const showFollowList = () => {
  if (!userDetail.value) return;
  router.push({
    path: '/user/follows',
    query: { uid: String(user.value?.userId || ''), name: user.value?.nickname || '' }
  });
};

const showFollowerList = () => {
  if (!userDetail.value) return;
  router.push({
    path: '/user/followers',
    query: { uid: String(user.value?.userId || ''), name: user.value?.nickname || '' }
  });
};

const handlePlayRecord = (item: any) => {
  playerStore.setPlayList(displayRecordList.value || []);
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
    userStore.setLoginType(account.loginMethod as any);
  }

  await loadData();
};

onBeforeUnmount(() => {
  mounted.value = false;
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
      // handleLogout 内部会清状态并刷新页面，刷新后由未登录态接管
      userStore.handleLogout();
    } else {
      message.error(t('user.message.loadFailed'));
    }
  } finally {
    if (mounted.value) {
      infoLoading.value = false;
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

// 旧版深链兼容：?panel=login 一律转向独立账号管理页
watch(
  () => route.query.panel,
  (panel) => {
    if (panel === 'login') {
      router.replace({ path: '/user/accounts', query: { panel: 'login' } });
    }
  }
);

onMounted(() => {
  checkLoginStatus() && loadData();
});
</script>

<style lang="scss" scoped>
.user-page {
  width: 100%;
  min-height: 100%;
  position: relative;
  overflow: visible;
  background: var(--cover-bg, var(--m-bg, var(--bg-color)));
}

.user-scroll {
  width: 100%;
  min-height: 100%;
  overflow: visible;
  padding-top: var(--mobile-topbar-inset);
}

.user-loading-placeholder {
  min-height: 100%;
  padding-top: var(--mobile-topbar-inset);
}

/* Content area */
.content-area {
  padding: 0 16px;
}

.profile-glass,
.glass-section {
  border: 1px solid color-mix(in srgb, var(--m-border, #d8d3cc) 34%, transparent);
  background: var(--m-surface, #f7f5f1);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--m-shadow, #000) 12%, transparent);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.profile-glass {
  position: relative;
  padding: 20px;
  border-radius: 28px;
  overflow: hidden;
}

.profile-main {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 126px;
  align-items: center;
  gap: 20px;
  cursor: pointer;
  transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1);

  &:active {
    transform: scale(0.985);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color) 64%, transparent);
    border-radius: 18px;
  }
}

.profile-avatar {
  width: 72px;
  height: 72px;
  flex: 0 0 72px;
  border: 2px solid rgba(255, 255, 255, 0.28);
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.16);
}

.profile-avatar-button {
  display: block;
  width: 72px;
  height: 72px;
  flex: 0 0 72px;
  transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

.profile-avatar-placeholder {
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--m-surface-alt) 72%, transparent);
  color: var(--m-text-muted);
  font-size: 28px;
}

.profile-copy {
  min-width: 0;
  flex: 1;
}

.profile-copy h1 {
  margin: 0;
  color: var(--m-text-primary);
  font-size: clamp(22px, 6vw, 28px);
  font-weight: 760;
  line-height: 1.15;
}

.profile-copy p {
  display: -webkit-box;
  margin: 5px 0 8px;
  overflow: hidden;
  color: var(--m-text-muted);
  font-size: 12px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.platform-badge {
  display: inline-flex;
  padding: 3px 8px;
  border: 1px solid color-mix(in srgb, var(--accent-color) 34%, transparent);
  border-radius: 999px;
  color: var(--accent-color);
  font-size: 10px;
  font-weight: 700;
}

.profile-entry-arrow {
  flex-shrink: 0;
  color: var(--m-text-muted);
  font-size: 22px;
  opacity: 0.7;
}

.profile-stat-clickable {
  cursor: pointer;
}

.profile-stat-clickable:active {
  transform: scale(0.96);
}

.profile-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 16px;
  padding: 14px 8px;
  border: 1px solid color-mix(in srgb, var(--m-border) 32%, transparent);
  border-radius: 22px;
  background: color-mix(in srgb, var(--m-surface-alt, #efede8) 46%, transparent);
}

.profile-stats div {
  display: grid;
  gap: 2px;
  text-align: center;
}

.profile-stats div + div {
  border-left: 1px solid color-mix(in srgb, var(--m-border) 38%, transparent);
}

.profile-stats strong {
  color: var(--m-text-primary);
  font-variant-numeric: tabular-nums;
}

.profile-stats span {
  color: var(--m-text-muted);
  font-size: 11px;
}

.glass-section {
  margin-top: 10px;
  padding: 16px;
  border-radius: 28px;
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
  cursor: pointer;
  outline: none;

  /* 触屏 tap 会粘滞 :hover,与歌曲项 is-active 叠成两层变色,只在真悬停设备生效 */
  @media (hover: hover) {
    &:hover {
      background: var(--cover-surface-hover, rgba(128, 128, 128, 0.06));
    }
  }

  &:active {
    transform: scale(0.99);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color) 64%, transparent);
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

.bottom-spacer {
  height: calc(var(--safe-area-inset-bottom, 0px) + 140px);
}
</style>
