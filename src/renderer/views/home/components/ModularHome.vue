<template>
  <div class="modular-home" @click="onBackgroundClick">
    <!-- Ambient Background -->
    <div class="ambient-bg">
      <div class="ambient-orb orb-1" />
      <div class="ambient-orb orb-2" />
      <div class="ambient-orb orb-3" />
    </div>
    <div class="top-mask" />

    <!-- Scrollable Content -->
    <div ref="scrollContainer" class="home-scroll" @click.stop @touchstart.passive="onBlankTouchStart">
      <div class="topbar-spacer" />

      <!-- Card Carousel -->
      <div v-if="cardItems.length > 0" class="card-section">
        <div ref="cardsTrack" class="cards-track" @scroll.passive="onCardsScroll">
          <div
            v-for="item in cardItems"
            :key="item.type"
            :data-card-id="item.type"
            class="card-item"
            :class="{
              'dragging': drag.active && drag.itemId === item.type && drag.source === 'card',
              'edit-mode': isEditMode,
            }"
            @touchstart.passive="onItemTouchStart($event, item.type, 'card')"
            @click="onItemClick(item.type)"
          >
            <div class="card-inner">
              <div class="card-bg" :style="cardBgStyle(item.type)" />
              <div class="card-overlay" />
              <div class="card-glow" :style="{ background: meta[item.type].glowColor }" />
              <div v-if="isEditMode" class="card-remove" @click.stop="removeItem(item.type, 'card')">
                <i class="ri-close-circle-fill" />
              </div>

              <!-- Daily Recommend -->
              <template v-if="item.type === 'daily-recommend'">
                <div class="card-content card-daily">
                  <div class="card-top-row">
                    <span class="card-badge"><i class="ri-calendar-check-fill" />{{ dailyCount }}{{ t('comp.homeHero.songs') }}</span>
                    <div class="daily-date">
                      <span class="daily-day">{{ dayOfMonth }}</span>
                      <span class="daily-weekday">{{ weekdayLabel }}</span>
                    </div>
                  </div>
                  <div class="card-body">
                    <h2 class="card-title">{{ t('comp.homeHero.dailyRecommend') }}</h2>
                    <div v-if="dailySongs.length > 0" class="daily-preview">
                      <div v-for="(song, i) in dailySongs.slice(0, 3)" :key="song.id" class="daily-preview-item">
                        <span class="preview-num">{{ i + 1 }}</span>
                        <span class="preview-name truncate">{{ song.name }}</span>
                        <span class="preview-artist truncate">{{ song.ar?.[0]?.name }}</span>
                      </div>
                    </div>
                  </div>
                  <button class="action-btn play-btn" @click.stop="playDayRecommend"><i class="ri-play-fill" /></button>
                </div>
              </template>

              <!-- Personal FM -->
              <template v-else-if="item.type === 'personal-fm'">
                <div class="card-content card-fm">
                  <div class="card-top-row">
                    <span class="card-badge">
                      <i :class="activeMode === 'intelligence' ? 'ri-heart-pulse-fill' : 'ri-radio-fill'" />
                      {{ activeMode === 'intelligence' ? t('comp.homeHero.intelligenceMode') : t('comp.homeHero.personalFm') }}
                    </span>
                  </div>
                  <div class="card-body fm-body">
                    <div class="fm-cover-wrap">
                      <img v-if="displayCover" :src="getImgUrl(displayCover, '300y300')" alt="" class="fm-cover" />
                      <div v-else class="fm-cover-placeholder"><i class="ri-radio-fill" /></div>
                      <div v-if="isFmPlaying" class="fm-eq">
                        <span v-for="i in 3" :key="i" class="eq-bar" :style="{ animationDelay: `${(i - 1) * 0.15}s` }" />
                      </div>
                    </div>
                    <div class="fm-info">
                      <h2 class="card-title">{{ displaySong?.name || t('comp.homeHero.discoverMusic') }}</h2>
                      <p class="card-subtitle">{{ displayArtist }}</p>
                      <div class="fm-controls">
                        <button v-if="activeMode === 'intelligence'" class="fm-icon-btn" :class="{ fav: isFavorite }" @click.stop="toggleFavorite">
                          <i :class="isFavorite ? 'ri-heart-3-fill' : 'ri-heart-3-line'" />
                        </button>
                        <button v-else class="fm-icon-btn" @click.stop="handleFmTrash"><i class="ri-thumb-down-line" /></button>
                        <button class="fm-play-btn" @click.stop="handleFmPlay"><i :class="isFmPlaying ? 'ri-pause-fill' : 'ri-play-fill'" /></button>
                        <button class="fm-icon-btn" @click.stop="handleNext"><i class="ri-skip-forward-fill" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <!-- User -->
              <template v-else-if="item.type === 'user'">
                <div class="card-content card-user">
                  <div class="card-body user-body">
                    <div class="user-avatar-wrap">
                      <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" class="user-avatar" />
                      <div v-else class="user-avatar-placeholder"><i class="ri-user-3-fill" /></div>
                    </div>
                    <div class="user-info">
                      <h2 class="card-title">{{ userNickname || t('comp.modularHome.blocks.user') }}</h2>
                      <p v-if="isLoggedIn" class="card-subtitle">{{ t('comp.modularHome.viewProfile') }}</p>
                      <p v-else class="card-subtitle">{{ t('comp.modularHome.loginToUnlock') }}</p>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Artists -->
              <template v-else-if="item.type === 'artists'">
                <div class="card-content card-artists">
                  <div class="card-top-row"><span class="card-badge"><i class="ri-mic-fill" />{{ t('comp.homeHero.hotArtists') }}</span></div>
                  <div class="card-body">
                    <div v-if="artists.length > 0" class="artists-row">
                      <div v-for="artist in artists.slice(0, 5)" :key="artist.id" class="artist-chip" @click.stop="navigateToArtist(artist.id)">
                        <img :src="getImgUrl(artist.picUrl || artist.img1v1Url, '150y150')" alt="" class="artist-chip-img" />
                        <span class="artist-chip-name truncate">{{ artist.name }}</span>
                      </div>
                    </div>
                    <div v-else class="card-empty-hint"><i class="ri-mic-fill" /></div>
                  </div>
                </div>
              </template>

              <!-- Playlists -->
              <template v-else-if="item.type === 'playlists'">
                <div class="card-content card-playlists">
                  <div class="card-top-row"><span class="card-badge"><i class="ri-play-list-2-fill" />{{ t('comp.homeHero.hotPlaylists') }}</span></div>
                  <div class="card-body">
                    <div v-if="playlists.length > 0" class="playlists-row">
                      <div v-for="(pl, i) in playlists.slice(0, 4)" :key="i" class="pl-chip">
                        <img :src="getImgUrl(pl.picUrl, '150y150')" alt="" class="pl-chip-img" />
                        <span class="pl-chip-name truncate">{{ pl.name }}</span>
                      </div>
                    </div>
                    <div v-else class="card-empty-hint"><i class="ri-play-list-2-fill" /></div>
                  </div>
                </div>
              </template>

              <!-- Daily Album -->
              <template v-else-if="item.type === 'daily-album'">
                <div class="card-content card-daily-album">
                  <div class="card-top-row"><span class="card-badge"><i class="ri-disc-fill" />{{ t('comp.modularHome.blocks.dailyAlbum') }}</span></div>
                  <div class="card-body daily-album-body">
                    <div v-if="dailyAlbum" class="daily-album-cover-wrap">
                      <img :src="getImgUrl(dailyAlbum.picUrl || dailyAlbum.album?.picUrl, '300y300')" alt="" class="daily-album-cover" />
                    </div>
                    <div v-else class="daily-album-placeholder"><i class="ri-disc-fill" /></div>
                    <div class="daily-album-info">
                      <h2 class="card-title">{{ dailyAlbum?.name || t('comp.modularHome.blocks.dailyAlbum') }}</h2>
                      <p class="card-subtitle">{{ dailyAlbum?.artist?.name || t('comp.modularHome.dailyAlbumDesc') }}</p>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Static cards -->
              <template v-else>
                <div class="card-content card-static">
                  <div class="card-top-row"><span class="card-badge"><i :class="meta[item.type].icon" />{{ t(meta[item.type].titleKey) }}</span></div>
                  <div class="card-body">
                    <h2 class="card-title">{{ t(meta[item.type].titleKey) }}</h2>
                    <p class="card-subtitle">{{ t(meta[item.type].descKey || 'comp.modularHome.tapToExplore') }}</p>
                  </div>
                  <i :class="meta[item.type].icon" class="card-watermark" />
                </div>
              </template>
            </div>
          </div>
        </div>
        <div class="page-dots">
          <span v-for="(_, i) in cardItems" :key="i" class="page-dot" :class="{ active: i === currentCardIndex }" />
        </div>
      </div>

      <!-- Drop zone indicator -->
      <Transition name="fade">
        <div v-if="drag.active" class="drop-zone-indicator" :class="drag.targetZone">
          <span v-if="drag.targetZone === 'card'">{{ t('comp.modularHome.dropAsCard') }}</span>
          <span v-else>{{ t('comp.modularHome.dropAsBlock') }}</span>
        </div>
      </Transition>

      <div ref="blockGridRef" class="block-grid-container">
        <div
          v-for="item in blockItems"
          :key="item.type"
          :data-block-id="item.type"
          class="block-item"
          :class="{
            'dragging': drag.active && drag.itemId === item.type && drag.source === 'grid',
            'edit-mode': isEditMode,
          }"
          :style="blockStyle(item)"
          @touchstart.passive="onItemTouchStart($event, item.type, 'grid')"
          @click="onItemClick(item.type)"
        >
          <div class="block-bg" :style="{ background: meta[item.type].gradient }" />
          <div class="block-glow" :style="{ background: meta[item.type].glowColor }" />
          <div v-if="isEditMode" class="block-remove" @click.stop="removeItem(item.type, 'grid')">
            <i class="ri-close-circle-fill" />
          </div>
          <div v-if="isEditMode" class="resize-handle" @touchstart.stop.prevent="onResizeStart($event, item)">
            <i class="ri-drag-move-2-fill" />
          </div>

          <div class="block-inner">
            <!-- Daily Recommend -->
            <template v-if="item.type === 'daily-recommend'">
              <div class="block-top">
                <span class="block-mini-badge">{{ dailyCount }}{{ t('comp.homeHero.songs') }}</span>
                <i class="ri-calendar-check-fill block-corner-icon" />
              </div>
              <div v-if="item.h >= 2" class="block-date">
                <span class="block-date-day">{{ dayOfMonth }}</span>
                <span class="block-date-week">{{ weekdayLabel }}</span>
              </div>
              <div v-if="item.w >= 3 && dailySongs.length > 0" class="block-daily-songs">
                <div v-for="(song, i) in dailySongs.slice(0, item.w >= 4 ? 4 : 2)" :key="song.id" class="block-daily-song truncate">
                  <span class="song-num">{{ i + 1 }}</span>{{ song.name }}
                </div>
              </div>
              <div class="block-label">{{ t('comp.homeHero.dailyRecommend') }}</div>
              <button class="action-btn play-btn" @click.stop="playDayRecommend"><i class="ri-play-fill" /></button>
            </template>

            <!-- Personal FM -->
            <template v-else-if="item.type === 'personal-fm'">
              <div v-if="isLoggedIn" class="block-fm-cover-wrap">
                <img v-if="displayCover" :src="getImgUrl(displayCover, '300y300')" alt="" class="block-fm-cover" />
                <div v-else class="block-fm-placeholder"><i class="ri-radio-fill" /></div>
                <div v-if="isFmPlaying" class="block-fm-eq">
                  <span v-for="i in 3" :key="i" class="eq-bar" :style="{ animationDelay: `${(i - 1) * 0.15}s` }" />
                </div>
              </div>
              <div v-else class="block-icon-large"><i class="ri-radio-fill" /></div>
              <div class="block-label">{{ t('comp.homeHero.personalFm') }}</div>
              <div v-if="isLoggedIn && displaySong?.name" class="block-fm-song truncate">{{ displaySong.name }}</div>
              <div v-else-if="!isLoggedIn" class="block-hint">{{ t('comp.modularHome.loginToUnlock') }}</div>
              <button v-if="isLoggedIn" class="action-btn play-btn" @click.stop="handleFmPlay">
                <i :class="isFmPlaying ? 'ri-pause-fill' : 'ri-play-fill'" />
              </button>
            </template>

            <!-- User -->
            <template v-else-if="item.type === 'user'">
              <div class="block-user-avatar-wrap">
                <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" class="block-user-avatar" />
                <div v-else class="block-user-placeholder"><i class="ri-user-3-fill" /></div>
              </div>
              <div class="block-label">{{ userNickname || t('comp.modularHome.blocks.user') }}</div>
              <div v-if="!isLoggedIn" class="block-hint">{{ t('comp.modularHome.loginToUnlock') }}</div>
            </template>

            <!-- Artists -->
            <template v-else-if="item.type === 'artists'">
              <div v-if="artists.length > 0" class="block-collage">
                <img
                  v-for="(artist, i) in artists.slice(0, 4)" :key="artist.id"
                  :src="getImgUrl(artist.picUrl || artist.img1v1Url, '150y150')" alt="" class="collage-img"
                  :style="{ animationDelay: `${i * 0.06}s` }"
                />
              </div>
              <div v-else class="block-icon-large"><i class="ri-mic-fill" /></div>
              <div class="block-label">{{ t('comp.homeHero.hotArtists') }}</div>
            </template>

            <!-- Playlists -->
            <template v-else-if="item.type === 'playlists'">
              <div v-if="playlists.length > 0" class="block-collage">
                <img
                  v-for="(pl, i) in playlists.slice(0, 4)" :key="i"
                  :src="getImgUrl(pl.picUrl, '150y150')" alt="" class="collage-img"
                  :style="{ animationDelay: `${i * 0.06}s` }"
                />
              </div>
              <div v-else class="block-icon-large"><i class="ri-play-list-2-fill" /></div>
              <div class="block-label">{{ t('comp.homeHero.hotPlaylists') }}</div>
            </template>

            <!-- Daily Album -->
            <template v-else-if="item.type === 'daily-album'">
              <div v-if="dailyAlbum" class="block-album-cover-wrap">
                <img :src="getImgUrl(dailyAlbum.picUrl || dailyAlbum.album?.picUrl, '300y300')" alt="" class="block-album-cover" />
              </div>
              <div v-else class="block-icon-large"><i class="ri-disc-fill" /></div>
              <div class="block-label">{{ dailyAlbum?.name || t('comp.modularHome.blocks.dailyAlbum') }}</div>
              <div v-if="!dailyAlbum" class="block-hint">{{ t('comp.modularHome.dailyAlbumDesc') }}</div>
            </template>

            <!-- Static blocks -->
            <template v-else>
              <div class="block-icon-large"><i :class="meta[item.type].icon" /></div>
              <div class="block-label">{{ t(meta[item.type].titleKey) }}</div>
            </template>
          </div>
        </div>

        <!-- Add block button -->
        <div
          v-if="isEditMode && availableBlocks.length > 0"
          class="block-item add-block"
          :style="blockStyle({ type: 'add' as any, w: 2, h: 2 } as LayoutItem)"
          @click="showAddSheet = true"
        >
          <div class="block-bg add-bg" />
          <div class="block-inner add-inner"><i class="ri-add-line" /><span>{{ t('comp.modularHome.addBlock') }}</span></div>
        </div>
      </div>

      <div class="bottom-spacer" />
    </div>

    <!-- Add block bottom sheet (2x2 thumbnails) -->
    <Transition name="sheet">
      <div v-if="showAddSheet" class="add-sheet-overlay" @click="showAddSheet = false">
        <div class="add-sheet" @click.stop>
          <div class="add-sheet-handle" />
          <h3 class="add-sheet-title">{{ t('comp.modularHome.addBlock') }}</h3>
          <div class="add-sheet-grid">
            <div
              v-for="blockType in availableBlocks" :key="blockType"
              class="add-sheet-item"
              :data-add-id="blockType"
              @touchstart.passive="onAddItemTouchStart($event, blockType)"
              @click="addItem(blockType)"
            >
              <div class="add-sheet-thumb" :style="{ background: meta[blockType].gradient }">
                <i :class="meta[blockType].icon" class="add-sheet-thumb-icon" />
                <span class="add-sheet-thumb-label">{{ t(meta[blockType].titleKey) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useWindowSize } from '@vueuse/core';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getHotSinger, getPersonalFM, getPersonalizedPlaylist } from '@/api/home';
