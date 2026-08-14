<template>
  <div class="mobile-home">
    <section class="mode-grid">
      <button class="mode-card fm" type="button" @click="playPersonalFm">
        <img v-if="modeCovers.fm" :src="modeCovers.fm" alt="" />
        <span class="mode-shade" />
        <span class="mode-copy">
          <i class="ri-radio-fill" />
          <b>私人 FM</b>
          <small>{{ fmLoading ? '正在准备' : '为你连续播放' }}</small>
        </span>
      </button>
      <button class="mode-card" type="button" @click="intelligenceStore.playIntelligenceMode">
        <img v-if="modeCovers.heart" :src="modeCovers.heart" alt="" />
        <span class="mode-shade" />
        <span class="mode-copy">
          <i class="ri-heart-pulse-fill" />
          <b>心动模式</b>
          <small>从喜欢的音乐出发</small>
        </span>
      </button>
      <button class="mode-card random" type="button" @click="openRandomPlaylist">
        <img v-if="modeCovers.random" :src="modeCovers.random" alt="" />
        <span class="mode-shade" />
        <span class="mode-copy">
          <i class="ri-shuffle-line" />
          <b>随机歌单</b>
          <small>换一种播放顺序</small>
        </span>
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
import { playMusic } from '@/hooks/MusicHook';
import { useIntelligenceModeStore } from '@/store/modules/intelligenceMode';
import { usePlayerCoreStore } from '@/store/modules/playerCore';
import { usePlaylistStore } from '@/store/modules/playlist';
import { useRecommendStore } from '@/store/modules/recommend';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';

const router = useRouter();
const recommendStore = useRecommendStore();
const playerCore = usePlayerCoreStore();
const playlistStore = usePlaylistStore();
const intelligenceStore = useIntelligenceModeStore();
const fmLoading = ref(false);
const heroPlaylists = ref<any[]>([]);
const dailySongs = computed(() => recommendStore.dailyRecommendSongs);
const coverFor = (index: number) => {
  const song = dailySongs.value[index] || dailySongs.value[0];
  const playlist = heroPlaylists.value[index] || heroPlaylists.value[0];
  const url =
    song?.picUrl ||
    song?.al?.picUrl ||
    song?.album?.picUrl ||
    playlist?.picUrl ||
    playlist?.coverImgUrl;
  return url ? getImgUrl(url, '512y512') : '';
};
const modeCovers = computed(() => ({
  fm: playMusic.value?.picUrl ? getImgUrl(playMusic.value.picUrl, '512y512') : coverFor(0),
  heart: coverFor(1),
  random: coverFor(2)
}));
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
  let playlists = heroPlaylists.value;
  if (playlists.length < 2) {
    const response = await getPersonalizedPlaylist(20);
    playlists = response.data?.result || [];
  }
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

onMounted(async () => {
  await Promise.allSettled([
    recommendStore.refreshIfStale(),
    getPersonalizedPlaylist(8).then((response) => {
      heroPlaylists.value = response.data?.result || [];
    })
  ]);
});
</script>

<style scoped lang="scss">
.mobile-home {
  min-height: 100%;
  padding: calc(var(--safe-area-inset-top, 0px) + 64px) 14px 150px;
  color: var(--m-text-primary, #20211f);
}

.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.mode-card {
  position: relative;
  min-height: 112px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 30px;
  background: color-mix(in srgb, var(--accent-color, #77836e) 28%, #727873);
  color: #fff;
  text-align: left;

  &.fm {
    grid-row: span 2;
    min-height: 234px;
  }

  &.random {
    min-height: 112px;
  }

  > img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.02);
  }

  .mode-shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(9, 14, 12, 0.05) 20%, rgba(9, 14, 12, 0.72));
  }

  .mode-copy {
    position: absolute;
    inset: 0;
    display: grid;
    align-content: end;
    justify-items: start;
    gap: 3px;
    padding: 16px;

    i {
      margin-bottom: auto;
      color: #fff;
      font-size: 25px;
    }

    b {
      font-size: 18px;
      font-weight: 750;
    }

    small {
      color: rgba(255, 255, 255, 0.78);
    }
  }
}

.daily-section {
  margin-top: 12px;
  padding: 16px 12px 6px;
  border: 1px solid color-mix(in srgb, var(--accent-color, #777) 22%, transparent);
  border-radius: 30px;
  background: color-mix(in srgb, var(--m-surface, #fff) 91%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);

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
    color: var(--m-text-secondary, #777);
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
  color: var(--m-text-secondary, #777);
  text-align: center;
}

.daily-section :deep(.home-song-card) {
  background: transparent !important;
}

.daily-section :deep(.song-name) {
  color: var(--m-text-primary, #20211f) !important;
}

.daily-section :deep(.artist-name),
.daily-section :deep(.more-btn) {
  color: var(--m-text-secondary, #777) !important;
}

@media (prefers-reduced-motion: no-preference) {
  .mode-card:active,
  .daily-section header button:active {
    transform: scale(0.97);
    transition: transform 120ms ease-out;
  }
}
</style>
