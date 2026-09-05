<template>
  <div class="list-page">
    <div class="list-scroll">
      <glow-tabs
        :model-value="playlistSourceFilter"
        :tabs="playlistSourceTabs"
        scrollable
        page-path="/list"
        class="playlist-source-tabs"
        @update:model-value="onSourceFilterChange"
      />

      <local-music-view
        v-if="playlistSourceFilter === 'local'"
        embedded
        class="embedded-local-music"
      />

      <!-- Loading skeleton -->
      <div v-if="playlistSourceFilter !== 'local' && isLoading" class="cover-grid">
        <div v-for="i in 6" :key="'skeleton-' + i" class="cover-card">
          <div class="cover-wrap skeleton-shimmer" style="aspect-ratio: 1; border-radius: 16px" />
          <div class="cover-text">
            <div
              class="skeleton-shimmer"
              style="height: 14px; width: 80%; border-radius: 6px; margin-bottom: 6px"
            />
            <div class="skeleton-shimmer" style="height: 11px; width: 50px; border-radius: 6px" />
          </div>
        </div>
      </div>

      <!-- Cover Grid -->
      <div
        v-else-if="playlistSourceFilter !== 'local' && items.length > 0"
        ref="gridRef"
        class="cover-grid"
      >
        <div
          v-for="item in items"
          :key="cardKey(item)"
          :data-key="cardKey(item)"
          class="cover-card"
          @click.stop="handleItemClick(item)"
        >
          <div class="cover-wrap">
            <img
              v-if="item.src"
              :src="getImgUrl(item.src, '300y300')"
              :alt="item.alt"
              draggable="false"
              class="cover-img"
              loading="lazy"
            />
            <div v-else class="cover-placeholder">
              <i class="ri-disc-line text-3xl" />
            </div>
            <div class="cover-play-overlay">
              <i class="ri-play-fill" />
            </div>
          </div>
          <div class="cover-text">
            <p class="cover-name">{{ item.alt }}</p>
            <span v-if="item.isLocal" class="cover-type-badge local">
              <i class="ri-folder-music-line" />
              本地 · 歌曲
            </span>
            <span v-else class="cover-type-badge" :class="item.type">
              <platform-logo :platform="item.platform" :size="13" />
              {{ platformName(item.platform) }} ·
              {{ item.type === 'album' ? 'Album' : 'Playlist' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="playlistSourceFilter !== 'local'" class="empty-state">
        <i class="ri-disc-line"></i>
        <p>暂无歌单或专辑</p>
      </div>

      <div class="bottom-spacer" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { computed, defineAsyncComponent, nextTick, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import GlowTabs from '@/components/common/GlowTabs.vue';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlatformLogo from '@/components/common/PlatformLogo.vue';
import { useUserStore } from '@/store';
import { type MusicPlatform, usePlatformAccountsStore } from '@/store/modules/platformAccounts';
import { getImgUrl } from '@/utils';
import {
  orderPlaylistCards,
  PLAYLIST_CARD_MRU_KEY,
  readPlaylistCardMru,
  touchPlaylistCardMru
} from '@/utils/playlistCardMru';

defineOptions({ name: 'List' });

const router = useRouter();
const route = useRoute();
const message = useMessage();
const userStore = useUserStore();
const accountStore = usePlatformAccountsStore();
const LocalMusicView = defineAsyncComponent(() => import('@/views/local-music/index.vue'));

const playlistSourceFilter = computed<'all' | MusicPlatform | 'local'>({
  get: () => (typeof route.query.source === 'string' ? route.query.source : 'all') as any,
  set: (source) => void router.replace({ query: { ...route.query, source } })
});

const gridRef = ref<HTMLElement>();

/** 封面卡稳定标识:跨来源筛选切换时同卡同 key,是 FILTER MOVE 段 FLIP 的前提 */
const cardKey = (item: any) => `${item.accountId}-${item.type}-${item.id}`;
// 加载状态：用户未登录或歌单数据未加载完成
const isLoading = computed(() => {
  return !accountStore.accounts.length && !userStore.user;
});

const playlistSourceTabs = computed(() => [
  { key: 'all', label: '全部' },
  { key: 'local', label: '本地' },
  { key: 'netease', label: '网易云' },
  { key: 'qq', label: 'QQ 音乐' },
  { key: 'kugou', label: '酷狗音乐' }
]);

const platformName = (platform: MusicPlatform) =>
  ({ netease: '网易云', qq: 'QQ 音乐', kugou: '酷狗音乐', spotify: 'Spotify' })[platform];

// "全部"页新增的本地歌曲入口卡片（点击跳转本地标签页）。
const LOCAL_SONGS_ITEM = {
  id: 'local-songs',
  src: '',
  alt: '本地歌曲',
  type: 'playlist' as const,
  platform: 'local',
  accountId: 'local',
  isLocal: true,
  raw: {}
};

const cardMru = ref(readPlaylistCardMru(localStorage.getItem(PLAYLIST_CARD_MRU_KEY)));
const touchCardMru = (item: any) => {
  cardMru.value = touchPlaylistCardMru(cardMru.value, item);
  try {
    localStorage.setItem(PLAYLIST_CARD_MRU_KEY, JSON.stringify(cardMru.value));
  } catch {
    /* 忽略持久化失败 */
  }
};

/** 按来源构建封面卡集合;独立成纯函数以便切换前离线预演新集合(FILTER 编排需要) */
const buildItems = (source: string) => {
  const result: any[] = [];

  if (source === 'all') {
    result.push({ ...LOCAL_SONGS_ITEM });
  }

  for (const account of accountStore.accounts) {
    if (source !== 'all' && account.platform !== source) {
      continue;
    }

    const cache = accountStore.accountCache[account.accountId];
    const playlists =
      account.platform === 'netease' && account.accountId === accountStore.activeAccountId
        ? userStore.playList
        : cache?.playlists || [];
    const albums =
      account.platform === 'netease' && account.accountId === accountStore.activeAccountId
        ? userStore.albumList
        : cache?.albums || [];

    for (const playlist of playlists as any[]) {
      result.push({
        id: playlist.id,
        src: playlist.coverImgUrl || playlist.picUrl || '',
        alt: playlist.name || '未知歌单',
        type: 'playlist' as const,
        platform: account.platform,
        accountId: account.accountId,
        raw: playlist
      });
    }

    for (const album of albums as any[]) {
      result.push({
        id: album.id,
        src: album.picUrl || album.blurPicUrl || album.coverImgUrl || '',
        alt: album.name || '未知专辑',
        type: 'album' as const,
        platform: account.platform,
        accountId: account.accountId,
        raw: album
      });
    }
  }

  return source === 'all' ? orderPlaylistCards(result, cardMru.value) : result;
};

const items = computed(() => buildItems(playlistSourceFilter.value));

// ==================== FILTER 三段编排(OUT → MOVE → IN,规格 §5) ====================
const FILTER_OUT_MS = 250;
const FILTER_MOVE_MS = 200;
const FILTER_IN_MS = 150;
let filterBusy = false;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const onSourceFilterChange = async (next: string | number) => {
  const source = String(next);
  if (filterBusy || source === playlistSourceFilter.value) return;
  const grid = gridRef.value;

  // 「本地」是整视图替换(网格让位给 local-music-view),不做卡片级三段编排,
  // 仅给被替换的网格一个快速淡出,呼应「卡片不凭空消失」
  const viewSwap = source === 'local' || playlistSourceFilter.value === 'local';
  if (!grid || viewSwap || prefersReducedMotion()) {
    if (grid && viewSwap && !prefersReducedMotion()) {
      grid.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 150,
        easing: 'ease-out',
        fill: 'forwards'
      });
      await wait(150);
    }
    playlistSourceFilter.value = source as any;
    return;
  }

  filterBusy = true;
  try {
    const prevKeys = new Set(items.value.map(cardKey));
    const nextKeys = new Set(buildItems(source).map(cardKey));

    // ── OUT:被筛掉的卡原地缩淡(不位移 = 「被移除」而非「搬走」),同时记录留存卡 First 位置 ──
    const outCards: HTMLElement[] = [];
    const stayRects = new Map<HTMLElement, DOMRect>();
    grid.querySelectorAll<HTMLElement>('[data-key]').forEach((el) => {
      if (nextKeys.has(el.dataset.key || '')) stayRects.set(el, el.getBoundingClientRect());
      else outCards.push(el);
    });
    if (!outCards.length && !stayRects.size) {
      playlistSourceFilter.value = source as any;
      return;
    }
    outCards.forEach((el) => el.classList.add('card-out'));
    await wait(FILTER_OUT_MS);

    // ── 数据切换:Vue 渲染新集合;nextTick 后仍在同帧,新卡先压住避免闪现 ──
    playlistSourceFilter.value = source as any;
    await nextTick();

    const inCards: HTMLElement[] = [];
    grid.querySelectorAll<HTMLElement>('[data-key]').forEach((el) => {
      if (!prevKeys.has(el.dataset.key || '')) {
        el.classList.add('card-pending');
        inCards.push(el);
      }
    });

    // ── MOVE:留存卡 FLIP 弹簧滑到新槽位(轻微错峰) ──
    let moveIndex = 0;
    stayRects.forEach((first, el) => {
      if (!el.isConnected) return;
      const last = el.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (!dx && !dy) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: FILTER_MOVE_MS,
        delay: Math.min(moveIndex * 20, 40),
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      });
      moveIndex += 1;
    });
    await wait(FILTER_MOVE_MS + 40);

    // ── IN:新卡从自己的空槽长出(back-out,逐卡 30ms 错峰) ──
    inCards.forEach((el, i) => {
      el.classList.remove('card-pending');
      el.classList.add('card-in');
      el.style.animationDelay = `${i * 30}ms`;
    });
    await wait(FILTER_IN_MS + inCards.length * 30 + 60);
    inCards.forEach((el) => {
      el.classList.remove('card-in');
      el.style.animationDelay = '';
    });
  } finally {
    // 兜底:任何异常路径都不允许永久锁死筛选
    filterBusy = false;
  }
};

