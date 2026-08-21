<template>
  <div class="platform-qr-login">
    <div class="qr-platform-header">
      <platform-logo :platform="platform" :size="22" />
      <span>{{ platformName }}</span>
    </div>

    <div
      v-if="platform === 'qq'"
      class="qq-provider-switch"
      role="tablist"
      aria-label="QQ 音乐登录方式"
    >
      <button
        v-for="item in qqProviders"
        :key="item.key"
        type="button"
        role="tab"
        :aria-selected="provider === item.key"
        :class="{ active: provider === item.key }"
        @click="switchProvider(item.key)"
      >
        <i :class="item.icon" />
        <span>{{ item.label }}</span>
      </button>
    </div>

    <div class="qr-container">
      <div v-if="qrStatus === 'loading'" class="qr-loading">
        <n-spin size="large" />
        <span>{{ t('login.message.qrGenerating') }}</span>
      </div>

      <div v-else-if="qrUrl" class="qr-image-wrapper">
        <img class="qr-img" :src="qrUrl" alt="QR Code" />

        <Transition name="qr-overlay">
          <div v-if="qrStatus === 'expired' || qrStatus === 'error'" class="qr-overlay">
            <span>
              {{
                qrStatus === 'expired'
                  ? t('login.message.qrExpiredShort')
                  : t('login.message.loginFailed')
              }}
            </span>
            <n-button type="primary" :loading="isRefreshing" @click="loadQr">
              {{ isRefreshing ? t('login.button.refreshing') : t('login.button.refresh') }}
            </n-button>
          </div>
        </Transition>

        <Transition name="qr-overlay">
          <div v-if="qrStatus === 'scanned'" class="qr-overlay qr-overlay--scanned">
            <i class="ri-check-line" />
            <span>{{ t('login.message.qrScannedShort') }}</span>
          </div>
        </Transition>
      </div>

      <div v-else class="qr-error">
        <i class="ri-qr-code-line" />
        <n-button text :loading="isRefreshing" @click="loadQr">
          {{ t('login.button.refreshQr') }}
        </n-button>
      </div>
    </div>

    <p class="qr-status-text" :class="`status-${qrStatus}`">{{ statusText }}</p>

    <n-button
      v-if="qrStatus === 'active'"
      text
      class="manual-refresh"
      :loading="isRefreshing"
      @click="loadQr"
    >
      {{ t('login.button.refreshQr') }}
    </n-button>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import QRCode from 'qrcode';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { createPlatformQr, pollPlatformQr, type QqLoginProvider } from '@/api/platformQrApi';
import PlatformLogo from '@/components/common/PlatformLogo.vue';

type QrStatus = 'loading' | 'active' | 'expired' | 'scanned' | 'confirmed' | 'error';

const props = defineProps<{
  platform: 'qq' | 'kugou';
  platformName: string;
}>();

const emit = defineEmits<{
  loginSuccess: [userInfo: any, cookie: string];
  loginError: [error: string];
}>();

const { t } = useI18n();
const message = useMessage();

const qrUrl = ref('');
const qrKey = ref('');
const qrStatus = ref<QrStatus>('loading');
const isRefreshing = ref(false);
const errorText = ref('');
const consecutivePollFailures = ref(0);
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let pollingStopped = false;
let requestVersion = 0;
const provider = ref<QqLoginProvider>('qq');
const qqProviders: Array<{ key: QqLoginProvider; label: string; icon: string }> = [
  { key: 'qq', label: 'QQ 扫码', icon: 'ri-qq-fill' },
  { key: 'wechat', label: '微信扫码', icon: 'ri-wechat-fill' }
];

const statusText = computed(() => {
  switch (qrStatus.value) {
    case 'loading':
      return t('login.message.qrLoading');
    case 'active':
      return props.platform === 'qq'
        ? provider.value === 'wechat'
          ? '请使用微信扫码并确认登录'
          : '请使用 QQ APP 扫码登录'
        : `请使用${props.platformName} APP扫码登录`;
    case 'expired':
      return t('login.message.qrExpired');
    case 'scanned':
      return t('login.message.qrScanned');
    case 'confirmed':
      return t('login.message.qrConfirmed');
    case 'error':
      return errorText.value || t('login.message.loginFailed');
    default:
      return '';
  }
});

const clearPollTimer = () => {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
};

const schedulePoll = (delay = 3000) => {
  clearPollTimer();
  if (!pollingStopped) {
    pollTimer = setTimeout(pollOnce, delay);
  }
};

const pollOnce = async () => {
  if (pollingStopped || !qrKey.value) return;
  const version = requestVersion;
  const key = qrKey.value;
  const activeProvider = provider.value;

  try {
    const result = await pollPlatformQr(props.platform, key, activeProvider);
    if (version !== requestVersion || key !== qrKey.value || activeProvider !== provider.value)
      return;
    consecutivePollFailures.value = 0;
    switch (result.code) {
      case 'waiting':
        qrStatus.value = 'active';
        schedulePoll();
        break;
      case 'scanned':
        qrStatus.value = 'scanned';
        schedulePoll();
        break;
      case 'expired':
        qrStatus.value = 'expired';
        clearPollTimer();
        break;
      case 'success':
        qrStatus.value = 'confirmed';
        clearPollTimer();
        if (result.cookie) {
          localStorage.setItem(`platform-cookie-${props.platform}`, result.cookie);
        }
        message.success(`${props.platformName} ${t('login.message.loginSuccess')}`);
        emit('loginSuccess', result.userInfo || {}, result.cookie || '');
        break;
      case 'error':
        errorText.value = result.message || t('login.message.loginFailed');
        qrStatus.value = 'error';
        clearPollTimer();
        message.error(result.message || t('login.message.loginFailed'));
        emit('loginError', result.message || t('login.message.loginFailed'));
        break;
    }
  } catch (error: any) {
    console.error(`${props.platformName} 轮询失败:`, error);
    consecutivePollFailures.value += 1;
    if (consecutivePollFailures.value >= 3) {
      errorText.value = error?.message || t('login.message.qrCheckFailed');
      qrStatus.value = 'error';
      clearPollTimer();
      emit('loginError', errorText.value);
      return;
    }
    schedulePoll(2000);
  }
};

