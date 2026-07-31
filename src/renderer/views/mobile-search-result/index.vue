<template>
  <div class="mobile-search-result">
    <!-- 搜索类型标签 -->
    <glow-tabs
      :model-value="String(searchType)"
      :tabs="searchTypes.map((t) => ({ key: String(t.key), label: t.label }))"
      scrollable
      class="search-types-glow"
      @update:model-value="(v) => selectType(Number(v))"
    />

    <!-- 来源筛选（仅歌曲搜索且有结果时） -->
    <div
      v-if="searchType === SEARCH_TYPE.MUSIC && results.length && sourceFilterOptions.length > 1"
      class="source-filter-wrap"
    >
      <glow-tabs
        :model-value="String(activeSourceFilter)"
        :tabs="
          sourceFilterOptions.map((opt) => ({
            key: String(opt.key),
            label: `${opt.label} ${opt.count}`
          }))
        "
        scrollable
        class="source-filter-glow"
        @update:model-value="(v) => (activeSourceFilter = v as any)"
      />
    </div>

    <!-- 搜索结果列表 -->
    <div class="result-content" @scroll="handleScroll">
      <!-- 加载中 -->
      <div v-if="loading && !results.length && !artistResults.length" class="loading-state">
        <n-spin size="medium" />
        <span class="ml-2">{{ t('search.loading.searching') }}</span>
      </div>

      <!-- 跨平台搜索加载提示（独立显示，不隐藏已有结果） -->
      <div v-if="crossSearchLoading" class="cross-search-loading">
        <i class="ri-loader-4-line animate-spin"></i>
        <span>正在搜索其他音源...</span>
      </div>

      <!-- 搜索结果 -->
      <div v-if="results.length || artistResults.length" class="result-list">
        <!-- 歌曲搜索 -->
        <template v-if="searchType === SEARCH_TYPE.MUSIC">
          <div v-for="item in filteredResults" :key="item.id" class="song-item-wrapper">
            <span
              v-if="getSourceLabel(item.id)"
              class="source-badge"
              :style="getSourceBadgeStyle(item.id)"
            >
              {{ getSourceLabel(item.id) }}
            </span>
            <song-item :item="item" :is-next="true" @play="handlePlay" />
          </div>
        </template>

        <!-- 歌手搜索 -->
        <template v-if="searchType === SEARCH_TYPE.ARTIST">
          <div v-if="artistResults.length" class="artist-list">
            <div
              v-for="(item, index) in artistResults"
              :key="item.id"
              class="artist-item"
              @click="goToArtist(item.id)"
            >
              <div class="artist-avatar">
                <n-image
                  :src="getImgUrl(item.picUrl || item.img1v1Url, '200y200')"
                  lazy
                  preview-disabled
                  class="w-full h-full object-cover rounded-full"
                />
              </div>
              <div class="artist-info">
                <div class="artist-name-row">
                  <span class="artist-name">{{ item.name }}</span>
                  <span v-if="index === 0 && item.matchedSong" class="artist-badge">
                    演唱过《{{ item.matchedSong }}》
                  </span>
                </div>
                <div class="artist-meta">
                  <span v-if="item.musicSize" class="meta-item">{{ item.musicSize }}首单曲</span>
                  <span v-if="item.albumSize" class="meta-item">{{ item.albumSize }}张专辑</span>
                </div>
              </div>
              <i class="ri-arrow-right-s-line artist-arrow"></i>
            </div>
          </div>
        </template>

        <!-- 专辑/歌单/MV 搜索 -->
        <template v-else-if="searchType !== SEARCH_TYPE.MUSIC">
          <search-item v-for="item in results" :key="item.id" :item="item" class="mb-3" />
        </template>

        <!-- 加载更多 -->
        <div v-if="isLoadingMore" class="loading-more">
          <n-spin size="small" />
          <span class="ml-2">{{ t('search.loading.more') }}</span>
        </div>

        <!-- 没有更多 -->
        <div v-if="!hasMore && (results.length || artistResults.length)" class="no-more">
          {{ t('search.noMore') }}
        </div>
      </div>

      <!-- 无结果 -->
      <div v-else-if="!loading && !results.length && !artistResults.length" class="empty-state">
        <i class="ri-search-line"></i>
        <span>{{ t('comp.musicList.noSearchResults') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { crossPlatformSearch } from '@/api/crossPlatformSearch';
import { getSearch } from '@/api/search';
import { searchServerSongs, type ServerSong } from '@/api/serverSongs';
import GlowTabs from '@/components/common/GlowTabs.vue';
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
import type { Artist, SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const searchStore = useSearchStore();

// 搜索关键词
const keyword = ref((route.query.keyword as string) || '');

// 歌手搜索结果
const artistResults = ref<any[]>([]);

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
  let list = results.value;
  if (activeSourceFilter.value !== 'all') {
    list = list.filter((song) => getCachedLabel(String(song.id)) === activeSourceFilter.value);
  }
  return list;
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
    artistResults.value = [];
    page.value = 1;
    hasMore.value = true;
    activeSourceFilter.value = 'all';
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

      // 第一页时触发跨平台搜索和云端搜索
      if (!isLoadMore) {
        triggerCrossSearch(keyword.value, songs);
        triggerServerSearch(keyword.value, songs);
      }
    }
    // 歌手搜索
    else if (searchType.value === SEARCH_TYPE.ARTIST) {
      // 先搜索歌曲，拿到最匹配歌曲的歌手信息
      let topSongArtist: { id: number; name: string; songName: string } | null = null;
      try {
        const songRes = await getSearch({
          keywords: keyword.value,
          type: SEARCH_TYPE.MUSIC,
          limit: 1,
          offset: 0
        });
        const topSong = songRes.data?.result?.songs?.[0];
        if (topSong) {
          const firstArtist = topSong.ar?.[0] || topSong.artists?.[0];
          if (firstArtist) {
            topSongArtist = {
              id: firstArtist.id,
              name: firstArtist.name,
              songName: topSong.name
            };
          }
        }
      } catch (e) {
        console.error('[歌曲搜索失败]:', e);
      }

      // 搜索歌手
      const { data } = await getSearch({
        keywords: keyword.value,
        type: searchType.value,
        limit: ITEMS_PER_PAGE,
        offset: (page.value - 1) * ITEMS_PER_PAGE
      });

      const artists = (data.result?.artists || []).map((item: any) => ({
        ...item,
        type: 'artist'
      }));

      // 如果有最匹配歌曲的歌手，将其提到第一位并标注
      if (topSongArtist) {
        const idx = artists.findIndex((a: any) => a.id === topSongArtist!.id);
        if (idx >= 0) {
          // 已在列表中，移动到第一位并标注
          const [found] = artists.splice(idx, 1);
          found.matchedSong = topSongArtist.songName;
          artists.unshift(found);
        } else {
          // 不在搜索结果中，插入到第一位
          artists.unshift({
            id: topSongArtist.id,
            name: topSongArtist.name,
            matchedSong: topSongArtist.songName,
            type: 'artist'
          });
        }
      }

      if (isLoadMore) {
        artistResults.value = [...artistResults.value, ...artists];
      } else {
        artistResults.value = artists;
      }

      hasMore.value = artists.length === ITEMS_PER_PAGE;
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

/**
 * 将 ServerSong 转换为 SongResult 格式
 */
function convertServerSongToSongResult(s: ServerSong): SongResult {
  const artists: Artist[] = s.artists.map((name, idx) => ({
    name,
    id: idx,
    picId: 0,
    img1v1Id: 0,
    briefDesc: '',
    picUrl: '',
    img1v1Url: '',
    albumSize: 0,
    alias: [],
    trans: '',
    musicSize: 0,
    topicPerson: 0
  }));

  const album = {
    name: s.album || '',
    id: 0,
    type: '',
    size: 0,
    picId: 0,
    blurPicUrl: '',
    companyId: 0,
    pic: 0,
    picUrl: s.picUrl || '',
    publishTime: 0,
    description: '',
    tags: '',
    company: '',
    briefDesc: '',
    artist: artists[0] || ({} as Artist),
    songs: [],
    alias: [],
    status: 0,
    copyrightId: 0,
    commentThreadId: '',
    artists,
    subType: '',
    transName: null,
    onSale: false,
    mark: 0,
    picId_str: ''
  };

  return {
    id: `server:${s.id}`,
    name: s.name,
    picUrl: s.picUrl,
    ar: artists,
    artists,
    al: album,
    album,
    count: s.duration,
    dt: s.duration,
    platform: 'server',
    platformId: s.id,
    playMusicUrl: s.audioUrl,
    source: 'netease' as any
  };
}

// Zephyrus 云端歌曲搜索
const triggerServerSearch = async (kw: string, existingSongs: any[]) => {
  try {
    const serverSongs = await searchServerSongs(kw, 20);
    if (serverSongs.length === 0) return;

    // 转换为 SongResult
    const songResults = serverSongs.map(convertServerSongToSongResult);

    // 去重（与已有结果合并）
    const existingKeys = new Set(
      existingSongs.map((s: any) =>
        `${(s.name || '').toLowerCase()}|${(s.ar || s.artists || []).map((a: any) => a.name).join(',')}`.toLowerCase()
      )
    );
    const deduped = songResults.filter(
      (s) =>
        !existingKeys.has(
          `${(s.name || '').toLowerCase()}|${s.ar?.map((a) => a.name).join(',')}`.toLowerCase()
        )
    );

    if (deduped.length > 0) {
      results.value = [...results.value, ...deduped];
      classifySongs(deduped);
    }
  } catch (e) {
    console.error('[云端歌曲搜索失败]:', e);
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
  playerStore.setPlayList(filteredResults.value);
  playerStore.setPlay(item);
};

// 跳转歌手详情
const goToArtist = (id: number) => {
  router.push({ name: 'artistDetail', params: { id } });
};

// 监听路由变化
watch(
  () => route.query,
  (query) => {
    if (route.path === '/mobile-search-result' && query.keyword) {
      keyword.value = query.keyword as string;
      searchStore.setSearchValue(keyword.value);
      searchType.value = Number(query.type) || searchStore.searchType || 1;
      performSearch();
    }
  }
);

onMounted(() => {
  searchStore.setSearchValue(keyword.value);
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
  padding-top: calc(var(--safe-area-inset-top, 0px) + 56px);
}

.search-types-glow {
  margin: 8px 16px 4px;
}

.source-filter-wrap {
  padding: 0 16px 4px;
}

.source-filter-glow {
  margin: 0;
}

.result-content {
  @apply flex-1 overflow-y-auto;
}

.loading-state {
  @apply flex flex-col items-center justify-center;
  @apply h-full py-20;
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

.song-item-wrapper {
  @apply relative;
}

.source-badge {
  @apply absolute right-12 top-2 z-10 px-1.5 py-0.5 rounded text-[10px] font-medium pointer-events-none;
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

.artist-list {
  @apply px-4 py-2;
}

.artist-item {
  @apply flex items-center gap-3 py-3 cursor-pointer;
  @apply transition-colors duration-200;
  @apply active:bg-gray-50 dark:active:bg-gray-800/50;
  @apply rounded-xl px-2;
}

.artist-avatar {
  @apply w-14 h-14 rounded-full overflow-hidden flex-shrink-0;
  @apply bg-gray-100 dark:bg-gray-800;
}

.artist-info {
  @apply flex-1 min-w-0;
}

.artist-name-row {
  @apply flex items-center gap-2 flex-wrap;
}

.artist-name {
  @apply text-base font-medium;
  @apply text-gray-900 dark:text-white;
}

.artist-badge {
  @apply text-xs px-2 py-0.5 rounded-full;
  background: color-mix(in srgb, var(--accent-color, #6366f1) 10%, transparent);
  color: var(--accent-color, #6366f1);
}

.artist-meta {
  @apply flex items-center gap-3 mt-1;
}

.meta-item {
  @apply text-xs;
  color: var(--m-text-muted, #9a9590);
}

.artist-arrow {
  @apply text-xl flex-shrink-0;
  color: var(--m-text-muted, #9a9590);
}
</style>
