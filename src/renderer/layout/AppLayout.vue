<template>
  <!-- 移动端优先项目：始终使用 MobileLayout -->
  <mobile-layout :is-phone="true" />

  <!-- 歌单抽屉（全局） -->
  <playlist-drawer v-model="showPlaylistDrawer" :song="currentSong" :song-id="currentSongId" />
  <playing-list-drawer />
</template>

<script lang="ts" setup>
import { defineAsyncComponent, onMounted, provide, ref } from 'vue';

import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import type { SongResult } from '@/types/music';

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
const currentSong = ref<SongResult | undefined>();

const openPlaylistDrawer = (songOrId: number | SongResult, isOpen: boolean = true) => {
  if (typeof songOrId === 'number') {
    currentSongId.value = songOrId;
    currentSong.value = undefined;
  } else {
    currentSong.value = songOrId;
    currentSongId.value = typeof songOrId.id === 'number' ? songOrId.id : undefined;
  }
  showPlaylistDrawer.value = isOpen;
  playerStore.setMusicFull(false);
  playerStore.setPlayListDrawerVisible(!isOpen);
};

provide('openPlaylistDrawer', openPlaylistDrawer);
</script>
