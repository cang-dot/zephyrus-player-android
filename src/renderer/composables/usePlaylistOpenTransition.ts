/**
 * 歌单跳转过渡（首页/发现页/云卡 → 歌单页）单例。
 *
 * 点击卡片后立刻做两件事：
 * 1) 把目标歌单的 chrome 底色写进 #layout-main 与 :root —— 歌单页自身的
 *    `background-color 480ms` 过渡因此从点击瞬间起跑，与覆盖层同步收敛；
 * 2) 显示覆盖层：底色块从卡片矩形扩展并变色到全屏、封面克隆同步放大，
 *    歌单页挂载后由 `resolve(heroRect)` 把封面克隆对齐到真实 hero 再淡出交接。
 *
 * 降级：`prefers-reduced-motion: reduce`、拿不到卡片矩形、非浏览器环境时返回 false，
 * 调用方照常 router.push（沿用既有二级页过渡）。
 * 由 MobileLayout 渲染覆盖层，MusicListPage 负责 resolve。
 */
import { computed, ref, shallowRef } from 'vue';

import { getImgUrl } from '@/utils';
import {
  fallbackPageChrome,
  getPageChromeForCover,
  type PageChrome,
  pageChromeVariables,
  resolvePageChrome} from '@/utils/pageChrome';
import { parseRepresentativeCssColor } from '@/utils/playerInk';

export interface TransitionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlaylistOpenSource {
  /** 源卡片/按钮的视口矩形 */
  rect?: TransitionRect | null;
  /** 目标歌单封面（用于取 chrome 底色与封面克隆） */
  coverUrl?: string;
  /** 已知的目标色（如发现页卡片的 themeColor），可省去取色等待 */
  color?: string;
}

/** 底色块扩展时长 */
export const PLAYLIST_OPEN_EXPAND_MS = 360;
/** 交接对齐时长 */
const ALIGN_MS = 140;
/** 覆盖层淡出时长 */
const FADE_MS = 200;
const FALLBACK_RADIUS = 24;

const phase = ref<'idle' | 'expanding' | 'fadeout'>('idle');
const sourceRect = shallowRef<TransitionRect | null>(null);
const heroRect = shallowRef<TransitionRect | null>(null);
const coverUrl = ref('');
const reveal = ref(false);

let timer: ReturnType<typeof setTimeout> | undefined;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });

/** 目标 chrome 变量写到布局根与 :root（歌单页同样写这三处，保证同源） */
function applyChromeToLayout(chrome: PageChrome) {
  const vars = pageChromeVariables(chrome);
  const targets = [document.getElementById('layout-main'), document.documentElement];
  targets.forEach((el) => {
    if (!el) return;
    Object.entries(vars).forEach(([name, value]) => el.style.setProperty(name, value));
  });
}

/** 覆盖层底色块：卡片矩形 → 全屏（scale 展开，圆角同步收到 0） */
const bgStyle = computed(() => {
  const rect = sourceRect.value;
  if (!rect) return { display: 'none' } as Record<string, string>;
  const { w, h } = viewport();
  const scaleX = (reveal.value ? w / rect.w : 1).toFixed(4);
  const scaleY = (reveal.value ? h / rect.h : 1).toFixed(4);
  return {
    position: 'absolute',
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
    borderRadius: reveal.value ? '0px' : `${FALLBACK_RADIUS}px`,
    transformOrigin: 'top left',
    transform: `scale(${scaleX}, ${scaleY})`,
    transition: reveal.value
      ? `transform ${PLAYLIST_OPEN_EXPAND_MS}ms cubic-bezier(0.32, 0.72, 0, 1), border-radius ${PLAYLIST_OPEN_EXPAND_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`
      : 'none'
  } as Record<string, string>;
});

