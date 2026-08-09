<template>
  <div
    class="floating-topbar"
    :class="{
      'safe-area-top': hasSafeArea,
      'is-search': isSearchPage,
      'has-back': showBack,
      'menu-expanded': topbarMenu.expanded.value
    }"
  >
    <button v-if="showBack" type="button" class="topbar-pill topbar-back" @click="onTitleClick">
      <i class="ri-arrow-left-s-line" />
    </button>

    <div v-if="!isSearchPage" class="topbar-morph-anchor">
      <section
        class="topbar-pill topbar-morph"
        :class="{ expanded: topbarMenu.expanded.value, 'has-menu': hasMorphMenu }"
        @click="toggleMorphMenu"
      >
        <header class="morph-trigger">
          <span>{{
            hasMorphMenu ? topbarMenu.activeLabel.value || displayTitle : displayTitle
          }}</span>
          <i v-if="hasMorphMenu" class="ri-arrow-down-s-line" />
        </header>
        <div class="morph-content" @click.stop>
          <div v-for="group in topbarMenu.groups.value" :key="group.id" class="morph-group">
            <button
              v-for="option in group.options"
              :key="option.key"
              type="button"
              :class="{ active: String(option.key) === String(group.value) }"
              @click="selectMorphOption(group, option.key)"
            >
              <i v-if="option.icon" :class="option.icon" />
              <span>{{ option.label }}</span>
              <i v-if="String(option.key) === String(group.value)" class="ri-check-line" />
            </button>
          </div>
          <div v-if="topbarMenu.actions.value.length" class="morph-actions">
            <button
              v-for="action in topbarMenu.actions.value"
              :key="action.id"
              type="button"
              @click="runMorphAction(action)"
            >
              <i :class="action.icon" />
              <span>{{ action.label }}</span>
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- 搜索框（非搜索页：点击跳转；搜索页：真实输入框） -->
    <div
      class="topbar-pill topbar-search-pill"
      @click="!isSearchPage && !isSettingsPage && openSearch()"
    >
      <i class="ri-search-line search-icon"></i>
      <input
        v-if="isSearchPage || isSettingsPage"
        ref="searchInputRef"
        :value="isSettingsPage ? settingsSearchValue : searchStore.searchValue"
        type="text"
        class="search-input"
        :placeholder="isSettingsPage ? topbarSearchPlaceholder : searchStore.placeholder"
        @input="isSettingsPage ? onSettingsSearchInput : onSearchInput"
        @focus="isSearchPage && handleSearchFocus()"
        @click="isSearchPage && handleSearchFocus()"
        @keydown.enter="isSearchPage && handleSearchSubmit()"
      />
      <span v-else class="topbar-search-text">{{ topbarSearchPlaceholder }}</span>
      <i
        v-if="(isSearchPage && searchStore.searchValue) || (isSettingsPage && settingsSearchValue)"
        class="ri-close-circle-fill clear-icon"
        @click.stop="isSettingsPage ? clearSettingsSearch() : clearSearch()"
      ></i>
    </div>

    <section
      v-if="isSearchPage"
      class="topbar-pill topbar-search-type"
      :class="{ expanded: searchTypeExpanded }"
      @click.stop="searchTypeExpanded = !searchTypeExpanded"
    >
      <header class="search-type-trigger">
        <span>{{ activeSearchTypeLabel }}</span>
        <i class="ri-arrow-down-s-line" />
      </header>
      <div class="search-type-options">
        <button
          v-for="type in searchTypes"
          :key="type.key"
          type="button"
          :class="{ active: Number(type.key) === Number(searchStore.searchType) }"
          @click.stop="selectSearchType(type.key)"
        >
          <span>{{ type.label }}</span>
          <i v-if="Number(type.key) === Number(searchStore.searchType)" class="ri-check-line" />
        </button>
      </div>
    </section>

    <button
      v-if="route.path === '/user'"
      type="button"
      class="topbar-pill topbar-action-pill topbar-settings-pill"
      :title="t('common.settings')"
      @click="goToSettings"
    >
      <i class="ri-settings-3-line action-icon" />
    </button>

    <!-- 头像 / 搜索按钮 -->
    <div
      v-else
      class="topbar-pill topbar-action-pill"
      :class="{ 'search-btn': isSearchPage }"
      @click="isSearchPage ? handleSearchSubmit() : goToUser()"
    >
      <i v-if="isSearchPage" class="ri-search-line action-icon"></i>
      <template v-else>
        <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" class="avatar-img" />
        <div v-else class="avatar-placeholder">
          <i class="ri-user-3-line"></i>
        </div>
      </template>
    </div>
  </div>

  <div
    v-if="topbarMenu.expanded.value || searchTypeExpanded"
    class="morph-dismiss-layer"
    @pointerdown="closeFloatingMenus"
  />

  <Teleport to="body">
    <Transition name="search-assist">
      <div
        v-if="showSearchAssist"
        class="search-assist-layer"
        @pointerdown.self="closeSearchAssist"
      >
        <section class="search-assist-panel" @pointerdown.stop>
          <header class="search-assist-header">
            <div class="search-assist-title">
              <i :class="showingHistory ? 'ri-time-line' : 'ri-search-line'" />
              <span>
                {{ showingHistory ? t('search.title.searchHistory') : t('search.suggestions') }}
              </span>
            </div>
            <button
              v-if="showingHistory && searchHistory.length"
              type="button"
              class="search-assist-clear"
              @click="clearSearchHistory"
            >
              {{ t('search.button.clear') }}
            </button>
          </header>

          <div v-if="suggestionsLoading" class="search-assist-loading">
            <i class="ri-loader-4-line" />
          </div>

          <div v-else-if="assistItems.length" class="search-assist-list">
            <button
              v-for="(item, itemIndex) in assistItems"
              :key="`${showingHistory ? 'history' : 'suggestion'}-${item}-${itemIndex}`"
              type="button"
              class="search-assist-item"
              @click="selectSearchAssistItem(item)"
            >
              <i :class="showingHistory ? 'ri-history-line' : 'ri-search-line'" />
              <span>{{ item }}</span>
              <i class="ri-arrow-right-up-line item-arrow" />
            </button>
          </div>

          <div v-else class="search-assist-empty">
            <i :class="showingHistory ? 'ri-history-line' : 'ri-search-eye-line'" />
            <span>{{ t('common.noData') }}</span>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import { computed, inject, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { getSearchSuggestions } from '@/api/search';
import { useMobileTopbarMenu } from '@/composables/useMobileTopbarMenu';
import { SEARCH_TYPES } from '@/const/bar-const';
import { usePlatformAccountsStore } from '@/store/modules/platformAccounts';
import { useSearchStore } from '@/store/modules/search';
import { useUserStore } from '@/store/modules/user';
import { getImgUrl } from '@/utils';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();
const accountStore = usePlatformAccountsStore();
const searchStore = useSearchStore();

const hasSafeArea = inject('hasSafeArea', false);

const showBack = computed(() => route.meta.back === true);

const isSearchPage = computed(
  () => route.path === '/mobile-search' || route.path === '/mobile-search-result'
);
const isSettingsPage = computed(() => route.path === '/set');
const isSearchResultPage = computed(() => route.path === '/mobile-search-result');
const searchTypes = computed(() =>
  SEARCH_TYPES.map((type) => ({ key: type.key, label: t(type.label) }))
);

const topbarMenu = useMobileTopbarMenu(() => route.path);
const isUserPage = computed(() => route.path === '/user');
const hasMorphMenu = computed(
  () =>
    !isUserPage.value && (topbarMenu.groups.value.length > 0 || topbarMenu.actions.value.length > 0)
);

const displayTitle = computed(() => {
  if (route.path === '/') return t('comp.home');
  const title = route.meta.title as string;
  return title ? t(title) : '';
});

const avatarUrl = computed(() => {
  const url = accountStore.activeAccount?.avatarUrl || userStore.user?.avatarUrl;
  return url ? getImgUrl(url, '72y72') : '';
});

const topbarSearchPlaceholder = computed(() =>
  route.path === '/set' ? '搜索设置项...' : t('comp.searchBar.searchPlaceholder')
);

const searchInputRef = ref<HTMLInputElement | null>(null);
const settingsSearchValue = ref('');
const searchTypeExpanded = ref(false);
const showSearchAssist = ref(false);
const searchHistory = ref<string[]>([]);
const suggestions = ref<string[]>([]);
const suggestionsLoading = ref(false);
const showingHistory = computed(() => !searchStore.searchValue.trim());
const assistItems = computed(() =>
  showingHistory.value ? searchHistory.value : suggestions.value
);
const activeSearchTypeLabel = computed(
  () =>
    searchTypes.value.find((type) => Number(type.key) === Number(searchStore.searchType))?.label ||
    searchTypes.value[0]?.label ||
    ''
);
const HISTORY_KEY = 'mobile_search_history';
let suggestionRequestId = 0;

const loadSearchHistory = () => {
  try {
    const storedHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    searchHistory.value = Array.isArray(storedHistory)
      ? storedHistory.filter((item): item is string => typeof item === 'string').slice(0, 20)
      : [];
  } catch {
    searchHistory.value = [];
  }
};

const saveSearchHistory = (keyword: string) => {
  loadSearchHistory();
  searchHistory.value = [keyword, ...searchHistory.value.filter((item) => item !== keyword)].slice(
    0,
    20
  );
  localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value));
};

