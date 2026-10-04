<template>
  <responsive-modal
    v-model="visible"
    :title="t('songItem.bilibili.lyricMatch.title')"
    class="lyric-match-panel"
  >
    <!-- 匹配目标歌曲 -->
    <div v-if="song" class="lm-target">
      <img
        v-if="song.picUrl"
        class="lm-target-cover"
        :src="getImgUrl(song.picUrl, '100y100')"
        referrerpolicy="no-referrer"
        alt=""
      />
      <span v-else class="lm-target-cover lm-target-placeholder"><i class="ri-music-2-line" /></span>
      <div class="lm-target-copy">
        <strong>{{ song.name }}</strong>
        <small>{{ targetArtist }}</small>
      </div>
    </div>

    <div class="lm-search">
      <input
        v-model="keyword"
        class="lm-search-input"
        type="text"
        :placeholder="t('songItem.bilibili.lyricMatch.keywordPlaceholder')"
        @keyup.enter="runSearch"
      />
      <button class="lm-search-btn" type="button" :disabled="loading" @click="runSearch">
        {{
          loading
            ? t('songItem.bilibili.lyricMatch.searching')
            : t('songItem.bilibili.lyricMatch.search')
        }}
      </button>
    </div>

    <p v-if="isBilibiliSong" class="lm-hint">
      {{ t('songItem.bilibili.subtitleNeedLogin') }}
    </p>

    <div v-if="loading" class="lm-loading">
      <i class="ri-loader-4-line lm-spin" />
    </div>

    <template v-else>
      <div v-if="!groupedCandidates.length" class="lm-empty">
        {{ t('songItem.bilibili.lyricMatch.empty') }}
      </div>
      <div v-else class="lm-groups">
        <section v-for="group in groupedCandidates" :key="group.source" class="lm-group">
          <header class="lm-group-head">
            <span class="lm-group-dot" :class="`dot-${group.source}`" />
            <span class="lm-group-name">{{ sourceLabel(group.source) }}</span>
            <span class="lm-group-count">{{ group.items.length }}</span>
          </header>
          <ul class="lm-list">
            <li
              v-for="candidate in group.items"
              :key="candidate.id"
              class="lm-item"
              :class="{ 'is-active': applyingId === candidate.id }"
              @click="apply(candidate)"
            >
              <img
                v-if="candidate.cover"
                class="lm-item-cover"
                :src="getImgUrl(candidate.cover, '100y100')"
                referrerpolicy="no-referrer"
                loading="lazy"
                alt=""
              />
              <span v-else class="lm-item-cover lm-item-cover-placeholder">
                <i class="ri-disc-line" />
              </span>
              <div class="lm-item-main">
                <div class="lm-item-title">{{ candidate.title }}</div>
                <div class="lm-item-sub">
                  {{ [candidate.artist, candidate.extra].filter(Boolean).join(' · ') }}
                </div>
              </div>
              <span class="lm-item-badge" :class="`badge-${candidate.source}`">
                <i :class="sourceIcon(candidate.source)" />
                {{ sourceLabel(candidate.source) }}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </responsive-modal>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { getBilibiliSubtitle } from '@/api/bilibili';
