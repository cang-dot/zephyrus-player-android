<template>
  <main class="mobile-discover-sub">
    <div v-if="loading" class="listen-list">
      <div v-for="i in 6" :key="i" class="listen-item skeleton-shimmer" />
    </div>
    <div v-else class="listen-list">
      <button
        v-for="item in programs"
        :key="item.id"
        type="button"
        class="listen-item"
        @click="play(item)"
      >
        <img :src="getImgUrl(item.picUrl, '200y200')" :alt="item.name" /><span
          ><strong>{{ item.name }}</strong
          ><small>{{ item.dj?.brand || item.dj?.nickname || '推荐节目' }}</small></span
        >
      </button>
    </div>
  </main>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { getPersonalizedDJ } from '@/api/home';
import { getImgUrl } from '@/utils';
const router = useRouter();
const programs = ref<any[]>([]);
const loading = ref(true);
onMounted(async () => {
  try {
    const { data } = await getPersonalizedDJ();
    programs.value = (data?.result || []).slice(0, 20);
  } finally {
    loading.value = false;
  }
});
const play = (item: any) => {
  if (item.program?.mainSong?.id)
    router.push({ path: '/mobile-search-result', query: { keyword: item.program.name, type: 1 } });
};
</script>
<style scoped>
.mobile-discover-sub {
  min-height: 100%;
  padding: calc(var(--safe-area-inset-top, 0px) + 82px) 16px
    calc(var(--safe-area-inset-bottom, 0px) + 220px);
}
.listen-list {
  display: grid;
  gap: 10px;
}
.listen-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 72px;
  padding: 8px 12px;
  border: 0;
  border-radius: 20px;
  background: color-mix(in srgb, var(--m-surface) 68%, transparent);
  color: inherit;
  text-align: left;
}
.listen-item img {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  object-fit: cover;
}
.listen-item span {
  display: grid;
  gap: 5px;
}
.listen-item small {
  color: var(--m-text-secondary);
}
</style>
