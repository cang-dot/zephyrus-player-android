<template>
  <Teleport to="body">
    <Transition name="ai-playlist-fade">
      <div v-if="visible" class="ai-playlist-overlay" @click.self="close">
        <div class="ai-playlist-panel no-toggle" @pointerdown.stop @pointerup.stop @click.stop>
          <header class="panel-header">
            <h3><i class="ri-magic-line"></i> AI 歌单</h3>
            <button type="button" class="panel-close" @click="close">
              <i class="ri-close-line"></i>
            </button>
          </header>

          <!-- 策略选择 -->
          <div class="strategy-row">
            <button
              type="button"
              class="strategy-chip"
              :class="{ active: strategy === 'favorites' }"
              :disabled="busy"
              @click="strategy = 'favorites'"
            >
              <i class="ri-heart-3-line"></i> 按最近收藏联想
            </button>
            <button
              type="button"
              class="strategy-chip"
              :class="{ active: strategy === 'followed-artists' }"
              :disabled="busy"
              @click="strategy = 'followed-artists'"
            >
              <i class="ri-user-star-line"></i> 按关注的音乐人
            </button>
          </div>

          <!-- 生成中 -->
          <div v-if="busy" class="stage-box">
            <i class="ri-loader-4-line spinning"></i>
            <span>{{ stage || '正在生成…' }}</span>
          </div>

          <!-- 错误 -->
          <p v-else-if="error" class="stage-box error">{{ error }}</p>

          <!-- 结果 -->
          <template v-else-if="result">
            <p v-if="result.rationale" class="rationale">{{ result.rationale }}</p>
            <p class="result-meta">
              已匹配 {{ result.songs.length }} 首<template v-if="result.skipped">
                · {{ result.skipped }} 首未在曲库找到</template
              >
            </p>
            <div class="result-list">
              <label
                v-for="song in result.songs"
                :key="String(song.id)"
                class="result-row"
                :class="{ excluded: excludedIds.has(String(song.id)) }"
              >
                <input
                  type="checkbox"
                  :checked="!excludedIds.has(String(song.id))"
                  @change="toggleSong(String(song.id))"
                />
                <div class="result-copy">
                  <span class="result-name">{{ song.name }}</span>
                  <span class="result-artist">{{
                    (song.ar || song.artists || []).map((a) => a.name).join(' / ')
                  }}</span>
                </div>
              </label>
            </div>

            <div class="action-row">
              <button type="button" class="action-btn" @click="playResult">
                <i class="ri-play-fill"></i> 播放
              </button>
              <button
                type="button"
                class="action-btn primary"
                :disabled="saving || !selectedSongs.length"
                @click="saveToCloud"
              >
                <i class="ri-cloud-line"></i>
                {{ saving ? '保存中…' : '保存为云端歌单' }}
              </button>
            </div>
          </template>

          <!-- 初始态 -->
          <p v-else class="hint">
            选择一种策略，AI 会结合{{ strategy === 'favorites' ? '你最近收藏的 50 首' : '你关注的音乐人' }}为你挑一份新歌单。
          </p>

          <footer class="panel-footer">
            <button type="button" class="generate-btn" :disabled="busy" @click="generate">
              {{ busy ? '生成中…' : result ? '重新生成' : '生成歌单' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { createPlaylist, updatePlaylistTracks } from '@/api/music';
import {
  generateAiPlaylist,
  type AiPlaylistResult,
  type AiPlaylistStrategy
} from '@/features/ai/aiPlaylist';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import { usePlayerStore } from '@/store/modules/player';

const visible = defineModel<boolean>({ type: Boolean, default: false });

const router = useRouter();
const message = useMessage();
const playerStore = usePlayerStore();

const strategy = ref<AiPlaylistStrategy>('favorites');
const busy = ref(false);
const stage = ref('');
const error = ref('');
const result = ref<AiPlaylistResult | null>(null);
const excludedIds = reactive(new Set<string>());
const saving = ref(false);

const selectedSongs = computed(() =>
  (result.value?.songs || []).filter((song) => !excludedIds.has(String(song.id)))
);

function toggleSong(id: string) {
  if (excludedIds.has(id)) excludedIds.delete(id);
  else excludedIds.add(id);
}

function close() {
  visible.value = false;
}

async function generate() {
  busy.value = true;
  error.value = '';
  result.value = null;
  excludedIds.clear();
  try {
    result.value = await generateAiPlaylist(strategy.value, {
      onProgress: (stageText) => (stage.value = stageText)
    });
  } catch (err: any) {
    error.value = err?.message || '生成失败，请重试';
  } finally {
    busy.value = false;
    stage.value = '';
  }
}

function playResult() {
  const songs = selectedSongs.value;
  if (!songs.length) return;
  const name =
    strategy.value === 'favorites' ? 'AI 歌单 · 风格联想' : 'AI 歌单 · 关注音乐人';
  navigateToMusicList(router, {
    songList: songs as any,
    name,
    type: 'aiPlaylist'
  });
  playerStore.setPlayList(songs as any, false);
  playerStore.setMusicFull(false);
  close();
}

async function saveToCloud() {
  const songs = selectedSongs.value;
  if (!songs.length) return;
  // 只有网易云歌曲 id 可以写入云端歌单
  const neteaseIds = songs.map((song) => String(song.id)).filter((id) => /^\d+$/.test(id));
  if (!neteaseIds.length) {
    message.error('所选歌曲均非网易云来源，无法保存为云端歌单');
    return;
  }
  saving.value = true;
  try {
    const name = `AI 歌单 · ${new Date().getMonth() + 1}月${new Date().getDate()}日`;
    const created = await createPlaylist({ name, privacy: 0 });
    const pid = created.data?.data?.id || created.data?.playlist?.id;
    if (!pid) throw new Error('创建歌单失败');
    for (let i = 0; i < neteaseIds.length; i += 500) {
      const response = await updatePlaylistTracks({
        op: 'add',
        pid: Number(pid),
        tracks: neteaseIds.slice(i, i + 500).join(',')
      });
      if (response.status !== 200) throw new Error(response.data?.message || '写入歌曲失败');
    }
    message.success(
      `已创建「${name}」并写入 ${neteaseIds.length} 首` +
        (songs.length > neteaseIds.length ? `（${songs.length - neteaseIds.length} 首非网易云歌曲未包含）` : '')
    );
  } catch (err: any) {
    message.error(err?.message || '保存云端歌单失败');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped lang="scss">
.ai-playlist-overlay {
  position: fixed;
  inset: 0;
  z-index: 100200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.ai-playlist-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 520px;
  max-height: 76dvh;
  padding: 16px 18px calc(18px + var(--safe-area-inset-bottom, 0px));
  overflow: hidden;
  border-radius: 22px 22px 0 0;
  background: var(--m-glass-bg, rgba(24, 24, 28, 0.94));
  color: var(--m-text-primary, #f0ece4);
  backdrop-filter: blur(24px) saturate(160%);
  box-shadow: 0 -18px 48px rgba(0, 0, 0, 0.4);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;

  h3 {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 16px;
    font-weight: 700;
  }
}

.panel-close {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: inherit;
  cursor: pointer;
}

.strategy-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}

.strategy-chip {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;

  &.active {
    border-color: var(--accent-color, #888);
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  &:disabled {
    opacity: 0.5;
  }
}

.stage-box {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 18px 4px;
  color: rgba(255, 255, 255, 0.7);

  &.error {
    color: #f87171;
  }
}

.spinning {
  animation: ai-playlist-spin 0.9s linear infinite;
}

@keyframes ai-playlist-spin {
  to {
    transform: rotate(360deg);
  }
}

.rationale {
  margin-bottom: 10px;
  font-size: 12.5px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.62);
}

.result-meta {
  margin-bottom: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.result-list {
  flex: 1;
  min-height: 0;
  padding-right: 4px;
  overflow-y: auto;
}

.result-row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 6px;
  border-radius: 10px;
  cursor: pointer;

  &.excluded .result-copy {
    opacity: 0.4;
  }

  input {
    accent-color: var(--accent-color, #888);
  }
}

.result-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.result-name {
  overflow: hidden;
  font-size: 13.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-artist {
  overflow: hidden;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 10px;
  margin-top: 12px;
}

.action-btn {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  padding: 11px;
  border: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;

  &.primary {
    background: var(--accent-color, #888);
    color: #141414;
    font-weight: 600;
  }

  &:disabled {
    opacity: 0.5;
  }
}

.hint {
  padding: 14px 4px;
  font-size: 13px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.6);
}

.panel-footer {
  margin-top: 6px;
}

.generate-btn {
  width: 100%;
  padding: 12px;
  border: 0;
  border-radius: 12px;
  background: var(--accent-color, #888);
  color: #141414;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ai-playlist-fade-enter-active,
  .ai-playlist-fade-leave-active {
    transition: opacity 120ms ease;
  }
}
</style>

<style>
.ai-playlist-fade-enter-active,
.ai-playlist-fade-leave-active {
  transition: opacity 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

.ai-playlist-fade-enter-from,
.ai-playlist-fade-leave-to {
  opacity: 0;
}
</style>
