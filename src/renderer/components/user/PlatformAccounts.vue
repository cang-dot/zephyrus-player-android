<template>
  <section class="platform-accounts">
    <header class="accounts-header">
      <div>
        <h2>{{ t('settings.playback.platforms.title') }}</h2>
        <p>{{ t('settings.playback.platforms.desc') }}</p>
      </div>
      <button type="button" class="header-add" @click="openLogin()">
        <i class="ri-add-line" />
        <span>{{ t('settings.playback.platforms.login') }}</span>
      </button>
    </header>

    <div class="platform-groups">
      <section v-for="platform in platformConfigs" :key="platform.key" class="platform-group">
        <header class="platform-header">
          <span class="platform-icon">
            <platform-logo :platform="platform.key" :size="23" />
          </span>
          <span class="platform-copy">
            <strong>{{ platform.name }}</strong>
            <small>{{ platform.description }}</small>
          </span>
          <button type="button" class="platform-login" @click="openLogin(platform.key)">
            <i class="ri-add-line" />
            <span>{{ t('settings.playback.platforms.login') }}</span>
          </button>
        </header>

        <TransitionGroup name="account-row" tag="div" class="platform-account-list">
          <div
            v-for="account in accountsForPlatform(platform.key)"
            :key="account.accountId"
            class="platform-account"
            :class="{ active: account.accountId === accountStore.activeAccountId }"
            role="button"
            tabindex="0"
            @click="switchAccount(account)"
            @keydown.enter="switchAccount(account)"
            @keydown.space.prevent="switchAccount(account)"
          >
            <span class="platform-account-avatar">
              <img v-if="account.avatarUrl" :src="account.avatarUrl" alt="" />
              <platform-logo v-else :platform="account.platform" :size="24" />
            </span>

            <span class="platform-account-copy">
              <span class="account-name-line">
                <strong>{{ account.nickname }}</strong>
                <span v-if="account.vip" class="vip-badge">
                  {{ account.vipLabel || 'VIP' }}
                </span>
              </span>
              <small>{{ methodLabel(account.loginMethod) }}</small>
            </span>

            <i
              v-if="account.accountId === accountStore.activeAccountId"
              class="ri-check-line active-check"
            />
            <button
              type="button"
              class="account-remove"
              @click.stop="confirmRemoveAccount(account)"
            >
              <i class="ri-delete-bin-line" />
            </button>
          </div>

          <button
            v-if="!accountsForPlatform(platform.key).length"
            :key="`${platform.key}-empty`"
            type="button"
            class="platform-empty"
            @click="openLogin(platform.key)"
          >
            <i class="ri-login-circle-line" />
            <span>{{ t('settings.playback.platforms.notLoggedIn') }}</span>
            <i class="ri-arrow-right-s-line" />
          </button>
        </TransitionGroup>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useDialog, useMessage } from 'naive-ui';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import PlatformLogo from '@/components/common/PlatformLogo.vue';
import {
  MUSIC_PLATFORMS,
  type MusicPlatform,
  type PlatformAccount,
  type PlatformLoginMethod,
  usePlatformAccountsStore
} from '@/store/modules/platformAccounts';

const { t } = useI18n();
const router = useRouter();
const dialog = useDialog();
const message = useMessage();
const accountStore = usePlatformAccountsStore();

const platformConfigs = computed(() =>
  MUSIC_PLATFORMS.map((platform) => ({
    key: platform,
    name: t(`login.platform.${platform}`),
    description:
      platform === 'netease'
        ? t('login.tokenTip')
        : t(`settings.playback.platforms.${platform}.desc`)
  }))
);

const accountsForPlatform = (platform: MusicPlatform) => accountStore.accountsForPlatform(platform);

const methodLabel = (method: PlatformLoginMethod) => t(`login.title.${method}`);

const openLogin = (platform?: MusicPlatform) => {
  router.push({
    path: '/login',
    query: platform ? { platform } : undefined
  });
};

const switchAccount = (account: PlatformAccount) => {
  if (accountStore.setActiveAccount(account.accountId)) {
    message.success(account.nickname);
  }
};

