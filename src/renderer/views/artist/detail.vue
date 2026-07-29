<template>
  <div
    class="artist-detail-page h-full w-full bg-white dark:bg-neutral-900 transition-colors duration-500"
  >
    <n-scrollbar ref="scrollbarRef" class="h-full" @scroll="handleScroll">
      <div class="artist-detail-content w-full pb-32" style="padding-top: calc(var(--safe-area-inset-top, 0px) + 56px);">
        <!-- Loading State -->
        <div v-if="loading" class="artist-content">
          <!-- Hero Skeleton -->
          <div class="hero-section relative h-[400px] overflow-hidden rounded-tl-2xl">
            <div class="hero-bg absolute inset-0 -top-20">
              <div class="absolute inset-0 skeleton-shimmer" />
            </div>
            <div class="hero-content relative z-10 px-4 pb-6 pt-4 md:px-8 md:pt-8">
              <div class="flex flex-col items-center gap-6 md:flex-row md:items-end md:gap-10">
                <div
                  class="h-36 w-36 md:h-48 md:w-48 skeleton-shimmer rounded-full flex-shrink-0"
                />
                <div class="flex-1 space-y-4 text-center md:text-left">
                  <div class="h-6 w-20 skeleton-shimmer rounded-full" />
                  <div class="h-10 w-1/2 md:h-12 skeleton-shimmer rounded-xl" />
                  <div class="flex justify-center gap-4 md:justify-start">
                    <div class="h-6 w-24 skeleton-shimmer rounded-lg" />
                    <div class="h-6 w-24 skeleton-shimmer rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Content Skeleton -->
          <div class="mt-8 page-padding-x">
            <div class="space-y-4">
              <div v-for="i in 8" :key="i" class="flex items-center gap-4">
                <div class="h-12 w-12 skeleton-shimmer rounded-xl flex-shrink-0" />
                <div class="flex-1 space-y-2">
                  <div class="h-4 w-1/3 skeleton-shimmer rounded-lg" />
                  <div class="h-3 w-1/4 skeleton-shimmer rounded-lg" />
                </div>
                <div class="h-8 w-8 skeleton-shimmer rounded-full flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div v-else-if="artistInfo" class="artist-content">
          <!--
            Hero Zone — 歌手信息+控制合为一体（和 MusicListPage 相同的形变模式）
            展开态: 封面/名/统计/控制 纵向
            收缩态: 封面/名  控制  横向单行
          -->
          <section class="hero-zone" :class="{ compact: isCompact }">
            <!-- 封面 -->
            <div class="cover-wrap">
              <img
                :src="getImgUrl(artistInfo.cover || artistInfo.picUrl, '500y500')"
                :alt="artistInfo.name"
                class="cover-img"
                draggable="false"
              />
            </div>

            <!-- 文字区 -->
            <div class="hero-text">
              <h1 ref="titleElRef" class="hero-title">{{ artistInfo.name }}</h1>
              <div class="hero-detail">
                <div class="hero-badge-row">
                  <span class="hero-badge">Artist</span>
                </div>
                <div class="hero-meta">
                  <div v-if="artistInfo.musicSize" class="meta-stat">
                    <i class="ri-music-2-line" />
                    <span class="meta-stat-num">{{ artistInfo.musicSize }}</span>
                    <span class="meta-stat-label">{{ t('artist.hotSongs') }}</span>
                  </div>
                  <div v-if="artistInfo.albumSize" class="meta-stat">
                    <i class="ri-album-line" />
                    <span class="meta-stat-num">{{ artistInfo.albumSize }}</span>
                    <span class="meta-stat-label">{{ t('artist.albums') }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 控制区 -->
            <div class="hero-controls">
              <button class="play-all-btn" @click="handlePlayAll">
                <i class="ri-play-fill" />
                <span class="play-all-label">{{ t('comp.musicList.playAll') }}</span>
              </button>

              <button class="icon-btn" @click="addToPlaylist">
                <i class="ri-play-list-add-line" />
              </button>

              <div class="controls-extra">
                <button
                  v-if="activeTab === 'songs'"
                  class="icon-btn"
                  :class="{ 'icon-btn-active': isSearchVisible }"
                  @click="isSearchVisible ? closeSearch() : showSearch()"
                >
                  <i :class="isSearchVisible ? 'ri-close-line' : 'ri-search-line'" />
                </button>

                <button
                  v-if="activeTab === 'songs' && !isMobile"
                  class="icon-btn"
                  @click="toggleLayout"
                >
                  <i :class="isCompactLayout ? 'ri-list-check' : 'ri-grid-line'" />
                </button>
              </div>
            </div>
          </section>

          <!-- Search Input (Expandable) — 在 hero-zone 下方 -->
          <Transition name="search-slide">
            <div v-if="isSearchVisible && activeTab === 'songs'" class="search-container page-padding-x mt-2">
              <div class="search-input-wrap">
                <i class="ri-search-line search-input-icon" />
                <input
                  v-model="searchKeyword"
                  type="text"
                  :placeholder="t('comp.musicList.searchSongs')"
                  class="search-input"
                  @blur="handleSearchBlur"
                />
                <button v-if="searchKeyword" class="search-clear-btn" @click="searchKeyword = ''">
                  <i class="ri-close-line" />
                </button>
              </div>
            </div>
          </Transition>

          <!-- Tab Navigation — glow风格 -->
          <section class="tab-nav page-padding-x pt-4 md:pt-6">
            <GlowTabs
              v-model="activeTab"
              :tabs="tabs.map(tab => ({ key: tab.value, label: tab.label }))"
            />
          </section>

          <!-- Tab Content -->
          <section class="tab-content page-padding-x py-6 md:py-8">
            <!-- Songs Tab -->
            <div v-show="activeTab === 'songs'" class="songs-tab">
              <!-- No Results -->
              <div
                v-if="filteredSongs.length === 0 && searchKeyword"
                class="empty-state flex flex-col items-center justify-center py-16"
              >
                <i
                  class="iconfont icon-search text-5xl text-neutral-300 dark:text-neutral-600 mb-4"
                />
                <p class="text-neutral-500 dark:text-neutral-400">
                  {{ t('comp.musicList.noSearchResults') }}
                </p>
              </div>

              <!-- Song List with CSS optimization -->
              <div v-else class="song-list" :class="{ 'compact-mode': isCompactLayout }">
                <div
                  v-for="(song, index) in filteredSongs"
                  :key="song.id"
                  class="song-item-container"
                >
                  <song-item
                    :item="formatSong(song)"
                    :compact="isCompactLayout"
                    :index="index"
                    @play="handlePlay(song)"
                  />
                </div>
              </div>

              <!-- Load More Trigger -->
              <div ref="songsLoadMoreRef" class="load-more-trigger py-8">
                <div v-if="songLoading" class="flex items-center justify-center gap-2">
                  <div
                    class="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"
                  />
                  <span class="text-sm text-neutral-400 dark:text-neutral-500">{{
                    t('common.loading') || 'Loading...'
                  }}</span>
                </div>
                <div
                  v-else-if="!songPage.hasMore && songs.length > 0"
                  class="text-center text-sm text-neutral-400 dark:text-neutral-500"
                >
                  — {{ t('common.noMore') || 'No more' }} —
                </div>
              </div>
            </div>

            <!-- Albums Tab -->
            <div v-show="activeTab === 'albums'" class="albums-tab">
              <!-- Album Grid -->
              <div
                v-if="albums.length > 0"
                class="album-grid grid grid-cols-2 gap-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              >
                <div
                  v-for="(album, index) in albums"
                  :key="album.id"
                  class="album-card group cursor-pointer"
                  :style="{ animationDelay: calculateAnimationDelay(index, 0.03) }"
                  @click="handleAlbumClick(album)"
                >
                  <!-- Cover -->
                  <div
                    class="album-cover relative aspect-square overflow-hidden rounded-2xl shadow-lg"
                  >
                    <img
                      :src="getImgUrl(album.picUrl, '500y500')"
                      :alt="album.name"
                      class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <!-- Play Overlay -->
                    <div
                      class="play-overlay absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 group-hover:bg-black/20 group-hover:opacity-100 transition-all duration-300"
                    >
                      <div
                        class="play-icon w-12 h-12 rounded-full bg-white/90 flex items-center justify-center scale-75 group-hover:scale-100 transition-transform duration-300 shadow-xl"
                      >
                        <i class="iconfont icon-playfill text-xl text-neutral-900 ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <!-- Info -->
                  <div class="album-info mt-3">
                    <h3
                      class="album-name line-clamp-2 text-sm font-semibold text-neutral-800 dark:text-neutral-100 group-hover:text-primary dark:group-hover:text-primary transition-colors"
                    >
                      {{ album.name }}
                    </h3>
                    <p class="album-date mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                      {{ formatPublishTime(album.publishTime) }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Load More Trigger -->
              <div ref="albumsLoadMoreRef" class="load-more-trigger py-8">
                <div v-if="albumLoading" class="flex items-center justify-center gap-2">
                  <div
                    class="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"
                  />
                  <span class="text-sm text-neutral-400 dark:text-neutral-500">{{
                    t('common.loading') || 'Loading...'
                  }}</span>
                </div>
                <div
                  v-else-if="!albumPage.hasMore && albums.length > 0"
                  class="text-center text-sm text-neutral-400 dark:text-neutral-500"
                >
                  — {{ t('common.noMore') || 'No more' }} —
                </div>
              </div>
            </div>

            <!-- About Tab -->
            <div v-show="activeTab === 'about'" class="about-tab">
              <div class="about-content">
                <h2
                  class="text-xl md:text-2xl font-bold text-neutral-900 dark:text-white mb-4 md:mb-6"
                >
                  {{ t('artist.description') }}
                </h2>
                <div
                  v-if="artistInfo.briefDesc"
                  class="prose prose-neutral dark:prose-invert max-w-none"
                >
                  <p
                    class="text-sm md:text-base leading-relaxed text-neutral-600 dark:text-neutral-300 whitespace-pre-line"
                  >
                    {{ artistInfo.briefDesc }}
                  </p>
                </div>
                <div
                  v-else
                  class="empty-state flex flex-col items-center justify-center py-16 text-neutral-400 dark:text-neutral-500"
                >
                  <i class="iconfont icon-info text-5xl mb-4 opacity-50" />
                  <p>{{ t('common.noData') || 'No description available' }}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- Empty State (No Artist) -->
        <div
          v-else
          class="empty-state flex flex-col items-center justify-center min-h-[60vh] text-neutral-400 dark:text-neutral-500"
        >
          <i class="iconfont icon-user text-6xl mb-4 opacity-30" />
          <p>{{ t('common.noData') || 'Artist not found' }}</p>
        </div>
      </div>
    </n-scrollbar>

    <!-- Bottom Player Spacer -->
    <play-bottom />
  </div>
</template>

<script setup lang="ts">
import { useDateFormat } from '@vueuse/core';
import { NScrollbar, useMessage } from 'naive-ui';
import PinyinMatch from 'pinyin-match';
import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  ref,
  watch
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import { getArtistAlbums, getArtistDetail, getArtistTopSongs } from '@/api/artist';
import { getMusicDetail } from '@/api/music';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlayBottom from '@/components/common/PlayBottom.vue';
import SongItem from '@/components/common/SongItem.vue';
import { usePlaylistConfirm } from '@/hooks/usePlaylistConfirm';
import { useScrollTitle } from '@/hooks/useScrollTitle';
import router from '@/router';
import { usePlayerStore } from '@/store';
import { IArtist } from '@/types/artist';
import { calculateAnimationDelay, getImgUrl, isMobile } from '@/utils';
import GlowTabs from '@/components/common/GlowTabs.vue';

defineOptions({
  name: 'ArtistDetail'
});

const { t } = useI18n();
const route = useRoute();
const playerStore = usePlayerStore();
const { confirmPlaylistReplace } = usePlaylistConfirm();
const message = useMessage();

const artistId = computed(() => Number(route.params.id));
const activeTab = ref('songs');

const scrollbarRef = ref<any>(null);

// Hero zone 可收缩状态
const isCompact = ref(false);
const COMPACT_ENTER = 80;
const COMPACT_EXIT = 10;
let compactLocked = false;
const setCompact = (val: boolean) => {
  if (val === isCompact.value) return;
  if (compactLocked) return;
  isCompact.value = val;
  compactLocked = true;
  setTimeout(() => { compactLocked = false; }, 450);
};
const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  const { scrollTop } = target;
  if (!isCompact.value && scrollTop > COMPACT_ENTER) {
    setCompact(true);
  } else if (isCompact.value && scrollTop < COMPACT_EXIT) {
    setCompact(false);
  }
};