import { getAmllLyricForSong, resolveAmllSource } from '@/api/amllLyrics';
import { queryCommunityLyrics } from '@/api/communityLyric';
import { fetchLrclibLyric } from '@/api/lrclibLyrics';
import { readProviderLyricCache, writeProviderLyricCache } from '@/api/providerLyricCache';
import { getSearch } from '@/api/search';
import ResponsiveModal from '@/components/common/ResponsiveModal.vue';
import { useLyricMatch } from '@/composables/useLyricMatch';
import { loadLrc } from '@/hooks/usePlayerHooks';
import { ttmlToTimedLines } from '@/services/ttmlParser';
import { usePlayerStore } from '@/store/modules/player';
import type { ILyric, SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';
import { mergeTranslationFeatures } from '@/utils/lyricTranslationMerge';
import { isUsableLyric } from '@/utils/lyricValidation';
import { mergeAuxiliaryLyrics, parseTimedLyrics } from '@/utils/timedLyrics';
import {
  defaultLyricSearchKeyword,
  manualLyricCacheKey,
  subtitleLinesToLyric
} from '@/utils/subtitleParser';

type CandidateSource = 'bilibili' | 'netease' | 'amll' | 'community' | 'lrclib';

const SOURCE_ORDER: CandidateSource[] = ['bilibili', 'netease', 'amll', 'community', 'lrclib'];

interface LyricCandidate {
  id: string;
  source: CandidateSource;
  title: string;
  artist: string;
  extra?: string;
  cover?: string;
  load: () => Promise<ILyric | null>;
}

const { t } = useI18n();
const message = useMessage();
const playerStore = usePlayerStore();
const { visible, targetSong, closeLyricMatch } = useLyricMatch();

const keyword = ref('');
const loading = ref(false);
const candidates = ref<LyricCandidate[]>([]);
const applyingId = ref<string | null>(null);

/** 目标歌曲：优先使用打开面板时传入的，否则用当前播放歌曲 */
const song = computed<SongResult | null>(() => targetSong.value || playerStore.playMusic || null);
const isBilibiliSong = computed(() => song.value?.platform === 'bilibili');
const targetArtist = computed(() => (song.value?.ar || song.value?.artists || [])[0]?.name || '');

const sourceLabel = (source: CandidateSource): string =>
  ({
    bilibili: t('songItem.bilibili.lyricMatch.sourceBilibili'),
    netease: t('songItem.bilibili.lyricMatch.sourceNetease'),
    amll: t('songItem.bilibili.lyricMatch.sourceAmll'),
    community: t('songItem.bilibili.lyricMatch.sourceCommunity'),
    lrclib: t('songItem.bilibili.lyricMatch.sourceLrclib')
  })[source];

const sourceIcon = (source: CandidateSource): string =>
  ({
    bilibili: 'ri-tv-2-line',
    netease: 'ri-netease-cloud-music-line',
    amll: 'ri-vip-crown-2-line',
    community: 'ri-group-line',
    lrclib: 'ri-global-line'
  })[source];

/** 按来源分组（固定顺序），供排版渲染 */
const groupedCandidates = computed(() =>
  SOURCE_ORDER.map((source) => ({
    source,
    items: candidates.value.filter((candidate) => candidate.source === source)
  })).filter((group) => group.items.length)
);

/** TTML（AMLL）→ 项目统一歌词结构 */
async function amllToLyric(current: SongResult): Promise<ILyric | null> {
  const ttml = await getAmllLyricForSong(current);
  if (!ttml?.lines.length) return null;
  const lines = ttmlToTimedLines(ttml);
  return {
    lrcTimeArray: lines.map((line) => line.startTime ?? 0),
    lrcArray: lines,
    hasWordByWord: lines.some((line) => line.words?.length),
    format: 'ttml',
    source: 'amll-ttml'
  };
}

/** Zephyrus 社区歌词：按平台 id / 内部 id 各查一次，逐条候选 */
async function communityCandidates(current: SongResult): Promise<LyricCandidate[]> {
  const ids = Array.from(
    new Set([current.platformId, current.id].filter((id) => id !== undefined && id !== null).map(String))
  );
  const list: LyricCandidate[] = [];
  const seen = new Set<number>();
  for (const id of ids) {
    try {
      const { entries } = await queryCommunityLyrics(id);
      for (const entry of entries) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        list.push({
          id: `community:${entry.id}`,
          source: 'community',
          title: entry.songName || current.name,
          artist: entry.artist || '',
          extra: t('songItem.bilibili.lyricMatch.communityEntry', {
            name: entry.contributorName,
            likes: entry.likes
          }),
          cover: current.picUrl,
          load: async () => {
            const parsed = parseTimedLyrics(entry.lrc, { format: 'lrc', source: 'community' });
            if (entry.trLrc) mergeAuxiliaryLyrics(parsed, entry.trLrc, 'trText', 'lrc');
            mergeTranslationFeatures(parsed.lrcArray);
            return parsed;
          }
        });
      }
    } catch {
      /* 社区歌词查询失败静默跳过 */
    }
  }
  return list;
}

