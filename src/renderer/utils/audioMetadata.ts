/**
 * 浏览器端音频元数据解析(无依赖)
 *
 * 支持:ID3v2.3/v2.4(mp3)、Vorbis Comment + METADATA_BLOCK_PICTURE
 * (flac / ogg / opus)、iTunes MP4 ilst(m4a / aac / mp4)。失败时降级为
 * 「歌手 - 歌名」文件名拆分;时长用 <audio preload="metadata"> 探测。
 */

export interface AudioFileMetadata {
  title: string;
  artist: string;
  album: string;
  duration: number;
  /** 封面 object URL(仅浏览器会话内有效) */
  cover: string | null;
  /** 内嵌歌词(LRC 文本优先;无时间戳歌词原样存放) */
  lyrics: string | null;
}

function syncsafe(b: Uint8Array, o: number): number {
  return ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
}

function u32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

function decodeText(bytes: Uint8Array, encoding: number): string {
  try {
    let text: string;
    if (encoding === 1) text = new TextDecoder('utf-16').decode(bytes);
    else if (encoding === 2) text = new TextDecoder('utf-16be').decode(bytes);
    else if (encoding === 3) text = new TextDecoder('utf-8').decode(bytes);
    else text = new TextDecoder('iso-8859-1').decode(bytes);
    return text.replace(/\0+$/g, '').replace(/^\uFEFF/, '').trim();
  } catch {
    return '';
  }
}

/** 「歌手 - 歌名」文件名拆分兜底 */
function splitFileName(name: string): { title: string; artist: string } {
  const base = name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim();
  const idx = base.indexOf(' - ');
  if (idx > 0) {
    return { artist: base.slice(0, idx).trim(), title: base.slice(idx + 3).trim() };
  }
  return { artist: '', title: base };
}

function probeDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;
    const done = (value: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(value) && value > 0 ? Math.round(value) : 0);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => done(audio.duration);
    audio.onerror = () => done(0);
    window.setTimeout(() => done(audio.duration || 0), 8000);
    audio.src = url;
  });
}

export async function parseAudioFileMetadata(file: File): Promise<AudioFileMetadata> {
  const fallback = splitFileName(file.name);
  const meta: AudioFileMetadata = {
    title: fallback.title,
    artist: fallback.artist,
    album: '',
    duration: 0,
    cover: null,
    lyrics: null
  };

  try {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (head.length > 4 && head[0] === 0x66 && head[1] === 0x4c && head[2] === 0x61 && head[3] === 0x43) {
      await parseFlacVorbis(file, meta);
    } else if (
      head.length > 10 &&
      head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70
    ) {
      await parseMp4Ilst(file, meta);
    } else if (
      head.length > 4 &&
      head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53
    ) {
      await parseOggVorbis(file, meta);
    } else {
      await parseId3v2(file, meta);
    }
  } catch {
    // 标签解析失败:保留文件名兜底
  }

  meta.duration = await probeDuration(file);
  return meta;
}

