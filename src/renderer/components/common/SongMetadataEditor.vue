<template>
  <Teleport to="body">
    <Transition name="meta-editor-pop">
      <div v-if="show && entry" class="meta-editor-overlay" @click="close">
        <div class="meta-editor-panel" @click.stop>
          <div class="meta-editor-header">
            <span class="meta-editor-title">{{ st('title') }}</span>
            <button type="button" class="meta-close-btn" @click="close">
              <i class="ri-close-line" />
            </button>
          </div>

          <div class="meta-editor-body">
            <div class="meta-cover-row">
              <div class="meta-cover">
                <img v-if="coverPreview" :src="coverPreview" alt="cover" />
                <i v-else class="ri-image-line" />
              </div>
              <label class="meta-change-cover">
                <i class="ri-image-edit-line" />{{ st('changeCover') }}
                <input type="file" accept="image/*" @change="onCoverPicked" />
              </label>
            </div>

            <button
              type="button"
              class="meta-cloud-match"
              :disabled="matching"
              @click="runCloudMatch"
            >
              <i :class="matching ? 'ri-loader-4-line is-spinning' : 'ri-cloud-line'" />
              {{ matching ? st('matching') : st('cloudMatch') }}
            </button>

            <div
              v-if="matchStatus === 'empty' || matchStatus === 'error'"
              class="meta-match-state"
              :class="{ error: matchStatus === 'error' }"
              role="status"
            >
              <i :class="matchStatus === 'error' ? 'ri-cloud-off-line' : 'ri-search-eye-line'" />
              <span>{{ st(matchStatus === 'error' ? 'matchFailed' : 'matchEmpty') }}</span>
            </div>

            <div v-if="matchCandidates.length" class="meta-candidates">
              <button
                v-for="candidate in matchCandidates"
                :key="candidate.id"
                type="button"
                class="meta-candidate"
                @click="applyCandidate(candidate)"
              >
                <div class="meta-candidate-copy">
                  <strong>{{ candidate.name }}</strong>
                  <small>
                    {{ candidate.artists }}
                    <template v-if="candidate.album"> · {{ candidate.album }}</template>
                  </small>
                </div>
                <span v-if="candidate.durationDiffLabel" class="meta-duration-diff">
                  {{ candidate.durationDiffLabel }}
                </span>
              </button>
            </div>

            <label class="meta-field">
              <span>{{ st('fieldTitle') }}</span>
              <input v-model="form.title" type="text" />
            </label>
            <label class="meta-field">
              <span>{{ st('artist') }}</span>
              <input v-model="form.artist" type="text" />
            </label>
            <label class="meta-field">
              <span>{{ st('album') }}</span>
              <input v-model="form.album" type="text" />
            </label>
            <div class="meta-field-row">
              <label class="meta-field">
                <span>{{ st('year') }}</span>
                <input v-model.number="form.year" type="number" min="0" max="9999" />
              </label>
              <label class="meta-field">
                <span>{{ st('track') }}</span>
                <input v-model.number="form.trackNumber" type="number" min="0" max="999" />
              </label>
              <label class="meta-field">
                <span>{{ st('disc') }}</span>
                <input v-model.number="form.diskNumber" type="number" min="0" max="99" />
              </label>
            </div>
            <label class="meta-field">
              <span>{{ st('lyrics') }}</span>
              <textarea v-model="form.lyrics" rows="5" spellcheck="false" />
            </label>
          </div>

          <div class="meta-editor-footer">
            <button type="button" class="meta-save-btn" :disabled="saving" @click="save">
              <i :class="saving ? 'ri-loader-4-line is-spinning' : 'ri-check-line'" />
              {{ saving ? st('saving') : st('save') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { getSearch } from '@/api/search';
import { isLocalSong } from '@/hooks/useLocalMusic';
import {
  isAndroidNative,
  type MetadataWriteResult,
  writeAudioMetadata
} from '@/services/androidNative';
import { useLocalMusicStore } from '@/store/modules/localMusic';
import type { SongResult } from '@/types/music';

const props = defineProps<{
  show: boolean;
  song: SongResult;
}>();

const emit = defineEmits<{ 'update:show': [value: boolean]; saved: [] }>();

const { t } = useI18n();
const st = (key: string) => t(`songItem.metadataEditor.${key}`);
const localMusicStore = useLocalMusicStore();

const entry = computed(() => {
  if (!props.song || !isLocalSong(props.song)) return null;
  return localMusicStore.musicList.find((meta) => meta.id === String(props.song.id)) ?? null;
});

const form = reactive({
  title: '',
  artist: '',
  album: '',
  year: 0,
  trackNumber: 0,
  diskNumber: 0,
  lyrics: ''
});
const coverPreview = ref('');
const coverBase64 = ref('');
const coverMime = ref('image/jpeg');
const saving = ref(false);
const matching = ref(false);
const matchStatus = ref<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');

interface MatchCandidate {
  id: number;
  name: string;
  artists: string;
  album: string;
  durationMs: number;
  picUrl?: string;
  durationDiffLabel: string;
}

const matchCandidates = ref<MatchCandidate[]>([]);

watch(
  () => props.show,
  (show) => {
    if (!show) return;
    const meta = entry.value;
    form.title = meta?.title ?? '';
    form.artist = meta?.artist ?? '';
    form.album = meta?.album ?? '';
    form.year = meta?.year ?? 0;
    form.trackNumber = meta?.trackNumber ?? 0;
    form.diskNumber = meta?.diskNumber ?? 0;
    form.lyrics = meta?.lyrics ?? '';
    coverPreview.value = meta?.cover ?? '';
    coverBase64.value = '';
    matchCandidates.value = [];
    matchStatus.value = 'idle';
  }
);

const close = () => {
  if (saving.value) return;
  emit('update:show', false);
};

/** 从文件名清洗出搜索关键词（无有效标题时使用）。 */
const sanitizeFileName = (name: string) =>
  name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[[【(（].*?[\]】)）]/g, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildMatchKeyword = () => {
  const meta = entry.value;
  if (!meta) return '';
  const fileName = decodeURIComponent(meta.filePath.split('/').pop() || '');
  const hasRealTitle = meta.title && meta.title !== fileName;
  if (!hasRealTitle) return sanitizeFileName(fileName);
  const parts = [meta.title];
  if (meta.artist && meta.artist !== '未知艺术家') parts.push(meta.artist);
  return parts.join(' ');
};

const runCloudMatch = async () => {
  const keyword = buildMatchKeyword();
  if (!keyword || matching.value) return;
  matching.value = true;
  matchStatus.value = 'loading';
  matchCandidates.value = [];
  try {
    const response: any = await getSearch({ keywords: keyword, type: 1, limit: 10 });
    const payload = response?.data ?? response;
    const songs: any[] =
      payload?.result?.songs ?? payload?.songs ?? payload?.data?.result?.songs ?? [];
    const localDuration = entry.value?.duration ?? 0;
    matchCandidates.value = songs
      .map((song) => {
        const artists = (song.ar || song.artists || []).map((a: any) => a.name).join(' / ');
        const durationMs = Number(song.dt ?? song.duration ?? 0);
        const diffSeconds = localDuration ? Math.round((durationMs - localDuration) / 1000) : 0;
        const durationDiffLabel = localDuration
          ? diffSeconds === 0
            ? '±0s'
            : diffSeconds > 0
              ? `+${diffSeconds}s`
              : `${diffSeconds}s`
          : '';
        return {
          id: Number(song.id),
          name: String(song.name || ''),
          artists,
          album: song.al?.name || song.album?.name || '',
          durationMs,
          picUrl: song.al?.picUrl || song.album?.picUrl || '',
          durationDiffLabel
        } satisfies MatchCandidate;
      })
      .filter((candidate) => candidate.name);
    matchStatus.value = matchCandidates.value.length ? 'success' : 'empty';
  } catch (error) {
    console.warn('[MetadataEditor] 云端匹配失败:', error);
    matchStatus.value = 'error';
  } finally {
    matching.value = false;
  }
};

const applyCandidate = async (candidate: MatchCandidate) => {
  form.title = candidate.name;
  if (candidate.artists) form.artist = candidate.artists;
  if (candidate.album) form.album = candidate.album;
  matchCandidates.value = [];
  matchStatus.value = 'idle';
  if (!candidate.picUrl) return;
  try {
    const blob = await (await fetch(candidate.picUrl)).blob();
    const compressed = await compressImage(blob);
    coverBase64.value = compressed.base64;
    coverMime.value = compressed.mime;
    coverPreview.value = compressed.dataUrl;
  } catch (error) {
    console.warn('[MetadataEditor] 封面下载失败:', error);
  }
};

/** 压缩封面为 JPEG（最长边 1000px），返回纯 base64 与 dataURL 预览。 */
const compressImage = async (
  source: Blob,
  maxEdge = 1000,
  quality = 0.88
): Promise<{ base64: string; dataUrl: string; mime: string }> => {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), dataUrl, mime: 'image/jpeg' };
};