const handleItemClick = (item: any) => {
  touchCardMru(item);
  if (item.isLocal) {
    router.push('/local-music');
    return;
  }
  const account = accountStore.accounts.find((candidate) => candidate.accountId === item.accountId);
  if (!account) return;

  const sourceId = String(
    item.raw.listId ||
      item.raw.list_id ||
      item.raw.tid ||
      item.raw.globalCollectionId ||
      item.raw.global_collection_id ||
      item.id ||
      ''
  ).trim();
  if (!sourceId) {
    message.warning('这个歌单缺少可加载的标识');
    return;
  }

  navigateToMusicList(router, {
    id: item.id,
    type: item.type,
    name: item.alt,
    listInfo: item.raw,
    canRemove: account.platform === 'netease' && item.type === 'playlist',
    sourceContext:
      account.platform === 'netease' || account.platform === 'qq' || account.platform === 'kugou'
        ? {
            platform: account.platform,
            accountId: account.accountId,
            sourceId,
            kind: item.type
          }
        : undefined
  });
};

// 监听数据变化更新卡片
</script>

<style lang="scss" scoped>
.list-page {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: var(--cover-bg, var(--m-bg, var(--bg-color, #f5f1eb)));
}

.list-scroll {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-top: calc(var(--safe-area-inset-top, 0px) + 68px);
  padding-bottom: calc(
    var(--mobile-dock-content-inset, 132px) + var(--safe-area-inset-bottom, 0px) + 180px
  );
  &::-webkit-scrollbar {
    display: none;
  }
}

.playlist-source-tabs {
  display: flex;
  margin: 0 16px 16px;
}

/* ── FILTER 三段编排(OUT 原地缩淡 / IN 从空槽长出;MOVE 由 JS FLIP 驱动) ── */
.cover-card.card-out {
  pointer-events: none;
  animation: card-out var(--filter-out-duration) var(--ease-exit) forwards;
}

@keyframes card-out {
  to {
    transform: scale(0.9);
    opacity: 0;
  }
}

.cover-card.card-pending {
  opacity: 0;
}

.cover-card.card-in {
  animation: card-in var(--filter-in-duration) var(--d-ease-spring) backwards;
}

@keyframes card-in {
  from {
    transform: scale(var(--pop-from-scale));
    opacity: 0;
  }
}

.cover-grid {
  animation: grid-fade-in 150ms ease-out;
}

@keyframes grid-fade-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cover-card.card-out,
  .cover-card.card-in,
  .cover-grid {
    animation-duration: 0.01ms;
  }
}

.embedded-local-music {
  display: block;
  width: 100%;
  min-height: calc(100dvh - var(--safe-area-inset-top, 0px) - 116px);
}

/* Cover grid */
.cover-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 0 16px;

  @media (min-width: 480px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  @media (min-width: 768px) {
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(5, 1fr);
  }
}

.cover-card {
  cursor: pointer;
  user-select: none;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);

  &:active {
    transform: scale(0.96);
  }
}

.cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 22px;
  overflow: hidden;
  background: var(--cover-surface, rgba(128, 128, 128, 0.1));
  box-shadow: 0 2px 12px var(--cover-shadow, rgba(0, 0, 0, 0.06));
  transition: box-shadow 0.3s ease;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(var(--accent-color-rgb, 136, 136, 136), 0.15),
    rgba(var(--accent-color-rgb, 136, 136, 136), 0.05)
  );
  color: var(--accent-color, #888);
  opacity: 0.4;
}

