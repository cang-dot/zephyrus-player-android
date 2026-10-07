<template>
  <div
    class="artist-detail-page h-full w-full bg-white dark:bg-neutral-900 transition-colors duration-500"
  >
    <n-scrollbar ref="scrollbarRef" class="h-full" @scroll="handleScroll">
      <div
        class="artist-detail-content w-full"
        style="padding-top: var(--mobile-topbar-inset); padding-bottom: calc(var(--mobile-dock-content-inset, 144px) + var(--safe-area-inset-bottom, 0px) + 12px)"
      >
        <page-loading-placeholder v-if="loading" variant="artist" :label="t('common.loading')" />

        <!-- Main Content -->
        <div v-else-if="artistInfo" class="artist-content">
          <!--
            移动端：设计稿布局——头像大图 + 三按钮(简介/播放/收藏) + 统计
            + 最新专辑大卡 + 热门歌曲横滑网格 + 专辑横滑 + 全部歌曲横滑网格
          -->
          <section
            v-if="isMobile"
            class="mobile-artist"
            :class="{ 'intro-open': introOpen }"
            :style="mobileArtistStyle"
          >
            <div class="ma-scroll-host">
              <!-- 头部：头像铺满整屏宽，向下渐变模糊融入头像主题色 -->
              <div class="ma-hero">
                <img
                  :src="avatarUrl"
                  :alt="artistInfo.name"
                  class="ma-photo"
                  referrerpolicy="no-referrer"
                  draggable="false"
                />
                <img
                  :src="avatarUrl"
                  aria-hidden="true"
                  class="ma-photo-blur"
                  referrerpolicy="no-referrer"
                  draggable="false"
                />
                <div class="ma-hero-fade" />
                <div class="ma-hero-content">
                  <h1 class="ma-name">{{ artistInfo.name }}</h1>
                  <div class="ma-actions">
                    <button
                      v-if="briefDesc"
                      ref="infoBtnRef"
                      type="button"
                      class="ma-btn ma-btn-side"
                      :aria-label="t('artist.intro')"
                      @click="toggleIntro"
                    >
                      <i class="ri-information-line" />
                    </button>
                    <button
                      type="button"
                      class="ma-btn ma-btn-play"
                      :aria-label="t('comp.musicList.playAll')"
                      @click="handlePlayAll"
                    >
                      <i class="ri-play-fill" />
                    </button>
                    <button
                      v-if="!isQqArtist"
                      type="button"
                      class="ma-btn ma-btn-side"
                      :class="{ 'is-subscribed': subscribed }"
                      :aria-label="t('artist.subscribe')"
                      @click="toggleSubscribe"
                    >
                      <i :class="subscribed ? 'ri-star-fill' : 'ri-star-line'" />
                    </button>
                  </div>
                  <p v-if="artistInfo.musicSize || artistInfo.albumSize" class="ma-stats">
                    {{ artistInfo.musicSize || 0 }} {{ t('artist.songsCount') }}
                    <span class="ma-stats-dot">·</span>
                    {{ artistInfo.albumSize || 0 }} {{ t('artist.albumsCount') }}
                  </p>
                </div>
              </div>

              <!-- 最新专辑大卡 -->
              <button
                v-if="latestAlbum"
                type="button"
                class="ma-latest-card"
                @click="handleAlbumClick(latestAlbum)"
              >
                <img
                  :src="getImgUrl(latestAlbum.picUrl, '300y300')"
                  class="ma-latest-cover"
                  referrerpolicy="no-referrer"
                  loading="lazy"
                  :alt="latestAlbum.name"
                />
                <div class="ma-latest-copy">
                  <small>{{ formatPublishTime(latestAlbum.publishTime) }}</small>
                  <strong>{{ latestAlbum.name }}</strong>
                  <small v-if="latestAlbum.size">{{ latestAlbum.size }} {{ t('artist.songsCount') }}</small>
                </div>
                <i class="ri-arrow-right-s-line ma-latest-arrow" />
              </button>

              <!-- 热门歌曲：横滑分页卡（对齐首页推荐区，每卡 3 行） -->
              <div v-if="hotSongsGrid.length" class="ma-section">
                <h2
                  class="ma-section-title"
                  role="button"
                  tabindex="0"
                  @click="openArtistList('songs')"
                  @keydown.enter.prevent="openArtistList('songs')"
                >
                  {{ t('artist.hotSongs') }}<i class="ri-arrow-right-s-line" />
                </h2>
                <div class="ma-hgrid" data-horizontal-scroll>
                  <div
                    v-for="(card, cardIndex) in hotSongCards"
                    :key="`hot-card-${cardIndex}`"
                    class="ma-page-card"
                  >
                    <button
                      v-for="song in card"
                      :key="`hot-${song.id}`"
                      type="button"
                      class="ma-row"
                      @click="handlePlay(song)"
                    >
                      <img
                        :src="getImgUrl(song.al?.picUrl || song.picUrl, '200y200')"
                        class="ma-row-cover"
                        referrerpolicy="no-referrer"
                        loading="lazy"
                        :alt="song.name"
                      />
                      <span class="ma-row-main">
                        <span class="ma-row-name">{{ song.name }}</span>
                        <span class="ma-row-artist">{{
                          song.ar?.[0]?.name || artistInfo.name
                        }}</span>
                      </span>
                      <span class="ma-row-play"><i class="ri-play-fill" /></span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- 专辑：单行横滑大卡 -->
              <div v-if="albums.length" class="ma-section">
                <h2
                  class="ma-section-title"
                  role="button"
                  tabindex="0"
                  @click="openArtistList('albums')"
                  @keydown.enter.prevent="openArtistList('albums')"
                >
                  {{ t('artist.albums') }}<i class="ri-arrow-right-s-line" />
                </h2>
                <div class="ma-hgrid" data-horizontal-scroll>
                  <button
                    v-for="album in albums"
                    :key="album.id"
                    type="button"
                    class="ma-song-card ma-album-card"
                    @click="handleAlbumClick(album)"
                  >
                    <img
                      :src="getImgUrl(album.picUrl, '300y300')"
                      class="ma-song-cover"
                      referrerpolicy="no-referrer"
                      loading="lazy"
                      :alt="album.name"
                    />
                    <strong>{{ album.name }}</strong>
                    <small>{{ artistInfo.name }}</small>
                  </button>
                </div>
              </div>

              <!-- 全部歌曲：横滑分页卡（触底分页） -->
              <div v-if="songs.length" class="ma-section">
                <h2
                  class="ma-section-title"
                  role="button"
                  tabindex="0"
                  @click="openArtistList('songs')"
                  @keydown.enter.prevent="openArtistList('songs')"
                >
                  {{ t('artist.allSongs') }}<i class="ri-arrow-right-s-line" />
                </h2>
                <div
                  ref="allSongsRailRef"
                  class="ma-hgrid"
                  data-horizontal-scroll
                  @scroll="onAllSongsRailScroll"
                >
                  <div
                    v-for="(card, cardIndex) in allSongCards"
                    :key="`all-card-${cardIndex}`"
                    class="ma-page-card"
                  >
                    <button
                      v-for="song in card"
                      :key="`all-${song.id}`"
                      type="button"
                      class="ma-row"
                      @click="handlePlay(song)"
                    >
                      <img
                        :src="getImgUrl(song.al?.picUrl || song.picUrl, '200y200')"
                        class="ma-row-cover"
                        referrerpolicy="no-referrer"
                        loading="lazy"
                        :alt="song.name"
                      />
                      <span class="ma-row-main">
                        <span class="ma-row-name">{{ song.name }}</span>
                        <span class="ma-row-artist">{{
                          song.ar?.[0]?.name || artistInfo.name
                        }}</span>
                      </span>
                      <span class="ma-row-play"><i class="ri-play-fill" /></span>
                    </button>
                  </div>
                  <div v-if="songLoading" class="ma-grid-loading">
                    <i class="ri-loader-4-line ma-spin" />
                  </div>
                </div>
              </div>
            </div>

            <!-- 简介容器：ⓘ 按钮 FLIP 扩大（遮罩变暗 + 页面内容虚化） -->
            <Transition name="ma-intro">
              <div v-if="introOpen && briefDesc" class="ma-intro-layer" @click="toggleIntro">
                <div class="ma-intro-panel" :style="introPanelStyle" @click.stop>
                  <h2 class="ma-intro-title">{{ t('artist.intro') }}</h2>
                  <div class="ma-intro-body">{{ briefDesc }}</div>
                  <button type="button" class="ma-intro-collapse" @click="toggleIntro">
                    {{ t('artist.collapse') }}
                  </button>
                </div>
              </div>
            </Transition>
          </section>

          <!--
            Hero Zone — 歌手信息+控制合为一体（和 MusicListPage 相同的形变模式）
            展开态: 封面/名/统计/控制 纵向
            收缩态: 封面/名  控制  横向单行
          -->
          <section v-if="!isMobile" class="hero-zone" :class="{ compact: isCompact }">
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
          <Transition v-if="!isMobile" name="search-slide">
            <div
              v-if="isSearchVisible && activeTab === 'songs'"
              class="search-container page-padding-x mt-2"
            >
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
          <section v-if="!isMobile" class="tab-nav page-padding-x pt-4 md:pt-6">
            <glow-tabs
              v-model="activeTab"
              :tabs="tabs.map((tab) => ({ key: tab.value, label: tab.label }))"
            />
          </section>

          <!-- Tab Content（桌面端） -->
          <section v-if="!isMobile" class="tab-content page-padding-x py-6 md:py-8">
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

