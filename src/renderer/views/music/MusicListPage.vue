<template>
  <div class="music-list-page">
    <n-scrollbar ref="scrollbarRef" class="flex-1 min-h-0" @scroll="handleScroll">
      <div class="music-list-content">
        <!-- Loading skeleton -->
        <div v-if="loading" class="hero-skeleton">
          <div class="skeleton-cover skeleton-shimmer" />
          <div class="skeleton-info">
            <div class="skeleton-title skeleton-shimmer" />
            <div class="skeleton-badge skeleton-shimmer" />
            <div class="skeleton-meta skeleton-shimmer" />
          </div>
        </div>

        <template v-else>
          <!--
            Hero Zone — 信息+控制合为一体
            展开态: [封面] / [标题+详情] / [控制栏]  纵向居中
            收缩态: [小封面] [标题]  [播放] [收藏]   横向单行
            同一组 DOM 元素通过 CSS 形变实现过渡，不创建新对象
          -->
          <section class="hero-zone" :class="{ compact: isCompact }">
            <!-- 封面：160px → 40px -->
            <div class="cover-wrap">
              <img
                :src="getImgUrl(getCoverImgUrl, '500y500')"
                class="cover-img"
                alt=""
                draggable="false"
              />
            </div>

            <!-- 文字区：标题始终可见，详情收缩时淡出 -->
            <div class="hero-text">
              <h1 ref="titleElRef" class="hero-title">{{ name }}</h1>
              <div class="hero-detail">
                <div class="hero-badge-row">
                  <span class="hero-badge">{{ isAlbum ? 'Album' : 'Playlist' }}</span>
                </div>
                <div class="hero-meta">
                  <div v-if="isAlbum && listInfo?.artist" class="meta-creator">
                    <img
                      :src="getImgUrl(listInfo.artist.picUrl, '50y50')"
                      class="meta-avatar"
                      alt=""
                    />
                    <span class="meta-name" @click="navigateToArtist(listInfo.artist.id)">{{
                      listInfo.artist.name
                    }}</span>
                  </div>
                  <div v-else-if="!isAlbum && listInfo?.creator" class="meta-creator">
                    <img
                      :src="getImgUrl(listInfo.creator.avatarUrl, '50y50')"
                      class="meta-avatar"
                      alt=""
                    />
                    <span class="meta-name">{{ listInfo.creator.nickname }}</span>
                  </div>
                  <span class="meta-count">{{ t('common.songCount', { count: total }) }}</span>
                </div>
                <div
                  v-if="listInfo?.description"
                  class="hero-desc"
                  @click.stop="showDescriptionPopover = !showDescriptionPopover"
                >
                  {{ listInfo.description }}
                </div>
              </div>
            </div>

            <!-- 控制区：播放全部+收藏始终可见，其余收缩时淡出 -->
            <div v-if="songList.length > 0" class="hero-controls">
              <button class="play-all-btn" @click="handlePlayAll">
                <i class="ri-play-fill" />
                <span class="play-all-label">{{ t('comp.musicList.playAll') }}</span>
              </button>

              <button
                v-if="canCollect"
                class="collect-btn"
                :class="{ collected: isCollected }"
                @click="toggleCollect"
              >
                <i :class="isCollected ? 'ri-heart-fill' : 'ri-heart-line'" />
              </button>

              <button
                v-if="currentPlayingIndex >= 0"
                class="icon-btn"
                :title="t('comp.musicList.locateCurrent', '定位当前播放')"
                @click="scrollToCurrentSong"
              >
                <i class="ri-focus-3-line" />
              </button>

              <!-- 额外控制：选择/搜索/排序等，收缩态隐藏 -->
              <div class="controls-extra">
                <button v-if="!isSelecting && isElectron" class="icon-btn" @click="startSelect">
                  <i class="ri-checkbox-multiple-line" />
                </button>

                <div v-if="isSelecting" class="batch-actions">
                  <n-checkbox
                    :checked="isAllSelected"
                    :indeterminate="isIndeterminate"
                    @update:checked="handleSelectAll"
                  >
                    {{ t('common.selectAll') }}
                  </n-checkbox>
                  <button
                    class="batch-btn"
                    :disabled="selectedSongs.length === 0 || isDownloading"
                    @click="handleBatchDownload"
                  >
                    <i class="ri-download-line" />
                    {{ t('favorite.download', { count: selectedSongs.length }) }}
                  </button>
                  <button
                    class="batch-btn"
                    :disabled="selectedSongs.length === 0"
                    @click="handleAddToPlaylist"
                  >
                    <i class="ri-play-list-add-line" />
                    {{ t('comp.musicList.addToPlaylist') }}
                  </button>
                  <button class="cancel-btn" @click="cancelSelect">{{ t('common.cancel') }}</button>
                </div>

                <div class="hidden sm:block list-search-wrap">
                  <n-input
                    v-model:value="searchKeyword"
                    :placeholder="t('comp.musicList.searchSongs')"
                    round
                    clearable
                    size="small"
                    class="list-search-input"
                  >
                    <template #prefix>
                      <i class="ri-search-line text-neutral-400"></i>
                    </template>
                  </n-input>
                </div>

                <button v-if="!isMobile" class="icon-btn" @click="toggleLayout">
                  <i :class="isCompactLayout ? 'ri-list-check-2' : 'ri-grid-line'" />
                </button>

                <n-dropdown :options="sortOptions" :value="sortBy" @select="handleSortChange">
                  <button class="icon-btn">
                    <i class="ri-sort-asc" />
                  </button>
                </n-dropdown>
              </div>
            </div>
          </section>
        </template>

        <!-- 专辑介绍弹窗 -->
        <Teleport to="body">
          <Transition name="popover-fade">
            <div
              v-if="showDescriptionPopover"
              class="description-popover-overlay"
              @click.stop="showDescriptionPopover = false"
            ></div>
          </Transition>
          <Transition name="popover-slide">
            <div v-if="showDescriptionPopover" class="description-popover-card" @click.stop>
              <p class="description-popover-title">专辑介绍</p>
              <p class="description-popover-text">{{ listInfo?.description }}</p>
            </div>
          </Transition>
        </Teleport>

        <!-- List Content -->
        <section class="song-list-section">
          <div v-if="filteredSongs.length === 0 && searchKeyword" class="empty-state">
            <i class="ri-search-line"></i>
            <p>{{ t('comp.musicList.noSearchResults') }}</p>
          </div>

          <div v-else class="song-list-container">
            <div
              v-for="(item, index) in filteredSongs"
              :key="item.id"
              class="song-item-wrap"
              :class="{ 'animate-item': index < initialAnimateCount }"
              :style="
                index < initialAnimateCount
                  ? { animationDelay: calculateAnimationDelay(index, 0.03) }
                  : undefined
              "
            >
              <song-item
                :index="index"
                :compact="isCompactLayout"
                :item="formatSong(item)"
                :can-remove="canRemove"
                :selectable="isSelecting"
                :selected="selectedSongs.includes(item.id as number)"
                @play="handlePlayItem(item)"
                @remove-song="handleRemoveSong"
                @select="(id, selected) => handleSelect(id, selected)"
              />
            </div>

            <div v-if="placeholderHeight > 0" :style="{ height: placeholderHeight + 'px' }" />

            <div v-if="loadingList" class="list-loading">
              <n-spin :size="18" />
              <span>{{ t('common.loading') }}</span>
            </div>
            <div
              v-else-if="
                !hasMore &&
                renderLimit >= allFilteredSongs.length &&
                filteredSongs.length > 0 &&
                !searchKeyword
              "
              class="list-end"
            >
              {{ t('common.noMore') }}
            </div>
          </div>
        </section>
      </div>
    </n-scrollbar>
    <play-bottom />
  </div>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui';
