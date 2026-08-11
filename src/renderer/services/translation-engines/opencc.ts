import type { ILyricText } from '@/types/music';

let _inited = false;
let _converter: any = null;
const CJK_RUN_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/g;

/**
 * OpenCC only needs to see Chinese text. Keeping punctuation and other symbols
 * outside the converter prevents third-party builds from rewriting full-width
 * lyric punctuation (for example `！`) while converting a whole line.
 */
export async function convertTextPreservingSymbols(
  text: string,
  convertRun: (value: string) => string | Promise<string>
): Promise<string> {
  let result = '';
  let cursor = 0;
  CJK_RUN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CJK_RUN_PATTERN.exec(text)) !== null) {
    result += text.slice(cursor, match.index);
    result += await convertRun(match[0]);
    cursor = match.index + match[0].length;
  }
  result += text.slice(cursor);
  return result;
}

export async function init(): Promise<void> {
  if (_inited) return;
  const mod: any = await import('https://cdn.jsdelivr.net/npm/opencc-rust/dist/opencc-rust.mjs');
  if (!mod?.initOpenccRust || !mod?.getConverter) {
    throw new Error('opencc-rust module missing expected exports');
  }
  await mod.initOpenccRust();
  _converter = mod.getConverter();
  _inited = true;
}

export async function convert(text: string): Promise<string> {
  await init();
  if (!_converter) return text;
  return _converter.convert(text);
}

export async function convertLines(lines: string[]) {
  await init();
  if (!_converter) return lines.slice();

  const cjkRe = /[\u4e00-\u9fff]/;

  const convertOne = async (s: string) => {
    const src = (s || '').trim();
    if (!src || !cjkRe.test(src)) return '';
    try {
      return await convertTextPreservingSymbols(src, (run) => _converter.convert(run));
    } catch (e) {
      console.warn('opencc convertLines item failed:', e);
      return '';
    }
  };

  const results = await Promise.all(lines.map((s) => convertOne(s)));
  return results;
}

export async function translateLines(lines: ILyricText[]) {
  if (!lines || lines.length === 0) return lines.slice();
  const srcInfo = lines.map((l) => {
    const hasTr = !!(l.trText && l.trText.trim() !== '');
    return {
      src: hasTr ? (l.trText || '').trim() : (l.text || '').trim(),
      targetIsTr: hasTr
    };
  });

  const srcLines = srcInfo.map((s) => s.src);
  const converted = await convertLines(srcLines);

  return lines.map((l, i) => {
    const { targetIsTr } = srcInfo[i];
    const conv = converted[i] || '';
    if (targetIsTr) {
      const tr = conv || l.trText || l.text || '';
      return { ...l, trText: tr };
    }
    const txt = conv || l.text || '';
    return { ...l, text: txt };
  });
}

export default {
  init,
  convert,
  convertLines,
  translateLines
};

// Ensure the engine is initialized and return public API.
let _ensurePromise: Promise<any> | null = null;
export async function ensureOpenccConverter() {
  if (_ensurePromise) return _ensurePromise;
  _ensurePromise = (async () => {
    try {
      await init();
    } catch (e) {
      console.warn('opencc ensureOpenccConverter init failed:', e);
    }
    return {
      init,
      convert,
      convertLines,
      translateLines
    };
  })();
  return _ensurePromise;
}
