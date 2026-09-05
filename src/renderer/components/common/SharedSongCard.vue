<template>
  <Transition name="card-pop">
    <div v-if="visible" class="shared-card-overlay" @click.self="dismiss">
      <div class="shared-card">
        <!-- 封面 -->
        <div class="cover-wrap">
          <img v-if="coverUrl" :src="coverUrl" alt="" class="cover" crossorigin="anonymous" />
          <div v-else class="cover placeholder">
            <i v-if="loading" class="ri-loader-4-line spinning" />
            <i v-else :class="kindIcon" />
          </div>
          <div class="kind-tag">{{ kindLabel }}</div>
          <button class="card-close" aria-label="关闭" @click="dismiss">
            <i class="ri-close-line" />
          </button>
        </div>

        <!-- 信息 -->
        <div class="meta">
          <div class="meta-label">{{ metaLabel }}</div>
          <div class="title">{{ title || '加载中' }}</div>
          <div class="subtitle">{{ subtitleText }}</div>
          <div v-if="statsText" class="stats">{{ statsText }}</div>
        </div>

        <!-- 曲目列表（歌单/专辑） -->
        <div v-if="tracks.length" class="tracks">
          <div v-for="(track, i) in tracks" :key="i" class="track">
            <div class="track-no">{{ i + 1 }}</div>
            <div class="track-body">
              <div class="track-name">{{ track.name }}</div>
              <div class="track-artist">{{ track.artist }}</div>
            </div>
          </div>
          <div v-if="trackMore > 0" class="tracks-more">
            还有 {{ trackMore }} 首，播放后查看全部
          </div>
        </div>

        <!-- 动作 -->
        <div class="actions">
          <button class="btn btn-primary" :disabled="loading || !playable" @click="handlePlay">
            <i v-if="loading" class="ri-loader-4-line spinning" />
            <span v-else class="btn-inner"><i class="ri-play-fill" />{{ primaryLabel }}</span>
          </button>
          <button v-if="collectionId" class="btn btn-secondary" @click="openCollectionPage">
            <i class="ri-arrow-right-line" /><span>查看完整{{ kindLabel }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';

import { getAlbumDetail, getMusicDetail, getPlaylistDetail } from '@/api/music';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';
import { resetLastHandledUrl } from '@/utils/deepLink';

type CardKind = 'song' | 'playlist' | 'album';
type CollectionKind = 'playlist' | 'album';
interface TrackRow {
  name: string;
  artist: string;
}

const router = useRouter();
const visible = ref(false);
const loading = ref(false);
const kind = ref<CardKind>('song');
const song = ref<SongResult | null>(null);
const title = ref('');
const subtitleText = ref('');
const statsText = ref('');
const coverUrl = ref('');
const tracks = ref<TrackRow[]>([]);
const trackMore = ref(0);
const collectionId = ref<number | null>(null);
const collectionSongs = ref<SongResult[]>([]);

let currentTarget = '';
let historyPushed = false;
let totalTrackCount = 0;

const kindLabel = computed(() =>
  kind.value === 'song' ? '歌曲' : kind.value === 'album' ? '专辑' : '歌单'
);
const kindIcon = computed(() =>
  kind.value === 'song'
    ? 'ri-music-2-fill'
    : kind.value === 'album'
      ? 'ri-album-fill'
      : 'ri-disc-fill'
);
const metaLabel = computed(() =>
  kind.value === 'song'
    ? '发现一首分享歌曲'
    : kind.value === 'album'
      ? '发现一张分享专辑'
      : '发现一份分享歌单'
);
const primaryLabel = computed(() => (kind.value === 'song' ? '播放' : '播放全部'));
const playable = computed(() =>
  kind.value === 'song' ? Boolean(song.value) : collectionSongs.value.length > 0
);

function beginSession(target: string) {
  if (target === currentTarget && visible.value) return;
  currentTarget = target;
  loading.value = true;
  visible.value = true;
  kind.value = 'song';
  song.value = null;
  title.value = '';
  subtitleText.value = '';
  statsText.value = '';
  coverUrl.value = '';
  tracks.value = [];
  trackMore.value = 0;
  collectionId.value = null;
  collectionSongs.value = [];
  totalTrackCount = 0;

  // pushState 让返回手势可以关闭卡片
  if (!historyPushed) {
    historyPushed = true;
    history.pushState({ sharedCard: true }, '');
  }
}

/** 歌曲：加载详情 */
async function showSongCard(songId: number) {
  beginSession(`song-${songId}`);
  try {
    const res = await getMusicDetail([songId]);
    const detail = res?.data?.songs?.[0] as SongResult | undefined;
    if (!detail) {
      console.warn('[SharedSongCard] 未找到歌曲, id:', songId);
      dismiss();
      return;
    }
    kind.value = 'song';
    song.value = detail;
    title.value = detail.name || '未知歌曲';
    subtitleText.value = (detail.ar || detail.artists || []).map((a: any) => a.name).join(' / ');
    coverUrl.value =
      detail.al?.picUrl || detail.album?.picUrl
        ? getImgUrl(detail.al?.picUrl || detail.album?.picUrl, '400y400')
        : '';
  } catch (err) {
    console.error('[SharedSongCard] 加载歌曲详情失败:', err);
    dismiss();
  } finally {
    loading.value = false;
  }
}

/** 歌单/专辑：加载合集信息 + 前 5 首曲目 */
async function showCollectionCard(kindArg: CollectionKind, id: number) {
  beginSession(`${kindArg}-${id}`);
  kind.value = kindArg;
  collectionId.value = id;
  const isAlbum = kindArg === 'album';
  try {
    let desc = '';
    let firstSongs: SongResult[] = [];
    if (isAlbum) {
      const res = await getAlbumDetail(String(id));
      const album = res?.data?.album;
      if (!album) throw new Error('未找到专辑');
      title.value = album.name || '未知专辑';
      subtitleText.value = album.artist?.name || '未知歌手';
      statsText.value = res?.data?.songs?.length ? `${res.data.songs.length} 首` : '';
      desc = (album.description || '').trim();
      coverUrl.value = album.picUrl ? getImgUrl(album.picUrl, '400y400') : '';
      firstSongs = (res?.data?.songs || []) as SongResult[];
      totalTrackCount = firstSongs.length;
    } else {
      const detail = await getPlaylistDetail(String(id));
      const pl = detail?.playlist;
      if (!pl) throw new Error('未找到歌单');
      title.value = pl.name || '未知歌单';
      subtitleText.value = pl.creator?.nickname || '未知创建者';
      const total = (pl.trackIds || []).length;
      statsText.value = total ? `${total} 首` : '';
      desc = (pl.description || '').trim();
      coverUrl.value = pl.coverImgUrl ? getImgUrl(pl.coverImgUrl, '400y400') : '';
      const ids = (pl.trackIds || []).slice(0, 5).map((t: any) => t.id);
      if (ids.length) {
        const res = await getMusicDetail(ids);
        firstSongs = (res?.data?.songs || []) as SongResult[];
      }
      totalTrackCount = total;
    }

    if (desc) {
      const compact = desc.replace(/\s+/g, ' ');
      statsText.value = statsText.value
        ? `${statsText.value} · ${compact.slice(0, 40)}`
        : compact.slice(0, 40);
    }
    tracks.value = firstSongs.slice(0, 5).map((s) => ({
      name: s.name || '',
      artist: (s.ar || s.artists || []).map((a: any) => a.name).join(' / ')
    }));
    trackMore.value = Math.max(0, totalTrackCount - tracks.value.length);
    collectionSongs.value = firstSongs;
  } catch (err) {
    console.error('[SharedSongCard] 加载合集失败:', err);
    dismiss();
  } finally {
    loading.value = false;
  }
}

/** 播放 */
async function handlePlay() {
  if (loading.value) return;
  loading.value = true;
  try {
    const playerStore = usePlayerStore();
    if (kind.value === 'song' && song.value) {
      const raw = song.value;
      const playableSong = {
        ...raw,
        picUrl: raw.al?.picUrl || raw.album?.picUrl || raw.picUrl || ''
      } as SongResult;
      playerStore.setPlayList([playableSong], false);
      playerStore.setPlay(playableSong);
    } else if (collectionSongs.value.length) {
      const normalized = collectionSongs.value.map((s) => ({
        ...s,
        picUrl: s.al?.picUrl || s.album?.picUrl || s.picUrl || ''
      }));
      playerStore.setPlayList(normalized, false);
      playerStore.setPlay(normalized[0]);
    } else {
      return;
    }
    playerStore.setMusicFull(true);
    dismiss();
  } catch (err) {
    console.error('[SharedSongCard] 播放失败:', err);
  } finally {
    loading.value = false;
  }
}

/** 打开完整歌单/专辑页 */
function openCollectionPage() {
  if (!collectionId.value) return;
  const id = collectionId.value;
  dismiss();
  router.push({
    path: `/music-list/${id}`,
    query: { type: kind.value, id: String(id) }
  });
}

function dismiss() {
  visible.value = false;
  currentTarget = '';

  // 重置去重标记，允许同一链接再次被处理
  resetLastHandledUrl();

  // 清理 pushState 的历史条目
  if (historyPushed) {
    historyPushed = false;
    history.back();
  }

  setTimeout(() => {
    song.value = null;
    title.value = '';
    subtitleText.value = '';
    statsText.value = '';
    coverUrl.value = '';
    tracks.value = [];
    collectionSongs.value = [];
    collectionId.value = null;
  }, 300);
}

// 监听 popstate（返回手势关闭卡片）
function onPopState() {
  if (historyPushed && visible.value) {
    historyPushed = false;
    visible.value = false;
    currentTarget = '';
    resetLastHandledUrl();
    setTimeout(() => {
      song.value = null;
      tracks.value = [];
    }, 300);
  }
}

window.addEventListener('popstate', onPopState);

onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPopState);
});