// Tab configuration
const tabs = computed(() => [
  { value: 'songs', label: t('artist.hotSongs') },
  { value: 'albums', label: t('artist.albums') },
  { value: 'about', label: t('artist.description') }
]);

// 歌手信息
const artistInfo = ref<IArtist>();
const songs = ref<any[]>([]);
const albums = ref<any[]>([]);

const titleElRef = ref<HTMLElement | null>(null);
const artistTitle = computed(() => artistInfo.value?.name ?? '');
useScrollTitle(artistTitle, titleElRef);

// 加载状态
const loading = ref(false);
const songLoading = ref(false);
const albumLoading = ref(false);

// 分页参数
const songPage = ref({
  page: 1,
  pageSize: 30,
  hasMore: true
});

const albumPage = ref({
  page: 1,
  pageSize: 30,
  hasMore: true
});

// 无限滚动引用
const songsLoadMoreRef = ref<HTMLElement | null>(null);
const albumsLoadMoreRef = ref<HTMLElement | null>(null);
let songsObserver: IntersectionObserver | null = null;
let albumsObserver: IntersectionObserver | null = null;

// 添加上一个ID的引用，用于比较
const previousId = ref<string | null>(null);

// 简化缓存机制
const artistDataCache = new Map();

// 单个缓存键函数
const getCacheKey = (id: string | number) => `artist_${id}`;