/** 收集候选：B 站字幕（视频自带）+ 网易云搜索 + AMLL 逐词 + Zephyrus 社区 + LRCLIB */
async function buildCandidates(
  current: SongResult,
  searchKeyword: string
): Promise<LyricCandidate[]> {
  const list: LyricCandidate[] = [];
  const currentArtist = (current.ar || current.artists || [])[0]?.name || '';

  // 1) B 站字幕：该视频的全部字幕轨（含 AI 字幕）
  if (current.platform === 'bilibili' && current.platformId) {
    try {
      const { ensureBilibiliCid } = await import('@/api/bilibili');
      const cid = await ensureBilibiliCid(current);
      const payload = await getBilibiliSubtitle({ bvid: String(current.platformId), cid });
      for (const track of payload.tracks) {
        const lines = track.id === payload.picked?.id ? payload.lines : [];
        list.push({
          id: `bilibili:${track.id}`,
          source: 'bilibili',
          title: current.name,
          artist: currentArtist,
          extra: track.lanDoc,
          cover: current.picUrl,
          load: async () => {
            if (lines.length) return subtitleLinesToLyric(lines);
            const fresh = await getBilibiliSubtitle({
              bvid: String(current.platformId),
              cid,
              lan: track.lan
            });
            return fresh.lines.length ? subtitleLinesToLyric(fresh.lines) : null;
          }
        });
      }
    } catch (error) {
      console.warn('[lyricMatch] B 站字幕获取失败:', error);
    }
  }

  // 2) AMLL TTML 逐词库：按歌曲 id 精准匹配（网易云/云端歌曲）
  const amllSource = resolveAmllSource(current);
  if (amllSource) {
    list.push({
      id: `amll:${amllSource.platform}:${amllSource.songId}`,
      source: 'amll',
      title: current.name,
      artist: currentArtist,
      extra: t('songItem.bilibili.lyricMatch.wordTimed'),
      cover: current.picUrl,
      load: () => amllToLyric(current)
    });
  }

  // 3) Zephyrus 社区歌词
  list.push(...(await communityCandidates(current)));

  // 4) 网易云：按关键词搜索候选歌曲，取各自歌词
  if (searchKeyword.trim()) {
    try {
      const { data } = await getSearch({
        keywords: searchKeyword.trim(),
        type: 1,
        limit: 8
      } as any);
      const songs: any[] = data?.result?.songs || [];
      for (const item of songs) {
        list.push({
          id: `netease:${item.id}`,
          source: 'netease',
          title: String(item.name || ''),
          artist: (item.ar || []).map((artist: any) => artist.name).join(' / '),
          extra: item.al?.name || '',
          cover: item.al?.picUrl || '',
          load: () => loadLrc(item.id)
        });
      }
    } catch (error) {
      console.warn('[lyricMatch] 网易云搜索失败:', error);
    }
  }

  // 5) LRCLIB：按当前关键词直接查（标题+歌手+时长）
  if (searchKeyword.trim()) {
    list.push({
      id: 'lrclib:keyword',
      source: 'lrclib',
      title: searchKeyword.trim(),
      artist: '',
      extra: '',
      cover: current.picUrl,
      load: () => fetchLrclibLyric({ ...current, name: searchKeyword.trim() } as SongResult)
    });
  }

  return list;
}

async function runSearch(): Promise<void> {
  const current = song.value;
  if (!current) {
    message.warning(t('songItem.bilibili.lyricMatch.empty'));
    return;
  }
  loading.value = true;
  applyingId.value = null;
  try {
    candidates.value = await buildCandidates(current, keyword.value);
  } finally {
    loading.value = false;
  }
}

async function apply(candidate: LyricCandidate): Promise<void> {
  const current = song.value;
  if (!current) return;
  applyingId.value = candidate.id;
  try {
    const lyric = await candidate.load();
    if (!lyric || !isUsableLyric(lyric)) {
      message.warning(t('songItem.bilibili.lyricMatch.empty'));
      return;
    }
    // 写入「手动匹配」缓存（优先级最高），当前播放中则立即生效
    await writeProviderLyricCache(manualLyricCacheKey(current), lyric);
    if (playerStore.playMusic && String(playerStore.playMusic.id) === String(current.id)) {
      playerStore.playMusic.lyric = lyric;
    }
    message.success(t('songItem.bilibili.lyricMatch.applied'));
    closeLyricMatch();
  } catch (error) {
    message.error((error as Error).message || t('songItem.bilibili.lyricMatch.empty'));
  } finally {
    applyingId.value = null;
  }
}

// 打开面板时用「歌手 歌名」预填关键词，并读取已有手动匹配结果
watch(visible, async (open) => {
  if (!open) {
    candidates.value = [];
    return;
  }
  const current = song.value;
  if (!current) return;
  keyword.value = defaultLyricSearchKeyword(current);
  try {
    const cached = await readProviderLyricCache(manualLyricCacheKey(current));
    applyingId.value = cached && isUsableLyric(cached.lyric) ? 'applied' : null;
  } catch {
    /* 忽略缓存读取失败 */
  }
  if (!candidates.value.length) await runSearch();
});
</script>

