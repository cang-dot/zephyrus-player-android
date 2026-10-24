<template>
  <!-- 宽屏悬浮岛式侧栏：窄条 ⇋ 展开岛（hover 展开 + 可钉住）。
       播放界面同底栏行为：pointer-events:none + 随 --player-open-progress 淡出。 -->
  <aside
    class="wide-sidebar"
    :class="{
      expanded: expanded,
      pinned: pinned,
      'player-hidden': playerStore.musicFull || playerTransition.progress.value > 0.05
    }"
    :style="{ '--ws-inset': inset }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div class="ws-scroll">
      <!-- 返回（仅二级页）+ 钉住 -->
      <div class="ws-top-actions">
        <button
          v-if="route.meta.back"
          class="ws-icon-btn ws-back"
          :title="t('common.back', '返回')"
          @click="router.back()"
        >
          <i class="ri-arrow-left-s-line" />
        </button>
        <button
          class="ws-icon-btn ws-pin"
          :title="pinned ? '取消钉住' : '钉住侧栏'"
          @click="togglePin"
        >
          <i :class="pinned ? 'ri-pushpin-fill' : 'ri-pushpin-line'" />
        </button>
      </div>

      <!-- 搜索：窄条钮 / 展开输入框（输入即搜） -->
      <div class="ws-search">
        <button v-if="!expanded" class="ws-icon-btn" title="搜索" @click="expandAndFocusSearch">
          <i class="ri-search-line" />
        </button>
        <div v-else class="ws-search-box">
          <i class="ri-search-line" />
          <input
            ref="searchInputRef"
            v-model="searchKeyword"
            type="text"
            :placeholder="t('search.placeholder', '搜索音乐')"
            @input="onSearchInput"
            @keydown.enter="commitSearch(searchKeyword)"
          />
          <button v-if="searchKeyword" class="ws-search-clear" @click="clearSearch">
            <i class="ri-close-circle-fill" />
          </button>
          <!-- 建议下拉 -->
          <div v-if="suggestions.length" class="ws-suggest-panel">
            <button
              v-for="(item, i) in suggestions"
              :key="i"
              class="ws-suggest-item"
              @click="commitSearch(item)"
            >
              <i class="ri-search-line" />
              <span>{{ item }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 筛选区（随页面动态：当前页注册的 GlowTabs groups，如歌单来源/搜索筛选） -->
      <div v-if="activeGroups.length" class="ws-filter">
        <div v-for="group in activeGroups" :key="group.id" class="ws-filter-group">
          <button
            v-for="opt in group.options"
            :key="opt.key"
            class="ws-filter-chip"
            :class="{ active: String(group.value) === String(opt.key) }"
            @click="group.select(opt.key)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- TAB 导航（走现有 pager 弹簧切页） -->
      <nav class="ws-nav">
        <router-link
          v-for="menu in menus"
          :key="menu.path"
          :to="menu.path"
          class="ws-nav-item"
          :class="{ active: isActiveMenu(menu.path) }"
          :title="String(menu.meta?.title || '')"
        >
          <i class="iconfont" :class="menu.meta?.icon || 'ri-music-line'" />
          <span class="ws-nav-label">{{ t(String(menu.meta?.title || '')) }}</span>
        </router-link>
      </nav>

      <div class="ws-spacer" />

      <!-- 迷你播放卡片 -->
      <button v-if="!playMusic" class="ws-mini ws-mini-empty" title="去搜索歌曲" @click="goSearch">
        <i class="ri-music-2-line" />
        <span class="ws-nav-label">去听歌</span>
      </button>
      <div v-else class="ws-mini">
        <button class="ws-mini-cover" title="打开播放器" @click="openFullPlayer">
          <img v-if="coverUrl" :src="coverUrl" alt="" />
          <i v-else class="ri-music-2-line" />
        </button>
        <div class="ws-mini-info" @click="openFullPlayer">
          <div class="ws-mini-name">{{ playMusic?.name }}</div>
          <div class="ws-mini-artist">{{ artistText }}</div>
        </div>
        <div class="ws-mini-controls">
          <button :title="playerStore.isPlay ? '暂停' : '播放'" @click="togglePlay">
            <i :class="playerStore.isPlay ? 'ri-pause-fill' : 'ri-play-fill'" />
          </button>
          <button title="下一首" @click="playerStore.nextPlay()">
            <i class="ri-skip-right-fill" />
          </button>
          <button title="播放列表" @click="openPlayList">
            <i class="ri-list-unordered" />
          </button>
        </div>
      </div>

      <!-- 头像 + 设置 -->
      <div class="ws-footer">
        <router-link to="/user" class="ws-icon-btn ws-avatar" title="我的">
          <img v-if="userAvatar" :src="userAvatar" alt="" />
          <i v-else class="ri-user-3-line" />
        </router-link>
        <router-link to="/set" class="ws-icon-btn" title="设置">
          <i class="ri-settings-3-line" />
        </router-link>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * WideSidebar — 宽屏悬浮岛式侧栏（顶栏+底栏合并）。
 *
 * 形态：窄条 64px（图标态）⇋ 展开岛 232px。hover 300ms 防误触展开、
 * 离开 1s 收回、钉住锁定（localStorage 记忆）。
 * 内容：返回（二级页）/搜索（输入即搜）/筛选区（useMobileTopbarMenu 的
 * 当前页 groups——GlowTabs 注册机制复用，零改动）/TAB 导航（menuStore +
 * 现有 pager 弹簧）/迷你播放卡片/头像+设置。
 * 播放界面：musicFull 时 pointer-events:none + 随 --player-open-progress 淡出
 * （与顶栏同机制，z-index 低于播放器皮肤）。
 */
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { getSearchSuggestions } from '@/api/search';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { useMobileTopbarMenu } from '@/composables/useMobileTopbarMenu';
import {
  setSidebarExpanded,
  toggleSidebarPinned,
  useWideSidebarState
} from '@/composables/useWideSidebarState';
import { playMusic } from '@/hooks/MusicHook';
import { audioService } from '@/services/audioService';
import { useLocalProfileStore } from '@/store/modules/localProfile';
import { useMenuStore } from '@/store/modules/menu';
import { usePlayerStore } from '@/store/modules/player';
import { usePlaylistStore } from '@/store/modules/playlist';
import { getImgUrl } from '@/utils';
import { useWideViewport } from '@/utils/isWideViewport';

const EXPAND_DELAY_MS = 300;
const COLLAPSE_DELAY_MS = 1000;

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const menuStore = useMenuStore();
const profileStore = useLocalProfileStore();
const { isWide } = useWideViewport();
const playerTransition = useMobilePlayerTransition();

// 钉住/展开状态与 MobileLayout 共享（内容区让位宽度同步）
const { expanded, pinned } = useWideSidebarState();
let expandTimer: ReturnType<typeof setTimeout> | null = null;
let collapseTimer: ReturnType<typeof setTimeout> | null = null;

const searchKeyword = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);
const suggestions = ref<string[]>([]);
let suggestTimer: ReturnType<typeof setTimeout> | null = null;

