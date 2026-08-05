<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div v-if="visible" class="account-overlay" @click.self="close">
        <!-- 模糊背景 -->
        <div class="account-overlay-backdrop" />

        <!-- 底部弹出面板 -->
        <Transition name="sheet">
          <div v-if="visible" class="account-sheet" @click.self="close">
            <div class="sheet-handle" />
            <h3 class="sheet-title">{{ t('user.accountSwitcher.title') }}</h3>

            <div class="account-list">
              <button
                v-for="account in accountStore.accounts"
                :key="account.accountId"
                type="button"
                class="account-row"
                :class="{ active: account.accountId === accountStore.activeAccountId }"
                @click="selectAccount(account)"
              >
                <div class="account-row-avatar">
                  <img
                    v-if="account.avatarUrl"
                    :src="account.avatarUrl"
                    alt=""
                    class="account-row-img"
                  />
                  <div v-else class="account-row-placeholder">
                    <i class="ri-user-3-line" />
                  </div>
                  <span class="account-row-badge">
                    <platform-logo :platform="account.platform" :size="13" />
                  </span>
                </div>
                <div class="account-row-info">
                  <div class="account-row-name">{{ account.nickname }}</div>
                  <div class="account-row-meta">
                    <span class="account-row-platform">{{ platformName(account.platform) }}</span>
                    <span v-if="account.vip" class="account-row-vip">{{ account.vipLabel || 'VIP' }}</span>
                  </div>
                </div>
                <div v-if="account.accountId === accountStore.activeAccountId" class="account-row-check">
                  <i class="ri-check-line" />
                </div>
              </button>
            </div>

            <button type="button" class="account-add-btn" @click="goToLogin">
              <i class="ri-add-line" />
              <span>{{ t('user.accountSwitcher.addAccount') }}</span>
            </button>

            <button type="button" class="account-close-btn" @click="close">
              {{ t('user.accountSwitcher.close') }}
            </button>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

import PlatformLogo from '@/components/common/PlatformLogo.vue';
import {
  type MusicPlatform,
  type PlatformAccount,
  usePlatformAccountsStore
} from '@/store/modules/platformAccounts';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  select: [account: PlatformAccount];
}>();

const { t } = useI18n();
const router = useRouter();
const accountStore = usePlatformAccountsStore();

const PLATFORM_NAMES: Record<MusicPlatform, string> = {
  netease: '网易云',
  qq: 'QQ 音乐',
  kugou: '酷狗音乐',
  spotify: 'Spotify'
};

const platformName = (platform: MusicPlatform) => PLATFORM_NAMES[platform];

const close = () => {
  emit('close');
};

const selectAccount = (account: PlatformAccount) => {
  if (accountStore.setActiveAccount(account.accountId)) {
    emit('select', account);
  }
  close();
};

const goToLogin = () => {
  close();
  router.push('/login');
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') close();
};

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeydown);
    } else {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeydown);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  document.body.style.overflow = '';
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style lang="scss" scoped>
.account-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.account-overlay-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(0px);
  -webkit-backdrop-filter: blur(0px);
  transition:
    backdrop-filter 300ms ease,
    -webkit-backdrop-filter 300ms ease,
    background 300ms ease;
}

.overlay-enter-active .account-overlay-backdrop {
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  background: rgba(0, 0, 0, 0.45);
}

.overlay-leave-active .account-overlay-backdrop {
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  background: rgba(0, 0, 0, 0.45);
}

.overlay-enter-from .account-overlay-backdrop,
.overlay-leave-to .account-overlay-backdrop {
  backdrop-filter: blur(0px);
  -webkit-backdrop-filter: blur(0px);
  background: rgba(0, 0, 0, 0);
}

.account-sheet {
  position: relative;
  width: 100%;
  max-width: 460px;
  max-height: 80vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 12px 16px calc(var(--safe-area-inset-bottom, 0px) + 20px);
  border-radius: 28px 28px 0 0;
  background: var(--cover-surface, var(--d-surface, #fff));
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.15);
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 9999px;
  background: var(--cover-text-muted, var(--d-text-muted));
  opacity: 0.3;
  margin: 0 auto 12px;
}

.sheet-title {
  margin: 0 0 16px;
  font-size: 17px;
  font-weight: 700;
  text-align: center;
  color: var(--cover-text-primary, var(--d-text-primary));
}

.account-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.account-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1.5px solid transparent;
  border-radius: 18px;
  background: var(--cover-surface-alt, rgba(128, 128, 128, 0.04));
  cursor: pointer;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:active {
    transform: scale(0.98);
  }

  &.active {
    border-color: rgba(var(--accent-color-rgb, 136, 136, 136), 0.4);
    background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.08);
  }
}

.account-row-avatar {
  position: relative;
  flex-shrink: 0;
}

.account-row-img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.account-row-placeholder {
  display: flex;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--cover-surface-hover, var(--d-surface-hover));
  color: var(--accent-color);
  font-size: 20px;
}

.account-row-badge {
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--cover-surface, var(--d-surface));
  border-radius: 50%;
  background: var(--cover-surface, var(--d-surface));
}

.account-row-info {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.account-row-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--cover-text-primary, var(--d-text-primary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-row-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
}

.account-row-platform {
  font-size: 12px;
  color: var(--cover-text-muted, var(--d-text-muted));
}

.account-row-vip {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 9999px;
  background: rgba(255, 193, 7, 0.15);
  color: #ffa000;
}

.account-row-check {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--accent-color);
  font-size: 20px;
}

.account-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  border: 1.5px dashed rgba(var(--accent-color-rgb, 136, 136, 136), 0.35);
  border-radius: 18px;
  background: transparent;
  color: var(--accent-color);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 160ms ease;

  &:active {
    background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.06);
  }

  i {
    font-size: 18px;
  }
}

.account-close-btn {
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  border: none;
  border-radius: 14px;
  background: var(--cover-surface-alt, rgba(128, 128, 128, 0.06));
  color: var(--cover-text-secondary, var(--d-text-secondary));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 160ms ease;

  &:active {
    background: var(--cover-surface-hover, rgba(128, 128, 128, 0.1));
  }
}

/* ===== Transitions ===== */

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 280ms ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.sheet-enter-active {
  transition:
    transform 360ms cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 280ms ease;
}

.sheet-leave-active {
  transition:
    transform 240ms cubic-bezier(0.4, 0, 1, 1),
    opacity 200ms ease;
}

.sheet-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.sheet-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .overlay-enter-active,
  .overlay-leave-active,
  .sheet-enter-active,
  .sheet-leave-active {
    transition-duration: 0ms;
  }

  .account-row:active {
    transform: none;
  }
}
</style>
