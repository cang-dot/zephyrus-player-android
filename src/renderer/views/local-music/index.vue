<template>
  <div class="local-music-page">
    <!-- ==================== 移动端（Capacitor） ==================== -->
    <div v-if="isMobileNative" ref="scrollRef" class="lm-scroll" @scroll.passive="onScroll">
      <!-- Hero Card -->
      <div class="hero-card" :class="{ compact: isCompact }">
        <div class="hero-bg" />
        <div class="hero-top">
          <div class="cover-wrap">
            <i class="ri-folder-music-fill cover-icon" />
          </div>
          <div class="hero-info">
            <h1 class="hero-title">{{ t('localMusic.title') }}</h1>
            <p class="hero-meta">
              {{ t('localMusic.songCount', { count: localMusicStore.musicList.length }) }}
            </p>
          </div>
          <div class="hero-actions">
            <button
              class="action-btn"
              :disabled="localMusicStore.scanning"
              @click="handleScan"
            >
              <i class="ri-refresh-line" :class="{ 'animate-spin': localMusicStore.scanning }" />
            </button>
            <button class="action-btn" @click="handleAddFolder">
              <i class="ri-folder-add-line" />
            </button>
            <button
              v-if="localMusicStore.folderPaths.length > 0"
              class="action-btn"
              @click="showFolderManager = true"
            >
              <i class="ri-folder-settings-line" />
            </button>
          </div>
        </div>
        <GlowTabs
          v-if="localMusicStore.musicList.length > 0"
          v-model="activeTab"
          :tabs="tabs.map(tab => ({ key: tab.key, label: tab.label }))"
          full-width
          class="tab-bar-glow"
        />
      </div>

      <!-- Scanning progress -->
      <div v-if="localMusicStore.scanning" class="scan-progress">
        <n-spin size="small" />
        <span>{{ t('localMusic.scanning') }} ({{ localMusicStore.scanProgress }})</span>
      </div>

      <!-- Empty state -->
      <div v-if="!localMusicStore.scanning && localMusicStore.musicList.length === 0" class="empty-state">
        <i class="ri-folder-music-fill empty-icon" />
        <p class="empty-text">{{ t('localMusic.emptyState') }}</p>
        <button class="empty-action" @click="handleAddFolder">
          <i class="ri-folder-add-line" />
          {{ t('localMusic.scanFolder') }}
        </button>
      </div>

      <!-- Content -->
      <div v-else-if="!localMusicStore.scanning" class="content-area">
        <!-- Songs tab -->
        <template v-if="activeTab === 'songs'">
          <div v-if="displayedSongResults.length === 0" class="no-results">
            <i class="ri-search-line" />
            <p>{{ t('localMusic.search') }}</p>
          </div>
          <div v-else class="song-list">
            <SongItem
              v-for="(item, index) in displayedSongResults"
              :key="item.id"
              :item="item"
              :index="index"
              @play="handlePlaySong"
            />
            <div class="bottom-spacer" />
          </div>
        </template>

        <!-- Artists tab -->
        <template v-else-if="activeTab === 'artists'">
          <div class="artist-grid">
            <button
              v-for="artist in artistList"
              :key="artist.name"
              class="artist-card"
              @click="enterDetailView('artist', artist.name)"
            >
              <div class="artist-avatar">{{ artist.name.charAt(0).toUpperCase() }}</div>
              <p class="artist-name">{{ artist.name }}</p>
              <p class="artist-count">{{ artist.count }} {{ t('localMusic.tabSongs') }}</p>
            </button>
          </div>
          <div class="bottom-spacer" />
        </template>

        <!-- Albums tab -->
        <template v-else-if="activeTab === 'albums'">
          <div class="album-grid">
            <button
              v-for="album in albumList"
              :key="album.name"
              class="album-card"
              @click="enterDetailView('album', album.name)"
            >
              <div class="album-cover">
                <img v-if="album.cover" :src="album.cover" :alt="album.name" />
                <i v-else class="ri-disc-line" />
              </div>
              <p class="album-name">{{ album.name }}</p>
              <p class="album-artist">{{ album.artist }}</p>
            </button>
          </div>
          <div class="bottom-spacer" />
        </template>
      </div>
    </div>

    <!-- ==================== 桌面端（Electron） ==================== -->
    <n-scrollbar v-else-if="isElectron" class="h-full">
      <div class="local-music-content pb-32">
        <!-- Hero Section -->
        <section class="hero-section relative overflow-hidden rounded-tl-2xl">
          <div class="hero-bg absolute inset-0 -top-20">
            <div
              class="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/10 blur-3xl opacity-50 dark:opacity-30"
            ></div>
            <div
              class="absolute inset-0 bg-gradient-to-b from-transparent via-white/80 to-white dark:via-black/80 dark:to-black"
            ></div>
          </div>

          <div class="hero-content relative z-10 page-padding-x pt-10 pb-8">
            <div class="flex flex-col md:flex-row gap-8 items-center md:items-end">
              <div class="cover-wrapper relative group">
                <div
                  class="cover-container relative w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-[var(--accent-color)]/10 flex items-center justify-center shadow-2xl ring-4 ring-white/50 dark:ring-neutral-800/50"
                >
                  <i class="ri-folder-music-fill text-6xl text-[var(--accent-color)] opacity-80" />
                </div>
              </div>

              <div class="info-content text-center md:text-left">
                <div class="badge mb-3">
                  <span
                    class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-color)]/10 dark:bg-[var(--accent-color)]/20 text-[var(--accent-color)] text-xs font-semibold uppercase tracking-wider"
                  >
                    {{ t('localMusic.title') }}
                  </span>
                </div>
                <h1
                  class="text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-white tracking-tight"
                >
                  {{ t('localMusic.title') }}
                </h1>
                <p class="mt-4 text-sm md:text-base text-neutral-500 dark:text-neutral-400">
                  {{ t('localMusic.songCount', { count: localMusicStore.musicList.length }) }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Action Bar (Sticky) -->
        <section
          class="action-bar sticky top-0 z-20 page-padding-x py-3 md:py-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-neutral-100 dark:border-neutral-800/50"
        >
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <div class="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900 rounded-full p-1">
              <button
                v-for="tab in tabs"
                :key="tab.key"
                class="tab-btn px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                :class="activeTab === tab.key
                  ? 'bg-[var(--accent-color)] text-white shadow-md'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'"
                @click="activeTab = tab.key"
              >
                {{ tab.label }}
              </button>
            </div>

            <div class="flex items-center gap-3 flex-1 justify-end">
              <div class="flex-1 max-w-xs min-w-[140px]">
                <n-input
                  v-model:value="searchKeyword"
                  :placeholder="t('localMusic.search')"
                  clearable
                  size="small"
                  round
                >
                  <template #prefix>
                    <i class="ri-search-line text-neutral-400" />
                  </template>
                </n-input>
              </div>

              <n-select
                v-if="activeTab === 'songs' || detailView"
                v-model:value="sortKey"
                :options="sortOptions"
                size="small"
                class="w-32"
              />

              <button
                v-if="displayedList.length > 0"
                class="action-btn-pill flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all bg-[var(--accent-color)] text-white hover:bg-[var(--accent-color)]/90"
                @click="handlePlayAll"
              >
                <i class="ri-play-fill text-lg" />
                <span class="hidden md:inline">{{ t('localMusic.playAll') }}</span>
              </button>

              <button
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                :disabled="localMusicStore.scanning"
                @click="handleScan"
              >
                <i
                  class="ri-refresh-line text-lg"
                  :class="{ 'animate-spin': localMusicStore.scanning }"
                />
              </button>

              <button
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                @click="handleAddFolder"
              >
                <i class="ri-folder-add-line text-lg" />
              </button>

              <button
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                :disabled="localMusicStore.musicList.length === 0"
                @click="handleAddLyricDir"
              >
                <i class="ri-file-music-line text-lg" />
              </button>

              <button
                v-if="localMusicStore.folderPaths.length > 0"
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                @click="showFolderManager = true"
              >
                <i class="ri-folder-settings-line text-lg" />
              </button>
            </div>
          </div>
        </section>

        <section v-if="localMusicStore.scanning" class="page-padding-x mt-6">
          <div
            class="flex items-center gap-4 p-4 rounded-2xl bg-[var(--accent-color)]/5 dark:bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20"
          >
            <n-spin size="small" />
            <div>
              <p class="text-sm font-medium text-neutral-900 dark:text-white">
                {{ t('localMusic.scanning') }}
              </p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {{ t('localMusic.songCount', { count: localMusicStore.scanProgress }) }}
              </p>
            </div>
          </div>
        </section>

        <section class="list-section page-padding-x mt-6">
          <div
            v-if="!localMusicStore.scanning && localMusicStore.musicList.length === 0"
            class="empty-state py-20 text-center"
          >
            <i class="ri-folder-music-fill text-5xl mb-4 text-neutral-200 dark:text-neutral-800" />
            <p class="text-neutral-400">{{ t('localMusic.emptyState') }}</p>
            <button
              class="mt-6 px-6 py-2 rounded-full bg-[var(--accent-color)] text-white text-sm font-medium hover:bg-[var(--accent-color)]/90 transition-all"
              @click="handleAddFolder"
            >
              <i class="ri-folder-add-line mr-2" />
              {{ t('localMusic.scanFolder') }}
            </button>
          </div>

          <div
            v-else-if="displayedList.length === 0"
            class="empty-state py-20 text-center"
          >
            <i class="ri-search-line text-5xl mb-4 text-neutral-200 dark:text-neutral-800" />
            <p class="text-neutral-400">{{ t('localMusic.search') }}</p>
          </div>

          <div v-else-if="activeTab === 'songs' || detailView" class="song-list-container">
            <div v-if="detailView" class="detail-header mb-6">
              <button
                class="back-btn flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-[var(--accent-color)] transition-colors mb-4"
                @click="exitDetailView"
              >
                <i class="ri-arrow-left-line text-lg" />
                {{ t('localMusic.backToList') }}
              </button>
              <div class="flex items-center gap-4">
                <div
                  class="w-16 h-16 rounded-2xl flex items-center justify-center bg-[var(--accent-color)]/10"
                >
                  <i
                    :class="detailType === 'artist' ? 'ri-user-3-fill' : 'ri-disc-line'"
                    class="text-3xl text-[var(--accent-color)]"
                  />
                </div>
                <div>
                  <h2 class="text-xl font-bold text-neutral-900 dark:text-white">
                    {{ detailName }}
                  </h2>
                  <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    {{ t('localMusic.songCount', { count: displayedList.length }) }}
                  </p>
                </div>
              </div>
            </div>

            <n-virtual-list
              class="song-virtual-list"
              style="max-height: calc(100vh - 320px)"
              :items="displayedSongResults"
              :item-size="70"
              item-resizable
              key-field="id"
            >
              <template #default="{ item, index }">
                <div>
                  <song-item :item="item" :index="index" @play="handlePlaySong" />
                  <div v-if="index === displayedSongResults.length - 1" class="h-36"></div>
                </div>
              </template>
            </n-virtual-list>
          </div>

          <div v-else-if="activeTab === 'artists'" class="artist-grid">
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              <button
                v-for="artist in artistList"
                :key="artist.name"
                class="artist-card group flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all"
                @click="enterDetailView('artist', artist.name)"
              >
                <div
                  class="w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-br from-[var(--accent-color)]/20 to-[var(--accent-color)]/5 text-2xl font-bold text-[var(--accent-color)]"
                >
                  {{ artist.name.charAt(0).toUpperCase() }}
                </div>
                <div class="text-center w-full">
                  <p class="text-sm font-medium text-neutral-900 dark:text-white truncate">
                    {{ artist.name }}
                  </p>
                  <p class="text-xs text-neutral-400 mt-0.5">
                    {{ artist.count }} {{ t('localMusic.tabSongs') }}
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div v-else-if="activeTab === 'albums'" class="album-grid">
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              <button
                v-for="album in albumList"
                :key="album.name"
                class="album-card group flex flex-col gap-3 p-3 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all"
                @click="enterDetailView('album', album.name)"
              >
                <div class="album-cover relative aspect-square rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                  <img
                    v-if="album.cover"
                    :src="album.cover"
                    :alt="album.name"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--accent-color)]/20 to-[var(--accent-color)]/5"
                  >
                    <i class="ri-disc-line text-3xl text-[var(--accent-color)] opacity-60" />
                  </div>
                </div>
                <div class="text-center w-full">
                  <p class="text-sm font-medium text-neutral-900 dark:text-white truncate">
                    {{ album.name }}
                  </p>
                  <p class="text-xs text-neutral-400 mt-0.5 truncate">
                    {{ album.artist }}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </section>
      </div>
    </n-scrollbar>

    <!-- Non-Electron, Non-Mobile fallback -->
    <div
      v-else
      class="flex h-full flex-col items-center justify-center px-8 text-center"
    >
      <div
        class="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-[var(--accent-color)]/10"
      >
        <i class="ri-folder-music-fill text-5xl text-[var(--accent-color)] opacity-60" />
      </div>
      <p class="max-w-xs text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
        {{ t('localMusic.desktopOnly') }}
      </p>
    </div>

    <!-- Folder manager Drawer (shared) -->
    <n-drawer v-model:show="showFolderManager" :width="400" placement="right">
      <n-drawer-content :title="t('localMusic.removeFolder')" closable>
        <div class="space-y-3 py-4">
          <div
            v-for="folder in localMusicStore.folderPaths"
            :key="folder"
            class="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800"
          >
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <i class="ri-folder-line text-lg text-[var(--accent-color)] flex-shrink-0" />
              <span class="text-sm text-neutral-700 dark:text-neutral-300 truncate">{{ folder }}</span>
            </div>
            <button
              class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-all flex-shrink-0 ml-2"
              @click="handleRemoveFolder(folder)"
            >
              <i class="ri-delete-bin-line" />
            </button>
          </div>

          <div v-if="localMusicStore.folderPaths.length === 0" class="text-center py-8">
            <i class="ri-folder-line text-4xl text-neutral-200 dark:text-neutral-800" />
            <p class="text-sm text-neutral-400 mt-2">{{ t('localMusic.emptyState') }}</p>
          </div>
        </div>

        <template #footer>
          <n-button type="primary" block @click="handleAddFolder">
            <template #icon>
              <i class="ri-folder-add-line" />
            </template>
            {{ t('localMusic.scanFolder') }}
          </n-button>
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { createDiscreteApi } from 'naive-ui';
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import GlowTabs from '@/components/common/GlowTabs.vue';
import SongItem from '@/components/common/SongItem.vue';
import { usePlaylistConfirm } from '@/hooks/usePlaylistConfirm';
import { useLocalMusicStore } from '@/store/modules/localMusic';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import type { LocalMusicEntry } from '@/types/localMusic';
import { isElectron } from '@/utils';
import { filterByKeyword, sortMusicList, toSongResult } from '@/utils/localMusicUtils';
import type { SortKey } from '@/utils/localMusicUtils';

