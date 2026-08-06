import { type ParsedLyrics, parseLyrics, type ParseResult } from './yrcParser';

function decodeNumericEntity(code: string, radix: number): string {
  const value = Number.parseInt(code, radix);
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) return '';
  try {
    return String.fromCodePoint(value);
  } catch {
    return '';
  }
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code) => decodeNumericEntity(code, 10))
    .replace(/&#x([\da-f]+);/gi, (_match, code) => decodeNumericEntity(code, 16))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function extractQrcLyricContent(payload: string): string {
  const source = String(payload || '').trim();
  if (!source || !source.startsWith('<')) return source;

  if (typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(source, 'application/xml');
    if (!document.querySelector('parsererror')) {
      const lyricNode = document.querySelector('[LyricContent]');
      const lyricContent = lyricNode?.getAttribute('LyricContent');
      if (lyricContent !== null && lyricContent !== undefined) return lyricContent;
    }
  }

  // Node 单元测试没有 DOMParser；仅作为 XML 属性读取的兼容后备。
  const attribute = source.match(/\bLyricContent\s*=\s*(["'])([\s\S]*?)\1/i);
  return attribute ? decodeXmlEntities(attribute[2]) : source;
}

export function parseQrcLyrics(payload: string): ParseResult<ParsedLyrics> {
  return parseLyrics(extractQrcLyricContent(payload));
}
