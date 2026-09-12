<template>
  <div class="settings-page">
    <!-- Full-screen scrollable content -->
    <div ref="contentRef" class="settings-scroll">
      <!-- Content -->
      <div class="settings-content">
        <!-- Search results mode -->
        <template v-if="isSearching">
          <div v-if="searchResults.length > 0" class="animate-fade-in">
            <div class="search-results-header">
              <i class="ri-search-line" />
              <span>找到 {{ searchResults.length }} 项匹配 "{{ searchQuery }}" 的设置</span>
            </div>
            <div
              v-for="(result, idx) in searchResults"
              :key="idx"
              class="search-result-card"
              @click="jumpToResult(result)"
            >
              <div class="search-result-tab">{{ result.tabLabel }}</div>
              <div class="search-result-info">
                <div class="search-result-title" v-html="highlight(result.title)" />
                <div
                  v-if="result.desc"
                  class="search-result-desc"
                  v-html="highlight(result.desc)"
                />
              </div>
              <i class="ri-arrow-right-s-line search-result-arrow" />
            </div>
          </div>
          <div v-else class="search-no-results">
            <i class="ri-search-eye-line"></i>
            <p>未找到与 "{{ searchQuery }}" 相关的设置</p>
          </div>
        </template>

        <!-- Normal mode -->
        <template v-else>
          <div v-show="currentSection === 'appearance'" class="animate-fade-in">
            <appearance-tab />
          </div>
          <div v-show="currentSection === 'playback'" class="animate-fade-in">
            <playback-tab />
          </div>
          <div v-show="currentSection === 'lyrics'" class="animate-fade-in">
            <lyrics-tab />
          </div>
          <div v-show="currentSection === 'ai'" class="animate-fade-in">
            <ai-tab />
          </div>
          <div v-show="currentSection === 'advanced'" class="animate-fade-in">
            <advanced-tab />
          </div>
          <div v-show="currentSection === 'about'" class="animate-fade-in">
            <about-tab />
          </div>
          <div v-show="currentSection === 'application'" class="animate-fade-in">
            <application-tab />
          </div>
          <div v-show="currentSection === 'network'" class="animate-fade-in">
            <network-tab />
          </div>
          <div v-show="currentSection === 'system'" class="animate-fade-in">
            <system-tab />
          </div>
        </template>

        <div class="bottom-spacer" />
        <play-bottom />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import { useDialog, useMessage } from 'naive-ui';
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import PlayBottom from '@/components/common/PlayBottom.vue';
import {
  registerMobileTopbarGroup,
  unregisterMobileTopbarGroup
} from '@/composables/useMobileTopbarMenu';
import { useSettingsStore } from '@/store/modules/settings';
import { isElectron } from '@/utils';

import config from '../../../../package.json';
import { createDefaultAppUpdateState } from '../../../shared/appUpdate';
import { SETTINGS_DATA_KEY, SETTINGS_DIALOG_KEY, SETTINGS_MESSAGE_KEY } from './keys';
import { MOBILE_SETTING_SEARCH_DEFINITIONS } from './mobileSettingSearch';
import AboutTab from './tabs/AboutTab.vue';
import AdvancedTab from './tabs/AdvancedTab.vue';
import AiTab from './tabs/AiTab.vue';
import AppearanceTab from './tabs/AppearanceTab.vue';
import ApplicationTab from './tabs/ApplicationTab.vue';
import LyricsTab from './tabs/LyricsTab.vue';
import NetworkTab from './tabs/NetworkTab.vue';
import PlaybackTab from './tabs/PlaybackTab.vue';
import SystemTab from './tabs/SystemTab.vue';

const settingsStore = useSettingsStore();
const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const { t } = useI18n();
const contentRef = ref<HTMLElement | null>(null);

// ==================== Settings data ====================
const saveSettings = useDebounceFn((data) => {
  settingsStore.setSetData(data);
}, 500);

const localSetData = ref({ ...settingsStore.setData });

const setData = computed({
  get: () => localSetData.value,
  set: (newData) => {
    localSetData.value = newData;
  }
});

watch(
  () => localSetData.value,
  (newValue) => saveSettings(newValue),
  { deep: true }
);

watch(
  () => settingsStore.setData,
  (newValue) => {
    if (JSON.stringify(localSetData.value) !== JSON.stringify(newValue)) {
      localSetData.value = { ...newValue };
    }
  },
  { deep: true, immediate: true }
);

