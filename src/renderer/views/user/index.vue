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
          <section
            class="profile-glass"
            :class="[`panel-${accountPanel}`, { 'is-expanded': accountPanel !== 'closed' }]"
          >
            <div class="profile-morph-stage">
              <div
                class="profile-morph-view profile-closed-view"
                :class="{ active: accountPanel === 'closed' }"
              >
                <div class="profile-main">
                  <button
                    type="button"
                    class="profile-avatar-button"
                    aria-label="accounts"
                    @pointerdown="startAvatarPress"
                    @pointerup="endAvatarPress"
                    @pointercancel="cancelAvatarPress"
                    @pointerleave="cancelAvatarPress"
                    @contextmenu.prevent="accountPanel = 'accounts'"
                  >
                    <img
                      v-if="user?.avatarUrl"
                      class="profile-avatar"
                      :src="getImgUrl(user.avatarUrl, '144y144')"
                      :alt="user.nickname"
                    />
                    <span v-else class="profile-avatar profile-avatar-placeholder">
                      <i class="ri-user-3-line" />
                    </span>
                  </button>
                  <div class="profile-copy">
                    <h1>{{ user?.nickname || t('user.accountSwitcher.addAccount') }}</h1>
                    <p>{{ userDetail?.profile?.signature || t('user.detail.noSignature') }}</p>
                    <span class="platform-badge">{{ activePlatformLabel }}</span>
                  </div>
                </div>
                <div class="profile-stats">
                  <div>
                    <strong>{{ userDetail?.profile?.followeds || 0 }}</strong>
                    <span>{{ t('user.profile.followers') }}</span>
                  </div>
                  <div>
                    <strong>{{ userDetail?.profile?.follows || 0 }}</strong>
                    <span>{{ t('user.profile.following') }}</span>
                  </div>
                  <div>
                    <strong>{{ userDetail?.level || 0 }}</strong>
                    <span>{{ t('user.profile.level') }}</span>
                  </div>
                </div>
              </div>
              <div
                class="profile-morph-view account-morph-panel account-grid-panel"
                :class="{ active: accountPanel === 'accounts' }"
              >
                <div class="account-morph-heading">
                  <strong>{{ t('user.accountSwitcher.title') }}</strong>
                  <button type="button" @click="closeAccountPanel">
                    <i class="ri-close-line" />
                  </button>
                </div>
                <div class="account-morph-grid">
                  <button
                    v-for="account in accounts"
                    :key="account.accountId"
                    type="button"
                    class="account-morph-row"
                    :class="{ active: account.accountId === activeAccountId }"
                    @click="
                      handleAccountChange(account);
                      closeAccountPanel();
                    "
                  >
                    <img
                      v-if="account.avatarUrl"
                      :src="getImgUrl(account.avatarUrl, '72y72')"
                      alt=""
                    />
                    <span v-else><i class="ri-user-3-line" /></span>
                    <div>
                      <strong>{{ account.nickname }}</strong
                      ><small>{{ platformName(account.platform) }}</small>
                    </div>
                    <i
                      v-if="account.accountId === activeAccountId"
                      class="ri-check-line account-morph-check"
                    />
                  </button>
                </div>
                <button type="button" class="account-add-morph" @click="accountPanel = 'login'">
                  <i class="ri-user-add-line" />{{ t('user.accountSwitcher.addAccount') }}
                </button>
              </div>
              <div
                class="profile-morph-view account-morph-panel login-morph-panel"
                :class="{ active: accountPanel === 'login' }"
              >
                <login-component
                  embedded
                  @login-success="handleLoginSuccess"
                  @close="closeAccountPanel"
                />
              </div>
            </div>
          </section>

          <section class="listening-overview">
            <article>
              <i class="ri-headphone-line" /><strong>{{ totalPlayCount }}</strong
              ><span>{{ t('user.statistics.plays') }}</span>
            </article>
            <article>
              <i class="ri-bar-chart-box-line" /><strong>{{ displayRecordList.length }}</strong
              ><span>{{ t('user.statistics.rankedSongs') }}</span>
            </article>
            <article>
              <i class="ri-links-line" /><strong>{{ connectedPlatformCount }}</strong
              ><span>{{ t('user.statistics.platforms') }}</span>
            </article>
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
import { type PlatformAccount, usePlatformAccountsStore } from '@/store/modules/platformAccounts';
import { usePlayerStore } from '@/store/modules/player';
import { useUserStore } from '@/store/modules/user';
import { getImgUrl, setAnimationClass } from '@/utils';
import { checkLoginStatus as checkAuthStatus } from '@/utils/auth';
import LoginComponent from '@/views/login/index.vue';