const onCoverPicked = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const compressed = await compressImage(file);
    coverBase64.value = compressed.base64;
    coverMime.value = compressed.mime;
    coverPreview.value = compressed.dataUrl;
  } catch (error) {
    console.warn('[MetadataEditor] 封面处理失败:', error);
  } finally {
    input.value = '';
  }
};

const save = async () => {
  const meta = entry.value;
  if (!meta || saving.value) return;
  const changes: Record<string, unknown> = {};
  if (form.title !== meta.title) changes.title = form.title;
  if (form.artist !== meta.artist) changes.artist = form.artist;
  if (form.album !== meta.album) changes.album = form.album;
  if ((form.year || 0) !== (meta.year || 0)) changes.year = form.year || 0;
  if ((form.trackNumber || 0) !== (meta.trackNumber || 0)) {
    changes.trackNumber = form.trackNumber || 0;
  }
  if ((form.diskNumber || 0) !== (meta.diskNumber || 0)) {
    changes.diskNumber = form.diskNumber || 0;
  }
  const lyricText = form.lyrics.trim();
  if (lyricText !== (meta.lyrics || '')) changes.lyrics = lyricText;
  if (coverBase64.value) {
    changes.coverBase64 = coverBase64.value;
    changes.coverMime = coverMime.value;
  }
  if (!Object.keys(changes).length) {
    emit('update:show', false);
    return;
  }

  saving.value = true;
  try {
    const result: MetadataWriteResult = await writeAudioMetadata(meta.filePath, changes);
    if (result.metadata) {
      await localMusicStore.applyEntryMetadata(JSON.stringify(result.metadata));
    }
    window.$message?.success(st('saved'));
    emit('saved');
    emit('update:show', false);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    window.$message?.error(message.includes('不支持') ? st('unsupported') : st('saveFailed'));
  } finally {
    saving.value = false;
  }
};

