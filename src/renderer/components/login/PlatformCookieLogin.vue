<template>
  <div class="platform-cookie-login">
    <!-- 平台标识 -->
    <div class="cookie-platform-header">
      <platform-logo :platform="platform" :size="22" />
      <span class="cookie-platform-name">{{ platformName }}</span>
    </div>

    <!-- Cookie 输入 -->
    <div class="cookie-input-wrap">
      <textarea
        v-model="cookieValue"
        class="cookie-input"
        :placeholder="placeholderText"
        rows="4"
      />
    </div>

    <!-- 说明 -->
    <div class="cookie-tip">
      {{ tipText }}
    </div>

    <!-- 按钮 -->
    <n-button class="btn-login" :loading="validating" @click="handleLogin">
      {{ t('login.button.cookieLogin') }}
    </n-button>

    <!-- 自动获取 Cookie（仅桌面端网易云） -->
    <n-button
      v-if="platform === 'netease' && isElectron"
      class="btn-auto-cookie"
      @click="autoGetCookie"
    >
      {{ t('login.button.autoGetCookie') }}
    </n-button>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import PlatformLogo from '@/components/common/PlatformLogo.vue';
import type { MusicPlatform } from '@/store/modules/platformAccounts';
import { isElectron } from '@/utils';

const props = defineProps<{
  platform: MusicPlatform;
  platformName: string;
}>();

const emit = defineEmits<{
  (e: 'loginSuccess', userInfo: any, cookie: string): void;
  (e: 'loginError', error: string): void;
}>();

const { t } = useI18n();
const message = useMessage();

const cookieValue = ref('');
const validating = ref(false);

const placeholderText = computed(() => {
  switch (props.platform) {
    case 'netease':
      return t('login.placeholder.cookie');
    case 'qq':
      return '粘贴 QQ 音乐 Cookie，例如：uin=12345; qm_keyst=abc;';
    case 'kugou':
      return '粘贴酷狗音乐 Cookie，例如：userid=123; token=abc;';
    case 'kuwo':
      return '粘贴酷我音乐 Cookie';
    case 'migu':
      return '粘贴咪咕音乐 Cookie';
    default:
      return '请输入 Cookie';
  }
});

const tipText = computed(() => {
  switch (props.platform) {
    case 'netease':
      return t('login.tokenTip');
    case 'qq':
      return '需要 uin 和 qm_keyst Cookie 才能解锁高品质音源';
    case 'kugou':
      return '需要 userid 和 token Cookie 才能使用账号功能';
    case 'kuwo':
      return 'Cookie 仅保存在本机，用于请求酷我账号数据';
    case 'migu':
      return 'Cookie 仅保存在本机，用于请求咪咕账号数据';
    default:
      return '';
  }
});

const handleLogin = async () => {
  if (!cookieValue.value.trim()) {
    const errorMsg = t('login.message.tokenRequired');
    message.error(errorMsg);
    emit('loginError', errorMsg);
    return;
  }

  validating.value = true;

  try {
    const cookie = cookieValue.value.trim();

    if (props.platform === 'netease') {
      // 网易云：设置 token 并验证
      localStorage.setItem('token', cookie);

      // 动态导入避免循环依赖
      const { getUserDetail } = await import('@/api/login');
      const user = await getUserDetail();
      if (user.data && user.data.profile) {
        message.success(t('login.message.tokenLoginSuccess'));
        emit('loginSuccess', user.data.profile, cookie);
      } else {
        localStorage.removeItem('token');
        const errorMsg = t('login.message.tokenInvalid');
        message.error(errorMsg);
        emit('loginError', errorMsg);
      }
    } else {
      if (window.api?.setPlatformCookie) {
        await window.api.setPlatformCookie(props.platform, cookie);
      }
      localStorage.setItem(`platform-cookie-${props.platform}`, cookie);

      message.success(`${props.platformName} Cookie 保存成功`);
      const cookieEntries = Object.fromEntries(
        cookie
          .split(';')
          .map((entry) => entry.trim().split('='))
          .filter(([key, value]) => key && value)
      );
      emit(
        'loginSuccess',
        {
          userId:
            cookieEntries.uin ||
            cookieEntries.userid ||
            cookieEntries.uid ||
            cookieEntries.userId ||
            '',
          nickname: `${props.platformName}用户`
        },
        cookie
      );
    }
  } catch (error: any) {
    if (props.platform === 'netease') {
      localStorage.removeItem('token');
    }
    const errorMsg =
      props.platform === 'netease'
        ? t('login.message.tokenInvalid')
        : `${props.platformName} Cookie 无效`;
    message.error(errorMsg);
    emit('loginError', errorMsg);
    console.error(`${props.platformName} Cookie 登录失败:`, error);
  } finally {
    validating.value = false;
  }
};