import { getArtistAlbums,
  getArtistDesc,
  getArtistDetail,
  getArtistSublist,
  getArtistTopSongs,
  subscribeArtist
} from '@/api/artist';
import { getMusicDetail } from '@/api/music';
import { fetchQqSingerHotSongs } from '@/api/platformQrApi';
import GlowTabs from '@/components/common/GlowTabs.vue';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PageLoadingPlaceholder from '@/components/common/PageLoadingPlaceholder.vue';
import PlayBottom from '@/components/common/PlayBottom.vue';
import SongItem from '@/components/common/SongItem.vue';
import {
  registerMobileTopbarAction,
  unregisterMobileTopbarAction
} from '@/composables/useMobileTopbarMenu';
import { usePosterShare } from '@/composables/usePosterShare';
import { usePlaylistConfirm } from '@/hooks/usePlaylistConfirm';
import { useScrollTitle } from '@/hooks/useScrollTitle';
import router from '@/router';
import { usePlayerStore } from '@/store';
import { IArtist } from '@/types/artist';
import { type PosterSubject } from '@/types/share';
import { calculateAnimationDelay, getImgUrl, isMobile } from '@/utils';

defineOptions({
  name: 'ArtistDetail'
});

const { t } = useI18n();
const route = useRoute();
const playerStore = usePlayerStore();
const { confirmPlaylistReplace } = usePlaylistConfirm();
const { openPosterForSubject } = usePosterShare();
const message = useMessage();

