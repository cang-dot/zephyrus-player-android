/**
 * 页面 chrome 配色：歌单/专辑页等「以打开页封面定底色」的场景。
 *
 * 规则：暗色封面 → 黑色混合封面主色；亮色封面 → 白色混合封面主色（镜像）；
 * 文字墨色按混合结果的亮度自动取黑/白（复用 playerInk 的滞回判定）。
 * 注意取色对象是「打开的页面封面」，不是当前播放歌曲的封面（那是 useCoverColor 的职责）。
 */
import { getImgUrl } from '@/utils';
import { getImageLinearBackground } from '@/utils/linearColor';
import {
  choosePlayerInkTone,
  mixRgb,
  parseRepresentativeCssColor,
  type PlayerInkTone,
  playerInkVariables,
  type RgbColor
} from '@/utils/playerInk';

export interface PageChrome {
  /** 页面背景色（rgb() 字符串） */
  background: string;
  /** 文字墨色倾向：dark = 深字浅底，light = 浅字深底 */
  ink: PlayerInkTone;
  /** 墨色 rgb 三元组字符串（供 rgba(r,g,b,α) 消费） */
  inkRgb: string;
}

/** 暗底方案里主色向黑混合的比例 */
const DARK_BASE_MIX = 0.34;
/** 亮底方案里主色向白混合的比例 */
const LIGHT_BASE_MIX = 0.22;
/** 取色失败/无封面时的兜底主色（与墨色体系一致的近黑） */
const FALLBACK_PRIMARY: RgbColor = { r: 23, g: 23, b: 26 };
const BLACK: RgbColor = { r: 0, g: 0, b: 0 };
const WHITE: RgbColor = { r: 255, g: 255, b: 255 };

const chromeCache = new Map<string, PageChrome>();
const CHROME_CACHE_MAX = 32;

function toRgbString(color: RgbColor): string {
  return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
}

/** 由封面主色推导页面 chrome（纯函数，可单测） */
export function resolvePageChrome(primary: RgbColor): PageChrome {
  const tone = choosePlayerInkTone(primary);
  const background =
    tone === 'light'
      ? mixRgb(BLACK, primary, DARK_BASE_MIX) // 暗封面 → 黑混主色
      : mixRgb(WHITE, primary, LIGHT_BASE_MIX); // 亮封面 → 白混主色（镜像）
  return {
    background: toRgbString(background),
    ink: tone,
    inkRgb: playerInkVariables(tone).rgb
  };
}

/** 把 chrome 转成 CSS 自定义属性表（页根与 #layout-main 共用） */
export function pageChromeVariables(chrome: PageChrome): Record<string, string> {
  return {
    '--page-chrome-bg': chrome.background,
    '--page-chrome-ink': chrome.ink === 'dark' ? '#17171a' : '#ffffff',
    '--page-chrome-ink-rgb': chrome.inkRgb
  };
}

export function fallbackPageChrome(): PageChrome {
  return resolvePageChrome(FALLBACK_PRIMARY);
}

/**
 * 封面 URL → 页面 chrome（带缓存）。取色走小图参数降本；
 * 跨域取色失败时回落兜底主色，保证页面背景永远可用。
 */
export async function getPageChromeForCover(coverUrl: string | null | undefined): Promise<PageChrome> {
  const key = String(coverUrl || '');
  const cached = chromeCache.get(key);
  if (cached) return cached;

  let chrome = fallbackPageChrome();
  try {
    const { primaryColor } = await getImageLinearBackground(getImgUrl(key, '100y100'));
    const primary = parseRepresentativeCssColor(primaryColor) || FALLBACK_PRIMARY;
    chrome = resolvePageChrome(primary);
  } catch {
    // 取色失败（跨域/加载超时）保持兜底 chrome
  }

  chromeCache.set(key, chrome);
  if (chromeCache.size > CHROME_CACHE_MAX) {
    const oldest = chromeCache.keys().next().value;
    if (oldest !== undefined) chromeCache.delete(oldest);
  }
  return chrome;
}

export function clearPageChromeCache(): void {
  chromeCache.clear();
}