import PinyinMatch from 'pinyin-match';
import { computed, nextTick, onActivated, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import { getAlbum, getListDetail } from '@/api/list';
import {
  getMusicDetail,
  subscribeAlbum,
  subscribePlaylist,
  updatePlaylistTracks
} from '@/api/music';
import playlistPlaceholder from '@/assets/icon_512.png';
import PlayBottom from '@/components/common/PlayBottom.vue';
import SongItem from '@/components/common/SongItem.vue';
import { useDownload } from '@/hooks/useDownload';
import { useOverlayNavigate } from '@/hooks/useOverlayNavigate';
import { usePlaylistConfirm } from '@/hooks/usePlaylistConfirm';
import { useScrollTitle } from '@/hooks/useScrollTitle';
import { useMusicStore, usePlayerStore, useRecommendStore, useUserStore } from '@/store';
import { useLocalPlaylistStore } from '@/store/modules/localPlaylist';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import { SongResult } from '@/types/music';
import { calculateAnimationDelay, getImgUrl, isElectron, isMobile } from '@/utils';
import { getLoginErrorMessage, hasPermission } from '@/utils/auth';

defineOptions({
  name: 'MusicList'
});

const { confirmPlaylistReplace } = usePlaylistConfirm();

const { t } = useI18n();
const route = useRoute();
const { navigate } = useOverlayNavigate();
const navigateToArtist = (id: number) => navigate(`/artist/detail/${id}`);
const playerStore = usePlayerStore();
const musicStore = useMusicStore();
const recommendStore = useRecommendStore();
const userStore = useUserStore();
const message = useMessage();
const playHistoryStore = usePlayHistoryStore();

const loading = ref(true);

const fetchData = async () => {
  const id = route.params.id;
  const type = route.query.type;

  if (!id || type === 'dailyRecommend') {
    loading.value = false;
    return;
  }

  // 检查是否需要加载数据
  if (
    musicStore.currentListInfo?.id?.toString() === id.toString() &&
    musicStore.currentMusicList &&
    musicStore.currentMusicList.length > 0
  ) {
    loading.value = false;
    return;
  }

  // 需要加载：立即显示骨架屏
  loading.value = true;
  try {
    let data: any;
    if (type === 'album') {
      const res = await getAlbum(Number(id));
      data = res.data;
      if (data.code === 200) {
        musicStore.setCurrentMusicList(
          data.songs,
          data.album.name,
          { ...data.album, picUrl: data.album.picUrl },
          false
        );
      } else {
        message.error(t('common.loadFailed'));
      }
    } else if (type === 'playlist') {
      const res = await getListDetail(id.toString());
      data = res.data;
      if (data.code === 200) {
        const playlist = data.playlist;
        musicStore.setCurrentMusicList(
          playlist.tracks || [],
          playlist.name,
          playlist,
          playlist.creator?.userId === userStore.user?.userId
        );
      } else {
        message.error(t('common.loadFailed'));
      }
    } else if (type === 'server-album') {
      // 云端同名专辑：从 songs.json 按专辑名聚合
      const { getServerAlbumSongs } = await import('@/api/serverSongs');
      const albumName = decodeURIComponent(String(id));
      const songs = await getServerAlbumSongs(albumName);
      if (songs.length > 0) {
        musicStore.setCurrentMusicList(
          songs,
          albumName,
          {
            id: albumName,
            name: albumName,
            artist: songs[0].ar?.[0]?.name || '',
            picUrl: songs[0].picUrl,
            type: 'server-album'
          },
          false
        );
      } else {
        message.error(t('common.loadFailed'));
      }
    }
  } catch (error) {
    console.error('加载列表数据失败:', error);
    message.error(t('common.loadFailed'));
  } finally {
    loading.value = false;
  }
};

watch(
  () => route.fullPath,
  () => {
    fetchData();
  },
  { immediate: true }
);
const isDailyRecommend = computed(() => route.query.type === 'dailyRecommend');
const isAlbum = computed(() => route.query.type === 'album' || route.query.type === 'server-album');

const name = computed(() => {
  if (isDailyRecommend.value) return t('comp.recommendSinger.songlist');
  return musicStore.currentMusicListName || '';
});

const titleElRef = ref<HTMLElement | null>(null);
useScrollTitle(name, titleElRef);

const songList = computed(() => {
  if (isDailyRecommend.value) return recommendStore.dailyRecommendSongs;
  const neteaseSongs = musicStore.currentMusicList || [];

  // 合并本地附加歌曲（本地/云端/跨平台歌曲仅在本地展示）
  const playlistId = route.query.id;
  if (playlistId && !isAlbum.value) {
    try {
      const localPlaylistStore = useLocalPlaylistStore();
      const localSongs = localPlaylistStore.getLocalSongs(Number(playlistId));
      if (localSongs.length > 0) {
        return [...neteaseSongs, ...localSongs];
      }
    } catch {
      // store 未加载时忽略
    }
  }

  return neteaseSongs;
});

const listInfo = computed(() => {
  if (isDailyRecommend.value) return null;
  return musicStore.currentListInfo || null;
});

const canRemove = computed(() => {
  if (isDailyRecommend.value) return false;
  return musicStore.canRemoveSong || false;
});

const canCollect = ref(false);
const isCollected = ref(false);
const pageSize = 40;
const initialAnimateCount = 20; // 仅前 20 项有入场动画
const displayedSongs = ref<SongResult[]>([]);
const renderLimit = ref(pageSize); // DOM 渲染上限，数据全部在内存
const loadingList = ref(false);
const loadedIds = ref(new Set<number>());
const isPlaylistLoading = ref(false);
const completePlaylist = ref<SongResult[]>([]);
const hasMore = ref(true);
const searchKeyword = ref('');

// 排序方式
type SortType =
  | 'default'
  | 'name-asc'
  | 'name-desc'
  | 'artist-asc'
  | 'artist-desc'
  | 'album-asc'
  | 'album-desc'
  | 'duration-asc'
  | 'duration-desc';
const sortBy = ref<SortType>('default');

// 专辑介绍弹窗
const showDescriptionPopover = ref(false);
const isFullPlaylistLoaded = ref(false);

const isSelecting = ref(false);
const selectedSongs = ref<number[]>([]);
const { isDownloading, batchDownloadMusic } = useDownload();

const isCompactLayout = ref(
  isMobile.value ? false : localStorage.getItem('musicListLayout') === 'compact'
);

// Hero zone morphing state — 滚动时驱动形变
const isCompact = ref(false);

const total = computed(() => {
  if (listInfo.value?.trackIds) return listInfo.value.trackIds.length;
  return songList.value.length;
});

const getCoverImgUrl = computed(() => {
  const coverImgUrl = listInfo.value?.coverImgUrl || listInfo.value?.picUrl;
  if (coverImgUrl) return coverImgUrl;
  const song = songList.value[0];
  return song?.picUrl || song?.al?.picUrl || song?.album?.picUrl || playlistPlaceholder;
});

// 全量歌曲列表（用于"播放全部"等操作）
const allFilteredSongs = computed(() => {
  const sourceList = isDailyRecommend.value ? songList.value : displayedSongs.value;
  const filtered = sourceList.filter((s) => !playerStore.dislikeList.includes(s.id));

  // 排序
  if (sortBy.value === 'default') return filtered;

  const sorted = [...filtered];
  switch (sortBy.value) {
    case 'name-asc':
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
    case 'name-desc':
      sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      break;
    case 'artist-asc':
      sorted.sort((a, b) => {
        const aName = a.ar?.[0]?.name || a.artists?.[0]?.name || '';
        const bName = b.ar?.[0]?.name || b.artists?.[0]?.name || '';
        return aName.localeCompare(bName);
      });
      break;
    case 'artist-desc':
      sorted.sort((a, b) => {
        const aName = a.ar?.[0]?.name || a.artists?.[0]?.name || '';
        const bName = b.ar?.[0]?.name || b.artists?.[0]?.name || '';
        return bName.localeCompare(aName);
      });
      break;
    case 'album-asc':
      sorted.sort((a, b) => (a.al?.name || '').localeCompare(b.al?.name || ''));
      break;
    case 'album-desc':
      sorted.sort((a, b) => (b.al?.name || '').localeCompare(a.al?.name || ''));
      break;
    case 'duration-asc':
      sorted.sort((a, b) => (a.dt || a.duration || 0) - (b.dt || b.duration || 0));
      break;
    case 'duration-desc':
      sorted.sort((a, b) => (b.dt || b.duration || 0) - (a.dt || a.duration || 0));
      break;
  }
  return sorted;
});

// 实际渲染到 DOM 的歌曲（搜索时显示全部匹配，非搜索时按 renderLimit 分页渲染）
const filteredSongs = computed(() => {
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase().trim();
    return allFilteredSongs.value.filter((song) => {
      const songName = song.name?.toLowerCase() || '';
      const albumName = song.al?.name?.toLowerCase() || '';
      const artists = song.ar || song.artists || [];
      return (
        songName.includes(keyword) ||
        albumName.includes(keyword) ||
        artists.some((a: any) => a.name?.toLowerCase().includes(keyword)) ||
        PinyinMatch.match(songName, keyword)
      );
    });
  }
  return allFilteredSongs.value.slice(0, renderLimit.value);
});