const artistId = computed(() => Number(route.params.id));
// QQ 歌手：路由带 ?platform=qq&singerMID=xx&name=xx（QQ 歌手 mid 是字符串，不走网易云数字 id）
const isQqArtist = computed(
  () => route.query.platform === 'qq' && Boolean(String(route.query.singerMID || '').trim())
);
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
  setTimeout(() => {
    compactLocked = false;
  }, 450);
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

// Tab configuration（QQ 歌手暂只提供热门歌曲，无专辑数据源）
const tabs = computed(() => {
  const list: Array<{ value: string; label: string }> = [
    { value: 'songs', label: t('artist.hotSongs') }
  ];
  if (!isQqArtist.value) list.push({ value: 'albums', label: t('artist.albums') });
  return list;
});

// 歌手信息
const artistInfo = ref<IArtist>();
const songs = ref<any[]>([]);
const albums = ref<any[]>([]);

// ==================== 移动端设计稿布局 ====================
const avatarUrl = computed(() =>
  getImgUrl(
    String(artistInfo.value?.avatar || artistInfo.value?.cover || artistInfo.value?.picUrl || ''),
    '500y500'
  )
);
const hotSongsGrid = computed(() => songs.value.slice(0, 8));
const latestAlbum = computed(() => albums.value[0] || null);

/** 横滑分页卡：每卡 3 行（对齐首页「根据你喜爱的歌曲推荐」范式） */
const chunkColumns = (list: any[], per = 3) => {
  const columns: any[][] = [];
  for (let i = 0; i < list.length; i += per) columns.push(list.slice(i, i + per));
  return columns;
};
const hotSongCards = computed(() => chunkColumns(hotSongsGrid.value, 3));
const allSongCards = computed(() => chunkColumns(songs.value, 3));

// ---------- 头像主题色：页面背景覆盖 + 文字按亮度反白 ----------
const artistPageColor = ref('');
const artistPageInk = ref('');
const mobileArtistStyle = computed(() => {
  if (!artistPageColor.value) return {};
  return {
    '--ma-page-color': artistPageColor.value,
    '--ma-ink': artistPageInk.value,
    '--ma-ink-muted': artistPageInk.value === '#ffffff' ? 'rgba(255, 255, 255, 0.55)' : ''
  };
});

