<template>
  <Transition name="lt-card-slide">
    <div v-if="visible" class="lt-invite-wrap" @click.self="dismiss">
      <div class="lt-invite-card">
        <button class="card-close" @click="dismiss">
          <i class="ri-close-line" />
        </button>

        <div class="invite-icon-wrap">
          <i class="ri-headphone-line" />
        </div>

        <div class="card-info">
          <span class="card-label">
            <i class="ri-share-forward-line" />
            {{ t('listenTogether.invite.label') }}
          </span>
          <h3 class="card-title">{{ roomCode }}</h3>
          <p class="card-desc">
            {{ t('listenTogether.invite.desc') }}
          </p>
        </div>

        <div class="invite-name-row">
          <input
            v-model.trim="displayName"
            class="invite-name-input"
            :placeholder="t('listenTogether.invite.namePlaceholder')"
            maxlength="24"
          />
        </div>

        <div class="invite-actions">
          <button class="action-btn secondary" @click="dismiss">
            {{ t('listenTogether.invite.later') }}
          </button>
          <button class="action-btn primary" :disabled="joining" @click="handleJoin">
            <i v-if="joining" class="ri-loader-4-line spinning" />
            <i v-else class="ri-headphone-fill" />
            <span>{{
              joining ? t('listenTogether.invite.joining') : t('listenTogether.invite.join')
            }}</span>
          </button>
        </div>

        <p v-if="errorMsg" class="invite-error">{{ errorMsg }}</p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { listenTogetherService } from '@/services/listenTogetherService';
import { resetLastHandledUrl } from '@/utils/deepLink';

const { t } = useI18n();

const visible = ref(false);
const joining = ref(false);
const errorMsg = ref('');
const roomCode = ref('');
const displayName = ref('');

let historyPushed = false;

function showInvite(code: string) {
  if (code === roomCode.value && visible.value) return;
  roomCode.value = code;
  errorMsg.value = '';
  visible.value = true;

  if (!historyPushed) {
    historyPushed = true;
    history.pushState({ listenInvite: true }, '');
  }
}

function dismiss() {
  visible.value = false;
  if (historyPushed) {
    history.back();
    historyPushed = false;
  }
  // 关闭后允许同一邀请再次处理
  resetLastHandledUrl();
}

async function handleJoin() {
  if (joining.value || !roomCode.value) return;
  joining.value = true;
  errorMsg.value = '';
  try {
    await listenTogetherService.joinRoom(roomCode.value, displayName.value);
    dismiss();
  } catch (e) {
    errorMsg.value =
      e instanceof Error && e.message ? e.message : String(t('listenTogether.invite.failed'));
  } finally {
    joining.value = false;
  }
}

function handlePopState() {
  if (visible.value) visible.value = false;
}

window.addEventListener('popstate', handlePopState);
onBeforeUnmount(() => window.removeEventListener('popstate', handlePopState));

defineExpose({ showInvite });
</script>

<style scoped lang="scss">
.lt-invite-wrap {
  position: fixed;
  inset: 0;
  z-index: 2100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  padding: 20px;
}

/* 玻璃卡片：与 SharedSongCard 同一表面配方 */
.lt-invite-card {
  position: relative;
  width: min(360px, calc(100vw - 40px));
  border-radius: 20px;
  padding: 28px 22px 22px;
  color: #f5f5f7;
  background: rgba(28, 28, 32, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
  font-size: 18px;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.16);
    color: rgba(255, 255, 255, 0.85);
  }
}

.invite-icon-wrap {
  align-self: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 30px;
  background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.16);
  color: var(--accent-color, #d4a056);
}

.card-info {
  text-align: center;

  .card-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .card-title {
    margin: 8px 0 6px;
    font-size: 26px;
    letter-spacing: 3px;
    font-weight: 700;
  }

  .card-desc {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.66);
  }
}

.invite-name-row {
  display: flex;

  .invite-name-input {
    flex: 1;
    height: 44px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: inherit;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s ease;

    &:focus {
      border-color: rgba(var(--accent-color-rgb, 136, 136, 136), 0.65);
    }

    &::placeholder {
      color: currentcolor;
      opacity: 0.4;
    }
  }
}

.invite-actions {
  display: flex;
  gap: 12px;

  .action-btn {
    flex: 1;
    height: 46px;
    border-radius: 999px;
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition:
      transform 0.15s ease,
      opacity 0.2s ease;

    &:active {
      transform: scale(0.97);
    }

    &.primary {
      color: #1a1a1c;
      background: var(--accent-color, #d4a056);

      &:disabled {
        opacity: 0.5;
      }
    }

    &.secondary {
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.85);
    }
  }
}

.invite-error {
  margin: -6px 0 0;
  text-align: center;
  font-size: 12px;
  color: #ff7a7a;
}

.spinning {
  animation: lt-spin 0.9s linear infinite;
}

@keyframes lt-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 进出场动画：与 SharedSongCard 的 card-slide 保持一致的观感 */
.lt-card-slide-enter-active,
.lt-card-slide-leave-active {
  transition: opacity 0.28s ease;

  .lt-invite-card {
    transition:
      transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1),
      opacity 0.28s ease;
  }
}

.lt-card-slide-enter-from,
.lt-card-slide-leave-to {
  opacity: 0;

  .lt-invite-card {
    transform: translateY(48px);
    opacity: 0;
  }
}
</style>
