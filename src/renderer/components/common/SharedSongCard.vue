<template>
  <Transition name="card-slide">
    <div v-if="visible" class="shared-song-card-wrap" @click.self="dismiss">
      <div class="shared-song-card">
        <!-- Close button -->
        <button class="card-close" @click="dismiss">
          <i class="ri-close-line" />
        </button>

        <!-- Cover -->
        <div class="card-cover-wrap">
          <img
            v-if="song?.al?.picUrl || song?.album?.picUrl"
            :src="getImgUrl(song?.al?.picUrl || song?.album?.picUrl, '300y300')"
            alt=""
            class="card-cover"
          />
          <div v-else class="card-cover-placeholder">
            <i v-if="loading" class="ri-loader-4-line spinning" />
            <i v-else class="ri-music-2-fill" />
          </div>
        </div>

        <!-- Info -->
        <div class="card-info">
          <span class="card-label">
            <i class="ri-share-forward-line" />
            发现一首分享歌曲
          </span>
          <h3 class="card-title">{{ song?.name || '加载中' }}</h3>
          <p class="card-artist">{{ artistText || ' ' }}</p>
        </div>

        <!-- Actions -->
        <button class="card-play" :disabled="loading || !song" @click="handlePlay">
          <i v-if="loading" class="ri-loader-4-line spinning" />
          <span v-else class="card-play-inner">
            <i class="ri-play-fill" />
            <span>播放</span>
          </span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

import { getMusicDetail } from '@/api/music';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';
import { resetLastHandledUrl } from '@/utils/deepLink';

const visible = ref(false);
const loading = ref(false);
const song = ref<SongResult | null>(null);
const artistText = ref('');

let currentSongId: number | null = null;
let historyPushed = false;

/**
 * 通过歌曲 ID 加载详情并显示卡片
 */
async function showSongCard(songId: number) {
  if (songId === currentSongId && visible.value) return;
  currentSongId = songId;
  loading.value = true;
  visible.value = true;
  song.value = null;
  artistText.value = '';

  // pushState 让返回手势可以关闭卡片
  if (!historyPushed) {
    historyPushed = true;
    history.pushState({ sharedCard: true }, '');
  }

  try {
    const res = await getMusicDetail([songId]);
    const detail = res?.data?.songs?.[0] as SongResult | undefined;
    if (!detail) {
      console.warn('[SharedSongCard] 未找到歌曲, id:', songId);
      dismiss();
      return;
    }
    song.value = detail;
    const artists = detail.ar || detail.artists || [];
    artistText.value = artists.map((a: any) => a.name).join(' / ') || '未知歌手';
  } catch (err) {
    console.error('[SharedSongCard] 加载歌曲详情失败:', err);
    dismiss();
  } finally {
    loading.value = false;
  }
}

/**
 * 播放当前歌曲
 */
async function handlePlay() {
  if (!song.value) return;
  loading.value = true;
  try {
    const playerStore = usePlayerStore();
    // 确保 picUrl 在顶层（播放器 UI 和封面取色依赖）
    const raw = song.value;
    const playableSong = {
      ...raw,
      picUrl: raw.al?.picUrl || raw.album?.picUrl || raw.picUrl || ''
    } as SongResult;
    playerStore.setPlayList([playableSong], false);
    playerStore.setPlay(playableSong);
    playerStore.setMusicFull(true);
    dismiss();
  } catch (err) {
    console.error('[SharedSongCard] 播放失败:', err);
  } finally {
    loading.value = false;
  }
}

function dismiss() {
  visible.value = false;
  currentSongId = null;

  // 重置去重标记，允许同一链接再次被处理
  resetLastHandledUrl();

  // 清理 pushState 的历史条目
  if (historyPushed) {
    historyPushed = false;
    history.back();
  }

  setTimeout(() => {
    song.value = null;
    artistText.value = '';
  }, 300);
}

// 监听 popstate（返回手势关闭卡片）
function onPopState() {
  if (historyPushed && visible.value) {
    historyPushed = false;
    visible.value = false;
    currentSongId = null;
    resetLastHandledUrl();
    setTimeout(() => {
      song.value = null;
      artistText.value = '';
    }, 300);
  }
}

window.addEventListener('popstate', onPopState);

onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPopState);
});

defineExpose({ showSongCard });
</script>

<style scoped>
.shared-song-card-wrap {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  pointer-events: auto;
}

.shared-song-card {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 20px;
  border-radius: 20px;
  background: rgba(28, 28, 32, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.card-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.5);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s,
    transform 0.15s;
  z-index: 1;
}

.card-close:active {
  transform: scale(0.9);
}

.card-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
}

.card-cover-wrap {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 14px;
  overflow: hidden;
  position: relative;
  background: rgba(255, 255, 255, 0.06);
  margin-bottom: 16px;
}

.card-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 40px;
}

.card-info {
  width: 100%;
  margin-bottom: 20px;
}

.card-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 6px;
}

.card-title {
  font-size: 18px;
  font-weight: 700;
  color: #f5f5f7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
  line-height: 1.3;
}

.card-artist {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 4px 0 0;
  line-height: 1.3;
}

.card-play {
  width: 100%;
  height: 48px;
  border-radius: 999px;
  border: none;
  background: var(--accent-color, #d4a056);
  color: #1a1a1c;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    transform 0.15s,
    opacity 0.2s;
}

.card-play-inner {
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-play:active {
  transform: scale(0.97);
}

.card-play:disabled {
  opacity: 0.4;
  cursor: default;
}

.card-play .spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Transition: scale + fade */
.card-slide-enter-active,
.card-slide-leave-active {
  transition: opacity 0.3s;
}

.card-slide-enter-active .shared-song-card,
.card-slide-leave-active .shared-song-card {
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.3s;
}

.card-slide-enter-from,
.card-slide-leave-to {
  opacity: 0;
}

.card-slide-enter-from .shared-song-card,
.card-slide-leave-to .shared-song-card {
  transform: scale(0.9);
  opacity: 0;
}
</style>
