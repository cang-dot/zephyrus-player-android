<template>
  <div class="h-full w-full page-bg transition-colors duration-500">
    <div class="ac-scroll" style="padding-top: var(--mobile-topbar-inset)">
      <!-- 登录视图：内嵌登录组件 -->
      <template v-if="view === 'login'">
        <section class="ac-card ac-login-card">
          <account-login-morph @back="closeLogin" @success="onLoginSuccess" @error="onLoginError" />
        </section>
      </template>

      <!-- 列表视图 -->
      <template v-else>
        <section class="ac-card">
          <div
            v-for="account in accounts"
            :key="account.accountId"
            class="ac-row"
            role="button"
            tabindex="0"
            :class="{ active: account.accountId === activeAccountId }"
            @click="switchAccount(account)"
            @keydown.enter.prevent="switchAccount(account)"
            @keydown.space.prevent="switchAccount(account)"
          >
            <div class="ac-row-main">
              <img
                v-if="account.avatarUrl"
                class="ac-row-avatar"
                :src="getImgUrl(account.avatarUrl, '72y72')"
                alt=""
              />
              <span v-else class="ac-row-avatar ac-avatar-placeholder">
                <i class="ri-user-3-line" />
              </span>
              <div class="ac-row-copy">
                <strong>{{ account.nickname }}</strong>
                <small>{{ platformDisplayName(account.platform) }}</small>
              </div>
              <i
                v-if="account.accountId === activeAccountId"
                class="ri-check-line ac-active-check"
                :aria-label="t('user.accounts.activeBadge')"
              />
              <button
                type="button"
                class="ac-delete-trigger"
                :aria-label="t('common.delete')"
                @click.stop="askDelete(account.accountId)"
              >
                <i class="ri-close-line" />
              </button>
            </div>
            <div
              v-if="deletingAccountId === account.accountId"
              class="ac-delete-confirm"
              @click.stop
            >
              <strong>{{ t('user.accountSwitcher.deleteAccount') }}</strong>
              <small>{{ account.nickname }}</small>
              <div class="ac-delete-actions">
                <button type="button" @click="deletingAccountId = null">
                  {{ t('common.cancel') }}
                </button>
                <button type="button" class="danger" @click="confirmRemove(account)">
                  {{ t('common.delete') }}
                </button>
              </div>
            </div>
          </div>
          <div v-if="!accounts.length" class="ac-empty">
            <i class="ri-user-line" />
            <p>{{ t('user.accounts.empty') }}</p>
          </div>
        </section>

        <!-- 离线资料覆盖提示 -->
        <section v-if="localProfileStore.hasOverrides" class="ac-card ac-override-card">
          <i class="ri-information-line" />
          <span>{{ t('user.accounts.overrideHint') }}</span>
          <button type="button" @click="router.push('/user/profile/edit')">
            {{ t('user.accounts.goEdit') }}
          </button>
        </section>

        <button type="button" class="ac-add-row" @click="openLogin">
          <i class="ri-user-add-line" />
          <span>{{ t('user.accountSwitcher.addAccount') }}</span>
          <i class="ri-arrow-right-s-line ac-add-arrow" />
        </button>
      </template>

      <div class="ac-bottom-spacer" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import AccountLoginMorph from '@/components/login/AccountLoginMorph.vue';
import { registerMobileBackLayer } from '@/services/mobileBackStack';
import { platformDisplayName, useLocalProfileStore } from '@/store/modules/localProfile';
import { type PlatformAccount, usePlatformAccountsStore } from '@/store/modules/platformAccounts';
import { useUserStore } from '@/store/modules/user';
import { getImgUrl } from '@/utils';

defineOptions({ name: 'UserAccounts' });

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const message = useMessage();

const userStore = useUserStore();
const accountStore = usePlatformAccountsStore();
const localProfileStore = useLocalProfileStore();
const { accounts, activeAccountId, activeAccount } = storeToRefs(accountStore);
const { userDetail, recordList } = storeToRefs(userStore);

const view = ref<'list' | 'login'>('list');
const deletingAccountId = ref<string | null>(null);
let backDisposer: (() => void) | null = null;

const openLogin = () => {
  view.value = 'login';
};

const closeLogin = () => {
  view.value = 'list';
  if (route.query.panel) router.replace({ path: '/user/accounts' });
};

const onLoginSuccess = () => {
  view.value = 'list';
  // 兜底：登录组件未激活新账号时补激活，/user 页的 activeAccountId watch 会自动重载数据
  if (!activeAccountId.value && accounts.value.length) {
    accountStore.setActiveAccount(accounts.value[accounts.value.length - 1].accountId);
  }
  message.success(t('user.accounts.loginSuccess'));
};

const onLoginError = (errorMessage: string) => {
  message.error(errorMessage || t('user.accounts.loginFailed'));
};

const switchAccount = (account: PlatformAccount) => {
  if (deletingAccountId.value === account.accountId) return;
  if (account.accountId === activeAccountId.value) return;
  accountStore.setActiveAccount(account.accountId);
  message.success(t('user.accounts.switchedTo', { name: account.nickname }));
};

