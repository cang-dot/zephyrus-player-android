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
            ref="profileGlassRef"
            class="profile-glass"
            data-no-page-swipe
            :class="[`panel-${accountPanel}`, { 'is-expanded': accountPanel !== 'closed' }]"
          >
            <div class="profile-morph-stage">
              <div
                class="profile-morph-view profile-closed-view"
                :style="accountCardStyle"
                :class="{
                  active:
                    accountPanel === 'closed' ||
                    (accountPanel === 'accounts' && accountGestureMode),
                  'is-account-gesture': accountPanel === 'accounts' && accountGestureMode
                }"
                @pointerdown="startProfilePress"
                @pointermove="handleAccountGestureMove"
                @pointerup="handleAvatarPointerUp"
                @pointercancel="handleAccountGestureCancel"
              >
                <div class="profile-main">
                  <button
                    type="button"
                    class="profile-avatar-button"
                    aria-label="accounts"
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
                    <h1>{{ user?.nickname || t('user.accountSwitcher.loginHint') }}</h1>
                    <p>{{ userDetail?.profile?.signature || t('user.detail.noSignature') }}</p>
                    <span v-if="user" class="platform-badge">{{
                      platformName(activePlatform)
                    }}</span>
                  </div>
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
                <div
                  v-if="accountGestureIntent === 'confirm' || accountGestureIntent === 'deleting'"
                  class="profile-delete-overlay"
                  :class="{ 'is-deleting': accountGestureIntent === 'deleting' }"
                >
                  <strong>{{ t('user.accountSwitcher.deleteAccount') }}</strong>
                  <div>
                    <button type="button" @click.stop="cancelDeleteGesture">
                      {{ t('common.cancel') }}
                    </button>
                    <button type="button" class="danger" @click.stop="confirmGestureDelete">
                      {{ t('common.confirm') }}
                    </button>
                  </div>
                </div>
              </div>
              <div
                class="profile-morph-view account-morph-panel account-grid-panel"
                :class="{
                  active: accountPanel === 'accounts',
                  'gesture-overlay': accountGestureMode
                }"
              >
                <div class="account-morph-heading">
                  <strong>{{ t('user.accountSwitcher.title') }}</strong>
                  <button type="button" @click="closeAccountPanel()">
                    <i class="ri-close-line" />
                  </button>
                </div>
                <div
                  v-if="accountGestureMode"
                  class="account-gesture-shell"
                  data-no-page-swipe
                  :style="accountCardStyle"
                  :class="{
                    'snap-delete': accountGestureIntent === 'delete',
                    'snap-login': accountGestureIntent === 'login'
                  }"
                  @pointerdown="startAccountGestureDrag"
                  @pointermove="handleAccountGestureMove"
                  @pointerup="handleAccountGestureEnd"
                  @pointercancel="handleAccountGestureCancel"
                >
                  <div class="account-drop-zone account-drop-zone-delete">
                    <i class="ri-delete-bin-line" />
                    <span>{{ t('common.delete') }}</span>
                  </div>
                  <div class="account-drop-zone account-drop-zone-login">
                    <i class="ri-user-add-line" />
                    <span>{{ t('user.accountSwitcher.addAccount') }}</span>
                  </div>
                  <div class="account-carousel-track">
                    <article
                      v-for="(account, index) in accounts"
                      :key="account.accountId"
                      class="account-carousel-card"
                      :role="account.accountId === activeAccountId ? 'button' : undefined"
                      :tabindex="account.accountId === activeAccountId ? 0 : -1"
                      :class="{
                        active: account.accountId === activeAccountId,
                        'is-confirming':
                          account.accountId === activeAccountId &&
                          accountGestureIntent === 'confirm',
                        'is-deleting':
                          account.accountId === activeAccountId &&
                          accountGestureIntent === 'deleting'
                      }"
                      :style="accountCarouselCardStyle(index)"
                      @click="handleAccountCarouselCardClick(account)"
                      @keydown.enter.prevent="handleAccountCarouselCardClick(account)"
                      @keydown.space.prevent="handleAccountCarouselCardClick(account)"
                    >
                      <div class="account-carousel-main">
                        <img
                          v-if="account.avatarUrl"
                          :src="getImgUrl(account.avatarUrl, '144y144')"
                          alt=""
                        />
                        <span v-else><i class="ri-user-3-line" /></span>
                        <div>
                          <strong>{{ account.nickname }}</strong>
                          <small>{{ accountCardDescription(account) }}</small>
                          <em>{{ platformName(account.platform) }}</em>
                        </div>
                      </div>
                      <div class="account-carousel-stats">
                        <div>
                          <strong>{{ accountMetric(account, 'followers') }}</strong>
                          <span>{{ t('user.profile.followers') }}</span>
                        </div>
                        <div>
                          <strong>{{ accountMetric(account, 'following') }}</strong>
                          <span>{{ t('user.profile.following') }}</span>
                        </div>
                        <div>
                          <strong>{{ accountMetric(account, 'level') }}</strong>
                          <span>{{ t('user.profile.level') }}</span>
                        </div>
                        <div>
                          <strong>{{ accountMetric(account, 'plays') }}</strong>
                          <span>{{ t('user.statistics.plays') }}</span>
                        </div>
                      </div>
                      <div
                        v-if="
                          account.accountId === activeAccountId &&
                          (accountGestureIntent === 'confirm' ||
                            accountGestureIntent === 'deleting')
                        "
                        class="account-delete-overlay"
                        @pointerdown.stop
                        @pointerup.stop
                        @pointercancel.stop
                      >
                        <strong>{{ t('user.accountSwitcher.deleteAccount') }}</strong>
                        <div>
                          <button type="button" @click.stop="cancelDeleteGesture">
                            {{ t('common.cancel') }}
                          </button>
                          <button type="button" class="danger" @click.stop="confirmGestureDelete">
                            {{ t('common.confirm') }}
                          </button>
                        </div>
                      </div>
                    </article>
                  </div>
                </div>
                <div v-else class="account-morph-grid">
                  <div
                    v-for="account in accounts"
                    :key="account.accountId"
                    class="account-morph-row"
                    role="button"
                    tabindex="0"
                    :class="{
                      active: account.accountId === activeAccountId,
                      'confirming-delete': deletingAccountId === account.accountId
                    }"
                    @click="selectAccount(account)"
                    @keydown.enter.prevent="selectAccount(account)"
                    @keydown.space.prevent="selectAccount(account)"
                  >
                    <div class="account-card-normal">
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
                      <button
                        type="button"
                        class="account-delete-trigger"
                        :aria-label="t('common.delete')"
                        @click.stop="deletingAccountId = account.accountId"
                      >
                        <i class="ri-close-line" />
                      </button>
                    </div>
                    <div class="account-delete-confirm" @click.stop>
                      <strong>{{ t('user.accountSwitcher.deleteAccount') }}</strong>
                      <small>{{ account.nickname }}</small>
                      <div class="account-delete-actions">
                        <button type="button" @click.stop="deletingAccountId = null">
                          {{ t('common.cancel') }}
                        </button>
                        <button
                          type="button"
                          class="danger"
                          @click.stop="confirmRemoveAccount(account)"
                        >
                          {{ t('common.delete') }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  v-if="!accountGestureMode"
                  type="button"
                  class="account-add-morph"
                  @click="openLoginPanel(false)"
                >
                  <i class="ri-user-add-line" />{{ t('user.accountSwitcher.addAccount') }}
                </button>
              </div>
              <div
                class="profile-morph-view account-morph-panel login-morph-panel"
                :class="{ active: accountPanel === 'login' }"
              >
                <account-login-morph
                  @back="leaveLoginPanel"
                  @success="handleLoginSuccess"
                  @error="handleLoginError"
                />
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
import AccountLoginMorph from '@/components/login/AccountLoginMorph.vue';
import { registerMobileBackLayer } from '@/services/mobileBackStack';
import { type PlatformAccount, usePlatformAccountsStore } from '@/store/modules/platformAccounts';
import { usePlayerStore } from '@/store/modules/player';
import { useUserStore } from '@/store/modules/user';
import { getImgUrl, setAnimationClass } from '@/utils';
import { checkLoginStatus as checkAuthStatus } from '@/utils/auth';

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
const loginReturnMode = ref<'closed' | 'accounts'>('closed');
const deletingAccountId = ref<string | null>(null);
const profileGlassRef = ref<HTMLElement | null>(null);
const accountGestureMode = ref(false);
const accountGestureIntent = ref<'idle' | 'delete' | 'login' | 'confirm' | 'deleting'>('idle');
const accountDragX = ref(0);
const accountDragY = ref(0);
const accountPointerStart = ref({ x: 0, y: 0 });
const accountGestureDragging = ref(false);
let accountGestureAxis: 'none' | 'horizontal' | 'vertical' = 'none';
let accountGestureMoved = false;
let suppressAccountCardClickUntil = 0;
let avatarPressTimer: number | null = null;
let accountGestureWindowBound = false;
const accountBackLayerDisposers: Array<() => void> = [];

const { accounts, activeAccountId, activeAccount, activeAccountCache, accountCache } =
  storeToRefs(accountStore);
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
const accountIndex = computed(() =>
  Math.max(
    0,
    accounts.value.findIndex((account) => account.accountId === activeAccountId.value)
  )
);
const accountCardStyle = computed(() => ({
  '--account-drag-x': `${accountDragX.value}px`,
  '--account-drag-y': `${accountDragY.value}px`,
  '--account-stretch-top': `${Math.max(0, -accountDragY.value) * 0.48}px`,
  '--account-stretch-bottom': `${Math.max(0, accountDragY.value) * 0.48}px`,
  '--account-card-shift-y': `${accountDragY.value * 0.24}px`
}));

const relativeAccountIndex = (index: number) => {
  const length = accounts.value.length;
  if (length < 2) return 0;
  let relative = index - accountIndex.value;
  if (relative > length / 2) relative -= length;
  if (relative < -length / 2) relative += length;
  return relative;
};

const accountCarouselCardStyle = (index: number) => ({
  ...accountCardStyle.value,
  '--account-offset-x': `${relativeAccountIndex(index) * 88}%`
});

const accountHistoryTotal = (account: PlatformAccount) => {
  const history = (accountCache.value[account.accountId]?.history || []) as any[];
  return history.reduce(
    (total, item) => total + Number(item.playCount || item.playCountScore || 0),
    0
  );
};

const accountMetric = (
  account: PlatformAccount,
  metric: 'followers' | 'following' | 'level' | 'plays'
) => {
  const isActive = account.accountId === activeAccountId.value;
  if (metric === 'plays') return isActive ? totalPlayCount.value : accountHistoryTotal(account);
  if (!isActive) return '--';
  if (metric === 'followers') return userDetail.value?.profile?.followeds || 0;
  if (metric === 'following') return userDetail.value?.profile?.follows || 0;
  return userDetail.value?.level || 0;
};

const accountCardDescription = (account: PlatformAccount) => {
  if (account.accountId === activeAccountId.value && userDetail.value?.profile?.signature) {
    return userDetail.value.profile.signature;
  }
  return account.vipLabel || `${platformName(account.platform)}账号`;
};

const platformName = (platform: PlatformAccount['platform']) =>
  ({ netease: '网易云', qq: 'QQ音乐', kugou: '酷狗音乐', spotify: 'Spotify' })[platform];

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

const beginPointerTracking = (event: PointerEvent) => {
  accountPointerStart.value = { x: event.clientX, y: event.clientY };
  accountGestureDragging.value = true;
  accountGestureAxis = 'none';
  accountGestureMoved = false;
  accountDragX.value = 0;
  accountDragY.value = 0;
  if (accountGestureIntent.value !== 'confirm') accountGestureIntent.value = 'idle';
  bindAccountGestureWindow();
  const target = event.currentTarget;
  if (target instanceof HTMLElement && target.setPointerCapture) {
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // The window listeners remain the fallback when WebView rejects capture.
    }
  }
};