onUnmounted(() => {
  settingsStore.setSetData(localSetData.value);
  unregisterMobileTopbarGroup('settings-sections');
  window.removeEventListener('mobile-settings-search-input', onTopbarSearchInput);
  window.removeEventListener('mobile-settings-search-select', onTopbarSearchSelect);
});

// ==================== Provide ====================
provide(SETTINGS_DATA_KEY, setData);
provide(SETTINGS_MESSAGE_KEY, message);
provide(SETTINGS_DIALOG_KEY, dialog);

// ==================== Navigation ====================
type SettingSectionConfig = {
  id: string;
  electron?: boolean;
};

const settingSections: SettingSectionConfig[] = [
  { id: 'appearance' },
  { id: 'playback' },
  { id: 'lyrics' },
  { id: 'ai' },
  { id: 'advanced' },
  { id: 'about' },
  { id: 'application', electron: true },
  { id: 'network', electron: true },
  { id: 'system', electron: true }
];

const navSections = computed(() => {
  return settingSections
    .filter((section) => !section.electron || isElectron)
    .map((section) => ({
      id: section.id,
      title: t(`settings.sections.${section.id}`)
    }));
});

const currentSection = ref('basic');

const applyRouteTarget = () => {
  if (!router.currentRoute.value.query.section) return;
  currentSection.value = 'basic';
  const focus = String(router.currentRoute.value.query.focus || '');
  if (focus) {
    nextTick(() =>
      nextTick(() =>
        document.getElementById(focus)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      )
    );
  }
};

watch(() => router.currentRoute.value.query, applyRouteTarget, { immediate: true });