/** ID3v2.3/2.4(mp3):TIT2/TPE1/TALB/APIC */
async function parseId3v2(file: File, meta: AudioFileMetadata): Promise<void> {
  const buf = new Uint8Array(await file.slice(0, 10 * 1024 * 1024).arrayBuffer());
  if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
      const ver = buf[3]; // 3 = ID3v2.3, 4 = ID3v2.4
      if (ver === 3 || ver === 4) {
        const tagEnd = Math.min(10 + syncsafe(buf, 6), buf.length);
        let o = 10;
        // 跳过扩展头(v2.3: u32 size;v2.4: syncsafe size,均不含自身 4 字节)
        if (buf[5] & 0x40) {
          const extSize = ver === 4 ? syncsafe(buf, 10) : u32(buf, 10);
          o += extSize + 4;
        }
        while (o + 10 <= tagEnd) {
          const id = String.fromCharCode(...buf.subarray(o, o + 4));
          if (!/^[A-Z0-9]{4}$/.test(id)) break; // padding
          const fsize = ver === 4 ? syncsafe(buf, o + 4) : u32(buf, o + 4);
          if (fsize <= 0 || o + 10 + fsize > tagEnd) break;
          const data = buf.subarray(o + 10, o + 10 + fsize);
          if (id === 'TIT2') meta.title = decodeText(data.subarray(1), data[0]) || meta.title;
          else if (id === 'TPE1') meta.artist = decodeText(data.subarray(1), data[0]) || meta.artist;
          else if (id === 'TALB') meta.album = decodeText(data.subarray(1), data[0]) || meta.album;
          else if (id === 'USLT' && !meta.lyrics) meta.lyrics = parseUslt(data) || meta.lyrics;
          else if (id === 'SYLT' && !meta.lyrics) meta.lyrics = parseSylt(data) || meta.lyrics;
          else if (id === 'APIC' && !meta.cover) {
            const encoding = data[0];
            let p = 1;
            while (p < data.length && data[p] !== 0) p++;
            const mime = new TextDecoder('iso-8859-1').decode(data.subarray(1, p)) || 'image/jpeg';
            p++; // null
            p++; // picture type
            if (encoding === 1 || encoding === 2) {
              while (p + 1 < data.length && !(data[p] === 0 && data[p + 1] === 0)) p += 2;
              p += 2;
            } else {
              while (p < data.length && data[p] !== 0) p++;
              p++;
            }
            const img = data.subarray(p);
            if (img.length > 128) {
              meta.cover = URL.createObjectURL(new Blob([img], { type: mime.startsWith('image/') ? mime : 'image/jpeg' }));
            }
          }
          o += 10 + fsize;
        }
      }
  }
}

// ─────────────────────────── Vorbis Comment(flac / ogg) ───────────────────────────

/** 解析单个 Vorbis Comment 块内容,写入 meta(含 METADATA_BLOCK_PICTURE 封面) */
function applyVorbisComments(bytes: Uint8Array, meta: AudioFileMetadata): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 0;
  const vendorLen = view.getUint32(o, true);
  o += 4 + vendorLen;
  const count = view.getUint32(o, true);
  o += 4;
  for (let i = 0; i < count && o + 4 <= bytes.length; i++) {
    const len = view.getUint32(o, true);
    o += 4;
    if (len > bytes.length - o) break;
    const kv = new TextDecoder('utf-8').decode(bytes.subarray(o, o + len));
    o += len;
    const eq = kv.indexOf('=');
    if (eq <= 0) continue;
    const key = kv.slice(0, eq).toUpperCase();
    const value = kv.slice(eq + 1);
    if (key === 'TITLE') meta.title = value || meta.title;
    else if (key === 'ARTIST') meta.artist = meta.artist || value;
    else if (key === 'ALBUM') meta.album = meta.album || value;
    else if (['LYRICS', 'UNSYNCEDLYRICS', 'SYNCEDLYRICS'].includes(key) && !meta.lyrics) {
      meta.lyrics = normalizeSyncedLyrics(value);
    }
    else if ((key === 'METADATA_BLOCK_PICTURE' || key === 'COVERART') && !meta.cover) {
      try {
        if (key === 'COVERART') {
          meta.cover = URL.createObjectURL(
            new Blob([Uint8Array.from(atob(value), (c) => c.charCodeAt(0))], { type: 'image/jpeg' })
          );
        } else {
          const bin = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
          const dv = new DataView(bin.buffer);
          dv.getUint32(0); // picture type
          const mimeLen = dv.getUint32(4);
          const mime =
            new TextDecoder('iso-8859-1').decode(bin.subarray(8, 8 + mimeLen)) || 'image/jpeg';
          let q = 8 + mimeLen;
          const descLen = dv.getUint32(q);
          q += 4 + descLen + 16;
          const picLen = dv.getUint32(q);
          q += 4;
          if (picLen > 0 && q + picLen <= bin.length) {
            meta.cover = URL.createObjectURL(
              new Blob([bin.subarray(q, q + picLen)], {
                type: mime.startsWith('image/') ? mime : 'image/jpeg'
              })
            );
          }
        }
      } catch {
        // 封面 base64 损坏,忽略
      }
    }
  }
}

