import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const generatedDir = path.join(root, 'generated');
const outputDir = path.join(root, 'output');
const copyPath = path.resolve(root, '../voice/tts-copy.txt');
const stylePath = path.resolve(root, '../voice/tts-style.txt');
const referencePath = process.env.ZEPHYRUS_REFERENCE_AUDIO || 'C:\\Users\\Administrator\\Desktop\\Tt\\yinlang_voice.mp3';
const port = Number(process.env.PORT || 4177);

const json = (res, status, data) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
};

const safeError = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/sk-[A-Za-z0-9]{12,}/g, '[API KEY REDACTED]').slice(0, 1200);
};

const readBody = async (req) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error('请求内容超过 1 MB。');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
};

const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { windowsHide: true });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) resolve();
    else reject(new Error(`${command} 执行失败：${stderr.slice(-800)}`));
  });
});

const parseSentences = (copy) => copy
  .split(/\r?\n|(?<=[。！？])/u)
  .map((line) => line.trim())
  .filter(Boolean);

const listVersions = async (id) => {
  const prefix = `line-${String(id).padStart(2, '0')}-v`;
  const entries = await fs.readdir(generatedDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.wav'))
    .map((entry) => entry.name)
    .sort()
    .reverse();
};

const nextVersion = async (id) => {
  const versions = await listVersions(id);
  const latest = versions[0]?.match(/-v(\d+)\.wav$/)?.[1];
  return Number(latest || 0) + 1;
};

const sendFile = async (res, file, contentType) => {
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, { 'content-type': contentType, 'cache-control': contentType.startsWith('audio/') ? 'no-store' : 'no-cache' });
    res.end(body);
  } catch {
    json(res, 404, { error: '文件不存在。' });
  }
};

const generateLine = async ({ id, text, style, apiKey }) => {
  if (!Number.isInteger(id) || id < 1 || id > 99) throw new Error('句子编号无效。');
  if (typeof text !== 'string' || !text.trim() || text.length > 600) throw new Error('句子内容无效。');
  if (typeof style !== 'string' || !style.trim() || style.length > 1200) throw new Error('语气指令无效。');
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('请填写 MiMo API Key。');
  if (!existsSync(referencePath)) throw new Error(`找不到参考音频：${referencePath}`);

  const referenceBytes = await fs.readFile(referencePath);
  const referenceBase64 = referenceBytes.toString('base64');
  if (Buffer.byteLength(referenceBase64) > 10 * 1024 * 1024) throw new Error('参考音频 Base64 超过 MiMo 10 MB 限制。');

  const response = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'api-key': apiKey.trim(), 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'mimo-v2.5-tts-voiceclone',
      messages: [
        { role: 'user', content: style.trim() },
        { role: 'assistant', content: text.trim() }
      ],
      audio: { format: 'wav', voice: `data:audio/mpeg;base64,${referenceBase64}` }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MiMo 返回 ${response.status}：${body.slice(0, 500)}`);
  }

  const result = await response.json();
  const audioBase64 = result?.choices?.[0]?.message?.audio?.data;
  if (typeof audioBase64 !== 'string' || !audioBase64) throw new Error('MiMo 响应中没有音频数据。');
  const rawBytes = Buffer.from(audioBase64, 'base64');
  if (rawBytes.length < 44 || rawBytes.subarray(0, 4).toString('ascii') !== 'RIFF') throw new Error('MiMo 返回的 WAV 无效。');

  const version = await nextVersion(id);
  const base = `line-${String(id).padStart(2, '0')}-v${String(version).padStart(3, '0')}`;
  const rawPath = path.join(generatedDir, `${base}.raw.wav`);
  const finalPath = path.join(generatedDir, `${base}.wav`);
  await fs.writeFile(rawPath, rawBytes);
  try {
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', rawPath, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', finalPath]);
  } finally {
    await fs.rm(rawPath, { force: true });
  }
  return { filename: `${base}.wav`, requestId: result?.id || null };
};

const completeAudio = async (selections) => {
  if (!Array.isArray(selections) || selections.length === 0) throw new Error('没有可合成的句子。');
  const buildDir = await fs.mkdtemp(path.join(root, 'build-'));
  const concatPath = path.join(buildDir, 'concat.txt');
  const files = [];
  try {
    for (let index = 0; index < selections.length; index += 1) {
      const item = selections[index];
      if (!/^line-\d{2}-v\d{3}\.wav$/.test(item.filename || '')) throw new Error(`第 ${index + 1} 句尚未选择有效音频。`);
      const source = path.join(generatedDir, item.filename);
      if (!existsSync(source)) throw new Error(`找不到第 ${index + 1} 句的音频。`);
      files.push(source);
      const gapMs = Math.max(0, Math.min(3000, Number(item.gapMs) || 0));
      if (gapMs > 0 && index < selections.length - 1) {
        const silence = path.join(buildDir, `silence-${index}.wav`);
        await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', String(gapMs / 1000), '-c:a', 'pcm_s16le', silence]);
        files.push(silence);
      }
    }
    const quote = (file) => `file '${file.replace(/'/g, "'\\''").replace(/\\/g, '/')}'`;
    await fs.writeFile(concatPath, files.map(quote).join('\n'), 'utf8');
    const output = path.join(outputDir, 'zephyrus-voiceclone-sentence-mix.wav');
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concatPath, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', output]);
    return output;
  } finally {
    await fs.rm(buildDir, { recursive: true, force: true });
  }
};

