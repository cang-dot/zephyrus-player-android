<template>
  <main ref="pageRoot" class="mobile-discover-sub">
    <div v-if="loading" class="sub-grid">
      <div v-for="i in 12" :key="i" class="sub-chip skeleton-shimmer" />
    </div>
    <div v-else-if="!selectedGenre" class="sub-grid">
      <button
        v-for="item in categories"
        :key="item.name"
        type="button"
        class="sub-chip"
        @click="selectGenre(item.name)"
      >
        {{ item.name }}
      </button>
    </div>
    <section v-else class="genre-results">
      <div class="genre-results-heading">
        <button type="button" aria-label="返回曲风分类" @click="clearGenre">
          <i class="ri-arrow-left-line" />
        </button>
        <h2>{{ selectedGenre }}</h2>
      </div>
      <div v-if="resultsLoading" class="genre-result-grid">
        <div v-for="i in 6" :key="i" class="genre-result skeleton-shimmer" />
      </div>
      <div v-else class="genre-result-grid">
        <button
          v-for="item in results"
          :key="item.id"
          class="genre-result"
          type="button"
          @click="openPlaylist(item)"
        >
          <img :src="getImgUrl(item.coverImgUrl || item.picUrl, '300y300')" :alt="item.name" />
          <span>{{ item.name }}</span>
        </button>
      </div>
    </section>
    <div class="sub-bottom-spacer" aria-hidden="true" />
  </main>
</template>
<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { getPlaylistCategory } from '@/api/home';
import { getListByCat } from '@/api/list';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import { getImgUrl } from '@/utils';
const router = useRouter();
const categories = ref<any[]>([]);
const pageRoot = ref<HTMLElement | null>(null);
const loading = ref(true);
const selectedGenre = ref('');
const results = ref<any[]>([]);
const resultsLoading = ref(false);
const resetPageScroll = async () => {
  await nextTick();
  const scrollContainer = pageRoot.value?.closest('.mobile-content');
  if (scrollContainer instanceof HTMLElement) {
    scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
  } else {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
};
const selectGenre = async (name: string) => {
  selectedGenre.value = name;
  await resetPageScroll();
  resultsLoading.value = true;
  try {
    const response = await getListByCat({ cat: name, offset: 0, limit: 12 });
    results.value = response.data?.playlists || response.data?.result || [];
  } finally {
    resultsLoading.value = false;
  }
};
const clearGenre = () => {
  selectedGenre.value = '';
  results.value = [];
  void resetPageScroll();
};
const openPlaylist = (item: any) =>
  navigateToMusicList(router, {
    id: item.id,
    type: 'playlist',
    name: item.name || selectedGenre.value,
    listInfo: item
  });
onMounted(async () => {
  try {
    const { data } = await getPlaylistCategory();
    categories.value = (data?.sub || data?.categories || []).slice(0, 36);
  } finally {
    loading.value = false;
  }
});
</script>
<style scoped>
.mobile-discover-sub {
  min-height: 100dvh;
  padding: calc(var(--safe-area-inset-top, 0px) + 82px) 16px
    calc(var(--mobile-dock-content-inset, 82px) + var(--safe-area-inset-bottom, 0px) + 220px);
  scroll-padding-bottom: calc(
    var(--mobile-dock-content-inset, 82px) + var(--safe-area-inset-bottom, 0px) + 220px
  );
}
.sub-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.genre-results {
  margin-top: 0;
}
.genre-results-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.genre-results-heading button {
  display: grid;
  width: 40px;
  height: 40px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--m-surface) 68%, transparent);
  color: inherit;
  font-size: 20px;
}
.genre-results h2 {
  margin: 0;
  font-size: 20px;
}
.genre-result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.genre-result {
  display: grid;
  gap: 7px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}
.genre-result img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 18px;
}
.genre-result span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.sub-chip {
  min-height: 54px;
  border: 0;
  border-radius: 18px;
  background: color-mix(in srgb, var(--m-surface) 68%, transparent);
  color: inherit;
}
.skeleton-shimmer {
  opacity: 0.5;
}
.sub-bottom-spacer {
  width: 100%;
  height: calc(
    var(--mobile-dock-content-inset, 132px) + var(--safe-area-inset-bottom, 0px) + 280px
  );
  grid-column: 1 / -1;
  flex: 0 0 auto;
}
</style>