const askDelete = (accountId: string) => {
  deletingAccountId.value = accountId;
};

const confirmRemove = async (account: PlatformAccount) => {
  const wasActive = account.accountId === activeAccountId.value;
  if (!accountStore.removeAccount(account.accountId)) return;
  deletingAccountId.value = null;
  message.success(t('user.message.deleteSuccess'));

  if (wasActive) {
    userDetail.value = null;
    recordList.value = [];
    const replacement = activeAccount.value;
    if (replacement) {
      // removeAccount 内部已切到替补账号；这里回写 user store 保持各页显示一致
      if (replacement.platform === 'netease') {
        userStore.setUser({
          userId: Number(replacement.userId) || 0,
          nickname: replacement.nickname,
          avatarUrl: replacement.avatarUrl,
          vipType: replacement.vip ? 11 : 0
        });
        userStore.setLoginType(replacement.loginMethod as any);
      }
    } else {
      // 全部账号已删除：清登录态并留在本页引导重新登录
      userStore.setLoginType(null);
      view.value = 'login';
    }
  }
};

onMounted(() => {
  if (route.query.panel === 'login') view.value = 'login';
  backDisposer = registerMobileBackLayer({
    id: 'user-accounts-login',
    priority: 900,
    isActive: () => view.value === 'login',
    onBack: () => closeLogin()
  });
});

onBeforeUnmount(() => {
  backDisposer?.();
});
</script>

<style lang="scss" scoped>
.ac-scroll {
  width: 100%;
  min-height: 100%;
  padding-left: 16px;
  padding-right: 16px;
}

.ac-card {
  margin-top: 12px;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--m-border, #d8d3cc) 34%, transparent);
  border-radius: 24px;
  background: var(--m-surface, #f7f5f1);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--m-shadow, #000) 10%, transparent);
}

.ac-row {
  position: relative;
  border-radius: 18px;
  transition: background 160ms ease;

  & + .ac-row {
    margin-top: 2px;
  }

  &.active {
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
  }

  &:active {
    background: color-mix(in srgb, var(--m-surface-alt) 70%, transparent);
  }
}

.ac-row-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
}

.ac-row-avatar {
  display: grid;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
}

.ac-avatar-placeholder {
  background: color-mix(in srgb, var(--m-surface-alt) 72%, transparent);
  color: var(--m-text-muted);
  font-size: 20px;
}

.ac-row-copy {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;

  strong {
    overflow: hidden;
    color: var(--m-text-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
  }

  small {
    color: var(--m-text-muted);
    font-size: 11px;
  }
}

.ac-active-check {
  flex-shrink: 0;
  color: var(--accent-color);
  font-size: 20px;
}

.ac-delete-trigger {
  display: grid;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--m-surface-alt) 72%, transparent);
  color: var(--m-text-muted);
  font-size: 15px;

  &:active {
    transform: scale(0.92);
  }
}

.ac-delete-confirm {
  padding: 6px 12px 12px;
  text-align: center;

  strong {
    display: block;
    color: var(--m-text-primary);
    font-size: 14px;
  }

  small {
    display: block;
    overflow: hidden;
    margin-top: 2px;
    color: var(--m-text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
  }
}

.ac-delete-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;

  button {
    min-height: 34px;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--m-surface-alt) 72%, transparent);
    color: var(--m-text-primary);
    font-size: 13px;
  }

  .danger {
    background: color-mix(in srgb, #ef4444 16%, transparent);
    color: #ef4444;
    font-weight: 700;
  }
}

.ac-empty {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 32px 0;
  color: var(--m-text-muted);
  font-size: 13px;

  i {
    font-size: 30px;
    opacity: 0.5;
  }

  p {
    margin: 0;
  }
}

.ac-override-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  color: var(--m-text-secondary);
  font-size: 12px;

  > i {
    flex-shrink: 0;
    color: var(--accent-color);
    font-size: 16px;
  }

  span {
    flex: 1;
    min-width: 0;
  }

  button {
    flex-shrink: 0;
    padding: 6px 12px;
    border: 1px solid color-mix(in srgb, var(--accent-color) 40%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
    color: var(--accent-color);
    font-size: 12px;
    font-weight: 700;

    &:active {
      transform: scale(0.95);
    }
  }
}

.ac-add-row {
  display: flex;
  width: 100%;
  min-height: 54px;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 12px 18px;
  border: 1px dashed color-mix(in srgb, var(--accent-color) 48%, transparent);
  border-radius: 24px;
  background: color-mix(in srgb, var(--accent-color) 8%, transparent);
  color: var(--accent-color);
  font-size: 14px;
  font-weight: 700;

  > i:first-child {
    font-size: 20px;
  }

  &:active {
    transform: scale(0.985);
  }
}

.ac-add-arrow {
  margin-left: auto;
  font-size: 18px;
  opacity: 0.7;
}

.ac-login-card {
  padding: 18px 14px;
}

.ac-bottom-spacer {
  height: calc(var(--safe-area-inset-bottom, 0px) + 140px);
}
</style>
