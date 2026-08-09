<template>
  <div class="login-page" :class="{ embedded }">
    <div class="login-shell">
      <header class="login-header">
        <button v-if="embedded" type="button" class="embedded-back" @click="emit('close')">
          <i class="ri-arrow-left-s-line" />
        </button>
        <div class="login-heading-copy">
          <h1 class="login-logo">
            {{ embedded ? t('user.accountSwitcher.addAccount') : 'Zephyrus' }}
          </h1>
          <p class="login-tagline">
            {{ embedded ? t(`login.title.${activeMethod}`) : t('comp.homeHero.discoverMusic') }}
          </p>
        </div>
      </header>

      <section class="login-card">
        <nav class="login-platform-picker" :aria-label="t('user.accountSwitcher.title')">
          <button
            v-for="platform in MUSIC_PLATFORMS"
            :key="platform"
            type="button"
            :class="{ active: activePlatform === platform }"
            @click="switchPlatform(platform)"
          >
            <platform-logo :platform="platform" :size="24" />
            <span>{{ t(`login.platform.${platform}`) }}</span>
          </button>
        </nav>

        <div class="platform-context">
          <span class="platform-context-logo">
            <platform-logo :platform="activePlatform" :size="28" />
          </span>
          <div>
            <strong>{{ t(`login.platform.${activePlatform}`) }}</strong>
            <small>{{ t(`login.title.${activeMethod}`) }}</small>
          </div>
        </div>

        <segment-slider
          v-if="activePlatform !== 'spotify'"
          :model-value="activeMethod"
          :tabs="methodTabs"
          class="login-method-slider"
          @update:model-value="switchMethod($event as LoginMethod)"
        />

        <div class="login-content">
          <Transition name="login-content">
            <div :key="`${activePlatform}-${activeMethod}`" class="login-form">
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
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

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

defineOptions({ name: 'Login' });

const props = withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false });
const emit = defineEmits<{ 'login-success': []; close: [] }>();
const { embedded } = toRefs(props);

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

const availableMethods = computed<LoginMethod[]>(() => {
  if (activePlatform.value === 'netease') return ['qr', 'cookie', 'uid'];
  if (activePlatform.value === 'spotify') return ['oauth'];
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
  // Spotify 只支持 OAuth 登录，不需要选择登录方式
  if (platform === 'spotify') {
    activeMethod.value = 'oauth';
  } else {
    activeMethod.value = 'qr';
  }
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
  if (embedded.value) {
    emit('login-success');
    return;
  }
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

const handleSpotifyLoginSuccess = () => {
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

.login-page.embedded {
  min-height: 0;
  height: auto;
  overflow: visible;
  background: transparent;

  .login-shell {
    width: 100%;
    min-height: 0;
    padding: 0;
    overflow: visible;
  }

  .login-header {
    display: flex;
    min-height: 44px;
    align-items: center;
    gap: 12px;
    margin: 0 0 12px;
    text-align: left;
  }

  .login-logo {
    font-family: inherit;
    font-size: 20px;
    font-weight: 760;
  }

  .login-tagline {
    display: block;
    margin-top: 2px;
    font-size: 11px;
  }

  .login-card {
    display: grid;
    gap: 12px;
    padding: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .platform-context {
    margin: 0;
    padding: 10px 12px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--m-surface-alt) 46%, transparent);
  }

  .login-method-slider {
    margin: 0;
  }

  .login-content {
    display: block;
    min-height: 0;
  }

  :deep(.qr-login),
  :deep(.platform-qr-login) {
    padding: 2px 0 0;
  }

  :deep(.qr-login .login-title) {
    margin-bottom: 10px;
    font-size: 16px;
  }

  :deep(.qr-container),
  :deep(.platform-qr-login .qr-container) {
    width: min(196px, 58vw);
    height: min(196px, 58vw);
    border-radius: 16px;
  }

  :deep(.qr-status-text),
  :deep(.qr-login .text) {
    margin-top: 8px;
    font-size: 11px;
  }
}

.embedded-back {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--m-surface-alt) 62%, transparent);
  color: var(--m-text-primary);
  font-size: 20px;
}

.login-heading-copy {
  min-width: 0;
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

.login-platform-picker {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;

  button {
    display: grid;
    min-width: 0;
    min-height: 68px;
    place-items: center;
    align-content: center;
    gap: 5px;
    padding: 7px 4px;
    border: 1px solid transparent;
    border-radius: 16px;
    background: color-mix(in srgb, var(--m-surface-alt) 38%, transparent);
    color: var(--cover-text-muted, var(--d-text-muted));
    transition:
      transform 180ms cubic-bezier(0.32, 0.72, 0, 1),
      background 180ms ease,
      border-color 180ms ease,
      color 180ms ease;

    span {
      width: 100%;
      overflow: hidden;
      font-size: 10px;
      font-weight: 650;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &.active {
      border-color: color-mix(in srgb, var(--accent-color) 42%, transparent);
      background: color-mix(in srgb, var(--accent-color) 13%, transparent);
      color: var(--accent-color);
    }

    &:active {
      transform: scale(0.96);
    }
  }
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
  max-width: none;
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