.cover-play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0);
  transition: background 0.3s ease;
  pointer-events: none;

  i {
    font-size: 28px;
    color: #fff;
    opacity: 0;
    transform: scale(0.8);
    transition:
      opacity 0.3s ease,
      transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .cover-card:hover & {
    background: rgba(0, 0, 0, 0.25);
    i {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (hover: none) {
    i {
      opacity: 0.7;
      transform: scale(1);
    }
    background: linear-gradient(to top, rgba(0, 0, 0, 0.3) 0%, transparent 50%);
  }
}

.cover-text {
  margin-top: 8px;
}

.cover-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--cover-text-primary, var(--m-text-primary, #2c2c2c));
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cover-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &.playlist {
    background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.12);
    color: var(--accent-color, #888);
  }

  &.album {
    background: rgba(99, 102, 241, 0.12);
    color: #6366f1;
  }
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
    font-size: 56px;
    opacity: 0.3;
  }

  p {
    font-size: 14px;
  }
}

.bottom-spacer {
  width: 100%;
  height: calc(
    var(--mobile-dock-content-inset, 132px) + var(--safe-area-inset-bottom, 0px) + 280px
  );
  flex: 0 0 auto;
  grid-column: 1 / -1;
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--cover-surface-alt, rgba(128, 128, 128, 0.08)) 25%,
    var(--cover-surface-hover, rgba(128, 128, 128, 0.14)) 50%,
    var(--cover-surface-alt, rgba(128, 128, 128, 0.08)) 75%
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

@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer {
    animation: none;
  }
}
</style>