const loadSuggestions = async (keyword: string) => {
  const normalizedKeyword = keyword.trim();
  const requestId = ++suggestionRequestId;

  if (!normalizedKeyword) {
    suggestions.value = [];
    suggestionsLoading.value = false;
    return;
  }

  suggestionsLoading.value = true;
  const result = await getSearchSuggestions(normalizedKeyword);
  if (requestId === suggestionRequestId && searchStore.searchValue.trim() === normalizedKeyword) {
    suggestions.value = result;
    suggestionsLoading.value = false;
  }
};

const debouncedLoadSuggestions = useDebounceFn(loadSuggestions, 240);

const openSearchAssist = () => {
  if (!isSearchResultPage.value) return;

  showSearchAssist.value = true;
  if (showingHistory.value) {
    suggestionRequestId++;
    suggestions.value = [];
    suggestionsLoading.value = false;
    loadSearchHistory();
  } else {
    debouncedLoadSuggestions(searchStore.searchValue);
  }
};

const closeSearchAssist = () => {
  showSearchAssist.value = false;
};

// Focus search input when entering search page
watch(isSearchPage, (val) => {
  if (val && route.path === '/mobile-search') {
    nextTick(() => {
      setTimeout(() => searchInputRef.value?.focus(), 300);
    });
  }
});

