export interface GatewayModel {
  id: string;
  name: string;
  provider: string;
  multiplier: number;
  privacy?: boolean;
  privacyNotice?: string;
}

export interface GatewayCredits {
  total: number;
  used: number;
  remaining: number;
  day: string;
  resetAt: string;
}

const BASE_URL = String(
  import.meta.env.VITE_AI_GATEWAY_BASE_URL || 'https://mucang.xyz/v1'
).replace(/\/$/, '');
const SESSION_KEY = 'zephyrus-ai-gateway-session';

function getSession() {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (value?.token && Number(value.expiresAt) > Date.now()) return value;
  } catch {}
  return null;
}

function getAccessToken(accessToken?: string) {
  return accessToken?.trim() || localStorage.getItem('ai-gateway-access-token')?.trim() || '';
}

async function gatewayFetch(path: string, init: RequestInit = {}, accessToken?: string) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const shared = getAccessToken(accessToken);
  if (shared) headers.set('X-AI-Access-Token', shared);
  const session = getSession();
  if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `AI 网关请求失败 (${response.status})`;
    try {
      message = (await response.json())?.error?.message || message;
    } catch {}
    throw new Error(message);
  }
  return response;
}

export async function listGatewayModels(accessToken?: string): Promise<GatewayModel[]> {
  const response = await gatewayFetch('/models', {}, accessToken);
  const data = await response.json();
  return Array.isArray(data?.data) ? data.data : [];
}

export async function createGatewaySession(accessToken: string): Promise<void> {
  const cookie = localStorage.getItem('token') || '';
  if (!cookie) throw new Error('请先登录网易云账号');
  const response = await fetch(`${BASE_URL}/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AI-Access-Token': getAccessToken(accessToken)
    },
    body: JSON.stringify({ cookie })
  });
  if (!response.ok) {
    let message = `AI 会话创建失败 (${response.status})`;
    try {
      message = (await response.json())?.error?.message || message;
    } catch {}
    throw new Error(message);
  }
  const data = await response.json();
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ token: data.token, expiresAt: data.expiresAt })
  );
}

export async function getGatewayCredits(accessToken?: string): Promise<GatewayCredits> {
  const response = await gatewayFetch('/credits', {}, accessToken);
  return response.json();
}

export async function gatewayChatCompletion(
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  accessToken: string,
  signal?: AbortSignal,
  onDelta?: (delta: string) => void
) {
  if (!getSession()) await createGatewaySession(accessToken);
  let response: Response;
  try {
    response = await gatewayFetch(
      '/chat/completions',
      {
        method: 'POST',
        body: JSON.stringify({ model, messages, stream: true }),
        signal
      },
      accessToken
    );
  } catch (error) {
    // A session created before a gateway restart or by another PM2 worker can
    // be stale. Re-authenticate once instead of surfacing a false expiry to
    // the user; other errors are preserved unchanged.
    if (!(error instanceof Error) || !/会话已过期|session_expired/i.test(error.message))
      throw error;
    localStorage.removeItem(SESSION_KEY);
    await createGatewaySession(accessToken);
    response = await gatewayFetch(
      '/chat/completions',
      {
        method: 'POST',
        body: JSON.stringify({ model, messages, stream: true }),
        signal
      },
      accessToken
    );
  }
  if (!response.body) throw new Error('AI 网关没有返回流式内容');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  const consumeLine = (line: string) => {
    if (!line.startsWith('data:')) return;
    const value = line.slice(5).trim();
    if (!value || value === '[DONE]') return;
    try {
      const json = JSON.parse(value);
      const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.text;
      if (typeof delta === 'string' && delta) {
        content += delta;
        onDelta?.(delta);
      }
    } catch {
      // Ignore comments and incomplete provider frames.
    }
  };
  while (true) {
    const part = await reader.read();
    if (part.done) {
      buffer += decoder.decode();
      if (buffer) consumeLine(buffer);
      break;
    }
    buffer += decoder.decode(part.value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    lines.forEach(consumeLine);
  }
  if (!content) throw new Error('AI 网关返回了空内容');
  return { content, model, provider: 'gateway' };
}
