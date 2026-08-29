<template>
  <teleport to="body">
    <transition name="photosensitivity-fade">
      <div v-if="visible" class="photosensitivity-overlay" @click.self="handleDecline">
        <div class="photosensitivity-card no-toggle" role="alertdialog" aria-modal="true">
          <div class="warning-icon">
            <i class="ri-flashlight-fill"></i>
          </div>
          <h3>{{ title }}</h3>
          <div class="warning-body">
            <p>{{ bodyIntro }}</p>
            <p>{{ bodyDetail }}</p>
          </div>
          <div class="warning-actions">
            <button type="button" class="action-decline" @click="handleDecline">
              {{ declineText }}
            </button>
            <button type="button" class="action-confirm" @click="handleConfirm">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
/**
 * PhotosensitivityWarning — 光敏性癫痫警告
 *
 * 强闪烁类播放器样式（如「错误」）启用前的一次性确认；
 * 确认后写入 localStorage 永久记住，拒绝则由父级回退样式。
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const ACK_STORAGE_KEY = 'photosensitivity-warning-acked';

defineProps({
  visible: { type: Boolean, default: false }
});

const emit = defineEmits<{
  'update:visible': [value: boolean];
  confirm: [];
  decline: [];
}>();

const { t } = useI18n();

const title = computed(() => t('player.photosensitivity.title'));
const bodyIntro = computed(() => t('player.photosensitivity.intro'));
const bodyDetail = computed(() => t('player.photosensitivity.detail'));
const confirmText = computed(() => t('player.photosensitivity.confirm'));
const declineText = computed(() => t('player.photosensitivity.decline'));

function handleConfirm() {
  try {
    localStorage.setItem(ACK_STORAGE_KEY, '1');
  } catch {
    // 存储不可用时本次会话内不再记忆
  }
  emit('update:visible', false);
  emit('confirm');
}

function handleDecline() {
  emit('update:visible', false);
  emit('decline');
}
</script>

<style lang="scss" scoped>
.photosensitivity-overlay {
  position: fixed;
  inset: 0;
  z-index: 100200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.66);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* 玻璃卡片：与 SharedSongCard 同一配方；琥珀为警示语义色 */
.photosensitivity-card {
  width: min(92vw, 400px);
  padding: 28px 24px 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: rgba(28, 28, 32, 0.96);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  text-align: center;
}

.warning-icon {
  display: grid;
  width: 52px;
  height: 52px;
  margin: 0 auto 14px;
  border-radius: 50%;
  color: #ffb020;
  background: rgba(255, 176, 32, 0.12);
  font-size: 28px;
  place-items: center;
}

h3 {
  margin: 0 0 12px;
  color: rgba(255, 255, 255, 0.95);
  font-size: 18px;
  font-weight: 700;
}

.warning-body {
  display: grid;
  gap: 8px;
  margin-bottom: 22px;

  p {
    margin: 0;
    color: rgba(255, 255, 255, 0.66);
    font-size: 13px;
    line-height: 1.65;
    text-align: left;
  }
}

.warning-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  button {
    padding: 12px 0;
    border: 0;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 160ms ease-out;

    &:active {
      transform: scale(0.97);
    }
  }

  .action-decline {
    color: rgba(255, 255, 255, 0.82);
    background: rgba(255, 255, 255, 0.08);
  }

  .action-confirm {
    color: #1a1a1c;
    background: #ffb020;
  }
}

.photosensitivity-fade-enter-active,
.photosensitivity-fade-leave-active {
  transition: opacity 0.22s ease;
}

.photosensitivity-fade-enter-from,
.photosensitivity-fade-leave-to {
  opacity: 0;
}
</style>