import { fmTrash } from '@/api/music';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import { useFavorite } from '@/hooks/useFavorite';
import { useArtist } from '@/hooks/useArtist';
import {
  useIntelligenceModeStore,
  usePlayerCoreStore,
  usePlayerStore,
  useRecommendStore,
  useUserStore
} from '@/store';
import { getImgUrl } from '@/utils';

defineOptions({ name: 'ModularHome' });

const { t, locale } = useI18n();
const router = useRouter();
const { width: winWidth } = useWindowSize();
const recommendStore = useRecommendStore();
const intelligenceModeStore = useIntelligenceModeStore();
const userStore = useUserStore();
const playerCoreStore = usePlayerCoreStore();
const playerStore = usePlayerStore();
const { isFavorite, toggleFavorite } = useFavorite();
const { navigateToArtist } = useArtist();

// ==================== Block Configuration ====================

type BlockType =
  | 'daily-recommend' | 'personal-fm' | 'user' | 'artists' | 'playlists'
  | 'daily-album' | 'toplist' | 'albums' | 'history' | 'favorites' | 'podcast' | 'mv';

type Zone = 'card' | 'grid';

interface LayoutItem {
  type: BlockType;
  w: number; // 1-4
  h: number; // 1-2
}

const PLAYABLE_BLOCKS: BlockType[] = ['daily-recommend', 'personal-fm'];