// Sync search value from URL on search result page
watch(
  () => route.query.keyword,
  (keyword) => {
    if (route.path === '/mobile-search-result' && typeof keyword === 'string') {
      searchStore.setSearchValue(keyword);
    }
  },
  { immediate: true }
);

watch(
  () => route.path,
  () => {
    closeSearchAssist();
    topbarMenu.close();
    searchTypeExpanded.value = false;
  }
);

const closeFloatingMenus = () => {
  topbarMenu.close();
  searchTypeExpanded.value = false;
};

const onTitleClick = () => {
  if (showBack.value) {
    // Clear search value when leaving search
    if (isSearchPage.value) {
      searchStore.setSearchValue('');
    }
    router.back();
  }
};

const toggleMorphMenu = () => {
  if (hasMorphMenu.value) topbarMenu.expanded.value = !topbarMenu.expanded.value;
};

const selectMorphOption = (group: any, value: string | number) => {
  group.select(value);
  topbarMenu.close();
};

const runMorphAction = (action: any) => {
  topbarMenu.close();
  action.run();
};

const openSearch = () => router.push('/mobile-search');

const onSettingsSearchInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  settingsSearchValue.value = value;
  window.dispatchEvent(new CustomEvent('mobile-settings-search-input', { detail: value }));
};

const clearSettingsSearch = () => {
  settingsSearchValue.value = '';
  window.dispatchEvent(new CustomEvent('mobile-settings-search-input', { detail: '' }));
};

const goToUser = () => router.push('/user');
const goToSettings = () => router.push('/set');

const onSearchInput = (e: Event) => {
  const value = (e.target as HTMLInputElement).value;
  searchStore.setSearchValue(value);
  if (!isSearchResultPage.value) return;

  showSearchAssist.value = true;
  if (value.trim()) {
    debouncedLoadSuggestions(value);
  } else {
    suggestionRequestId++;
    suggestions.value = [];
    suggestionsLoading.value = false;
    loadSearchHistory();
  }
};

const handleSearchFocus = () => openSearchAssist();

const clearSearch = () => {
  searchStore.setSearchValue('');
  openSearchAssist();
};

const selectSearchType = (value: string | number) => {
  const type = Number(value);
  searchStore.setSearchType(type);
  searchTypeExpanded.value = false;
  if (isSearchResultPage.value) {
    router.replace({ path: route.path, query: { ...route.query, type } });
  }
};

const clearSearchHistory = () => {
  searchHistory.value = [];
  localStorage.removeItem(HISTORY_KEY);
};

