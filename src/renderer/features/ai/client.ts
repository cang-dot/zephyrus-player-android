import { type AIProvider,getProvider } from './providers';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  providerId: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  model: string;
  provider: string;
}

export async function chatCompletion(options: ChatOptions): Promise<ChatResult> {
  const { model, baseUrl, headers, provider } = await resolveProviderEndpoint(options);

  if (provider.needApiKey && !options.apiKey) {
    throw new Error(`${provider.name} 需要 API 密钥，请在设置中配置`);
  }
  if (provider.id === 'gemini') {
    return geminiChat(baseUrl, model, options.apiKey || '', options.messages, options.signal);
  }

  return openaiChat(baseUrl, model, options.apiKey, options.messages, options.signal, headers);
}

/** 解析 provider 预设与自定义覆盖,得到请求端点(模型/地址/附加头) */
async function resolveProviderEndpoint(options: ChatOptions): Promise<{
  model: string;
  baseUrl: string;
  headers: Record<string, string>;
  provider: AIProvider;
}> {
  const provider = getProvider(options.providerId);
  if (!provider && options.providerId !== 'custom') {
    throw new Error(`未知的 AI 提供商: ${options.providerId}`);
  }

  const p: AIProvider = provider || {
    id: 'custom',
    name: '自定义',
    baseUrl: options.baseUrl || '',
    defaultModel: options.model || '',
    needApiKey: false,
    description: ''
  };

  const model = options.model || p.defaultModel;
  const baseUrl = options.baseUrl || p.baseUrl;

  if (!baseUrl) {
    throw new Error('未配置 API 地址');
  }

  const headers: Record<string, string> = {};
  if (p.id === 'github-models') {
    headers['Accept'] = 'application/vnd.github+json';
    headers['X-GitHub-Api-Version'] = '2022-11-28';
  }

  return { model, baseUrl, headers, provider };
}

/**
 * OpenAI 兼容流式对话(SSE):delta 经 onDelta 增量回调,
 * 返回完整文本。BYOK 模式下的唯一流式请求层。
 */
export async function chatCompletionStream(
  options: ChatOptions & { onDelta?: (delta: string, full: string) => void }
): Promise<ChatResult> {
  const { model, baseUrl, headers, provider } = await resolveProviderEndpoint(options);

  if (provider.needApiKey && !options.apiKey) {
    throw new Error(`${provider.name} 需要 API 密钥，请在设置中配置`);
  }
  if (provider.id === 'gemini') {
    const result = await geminiChat(baseUrl, model, options.apiKey || '', options.messages, options.signal);
    options.onDelta?.(result.content, result.content);
    return result;
  }

  const url = `${baseUrl}/chat/completions`;
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers
  };
  if (options.apiKey) {
    requestHeaders['Authorization'] = `Bearer ${options.apiKey}`;
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify({ model, messages: options.messages, stream: true }),
    signal: options.signal
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`API 请求失败 (${resp.status}): ${errText.slice(0, 200)}`);
  }
  if (!resp.body) {
    throw new Error('当前环境不支持流式响应');
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content || '';
        if (delta) {
          full += delta;
          options.onDelta?.(delta, full);
        }
      } catch {
        // 忽略无法解析的心跳/注释行
      }
    }
  }

  if (!full) {
    throw new Error('API 返回了空内容');
  }
  return { content: full, model, provider: 'openai' };
}

async function openaiChat(
  baseUrl: string,
  model: string,
  apiKey: string | undefined,
  messages: ChatMessage[],
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>
): Promise<ChatResult> {
  const url = `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const body = JSON.stringify({
    model,
    messages,
    stream: false
  });

  const resp = await fetch(url, { method: 'POST', headers, body, signal });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`API 请求失败 (${resp.status}): ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || '';
  if (!content) {
    throw new Error('API 返回了空内容');
  }

  return { content, model: data?.model || model, provider: 'openai' };
}

async function geminiChat(
  baseUrl: string,
  model: string,
  apiKey: string,
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<ChatResult> {
  const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const body = JSON.stringify({ contents });
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Gemini API 请求失败 (${resp.status}): ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!content) {
    throw new Error('Gemini API 返回了空内容');
  }

  return { content, model, provider: 'gemini' };
}