const startAvatarPress = (event?: PointerEvent) => {
  if (!event) return;
  if (accountGestureMode.value) {
    startAccountGestureDrag(event);
    return;
  }
  beginPointerTracking(event);
  if (avatarPressTimer) window.clearTimeout(avatarPressTimer);
  avatarPressTimer = window.setTimeout(() => {
    accountPanel.value = 'accounts';
    accountGestureMode.value = true;
    accountGestureIntent.value = 'idle';
    accountDragX.value = 0;
    accountDragY.value = 0;
    avatarPressTimer = null;
  }, 480);
};
const startProfilePress = (event: PointerEvent) => startAvatarPress(event);
const startAccountGestureDrag = (event: PointerEvent) => {
  if (
    !accountGestureMode.value ||
    accountGestureIntent.value === 'confirm' ||
    accountGestureIntent.value === 'deleting'
  ) {
    return;
  }
  beginPointerTracking(event);
};
const bindAccountGestureWindow = () => {
  if (accountGestureWindowBound) return;
  accountGestureWindowBound = true;
  window.addEventListener('pointermove', handleAccountGestureMove, { passive: true });
  window.addEventListener('pointerup', handleAccountGestureEnd, { passive: true });
  window.addEventListener('pointercancel', handleAccountGestureCancel, { passive: true });
};
const unbindAccountGestureWindow = () => {
  if (!accountGestureWindowBound) return;
  accountGestureWindowBound = false;
  window.removeEventListener('pointermove', handleAccountGestureMove);
  window.removeEventListener('pointerup', handleAccountGestureEnd);
  window.removeEventListener('pointercancel', handleAccountGestureCancel);
};
const handleAccountGestureMove = (event: PointerEvent) => {
  if (avatarPressTimer) {
    if (
      Math.hypot(
        event.clientX - accountPointerStart.value.x,
        event.clientY - accountPointerStart.value.y
      ) > 12
    ) {
      cancelAvatarPress();
    }
    return;
  }
  if (
    accountPanel.value !== 'accounts' ||
    !accountGestureMode.value ||
    !accountGestureDragging.value ||
    accountGestureIntent.value === 'confirm' ||
    accountGestureIntent.value === 'deleting'
  ) {
    return;
  }
  const rawX = event.clientX - accountPointerStart.value.x;
  const rawY = event.clientY - accountPointerStart.value.y;
  if (accountGestureAxis === 'none') {
    if (Math.max(Math.abs(rawX), Math.abs(rawY)) < 8) return;
    accountGestureAxis = Math.abs(rawX) > Math.abs(rawY) * 1.05 ? 'horizontal' : 'vertical';
  }
  accountGestureMoved = true;
  if (accountGestureAxis === 'horizontal') {
    accountDragX.value = Math.max(-150, Math.min(150, rawX));
    accountDragY.value = 0;
    accountGestureIntent.value = 'idle';
    return;
  }
  accountDragX.value = 0;
  accountDragY.value = Math.max(-130, Math.min(130, rawY));
  if (accountDragY.value < -48) {
    accountGestureIntent.value = 'delete';
  } else if (accountDragY.value > 48) {
    accountGestureIntent.value = 'login';
  } else {
    accountGestureIntent.value = 'idle';
  }
};
const handleAccountGestureEnd = () => {
  unbindAccountGestureWindow();
  const longPressActivated = accountGestureMode.value && accountPanel.value === 'accounts';
  cancelAvatarPress();
  accountGestureDragging.value = false;
  if (!longPressActivated) return;
  if (accountGestureIntent.value === 'delete' && accountDragY.value < -72) {
    accountGestureIntent.value = 'confirm';
    accountDragX.value = 0;
    accountDragY.value = 0;
    accountGestureAxis = 'none';
    accountGestureMoved = false;
    return;
  } else if (accountGestureIntent.value === 'login' && accountDragY.value > 72) {
    openLoginPanel(true);
    return;
  } else if (
    accountGestureAxis === 'horizontal' &&
    Math.abs(accountDragX.value) > 72 &&
    accounts.value.length > 1
  ) {
    const direction = accountDragX.value > 0 ? -1 : 1;
    const targetIndex =
      (accountIndex.value + direction + accounts.value.length) % accounts.value.length;
    const target = accounts.value[targetIndex];
    if (target) void handleAccountChange(target);
    suppressAccountCardClickUntil = performance.now() + 300;
    accountGestureIntent.value = 'idle';
    accountDragX.value = 0;
    accountDragY.value = 0;
    accountGestureAxis = 'none';
    accountGestureMoved = false;
    return;
  }
  closeAccountPanel(false);
};
const handleAccountGestureCancel = () => {
  unbindAccountGestureWindow();
  cancelAvatarPress();
  accountGestureDragging.value = false;
  if (accountGestureIntent.value === 'confirm') return;
  closeAccountPanel(false);
};
const cancelDeleteGesture = () => {
  accountGestureIntent.value = 'idle';
  deletingAccountId.value = null;
  accountDragY.value = 0;
};

