<template>
  <div class="home-container home-low-saturation h-full w-full transition-colors duration-500">
    <mobile-home v-if="isMobile" />

    <!-- Desktop: Original layout -->
    <n-scrollbar v-else class="h-full">
      <div class="home-content w-full pb-32 page-padding">
        <!-- Hero Section -->
        <home-hero class="enter-fade" />

        <!-- Main Content Sections -->
        <div class="content-sections space-y-8 lg:space-y-12">
          <!-- Recommended Playlists (Grid Section) -->
          <home-playlist-section
            :title="t('comp.recommendSonglist.title')"
            :limit="18"
            class="enter-stagger"
          />

          <!-- Hot Artists (Horizontal Scroll Section) -->
          <home-artists
            :title="t('comp.recommendSinger.title')"
            :limit="15"
            class="enter-stagger"
          />

          <!-- New Albums (NEW - 新碟上架) -->
          <home-album-section
            :title="t('comp.newAlbum.title')"
            :limit="6"
            :columns="5"
            :rows="1"
            class="enter-stagger"
            @more="router.push('/album')"
          />

          <!-- New Songs (Compact Grid Section) -->
          <home-new-songs
            :title="t('comp.recommendNewMusic.title')"
            :limit="20"
            class="enter-stagger"
          />
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script lang="ts" setup>
import { NScrollbar } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { isMobile } from '@/utils';

import HomeAlbumSection from './components/HomeAlbumSection.vue';
import HomeArtists from './components/HomeArtists.vue';
import HomeHero from './components/HomeHero.vue';
import HomeNewSongs from './components/HomeNewSongs.vue';
import HomePlaylistSection from './components/HomePlaylistSection.vue';
import MobileHome from './components/MobileHome.vue';

defineOptions({
  name: 'Home'
});

const { t } = useI18n();
const router = useRouter();
</script>

<style lang="scss" scoped>
.home-container {
  position: relative;
  background: var(--bg-color);
}

/* Home surfaces stay quiet so song and action labels carry the visual energy. */
.home-low-saturation {
  --home-surface: #707873;
  --home-surface-strong: #7a827c;
  --home-border: rgba(255, 255, 255, 0.2);
  --home-ink: #ffffff;
  --home-ink-alt: #ffffff;
  --home-ink-muted: rgba(255, 255, 255, 0.76);
  --home-control: #7d857f;
  color: var(--home-ink);
}

:global(.dark) .home-low-saturation {
  --home-surface: #2d3632;
  --home-surface-strong: #39453f;
  --home-border: rgba(255, 255, 255, 0.2);
  --home-ink: #ffffff;
  --home-ink-alt: #ffffff;
  --home-ink-muted: rgba(255, 255, 255, 0.76);
  --home-control: #35413c;
}

.home-low-saturation :deep(.modular-home),
.home-low-saturation :deep(.home-content) {
  color: var(--home-ink);
}

.home-low-saturation :deep(.card-item),
.home-low-saturation :deep(.daily-card),
.home-low-saturation :deep(.fm-card),
.home-low-saturation :deep(.home-list-card),
.home-low-saturation :deep(.home-card),
.home-low-saturation :deep(.nav-card),
.home-low-saturation :deep(.artist-chip),
.home-low-saturation :deep(.playlist-card),
.home-low-saturation :deep(.album-card),
.home-low-saturation :deep(.song-card) {
  background-color: var(--home-surface) !important;
  border-color: var(--home-border) !important;
  box-shadow: 0 12px 28px rgba(34, 49, 43, 0.1);
}

.home-low-saturation :deep(.card-bg),
.home-low-saturation :deep(.hero-card img),
.home-low-saturation :deep(.home-list-card img) {
  filter: grayscale(0.85) saturate(0.08) brightness(0.66) contrast(0.88);
}

.home-low-saturation :deep(.card-glow) {
  background: var(--home-surface-strong) !important;
  opacity: 0.42;
}

.home-low-saturation :deep(.block-glow) {
  background: var(--home-surface-strong) !important;
  opacity: 0.28;
}