const meta: Record<BlockType, {
  icon: string; titleKey: string; descKey?: string;
  glowColor: string; gradient: string; requiresLogin?: boolean;
}> = {
  'daily-recommend': { icon: 'ri-calendar-check-fill', titleKey: 'comp.homeHero.dailyRecommend', glowColor: 'var(--accent-color)', gradient: 'linear-gradient(135deg, var(--accent-color), var(--accent-color-dark, #4a4a4a))', requiresLogin: true },
  'personal-fm': { icon: 'ri-radio-fill', titleKey: 'comp.homeHero.personalFm', glowColor: 'var(--accent-color-light, #8b5cf6)', gradient: 'linear-gradient(135deg, var(--accent-color), var(--accent-color-dark, #4a4a4a))', requiresLogin: true },
  'user': { icon: 'ri-user-3-fill', titleKey: 'comp.modularHome.blocks.user', descKey: 'comp.modularHome.viewProfile', glowColor: 'var(--accent-color-light, #6366f1)', gradient: 'linear-gradient(135deg, var(--accent-color-light, #6366f1), var(--accent-color, #4f46e5))' },
  'artists': { icon: 'ri-mic-fill', titleKey: 'comp.homeHero.hotArtists', glowColor: 'var(--accent-color-dark, #f59e0b)', gradient: 'linear-gradient(135deg, var(--accent-color-dark, #f59e0b), var(--accent-color, #d97706))' },
  'playlists': { icon: 'ri-play-list-2-fill', titleKey: 'comp.homeHero.hotPlaylists', glowColor: 'var(--accent-color, #8b5cf6)', gradient: 'linear-gradient(135deg, var(--accent-color, #8b5cf6), var(--accent-color-dark, #7c3aed))' },
  'daily-album': { icon: 'ri-disc-fill', titleKey: 'comp.modularHome.blocks.dailyAlbum', descKey: 'comp.modularHome.dailyAlbumDesc', glowColor: 'var(--accent-color-light, #14b8a6)', gradient: 'linear-gradient(135deg, var(--accent-color-light, #14b8a6), var(--accent-color, #0d9488))', requiresLogin: true },
  'toplist': { icon: 'ri-trophy-fill', titleKey: 'comp.toplist', glowColor: 'var(--accent-color-dark, #eab308)', gradient: 'linear-gradient(135deg, var(--accent-color-dark, #eab308), var(--accent-color, #ca8a04))' },
  'albums': { icon: 'ri-album-fill', titleKey: 'comp.newAlbum.title', glowColor: 'var(--accent-color-light, #06b6d4)', gradient: 'linear-gradient(135deg, var(--accent-color-light, #06b6d4), var(--accent-color, #0891b2))' },
  'history': { icon: 'ri-history-fill', titleKey: 'comp.history', glowColor: 'var(--accent-color, #10b981)', gradient: 'linear-gradient(135deg, var(--accent-color, #10b981), var(--accent-color-dark, #059669))' },
  'favorites': { icon: 'ri-heart-3-fill', titleKey: 'comp.homeHero.quickNav.myFavorite', glowColor: 'var(--accent-color-light, #ec4899)', gradient: 'linear-gradient(135deg, var(--accent-color-light, #ec4899), var(--accent-color, #db2777))' },
  'podcast': { icon: 'ri-radio-2-fill', titleKey: 'podcast.podcast', glowColor: 'var(--accent-color-dark, #6366f1)', gradient: 'linear-gradient(135deg, var(--accent-color-dark, #6366f1), var(--accent-color, #4f46e5))' },
  'mv': { icon: 'ri-movie-2-fill', titleKey: 'comp.mv', glowColor: 'var(--accent-color, #ef4444)', gradient: 'linear-gradient(135deg, var(--accent-color, #ef4444), var(--accent-color-dark, #dc2626))' },
};

const ALL_BLOCKS: BlockType[] = [
  'daily-recommend', 'personal-fm', 'user', 'artists', 'playlists', 'daily-album',
  'toplist', 'albums', 'history', 'favorites', 'podcast', 'mv',
];

// ==================== Grid Sizing (JS-computed, bulletproof) ====================

const GAP = 12;
const PADDING = 16;

/** Compute exact pixel size for a block based on w/h */
const blockSize = (item: LayoutItem) => {
  // container width = viewport width - 2*padding
  const containerW = winWidth.value - PADDING * 2;
  // 4 columns, 3 gaps between them
  const unitW = (containerW - GAP * 3) / 4;
  const unitH = unitW; // square units

  const w = Math.max(1, Math.min(4, item.w));
  const h = Math.max(1, Math.min(2, item.h));

  return {
    width: unitW * w + GAP * (w - 1),
    height: unitH * h + GAP * (h - 1),
    unitW,
    unitH,
  };
};

/** Inline style for a block item — CSS Grid span */
const blockStyle = (item: LayoutItem) => {
  const w = Math.max(1, Math.min(4, item.w));
  const h = Math.max(1, Math.min(2, item.h));
  return {
    gridColumn: `span ${w}`,
    gridRow: `span ${h}`,
  };
};

// ==================== Persistence ====================

const loadLayout = (): { cards: LayoutItem[]; blocks: LayoutItem[] } => {
  try {
    const saved = localStorage.getItem('homeLayoutV2');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.cards) && Array.isArray(parsed.blocks)) {
        const toItems = (arr: any[]) => arr
          .filter((b: any) => b && ALL_BLOCKS.includes(b.type as BlockType))
          .map((b: any) => ({ type: b.type as BlockType, w: Math.min(4, Math.max(1, b.w || 2)), h: Math.min(2, Math.max(1, b.h || 2)) }));
        return { cards: toItems(parsed.cards), blocks: toItems(parsed.blocks) };
      }
    }
  } catch { /* ignore */ }
  try {
    const old = localStorage.getItem('homeLayout');
    if (old) {
      const parsed = JSON.parse(old);
      if (parsed && Array.isArray(parsed.cards) && Array.isArray(parsed.blocks)) {
        const toItems = (arr: string[]) => arr.filter((b: string) => ALL_BLOCKS.includes(b as BlockType)).map((type: string) => ({ type: type as BlockType, w: 2, h: 2 } as LayoutItem));
        return { cards: toItems(parsed.cards), blocks: toItems(parsed.blocks) };
      }
    }
  } catch { /* ignore */ }
  return {
    cards: [{ type: 'daily-recommend', w: 2, h: 2 }, { type: 'personal-fm', w: 2, h: 2 }],
    blocks: [
      { type: 'user', w: 2, h: 1 }, { type: 'artists', w: 2, h: 2 }, { type: 'playlists', w: 2, h: 2 },
      { type: 'daily-album', w: 2, h: 1 }, { type: 'toplist', w: 2, h: 2 },
    ],
  };
};

const saveLayout = () => {
  try {
    localStorage.setItem('homeLayoutV2', JSON.stringify({ cards: cardItems.value, blocks: blockItems.value }));
  } catch { /* ignore */ }
};

const initial = loadLayout();
const cardItems = ref<LayoutItem[]>(initial.cards);
const blockItems = ref<LayoutItem[]>(initial.blocks);

const availableBlocks = computed(() =>
  ALL_BLOCKS.filter(b => !cardItems.value.some(i => i.type === b) && !blockItems.value.some(i => i.type === b))
);

// ==================== User State ====================

const isLoggedIn = computed(() => !!userStore.user);
const avatarUrl = computed(() => {
  const url = userStore.user?.avatarUrl;
  return url ? getImgUrl(url, '72y72') : '';
});
const userNickname = computed(() => userStore.user?.nickname || '');

// ==================== Daily Recommend ====================

const dayOfMonth = new Date().getDate();
const weekdayLabel = new Date().toLocaleDateString(locale.value, { weekday: 'short' });
const dailySongs = computed(() => recommendStore.dailyRecommendSongs);
const dailyCount = computed(() => recommendStore.dailyRecommendSongs.length);

const showDayRecommend = () => {
  if (dailySongs.value.length === 0) return;
  navigateToMusicList(router, { type: 'dailyRecommend', name: t('comp.recommendSinger.songlist'), songList: dailySongs.value, canRemove: false });
};

