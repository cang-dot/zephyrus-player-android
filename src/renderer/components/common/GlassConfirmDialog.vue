<template>
  <Teleport to="body">
    <Transition name="glass-confirm-fade">
      <div v-if="visible" class="glass-confirm-overlay" @click.self="handleCancel">
        <div class="glass-confirm-card" role="alertdialog" aria-modal="true">
          <h3 class="confirm-title">{{ title }}</h3>
          <p v-if="message" class="confirm-message">{{ message }}</p>
          <div class="confirm-actions">
            <button type="button" class="action-btn secondary" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button
              type="button"
              class="action-btn primary"
              :class="{ danger }"
              @click="handleConfirm"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * GlassConfirmDialog — 移动端玻璃质感确认对话框
 * 统一替代移动端路径上的 naive-ui dialog.warning 直出弹窗。
 */
defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '确认操作' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '确认' },
  cancelText: { type: String, default: '取消' },
  /** 危险操作（删除/清空）：确认按钮使用红色语义 */
  danger: { type: Boolean, default: false }
});

const emit = defineEmits<{
  'update:visible': [value: boolean];
  confirm: [];
  cancel: [];
}>();

function handleConfirm() {
  emit('update:visible', false);
  emit('confirm');
}

function handleCancel() {
  emit('update:visible', false);
  emit('cancel');
}
</script>

<style scoped>
.glass-confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 100100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* 玻璃卡片：与 SharedSongCard 同一配方 */
.glass-confirm-card {
  width: min(88vw, 340px);
  padding: 24px 20px 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: rgba(28, 28, 32, 0.96);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.confirm-title {
  margin: 0 0 8px;
  color: #f5f5f7;
  font-size: 17px;
  font-weight: 700;
  text-align: center;
}

.confirm-message {
  margin: 0 0 20px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
}

.confirm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.action-btn {
  padding: 12px 0;
  border: none;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    opacity 0.2s ease;
}

.action-btn:active {
  transform: scale(0.97);
}

.action-btn.secondary {
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.08);
}

.action-btn.primary {
  color: #1a1a1c;
  background: var(--accent-color, #d4a056);
}

.action-btn.primary.danger {
  color: #fff;
  background: #e5484d;
}

.glass-confirm-fade-enter-active,
.glass-confirm-fade-leave-active {
  transition: opacity 0.22s ease;
}

.glass-confirm-fade-enter-active .glass-confirm-card,
.glass-confirm-fade-leave-active .glass-confirm-card {
  transition:
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.22s ease;
}

.glass-confirm-fade-enter-from,
.glass-confirm-fade-leave-to {
  opacity: 0;
}

.glass-confirm-fade-enter-from .glass-confirm-card,
.glass-confirm-fade-leave-to .glass-confirm-card {
  transform: scale(0.92);
  opacity: 0;
}
</style>