const navigateToSearchResult = (keyword: string) => {
  saveSearchHistory(keyword);
  searchStore.setSearchValue(keyword);
  closeSearchAssist();
  searchInputRef.value?.blur();

  const location = {
    path: '/mobile-search-result',
    query: { keyword, type: searchStore.searchType }
  };
  if (isSearchResultPage.value) {
    router.replace(location);
  } else {
    router.push(location);
  }
};

const selectSearchAssistItem = (keyword: string) => {
  navigateToSearchResult(keyword);
};

const handleSearchSubmit = () => {
  const keyword = searchStore.searchValue.trim();
  if (!keyword) {
    openSearchAssist();
    return;
  }

  navigateToSearchResult(keyword);
};
</script>

<style lang="scss" scoped>
.floating-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  padding-top: calc(var(--safe-area-inset-top, 0px) + 8px);
  padding-bottom: 8px;
  pointer-events: none; /* allow scroll-through on gaps */
  transition: padding-top 220ms ease;
}

.topbar-morph-anchor {
  position: relative;
  width: 80px;
  height: 40px;
  flex: 0 0 80px;
  pointer-events: auto;
}

.topbar-pill {
  display: flex;
  align-items: center;
  height: 40px;
  border-radius: 20px;
  background: var(--m-glass-bg);
  backdrop-filter: blur(24px) saturate(170%);
  -webkit-backdrop-filter: blur(24px) saturate(170%);
  border: 1px solid color-mix(in srgb, var(--m-white, #fff) 25%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
  cursor: pointer;
  pointer-events: auto;
  transition:
    transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1),
    background 180ms ease,
    border-color 180ms ease,
    max-width 240ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 180ms cubic-bezier(0.32, 0.72, 0, 1),
    padding 220ms cubic-bezier(0.32, 0.72, 0, 1),
    flex 240ms cubic-bezier(0.32, 0.72, 0, 1);
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  overflow: hidden;

  &:active {
    transform: scale(0.95);
  }
}

.topbar-back {
  flex: 0 0 40px;
  justify-content: center;
  padding: 0;
  border-radius: 50%;
  border-color: var(--cover-border, rgba(128, 128, 128, 0.14));
  color: var(--cover-text-primary, var(--text-color));
  font-size: 22px;
}

.topbar-morph {
  position: relative;
  z-index: 3;
  flex: 0 0 auto;
  width: 80px;
  height: auto;
  min-width: 72px;
  max-width: 88px;
  min-height: 40px;
  max-height: 40px;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  padding: 0;
  border-radius: 20px;
  overflow: hidden;
  transform-origin: top left;
  transition:
    width 360ms cubic-bezier(0.32, 0.72, 0, 1),
    max-width 360ms cubic-bezier(0.32, 0.72, 0, 1),
    max-height 360ms cubic-bezier(0.32, 0.72, 0, 1),
    min-height 360ms cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 360ms cubic-bezier(0.32, 0.72, 0, 1),
    background-color 240ms ease,
    box-shadow 360ms cubic-bezier(0.32, 0.72, 0, 1);

  &.expanded {
    position: fixed;
    top: calc(var(--safe-area-inset-top, 0px) + 8px);
    left: 12px;
    width: min(78vw, 320px);
    max-width: min(78vw, 320px);
    max-height: min(52dvh, 420px);
    min-height: 40px;
    border-radius: 18px;
    background: var(--m-glass-bg);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.16);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
  }
}

.floating-topbar.has-back .topbar-morph.expanded {
  left: 60px;
}

.morph-trigger {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  color: var(--cover-text-primary, var(--text-color));
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  i {
    flex: 0 0 auto;
    color: var(--cover-text-muted, #9a9590);
    font-size: 16px;
  }
}

.morph-content {
  display: grid;
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  padding: 0;
  transition:
    max-height 360ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 180ms ease,
    padding 360ms cubic-bezier(0.32, 0.72, 0, 1);

  .topbar-morph.expanded & {
    max-height: min(52dvh, 420px);
    overflow-y: auto;
    opacity: 1;
    padding: 6px;
  }
}

.morph-group,
.morph-actions {
  display: grid;
  gap: 2px;
}

.morph-group + .morph-group,
.morph-actions {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--cover-border, rgba(128, 128, 128, 0.12));
}