/** 封面克隆：卡片矩形 → hero 矩形（hero 未知时先放大到估算位置，resolve 时精确对齐） */
const coverStyle = computed(() => {
  const rect = sourceRect.value;
  if (!rect || !coverUrl.value) return { display: 'none' } as Record<string, string>;
  if (!reveal.value) {
    return {
      position: 'absolute',
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.w}px`,
      height: `${rect.h}px`,
      borderRadius: '20px',
      transition: 'none'
    } as Record<string, string>;
  }
  return {
    position: 'absolute',
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
    borderRadius: '20px',
    transition: `transform ${ALIGN_MS}ms ease, border-radius ${PLAYLIST_OPEN_EXPAND_MS}ms ease`
  } as Record<string, string>;
});

/** 封面克隆的 transform（相对源矩形 → hero 矩形；未测到 hero 时用估算位置） */
const coverTransform = computed(() => {
  const rect = sourceRect.value;
  if (!rect || !reveal.value) return 'none';
  const { w, h } = viewport();
  const target = heroRect.value ?? {
    x: w * 0.5 - Math.min(w * 0.68, 320) / 2,
    // hero 位于顶栏下方：按视口高度估算，resolve 时以真实 hero 矩形覆盖
    y: Math.min(96, Math.max(72, Math.round(h * 0.11))),
    w: Math.min(w * 0.68, 320),
    h: Math.min(w * 0.68, 320)
  };
  const scale = Math.max(0.01, target.w / rect.w);
  const dx = target.x - rect.x;
  const dy = target.y - rect.y;
  return `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(4)})`;
});

function clear() {
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  phase.value = 'idle';
  sourceRect.value = null;
  heroRect.value = null;
  coverUrl.value = '';
  reveal.value = false;
}

/** 封面克隆的解析后地址（模板直接用，避免在布局层再引入 getImgUrl） */
const coverSrc = computed(() => (coverUrl.value ? getImgUrl(coverUrl.value, '500y500') : ''));

/** 是否正在进行歌单跳转过渡（MobileLayout 据此跳过二级页自带的位移动画/底色闪动） */
function isActive() {
  return phase.value !== 'idle';
}

export function usePlaylistOpenTransition() {
  return {
    phase,
    sourceRect,
    coverUrl,
    coverSrc,
    bgStyle,
    coverStyle,
    coverTransform,
    isActive
  };
}

/**
 * 开始过渡。返回 false 表示降级（调用方直接 router.push 即可）。
 */
export function beginPlaylistOpen(source: PlaylistOpenSource): boolean {
  if (typeof window === 'undefined' || prefersReducedMotion()) return false;
  const rect = source.rect;
  if (!rect || rect.w <= 0 || rect.h <= 0) return false;

  clear();
  sourceRect.value = { ...rect };
  coverUrl.value = source.coverUrl ?? '';
  phase.value = 'expanding';

  const parsed = parseRepresentativeCssColor(source.color);
  applyChromeToLayout(parsed ? resolvePageChrome(parsed) : fallbackPageChrome());
  if (!parsed && coverUrl.value) {
    void getPageChromeForCover(coverUrl.value)
      .then((chrome) => {
        if (phase.value !== 'idle') applyChromeToLayout(chrome);
      })
      .catch(() => {});
  }

  // 两帧后再置 reveal，确保初始态已上屏、transform 过渡生效
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (phase.value === 'expanding') reveal.value = true;
    });
  });

  // 兜底：目标页迟迟不 resolve 时也要收尾，避免覆盖层卡死
  timer = setTimeout(() => resolvePlaylistOpen(), PLAYLIST_OPEN_EXPAND_MS + 900);
  return true;
}

/**
 * 目标歌单页挂载完成后调用：把封面克隆对齐到真实 hero 位置并淡出覆盖层。
 * 不传 heroRect 也能收尾（覆盖层直接淡出）。
 */
export function resolvePlaylistOpen(hero?: TransitionRect | null) {
  if (phase.value === 'idle') return;
  if (hero && hero.w > 0 && hero.h > 0) heroRect.value = { ...hero };
  reveal.value = true;
  phase.value = 'fadeout';
  if (timer) clearTimeout(timer);
  timer = setTimeout(clear, FADE_MS + 80);
}