const removeAccount = (account: PlatformAccount) => {
  if (!accountStore.removeAccount(account.accountId)) return;
  message.success(t('settings.playback.platforms.logoutSuccess'));
};

const confirmRemoveAccount = (account: PlatformAccount) => {
  dialog.warning({
    title: t('common.delete'),
    content: `${t('common.delete')} “${account.nickname}”?`,
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: () => removeAccount(account)
  });
};
</script>

<style lang="scss" scoped>
.platform-accounts {
  color: var(--cover-text-primary, var(--d-text-primary));
}

.accounts-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
  }

  p {
    max-width: 540px;
    margin: 4px 0 0;
    color: var(--cover-text-muted, var(--d-text-muted));
    font-size: 12px;
    line-height: 1.55;
  }
}

.header-add,
.platform-login {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 0;
  border-radius: 9999px;
  background: var(--accent-color);
  color: #fff;
  cursor: pointer;
  transition:
    filter 160ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:hover {
    filter: brightness(1.06);
  }

  &:active {
    transform: scale(0.97);
  }
}

.header-add {
  height: 36px;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 600;
}

.platform-groups {
  display: grid;
  gap: 12px;
}

.platform-group {
  overflow: hidden;
  border: 1px solid var(--cover-border, var(--d-border-light));
  border-radius: var(--d-radius-lg);
  background: var(--cover-surface-alt, var(--d-surface-alt));
  transition:
    border-color 160ms ease,
    background-color 160ms ease;
}

.platform-header {
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 11px;
  padding: 10px 12px;
}

.platform-icon {
  display: flex;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.1);
  color: var(--accent-color);
}

.platform-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;

  strong {
    font-size: 14px;
    font-weight: 650;
  }

  small {
    margin-top: 2px;
    overflow: hidden;
    color: var(--cover-text-muted, var(--d-text-muted));
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.platform-login {
  height: 30px;
  padding: 0 11px;
  background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.12);
  color: var(--accent-color);
  font-size: 11px;
  font-weight: 600;
}

.platform-account-list {
  display: grid;
  gap: 1px;
  padding: 0 6px 6px;
}

.platform-account,
.platform-empty {
  display: flex;
  width: 100%;
  min-height: 54px;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--d-radius-md);
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    background-color 160ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:hover,
  &.active {
    background: var(--cover-surface-hover, var(--d-surface-hover));
  }

  &:active {
    transform: scale(0.995);
  }
}

.platform-account.active {
  box-shadow: inset 3px 0 0 var(--accent-color);
}

.platform-account-avatar {
  display: flex;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--cover-surface-active, var(--d-surface-active));
  color: var(--accent-color);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.platform-account-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;

  small {
    margin-top: 2px;
    color: var(--cover-text-muted, var(--d-text-muted));
    font-size: 10px;
  }
}

.account-name-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;

  strong {
    overflow: hidden;
    font-size: 13px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.vip-badge {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 9999px;
  background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.12);
  color: var(--accent-color);
  font-size: 9px;
  font-weight: 700;
}

.active-check {
  color: var(--accent-color);
  font-size: 17px;
}

.account-remove {
  display: flex;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--cover-text-muted, var(--d-text-muted));
  cursor: pointer;
  transition:
    color 150ms ease,
    background-color 150ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  &:active {
    transform: scale(0.94);
  }
}

.platform-empty {
  min-height: 46px;
  color: var(--cover-text-muted, var(--d-text-muted));
  font-size: 12px;

  span {
    flex: 1;
  }
}

.account-row-enter-active,
.account-row-leave-active {
  transition:
    opacity 180ms ease,
    transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
}

.account-row-enter-from,
.account-row-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (prefers-reduced-motion: reduce) {
  .header-add,
  .platform-login,
  .platform-group,
  .platform-account,
  .platform-empty,
  .account-remove,
  .account-row-enter-active,
  .account-row-leave-active {
    transition-duration: 0ms;
  }

  .header-add:active,
  .platform-login:active,
  .platform-account:active,
  .platform-empty:active,
  .account-remove:active {
    transform: none;
  }
}
</style>
