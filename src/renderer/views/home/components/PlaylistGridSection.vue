<script setup lang="ts">
/** 为你推荐：精选歌单 2×2 网格卡（封面 + 底部渐变 + 歌单名 + 小字），无「更多」入口 */
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getPersonalizedPlaylist } from '@/api/home';
import { getImgUrl } from '@/utils';

interface RecommendedPlaylist {
  id: number | string;
  name: string;
  picUrl?: string;
  copywriter?: string;
}

const { t } = useI18n();
const router = useRouter();

const playlists = ref<RecommendedPlaylist[]>([]);

function open(item: RecommendedPlaylist) {
  router.push(`/music-list/${item.id}?type=playlist`);
}

onMounted(async () => {
  try {
    const response = await getPersonalizedPlaylist(8);
    playlists.value = (response.data?.result || []).slice(0, 4);
  } catch {
    playlists.value = [];
  }
});
</script>

<template>
  <section v-if="playlists.length" class="playlist-grid-section">
    <h2>{{ t('comp.homeV2.forYouTitle') }}</h2>
    <div class="playlist-grid">
      <button
        v-for="item in playlists"
        :key="item.id"
        class="playlist-card"
        type="button"
        @click="open(item)"
      >
        <span
          class="playlist-cover"
          :style="
            item.picUrl
              ? { backgroundImage: `url(${getImgUrl(item.picUrl, '400y400')})` }
              : undefined
          "
        >
          <i v-if="!item.picUrl" class="ri-play-list-2-line" />
        </span>
        <span class="playlist-shade" />
        <span class="playlist-copy">
          <b>{{ item.name }}</b>
          <small>{{ item.copywriter || t('comp.homeV2.badge') }}</small>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.playlist-grid-section {
  margin-top: 20px;
  padding: 0 16px;
}

h2 {
  margin: 0 0 10px;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--m-text-primary, #20211f);
}

.playlist-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.playlist-card {
  position: relative;
  overflow: hidden;
  aspect-ratio: 1 / 1;
  border-radius: 20px;
  background: var(--m-surface-container-low, rgba(128, 128, 128, 0.12));
  text-align: left;
  isolation: isolate;

  .playlist-cover {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background-position: center;
    background-size: cover;
    color: rgba(255, 255, 255, 0.5);
  }
}

.playlist-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.06) 38%, rgba(0, 0, 0, 0.68) 100%);
}

.playlist-copy {
  position: absolute;
  inset: auto 12px 11px;
  display: grid;
  gap: 2px;

  b {
    overflow: hidden;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: #fff;
  }

  small {
    overflow: hidden;
    font-size: 10.5px;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: rgba(255, 255, 255, 0.78);
  }
}

@media (prefers-reduced-motion: no-preference) {
  .playlist-card:active {
    transform: scale(0.97);
    transition: transform 120ms var(--m-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
  }
}
</style>