defineOptions({ name: 'User' });

const { t } = useI18n();
const userStore = useUserStore();
const accountStore = usePlatformAccountsStore();
const playerStore = usePlayerStore();
const router = useRouter();
const route = useRoute();
const { userDetail, recordList } = storeToRefs(userStore);
const infoLoading = ref(false);
const mounted = ref(true);
const message = useMessage();
const accountPanel = ref<'closed' | 'accounts' | 'login'>(
  route.query.panel === 'login' ? 'login' : 'closed'
);
let avatarPressTimer: number | null = null;

const { accounts, activeAccountId, activeAccount, activeAccountCache } = storeToRefs(accountStore);
const activePlatform = computed(() => activeAccount.value?.platform || 'netease');
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
const connectedPlatformCount = computed(
  () => new Set(accounts.value.map((account) => account.platform)).size
);
const activePlatformLabel = computed(() => activePlatform.value.toUpperCase());

const platformName = (platform: PlatformAccount['platform']) =>
  ({ netease: '网易云', qq: 'QQ 音乐', kugou: '酷狗音乐', spotify: 'Spotify' })[platform];

const handlePlayRecord = (item: any) => {
  playerStore.setPlayList(displayRecordList.value || []);
  playerStore.setPlay(item);
};

const startAvatarPress = () => {
  if (avatarPressTimer) window.clearTimeout(avatarPressTimer);
  avatarPressTimer = window.setTimeout(() => {
    accountPanel.value = 'accounts';
    avatarPressTimer = null;
  }, 480);
};
const cancelAvatarPress = () => {
  if (avatarPressTimer) window.clearTimeout(avatarPressTimer);
  avatarPressTimer = null;
};
const endAvatarPress = () => cancelAvatarPress();
const closeAccountPanel = () => {
  cancelAvatarPress();
  accountPanel.value = 'closed';
  if (route.query.panel) router.replace({ path: '/user' });
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
  cancelAvatarPress();
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
      userStore.handleLogout();
      accountPanel.value = 'login';
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

watch(
  () => route.query.panel,
  (panel) => {
    if (panel === 'login') accountPanel.value = 'login';
  }
);

onMounted(() => {
  checkLoginStatus() && loadData();
});

const handleLoginSuccess = () => {
  accountPanel.value = 'closed';
  checkLoginStatus();
  loadData();
};
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
  padding-top: calc(var(--safe-area-inset-top, 0px) + 68px);
}

