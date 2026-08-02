<template>
  <div class="settings-page">
    <!-- Full-screen scrollable content -->
    <div ref="contentRef" class="settings-scroll" @scroll.passive="onScroll">
      <!-- Sticky morphing hero card: title + search + section chips -->
      <div class="hero-card" :class="{ compact: isCompact }">
        <div class="hero-bg" />
        <!-- Title + Search row -->
        <div class="hero-top">
          <h1 class="hero-title">{{ t('common.settings') }}</h1>
          <div class="search-wrap">
            <i class="ri-search-line search-icon" />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              class="search-input"
              :placeholder="t('comp.searchBar.searchPlaceholder')"
              @input="onSearchInput"
              @keydown.escape="clearSearch"
            />
            <button v-if="searchQuery" class="search-clear" @click="clearSearch">
              <i class="ri-close-line" />
            </button>
          </div>
        </div>
        <!-- Section tabs: glow style, always visible inside the card -->
        <glow-tabs
          v-show="!isSearching"
          v-model="currentSection"
          :tabs="navSections.map((s) => ({ key: s.id, label: s.title }))"
          scrollable
          class="section-bar-glow"
        />
      </div>

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
          <div v-show="currentSection === 'basic'" class="animate-fade-in">
            <basic-tab />
          </div>
          <div v-show="currentSection === 'interface'" class="animate-fade-in">
            <interface-tab />
          </div>
          <div v-show="currentSection === 'playback'" class="animate-fade-in">
            <playback-tab />
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
          <div v-show="currentSection === 'keepAlive'" class="animate-fade-in">
            <keep-alive-tab />
          </div>
          <div v-show="currentSection === 'about'" class="animate-fade-in">
            <about-tab />
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

import GlowTabs from '@/components/common/GlowTabs.vue';
import PlayBottom from '@/components/common/PlayBottom.vue';
import { useSettingsStore } from '@/store/modules/settings';
import { isElectron } from '@/utils';

import config from '../../../../package.json';
import { createDefaultAppUpdateState } from '../../../shared/appUpdate';
import { SETTINGS_DATA_KEY, SETTINGS_DIALOG_KEY, SETTINGS_MESSAGE_KEY } from './keys';
import AboutTab from './tabs/AboutTab.vue';
import ApplicationTab from './tabs/ApplicationTab.vue';
import BasicTab from './tabs/BasicTab.vue';
import InterfaceTab from './tabs/InterfaceTab.vue';
import KeepAliveTab from './tabs/KeepAliveTab.vue';
import NetworkTab from './tabs/NetworkTab.vue';
import PlaybackTab from './tabs/PlaybackTab.vue';
import SystemTab from './tabs/SystemTab.vue';

const settingsStore = useSettingsStore();
const message = useMessage();
const dialog = useDialog();
const { t } = useI18n();

// ==================== Scroll compact state ====================
const contentRef = ref<HTMLElement | null>(null);
const isCompact = ref(false);
let rafId = 0;

const onScroll = () => {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    const el = contentRef.value;
    if (el) {
      isCompact.value = el.scrollTop > 10;
    }
    rafId = 0;
  });
};

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
  { id: 'basic' },
  { id: 'interface' },
  { id: 'playback' },
  { id: 'application', electron: true },
  { id: 'network', electron: true },
  { id: 'system', electron: true },
  { id: 'keepAlive' },
  { id: 'about' }
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

// ==================== Settings search ====================
const searchInputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref('');
const isSearching = ref(false);
const searchResults = ref<SearchResult[]>([]);

interface SearchResult {
  tabId: string;
  tabLabel: string;
  title: string;
  desc: string;
  titlePath: string;
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
  const items: SearchResult[] = [];
  const tabLabels: Record<string, string> = {};
  navSections.value.forEach((s) => {
    tabLabels[s.id] = s.title;
  });

  const basicItems = [
    { title: t('settings.basic.themeMode'), desc: t('settings.basic.themeModeDesc') },
    { title: t('settings.basic.language'), desc: t('settings.basic.languageDesc') },
    { title: t('settings.basic.font'), desc: t('settings.basic.fontDesc') },
    { title: t('settings.basic.animation'), desc: t('settings.basic.animationDesc') },
    { title: t('settings.basic.animationSpeed'), desc: t('settings.basic.animationSpeedDesc') },
    { title: t('settings.basic.defaultPage'), desc: t('settings.basic.defaultPageDesc') }
  ];
  basicItems.forEach((item) => {
    items.push({
      tabId: 'basic',
      tabLabel: tabLabels['basic'],
      title: item.title,
      desc: item.desc,
      titlePath: item.title
    });
  });

