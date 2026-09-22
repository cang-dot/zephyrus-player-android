import { describe, expect, it, vi } from 'vitest';

import {
  type AudioFileMetadata,
  parseAudioFileMetadata,
  parseMp4Ilst
} from '../../src/renderer/utils/audioMetadata';

/** 组装一个 MP4 box:size(4) + type(4) + payload */
function box(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, out.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(payload, 8);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function dataBox(payload: string): Uint8Array {
  const text = new TextEncoder().encode(payload);
  const body = new Uint8Array(8 + text.length);
  const view = new DataView(body.buffer);
  view.setUint32(0, 1); // well-known type: UTF-8
  body.set(text, 8);
  return box('data', body);
}

function ilstItem(atomName: string, value: string): Uint8Array {
  return box(atomName, dataBox(value));
}

/** 构造带 ftyp + moov.udta.meta.ilst 的最小 m4a */
function buildM4a(items: Uint8Array[]): Uint8Array {
  const ftyp = box('ftyp', new TextEncoder().encode('M4A isom'));
  const ilst = box('ilst', concat(...items));
  const meta = (() => {
    const body = concat(new Uint8Array(4), ilst); // version/flags
    return box('meta', body);
  })();
  const udta = box('udta', meta);
  const moov = box('moov', udta);
  return concat(ftyp, moov);
}

async function parse(bytes: Uint8Array): Promise<AudioFileMetadata> {
  const meta: AudioFileMetadata = {
    title: '',
    artist: '',
    album: '',
    duration: 0,
    cover: null,
    lyrics: null
  };
  const file = new File([bytes], 'test.m4a');
  await parseMp4Ilst(file, meta);
  return meta;
}

describe('web m4a ilst metadata parsing', () => {
  it('maps ©nam to title and ©ART to artist without swapping', async () => {
    const bytes = buildM4a([ilstItem('©nam', '测试歌名'), ilstItem('©ART', '测试歌手')]);
    const meta = await parse(bytes);

    expect(meta.title).toBe('测试歌名');
    expect(meta.artist).toBe('测试歌手');
    expect(meta.album).toBe('');
  });

  it('keeps title/artist distinct when atoms appear in either order', async () => {
    const bytes = buildM4a([ilstItem('©ART', '顺序歌手'), ilstItem('©nam', '顺序歌名')]);
    const meta = await parse(bytes);

    expect(meta.title).toBe('顺序歌名');
    expect(meta.artist).toBe('顺序歌手');
  });

  it('reads album, lyrics and cover atoms', async () => {
    const bytes = buildM4a([
      ilstItem('©alb', '测试专辑'),
      ilstItem('©lyr', '[00:01.000]测试歌词'),
      ilstItem('covr', 'x'.repeat(200))
    ]);
    const meta = await parse(bytes);

    expect(meta.album).toBe('测试专辑');
    expect(meta.lyrics).toContain('测试歌词');
    expect(meta.cover).not.toBeNull();
  });

  it('lets tags win over filename fallback even when the name order is reversed', async () => {
    // 回归:真实文件「病友王建军描述记录 - 唯利玉碎计划.m4a」的文件名是
    // 「歌名 - 歌手」序,标签解析成功时必须以标签为准,不能被文件名兜底颠倒
    vi.stubGlobal(
      'Audio',
      class {
        onloadedmetadata: (() => void) | null = null;
        onerror: (() => void) | null = null;
        preload = '';
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      }
    );
    try {
      const bytes = buildM4a([ilstItem('©nam', '测试歌名'), ilstItem('©ART', '测试歌手')]);
      const file = new File([bytes], '病友王建军描述记录 - 唯利玉碎计划.m4a');
      const meta = await parseAudioFileMetadata(file);

      expect(meta.title).toBe('测试歌名');
      expect(meta.artist).toBe('测试歌手');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('falls back to filename split only when tags are missing', async () => {
    vi.stubGlobal(
      'Audio',
      class {
        onloadedmetadata: (() => void) | null = null;
        onerror: (() => void) | null = null;
        preload = '';
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      }
    );
    try {
      const bytes = buildM4a([]);
      const file = new File([bytes], '某歌手 - 某歌名.m4a');
      const meta = await parseAudioFileMetadata(file);

      expect(meta.title).toBe('某歌名');
      expect(meta.artist).toBe('某歌手');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