// 未渲染项的占位高度，让滚动条从一开始就反映真实总高度
const estimatedItemHeight = computed(() => (isCompactLayout.value ? 50 : 70));
const placeholderHeight = computed(() => {
  if (searchKeyword.value) return 0;
  const unrenderedCount = allFilteredSongs.value.length - filteredSongs.value.length;
  return Math.max(0, unrenderedCount) * estimatedItemHeight.value;
});

const resetListState = () => {
  loadedIds.value.clear();
  displayedSongs.value = [];
  completePlaylist.value = [];
  hasMore.value = true;
  isFullPlaylistLoaded.value = false;
};

const formatSong = (item: any) => {
  if (!item) return null;
  // 专辑歌曲的 al.picUrl 可能为空，使用专辑封面兜底
  const picUrl = item.al?.picUrl || item.picUrl || (isAlbum.value ? getCoverImgUrl.value : '');
  return {
    ...item,
    picUrl,
    song: {
      artists: item.ar || item.artists,
      name: item.name,
      id: item.id
    }
  };
};

const loadSongs = async (ids: number[], appendToList = true, updateComplete = false) => {
  if (ids.length === 0) return [];
  try {
    const { data } = await getMusicDetail(ids);
    if (data?.songs) {
      const { songs } = data;
      songs.forEach((song: any) => loadedIds.value.add(song.id));
      if (appendToList) displayedSongs.value.push(...songs);
      if (updateComplete) completePlaylist.value.push(...songs);
      return songs;
    }
  } catch (error) {
    console.error('加载歌曲失败:', error);
  }
  return [];
};

