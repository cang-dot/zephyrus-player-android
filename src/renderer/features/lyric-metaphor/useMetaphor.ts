import { ref } from 'vue';

import { chatCompletionStream, type ChatMessage } from '@/features/ai/client';
import { getProvider } from '@/features/ai/providers';
import { isFeatureEnabled } from '@/features/store';

const STORAGE = 'lyric-metaphor-config';
const CACHE_KEY = 'lyric-metaphor-cache';
const CACHE_MAX = 100;
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

interface MetaphorConfig {
  provider: string;
  apiKey: string;
  accessToken?: string;
  model: string;
  baseUrl: string;
}

interface CacheEntry {
  data: string;
  time: number;
}

export function getMetaphorConfig(): MetaphorConfig {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      const config = JSON.parse(raw) as MetaphorConfig;
      // 旧网关配置迁移:云端网关已弃用,落到智谱免费档
      if (config.provider === 'gateway' || config.provider === '') {
        config.provider = 'zhipu';
        if (!config.model || config.model === 'opencode-v4f') config.model = 'glm-4-flash';
        config.baseUrl = '';
        delete config.accessToken;
        saveMetaphorConfig(config);
      }
      return config;
    }
  } catch {
    // Ignore invalid legacy configuration and use the current defaults.
  }
  // 兼容旧配置:历史版本默认走已弃用的云端网关,迁移到智谱免费档
  return { provider: 'zhipu', apiKey: '', model: 'glm-4-flash', baseUrl: '' };
}

export function saveMetaphorConfig(config: MetaphorConfig) {
  localStorage.setItem(STORAGE, JSON.stringify(config));
}

export interface MetaphorState {
  loading: boolean;
  error: string;
  result: string;
  cached: boolean;
}

const cacheStore = new Map<string, CacheEntry>();

function loadPersistentCache(): Map<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
      const now = Date.now();
      const map = new Map<string, CacheEntry>();
      for (const [key, entry] of Object.entries(parsed)) {
        if (now - entry.time < CACHE_TTL) {
          map.set(key, entry);
        }
      }
      return map;
    }
  } catch {
    // Ignore invalid or expired cache entries.
  }
  return new Map();
}

function savePersistentCache(map: Map<string, CacheEntry>) {
  try {
    const obj: Record<string, CacheEntry> = {};
    map.forEach((entry, key) => {
      obj[key] = entry;
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    if (map.size > 0) {
      const first = map.keys().next().value;
      if (first !== undefined) {
        map.delete(first);
        savePersistentCache(map);
      }
    }
  }
}

const entries = loadPersistentCache();
entries.forEach((entry, key) => cacheStore.set(key, entry));

export function useMetaphor() {
  const loading = ref(false);
  const error = ref('');
  const result = ref('');
  const cached = ref(false);

  async function analyze(
    lyrics: string,
    songName: string,
    artist: string,
    albumDesc?: string
  ): Promise<void> {
    if (!isFeatureEnabled('lyric-metaphor')) {
      error.value = '歌词隐喻分析功能未启用，请在 设置 > 基础设置 > 歌词 AI 解析 中开启';
      return;
    }

    const cacheKey = `${artist}|${songName}|${lyrics.slice(0, 100)}|${albumDesc?.slice(0, 200) || ''}`;
    const entry = cacheStore.get(cacheKey);
    if (entry) {
      result.value = entry.data;
      cached.value = true;
      error.value = '';
      return;
    }

    loading.value = true;
    error.value = '';
    result.value = '';
    cached.value = false;

    const config = getMetaphorConfig();

    if (!config.provider && !config.baseUrl) {
      config.provider = 'pollinations';
      saveMetaphorConfig(config);
    }

    const provider = getProvider(config.provider);
    const systemPrompt = `你是一位专业的歌词分析专家。逐句解析歌词，格式：

{歌词原文}
解析：{该句的修辞手法、隐喻含义、情感分析}

最后给出整体评价。如果歌词没有明显的隐喻，也请如实说明。`;

    const userPrompt = `请分析以下歌词的修辞手法和隐喻含义：

**歌曲名称**：${songName}
**歌手**：${artist}${albumDesc ? `\n**专辑介绍**：${albumDesc}` : ''}

**歌词**：
${lyrics}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    try {
      let pendingText = '';
      let typingFrame = 0;
      const pumpTyping = () => {
        if (!pendingText) {
          typingFrame = 0;
          return;
        }
        const count = Math.min(4, Math.max(1, Math.ceil(pendingText.length / 24)));
        result.value += pendingText.slice(0, count);
        pendingText = pendingText.slice(count);
        typingFrame = requestAnimationFrame(pumpTyping);
      };
      const enqueueDelta = (delta: string) => {
        pendingText += delta;
        if (!typingFrame) typingFrame = requestAnimationFrame(pumpTyping);
      };
      const res = await chatCompletionStream({
        providerId: provider ? config.provider : 'custom',
        apiKey: config.apiKey || undefined,
        model: config.model || provider?.defaultModel || 'openai',
        baseUrl: config.baseUrl || provider?.baseUrl,
        messages,
        onDelta: enqueueDelta
      });
      if (pendingText || typingFrame) {
        await new Promise<void>((resolve) => {
          const waitForTyping = () => {
            if (!pendingText && !typingFrame) resolve();
            else requestAnimationFrame(waitForTyping);
          };
          waitForTyping();
        });
      }
      result.value = res.content;
      const entry: CacheEntry = { data: res.content, time: Date.now() };
      cacheStore.set(cacheKey, entry);
      if (cacheStore.size > CACHE_MAX) {
        const oldest = cacheStore.keys().next().value;
        if (oldest !== undefined) cacheStore.delete(oldest);
      }
      savePersistentCache(cacheStore);
    } catch (e: any) {
      error.value = e?.message || '分析失败，请重试';
    } finally {
      loading.value = false;
    }
  }

  function clear() {
    loading.value = false;
    error.value = '';
    result.value = '';
    cached.value = false;
  }

  return { loading, error, result, cached, analyze, clear };
}

export function clearMetaphorCache() {
  cacheStore.clear();
  localStorage.removeItem(CACHE_KEY);
}
