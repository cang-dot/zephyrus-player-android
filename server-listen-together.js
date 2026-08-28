/**
 * Zephyrus Listen-Together (一起听) relay service.
 *
 * Integration differs slightly between environments:
 *   - Local repo gateway (see server-platform-login.js): REST routes mounted
 *     at /platform/listen/*, MCP at /platform/mcp/<roomCode> and /mcp/<code>.
 *   - Production (mucang.xyz): netease-api's server.js mounts the
 *     platformLogin router at /platform; platformLogin.js nests these two
 *     routers with router.use('/listen', ...) and router.use('/mcp', ...).
 *
 * Transport model (HTTP polling, WebSocket-free so it works behind plain nginx):
 *   - Clients join a room with a unique room code (also shared through QR /
 *     deep link exactly like song sharing).
 *   - Every 5s each client POSTs its authoritative playback snapshot
 *     (song info / position / paused / volume / loudness + LRC text on change).
 *   - Instant republish happens on seek / play-pause toggle / track change.
 *   - Server stores the newest snapshot per room; every response echoes the
 *     merged room snapshot plus `serverTime` so clients can do clock-offset
 *     correction and converge onto whoever published most recently.
 *   - An AI assistant can "listen together" passively by calling the MCP tool
 *     with the room code; it can only READ current progress, song info,
 *     LRC lyrics and loudness.
 *
 * Storage: the in-memory Map is the source of truth; a JSON file (atomic
 * tmp+rename writes, debounced & async) is only used to restore state after a
 * process restart.
 * 注意：部署 pm2 cluster 时请 workers=1 —— 多 worker 进程各自持有内存副本，
 * 文件持久化不保证跨进程一致（丢失的更新由客户端 ≤5s 心跳自愈）。
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOM_TTL_MS = 15 * 60 * 1000; // room deleted after 15 min without activity
const MEMBER_ONLINE_MS = 30 * 1000; // member considered online within 30s
const MEMBER_STALE_MS = 30 * 60 * 1000; // member removed after 30 min without heartbeat
const MEMBER_LIMIT = 100; // 单房间成员上限，满员拒绝新成员加入
const SAVE_DEBOUNCE_MS = 500; // 持久化防抖间隔
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous chars

const STORE_FILE =
  process.env.LISTEN_ROOMS_FILE || path.join(os.tmpdir(), 'zephyrus_listen_rooms.json');

/** @type {Map<string, Room>} */
const rooms = new Map();

function randomCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i += 1) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// ---------------------------------------------------------------------------
// Store: in-memory authoritative + debounced async persistence.
// 启动时 loadStore 一次到内存，此后所有变更仅在内存 Map 上进行；
// 持久化通过防抖（500ms）异步写盘（fs.promises.writeFile + 原子 rename），
// 写入失败仅记录日志，不阻塞事件循环、不影响服务。
// ---------------------------------------------------------------------------

function loadStore() {
  let raw;
  try {
    raw = fs.readFileSync(STORE_FILE, 'utf8');
  } catch {
    return; // no store yet
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return; // corrupted store: keep in-memory copy
  }
  rooms.clear();
  for (const [code, r] of Object.entries(data.rooms || {})) {
    if (!r || typeof r !== 'object' || !r.code) continue;
    rooms.set(code, {
      code: r.code,
      hostName: String(r.hostName || ''),
      startedAt: Number(r.startedAt) || Date.now(),
      lastActivity: Number(r.lastActivity) || Date.now(),
      members: new Map(Object.entries(r.members || {})),
      state: r.state || null,
      lrc: r.lrc || null,
      lrcSongId: r.lrcSongId || null
    });
  }
}

function serializeStore() {
  const data = { savedAt: Date.now(), rooms: {} };
  for (const [code, r] of rooms) {
    data.rooms[code] = {
      code: r.code,
      hostName: r.hostName,
      startedAt: r.startedAt,
      lastActivity: r.lastActivity,
      members: Object.fromEntries(r.members),
      state: r.state,
      lrc: r.lrc,
      lrcSongId: r.lrcSongId
    };
  }
  return JSON.stringify(data);
}

let saveChain = Promise.resolve();
function saveStore() {
  // 异步写 + 原子 rename（tmp→rename）；用 promise 链串行化，避免并发写同一临时文件
  const tmp = `${STORE_FILE}.${process.pid}.tmp`;
  const payload = serializeStore();
  saveChain = saveChain
    .then(() => fs.promises.writeFile(tmp, payload).then(() => fs.promises.rename(tmp, STORE_FILE)))
    .catch((e) => {
      console.error('[listen-together] failed to persist store:', e && e.message);
    });
  return saveChain;
}

let saveTimer = null;
function scheduleSave() {
  // 防抖：500ms 内的多次变更合并为一次落盘
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveStore();
  }, SAVE_DEBOUNCE_MS);
  saveTimer.unref?.();
}

function pruneRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    // 清理超过 30 分钟未上报心跳的成员（此前成员只增不减）
    for (const [peerId, member] of room.members) {
      if (now - member.lastSeen > MEMBER_STALE_MS) room.members.delete(peerId);
    }
    if (now - room.lastActivity > ROOM_TTL_MS) rooms.delete(code);
  }
}

/** 内存权威：mutate 前清理过期数据，mutate 后仅调度防抖持久化（不再同步读写文件）。 */
function withStore(mutate) {
  pruneRooms();
  const result = mutate();
  scheduleSave();
  return result;
}

// 启动时加载一次历史房间到内存（此后内存为权威数据源）
loadStore();

function sanitizeState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const num = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const str = (v) => (typeof v === 'string' ? String(v).slice(0, 500) : '');
  const artists = Array.isArray(raw.artists)
    ? raw.artists
        .slice(0, 10)
        .map((a) => String(a || '').slice(0, 100))
        .filter(Boolean)
    : [];
  return {
    peerId: str(raw.peerId).slice(0, 64),
    name: str(raw.name).slice(0, 64),
    ts: num(raw.ts), // publisher-local wallclock ms
    seq: num(raw.seq),
    songId: str(raw.songId),
    songName: str(raw.songName),
    artists,
    album: str(raw.album),
    picUrl: str(raw.picUrl),
    duration: num(raw.duration),
    position: Math.max(0, num(raw.position)),
    isPaused: Boolean(raw.isPaused),
    volume: Math.min(100, Math.max(0, num(raw.volume))),
    loudness: raw.loudness === null || raw.loudness === undefined ? null : num(raw.loudness)
  };
}

function createRoomSnapshot(room) {
  const now = Date.now();
  return {
    code: room.code,
    hostName: room.hostName,
    startedAt: room.startedAt,
    listenedMs: Math.max(0, now - room.startedAt),
    serverTime: now,
    members: Array.from(room.members.values()).map((m) => ({
      id: m.id,
      name: m.name,
      joinedAt: m.joinedAt,
      online: now - m.lastSeen <= MEMBER_ONLINE_MS
    })),
    state: room.state
      ? {
          ...room.state,
          receivedAt: room.state.receivedAt // server clock anchor of position
        }
      : null
  };
}

function touchMember(room, peerId, name) {
  const existing = room.members.get(peerId);
  if (existing) {
    if (name && name !== existing.name) existing.name = name;
    existing.lastSeen = Date.now();
  } else {
    room.members.set(peerId, {
      id: peerId,
      name: name || peerId,
      joinedAt: Date.now(),
      lastSeen: Date.now()
    });
  }
}

// ---------------------------------------------------------------------------
// 按 IP 限流（令牌桶）：平均每秒 2 次、突发容量 10，应用于 /create、/join、/sync、/room/:code。
// ---------------------------------------------------------------------------
const RATE_LIMIT_RATE = 2; // 每秒补充令牌数
const RATE_LIMIT_BURST = 10; // 令牌桶容量
const rateBuckets = new Map();

function requestClientIp(req) {
  // 与 server-platform-login.js 的 requestClientIp 逻辑保持一致：
  // trust proxy 启用时 req.ip 即真实客户端 IP；否则取 X-Forwarded-For 末段
  //（由可信 nginx 追加），避免首段伪造。
  if (req.app?.get('trust proxy') && req.ip) return req.ip;
  const segments = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return segments[segments.length - 1] || req.ip || req.socket?.remoteAddress || 'unknown';
}

function pruneRateBuckets(now) {
  // 回收 10 分钟未活跃的桶，防止 Map 无限增长
  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.last > 10 * 60 * 1000) rateBuckets.delete(key);
  }
}

function rateLimitByIp(req, res, next) {
  const now = Date.now();
  if (rateBuckets.size > 1000) pruneRateBuckets(now);
  const key = requestClientIp(req);
  let bucket = rateBuckets.get(key);
  if (!bucket) {
    bucket = { tokens: RATE_LIMIT_BURST, last: now };
    rateBuckets.set(key, bucket);
  }
  // 按流逝时间补充令牌
  bucket.tokens = Math.min(
    RATE_LIMIT_BURST,
    bucket.tokens + ((now - bucket.last) / 1000) * RATE_LIMIT_RATE
  );
  bucket.last = now;
  if (bucket.tokens < 1) {
    return res.status(429).json({ code: 429, msg: '请求过于频繁，请稍后重试' });
  }
  bucket.tokens -= 1;
  next();
}

// ---------------------------------------------------------------------------
// REST routes (mounted at /platform/listen)
// ---------------------------------------------------------------------------