const loadFullPlaylist = async () => {
  if (isPlaylistLoading.value || isFullPlaylistLoaded.value) return;
  isPlaylistLoading.value = true;
  try {
    if (!listInfo.value?.trackIds) {
      isFullPlaylistLoaded.value = true;
      return;
    }
    const allIds = listInfo.value.trackIds.map((item) => item.id);
    const loadedSongIds = new Set(displayedSongs.value.map((s) => s.id as number));
    completePlaylist.value = [...displayedSongs.value];
    const unloadedIds = allIds.filter((id) => !loadedSongIds.has(id));

    if (unloadedIds.length === 0) {
      isFullPlaylistLoaded.value = true;
      return;
    }

    const batchSize = 500;
    for (let i = 0; i < unloadedIds.length; i += batchSize) {
      const batchIds = unloadedIds.slice(i, i + batchSize);
      const loadedBatch = await loadSongs(batchIds, false, false);
      if (loadedBatch.length > 0) {
        displayedSongs.value = [...displayedSongs.value, ...loadedBatch];
        completePlaylist.value = [...completePlaylist.value, ...loadedBatch];
      }
    }
    isFullPlaylistLoaded.value = true;
    hasMore.value = false;
  } catch (error) {
    console.error('加载完整播放列表失败:', error);
  } finally {
    isPlaylistLoading.value = false;
  }
};