// 搜索和布局相关
const searchKeyword = ref('');
const isSearchVisible = ref(false);
const isCompactLayout = ref(
  isMobile.value ? false : localStorage.getItem('musicListLayout') === 'compact'
);

// 导航到专辑详情
const handleAlbumClick = async (album: any) => {
  try {
    navigateToMusicList(router, {
      id: album.id,
      type: 'album',
      name: album.name,
      listInfo: {
        ...album,
        coverImgUrl: album.picUrl
      },
      canRemove: false
    });
  } catch (error) {
    console.error('Failed to navigate to album:', error);
    message.error(t('common.loadFailed'));
  }
};

// 加载歌手信息
const loadArtistInfo = async () => {
  if (!artistId.value) return;

  // 滚动到顶部
  nextTick(() => {
    scrollbarRef.value?.scrollTo(0, 0);
  });

  // 简化缓存检查
  const cacheKey = getCacheKey(artistId.value);
  if (artistDataCache.has(cacheKey)) {
    const cachedData = artistDataCache.get(cacheKey);
    artistInfo.value = cachedData.artistInfo;
    songs.value = cachedData.songs;
    albums.value = cachedData.albums;
    songPage.value = cachedData.songPage;
    albumPage.value = cachedData.albumPage;
    return;
  }

  // 加载新数据
  loading.value = true;
  try {
    const info = await getArtistDetail(artistId.value);
    if (info.data?.data?.artist) {
      artistInfo.value = info.data.data.artist;
    }
    // 重置分页并加载初始数据
    resetPagination();
    await Promise.all([loadSongs(), loadAlbums()]);

    // 保存到缓存
    artistDataCache.set(cacheKey, {
      artistInfo: artistInfo.value,
      songs: [...songs.value],
      albums: [...albums.value],
      songPage: { ...songPage.value },
      albumPage: { ...albumPage.value }
    });
  } catch (error) {
    console.error('加载歌手信息失败:', error);
  } finally {
    loading.value = false;
  }
};