// ==================== Stores ====================
const { t } = useI18n();
const { message } = createDiscreteApi(['message']);
const localMusicStore = useLocalMusicStore();
const playerStore = usePlayerStore();
const { confirmPlaylistReplace } = usePlaylistConfirm();

// ==================== Platform detection ====================
const isMobileNative = !isElectron && typeof (window as any).AndroidNative !== 'undefined';

// ==================== State ====================
const searchKeyword = ref('');
const showFolderManager = ref(false);
const activeTab = ref<'songs' | 'artists' | 'albums'>('songs');
const sortKey = ref<SortKey>('default');
const detailView = ref(false);
const detailType = ref<'artist' | 'album' | null>(null);
const detailName = ref('');

// Mobile scroll compact state
const scrollRef = ref<HTMLElement | null>(null);
const isCompact = ref(false);
let compactLocked = false;
const COMPACT_ENTER = 80;
const COMPACT_EXIT = 10;

// ==================== Computed ====================
type TabKey = 'songs' | 'artists' | 'albums';
type SortOption = { label: string; value: SortKey };

const tabs = computed<{ key: TabKey; label: string }[]>(() => [
  { key: 'songs', label: t('localMusic.tabSongs') },
  { key: 'artists', label: t('localMusic.tabArtists') },
  { key: 'albums', label: t('localMusic.tabAlbums') }
]);

