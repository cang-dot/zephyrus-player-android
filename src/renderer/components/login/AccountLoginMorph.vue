<template>
  <div class="account-login-morph">
    <button
      type="button"
      class="account-login-back"
      :aria-label="t('common.back')"
      @click="emit('back')"
    >
      <i class="ri-arrow-left-line" />
    </button>

    <nav class="account-platform-tabs" :aria-label="t('user.accountSwitcher.title')">
      <button
        v-for="platform in MUSIC_PLATFORMS"
        :key="platform"
        type="button"
        :class="{ active: activePlatform === platform }"
        @click="switchPlatform(platform)"
      >
        <platform-logo :platform="platform" :size="20" />
        <span>{{ t(`login.platform.${platform}`) }}</span>
      </button>
    </nav>

    <segment-slider
      v-if="activePlatform !== 'spotify'"
      :model-value="activeMethod"
      :tabs="methodTabs"
      class="account-method-tabs"
      @update:model-value="switchMethod($event as LoginMethod)"
    />

    <div class="account-login-content">
      <Transition name="account-login-content" mode="out-in">
        <div :key="`${activePlatform}-${activeMethod}`" class="account-login-form">
          <spotify-login
            v-if="activePlatform === 'spotify'"
            @login-success="handleSpotifyLoginSuccess"
          />

          <qr-login
            v-else-if="activePlatform === 'netease' && activeMethod === 'qr'"
            @login-success="handleNeteaseLoginSuccess"
            @login-error="handleLoginError"
          />

          <uid-login
            v-else-if="activePlatform === 'netease' && activeMethod === 'uid'"
            @login-success="handleNeteaseLoginSuccess"
            @login-error="handleLoginError"
          />

          <platform-qr-login
            v-else-if="qrPlatform && activeMethod === 'qr'"
            :platform="qrPlatform"
            :platform-name="t(`login.platform.${activePlatform}`)"
            @login-success="handlePlatformLoginSuccess"
            @login-error="handleLoginError"
          />

          <platform-cookie-login
            v-else
            :platform="activePlatform"
            :platform-name="t(`login.platform.${activePlatform}`)"
            @login-success="handleCookieLoginSuccess"
            @login-error="handleLoginError"
          />
        </div>
      </Transition>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import PlatformLogo from '@/components/common/PlatformLogo.vue';
import SegmentSlider from '@/components/common/SegmentSlider.vue';
import PlatformCookieLogin from '@/components/login/PlatformCookieLogin.vue';
import PlatformQrLogin from '@/components/login/PlatformQrLogin.vue';
import QrLogin from '@/components/login/QrLogin.vue';
import SpotifyLogin from '@/components/login/SpotifyLogin.vue';
import UidLogin from '@/components/login/UidLogin.vue';
import {
  MUSIC_PLATFORMS,
  type MusicPlatform,
  type PlatformLoginMethod,
  usePlatformAccountsStore
} from '@/store/modules/platformAccounts';
import { useUserStore } from '@/store/modules/user';

defineOptions({ name: 'AccountLoginMorph' });

const emit = defineEmits<{ success: []; error: [message: string]; back: [] }>();
const { t } = useI18n();
const accountStore = usePlatformAccountsStore();
const userStore = useUserStore();

type LoginMethod = PlatformLoginMethod;

const activePlatform = ref<MusicPlatform>('netease');
const activeMethod = ref<LoginMethod>('qr');

const availableMethods = computed<LoginMethod[]>(() => {
  if (activePlatform.value === 'netease') return ['qr', 'cookie', 'uid'];
  if (activePlatform.value === 'spotify') return ['oauth'];
  return ['qr', 'cookie'];
});

const methodTabs = computed(() =>
  availableMethods.value.map((method) => ({ key: method, label: t(`login.title.${method}`) }))
);

const qrPlatform = computed<'qq' | 'kugou' | null>(() =>
  activePlatform.value === 'qq' || activePlatform.value === 'kugou' ? activePlatform.value : null
);