// 重置分页
const resetPagination = () => {
  songPage.value = {
    page: 1,
    pageSize: 50,
    hasMore: true
  };
  albumPage.value = {
    page: 1,
    pageSize: 50,
    hasMore: true
  };
  songs.value = [];
  albums.value = [];
};

// 加载歌曲
const loadSongs = async () => {
  if (!artistId.value || !songPage.value.hasMore || songLoading.value) return;

  try {
    songLoading.value = true;
    const { page, pageSize } = songPage.value;
    const res = await getArtistTopSongs({
      id: artistId.value,
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    const ids = res.data.songs.map((item) => item.id);
    const songsDetail = await getMusicDetail(ids);

    if (songsDetail.data?.songs) {
      const newSongs = songsDetail.data.songs.map((item) => {
        return {
          ...item,
          picUrl: item.al.picUrl,
          song: {
            artists: item.ar,
            name: item.name,
            id: item.id
          }
        };
      });
      songs.value = page === 1 ? newSongs : [...songs.value, ...newSongs];
      songPage.value.hasMore = newSongs.length === pageSize;
      songPage.value.page++;
    } else {
      songPage.value.hasMore = false;
    }
  } catch (error) {
    console.error('加载歌曲失败:', error);
  } finally {
    songLoading.value = false;
  }
};

// 加载专辑
const loadAlbums = async () => {
  if (!artistId.value || !albumPage.value.hasMore || albumLoading.value) return;

  try {
    albumLoading.value = true;
    const { page, pageSize } = albumPage.value;
    const res = await getArtistAlbums({
      id: artistId.value,
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    if (res.data?.hotAlbums) {
      const newAlbums = res.data.hotAlbums;
      albums.value = page === 1 ? newAlbums : [...albums.value, ...newAlbums];
      albumPage.value.hasMore = newAlbums.length === pageSize;
      albumPage.value.page++;
    } else {
      albumPage.value.hasMore = false;
    }
  } catch (error) {
    console.error('加载专辑失败:', error);
  } finally {
    albumLoading.value = false;
  }
};

// 格式化发布时间
const formatPublishTime = (time: number) => {
  return useDateFormat(time, 'YYYY-MM-DD').value;
};

// 搜索相关方法
const showSearch = () => {
  isSearchVisible.value = true;
  // 添加一个小延迟后聚焦搜索框
  nextTick(() => {
    const inputEl = document.querySelector('.search-container input');
    if (inputEl) {
      (inputEl as HTMLInputElement).focus();
    }
  });
};

const closeSearch = () => {
  isSearchVisible.value = false;
  searchKeyword.value = '';
};

const handleSearchBlur = () => {
  // 如果搜索框为空，则在失焦时关闭搜索框
  if (!searchKeyword.value) {
    setTimeout(() => {
      isSearchVisible.value = false;
    }, 200);
  }
};

// 过滤歌曲列表
const filteredSongs = computed(() => {
  if (!searchKeyword.value) {
    return songs.value;
  }

  const keyword = searchKeyword.value.toLowerCase().trim();
  return songs.value.filter((song) => {
    const songName = song.name?.toLowerCase() || '';
    const albumName = song.al?.name?.toLowerCase() || '';
    const artists = song.ar || song.artists || [];

    // 原始文本匹配
    const nameMatch = songName.includes(keyword);
    const albumMatch = albumName.includes(keyword);
    const artistsMatch = artists.some((artist: any) => {
      return artist.name?.toLowerCase().includes(keyword);
    });

    // 拼音匹配
    const namePinyinMatch = song.name && PinyinMatch.match(song.name, keyword);
    const albumPinyinMatch = song.al?.name && PinyinMatch.match(song.al.name, keyword);
    const artistsPinyinMatch = artists.some((artist: any) => {
      return artist.name && PinyinMatch.match(artist.name, keyword);
    });

    return (
      nameMatch ||
      albumMatch ||
      artistsMatch ||
      namePinyinMatch ||
      albumPinyinMatch ||
      artistsPinyinMatch
    );
  });
});

// 布局切换
const toggleLayout = () => {
  isCompactLayout.value = !isCompactLayout.value;
  localStorage.setItem('musicListLayout', isCompactLayout.value ? 'compact' : 'normal');
};

// 播放全部
const handlePlayAll = () => {
  if (filteredSongs.value.length === 0) return;

  confirmPlaylistReplace(() => {
    playerStore.setPlayList(
      filteredSongs.value.map((song) => ({
        ...song,
        picUrl: song.al.picUrl
      }))
    );

    // 开始播放第一首
    playerStore.setPlay(filteredSongs.value[0]);

    message.success(t('comp.musicList.playAll'));
  });
};

// 添加到播放列表
const addToPlaylist = () => {
  if (filteredSongs.value.length === 0) return;

  // 获取当前播放列表
  const currentList = playerStore.playList;

  // 添加歌曲到播放列表(避免重复添加)
  const newSongs = filteredSongs.value.filter(
    (song) => !currentList.some((item) => item.id === song.id)
  );

  if (newSongs.length === 0) {
    message.info(t('comp.musicList.songsAlreadyInPlaylist'));
    return;
  }

  // 合并到当前播放列表末尾
  const newList = [
    ...currentList,
    ...newSongs.map((song) => ({
      ...song,
      picUrl: song.al.picUrl
    }))
  ];

  playerStore.setPlayList(newList);

  message.success(t('comp.musicList.addToPlaylistSuccess', { count: newSongs.length }));
};

const handlePlay = (song?: any) => {
  // 如果传入了特定歌曲（点击单曲播放），则将其作为播放列表的第一首
  if (song) {
    const songList = [...filteredSongs.value];
    const index = songList.findIndex((item) => item.id === song.id);

    if (index !== -1) {
      // 将点击的歌曲移到第一位
      const clickedSong = songList.splice(index, 1)[0];
      songList.unshift(clickedSong);
    }

    playerStore.setPlayList(
      songList.map((item) => ({
        ...item,
        picUrl: item.al?.picUrl || item.picUrl
      }))
    );

    // 设置当前播放歌曲
    playerStore.setPlay(song);
  } else {
    // 默认行为：播放整个过滤后的列表
    playerStore.setPlayList(
      filteredSongs.value.map((item) => ({
        ...item,
        picUrl: item.al?.picUrl || item.picUrl
      }))
    );
  }
};

// 简化观察器设置
const setupObservers = () => {
  // 清理之前的观察器
  if (songsObserver) songsObserver.disconnect();
  if (albumsObserver) albumsObserver.disconnect();

  // 创建观察器(如果不存在)
  if (!songsObserver) {
    songsObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && songPage.value.hasMore) {
          loadSongs();
        }
      },
      { threshold: 0.1 }
    );
  }

  if (!albumsObserver) {
    albumsObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && albumPage.value.hasMore) {
          loadAlbums();
        }
      },
      { threshold: 0.1 }
    );
  }

  // 观察当前标签页的元素
  nextTick(() => {
    if (activeTab.value === 'songs' && songsLoadMoreRef.value) {
      songsObserver?.observe(songsLoadMoreRef.value);
    } else if (activeTab.value === 'albums' && albumsLoadMoreRef.value) {
      albumsObserver?.observe(albumsLoadMoreRef.value);
    }
  });
};