const hexBrightness = (hex: string): number => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 128;
  const int = parseInt(match[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return (r * 299 + g * 587 + b * 114) / 1000;
};

/** 主色 → page chrome（对齐专辑页口径）：顶栏/迷你栏表面与墨色跟随页面底色 */
const applyArtistPageChrome = (hex: string) => {
  const ink = hexBrightness(hex) > 165 ? '#17171a' : '#ffffff';
  const inkRgb = ink === '#17171a' ? '23, 23, 26' : '255, 255, 255';
  const layout = document.getElementById('layout-main');
  const vars: Array<[string, string]> = [
    ['--page-chrome-bg', hex],
    ['--page-chrome-ink', ink],
    ['--page-chrome-ink-rgb', inkRgb]
  ];
  for (const [key, value] of vars) {
    layout?.style.setProperty(key, value);
    document.documentElement.style.setProperty(key, value);
  }
  layout?.setAttribute('data-page-chrome', 'artist-detail');
};

const clearArtistPageChrome = () => {
  const layout = document.getElementById('layout-main');
  for (const key of ['--page-chrome-bg', '--page-chrome-ink', '--page-chrome-ink-rgb']) {
    layout?.style.removeProperty(key);
    document.documentElement.style.removeProperty(key);
  }
  layout?.removeAttribute('data-page-chrome');
};

watch(avatarUrl, async (url) => {
  artistPageColor.value = '';
  if (!url) {
    clearArtistPageChrome();
    return;
  }
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = getImgUrl(url, '50y50');
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(img, 0, 0, 10, 10);
    const { data } = context.getImageData(0, 0, 10, 10);
    let r = 0;
    let g = 0;
    let b = 0;
    const count = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const hex = `#${[r, g, b]
      .map((sum) => Math.round(sum / count).toString(16).padStart(2, '0'))
      .join('')}`;
    artistPageColor.value = hex;
    // 亮主色 → 深墨字；暗主色 → 白字（跟随背景反白）
    artistPageInk.value = hexBrightness(hex) > 165 ? '#1c1b1a' : '#ffffff';
    applyArtistPageChrome(hex);
  } catch {
    /* 跨域取色失败：回退主题墨色，chrome 保持默认 */
    clearArtistPageChrome();
  }
});

/** 分区标题 → 独立列表子页 */
const openArtistList = (kind: 'songs' | 'albums') => {
  if (kind === 'albums' && (isQqArtist.value || !albums.value.length)) return;
  const query = isQqArtist.value
    ? {
        platform: 'qq',
        singerMID: String(route.query.singerMID || ''),
        name: String(route.query.name || '')
      }
    : undefined;
  router.push({ path: `/artist/${kind}/${artistId.value}`, query });
};

const briefDesc = ref('');
const subscribed = ref(false);
const introOpen = ref(false);
const infoBtnRef = ref<HTMLElement | null>(null);
const allSongsRailRef = ref<HTMLElement | null>(null);
/** 简介容器从 ⓘ 按钮位置展开（FLIP 起点，视口坐标） */
const introPanelStyle = ref<Record<string, string>>({});

const loadArtistBrief = async () => {
  if (isQqArtist.value || !artistId.value) {
    briefDesc.value = String(artistInfo.value?.briefDesc || '').trim();
    return;
  }
  try {
    const res = await getArtistDesc(artistId.value);
    briefDesc.value = String(res?.data?.briefDesc || artistInfo.value?.briefDesc || '').trim();
  } catch {
    briefDesc.value = String(artistInfo.value?.briefDesc || '').trim();
  }
};

const refreshSubscribed = async () => {
  if (isQqArtist.value || !artistId.value) return;
  try {
    if (!localStorage.getItem('token')) {
      subscribed.value = false;
      return;
    }
    const res = await getArtistSublist(200);
    const list = res?.data?.data || [];
    subscribed.value = list.some((item: any) => Number(item.id) === artistId.value);
  } catch {
    subscribed.value = false;
  }
};

const toggleSubscribe = async () => {
  if (!localStorage.getItem('token')) {
    message.warning(t('artist.subscribeNeedLogin'));
    return;
  }
  const next: 1 | 2 = subscribed.value ? 2 : 1;
  try {
    await subscribeArtist(artistId.value, next);
    subscribed.value = !subscribed.value;
    message.success(next === 1 ? t('artist.subscribeOk') : t('artist.subscribeCancel'));
  } catch {
    message.error(t('artist.subscribeFail'));
  }
};

const toggleIntro = () => {
  if (introOpen.value) {
    introOpen.value = false;
    return;
  }
  const rect = infoBtnRef.value?.getBoundingClientRect();
  if (rect) {
    introPanelStyle.value = {
      '--intro-origin-x': `${rect.left + rect.width / 2}px`,
      '--intro-origin-y': `${rect.top + rect.height / 2}px`
    };
  }
  introOpen.value = true;
};

/** 全部歌曲横滑触底：续接现有分页加载 */
const onAllSongsRailScroll = (event: Event) => {
  const rail = event.target as HTMLElement;
  if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 120) {
    void loadSongs();
  }
};

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
  introOpen.value = false;
  if (isQqArtist.value) {
    await loadQqArtistInfo();
    return;
  }
  if (!artistId.value) return;

  // 滚动到顶部
  nextTick(() => {
    scrollbarRef.value?.scrollTo(0, 0);
  });

  // 简介与收藏态（独立于数据缓存，始终刷新）
  void loadArtistBrief();
  void refreshSubscribed();

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