const handlePlayAll = () => {
  if (displayedSongs.value.length === 0) return;
  confirmPlaylistReplace(() => {
    saveHistory();
    const list = searchKeyword.value
      ? filteredSongs.value
      : isFullPlaylistLoaded.value
        ? completePlaylist.value
        : allFilteredSongs.value;
    playerStore.setPlayList(list.map(formatSong));
    playerStore.setPlay(formatSong(list[0]));
    if (!isFullPlaylistLoaded.value) loadFullPlaylist();
  });
};

const handlePlayItem = (item: any) => {
  confirmPlaylistReplace(() => {
    playerStore.setPlay(formatSong(item));
    if (!playerStore.playList.some((s) => s.id === item.id)) {
      playerStore.addToNextPlay(formatSong(item));
    }
  });
};

const handleRemoveSong = async (songId: number) => {
  if (!listInfo.value?.id || !canRemove.value) return;
  try {
    const res = await updatePlaylistTracks({
      op: 'del',
      pid: listInfo.value.id,
      tracks: songId.toString()
    });
    if (res.status === 200) {
      message.success(t('user.message.deleteSuccess'));
      displayedSongs.value = displayedSongs.value.filter((s) => s.id !== songId);
      completePlaylist.value = completePlaylist.value.filter((s) => s.id !== songId);
      musicStore.removeSongFromList(songId);
    }
  } catch (error) {
    console.error('删除歌曲失败:', error);
    message.error(t('user.message.deleteFailed'));
  }
};

// 滞回阈值：进入和退出用不同阈值，防止高度变化→滚动位移→状态翻转的反馈循环
const COMPACT_ENTER = 80; // 滚动超过 80px 才收缩
const COMPACT_EXIT = 10; // 回滚到 10px 以内才展开
// transition 期间锁定状态，防止动画过程中反复触发
let compactLocked = false;

const setCompact = (val: boolean) => {
  if (val === isCompact.value) return;
  if (compactLocked) return;
  isCompact.value = val;
  compactLocked = true;
  // 等过渡动画完成后再解锁
  setTimeout(() => {
    compactLocked = false;
  }, 450);
};

// 根据滚动位置计算需要渲染多少项，快速滚动也不会出现空白
const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight } = target;

  // 滞回判断：选择模式下始终展开
  if (!isSelecting.value) {
    if (!isCompact.value && scrollTop > COMPACT_ENTER) {
      setCompact(true);
    } else if (isCompact.value && scrollTop < COMPACT_EXIT) {
      setCompact(false);
    }
  }

  if (searchKeyword.value) return;

  // 列表区域在滚动内容中的起始偏移（hero zone 高度 + margin）
  const listSection = document.querySelector('.song-list-section') as HTMLElement;
  const listStart = listSection?.offsetTop || 0;

  // 当前可见区域底部在列表中的位置
  const visibleBottom = scrollTop + clientHeight - listStart;
  if (visibleBottom <= 0) return;

  // 计算需要渲染到第几项（多渲染一屏作为缓冲）
  const bufferHeight = clientHeight;
  const neededIndex = Math.ceil((visibleBottom + bufferHeight) / estimatedItemHeight.value);
  const allCount = allFilteredSongs.value.length;

  if (neededIndex > renderLimit.value) {
    renderLimit.value = Math.min(neededIndex, allCount);
  }

  // 内存数据全部渲染完但还有更多数据需要从 API 加载
  if (renderLimit.value >= allCount && !loadingList.value && hasMore.value) {
    loadMoreSongs();
  }
};