/** FLAC:STREAMINFO 后遍历 VORBIS_COMMENT(type 4)块 */
async function parseFlacVorbis(file: File, meta: AudioFileMetadata): Promise<void> {
  // 元数据块集中在文件头部,8MB 足够
  const buf = new Uint8Array(await file.slice(0, 8 * 1024 * 1024).arrayBuffer());
  let o = 4;
  for (;;) {
    if (o + 4 > buf.length) break;
    const header = buf[o];
    const isLast = (header & 0x80) !== 0;
    const type = header & 0x7f;
    const size = (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3];
    o += 4;
    if (type === 4 && o + size <= buf.length) {
      applyVorbisComments(buf.subarray(o, o + size), meta);
    }
    o += size;
    if (isLast) break;
  }
}

/** OGG:扫描 VORBIS_COMMENT 包(0x03 头),允许跨页取连续区域解析 */
async function parseOggVorbis(file: File, meta: AudioFileMetadata): Promise<void> {
  const buf = new Uint8Array(await file.slice(0, 8 * 1024 * 1024).arrayBuffer());
  const marker = [0x03, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73, 0x43, 0x6f, 0x6d, 0x6d, 0x65, 0x6e, 0x74];
  for (let i = 0; i + marker.length <= buf.length; i++) {
    let hit = true;
    for (let j = 0; j < marker.length; j++) {
      if (buf[i + j] !== marker[j]) {
        hit = false;
        break;
      }
    }
    if (!hit) continue;
    const body = buf.subarray(i + marker.length, Math.min(i + marker.length + 2 * 1024 * 1024, buf.length));
    applyVorbisComments(body, meta);
    return;
  }
}

// ─────────────────────────── iTunes MP4 ilst(m4a) ───────────────────────────

const MP4_KEY_MAP: Record<string, 'title' | 'artist' | 'album' | 'covr' | 'lyrics'> = {
  '©nam': 'title',
  '©ART': 'artist',
  '©alb': 'album',
  covr: 'covr',
  '©lyr': 'lyrics'
};

/** MP4:遍历 moov.udta.meta.ilst,取 ©nam/©ART/©alb/covr */
async function parseMp4Ilst(file: File, meta: AudioFileMetadata): Promise<void> {
  const buf = new Uint8Array(await file.slice(0, 12 * 1024 * 1024).arrayBuffer());
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  const stack: Array<{ start: number; end: number }> = [{ start: 0, end: buf.length }];
  while (stack.length) {
    const range = stack.pop()!;
    let o = range.start;
    while (o + 8 <= range.end) {
      let size = view.getUint32(o);
      const type = String.fromCharCode(buf[o + 4], buf[o + 5], buf[o + 6], buf[o + 7]);
      let headerSize = 8;
      if (size === 1) {
        size = Number(view.getBigUint64(o + 8));
        headerSize = 16;
      } else if (size === 0) {
        size = range.end - o;
      }
      if (size < headerSize || o + size > range.end) break;
      if (['moov', 'udta', 'meta', 'ilst'].includes(type)) {
        stack.push({ start: o + headerSize + (type === 'meta' ? 4 : 0), end: o + size });
      } else if (MP4_KEY_MAP[type]) {
        let d = o + headerSize;
        const end = o + size;
        while (d + 8 <= end) {
          const dSize = view.getUint32(d);
          const dType = String.fromCharCode(buf[d + 4], buf[d + 5], buf[d + 6], buf[d + 7]);
          if (dSize < 8 || d + dSize > end) break;
          if (dType === 'data' && dSize > 16) {
            const payload = buf.subarray(d + 16, d + dSize);
            const mapped = MP4_KEY_MAP[type];
            if (mapped === 'title' && !meta.title) meta.title = new TextDecoder('utf-8').decode(payload);
            else if (mapped === 'artist' && !meta.artist)
              meta.artist = new TextDecoder('utf-8').decode(payload);
            else if (mapped === 'album' && !meta.album)
              meta.album = new TextDecoder('utf-8').decode(payload);
            else if (mapped === 'lyrics' && !meta.lyrics)
              meta.lyrics = normalizeSyncedLyrics(new TextDecoder('utf-8').decode(payload));
            else if (mapped === 'covr' && !meta.cover && payload.length > 128) {
              const typeCode = view.getUint32(d + 8) & 0xffffff;
              const mime = typeCode === 14 ? 'image/png' : 'image/jpeg';
              meta.cover = URL.createObjectURL(new Blob([payload], { type: mime }));
            }
          }
          d += dSize;
        }
      }
      o += size;
    }
  }
}

