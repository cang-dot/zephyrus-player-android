<script setup lang="ts">
/**
 * 根据你喜爱的歌曲推荐：横向分页卡片流，每卡 3 首。
 * 行内标签来自日推数据（推荐理由 / 无损音质 / 小众），右缘露出下一卡首列封面。
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { usePlayerCoreStore } from '@/store/modules/playerCore';
import { usePlaylistStore } from '@/store/modules/playlist';
import { useRecommendStore } from '@/store/modules/recommend';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';
import { resolveSongTag, type SongTag } from '@/utils/songTag';

const { t } = useI18n();
const recommendStore = useRecommendStore();
const playerCore = usePlayerCoreStore();
const playlistStore = usePlaylistStore();

interface RecommendEntry {
  song: SongResult;
  tag?: SongTag;
}

const SONGS_PER_CARD = 3;

const cards = computed<RecommendEntry[][]>(() => {
  const songs = recommendStore.dailyRecommendSongs as unknown as SongResult[];
  const pages: RecommendEntry[][] = [];
  for (let index = 0; index < songs.length; index += SONGS_PER_CARD) {
    pages.push(
      songs
        .slice(index, index + SONGS_PER_CARD)
        .map((song) => ({ song, tag: resolveSongTag(song, t) }))
    );
  }
  return pages;
});

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

function coverOf(song: SongResult) {
  const url = song.picUrl || song.al?.picUrl;
  return url ? getImgUrl(url, '200y200') : '';
}

function artistOf(song: SongResult) {
  const artists = song.ar?.length ? song.ar : (song.artists ?? []);
  return artists
    .map((artist) => artist.name)
    .filter(Boolean)
    .join(' / ');
}

async function playSong(song: SongResult) {
  const queue = cards.value.flat().map((entry) => normalizeSong(entry.song));
  const index = Math.max(
    0,
    queue.findIndex((item) => item.id === song.id)
  );
  playlistStore.setPlayList(queue, false, false);
  await playerCore.handlePlayMusic(queue[index], true);
}
</script>

<template>
  <section class="recommend-section">
    <h2>{{ t('comp.homeV2.recommendTitle') }}</h2>

    <div v-if="cards.length" class="recommend-track" data-horizontal-scroll>
      <div v-for="(card, cardIndex) in cards" :key="cardIndex" class="recommend-card">
        <button
          v-for="entry in card"
          :key="entry.song.id"
          class="recommend-row"
          type="button"
          @click="playSong(entry.song)"
        >
          <span
            class="row-cover"
            :style="
              coverOf(entry.song) ? { backgroundImage: `url(${coverOf(entry.song)})` } : undefined
            "
          >
            <i v-if="!coverOf(entry.song)" class="ri-music-2-line" />
          </span>
          <span class="row-main">
            <span class="row-title">
              <span class="row-name">{{ entry.song.name }}</span>
              <span v-if="entry.tag" class="row-tag" :class="`tag-${entry.tag.kind}`">
                <i v-if="entry.tag.kind === 'reason'" class="ri-heart-3-fill" />{{ entry.tag.text }}
              </span>
            </span>
            <span class="row-artist">{{ artistOf(entry.song) }}</span>
          </span>
          <span class="row-play"><i class="ri-play-fill" /></span>
        </button>
      </div>
    </div>

    <p v-else class="recommend-empty">{{ t('comp.homeV2.loginHint') }}</p>
  </section>
</template>

<style scoped lang="scss">
.recommend-section {
  margin-top: 20px;
}

h2 {
  margin: 0 16px 10px;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--m-text-primary, #20211f);
}

.recommend-track {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 2px 16px 6px;
  scroll-padding-inline: 16px;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.recommend-card {
  display: flex;
  flex: 0 0 calc(100% - 84px);
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border-radius: 24px;
  background: var(--m-surface-container-low, rgba(128, 128, 128, 0.1));
  scroll-snap-align: start;
}

.recommend-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  text-align: left;

  &:active {
    opacity: 0.72;
  }
}

.row-cover {
  display: grid;
  width: 44px;
  height: 44px;
  flex: none;
  place-items: center;
  border-radius: 8px;
  background-color: var(--m-surface-container-high, rgba(128, 128, 128, 0.18));
  background-position: center;
  background-size: cover;
  color: var(--m-text-muted, #999);

  i {
    font-size: 18px;
  }
}

.row-main {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.row-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.row-name {
  min-width: 0;
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 650;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--m-text-primary, #20211f);
}

.row-tag {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 10px;
  line-height: 1.5;

  i {
    font-size: 9px;
  }
}

.tag-reason {
  background: rgba(var(--accent-color-rgb, 204, 68, 68), 0.14);
  color: var(--accent-color, #c44);
}

.tag-quality,
.tag-niche {
  background: var(--m-surface-container-high, rgba(128, 128, 128, 0.16));
  color: var(--m-text-secondary, #777);
}

.row-artist {
  overflow: hidden;
  font-size: 11.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--m-text-secondary, #777);
}

.row-play {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: rgba(var(--accent-color-rgb, 119, 131, 110), 0.16);
  color: var(--accent-color, #77836e);

  i {
    font-size: 16px;
  }
}

.recommend-empty {
  margin: 0 16px;
  padding: 22px 0;
  border-radius: 24px;
  background: var(--m-surface-container-low, rgba(128, 128, 128, 0.1));
  font-size: 12.5px;
  text-align: center;
  color: var(--m-text-secondary, #777);
}
</style>