const normalizeQrUrl = async (sourceUrl: string) => {
  if (/^https:\/\/open\.weixin\.qq\.com\/connect\/qrcode\//i.test(sourceUrl)) {
    return sourceUrl;
  }
  if (sourceUrl.startsWith('http') && !sourceUrl.match(/\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i)) {
    return QRCode.toDataURL(sourceUrl, {
      width: 280,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });
  }
  return sourceUrl;
};

const loadQr = async () => {
  const version = ++requestVersion;
  const activeProvider = provider.value;
  isRefreshing.value = true;
  qrStatus.value = 'loading';
  qrUrl.value = '';
  qrKey.value = '';
  errorText.value = '';
  consecutivePollFailures.value = 0;
  pollingStopped = false;
  clearPollTimer();

  try {
    const result = await createPlatformQr(props.platform, activeProvider);
    if (version !== requestVersion || activeProvider !== provider.value) return;
    if (result.error || !result.key || !result.qrUrl) {
      throw new Error(result.error || t('login.message.qrCheckFailed'));
    }

    qrKey.value = result.key;
    qrUrl.value = await normalizeQrUrl(result.qrUrl);
    qrStatus.value = 'active';
    schedulePoll(1000);
  } catch (error: any) {
    if (version !== requestVersion) return;
    const errorMessage = error?.message || t('login.message.qrCheckFailed');
    errorText.value = errorMessage;
    qrStatus.value = 'error';
    message.error(errorMessage);
    emit('loginError', errorMessage);
  } finally {
    if (version === requestVersion) isRefreshing.value = false;
  }
};

const switchProvider = (nextProvider: QqLoginProvider) => {
  if (provider.value === nextProvider) return;
  provider.value = nextProvider;
  void loadQr();
};

onMounted(loadQr);

onUnmounted(() => {
  requestVersion += 1;
  pollingStopped = true;
  clearPollTimer();
});
</script>

<style lang="scss" scoped>
.platform-qr-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--cover-text-primary, var(--d-text-primary));
  animation: qr-login-enter 220ms cubic-bezier(0.23, 1, 0.32, 1) both;
}

.qr-platform-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
  color: var(--accent-color);

  span {
    color: var(--cover-text-primary, var(--d-text-primary));
    font-size: 17px;
    font-weight: 700;
  }
}

.qq-provider-switch {
  display: grid;
  width: min(300px, 78vw);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  margin: 0 0 14px;
  padding: 3px;
  border: 1px solid var(--cover-border, rgba(128, 128, 128, 0.12));
  border-radius: 8px;
  background: color-mix(in srgb, var(--cover-surface, #888) 48%, transparent);
}

.qq-provider-switch button {
  display: inline-flex;
  min-width: 0;
  height: 34px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--cover-text-muted, var(--d-text-muted));
  font-size: 12px;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.qq-provider-switch button.active {
  background: var(--cover-surface, rgba(128, 128, 128, 0.14));
  color: var(--cover-text-primary, var(--d-text-primary));
}

.qr-container {
  position: relative;
  display: flex;
  width: 200px;
  height: 200px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--cover-border, var(--d-border-light));
  border-radius: var(--d-radius-lg);
  background: #fff;
}

.qr-loading,
.qr-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--d-text-muted);
  font-size: 12px;
}

.qr-error i {
  color: var(--accent-color);
  font-size: 36px;
}

.qr-image-wrapper,
.qr-img {
  width: 100%;
  height: 100%;
}

.qr-img {
  object-fit: contain;
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.23, 1, 0.32, 1);
}

.qr-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.9);
  color: #1a1a1a;
  font-size: 13px;
  backdrop-filter: blur(4px);

  &--scanned {
    background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.9);
    color: #fff;

    i {
      font-size: 44px;
    }
  }
}

.qr-status-text {
  min-height: 20px;
  margin: 14px 0 0;
  color: var(--cover-text-secondary, var(--d-text-secondary));
  font-size: 12px;
  text-align: center;
  transition: color 160ms ease;

  &.status-expired,
  &.status-error {
    color: var(--accent-color);
  }
}

.manual-refresh {
  margin-top: 8px;
  color: var(--cover-text-muted, var(--d-text-muted));
  font-size: 12px;
  transition:
    color 150ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:hover {
    color: var(--accent-color);
  }

  &:active {
    transform: scale(0.97);
  }
}

.qr-overlay-enter-active,
.qr-overlay-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.23, 1, 0.32, 1);
}

.qr-overlay-enter-from,
.qr-overlay-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

@keyframes qr-login-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .platform-qr-login {
    animation: none;
  }

  .qr-img,
  .qr-status-text,
  .manual-refresh,
  .qr-overlay-enter-active,
  .qr-overlay-leave-active {
    transition-duration: 0ms;
  }

  .manual-refresh:active {
    transform: none;
  }
}
</style>