const sortOptions = computed<SortOption[]>(() => [
  { label: t('localMusic.sortDefault'), value: 'default' },
  { label: t('localMusic.sortTitle'), value: 'title' },
  { label: t('localMusic.sortArtist'), value: 'artist' },
  { label: t('localMusic.sortAlbum'), value: 'album' },
  { label: t('localMusic.sortYear'), value: 'year' },
  { label: t('localMusic.sortDuration'), value: 'duration' }
]);

const filteredList = computed<LocalMusicEntry[]>(() => {
  let list = localMusicStore.musicList;
  if (detailView.value && detailType.value) {
    if (detailType.value === 'artist') {
      list = list.filter((e) => e.artist === detailName.value);
    } else if (detailType.value === 'album') {
      list = list.filter((e) => e.album === detailName.value);
    }
  }
  list = filterByKeyword(list, searchKeyword.value);
  list = sortMusicList(list, sortKey.value);
  return list;
});

const displayedList = computed<LocalMusicEntry[]>(() => filteredList.value);

const displayedSongResults = computed<SongResult[]>(() => {
  return displayedList.value.map(toSongResult);
});

const artistList = computed<{ name: string; count: number }[]>(() => {
  const map = new Map<string, number>();
  const keyword = searchKeyword.value.trim().toLowerCase();
  for (const entry of localMusicStore.musicList) {
    if (keyword && !entry.artist.toLowerCase().includes(keyword)) continue;
    const name = entry.artist || t('localMusic.unknownArtist');
    map.set(name, (map.get(name) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
});

const albumList = computed<{ name: string; artist: string; cover: string | null; count: number }[]>(() => {
  const map = new Map<string, { artist: string; cover: string | null; count: number }>();
  const keyword = searchKeyword.value.trim().toLowerCase();
  for (const entry of localMusicStore.musicList) {
    if (keyword && !entry.album.toLowerCase().includes(keyword) && !entry.artist.toLowerCase().includes(keyword)) continue;
    const name = entry.album || t('localMusic.unknownAlbum');
    const existing = map.get(name);
    if (existing) {
      existing.count++;
      if (!existing.cover && entry.cover) existing.cover = entry.cover;
    } else {
      map.set(name, { artist: entry.artist, cover: entry.cover, count: 1 });
    }
  }
  return Array.from(map.entries())
    .map(([name, info]) => ({ name, ...info }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
});

// ==================== Mobile scroll handler ====================
const onScroll = () => {
  if (!isMobileNative) return;
  const el = scrollRef.value;
  if (!el) return;
  const scrollTop = el.scrollTop;
  const setCompact = (val: boolean) => {
    if (val === isCompact.value || compactLocked) return;
    isCompact.value = val;
    compactLocked = true;
    setTimeout(() => { compactLocked = false; }, 400);
  };
  if (scrollTop > COMPACT_ENTER) setCompact(true);
  else if (scrollTop < COMPACT_EXIT) setCompact(false);
};

// ==================== Watchers ====================
watch(activeTab, () => {
  detailView.value = false;
  detailType.value = null;
  detailName.value = '';
});

// ==================== Methods ====================
function enterDetailView(type: 'artist' | 'album', name: string): void {
  detailType.value = type;
  detailName.value = name;
  detailView.value = true;
  sortKey.value = type === 'album' ? 'album' : 'default';
}

function exitDetailView(): void {
  detailView.value = false;
  detailType.value = null;
  detailName.value = '';
  sortKey.value = 'default';
}

// ==================== Folder picker ====================
async function handleAddFolder(): Promise<void> {
  if (isMobileNative) {
    // 移动端：使用 NativeBridge 的文件夹选择器
    (window as any).AndroidNative.pickAudioFolder();
    // 等待用户选择文件夹（回调由 window.__localMusicFolderPicked 触发）
    const treeUri = await waitForFolderPick();
    if (!treeUri) {
      message.error('未选择文件夹');
      return;
    }
    localMusicStore.addFolder(treeUri);
    await localMusicStore.scanFolders();
    message.success(t('localMusic.scanComplete'));
    return;
  }
  // Electron 桌面端
  try {
    const result = await window.electron.ipcRenderer.invoke('select-directory');
    if (result && !result.canceled && result.filePaths?.length > 0) {
      localMusicStore.addFolder(result.filePaths[0]);
      await localMusicStore.scanFolders();
    }
  } catch (error) {
    console.error('Failed to select folder:', error);
    message.error(String(error));
  }
}

async function handleAddLyricDir(): Promise<void> {
  try {
    const result = await window.electron.ipcRenderer.invoke('select-directory');
    if (!result || result.canceled || !result.filePaths?.length) return;
    const dirPath = result.filePaths[0];
    message.loading('正在扫描歌词文件...');
    const bindResult = await localMusicStore.bindLyricsFromDirectory(dirPath);
    if (bindResult.matched > 0) {
      message.success(`成功绑定 ${bindResult.matched} 首歌词（共扫描 ${bindResult.total} 个文件）`);
    } else if (bindResult.total > 0) {
      message.warning(`扫描到 ${bindResult.total} 个歌词文件，但未匹配到本地歌曲`);
    } else {
      message.info('该目录下没有找到歌词文件');
    }
  } catch (error) {
    console.error('Failed to add lyric directory:', error);
    message.error('添加歌词目录失败');
  }
}

function handleRemoveFolder(folder: string): void {
  localMusicStore.removeFolder(folder);
}

async function handleScan(): Promise<void> {
  if (localMusicStore.folderPaths.length === 0) {
    await handleAddFolder();
    return;
  }
  await localMusicStore.scanFolders();
  if (isMobileNative) {
    message.success(t('localMusic.scanComplete'));
  }
}

async function handlePlaySong(_song: SongResult): Promise<void> {
  confirmPlaylistReplace(() => {
    playerStore.setPlayList(displayedSongResults.value);
  });
}

async function handlePlayAll(): Promise<void> {
  if (displayedSongResults.value.length === 0) return;
  confirmPlaylistReplace(async () => {
    try {
      const firstSong = displayedSongResults.value[0];
      const entry = displayedList.value[0];
      if (isElectron) {
        const exists = await window.electron.ipcRenderer.invoke('check-file-exists', entry.filePath);
        if (!exists) {
          message.error(t('localMusic.fileNotFound'));
          return;
        }
      }
      playerStore.setPlayList(displayedSongResults.value);
      await playerStore.setPlay(firstSong);
    } catch (error) {
      console.error('Failed to play all:', error);
    }
  });
}

// ==================== Mobile folder picker callback ====================
let folderPickerResolver: ((treeUri: string | null) => void) | null = null;

function waitForFolderPick(): Promise<string | null> {
  return new Promise((resolve) => {
    folderPickerResolver = resolve;
  });
}

// Register global callback for folder picker result
if (typeof window !== 'undefined') {
  (window as any).__localMusicFolderPicked = (treeUri: string | null) => {
    if (folderPickerResolver) {
      folderPickerResolver(treeUri);
      folderPickerResolver = null;
    }
  };
}

// ==================== Lifecycle ====================
onMounted(async () => {
  if (!isElectron && !isMobileNative) return;
  await localMusicStore.loadFromCache();
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    delete (window as any).__localMusicFolderPicked;
  }
});

// Watch for mobile folder picker callback to trigger scan
watch(() => (window as any).__localMusicFolderPicked, () => {}, { immediate: false });
</script>

<style lang="scss" scoped>
$spring: cubic-bezier(0.34, 1.56, 0.64, 1);
$smooth: cubic-bezier(0.32, 0.72, 0, 1);

.local-music-page {
  height: 100%;
  width: 100%;
}

/* ==================== 移动端样式 ==================== */
.lm-scroll {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

/* Hero Card — sticky morphing floating card */
.hero-card {
  position: fixed;
  top: calc(var(--safe-area-inset-top, 0px) + 52px);
  left: 16px;
  right: 16px;
  z-index: 50;
  border-radius: 22px;
  overflow: hidden;
  transition: border-radius 0.4s $spring,
              box-shadow 0.4s $spring,
              top 0.4s $spring;

  &.compact {
    border-radius: 18px;
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.08);
    top: calc(var(--safe-area-inset-top, 0px) + 56px);
  }
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--cover-surface, rgba(255, 255, 255, 0.55));
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  opacity: 1;
  transition: opacity 0.4s $spring;
}

.hero-top {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 20px 12px;
  transition: padding 0.4s $spring, gap 0.4s $spring;

  .hero-card.compact & {
    padding: 10px 16px 8px;
    gap: 10px;
  }
}

.cover-wrap {
  flex-shrink: 0;
  display: flex;
  justify-content: center;

  .hero-card.compact & {
    justify-content: flex-start;
  }
}

.cover-icon {
  font-size: 48px;
  color: var(--accent-color, #888);
  opacity: 0.8;
  transition: font-size 0.4s $spring;

  .hero-card.compact & {
    font-size: 28px;
  }
}

.hero-info {
  flex: 1;
  min-width: 0;
}

.hero-title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--cover-text-primary, var(--m-text-primary, var(--text-color, #000)));
  margin: 0;
  transition: font-size 0.4s $spring;

  .hero-card.compact & {
    font-size: 17px;
    font-weight: 600;
  }
}

.hero-meta {
  font-size: 13px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  margin-top: 2px;
  transition: opacity 0.3s ease;

  .hero-card.compact & {
    font-size: 11px;
  }
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: var(--cover-surface-alt, rgba(128, 128, 128, 0.08));
  color: var(--cover-text-secondary, var(--m-text-secondary, #6b6560));
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.2s ease, transform 0.2s $spring;

  &:active {
    transform: scale(0.88);
  }

  &:disabled {
    opacity: 0.4;
  }
}

/* Tab bar — glow tabs */
.tab-bar-glow {
  margin: 4px 4px 8px;
  transition: margin 0.4s $spring;

  .hero-card.compact & {
    margin: 0 16px 6px;
  }
}

/* Scan progress */
.scan-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 280px 20px 0;
  padding: 16px;
  border-radius: 16px;
  background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.08);
  border: 1px solid rgba(var(--accent-color-rgb, 136, 136, 136), 0.15);
  font-size: 14px;
  color: var(--cover-text-primary, var(--m-text-primary, #000));
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 360px 20px 80px;
  gap: 16px;
}

.empty-icon {
  font-size: 56px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  opacity: 0.3;
}

.empty-text {
  font-size: 14px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  text-align: center;
}

.empty-action {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border-radius: 9999px;
  border: none;
  background: var(--accent-color, #888);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.2s $spring;

  &:active { transform: scale(0.95); }
}

/* Content area */
.content-area {
  padding: 0 16px;
  margin-top: 280px;
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 20px;
  gap: 12px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));

  i { font-size: 40px; opacity: 0.3; }
  p { font-size: 14px; }
}

/* Song list */
.song-list {
  display: flex;
  flex-direction: column;
}

/* Artist grid */
.artist-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.artist-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 12px;
  border: none;
  border-radius: 16px;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.2s ease;

  &:active { background: var(--cover-surface-alt, rgba(128, 128, 128, 0.06)); }
}

.artist-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: var(--accent-color, #888);
  background: linear-gradient(135deg,
    rgba(var(--accent-color-rgb, 136, 136, 136), 0.2),
    rgba(var(--accent-color-rgb, 136, 136, 136), 0.05));
}

.artist-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--cover-text-primary, var(--m-text-primary, #000));
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.artist-count {
  font-size: 11px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
}

/* Album grid */
.album-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.album-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border: none;
  border-radius: 16px;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.2s ease;

  &:active { background: var(--cover-surface-alt, rgba(128, 128, 128, 0.06)); }
}

.album-cover {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  background: var(--cover-surface-alt, rgba(128, 128, 128, 0.08));

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  i {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 28px;
    color: var(--accent-color, #888);
    opacity: 0.4;
  }
}

.album-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--cover-text-primary, var(--m-text-primary, #000));
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-artist {
  font-size: 11px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Bottom spacer for safe area + nav bar */
.bottom-spacer {
  height: calc(var(--safe-area-inset-bottom, 0px) + 140px);
}

/* ==================== Desktop styles (shared) ==================== */
.song-virtual-list {
  @apply w-full;
}

.song-virtual-list :deep(.n-virtual-list__scroll) {
  scrollbar-width: thin;
}

.song-virtual-list :deep(.n-virtual-list__scroll)::-webkit-scrollbar {
  width: 6px;
}

.song-virtual-list :deep(.n-virtual-list__scroll)::-webkit-scrollbar-thumb {
  @apply bg-neutral-300 dark:bg-neutral-700 rounded-full;
}

.song-virtual-list :deep(.n-virtual-list__scroll)::-webkit-scrollbar-track {
  @apply bg-transparent;
}

/* Animation */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .hero-card,
  .hero-top,
  .cover-icon,
  .hero-title,
  .hero-meta,
  .tab-bar-glow {
    transition: none;
  }
}
</style>