function createListenTogetherRouter() {
  const router = express.Router();
  // LRC payloads can be sizeable; be generous but bounded.
  router.use(express.json({ limit: '768kb' }));

  // Create a room. Body: {name}. Returns {code, peerId}.
  router.post('/create', rateLimitByIp, (req, res) => {
    const name = String((req.body && req.body.name) || '').slice(0, 64) || '听众';
    const peerId = crypto.randomUUID();
    const data = withStore(() => {
      let code = randomCode();
      while (rooms.has(code)) code = randomCode(); // defensive against collision
      const room = {
        code,
        hostName: name,
        startedAt: Date.now(),
        lastActivity: Date.now(),
        members: new Map(),
        state: null,
        lrc: null,
        lrcSongId: null
      };
      touchMember(room, peerId, name);
      rooms.set(code, room);
      return { code, peerId, room: createRoomSnapshot(room) };
    });
    res.json({ code: 0, msg: 'ok', data });
  });

  // Join an existing room. Body: {code, name}.
  router.post('/join', rateLimitByIp, (req, res) => {
    const code = String((req.body && req.body.code) || '')
      .toUpperCase()
      .trim();
    const name = String((req.body && req.body.name) || '').slice(0, 64) || '听众';
    const data = withStore(() => {
      const room = rooms.get(code);
      if (!room) return null;
      // 单房间成员上限：满员拒绝加入（返回 4xx）
      if (room.members.size >= MEMBER_LIMIT) return { error: '房间成员已达上限' };
      const peerId = crypto.randomUUID();
      touchMember(room, peerId, name);
      room.lastActivity = Date.now();
      return { code, peerId, room: createRoomSnapshot(room) };
    });
    if (!data) return res.status(404).json({ code: 40404, msg: '房间不存在或已过期' });
    if (data.error) return res.status(400).json({ code: 40001, msg: data.error });
    res.json({ code: 0, msg: 'ok', data });
  });

  // Heartbeat + publish local playback state.
  // Body: {code, peerId, name?, state?, lrc?, lrcSongId?}
  // Response always carries merged snapshot + serverTime (for clock sync).
  router.post('/sync', rateLimitByIp, (req, res) => {
    const body = req.body || {};
    const { state, lrc, lrcSongId } = body;
    // peerId / name 截断至 64 字符（touchMember 前完成校验），防止超长字段写入存储
    const peerId = String(body.peerId || '').slice(0, 64);
    const memberName = String(body.name || '').slice(0, 64);
    const normalized = String(body.code || '')
      .toUpperCase()
      .trim();
    const data = withStore(() => {
      const room = rooms.get(normalized);
      if (!room) return null;
      if (!peerId) return { error: 'missing peerId' };
      // 单房间成员上限：满员时拒绝新成员加入（老成员正常续期），返回 4xx
      if (!room.members.has(peerId) && room.members.size >= MEMBER_LIMIT) {
        return { error: '房间成员已达上限' };
      }
      room.lastActivity = Date.now();

      const snap = sanitizeState(state);
      if (snap) {
        snap.receivedAt = Date.now();
        // Converge onto the freshest publication. Ties broken by seq then
        // peerId so all members deterministically pick the same winner.
        const cur = room.state;
        if (
          !cur ||
          snap.ts > cur.ts ||
          (snap.ts === cur.ts &&
            (snap.seq > cur.seq || (snap.seq === cur.seq && snap.peerId > cur.peerId)))
        ) {
          room.state = snap;
        }
      }
      if (typeof lrc === 'string' && lrc.length < 700000) {
        room.lrc = lrc.slice(0, 700000);
        room.lrcSongId = String(lrcSongId || '');
      }
      touchMember(room, peerId, memberName);

      return { room: createRoomSnapshot(room), myPeerId: peerId };
    });

    if (!data) return res.status(404).json({ code: 40404, msg: '房间不存在或已过期' });
    if (data.error) return res.status(400).json({ code: 40001, msg: data.error });
    res.json({ code: 0, msg: 'ok', data });
  });

  // Read-only room peek (used by relay page preview & diagnostics).
  router.get('/room/:code', rateLimitByIp, (req, res) => {
    const data = withStore(() => {
      const room = rooms.get(
        String(req.params.code || '')
          .toUpperCase()
          .trim()
      );
      if (!room) return null;
      room.lastActivity = Date.now();
      return { room: createRoomSnapshot(room) };
    });
    if (!data) return res.status(404).json({ code: 40404, msg: '房间不存在或已过期' });
    res.json({ code: 0, msg: 'ok', data });
  });

  // Leave room (best-effort housekeeping).
  router.post('/leave', (req, res) => {
    const { code, peerId } = req.body || {};
    withStore(() => {
      const room = rooms.get(
        String(code || '')
          .toUpperCase()
          .trim()
      );
      if (room && peerId) {
        room.members.delete(String(peerId));
        room.lastActivity = Date.now();
      }
    });
    res.json({ code: 0, msg: 'ok' });
  });

  return router;
}

