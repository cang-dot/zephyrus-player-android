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
          <div class="flex-1 overflow-y-auto px-6 pb-4 max-w-none">
            <div class="disclaimer-markdown" v-html="agreementHtml"></div>
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
const ONBOARDING_COMPLETED_KEY = 'onboarding-completed';

const showDisclaimer = ref(false);
const isTransitioning = ref(false);
const agreementHtml = marked.parse(userAgreementText, { async: false });

const shouldShowDisclaimer = () => {
  // 未同意过协议，且引导已完成（引导流程本身包含协议步骤；
  // 新装用户由 OnboardingOverlay 的协议步骤负责，避免双重弹窗）
  return (
    !localStorage.getItem(DISCLAIMER_AGREED_KEY) &&
    Boolean(localStorage.getItem(ONBOARDING_COMPLETED_KEY))
  );
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

/* 协议 Markdown 深色排版（未启用 tailwind typography，手写覆盖防止黑字） */
.disclaimer-markdown {
  font-size: 13px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.78);
  text-align: left;
}

.disclaimer-markdown h1,
.disclaimer-markdown h2,
.disclaimer-markdown h3 {
  margin: 1.2em 0 0.5em;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
}

.disclaimer-markdown h1:first-child,
.disclaimer-markdown h2:first-child,
.disclaimer-markdown p:first-child {
  margin-top: 0;
}

.disclaimer-markdown p,
.disclaimer-markdown ul,
.disclaimer-markdown ol {
  margin: 0.6em 0;
}

.disclaimer-markdown ul,
.disclaimer-markdown ol {
  padding-left: 1.4em;
}

.disclaimer-markdown li {
  margin: 0.3em 0;
  list-style: inherit;
}

.disclaimer-markdown strong {
  color: #fff;
}

.disclaimer-markdown a {
  color: var(--accent-color, #fff);
  text-decoration: underline;
}

.disclaimer-markdown code {
  padding: 0.1em 0.4em;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.9em;
  color: rgba(255, 255, 255, 0.9);
}
</style>