const loadMoreSongs = async () => {
  if (
    isFullPlaylistLoaded.value ||
    searchKeyword.value ||
    displayedSongs.value.length >= total.value
  )
    return;
  loadingList.value = true;
  try {
    const start = displayedSongs.value.length;
    const end = Math.min(start + pageSize, total.value);
    if (listInfo.value?.trackIds) {
      const ids = listInfo.value.trackIds
        .slice(start, end)
        .map((i) => i.id)
        .filter((id) => !loadedIds.value.has(id));
      if (ids.length > 0) await loadSongs(ids);
    }
    hasMore.value = displayedSongs.value.length < total.value;
    // 新数据加载后扩展渲染窗口
    renderLimit.value = displayedSongs.value.length;
  } finally {
    loadingList.value = false;
  }
};

const saveHistory = () => {
  if (!listInfo.value?.id) return;
  if (route.query.type === 'album') {
    playHistoryStore.addAlbum({
      id: listInfo.value.id,
      name: listInfo.value.name || '',
      picUrl: getCoverImgUrl.value,
      size: total.value,
      artist: listInfo.value.artist
    });
  } else if (route.query.type === 'playlist') {
    playHistoryStore.addPlaylist({
      id: listInfo.value.id,
      name: listInfo.value.name || '',
      coverImgUrl: getCoverImgUrl.value,
      trackCount: total.value,
      playCount: listInfo.value.playCount,
      creator: listInfo.value.creator
    });
  }
};

const toggleCollect = async () => {
  if (route.query.type === 'server-album') return;
  if (!listInfo.value?.id || !hasPermission(true)) {
    if (!listInfo.value?.id) return;
    message.error(getLoginErrorMessage(true));
    return;
  }
  const type = route.query.type as string;
  try {
    const tVal = isCollected.value ? 2 : 1;
    const response =
      type === 'album'
        ? await subscribeAlbum({ t: tVal, id: listInfo.value.id })
        : await subscribePlaylist({ t: tVal, id: listInfo.value.id });
    if (response.data.code === 200) {
      isCollected.value = !isCollected.value;
      message.success(
        t(
          isCollected.value
            ? 'comp.musicList.collectSuccess'
            : 'comp.musicList.cancelCollectSuccess'
        )
      );
      if (type === 'album') {
        isCollected.value
          ? userStore.addCollectedAlbum(listInfo.value.id)
          : userStore.removeCollectedAlbum(listInfo.value.id);
      } else {
        listInfo.value.subscribed = isCollected.value;
      }
    }
  } catch (error) {
    console.error('操作收藏失败:', error);
    message.error(t('comp.musicList.operationFailed'));
  }
};

const startSelect = () => {
  isSelecting.value = true;
  selectedSongs.value = [];
};
const cancelSelect = () => {
  isSelecting.value = false;
  selectedSongs.value = [];
};
const handleSelect = (id: number, selected: boolean) => {
  selected
    ? selectedSongs.value.push(id)
    : (selectedSongs.value = selectedSongs.value.filter((i) => i !== id));
};
const isAllSelected = computed(
  () => filteredSongs.value.length > 0 && selectedSongs.value.length === filteredSongs.value.length
);
const isIndeterminate = computed(
  () => selectedSongs.value.length > 0 && selectedSongs.value.length < filteredSongs.value.length
);
const handleSelectAll = (checked: boolean) => {
  selectedSongs.value = checked ? filteredSongs.value.map((s) => s.id as number) : [];
};
const handleBatchDownload = async () => {
  const list = selectedSongs.value
    .map((id) => filteredSongs.value.find((s) => s.id === id))
    .filter((s) => s) as SongResult[];
  await batchDownloadMusic(list);
  cancelSelect();
};

const handleAddToPlaylist = () => {
  const songs = selectedSongs.value
    .map((id) => filteredSongs.value.find((s) => s.id === id))
    .filter((s) => s)
    .map((s) => formatSong(s))
    .filter((s) => s) as SongResult[];
  if (songs.length === 0) return;

  const currentList = playerStore.playList;
  const newSongs = songs.filter((s) => !currentList.some((item) => item.id === s.id));
  if (newSongs.length === 0) {
    message.warning(t('comp.musicList.songsAlreadyInPlaylist'));
    return;
  }

  playerStore.setPlayList([...currentList, ...newSongs], true);
  message.success(t('comp.musicList.addToPlaylistSuccess', { count: newSongs.length }));
  cancelSelect();
};