.morph-group button,
.morph-actions button {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0 10px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--cover-text-primary, var(--text-color));
  font-size: 14px;
  text-align: left;
  cursor: pointer;

  i:first-child {
    color: var(--cover-text-muted, #9a9590);
    font-size: 17px;
  }

  i:last-child {
    margin-left: auto;
    color: var(--accent-color);
    font-size: 18px;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:active,
  &.active {
    background: var(--cover-surface-hover, rgba(128, 128, 128, 0.1));
    color: var(--accent-color);
  }
}

.morph-dismiss-layer {
  position: fixed;
  inset: 0;
  z-index: 99;
  background: transparent;
}

/* 页面名 */
.topbar-title-pill {
  flex-shrink: 0;
  padding: 0 14px;
  gap: 2px;
  max-width: 140px;
  opacity: 1;

  &.collapsed {
    max-width: 40px;
    padding: 0;
    justify-content: center;
    flex-shrink: 0;
  }

  .title-back-icon {
    font-size: 22px;
    color: var(--cover-text-primary, var(--text-color));
    flex-shrink: 0;
    opacity: 0;
    width: 0;
    transition:
      opacity 180ms ease,
      width 200ms ease;
  }

  &.collapsed .title-back-icon {
    opacity: 1;
    width: 22px;
  }
}

.topbar-title-text {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--cover-text-primary, var(--text-color));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 160ms ease;
}

.collapsed .topbar-title-text {
  opacity: 0;
  width: 0;
}

