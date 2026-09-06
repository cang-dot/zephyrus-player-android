/**
 * AI 生成歌单
 *
 * 两种策略:
 *  - favorites: 取用户收藏的最后 50 首,让模型按风格延续联想推荐;
 *  - followed-artists: 取用户关注的歌手,聚合每人简介与热门歌曲后让模型挑选。
 *
 * 模型输出「歌名 + 歌手」清单,再逐条经搜索解析为真实歌曲(复用私人 FM 链路)。
 */
import { getArtistDetail, getArtistTopSongs } from '@/api/artist';
import { getMusicDetail } from '@/api/music';
import { getSearch } from '@/api/search';
import { getArtistSublist } from '@/api/user';
import type { ChatMessage } from '@/features/ai/client';
import { chatCompletion } from '@/features/ai/client';
import { getProvider } from '@/features/ai/providers';

export type AiPlaylistStrategy = 'favorites' | 'followed-artists';

export interface AiPlaylistSeed {
  name: string;
  artist: string;
  reason?: string;
}

export interface AiPlaylistSong {
  id: number | string;
  name: string;
  ar?: Array<{ name: string }>;
  artists?: Array<{ name: string }>;
  al?: { name?: string; picUrl?: string };
}

export interface AiPlaylistResult {
  rationale: string;
  seeds: AiPlaylistSeed[];
  /** 解析为真实歌曲后的结果(可直接喂给 navigateToMusicList) */
  songs: AiPlaylistSong[];
  skipped: number;
}

interface AiConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

function readAiConfig(): AiConfig {
  try {
    const raw = JSON.parse(localStorage.getItem('lyric-metaphor-config') || '{}');
    return {
      provider: raw.provider || 'zhipu',
      apiKey: raw.apiKey || '',
      model: raw.model || 'glm-4-flash',
      baseUrl: raw.baseUrl || ''
    };
  } catch {
    return { provider: 'zhipu', apiKey: '', model: 'glm-4-flash', baseUrl: '' };
  }
}

async function requestAiJson(messages: ChatMessage[]): Promise<string> {
  const config = readAiConfig();
  if (!config.apiKey && getProvider(config.provider)?.needApiKey) {
    throw new Error('请先在设置中配置 AI 密钥（设置 → 基础设置 → 歌词 AI 解析）');
  }
  const result = await chatCompletion({
    providerId: getProvider(config.provider) ? config.provider : 'custom',
    apiKey: config.apiKey || undefined,
    model: config.model,
    baseUrl: config.baseUrl || getProvider(config.provider)?.baseUrl,
    messages
  });
  return result.content;
}

/** 从模型输出里提取 JSON 数组(容忍 ```json 围栏与前后闲话) */
function extractJsonArray(content: string): Array<Record<string, unknown>> {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : content;
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('AI 未返回有效的推荐列表');
  return JSON.parse(candidate.slice(start, end + 1)) as Array<Record<string, unknown>>;
}

async function collectFavoritesContext(): Promise<string> {
  const { useFavoriteStore } = await import('@/store/modules/favorite');
  const favoriteStore = useFavoriteStore();
  if (!favoriteStore.favoriteList?.length) {
    throw new Error('还没有收藏的歌曲，先收藏几首再试试');
  }
  // favoriteList 头部 = 最新收藏
  const recentIds = favoriteStore.favoriteList.slice(0, 50).map((id: unknown) => Number(id));
  const detail = await getMusicDetail(recentIds);
  const songs = (detail.data?.songs || []) as Array<{
    name: string;
    ar?: Array<{ name: string }>;
  }>;
  if (!songs.length) throw new Error('收藏歌曲详情加载失败，请稍后再试');
  return songs.map((song, i) => `${i + 1}. ${song.name} - ${(song.ar || []).map((a) => a.name).join('/')}`).join('\n');
}

interface FollowedArtist {
  id: number;
  name: string;
  briefDesc?: string;
  hotSongs: Array<{ name: string; artist: string }>;
}