<style scoped lang="scss">
.lyric-match-panel {
  .lm-target {
    @apply flex items-center;
    gap: 12px;
    margin-bottom: 10px;
    padding: 10px;
    border: 1px solid var(--m-border, rgba(128, 128, 128, 0.18));
    border-radius: 14px;
    background: var(--d-surface-hover, rgba(128, 128, 128, 0.06));
  }

  .lm-target-cover {
    @apply shrink-0;
    width: 42px;
    height: 42px;
    border-radius: 10px;
    object-fit: cover;
  }

  .lm-target-placeholder {
    @apply grid place-items-center;
    color: var(--d-text-muted, #999);
    font-size: 18px;
    background: rgba(128, 128, 128, 0.12);
  }

  .lm-target-copy {
    @apply min-w-0;

    strong {
      display: block;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      display: block;
      margin-top: 2px;
      font-size: 12px;
      color: var(--d-text-muted, #999);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .lm-search {
    @apply flex items-center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .lm-search-input {
    @apply flex-1 min-w-0;
    height: 36px;
    padding: 0 10px;
    border: 1px solid var(--m-border, rgba(128, 128, 128, 0.24));
    border-radius: 10px;
    background: transparent;
    color: inherit;
    font-size: 14px;
    outline: none;

    &:focus {
      border-color: var(--accent-color, #77836e);
    }
  }

  .lm-search-btn {
    @apply shrink-0;
    height: 36px;
    padding: 0 14px;
    border: 0;
    border-radius: 10px;
    background: var(--accent-color, #77836e);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }
  }

  .lm-hint {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--d-text-muted, #999);
  }

  .lm-loading {
    @apply flex items-center justify-center;
    padding: 24px 0;
  }

  .lm-spin {
    display: inline-block;
    animation: lm-spin 900ms linear infinite;
    font-size: 20px;
    color: var(--accent-color, #77836e);
  }

  .lm-empty {
    padding: 20px 0;
    text-align: center;
    font-size: 13px;
    color: var(--d-text-muted, #999);
  }

  .lm-groups {
    @apply flex flex-col;
    gap: 14px;
  }

  .lm-group-head {
    @apply flex items-center;
    gap: 6px;
    margin-bottom: 6px;
    padding: 0 2px;
  }

  .lm-group-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #8e8e93;

    &.dot-bilibili {
      background: #fb7299;
    }

    &.dot-netease {
      background: #ea402f;
    }

    &.dot-amll {
      background: #7c5cff;
    }

    &.dot-community {
      background: var(--accent-color, #77836e);
    }
  }

  .lm-group-name {
    font-size: 12px;
    font-weight: 700;
    color: var(--d-text-secondary, #666);
  }

  .lm-group-count {
    font-size: 11px;
    color: var(--d-text-muted, #999);
    font-variant-numeric: tabular-nums;
  }

  .lm-list {
    @apply flex flex-col;
    gap: 6px;
  }

  .lm-item {
    @apply flex items-center;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid var(--m-border, rgba(128, 128, 128, 0.18));
    border-radius: 12px;
    cursor: pointer;
    transition: background-color 160ms ease;

    &:active {
      background: var(--d-surface-hover, rgba(128, 128, 128, 0.08));
    }

    &.is-active {
      border-color: var(--accent-color, #77836e);
    }
  }

  .lm-item-cover {
    @apply shrink-0;
    width: 42px;
    height: 42px;
    border-radius: 9px;
    object-fit: cover;
    background: rgba(128, 128, 128, 0.1);
  }

  .lm-item-cover-placeholder {
    @apply grid place-items-center;
    color: var(--d-text-muted, #999);
    font-size: 18px;
  }

  .lm-item-main {
    @apply flex-1 min-w-0;
  }

  .lm-item-title {
    font-size: 14px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lm-item-sub {
    margin-top: 2px;
    font-size: 12px;
    color: var(--d-text-muted, #999);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lm-item-badge {
    @apply shrink-0 flex items-center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 7px;
    font-size: 11px;

    i {
      font-size: 12px;
    }

    &.badge-bilibili {
      background: rgba(251, 114, 153, 0.14);
      color: #fb7299;
    }

    &.badge-netease {
      background: rgba(234, 64, 47, 0.12);
      color: #ea402f;
    }

    &.badge-amll {
      background: rgba(124, 92, 255, 0.14);
      color: #7c5cff;
    }

    &.badge-community {
      background: color-mix(in srgb, var(--accent-color, #77836e) 14%, transparent);
      color: var(--accent-color, #77836e);
    }

    &.badge-lrclib {
      background: rgba(142, 142, 147, 0.16);
      color: #8e8e93;
    }
  }
}

@keyframes lm-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
