<template>
  <div class="account-switcher" :class="{ collapsed }">
    <TransitionGroup name="account-pill" tag="div" class="account-switcher-rail">
      <button
        v-for="account in accountStore.accounts"
        :key="account.accountId"
        type="button"
        class="account-pill"
        :data-account-id="account.accountId"
        :class="{
          active: account.accountId === accountStore.activeAccountId,
          'is-dragging': draggingAccountId === account.accountId
        }"
        @pointerdown="startAccountPress($event, account)"
        @pointermove="moveAccount($event, account)"
        @pointerup="finishAccountPress"
        @pointercancel="finishAccountPress"
        @click="selectAccount(account)"
      >
        <span class="account-avatar">
          <img v-if="account.avatarUrl" :src="account.avatarUrl" alt="" />
          <platform-logo v-else :platform="account.platform" :size="22" />
          <span class="account-platform-badge">
            <platform-logo :platform="account.platform" :size="11" />
          </span>
        </span>
        <span class="account-copy">
          <strong>{{ account.nickname }}</strong>
          <small>{{ platformName(account.platform) }}</small>
        </span>
      </button>

      <button key="add" type="button" class="account-add" @click="openLogin">
        <i class="ri-add-line" />
      </button>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';

import PlatformLogo from '@/components/common/PlatformLogo.vue';
import {
  type MusicPlatform,
  type PlatformAccount,
  usePlatformAccountsStore
} from '@/store/modules/platformAccounts';

withDefaults(
  defineProps<{
    collapsed?: boolean;
  }>(),
  {
    collapsed: false
  }
);

const emit = defineEmits<{
  change: [account: PlatformAccount];
}>();

const router = useRouter();
const accountStore = usePlatformAccountsStore();
const draggingAccountId = ref<string | null>(null);
let pressTimer: ReturnType<typeof setTimeout> | null = null;
let pressStartX = 0;
let pressStartY = 0;
let didDrag = false;
let touchMoveBlocker: ((e: TouchEvent) => void) | null = null;

const clearPressTimer = () => {
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = null;
};

const startAccountPress = (event: PointerEvent, account: PlatformAccount) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  pressStartX = event.clientX;
  pressStartY = event.clientY;
  didDrag = false;
  clearPressTimer();
  if (!touchMoveBlocker) {
    touchMoveBlocker = (e: TouchEvent) => {
      // 长按拖拽开始后阻止横向滚动接管手势，否则 pointercancel 会让卡片立刻回位。
      if (draggingAccountId.value) e.preventDefault();
    };
    document.addEventListener('touchmove', touchMoveBlocker, { passive: false });
  }
  pressTimer = setTimeout(() => {
    draggingAccountId.value = account.accountId;
    didDrag = true;
    (event.currentTarget as HTMLElement)?.setPointerCapture?.(event.pointerId);
  }, 420);
};

const moveAccount = (event: PointerEvent, account: PlatformAccount) => {
  if (draggingAccountId.value !== account.accountId) {
    if (Math.hypot(event.clientX - pressStartX, event.clientY - pressStartY) > 10) {
      clearPressTimer();
    }
    return;
  }

  event.preventDefault();
  const target = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>('.account-pill[data-account-id]');
  const targetId = target?.dataset.accountId;
  if (!targetId || targetId === account.accountId) return;

  const fromIndex = accountStore.accounts.findIndex((item) => item.accountId === account.accountId);
  const toIndex = accountStore.accounts.findIndex((item) => item.accountId === targetId);
  accountStore.moveAccount(fromIndex, toIndex);
};

const finishAccountPress = () => {
  clearPressTimer();
  draggingAccountId.value = null;
  if (touchMoveBlocker) {
    document.removeEventListener('touchmove', touchMoveBlocker);
    touchMoveBlocker = null;
  }
};

onBeforeUnmount(() => {
  clearPressTimer();
  if (touchMoveBlocker) {
    document.removeEventListener('touchmove', touchMoveBlocker);
    touchMoveBlocker = null;
  }
});

const PLATFORM_NAMES: Record<MusicPlatform, string> = {
  netease: '网易云',
  qq: 'QQ 音乐',
  kugou: '酷狗音乐'
};

const platformName = (platform: MusicPlatform) => PLATFORM_NAMES[platform];

const selectAccount = (account: PlatformAccount) => {
  if (didDrag) {
    didDrag = false;
    return;
  }
  if (accountStore.setActiveAccount(account.accountId)) {
    emit('change', account);
  }
};

const openLogin = () => router.push('/login');
</script>

<style lang="scss" scoped>
.account-switcher {
  position: relative;
  max-height: 70px;
  padding: 4px 12px 10px;
  overflow: hidden;
  opacity: 1;
  transition:
    max-height 220ms cubic-bezier(0.23, 1, 0.32, 1),
    padding 220ms cubic-bezier(0.23, 1, 0.32, 1),
    opacity 160ms ease;

  &.collapsed {
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    opacity: 0;
    pointer-events: none;
  }
}

.account-switcher-rail {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.account-pill {
  position: relative;
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  height: 48px;
  max-width: 168px;
  padding: 4px 12px 4px 5px;
  border: 1px solid var(--cover-border, rgba(128, 128, 128, 0.1));
  border-radius: 9999px;
  background: var(--cover-surface-alt, rgba(128, 128, 128, 0.06));
  color: var(--cover-text-primary, var(--d-text-primary));
  cursor: pointer;
  touch-action: pan-x;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow 180ms ease;

  &.active {
    border-color: rgba(var(--accent-color-rgb, 136, 136, 136), 0.42);
    background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.12);
    box-shadow: 0 0 18px rgba(var(--accent-color-rgb, 136, 136, 136), 0.12);
  }

  &:active {
    transform: scale(0.98);
  }

  &.is-dragging {
    z-index: 2;
    cursor: grabbing;
    opacity: 0.78;
    transform: scale(1.04) rotate(1deg);
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.22);
    touch-action: none;
  }
}

.account-avatar {
  position: relative;
  display: flex;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: visible;
  border-radius: 50%;
  background: var(--cover-surface-hover, var(--d-surface-hover));
  color: var(--accent-color);

  > img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
}

.account-platform-badge {
  position: absolute;
  right: -2px;
  bottom: -1px;
  display: flex;
  width: 17px;
  height: 17px;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--cover-surface, var(--d-surface));
  border-radius: 50%;
  background: var(--cover-surface-active, var(--d-surface-active));
  color: var(--accent-color);
}

.account-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  text-align: left;

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 12px;
    font-weight: 600;
  }

  small {
    margin-top: 1px;
    color: var(--cover-text-muted, var(--d-text-muted));
    font-size: 10px;
  }
}

.account-add {
  display: flex;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(var(--accent-color-rgb, 136, 136, 136), 0.42);
  border-radius: 50%;
  background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.08);
  color: var(--accent-color);
  cursor: pointer;
  transition:
    background-color 160ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  i {
    font-size: 20px;
  }

  &:active {
    transform: scale(0.96);
  }
}

.account-pill-enter-active,
.account-pill-leave-active {
  transition:
    opacity 180ms ease,
    transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
}

.account-pill-enter-from,
.account-pill-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .account-switcher,
  .account-pill,
  .account-add,
  .account-pill-enter-active,
  .account-pill-leave-active {
    transition-duration: 0ms;
  }

  .account-pill:active,
  .account-add:active {
    transform: none;
  }
}
</style>