const playDayRecommend = async () => {
  if (dailySongs.value.length === 0) return;
  try {
    const { usePlayerCoreStore: pcs } = await import('@/store/modules/playerCore');
    const { usePlaylistStore } = await import('@/store/modules/playlist');
    const playerCore = pcs();
    const playlistStore = usePlaylistStore();
    const songs = dailySongs.value.map((s: any) => ({ id: s.id, name: s.name, picUrl: s.al?.picUrl, source: 'netease', song: s, ...s, playLoading: false }));
    playlistStore.setPlayList(songs, false, false);
    await playerCore.handlePlayMusic(songs[0], true);
  } catch (error) { console.error('Failed to play daily recommend:', error); }
};

// ==================== Personal FM ====================

const fmCurrentSong = ref<any>(null);
const fmNextSong = ref<any>(null);
const fmLoading = ref(false);

const activeMode = computed(() => intelligenceModeStore.isIntelligenceMode ? 'intelligence' : 'fm');
const fmCurrentCover = computed(() => fmCurrentSong.value?.album?.picUrl || fmCurrentSong.value?.al?.picUrl || '');
const fmCurrentArtist = computed(() => {
  const song = fmCurrentSong.value;
  if (!song) return t('comp.homeHero.personalFmDesc');
  const artists = song.artists || song.ar;
  return artists?.map((a: any) => a.name).join(' / ') || '';
});

const displaySong = computed(() => activeMode.value === 'intelligence' ? playerCoreStore.currentSong : fmCurrentSong.value);
const displayCover = computed(() => {
  if (activeMode.value === 'intelligence') return playerCoreStore.currentSong?.al?.picUrl || playerCoreStore.currentSong?.album?.picUrl || '';
  return fmCurrentCover.value;
});
const displayArtist = computed(() => {
  if (activeMode.value === 'intelligence') {
    const song = playerCoreStore.currentSong;
    if (!song) return '';
    const artists = song.artists || song.ar;
    return artists?.map((a: any) => a.name).join(' / ') || '';
  }
  return fmCurrentArtist.value;
});
const isFmPlaying = computed(() => {
  if (activeMode.value === 'intelligence') return !!playerCoreStore.currentSong?.id && playerCoreStore.isPlaying;
  return !!fmCurrentSong.value && playerCoreStore.currentSong?.id === fmCurrentSong.value.id && playerCoreStore.isPlaying;
});

