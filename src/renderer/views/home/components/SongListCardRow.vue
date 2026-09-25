<template>
  <div class="song-list-card-row">
    <div class="cards-track" data-horizontal-scroll>
      <section
        v-for="card in cards"
        :key="card.id"
        class="song-card"
        :class="{ internal: internalScroll }"
      >
        <header class="song-card-header">
          <h3 class="song-card-title">{{ card.name }}</h3>
          <button
            v-if="card.detailable"
            type="button"
            class="song-card-detail"
            @click="emit('detail', card)"
          >
            {{ t('comp.homeSection.detail') }}<i class="ri-arrow-right-s-line" />
          </button>
        </header>
        <div
          class="song-card-rows"
          :class="{ 'internal-scroll': internalScroll }"
          data-horizontal-scroll
        >
          <button
            v-for="song in card.songs"
            :key="song.id"
            type="button"
            class="card-song-row"
            @click="emit('song-play', card, song)"
          >
            <img
              v-if="song.cover"
              :src="getImgUrl(song.cover, '100y100')"
              class="card-song-cover"
              alt=""
              loading="lazy"
            />
            <span v-else class="card-song-cover placeholder"><i class="ri-disc-line" /></span>
            <span class="card-song-main">
              <span class="card-song-name">
                {{ song.name }}
                <em v-if="song.badge" class="card-song-badge" :class="`badge-${song.badge.kind}`">{{
                  song.badge.text
                }}</em>
              </span>
              <span class="card-song-artist">{{ song.artist }}</span>
            </span>
            <span class="card-song-play"><i class="ri-play-fill" /></span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { getImgUrl } from '@/utils';

export interface CardSong {
  id: string | number;
  name: string;
  cover: string;
  artist: string;
  badge?: { kind: 'reason' | 'quality' | 'niche'; text: string };
  raw?: unknown;
}

export interface SongListCard {
  id: string | number;
  name: string;
  songs: CardSong[];
  detailable?: boolean;
}

defineProps<{
  cards: SongListCard[];
  /** 卡片内部横向滑动展示全部歌曲（单卡模式，如 Zephyrus 云） */
  internalScroll?: boolean;
}>();

const emit = defineEmits<{
  'song-play': [card: SongListCard, song: CardSong];
  detail: [card: SongListCard];
}>();

const { t } = useI18n();
</script>

<style lang="scss" scoped>
/* 通栏横滚：负 margin 抵消页边距，右缘自然露出下一卡 */
.song-list-card-row {
  margin-left: calc(var(--page-pl, 1rem) * -1);
  margin-right: calc(var(--page-pl, 1rem) * -1);
}

.cards-track {
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
}

.song-card {
  flex: 0 0 auto;
  width: 300px;
  scroll-snap-align: start;
  padding: 12px 14px;
  border-radius: 16px;
  /* 透明底：与页面背景融为一体 */
  background: transparent;
  border: 1px solid rgba(128, 128, 128, 0.14);
}

/* 单卡内部横滑：3 行一屏，所有歌曲在卡内左右滑动 */
/* 单卡内部横滑：3 行一屏；组宽 = 卡内宽 - 56px，右缘露出下一组首格封面 */
.song-card.internal {
  /* 加宽到轨道内容宽（= 屏宽减左右 16px 页边距），随布局宽度居中，不用 100vw */
  width: 100%;
  flex: 0 0 100%;
}

.song-card-rows.internal-scroll {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(3, auto);
  grid-auto-columns: calc(100% - 56px);
  column-gap: 14px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  margin: 0 -6px;

  &::-webkit-scrollbar {
    display: none;
  }

  .card-song-row {
    scroll-snap-align: start;
    padding: 7px 6px;
  }

  /* 内滑模式下歌曲项加宽 */
  .card-song-cover {
    width: 48px;
    height: 48px;
  }

  .card-song-name {
    font-size: 14px;
  }

  .card-song-artist {
    font-size: 12px;
  }
}

.song-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;

  .song-card-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--d-text-primary, rgba(0, 0, 0, 0.9));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .song-card-detail {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    border: 0;
    background: transparent;
    color: var(--d-text-secondary, rgba(0, 0, 0, 0.5));
    font-size: 12px;
    cursor: pointer;

    i {
      font-size: 15px;
    }
  }
}

.card-song-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;

  .card-song-cover {
    width: 42px;
    height: 42px;
    border-radius: 7px;
    object-fit: cover;
    flex-shrink: 0;
    background: rgba(128, 128, 128, 0.12);

    &.placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-color, #888);
      opacity: 0.6;
    }
  }

  .card-song-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-song-name {
    font-size: 13.5px;
    color: var(--d-text-primary, rgba(0, 0, 0, 0.9));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-song-badge {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 6px;
    border-radius: 6px;
    font-size: 10px;
    font-style: normal;
    font-weight: 500;
    vertical-align: 1px;

    &.badge-reason {
      color: var(--accent-color, #e05a5a);
      background: rgba(var(--accent-color-rgb, 224, 90, 90), 0.12);
    }

    &.badge-quality,
    &.badge-niche {
      color: var(--d-text-secondary, rgba(0, 0, 0, 0.55));
      background: rgba(128, 128, 128, 0.14);
    }
  }

  .card-song-artist {
    font-size: 11.5px;
    color: var(--d-text-secondary, rgba(0, 0, 0, 0.5));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-song-play {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.16);
    color: var(--accent-color, #888);
    flex-shrink: 0;

    i {
      font-size: 16px;
    }
  }

  &:active {
    opacity: 0.75;
  }
}
</style>
