<script setup lang="ts">
/** 最近播放：横滚大方形封面卡（封面 + 歌名 + 歌手），点击立即播放 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { usePlayerCoreStore } from '@/store/modules/playerCore';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';

const { t } = useI18n();
const playHistoryStore = usePlayHistoryStore();
const playerCore = usePlayerCoreStore();

const recentSongs = computed(() => playHistoryStore.musicHistory.slice(0, 30));

function coverOf(song: SongResult) {
  const url = song.picUrl || song.al?.picUrl;
  return url ? getImgUrl(url, '300y300') : '';
}

function artistOf(song: SongResult) {
  const artists = song.ar?.length ? song.ar : (song.artists ?? []);
  return artists
    .map((artist) => artist.name)
    .filter(Boolean)
    .join(' / ');
}

async function play(song: SongResult) {
  await playerCore.handlePlayMusic(song, true);
}
</script>

<template>
  <section class="recent-row">
    <h2>{{ t('comp.homeHero.recentPlays') }}</h2>
    <div class="recent-track" data-horizontal-scroll>
      <button
        v-for="song in recentSongs"
        :key="song.id"
        class="recent-card"
        type="button"
        @click="play(song)"
      >
        <span
          class="recent-cover"
          :style="coverOf(song) ? { backgroundImage: `url(${coverOf(song)})` } : undefined"
        >
          <i v-if="!coverOf(song)" class="ri-music-2-line" />
        </span>
        <span class="recent-name">{{ song.name }}</span>
        <span class="recent-artist">{{ artistOf(song) }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.recent-row {
  margin-top: 20px;
}

h2 {
  margin: 0 16px 10px;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--m-text-primary, #20211f);
}

.recent-track {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 2px 16px 6px;
  scroll-padding-inline: 16px;
  scroll-snap-type: x proximity;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.recent-card {
  display: grid;
  flex: 0 0 132px;
  gap: 6px;
  scroll-snap-align: start;
  text-align: left;
}

.recent-cover {
  display: grid;
  width: 132px;
  height: 132px;
  place-items: center;
  border-radius: 16px;
  background-color: var(--m-surface-container-low, rgba(128, 128, 128, 0.12));
  background-position: center;
  background-size: cover;
  color: var(--m-text-muted, #999);

  i {
    font-size: 22px;
  }
}

.recent-name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 650;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--m-text-primary, #20211f);
}

.recent-artist {
  overflow: hidden;
  font-size: 11.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--m-text-secondary, #777);
}

@media (prefers-reduced-motion: no-preference) {
  .recent-card:active .recent-cover {
    transform: scale(0.96);
    transition: transform 120ms var(--m-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
  }
}
</style>
