<template>
  <div class="discover-page">
    <div class="discover-grid">
      <button
        v-for="item in shortcuts"
        :key="item.path"
        class="discover-card"
        @click="router.push(item.path)"
      >
        <i :class="item.icon" />
        <span>{{ item.label }}</span>
      </button>
    </div>
    <div class="discover-section">
      <home-playlist-section :title="t('comp.recommendSonglist.title')" :limit="8" />
    </div>
    <div class="discover-section">
      <home-album-section :title="t('comp.newAlbum.title')" :limit="6" :columns="3" :rows="1" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import HomeAlbumSection from '@/views/home/components/HomeAlbumSection.vue';
import HomePlaylistSection from '@/views/home/components/HomePlaylistSection.vue';

const { t } = useI18n();
const router = useRouter();
const shortcuts = [
  { path: '/toplist', icon: 'ri-bar-chart-grouped-fill', label: '榜单' },
  { path: '/album', icon: 'ri-album-fill', label: '新专辑' },
  { path: '/artist/detail/0', icon: 'ri-mic-fill', label: '热门歌手' },
  { path: '/podcast', icon: 'ri-radio-2-fill', label: '播客' }
];
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
</style>
