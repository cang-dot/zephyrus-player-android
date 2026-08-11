<template>
  <div
    class="floating-topbar"
    :class="{
      'safe-area-top': hasSafeArea,
      'is-search': isSearchPage,
      'has-back': showBack,
      'menu-expanded': topbarMenu.expanded.value,
      'filter-expanded': searchTypeExpanded,
      'wide-detail-topbar': usesWideDetailTopbar
    }"
  >
    <button v-if="showBack" type="button" class="topbar-pill topbar-back" @click="onTitleClick">
      <i class="ri-arrow-left-s-line" />
    </button>

    <div v-if="!isSearchPage" class="topbar-morph-anchor">
      <section
        class="topbar-pill topbar-morph"
        :class="{ expanded: topbarMenu.expanded.value, 'has-menu': hasMorphMenu }"
        @pointerdown.stop
      >
        <header class="morph-trigger" @click.stop="toggleMorphMenu">
          <img
            v-if="topbarMenu.presentation.value?.imageUrl"
            :src="topbarMenu.presentation.value.imageUrl"
            class="morph-trigger-image"
            alt=""
          />
          <span class="morph-trigger-copy">
            <strong>{{
              topbarMenu.presentation.value?.title ||
              (hasMorphMenu ? topbarMenu.activeLabel.value || displayTitle : displayTitle)
            }}</strong>
            <small v-if="topbarMenu.presentation.value?.subtitle">
              {{ topbarMenu.presentation.value.subtitle }}
            </small>
          </span>
          <i v-if="hasMorphMenu" class="ri-arrow-down-s-line" />
        </header>
        <div v-if="topbarMenu.presentation.value?.badge" class="morph-badge">
          {{ topbarMenu.presentation.value.badge }}
        </div>
        <div class="morph-content" @click.stop>
          <section v-if="topbarMenu.presentation.value?.description" class="morph-description">
            <header v-if="topbarMenu.presentation.value.descriptionTitle">
              <i class="ri-information-line" />
              <strong>{{ topbarMenu.presentation.value.descriptionTitle }}</strong>
            </header>
            <p>{{ topbarMenu.presentation.value.description }}</p>
          </section>
          <label v-if="topbarMenu.presentation.value?.searchPlaceholder" class="morph-search">
            <i class="ri-search-line" />
            <input
              ref="morphSearchInputRef"
              :value="topbarMenu.presentation.value.searchValue || ''"
              :placeholder="topbarMenu.presentation.value.searchPlaceholder"
              @input="
                topbarMenu.presentation.value.onSearchInput?.(
                  ($event.target as HTMLInputElement).value
                )
              "
            />
          </label>
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
            <section
              v-for="action in topbarMenu.actions.value"
              :key="action.id"
              class="morph-action-shell"
              :class="{ expanded: expandedMorphActionId === action.id }"
            >
              <button
                type="button"
                class="morph-action-trigger"
                @click.stop="runMorphAction(action)"
              >
                <i :class="action.icon" />
                <span>{{ action.label }}</span>
                <i v-if="action.options?.length" class="ri-arrow-down-s-line morph-action-arrow" />
              </button>
              <div v-if="action.options?.length" class="morph-action-options-wrap">
                <div class="morph-action-options">
                  <button
                    v-for="option in action.options"
                    :key="option.key"
                    type="button"
                    :class="{ active: String(option.key) === String(action.value) }"
                    @click.stop="selectMorphActionOption(action, option.key)"
                  >
                    <span>{{ option.label }}</span>
                    <i v-if="String(option.key) === String(action.value)" class="ri-check-line" />
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>

    <!-- 搜索框（非搜索页：点击跳转；搜索页：真实输入框） -->
    <button
      class="topbar-pill topbar-search-pill"
      :class="{ 'search-circle': usesWideDetailTopbar }"
      @click="!isSearchPage && !isSettingsPage && openSearch()"
      :aria-label="t('comp.searchBar.searchPlaceholder')"
    >
      <i class="ri-search-line search-icon"></i>
      <input
        ref="searchInputRef"
        :value="isSettingsPage ? settingsSearchValue : isSearchPage ? searchStore.searchValue : ''"
        type="text"
        class="search-input"
        :readonly="!isSearchPage && !isSettingsPage"
        :placeholder="isSettingsPage ? topbarSearchPlaceholder : searchStore.placeholder"
        @input="onTopbarInput"
        @focus="(isSearchPage || isSettingsPage) && handleSearchFocus()"
        @click="(isSearchPage || isSettingsPage) && handleSearchFocus()"
        @keydown.enter="isSearchPage && handleSearchSubmit()"
      />
      <i
        v-if="(isSearchPage && searchStore.searchValue) || (isSettingsPage && settingsSearchValue)"
        class="ri-close-circle-fill clear-icon"
        @click.stop="isSettingsPage ? clearSettingsSearch() : clearSearch()"
      ></i>
    </button>

    <div v-if="isSearchPage" class="topbar-morph-anchor topbar-search-morph-anchor">
      <section
        class="topbar-pill topbar-morph topbar-search-morph"
        :class="{ expanded: searchTypeExpanded }"
        @pointerdown.stop
      >
        <header
          class="morph-trigger search-filter-trigger"
          @click.stop="searchTypeExpanded = !searchTypeExpanded"
        >
          <span>{{ activeSearchTypeLabel }}</span>
          <i class="ri-arrow-down-s-line" />
        </header>
        <div class="morph-content search-filter-content" @click.stop>
          <div class="search-filter-grid">
            <section class="search-filter-column">
              <p class="search-filter-heading">搜索类型</p>
              <div class="morph-group search-filter-options">
                <button
                  v-for="type in searchTypes"
                  :key="type.key"
                  type="button"
                  :class="{ active: Number(type.key) === Number(searchStore.searchType) }"
                  @click.stop="selectSearchType(type.key)"
                >
                  <span>{{ type.label }}</span>
                  <i
                    v-if="Number(type.key) === Number(searchStore.searchType)"
                    class="ri-check-line"
                  />
                </button>
              </div>
            </section>
            <section class="search-filter-column">
              <p class="search-filter-heading">来源</p>
              <div class="morph-group search-filter-options search-source-options">
                <button
                  v-for="source in searchStore.searchSourceOptions"
                  :key="source.key"
                  type="button"
                  class="search-source-option"
                  :class="{ active: source.key === searchStore.searchSource }"
                  @click.stop="selectSearchSource(source.key)"
                >
                  <platform-logo
                    v-if="platformForSearchSource(source.key)"
                    :platform="platformForSearchSource(source.key)"
                    :size="16"
                  />
                  <i v-else class="ri-apps-2-line" />
                  <span
                    >{{ source.label
                    }}<small v-if="source.count != null"> {{ source.count }}</small></span
                  >
                  <i v-if="source.key === searchStore.searchSource" class="ri-check-line" />
                </button>
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>

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
              <i
                :class="
                  isSettingsPage
                    ? 'ri-settings-3-line'
                    : showingHistory
                      ? 'ri-time-line'
                      : 'ri-search-line'
                "
              />
              <span>
                {{
                  isSettingsPage
                    ? '设置建议'
                    : showingHistory
                      ? t('search.title.searchHistory')
                      : t('search.suggestions')
                }}
              </span>
            </div>
            <button
              v-if="!isSettingsPage && showingHistory && searchHistory.length"
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

          <div v-else-if="isSettingsPage && settingsAssistItems.length" class="search-assist-list">
            <button
              v-for="(item, itemIndex) in settingsAssistItems"
              :key="`settings-${item.tabId}-${item.title}-${itemIndex}`"
              type="button"
              class="search-assist-item search-assist-item--setting"
              @click="selectSettingsAssistItem(item)"
            >
              <span class="settings-assist-section">{{ item.tabLabel }}</span>
              <span class="settings-assist-copy">
                <strong>{{ item.title }}</strong>
                <small>{{ item.desc }}</small>
              </span>
              <i class="ri-arrow-right-s-line item-arrow" />
            </button>
          </div>

          <div v-else-if="!isSettingsPage && assistItems.length" class="search-assist-list">
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
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { getSearchSuggestions } from '@/api/search';
import PlatformLogo from '@/components/common/PlatformLogo.vue';
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
const usesWideDetailTopbar = computed(
  () => route.path.startsWith('/music-list/') || route.path.startsWith('/artist/detail/')
);
const isSearchResultPage = computed(() => route.path === '/mobile-search-result');
const searchTypes = computed(() =>
  SEARCH_TYPES.map((type) => ({ key: type.key, label: t(type.label) }))
);

