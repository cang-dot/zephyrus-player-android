/**
 * 歌名展示拆分：
 * ① 结尾闭合括号（全角/半角）视为「后缀」——如 `明知故犯（重制版）`、`Song (Live)`；
 *    未闭合、整名都在括号里的不剥。
 * ② 春晓乐队《长大就好了》（网易云专辑 399350672）的曲目名为「中文 English」连写
 *    且无括号——英文部分按后缀处理（曲目 id 白名单限定，避免对普通「中文 English」
 *    歌名误拆）。曲目名已从网易云 API 码位级核实：中文段无空格，中英以单个
 *    U+0020 分隔，英文段内部可含空格/全角逗号。
 *
 * 纯展示层拆分：底层数据（搜索/播放/分享）仍使用完整歌名。
 * 渲染约定：main + suffix 同字号；suffix 用淡一级颜色（约 opacity .62）；
 * 播放页大标题只显示 main。
 */

const CJK_CHAR = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const LATIN_CHAR = /[A-Za-z]/;

/** 春晓乐队《长大就好了》曲目 id 白名单 */
const CHUNXIAO_ALBUM_SONG_IDS = new Set([
  '3438657356',
  '3438657413',
  '3438657402',
  '3438657422',
  '3438657449',
  '3438658018',
  '3438657961',
  '3438657967',
  '3438659116',
  '3438657953'
]);

export interface SongTitleParts {
  main: string;
  suffix: string;
}

/** 结尾闭合括号 → 后缀；找不到配对开括号（或整名都在括号里）返回 null */
function splitTrailingParenSuffix(name: string): SongTitleParts | null {
  const trimmed = name.trimEnd();
  const last = trimmed[trimmed.length - 1];
  if (last !== ')' && last !== '）') return null;
  const openIndex = Math.max(trimmed.lastIndexOf('('), trimmed.lastIndexOf('（'));
  if (openIndex <= 0) return null;
  const main = trimmed.slice(0, openIndex).trimEnd();
  const suffix = trimmed.slice(openIndex);
  if (!main) return null;
  return { main, suffix };
}

/** 「中文 English」连写 → 在第一个「CJK 后接空格且再往后是拉丁字母」处拆分 */
function splitCjkLatinName(name: string): SongTitleParts | null {
  for (let index = 0; index < name.length - 2; index += 1) {
    if (
      CJK_CHAR.test(name[index]) &&
      name[index + 1] === ' ' &&
      LATIN_CHAR.test(name[index + 2])
    ) {
      const main = name.slice(0, index + 1).trimEnd();
      const suffix = name.slice(index + 2).trim();
      if (!main || !suffix) return null;
      return { main, suffix };
    }
  }
  return null;
}

export function splitSongTitle(
  name: string,
  songId?: string | number | null
): SongTitleParts {
  if (!name) return { main: '', suffix: '' };
  const paren = splitTrailingParenSuffix(name);
  if (paren) return paren;

  if (songId != null && CHUNXIAO_ALBUM_SONG_IDS.has(String(songId))) {
    const cjkLatin = splitCjkLatinName(name);
    if (cjkLatin) return cjkLatin;
  }
  return { main: name, suffix: '' };
}