// 监听标签切换
watch(activeTab, () => {
  setupObservers();
});

// 监听引用元素的变化
watch([songsLoadMoreRef, albumsLoadMoreRef], () => {
  setupObservers();
});

// 搜索词变化时重新设置观察器
watch(searchKeyword, () => {
  nextTick(() => {
    setupObservers();
  });
});

onActivated(() => {
  // 确保当前路由是艺术家详情页
  if (route.name === 'artistDetail') {
    const currentId = route.params.id as string;

    // 滚动到顶部
    nextTick(() => {
      scrollbarRef.value?.scrollTo(0, 0);
    });

    // 首次加载或ID变化时加载数据
    if (!previousId.value || previousId.value !== currentId) {
      previousId.value = currentId;
      activeTab.value = 'songs';
      loadArtistInfo();
    }

    // 重新设置观察器
    setupObservers();
  }
});

onMounted(() => {
  // 首次挂载时加载数据
  if (route.params.id) {
    previousId.value = route.params.id as string;
    loadArtistInfo();
    setupObservers();
  }
});

onDeactivated(() => {
  // 断开观察器但不清除引用
  if (songsObserver) songsObserver.disconnect();
  if (albumsObserver) albumsObserver.disconnect();
});

onUnmounted(() => {
  // 完全清理观察器
  if (songsObserver) {
    songsObserver.disconnect();
    songsObserver = null;
  }
  if (albumsObserver) {
    albumsObserver.disconnect();
    albumsObserver = null;
  }
});

