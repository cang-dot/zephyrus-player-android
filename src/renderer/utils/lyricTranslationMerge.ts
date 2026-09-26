/**
 * 翻译歌词特征合并：
 * 一些歌词源把「原文 + 翻译」混在一起——或同一行内用全角括号附带中文翻译
 * （如 `I feel lonely, makes me start miss you.（我觉得孤独让你开始想你）`），
 * 或同一时间轴连续两行（一行原文一行翻译）。这里把它们规范化成
 * 「主歌词 text + 翻译 trText」结构，AMLL 渲染即为一行原文一行翻译。
 *
 * 规则刻意保守：两类特征都要求「一边以 CJK 为主、另一边以拉丁字母为主」的
 * 跨语系对比——纯中文/纯英文歌词不会误伤；半角括号不处理（`(Live)` 类版式
 * 标记假阳性太多）。已有 trText 的行（如 TTML 内嵌翻译）不重复处理。
 */
import type { ILyricText } from '@/types/music';

const CJK_CHAR = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const LATIN_CHAR = /[A-Za-z]/;

function charRatio(text: string, pattern: RegExp): number {
  const chars = text.replace(/\s/g, '');
  if (!chars.length) return 0;
  let count = 0;
  for (const ch of chars) {
    if (pattern.test(ch)) count += 1;
  }
  return count / chars.length;
}

const isCjkDominated = (text: string) => charRatio(text, CJK_CHAR) >= 0.6;
const isLatinDominated = (text: string) => charRatio(text, LATIN_CHAR) >= 0.6;

/** 行尾全角括号（允许尾随标点） */
const TRAILING_FULLWIDTH_PAREN = /[ \t]*（([^（）]*)）[ \t]*[。，、！？!?.…～~]*$/;

/** 拆「原文（中文翻译）」行尾内联翻译；特征不符返回 null */
function splitInlineTranslation(text: string): { main: string; translation: string } | null {
  const match = TRAILING_FULLWIDTH_PAREN.exec(text);
  if (!match) return null;
  const inner = match[1].trim();
  const main = text.slice(0, match.index).trimEnd();
  if (!main || !inner) return null;
  if (!isLatinDominated(main) || !isCjkDominated(inner)) return null;
  return { main, translation: inner };
}

/** 相邻两行 |ΔstartTime| ≤ PAIRED_WINDOW_MS 且跨语系 → 视为一对原文/翻译 */
const PAIRED_WINDOW_MS = 50;

function isPairablePair(a: ILyricText, b: ILyricText): boolean {
  if (a.trText || b.trText) return false; // 已有翻译（TTML 内嵌）不处理
  if (a.isBG || b.isBG) return false; // 背景和声行不参与
  const aTime = a.startTime;
  const bTime = b.startTime;
  if (aTime === undefined || bTime === undefined) return false;
  if (Math.abs(bTime - aTime) > PAIRED_WINDOW_MS) return false;
  return (
    (isLatinDominated(a.text) && isCjkDominated(b.text)) ||
    (isCjkDominated(a.text) && isLatinDominated(b.text))
  );
}

/**
 * 就地合并翻译特征。输入须已按时间排序（各解析器的产出即如此）。
 */
export function mergeTranslationFeatures(lines: ILyricText[]): ILyricText[] {
  // ① 同时间轴双行：拉丁行做原文、CJK 行做翻译，合并为一条
  const paired: ILyricText[] = [];
  for (const line of lines) {
    const prev = paired[paired.length - 1];
    if (prev && isPairablePair(prev, line)) {
      const latinFirst = isLatinDominated(prev.text);
      const latin = latinFirst ? prev : line;
      const cjk = latinFirst ? line : prev;
      // 先取值再赋值：cjk 可能就是 prev 本身，先改 prev.text 会污染读取
      const originalText = latin.text;
      const translationText = cjk.text;
      prev.text = originalText;
      prev.trText = translationText;
      // 逐字时间轴跟原文走
      if (latin.words?.length) prev.words = latin.words;
      if (latin.hasWordByWord) prev.hasWordByWord = true;
      continue;
    }
    paired.push(line);
  }

  // ② 行尾全角括号内联翻译：拆为 text + trText
  return paired.map((line) => {
    if (line.trText) return line;
    const split = splitInlineTranslation(line.text);
    if (!split) return line;
    return { ...line, text: split.main, trText: split.translation };
  });
}