<template>
  <div class="spotify-login">
    <!-- 已登录状态 -->
    <div v-if="spotifyStore.loggedIn && spotifyStore.user" class="spotify-logged-in">
      <div class="spotify-user-card">
        <img
          v-if="spotifyStore.user.images?.length"
          :src="spotifyStore.user.images[0].url"
          alt=""
          class="spotify-avatar"
        />
        <div v-else class="spotify-avatar-placeholder">
          <i class="ri-user-3-line" />
        </div>
        <div class="spotify-user-info">
          <strong>{{ spotifyStore.user.display_name || 'Spotify User' }}</strong>
          <small>{{ spotifyStore.user.email || spotifyStore.user.id }}</small>
          <span v-if="spotifyStore.isPremium" class="spotify-premium-badge">Premium</span>
          <span v-else class="spotify-free-badge">Free</span>
        </div>
      </div>
      <button type="button" class="spotify-action-btn primary" @click="handleContinue">
        {{ t('login.spotify.continue') }}
      </button>
    </div>

    <!-- 登录中状态 -->
    <div v-else-if="spotifyStore.authLoading" class="spotify-loading">
      <div class="spotify-spinner">
        <i class="ri-loader-4-line" />
      </div>
      <p>{{ t('login.spotify.waiting') }}</p>
      <small>{{ t('login.spotify.waitingHint') }}</small>
    </div>

    <!-- 未登录状态 -->
    <div v-else class="spotify-login-form">
      <div class="spotify-brand">
        <platform-logo platform="spotify" :size="56" color="#1DB954" />
      </div>
      <p class="spotify-desc">{{ t('login.spotify.description') }}</p>

      <div v-if="spotifyStore.authError" class="spotify-error">
        <i class="ri-error-warning-line" />
        <span>{{ spotifyStore.authError }}</span>
      </div>

      <button
        type="button"
        class="spotify-login-btn"
        :disabled="spotifyStore.authLoading"
        @click="handleLogin"
      >
        <i class="ri-spotify-fill" />
        <span>{{ t('login.spotify.loginWithSpotify') }}</span>
      </button>

      <div class="spotify-features">
        <div class="spotify-feature">
          <i class="ri-music-2-line" />
          <span>{{ t('login.spotify.featureSearch') }}</span>
        </div>
        <div class="spotify-feature">
          <i class="ri-play-list-2-line" />
          <span>{{ t('login.spotify.featurePlaylist') }}</span>
        </div>
        <div class="spotify-feature">
          <i class="ri-vip-crown-line" />
          <span>{{ t('login.spotify.featurePremium') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import PlatformLogo from '@/components/common/PlatformLogo.vue';
import { useSpotifyStore } from '@/store/modules/spotify';
import { usePlatformAccountsStore } from '@/store/modules/platformAccounts';

const { t } = useI18n();
const emit = defineEmits<{
  'login-success': [];
}>();

const spotifyStore = useSpotifyStore();
const accountStore = usePlatformAccountsStore();

const saveSpotifyAccount = () => {
  if (!spotifyStore.user) return;
  const user = spotifyStore.user;
  accountStore.addOrUpdateAccount({
    platform: 'spotify',
    userId: user.id,
    nickname: user.display_name || user.id,
    avatarUrl: user.images?.[0]?.url || '',
    vip: user.product === 'premium',
    vipLabel: user.product === 'premium' ? 'Premium' : 'Free',
    cookie: '',
    loginMethod: 'oauth'
  });
};

const handleLogin = () => {
  spotifyStore.login();
};

const handleContinue = () => {
  saveSpotifyAccount();
  emit('login-success');
};

// 监听登录成功（可能由 deep link 回调触发）
const stopWatch = watch(
  () => spotifyStore.loggedIn,
  (loggedIn) => {
    if (loggedIn && spotifyStore.user) {
      // 等待 user 信息加载完成后再保存
      saveSpotifyAccount();
      emit('login-success');
    }
  }
);

onBeforeUnmount(() => {
  stopWatch();
});
</script>

<style lang="scss" scoped>
.spotify-login {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

/* ===== 已登录 ===== */
.spotify-logged-in {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.spotify-user-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 16px;
  background: var(--cover-surface-alt, rgba(128, 128, 128, 0.06));
  border: 1px solid var(--cover-border, rgba(128, 128, 128, 0.1));
}

.spotify-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.spotify-avatar-placeholder {
  display: flex;
  width: 52px;
  height: 52px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(29, 185, 84, 0.12);
  color: #1db954;
  font-size: 22px;
  flex-shrink: 0;
}

.spotify-user-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    font-size: 15px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    font-size: 12px;
    color: var(--cover-text-muted, var(--d-text-muted));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.spotify-premium-badge,
.spotify-free-badge {
  align-self: flex-start;
  margin-top: 4px;
  padding: 2px 10px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.spotify-premium-badge {
  background: #1db954;
  color: #fff;
}

.spotify-free-badge {
  background: rgba(128, 128, 128, 0.15);
  color: var(--cover-text-muted, var(--d-text-muted));
}

.spotify-action-btn {
  width: 100%;
  height: 46px;
  border: none;
  border-radius: 9999px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1),
    opacity 160ms ease;

  &.primary {
    background: #1db954;
    color: #fff;
  }

  &:active {
    transform: scale(0.97);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

/* ===== 加载中 ===== */
.spotify-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 0;

  p {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--cover-text-primary, var(--d-text-primary));
  }

  small {
    font-size: 12px;
    color: var(--cover-text-muted, var(--d-text-muted));
    text-align: center;
    max-width: 240px;
  }
}

.spotify-spinner {
  i {
    font-size: 36px;
    color: #1db954;
    animation: spotify-spin 1s linear infinite;
  }
}

@keyframes spotify-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ===== 未登录 ===== */
.spotify-login-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.spotify-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(29, 185, 84, 0.08);
}

.spotify-desc {
  margin: 0;
  text-align: center;
  font-size: 13px;
  line-height: 1.6;
  color: var(--cover-text-muted, var(--d-text-muted));
  max-width: 280px;
}

.spotify-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 12px;
  background: rgba(233, 69, 96, 0.1);
  color: #e94560;
  font-size: 12px;

  i {
    font-size: 16px;
    flex-shrink: 0;
  }
}

.spotify-login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 50px;
  border: none;
  border-radius: 9999px;
  background: #1db954;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1),
    opacity 160ms ease;

  i {
    font-size: 22px;
  }

  &:active {
    transform: scale(0.97);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.spotify-features {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: 4px;
}

.spotify-feature {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--cover-surface-alt, rgba(128, 128, 128, 0.04));

  i {
    font-size: 18px;
    color: #1db954;
    flex-shrink: 0;
  }

  span {
    font-size: 13px;
    color: var(--cover-text-secondary, var(--d-text-secondary));
  }
}

@media (prefers-reduced-motion: reduce) {
  .spotify-spinner i {
    animation-duration: 3s;
  }

  .spotify-action-btn,
  .spotify-login-btn {
    transition: none;
  }
}
</style>
