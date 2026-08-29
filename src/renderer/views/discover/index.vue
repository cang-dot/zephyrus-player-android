<template>
  <div class="discover-page">
    <nav class="discover-shortcuts" aria-label="发现快捷入口">
      <button v-for="item in shortcuts" :key="item.key" type="button" @click="openShortcut(item)">
        <i :class="item.icon" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <section ref="artistsSection" class="discover-section">
      <div class="section-heading">
        <h2>推荐歌手</h2>
        <button type="button" @click="openArtistDirectory">更多</button>
      </div>
      <div v-if="artistsLoading" class="artist-rail" data-horizontal-scroll>
        <div v-for="i in 4" :key="i" class="artist-card discover-skeleton" />
      </div>
      <div v-else-if="artists.length" class="artist-rail" data-horizontal-scroll>
        <button
          v-for="artist in artists"
          :key="artist.id"
          type="button"
          class="artist-card"
          @click="navigateToArtist(artist.id)"
        >
          <img :src="getImgUrl(artist.picUrl, '500y500')" :alt="artist.name" loading="lazy" />
          <span class="artist-card-copy"
            ><strong>{{ artist.name }}</strong
            ><small>{{ artist.briefDesc || '音乐人' }}</small></span
          >
        </button>
      </div>
      <p v-else class="discover-empty">暂无推荐歌手</p>
    </section>

    <section class="discover-section">
      <div class="section-heading">
        <h2>为你推荐</h2>
        <button type="button" @click="router.push('/album')">更多</button>
      </div>
      <div v-if="mediaLoading" class="media-grid">
        <div v-for="i in 4" :key="i" class="media-card discover-skeleton" />
      </div>
      <div v-else-if="mediaCards.length" class="media-grid">
        <button
          v-for="card in mediaCards"
          :key="card.key"
          type="button"
          class="media-card"
          :style="{ '--media-color': card.themeColor }"
          @click="openMedia(card)"
        >
          <span class="media-card-art">
            <img :src="getImgUrl(card.picUrl, '500y500')" :alt="card.name" loading="lazy" />
          </span>
          <span class="media-card-copy"
            ><strong>{{ card.name }}</strong
            ><small>{{ card.copy }}</small></span
          >
        </button>
      </div>
      <p v-else class="discover-empty">暂无推荐内容</p>
    </section>
    <div class="discover-bottom-spacer" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">

defineOptions({ name: 'Discover' });
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { getHotSinger, getPersonalizedPlaylist, getTopAlbum } from '@/api/home';
import { useArtist } from '@/hooks/useArtist';
import { getImgUrl } from '@/utils';

type Shortcut = { key: string; label: string; icon: string; path?: string; target?: string };
type MediaCard = {
  key: string;
  id: number;
  kind: 'playlist' | 'album';
  name: string;
  picUrl: string;
  copy: string;
  themeColor: string;
};

const router = useRouter();
const { navigateToArtist } = useArtist();
const artistsSection = ref<HTMLElement | null>(null);
const artists = ref<any[]>([]);
const mediaCards = ref<MediaCard[]>([]);
const artistsLoading = ref(true);
const mediaLoading = ref(true);

const shortcuts: Shortcut[] = [
  { key: 'toplist', path: '/toplist', icon: 'ri-bar-chart-grouped-fill', label: '榜单' },
  { key: 'artists', target: 'artists', icon: 'ri-mic-fill', label: '歌手' },
  { key: 'genre', path: '/discover/genre', icon: 'ri-music-2-fill', label: '曲风' },
  { key: 'new', path: '/album', icon: 'ri-album-fill', label: '新歌新碟' },
  { key: 'listen', path: '/discover/listen', icon: 'ri-book-open-fill', label: '听书' }
];