function togglePin(): void {
  toggleSidebarPinned();
  clearCollapseTimer();
}

function onMouseEnter(): void {
  clearCollapseTimer();
  if (pinned.value || expanded.value) return;
  clearExpandTimer();
  expandTimer = setTimeout(() => {
    setSidebarExpanded(true);
  }, EXPAND_DELAY_MS);
}

function onMouseLeave(): void {
  clearExpandTimer();
  if (pinned.value) return;
  clearCollapseTimer();
  collapseTimer = setTimeout(() => {
    setSidebarExpanded(false);
    searchKeyword.value = '';
    suggestions.value = [];
  }, COLLAPSE_DELAY_MS);
}

function clearExpandTimer(): void {
  if (expandTimer) {
    clearTimeout(expandTimer);
    expandTimer = null;
  }
}

function clearCollapseTimer(): void {
  if (collapseTimer) {
    clearTimeout(collapseTimer);
    collapseTimer = null;
  }
}

function expandAndFocusSearch(): void {
  clearCollapseTimer();
  setSidebarExpanded(true);
  void nextTick(() => searchInputRef.value?.focus());
}

// 输入即搜（网易云 suggest，debounce 300ms）
function onSearchInput(): void {
  if (suggestTimer) clearTimeout(suggestTimer);
  const keyword = searchKeyword.value.trim();
  if (!keyword) {
    suggestions.value = [];
    return;
  }
  suggestTimer = setTimeout(async () => {
    try {
      suggestions.value = (await getSearchSuggestions(keyword)).slice(0, 6);
    } catch {
      suggestions.value = [];
    }
  }, 300);
}

function clearSearch(): void {
  searchKeyword.value = '';
  suggestions.value = [];
  searchInputRef.value?.focus();
}

