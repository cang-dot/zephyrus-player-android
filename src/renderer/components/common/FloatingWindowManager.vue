<template>
  <floating-panel v-if="windowStore.activePath" />
</template>

<script setup lang="ts">
import { useWindowStore } from '@/store/modules/windowStore';

import FloatingPanel from './FloatingPanel.vue';

const windowStore = useWindowStore();
</script>