// ---------------------------------------------------------------------------
// Minimal MCP (Streamable HTTP, JSON responses) mounted at /platform/mcp/<code>
// (and /mcp/<code> in the local repo gateway).
//
// Read-only tools so an external AI agent can "listen together" with the user:
// it receives current progress, song info, LRC lyrics and loudness.
// ---------------------------------------------------------------------------

const NOW_PLAYING_TOOL = {
  name: 'listen_together_now_playing',
  title: '获取一起听房间当前播放状态',
  description:
    '查询 Zephyrus「一起听」房间的实时播放状态。返回：歌曲信息（歌名/歌手/专辑/封面/时长）、当前播放进度（秒）、是否暂停、音量与实时响度、完整 LRC 歌词文本，以及在线成员与一起听时长。调用方仅需提供房间识别码。',
  inputSchema: {
    type: 'object',
    properties: {
      comment: {
        type: 'string',
        description: '可选，无需填写'
      }
    },
    required: []
  }
};

function buildNowPlayingPayload(room) {
  const snap = createRoomSnapshot(room);
  const st = snap.state;
  return {
    room: {
      code: snap.code,
      hostName: snap.hostName,
      members: snap.members,
      listenedMs: snap.listenedMs,
      onlineCount: snap.members.filter((m) => m.online).length
    },
    playing: st
      ? {
          song: {
            id: st.songId,
            name: st.songName,
            artists: st.artists,
            album: st.album,
            picUrl: st.picUrl,
            durationSec: st.duration
          },
          // Position advanced to "now" on the server timeline.
          positionSec: st.isPaused
            ? Math.min(st.position, st.duration || st.position)
            : Math.min(st.position + (Date.now() - st.receivedAt) / 1000, st.duration || Infinity),
          reportedPositionSec: st.position,
          isPaused: st.isPaused,
          reportedBy: st.name,
          updatedAtServerMs: st.receivedAt
        }
      : null,
    loudness: st ? { volumePercent: st.volume, realtimeLoudness: st.loudness } : null,
    lrc: room.lrc || null,
    lrcFormat: 'lrc',
    fetchedAtServerMs: Date.now()
  };
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function handleJsonRpc(roomCode, body) {
  const { id, method, params } = body || {};
  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: (params && params.protocolVersion) || '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'zephyrus-listen-together', version: '1.0.0' },
          instructions:
            'Zephyrus 「一起听」只读 MCP。使用 listen_together_now_playing 工具即可随用户同步收听，可按需每 5 秒轮询一次以跟随进度。'
        }
      };
    case 'notifications/initialized':
      return undefined; // notification -> no response body needed
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: [NOW_PLAYING_TOOL] } };
    case 'tools/call': {
      const name = params && params.name;
      if (name !== NOW_PLAYING_TOOL.name) {
        return jsonRpcError(id, -32602, `Unknown tool: ${name}`);
      }
      const data = withStore(() => {
        const room = rooms.get(
          String(roomCode || '')
            .toUpperCase()
            .trim()
        );
        if (!room) return null;
        room.lastActivity = Date.now();
        return buildNowPlayingPayload(room);
      });
      if (!data) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [
              {
                type: 'text',
                text: `房间 ${roomCode} 不存在或已过期（15 分钟无活动自动销毁）。请让用户重新分享房间码。`
              }
            ]
          }
        };
      }
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
      };
    }
    default:
      if (id === undefined || id === null) return undefined;
      return jsonRpcError(id, -32601, `Method not found: ${method}`);
  }
}

function createListenTogetherMcpRouter() {
  const router = express.Router();
  router.use(express.json({ limit: '128kb', type: ['application/json'] }));

  // Streamable HTTP style: everything arrives via POST; we answer plain JSON
  // (single response mode is valid per spec for servers without streams/SSE).
  router.post('/:roomCode', (req, res) => {
    const body = req.body;
    const items = Array.isArray(body) ? body : [body];
    const answers = items.map((item) => handleJsonRpc(req.params.roomCode, item)).filter(Boolean);
    if (answers.length === 0) return res.status(202).end();
    res.json(Array.isArray(body) ? answers : answers[0]);
  });

  router.get('/:roomCode', (_req, res) => {
    res
      .status(405)
      .json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'SSE not supported; use POST per Streamable HTTP.' }
      });
  });

  return router;
}

module.exports.createListenTogetherRouter = createListenTogetherRouter;
module.exports.createListenTogetherMcpRouter = createListenTogetherMcpRouter;
module.exports._internals = {
  rooms,
  randomCode,
  sanitizeState,
  buildNowPlayingPayload,
  STORE_FILE
};