// 格式化歌曲（使用在列表中）
const formatSong = (item: any) => {
  if (!item) {
    return null;
  }
  return {
    ...item,
    picUrl: item.al?.picUrl || item.picUrl
  };
};
</script>

<style lang="scss" scoped>
$spring: cubic-bezier(0.34, 1.56, 0.64, 1);
$smooth: cubic-bezier(0.32, 0.72, 0, 1);

/* Artist Detail Page Styles */
.artist-detail-page {
  position: relative;
}

.page-padding-x {
  padding-left: 16px;
  padding-right: 16px;
}

/* ============================================================
   Hero Zone — 单一形变容器（和 MusicListPage 相同的设计语言）
   ============================================================ */
.hero-zone {
  position: sticky;
  top: calc(var(--safe-area-inset-top, 0px) + 52px);
  z-index: 30;
  margin: 0 16px 8px;
  border-radius: 22px;
  background: var(--cover-surface, rgba(255, 255, 255, 0.92));
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 20px 16px 14px;
  max-height: 500px;
  transition: border-radius 0.4s $spring,
              box-shadow 0.4s ease,
              padding 0.4s $spring,
              gap 0.4s $spring,
              max-height 0.4s $spring;

  &.compact {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    max-height: 64px;
  }
}

.cover-wrap {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  .hero-zone.compact & { justify-content: flex-start; }
}