const openShortcut = (item: Shortcut) => {
  if (item.target === 'artists') {
    artistsSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (item.path) {
    router.push(item.path);
  }
};

const openMedia = (card: MediaCard) => {
  router.push({
    path: `/music-list/${card.id}`,
    query: { type: card.kind }
  });
};

const openArtistDirectory = () => {
  router.push({ path: '/mobile-search-result', query: { keyword: '热门歌手', type: 100 } });
};

const fallbackCardColor = (seed: string) => {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 24% 38%)`;
};

const sampleCoverColor = async (card: MediaCard) => {
  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = getImgUrl(card.picUrl, '50y50');
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('cover color failed'));
    });
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0, 8, 8);
    const pixels = context.getImageData(0, 0, 8, 8).data;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      r += pixels[index];
      g += pixels[index + 1];
      b += pixels[index + 2];
    }
    const count = pixels.length / 4;
    card.themeColor = `rgb(${Math.round(r / count)} ${Math.round(g / count)} ${Math.round(b / count)})`;
  } catch {
    // Keep the deterministic low-saturation fallback when CORS blocks sampling.
  }
};

onMounted(async () => {
  const [artistResult, playlistResult, albumResult] = await Promise.allSettled([
    getHotSinger({ offset: 0, limit: 12 }),
    getPersonalizedPlaylist(12),
    getTopAlbum({ limit: 8 })
  ]);
  if (artistResult.status === 'fulfilled' && artistResult.value.data?.artists) {
    artists.value = artistResult.value.data.artists.slice(0, 12);
  }
  artistsLoading.value = false;
  const playlists =
    playlistResult.status === 'fulfilled' ? playlistResult.value.data?.result || [] : [];
  const albums = albumResult.status === 'fulfilled' ? albumResult.value.data?.albums || [] : [];
  mediaCards.value = [
    ...playlists.map((item: any) => ({
      key: `playlist-${item.id}`,
      id: item.id,
      kind: 'playlist' as const,
      name: item.name,
      picUrl: item.picUrl,
      copy: item.copywriter || item.description || '精选歌单',
      themeColor: fallbackCardColor(item.name || String(item.id))
    })),
    ...albums.map((item: any) => ({
      key: `album-${item.id}`,
      id: item.id,
      kind: 'album' as const,
      name: item.name,
      picUrl: item.picUrl,
      copy: item.artist?.name || '新专辑',
      themeColor: fallbackCardColor(item.name || String(item.id))
    }))
  ].slice(0, 12);
  void Promise.all(mediaCards.value.map(sampleCoverColor));
  mediaLoading.value = false;
});
</script>

<style scoped lang="scss">
.discover-page {
  min-height: 100%;
  padding: calc(var(--safe-area-inset-top, 0px) + 72px) 16px
    calc(var(--mobile-dock-content-inset, 132px) + var(--safe-area-inset-bottom, 0px) + 240px);
  color: var(--m-text-primary, var(--text-color));
}
.discover-shortcuts {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
  margin: 0 0 26px;
}
.discover-shortcuts button {
  display: grid;
  place-items: center;
  gap: 7px;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 11px;
}
.discover-shortcuts i {
  color: color-mix(in srgb, var(--accent-color) 62%, #8390c7);
  font-size: 25px;
}
.discover-section {
  margin-top: 25px;
  scroll-margin-top: calc(var(--safe-area-inset-top, 0px) + 76px);
}
.discover-bottom-spacer {
  width: 100%;
  height: calc(
    var(--mobile-dock-content-inset, 132px) + var(--safe-area-inset-bottom, 0px) + 280px
  );
  flex: 0 0 auto;
}
.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-heading h2 {
  margin: 0;
  font-size: 21px;
  font-weight: 750;
}
.section-heading button {
  border: 0;
  background: transparent;
  color: var(--m-text-secondary);
  font-size: 12px;
}
.artist-rail {
  display: flex;
  width: calc(100% + 32px);
  gap: 12px;
  margin-inline: -16px;
  overflow-x: auto;
  padding: 0 0 8px;
  scrollbar-width: none;
  scroll-snap-type: x proximity;
  touch-action: pan-x;
  overscroll-behavior-x: contain;
}
.artist-rail::-webkit-scrollbar {
  display: none;
}
.artist-card {
  position: relative;
  flex: 0 0 min(58vw, 230px);
  aspect-ratio: 0.78;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: 22px;
  background: var(--m-surface);
  color: #fff;
  scroll-snap-align: start;
  text-align: left;
}
.artist-card img,
.media-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.artist-card::after,
.media-card::after {
  position: absolute;
  inset: 35% 0 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.78));
  content: '';
}
.artist-card-copy,
.media-card-copy {
  position: absolute;
  right: 14px;
  bottom: 13px;
  left: 14px;
  z-index: 1;
  display: grid;
  gap: 4px;
}
.artist-card-copy strong,
.media-card-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 17px;
}
.artist-card-copy small,
.media-card-copy small {
  display: -webkit-box;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.78);
  font-size: 11px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.media-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.media-card {
  position: relative;
  min-width: 0;
  aspect-ratio: 1.55;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: 20px;
  background: var(--media-color, var(--m-surface));
  color: #fff;
  text-align: left;
  isolation: isolate;
}
.media-card::before {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--media-color) 88%, #121214) 0 34%,
    color-mix(in srgb, var(--media-color) 68%, transparent) 55%,
    transparent 78%
  );
  content: '';
}
.media-card::after {
  inset: 48% 0 0;
  z-index: 2;
}
.media-card-art {
  position: absolute;
  inset: 0 0 0 38%;
  display: block;
}
.media-card-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.media-card-copy {
  right: 40%;
  z-index: 3;
}
.media-card-copy strong {
  font-size: 14px;
}
.discover-empty {
  color: var(--m-text-muted);
}
.discover-skeleton {
  background: linear-gradient(
    100deg,
    color-mix(in srgb, var(--m-surface) 78%, transparent) 25%,
    color-mix(in srgb, var(--m-text-primary) 8%, var(--m-surface)) 44%,
    color-mix(in srgb, var(--m-surface) 78%, transparent) 63%
  );
  background-size: 220% 100%;
  animation: discover-skeleton 1.35s ease-in-out infinite;
}
.discover-skeleton::before,
.discover-skeleton::after {
  display: none;
}
@keyframes discover-skeleton {
  to {
    background-position: -120% 0;
  }
}
@media (max-width: 360px) {
  .discover-shortcuts {
    gap: 2px;
  }
  .discover-shortcuts i {
    font-size: 22px;
  }
  .artist-card {
    flex-basis: 64vw;
  }
}
</style>