// QQ 歌手：走网关 qq/singer/songs（热门排序，归一化结果已是全量 SongResult，无需二次详情）
const loadQqArtistInfo = async () => {
  // mid 优先取 query.singerMID，兼容直接把 mid 放进路径参数的入口
  const mid = String(route.query.singerMID || route.params.id || '').trim();
  const fallbackName = String(route.query.name || '').trim();
  const cacheKey = `artist_qq_${mid}`;
  if (artistDataCache.has(cacheKey)) {
    const cachedData = artistDataCache.get(cacheKey);
    artistInfo.value = cachedData.artistInfo;
    songs.value = cachedData.songs;
    songPage.value = cachedData.songPage;
    return;
  }
  loading.value = true;
  try {
    nextTick(() => {
      scrollbarRef.value?.scrollTo(0, 0);
    });
    const result = await fetchQqSingerHotSongs(mid, 50, 0);
    artistInfo.value = {
      id: 0,
      name: result.artist.name || fallbackName || '未知歌手',
      picUrl: result.artist.picUrl,
      cover: result.artist.picUrl
    } as IArtist;
    songs.value = result.songs;
    albums.value = [];
    songPage.value = { page: 1, pageSize: 50, hasMore: false };
    albumPage.value = { page: 1, pageSize: 50, hasMore: false };
    artistDataCache.set(cacheKey, {
      artistInfo: artistInfo.value,
      songs: [...songs.value],
      songPage: { ...songPage.value }
    });
  } catch (error) {
    console.error('加载 QQ 歌手信息失败:', error);
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

// 移动端简洁顶栏右胶囊（歌单页同款）：分享（海报）+ 三个点（页面未承载的操作）。
// 菜单项 = 加入播放列表 / 搜索歌曲（跳全部歌曲子页过滤）/ 播放全部。
const artistTopbarActionPrefix = 'artist-detail';
const artistMenuIds = [
  `${artistTopbarActionPrefix}-menu-add`,
  `${artistTopbarActionPrefix}-menu-search`,
  `${artistTopbarActionPrefix}-menu-play`
];

const buildArtistPosterSubject = (): PosterSubject => ({
  kind: 'artist',
  songId: artistId.value,
  songName: artistInfo.value?.name || '',
  artists: artistInfo.value?.name || '',
  coverUrl: avatarUrl.value,
  title: artistInfo.value?.name,
  subtitle: artistInfo.value?.name,
  tracks: songs.value.slice(0, 40).map((song) => ({
    name: song.name,
    artist: song.ar?.[0]?.name || '',
    picUrl: song.al?.picUrl || song.picUrl
  }))
});

const openArtistSearch = () => {
  const query: Record<string, string> = { keyword: searchKeyword.value || '' };
  if (isQqArtist.value) {
    query.platform = 'qq';
    query.singerMID = String(route.query.singerMID || '');
    query.name = String(route.query.name || '');
  }
  router.push({ path: `/artist/songs/${artistId.value}`, query });
};

const syncArtistTopbar = () => {
  if (!isMobile.value || !route.path.startsWith('/artist/detail/')) return;
  registerMobileTopbarAction({
    id: `${artistTopbarActionPrefix}-poster`,
    routePath: '/artist/detail/*',
    label: t('comp.musicList.posterShare'),
    icon: 'ri-share-forward-line',
    kind: 'capsule',
    run: () => openPosterForSubject(buildArtistPosterSubject())
  });
  registerMobileTopbarAction({
    id: `${artistTopbarActionPrefix}-more`,
    routePath: '/artist/detail/*',
    label: t('common.more') || '更多',
    icon: 'ri-more-2-fill',
    kind: 'capsule',
    opensMenu: true,
    keepOpen: true,
    run: () => {}
  });
  registerMobileTopbarAction({
    id: `${artistTopbarActionPrefix}-menu-add`,
    routePath: '/artist/detail/*',
    label: t('comp.musicList.addToPlaylist'),
    icon: 'ri-play-list-add-line',
    run: addToPlaylist
  });
  registerMobileTopbarAction({
    id: `${artistTopbarActionPrefix}-menu-search`,
    routePath: '/artist/detail/*',
    label: t('common.search'),
    icon: 'ri-search-line',
    run: openArtistSearch
  });
  registerMobileTopbarAction({
    id: `${artistTopbarActionPrefix}-menu-play`,
    routePath: '/artist/detail/*',
    label: t('comp.musicList.playAll'),
    icon: 'ri-play-fill',
    run: handlePlayAll
  });
};

watch([artistInfo, activeTab, searchKeyword, isSearchVisible], () => syncArtistTopbar(), {
  deep: false
});

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
    syncArtistTopbar();
  }
});