const resetAccountGesture = () => {
  unbindAccountGestureWindow();
  cancelAvatarPress();
  accountGestureDragging.value = false;
  accountGestureAxis = 'none';
  accountGestureMoved = false;
  accountGestureIntent.value = 'idle';
  accountDragX.value = 0;
  accountDragY.value = 0;
};

const openLoginPanel = (fromOperation: boolean) => {
  loginReturnMode.value = fromOperation && accounts.value.length ? 'accounts' : 'closed';
  resetAccountGesture();
  accountGestureMode.value = false;
  accountPanel.value = 'login';
};

const leaveLoginPanel = () => {
  resetAccountGesture();
  if (loginReturnMode.value === 'accounts' && accounts.value.length) {
    accountPanel.value = 'accounts';
    accountGestureMode.value = true;
  } else {
    accountPanel.value = 'closed';
  }
  if (route.path === '/user' && route.query.panel) router.replace({ path: '/user' });
};
const confirmGestureDelete = async () => {
  const account = activeAccount.value;
  if (!account) return;
  accountGestureIntent.value = 'deleting';
  await new Promise((resolve) => window.setTimeout(resolve, 460));
  await confirmRemoveAccount(account);
  if (accounts.value.length) {
    accountPanel.value = 'accounts';
    accountGestureMode.value = true;
    accountGestureIntent.value = 'idle';
  }
};
const cancelAvatarPress = () => {
  if (avatarPressTimer) window.clearTimeout(avatarPressTimer);
  avatarPressTimer = null;
};
const endAvatarPress = () => cancelAvatarPress();
const handleAvatarPointerUp = () => {
  endAvatarPress();
  handleAccountGestureEnd();
};
const handleAccountCarouselCardClick = (account: PlatformAccount) => {
  if (
    account.accountId !== activeAccountId.value ||
    !accountGestureMode.value ||
    accountGestureIntent.value !== 'idle' ||
    accountGestureDragging.value ||
    accountGestureMoved ||
    performance.now() < suppressAccountCardClickUntil
  ) {
    return;
  }
  closeAccountPanel(false);
};
const handleAccountOutsidePointerDown = (event: PointerEvent) => {
  if (accountPanel.value === 'closed') return;
  if (profileGlassRef.value?.contains(event.target as Node)) return;
  closeAccountPanel();
};
const closeAccountPanel = (updateRoute = true) => {
  resetAccountGesture();
  deletingAccountId.value = null;
  accountGestureMode.value = false;
  accountPanel.value = 'closed';
  if (updateRoute && route.path === '/user' && route.query.panel) {
    router.replace({ path: '/user' });
  }
};

