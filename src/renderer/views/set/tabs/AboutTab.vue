<template>
  <setting-section :title="t('settings.sections.about')">
    <setting-item :title="t('settings.about.version')">
      <template #description>
        <div class="flex flex-wrap items-center gap-2">
          <span>{{ updateInfo.currentVersion }}</span>
          <n-tag v-if="updateInfo.hasUpdate" type="success">
            {{ t('settings.about.hasUpdate') }} {{ updateInfo.latestVersion }}
          </n-tag>
        </div>
        <div v-if="hasManualUpdateFallback" class="mt-2 text-xs text-amber-600">
          <i class="ri-information-line mr-1"></i>
          {{ appUpdateState.errorMessage || t('settings.about.messages.checkError') }}
        </div>
      </template>
      <template #action>
        <div class="flex items-center gap-2 flex-wrap">
          <s-btn :loading="checking" @click="checkForUpdates(true)">
            {{ checking ? t('settings.about.checking') : t('settings.about.checkUpdate') }}
          </s-btn>
          <s-btn v-if="updateInfo.hasUpdate" variant="primary" @click="openReleasePage">
            {{ t('settings.about.gotoUpdate') }}
          </s-btn>
          <s-btn v-if="hasManualUpdateFallback" variant="ghost" @click="openManualUpdatePage">
            {{ t('settings.about.manualUpdate') }}
          </s-btn>
        </div>
      </template>
    </setting-item>

    <setting-item
      :title="t('settings.about.author')"
      :description="t('settings.about.authorDesc')"
      clickable
      @click="openAuthor"
    >
      <s-btn @click.stop="openAuthor">
        <i class="ri-github-line mr-1"></i>{{ t('settings.about.gotoGithub') }}
      </s-btn>
    </setting-item>

    <!-- 用户协议 / 开源协议 / 应用介绍 -->
    <setting-item
      title="用户协议"
      description="查看用户协议"
      clickable
      @click="openModal('用户协议', userAgreementText)"
    />
    <setting-item
      title="开源协议"
      description="查看开源协议 (MIT)"
      clickable
      @click="openModal('开源协议', licenseText)"
    />
    <setting-item
      title="应用介绍"
      description="了解 Zephyrus Player"
      clickable
      @click="openModal('应用介绍', readmeText)"
    />
    <setting-item title="使用文档" description="查看完整使用文档" clickable @click="openDocs" />

    <!-- 意见反馈 -->
    <setting-item title="意见反馈" description="提交 Bug 报告或功能建议">
      <template #description>
        <div class="flex flex-col gap-2">
          <div class="flex gap-2">
            <button
              v-for="opt in feedbackTypeOptions"
              :key="opt.value"
              class="feedback-type-btn"
              :class="{ active: feedbackType === opt.value }"
              @click="feedbackType = opt.value"
            >
              <i :class="opt.icon" class="mr-1"></i>{{ opt.label }}
            </button>
          </div>
          <textarea
            v-model="feedbackContent"
            placeholder="描述你遇到的问题或建议..."
            rows="3"
            class="feedback-textarea"
          ></textarea>
          <input
            v-model="feedbackContact"
            type="text"
            placeholder="联系方式（可选，方便回复你）"
            class="feedback-contact"
          />
          <div v-if="feedbackResult" class="text-xs" :class="feedbackResult.success ? 'text-green-500' : 'text-red-400'">
            {{ feedbackResult.message }}
          </div>
        </div>
      </template>
      <template #action>
        <s-btn
          variant="primary"
          :disabled="!feedbackContent.trim() || feedbackSubmitting"
          @click="submitFeedbackAction"
        >
          <i v-if="feedbackSubmitting" class="ri-loader-4-line animate-spin mr-1"></i>
          <i v-else class="ri-send-plane-line mr-1"></i>
          {{ feedbackSubmitting ? '提交中...' : '提交' }}
        </s-btn>
      </template>
    </setting-item>
  </setting-section>

  <!-- 内嵌内容弹窗 -->
  <teleport to="body">
    <transition name="fade">
      <div
        v-if="modalVisible"
        class="fixed inset-0 z-[99999] flex items-center justify-center p-6"
        @click.self="closeModal"
      >
        <div class="absolute inset-0 bg-black/60"></div>
        <div
          class="relative w-full max-w-lg max-h-[80vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          <div
            class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
          >
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ modalTitle }}</h3>
            <button
              @click="closeModal"
              class="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <i class="ri-close-line text-xl"></i>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto px-5 py-4 prose prose-sm dark:prose-invert max-w-none">
            <div v-html="modalContent"></div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { marked } from 'marked';