onMounted(() => {
  // 首次挂载时加载数据
  if (route.params.id) {
    previousId.value = route.params.id as string;
    loadArtistInfo();
    setupObservers();
    syncArtistTopbar();
  }
});

onDeactivated(() => {
  // 断开观察器但不清除引用
  if (songsObserver) songsObserver.disconnect();
  if (albumsObserver) albumsObserver.disconnect();
});

onUnmounted(() => {
  // page chrome（顶栏/迷你栏跟随色）随页卸载清理，避免污染其它页面
  clearArtistPageChrome();
  // 顶栏胶囊动作注销
  unregisterMobileTopbarAction(`${artistTopbarActionPrefix}-poster`);
  unregisterMobileTopbarAction(`${artistTopbarActionPrefix}-more`);
  artistMenuIds.forEach((id) => unregisterMobileTopbarAction(id));
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
  transition:
    border-radius 0.4s $spring,
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
  .hero-zone.compact & {
    justify-content: flex-start;
  }
}

.cover-img {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  transition:
    width 0.4s $spring,
    height 0.4s $spring,
    border-radius 0.4s $spring,
    box-shadow 0.4s ease;
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
  .hero-zone.compact & {
    text-align: left;
  }
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
  transition:
    font-size 0.4s $spring,
    font-weight 0.4s;
  .hero-zone.compact & {
    font-size: 15px;
    font-weight: 600;
  }
}

.hero-detail {
  opacity: 1;
  max-height: 120px;
  overflow: hidden;
  margin-top: 8px;
  transition:
    opacity 0.25s ease,
    max-height 0.35s $spring,
    margin-top 0.35s $spring;
  .hero-zone.compact & {
    opacity: 0;
    max-height: 0;
    margin-top: 0;
    pointer-events: none;
  }
}

.hero-badge-row {
  margin-top: 8px;
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.12);
  color: var(--accent-color, #888);
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 8px;
}
.meta-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--cover-text-secondary, var(--m-text-secondary, #6b6560));
}
.meta-stat i {
  font-size: 14px;
  color: var(--accent-color, #888);
}
.meta-stat-num {
  font-weight: 700;
  color: var(--cover-text-primary, var(--m-text-primary, #1a1a1a));
}
.meta-stat-label {
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
}

.hero-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  flex-shrink: 0;
  .hero-zone.compact & {
    justify-content: flex-end;
    margin-left: auto;
  }
}

.controls-extra {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 1;
  max-width: 600px;
  overflow: hidden;
  transition:
    opacity 0.25s ease,
    max-width 0.35s $spring;
  .hero-zone.compact & {
    opacity: 0;
    max-width: 0;
    pointer-events: none;
  }
}

.play-all-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border-radius: 9999px;
  border: none;
  background: var(--accent-color, #888);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(var(--accent-color-rgb, 136, 136, 136), 0.25);
  white-space: nowrap;
  flex-shrink: 0;
  transition:
    padding 0.3s $spring,
    font-size 0.3s $spring;
  i {
    font-size: 16px;
    transition: font-size 0.3s $spring;
  }
  .hero-zone.compact & {
    padding: 6px 12px;
    font-size: 12px;
    i {
      font-size: 14px;
    }
  }
  &:active {
    transform: scale(0.94);
  }
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(128, 128, 128, 0.1);
  color: var(--cover-text-secondary, var(--m-text-secondary, #6b6560));
  font-size: 18px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s $spring;
  &:active {
    transform: scale(0.88);
  }
  &.icon-btn-active {
    background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.15);
    color: var(--accent-color, #888);
  }
}

/* Search */
.search-container {
  padding: 0 16px;
}
.search-input-wrap {
  display: flex;
  align-items: center;
  background: rgba(128, 128, 128, 0.08);
  border-radius: 14px;
  overflow: hidden;
  padding: 0 12px;
}
.search-input-icon {
  color: var(--cover-text-muted, #999);
  font-size: 16px;
}
.search-input {
  flex: 1;
  padding: 10px 8px;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: var(--cover-text-primary, #1a1a1a);
  &::placeholder {
    color: var(--cover-text-muted, #999);
  }
}
.search-clear-btn {
  border: none;
  background: none;
  color: var(--cover-text-muted, #999);
  cursor: pointer;
  padding: 4px;
}

/* Search Slide Animation */
.search-slide-enter-active,
.search-slide-leave-active {
  transition: all 0.25s ease;
}
.search-slide-enter-from,
.search-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
  margin-top: 0;
}
.search-slide-enter-to,
.search-slide-leave-from {
  max-height: 60px;
}

/* Virtual Song List */
.virtual-song-list {
  @apply w-full;
}
.song-list {
  @apply w-full;
}

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
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Loading Spinner */
.loading-spinner {
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

/* Hover Effects */
.album-cover {
  transition: box-shadow 0.3s ease;
}
.album-card:hover .album-cover {
  @apply shadow-2xl;
  box-shadow:
    0 10px 15px -3px rgba(var(--accent-color-rgb, 0, 0, 0), 0.1),
    0 4px 6px -2px rgba(var(--accent-color-rgb, 0, 0, 0), 0.05);
}

/* Focus states for accessibility */
button:focus-visible {
  @apply outline-none ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-neutral-900;
}
input:focus-visible {
  @apply outline-none ring-2 ring-primary ring-opacity-50;
}

/* ==================== 移动端设计稿布局 ==================== */
.mobile-artist {
  /* 主色背景覆盖整页（含顶栏后区域）：负 margin 顶到屏顶 */
  --ma-ink: var(--m-text-primary, var(--d-text-primary, #1c1b1a));
  --ma-ink-muted: var(--m-text-muted, var(--d-text-muted, rgba(0, 0, 0, 0.55)));
  min-height: 100%;
  margin-top: calc(-1 * var(--mobile-topbar-inset));
  padding-top: var(--mobile-topbar-inset);
  background: var(--ma-page-color, transparent);
}

.ma-scroll-host {
  transition: filter 300ms ease;
}

/* 简介打开时页面内容虚化（filter 允许，非 backdrop） */
.mobile-artist.intro-open .ma-scroll-host {
  filter: blur(14px) brightness(0.72);
  pointer-events: none;
}

/* ---------- 头部：照片铺满 + 渐变模糊融入主题色 ---------- */
.ma-hero {
  position: relative;
  overflow: hidden;
  margin-top: calc(-1 * var(--mobile-topbar-inset));
}

.ma-photo,
.ma-photo-blur {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}

/* 下半段渐显的模糊层：清晰照片向下"渐变模糊" */
.ma-photo-blur {
  filter: blur(26px) brightness(0.92) saturate(1.1);
  transform: scale(1.18);
  -webkit-mask-image: linear-gradient(180deg, transparent 36%, #000 82%);
  mask-image: linear-gradient(180deg, transparent 36%, #000 82%);
}

/* 顶部压暗 + 底部渐变到头像主题色（页面背景色） */
.ma-hero-fade {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.28) 0%,
    rgba(0, 0, 0, 0.08) 22%,
    transparent 40%,
    var(--ma-page-color, rgba(0, 0, 0, 0.55)) 94%
  );
}

.ma-hero-content {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  gap: 14px;
  /* 名字落在照片中下部；照片铺满整个 hero */
  padding: clamp(300px, 46vh, 500px) 20px 24px;
  text-align: center;
}

/* 头部文字固定反白（背景是照片+压暗，与主题明暗无关） */
.ma-name {
  margin: 4px 0 0;
  color: #fff;
  font-size: 27px;
  font-weight: 800;
  letter-spacing: 0.01em;
  text-shadow: 0 2px 18px rgba(0, 0, 0, 0.45);
}

/* 三按钮：中央大播放 + 两侧小钮 */
.ma-actions {
  display: flex;
  align-items: center;
  gap: 22px;
  margin-top: 4px;
}

.ma-btn {
  display: grid;
  place-items: center;
  border: 0;
  cursor: pointer;
  transition: transform 180ms cubic-bezier(0.32, 0.72, 0, 1);

  &:active {
    transform: scale(0.92);
  }
}

.ma-btn-side {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: 20px;
  backdrop-filter: none;

  &.is-subscribed {
    background: color-mix(in srgb, var(--accent-color) 30%, rgba(255, 255, 255, 0.1));
    color: #fff;
  }
}

.ma-btn-play {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #fff;
  color: #141312;
  font-size: 28px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

.ma-stats {
  margin: 0;
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.4);
}

.ma-stats-dot {
  margin: 0 6px;
}

/* ---------- 最新专辑大卡 ---------- */
.ma-latest-card {
  display: flex;
  width: calc(100% - 32px);
  align-items: center;
  gap: 14px;
  margin: 6px 16px 2px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--ma-ink) 10%, transparent);
  border-radius: 22px;
  background: color-mix(in srgb, var(--ma-ink) 8%, transparent);
  color: var(--ma-ink);
  cursor: pointer;
  text-align: left;
  transition: transform 180ms cubic-bezier(0.32, 0.72, 0, 1);

  &:active {
    transform: scale(0.98);
  }
}

.ma-latest-cover {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  border-radius: 14px;
  object-fit: cover;
}

.ma-latest-copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 3px;

  small {
    color: var(--ma-ink-muted);
    font-size: 11px;
  }

  strong {
    overflow: hidden;
    font-size: 16px;
    font-weight: 750;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.ma-latest-arrow {
  flex-shrink: 0;
  color: var(--ma-ink-muted);
  font-size: 20px;
}

/* ---------- 区块与横滑网格（flex 列包装，每列 2 卡） ---------- */
.ma-section {
  margin-top: 18px;
}

.ma-section-title {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 0 0 10px;
  padding: 0 16px;
  color: var(--ma-ink);
  font-size: 19px;
  font-weight: 800;
  cursor: pointer;

  i {
    color: var(--ma-ink-muted);
    font-size: 17px;
  }

  &:active {
    opacity: 0.7;
  }
}

.ma-hgrid {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 2px 16px 6px;
  scroll-padding-inline: 16px;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  touch-action: pan-x pan-y;
  overscroll-behavior-x: contain;

  &::-webkit-scrollbar {
    display: none;
  }
}

/* 横滑分页卡（对齐首页「根据你喜爱的歌曲推荐」）：每卡 3 行，右缘露出下一卡 */
.ma-page-card {
  display: flex;
  flex: 0 0 calc(100% - 84px);
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border-radius: 24px;
  background: color-mix(in srgb, var(--ma-ink) 9%, transparent);
  scroll-snap-align: start;
}

.ma-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border: 0;
  background: transparent;
  color: var(--ma-ink);
  cursor: pointer;
  text-align: left;

  &:active {
    opacity: 0.72;
  }
}

.ma-row-cover {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 8px;
  background: color-mix(in srgb, var(--ma-ink) 14%, transparent);
  object-fit: cover;
}

.ma-row-main {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.ma-row-name {
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ma-row-artist {
  overflow: hidden;
  color: var(--ma-ink-muted);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ma-row-play {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent-color) 16%, transparent);
  color: var(--accent-color);
  font-size: 16px;
}

.ma-song-card {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 3px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ma-ink);
  cursor: pointer;
  text-align: left;

  &:active {
    opacity: 0.75;
  }

  img {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 12px;
    background: color-mix(in srgb, var(--ma-ink) 8%, transparent);
    object-fit: cover;
  }

  strong {
    overflow: hidden;
    margin-top: 2px;
    font-size: 13px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    overflow: hidden;
    color: var(--ma-ink-muted);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.ma-grid-loading {
  display: grid;
  width: 120px;
  place-items: center;
  align-self: center;
  color: var(--ma-ink-muted);
  font-size: 20px;
}

/* 专辑单行横滑：与热门歌曲卡同宽的大卡 */
.ma-album-card {
  flex: 0 0 calc(50vw - 21px);
  min-width: 148px;
}

.ma-spin {
  display: inline-block;
  animation: ma-rotate 900ms linear infinite;
}

@keyframes ma-rotate {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- 简介容器（ⓘ FLIP 扩大） ---------- */
.ma-intro-layer {
  position: fixed;
  inset: 0;
  z-index: 130;
  background: rgba(0, 0, 0, 0.5);
}

.ma-intro-panel {
  position: absolute;
  top: 9vh;
  right: 16px;
  bottom: 11vh;
  left: 16px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 14px;
  padding: 24px 20px 18px;
  border-radius: 30px;
  background: color-mix(in srgb, var(--page-chrome-bg, #f5f3ef) 93%, #000 7%);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
  transform-origin: var(--intro-origin-x, 50%) var(--intro-origin-y, 50%);
}

.ma-intro-title {
  margin: 0;
  color: var(--m-text-primary, var(--d-text-primary, #20211f));
  font-size: 22px;
  font-weight: 800;
}

.ma-intro-body {
  overflow-y: auto;
  color: var(--m-text-primary, var(--d-text-primary, #20211f));
  font-size: 15px;
  line-height: 1.85;
  white-space: pre-wrap;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.ma-intro-collapse {
  min-height: 48px;
  justify-self: center;
  width: min(64%, 280px);
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--m-text-primary, #888) 12%, transparent);
  color: var(--m-text-primary, var(--d-text-primary, #20211f));
  font-size: 15px;
  font-weight: 700;

  &:active {
    transform: scale(0.97);
  }
}

.ma-intro-enter-active,
.ma-intro-leave-active {
  transition: background-color 260ms ease;

  .ma-intro-panel {
    transition:
      transform 400ms cubic-bezier(0.32, 0.72, 0, 1),
      opacity 240ms ease;
  }
}

.ma-intro-enter-from,
.ma-intro-leave-to {
  background: rgba(0, 0, 0, 0);

  .ma-intro-panel {
    opacity: 0.3;
    transform: scale(0.12);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ma-intro-enter-active,
  .ma-intro-leave-active {
    transition-duration: 80ms;

    .ma-intro-panel {
      transition-duration: 80ms;
    }
  }
}
</style>
