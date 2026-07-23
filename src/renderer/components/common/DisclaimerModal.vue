<template>
  <Teleport to="body">
    <Transition name="disclaimer-modal">
      <div
        v-if="showDisclaimer"
        class="fixed inset-0 z-[999999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      >
        <div
          class="w-full max-w-md max-h-[85vh] bg-gray-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-white/10"
        >
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
            <button
              @click="handleAgree"
              class="w-full py-3.5 rounded-2xl text-base font-medium text-white bg-gradient-to-r from-[var(--accent-color)] to-[var(--accent-color-dark)] hover:brightness-110 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-[var(--accent-color)]/25"
            >
              <span class="flex items-center justify-center gap-2">
                <i class="ri-check-line text-lg"></i>
                同意并继续
              </span>
            </button>

            <button
              @click="handleDisagree"
              class="w-full py-2.5 rounded-2xl text-sm font-medium text-white/40 hover:text-white/70 transition-colors"
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
import { onMounted, ref } from 'vue';

import { isElectron, isLyricWindow } from '@/utils';
import { marked } from 'marked';
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
.disclaimer-modal-enter-active,
.disclaimer-modal-leave-active {
  transition: opacity 0.3s ease;
}

.disclaimer-modal-enter-from,
.disclaimer-modal-leave-to {
  opacity: 0;
}
</style>
