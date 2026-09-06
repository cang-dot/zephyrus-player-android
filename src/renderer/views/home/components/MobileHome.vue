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

    <!-- Zephyrus 云端曲库轮播胶囊:新歌即点即听 -->
    <button
      v-if="cloudSongs.length"
      type="button"
      class="cloud-marquee"
      @click="openCloudLibrary"
    >
      <span class="cloud-marquee-cover" :style="{ backgroundImage: `url(${currentCloudCover})` }" />
      <Transition name="cloud-marquee-text" mode="out-in">
        <span :key="currentCloudIndex" class="cloud-marquee-copy">
          <i class="ri-cloud-line" />
          嘿，最近 Zephyrus 云新上了<b>{{ currentCloudName }}</b>，点击即听！
        </span>
      </Transition>
      <i class="ri-arrow-right-s-line cloud-marquee-arrow" />
    </button>

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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { getPersonalFM, getPersonalizedPlaylist } from '@/api/home';
import { loadServerSongs, serverSongToSongResult, type ServerSong } from '@/api/serverSongs';
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
// ==================== 云端曲库轮播 ====================
const cloudSongs = ref<ServerSong[]>([]);
const currentCloudIndex = ref(0);
let cloudTimer: ReturnType<typeof setInterval> | null = null;
const currentCloudSong = computed(() => cloudSongs.value[currentCloudIndex.value] || null);
const currentCloudName = computed(() => currentCloudSong.value?.name || '');
const currentCloudCover = computed(() => currentCloudSong.value?.picUrl || '');

const openCloudLibrary = async () => {
  const song = currentCloudSong.value;
  if (!song) return;
  // 点击直接播放当前轮播曲;整个云曲库(而非仅轮播的5首)进播放列表
  const all = await loadServerSongs();
  const songs = all.map(serverSongToSongResult);
  const index = songs.findIndex((item) => String(item.id) === String(song.id));
  playlistStore.setPlayList(songs);
  await playSong(songs[index >= 0 ? index : 0]);
};

const rotateCloud = () => {
  if (!cloudSongs.value.length) return;
  currentCloudIndex.value = (currentCloudIndex.value + 1) % cloudSongs.value.length;
};
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
  loadServerSongs()
    .then((all) => {
      cloudSongs.value = all.slice(-5).reverse();
    })
    .catch(() => {});
  await Promise.allSettled([
    recommendStore.refreshIfStale(),
    getPersonalizedPlaylist(8).then((response) => {
      heroPlaylists.value = response.data?.result || [];
    })
  ]);
  cloudTimer = setInterval(rotateCloud, 5000);
});

onBeforeUnmount(() => {
  if (cloudTimer) clearInterval(cloudTimer);
});
</script>

<style scoped lang="scss">
.mobile-home {
  min-height: 100%;
  padding: var(--mobile-topbar-inset) 14px 150px;
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

/* ==================== 云端曲库轮播胶囊 ==================== */
.cloud-marquee {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: color-mix(in srgb, var(--m-surface-alt, #f3f0eb) 86%, transparent);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  cursor: pointer;
  text-align: left;
  transition:
    transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1),
    border-color 160ms ease;

  &:active {
    transform: scale(0.98);
    border-color: color-mix(in srgb, var(--accent-color, #888) 40%, transparent);
  }
}

.cloud-marquee-cover {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border-radius: 50%;
  background-color: rgba(var(--accent-color-rgb, 136, 136, 136), 0.14);
  background-position: center;
  background-size: cover;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
}

.cloud-marquee-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  font-size: 13px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--d-text-primary, inherit);

  i {
    flex: none;
    color: var(--accent-color);
  }

  b {
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--accent-color);
  }
}

.cloud-marquee-arrow {
  flex: none;
  color: var(--d-text-muted, #999);
}

.cloud-marquee-text-enter-active,
.cloud-marquee-text-leave-active {
  transition:
    opacity 260ms ease,
    transform 320ms cubic-bezier(0.32, 0.72, 0, 1);
}

.cloud-marquee-text-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.cloud-marquee-text-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

@media (prefers-reduced-motion: reduce) {
  .cloud-marquee-text-enter-active,
  .cloud-marquee-text-leave-active {
    transition: opacity 120ms ease;
    transform: none;
  }
}
</style>