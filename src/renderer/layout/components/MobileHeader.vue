<template>
  <div class="floating-topbar" :class="{ 'safe-area-top': hasSafeArea, 'is-search': isSearchPage }">
    <!-- 页面名 / 返回按钮 -->
    <div class="topbar-pill topbar-title-pill" :class="{ 'collapsed': isSearchPage || hasPageHero }" @click="onTitleClick">
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
        @keydown.enter="handleSearchSubmit"
      />
      <span v-else class="topbar-search-text">{{ t('comp.searchBar.searchPlaceholder') }}</span>
      <i v-if="isSearchPage && searchStore.searchValue" class="ri-close-circle-fill clear-icon" @click.stop="clearSearch"></i>
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
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { useUserStore } from '@/store/modules/user';
import { useSearchStore } from '@/store/modules/search';
import { getImgUrl } from '@/utils';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();
const searchStore = useSearchStore();

const hasSafeArea = inject('hasSafeArea', false);

const showBack = computed(() => route.meta.back === true);

const isSearchPage = computed(() =>
  route.path === '/mobile-search' || route.path === '/mobile-search-result'
);

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
  const url = userStore.user?.avatarUrl;
  return url ? getImgUrl(url, '72y72') : '';
});

const searchInputRef = ref<HTMLInputElement | null>(null);

// Focus search input when entering search page
watch(isSearchPage, (val) => {
  if (val && route.path === '/mobile-search') {
    nextTick(() => {
      setTimeout(() => searchInputRef.value?.focus(), 300);
    });
  }
});

// Sync search value from URL on search result page
watch(() => route.query.keyword, (keyword) => {
  if (route.path === '/mobile-search-result' && typeof keyword === 'string') {
    searchStore.setSearchValue(keyword);
  }
}, { immediate: true });

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
};

const clearSearch = () => {
  searchStore.setSearchValue('');
};

const handleSearchSubmit = () => {
  const keyword = searchStore.searchValue.trim();
  if (!keyword) return;

  // Save to history
  try {
    const HISTORY_KEY = 'mobile_search_history';
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const filtered = history.filter((item: string) => item !== keyword);
    filtered.unshift(keyword);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, 20)));
  } catch { /* ignore */ }

  // Navigate to results
  router.push({
    path: '/mobile-search-result',
    query: { keyword, type: searchStore.searchType },
  });
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
  padding-top: var(--safe-area-inset-top, 0px);
  padding-top: calc(var(--safe-area-inset-top, 0px) + 8px);
  padding-bottom: 8px;
  pointer-events: none; /* allow scroll-through on gaps */
  transition: padding-top 0.3s ease;
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
  transition: transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1),
              background 0.4s ease, border-color 0.4s ease,
              max-width 0.45s cubic-bezier(0.32, 0.72, 0, 1),
              opacity 0.35s cubic-bezier(0.32, 0.72, 0, 1),
              padding 0.35s cubic-bezier(0.32, 0.72, 0, 1),
              flex 0.45s cubic-bezier(0.32, 0.72, 0, 1);
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
    transition: opacity 0.3s ease, width 0.3s ease;
  }

  &.collapsed .title-back-icon {
    opacity: 1;
    width: 22px;
  }
}

.topbar-title-text {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--cover-text-primary, var(--text-color));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 0.25s ease;
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

@media (prefers-reduced-motion: reduce) {
  .topbar-pill {
    transition: none;
  }
}
</style>
