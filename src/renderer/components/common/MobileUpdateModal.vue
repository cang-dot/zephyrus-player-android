<template>
  <Teleport to="body">
    <Transition name="update-modal">
      <div
        v-if="showModal"
        class="fixed inset-0 z-[999999] flex items-end justify-center bg-black/50 backdrop-blur-sm"
      >
        <div
          class="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl overflow-hidden animate-slide-up"
        >
          <div
            class="h-1 bg-gradient-to-r from-[var(--accent-color-light)] via-[var(--accent-color)] to-[var(--accent-color-dark)]"
          ></div>

          <div class="flex justify-center pt-3 pb-2">
            <div class="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></div>
          </div>

          <div class="px-6 pb-5">
            <div class="flex items-center gap-4">
              <div
                class="w-20 h-20 rounded-2xl overflow-hidden shadow-lg flex-shrink-0 ring-2 ring-[var(--accent-color)]/20"
              >
                <img
                  src="@/assets/icon_512.png"
                  alt="App Icon"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-2">
                  <span
                    class="px-3 py-1 text-xs font-medium text-white bg-gradient-to-r from-[var(--accent-color)] to-[var(--accent-color-dark)] rounded-full"
                  >
                    {{ t('comp.update.title') }}
                  </span>
                </div>
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white truncate">
                  v{{ latestVersion }}
                </h2>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {{ t('comp.update.currentVersion') }}: v{{ currentVersion }}
                </p>
              </div>
            </div>
          </div>

          <div
            class="mx-6 mb-6 max-h-72 overflow-y-auto rounded-2xl bg-gray-50 dark:bg-gray-800/50"
          >
            <div
              class="p-5 text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
              v-html="parsedReleaseNotes"
            ></div>
          </div>

          <!-- 下载进度 -->
          <div v-if="downloadState === 'downloading'" class="px-6 pb-4">
            <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
              <span>{{ t('comp.update.downloading') }}</span>
              <span>{{ downloadProgressText }}</span>
            </div>
            <div class="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-[var(--accent-color)] to-[var(--accent-color-dark)] rounded-full transition-all duration-200"
                :style="{ width: `${Math.round(downloadProgress * 100)}%` }"
              ></div>
            </div>
            <p class="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{{ downloadSpeedText }}</p>
          </div>
          <p v-else-if="downloadState === 'error'" class="px-6 pb-4 text-xs text-red-500">
            {{ t('comp.update.downloadFailed') }}：{{ downloadError }}
          </p>

          <div
            class="px-6 pb-8 flex gap-3"
            :style="{ paddingBottom: `calc(32px + var(--safe-area-inset-bottom, 0px))` }"
          >
            <button
              @click="handleLater"
              :disabled="downloadState === 'downloading'"
              class="flex-1 py-4 px-4 rounded-2xl text-base font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
            >
              {{ t('comp.update.noThanks') }}
            </button>
            <button
              @click="handlePrimaryAction"
              class="flex-1 py-4 px-4 rounded-2xl text-base font-medium text-white bg-gradient-to-r from-[var(--accent-color)] to-[var(--accent-color-dark)] hover:brightness-90 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-[var(--accent-color)]/25 disabled:opacity-60"
            >
              <span class="flex items-center justify-center gap-2">
                <i
                  :class="downloadState === 'ready' ? 'ri-check-double-line text-lg' : 'ri-download-2-line text-lg'"
                ></i>
                {{
                  downloadState === 'downloading'
                    ? t('comp.update.backgroundDownload')
                    : downloadState === 'ready'
                      ? t('comp.update.installNow')
                      : t('comp.update.nowUpdate')
                }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { marked } from 'marked';
import { useMessage } from 'naive-ui';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { closeUpdateModal, openUpdateModal, updateModalState } from '@/composables/useUpdateModal';
import {
  getApkDownloadState,
  installApkFromCache,
  isAndroidNative,
  startApkDownload
} from '@/services/androidNative';
import { checkUpdate, type UpdateResult } from '@/utils/update';

import config from '../../../../package.json';

const { t } = useI18n();
const message = useMessage();

const REMIND_LATER_KEY = 'update_remind_later_timestamp';
const APK_READY_KEY = 'apk_update_ready';
const SERVER_DOWNLOAD_URL = 'https://mucang.xyz/zephyrus/apks/zephyrus-player-latest.apk';

marked.setOptions({ breaks: true, gfm: true });

const showModal = computed(() => updateModalState.value.show);
const updateInfo = computed<UpdateResult | null>(() => updateModalState.value.info);
const latestVersion = computed(() => updateInfo.value?.latestVersion || '');
const currentVersion = computed(() => updateInfo.value?.currentVersion || config.version);

const downloadState = ref<'idle' | 'downloading' | 'ready' | 'error'>('idle');
const downloadProgress = ref(0);
const downloadError = ref('');
const downloadSpeed = ref(0);
const downloadElapsed = ref(0);
const downloadMode = ref<'foreground' | 'background'>('foreground');

const totalSize = computed(() => Number(updateInfo.value?.releaseInfo?.assets?.[0]?.size) || 0);
const downloadProgressText = computed(() => {
  if (totalSize.value > 0 && downloadProgress.value > 0) {
    const doneMB = ((totalSize.value * downloadProgress.value) / 1024 / 1024).toFixed(1);
    const totalMB = (totalSize.value / 1024 / 1024).toFixed(1);
    return `${Math.round(downloadProgress.value * 100)}% (${doneMB}/${totalMB} MB)`;
  }
  return `${Math.round(downloadProgress.value * 100)}%`;
});
const downloadSpeedText = computed(() => {
  if (downloadSpeed.value > 0) {
    return `速度 ${downloadSpeed.value.toFixed(1)} MB/s · 已用 ${Math.round(downloadElapsed.value)}s`;
  }
  return '';
});

const parsedReleaseNotes = computed(() => {
  const body = updateInfo.value?.releaseInfo?.body;
  if (!body) return '';
  try {
    return marked.parse(body);
  } catch {
    return body;
  }
});

const shouldShowReminder = (): boolean => {
  const savedTime = parseInt(localStorage.getItem(REMIND_LATER_KEY) || '', 10);
  return !savedTime || Date.now() - savedTime >= 24 * 60 * 60 * 1000;
};

const handleLater = () => {
  localStorage.setItem(REMIND_LATER_KEY, Date.now().toString());
  // 下载中点击“稍后安装”：转为后台下载，完成后仍可安装
  if (downloadState.value === 'downloading') {
    downloadMode.value = 'background';
  } else {
    clearDownloadTimer();
  }
  closeUpdateModal();
};

let downloadTimer: number | null = null;
let downloadStartedAt = 0;

const clearDownloadTimer = () => {
  if (downloadTimer) {
    window.clearInterval(downloadTimer);
    downloadTimer = null;
  }
};

const installDownloadedApk = () => {
  installApkFromCache('zephyrus-update.apk');
  closeUpdateModal();
};

/**
 * 启动原生下载并轮询进度；前台模式完成后自动安装，后台模式完成后记录就绪
 */
const startDownload = (url: string) => {
  downloadState.value = 'downloading';
  downloadProgress.value = 0;
  downloadError.value = '';
  downloadSpeed.value = 0;
  downloadElapsed.value = 0;
  downloadStartedAt = Date.now();
  startApkDownload(url, totalSize.value);

  clearDownloadTimer();
  downloadTimer = window.setInterval(() => {
    const state = getApkDownloadState();
    if (!state) return;

    const expected = state.expected || totalSize.value;
    if (state.error) {
      clearDownloadTimer();
      if (downloadMode.value === 'background') {
        message.error(state.message || t('comp.update.downloadFailed'));
      } else {
        downloadState.value = 'error';
        downloadError.value = state.message || t('comp.update.downloadFailed');
      }
      return;
    }
    if (state.done) {
      clearDownloadTimer();
      downloadProgress.value = 1;
      if (downloadMode.value === 'background') {
        localStorage.setItem(APK_READY_KEY, updateInfo.value?.latestVersion || '1');
        message.success(t('comp.update.backgroundDone'));
      } else {
        downloadState.value = 'ready';
        installDownloadedApk();
      }
      return;
    }

    downloadProgress.value = expected > 0 ? Math.min(1, state.bytes / expected) : 0;
    const elapsed = (Date.now() - downloadStartedAt) / 1000;
    downloadElapsed.value = elapsed;
    if (elapsed > 0) downloadSpeed.value = state.bytes / 1024 / 1024 / elapsed;
  }, 400);
};

const getDownloadUrl = () =>
  updateInfo.value?.releaseInfo?.assets?.[0]?.browser_download_url || SERVER_DOWNLOAD_URL;

/**
 * 主按钮：未下载时「立即更新」（前台下载并显示进度）；
 * 下载中变为「后台下载」，点击后转入后台（关闭弹窗，下载继续）；
 * 下载就绪后变为「立即安装」，点击唤起安装器。
 */
const handlePrimaryAction = () => {
  localStorage.removeItem(REMIND_LATER_KEY);
  if (!isAndroidNative()) {
    window.open(getDownloadUrl(), '_blank');
    closeUpdateModal();
    return;
  }
  // 下载已完成：直接安装
  if (downloadState.value === 'ready') {
    localStorage.removeItem(APK_READY_KEY);
    installDownloadedApk();
    return;
  }
  // 下载中：切换为后台下载
  if (downloadState.value === 'downloading') {
    downloadMode.value = 'background';
    closeUpdateModal();
    message.success(t('comp.update.backgroundStart'));
    return;
  }
  // 首次点击：前台下载，按钮随即变为「后台下载」
  downloadMode.value = 'foreground';
  startDownload(getDownloadUrl());
};

const checkForUpdates = async () => {
  if (!shouldShowReminder()) return;
  try {
    const result = await checkUpdate(config.version);
    if (result?.hasUpdate) {
      downloadState.value = 'idle';
      downloadProgress.value = 0;
      // 后台下载已完成且版本一致：直接进入“立即安装”
      if (localStorage.getItem(APK_READY_KEY) === result.latestVersion) {
        downloadState.value = 'ready';
      }
      openUpdateModal(result);
    }
  } catch (error) {
    console.error('检查更新失败:', error);
  }
};

onMounted(() => {
  setTimeout(() => {
    checkForUpdates();
  }, 2000);
});

onUnmounted(() => {
  clearDownloadTimer();
});
</script>

<style scoped>
.update-modal-enter-active,
.update-modal-leave-active {
  transition: opacity 0.3s ease;
}

.update-modal-enter-from,
.update-modal-leave-to {
  opacity: 0;
}

.update-modal-enter-active .animate-slide-up,
.update-modal-leave-active .animate-slide-up {
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.update-modal-enter-from .animate-slide-up,
.update-modal-leave-to .animate-slide-up {
  transform: translateY(100%);
}
</style>