// 网易云自动获取 Cookie
const autoGetCookie = () => {
  if (!isElectron) return;
  message.info(t('login.message.autoGetCookieTip'));
  window.electron.ipcRenderer.send('open-login');
};

// 监听 Cookie 接收（仅网易云）
const handleCookieReceived = async (_event: any, cookieValue: string) => {
  try {
    localStorage.setItem('token', cookieValue);
    const { getUserDetail } = await import('@/api/login');
    const user = await getUserDetail();
    if (user.data && user.data.profile) {
      message.success(t('login.message.autoGetCookieSuccess'));
      emit('loginSuccess', user.data.profile, cookieValue);
    } else {
      localStorage.removeItem('token');
      message.error(t('login.message.autoGetCookieFailed'));
      emit('loginError', t('login.message.autoGetCookieFailed'));
    }
  } catch {
    localStorage.removeItem('token');
    message.error(t('login.message.autoGetCookieFailed'));
    emit('loginError', t('login.message.autoGetCookieFailed'));
  }
};

onMounted(() => {
  if (isElectron && props.platform === 'netease') {
    window.electron.ipcRenderer.on('send-cookies', handleCookieReceived);
  }
});

onBeforeUnmount(() => {
  if (isElectron && props.platform === 'netease') {
    window.electron.ipcRenderer.removeAllListeners('send-cookies');
  }
});
</script>

<style lang="scss" scoped>
.platform-cookie-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: cookie-login-enter 220ms cubic-bezier(0.23, 1, 0.32, 1) both;
}

.cookie-platform-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;

  .cookie-platform-name {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--cover-text-primary, var(--d-text-primary));
  }
}

.cookie-input-wrap {
  width: 250px;
  border-radius: var(--m-radius-lg, 16px);
  overflow: hidden;
  background: var(--cover-surface-alt, var(--d-surface-alt));
  border: 1px solid var(--cover-border, var(--d-border));
  transition:
    border-color 160ms ease,
    box-shadow 180ms ease;

  &:focus-within {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px rgba(var(--accent-color-rgb, 136, 136, 136), 0.1);
  }
}

.cookie-input {
  width: 100%;
  outline: none;
  resize: none;
  color: var(--cover-text-primary, var(--d-text-primary));
  background: transparent;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.4;
  min-height: 100px;
  padding: 16px;
  border: none;
  box-sizing: border-box;

  &::placeholder {
    color: var(--cover-text-muted, var(--d-text-muted));
  }

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--d-border-strong);
    border-radius: 2px;
  }
}

.cookie-tip {
  margin-top: 12px;
  color: var(--cover-text-muted, var(--d-text-muted));
  font-size: 12px;
  text-align: center;
}

.btn-login {
  width: 250px;
  height: 44px;
  margin-top: 24px;
  border-radius: 12px;
  color: #fff;
  background: var(--accent-color);
  transition:
    filter 160ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:active {
    transform: scale(0.97);
  }

  &:hover {
    filter: brightness(1.06);
  }
}

.btn-auto-cookie {
  width: 250px;
  height: 40px;
  margin-top: 12px;
  border-radius: 12px;
  color: var(--cover-text-secondary, var(--d-text-secondary));
  background: var(--cover-surface-alt, var(--d-surface-alt));
  transition:
    background-color 160ms ease,
    color 160ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:hover {
    background: var(--cover-surface-hover, var(--d-surface-hover));
    color: var(--accent-color);
  }

  &:active {
    transform: scale(0.98);
  }
}

@keyframes cookie-login-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .platform-cookie-login {
    animation: none;
  }

  .cookie-input-wrap,
  .btn-login,
  .btn-auto-cookie {
    transition-duration: 0ms;
  }

  .btn-login:active,
  .btn-auto-cookie:active {
    transform: none;
  }
}
</style>
