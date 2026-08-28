import { getSearch } from '@/api/search';
import type { ChatMessage } from '@/features/ai/client';
import { chatCompletion } from '@/features/ai/client';
import { gatewayChatCompletion } from '@/features/ai/gateway';
import { getProvider } from '@/features/ai/providers';

export interface FmSeed {
  id: number | string;
  name: string;
  artists?: Array<{ name: string }>;
  ar?: Array<{ name: string }>;
  al?: { name?: string };
}

interface AiConfig {
  provider: string;
  apiKey: string;
  accessToken?: string;
  model: string;
  baseUrl: string;
}

function normalizeAiConfig(rawConfig: unknown): AiConfig {
  const config = (rawConfig || {}) as Partial<AiConfig>;
  return {
    provider: config.provider || 'gateway',
    apiKey: config.apiKey || '',
    accessToken: config.accessToken || '',
    model: config.model || 'opencode-v4f',
    baseUrl: config.baseUrl || ''
  };
}

function extractSongTitles(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+[.、)]|[-*])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

async function requestRecommendedTitles(prompt: string): Promise<string[]> {
  const rawConfig = localStorage.getItem('lyric-metaphor-config');
  const config = normalizeAiConfig(rawConfig ? JSON.parse(rawConfig) : null);
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: '你是私人FM推荐器。只输出歌曲名称，每行一首，不要编号、标点、歌手名或任何解释。'
    },
    { role: 'user', content: prompt }
  ];

  if (!config.provider && !config.baseUrl) {
    throw new Error('请先在歌词隐喻设置中配置 AI');
  }

  const result =
    config.provider === 'gateway'
      ? await gatewayChatCompletion(config.model, messages, config.accessToken || '')
      : await chatCompletion({
          providerId: getProvider(config.provider) ? config.provider : 'custom',
          apiKey: config.apiKey || undefined,
          model: config.model,
          baseUrl: config.baseUrl || getProvider(config.provider)?.baseUrl,
          messages
        });
  return extractSongTitles(result.content);
}

async function searchTitle(title: string): Promise<FmSeed | null> {
  try {
    const response = await getSearch({ keywords: title, type: 1, limit: 1 });
    const song = response.data?.result?.songs?.[0];
    if (!song?.id || !song.name) return null;
    return song as FmSeed;
  } catch {
    return null;
  }
}

export async function recommendPersonalFmSeeds(input: {
  favoriteIds?: Array<number | string>;
  current?: FmSeed | null;
}): Promise<FmSeed[]> {
  const currentArtist = input.current?.artists?.[0]?.name || input.current?.ar?.[0]?.name;
  const prompt = [
    `当前歌曲：${input.current ? `${input.current.name}${currentArtist ? ` - ${currentArtist}` : ''}` : '未知'}`,
    input.favoriteIds?.length ? `用户收藏歌曲数量：${input.favoriteIds.length}` : '',
    '请推荐 6 首风格相近且适合连续收听的歌曲。'
  ]
    .filter(Boolean)
    .join('\n');

  const titles = await requestRecommendedTitles(prompt);
  const resolved = await Promise.all(titles.map(searchTitle));
  const seen = new Set<number | string>();
  return resolved.filter((song): song is FmSeed => {
    if (!song || seen.has(song.id)) return false;
    seen.add(song.id);
    return true;
  });
}