import { computed, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { openUpdateModal } from '@/composables/useUpdateModal';
import { useSettingsStore } from '@/store/modules/settings';
import { isElectron } from '@/utils';
import { checkUpdate, UpdateResult } from '@/utils/update';

import licenseText from '../../../../../LICENSE?raw';
import config from '../../../../../package.json';
import readmeText from '../../../../../README.md?raw';
import userAgreementText from '../../../../../用户协议.md?raw';
import { submitFeedback, type FeedbackType, type FeedbackResult } from '@/api/feedback';
import { APP_UPDATE_STATUS, hasAvailableAppUpdate } from '../../../../shared/appUpdate';
import { SETTINGS_DATA_KEY, SETTINGS_MESSAGE_KEY } from '../keys';
import SBtn from '../SBtn.vue';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const setData = inject(SETTINGS_DATA_KEY)!;
const message = inject(SETTINGS_MESSAGE_KEY)!;

const checking = ref(false);

// 内嵌内容弹窗
const modalVisible = ref(false);
const modalTitle = ref('');
const modalContent = ref('');

function openModal(title: string, content: string) {
  modalTitle.value = title;
  modalContent.value = marked.parse(content, { async: false });
  modalVisible.value = true;
}

function closeModal() {
  modalVisible.value = false;
}
const webUpdateInfo = ref<UpdateResult>({
  hasUpdate: false,
  latestVersion: '',
  currentVersion: `v${config.version}`,
  releaseInfo: null
});

const appUpdateState = computed(() => settingsStore.appUpdateState);
const hasAppUpdate = computed(() => hasAvailableAppUpdate(appUpdateState.value));
const hasManualUpdateFallback = computed(
  () => isElectron && appUpdateState.value.status === APP_UPDATE_STATUS.error
);

const updateInfo = computed<UpdateResult>(() => {
  if (!isElectron) {
    return webUpdateInfo.value;
  }

  return {
    hasUpdate: hasAppUpdate.value,
    latestVersion: appUpdateState.value.availableVersion ?? '',
    currentVersion: `v${config.version}`,
    releaseInfo: appUpdateState.value.availableVersion
      ? {
          tag_name: appUpdateState.value.availableVersion,
          body: appUpdateState.value.releaseNotes,
          html_url: appUpdateState.value.releasePageUrl,
          assets: []
        }
      : null
  };
});

const checkForUpdates = async (isClick = false) => {
  checking.value = true;
  try {
    if (isElectron) {
      const result = await window.api.checkAppUpdate(isClick);
      settingsStore.setAppUpdateState(result);

      if (hasAvailableAppUpdate(result)) {
        if (isClick) {
          settingsStore.setShowUpdateModal(true);
        }
      } else if (result.status === APP_UPDATE_STATUS.notAvailable && isClick) {
        message.success(t('settings.about.latest'));
      } else if (result.status === APP_UPDATE_STATUS.error && isClick) {
        message.error(result.errorMessage || t('settings.about.messages.checkError'));
      }

      return;
    }

    const result = await checkUpdate(config.version);
    if (result) {
      webUpdateInfo.value = result;
      if (result.hasUpdate) {
        // 移动端：检测到更新后弹出应用内更新弹窗（含更新内容）
        openUpdateModal(result);
      } else if (isClick) {
        message.success(t('settings.about.latest'));
      }
    } else if (isClick) {
      message.success(t('settings.about.latest'));
    }
  } catch (error) {
    console.error('检查更新失败:', error);
    if (isClick) {
      message.error(t('settings.about.messages.checkError'));
    }
  } finally {
    checking.value = false;
  }
};

const openReleasePage = () => {
  if (isElectron) {
    settingsStore.setShowUpdateModal(true);
    return;
  }

  // 移动端：打开应用内更新弹窗（展示更新内容 + 应用内下载安装）
  openUpdateModal(updateInfo.value);
};

const openManualUpdatePage = async () => {
  if (isElectron) {
    await window.api.openAppUpdatePage();
    return;
  }

  window.open(updateInfo.value.releaseInfo?.html_url || setData.value.authorUrl);
};

const openAuthor = () => {
  window.open(setData.value.authorUrl);
};

const openDocs = () => {
  window.open('https://www.mucang.xyz/zephyrus/docs');
};

// ==================== 意见反馈 ====================
const feedbackType = ref<FeedbackType>('bug');
const feedbackContent = ref('');
const feedbackContact = ref('');
const feedbackSubmitting = ref(false);
const feedbackResult = ref<FeedbackResult | null>(null);

const feedbackTypeOptions = [
  { value: 'bug' as const, label: 'Bug', icon: 'ri-bug-line' },
  { value: 'feature' as const, label: '功能建议', icon: 'ri-lightbulb-line' },
  { value: 'other' as const, label: '其他', icon: 'ri-chat-3-line' }
];

async function submitFeedbackAction() {
  if (!feedbackContent.value.trim()) return;
  feedbackSubmitting.value = true;
  feedbackResult.value = null;
  try {
    const result = await submitFeedback({
      type: feedbackType.value,
      content: feedbackContent.value.trim(),
      contact: feedbackContact.value.trim() || undefined,
      appVersion: config.version || '1.2.0',
      device: navigator.userAgent || 'unknown',
      osVersion: navigator.platform || 'unknown'
    });
    feedbackResult.value = result;
    if (result.success) {
      feedbackContent.value = '';
      feedbackContact.value = '';
      message.success(result.message);
    } else {
      message.error(result.message);
    }
  } finally {
    feedbackSubmitting.value = false;
  }
}

defineExpose({ checkForUpdates });
</script>

<style scoped>
.feedback-type-btn {
  flex: 1;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--m-border, rgba(0, 0, 0, 0.08));
  background: transparent;
  color: var(--m-text-secondary, #666);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.feedback-type-btn.active {
  background: var(--accent-color, #1ed760);
  color: #fff;
  border-color: var(--accent-color, #1ed760);
}

.feedback-textarea {
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--m-border, rgba(0, 0, 0, 0.08));
  background: var(--m-surface, rgba(0, 0, 0, 0.03));
  color: var(--m-text-primary, #333);
  font-size: 13px;
  outline: none;
  resize: none;
  font-family: inherit;
}

.feedback-textarea:focus {
  border-color: var(--accent-color, #1ed760);
}

.feedback-contact {
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--m-border, rgba(0, 0, 0, 0.08));
  background: var(--m-surface, rgba(0, 0, 0, 0.03));
  color: var(--m-text-primary, #333);
  font-size: 13px;
  outline: none;
}

.feedback-contact:focus {
  border-color: var(--accent-color, #1ed760);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