function commitSearch(keyword: string): void {
  const value = keyword.trim();
  if (!value) return;
  router.push({ path: '/mobile-search-result', query: { keyword: value } });
  searchKeyword.value = '';
  suggestions.value = [];
  if (!pinned.value) setSidebarExpanded(false);
}

function goSearch(): void {
  router.push('/mobile-search');
}

// ==================== 筛选区（当前页 GlowTabs groups） ====================
const { groups } = useMobileTopbarMenu(() => route.path);
const activeGroups = computed(() =>
  expanded.value ? Array.from(groups.value).filter((group) => group.routePath === route.path) : []
);

// ==================== TAB 导航 ====================
const menus = computed(() => menuStore.menus);
const isActiveMenu = (path: string) => route.path === path;

// ==================== 迷你播放卡片 ====================
const coverUrl = computed(() =>
  getImgUrl(
    playMusic.value?.picUrl || playMusic.value?.al?.picUrl || playMusic.value?.album?.picUrl,
    '120y120'
  )
);
const artistText = computed(() => {
  const song = playMusic.value;
  if (!song) return '';
  if (Array.isArray(song.ar) && song.ar.length) return song.ar.map((a: any) => a.name).join('/');
  if (Array.isArray(song.artists) && song.artists.length)
    return song.artists.map((a: any) => a.name).join('/');
  return String(
    (Array.isArray(song.artists) && song.artists[0]?.name) ||
      (Array.isArray(song.ar) && song.ar[0]?.name) ||
      song.album?.name ||
      ''
  );
});

function togglePlay(): void {
  if (playerStore.isPlay) {
    audioService.pause();
  } else {
    void playerStore.setPlay(playMusic.value);
  }
}

function openFullPlayer(): void {
  playerStore.setMusicFull(true);
}

function openPlayList(): void {
  const playlistStore = usePlaylistStore();
  playlistStore.setPlayListDrawerVisible(true);
}

// ==================== 头像 ====================
const userAvatar = computed(() => profileStore.displayAvatarUrl || '');

// ==================== 让位宽度（MobileLayout 消费） ====================
const inset = computed(() => {
  if (!isWide.value) return '0px';
  return expanded.value || pinned.value ? '240px' : '88px';
});

// 窄屏直接收起
watch(isWide, (wide) => {
  if (!wide) {
    expanded.value = false;
    pinned.value = false;
  }
});
</script>

<style lang="scss" scoped>
$ws-narrow: 64px;
$ws-wide: 232px;

.wide-sidebar {
  position: fixed;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 300;
  width: $ws-narrow;
  max-height: calc(100dvh - 24px);
  border-radius: 20px;
  overflow: hidden;
  /* 玻璃表面：与 dock 同材质令牌（跟随明暗主题） */
  background: var(--m-surface-container, var(--m-card, rgba(30, 30, 34, 0.9)));
  border: 1px solid var(--m-outline-variant, var(--m-border, rgba(255, 255, 255, 0.08)));
  box-shadow: var(--m-elevation-3, 0 12px 32px rgba(0, 0, 0, 0.35));
  transition:
    width 260ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 200ms ease,
    background-color 200ms ease;
  display: flex;
  flex-direction: column;

  &.expanded,
  &.pinned {
    width: $ws-wide;
  }

  /* 窄条态：隐藏一切文字类内容（迷你卡只留封面圆、footer 只留图标） */
  &:not(.expanded):not(.pinned) {
    .ws-mini-info,
    .ws-mini-controls,
    .ws-nav-label,
    .ws-filter {
      display: none;
    }

    .ws-mini,
    .ws-mini-empty {
      justify-content: center;
      padding: 4px;
    }
  }

  /* 播放界面：同底栏行为——淡出 + 不可交互 */
  &.player-hidden {
    pointer-events: none;
    opacity: calc(1 - var(--player-open-progress, 0) * 1.2);
  }
}

.ws-scroll {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 8px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.ws-top-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  min-height: 40px;
}

.ws-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--m-text-primary, rgba(var(--player-ink-rgb, 255, 255, 255), 0.85));
  font-size: 20px;
  cursor: pointer;
  transition: background 160ms ease;

  &:hover {
    background: var(--m-surface-container-high, rgba(255, 255, 255, 0.1));
  }

  &.ws-back {
    color: var(--accent-color, #fff);
  }

  &.ws-pin {
    font-size: 16px;
    margin-left: auto;
  }

  &.ws-avatar {
    overflow: hidden;

    img {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      object-fit: cover;
    }
  }
}

.ws-search {
  min-height: 40px;
}

