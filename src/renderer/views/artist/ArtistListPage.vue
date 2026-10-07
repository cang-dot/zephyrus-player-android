<template>
  <div class="artist-list-page h-full w-full page-bg transition-colors duration-500">
    <n-scrollbar ref="scrollbarRef" class="h-full" @scroll="handleScroll">
      <div class="alp-content w-full" style="padding-top: var(--mobile-topbar-inset)">
        <page-loading-placeholder v-if="loading" variant="artist" :label="t('common.loading')" />

        <template v-else>
          <!-- 全部歌曲：搜索框 + 单列列表 -->
          <div v-if="kind === 'songs'" class="alp-songs page-padding-x">
            <div class="alp-search">
              <i class="ri-search-line" />
              <input
                v-model="searchInput"
                type="text"
                :placeholder="t('comp.musicList.searchSongs')"
              />
              <button v-if="searchInput" type="button" @click="searchInput = ''">
                <i class="ri-close-circle-fill" />
              </button>
            </div>
            <song-item
              v-for="song in filteredSongs"
              :key="song.id"
              :item="formatSong(song)"
              :is-next="true"
              @play="handlePlay(song)"
            />
            <div v-if="!filteredSongs.length && !loading" class="alp-empty">
              {{ t('comp.musicList.noSearchResults') }}
            </div>
          </div>

          <!-- 专辑：两列网格 -->
          <div v-else class="alp-albums page-padding-x">
            <div class="grid grid-cols-2 gap-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
              <div
                v-for="album in albums"
                :key="album.id"
                class="alp-album-card cursor-pointer"
                @click="handleAlbumClick(album)"
              >
                <div class="relative aspect-square overflow-hidden rounded-2xl shadow-lg">
                  <img
                    :src="getImgUrl(album.picUrl, '500y500')"
                    :alt="album.name"
                    class="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <h3 class="alp-album-name">{{ album.name }}</h3>
                <p class="alp-album-date">{{ formatPublishTime(album.publishTime) }}</p>
              </div>
            </div>
            <div v-if="!albums.length && !loading" class="alp-empty">
              {{ t('artist.albums') }} · {{ t('common.noData') }}
            </div>
          </div>

          <!-- 加载状态 -->
          <div ref="loadMoreRef" class="alp-load-more">
            <span v-if="listLoading" class="alp-loading-dot" />
            <span v-else-if="!hasMore && list.length" class="alp-no-more">— {{ t('common.noMore') }} —</span>
          </div>
        </template>

        <div class="bottom-spacer" />
      </div>
    </n-scrollbar>

    <play-bottom />
  </div>
</template>

