<template>
  <div class="mobile-home">
    <mobile-home-hero
      :covers="wallCovers"
      :is-heart-mode="isHeartMode"
      :current-cover-url="currentCoverUrl"
      :user-name="userName"
      :fm-loading="fmLoading"
      @play-heart="playHeartMode"
      @play-fm="playPersonalFm"
    />

    <listening-heatmap />

    <section v-if="cloudCards.length" class="home-section">
      <song-list-card-row
        :cards="cloudCards"
        internal-scroll
        @song-play="onCardSongPlay"
        @detail="openCloudLibrary"
      />
    </section>

    <section v-if="dailyPlaylists.length" class="home-section">
      <div class="playlist-cards">
        <button
          v-for="playlist in dailyPlaylists"
          :key="playlist.id"
          type="button"
          class="playlist-card"
          @click="openPlaylist(playlist)"
        >
          <img
            :src="getImgUrl(playlist.picUrl || playlist.coverImgUrl, '300y300')"
            class="playlist-cover"
            alt=""
            loading="lazy"
          />
          <span class="playlist-name">{{ playlist.name }}</span>
          <span v-if="playlist.playCount" class="playlist-count">{{
            formatPlayCount(playlist.playCount)
          }}</span>
        </button>
      </div>
    </section>

    <section v-if="dailyCards.length" class="home-section">
      <song-list-card-row
        :cards="dailyCards"
        @song-play="onCardSongPlay"
        @detail="openDailyRecommend"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getPersonalFM, getPersonalizedPlaylist } from '@/api/home';
import { loadServerSongs, type ServerSong } from '@/api/serverSongs';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import { playMusic } from '@/hooks/MusicHook';
import { useUserStore } from '@/store';
import { useIntelligenceModeStore } from '@/store/modules/intelligenceMode';
import { usePlayerCoreStore } from '@/store/modules/playerCore';
import { usePlaylistStore } from '@/store/modules/playlist';
import { useRecommendStore } from '@/store/modules/recommend';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';
import { resolveSongBadge } from '@/utils/songBadges';
import ListeningHeatmap from '@/views/home/components/ListeningHeatmap.vue';
import MobileHomeHero from '@/views/home/components/MobileHomeHero.vue';
import { type CardSong, type SongListCard } from '@/views/home/components/SongListCardRow.vue';
import SongListCardRow from '@/views/home/components/SongListCardRow.vue';

const { t } = useI18n();
const router = useRouter();
const recommendStore = useRecommendStore();
const playerCore = usePlayerCoreStore();
const playlistStore = usePlaylistStore();
const intelligenceStore = useIntelligenceModeStore();
const userStore = useUserStore();
const fmLoading = ref(false);

// ==================== Hero ====================
const isHeartMode = computed(() => playlistStore.playMode === 3);
const currentCoverUrl = computed(() => playMusic.value?.picUrl || '');
const userName = computed(
  () =>
    (userStore.user as any)?.nickname ||
    (userStore.user as any)?.profile?.nickname ||
    t('comp.homeSection.guestName')
);

/** 照片墙：用户歌单库封面去重（≤30 张），兜底云歌曲/日推封面 */
const cloudSongs = ref<ServerSong[]>([]);
const wallCovers = computed(() => {
  const covers: string[] = [];
  const push = (url?: string) => {
    if (!url) return;
    const normalized = getImgUrl(url, '300y300');
    if (!covers.includes(normalized)) covers.push(normalized);
  };
  for (const playlist of userStore.playList as any[])
    push(playlist?.coverImgUrl || playlist?.picUrl);
  for (const album of userStore.albumList as any[]) push(album?.picUrl || album?.coverImgUrl);
  for (const song of cloudSongs.value) push(song?.picUrl);
  for (const song of dailySongs.value as any[]) push(song?.picUrl || song?.al?.picUrl);
  return covers.slice(0, 30);
});

async function playHeartMode() {
  await intelligenceStore.playIntelligenceMode();
}

async function playPersonalFm() {
  if (fmLoading.value) return;
  fmLoading.value = true;
  try {
    const response = await getPersonalFM();
    const songs = (response.data?.data || []).map(normalizeSong);
    if (!songs.length) return;
    playlistStore.setPlayList(songs, false, false);
    playerCore.isFmPlaying = true;
    await playerCore.handlePlayMusic(songs[0], true);
  } finally {
    fmLoading.value = false;
  }
}

// ==================== 数据 ====================
const dailyPlaylists = ref<any[]>([]);
const dailySongs = computed(() => recommendStore.dailyRecommendSongs);

