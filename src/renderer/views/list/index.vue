<template>
  <div class="list-page">
    <div class="list-scroll">
      <!-- 最近常听：最近打开的四个歌单（上限四个） -->
      <section v-if="recentItems.length" class="list-strip recent-strip">
        <header class="strip-header static">
          <i class="ri-history-line strip-icon" />
          <span class="strip-title">最近常听</span>
        </header>
        <div class="cover-grid strip-grid">
          <div
            v-for="item in recentItems"
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
              <p class="cover-name">
                {{ item.alt }}
                <platform-logo
                  class="cover-name-logo"
                  :platform="item.platform"
                  :size="12"
                  color="var(--cover-text-muted, var(--m-text-muted, #9a9590))"
                />
              </p>
              <span class="cover-kind">{{
                `${item.type === 'album' ? '专辑' : '歌单'}${coverKindCountSuffix(item)}`
              }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 来源收纳条：每个来源一个可折叠分区 -->
      <section
        v-for="strip in sourceStrips"
        :key="strip.key"
        class="list-strip"
        :class="{ expanded: openStrips.includes(strip.key) }"
      >
        <button type="button" class="strip-header pressable" @click="toggleStrip(strip.key)">
          <platform-logo
            v-if="strip.platform !== 'local'"
            :platform="strip.platform"
            :size="16"
            color="var(--accent-color, #888)"
          />
          <i v-else class="ri-hard-drive-3-line strip-icon" />
          <span class="strip-title">{{ strip.label }}</span>
          <span class="strip-count">{{ strip.count }}</span>
          <i class="ri-arrow-down-s-line strip-arrow" />
        </button>
        <div class="strip-body">
          <div class="strip-inner">
            <local-music-view
              v-if="strip.key === 'local' && openStrips.includes('local')"
              embedded
              class="embedded-local-music"
            />
            <div v-else class="cover-grid strip-grid">
              <div
                v-for="item in strip.items"
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
                  <p class="cover-name">
                    {{ item.alt }}
                    <platform-logo
                      class="cover-name-logo"
                      :platform="item.platform"
                      :size="12"
                      color="var(--cover-text-muted, var(--m-text-muted, #9a9590))"
                    />
                  </p>
                  <span class="cover-kind">{{
                    `${item.type === 'album' ? '专辑' : '歌单'}${coverKindCountSuffix(item)}`
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 未登录 / 全部来源加载失败：状态提示块。
           「全部」下仍会渲染本地歌曲入口卡，故提示块独立于网格之外。 -->
      <div
        v-if="stateNotice"
        class="state-block"
        :class="{ 'state-block--error': stateNotice.kind === 'error' }"
      >
        <i :class="stateNotice.icon" />
        <p class="state-title">{{ stateNotice.title }}</p>
        <p class="state-desc">{{ stateNotice.desc }}</p>
        <button
          class="state-action pressable"
          @click="stateNotice.kind === 'error' ? retryFailedSources() : goLogin()"
        >
          {{ stateNotice.kind === 'error' ? '重试' : '去登录' }}
        </button>
      </div>

      <!-- Loading skeleton -->
      <div v-if="showSkeleton" class="cover-grid">
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

      <!-- 部分来源加载失败：不阻断已加载内容，以横幅提示 -->
      <div v-if="partialErrors.length" class="partial-error">
        <i class="ri-error-warning-line" />
        <div class="partial-error-body">
          <p class="partial-error-title">部分来源加载失败</p>
          <p
            v-for="entry in partialErrors"
            :key="entry.account.accountId"
            class="partial-error-desc"
          >
            {{ entry.state.message }}
          </p>
        </div>
        <button class="partial-error-retry pressable" @click="retryFailedSources()">重试</button>
      </div>

      <div class="bottom-spacer" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { fetchPlatformAccountData } from '@/api/platformQrApi';
import { getUserPlaylist } from '@/api/user';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlatformLogo from '@/components/common/PlatformLogo.vue';
import { useUserStore } from '@/store';
import { type MusicPlatform, usePlatformAccountsStore } from '@/store/modules/platformAccounts';
import { getImgUrl } from '@/utils';
import {
  orderPlaylistCards,
  PLAYLIST_CARD_MRU_KEY,
  playlistCardKey,
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

/** 封面卡稳定标识:跨来源筛选切换时同卡同 key,是 FILTER MOVE 段 FLIP 的前提 */
const cardKey = (item: any) => `${item.accountId}-${item.type}-${item.id}`;
// ==================== 数据加载与页面状态 ====================
// 歌单页自己负责拉取数据。原先只读缓存：未登录会永远停在骨架屏，
// 没进过「我的」页则歌单永远是空的。

type AccountLoadStatus = 'loading' | 'ok' | 'error';
interface AccountLoadState {
  status: AccountLoadStatus;
  message?: string;
}

const accountLoadStates = ref<Record<string, AccountLoadState>>({});
let loadSequence = 0;

/** 不同失败形态给不同文案，而不是笼统的「加载失败」 */
function describeLoadError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const text = raw.toLowerCase();
  if (/timeout|timed?\s?out|network error|err_network|fetch failed/.test(text)) {
    return '网络超时或中断，请检查网络后重试';
  }
  if (/\b(301|401|403)\b|登录|cookie|未登录|expired/.test(text)) {
    return '登录状态已失效，请到「我的」页重新登录';
  }
  if (/\b429\b|频率|频繁|rate limit/.test(text)) {
    return '来源接口限流，稍等片刻再试';
  }
  if (/\b5\d\d\b|服务器|server error|bad gateway/.test(text)) {
    return raw || '来源服务暂时不可用，稍后重试';
  }
  return raw || '加载失败，请重试';
}

/** 当前筛选下的来源账号；local 视图不参与 */
const relevantAccounts = computed(() => accountStore.accounts);

const notLoggedIn = computed(
  () => playlistSourceFilter.value !== 'local' && relevantAccounts.value.length === 0
);

const failedAccounts = computed(() =>
  relevantAccounts.value
    .map((account) => ({ account, state: accountLoadStates.value[account.accountId] }))
    .filter((entry) => entry.state?.status === 'error')
);

const allSourcesFailed = computed(
  () =>
    relevantAccounts.value.length > 0 &&
    relevantAccounts.value.every(
      (account) => accountLoadStates.value[account.accountId]?.status === 'error'
    )
);

const showSkeleton = computed(() => {
  if (!relevantAccounts.value.length) return false;
  return relevantAccounts.value.every(
    (account) => accountLoadStates.value[account.accountId]?.status === 'loading'
  );
});

const stateNotice = computed(() => {
  if (notLoggedIn.value) {
    return {
      kind: 'login' as const,
      icon: 'ri-user-line',
      title: '暂未登录',
      desc: '登录网易云 / QQ 音乐 / 酷狗后，这里会显示对应账号的歌单与专辑。'
    };
  }
  if (allSourcesFailed.value) {
    return {
      kind: 'error' as const,
      icon: 'ri-wifi-off-line',
      title: '歌单加载失败',
      desc: failedAccounts.value[0]?.state?.message || '请检查网络后重试'
    };
  }
  return null;
});

/** 有成功有失败时不整屏报错，只挂横幅 */
const partialErrors = computed(() => (allSourcesFailed.value ? [] : failedAccounts.value));

const goLogin = () => {
  router.push({ path: '/user', query: { panel: 'login' } });
};

const retryFailedSources = () => {
  for (const { account } of failedAccounts.value) {
    delete accountLoadStates.value[account.accountId];
  }
  accountLoadStates.value = { ...accountLoadStates.value };
  void ensureSourcesLoaded();
};

async function ensureSourcesLoaded() {
  const sequence = ++loadSequence;
  const targets = relevantAccounts.value;
  if (!targets.length) {
    accountLoadStates.value = {};
    return;
  }

  await Promise.all(
    targets.map(async (account) => {
      const existing = accountLoadStates.value[account.accountId];
      if (existing && (existing.status === 'ok' || existing.status === 'loading')) return;

      const settle = (state: AccountLoadState) => {
        if (sequence !== loadSequence) return;
        accountLoadStates.value = { ...accountLoadStates.value, [account.accountId]: state };
      };

      settle({ status: 'loading' });
      try {
        if (account.platform === 'netease') {
          const isActive = accountStore.activeAccountId === account.accountId;
          if (isActive && !userStore.playList?.length) {
            const response = await getUserPlaylist(Number(account.userId));
            if (response.data?.playlist && accountStore.activeAccountId === account.accountId) {
              userStore.playList = response.data.playlist;
            }
          }
        } else if (account.platform === 'qq' || account.platform === 'kugou') {
          const cache = accountStore.accountCache[account.accountId];
          if (!cache?.playlists?.length) {
            const data = await fetchPlatformAccountData(account.platform, account.cookie || '');
            accountStore.cacheAccountData(account.accountId, 'playlists', data.playlists);
            accountStore.cacheAccountData(account.accountId, 'albums', data.albums);
          }
        }
        // spotify 等其余来源：数据由「我的」页同步，这里缺省视为已加载（与既有行为一致）
        settle({ status: 'ok' });
      } catch (error) {
        settle({ status: 'error', message: describeLoadError(error) });
      }
    })
  );
}

onMounted(() => {
  void ensureSourcesLoaded();
});

watch(
  () => accountStore.accounts.map((account) => account.accountId).join(','),
  () => {
    void ensureSourcesLoaded();
  }
);

// ==================== 来源收纳条 ====================
const sourceStrips = computed(() => [
  { key: 'netease', label: '网易云', platform: 'netease', items: buildItems('netease') },
  { key: 'qq', label: 'QQ 音乐', platform: 'qq', items: buildItems('qq') },
  { key: 'kugou', label: '酷狗音乐', platform: 'kugou', items: buildItems('kugou') },
  { key: 'local', label: '本地音乐', platform: 'local', items: [] as any[], count: 0 }
]);

const openStrips = ref<string[]>(['netease']);

const toggleStrip = (key: string) => {
  openStrips.value = openStrips.value.includes(key)
    ? openStrips.value.filter((candidate) => candidate !== key)
    : [...openStrips.value, key];
};

// ==================== 最近常听：最近打开的四个歌单 ====================
const recentItems = computed<any[]>(() => {
  const index = new Map<string, any>();
  for (const item of buildItems('all')) {
    if (!item.isLocal) index.set(playlistCardKey(item), item);
  }
  return cardMru.value.keys
    .map((key) => index.get(key))
    .filter((item): item is any => Boolean(item))
    .slice(0, 4);
});

/**
 * 类型小字的曲目数后缀：网易云歌单原生带 trackCount，QQ/酷狗由服务端网关
 * 归一化为 trackCount，专辑统一用 size。取不到有效数字时不加后缀。
 */
const coverKindCountSuffix = (item: any) => {
  const raw = item.raw || {};
  const count = Number(raw.trackCount ?? raw.size ?? 0);
  return Number.isFinite(count) && count > 0 ? ` · ${count}首` : '';
};

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

const handleItemClick = (item: any) => {
  touchCardMru(item);
  if (item.isLocal) {
    router.push('/local-music');
    return;
  }
  const account = accountStore.accounts.find((candidate) => candidate.accountId === item.accountId);
  if (!account) return;

  // 记录封面卡片位置，歌单页 hero 封面据此做飞入过渡
  const cardImg = document.querySelector(
    `.cover-card[data-key="${CSS.escape(String(cardKey(item)))}"] .cover-img`
  ) as HTMLElement | null;
  if (cardImg) {
    const rect = cardImg.getBoundingClientRect();
    sessionStorage.setItem(
      'musicListCoverRect',
      JSON.stringify({ x: rect.x, y: rect.y, w: rect.width, h: rect.height })
    );
  }

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
/* 与主页/发现/我的页一致:min-height 流式内容,滚动统一交由 .pager-page */
.list-page {
  width: 100%;
  min-height: 100%;
  position: relative;
  background: var(--cover-bg, var(--m-bg, var(--bg-color, #f5f1eb)));
}

.list-scroll {
  width: 100%;
  padding-top: var(--mobile-topbar-inset);
  padding-bottom: calc(
    var(--mobile-dock-content-inset, 132px) + var(--safe-area-inset-bottom, 0px) + 180px
  );
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
  margin: 0 16px;
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

.cover-name-logo {
  display: inline-flex;
  vertical-align: -1px;
  margin-left: 2px;
}

/* 类型小字:比名字淡一级,无胶囊底 */
.cover-kind {
  display: block;
  margin-top: 3px;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
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

/* ── 未登录 / 全部来源失败的状态提示块 ── */
.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 24px 16px 0;
  padding: 44px 24px;
  gap: 10px;
  border: 1px solid var(--m-outline-variant, var(--m-border, #d5d0c9));
  border-radius: var(--m-radius-lg, 16px);
  background: var(--m-surface-container, var(--m-card, #e8e4dc));
  text-align: center;

  > i {
    font-size: 44px;
    color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  }

  .state-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--cover-text-primary, var(--m-text-primary, #2c2c2c));
  }

  .state-desc {
    max-width: 300px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--cover-text-secondary, var(--m-text-secondary, #6b6560));
  }

  .state-action {
    margin-top: 6px;
    padding: 8px 28px;
    border: 0;
    border-radius: var(--m-radius-full, 9999px);
    background: var(--accent-color, #888);
    color: #fff;
    font-size: 13px;
    font-weight: 500;
  }

  &.state-block--error > i {
    color: var(--m-text-secondary, #6b6560);
  }
}

/* ── 部分来源加载失败横幅 ── */
.partial-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 16px 16px 0;
  padding: 12px 14px;
  border: 1px solid var(--m-outline-variant, var(--m-border, #d5d0c9));
  border-radius: var(--m-radius-md, 12px);
  background: var(--m-surface-container, var(--m-card, #e8e4dc));

  > i {
    flex-shrink: 0;
    font-size: 18px;
    color: var(--cover-text-secondary, var(--m-text-secondary, #6b6560));
  }

  .partial-error-body {
    flex: 1;
    min-width: 0;
  }

  .partial-error-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--cover-text-primary, var(--m-text-primary, #2c2c2c));
  }

  .partial-error-desc {
    margin-top: 2px;
    font-size: 11px;
    line-height: 1.5;
    color: var(--cover-text-secondary, var(--m-text-secondary, #6b6560));
  }

  .partial-error-retry {
    flex-shrink: 0;
    padding: 5px 14px;
    border: 1px solid var(--m-outline-variant, var(--m-border, #d5d0c9));
    border-radius: var(--m-radius-full, 9999px);
    background: transparent;
    color: var(--cover-text-primary, var(--m-text-primary, #2c2c2c));
    font-size: 12px;
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

/* ==================== 来源收纳条 ==================== */ .list-strip { margin: 0 16px 14px;
border-radius: 16px; background: rgba(128, 128, 128, 0.08); border: 1px solid rgba(128, 128, 128,
0.12); overflow: hidden; } .recent-strip { background: transparent; border: 0; padding-top: 4px; }
.strip-header { display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 14px;
border: 0; background: transparent; color: var(--d-text-primary, rgba(0, 0, 0, 0.92)); font-size:
15px; font-weight: 700; cursor: pointer; text-align: left; .strip-icon { font-size: 17px; color:
var(--accent-color, #888); } .strip-title { flex: 1; min-width: 0; overflow: hidden; text-overflow:
ellipsis; white-space: nowrap; } .strip-count { font-size: 12px; font-weight: 400; color:
var(--d-text-secondary, rgba(0, 0, 0, 0.45)); } .strip-arrow { font-size: 18px; color:
var(--d-text-secondary, rgba(0, 0, 0, 0.5)); transition: transform 260ms cubic-bezier(0.32, 0.72, 0,
1); } } .list-strip.expanded .strip-header .strip-arrow { transform: rotate(180deg); } .strip-body {
display: grid; grid-template-rows: 0fr; transition: grid-template-rows 420ms cubic-bezier(0.32,
0.72, 0, 1); } .list-strip.expanded .strip-body { grid-template-rows: 1fr; } .strip-inner {
overflow: hidden; padding-bottom: 0; } .list-strip.expanded .strip-inner { padding-bottom: 10px; }
.strip-grid { margin: 0 8px; } .embedded-local-music { margin: 0 8px; }