<script setup lang="ts">
import { NScrollbar, useMessage } from 'naive-ui';
import { computed, onActivated, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import { getArtistAlbums, getArtistTopSongs } from '@/api/artist';
import { getMusicDetail } from '@/api/music';
import { fetchQqSingerHotSongs } from '@/api/platformQrApi';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PageLoadingPlaceholder from '@/components/common/PageLoadingPlaceholder.vue';
import PlayBottom from '@/components/common/PlayBottom.vue';
import SongItem from '@/components/common/SongItem.vue';
import {
  registerMobileTopbarPresentation,
  unregisterMobileTopbarPresentation
} from '@/composables/useMobileTopbarMenu';
import router from '@/router';
import { usePlayerStore } from '@/store';
import { calculateAnimationDelay, getImgUrl, isMobile } from '@/utils';

defineOptions({ name: 'ArtistListPage' });

const { t } = useI18n();
const route = useRoute();
const playerStore = usePlayerStore();
const message = useMessage();

const kind = computed(() => (route.params.kind === 'albums' ? 'albums' : 'songs'));
const isQqArtist = computed(
  () => route.query.platform === 'qq' && Boolean(String(route.query.singerMID || '').trim())
);
const artistId = computed(() => Number(route.params.id));
const qqMid = computed(() => String(route.query.singerMID || route.params.id || '').trim());

const scrollbarRef = ref<any>(null);
const loadMoreRef = ref<HTMLElement | null>(null);
const loading = ref(false);
const listLoading = ref(false);
const hasMore = ref(true);
const page = ref(1);
const pageSize = 30;
const songs = ref<any[]>([]);
const albums = ref<any[]>([]);
const list = computed(() => (kind.value === 'songs' ? songs.value : albums.value));

// 歌曲过滤（「搜索歌曲」入口经 ?keyword= 预填）
const searchInput = ref(String(route.query.keyword || ''));
const filteredSongs = computed(() => {
  const keyword = searchInput.value.trim().toLowerCase();
  if (!keyword) return songs.value;
  return songs.value.filter(
    (song) =>
      String(song.name || '').toLowerCase().includes(keyword) ||
      (song.ar || []).some((artist: any) =>
        String(artist?.name || '').toLowerCase().includes(keyword)
      )
  );
});

let observer: IntersectionObserver | null = null;
let requestId = 0;

const title = computed(() =>
  kind.value === 'songs' ? t('artist.allSongs') : t('artist.albums')
);

const syncPresentation = () => {
  registerMobileTopbarPresentation({
    routePath: route.path,
    title: title.value
  });
};

const resetAndLoad = async () => {
  const generation = ++requestId;
  loading.value = true;
  page.value = 1;
  hasMore.value = true;
  songs.value = [];
  albums.value = [];
  try {
    if (kind.value === 'songs' && isQqArtist.value) {
      const result = await fetchQqSingerHotSongs(qqMid.value, 50, 0);
      if (generation !== requestId) return;
      songs.value = result.songs || [];
      hasMore.value = false;
      return;
    }
    await loadPage(generation);
  } catch (error) {
    console.error('[artistList] 加载失败:', error);
    message.error(t('common.loadFailed'));
  } finally {
    if (generation === requestId) loading.value = false;
  }
};

const loadPage = async (generation: number) => {
  if (listLoading.value || !hasMore.value) return;
  listLoading.value = true;
  try {
    if (kind.value === 'songs') {
      if (!artistId.value) {
        hasMore.value = false;
        return;
      }
      const res = await getArtistTopSongs({
        id: artistId.value,
        limit: pageSize,
        offset: (page.value - 1) * pageSize
      });
      if (generation !== requestId) return;
      const raw = res.data?.songs || [];
      if (raw.length) {
        const ids = raw.map((item: any) => item.id);
        const detail = await getMusicDetail(ids);
        if (generation !== requestId) return;
        const merged = (detail.data?.songs || raw).map((item: any) => ({
          ...item,
          picUrl: item.al?.picUrl || item.picUrl,
          song: { artists: item.ar, name: item.name, id: item.id }
        }));
        songs.value = page.value === 1 ? merged : [...songs.value, ...merged];
      }
      hasMore.value = raw.length === pageSize;
    } else {
      if (!artistId.value) {
        hasMore.value = false;
        return;
      }
      const res = await getArtistAlbums({
        id: artistId.value,
        limit: pageSize,
        offset: (page.value - 1) * pageSize
      });
      if (generation !== requestId) return;
      const raw = res.data?.hotAlbums || [];
      albums.value = page.value === 1 ? raw : [...albums.value, ...raw];
      hasMore.value = raw.length === pageSize;
    }
    page.value += 1;
  } catch (error) {
    console.error('[artistList] 翻页失败:', error);
    hasMore.value = false;
  } finally {
    if (generation === requestId) listLoading.value = false;
  }
};

const handleScroll = () => {
  /* 底部哨兵为主，滚动仅兜底触发 */
  if (scrollbarRef.value) {
    void tryLoadMore();
  }
};

let lastTriggerAt = 0;
const tryLoadMore = () => {
  const now = Date.now();
  if (now - lastTriggerAt < 600 || !hasMore.value || listLoading.value || loading.value) return;
  lastTriggerAt = now;
  void loadPage(requestId);
};

const formatSong = (item: any) =>
  item
    ? {
        ...item,
        picUrl: item.al?.picUrl || item.picUrl,
        song: { artists: item.ar, name: item.name, id: item.id }
      }
    : null;

const handlePlay = (song: any) => {
  if (!song) return;
  const playable = filteredSongs.value.map((item) => ({
    ...item,
    picUrl: item.al?.picUrl || item.picUrl
  }));
  const index = playable.findIndex((item) => String(item.id) === String(song.id));
  if (index >= 0) playable.splice(0, 0, ...playable.splice(index, 1));
  playerStore.setPlayList(playable);
  playerStore.setPlay(song);
};

const handleAlbumClick = (album: any) => {
  navigateToMusicList(router, {
    id: album.id,
    type: 'album',
    name: album.name,
    listInfo: { ...album, coverImgUrl: album.picUrl },
    canRemove: false
  });
};

const formatPublishTime = (time?: number | string) => {
  if (!time) return '';
  const date = new Date(Number(time));
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

const setupObserver = () => {
  observer?.disconnect();
  if (!loadMoreRef.value || !isMobile.value) return;
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void tryLoadMore();
    },
    { rootMargin: '300px' }
  );
  observer.observe(loadMoreRef.value);
};

onMounted(() => {
  syncPresentation();
  void resetAndLoad();
  setupObserver();
});

onActivated(() => {
  syncPresentation();
});

onUnmounted(() => {
  observer?.disconnect();
  observer = null;
  unregisterMobileTopbarPresentation(route.path);
});

watch(
  () => route.fullPath,
  (path, previous) => {
    if (path !== previous && route.name === 'artistList') {
      syncPresentation();
      void resetAndLoad();
    }
  }
);

// calculateAnimationDelay 供网格交错动画使用（保持与歌手页一致的动效习惯）
void calculateAnimationDelay;
</script>

<style scoped lang="scss">
.alp-content {
  min-height: 100%;
}

.alp-songs :deep(.song-item-container) {
  margin-bottom: 2px;
}

.alp-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 9px 12px;
  border: 1px solid var(--m-border, rgba(128, 128, 128, 0.2));
  border-radius: 12px;
  background: var(--m-surface-alt, rgba(128, 128, 128, 0.06));
  color: var(--m-text-muted, #999);

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--m-text-primary, inherit);
    font-size: 14px;
    outline: none;
  }

  button {
    display: grid;
    place-items: center;
    border: 0;
    background: transparent;
    color: var(--m-text-muted, #999);
    font-size: 16px;
  }
}

.alp-album-name {
  margin: 8px 0 0;
  overflow: hidden;
  color: var(--cover-text-primary, var(--m-text-primary, var(--text-color)));
  font-size: 14px;
  font-weight: 650;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.alp-album-date {
  margin: 4px 0 0;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  font-size: 11px;
}

.alp-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  font-size: 14px;
}

.alp-load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 0;
  min-height: 48px;
}

.alp-loading-dot {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(128, 128, 128, 0.25);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: alp-spin 800ms linear infinite;
}

@keyframes alp-spin {
  to {
    transform: rotate(360deg);
  }
}

.alp-no-more {
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  font-size: 12px;
}

.bottom-spacer {
  height: calc(var(--mobile-dock-content-inset, 144px) + var(--safe-area-inset-bottom, 0px) + 12px);
}
</style>
