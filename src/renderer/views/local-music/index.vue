<template>
  <div
    class="local-music-page"
    :class="{ 'is-embedded': embedded, 'drop-target': dropActive }"
    @dragover.prevent="onDragOver"
    @dragleave.self="dropActive = false"
    @drop.prevent="onDrop"
  >
    <!-- ==================== 移动端（Capacitor） ==================== -->
    <div
      v-if="isMobileNative"
      ref="scrollRef"
      class="lm-scroll"
      :class="{ 'is-embedded': embedded }"
      @scroll.passive="onScroll"
    >
      <glow-tabs
        v-if="localMusicStore.musicList.length > 0"
        v-model="activeTab"
        :tabs="tabs.map((tab) => ({ key: tab.key, label: tab.label }))"
        :page-path="embedded ? '/list' : '/local-music'"
        full-width
        class="tab-bar-glow"
      />

      <!-- Scanning progress -->
      <div v-if="localMusicStore.scanning" class="scan-progress">
        <n-spin size="small" />
        <span>{{ t('localMusic.scanning') }} ({{ localMusicStore.scanProgress }})</span>
      </div>

      <!-- Empty state -->
      <div
        v-if="!localMusicStore.scanning && localMusicStore.musicList.length === 0"
        class="empty-state"
      >
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
            <song-item
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
            <div
              class="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900 rounded-full p-1"
            >
              <button
                v-for="tab in tabs"
                :key="tab.key"
                class="tab-btn px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                :class="
                  activeTab === tab.key
                    ? 'bg-[var(--accent-color)] text-white shadow-md'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                "
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
                v-if="isWebBrowser"
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                :title="t('localMusic.importFiles') || '导入音频文件'"
                @click="audioFileInput?.click()"
              >
                <i class="ri-music-add-line text-lg" />
              </button>
              <input
                v-if="isWebBrowser"
                ref="audioFileInput"
                type="file"
                accept="audio/*"
                multiple
                hidden
                @change="onAudioFilePick"
              />

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

          <div v-else-if="displayedList.length === 0" class="empty-state py-20 text-center">
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
            <div
              class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
            >
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
            <div
              class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
            >
              <button
                v-for="album in albumList"
                :key="album.name"
                class="album-card group flex flex-col gap-3 p-3 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all"
                @click="enterDetailView('album', album.name)"
              >
                <div
                  class="album-cover relative aspect-square rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800"
                >
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
    <div v-else class="flex h-full flex-col items-center justify-center px-8 text-center">
      <div
        class="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-[var(--accent-color)]/10"
      >
        <i class="ri-folder-music-fill text-5xl text-[var(--accent-color)] opacity-60" />
      </div>
      <p class="max-w-xs text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
        {{ t('localMusic.desktopOnly') }}
      </p>
    </div>

    <!-- Folder manager（底部玻璃 sheet） -->
    <Teleport to="body">
      <Transition name="folder-sheet">
        <div
          v-if="showFolderManager"
          class="folder-sheet-overlay"
          @click.self="showFolderManager = false"
        >
          <div class="folder-sheet">
            <div class="folder-sheet-grabber"></div>
            <header class="folder-sheet-header">
              <h3>{{ t('localMusic.removeFolder') }}</h3>
              <button class="folder-sheet-close" @click="showFolderManager = false">
                <i class="ri-close-line" />
              </button>
            </header>
            <div class="folder-sheet-body">
              <div class="space-y-3 py-2">
                <div
                  v-for="folder in localMusicStore.folderPaths"
                  :key="folder"
                  class="folder-item"
                >
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <i class="ri-folder-line text-lg text-[var(--accent-color)] flex-shrink-0" />
                    <span class="text-sm text-white/80 truncate">{{ folder }}</span>
                  </div>
                  <button
                    class="w-9 h-9 rounded-full flex items-center justify-center text-white/45 active:text-red-500 active:bg-red-500/10 transition-all flex-shrink-0 ml-2"
                    @click="handleRemoveFolder(folder)"
                  >
                    <i class="ri-delete-bin-line" />
                  </button>
                </div>

                <div v-if="localMusicStore.folderPaths.length === 0" class="text-center py-8">
                  <i class="ri-folder-line text-4xl text-white/15" />
                  <p class="text-sm text-white/40 mt-2">{{ t('localMusic.emptyState') }}</p>
                </div>
              </div>
            </div>
            <div class="folder-sheet-footer">
              <button class="folder-sheet-add" @click="handleAddFolder">
                <i class="ri-folder-add-line" />
                {{ t('localMusic.scanFolder') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { createDiscreteApi } from 'naive-ui';
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import GlowTabs from '@/components/common/GlowTabs.vue';
import SongItem from '@/components/common/SongItem.vue';
import {
  registerMobileTopbarAction,
  registerMobileTopbarPresentation,
  unregisterMobileTopbarAction,
  unregisterMobileTopbarPresentation
} from '@/composables/useMobileTopbarMenu';
import { usePlaylistConfirm } from '@/hooks/usePlaylistConfirm';
import { useLocalMusicStore } from '@/store/modules/localMusic';
import { usePlayerStore } from '@/store/modules/player';
import type { LocalMusicEntry } from '@/types/localMusic';
import type { SongResult } from '@/types/music';
import { isElectron } from '@/utils';
import type { SortKey } from '@/utils/localMusicUtils';
import { filterByKeyword, sortMusicList, toSongResult } from '@/utils/localMusicUtils';

const route = useRoute();
const router = useRouter();

// ==================== Stores ====================
const { t } = useI18n();
const { message } = createDiscreteApi(['message']);
const localMusicStore = useLocalMusicStore();
const playerStore = usePlayerStore();
const { confirmPlaylistReplace } = usePlaylistConfirm();

// ==================== Platform detection ====================
const isMobileNative = !isElectron;
// ==================== 网页版:本地音频文件导入 + 拖拽 ====================
// 会话级能力(blob URL 刷新失效):条目入 IndexedDB 但标记 fileUrl,
// 播放走 blob URL;刷新后这些条目自动清除
const isWebBrowser = isElectron === false && !(window as any).AndroidNative && typeof window !== 'undefined';
const dropActive = ref(false);
const audioFileInput = ref<HTMLInputElement | null>(null);
const sessionFiles = ref<Set<string>>(new Set());

const AUDIO_EXT_RE = /\.(mp3|flac|wav|ogg|m4a|aac|opus|wma|ape)$/i;

/** 把本地文件加入列表并返回 SongResult(会话级 blob URL) */
async function importAudioFile(file: File): Promise<SongResult | null> {
  if (!AUDIO_EXT_RE.test(file.name)) return null;
  const filePath = `web-session://${file.name}`;
  const entry: any = {
    id: `web_${file.name}_${file.size}`,
    filePath,
    title: file.name.replace(/\.[^.]+$/, ''),
    artist: '',
    album: '',
    duration: 0,
    cover: null,
    lyrics: null,
    fileSize: file.size,
    modifiedTime: file.lastModified,
    fileUrl: URL.createObjectURL(file),
    isSession: true
  };
  await localMusicStore.applyEntryMetadata(JSON.stringify(entry));
  sessionFiles.value.add(entry.id);
  return toSongResult(entry);
}

const onDragOver = (e: DragEvent) => {
  if (!isWebBrowser) return;
  dropActive.value = true;
  e.dataTransfer && (e.dataTransfer.dropEffect = 'copy');
};

const onDrop = async (e: DragEvent) => {
  dropActive.value = false;
  if (!isWebBrowser) return;
  const files = [...(e.dataTransfer?.files || [])].filter((f) => AUDIO_EXT_RE.test(f.name));
  if (!files.length) return;
  const imported: SongResult[] = [];
  for (const file of files) {
    const song = await importAudioFile(file);
    if (song) imported.push(song);
  }
  if (imported.length) {
    message.success(`已导入 ${imported.length} 个音频文件`);
    playerStore.setPlayList(imported);
    void playerStore.setPlay(imported[0]);
  }
};

const onAudioFilePick = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = [...(input.files || [])].filter((f) => AUDIO_EXT_RE.test(f.name));
  input.value = '';
  const imported: SongResult[] = [];
  for (const file of files) {
    const song = await importAudioFile(file);
    if (song) imported.push(song);
  }
  if (imported.length) {
    message.success(`已导入 ${imported.length} 个音频文件`);
    playerStore.setPlayList(imported);
    void playerStore.setPlay(imported[0]);
  }
};
const { embedded } = withDefaults(defineProps<{ embedded?: boolean }>(), {
  embedded: false
});

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

// ==================== Computed ====================
type TabKey = 'songs' | 'artists' | 'albums';
type SortOption = { label: string; value: SortKey };

const tabs = computed<{ key: TabKey; label: string }[]>(() => [
  { key: 'songs', label: t('localMusic.tabSongs') },
  { key: 'artists', label: t('localMusic.tabArtists') },
  { key: 'albums', label: t('localMusic.tabAlbums') }
]);

watch(
  () => route.query.localTab,
  (tab) => {
    if (tab === 'songs' || tab === 'artists' || tab === 'albums') activeTab.value = tab;
  },
  { immediate: true }
);

watch(activeTab, (tab) => {
  if (route.path !== '/list' || route.query.localTab === tab) return;
  void router.replace({ query: { ...route.query, source: 'local', localTab: tab } });
});

const topbarActionPrefix = `local-music-${getCurrentInstance()?.uid ?? 'view'}`;
const syncTopbarActions = () => {
  if (!isMobileNative) return;
  registerMobileTopbarPresentation({
    routePath: '/local-music/*',
    title: t('localMusic.title') || '本地音乐',
    subtitle: `${localMusicStore.musicList.length} 首`
  });
  registerMobileTopbarAction({
    id: `${topbarActionPrefix}-scan`,
    routePath: route.path,
    label: t('localMusic.scanFolder'),
    icon: 'ri-folder-add-line',
    run: () => void handleAddFolder()
  });
  registerMobileTopbarAction({
    id: `${topbarActionPrefix}-folders`,
    routePath: route.path,
    label: '管理文件夹',
    icon: 'ri-folder-settings-line',
    run: () => {
      showFolderManager.value = true;
    }
  });
  registerMobileTopbarAction({
    id: `${topbarActionPrefix}-refresh`,
    routePath: route.path,
    label: t('localMusic.scanComplete'),
    icon: 'ri-refresh-line',
    run: () => void handleScan()
  });
};

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
  return displayedList.value.map((entry: any) => {
    const song = toSongResult(entry);
    // 网页版会话导入条目:blob URL 仅本会话有效
    if (entry.isSession && entry.fileUrl) {
      song.playMusicUrl = entry.fileUrl;
      song.expiredAt = Date.now() + 365 * 24 * 3600 * 1000;
    }
    return song;
  });
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

const albumList = computed<{ name: string; artist: string; cover: string | null; count: number }[]>(
  () => {
    const map = new Map<string, { artist: string; cover: string | null; count: number }>();
    const keyword = searchKeyword.value.trim().toLowerCase();
    for (const entry of localMusicStore.musicList) {
      if (
        keyword &&
        !entry.album.toLowerCase().includes(keyword) &&
        !entry.artist.toLowerCase().includes(keyword)
      )
        continue;
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
  }
);

// ==================== Mobile scroll handler ====================
const onScroll = () => {
  if (!isMobileNative || !scrollRef.value) return;
  isCompact.value = scrollRef.value.scrollTop > 10;
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
  // 纯浏览器环境（Web 版）没有文件夹访问能力
  if (!isElectron && !(window as any).AndroidNative) {
    message.warning('网页版暂不支持扫描本地音乐，请使用客户端');
    return;
  }
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

async function handlePlaySong(song: SongResult): Promise<void> {
  playerStore.setPlayList(displayedSongResults.value);
  await playerStore.setPlay(song);
}

async function handlePlayAll(): Promise<void> {
  if (displayedSongResults.value.length === 0) return;
  confirmPlaylistReplace(async () => {
    try {
      const firstSong = displayedSongResults.value[0];
      const entry = displayedList.value[0];
      if (isElectron) {
        const exists = await window.electron.ipcRenderer.invoke(
          'check-file-exists',
          entry.filePath
        );
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
  syncTopbarActions();
});

onBeforeUnmount(() => {
  unregisterMobileTopbarAction(`${topbarActionPrefix}-scan`);
  unregisterMobileTopbarAction(`${topbarActionPrefix}-folders`);
  unregisterMobileTopbarAction(`${topbarActionPrefix}-refresh`);
  unregisterMobileTopbarPresentation('/local-music/*');
  if (typeof window !== 'undefined') {
    delete (window as any).__localMusicFolderPicked;
  }
});

// Watch for mobile folder picker callback to trigger scan
watch(
  () => (window as any).__localMusicFolderPicked,
  () => {},
  { immediate: false }
);
</script>

<style lang="scss" scoped>
$spring: cubic-bezier(0.34, 1.56, 0.64, 1);
$smooth: cubic-bezier(0.32, 0.72, 0, 1);

.local-music-page {
  height: 100%;
  width: 100%;

  &.is-embedded {
    height: auto;
    min-height: calc(100dvh - var(--safe-area-inset-top, 0px) - 116px);
  }
}

/* ==================== 移动端样式 ==================== */
.lm-scroll {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }

  &.is-embedded {
    height: auto;
    min-height: inherit;
    overflow: visible;
    -webkit-overflow-scrolling: auto;
  }
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
  transition:
    border-radius 0.4s $spring,
    box-shadow 0.4s $spring,
    top 0.4s $spring;

  &.compact {
    border-radius: 18px;
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.08);
    top: var(--mobile-topbar-inset);
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
  transition:
    padding 0.4s $spring,
    gap 0.4s $spring;

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
  transition:
    background 0.2s ease,
    transform 0.2s $spring;

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
  margin: 12px 16px;
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
  min-height: calc(100dvh - var(--safe-area-inset-top, 0px) - 220px);
  padding: 48px 20px 120px;
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

  &:active {
    transform: scale(0.95);
  }
}

/* Content area */
.content-area {
  padding: 0 16px;
  margin-top: 0;
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 20px;
  gap: 12px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));

  i {
    font-size: 40px;
    opacity: 0.3;
  }
  p {
    font-size: 14px;
  }
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

  &:active {
    background: var(--cover-surface-alt, rgba(128, 128, 128, 0.06));
  }
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
  background: linear-gradient(
    135deg,
    rgba(var(--accent-color-rgb, 136, 136, 136), 0.2),
    rgba(var(--accent-color-rgb, 136, 136, 136), 0.05)
  );
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

  &:active {
    background: var(--cover-surface-alt, rgba(128, 128, 128, 0.06));
  }
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

.local-music-page.is-embedded .bottom-spacer {
  height: 0;
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
  to {
    transform: rotate(360deg);
  }
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

/* ===== 文件夹管理：底部玻璃 sheet ===== */
.folder-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 100100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.folder-sheet {
  width: 100%;
  max-width: 520px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  padding: 10px 20px calc(16px + var(--safe-area-inset-bottom, 0px));
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: none;
  border-radius: 24px 24px 0 0;
  background: rgba(28, 28, 32, 0.96);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow:
    0 -16px 48px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.folder-sheet-grabber {
  width: 40px;
  height: 4px;
  margin: 0 auto 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
}

.folder-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

  h3 {
    margin: 0;
    color: #f5f5f7;
    font-size: 17px;
    font-weight: 700;
  }
}

.folder-sheet-close {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
  font-size: 18px;
  place-items: center;
}

.folder-sheet-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.folder-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
}

.folder-sheet-footer {
  padding-top: 14px;
}

.folder-sheet-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px 0;
  border: none;
  border-radius: 999px;
  color: #1a1a1c;
  background: var(--accent-color, #d4a056);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease;

  &:active {
    transform: scale(0.98);
  }
}

.folder-sheet-enter-active,
.folder-sheet-leave-active {
  transition: opacity 0.3s ease;

  .folder-sheet {
    transition: transform 0.38s cubic-bezier(0.22, 1, 0.36, 1);
  }
}

.folder-sheet-enter-from,
.folder-sheet-leave-to {
  opacity: 0;

  .folder-sheet {
    transform: translateY(100%);
  }
}

.local-music-page.drop-target::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 999;
  border: 3px dashed var(--accent-color, #888);
  border-radius: 18px;
  background: color-mix(in srgb, var(--accent-color, #888) 8%, transparent);
  pointer-events: none;
}
</style>
