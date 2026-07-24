<template>
  <div class="mobile-search-result">
    <!-- 搜索结果头部 -->
    <div class="result-header" :class="{ 'safe-area-top': hasSafeArea }">
      <div class="header-back" @click="goBack">
        <i class="ri-arrow-left-s-line"></i>
      </div>
      <div class="header-keyword">{{ keyword }}</div>
      <div class="header-actions">
        <div class="action-btn" @click="openSearch">
          <i class="ri-search-line"></i>
        </div>
      </div>
    </div>

    <!-- 搜索类型标签 -->
    <div class="search-types">
      <div
        v-for="type in searchTypes"
        :key="type.key"
        class="type-tag"
        :class="{ active: searchType === type.key }"
        @click="selectType(type.key)"
      >
        {{ type.label }}
      </div>
    </div>

    <!-- 来源筛选（仅歌曲搜索且有结果时） -->
    <div v-if="searchType === SEARCH_TYPE.MUSIC && results.length && sourceFilterOptions.length > 1" class="source-filter">
      <button
        v-for="opt in sourceFilterOptions"
        :key="opt.key"
        class="source-chip"
        :class="{ 'source-chip-active': activeSourceFilter === opt.key }"
        @click="activeSourceFilter = opt.key as any"
      >
        {{ opt.label }}
        <span class="opacity-60 ml-0.5">{{ opt.count }}</span>
      </button>
    </div>

    <!-- 搜索结果列表 -->
    <div class="result-content" @scroll="handleScroll">
      <!-- 加载中 -->
      <div v-if="loading && !results.length" class="loading-state">
        <n-spin size="medium" />
        <span class="ml-2">{{ t('search.loading.searching') }}</span>
      </div>

      <!-- 跨平台搜索加载提示 -->
      <div v-if="crossSearchLoading" class="cross-search-loading">
        <i class="ri-loader-4-line animate-spin"></i>
        <span>正在搜索其他音源...</span>
      </div>

      <!-- 搜索结果 -->
      <div v-else-if="results.length" class="result-list">
        <!-- 歌曲搜索 -->