const confirmRemoveAccount = async (account: PlatformAccount) => {
  const wasActive = account.accountId === activeAccountId.value;
  if (!accountStore.removeAccount(account.accountId)) return;
  deletingAccountId.value = null;

  if (wasActive) {
    userDetail.value = null;
    recordList.value = [];
    const replacement = activeAccount.value;
    if (replacement) {
      await handleAccountChange(replacement);
    } else {
      userStore.handleLogout();
      openLoginPanel(false);
    }
  }
};

const selectAccount = async (account: PlatformAccount) => {
  if (deletingAccountId.value === account.accountId) return;
  await handleAccountChange(account);
  closeAccountPanel();
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
  accountBackLayerDisposers.splice(0).forEach((dispose) => dispose());
  cancelAvatarPress();
  unbindAccountGestureWindow();
  window.removeEventListener('pointerdown', handleAccountOutsidePointerDown, true);
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
      openLoginPanel(false);
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
    } else if (accountPanel.value !== 'closed') {
      closeAccountPanel(false);
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
    if (panel === 'login') openLoginPanel(false);
  }
);

onMounted(() => {
  accountBackLayerDisposers.push(
    registerMobileBackLayer({
      id: 'account-delete-confirm',
      priority: 940,
      isActive: () => accountGestureIntent.value === 'confirm' || deletingAccountId.value !== null,
      onBack: () => cancelDeleteGesture()
    }),
    registerMobileBackLayer({
      id: 'account-login-panel',
      priority: 920,
      isActive: () => accountPanel.value === 'login',
      onBack: () => leaveLoginPanel()
    }),
    registerMobileBackLayer({
      id: 'account-operation-mode',
      priority: 700,
      isActive: () => accountPanel.value === 'accounts',
      onBack: () => closeAccountPanel()
    })
  );
  window.addEventListener('pointerdown', handleAccountOutsidePointerDown, true);
  checkLoginStatus() && loadData();
});

