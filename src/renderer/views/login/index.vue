<template>
  <div class="login-page">
    <div class="login-fullscreen" :class="setAnimationClass('animate__fadeIn')">
      <!-- Logo + 标语 -->
      <div class="login-header">
        <h1 class="login-logo">Zephyrus</h1>
        <p class="login-tagline">{{ t('comp.homeHero.discoverMusic') }}</p>
      </div>

      <!-- 白色圆角卡片 -->
      <div class="login-card">
        <!-- Tab导航 -->
        <div class="login-tabs" :class="setAnimationClass('animate__fadeInUp')">
          <div
            v-for="tab in loginTabs"
            :key="tab.key"
            class="tab-item"
            :class="{ active: activeMode === tab.key }"
            @click="switchToMode(tab.key)"
          >
            {{ tab.label }}
          </div>
        </div>

        <!-- 登录内容区域 -->
        <div class="login-content">
          <transition
            name="login-content"
            mode="out-in"
            enter-active-class="animate__animated animate__fadeIn"
            leave-active-class="animate__animated animate__fadeOut"
          >
            <div v-if="activeMode === LoginMode.QR && !isTransitioning" key="qr" class="login-form">
              <qr-login @login-success="handleLoginSuccess" @login-error="handleLoginError" />
            </div>
            <div
              v-else-if="activeMode === LoginMode.PHONE && !isTransitioning"
              key="phone"
              class="login-form"
            >
              <div class="login-title">{{ t('login.title.phone') }}</div>
              <div class="phone-page">
                <input
                  v-model="phone"
                  class="phone-input"
                  type="text"
                  :placeholder="t('login.placeholder.phone')"
                />
                <input
                  v-model="password"
                  class="phone-input"
                  type="password"
                  :placeholder="t('login.placeholder.password')"
                />
              </div>
              <div class="text">{{ t('login.phoneTip') }}</div>
              <n-button class="btn-login" @click="loginPhone()">{{
                t('login.button.login')
              }}</n-button>
            </div>
            <div
              v-else-if="activeMode === LoginMode.UID && !isTransitioning"
              key="uid"
              class="login-form"
            >
              <uid-login @login-success="handleLoginSuccess" @login-error="handleLoginError" />
            </div>
            <div
              v-else-if="activeMode === LoginMode.COOKIE && !isTransitioning"
              key="token"
              class="login-form"
            >
              <cookie-login @login-success="handleLoginSuccess" @login-error="handleLoginError" />
            </div>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { loginByCellphone } from '@/api/login';
import CookieLogin from '@/components/login/CookieLogin.vue';
import QrLogin from '@/components/login/QrLogin.vue';
import UidLogin from '@/components/login/UidLogin.vue';
import { useUserStore } from '@/store/modules/user';
import { setAnimationClass } from '@/utils';

defineOptions({
  name: 'Login'
});

// 登录模式枚举
enum LoginMode {
  QR = 'qr',
  PHONE = 'phone',
  UID = 'uid',
  COOKIE = 'cookie'
}

const { t } = useI18n();
const message = useMessage();
const router = useRouter();
const userStore = useUserStore();

// 当前激活的登录模式
const activeMode = ref<LoginMode>(LoginMode.QR);
// 用于控制内容切换动画
const isTransitioning = ref(false);

// 登录选项配置
const loginTabs = computed(() => [
  { key: LoginMode.QR, label: t('login.title.qr') },
  { key: LoginMode.COOKIE, label: t('login.title.cookie') },
  { key: LoginMode.UID, label: t('login.title.uid') }
]);

// 手机号登录
const phone = ref('');
const password = ref('');
const loginPhone = async () => {
  try {
    if (!phone.value.trim()) {
      message.error(t('login.message.phoneRequired'));
      return;
    }
    if (!password.value.trim()) {
      message.error(t('login.message.passwordRequired'));
      return;
    }

    const { data } = await loginByCellphone(phone.value, password.value);
    if (data.code === 200) {
      message.success(t('login.message.loginSuccess'));
      userStore.setUser(data.profile);
      localStorage.setItem('token', data.cookie);
      setTimeout(() => {
        router.push('/user');
      }, 1000);
    } else {
      message.error(t('login.message.phoneLoginFailed'));
    }
  } catch (error) {
    message.error(t('login.message.phoneLoginFailed'));
    console.error(t('login.message.loginFailed') + ':', error);
  }
};

