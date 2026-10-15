/**
 * 页面 chrome 配色：歌单/专辑页等「以打开页封面定底色」的场景。
 *
 * muted（默认）：暗色封面 → 黑色混合封面主色；亮色封面 → 白色混合封面主色（镜像）；
 * vivid：直接取封面外围面积最大的颜色原明度上底，不再向黑/白混合。
 * 文字墨色按背景亮度自动取黑/白（复用 playerInk 的滞回判定，两种策略共用）。
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

/** 背景取色策略（设置项：歌单/专辑页背景） */
export type PageChromeStrategy = 'muted' | 'vivid';

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
export function resolvePageChrome(
  primary: RgbColor,
  strategy: PageChromeStrategy = 'muted'
): PageChrome {
  const tone = choosePlayerInkTone(primary);
  const background =
    strategy === 'vivid'
      ? primary // 高饱和：直接上封面主色，保持原明度
      : tone === 'light'
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

export function fallbackPageChrome(strategy: PageChromeStrategy = 'muted'): PageChrome {
  return resolvePageChrome(FALLBACK_PRIMARY, strategy);
}

/**
 * 提取封面外围环带（外缘 1/4）里面积最大的颜色桶：vivid 策略的取色源。
 * 「外围最大面积颜色」比全图平均更贴专辑装帧的底色（全图平均会被中心主体拉偏）。
 * 4bit/通道量化分桶抑制噪点；跨域取像素失败返回 null。
 */
function extractEdgeDominantColor(imageSrc: string): Promise<RgbColor | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 96;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const band = Math.floor(size / 4);
        const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const inEdge = x < band || x >= size - band || y < band || y >= size - band;
            if (!inEdge) continue;
            const i = (y * size + x) * 4;
            if (data[i + 3] < 125) continue;
            const key = `${data[i] >> 4}-${data[i + 1] >> 4}-${data[i + 2] >> 4}`;
            const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
            bucket.r += data[i];
            bucket.g += data[i + 1];
            bucket.b += data[i + 2];
            bucket.n += 1;
            buckets.set(key, bucket);
          }
        }
        let best: { r: number; g: number; b: number; n: number } | null = null;
        for (const bucket of buckets.values()) {
          if (!best || bucket.n > best.n) best = bucket;
        }
        if (!best || best.n === 0) {
          resolve(null);
          return;
        }
        resolve({ r: best.r / best.n, g: best.g / best.n, b: best.b / best.n });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageSrc;
  });
}

/**
 * 封面 URL → 页面 chrome（带缓存，缓存键含策略）。取色走小图参数降本；
 * 跨域取色失败时回落兜底主色，保证页面背景永远可用。
 */
export async function getPageChromeForCover(
  coverUrl: string | null | undefined,
  strategy: PageChromeStrategy = 'muted'
): Promise<PageChrome> {
  const url = String(coverUrl || '');
  const key = `${url}|${strategy}`;
  const cached = chromeCache.get(key);
  if (cached) return cached;

  let chrome = fallbackPageChrome(strategy);
  try {
    if (strategy === 'vivid') {
      const edge = await extractEdgeDominantColor(getImgUrl(url, '100y100'));
      chrome = resolvePageChrome(edge || FALLBACK_PRIMARY, 'vivid');
    } else {
      const { primaryColor } = await getImageLinearBackground(getImgUrl(url, '100y100'));
      const primary = parseRepresentativeCssColor(primaryColor) || FALLBACK_PRIMARY;
      chrome = resolvePageChrome(primary, 'muted');
    }
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
