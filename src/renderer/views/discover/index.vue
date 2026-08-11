<template>
  <div class="discover-page">
    <div class="discover-grid">
      <button
        v-for="item in shortcuts"
        :key="item.key"
        type="button"
        class="discover-card"
        data-no-page-swipe
        @click="openShortcut(item)"
      >
        <i :class="item.icon" />
        <span>{{ item.label }}</span>
      </button>
    </div>
    <div class="discover-section">
      <home-playlist-section
        :title="t('comp.recommendSonglist.title')"
        :limit="8"
        :show-more="false"
      />
    </div>
    <div class="discover-section">
      <home-album-section
        :title="t('comp.newAlbum.title')"
        :limit="6"
        :columns="3"
        :rows="1"
        @more="router.push('/album')"
      />
    </div>
    <div ref="artistsSection" class="discover-section discover-artists">
      <h2>{{ t('comp.recommendSinger.title') }}</h2>
      <home-artists :title="t('comp.recommendSinger.title')" :limit="12" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import HomeAlbumSection from '@/views/home/components/HomeAlbumSection.vue';
import HomeArtists from '@/views/home/components/HomeArtists.vue';
import HomePlaylistSection from '@/views/home/components/HomePlaylistSection.vue';

const { t } = useI18n();
const router = useRouter();
const artistsSection = ref<HTMLElement | null>(null);
const shortcuts = [
  { key: 'toplist', path: '/toplist', icon: 'ri-bar-chart-grouped-fill', label: '榜单' },
  { key: 'album', path: '/album', icon: 'ri-album-fill', label: '新专辑' },
  { key: 'artists', target: 'artists', icon: 'ri-mic-fill', label: '热门歌手' },
  { key: 'podcast', path: '/podcast', icon: 'ri-radio-2-fill', label: '播客' }
];

const openShortcut = (item: (typeof shortcuts)[number]) => {
  if (item.target === 'artists') {
    artistsSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (item.path) router.push(item.path);
};
</script>

<style scoped lang="scss">
.discover-page {
  min-height: 100%;
  padding: calc(var(--safe-area-inset-top, 0px) + 72px) 16px 150px;
  color: var(--m-text-primary, var(--text-color));
}
.discover-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 24px;
}
.discover-card {
  display: grid;
  min-height: 74px;
  place-items: center;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--m-white, #fff) 24%, transparent);
  border-radius: 24px;
  background: color-mix(in srgb, var(--m-surface) 62%, transparent);
  color: var(--m-text-primary, var(--text-color));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
}
.discover-card i {
  color: var(--accent-color);
  font-size: 22px;
}
.discover-card span {
  font-size: 11px;
}
.discover-card:active {
  transform: scale(0.97);
}
.discover-section {
  margin-top: 22px;
}

.discover-artists {
  scroll-margin-top: calc(var(--safe-area-inset-top, 0px) + 72px);
}

.discover-artists h2 {
  margin: 0 0 14px;
  font-size: 18px;
  font-weight: 700;
}
</style>