defineExpose({ showSongCard, showCollectionCard });
</script>

<style scoped>
/* 与中继页（relay.html）统一的玻璃卡片设计语言 */
.shared-card-overlay {
  position: fixed;
  inset: 0;
  z-index: 100001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px;
  background: rgba(8, 9, 12, 0.62);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: auto;
}

.shared-card {
  width: 100%;
  max-width: 352px;
  max-height: calc(100dvh - 64px);
  display: flex;
  flex-direction: column;
  border-radius: 22px;
  background: rgba(22, 24, 30, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(28px) saturate(160%);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 24px 70px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.cover-wrap {
  position: relative;
  flex: none;
}

.cover {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
  background: rgba(255, 255, 255, 0.05);
}

.cover.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 42px;
}

.kind-tag {
  position: absolute;
  left: 14px;
  bottom: 14px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 5px 11px;
  border-radius: 999px;
}

.card-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: none;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: rgba(255, 255, 255, 0.8);
  font-size: 17px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 120ms ease-out;
}

.card-close:active {
  transform: scale(0.9);
}

.meta {
  padding: 16px 18px 4px;
}

.meta-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 6px;
}

.title {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.25;
  color: rgba(255, 255, 255, 0.95);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.subtitle {
  margin-top: 5px;
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.62);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stats {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tracks {
  padding: 8px 18px 0;
  overflow-y: auto;
}

.track {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 8px 0;
}

.track + .track {
  border-top: 1px solid rgba(255, 255, 255, 0.055);
}

.track-no {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.4);
  font-variant-numeric: tabular-nums;
  width: 18px;
  flex: none;
  text-align: right;
}

.track-body {
  min-width: 0;
}

.track-name {
  font-size: 13.5px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artist {
  margin-top: 1px;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tracks-more {
  padding: 8px 0 4px;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.36);
  text-align: center;
}

.actions {
  padding: 14px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: auto;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  height: 46px;
  border: none;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  text-decoration: none;
  transition:
    transform 120ms ease-out,
    filter 160ms ease;
}

.btn:active {
  transform: scale(0.975);
}

.btn-primary {
  background: var(--accent-color, #d4a056);
  color: #14151a;
}

.btn-primary:hover {
  filter: brightness(1.06);
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: default;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.09);
  border: 1px solid rgba(255, 255, 255, 0.13);
  color: rgba(255, 255, 255, 0.9);
}

.btn-inner {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Transition: scale + fade（spring 近似曲线） */
.card-pop-enter-active,
.card-pop-leave-active {
  transition: opacity 0.32s cubic-bezier(0.32, 0.72, 0, 1);
}

.card-pop-enter-active .shared-card,
.card-pop-leave-active .shared-card {
  transition:
    transform 0.42s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.32s cubic-bezier(0.32, 0.72, 0, 1);
}

.card-pop-enter-from,
.card-pop-leave-to {
  opacity: 0;
}

.card-pop-enter-from .shared-card,
.card-pop-leave-to .shared-card {
  transform: translateY(14px) scale(0.96);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .card-pop-enter-active,
  .card-pop-leave-active,
  .card-pop-enter-active .shared-card,
  .card-pop-leave-active .shared-card {
    transition: opacity 0.2s ease;
  }

  .card-pop-enter-from .shared-card,
  .card-pop-leave-to .shared-card {
    transform: none;
  }

  .spinning {
    animation-duration: 1.6s;
  }
}
</style>
