<template>
  <!-- 移动端优先项目：始终使用 MobileLayout -->
  <mobile-layout :is-phone="true" />

  <!-- 歌单抽屉（全局） -->
  <playlist-drawer v-model="showPlaylistDrawer" :song-id="currentSongId" />
  <playing-list-drawer />
</template>

<script lang="ts" setup>
import { defineAsyncComponent, onMounted, provide, ref } from 'vue';

import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';

import MobileLayout from './MobileLayout.vue';

const PlayingListDrawer = defineAsyncComponent(
  () => import('@/components/player/PlayingListDrawer.vue')
);
const PlaylistDrawer = defineAsyncComponent(() => import('@/components/common/PlaylistDrawer.vue'));

const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();

onMounted(() => {
  settingsStore.initializeSettings();
  settingsStore.initializeTheme();
});

const showPlaylistDrawer = ref(false);
const currentSongId = ref<number | undefined>();

const openPlaylistDrawer = (songId: number, isOpen: boolean = true) => {
  currentSongId.value = songId;
  showPlaylistDrawer.value = isOpen;
  playerStore.setMusicFull(false);
  playerStore.setPlayListDrawerVisible(!isOpen);
};

provide('openPlaylistDrawer', openPlaylistDrawer);
</script>
