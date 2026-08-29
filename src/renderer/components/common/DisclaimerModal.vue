<template>
  <Teleport to="body">
    <Transition name="disclaimer-modal">
      <div
        v-if="showDisclaimer"
        class="fixed inset-0 z-[999999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      >
        <div
          class="w-full max-w-md max-h-[85vh] rounded-3xl overflow-hidden flex flex-col border border-white/10 disclaimer-sheet"
        >
          <!-- 标题 -->
          <div class="px-6 pt-8 pb-4 flex-shrink-0">
            <h2 class="text-xl font-bold text-white text-center">用户协议</h2>
            <p class="text-xs text-white/40 text-center mt-1">请阅读以下协议后继续使用</p>
          </div>

          <!-- 协议内容（Markdown 渲染） -->
          <div class="flex-1 overflow-y-auto px-6 pb-4 prose prose-sm prose-invert max-w-none">
            <div v-html="agreementHtml"></div>
          </div>

          <!-- 按钮 -->
          <div class="px-6 pb-8 pt-2 space-y-3 flex-shrink-0">
            <button @click="handleAgree" class="disclaimer-primary-btn">
              <span class="flex items-center justify-center gap-2">
                <i class="ri-check-line text-lg"></i>
                同意并继续
              </span>
            </button>

            <button
              @click="handleDisagree"
              class="w-full py-2.5 rounded-full text-sm font-medium text-white/40 active:text-white/70 transition-colors"
            >
              不同意，退出应用
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { marked } from 'marked';
import { onMounted, ref } from 'vue';

import { isElectron, isLyricWindow } from '@/utils';

import userAgreementText from '../../../../用户协议.md?raw';

const DISCLAIMER_AGREED_KEY = 'disclaimer_agreed_timestamp';

const showDisclaimer = ref(false);
const isTransitioning = ref(false);
const agreementHtml = marked.parse(userAgreementText, { async: false });

const shouldShowDisclaimer = () => {
  return !localStorage.getItem(DISCLAIMER_AGREED_KEY);
};

const handleAgree = () => {
  if (isTransitioning.value) return;
  isTransitioning.value = true;

  localStorage.setItem(DISCLAIMER_AGREED_KEY, Date.now().toString());
  showDisclaimer.value = false;

  setTimeout(() => {
    isTransitioning.value = false;
  }, 300);
};

const handleDisagree = () => {
  if (isTransitioning.value) return;
  isTransitioning.value = true;

  if (isElectron) {
    window.api?.quitApp?.();
  } else {
    window.close();
  }
  isTransitioning.value = false;
};

onMounted(() => {
  if (isLyricWindow.value) return;

  if (shouldShowDisclaimer()) {
    showDisclaimer.value = true;
  }
});
</script>

<style scoped>
/* 玻璃表面：与 SharedSongCard 同一配方 */
.disclaimer-sheet {
  background: rgba(28, 28, 32, 0.96);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.disclaimer-primary-btn {
  width: 100%;
  padding: 14px 0;
  border: none;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1c;
  background: var(--accent-color, #d4a056);
  cursor: pointer;
  transition:
    transform 0.15s ease,
    opacity 0.2s ease;
}

.disclaimer-primary-btn:active {
  transform: scale(0.98);
}

.disclaimer-modal-enter-active,
.disclaimer-modal-leave-active {
  transition: opacity 0.3s ease;
}

.disclaimer-modal-enter-from,
.disclaimer-modal-leave-to {
  opacity: 0;
}
</style>