// 当前播放歌曲在列表中的索引
const currentPlayingIndex = computed(() => {
  const currentId = playerStore.playMusic?.id;
  if (!currentId) return -1;
  return allFilteredSongs.value.findIndex((s) => s.id === currentId);
});

const scrollbarRef = ref<any>(null);

// 滚动到当前播放歌曲
const scrollToCurrentSong = async () => {
  const index = currentPlayingIndex.value;
  if (index < 0) return;

  // 确保目标歌曲已渲染到 DOM
  if (index >= renderLimit.value) {
    renderLimit.value = index + 5;
    await nextTick();
  }

  const container = document.querySelector('.song-list-container') as HTMLElement;
  const target = container?.children[index] as HTMLElement;
  if (!target || !scrollbarRef.value) return;

  // 获取 n-scrollbar 内部的可滚动容器
  const scrollEl = document.querySelector('.music-list-page .n-scrollbar-container') as HTMLElement;
  if (!scrollEl) return;

  // 用 getBoundingClientRect 精确测量目标位置
  const scrollRect = scrollEl.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const currentScrollTop = scrollEl.scrollTop;

  // 目标在滚动内容中的绝对位置
  const targetAbsoluteTop = currentScrollTop + targetRect.top - scrollRect.top;

  // 粘性 hero-zone 占用的高度
  const heroZoneEl = document.querySelector('.hero-zone') as HTMLElement;
  const heroZoneHeight = heroZoneEl?.offsetHeight || 0;

  // 可视区域高度（去掉 hero zone）
  const visibleHeight = scrollRect.height - heroZoneHeight;

  // 滚动到目标居中（在可视区域中间）
  const scrollTop = targetAbsoluteTop - heroZoneHeight - visibleHeight / 2 + targetRect.height / 2;

  scrollbarRef.value.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });

  // 短暂高亮效果
  await nextTick();
  target.classList.add('song-highlight');
  setTimeout(() => target.classList.remove('song-highlight'), 2000);
};

const toggleLayout = () => {
  isCompactLayout.value = !isCompactLayout.value;
  localStorage.setItem('musicListLayout', isCompactLayout.value ? 'compact' : 'normal');
};

// 排序选项
const sortOptions = [
  { label: '默认排序', key: 'default' },
  { label: '歌曲名 A→Z', key: 'name-asc' },
  { label: '歌曲名 Z→A', key: 'name-desc' },
  { label: '歌手名 A→Z', key: 'artist-asc' },
  { label: '歌手名 Z→A', key: 'artist-desc' },
  { label: '专辑名 A→Z', key: 'album-asc' },
  { label: '专辑名 Z→A', key: 'album-desc' },
  { label: '时长 短→长', key: 'duration-asc' },
  { label: '时长 长→短', key: 'duration-desc' }
];

const handleSortChange = (key: SortType) => {
  sortBy.value = key;
};

const checkCollectionStatus = () => {
  const type = route.query.type as string;
  if (type === 'playlist' && listInfo.value?.id) {
    canCollect.value = true;
    isCollected.value = listInfo.value.subscribed || false;
  } else if (type === 'album' && listInfo.value?.id) {
    canCollect.value = true;
    isCollected.value = userStore.isAlbumCollected(listInfo.value.id);
  } else {
    canCollect.value = false;
  }
};

// 进入选择模式时强制展开 hero-zone
watch(isSelecting, (selecting) => {
  if (selecting) {
    isCompact.value = false;
    compactLocked = false;
  }
});

watch(
  songList,
  (newSongs) => {
    resetListState();
    renderLimit.value = pageSize; // 重置 DOM 渲染窗口
    if (newSongs.length > 0) {
      displayedSongs.value = [...newSongs];
      newSongs.forEach((s) => loadedIds.value.add(s.id));
    }
    hasMore.value = displayedSongs.value.length < total.value;
    checkCollectionStatus();
  },
  { immediate: true }
);

onMounted(() => {
  checkCollectionStatus();
});

// keep-alive 重新激活时重置状态
onActivated(() => {
  isCompact.value = false;
  compactLocked = false;
  if (scrollbarRef.value) {
    scrollbarRef.value.scrollTo(0);
  }
});
</script>

<style scoped lang="scss">
$spring: cubic-bezier(0.34, 1.56, 0.64, 1);