<template v-if="searchType === SEARCH_TYPE.MUSIC">
<div
v-for="item in filteredResults"
:key="item.id"
class="song-item-wrapper"
>
<span
v-if="getSourceLabel(item.id)"
class="source-badge"
:style="getSourceBadgeStyle(item.id)"
>
{{ getSourceLabel(item.id) }}
</span>
<song-item
:item="item"
:is-next="true"
@play="handlePlay"
/>
</div>
</template>

        <!-- 专辑/歌单/MV 搜索 -->
        <template v-else>
          <search-item v-for="item in results" :key="item.id" :item="item" class="mb-3" />
        </template>

        <!-- 加载更多 -->
        <div v-if="isLoadingMore" class="loading-more">
          <n-spin size="small" />
          <span class="ml-2">{{ t('search.loading.more') }}</span>
        </div>

        <!-- 没有更多 -->
        <div v-if="!hasMore && results.length" class="no-more">
          {{ t('search.noMore') }}
        </div>
      </div>

      <!-- 无结果 -->
      <div v-else-if="!loading" class="empty-state">
        <i class="ri-search-line"></i>
        <span>{{ t('comp.musicList.noSearchResults') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { crossPlatformSearch } from '@/api/crossPlatformSearch';
import { getSearch } from '@/api/search';
import SearchItem from '@/components/common/SearchItem.vue';
import SongItem from '@/components/common/SongItem.vue';
import { SEARCH_TYPE, SEARCH_TYPES } from '@/const/bar-const';
import {
  getCachedLabel,
  quickClassify,
  setLabel,
  SOURCE_LABEL_CONFIG,
  type SourceLabel
} from '@/services/sourceProbeService';
import { usePlayerStore } from '@/store/modules/player';
import { useSearchStore } from '@/store/modules/search';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const searchStore = useSearchStore();

// 注入是否有安全区域
const hasSafeArea = inject('hasSafeArea', false);

// 搜索关键词
const keyword = ref((route.query.keyword as string) || '');

// 搜索类型
const searchType = ref(Number(route.query.type) || searchStore.searchType || 1);
const searchTypes = computed(() => {
  locale.value;
  return SEARCH_TYPES.map((type) => ({
    label: t(type.label),
    key: type.key
  }));
});

// 搜索结果
const results = ref<any[]>([]);
const loading = ref(false);
const crossSearchLoading = ref(false);

// 来源筛选
const activeSourceFilter = ref<SourceLabel | 'all'>('all');
const sourceLabelVersion = ref(0);

function classifySongs(songs: any[]) {
  for (const song of songs) {
    const label = quickClassify(song);
    setLabel(String(song.id), label);
  }
  sourceLabelVersion.value++;
}

function getSourceLabel(songId: string | number): string | null {
  sourceLabelVersion.value;
  const label = getCachedLabel(String(songId));
  if (!label || label === 'pending') return null;
  return SOURCE_LABEL_CONFIG[label]?.text || null;
}

function getSourceBadgeStyle(songId: string | number): Record<string, string> {
  const label = getCachedLabel(String(songId));
  if (!label) return {};
  const cfg = SOURCE_LABEL_CONFIG[label];
  if (!cfg) return {};
  return { color: cfg.color, background: cfg.bg };
}

const sourceFilterOptions = computed(() => {
  sourceLabelVersion.value;
  const counts: Record<string, number> = {};
  for (const song of results.value) {
    const label = getCachedLabel(String(song.id));
    if (label && label !== 'pending') {
      counts[label] = (counts[label] || 0) + 1;
    }
  }
  const options = [{ key: 'all', label: '全部', count: results.value.length }];
  for (const [key, count] of Object.entries(counts)) {
    const cfg = SOURCE_LABEL_CONFIG[key as SourceLabel];
    if (cfg) {
      options.push({ key, label: cfg.text, count });
    }
  }
  return options;
});

const filteredResults = computed(() => {
  sourceLabelVersion.value;
  if (activeSourceFilter.value === 'all') return results.value;
  return results.value.filter(
    (song) => getCachedLabel(String(song.id)) === activeSourceFilter.value
  );
});

// 分页
const ITEMS_PER_PAGE = 30;
const page = ref(1);
const hasMore = ref(true);
const isLoadingMore = ref(false);

// 执行搜索
const performSearch = async (isLoadMore = false) => {
  if (!keyword.value) return;

  if (isLoadMore) {
    if (!hasMore.value || isLoadingMore.value) return;
    isLoadingMore.value = true;
  } else {
    loading.value = true;
    results.value = [];
    page.value = 1;
    hasMore.value = true;
  }

  try {
    // 歌曲搜索
    if (searchType.value === SEARCH_TYPE.MUSIC) {
      const { data } = await getSearch({
        keywords: keyword.value,
        type: searchType.value,
        limit: ITEMS_PER_PAGE,
        offset: (page.value - 1) * ITEMS_PER_PAGE
      });

      const songs = (data.result.songs || []).map((item: any) => ({
        ...item,
        picUrl: item.al?.picUrl,
        artists: item.ar
      }));

      if (isLoadMore) {
        results.value = [...results.value, ...songs];
      } else {
        results.value = songs;
      classifySongs(songs);
      }

      hasMore.value = songs.length === ITEMS_PER_PAGE;

      // 第一页时触发跨平台搜索
      if (!isLoadMore) {
        triggerCrossSearch(keyword.value, songs);
      }
    }
    // 专辑搜索
    else if (searchType.value === SEARCH_TYPE.ALBUM) {
      const { data } = await getSearch({
        keywords: keyword.value,
        type: searchType.value,
        limit: ITEMS_PER_PAGE,
        offset: (page.value - 1) * ITEMS_PER_PAGE
      });

      const albums = (data.result.albums || []).map((item: any) => ({
        ...item,
        desc: `${item.artist?.name || ''} ${item.company || ''}`,
        type: 'album'
      }));

      if (isLoadMore) {
        results.value = [...results.value, ...albums];
      } else {
        results.value = albums;
      }

      hasMore.value = albums.length === ITEMS_PER_PAGE;
    }
    // 歌单搜索
    else if (searchType.value === SEARCH_TYPE.PLAYLIST) {
      const { data } = await getSearch({
        keywords: keyword.value,
        type: searchType.value,
        limit: ITEMS_PER_PAGE,
        offset: (page.value - 1) * ITEMS_PER_PAGE
      });

      const playlists = (data.result.playlists || []).map((item: any) => ({
        ...item,
        picUrl: item.coverImgUrl,
        playCount: item.playCount,
        desc: item.creator?.nickname || '',
        type: 'playlist'
      }));

      if (isLoadMore) {
        results.value = [...results.value, ...playlists];
      } else {
        results.value = playlists;
      }

      hasMore.value = playlists.length === ITEMS_PER_PAGE;
    }
    // MV 搜索
    else if (searchType.value === SEARCH_TYPE.MV) {
      const { data } = await getSearch({
        keywords: keyword.value,
        type: searchType.value,
        limit: ITEMS_PER_PAGE,
        offset: (page.value - 1) * ITEMS_PER_PAGE
      });

      const mvs = (data.result.mvs || []).map((item: any) => ({
        ...item,
        picUrl: item.cover,
        playCount: item.playCount,
        desc: item.artists?.map((artist: any) => artist.name).join('/') || '',
        type: 'mv'
      }));

      if (isLoadMore) {
        results.value = [...results.value, ...mvs];
      } else {
        results.value = mvs;
      }

      hasMore.value = mvs.length === ITEMS_PER_PAGE;
    }

    page.value++;
  } catch (error) {
    console.error('搜索失败:', error);
  } finally {
    loading.value = false;
    isLoadingMore.value = false;
  }
};

// 跨平台补充搜索
const triggerCrossSearch = async (kw: string, neteaseSongs: any[]) => {
  crossSearchLoading.value = true;
  try {
    const existingSongs = neteaseSongs.map((s: any) => ({
      ...s,
      ar: s.artists || s.ar,
      name: s.name,
      id: String(s.id)
    }));
    const crossResults = await crossPlatformSearch(kw, existingSongs);
    if (crossResults.length > 0) {
      results.value = [...results.value, ...crossResults];
      classifySongs(crossResults);
    }
  } catch (e) {
    console.error('[跨平台搜索失败]:', e);
  } finally {
    crossSearchLoading.value = false;
  }
};

// 选择搜索类型
const selectType = (type: number) => {
  if (searchType.value === type) return;

  searchType.value = type;
  searchStore.searchType = type;

  // 更新路由查询参数
  router.replace({
    query: {
      ...route.query,
      type: type.toString()
    }
  });

  performSearch();
};

// 滚动加载更多
const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  const { scrollTop, scrollHeight, clientHeight } = target;

  if (scrollTop + clientHeight >= scrollHeight - 100) {
    performSearch(true);
  }
};

// 播放音乐
const handlePlay = (item: any) => {
  playerStore.addToNextPlay(item);
};

// 返回
const goBack = () => {
  router.back();
};

// 打开搜索
const openSearch = () => {
  router.push('/mobile-search');
};

// 监听路由变化
watch(
  () => route.query,
  (query) => {
    if (route.path === '/mobile-search-result' && query.keyword) {
      keyword.value = query.keyword as string;
      searchType.value = Number(query.type) || searchStore.searchType || 1;
      performSearch();
    }
  }
);

onMounted(() => {
  if (keyword.value) {
    performSearch();
  }
});
</script>

<style lang="scss" scoped>
.mobile-search-result {
  @apply fixed inset-0;
  @apply bg-light dark:bg-black;
  @apply flex flex-col;
}

.result-header {
  @apply flex items-center gap-3 px-4 py-3;
  @apply border-b border-gray-100 dark:border-gray-800;

  &.safe-area-top {
    padding-top: calc(var(--safe-area-inset-top, 0px) + 12px);
  }
}

.header-back {
  @apply flex items-center justify-center;
  @apply w-10 h-10 rounded-full text-xl;
  @apply text-gray-600 dark:text-gray-300;
  @apply active:bg-gray-100 dark:active:bg-gray-800;
}

.header-keyword {
  @apply flex-1 text-base font-medium;
  @apply text-gray-900 dark:text-white;
  @apply truncate;
}

.header-actions {
  @apply flex items-center gap-2;
}

.action-btn {
  @apply flex items-center justify-center;
  @apply w-10 h-10 rounded-full text-xl;
  @apply text-gray-600 dark:text-gray-300;
  @apply active:bg-gray-100 dark:active:bg-gray-800;
}

.search-types {
  @apply flex gap-2 px-4 py-3 overflow-x-auto;
  @apply border-b border-gray-100 dark:border-gray-800;

  &::-webkit-scrollbar {
    display: none;
  }
}

.type-tag {
  @apply px-4 py-1.5 rounded-full text-sm whitespace-nowrap;
  @apply bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300;
  @apply transition-colors duration-200;

  &.active {
    @apply bg-[var(--accent-color)] text-white;
  }
}

.result-content {
  @apply flex-1 overflow-y-auto;
}

.loading-state {
@apply flex flex-col items-center justify-center py-20;
@apply text-gray-500 dark:text-gray-400;
}

.cross-search-loading {
@apply flex items-center justify-center gap-2 py-3;
@apply text-xs;
color: var(--accent-color, #6366f1);

i {
font-size: 14px;
}
}

.source-filter {
@apply flex items-center gap-1.5 flex-wrap px-4 py-2;
}

.source-chip {
@apply px-2.5 py-1 rounded-full text-xs font-medium transition-colors;
@apply bg-white/5 text-white/60;
}

.source-chip-active {
@apply text-white;
background: var(--accent-color, #6366f1);
}

.song-item-wrapper {
@apply relative;
}

.source-badge {
@apply absolute right-2 top-2 z-10 px-1.5 py-0.5 rounded text-[10px] font-medium pointer-events-none;
}

.result-list {
  @apply pb-20;
}

.loading-more {
  @apply flex justify-center items-center py-4;
  @apply text-gray-500 dark:text-gray-400;
}

.no-more {
  @apply text-center py-4;
  @apply text-gray-500 dark:text-gray-400;
}

.empty-state {
  @apply flex flex-col items-center justify-center py-20;
  @apply text-gray-400 dark:text-gray-500;

  i {
    @apply text-6xl mb-4;
  }
}
</style>
