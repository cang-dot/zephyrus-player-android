/**
 * Parser for the AMLL TTML lyric format.
 *
 * The parser deliberately keeps the main lyric, auxiliary text, background
 * vocals and performer lines separate. Player styles can then choose the
 * presentation without reparsing XML or relying on LRC-specific fields.
 */

const TTM_NS = 'http://www.w3.org/ns/ttml#metadata';
const ITUNES_NS = 'http://music.apple.com/lyric-ttml-internal';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

export type TtmlTimingMode = 'word' | 'line' | 'unknown';
export type TtmlAuxiliaryRole = 'translation' | 'roman';

export interface TtmlWord {
  text: string;
  begin: number;
  end: number;
  role?: 'main' | 'background';
}

export interface TtmlAuxiliaryText {
  text: string;
  role: TtmlAuxiliaryRole;
  lang?: string;
}

export interface TtmlBackgroundLine {
  text: string;
  begin: number;
  end: number;
  words: TtmlWord[];
  agent?: string;
  translations: TtmlAuxiliaryText[];
  romanizations: TtmlAuxiliaryText[];
}

export interface TtmlLine {
  begin: number;
  end: number;
  text: string;
  words: TtmlWord[];
  agent?: string;
  part?: string;
  key?: string;
  isBackground: boolean;
  background: TtmlBackgroundLine[];
  translations: TtmlAuxiliaryText[];
  romanizations: TtmlAuxiliaryText[];
}

export interface TtmlAgent {
  id: string;
  name?: string;
  type?: string;
}

export interface TtmlLyric {
  lines: TtmlLine[];
  duration: number;
  timingMode: TtmlTimingMode;
  primaryAgent?: string;
  agents: TtmlAgent[];
  parts: Array<{ begin: number; end: number; name: string }>;
  meta: Record<string, string[]>;
  source?: string;
}

function attr(element: Element, localName: string, namespace?: string): string | undefined {
  const namespaced = namespace ? element.getAttributeNS(namespace, localName) : null;
  if (namespaced) return namespaced;

  const prefixed =
    namespace === TTM_NS
      ? `ttm:${localName}`
      : namespace === ITUNES_NS
        ? `itunes:${localName}`
        : namespace === XML_NS
          ? `xml:${localName}`
          : localName;
  const value = element.getAttribute(prefixed) || element.getAttribute(localName);
  return value || undefined;
}

/** Convert AMLL/W3C TTML time expressions to seconds. */
export function parseTtmlTime(value: string | null | undefined): number {
  if (!value) return 0;
  const input = value.trim().toLowerCase();
  if (!input) return 0;

  if (input.endsWith('ms')) {
    return (Number.parseFloat(input.slice(0, -2)) || 0) / 1000;
  }
  if (input.endsWith('s')) {
    return Number.parseFloat(input.slice(0, -1)) || 0;
  }

  if (!input.includes(':')) return Number.parseFloat(input) || 0;

  const parts = input.split(':');
  if (parts.length === 2) {
    return (Number.parseFloat(parts[0]) || 0) * 60 + (Number.parseFloat(parts[1]) || 0);
  }
  if (parts.length === 3) {
    return (
      (Number.parseFloat(parts[0]) || 0) * 3600 +
      (Number.parseFloat(parts[1]) || 0) * 60 +
      (Number.parseFloat(parts[2]) || 0)
    );
  }
  return 0;
}

function elementChildren(element: Element): Element[] {
  return Array.from(element.children).filter((child): child is Element => child.nodeType === 1);
}

function roleOf(element: Element): string | undefined {
  return attr(element, 'role', TTM_NS);
}

function elementText(element: Element): string {
  return (element.textContent || '').replace(/\s+/g, ' ').trim();
}

function timedWordText(element: Element): string {
  const text = elementText(element);
  const trailingText =
    element.nextSibling?.nodeType === 3 ? element.nextSibling.textContent || '' : '';
  return trailingText && /\s/.test(trailingText) ? `${text} ` : text;
}

function mainText(element: Element): string {
  const collect = (node: ChildNode): string => {
    if (node.nodeType === 3) return node.textContent || '';
    if (node.nodeType !== 1) return '';
    const child = node as Element;
    const role = roleOf(child);
    if (role === 'x-translation' || role === 'x-roman' || role === 'x-bg') return '';
    return Array.from(child.childNodes).map(collect).join('');
  };
  return Array.from(element.childNodes).map(collect).join('').replace(/\s+/g, ' ').trim();
}

function parseAuxiliary(element: Element, role: TtmlAuxiliaryRole): TtmlAuxiliaryText | null {
  const text = elementText(element);
  if (!text) return null;
  return {
    text,
    role,
    lang: attr(element, 'lang', XML_NS) || element.getAttribute('lang') || undefined
  };
}