const topbarMenu = useMobileTopbarMenu(() => route.path);
const isUserPage = computed(() => route.path === '/user');
const hasMorphMenu = computed(
  () =>
    !isUserPage.value &&
    (topbarMenu.groups.value.length > 0 ||
      topbarMenu.actions.value.length > 0 ||
      Boolean(topbarMenu.presentation.value))
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
const morphSearchInputRef = ref<HTMLInputElement | null>(null);
const settingsSearchValue = ref('');
const searchTypeExpanded = ref(false);
const expandedMorphActionId = ref<string | null>(null);
const showSearchAssist = ref(false);
type SettingsAssistItem = {
  tabId: string;
  tabLabel: string;
  title: string;
  desc: string;
  titlePath: string;
};
const settingsAssistItems = ref<SettingsAssistItem[]>([]);
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
  if (!isSearchResultPage.value && !isSettingsPage.value) return;

  showSearchAssist.value = isSettingsPage.value;
  if (isSettingsPage.value) return;
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
    expandedMorphActionId.value = null;
  }
);

const closeFloatingMenus = () => {
  topbarMenu.close();
  searchTypeExpanded.value = false;
  expandedMorphActionId.value = null;
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
  if (!hasMorphMenu.value) return;
  topbarMenu.expanded.value = !topbarMenu.expanded.value;
  if (!topbarMenu.expanded.value) expandedMorphActionId.value = null;
};