// ─────────────────────────── 内嵌歌词提取 ───────────────────────────

/** 把「[mm:ss.xx] 文本」列表归一为标准 LRC;无时间戳则原样返回 */
function normalizeSyncedLyrics(raw: string): string | null {
  const text = (raw || '').trim();
  if (!text) return null;
  if (text.includes('[mm:ss') || /\[\d{2,3}:\d{2}(:\d{2})?(\.\d{1,3})?\]/.test(text)) return text;
  return text;
}

/** 4 字节 syncsafe 整数 */
function readSyncsafe4(bytes: Uint8Array, o: number): number {
  return ((bytes[o] & 0x7f) << 21) | ((bytes[o + 1] & 0x7f) << 14) | ((bytes[o + 2] & 0x7f) << 7) | (bytes[o + 3] & 0x7f);
}

/** 文本解码(按 ID3 编码字节);off 起读至首个终止符 */
function decodeId3Text(bytes: Uint8Array, encoding: number, off: number): string {
  let end = bytes.length;
  if (encoding === 1 || encoding === 2) {
    for (let i = off; i + 1 < bytes.length; i += 2) {
      if (bytes[i] === 0 && bytes[i + 1] === 0) {
        end = i;
        break;
      }
    }
    return decodeText(bytes.subarray(off, end), encoding);
  }
  for (let i = off; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      end = i;
      break;
    }
  }
  return decodeText(bytes.subarray(off, end), encoding);
}

/** ID3v2 USLT:编码(1) 语言(3) 内容描述(终止串) 歌词文本 */
function parseUslt(data: Uint8Array): string | null {
  try {
    const encoding = data[0];
    let o = 4; // encoding + 3 字节语言
    // 跳过内容描述终止串
    if (encoding === 1 || encoding === 2) {
      while (o + 1 < data.length && !(data[o] === 0 && data[o + 1] === 0)) o += 2;
      o += 2;
    } else {
      while (o < data.length && data[o] !== 0) o++;
      o++;
    }
    const text = decodeId3Text(data, encoding, o);
    return normalizeSyncedLyrics(text);
  } catch {
    return null;
  }
}

/** ID3v2 SYLT:同步歌词帧 → LRC(时间戳取自前两个 syncsafe 字段之一,按规范在描述串后) */
function parseSylt(data: Uint8Array): string | null {
  try {
    const encoding = data[0];
    let o = 4; // encoding + 语言
    // 时间戳格式字节(1) + 内容类型字节(1) + 内容描述终止串
    o += 2;
    if (encoding === 1 || encoding === 2) {
      while (o + 1 < data.length && !(data[o] === 0 && data[o + 1] === 0)) o += 2;
      o += 2;
    } else {
      while (o < data.length && data[o] !== 0) o++;
      o++;
    }
    // 逐条:终止串 + 4 字节时间戳(ms)
    const lines: string[] = [];
    for (;;) {
      let start = o;
      if (encoding === 1 || encoding === 2) {
        while (start + 1 < data.length && !(data[start] === 0 && data[start + 1] === 0)) start += 2;
        if (start + 1 >= data.length) break;
      } else {
        while (start < data.length && data[start] !== 0) start++;
        if (start >= data.length) break;
      }
      const text = decodeId3Text(data, encoding, o);
      const stampOff = encoding === 1 || encoding === 2 ? start + 2 : start + 1;
      if (stampOff + 4 > data.length) break;
      const ms = readSyncsafe4(data, stampOff);
      const total = Math.floor(ms / 10);
      const mm = String(Math.floor(total / 6000)).padStart(2, '0');
      const ss = String(Math.floor((total % 6000) / 100)).padStart(2, '0');
      const cs = String(total % 100).padStart(2, '0');
      lines.push(`[${mm}:${ss}.${cs}]${text}`);
      o = stampOff + 4;
      if (lines.length > 2000) break;
    }
    return lines.length ? lines.join('\n') : null;
  } catch {
    return null;
  }
}
