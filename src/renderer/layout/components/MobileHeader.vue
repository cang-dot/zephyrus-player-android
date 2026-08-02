<template>
  <div class="floating-topbar" :class="{ 'safe-area-top': hasSafeArea, 'is-search': isSearchPage }">
    <!-- 页面名 / 返回按钮 -->
    <div
      class="topbar-pill topbar-title-pill"
      :class="{ collapsed: isSearchPage || hasPageHero }"
      @click="onTitleClick"
    >
      <i class="ri-arrow-left-s-line title-back-icon"></i>
      <span class="topbar-title-text">{{ displayTitle }}</span>
    </div>

    <!-- 搜索框（非搜索页：点击跳转；搜索页：真实输入框） -->
    <div class="topbar-pill topbar-search-pill" @click="!isSearchPage && openSearch()">
      <i class="ri-search-line search-icon"></i>
      <input
        v-if="isSearchPage"
        ref="searchInputRef"
        :value="searchStore.searchValue"
        type="text"
        class="search-input"
        :placeholder="searchStore.placeholder"
        @input="onSearchInput"
        @focus="handleSearchFocus"
        @click="handleSearchFocus"
        @keydown.enter="handleSearchSubmit"
      />
      <span v-else class="topbar-search-text">{{ t('comp.searchBar.searchPlaceholder') }}</span>
      <i
        v-if="isSearchPage && searchStore.searchValue"
        class="ri-close-circle-fill clear-icon"
        @click.stop="clearSearch"
      ></i>
    </div>

    <!-- 头像 / 搜索按钮 -->
    <div
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
import { useSearchStore } from '@/store/modules/search';
import { usePlatformAccountsStore } from '@/store/modules/platformAccounts';
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
const isSearchResultPage = computed(() => route.path === '/mobile-search-result');

// 页面自身有 Hero Card（含标题）时，隐藏顶栏标题防止重复
const hasPageHero = computed(() => {
  return ['/list', '/local-music', '/set', '/user'].includes(route.path);
});

const displayTitle = computed(() => {
  if (route.path === '/') return t('comp.home');
  const title = route.meta.title as string;
  return title ? t(title) : '';
});

const avatarUrl = computed(() => {
  const url = accountStore.activeAccount?.avatarUrl || userStore.user?.avatarUrl;
  return url ? getImgUrl(url, '72y72') : '';
});

const searchInputRef = ref<HTMLInputElement | null>(null);
const showSearchAssist = ref(false);
const searchHistory = ref<string[]>([]);
const suggestions = ref<string[]>([]);
const suggestionsLoading = ref(false);
const showingHistory = computed(() => !searchStore.searchValue.trim());
const assistItems = computed(() =>
  showingHistory.value ? searchHistory.value : suggestions.value
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
  () => closeSearchAssist()
);

const onTitleClick = () => {
  if (showBack.value) {
    // Clear search value when leaving search
    if (isSearchPage.value) {
      searchStore.setSearchValue('');
    }
    router.back();
  }
};

const openSearch = () => router.push('/mobile-search');

const goToUser = () => router.push('/user');

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

.topbar-pill {
  display: flex;
  align-items: center;
  height: 40px;
  border-radius: 20px;
  background: var(--cover-surface, rgba(255, 255, 255, 0.08));
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--cover-border, rgba(255, 255, 255, 0.06));
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
  background: var(--cover-surface, rgba(255, 255, 255, 0.92));
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