const handleLoginSuccess = () => {
  closeAccountPanel();
  checkLoginStatus();
  loadData();
};

const handleLoginError = (error: string) => {
  message.error(error || t('login.message.loginFailed'));
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
  padding-top: var(--mobile-topbar-inset);
}

.user-loading-placeholder {
  min-height: 100%;
  padding-top: var(--mobile-topbar-inset);
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
    top: var(--mobile-topbar-inset);
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
  border: 1px solid color-mix(in srgb, var(--m-border, #d8d3cc) 34%, transparent);
  background: color-mix(in srgb, var(--m-surface, #f7f5f1) 78%, transparent);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--m-shadow, #000) 12%, transparent);
  backdrop-filter: blur(22px) saturate(120%);
  -webkit-backdrop-filter: blur(22px) saturate(120%);
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
    min-height: 228px;
  }

  &.panel-accounts {
    min-height: 340px;
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

.profile-glass.panel-accounts .profile-morph-stage {
  min-height: 300px;
}

.login-morph-panel.active {
  min-height: 500px;
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

.profile-closed-view.active {
  touch-action: none;
}

.profile-closed-view.is-account-gesture {
  z-index: 4;
  min-height: 248px;
  opacity: 0;
  pointer-events: none;
  transform: scale(0.78);
  transform-origin: center;
  transition:
    opacity 140ms ease,
    transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

.profile-closed-view.is-account-gesture .profile-avatar-button,
.profile-closed-view.is-account-gesture .profile-copy,
.profile-closed-view.is-account-gesture .profile-stat-clickable {
  cursor: pointer;
}

.profile-stat-clickable:active {
  transform: scale(0.96);
}

.profile-stats {
  transition:
    opacity 180ms ease,
    transform 260ms cubic-bezier(0.32, 0.72, 0, 1);
}

.profile-closed-view.is-account-gesture .profile-avatar-button {
  transform: scale(0.92);
}

.profile-delete-overlay {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: grid;
  place-content: center;
  gap: 12px;
  border-radius: inherit;
  background: color-mix(in srgb, #ef4444 78%, transparent);
  color: #fff;
  text-align: center;
}

.profile-delete-overlay > div {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.profile-delete-overlay button {
  min-width: 62px;
  padding: 7px 12px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.profile-delete-overlay button.danger {
  background: #fff;
  color: #b91c1c;
}

.profile-delete-overlay.is-deleting {
  animation: profile-delete-overlay-out 460ms ease forwards;
}

@keyframes profile-delete-overlay-out {
  0% {
    opacity: 1;
  }
  42% {
    opacity: 0;
  }
  100% {
    opacity: 0;
    transform: translateY(-12px) scale(0.86);
  }
}

.profile-main {
  display: flex;
  align-items: center;
  gap: 20px;
  min-height: 126px;
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

.account-grid-panel.gesture-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: block;
  min-height: 248px;
  pointer-events: auto;
}

.account-grid-panel.gesture-overlay .account-morph-heading,
.account-grid-panel.gesture-overlay .account-morph-grid,
.account-grid-panel.gesture-overlay .account-add-morph {
  display: none;
}

.account-grid-panel.gesture-overlay .account-gesture-shell {
  min-height: 248px;
}

.account-morph-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.account-gesture-shell {
  position: relative;
  min-height: 300px;
  overflow: visible;
  touch-action: none;
}

.account-drop-zone {
  position: absolute;
  right: 0;
  left: 0;
  display: grid;
  height: 46px;
  place-items: center;
  gap: 3px;
  border: 1px dashed color-mix(in srgb, var(--m-text-muted) 45%, transparent);
  border-radius: 18px;
  color: var(--m-text-muted);
  font-size: 11px;
  opacity: 0.65;
  transition:
    transform 260ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 180ms ease,
    background 180ms ease;

  i {
    font-size: 17px;
  }
}

.account-drop-zone-delete {
  top: 0;
  transform: translateY(calc(-1 * var(--account-drag-y, 0px) * 0.16));
}
.account-drop-zone-login {
  bottom: 0;
  transform: translateY(calc(-1 * var(--account-drag-y, 0px) * 0.16));
}

.account-gesture-shell.snap-delete .account-drop-zone-delete,
.account-gesture-shell.snap-login .account-drop-zone-login {
  opacity: 1;
  background: color-mix(in srgb, #ef4444 14%, transparent);
  color: #ef4444;
}

.account-gesture-shell.snap-login .account-drop-zone-login {
  background: color-mix(in srgb, var(--accent-color) 14%, transparent);
  color: var(--accent-color);
}

.account-carousel-track {
  position: absolute;
  top: 54px;
  right: 0;
  bottom: 54px;
  left: 0;
  overflow: visible;
  pointer-events: none;
}

.account-carousel-card {
  --account-card-base-height: 184px;

  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  display: grid;
  width: 100%;
  height: calc(
    var(--account-card-base-height) + var(--account-stretch-top, 0px) +
      var(--account-stretch-bottom, 0px)
  );
  align-content: center;
  gap: 14px;
  padding: 18px 20px;
  overflow: hidden;
  border: 0;
  border-radius: 28px;
  background: color-mix(in srgb, var(--m-surface) 90%, transparent);
  color: var(--m-text-primary);
  opacity: 0.66;
  transform: translate3d(
      calc(-50% + var(--account-offset-x, 0%) + var(--account-drag-x, 0px)),
      calc(-50% + var(--account-card-shift-y, 0px)),
      0
    )
    scale(0.76);
  transform-origin: center;
  transition:
    height 260ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 180ms ease,
    transform 320ms cubic-bezier(0.32, 0.72, 0, 1),
    background 180ms ease;
  will-change: transform;
}

.account-carousel-card.active {
  z-index: 3;
  opacity: 1;
  pointer-events: auto;
}

.account-carousel-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;

  > img,
  > span {
    display: grid;
    width: 66px;
    height: 66px;
    flex: 0 0 66px;
    place-items: center;
    border-radius: 50%;
    object-fit: cover;
    background: color-mix(in srgb, var(--m-surface-alt) 76%, transparent);
    font-size: 24px;
  }

  > div {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
  }

  strong,
  small,
  em {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 20px;
    font-style: normal;
    font-weight: 760;
  }

  small {
    margin-top: 2px;
    color: var(--m-text-muted);
    font-size: 11px;
  }

  em {
    width: fit-content;
    max-width: 100%;
    margin-top: 7px;
    padding: 3px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
    color: var(--m-text-secondary);
    font-size: 9px;
    font-style: normal;
  }
}

.account-carousel-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  padding: 9px 7px;
  border-radius: 17px;
  background: color-mix(in srgb, var(--m-surface-alt) 50%, transparent);

  > div {
    display: grid;
    min-width: 0;
    place-items: center;
  }

  strong {
    font-size: 13px;
    font-weight: 700;
  }

  span {
    overflow: hidden;
    color: var(--m-text-muted);
    font-size: 8px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.account-carousel-card.is-confirming {
  background: color-mix(in srgb, #ef4444 22%, var(--m-surface));
}

.account-carousel-card.is-deleting {
  animation: account-card-delete 460ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
}

.account-neighbor {
  position: absolute;
  top: 50%;
  display: grid;
  width: 42px;
  height: 82px;
  place-items: center;
  overflow: hidden;
  border-radius: 18px;
  background: color-mix(in srgb, var(--m-surface-alt) 55%, transparent);
  opacity: 0.65;
  transform: translateY(-50%);
  transition:
    transform 300ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 180ms ease;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.account-neighbor-left {
  left: -8px;
  transform: translate(calc(-1 * var(--account-drag-x, 0px) * 0.16), -50%);
}
.account-neighbor-right {
  right: -8px;
  transform: translate(calc(var(--account-drag-x, 0px) * 0.16), -50%);
}

.account-gesture-card {
  position: relative;
  z-index: 2;
  display: grid;
  width: min(260px, 76%);
  height: calc(142px + var(--account-stretch-top, 0px) + var(--account-stretch-bottom, 0px));
  margin-top: calc(-1 * var(--account-stretch-top, 0px));
  place-items: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--accent-color) 28%, transparent);
  border-radius: 28px;
  background: color-mix(in srgb, var(--m-surface) 84%, transparent);
  color: var(--m-text-primary);
  transform: translate3d(var(--account-drag-x, 0px), 0, 0) scale(0.94);
  transition:
    height 260ms cubic-bezier(0.32, 0.72, 0, 1),
    margin-top 260ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 280ms cubic-bezier(0.32, 0.72, 0, 1),
    background 180ms ease;
}

.account-gesture-card.is-confirming {
  background: color-mix(in srgb, #ef4444 24%, var(--m-surface));
}

.account-gesture-card.is-deleting {
  animation: account-card-delete 460ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
}

.account-gesture-card.is-deleting .account-delete-overlay {
  animation: account-card-content-out 180ms ease forwards;
}
.account-gesture-card .account-card-normal {
  display: grid;
  place-items: center;
  gap: 6px;
}
.account-gesture-card .account-card-normal > img,
.account-gesture-card .account-card-normal > span {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  object-fit: cover;
}
.account-gesture-card .account-card-normal small {
  color: var(--m-text-muted);
  font-size: 11px;
}

.account-delete-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-content: center;
  gap: 12px;
  pointer-events: auto;
  background: color-mix(in srgb, #ef4444 76%, transparent);
  color: #fff;
  text-align: center;
}

.account-delete-overlay > div {
  display: flex;
  justify-content: center;
  gap: 8px;
}
.account-delete-overlay button {
  min-width: 62px;
  padding: 7px 12px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
.account-delete-overlay button.danger {
  background: #fff;
  color: #b91c1c;
}

@keyframes account-card-delete {
  0% {
    height: 142px;
    opacity: 1;
    transform: scale(0.94);
  }
  62% {
    height: 18px;
    opacity: 1;
    transform: scaleX(0.94);
  }
  100% {
    height: 18px;
    opacity: 0;
    transform: scaleX(0.72);
  }
}

@keyframes account-card-content-out {
  to {
    opacity: 0;
    transform: translateY(-8px);
  }
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

.account-card-normal,
.account-delete-confirm {
  grid-area: 1 / 1;
  display: grid;
  width: 100%;
  place-items: center;
  gap: 8px;
  transition:
    opacity 180ms ease,
    transform 260ms cubic-bezier(0.32, 0.72, 0, 1);
}

.account-card-normal > img,
.account-card-normal > span:first-child {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border-radius: 50%;
  object-fit: cover;
  background: color-mix(in srgb, var(--m-surface-alt) 68%, transparent);
}

.account-card-normal > div:not(.account-delete-confirm) {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.account-delete-confirm {
  pointer-events: none;
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}

.account-delete-confirm small {
  max-width: 100%;
  overflow: hidden;
  color: var(--m-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-delete-actions {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.account-delete-actions button {
  min-height: 34px;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--m-surface-alt) 72%, transparent);
  color: var(--m-text-primary);
}

.account-delete-actions .danger {
  background: color-mix(in srgb, #ef4444 18%, transparent);
  color: #ef4444;
}

.account-delete-trigger {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--m-surface-alt) 72%, transparent);
  color: var(--m-text-muted);
}

.account-morph-row.confirming-delete .account-card-normal {
  pointer-events: none;
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
}

.account-morph-row.confirming-delete .account-delete-confirm {
  pointer-events: auto;
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .account-card-normal,
  .account-delete-confirm {
    transition: opacity 120ms ease;
    transform: none;
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