/* 搜索框 */
.topbar-search-pill {
  flex: 1;
  min-width: 0;
  padding: 0 14px;
  gap: 8px;

  .search-icon {
    font-size: 17px;
    color: var(--cover-text-muted, #9a9590);
    flex-shrink: 0;
  }
}

.topbar-search-text {
  flex: 1;
  font-size: 13px;
  color: var(--cover-text-muted, #9a9590);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.search-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--cover-text-primary, var(--text-color));
  height: 100%;

  &::placeholder {
    color: var(--cover-text-muted, #9a9590);
  }
}

.clear-icon {
  font-size: 16px;
  color: var(--cover-text-muted, #9a9590);
  flex-shrink: 0;
  cursor: pointer;
}

/* 头像 / 搜索按钮 */
.topbar-action-pill {
  flex-shrink: 0;
  padding: 3px;
  width: 40px;
  height: 40px;
  justify-content: center;

  &.search-btn {
    background: var(--accent-color, #888);
    border-color: transparent;
  }
}

.topbar-search-type {
  position: relative;
  flex: 0 0 auto;
  z-index: 4;
  width: 72px;
  max-width: 72px;
  height: auto;
  min-height: 40px;
  max-height: 40px;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  padding: 0;
  overflow: hidden;
  color: var(--cover-text-primary, var(--text-color));
  transform-origin: top right;
  transition:
    width 360ms cubic-bezier(0.32, 0.72, 0, 1),
    max-width 360ms cubic-bezier(0.32, 0.72, 0, 1),
    max-height 360ms cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 360ms cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 280ms ease;

  &.expanded {
    position: fixed;
    top: calc(var(--safe-area-inset-top, 0px) + 8px);
    right: 60px;
    width: min(42vw, 170px);
    max-width: min(42vw, 170px);
    max-height: 286px;
    border-radius: 18px;
    box-shadow: 0 16px 42px rgba(0, 0, 0, 0.17);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
  }
}

.search-type-trigger {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0 9px;
  font-size: 12px;
  font-weight: 650;

  i {
    color: var(--cover-text-muted, #9a9590);
    font-size: 13px;
    transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
  }

  .expanded & i {
    transform: rotate(180deg);
  }
}

.search-type-options {
  display: grid;
  gap: 2px;
  padding: 0 6px 6px;
  opacity: 0;
  transform: translateY(-6px);
  transition:
    opacity 180ms ease,
    transform 300ms cubic-bezier(0.32, 0.72, 0, 1);

  .expanded & {
    opacity: 1;
    transform: none;
  }

  button {
    display: grid;
    min-height: 38px;
    grid-template-columns: minmax(0, 1fr) 18px;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--cover-text-primary, var(--text-color));
    font-size: 13px;
    text-align: left;

    &.active {
      background: color-mix(in srgb, var(--accent-color) 14%, transparent);
      color: var(--accent-color);
    }

    i {
      color: currentColor;
    }
  }
}

.topbar-search-pill,
.topbar-search-type,
.topbar-action-pill {
  transform-origin: center right;
  transition:
    opacity 180ms ease,
    transform 340ms cubic-bezier(0.32, 0.72, 0, 1),
    background 180ms ease,
    border-color 180ms ease;
}

.floating-topbar.menu-expanded {
  .topbar-search-pill,
  .topbar-search-type,
  .topbar-action-pill {
    opacity: 0;
    transform: translate3d(12px, 0, 0) scale(0.94);
    pointer-events: none;
  }
}

.topbar-settings-pill {
  border: 1px solid var(--m-glass-border);
  color: var(--cover-text-primary, var(--text-color));

  .action-icon {
    color: currentColor;
    font-size: 20px;
  }
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 17px;
  object-fit: cover;
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 17px;
  background: var(--cover-surface-hover, rgba(255, 255, 255, 0.12));
  color: var(--cover-text-muted, #9a9590);
  font-size: 18px;
}

.action-icon {
  font-size: 18px;
  color: #fff;
}

.search-assist-layer {
  position: fixed;
  inset: 0;
  z-index: 99;
  background: rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.search-assist-panel {
  position: absolute;
  top: calc(var(--safe-area-inset-top, 0px) + 58px);
  right: 12px;
  left: 12px;
  max-height: min(48dvh, 420px);
  overflow: hidden;
  border: 1px solid var(--cover-border, rgba(255, 255, 255, 0.12));
  border-radius: 20px;
  background: var(--m-glass-bg);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  color: var(--cover-text-primary, var(--text-color));
}

.search-assist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 46px;
  padding: 0 16px;
  border-bottom: 1px solid var(--cover-border, rgba(128, 128, 128, 0.1));
}

.search-assist-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;

  i {
    color: var(--accent-color);
    font-size: 16px;
  }
}

.search-assist-clear {
  padding: 6px 9px;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  color: var(--cover-text-muted, #9a9590);
  font-size: 12px;
  cursor: pointer;
  transition:
    color 150ms ease,
    background-color 150ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  &:active {
    background: var(--cover-surface-hover, rgba(128, 128, 128, 0.1));
    transform: scale(0.97);
  }
}

.search-assist-list {
  max-height: calc(min(48dvh, 420px) - 46px);
  overflow-y: auto;
  padding: 6px;
  overscroll-behavior: contain;
}

.search-assist-item {
  display: grid;
  width: 100%;
  min-height: 44px;
  grid-template-columns: 22px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--cover-text-primary, var(--text-color));
  cursor: pointer;
  text-align: left;
  transition:
    color 150ms ease,
    background-color 150ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

  > i:first-child {
    color: var(--cover-text-muted, #9a9590);
    font-size: 16px;
  }

  span {
    overflow: hidden;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-arrow {
    color: var(--cover-text-muted, #9a9590);
    font-size: 15px;
    opacity: 0.6;
  }

  &:active {
    background: var(--cover-surface-hover, rgba(128, 128, 128, 0.1));
    color: var(--accent-color);
    transform: scale(0.99);
  }
}

.search-assist-loading,
.search-assist-empty {
  display: flex;
  min-height: 112px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--cover-text-muted, #9a9590);
  font-size: 13px;
}

.search-assist-loading i {
  color: var(--accent-color);
  font-size: 20px;
  animation: search-assist-spin 800ms linear infinite;
}

.search-assist-enter-active,
.search-assist-leave-active {
  transition: opacity 180ms ease;

  .search-assist-panel {
    transition:
      opacity 180ms ease,
      transform 220ms cubic-bezier(0.23, 1, 0.32, 1);
  }
}

.search-assist-enter-from,
.search-assist-leave-to {
  opacity: 0;

  .search-assist-panel {
    opacity: 0;
    transform: translateY(-8px) scale(0.985);
  }
}

@keyframes search-assist-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .topbar-search-pill,
  .topbar-search-type,
  .topbar-action-pill {
    transition-duration: 120ms;
    transform: none !important;
  }

  .floating-topbar,
  .topbar-pill {
    transition: none;
  }

  .title-back-icon,
  .topbar-title-text {
    transition-duration: 0ms;
  }

  .search-assist-enter-active,
  .search-assist-leave-active,
  .search-assist-enter-active .search-assist-panel,
  .search-assist-leave-active .search-assist-panel,
  .search-assist-clear,
  .search-assist-item {
    transition-duration: 0ms;
  }

  .search-assist-loading i {
    animation-duration: 1.6s;
  }

  .search-assist-clear:active,
  .search-assist-item:active {
    transform: none;
  }
}
</style>