.user-loading-placeholder {
  min-height: 100%;
  padding-top: calc(var(--safe-area-inset-top, 0px) + 68px);
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

.profile-glass,
.glass-section,
.listening-overview article {
  border: 1px solid color-mix(in srgb, var(--m-white, #fff) 24%, transparent);
  background: color-mix(in srgb, var(--m-surface, #eae6df) 62%, transparent);
  box-shadow:
    0 14px 34px color-mix(in srgb, var(--m-shadow, #000) 44%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(26px) saturate(165%);
  -webkit-backdrop-filter: blur(26px) saturate(165%);
}

.profile-glass {
  position: relative;
  padding: 20px;
  border-radius: 28px;
  overflow: hidden;
  transition:
    min-height 460ms cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 420ms cubic-bezier(0.32, 0.72, 0, 1),
    padding 420ms cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 300ms ease;

  &.panel-closed {
    min-height: 178px;
  }

  &.panel-accounts {
    min-height: 286px;
  }

  &.panel-login {
    min-height: 600px;
  }

  &.is-expanded {
    border-radius: 32px;
    box-shadow:
      0 22px 48px color-mix(in srgb, var(--m-shadow, #000) 54%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
}

.profile-morph-stage {
  position: relative;
  min-height: 138px;
}

.profile-morph-view {
  position: absolute;
  inset: 0;
  width: 100%;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(18px, 0, 0) scale(0.98);
  transition:
    opacity 220ms ease,
    transform 460ms cubic-bezier(0.32, 0.72, 0, 1),
    visibility 0s linear 460ms;
}

.profile-morph-view.active {
  position: relative;
  inset: auto;
  visibility: visible;
  opacity: 1;
  pointer-events: auto;
  transform: none;
  transition-delay: 0s;
}

.profile-main {
  display: flex;
  align-items: center;
  gap: 16px;
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
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  touch-action: pan-y;
  transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1);

  &:active {
    transform: scale(0.94);
  }
}

.account-morph-panel {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  overflow: visible;
  border: 0;
}

.account-grid-panel {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

.account-morph-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.account-morph-heading {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  color: var(--m-text-primary);
  font-size: 15px;

  button {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: color-mix(in srgb, var(--m-surface-alt) 58%, transparent);
    color: inherit;
    font-size: 18px;
  }
}

.account-morph-row {
  display: grid;
  min-width: 0;
  min-height: 112px;
  place-items: center;
  align-content: center;
  gap: 8px;
  padding: 14px 10px 12px;
  border: 1px solid transparent;
  border-radius: 18px;
  background: color-mix(in srgb, var(--m-surface-alt) 42%, transparent);
  color: var(--m-text-primary);
  text-align: center;
  transition:
    transform 180ms cubic-bezier(0.32, 0.72, 0, 1),
    border-color 180ms ease,
    background 180ms ease;

  > img,
  > span:first-child {
    display: grid;
    width: 58px;
    height: 58px;
    place-items: center;
    border-radius: 50%;
    object-fit: cover;
    background: color-mix(in srgb, var(--m-surface-alt) 68%, transparent);
  }

  div {
    display: grid;
    min-width: 0;
    gap: 2px;

    strong,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      color: var(--m-text-muted);
      font-size: 11px;
    }
  }

  &.active {
    border-color: color-mix(in srgb, var(--accent-color) 48%, transparent);
    background: color-mix(in srgb, var(--accent-color) 14%, transparent);
  }

  &:active {
    transform: scale(0.98);
  }
}

.account-morph-check {
  position: absolute;
  top: 10px;
  right: 10px;
  color: var(--accent-color);
  font-size: 19px;
}

.account-morph-row {
  position: relative;
}

.account-add-morph {
  min-height: 48px;
  border: 1px dashed color-mix(in srgb, var(--accent-color) 48%, transparent);
  border-radius: 18px;
  background: color-mix(in srgb, var(--accent-color) 8%, transparent);
  color: var(--accent-color);
  font-size: 13px;
  font-weight: 700;
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
}

.profile-copy h1 {
  margin: 0;
  color: var(--m-text-primary);
  font-size: 24px;
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

.profile-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid color-mix(in srgb, var(--m-border) 58%, transparent);
}

.profile-stats div {
  display: grid;
  gap: 2px;
  text-align: center;
}

.profile-stats div + div {
  border-left: 1px solid color-mix(in srgb, var(--m-border) 58%, transparent);
}

.profile-stats strong,
.listening-overview strong {
  color: var(--m-text-primary);
  font-variant-numeric: tabular-nums;
}

.profile-stats span,
.listening-overview span {
  color: var(--m-text-muted);
  font-size: 11px;
}

.listening-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.listening-overview article {
  display: grid;
  min-width: 0;
  min-height: 104px;
  place-items: center;
  align-content: center;
  gap: 3px;
  padding: 13px;
  border-radius: 22px;
}

.listening-overview i {
  margin-bottom: 2px;
  color: var(--accent-color);
  font-size: 20px;
}

.listening-overview strong {
  overflow: hidden;
  font-size: 21px;
  text-overflow: ellipsis;
  text-align: center;
}

.listening-overview span {
  text-align: center;
}

.glass-section {
  margin-top: 10px;
  padding: 16px;
  border-radius: 28px;
}

@media (prefers-reduced-motion: reduce) {
  .profile-glass,
  .profile-morph-view {
    transition-duration: 120ms;
  }
}

.accounts-glass {
  margin-top: 4px;
}

.accounts-glass :deep(.platform-accounts) {
  padding: 0;
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
  cursor: pointer;
  outline: none;

  &:hover {
    background: var(--cover-surface-hover, rgba(128, 128, 128, 0.06));
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

  .long-press-hint {
    animation: none;
  }

  .account-picker-row:active,
  .account-picker-add:active {
    transform: none;
  }
}
</style>