// 切换登录模式（带动画效果）
const switchToMode = (mode: LoginMode) => {
  if (mode === activeMode.value) return;

  isTransitioning.value = true;
  setTimeout(() => {
    activeMode.value = mode;
    setTimeout(() => {
      isTransitioning.value = false;
    }, 50);
  }, 150);
};

// 通用登录成功处理
const handleLoginSuccess = (userProfile: any, loginType: string) => {
  // 更新 userStore（这会同时更新 store 状态和 localStorage 中的用户数据）
  userStore.setUser(userProfile);

  // 设置登录类型到 userStore 和 localStorage
  userStore.setLoginType(loginType as any);

  // 设置其他相关状态
  const token = loginType !== 'uid' ? localStorage.getItem('token') : undefined;

  if (token) {
    localStorage.setItem('token', token);
  }

  if (loginType === 'uid') {
    localStorage.setItem('uidLogin', 'true');
  }

  setTimeout(() => {
    router.push('/user');
  }, 1000);
};

// 通用登录错误处理
const handleLoginError = (error: string) => {
  console.error(t('login.message.loginFailed') + ':', error);
};
</script>

<style lang="scss" scoped>
.login-page {
  @apply flex flex-col items-center justify-center h-full w-full;
  background: #0a0a0a;
}

.login-fullscreen {
  @apply flex flex-col items-center justify-center w-full h-full px-6;
  background: linear-gradient(160deg, #1a1a2e 0%, #0a0a0a 50%, #16213e 100%);
  padding-top: calc(var(--safe-area-inset-top, 0px) + 60px);
  padding-bottom: calc(var(--safe-area-inset-bottom, 0px) + 40px);
  animation-duration: 0.8s;
}

.login-header {
  @apply flex flex-col items-center mb-8;
  animation-duration: 0.6s;
  animation-delay: 0.1s;
}

.login-logo {
  font-family: var(--m-font-serif, 'Cormorant Garamond', serif);
  font-size: 42px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #fff;
  text-shadow: 0 2px 20px rgba(255, 255, 255, 0.15);
}

.login-tagline {
  @apply mt-2 text-sm;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.1em;
}

.login-card {
  @apply w-full max-w-sm rounded-3xl p-6;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  animation-duration: 0.6s;
  animation-delay: 0.2s;
}

.login-title {
  @apply text-2xl font-bold mb-6;
  color: #1a1a1a;
}

.text {
  @apply mt-4 text-xs;
  color: #666;
}

.login-tabs {
  @apply flex mb-6 bg-gray-100 rounded-xl p-1;

  .tab-item {
    @apply flex-1 py-2 px-3 text-sm text-center cursor-pointer rounded-lg transition-all duration-300;
    color: #666;
    transform: translateY(0);

    &:active {
      transform: scale(0.97);
    }

    &.active {
      @apply font-medium text-white;
      background: var(--accent-color);
      transform: none;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }
  }
}

.login-content {
  @apply flex items-center justify-center;
  min-height: 280px;
}

.login-form {
  animation-duration: 0.5s;
  width: 100%;
  max-width: 300px;
}

.phone-page {
  @apply rounded-2xl overflow-hidden;
  background: #f5f5f5;
  width: 100%;
  margin: 0 auto;
}

.phone-input {
  height: 44px;
  @apply w-full px-4 outline-none;
  color: #1a1a1a;
  background: transparent;
  border-bottom: 1px solid #e0e0e0;
  transition: border-color 0.3s ease;

  &:focus {
    border-color: var(--accent-color);
  }

  &::placeholder {
    color: #999;
  }
}

.btn-login {
  width: 100%;
  height: 44px;
  @apply mt-8 rounded-xl;
  color: #fff;
  background: var(--accent-color);
  transition:
    transform 0.2s ease,
    brightness 0.2s ease;

  &:active {
    transform: scale(0.97);
  }

  &:hover {
    brightness: 0.9;
  }
}

/* 登录内容切换动画 */
.login-content-enter-active,
.login-content-leave-active {
  animation-duration: 0.3s;
}

.login-content-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.login-content-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
