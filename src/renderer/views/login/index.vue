<template>
  <div class="login-page">
    <div class="login-shell">
      <header class="login-header">
        <h1 class="login-logo">Zephyrus</h1>
        <p class="login-tagline">{{ t('comp.homeHero.discoverMusic') }}</p>
      </header>

      <section class="login-card">
        <div class="platform-context">
          <span class="platform-context-logo">
            <platform-logo :platform="activePlatform" :size="28" />
          </span>
          <div>
            <strong>{{ t(`login.platform.${activePlatform}`) }}</strong>
            <small>{{ t(`login.title.${activeMethod}`) }}</small>
          </div>
        </div>

        <glow-tabs
          :model-value="activePlatform"
          :tabs="platformTabs"
          scrollable
          class="login-platform-tabs"
          @update:model-value="switchPlatform($event as Platform)"
        />

        <segment-slider
          :model-value="activeMethod"
          :tabs="methodTabs"
          class="login-method-slider"
          @update:model-value="switchMethod($event as LoginMethod)"
        />

        <div class="login-content">
          <Transition name="login-content" mode="out-in">
            <div :key="`${activePlatform}-${activeMethod}`" class="login-form">
              <qr-login
                v-if="activePlatform === 'netease' && activeMethod === 'qr'"
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
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import GlowTabs from '@/components/common/GlowTabs.vue';
import PlatformLogo from '@/components/common/PlatformLogo.vue';
import SegmentSlider from '@/components/common/SegmentSlider.vue';
import PlatformCookieLogin from '@/components/login/PlatformCookieLogin.vue';
import PlatformQrLogin from '@/components/login/PlatformQrLogin.vue';
import QrLogin from '@/components/login/QrLogin.vue';
import UidLogin from '@/components/login/UidLogin.vue';
import {
  MUSIC_PLATFORMS,
  type MusicPlatform,
  type PlatformLoginMethod,
  usePlatformAccountsStore
} from '@/store/modules/platformAccounts';
import { useUserStore } from '@/store/modules/user';

defineOptions({ name: 'Login' });

type Platform = MusicPlatform;
type LoginMethod = PlatformLoginMethod;

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const accountStore = usePlatformAccountsStore();

const routePlatform = computed(() => {
  const platform = String(route.query.platform || '');
  return MUSIC_PLATFORMS.includes(platform as Platform) ? (platform as Platform) : 'netease';
});

const activePlatform = ref<Platform>(routePlatform.value);
const activeMethod = ref<LoginMethod>('qr');

const platformTabs = computed(() =>
  MUSIC_PLATFORMS.map((platform) => ({
    key: platform,
    label: t(`login.platform.${platform}`)
  }))
);

const availableMethods = computed<LoginMethod[]>(() => {
  if (activePlatform.value === 'netease') return ['qr', 'cookie', 'uid'];
  return ['qr', 'cookie'];
});

const methodTabs = computed(() =>
  availableMethods.value.map((method) => ({
    key: method,
    label: t(`login.title.${method}`)
  }))
);

const qrPlatform = computed<'qq' | 'kugou' | null>(() =>
  activePlatform.value === 'qq' || activePlatform.value === 'kugou' ? activePlatform.value : null
);

const switchPlatform = (platform: Platform) => {
  if (!MUSIC_PLATFORMS.includes(platform)) return;
  activePlatform.value = platform;
  activeMethod.value = 'qr';
};

const switchMethod = (method: LoginMethod) => {
  if (availableMethods.value.includes(method)) {
    activeMethod.value = method;
  }
};

watch(
  () => route.query.platform,
  () => switchPlatform(routePlatform.value)
);

const finishLogin = () => {
  window.setTimeout(() => router.push('/user'), 260);
};