.cover-img {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  transition: width 0.4s $spring, height 0.4s $spring, border-radius 0.4s $spring, box-shadow 0.4s ease;
  .hero-zone.compact & {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.1);
  }
}

.hero-text {
  flex: 1;
  min-width: 0;
  text-align: center;
  .hero-zone.compact & { text-align: left; }
}

.hero-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--cover-text-primary, var(--m-text-primary, #1a1a1a));
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: font-size 0.4s $spring, font-weight 0.4s;
  .hero-zone.compact & { font-size: 15px; font-weight: 600; }
}

.hero-detail {
  opacity: 1;
  max-height: 120px;
  overflow: hidden;
  margin-top: 8px;
  transition: opacity 0.25s ease, max-height 0.35s $spring, margin-top 0.35s $spring;
  .hero-zone.compact & { opacity: 0; max-height: 0; margin-top: 0; pointer-events: none; }
}

.hero-badge-row { margin-top: 8px; }
.hero-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px; border-radius: 9999px;
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
  background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.12);
  color: var(--accent-color, #888);
}

.hero-meta {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 12px; margin-top: 8px;
}
.meta-stat { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--cover-text-secondary, var(--m-text-secondary, #6b6560)); }
.meta-stat i { font-size: 14px; color: var(--accent-color, #888); }
.meta-stat-num { font-weight: 700; color: var(--cover-text-primary, var(--m-text-primary, #1a1a1a)); }
.meta-stat-label { color: var(--cover-text-muted, var(--m-text-muted, #9a9590)); }

.hero-controls {
  display: flex; align-items: center; gap: 8px; justify-content: center; flex-shrink: 0;
  .hero-zone.compact & { justify-content: flex-end; margin-left: auto; }
}

.controls-extra {
  display: flex; align-items: center; gap: 8px;
  opacity: 1; max-width: 600px; overflow: hidden;
  transition: opacity 0.25s ease, max-width 0.35s $spring;
  .hero-zone.compact & { opacity: 0; max-width: 0; pointer-events: none; }
}

.play-all-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 8px 16px; border-radius: 9999px; border: none;
  background: var(--accent-color, #888); color: #fff;
  font-size: 13px; font-weight: 600; cursor: pointer;
  box-shadow: 0 2px 12px rgba(var(--accent-color-rgb, 136, 136, 136), 0.25);
  white-space: nowrap; flex-shrink: 0;
  transition: padding 0.3s $spring, font-size 0.3s $spring;
  i { font-size: 16px; transition: font-size 0.3s $spring; }
  .hero-zone.compact & { padding: 6px 12px; font-size: 12px; i { font-size: 14px; } }
  &:active { transform: scale(0.94); }
}

.icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 50%; border: none;
  background: rgba(128, 128, 128, 0.1);
  color: var(--cover-text-secondary, var(--m-text-secondary, #6b6560));
  font-size: 18px; cursor: pointer; flex-shrink: 0;
  transition: all 0.2s $spring;
  &:active { transform: scale(0.88); }
  &.icon-btn-active { background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.15); color: var(--accent-color, #888); }
}

/* Search */
.search-container { padding: 0 16px; }
.search-input-wrap {
  display: flex; align-items: center;
  background: rgba(128, 128, 128, 0.08);
  border-radius: 14px;
  overflow: hidden;
  padding: 0 12px;
}
.search-input-icon { color: var(--cover-text-muted, #999); font-size: 16px; }
.search-input {
  flex: 1; padding: 10px 8px; border: none; background: transparent; outline: none;
  font-size: 14px; color: var(--cover-text-primary, #1a1a1a);
  &::placeholder { color: var(--cover-text-muted, #999); }
}
.search-clear-btn { border: none; background: none; color: var(--cover-text-muted, #999); cursor: pointer; padding: 4px; }

/* Search Slide Animation */
.search-slide-enter-active, .search-slide-leave-active { transition: all 0.25s ease; }
.search-slide-enter-from, .search-slide-leave-to { opacity: 0; transform: translateY(-8px); max-height: 0; margin-top: 0; }
.search-slide-enter-to, .search-slide-leave-from { max-height: 60px; }

/* Virtual Song List */
.virtual-song-list { @apply w-full; }
.song-list { @apply w-full; }

.song-item-container {
  content-visibility: auto;
  contain-intrinsic-size: 0 72px;
}
.song-list.compact-mode .song-item-container {
  contain-intrinsic-size: 0 52px;
}

/* Album Card Animation */
.album-card {
  animation: fadeInUp 0.4s ease backwards;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Loading Spinner */
.loading-spinner { animation: pulse 2s ease-in-out infinite; }
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* Hover Effects */
.album-cover { transition: box-shadow 0.3s ease; }
.album-card:hover .album-cover {
  @apply shadow-2xl;
  box-shadow: 0 10px 15px -3px rgba(var(--accent-color-rgb, 0, 0, 0), 0.1), 0 4px 6px -2px rgba(var(--accent-color-rgb, 0, 0, 0), 0.05);
}

/* Focus states for accessibility */
button:focus-visible { @apply outline-none ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-neutral-900; }
input:focus-visible { @apply outline-none ring-2 ring-primary ring-opacity-50; }
</style>
