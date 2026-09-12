<template>
  <div class="mobile-search-page">
    <!-- 搜索内容区域 -->
    <div class="search-content">
      <!-- 搜索历史 -->
      <div v-if="searchHistory.length > 0" class="search-section">
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
              <!-- 接口图片替换为随强调色染色的 SVG:5=爆,1=上升 -->
              <svg
                v-if="item.iconType === 5"
                class="hot-svg"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <text
                  x="12"
                  y="17.5"
                  text-anchor="middle"
                  font-size="15"
                  font-weight="700"
                  fill="currentColor"
                >
                  爆
                </text>
              </svg>
              <svg
                v-else-if="item.iconType === 1"
                class="hot-svg"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.59 5.58L20 12l-8-8-8 8z"
                />
              </svg>
              <svg v-else class="hot-svg" viewBox="0 0 24 24" aria-hidden="true">
                <text
                  x="12"
                  y="17.5"
                  text-anchor="middle"
                  font-size="15"
                  font-weight="700"
                  fill="currentColor"
                >
                  爆
                </text>
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getHotSearch, getSearchKeyword } from '@/api/home';
import { useSearchStore } from '@/store/modules/search';

const { t } = useI18n();
const router = useRouter();
const searchStore = useSearchStore();

// 搜索类型

// 搜索建议
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

// 选择建议
const selectSuggestion = (keyword: string) => {
  searchStore.setSearchValue(keyword);
  // Save to history
  try {
    const history = searchHistory.value.filter((item) => item !== keyword);
    history.unshift(keyword);
    searchHistory.value = history.slice(0, 20);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value));
  } catch {
    /* ignore */
  }

  router.push({
    path: '/mobile-search-result',
    query: { keyword, type: searchStore.searchType }
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
  padding-top: var(--mobile-topbar-inset);
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
    color: var(--accent-color, #888);
  }
}

.hot-word {
  @apply flex-1 text-gray-700 dark:text-gray-200;
}

.hot-icon {
  img {
    @apply h-4;
  }

.hot-svg {
  width: 15px;
  height: 15px;
  color: var(--accent-color, #888);
}
}
</style>