const cardBgStyle = (type: BlockType) => {
  if (type === 'personal-fm' && displayCover.value) {
    return { backgroundImage: `url(${getImgUrl(displayCover.value, '300y300')})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return { background: meta[type].gradient };
};

const fetchFmSongs = async (retries = 3): Promise<any[]> => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await getPersonalFM();
      const songs = res.data?.data;
      if (Array.isArray(songs) && songs.length > 0) return songs;
    } catch { if (i < retries - 1) await new Promise((r) => setTimeout(r, 1000)); }
  }
  return [];
};

const loadFmSongs = async () => {
  if (fmLoading.value) return;
  fmLoading.value = true;
  try {
    const songs = await fetchFmSongs();
    if (songs.length > 0) { fmCurrentSong.value = songs[0]; fmNextSong.value = songs[1] || null; }
  } finally { fmLoading.value = false; }
};

const preloadNextFm = async () => {
  if (fmNextSong.value) return;
  try { const songs = await fetchFmSongs(1); if (songs.length > 0) fmNextSong.value = songs[0]; } catch { /* silent */ }
};

const handleFmPlay = async () => {
  if (activeMode.value === 'intelligence') {
    const { usePlaylistStore } = await import('@/store/modules/playlist');
    await usePlaylistStore().setPlay(playerCoreStore.currentSong);
    return;
  }
  if (!fmCurrentSong.value) return;
  if (playerCoreStore.currentSong?.id === fmCurrentSong.value.id) {
    const { usePlaylistStore } = await import('@/store/modules/playlist');
    await usePlaylistStore().setPlay(playerCoreStore.currentSong);
    return;
  }
  try {
    const { usePlayerCoreStore: pcs } = await import('@/store/modules/playerCore');
    const { usePlaylistStore } = await import('@/store/modules/playlist');
    const playerCore = pcs();
    const playlistStore = usePlaylistStore();
    const song = fmCurrentSong.value;
    const playlist = [{ id: song.id, name: song.name, picUrl: song.al?.picUrl || song.album?.picUrl, ar: song.artists || song.ar, al: song.al || song.album, source: 'netease' as const, song, ...song, playLoading: false }];
    playlistStore.setPlayList(playlist, false, false);
    playerCore.isFmPlaying = true;
    await playerCore.handlePlayMusic(playlist[0], true);
  } catch (error) { console.error('Failed to play Personal FM:', error); }
};

const handleFmNext = async () => {
  if (fmLoading.value) return;
  if (fmNextSong.value) { fmCurrentSong.value = fmNextSong.value; fmNextSong.value = null; preloadNextFm(); }
  else await loadFmSongs();
  await handleFmPlay();
};

const handleFmTrash = async () => {
  const song = fmCurrentSong.value;
  if (!song) return;
  try { await fmTrash(song.id); } catch { /* ignore */ }
  await handleFmNext();
};

const handleNext = async () => {
  if (activeMode.value === 'intelligence') { playerStore.nextPlay(); return; }
  await handleFmNext();
};

// ==================== Daily Album ====================

const dailyAlbum = ref<any>(null);

const pickDailyAlbum = () => {
  const albums = userStore.albumList;
  if (!albums || albums.length === 0) { dailyAlbum.value = null; return; }
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const saved = localStorage.getItem('dailyAlbum');
  const savedDate = localStorage.getItem('dailyAlbumDate');
  if (saved && savedDate === dateStr) {
    try {
      const parsed = JSON.parse(saved);
      if (albums.some((a: any) => a.id === parsed.id)) { dailyAlbum.value = parsed; return; }
    } catch { /* ignore */ }
  }
  const idx = Math.floor(Math.random() * albums.length);
  const picked = albums[idx];
  dailyAlbum.value = picked;
  localStorage.setItem('dailyAlbum', JSON.stringify(picked));
  localStorage.setItem('dailyAlbumDate', dateStr);
};

const openDailyAlbum = () => { if (dailyAlbum.value) router.push(`/music-list/${dailyAlbum.value.id}?type=album`); };

// ==================== Artists & Playlists ====================

const artists = ref<any[]>([]);
const playlists = ref<any[]>([]);

const fetchArtists = async () => {
  try { const { data } = await getHotSinger({ offset: 0, limit: 6 }); if (data.code === 200) artists.value = data.artists.slice(0, 6); } catch { /* ignore */ }
};
const fetchPlaylists = async () => {
  try { const res = await getPersonalizedPlaylist(8); const list = res.result || res.data; if (list) playlists.value = list; } catch { /* ignore */ }
};

// ==================== Card Carousel ====================

const cardsTrack = ref<HTMLElement | null>(null);
const blockGridRef = ref<HTMLElement | null>(null);
const currentCardIndex = ref(0);

const onCardsScroll = () => {
  if (!cardsTrack.value) return;
  currentCardIndex.value = Math.round(cardsTrack.value.scrollLeft / cardsTrack.value.offsetWidth);
};

// ==================== Item Actions ====================

const onItemClick = (type: BlockType) => {
  if (isEditMode.value) return;
  switch (type) {
    case 'daily-recommend': showDayRecommend(); break;
    case 'personal-fm': if (isLoggedIn.value) handleFmPlay(); else router.push('/user'); break;
    case 'user': router.push('/user'); break;
    case 'artists': if (artists.value.length > 0) navigateToArtist(artists.value[0].id); else router.push('/list'); break;
    case 'playlists': router.push('/list'); break;
    case 'daily-album': if (dailyAlbum.value) openDailyAlbum(); else router.push('/album'); break;
    case 'toplist': router.push('/toplist'); break;
    case 'albums': router.push('/album'); break;
    case 'history': router.push('/history'); break;
    case 'favorites': router.push('/favorite'); break;
    case 'podcast': router.push('/podcast'); break;
    case 'mv': router.push('/mv'); break;
  }
};

// ==================== Edit Mode ====================

const editModeType = ref<'none' | 'drag' | 'manual'>('none');
const isEditMode = computed(() => editModeType.value !== 'none');
const showAddSheet = ref(false);
const scrollContainer = ref<HTMLElement | null>(null);

const onBackgroundClick = () => {
  if (editModeType.value === 'manual') {
    editModeType.value = 'none';
  }
};

const removeItem = (type: BlockType, zone: Zone) => {
  if (zone === 'card') {
    const item = cardItems.value.find(i => i.type === type);
    cardItems.value = cardItems.value.filter(i => i.type !== type);
    if (item) blockItems.value.push({ ...item, w: 2, h: 2 });
  } else {
    blockItems.value = blockItems.value.filter(i => i.type !== type);
  }
  saveLayout();
};

const addItem = (type: BlockType) => {
  blockItems.value.push({ type, w: 2, h: 2 });
  saveLayout();
  showAddSheet.value = false;
};

// ==================== FLIP Animation ====================

const SPRING_EASE = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const SPRING_DURATION = '0.45s';

const recordRects = (container: HTMLElement, selector: string): Map<string, DOMRect> => {
  const map = new Map<string, DOMRect>();
  container.querySelectorAll<HTMLElement>(selector).forEach(child => {
    const id = child.getAttribute('data-block-id') || child.getAttribute('data-card-id');
    if (id) map.set(id, child.getBoundingClientRect());
  });
  return map;
};

const playFlip = (container: HTMLElement, selector: string, beforeRects: Map<string, DOMRect>) => {
  container.querySelectorAll<HTMLElement>(selector).forEach(child => {
    const id = child.getAttribute('data-block-id') || child.getAttribute('data-card-id');
    if (!id) return;
    const before = beforeRects.get(id);
    if (!before) return;
    const after = child.getBoundingClientRect();
    const dx = before.left - after.left;
    const dy = before.top - after.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    child.style.transform = `translate(${dx}px, ${dy}px)`;
    child.style.transition = 'none';
    child.offsetHeight;
    child.style.transform = '';
    child.style.transition = `transform ${SPRING_DURATION} ${SPRING_EASE}`;
    setTimeout(() => { child.style.transition = ''; child.style.transform = ''; }, 500);
  });
};

const flipAfterMutation = async (container: HTMLElement | null, selector: string) => {
  if (!container) return;
  const beforeRects = recordRects(container, selector);
  await nextTick();
  playFlip(container, selector, beforeRects);
};

// ==================== Drag & Drop ====================

const drag = reactive({
  active: false,
  itemId: '' as string,
  source: '' as Zone,
  targetZone: '' as Zone,
  startTouchX: 0,
  startTouchY: 0,
  deltaX: 0,
  deltaY: 0,
  cardSectionTop: 0,
  cardSectionBottom: 0,
  hasMoved: false,
});

let pressTimer: number | undefined;
let touchStartX = 0;
let touchStartY = 0;
let docMoveHandler: ((e: TouchEvent) => void) | null = null;
let docEndHandler: ((e: TouchEvent) => void) | null = null;

// 抖动过滤：累计位移记录，只有持续定向移动才取消长按
let jitterSamples: { x: number; y: number; t: number }[] = [];
const JITTER_WINDOW = 5;          // 取最近5个采样点
const JITTER_THRESHOLD = 24;       // 累计位移超过此值才算"真的在移动"

const onBlankTouchStart = (e: TouchEvent) => {
  // 如果触摸到了卡片或区块项，不处理空白触发
  const target = e.target as HTMLElement;
  if (target.closest('.card-item') || target.closest('.block-item') || target.closest('.add-sheet-item')) {
    return;
  }

  // 已在编辑模式 — 点击空白退出（由 onBackgroundClick 处理）
  if (isEditMode.value) return;

  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  jitterSamples = [{ x: touch.clientX, y: touch.clientY, t: Date.now() }];

  // 长按空白区域进入手动编辑模式
  pressTimer = window.setTimeout(() => {
    if (editModeType.value === 'none') {
      editModeType.value = 'manual';
      // 触觉反馈
      if (navigator.vibrate) navigator.vibrate(30);
    }
  }, 600);

  // 监听移动和结束
  docMoveHandler = (ev: TouchEvent) => {
    const t = ev.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    // 抖动过滤：采样并计算最近窗口内的累计位移
    jitterSamples.push({ x: t.clientX, y: t.clientY, t: Date.now() });
    if (jitterSamples.length > JITTER_WINDOW + 1) {
      jitterSamples.shift();
    }

    // 只有最近窗口内位移超过阈值才取消长按（过滤微小抖动）
    if (jitterSamples.length >= 2) {
      const oldest = jitterSamples[0];
      const newest = jitterSamples[jitterSamples.length - 1];
      const netDx = Math.abs(newest.x - oldest.x);
      const netDy = Math.abs(newest.y - oldest.y);
      if (netDx > JITTER_THRESHOLD || netDy > JITTER_THRESHOLD) {
        clearTimeout(pressTimer);
        pressTimer = undefined;
        detachDocListeners();
      }
    }
  };
  docEndHandler = () => {
    clearTimeout(pressTimer);
    pressTimer = undefined;
    detachDocListeners();
  };
  document.addEventListener('touchmove', docMoveHandler, { passive: true });
  document.addEventListener('touchend', docEndHandler, { passive: true });
  document.addEventListener('touchcancel', docEndHandler, { passive: true });
};

const onItemTouchStart = (e: TouchEvent, itemType: BlockType, source: Zone) => {
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  drag.startTouchX = touch.clientX;
  drag.startTouchY = touch.clientY;
  drag.itemId = itemType;
  drag.source = source;
  drag.targetZone = source;
  drag.hasMoved = false;
  jitterSamples = [{ x: touch.clientX, y: touch.clientY, t: Date.now() }];

  const cardSection = document.querySelector('.card-section');
  if (cardSection) {
    const rect = cardSection.getBoundingClientRect();
    drag.cardSectionTop = rect.top;
    drag.cardSectionBottom = rect.bottom;
  } else {
    drag.cardSectionTop = 0;
    drag.cardSectionBottom = window.innerHeight * 0.4;
  }

  if (isEditMode.value) {
    startDrag();
    attachDocListeners();
    return;
  }

  pressTimer = window.setTimeout(() => {
    editModeType.value = 'drag';
    startDrag();
    attachDocListeners();
    if (navigator.vibrate) navigator.vibrate(30);
  }, 600);
};

const attachDocListeners = () => {
  docMoveHandler = (ev: TouchEvent) => onDocTouchMove(ev);
  docEndHandler = (ev: TouchEvent) => onDocTouchEnd(ev);
  document.addEventListener('touchmove', docMoveHandler, { passive: false });
  document.addEventListener('touchend', docEndHandler, { passive: false });
  document.addEventListener('touchcancel', docEndHandler, { passive: false });
};

const detachDocListeners = () => {
  if (docMoveHandler) { document.removeEventListener('touchmove', docMoveHandler); docMoveHandler = null; }
  if (docEndHandler) { document.removeEventListener('touchend', docEndHandler); document.removeEventListener('touchcancel', docEndHandler); docEndHandler = null; }
};

const onDocTouchMove = (e: TouchEvent) => {
  const touch = e.touches[0];

  // 抖动过滤：采样并计算最近窗口内的累计位移
  jitterSamples.push({ x: touch.clientX, y: touch.clientY, t: Date.now() });
  if (jitterSamples.length > JITTER_WINDOW + 1) {
    jitterSamples.shift();
  }

  if (!drag.active && pressTimer) {
    // 只有持续定向移动超过阈值才取消长按（过滤微小抖动）
    if (jitterSamples.length >= 2) {
      const oldest = jitterSamples[0];
      const newest = jitterSamples[jitterSamples.length - 1];
      const netDx = Math.abs(newest.x - oldest.x);
      const netDy = Math.abs(newest.y - oldest.y);
      if (netDx > JITTER_THRESHOLD || netDy > JITTER_THRESHOLD) {
        clearTimeout(pressTimer);
        pressTimer = undefined;
        if (editModeType.value === 'manual') {
          startDrag();
          attachDocListeners();
        }
      }
    }
    return;
  }

  if (!drag.active) return;

  e.preventDefault();

  drag.deltaX = touch.clientX - drag.startTouchX;
  drag.deltaY = touch.clientY - drag.startTouchY;
  drag.hasMoved = true;

  const selector = drag.source === 'card' ? `[data-card-id="${drag.itemId}"]` : `[data-block-id="${drag.itemId}"]`;
  const el = document.querySelector(selector) as HTMLElement;
  if (el) {
    el.style.transform = `translate(${drag.deltaX}px, ${drag.deltaY}px) scale(1.08)`;
    el.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.35)';
  }

  const fingerY = touch.clientY;
  const isCardZone = fingerY < drag.cardSectionBottom + 80;

  if (drag.source === 'grid' && isCardZone) {
    if (drag.targetZone !== 'card') {
      drag.targetZone = 'card';
      if (el) {
        el.style.transition = 'border-radius 0.3s ease';
        el.style.borderRadius = '24px';
      }
    }
  } else if (drag.source === 'card' && !isCardZone) {
    if (drag.targetZone !== 'grid') {
      drag.targetZone = 'grid';
      const size = blockSize({ type: drag.itemId as BlockType, w: 2, h: 2 });
      if (el) {
        el.style.transition = 'width 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 0.3s ease';
        el.style.width = size.width + 'px';
        el.style.height = size.height + 'px';
        el.style.borderRadius = '24px';
      }
    }
    if (cardsTrack.value) {
      cardsTrack.value.style.overflow = 'visible';
    }
  } else if (drag.source === 'card' && isCardZone) {
    if (drag.targetZone === 'grid') {
      drag.targetZone = 'card';
      if (el) {
        el.style.transition = 'width 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 0.3s ease';
        el.style.width = '';
        el.style.height = '';
      }
    }
  } else {
    drag.targetZone = drag.source;
  }

  const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
  if (!elementUnder) return;

  if (drag.source === 'card' && drag.targetZone === 'card') {
    const targetCard = elementUnder.closest('.card-item:not(.dragging)') as HTMLElement | null;
    if (targetCard) {
      const targetId = targetCard.getAttribute('data-card-id');
      if (targetId && targetId !== drag.itemId) {
        const track = cardsTrack.value;
        if (track) {
          const beforeRects = recordRects(track, '.card-item:not(.dragging)');
          moveInArray(cardItems, drag.itemId, targetId);
          nextTick(() => playFlip(track, '.card-item:not(.dragging)', beforeRects));
        }
      }
    }
  } else if (drag.source === 'grid' && drag.targetZone === 'grid') {
    const targetBlock = elementUnder.closest('.block-item:not(.dragging):not(.add-block)') as HTMLElement | null;
    if (targetBlock) {
      const targetId = targetBlock.getAttribute('data-block-id');
      if (targetId && targetId !== drag.itemId) {
        const grid = blockGridRef.value;
        if (grid) {
          const beforeRects = recordRects(grid, '.block-item:not(.dragging):not(.add-block)');
          moveInArray(blockItems, drag.itemId, targetId);
          nextTick(() => playFlip(grid, '.block-item:not(.dragging):not(.add-block)', beforeRects));
        }
      }
    }
  }
};

const moveInArray = (arr: { value: LayoutItem[] }, fromId: string, toId: string) => {
  const fromIdx = arr.value.findIndex(i => i.type === fromId);
  const toIdx = arr.value.findIndex(i => i.type === toId);
  if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
    const newOrder = [...arr.value];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    arr.value = newOrder;
    saveLayout();

    const selector = `[data-block-id="${fromId}"], [data-card-id="${fromId}"]`;
    const el = document.querySelector(selector) as HTMLElement;
    if (el) {
      const oldRect = el.getBoundingClientRect();
      requestAnimationFrame(() => {
        const newEl = document.querySelector(selector) as HTMLElement;
        if (newEl) {
          const newRect = newEl.getBoundingClientRect();
          drag.startTouchX += (newRect.left - oldRect.left);
          drag.startTouchY += (newRect.top - oldRect.top);
        }
      });
    }
  }
};

const onDocTouchEnd = () => {
  clearTimeout(pressTimer);
  pressTimer = undefined;

  if (!drag.active) {
    detachDocListeners();
    if (editModeType.value === 'drag' && !drag.hasMoved) {
      editModeType.value = 'manual';
    }
    return;
  }

  const dragSelector = `[data-block-id="${drag.itemId}"], [data-card-id="${drag.itemId}"]`;
  const draggedEl = document.querySelector(dragSelector) as HTMLElement;
  const draggedRectBefore = draggedEl ? draggedEl.getBoundingClientRect() : null;

  if (drag.source !== drag.targetZone) {
    const grid = blockGridRef.value;
    const track = cardsTrack.value;

    if (drag.source === 'grid' && drag.targetZone === 'card') {
      const item = blockItems.value.find(i => i.type === drag.itemId);
      blockItems.value = blockItems.value.filter(i => i.type !== drag.itemId);
      if (item) cardItems.value.push(item);
      saveLayout();
      if (grid) flipAfterMutation(grid, '.block-item:not(.dragging):not(.add-block)');
    } else if (drag.source === 'card' && drag.targetZone === 'grid') {
      const item = cardItems.value.find(i => i.type === drag.itemId);
      cardItems.value = cardItems.value.filter(i => i.type !== drag.itemId);
      if (item) blockItems.value.push({ ...item, w: 2, h: 2 });
      saveLayout();
      if (track) flipAfterMutation(track, '.card-item:not(.dragging)');
    }

    if (draggedRectBefore && draggedEl) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const newEl = document.querySelector(dragSelector) as HTMLElement;
          if (newEl) {
            const newRect = newEl.getBoundingClientRect();
            const dx = draggedRectBefore.left - newRect.left;
            const dy = draggedRectBefore.top - newRect.top;
            newEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
            newEl.style.transition = 'none';
            newEl.style.zIndex = '1000';
            newEl.offsetHeight;
            newEl.style.transform = '';
            newEl.style.transition = `transform ${SPRING_DURATION} ${SPRING_EASE}`;
            setTimeout(() => {
              newEl.style.transition = ''; newEl.style.transform = ''; newEl.style.zIndex = '';
              newEl.style.pointerEvents = ''; newEl.style.touchAction = ''; newEl.style.boxShadow = '';
              newEl.style.borderRadius = ''; newEl.style.width = ''; newEl.style.height = '';
            }, 500);
          }
        });
      });
    }
  } else {
    if (draggedEl) {
      draggedEl.style.transition = `transform ${SPRING_DURATION} ${SPRING_EASE}`;
      draggedEl.style.transform = '';
      draggedEl.style.zIndex = ''; draggedEl.style.pointerEvents = ''; draggedEl.style.touchAction = '';
      draggedEl.style.boxShadow = ''; draggedEl.style.borderRadius = '';
      draggedEl.style.width = ''; draggedEl.style.height = '';
      setTimeout(() => { if (draggedEl) draggedEl.style.transition = ''; }, 500);
    }
  }

  if (scrollContainer.value) { scrollContainer.value.style.overflow = ''; scrollContainer.value.style.touchAction = ''; }
  if (cardsTrack.value) { cardsTrack.value.style.overflow = ''; }

  detachDocListeners();

  drag.active = false;
  drag.itemId = '';
  drag.deltaX = 0;
  drag.deltaY = 0;

  if (editModeType.value === 'drag') {
    setTimeout(() => { editModeType.value = 'none'; }, 100);
  }
};

const startDrag = () => {
  const selector = `[data-block-id="${drag.itemId}"], [data-card-id="${drag.itemId}"]`;
  const el = document.querySelector(selector) as HTMLElement;
  if (!el) return;

  el.style.zIndex = '1000';
  el.style.pointerEvents = 'none';
  el.style.transition = 'none';
  el.style.touchAction = 'none';

  drag.active = true;

  if (scrollContainer.value) { scrollContainer.value.style.overflow = 'hidden'; scrollContainer.value.style.touchAction = 'none'; }
  if (cardsTrack.value && drag.source === 'card') {
    cardsTrack.value.style.overflow = 'hidden';
  }
};

// ==================== Resize Handle ====================

let resizeData: { item: LayoutItem; startW: number; startH: number; startX: number; startY: number; } | null = null;
let resizeMoveHandler: ((e: TouchEvent) => void) | null = null;
let resizeEndHandler: ((e: TouchEvent) => void) | null = null;

const onResizeStart = (e: TouchEvent, item: LayoutItem) => {
  const touch = e.touches[0];
  resizeData = { item, startW: item.w, startH: item.h, startX: touch.clientX, startY: touch.clientY };

  resizeMoveHandler = (ev: TouchEvent) => {
    if (!resizeData) return;
    ev.preventDefault();
    const t = ev.touches[0];
    const grid = blockGridRef.value;
    if (!grid) return;
    const size = blockSize({ type: 'x' as any, w: 1, h: 1 } as LayoutItem);
    const colWidth = size.unitW + GAP;
    const rowHeight = size.unitH + GAP;

    const dx = t.clientX - resizeData.startX;
    const dy = t.clientY - resizeData.startY;

    const newW = Math.max(1, Math.min(4, Math.round(resizeData.startW + dx / colWidth)));
    const newH = Math.max(1, Math.min(2, Math.round(resizeData.startH + dy / rowHeight)));

    if (newW !== resizeData.item.w || newH !== resizeData.item.h) {
      const idx = blockItems.value.findIndex(i => i.type === resizeData!.item.type);
      if (idx !== -1) {
        const beforeRects = recordRects(grid, '.block-item:not(.dragging):not(.add-block)');
        blockItems.value[idx] = { ...blockItems.value[idx], w: newW, h: newH };
        saveLayout();
        nextTick(() => playFlip(grid, '.block-item:not(.dragging):not(.add-block)', beforeRects));
      }
    }
  };

  resizeEndHandler = () => {
    resizeData = null;
    if (resizeMoveHandler) { document.removeEventListener('touchmove', resizeMoveHandler); resizeMoveHandler = null; }
    if (resizeEndHandler) { document.removeEventListener('touchend', resizeEndHandler); document.removeEventListener('touchcancel', resizeEndHandler); resizeEndHandler = null; }
  };

  document.addEventListener('touchmove', resizeMoveHandler, { passive: false });
  document.addEventListener('touchend', resizeEndHandler, { passive: false });
  document.addEventListener('touchcancel', resizeEndHandler, { passive: false });
};

// ==================== Add Sheet Drag ====================

const onAddItemTouchStart = (e: TouchEvent, blockType: BlockType) => {
  const touch = e.touches[0];
  pressTimer = window.setTimeout(() => {
    showAddSheet.value = false;
    const newItem: LayoutItem = { type: blockType, w: 2, h: 2 };
    blockItems.value.push(newItem);
    saveLayout();

    drag.itemId = blockType;
    drag.source = 'grid';
    drag.targetZone = 'grid';
    drag.startTouchX = touch.clientX;
    drag.startTouchY = touch.clientY;
    drag.hasMoved = false;
    editModeType.value = 'drag';

    requestAnimationFrame(() => {
      startDrag();
      attachDocListeners();
    });
  }, 400);
};

// ==================== Edit Mode: Back gesture ====================

const onPopState = (e: PopStateEvent) => {
  if (isEditMode.value) {
    editModeType.value = 'none';
    history.pushState(null, '', location.href);
  }
};

watch(isEditMode, (val) => {
  if (val) {
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', onPopState);
  } else {
    window.removeEventListener('popstate', onPopState);
  }
});

// ==================== Data Fetching ====================

const fetchAllData = async () => {
  const promises: Promise<any>[] = [];
  promises.push(recommendStore.refreshIfStale());
  promises.push(fetchArtists());
  promises.push(fetchPlaylists());
  if (isLoggedIn.value) {
    promises.push(loadFmSongs());
    promises.push(userStore.initializeAlbumList().then(() => pickDailyAlbum()));
  }
  await Promise.allSettled(promises);
};

onMounted(() => {
  fetchAllData();
  if (userStore.albumList && userStore.albumList.length > 0) pickDailyAlbum();
});

onActivated(() => {
  recommendStore.refreshIfStale();
  if (userStore.albumList && userStore.albumList.length > 0) pickDailyAlbum();
});

onBeforeUnmount(() => {
  clearTimeout(pressTimer);
  detachDocListeners();
  window.removeEventListener('popstate', onPopState);
  if (resizeMoveHandler) document.removeEventListener('touchmove', resizeMoveHandler);
  if (resizeEndHandler) { document.removeEventListener('touchend', resizeEndHandler); document.removeEventListener('touchcancel', resizeEndHandler); }
});
</script>

<style scoped lang="scss">
.modular-home {
  position: relative; width: 100%; height: 100%; overflow: hidden;
  background: var(--cover-bg, var(--m-bg, var(--bg-color)));
  transition: background 0.6s ease;
}

.ambient-bg { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.ambient-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.1; animation: orbFloat 25s ease-in-out infinite; }
.orb-1 { width: 320px; height: 320px; background: var(--accent-color, #888); top: 5%; left: -15%; }
.orb-2 { width: 280px; height: 280px; background: var(--accent-color-dark, #8b5cf6); top: 35%; right: -15%; animation-delay: -8s; }
.orb-3 { width: 240px; height: 240px; background: var(--accent-color-light, #06b6d4); bottom: 15%; left: 25%; animation-delay: -16s; }
@keyframes orbFloat { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(40px, -30px) scale(1.1); } 66% { transform: translate(-30px, 40px) scale(0.92); } }

.top-mask {
  position: fixed; top: 0; left: 0; right: 0;
  height: calc(var(--safe-area-inset-top, 0px) + 100px);
  background: linear-gradient(to bottom, var(--cover-bg, var(--m-bg, var(--bg-color))) 0%, var(--cover-bg, var(--m-bg, var(--bg-color))) 30%, transparent 100%);
  z-index: 10; pointer-events: none;
}

.home-scroll {
  position: relative; z-index: 1; height: 100%;
  overflow-y: auto; overflow-x: hidden;
  -webkit-overflow-scrolling: touch; scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}
.topbar-spacer { height: calc(var(--safe-area-inset-top, 0px) + 56px); flex-shrink: 0; }

/* ==================== Card Carousel ==================== */
.card-section { margin-top: 8px; }
.cards-track {
  display: flex; overflow-x: auto; overflow-y: visible;
  scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;
  scrollbar-width: none; gap: 0; padding: 0 16px; scroll-behavior: smooth;
  &::-webkit-scrollbar { display: none; }
}

.card-item {
  flex: 0 0 calc(100vw - 32px); scroll-snap-align: center; scroll-snap-stop: always;
  border-radius: 24px; overflow: hidden; position: relative;
  aspect-ratio: 16 / 11; margin-right: 12px; cursor: pointer;
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
  transition: transform 0.3s var(--m-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
  &:active:not(.edit-mode):not(.dragging) { transform: scale(0.98); }
  &.edit-mode { animation: jiggle 0.4s ease-in-out infinite; }
  &.dragging {
    opacity: 0.95; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
    animation: none !important; transition: none !important;
  }
}
.card-item:last-child { margin-right: 0; }
@keyframes jiggle { 0%, 100% { transform: rotate(-0.5deg); } 50% { transform: rotate(0.5deg); } }

.card-inner { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 24px; }
.card-bg { position: absolute; inset: 0; z-index: 1; }
.card-overlay { position: absolute; inset: 0; z-index: 2; background: linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.35) 100%); }
.card-glow { position: absolute; inset: -20px; border-radius: 50%; filter: blur(40px); opacity: 0.2; z-index: 0; pointer-events: none; }

.card-content {
  position: relative; z-index: 3; width: 100%; height: 100%;
  padding: 20px; display: flex; flex-direction: column; justify-content: space-between; color: #fff;
}
.card-top-row { display: flex; justify-content: space-between; align-items: flex-start; }
.card-badge {
  display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px;
  border-radius: 10px; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px);
  font-size: 11px; font-weight: 600; i { font-size: 13px; }
}
.card-body { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; }
.card-title { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3); margin: 0; }
.card-subtitle { font-size: 14px; opacity: 0.75; margin-top: 4px; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.2); }
.card-watermark { position: absolute; bottom: -10px; right: -10px; font-size: 120px; opacity: 0.08; z-index: 2; pointer-events: none; }

.action-btn {
  position: absolute; bottom: 16px; right: 16px; z-index: 5;
  width: 40px; height: 40px; border-radius: 50%; border: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1);
  &:active { transform: scale(0.88); }
}
.play-btn {
  background: rgba(255, 255, 255, 0.9); color: #1a1a1a; font-size: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2); i { margin-left: 2px; }
}

.daily-date { display: flex; flex-direction: column; align-items: flex-end; }
.daily-day { font-family: var(--m-font-serif, 'Cormorant Garamond', serif); font-size: 36px; font-weight: 700; line-height: 1; }
.daily-weekday { font-size: 10px; letter-spacing: 0.1em; opacity: 0.8; margin-top: 2px; }
.daily-preview { margin-top: 12px; display: flex; flex-direction: column; gap: 2px; }
.daily-preview-item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.preview-num { width: 16px; text-align: center; opacity: 0.5; font-weight: 600; }
.preview-name { flex: 1; font-weight: 500; }
.preview-artist { opacity: 0.5; max-width: 80px; }

.fm-body { flex-direction: row; align-items: center; gap: 16px; }
.fm-cover-wrap { position: relative; width: 72px; height: 72px; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3); flex-shrink: 0; }
.fm-cover { width: 100%; height: 100%; object-fit: cover; }
.fm-cover-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.1); i { font-size: 28px; opacity: 0.5; } }
.fm-eq { position: absolute; bottom: 4px; right: 4px; display: flex; align-items: flex-end; gap: 2px; }
.eq-bar { width: 3px; border-radius: 9999px; background: #fff; animation: eqPulse 0.8s ease-in-out infinite; }
.eq-bar:nth-child(1) { height: 6px; }
.eq-bar:nth-child(2) { height: 12px; }
.eq-bar:nth-child(3) { height: 8px; }
@keyframes eqPulse { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.6); } }
.fm-info { flex: 1; min-width: 0; }
.fm-controls { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.fm-icon-btn {
  width: 36px; height: 36px; border-radius: 50%; border: none;
  background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(8px); color: rgba(255, 255, 255, 0.7);
  display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer;
  transition: all 160ms cubic-bezier(0.23, 1, 0.32, 1); &.fav { color: #ef4444; } &:active { transform: scale(0.9); }
}
.fm-play-btn {
  width: 44px; height: 44px; border-radius: 50%; border: none;
  background: rgba(255, 255, 255, 0.25); backdrop-filter: blur(8px); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer;
  transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1); &:active { transform: scale(0.9); }
}

.user-body { flex-direction: row; align-items: center; gap: 16px; }
.user-avatar-wrap { width: 56px; height: 56px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(255, 255, 255, 0.3); flex-shrink: 0; }
.user-avatar { width: 100%; height: 100%; object-fit: cover; }
.user-avatar-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.15); i { font-size: 24px; opacity: 0.6; } }
.user-info { flex: 1; min-width: 0; }

.artists-row { display: flex; gap: 12px; overflow: hidden; }
.artist-chip { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; flex: 1; }
.artist-chip-img { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
.artist-chip-name { font-size: 11px; text-align: center; opacity: 0.85; max-width: 100%; }

.playlists-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.pl-chip { display: flex; flex-direction: column; gap: 4px; }
.pl-chip-img { width: 100%; aspect-ratio: 1; border-radius: 10px; object-fit: cover; }
.pl-chip-name { font-size: 10px; opacity: 0.7; }
.card-empty-hint { flex: 1; display: flex; align-items: center; justify-content: center; i { font-size: 40px; opacity: 0.3; } }

.page-dots { display: flex; justify-content: center; gap: 6px; margin-top: 12px; }
.page-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--cover-text-muted, var(--m-text-muted, #9a9590)); opacity: 0.3;
  transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  &.active { opacity: 1; background: var(--accent-color, #888); width: 18px; border-radius: 3px; }
}

.drop-zone-indicator { text-align: center; padding: 8px; font-size: 12px; font-weight: 600; color: var(--accent-color, #888); opacity: 0.8; }

/* ==================== Block Grid (CSS Grid + dense packing) ==================== */
.block-grid-container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-flow: dense;
  grid-auto-rows: calc((100vw - 32px - 36px) / 4);
  gap: 12px; padding: 16px;
  position: relative;
}

.block-item {
  position: relative; border-radius: 24px; overflow: hidden; cursor: pointer;
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
  transition: transform 0.3s var(--m-ease-out, cubic-bezier(0.23, 1, 0.32, 1));

  .block-glow { position: absolute; inset: -20px; border-radius: 50%; filter: blur(30px); opacity: 0.2; z-index: 0; pointer-events: none; }
  &:active:not(.edit-mode):not(.dragging) { transform: scale(0.96); }
  &.edit-mode { animation: jiggle 0.4s ease-in-out infinite; }
  &.edit-mode:nth-child(even) { animation-delay: 0.2s; }
  &.dragging {
    opacity: 0.95; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
    animation: none !important; transition: none !important;
  }
}

.block-bg { position: absolute; inset: 0; z-index: 1; }
.block-inner {
  position: relative; z-index: 2; width: 100%; height: 100%;
  padding: 14px; display: flex; flex-direction: column; justify-content: space-between; color: #fff;
}
.block-label { font-size: 14px; font-weight: 600; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.block-hint { font-size: 11px; opacity: 0.65; margin-top: 2px; }
.block-top { display: flex; justify-content: space-between; align-items: center; }
.block-mini-badge { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(4px); }
.block-corner-icon { font-size: 18px; opacity: 0.7; }
.block-date { display: flex; flex-direction: column; align-items: flex-end; }
.block-date-day { font-family: var(--m-font-serif, 'Cormorant Garamond', serif); font-size: 36px; font-weight: 700; line-height: 1; }
.block-date-week { font-size: 10px; letter-spacing: 0.1em; opacity: 0.7; margin-top: 2px; }
.block-daily-songs { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
.block-daily-song { font-size: 11px; opacity: 0.8; display: flex; gap: 6px; align-items: center; }
.song-num { opacity: 0.5; font-weight: 600; min-width: 14px; }
.block-icon-large { font-size: 32px; opacity: 0.85; align-self: flex-start; }
.block-fm-cover-wrap { position: relative; width: 52px; height: 52px; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); }
.block-fm-cover { width: 100%; height: 100%; object-fit: cover; }
.block-fm-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.1); i { font-size: 22px; opacity: 0.4; } }
.block-fm-eq { position: absolute; bottom: 3px; right: 3px; display: flex; align-items: flex-end; gap: 2px; }
.block-fm-song { font-size: 11px; opacity: 0.75; }
.block-user-avatar-wrap { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(255, 255, 255, 0.25); }
.block-user-avatar { width: 100%; height: 100%; object-fit: cover; }
.block-user-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.15); i { font-size: 22px; opacity: 0.5; } }
.block-collage { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
.collage-img { width: 100%; aspect-ratio: 1; object-fit: cover; animation: fadeIn 0.5s ease both; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.block-album-cover-wrap { width: 100%; aspect-ratio: 1; border-radius: 12px; overflow: hidden; margin-bottom: 6px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2); }
.block-album-cover { width: 100%; height: 100%; object-fit: cover; }

.resize-handle {
  position: absolute; bottom: 0; right: 0; z-index: 10;
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  cursor: nwse-resize; touch-action: none;
  i { font-size: 18px; color: rgba(255, 255, 255, 0.6); filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.3)); }
}

.add-block {
  .add-bg { background: var(--cover-surface, rgba(0, 0, 0, 0.05)); border: 2px dashed var(--cover-border, rgba(128, 128, 128, 0.3)); }
  .add-inner {
    align-items: center; justify-content: center;
    i { font-size: 32px; color: var(--cover-text-muted, var(--m-text-muted, #9a9590)); margin-bottom: 4px; }
    span { font-size: 13px; color: var(--cover-text-muted, var(--m-text-muted, #9a9590)); }
  }
}

.block-remove, .card-remove {
  position: absolute; top: 8px; right: 8px; z-index: 10;
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  border-radius: 50%; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(12px) saturate(180%);
  i { font-size: 22px; color: #ff4444; }
}

.add-sheet-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(8px) saturate(180%);
  display: flex; align-items: flex-end;
}
.add-sheet {
  width: 100%; background: var(--cover-bg, var(--m-bg, var(--bg-color)));
  border-radius: 28px 28px 0 0; padding: 8px 20px 32px;
  padding-bottom: calc(var(--safe-area-inset-bottom, 0px) + 32px);
}
.add-sheet-handle { width: 36px; height: 4px; border-radius: 9999px; background: var(--cover-text-muted, var(--m-text-muted, #9a9590)); opacity: 0.3; margin: 0 auto 16px; }
.add-sheet-title { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: var(--cover-text-primary, var(--m-text-primary, var(--text-color))); margin-bottom: 20px; }
.add-sheet-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.add-sheet-item { cursor: pointer; transition: transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1); &:active { transform: scale(0.92); } }
.add-sheet-thumb {
  width: 100%; aspect-ratio: 1; border-radius: 20px; overflow: hidden;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  position: relative; color: #fff; gap: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}
.add-sheet-thumb-icon { font-size: 32px; opacity: 0.9; }
.add-sheet-thumb-label { font-size: 13px; font-weight: 600; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.2); }

.bottom-spacer { height: 240px; flex-shrink: 0; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.sheet-enter-active, .sheet-leave-active {
  transition: opacity 0.3s ease;
  .add-sheet { transition: transform 0.3s var(--m-ease-drawer, cubic-bezier(0.32, 0.72, 0, 1)); }
}
.sheet-enter-from, .sheet-leave-to { opacity: 0; .add-sheet { transform: translateY(100%); } }

.card-daily-album {
  .daily-album-body { display: flex; align-items: center; gap: 14px; margin-top: 8px; }
  .daily-album-cover-wrap { width: 80px; height: 80px; border-radius: 14px; overflow: hidden; flex-shrink: 0; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3); }
  .daily-album-cover { width: 100%; height: 100%; object-fit: cover; }
  .daily-album-placeholder { width: 80px; height: 80px; border-radius: 14px; background: rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; i { font-size: 32px; color: rgba(255, 255, 255, 0.5); } }
  .daily-album-info { flex: 1; min-width: 0; }
  .daily-album-info .card-title { font-size: 17px; font-weight: 700; color: #fff; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .daily-album-info .card-subtitle { font-size: 12px; color: rgba(255, 255, 255, 0.7); margin: 4px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

@media (prefers-reduced-motion: reduce) {
  .ambient-orb, .block-item.edit-mode, .card-item.edit-mode { animation: none; }
}
</style>