const saveAccount = (
  platform: Platform,
  userInfo: Record<string, any>,
  cookie: string,
  loginMethod: LoginMethod
) => {
  return accountStore.addOrUpdateAccount({
    platform,
    userId: userInfo.userId || userInfo.uid || userInfo.id || '',
    nickname: userInfo.nickname || userInfo.nickName || '',
    avatarUrl: userInfo.avatarUrl || userInfo.avatar || userInfo.headIcon || '',
    vip: Boolean(userInfo.vipType || userInfo.isVip || userInfo.vip),
    vipLabel: userInfo.vipLabel || userInfo.vipName,
    cookie,
    loginMethod
  });
};

const handleNeteaseLoginSuccess = (userProfile: any, loginType: string) => {
  const normalizedLoginType: LoginMethod = loginType === 'uid' ? 'uid' : 'qr';
  const cookie = normalizedLoginType === 'uid' ? '' : localStorage.getItem('token') || '';

  userStore.setUser(userProfile);
  userStore.setLoginType(loginType as any);
  if (normalizedLoginType === 'uid') {
    localStorage.setItem('uidLogin', 'true');
  }
  saveAccount('netease', userProfile, cookie, normalizedLoginType);
  finishLogin();
};

const handleCookieLoginSuccess = (userInfo: any, cookie: string) => {
  if (activePlatform.value === 'netease') {
    userStore.setUser(userInfo);
    userStore.setLoginType('cookie');
  }
  saveAccount(activePlatform.value, userInfo || {}, cookie, 'cookie');
  finishLogin();
};

const handlePlatformLoginSuccess = (userInfo: any, cookie: string) => {
  saveAccount(activePlatform.value, userInfo || {}, cookie, 'qr');
  finishLogin();
};

const handleLoginError = (error: string) => {
  console.error(`${t('login.message.loginFailed')}:`, error);
};
</script>

<style lang="scss" scoped>
.login-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: var(--cover-bg, var(--m-bg, var(--bg-color)));
  color: var(--cover-text-primary, var(--d-text-primary));
}

.login-shell {
  display: flex;
  width: min(100%, 460px);
  min-height: 100%;
  flex-direction: column;
  justify-content: center;
  margin: 0 auto;
  padding: calc(var(--safe-area-inset-top, 0px) + 72px) 18px
    calc(var(--safe-area-inset-bottom, 0px) + 32px);
}

.login-header {
  margin-bottom: 20px;
  text-align: center;
}

.login-logo {
  margin: 0;
  color: var(--cover-text-primary, var(--d-text-primary));
  font-family: var(--m-font-serif, 'Cormorant Garamond', serif);
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 0;
}

.login-tagline {
  margin: 4px 0 0;
  color: var(--cover-text-muted, var(--d-text-muted));
  font-size: 13px;
  letter-spacing: 0;
}

.login-card {
  width: 100%;
  padding: 18px;
  border: 1px solid var(--cover-border, var(--d-border-light));
  border-radius: var(--d-radius-2xl);
  background: var(--cover-surface, var(--d-surface));
  box-shadow: 0 18px 56px var(--cover-shadow, rgba(0, 0, 0, 0.14));
  backdrop-filter: blur(24px) saturate(170%);
  -webkit-backdrop-filter: blur(24px) saturate(170%);
}

.platform-context {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;

  > div {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  strong {
    font-size: 15px;
    font-weight: 700;
  }

  small {
    margin-top: 1px;
    color: var(--cover-text-muted, var(--d-text-muted));
    font-size: 11px;
  }
}

.platform-context-logo {
  display: flex;
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.1);
  color: var(--accent-color);
}

.login-platform-tabs {
  display: flex;
  width: 100%;
  margin-bottom: 12px;
}

.login-method-slider {
  margin-bottom: 20px;
}

.login-content {
  display: flex;
  min-height: 282px;
  align-items: center;
  justify-content: center;
}

.login-form {
  width: 100%;
  max-width: 320px;
}

.login-content-enter-active,
.login-content-leave-active {
  transition:
    opacity 170ms ease,
    transform 210ms cubic-bezier(0.23, 1, 0.32, 1);
}

.login-content-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.login-content-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .login-content-enter-active,
  .login-content-leave-active {
    transition-duration: 0ms;
  }
}
</style>