function normalizeSong(song: any): SongResult {
  return {
    ...song,
    id: song.id,
    name: song.name,
    picUrl: song.picUrl || song.al?.picUrl || song.album?.picUrl,
    ar: song.ar || song.artists,
    al: song.al || song.album,
    source: 'netease',
    song,
    playLoading: false
  } as SongResult;
}

/** 统一模板的歌曲行徽章：推荐理由 > 音质 > 小众（纯函数见 utils/songBadges） */
const badgeFor = (song: any): CardSong['badge'] | undefined => resolveSongBadge(song, t);

const toCardSong = (song: any): CardSong => {
  const normalized = normalizeSong(song);
  return {
    id: normalized.id,
    name: normalized.name || '',
    cover: normalized.picUrl || '',
    artist: (normalized.ar || [])
      .map((artist: any) => artist?.name)
      .filter(Boolean)
      .join(' / '),
    badge: badgeFor(song),
    raw: song
  };
};

const chunkCards = (
  songs: any[],
  nameFor: (index: number, songs: any[]) => string,
  detailable: boolean
): SongListCard[] => {
  const cards: SongListCard[] = [];
  for (let i = 0; i * 3 < songs.length; i++) {
    const chunk = songs.slice(i * 3, i * 3 + 3);
    if (!chunk.length) continue;
    cards.push({
      id: `card-${i}`,
      name: nameFor(i, chunk),
      songs: chunk.map(toCardSong),
      detailable
    });
  }
  return cards;
};

/** 云歌曲：单卡内部横滑展示全部歌曲 */
const cloudCards = computed<SongListCard[]>(() => {
  const songs = cloudSongs.value.slice(-12).reverse();
  if (!songs.length) return [];
  return [
    {
      id: 'cloud-all',
      name: t('comp.homeSection.cloudTitle'),
      songs: songs.map(toCardSong),
      detailable: true
    }
  ];
});

/** 每日歌曲推荐卡 */
const dailyCards = computed<SongListCard[]>(() =>
  chunkCards(
    (dailySongs.value as any[]).slice(0, 12),
    (index) =>
      index === 0
        ? t('comp.homeSection.dailyBasis')
        : t('comp.homeSection.dailyMore', { n: index + 1 }),
    true
  )
);

// ==================== 行为 ====================
function onCardSongPlay(_card: SongListCard, song: CardSong) {
  void playerCore.handlePlayMusic(normalizeSong(song.raw), true);
}

function openCloudLibrary() {
  router.push('/music-list/zephyrus-cloud?type=server-library');
}

function openDailyRecommend() {
  navigateToMusicList(router, {
    type: 'dailyRecommend',
    name: t('comp.homeSection.dailyBasis'),
    songList: (dailySongs.value as any[]).map(normalizeSong)
  });
}

function openPlaylist(playlist: any) {
  router.push(`/music-list/${playlist.id}?type=playlist`);
}

function formatPlayCount(count: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact' }).format(count);
}

onMounted(async () => {
  loadServerSongs()
    .then((all) => {
      cloudSongs.value = all.slice(-12).reverse();
    })
    .catch(() => {});
  await Promise.allSettled([
    recommendStore.refreshIfStale(),
    getPersonalizedPlaylist(20).then((response) => {
      dailyPlaylists.value = response.data?.result || [];
    })
  ]);
});
</script>

<style lang="scss" scoped>
.mobile-home {
  padding: 12px 0 8px;
  overflow-x: clip;
  --page-pl: 16px;
}

.home-section {
  margin-bottom: 6px;
}

/* 歌单推荐：变体卡横滚（封面+名字+播放数，右缘露下一张） */
.playlist-cards {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 2px 16px 10px;
  scroll-padding: 0 16px;
  scroll-snap-type: x proximity;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  .playlist-card {
    flex: 0 0 auto;
    width: 132px;
    scroll-snap-align: start;
    border: 0;
    background: transparent;
    cursor: pointer;
    text-align: left;
    padding: 0;

    .playlist-cover {
      width: 132px;
      height: 132px;
      border-radius: 12px;
      object-fit: cover;
      background: rgba(128, 128, 128, 0.12);
    }

    .playlist-name {
      display: block;
      margin-top: 7px;
      font-size: 12.5px;
      color: var(--d-text-primary, rgba(0, 0, 0, 0.9));
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .playlist-count {
      display: block;
      margin-top: 2px;
      font-size: 11px;
      color: var(--d-text-secondary, rgba(0, 0, 0, 0.45));
    }

    &:active .playlist-cover {
      transform: scale(0.98);
    }
  }
}
</style>
