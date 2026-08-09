<template>
  <div class="mobile-home">
    <section class="mode-grid">
      <button class="mode-card fm" type="button" @click="playPersonalFm">
        <i class="ri-radio-fill" />
        <span>私人 FM</span>
        <small>{{ fmLoading ? '正在准备' : '为你连续播放' }}</small>
      </button>
      <button class="mode-card" type="button" @click="intelligenceStore.playIntelligenceMode">
        <i class="ri-heart-pulse-fill" />
        <span>心动模式</span>
        <small>从喜欢的音乐出发</small>
      </button>
      <button class="mode-card random" type="button" @click="openRandomPlaylist">
        <i class="ri-shuffle-line" />
        <span>随机歌单</span>
        <small>换一种播放顺序</small>
      </button>
    </section>

    <section class="daily-section">
      <header>
        <div>
          <small>{{ todayLabel }}</small>
          <h2>每日推荐歌曲</h2>
        </div>
        <button type="button" title="播放全部" @click="playDailySongs">
          <i class="ri-play-fill" />
        </button>
      </header>
      <div v-if="!dailySongs.length" class="daily-empty">今日推荐正在准备</div>
      <song-item
        v-for="song in dailySongs.slice(0, 12)"
        :key="song.id"
        :item="song"
        home
        :favorite="false"
        @play="playSong(song)"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { getPersonalFM, getPersonalizedPlaylist } from '@/api/home';
import SongItem from '@/components/common/SongItem.vue';
import { useIntelligenceModeStore } from '@/store/modules/intelligenceMode';
import { usePlayerCoreStore } from '@/store/modules/playerCore';
import { usePlaylistStore } from '@/store/modules/playlist';
import { useRecommendStore } from '@/store/modules/recommend';
import type { SongResult } from '@/types/music';

const router = useRouter();
const recommendStore = useRecommendStore();
const playerCore = usePlayerCoreStore();
const playlistStore = usePlaylistStore();
const intelligenceStore = useIntelligenceModeStore();
const fmLoading = ref(false);
const dailySongs = computed(() => recommendStore.dailyRecommendSongs);
const todayLabel = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  day: 'numeric',
  weekday: 'short'
}).format(new Date());

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

async function openRandomPlaylist() {
  const response = await getPersonalizedPlaylist(20);
  const playlists = response.data?.result || [];
  if (!playlists.length) return;
  const item = playlists[Math.floor(Math.random() * playlists.length)];
  router.push(`/music-list/${item.id}?type=playlist`);
}

async function playSong(song: SongResult) {
  await playerCore.handlePlayMusic(normalizeSong(song), true);
}

async function playDailySongs() {
  const songs = dailySongs.value.map(normalizeSong);
  if (!songs.length) return;
  playlistStore.setPlayList(songs, false, false);
  await playerCore.handlePlayMusic(songs[0], true);
}

onMounted(() => recommendStore.refreshIfStale());
</script>

<style scoped lang="scss">
.mobile-home {
  min-height: 100%;
  padding: 72px 14px 150px;
  color: #fff;
}

.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.mode-card {
  --material-tone: 0.14;
  min-height: 112px;
  padding: 16px;
  display: grid;
  justify-items: start;
  align-content: end;
  gap: 3px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 28px;
  background:
    linear-gradient(
      rgba(var(--accent-color-rgb, 136, 136, 136), var(--material-tone)),
      rgba(var(--accent-color-rgb, 136, 136, 136), var(--material-tone))
    ),
    color-mix(in srgb, rgba(30, 30, 32, 0.62) 58%, transparent);
  color: #fff;
  box-shadow:
    0 12px 28px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(24px) saturate(165%);
  -webkit-backdrop-filter: blur(24px) saturate(165%);

  &.fm {
    --material-tone: 0.22;
    grid-row: span 2;
    min-height: 234px;
  }

  &.random {
    --material-tone: 0.1;
    min-height: 112px;
  }

  i {
    margin-bottom: auto;
    font-size: 25px;
    color: color-mix(in srgb, var(--accent-color) 72%, #fff);
  }

  span {
    font-size: 17px;
    font-weight: 750;
  }

  small {
    color: rgba(255, 255, 255, 0.64);
  }
}

.daily-section {
  margin-top: 12px;
  padding: 16px 12px 6px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 30px;
  background:
    linear-gradient(
      rgba(var(--accent-color-rgb, 136, 136, 136), 0.12),
      rgba(var(--accent-color-rgb, 136, 136, 136), 0.12)
    ),
    color-mix(in srgb, rgba(30, 30, 32, 0.58) 58%, transparent);
  box-shadow:
    0 14px 32px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(24px) saturate(165%);
  -webkit-backdrop-filter: blur(24px) saturate(165%);

  header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    margin: 0 4px 12px;
  }

  h2 {
    margin: 2px 0 0;
    font-size: 24px;
    font-weight: 800;
  }

  small {
    color: rgba(255, 255, 255, 0.62);
  }

  header button {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent-color) 82%, #fff);
    color: #fff;
  }
}

.daily-empty {
  padding: 48px 0;
  color: rgba(255, 255, 255, 0.58);
  text-align: center;
}

@media (prefers-reduced-motion: no-preference) {
  .mode-card:active,
  .daily-section header button:active {
    transform: scale(0.97);
    transition: transform 120ms ease-out;
  }
}
</style>