.ws-search-box {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  height: 40px;
  border-radius: 12px;
  background: var(--m-surface-container-high, rgba(255, 255, 255, 0.08));
  color: var(--m-text-secondary, rgba(255, 255, 255, 0.6));

  input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--m-text-primary, #fff);
    font-size: 13px;

    &::placeholder {
      color: var(--m-outline, rgba(255, 255, 255, 0.4));
    }
  }

  .ws-search-clear {
    border: none;
    background: transparent;
    color: var(--m-outline, rgba(255, 255, 255, 0.4));
    cursor: pointer;
    font-size: 15px;
    display: flex;
  }
}

.ws-suggest-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 5;
  border-radius: 12px;
  background: var(--m-surface-container, rgba(30, 30, 34, 0.96));
  border: 1px solid var(--m-outline-variant, rgba(255, 255, 255, 0.1));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.ws-suggest-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  background: transparent;
  color: var(--m-text-primary, rgba(255, 255, 255, 0.85));
  font-size: 13px;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: var(--m-surface-container-high, rgba(255, 255, 255, 0.08));
  }

  i {
    color: var(--m-outline, rgba(255, 255, 255, 0.35));
    font-size: 14px;
  }
}

.ws-filter {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 2px;
}

.ws-filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.ws-filter-chip {
  padding: 4px 10px;
  border-radius: 9999px;
  border: 1px solid var(--m-outline-variant, rgba(255, 255, 255, 0.12));
  background: transparent;
  color: var(--m-text-secondary, rgba(255, 255, 255, 0.65));
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 160ms ease,
    color 160ms ease;

  &.active {
    background: color-mix(in srgb, var(--accent-color, #888888) 22%, transparent);
    border-color: color-mix(in srgb, var(--accent-color, #888888) 45%, transparent);
    color: var(--accent-color, #fff);
  }
}

.ws-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ws-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 42px;
  padding: 0 10px;
  border-radius: 12px;
  color: var(--m-text-secondary, rgba(255, 255, 255, 0.6));
  text-decoration: none;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  transition:
    background 160ms ease,
    color 160ms ease;

  i {
    font-size: 21px;
    flex-shrink: 0;
  }

  .ws-nav-label {
    opacity: 0;
    transition: opacity 180ms ease 80ms;
  }

  &.active {
    background: color-mix(in srgb, var(--accent-color, #888888) 18%, transparent);
    color: var(--accent-color, #fff);
  }

  &:hover {
    color: var(--m-text-primary, rgba(255, 255, 255, 0.9));
  }
}

.ws-spacer {
  flex: 1;
  min-height: 12px;
}

.ws-mini,
.ws-mini-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 14px;
  background: var(--m-surface-container, rgba(255, 255, 255, 0.06));
  color: var(--m-text-primary, rgba(255, 255, 255, 0.8));
  border: none;
  cursor: pointer;
  overflow: hidden;
}

.ws-mini-empty {
  justify-content: center;
  min-height: 44px;

  i {
    font-size: 18px;
  }
}

.ws-mini {
  .ws-mini-cover {
    flex-shrink: 0;
    width: 42px;
    height: 42px;
    border-radius: 10px;
    border: none;
    padding: 0;
    background: var(--m-surface-container-high, rgba(255, 255, 255, 0.1));
    color: rgba(255, 255, 255, 0.5);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    i {
      font-size: 18px;
    }
  }

  .ws-mini-info {
    flex: 1;
    min-width: 0;
    text-align: left;

    .ws-mini-name {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--m-text-primary, rgba(255, 255, 255, 0.9));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ws-mini-artist {
      font-size: 11px;
      color: var(--m-outline, rgba(255, 255, 255, 0.45));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .ws-mini-controls {
    display: flex;
    flex-direction: column;
    gap: 0;

    button {
      border: none;
      background: transparent;
      color: var(--m-text-secondary, rgba(255, 255, 255, 0.7));
      font-size: 15px;
      height: 20px;
      display: flex;
      align-items: center;
      cursor: pointer;

      &:hover {
        color: var(--m-text-primary, #fff);
      }
    }
  }
}

/* 展开态恢复导航文字（基础 opacity:0 供窄条隐藏；显式根前缀防嵌套错位） */
.wide-sidebar.expanded .ws-nav-item .ws-nav-label,
.wide-sidebar.pinned .ws-nav-item .ws-nav-label {
  opacity: 1;
}

.ws-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  min-height: 40px;
}
</style>