await Promise.all([fs.mkdir(generatedDir, { recursive: true }), fs.mkdir(outputDir, { recursive: true })]);

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/project') {
      const [copy, style] = await Promise.all([fs.readFile(copyPath, 'utf8'), fs.readFile(stylePath, 'utf8')]);
      const sentences = parseSentences(copy);
      const data = await Promise.all(sentences.map(async (text, index) => ({ id: index + 1, text, versions: await listVersions(index + 1) })));
      return json(res, 200, { sentences: data, style: style.trim(), referenceAudio: path.basename(referencePath) });
    }
    if (req.method === 'POST' && url.pathname === '/api/generate') {
      const result = await generateLine(await readBody(req));
      return json(res, 200, { ...result, url: `/audio/${result.filename}?v=${Date.now()}` });
    }
    if (req.method === 'POST' && url.pathname === '/api/complete') {
      const { selections } = await readBody(req);
      const output = await completeAudio(selections);
      return json(res, 200, { filename: path.basename(output), path: output, url: `/output/${path.basename(output)}?v=${Date.now()}` });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/audio/')) {
      const name = path.basename(decodeURIComponent(url.pathname.slice('/audio/'.length)));
      if (!/^line-\d{2}-v\d{3}\.wav$/.test(name)) return json(res, 400, { error: '音频文件名无效。' });
      return sendFile(res, path.join(generatedDir, name), 'audio/wav');
    }
    if (req.method === 'GET' && url.pathname.startsWith('/output/')) {
      const name = path.basename(decodeURIComponent(url.pathname.slice('/output/'.length)));
      if (name !== 'zephyrus-voiceclone-sentence-mix.wav') return json(res, 400, { error: '输出文件名无效。' });
      return sendFile(res, path.join(outputDir, name), 'audio/wav');
    }

    const route = url.pathname === '/' ? '/index.html' : url.pathname;
    const staticPath = path.normalize(path.join(publicDir, route));
    if (!staticPath.startsWith(publicDir)) return json(res, 403, { error: '禁止访问。' });
    const ext = path.extname(staticPath);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
    return sendFile(res, staticPath, types[ext] || 'application/octet-stream');
  } catch (error) {
    return json(res, 500, { error: safeError(error) });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Zephyrus TTS Workbench: http://127.0.0.1:${port}`);
  console.log(`Reference audio: ${referencePath}`);
});