const switchPlatform = (platform: MusicPlatform) => {
  activePlatform.value = platform;
  activeMethod.value = platform === 'spotify' ? 'oauth' : 'qr';
};

const switchMethod = (method: LoginMethod) => {
  if (availableMethods.value.includes(method)) activeMethod.value = method;
};

const saveAccount = (
  platform: MusicPlatform,
  userInfo: Record<string, any>,
  cookie: string,
  loginMethod: LoginMethod
) => {
  accountStore.addOrUpdateAccount({
    platform,
    userId: userInfo.userId || userInfo.uid || userInfo.id || '',
    nickname: userInfo.nickname || userInfo.nickName || '',
    avatarUrl: userInfo.avatarUrl || userInfo.avatar || userInfo.headIcon || '',
    vip: Boolean(userInfo.vipType || userInfo.isVip || userInfo.vip),
    vipLabel: userInfo.vipLabel || userInfo.vipName,
    cookie,
    loginMethod
  });
  emit('success');
};

const handleNeteaseLoginSuccess = (profile: any, loginType: string) => {
  const method: LoginMethod = loginType === 'uid' ? 'uid' : 'qr';
  const cookie = method === 'uid' ? '' : localStorage.getItem('token') || '';
  userStore.setUser(profile);
  userStore.setLoginType(loginType as any);
  if (method === 'uid') localStorage.setItem('uidLogin', 'true');
  saveAccount('netease', profile, cookie, method);
};

const handleCookieLoginSuccess = (userInfo: any, cookie: string) => {
  if (activePlatform.value === 'netease') {
    userStore.setUser(userInfo);
    userStore.setLoginType('cookie');
  }
  saveAccount(activePlatform.value, userInfo || {}, cookie, 'cookie');
};

const handlePlatformLoginSuccess = (userInfo: any, cookie: string) =>
  saveAccount(activePlatform.value, userInfo || {}, cookie, 'qr');

const handleSpotifyLoginSuccess = () => emit('success');

const handleLoginError = (error: string) => {
  emit('error', error);
};
</script>

<style lang="scss" scoped>
.account-login-morph {
  display: grid;
  width: 100%;
  gap: 12px;
}

.account-login-back {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--m-surface-alt) 58%, transparent);
  color: var(--m-text-primary);
  font-size: 20px;
}

.account-platform-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;

  button {
    display: grid;
    min-width: 0;
    min-height: 52px;
    place-items: center;
    align-content: center;
    gap: 3px;
    padding: 5px 2px;
    border: 0;
    border-radius: 15px;
    background: color-mix(in srgb, var(--m-surface-alt) 62%, transparent);
    color: var(--m-text-muted);
    transition:
      transform 180ms cubic-bezier(0.32, 0.72, 0, 1),
      background 180ms ease,
      color 180ms ease;

    span {
      width: 100%;
      overflow: hidden;
      font-size: 9px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &.active {
      background: color-mix(in srgb, var(--accent-color) 14%, var(--m-surface-alt));
      color: var(--m-text-primary);
    }

    &:active {
      transform: scale(0.96);
    }
  }
}

.account-method-tabs {
  margin: 0;
}

.account-login-content {
  display: grid;
  min-height: 270px;
  place-items: center;
  overflow: hidden;
  border-radius: 20px;
  background: color-mix(in srgb, var(--m-surface-alt) 48%, transparent);
}

.account-login-form {
  width: 100%;
  padding: 12px;
}

.account-login-form :deep(.qr-container),
.account-login-form :deep(.platform-qr-login .qr-container) {
  width: min(188px, 52vw);
  height: min(188px, 52vw);
  border-radius: 18px;
}

.account-login-form :deep(.login-title) {
  margin-bottom: 8px;
  font-size: 15px;
}

.account-login-content-enter-active,
.account-login-content-leave-active {
  transition:
    opacity 160ms ease,
    transform 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

.account-login-content-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.account-login-content-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .account-platform-tabs button,
  .account-login-content-enter-active,
  .account-login-content-leave-active {
    transition-duration: 0ms;
  }
}
</style>
