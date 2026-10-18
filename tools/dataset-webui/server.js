/**
 * dataset-webui server — 内网数据集工具（搜索/爬取/标注/导出）。
 * Node ≥18，零 npm 依赖：node server.js [--port 8787]
 *
 * 端点：
 *   GET  /                    静态 UI（public/index.html）
 *   GET  /api/search?kw=      网易云搜索（服务端带 UA/Referer，无 CORS 问题）
 *   GET  /api/playlist?id=    网易云歌单曲目批量拉取
 *   GET  /api/song-url?id=    解析播放直链
 *   GET  /api/download?id=&url=  服务端拉取音频存盘 dataset/{id}.{ext}
 *   GET  /dataset/{file}      同源回放音频（支持 Range）
 *   GET  /api/annotations     标注列表；POST 同路径保存单条
 *   GET  /api/export          打包 {manifest, items} 下载
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const PORT = Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : process.env.PORT || 8787);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATASET_DIR = path.join(ROOT, 'dataset');
const ANNOTATION_DIR = path.join(DATASET_DIR, 'annotations');
for (const dir of [DATASET_DIR, ANNOTATION_DIR]) fs.mkdirSync(dir, { recursive: true });

const NETEASE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Referer: 'https://music.163.com/',
  Cookie: 'os=pc; appver=2.9.7;'
};

function sendJson(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

async function neteaseJson(endpoint) {
  const response = await fetch(endpoint, { headers: NETEASE_HEADERS });
  if (!response.ok) throw new Error(`netease ${response.status}`);
  return response.json();
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.json': 'application/json; charset=utf-8'
};

function extFromUrlOrType(target, contentType) {
  const fromUrl = (target.split('?')[0].match(/\.(mp3|m4a|flac|ogg|wav)$/i) || [])[1];
  if (fromUrl) return fromUrl.toLowerCase();
  if (/mp4|m4a/.test(contentType)) return 'm4a';
  if (/flac/.test(contentType)) return 'flac';
  if (/ogg/.test(contentType)) return 'ogg';
  if (/wav/.test(contentType)) return 'wav';
  return 'mp3';
}

/** 音频文件按 Range 回放（<audio> 拖动定位需要 206） */
function serveAudio(req, res, filePath) {
  const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
  if (!stat) {
    res.writeHead(404).end('not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    if (isNaN(start) || start > end || end >= stat.size) {
      start = 0;
      end = stat.size - 1;
    }
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'Content-Length': stat.size
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

async function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function downloadAudio(songId, audioUrl) {
  if (!audioUrl) throw new Error('缺少音频 URL');
  const response = await fetch(audioUrl, { headers: { ...NETEASE_HEADERS } });
  if (!response.ok) throw new Error(`音频源返回 ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (/text\/html/i.test(contentType)) throw new Error('音源返回了网页（可能需要 VIP/版权不可用）');
  const ext = extFromUrlOrType(audioUrl, contentType);
  const file = `${String(songId).replace(/[^\w.-]/g, '_')}.${ext}`;
  const filePath = path.join(DATASET_DIR, file);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 16 * 1024) throw new Error(`音频过小(${buffer.length}B)，疑似失败占位`);
  fs.writeFileSync(filePath, buffer);
  return { file, size: buffer.length };
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsed.pathname);
  try {
    // ---------- API ----------
    if (pathname === '/api/search') {
      const kw = parsed.searchParams.get('kw') || '';
      if (!kw.trim()) return sendJson(res, 200, { songs: [] });
      const data = await neteaseJson(
        `https://music.163.com/api/search/get/?s=${encodeURIComponent(kw)}&type=1&offset=0&limit=30`
      );
      const songs = (data.result?.songs || []).map((s) => ({
        id: s.id,
        name: s.name,
        artist: (s.artists || []).map((a) => a.name).join('/'),
        album: s.album?.name || '',
        duration: s.duration || 0
      }));
      return sendJson(res, 200, { songs });
    }

    if (pathname === '/api/playlist') {
      const id = parsed.searchParams.get('id') || '';
      if (!id) return sendJson(res, 400, { error: '缺少歌单 id' });
      const data = await neteaseJson(`https://music.163.com/api/playlist/detail?id=${id}`);
      const tracks = (data.result?.tracks || []).map((s) => ({
        id: s.id,
        name: s.name,
        artist: (s.artists || []).map((a) => a.name).join('/'),
        album: s.album?.name || '',
        duration: s.duration || 0
      }));
      return sendJson(res, 200, { name: data.result?.name || '', tracks });
    }

    if (pathname === '/api/song-url') {
      const id = parsed.searchParams.get('id') || '';
      if (!id) return sendJson(res, 400, { error: '缺少歌曲 id' });
      let data;
      try {
        data = await neteaseJson(
          `https://music.163.com/api/song/enhance/player/url?ids=[${id}]&br=320000`
        );
      } catch {
        // 某些节点对 GET 敏感，退回 POST 表单
        const response = await fetch('https://music.163.com/api/song/enhance/player/url', {
          method: 'POST',
          headers: {
            ...NETEASE_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `ids=[${id}]&br=320000`
        });
        data = await response.json();
      }
      const item = (data.data || [])[0] || {};
      return sendJson(res, 200, {
        url: item.url || '',
        type: item.type || '',
        size: item.size || 0,
        code: item.code || data.code || 0
      });
    }

    if (pathname === '/api/download') {
      const id = parsed.searchParams.get('id') || '';
      let target = parsed.searchParams.get('url') || '';
      if (!id) return sendJson(res, 400, { error: '缺少歌曲 id' });
      if (!target) {
        const resolved = await neteaseJson(
          `https://music.163.com/api/song/enhance/player/url?ids=[${id}]&br=320000`
        ).catch(() => null);
        target = resolved?.data?.[0]?.url || '';
      }
      const result = await downloadAudio(id, target);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/files') {
      const files = (fs.existsSync(DATASET_DIR) ? fs.readdirSync(DATASET_DIR) : [])
        .filter((f) => /\.(mp3|m4a|flac|ogg|wav)$/i.test(f))
        .map((f) => ({ file: f }));
      return sendJson(res, 200, { files });
    }

    if (pathname === '/api/annotations' && req.method === 'GET') {
      const files = fs.existsSync(ANNOTATION_DIR) ? fs.readdirSync(ANNOTATION_DIR) : [];
      const items = files
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
          try {
            return JSON.parse(fs.readFileSync(path.join(ANNOTATION_DIR, f), 'utf8'));
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      return sendJson(res, 200, { items });
    }

    if (pathname === '/api/annotations' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      if (!body.id) return sendJson(res, 400, { error: '缺少 id' });
      body.savedAt = Date.now();
      const file = path.join(ANNOTATION_DIR, `${String(body.id).replace(/[^\w.-]/g, '_')}.json`);
      fs.writeFileSync(file, JSON.stringify(body, null, 2));
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/export' && req.method === 'GET') {
      const files = fs.existsSync(ANNOTATION_DIR) ? fs.readdirSync(ANNOTATION_DIR) : [];
      const items = files
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(fs.readFileSync(path.join(ANNOTATION_DIR, f), 'utf8')))
        .filter((x) => x && Array.isArray(x.sections));
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="dataset-export-${Date.now()}.json"`
      });
      res.end(
        JSON.stringify(
          {
            manifest: {
              version: 1,
              labelSet: ['intro', 'verse', 'prechorus', 'chorus', 'bridge', 'interlude', 'outro'],
              exportedAt: new Date().toISOString(),
              count: items.length
            },
            items
          },
          null,
          2
        )
      );
      return;
    }

    // ---------- 音频回放 ----------
    if (pathname.startsWith('/dataset/')) {
      const file = path.basename(pathname.slice('/dataset/'.length));
      return serveAudio(req, res, path.join(DATASET_DIR, file));
    }

    // ---------- 静态 ----------
    const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = path.join(PUBLIC_DIR, path.basename(rel));
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'text/plain; charset=utf-8' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    res.writeHead(404).end('not found');
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(PORT, () => {
  console.log(`[dataset-webui] http://0.0.0.0:${PORT}  数据目录: ${DATASET_DIR}`);
});