const syncSettingsTopbar = () => {
  registerMobileTopbarGroup({
    id: 'settings-sections',
    routePath: '/set',
    options: navSections.value.map((section) => ({ key: section.id, label: section.title })),
    value: currentSection.value,
    select: (value) => {
      currentSection.value = String(value);
      contentRef.value?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
};

watch([currentSection, navSections], syncSettingsTopbar, { immediate: true });

// ==================== Settings search ====================
const searchQuery = ref('');
const isSearching = ref(false);
const searchResults = ref<SearchResult[]>([]);

interface SearchResult {
  tabId: string;
  tabLabel: string;
  title: string;
  desc: string;
  titlePath: string;
  targetTitle?: string;
  targetId?: string;
}

function fuzzyMatch(query: string, target: string): boolean {
  if (!query || !target) return false;
  const q = query.toLowerCase();
  const tgt = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < tgt.length && qi < q.length; ti++) {
    if (tgt[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function highlight(text: string): string {
  if (!searchQuery.value || !text) return text;
  const q = searchQuery.value.toLowerCase();
  const tgt = text;
  let result = '';
  let qi = 0;
  for (let ti = 0; ti < tgt.length; ti++) {
    if (qi < q.length && tgt[ti].toLowerCase() === q[qi]) {
      result += `<mark>${tgt[ti]}</mark>`;
      qi++;
    } else {
      result += tgt[ti];
    }
  }
  return result;
}

const settingIndex = computed<SearchResult[]>(() => {
  const tabLabels: Record<string, string> = {};
  navSections.value.forEach((s) => {
    tabLabels[s.id] = s.title;
  });

  return MOBILE_SETTING_SEARCH_DEFINITIONS.map((item) => {
    const translatedTitle = item.titleKey ? t(item.titleKey) : '';
    const translatedDesc = item.descKey ? t(item.descKey) : '';
    const title =
      translatedTitle && translatedTitle !== item.titleKey ? translatedTitle : item.title || '';
    const desc =
      translatedDesc && translatedDesc !== item.descKey ? translatedDesc : item.desc || '';

    return {
      tabId: item.tabId,
      tabLabel: tabLabels[item.tabId],
      title,
      desc,
      titlePath: item.targetTitle || title,
      targetTitle: item.targetTitle,
      targetId: item.targetId
    };
  }).filter((item) => item.title && item.tabLabel);
});

const performSearch = useDebounceFn(() => {
  const q = searchQuery.value.trim();
  if (!q) {
    isSearching.value = false;
    searchResults.value = [];
    window.dispatchEvent(new CustomEvent('mobile-settings-search-results', { detail: [] }));
    return;
  }
  isSearching.value = true;
  searchResults.value = settingIndex.value.filter((item) => {
    return fuzzyMatch(q, item.title) || fuzzyMatch(q, item.desc) || fuzzyMatch(q, item.tabLabel);
  });
  window.dispatchEvent(
    new CustomEvent('mobile-settings-search-results', { detail: searchResults.value.slice(0, 12) })
  );
}, 200);

const onSearchInput = () => {
  performSearch();
};

const clearSearch = () => {
  searchQuery.value = '';
  isSearching.value = false;
  searchResults.value = [];
  window.dispatchEvent(new CustomEvent('mobile-settings-search-reset'));
};

const onTopbarSearchInput = (event: Event) => {
  searchQuery.value = String((event as CustomEvent).detail || '');
  onSearchInput();
};

const onTopbarSearchSelect = (event: Event) => {
  const result = (event as CustomEvent<SearchResult>).detail;
  if (result) jumpToResult(result);
};

const jumpToResult = (result: SearchResult) => {
  clearSearch();
  currentSection.value = result.tabId;
  nextTick(() => {
    nextTick(() => {
      const targetedItem = result.targetId
        ? contentRef.value?.querySelector<HTMLElement>(`#${CSS.escape(result.targetId)}`)
        : null;
      if (targetedItem) {
        targetedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (targetedItem.getAttribute('aria-expanded') !== 'true') {
          targetedItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
        targetedItem.classList.add('setting-item-flash');
        setTimeout(() => targetedItem.classList.remove('setting-item-flash'), 2000);
        return;
      }
      const items = contentRef.value?.querySelectorAll('.setting-item, .keep-alive-item');
      if (items) {
        for (const item of items) {
          const titleEl = item.querySelector('.setting-item-title, .item-title, [class*="title"]');
          if (titleEl && titleEl.textContent?.includes(result.titlePath)) {
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (item.getAttribute('aria-expanded') !== 'true') {
              item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
            item.classList.add('setting-item-flash');
            setTimeout(() => item.classList.remove('setting-item-flash'), 2000);
            break;
          }
        }
      }
    });
  });
};

// ==================== Init ====================
onMounted(() => {
  syncSettingsTopbar();
  window.addEventListener('mobile-settings-search-input', onTopbarSearchInput);
  window.addEventListener('mobile-settings-search-select', onTopbarSearchSelect);
  if (isElectron && settingsStore.appUpdateState.currentVersion === '') {
    settingsStore.setAppUpdateState(createDefaultAppUpdateState(config.version));
  }
  if (setData.value.enableRealIP === undefined) {
    setData.value = { ...setData.value, enableRealIP: false };
  }
  if (setData.value.enableDiskCache === undefined) {
    setData.value = { ...setData.value, enableDiskCache: true };
  }
  if (!setData.value.diskCacheMaxSizeMB) {
    setData.value = { ...setData.value, diskCacheMaxSizeMB: 4096 };
  }
  if (!['lru', 'fifo'].includes(setData.value.diskCacheCleanupPolicy)) {
    setData.value = { ...setData.value, diskCacheCleanupPolicy: 'lru' };
  }
  applyRouteTarget();
});
</script>

<style scoped>
.settings-page {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: var(--cover-bg, var(--m-bg, var(--bg-color, #fff)));
  color: var(--cover-text-primary, var(--m-text-primary, var(--text-color, #000)));
}

/* Settings are content, not a stack of floating glass cards. Keep controls'
   own affordances, but remove elevation and reflective edges from containers. */
.settings-page :deep(.hero-card),
.settings-page :deep(.setting-section-list),
.settings-page :deep(.setting-item),
.settings-page :deep(.search-result-card),
.settings-page :deep(.setting-control),
.settings-page :deep(.setting-card) {
  box-shadow: none !important;
}

.settings-page :deep(*) {
  box-shadow: none !important;
  filter: none !important;
}

.settings-page :deep(.setting-section),
.settings-page :deep(.setting-section-list),
.settings-page :deep(.setting-item),
.settings-page :deep(.setting-item-details),
.settings-page :deep(.setting-item-details-inner) {
  background: transparent !important;
  border-color: transparent !important;
}

@media (prefers-color-scheme: dark) {
  .settings-page :deep(.hero-card),
  .settings-page :deep(.setting-section-list),
  .settings-page :deep(.setting-item),
  .settings-page :deep(.search-result-card),
  .settings-page :deep(.setting-control),
  .settings-page :deep(.setting-card) {
    border-color: transparent !important;
  }
}

.settings-scroll {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: visible;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-top: var(--mobile-topbar-inset);
}
.settings-scroll::-webkit-scrollbar {
  display: none;
}

/* Safe area spacer */
.safe-top {
  height: 0;
  display: none;
}

/* ========================================
   Hero Card — sticky morphing floating card
   Contains: title + search + section chips
   Same element transforms on scroll.
   ======================================== */
.hero-card {
  position: fixed;
  top: calc(var(--safe-area-inset-top, 0px) + 52px);
  left: 16px;
  right: 16px;
  z-index: 50;
  border-radius: 22px;
  overflow: hidden;
  transition:
    border-radius 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
    top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.hero-card.compact {
  border-radius: 18px;
  box-shadow: none;
  top: var(--mobile-topbar-inset);
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--cover-surface, rgba(255, 255, 255, 0.55));
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  opacity: 1;
  transition: opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.hero-card.compact .hero-bg {
  opacity: 1;
}

/* Title + Search row */
.hero-top {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 20px 12px;
  transition:
    padding 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
    gap 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.hero-card.compact .hero-top {
  padding: 10px 16px 8px;
  gap: 8px;
}

.hero-title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--cover-text-primary, var(--m-text-primary, var(--text-color, #000)));
  margin: 0;
  transition: font-size 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.hero-card.compact .hero-title {
  font-size: 17px;
  font-weight: 600;
}

/* Search bar */
.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 14px;
  font-size: 16px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  pointer-events: none;
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 0 36px 0 40px;
  height: 42px;
  border: none;
  border-radius: 14px;
  background: var(--cover-surface, rgba(128, 128, 128, 0.08));
  font-size: 14px;
  color: var(--cover-text-primary, var(--m-text-primary, var(--text-color, #000)));
  outline: none;
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease,
    height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.hero-card.compact .search-input {
  height: 36px;
}

.search-input:focus {
  background: var(--cover-surface-alt, rgba(128, 128, 128, 0.12));
  box-shadow: 0 0 0 2px rgba(var(--accent-color-rgb, 136, 136, 136), 0.2);
}

.search-input::placeholder {
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
}

.search-clear {
  position: absolute;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  border: none;
  background: var(--cover-surface-active, rgba(128, 128, 128, 0.15));
  color: var(--cover-text-secondary, var(--m-text-secondary, #6b6560));
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.search-clear:hover {
  background: var(--cover-border-strong, rgba(128, 128, 128, 0.25));
}

/* Section tabs — glow style, stays inside the card */
.section-bar-glow {
  margin: 4px 4px 8px;
  transition: margin 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  .hero-card.compact & {
    margin: 0 16px 6px;
  }
}

/* Settings content */
.settings-content {
  padding: 0 20px;
}

.settings-inline-search {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 14px;
}

/* Search results */
.search-results-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--cover-text-secondary, var(--m-text-secondary, #6b6560));
  margin-bottom: 16px;
  padding: 0 4px;
}

.search-result-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  margin-bottom: 8px;
  background: var(--cover-surface, rgba(128, 128, 128, 0.06));
  cursor: pointer;
  transition:
    background 0.2s ease,
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.search-result-card:hover {
  background: var(--cover-surface-hover, rgba(128, 128, 128, 0.1));
}

.search-result-card:active {
  transform: scale(0.98);
}

.search-result-tab {
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 9999px;
  background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.12);
  color: var(--accent-color, #888);
  white-space: nowrap;
  flex-shrink: 0;
}

.search-result-info {
  flex: 1;
  min-width: 0;
}

.search-result-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--cover-text-primary, var(--m-text-primary, var(--text-color, #000)));
  margin-bottom: 2px;
}

.search-result-desc {
  font-size: 12px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result-arrow {
  font-size: 18px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  flex-shrink: 0;
}

.search-result-title mark,
.search-result-desc mark {
  background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.15);
  color: var(--accent-color, #888);
  border-radius: 2px;
  padding: 0 1px;
  font-weight: 700;
}

.search-no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 12px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
}

.search-no-results i {
  font-size: 48px;
  opacity: 0.3;
}

.search-no-results p {
  font-size: 14px;
}

/* Animations */
.animate-fade-in {
  animation: fadeIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

:deep(.setting-item-flash) {
  animation: flashHighlight 2s ease;
}

@keyframes flashHighlight {
  0%,
  100% {
    background: transparent;
  }
  10%,
  30% {
    background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.08);
  }
}

.bottom-spacer {
  height: calc(var(--safe-area-inset-bottom, 0px) + 140px);
}

:deep(.n-select .n-base-selection) {
  border-radius: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .hero-card,
  .hero-top,
  .hero-title,
  .search-input,
  .section-bar-glow {
    transition: none;
  }
}
</style>
