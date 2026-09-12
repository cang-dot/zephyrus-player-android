/**
 * 浏览器端音频元数据解析(无依赖)
 *
 * 支持 ID3v2.3 / v2.4 标签(TIT2/TPE1/TALB/APIC),失败时降级为
 * 「歌手 - 歌名」文件名拆分;时长用 <audio preload="metadata"> 探测。
 */

export interface AudioFileMetadata {
  title: string;
  artist: string;
  album: string;
  duration: number;
  /** 封面 object URL(仅浏览器会话内有效) */
  cover: string | null;
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
    cover: null
  };

  try {
    // ID3 标签在文件头,前 10MB 足以覆盖常见标签+内嵌封面
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
  } catch {
    // 标签解析失败:保留文件名兜底
  }

  meta.duration = await probeDuration(file);
  return meta;
}
