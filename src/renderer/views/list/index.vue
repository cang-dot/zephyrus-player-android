<template>
  <div class="list-page">
    <div ref="scrollRef" class="list-scroll" @scroll.passive="onScroll">
      <glow-tabs
        v-if="playlistSourceTabs.length > 1"
        v-model="playlistSourceFilter"
        :tabs="playlistSourceTabs"
        scrollable
        class="playlist-source-tabs"
      />

      <!-- Loading skeleton -->
      <div v-if="isLoading" class="cover-grid">
        <div v-for="i in 6" :key="'skeleton-' + i" class="cover-card">
          <div class="cover-wrap skeleton-shimmer" style="aspect-ratio: 1; border-radius: 16px;" />
          <div class="cover-text">
            <div class="skeleton-shimmer" style="height: 14px; width: 80%; border-radius: 6px; margin-bottom: 6px;" />
            <div class="skeleton-shimmer" style="height: 11px; width: 50px; border-radius: 6px;" />
          </div>
        </div>
      </div>

      <!-- Cover Grid -->
      <div v-else-if="items.length > 0" class="cover-grid">
        <div
          v-for="item in items"
          :key="`${item.accountId}-${item.type}-${item.id}`"
          class="cover-card"
          @click="handleItemClick(item)"
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
            <span class="cover-type-badge" :class="item.type">
              {{ item.type === 'album' ? 'Album' : 'Playlist' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="empty-state">
        <i class="ri-disc-line"></i>
        <p>暂无歌单或专辑</p>
      </div>

      <div class="bottom-spacer" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { computed, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { fetchPlatformPlaylistTracks } from '@/api/platformQrApi';
import GlowTabs from '@/components/common/GlowTabs.vue';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import { useHeroCard } from '@/composables/useHeroCard';
import { useUserStore } from '@/store';
import {
  type MusicPlatform,
  usePlatformAccountsStore
} from '@/store/modules/platformAccounts';
import { getImgUrl } from '@/utils';

defineOptions({ name: 'MyMusic' });

const { t } = useI18n();
const router = useRouter();
const message = useMessage();
const userStore = useUserStore();
const accountStore = usePlatformAccountsStore();
const { setHeroCard, setCompact, showHeroCard, hideHeroCard } = useHeroCard();

const scrollRef = ref<HTMLElement | null>(null);
let rafId = 0;
const playlistSourceFilter = ref<'all' | MusicPlatform>('all');
const platformPlaylistTracksCache = new Map<string, any[]>();

// 加载状态：用户未登录或歌单数据未加载完成
const isLoading = computed(() => {
  return !accountStore.accounts.length && !userStore.user;
});

const playlistSourceTabs = computed(() => [
  { key: 'all', label: '全部' },
  ...accountStore.accountsForPlatform('netease').length ? [{ key: 'netease', label: '网易云' }] : [],
  ...accountStore.accountsForPlatform('qq').length ? [{ key: 'qq', label: 'QQ 音乐' }] : [],
  ...accountStore.accountsForPlatform('kugou').length ? [{ key: 'kugou', label: '酷狗音乐' }] : []
]);

const items = computed(() => {
  const result: any[] = [];

  for (const account of accountStore.accounts) {
    if (playlistSourceFilter.value !== 'all' && account.platform !== playlistSourceFilter.value) {
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

  return result;
});

// 更新共享卡片内容
const updateHeroCard = () => {
  setHeroCard({
    title: t('comp.list'),
    subtitle: `${items.value.length} ${t('comp.musicList.songs')}`,
    variant: 'simple',
    visible: true,
  });
};

const onScroll = () => {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    const el = scrollRef.value;
    if (el) {
      setCompact(el.scrollTop > 10);
    }
    rafId = 0;
  });
};

const handleItemClick = async (item: any) => {
  const account = accountStore.accounts.find((candidate) => candidate.accountId === item.accountId);
  if (!account) return;

  accountStore.setActiveAccount(account.accountId);

  if (item.type === 'playlist' && account.platform === 'kugou' && account.cookie) {
    const listId = String(
      item.raw.listId ||
        item.raw.list_id ||
        item.raw.globalCollectionId ||
        item.raw.global_collection_id ||
        item.id ||
        ''
    ).trim();
    if (!listId) {
      message.warning('这个酷狗歌单缺少可加载的标识');
      return;
    }

    const cacheKey = `${account.accountId}:${listId}`;
    try {
      let songs = platformPlaylistTracksCache.get(cacheKey) || [];
      if (!songs.length) {
        const result = await fetchPlatformPlaylistTracks('kugou', account.cookie, listId);
        songs = result.songs;
        platformPlaylistTracksCache.set(cacheKey, songs);
      }
      if (!songs.length) {
        message.warning('这个酷狗歌单暂时没有可播放的歌曲');
        return;
      }
      navigateToMusicList(router, {
        id: item.id,
        type: 'playlist',
        name: item.alt,
        songList: songs,
        listInfo: item.raw,
        canRemove: false
      });
    } catch (error: any) {
      console.error('加载酷狗歌单失败:', error);
      message.error(error?.message || '酷狗歌单加载失败');
    }
    return;
  }

  navigateToMusicList(router, {
    id: item.id,
    type: item.type,
    name: item.alt,
    listInfo: item.raw,
    canRemove: account.platform === 'netease' && item.type === 'playlist'
  });
};

// 监听数据变化更新卡片
watch([items, () => userStore.user], () => {
  updateHeroCard();
}, { immediate: true });

onMounted(() => {
  updateHeroCard();
  showHeroCard();
});

onActivated(() => {
  updateHeroCard();
  showHeroCard();
});

onBeforeUnmount(() => {
  hideHeroCard();
});
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
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  /* 为固定悬浮卡片留出空间 */
  padding-top: calc(var(--safe-area-inset-top, 0px) + 140px);
  &::-webkit-scrollbar { display: none; }
}

.playlist-source-tabs {
  display: flex;
  margin: 0 16px 16px;
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
  border-radius: 16px;
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
    transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
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
  display: inline-block;
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
  height: calc(var(--safe-area-inset-bottom, 0px) + 120px);
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
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer { animation: none; }
}
</style>
