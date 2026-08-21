const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DAY = 24 * 60 * 60 * 1000;
const MODEL_DEFS = [
  [
    'gpt-5.6-sol',
    'GPT 5.6 Sol',
    'https://sub.wessvan.com/v1',
    'gpt-5.6-sol',
    'DG_GPT_API_KEY',
    2,
    'relay'
  ],
  [
    'deepseek-v4-flash-0731',
    'DeepSeek V4 Flash 0731（官方别名）',
    'https://api.deepseek.com/v1',
    'deepseek-v4-flash',
    'DEEPSEEK_API_KEY',
    1,
    'deepseek'
  ],
  [
    'opencode-v4f',
    'OpenCode V4 Flash Free',
    'https://opencode.ai/zen/v1',
    'deepseek-v4-flash-free',
    'OPENCODE_API_KEY',
    0.8,
    'opencode'
  ],
  [
    'opencode-hy3',
    'OpenCode Hy3 Free',
    'https://opencode.ai/zen/v1',
    'hy3-free',
    'OPENCODE_API_KEY',
    0.4,
    'opencode'
  ],
  [
    'opencode-mimo-v2.5',
    'OpenCode MiMo V2.5 Free',
    'https://opencode.ai/zen/v1',
    'mimo-v2.5-free',
    'OPENCODE_API_KEY',
    0.5,
    'opencode'
  ],
  [
    'opencode-big-pickle',
    'OpenCode Big Pickle',
    'https://opencode.ai/zen/v1',
    'big-pickle',
    'OPENCODE_API_KEY',
    0.2,
    'opencode'
  ],
  [
    'opencode-nemotron-ultra',
    'OpenCode Nemotron 3 Ultra Free',
    'https://opencode.ai/zen/v1',
    'nemotron-3-ultra-free',
    'OPENCODE_API_KEY',
    0.2,
    'opencode'
  ],
  [
    'opencode-nemotron-lightning',
    'OpenCode Nemotron 3.5 Lightning Free',
    'https://opencode.ai/zen/v1',
    'nemotron-3.5-lightning-free',
    'OPENCODE_API_KEY',
    0.2,
    'opencode'
  ],
  [
    'opencode-muse-spark',
    'OpenCode Muse Spark Contributor Free',
    'https://opencode.ai/zen/v1',
    'muse-spark-1.2-contributor-free',
    'OPENCODE_API_KEY',
    0.2,
    'opencode'
  ],
  [
    'opencode-laguna',
    'OpenCode Laguna S 2.1 Free',
    'https://opencode.ai/zen/v1',
    'laguna-s-2.1-free',
    'OPENCODE_API_KEY',
    0.2,
    'opencode'
  ]
].map(([id, name, baseUrl, upstreamModel, keyEnv, multiplier, provider]) => ({
  id,
  name,
  baseUrl,
  upstreamModel,
  keyEnv,
  multiplier,
  provider,
  privacy: [
    'opencode-big-pickle',
    'opencode-mimo-v2.5',
    'opencode-hy3',
    'opencode-muse-spark'
  ].includes(id)
}));