// 云端匹配仅在实际的原生环境中有意义（写回也依赖原生）。
if (!isAndroidNative()) matchCandidates.value = [];
</script>

<style scoped lang="scss">
.meta-editor-overlay {
  position: fixed;
  inset: 0;
  z-index: 100200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.46);
}

.meta-editor-panel {
  display: flex;
  width: 100%;
  max-height: min(88dvh, 720px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--m-glass-border, rgba(128, 128, 128, 0.18));
  border-bottom: 0;
  border-radius: 24px 24px 0 0;
  background: var(--m-surface-raised, var(--d-surface, #17171a));
  box-shadow: 0 -16px 48px rgba(0, 0, 0, 0.28);
}

.meta-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 10px;
}

.meta-editor-title {
  font-size: 16px;
  font-weight: 650;
  color: var(--m-text-primary, var(--d-text-primary, #fff));
}

.meta-close-btn {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--m-text-secondary, #999);
  font-size: 20px;
}

.meta-editor-body {
  display: grid;
  flex: 1 1 auto;
  gap: 12px;
  padding: 0 18px 14px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.meta-cover-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.meta-cover {
  display: grid;
  width: 84px;
  height: 84px;
  flex-shrink: 0;
  place-items: center;
  overflow: hidden;
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent-color) 10%, transparent);
  color: var(--m-text-muted, #888);
  font-size: 26px;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.meta-change-cover {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border: 1px solid color-mix(in srgb, #fff 22%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-color) 12%, transparent);
  color: var(--m-text-primary, #eee);
  font-size: 12px;
  cursor: pointer;

  input {
    display: none;
  }
}

.meta-cloud-match {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--accent-color) 32%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent-color) 9%, transparent);
  color: var(--accent-color, #eee);
  font-size: 13px;

  &:disabled {
    opacity: 0.6;
  }
}

.meta-candidates {
  display: grid;
  gap: 8px;
  max-height: 220px;
  padding: 4px;
  border: 1px solid color-mix(in srgb, #fff 14%, transparent);
  border-radius: 14px;
  overflow-y: auto;
}

.meta-match-state {
  display: flex;
  min-height: 54px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, #fff 12%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, #fff 5%, transparent);
  color: var(--m-text-muted, #888);
  font-size: 12px;
  text-align: center;
}

.meta-match-state.error {
  border-color: color-mix(in srgb, #ef4444 24%, transparent);
  color: color-mix(in srgb, #ef4444 72%, #fff);
}

.meta-candidate {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  text-align: left;

  &:active {
    background: color-mix(in srgb, var(--accent-color) 14%, transparent);
  }
}

.meta-candidate-copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;

  strong {
    overflow: hidden;
    color: var(--m-text-primary, #eee);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    overflow: hidden;
    color: var(--m-text-muted, #888);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.meta-duration-diff {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-color) 14%, transparent);
  color: var(--m-text-secondary, #aaa);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.meta-field {
  display: grid;
  gap: 6px;
  color: var(--m-text-secondary, #999);
  font-size: 11px;
}

.meta-field-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

.meta-field input,
.meta-field textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, #fff 16%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent-color) 6%, transparent);
  color: var(--m-text-primary, #eee);
  font-size: 13px;
  outline: none;

  &:focus {
    border-color: color-mix(in srgb, var(--accent-color) 45%, transparent);
  }
}

.meta-field textarea {
  resize: vertical;
  min-height: 96px;
  font-family: inherit;
  line-height: 1.5;
}

.meta-editor-footer {
  padding: 10px 18px max(12px, var(--safe-area-inset-bottom, 0px));
}

.meta-save-btn {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px;
  border: 0;
  border-radius: 14px;
  background: var(--accent-color, #5b8cff);
  color: #fff;
  font-size: 15px;
  font-weight: 600;

  &:disabled {
    opacity: 0.6;
  }

  &:active {
    transform: scale(0.99);
  }
}

.is-spinning {
  animation: meta-editor-spin 900ms linear infinite;
}

@keyframes meta-editor-spin {
  to {
    transform: rotate(360deg);
  }
}

.meta-editor-pop-enter-active {
  transition: opacity 200ms ease;

  .meta-editor-panel {
    transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
  }
}

.meta-editor-pop-leave-active {
  transition: opacity 180ms ease;

  .meta-editor-panel {
    transition: transform 240ms cubic-bezier(0.32, 0.72, 0, 1);
  }
}

.meta-editor-pop-enter-from,
.meta-editor-pop-leave-to {
  opacity: 0;

  .meta-editor-panel {
    transform: translateY(100%);
  }
}
</style>