const selectMorphOption = (group: any, value: string | number) => {
  group.select(value);
  topbarMenu.close();
};

const runMorphAction = (action: any) => {
  if (action.options?.length) {
    expandedMorphActionId.value = expandedMorphActionId.value === action.id ? null : action.id;
    return;
  }
  if (!action.keepOpen) topbarMenu.close();
  expandedMorphActionId.value = null;
  action.run();
  if (action.keepOpen) nextTick(() => morphSearchInputRef.value?.focus());
};

const selectMorphActionOption = (action: any, value: string | number) => {
  action.select?.(value);
  expandedMorphActionId.value = null;
};

const openSearch = () => router.push('/mobile-search');

const onSettingsSearchInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  settingsSearchValue.value = value;
  window.dispatchEvent(new CustomEvent('mobile-settings-search-input', { detail: value }));
};

const onTopbarInput = (event: Event) => {
  if (isSettingsPage.value) {
    onSettingsSearchInput(event);
  } else if (isSearchPage.value) {
    onSearchInput(event);
  }
};

const onSettingsSearchResults = (event: Event) => {
  settingsAssistItems.value = Array.isArray((event as CustomEvent).detail)
    ? (event as CustomEvent<SettingsAssistItem[]>).detail
    : [];
  showSearchAssist.value = Boolean(settingsSearchValue.value.trim());
};

const clearSettingsSearch = () => {
  settingsSearchValue.value = '';
  window.dispatchEvent(new CustomEvent('mobile-settings-search-input', { detail: '' }));
  settingsAssistItems.value = [];
  closeSearchAssist();
};

const goToUser = () => router.push('/user');
const goToSettings = () => router.push('/set');

const onSearchInput = (e: Event) => {
  const value = (e.target as HTMLInputElement).value;
  searchStore.setSearchValue(value);
  if (!isSearchResultPage.value) return;

  showSearchAssist.value = isSettingsPage.value;
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

const selectSearchSource = (source: string) => {
  if (searchStore.searchType !== 1) searchStore.setSearchType(1);
  searchStore.setSearchSource(source);
  searchTypeExpanded.value = false;
  if (isSearchResultPage.value) {
    router.replace({ path: route.path, query: { ...route.query, type: 1, source } });
  }
};

const platformForSearchSource = (source: string) => {
  if (source === 'netease' || source === 'netease-vip') return 'netease';
  if (source === 'cross-qq') return 'qq';
  if (source === 'cross-joox') return 'joox';
  if (source === 'cross-kugou') return 'kugou';
  if (source === 'cross-spotify') return 'spotify';
  return '';
};

const selectSettingsAssistItem = (item: SettingsAssistItem) => {
  closeSearchAssist();
  searchInputRef.value?.blur();
  window.dispatchEvent(new CustomEvent('mobile-settings-search-select', { detail: item }));
};

onMounted(() => {
  window.addEventListener('mobile-settings-search-results', onSettingsSearchResults);
});

onBeforeUnmount(() => {
  window.removeEventListener('mobile-settings-search-results', onSettingsSearchResults);
});

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

.topbar-search-morph-anchor {
  width: 72px;
  flex-basis: 72px;
}

.topbar-search-morph {
  position: fixed;
  top: calc(var(--safe-area-inset-top, 0px) + 8px);
  right: 60px;
  left: auto;
  width: 72px;
  min-width: 72px;
  max-width: 72px;
  max-height: none;
  transform-origin: top right;

  &.expanded {
    width: min(calc(100vw - 72px), 430px);
    max-width: min(calc(100vw - 72px), 430px);
    max-height: calc(100dvh - var(--safe-area-inset-top, 0px) - 16px);
    min-height: 40px;
    border-radius: 18px;
    background: var(--m-glass-bg);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.16);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
  }
}