.home-low-saturation :deep(.block-bg) {
  filter: grayscale(0.85) saturate(0.08) brightness(0.66) contrast(0.88);
}

.home-low-saturation :deep(.page-dot.active) {
  background: var(--home-surface-strong) !important;
}

.home-low-saturation :deep(.card-overlay) {
  background: linear-gradient(180deg, rgba(34, 48, 43, 0.08), rgba(34, 48, 43, 0.28));
}

.home-low-saturation :deep(h1),
.home-low-saturation :deep(h2),
.home-low-saturation :deep(h3),
.home-low-saturation :deep(.card-title),
.home-low-saturation :deep(.section-title),
.home-low-saturation :deep(.content-name),
.home-low-saturation :deep(.artist-name),
.home-low-saturation :deep(.song-name),
.home-low-saturation :deep(.playlist-name),
.home-low-saturation :deep(.album-name) {
  color: var(--home-ink) !important;
}

.home-low-saturation :deep(p),
.home-low-saturation :deep(.card-subtitle),
.home-low-saturation :deep(.artist-meta),
.home-low-saturation :deep(.song-artist),
.home-low-saturation :deep(.section-more),
.home-low-saturation :deep(.text-neutral-400),
.home-low-saturation :deep(.text-neutral-500),
.home-low-saturation :deep(.text-neutral-600) {
  color: var(--home-ink-muted) !important;
}

.home-low-saturation :deep(button),
.home-low-saturation :deep(a),
.home-low-saturation :deep(i) {
  color: var(--home-ink-alt);
}

.home-low-saturation :deep(button:hover),
.home-low-saturation :deep(a:hover) {
  color: var(--home-ink) !important;
}

.home-low-saturation :deep(.bg-\[var\(--accent-color\)\]),
.home-low-saturation :deep(.bg-\[var\(--accent-color\)\]\/90) {
  background-color: var(--home-ink) !important;
}

.home-low-saturation :deep(.nav-chip),
.home-low-saturation :deep(.daily-play-btn),
.home-low-saturation :deep(.fm-play-btn) {
  background: var(--home-control) !important;
  color: var(--home-ink) !important;
  border: 1px solid var(--home-border);
}

.home-low-saturation :deep(.topbar-pill),
.home-low-saturation :deep(.mobile-glow-nav) {
  background: var(--home-surface) !important;
  color: var(--home-ink) !important;
}

.home-low-saturation :deep(.topbar-title-text),
.home-low-saturation :deep(.topbar-search-text),
.home-low-saturation :deep(.topbar-title-pill),
.home-low-saturation :deep(.topbar-search-pill),
.home-low-saturation :deep(.topbar-action-pill),
.home-low-saturation :deep(.glow-nav-item),
.home-low-saturation :deep(.glow-item-content),
.home-low-saturation :deep(.glow-item-label),
.home-low-saturation :deep(.glow-item-icon),
.home-low-saturation :deep(.topbar-pill input) {
  color: var(--home-ink) !important;
}

.home-low-saturation :deep(.search-input),
.home-low-saturation :deep(.topbar-search) {
  background: var(--home-surface) !important;
  color: var(--home-ink) !important;
}

.home-low-saturation :deep(.glow-nav-item.active .glow-item-icon),
.home-low-saturation :deep(.glow-nav-item.active .glow-item-label) {
  color: var(--home-ink) !important;
}

/* 移动端使用暖色基底 */
.mobile .home-container {
  background: var(--m-bg, var(--bg-color));
}

/* 入场动画 - 使用自定义缓动曲线（Emil Kowalski 风格） */
:deep(.animate-item) {
  animation: fadeInUp 0.6s var(--m-ease-out, cubic-bezier(0.23, 1, 0.32, 1)) backwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 交错延迟 - 50ms 间隔（技能建议 30-80ms） */
:deep(.animate-item) {
  @for $i from 1 through 20 {
    &:nth-child(#{$i}) {
      animation-delay: #{$i * 0.05}s;
    }
  }
}
</style>