function hash(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}
function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}
function signSessionPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}
function createSessionToken(userId, cookieHash, expiresAt, secret) {
  const payload = Buffer.from(JSON.stringify({ userId, cookieHash, expiresAt })).toString(
    'base64url'
  );
  return `${payload}.${signSessionPayload(payload, secret)}`;
}
function decodeSessionToken(token, secret) {
  const separator = token.indexOf('.');
  if (separator <= 0) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = signSessionPayload(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  )
    return null;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!value?.userId || !value?.expiresAt || Number(value.expiresAt) <= Date.now()) return null;
    return {
      userId: String(value.userId),
      cookieHash: String(value.cookieHash || ''),
      expiresAt: Number(value.expiresAt),
      concurrency: 0
    };
  } catch {
    return null;
  }
}
function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function createAiGatewayRouter(options = {}) {
  const router = express.Router();
  const sessions = new Map();
  const credits = new Map();
  const ipHits = new Map();
  const accessToken = String(
    options.accessToken || process.env.AI_GATEWAY_ACCESS_TOKEN || ''
  ).trim();
  const stateFile =
    process.env.AI_GATEWAY_STATE_FILE || path.join('/tmp', 'zephyrus-ai-credits.json');

  function loadCredits() {
    try {
      const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      Object.entries(data).forEach(([key, value]) => credits.set(key, value));
    } catch {}
  }
  function saveCredits() {
    try {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      const data = Object.fromEntries(credits.entries());
      const temp = `${stateFile}.${process.pid}.tmp`;
      fs.writeFileSync(temp, JSON.stringify(data));
      fs.renameSync(temp, stateFile);
    } catch (error) {
      console.error('[ai-gateway] credit persistence failed:', error.message);
    }
  }
  loadCredits();

  router.use((req, res, next) => {
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-AI-Access-Token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  router.use(express.json({ limit: '512kb' }));

  function requireAccess(req, res, next) {
    if (!accessToken)
      return res
        .status(503)
        .json({ error: { code: 'gateway_not_configured', message: 'AI 网关尚未配置访问 Token' } });
    const supplied = req.get('X-AI-Access-Token') || String(req.body?.accessToken || '');
    const suppliedBuffer = Buffer.from(supplied);
    const expectedBuffer = Buffer.from(accessToken);
    if (
      !supplied ||
      suppliedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      return res
        .status(401)
        .json({ error: { code: 'invalid_access_token', message: '共享访问 Token 无效' } });
    }
    next();
  }
  function rateLimit(req, res, next) {
    const now = Date.now();
    const key = req.ip || 'unknown';
    const list = (ipHits.get(key) || []).filter((time) => now - time < 60_000);
    if (list.length >= 60)
      return res.status(429).json({ error: { code: 'rate_limited', message: '请求过于频繁' } });
    list.push(now);
    ipHits.set(key, list);
    next();
  }
  function sessionFrom(req) {
    const token = String(req.get('Authorization') || '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    if (!token) return null;
    let session = sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      session = decodeSessionToken(token, accessToken);
      if (session) sessions.set(token, session);
    }
    if (!session || session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return null;
    }
    return { token, session };
  }
  function requireSession(req, res, next) {
    const found = sessionFrom(req);
    if (!found)
      return res.status(401).json({
        error: { code: 'session_expired', message: 'AI 会话已过期，请重新验证网易云账号' }
      });
    req.aiSession = found;
    next();
  }
  function availableModels() {
    return MODEL_DEFS.filter((model) => Boolean(process.env[model.keyEnv])).map((model) => ({
      id: model.id,
      object: 'model',
      name: model.name,
      provider: model.provider,
      multiplier: model.multiplier,
      privacy: model.privacy,
      privacyNotice: model.privacy
        ? '该免费模型可能将请求用于服务改进或训练，请勿提交敏感信息'
        : undefined
    }));
  }

  router.get('/models', requireAccess, (_req, res) =>
    res.json({ object: 'list', data: availableModels() })
  );
  router.get('/healthz', (_req, res) => res.json({ ok: true }));
  router.get('/readyz', (_req, res) => {
    const missing = MODEL_DEFS.filter((model) => !process.env[model.keyEnv]).map(
      (model) => model.id
    );
    res
      .status(missing.length === MODEL_DEFS.length ? 503 : 200)
      .json({ ok: missing.length < MODEL_DEFS.length, missing });
  });

  router.post('/session', requireAccess, rateLimit, async (req, res) => {
    const cookie = String(req.body?.cookie || '').trim();
    if (!cookie)
      return res
        .status(400)
        .json({ error: { code: 'cookie_required', message: '需要网易云 Cookie' } });
    try {
      const headers = {
        Cookie: cookie,
        'User-Agent': 'Mozilla/5.0 (ZephyrusPlayer)',
        Referer: 'https://music.163.com/'
      };
      // Reuse the local NetEase API login/status route. It owns weapi
      // encryption and csrf handling; raw GET requests are rejected even
      // when MUSIC_U is still valid.
      let response = null;
      try {
        const status = await axios.post(
          'http://127.0.0.1:3000/login/status',
          { cookie },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000,
            validateStatus: () => true
          }
        );
        const body = status?.data || {};
        const payload = body.data || body;
        const profile = body.profile || payload.profile || payload.data?.profile || null;
        const userId = String(
          profile?.userId ||
            body.account?.id ||
            payload.account?.id ||
            payload.data?.account?.id ||
            ''
        ).trim();
        if (
          status?.status === 200 &&
          (body.code === 200 || payload.code === 200 || userId) &&
          userId
        ) {
          response = { profile, userId };
        }
      } catch {
        // Continue with the public endpoint fallbacks below.
      }
      // /api/whoami is not a stable public endpoint. Keep account endpoint
      // fallbacks for installations where the bundled API is unavailable.
      const endpoints = [
        'https://music.163.com/api/nuser/account/get',
        'https://music.163.com/api/w/nuser/account/get'
      ];
      for (const endpoint of response ? [] : endpoints) {
        const candidate = await axios.get(endpoint, {
          headers,
          timeout: 10000,
          validateStatus: () => true
        });
        const candidateProfile = candidate.data?.profile || candidate.data?.data?.profile || null;
        const candidateUserId = String(
          candidateProfile?.userId ||
            candidate.data?.account?.id ||
            candidate.data?.data?.account?.id ||
            ''
        ).trim();
        if (candidate.status < 400 && candidateUserId) {
          response = { data: candidate.data, profile: candidateProfile, userId: candidateUserId };
          break;
        }
      }
      if (!response)
        return res.status(401).json({
          error: { code: 'netease_cookie_invalid', message: '网易云 Cookie 无效或已过期' }
        });
      const profile = response.profile;
      const userId = response.userId;
      const expiresAt = Date.now() + 7 * DAY;
      const cookieHash = hash(cookie);
      // Sign the session so every PM2 worker can validate it independently.
      const token = createSessionToken(userId, cookieHash, expiresAt, accessToken);
      sessions.set(token, {
        userId,
        cookieHash,
        expiresAt,
        concurrency: 0
      });
      const creditKey = `${userId}:${dayKey()}`;
      if (!credits.has(creditKey)) credits.set(creditKey, { userId, day: dayKey(), used: 0 });
      saveCredits();
      res.json({
        token,
        expiresAt,
        user: { id: userId, nickname: profile?.nickname || '' }
      });
    } catch (error) {
      res
        .status(502)
        .json({ error: { code: 'netease_unavailable', message: '网易云账号验证服务不可用' } });
    }
  });
  router.post('/session/revoke', requireSession, (req, res) => {
    sessions.delete(req.aiSession.token);
    res.json({ ok: true });
  });
  router.get('/credits', requireSession, (req, res) => {
    const key = `${req.aiSession.session.userId}:${dayKey()}`;
    const state = credits.get(key) || { used: 0 };
    res.json({
      total: 100,
      used: Number(state.used || 0),
      remaining: Math.max(0, 100 - Number(state.used || 0)),
      day: dayKey(),
      resetAt: `${dayKey()}T24:00:00.000Z`
    });
  });

  router.post('/chat/completions', requireSession, rateLimit, async (req, res) => {
    const model = MODEL_DEFS.find((entry) => entry.id === req.body?.model);
    if (!model || !process.env[model.keyEnv])
      return res.status(400).json({ error: { code: 'model_unavailable', message: '模型不可用' } });
    const session = req.aiSession.session;
    if (session.concurrency >= 4)
      return res
        .status(429)
        .json({ error: { code: 'concurrency_limit', message: '当前账号并发请求已达上限' } });
    const key = `${session.userId}:${dayKey()}`;
    const state = credits.get(key) || { userId: session.userId, day: dayKey(), used: 0 };
    if (Number(state.used || 0) + model.multiplier > 100)
      return res
        .status(402)
        .json({ error: { code: 'insufficient_credits', message: '今日积分不足' } });
    state.used = Math.round((Number(state.used || 0) + model.multiplier) * 10) / 10;
    credits.set(key, state);
    saveCredits();
    session.concurrency += 1;
    const controller = new AbortController();
    // `close` also fires after the request body has been fully received. Using
    // it here aborts otherwise valid upstream requests before they respond.
    // Only abort when the client actually cancels the request.
    req.on('aborted', () => controller.abort());
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    try {
      const upstream = await axios.post(
        `${model.baseUrl}/chat/completions`,
        { ...req.body, model: model.upstreamModel, stream: true },
        {
          responseType: 'stream',
          signal: controller.signal,
          timeout: 120000,
          headers: {
            Authorization: `Bearer ${process.env[model.keyEnv]}`,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream'
          },
          validateStatus: () => true
        }
      );
      if (upstream.status >= 400) {
        let text = '';
        upstream.data.on('data', (chunk) => {
          text += chunk.toString().slice(0, 500);
        });
        await new Promise((resolve) => upstream.data.on('end', resolve));
        return res
          .status(upstream.status)
          .json({ error: { code: 'upstream_error', message: text || '上游请求失败' } });
      }
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Connection', 'keep-alive');
      upstream.data.on('end', () => {
        session.concurrency = Math.max(0, session.concurrency - 1);
      });
      upstream.data.on('error', () => {
        session.concurrency = Math.max(0, session.concurrency - 1);
      });
      upstream.data.pipe(res);
      return;
    } catch (error) {
      console.error('[ai-gateway] upstream unavailable', {
        model: model.id,
        provider: model.provider,
        code: error?.code,
        status: error?.response?.status,
        message: error?.message
      });
      if (!res.headersSent)
        res
          .status(502)
          .json({ error: { code: 'upstream_unavailable', message: 'AI 上游服务不可用' } });
    } finally {
      if (!res.headersSent) session.concurrency = Math.max(0, session.concurrency - 1);
    }
  });
  return router;
}

module.exports = { createAiGatewayRouter, MODEL_DEFS };