function parseTimedWords(
  element: Element,
  fallbackBegin: number,
  fallbackEnd: number,
  role: 'main' | 'background'
): TtmlWord[] {
  const words: TtmlWord[] = [];
  for (const child of elementChildren(element)) {
    const childRole = roleOf(child);
    if (childRole === 'x-translation' || childRole === 'x-roman') continue;
    if (childRole === 'x-bg') {
      words.push(...parseTimedWords(child, fallbackBegin, fallbackEnd, 'background'));
      continue;
    }

    const text = timedWordText(child);
    if (!text) continue;
    const begin = parseTtmlTime(attr(child, 'begin') || String(fallbackBegin));
    const end = parseTtmlTime(attr(child, 'end') || String(fallbackEnd));
    words.push({ text, begin, end: Math.max(begin, end), role });
  }

  if (words.length === 0) {
    const text = element.children.length === 0 ? timedWordText(element) : mainText(element);
    if (text) words.push({ text, begin: fallbackBegin, end: fallbackEnd, role });
  }
  return words;
}

function parentDivPart(element: Element): string | undefined {
  let parent = element.parentElement;
  while (parent) {
    if (parent.localName === 'div' || parent.tagName.toLowerCase() === 'div') {
      return attr(parent, 'song-part', ITUNES_NS);
    }
    parent = parent.parentElement;
  }
  return undefined;
}

function parseBackgroundSpan(
  element: Element,
  parentBegin: number,
  parentEnd: number
): TtmlBackgroundLine | null {
  const begin = parseTtmlTime(attr(element, 'begin') || String(parentBegin));
  const end = parseTtmlTime(attr(element, 'end') || String(parentEnd));
  const words = parseTimedWords(element, begin, end, 'background');
  const translations: TtmlAuxiliaryText[] = [];
  const romanizations: TtmlAuxiliaryText[] = [];

  for (const child of elementChildren(element)) {
    const role = roleOf(child);
    if (role === 'x-translation') {
      const value = parseAuxiliary(child, 'translation');
      if (value) translations.push(value);
    } else if (role === 'x-roman') {
      const value = parseAuxiliary(child, 'roman');
      if (value) romanizations.push(value);
    }
  }

  const text = words.map((word) => word.text).join('') || elementText(element);
  if (!text) return null;
  return { text, begin, end: Math.max(begin, end), words, translations, romanizations };
}

function parseLine(element: Element, timingMode: TtmlTimingMode): TtmlLine | null {
  const begin = parseTtmlTime(attr(element, 'begin') || '0');
  const end = parseTtmlTime(attr(element, 'end') || String(begin));
  const translations: TtmlAuxiliaryText[] = [];
  const romanizations: TtmlAuxiliaryText[] = [];
  const background: TtmlBackgroundLine[] = [];
  const mainWords: TtmlWord[] = [];

  for (const child of elementChildren(element)) {
    const role = roleOf(child);
    if (role === 'x-bg') {
      const value = parseBackgroundSpan(child, begin, end);
      if (value) background.push(value);
      continue;
    }
    if (role === 'x-translation') {
      const value = parseAuxiliary(child, 'translation');
      if (value) translations.push(value);
      continue;
    }
    if (role === 'x-roman') {
      const value = parseAuxiliary(child, 'roman');
      if (value) romanizations.push(value);
      continue;
    }

    const text = timedWordText(child);
    if (!text) continue;
    if (timingMode === 'line') {
      mainWords.push({ text, begin, end: Math.max(begin, end), role: 'main' });
    } else {
      mainWords.push(...parseTimedWords(child, begin, end, 'main'));
    }
  }

  if (mainWords.length === 0) {
    const text = mainText(element);
    if (text) mainWords.push({ text, begin, end: Math.max(begin, end), role: 'main' });
  }

  const text = mainWords.map((word) => word.text).join('');
  if (!text) return null;

  return {
    begin,
    end: Math.max(begin, end),
    text,
    words: mainWords,
    agent: attr(element, 'agent', TTM_NS),
    part: parentDivPart(element),
    key: attr(element, 'key', ITUNES_NS),
    isBackground: false,
    background,
    translations,
    romanizations
  };
}

function parseAgents(root: Element): TtmlAgent[] {
  const agents: TtmlAgent[] = [];
  const elements = root.getElementsByTagNameNS('*', 'agent');
  for (const element of Array.from(elements)) {
    const id = attr(element, 'id', XML_NS) || element.getAttribute('xml:id');
    if (!id) continue;
    const nameElement = Array.from(element.children).find((child) => child.localName === 'name');
    agents.push({
      id,
      type: element.getAttribute('type') || undefined,
      name: nameElement ? elementText(nameElement) : undefined
    });
  }
  return agents;
}

