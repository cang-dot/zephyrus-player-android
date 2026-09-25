<script setup lang="ts">
/** 为你推荐：精选歌单 2×2 网格卡（封面 + 底部渐变 + 歌单名 + 小字），无「更多」入口 */
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { getPersonalizedPlaylist } from '@/api/home';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import { beginReturnFlight } from '@/composables/usePlaylistOpenTransition';
import { getImgUrl } from '@/utils';

interface RecommendedPlaylist {
  id: number | string;
  name: string;
  picUrl?: string;
  copywriter?: string;
}

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const playlists = ref<RecommendedPlaylist[]>([]);

function open(item: RecommendedPlaylist, event?: MouseEvent) {
  // 与歌单库页同一套封面飞行：记录卡片封面矩形（+key），歌单页 hero 从该处飞入
  const el = event?.currentTarget as HTMLElement | null;
  const cover = el?.querySelector<HTMLElement>('.playlist-cover');
  const rect = (cover ?? el)?.getBoundingClientRect();
  if (rect && rect.width > 0) {
    try {
      sessionStorage.setItem(
        'musicListCoverRect',
        JSON.stringify({
          x: rect.x,
          y: rect.y,
          w: rect.width,
          h: rect.height,
          key: `home-pl-${item.id}`
        })
      );
    } catch {
      /* ignore */
    }
  }
  // 同一套预填充：写好列表信息，歌单页 hero 首帧即可渲染（无骨架）
  navigateToMusicList(router, {
    id: item.id,
    type: 'playlist',
    name: item.name,
    listInfo: item
  });
}

/** 返回主页时：消费歌单页写入的返回矩形，用覆盖层克隆把封面从 hero 飞回卡片
 *  （fixed 层不受 .playlist-card 的 overflow:hidden 与外层滚动容器裁剪） */
watch(
  () => route.path,
  (path) => {
    if (path !== '/') return;
    window.setTimeout(() => {
      const raw = sessionStorage.getItem('musicListCoverReturn');
      if (!raw) return;
      let payload: {
        x: number;
        y: number;
        w: number;
        h: number;
        key?: string;
        coverUrl?: string;
      };
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }
      if (!payload.key?.startsWith('home-pl-')) return;
      const card = document.querySelector(`.playlist-card[data-key="${CSS.escape(payload.key)}"]`);
      const cover = card?.querySelector<HTMLElement>('.playlist-cover');
      const endRect = cover?.getBoundingClientRect();
      if (!endRect || endRect.width <= 0) return;
      sessionStorage.removeItem('musicListCoverReturn');
      beginReturnFlight({
        heroRect: { x: payload.x, y: payload.y, w: payload.w, h: payload.h },
        endRect: { x: endRect.x, y: endRect.y, w: endRect.width, h: endRect.height },
        coverUrl: payload.coverUrl
      });
    }, 60);
  }
);

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
        :data-key="`home-pl-${item.id}`"
        @click="open(item, $event)"
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