.music-list-page {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.music-list-content {
  padding-top: calc(var(--safe-area-inset-top, 0px) + 56px);
}

/* ===== Loading skeleton ===== */
.hero-skeleton {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 20px;
  margin: 0 16px;
}
.skeleton-cover {
  width: 160px;
  height: 160px;
  border-radius: 16px;
}
.skeleton-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 280px;
}
.skeleton-title {
  height: 24px;
  width: 70%;
  border-radius: 8px;
}
.skeleton-badge {
  height: 18px;
  width: 80px;
  border-radius: 9999px;
}
.skeleton-meta {
  height: 14px;
  width: 50%;
  border-radius: 6px;
}
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    rgba(128, 128, 128, 0.08) 25%,
    rgba(128, 128, 128, 0.16) 50%,
    rgba(128, 128, 128, 0.08) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* ============================================================
   Hero Zone — 单一形变容器
   展开态: flex-direction column, 封面居中 160px, 标题 24px
   收缩态: flex-direction row, 封面 40px 靠左, 标题 15px, 控制靠右
   同一组 DOM 元素，通过 CSS transition 实现形变
   overflow:hidden + max-height 过渡平滑遮盖 flex-direction 瞬切
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

  /* 展开态：纵向排列，居中 */
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

  /* 收缩态：横向单行 */
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

/* ===== 封面：160px → 40px ===== */
.cover-wrap {
  flex-shrink: 0;
  display: flex;
  justify-content: center;

  .hero-zone.compact & {
    justify-content: flex-start;
  }
}

.cover-img {
  width: 160px;
  height: 160px;
  border-radius: 16px;
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

/* ===== 文字区 ===== */
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

/* 详情区（badge + meta + desc）：收缩时淡出+折叠 */
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
  /* no extra margin needed */
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
  gap: 8px;
  margin-top: 8px;
}
.meta-creator {
  display: flex;
  align-items: center;
  gap: 6px;
}
.meta-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}
.meta-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--cover-text-secondary, var(--m-text-secondary, #6b6560));
  cursor: pointer;
}
.meta-count {
  font-size: 12px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
}

.hero-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  margin-top: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
}

/* ===== 控制区 ===== */
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

/* 额外控制（选择/搜索/排序等）：收缩时淡出+折叠 */
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

/* 播放全部按钮：收缩时缩小 */
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

/* 收藏按钮：收缩时缩小 */
.collect-btn {
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
  transition:
    width 0.3s $spring,
    height 0.3s $spring,
    font-size 0.3s $spring;

  .hero-zone.compact & {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }

  &.collected {
    color: #ef4444;
  }
  &:active {
    transform: scale(0.88);
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
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.batch-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 9999px;
  border: none;
  background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.1);
  color: var(--accent-color, #888);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
.cancel-btn {
  border: none;
  background: transparent;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  font-size: 12px;
  cursor: pointer;
}

.list-search-wrap {
  width: 180px;
}
.list-search-input {
  border: none !important;
  background: rgba(128, 128, 128, 0.1) !important;
}

/* ===== Song list ===== */
.song-list-section {
  padding: 0 16px;
  margin-top: 4px;
}
.song-list-container {
  padding-bottom: 20px;
}
.song-item-wrap {
  margin-bottom: 6px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 12px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  i {
    font-size: 48px;
    opacity: 0.2;
  }
  p {
    font-size: 14px;
  }
}

.list-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
  gap: 8px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  font-size: 14px;
}
.list-end {
  padding: 24px 0;
  text-align: center;
  font-size: 14px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
}

.animate-item {
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.song-highlight {
  animation: highlightPulse 2s ease-out;
}
@keyframes highlightPulse {
  0%,
  30% {
    background-color: rgba(var(--accent-color-rgb), 0.15);
    border-radius: 12px;
  }
  100% {
    background-color: transparent;
  }
}

/* ===== Description popover ===== */
.description-popover-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: rgba(0, 0, 0, 0.4);
}
.description-popover-card {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 20px;
  background: var(--cover-bg, #fff);
  border-radius: 20px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.2);
  max-width: 400px;
  width: 90vw;
  max-height: 70vh;
  overflow-y: auto;
  z-index: 9999;
}
.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: opacity 0.2s ease;
}
.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
}
.popover-slide-enter-active {
  transition: all 0.25s $spring;
}
.popover-slide-leave-active {
  transition: all 0.2s ease;
}
.popover-slide-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.92);
}
.popover-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.92);
}
.description-popover-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--cover-text-primary, #1a1a1a);
  margin-bottom: 12px;
}
.description-popover-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--cover-text-muted, #666);
  white-space: pre-wrap;
  word-break: break-word;
}

@media (prefers-reduced-motion: reduce) {
  .animate-item {
    animation: none;
  }
}
</style>