async function collectFollowedArtistsContext(maxArtists = 6): Promise<string> {
  const sub = await getArtistSublist(30, 0);
  const raw = (sub.data?.data?.artists || sub.data?.artists || []) as Array<{
    id: number;
    name: string;
  }>;
  if (!raw.length) throw new Error('还没有关注的歌手，先去关注几位再试试');

  const picked = raw.slice(0, maxArtists);
  const artists: FollowedArtist[] = [];
  for (const item of picked) {
    try {
      const [detail, top] = await Promise.all([
        getArtistDetail(item.id),
        getArtistTopSongs({ id: item.id, limit: 3 })
      ]);
      artists.push({
        id: item.id,
        name: item.name,
        briefDesc:
          (detail.data?.data?.artist?.briefDesc || '').slice(0, 160) ||
          (detail.data?.artist?.briefDesc || '').slice(0, 160),
        hotSongs: ((top.data?.songs || []) as Array<{ name: string; ar?: Array<{ name: string }> }>)
          .slice(0, 3)
          .map((song) => ({
            name: song.name,
            artist: (song.ar || []).map((a) => a.name).join('/')
          }))
      });
    } catch {
      // 单个歌手的详情失败不阻塞整体
      artists.push({ id: item.id, name: item.name, hotSongs: [] });
    }
  }

  return artists
    .map(
      (artist) =>
        `歌手：${artist.name}${artist.briefDesc ? `（${artist.briefDesc}）` : ''}` +
        (artist.hotSongs.length
          ? `\n代表作品：${artist.hotSongs.map((song) => `${song.name}-${song.artist}`).join('；')}`
          : '')
    )
    .join('\n\n');
}

function buildPrompt(strategy: AiPlaylistStrategy, context: string): ChatMessage[] {
  const strategyText =
    strategy === 'favorites'
      ? '以下是用户最近收藏的 50 首歌曲。请分析整体风格倾向（流派、年代、情绪、语言等），然后推荐 15-20 首风格延续、但用户大概率还没听过的新歌。'
      : '以下是与用户关注的各位歌手相关的资料。请围绕这些歌手的风格与代表作，推荐 15-20 首相似气质的歌曲（可以是这些歌手的冷门佳作，也可以是同风格其它歌手/乐队的作品）。';

  return [
    {
      role: 'system',
      content:
        '你是音乐推荐专家。只输出一个 JSON 数组，不要任何解释或围栏。' +
        '数组每项格式 {"name":"歌曲名","artist":"歌手名","reason":"一句话推荐理由"}。' +
        '推荐必须真实存在的歌曲，不要编造。'
    },
    { role: 'user', content: `${strategyText}\n\n${context}\n\n请输出推荐 JSON 数组。` }
  ];
}

async function searchSong(seed: AiPlaylistSeed): Promise<AiPlaylistSong | null> {
  try {
    const response = await getSearch({
      keywords: `${seed.name} ${seed.artist}`.trim(),
      type: 1,
      limit: 1
    });
    const song = response.data?.result?.songs?.[0];
    if (!song?.id || !song.name) return null;
    return song as AiPlaylistSong;
  } catch {
    return null;
  }
}

export async function generateAiPlaylist(
  strategy: AiPlaylistStrategy,
  options: { onProgress?: (stage: string) => void } = {}
): Promise<AiPlaylistResult> {
  options.onProgress?.(
    strategy === 'favorites' ? '正在整理最近收藏…' : '正在收集关注的歌手…'
  );
  const context =
    strategy === 'favorites'
      ? await collectFavoritesContext()
      : await collectFollowedArtistsContext();

  options.onProgress?.('正在让 AI 挑选歌曲…');
  const content = await requestAiJson(buildPrompt(strategy, context));
  const rawSeeds = extractJsonArray(content);

  const seeds: AiPlaylistSeed[] = rawSeeds
    .map((item) => ({
      name: String(item.name || '').trim(),
      artist: String(item.artist || '').trim(),
      reason: String(item.reason || '').trim()
    }))
    .filter((seed) => seed.name);

  if (seeds.length < 5) throw new Error('AI 推荐列表过短，请重试');

  options.onProgress?.('正在匹配曲库…');
  const resolved = await Promise.all(seeds.map((seed) => searchSong(seed)));
  const songs: AiPlaylistSong[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  resolved.forEach((song) => {
    if (!song) {
      skipped += 1;
      return;
    }
    const dedupeKey = String(song.id);
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    songs.push(song);
  });

  if (songs.length < 5) throw new Error('有效推荐不足 5 首，请重试');
  return { rationale: '', seeds, songs, skipped };
}