  const interfaceItems = [
    { title: '界面布局', desc: '经典：传统侧边栏+页面 / 浮动覆盖：播放界面为主+悬浮窗口' },
    { title: '自动收起', desc: '无操作时自动将侧栏和搜索栏移出屏幕' },
    { title: '收起延迟', desc: '无操作后多少秒自动收起' },
    { title: '播放器样式', desc: '默认 / 舞台 / 杂志 / 狂躁' },
    { title: '底栏样式', desc: '贯穿：全宽底栏 / 迷你：浮动圆角底栏' },
    { title: '快捷组件', desc: '迷你底栏悬停时显示的组件' },
    { title: '本地歌词文件', desc: '为当前歌曲指定本地 TTML/LRC 歌词文件' },
    { title: '桌面歌词字体', desc: '选择已安装的系统字体' },
    { title: '桌面歌词文本颜色', desc: '歌词文字颜色' },
    { title: '桌面歌词已播放颜色', desc: '当前播放行的高亮颜色' },
    { title: '桌面歌词未播放颜色', desc: '未播放歌词行的文字颜色' },
    { title: '桌面歌词描边颜色', desc: '歌词文字描边/阴影颜色' },
    { title: '封面取色', desc: '自动跟随当前播放歌曲封面提取颜色' },
    { title: t('settings.interface.sidebarOrder'), desc: t('settings.interface.sidebarOrderDesc') }
  ];
  interfaceItems.forEach((item) => {
    items.push({
      tabId: 'interface',
      tabLabel: tabLabels['interface'],
      title: item.title,
      desc: item.desc,
      titlePath: item.title
    });
  });

  const playbackItems = [
    { title: t('settings.playback.quality'), desc: t('settings.playback.qualityDesc') },
    { title: t('settings.playback.autoPlay'), desc: t('settings.playback.autoPlayDesc') },
    { title: t('settings.playback.volume'), desc: t('settings.playback.volumeDesc') },
    { title: t('settings.playback.crossfade'), desc: t('settings.playback.crossfadeDesc') },
    { title: t('settings.playback.gapless'), desc: t('settings.playback.gaplessDesc') }
  ];
  playbackItems.forEach((item) => {
    items.push({
      tabId: 'playback',
      tabLabel: tabLabels['playback'],
      title: item.title,
      desc: item.desc,
      titlePath: item.title
    });
  });

  if (isElectron) {
    const appItems = [
      { title: t('settings.application.gpu'), desc: t('settings.application.gpuDesc') },
      { title: t('settings.application.diskCache'), desc: t('settings.application.diskCacheDesc') },
      { title: t('settings.application.cacheSize'), desc: t('settings.application.cacheSizeDesc') },
      {
        title: t('settings.application.downloadPath'),
        desc: t('settings.application.downloadPathDesc')
      },
      {
        title: t('settings.application.closeAction'),
        desc: t('settings.application.closeActionDesc')
      }
    ];
    appItems.forEach((item) => {
      items.push({
        tabId: 'application',
        tabLabel: tabLabels['application'],
        title: item.title,
        desc: item.desc,
        titlePath: item.title
      });
    });

    const networkItems = [
      { title: t('settings.network.proxy'), desc: t('settings.network.proxyDesc') },
      { title: t('settings.network.realIP'), desc: t('settings.network.realIPDesc') },
      { title: t('settings.network.musicUnblock'), desc: t('settings.network.musicUnblockDesc') },
      { title: t('settings.network.musicSources'), desc: t('settings.network.musicSourcesDesc') }
    ];
    networkItems.forEach((item) => {
      items.push({
        tabId: 'network',
        tabLabel: tabLabels['network'],
        title: item.title,
        desc: item.desc,
        titlePath: item.title
      });
    });

    const systemItems = [
      { title: t('settings.system.update'), desc: t('settings.system.updateDesc') },
      { title: t('settings.system.restart'), desc: t('settings.system.restartDesc') },
      { title: t('settings.system.clearCache'), desc: t('settings.system.clearCacheDesc') }
    ];
    systemItems.forEach((item) => {
      items.push({
        tabId: 'system',
        tabLabel: tabLabels['system'],
        title: item.title,
        desc: item.desc,
        titlePath: item.title
      });
    });
  }

  const aboutItems = [
    { title: t('settings.about.version'), desc: t('settings.about.versionDesc') },
    { title: t('settings.about.github'), desc: t('settings.about.githubDesc') },
    { title: t('settings.about.feedback'), desc: t('settings.about.feedbackDesc') }
  ];
  aboutItems.forEach((item) => {
    items.push({
      tabId: 'about',
      tabLabel: tabLabels['about'],
      title: item.title,
      desc: item.desc,
      titlePath: item.title
    });
  });

  return items;
});

const performSearch = useDebounceFn(() => {
  const q = searchQuery.value.trim();
  if (!q) {
    isSearching.value = false;
    searchResults.value = [];
    return;
  }
  isSearching.value = true;
  searchResults.value = settingIndex.value.filter((item) => {
    return fuzzyMatch(q, item.title) || fuzzyMatch(q, item.desc) || fuzzyMatch(q, item.tabLabel);
  });
}, 200);

const onSearchInput = () => {
  performSearch();
};

const clearSearch = () => {
  searchQuery.value = '';
  isSearching.value = false;
  searchResults.value = [];
};

const jumpToResult = (result: SearchResult) => {
  clearSearch();
  currentSection.value = result.tabId;
  nextTick(() => {
    nextTick(() => {
      const items = contentRef.value?.querySelectorAll('.setting-item');
      if (items) {
        for (const item of items) {
          const titleEl = item.querySelector('.setting-item-title, [class*="title"]');
          if (titleEl && titleEl.textContent?.includes(result.titlePath)) {
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

.settings-scroll {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  /* 为固定悬浮卡片留出空间 */
  padding-top: calc(var(--safe-area-inset-top, 0px) + 210px);
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
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.08);
  top: calc(var(--safe-area-inset-top, 0px) + 56px);
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