/* 歌单与歌手详情的收起胶囊填满中间轨道，让右侧按钮保持稳定。 */
.floating-topbar.wide-detail-topbar .topbar-morph-anchor {
  width: auto;
  min-width: 0;
  flex: 1 1 auto;
}

.floating-topbar.wide-detail-topbar .topbar-morph:not(.expanded) {
  width: 100%;
  max-width: none;
}

/* 展开态保持同一容器形变，并延伸到顶栏右边缘。 */
.floating-topbar.wide-detail-topbar .topbar-morph.expanded {
  width: min(calc(100vw - 72px), 460px);
  max-width: min(calc(100vw - 72px), 460px);
}

.floating-topbar.has-back .topbar-morph.expanded {
  left: 60px;
}

/* Search filter keeps the right edge of its trigger as the morph origin. */
.floating-topbar.has-back .topbar-search-morph.expanded {
  right: 60px;
  left: auto;
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

  .morph-trigger-copy {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    align-items: center;

    strong,
    small {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      font-size: inherit;
      font-weight: inherit;
    }

    small {
      max-height: 0;
      color: var(--cover-text-muted, #9a9590);
      font-size: 10px;
      font-weight: 500;
      opacity: 0;
      transition:
        max-height 260ms cubic-bezier(0.32, 0.72, 0, 1),
        opacity 180ms ease;
    }
  }

  .topbar-morph.expanded & {
    min-height: 54px;
    justify-content: flex-start;

    .morph-trigger-copy {
      align-items: flex-start;
    }

    .morph-trigger-copy small {
      max-height: 16px;
      opacity: 1;
    }
  }

  > i:last-child {
    transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
  }

  .topbar-morph.expanded & > i:last-child {
    transform: rotate(180deg);
  }

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

.morph-trigger-image {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
  transition:
    width 320ms cubic-bezier(0.32, 0.72, 0, 1),
    height 320ms cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 320ms cubic-bezier(0.32, 0.72, 0, 1);

  .topbar-morph.expanded & {
    width: 34px;
    height: 34px;
    flex-basis: 34px;
    border-radius: 10px;
  }
}

.morph-badge {
  display: none;
  margin: 0 12px 4px;
  color: var(--cover-text-muted, #9a9590);
  font-size: 10px;
  letter-spacing: 0.04em;

  .topbar-morph.expanded & {
    display: block;
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

.morph-description {
  display: grid;
  gap: 8px;
  margin: 0 6px 6px;
  padding: 10px 8px 12px;
  border-bottom: 1px solid
    color-mix(in srgb, var(--cover-border, rgba(128, 128, 128, 0.14)) 78%, transparent);
  color: var(--cover-text-secondary, var(--text-color));

  header {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--cover-text-primary, var(--text-color));
    font-size: 13px;

    i {
      color: var(--accent-color);
      font-size: 16px;
    }

    strong {
      font-weight: 650;
    }
  }

  p {
    margin: 0;
    color: var(--cover-text-secondary, var(--text-color));
    font-size: 12px;
    line-height: 1.65;
    white-space: pre-line;
  }
}

.search-filter-content {
  display: grid;
  max-height: none;
  grid-template-rows: 0fr;
  padding: 0 6px;
  overflow: hidden;
  transition:
    grid-template-rows 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 180ms ease,
    padding 420ms cubic-bezier(0.2, 0.8, 0.2, 1);

  .topbar-search-morph.expanded & {
    max-height: none;
    grid-template-rows: 1fr;
    overflow: hidden;
    padding: 6px;
  }
}

.search-filter-grid {
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 8px;
  overflow: hidden;
}

.search-filter-trigger {
  min-height: 40px;
  padding-inline: 10px;
  font-size: 12px;

  i {
    font-size: 13px;
    transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
  }

  .topbar-search-morph.expanded & i {
    transform: rotate(180deg);
  }
}

.search-filter-column {
  min-width: 0;
}

.morph-group,
.morph-actions {
  display: grid;
  gap: 2px;
}

.floating-topbar.wide-detail-topbar .morph-actions {
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
}

.floating-topbar.wide-detail-topbar .morph-action-trigger > i:first-child {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  place-items: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent-color) 12%, transparent);
  color: var(--accent-color);
}

.morph-action-shell {
  display: grid;
  min-width: 0;
  grid-template-rows: auto 0fr;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--m-glass-border) 60%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--m-surface-alt, #fff) 38%, transparent);
  transition:
    grid-template-rows 360ms cubic-bezier(0.32, 0.72, 0, 1),
    background-color 180ms ease,
    border-radius 360ms cubic-bezier(0.32, 0.72, 0, 1);

  &.expanded {
    grid-template-rows: auto 1fr;
    border-radius: 18px;
    background: color-mix(in srgb, var(--accent-color) 8%, var(--m-surface-alt, #fff));
  }
}

.morph-action-shell > .morph-action-trigger {
  border: 0;
  background: transparent;
}

.morph-action-arrow {
  margin-left: auto;
  transition: transform 320ms cubic-bezier(0.32, 0.72, 0, 1);

  .morph-action-shell.expanded & {
    transform: rotate(180deg);
  }
}

.morph-action-options-wrap {
  min-height: 0;
  overflow: hidden;
}

.morph-action-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  padding: 0 6px 6px;
  opacity: 0;
  transform: translate3d(0, -5px, 0);
  transition:
    opacity 180ms ease,
    transform 320ms cubic-bezier(0.32, 0.72, 0, 1);

  .morph-action-shell.expanded & {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }

  button {
    min-height: 38px;
    padding-inline: 9px;
    border-radius: 11px;
    font-size: 12px;
  }
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
  min-height: 48px;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--m-glass-border) 60%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--m-surface-alt, #fff) 38%, transparent);
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
    background: color-mix(in srgb, var(--accent-color) 14%, var(--m-surface-alt, #fff));
    color: var(--accent-color);
  }
}

.morph-group {
  gap: 5px;
}

.morph-group + .morph-group,
.morph-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 0;
}

.search-filter-options {
  gap: 5px;

  button {
    min-height: 38px;
    padding-inline: 9px;
    font-size: 12px;
  }
}

.morph-dismiss-layer {
  position: fixed;
  inset: 0;
  z-index: 299;
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

.morph-search {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding: 0 10px;
  border: 1px solid var(--cover-border, rgba(128, 128, 128, 0.12));
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent-color) 8%, transparent);

  i {
    color: var(--cover-text-muted, #9a9590);
  }

  input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--cover-text-primary, var(--text-color));
    font-size: 13px;
  }
}