function parseMeta(root: Element): Record<string, string[]> {
  const meta: Record<string, string[]> = {};
  const elements = root.getElementsByTagNameNS('*', 'meta');
  for (const element of Array.from(elements)) {
    const key = element.getAttribute('key');
    const value = element.getAttribute('value');
    if (!key || value === null) continue;
    (meta[key] ||= []).push(value);
  }
  return meta;
}

function parseParts(root: Element): Array<{ begin: number; end: number; name: string }> {
  const parts: Array<{ begin: number; end: number; name: string }> = [];
  for (const element of Array.from(root.getElementsByTagNameNS('*', 'div'))) {
    const name = attr(element, 'song-part', ITUNES_NS);
    if (!name) continue;
    const begin = parseTtmlTime(attr(element, 'begin'));
    const end = parseTtmlTime(attr(element, 'end'));
    parts.push({ begin, end: Math.max(begin, end), name });
  }
  return parts;
}

export function parseTtml(xmlString: string): TtmlLyric | null {
  if (!xmlString.trim()) return null;
  try {
    const document = new DOMParser().parseFromString(xmlString, 'application/xml');
    const parseError = document.querySelector('parsererror');
    if (parseError) return null;

    const root = document.documentElement;
    if (!root || (root.localName || root.tagName).toLowerCase() !== 'tt') return null;

    const timingValue = attr(root, 'timing', ITUNES_NS)?.toLowerCase();
    const timingMode: TtmlTimingMode =
      timingValue === 'word' ? 'word' : timingValue === 'line' ? 'line' : 'unknown';
    const agents = parseAgents(root);
    const primaryAgent = agents[0]?.id;
    const meta = parseMeta(root);
    const parts = parseParts(root);
    const body = Array.from(root.getElementsByTagNameNS('*', 'body'))[0];
    const bodyDuration = parseTtmlTime(body?.getAttribute('dur'));
    const pElements = Array.from(root.getElementsByTagNameNS('*', 'p'));
    const lines = pElements
      .map((element) => parseLine(element, timingMode))
      .filter((line): line is TtmlLine => Boolean(line))
      .sort((a, b) => a.begin - b.begin);

    const resolvedMode: TtmlTimingMode =
      timingMode === 'unknown'
        ? lines.some((line) => line.words.length > 1)
          ? 'word'
          : 'line'
        : timingMode;
    const maxTimestamp = Math.max(
      0,
      ...lines.map((line) => line.end),
      ...lines.flatMap((line) => line.background.map((item) => item.end))
    );

    for (const line of lines) {
      line.isBackground = Boolean(line.agent && primaryAgent && line.agent !== primaryAgent);
    }

    return {
      lines,
      duration: Math.max(bodyDuration, maxTimestamp),
      timingMode: resolvedMode,
      primaryAgent,
      agents,
      parts,
      meta
    };
  } catch (error) {
    console.warn('[AMLL] Failed to parse TTML:', error);
    return null;
  }
}

export function findTtmlLineIndex(lyric: TtmlLyric, currentTime: number): number {
  let result = -1;
  for (let index = 0; index < lyric.lines.length; index += 1) {
    if (currentTime >= lyric.lines[index].begin) result = index;
    else break;
  }
  return result;
}

export function findTtmlWordIndex(line: TtmlLine, currentTime: number): number {
  let result = -1;
  for (let index = 0; index < line.words.length; index += 1) {
    const word = line.words[index];
    if (currentTime >= word.begin) result = index;
    else break;
  }
  return result;
}

export function isWordActive(line: TtmlLine, wordIndex: number, currentTime: number): boolean {
  const word = line.words[wordIndex];
  return Boolean(word && currentTime >= word.begin && currentTime < word.end);
}

export function isTtmlPartActive(
  lyric: TtmlLyric,
  partNames: string | string[],
  currentTime: number
): boolean {
  const names = new Set(
    (Array.isArray(partNames) ? partNames : [partNames]).map((name) => name.toLowerCase())
  );
  return lyric.parts.some(
    (part) =>
      names.has(part.name.toLowerCase()) && currentTime >= part.begin && currentTime <= part.end
  );
}

export function getTtmlBackgroundLines(
  lyric: TtmlLyric,
  currentTime: number
): TtmlBackgroundLine[] {
  const nested = lyric.lines.flatMap((line) => line.background);
  const performerLines = lyric.lines
    .filter((line) => line.isBackground && currentTime >= line.begin && currentTime <= line.end)
    .map((line) => ({
      text: line.text,
      begin: line.begin,
      end: line.end,
      words: line.words.map((word) => ({ ...word, role: 'background' as const })),
      agent: line.agent,
      translations: line.translations,
      romanizations: line.romanizations
    }));
  return [
    ...nested.filter((line) => currentTime >= line.begin && currentTime <= line.end),
    ...performerLines
  ];
}
