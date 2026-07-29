<template>
  <div class="mobile-search-page">
    <!-- 搜索类型标签 -->
    <GlowTabs
      :model-value="String(searchType)"
      :tabs="searchTypes.map(t => ({ key: String(t.key), label: t.label }))"
      scrollable
      class="search-types-glow"
      @update:model-value="(v) => selectType(Number(v))"
    />

    <!-- 搜索内容区域 -->
    <div class="search-content">
      <!-- 搜索建议 -->
      <div v-if="suggestions.length > 0" class="search-section">
        <div class="section-title">{{ t('search.suggestions') }}</div>
        <div class="suggestion-list">
          <div
            v-for="(item, index) in suggestions"
            :key="index"
            class="suggestion-item"
            @click="selectSuggestion(item)"
          >
            <i class="ri-search-line"></i>
            <span>{{ item }}</span>
          </div>
        </div>
      </div>

      <!-- 搜索历史 -->
      <div v-else-if="searchHistory.length > 0" class="search-section">
        <div class="section-header">
          <span class="section-title">{{ t('search.history') }}</span>
          <span class="clear-history" @click="clearHistory">{{ t('common.clear') }}</span>
        </div>
        <div class="history-tags">
          <div
            v-for="(item, index) in searchHistory"
            :key="index"
            class="history-tag"
            @click="selectSuggestion(item)"
          >
            {{ item }}
          </div>
        </div>
      </div>

      <!-- 热门搜索 -->
      <div v-if="hotSearchList.length > 0 && !searchStore.searchValue" class="search-section">
        <div class="section-title">{{ t('search.hot') }}</div>
        <div class="hot-list">
          <div
            v-for="(item, index) in hotSearchList"
            :key="index"
            class="hot-item"
            @click="selectSuggestion(item.searchWord)"
          >
            <span class="hot-rank" :class="{ top: index < 3 }">{{ index + 1 }}</span>
            <span class="hot-word">{{ item.searchWord }}</span>
            <span v-if="item.iconUrl" class="hot-icon">
              <img :src="item.iconUrl" alt="" />
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getHotSearch, getSearchKeyword } from '@/api/home';
import { getSearchSuggestions } from '@/api/search';
import GlowTabs from '@/components/common/GlowTabs.vue';
import { SEARCH_TYPES } from '@/const/bar-const';
import { useSearchStore } from '@/store/modules/search';

const { t, locale } = useI18n();
const router = useRouter();
const searchStore = useSearchStore();

// 搜索类型
const searchType = ref(searchStore.searchType || 1);
const searchTypes = computed(() => {
  locale.value;
  return SEARCH_TYPES.map((type) => ({
    label: t(type.label),
    key: type.key
  }));
});

// 搜索建议
const suggestions = ref<string[]>([]);

// 搜索历史
const HISTORY_KEY = 'mobile_search_history';
const searchHistory = ref<string[]>([]);

// 热门搜索
const hotSearchList = ref<any[]>([]);

// 加载热门搜索关键词
const loadHotSearchKeyword = async () => {
  try {
    const { data } = await getSearchKeyword();
    searchStore.setPlaceholder(data.data.showKeyword);
  } catch (e) {
    console.error('加载热门搜索关键词失败:', e);
  }
};

// 加载热门搜索列表
const loadHotSearchList = async () => {
  try {
    const { data } = await getHotSearch();
    hotSearchList.value = data.data || [];
  } catch (e) {
    console.error('加载热门搜索失败:', e);
  }
};

// 加载搜索历史
const loadSearchHistory = () => {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    searchHistory.value = history ? JSON.parse(history) : [];
  } catch (e) {
    console.error('加载搜索历史失败:', e);
    searchHistory.value = [];
  }
};

// 清除搜索历史
const clearHistory = () => {
  searchHistory.value = [];
  localStorage.removeItem(HISTORY_KEY);
};

// 获取搜索建议（防抖）
const debouncedGetSuggestions = useDebounceFn(async (keyword: string) => {
  if (!keyword.trim()) {
    suggestions.value = [];
    return;
  }
  suggestions.value = await getSearchSuggestions(keyword);
}, 300);

// Watch search store value for suggestions
watch(() => searchStore.searchValue, (val) => {
  debouncedGetSuggestions(val);
});

// 选择搜索类型
const selectType = (type: number) => {
  searchType.value = type;
  searchStore.setSearchType(type);
};

// 选择建议
const selectSuggestion = (keyword: string) => {
  searchStore.setSearchValue(keyword);
  // Save to history
  try {
    const history = searchHistory.value.filter((item) => item !== keyword);
    history.unshift(keyword);
    searchHistory.value = history.slice(0, 20);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value));
  } catch { /* ignore */ }

  router.push({
    path: '/mobile-search-result',
    query: { keyword, type: searchType.value }
  });
};

onMounted(() => {
  loadHotSearchKeyword();
  loadHotSearchList();
  loadSearchHistory();
});
</script>

<style lang="scss" scoped>
.mobile-search-page {
  @apply fixed inset-0 z-50;
  @apply flex flex-col;
  background: var(--m-bg, var(--bg-color));
  padding-top: calc(var(--safe-area-inset-top, 0px) + 56px);
}

.search-types-glow {
  margin: 8px 16px 4px;
}

.search-content {
  @apply flex-1 overflow-y-auto px-4 py-3;
}

.search-section {
  @apply mb-6;
}

.section-header {
  @apply flex items-center justify-between mb-3;
}

.section-title {
  @apply text-sm font-medium mb-3;
  color: var(--m-text-muted, #9a9590);
}

.clear-history {
  @apply text-sm;
  color: var(--m-text-muted, #9a9590);
}

.suggestion-list {
  @apply space-y-1;
}

.suggestion-item {
  @apply flex items-center gap-3 py-3;
  color: var(--m-text-primary, #2c2c2c);
  transition: background var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

  &:active {
    background: var(--m-surface, rgba(0, 0, 0, 0.03));
  }

  i {
    color: var(--m-text-muted, #9a9590);
  }
}

.history-tags {
  @apply flex flex-wrap gap-2;
}

.history-tag {
  @apply px-3 py-1.5 rounded-full text-sm;
  background: var(--m-surface, #eae6df);
  color: var(--m-text-secondary, #6b6560);
  transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

  &:active {
    transform: scale(0.97);
    background: var(--m-surface-alt, #e0dbd3);
  }
}

.hot-list {
  @apply space-y-1;
}

.hot-item {
  @apply flex items-center gap-3 py-2.5;
  transition: background var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

  &:active {
    background: var(--m-surface, rgba(0, 0, 0, 0.03));
  }
}

.hot-rank {
  @apply w-5 text-center text-sm font-medium;
  color: var(--m-text-muted, #9a9590);

  &.top {
    @apply text-red-500;
  }
}

.hot-word {
  @apply flex-1 text-gray-700 dark:text-gray-200;
}

.hot-icon {
  img {
    @apply h-4;
  }
}
</style>