.topbar-search-pill.search-circle {
  flex: 0 0 40px;
  width: 40px;
  padding: 0;
  justify-content: center;

  .search-input,
  .clear-icon {
    display: none;
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

.search-filter-heading {
  color: var(--cover-text-muted, #9a9590);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.search-filter-options button :deep(.platform-logo) {
  flex: 0 0 auto;
  color: currentColor;
}

.search-filter-options button.search-source-option {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 18px;

  > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.search-filter-options button small {
  color: var(--cover-text-muted, #9a9590);
  font-size: 10px;
}

.search-assist-item--setting {
  grid-template-columns: 52px minmax(0, 1fr) 20px;
}

.settings-assist-section {
  align-self: start;
  margin-top: 13px;
  color: var(--accent-color, #888);
  font-size: 10px;
  font-weight: 700;
}

.settings-assist-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 13px;
    font-weight: 650;
  }

  small {
    color: var(--cover-text-muted, #9a9590);
    font-size: 11px;
  }
}

.topbar-search-pill,
.topbar-action-pill {
  transform-origin: center right;
  transition:
    opacity 180ms ease,
    transform 340ms cubic-bezier(0.32, 0.72, 0, 1),
    background 180ms ease,
    border-color 180ms ease;
}

.floating-topbar.menu-expanded {
  z-index: 300;

  .topbar-search-pill,
  .topbar-search-morph,
  .topbar-action-pill {
    opacity: 0;
    transform: translate3d(12px, 0, 0) scale(0.94);
    pointer-events: none;
  }
}

.topbar-search-morph {
  transform-origin: top right;
  transition:
    width 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    max-width 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    max-height 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    min-height 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    border-radius 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    background-color 240ms ease,
    box-shadow 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.floating-topbar.filter-expanded {
  z-index: 300;
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
  .topbar-search-morph,
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
