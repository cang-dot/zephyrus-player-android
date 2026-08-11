<template>
  <!-- 移动端优先项目：始终使用 MobileLayout -->
  <mobile-layout :is-phone="true" />
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';

import { useSettingsStore } from '@/store/modules/settings';

import MobileLayout from './MobileLayout.vue';
const settingsStore = useSettingsStore();

onMounted(() => {
  settingsStore.initializeSettings();
  settingsStore.initializeTheme();
});
</script>
