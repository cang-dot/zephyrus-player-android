/**
 * 歌单跳转过渡（首页/发现页/云卡 → 歌单页，以及返回）单例。
 *
 * 去程：点击卡片后立刻把目标歌单的 chrome 底色写进 #layout-main 与 :root
 * （歌单页自身的 `background-color 480ms` 因此从点击瞬间起跑、与覆盖层同步收敛），
 * 覆盖层底色块从卡片矩形扩展并变色到全屏、封面克隆放大到 hero；
 * 歌单页挂载后由 `resolvePlaylistOpen(heroRect)` 对齐并淡出。
 *
 * 回程：`beginPlaylistOpenReturn()` 由歌单页卸载前调用——底色块从全屏收缩回
 * 记住的源卡片矩形再淡出，与去程镜像。
 *
 * 降级：`prefers-reduced-motion: reduce`、拿不到卡片矩形、非浏览器环境返回 false，
 * 调用方照常路由跳转（沿用既有二级页过渡）。
 */
import { computed, nextTick, ref, shallowRef } from 'vue';

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

interface LayerState {
  rect: TransitionRect;
  radius: number;
}

/** 底色块扩展/收缩时长 */
export const PLAYLIST_OPEN_EXPAND_MS = 360;
/** 交接对齐时长 */
const ALIGN_MS = 140;
/** 覆盖层淡出时长 */
const FADE_MS = 200;
const CARD_RADIUS = 20;

const phase = ref<'idle' | 'expanding' | 'fadeout'>('idle');
const startLayer = shallowRef<LayerState | null>(null);
const endLayer = shallowRef<LayerState | null>(null);
const heroRect = shallowRef<TransitionRect | null>(null);
const coverUrl = ref('');
const bgColor = ref('');
/** reveal 后过渡到的颜色：去程不变（=歌单页 chrome 底），回程渐变成主页底色 */
const bgEndColor = ref('');
const reveal = ref(false);

/** 记住去程的源矩形与最终底色，供回程镜像使用 */
let lastRect: TransitionRect | null = null;
let lastColor = '';
let timer: ReturnType<typeof setTimeout> | undefined;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const viewportRect = (): TransitionRect => ({
  x: 0,
  y: 0,
  w: window.innerWidth,
  h: window.innerHeight
});

/** 目标 chrome 变量写到布局根与 :root（歌单页自己也会写这三处，保证同源） */
function applyChromeToLayout(chrome: PageChrome) {
  const vars = pageChromeVariables(chrome);
  const targets = [document.getElementById('layout-main'), document.documentElement];
  targets.forEach((el) => {
    if (!el) return;
    Object.entries(vars).forEach(([name, value]) => el.style.setProperty(name, value));
  });
  return vars['--page-chrome-bg'] ?? '';
}

/** 遮罩带参数由「起止层」决定：去程卡片→全屏，回程全屏→卡片 */
function assignLayers(start: LayerState, end: LayerState) {
  startLayer.value = start;
  endLayer.value = end;
}

/** 下一帧揭示目标态；不依赖 phase（极快交接也要把目标态上屏），隐藏页用定时器兜底 */
function scheduleReveal() {
  const flip = () => {
    if (phase.value !== 'idle') reveal.value = true;
  };
  void nextTick().then(() => {
    requestAnimationFrame(() => requestAnimationFrame(flip));
    setTimeout(flip, 60);
  });
}

const bgStyle = computed(() => {
  const start = startLayer.value;
  const end = endLayer.value;
  if (!start || !end) return { display: 'none' } as Record<string, string>;
  // bgColor 为空 = 本次过渡无底色块（如回程封面克隆飞行），只渲染克隆层
  if (!bgColor.value) return { display: 'none' } as Record<string, string>;
  const scaleX = end.rect.w / start.rect.w;
  const scaleY = end.rect.h / start.rect.h;
  const dx = end.rect.x - start.rect.x;
  const dy = end.rect.y - start.rect.y;
  return {
    position: 'absolute',
    left: `${start.rect.x}px`,
    top: `${start.rect.y}px`,
    width: `${start.rect.w}px`,
    height: `${start.rect.h}px`,
        backgroundColor: reveal.value ? bgEndColor.value || bgColor.value : bgColor.value,
    transformOrigin: 'top left',
    borderRadius: reveal.value ? `${end.radius}px` : `${start.radius}px`,
    transform: reveal.value ? `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})` : 'none',
    willChange: 'transform',
    transition: reveal.value
      ? `transform ${PLAYLIST_OPEN_EXPAND_MS}ms cubic-bezier(0.32, 0.72, 0, 1), border-radius ${PLAYLIST_OPEN_EXPAND_MS}ms cubic-bezier(0.32, 0.72, 0, 1), background-color ${PLAYLIST_OPEN_EXPAND_MS}ms ease`
      : 'none'
  } as Record<string, string>;
});

/** 封面克隆的解析后地址（模板直接用，避免布局层再引入 getImgUrl） */
const coverSrc = computed(() => (coverUrl.value ? getImgUrl(coverUrl.value, '500y500') : ''));

const coverStyle = computed(() => {
  const start = startLayer.value;
  if (!start || !coverUrl.value) return { display: 'none' } as Record<string, string>;
  return {
    position: 'absolute',
    left: `${start.rect.x}px`,
    top: `${start.rect.y}px`,
    width: `${start.rect.w}px`,
    height: `${start.rect.h}px`,
    borderRadius: `${CARD_RADIUS}px`,
    transition: `transform ${ALIGN_MS}ms ease, border-radius ${PLAYLIST_OPEN_EXPAND_MS}ms ease`
  } as Record<string, string>;
});

/** 封面克隆 transform：卡片矩形 → hero 矩形（未测到 hero 时用估算位置） */
const coverTransform = computed(() => {
  const start = startLayer.value;
  if (!start || !reveal.value) return 'none';
  const { w, h } = { w: window.innerWidth, h: window.innerHeight };
  const target = heroRect.value ?? {
    x: w * 0.5 - Math.min(w * 0.68, 320) / 2,
    // hero 位于顶栏下方：按视口高度估算，resolve 时以真实 hero 矩形覆盖
    y: Math.min(96, Math.max(72, Math.round(h * 0.11))),
    w: Math.min(w * 0.68, 320),
    h: Math.min(w * 0.68, 320)
  };
  const scale = Math.max(0.01, target.w / start.rect.w);
  const dx = target.x - start.rect.x;
  const dy = target.y - start.rect.y;
  return `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(4)})`;
});

/** 主页底色（回程收缩的终点色）：从布局根读取当前主题的 --m-bg */
function resolveHomeBgColor(): string {
  const layout = document.querySelector('.mobile-layout');
  const value = layout ? getComputedStyle(layout).getPropertyValue('--m-bg').trim() : '';
  return value || 'var(--m-bg, #141414)';
}

function resetLayer() {
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  phase.value = 'idle';
  startLayer.value = null;
  endLayer.value = null;
  heroRect.value = null;
    coverUrl.value = '';
  bgEndColor.value = '';
  reveal.value = false;
}

/** 是否正在进行歌单跳转过渡（布局层据此跳过二级页自带的位移/底色过渡） */
function isActive() {
  return phase.value !== 'idle';
}

export function usePlaylistOpenTransition() {
  return {
    phase,
    coverSrc,
    bgStyle,
    coverStyle,
    coverTransform,
    isActive
  };
}

/** 开始去程过渡。返回 false 表示降级（调用方直接路由跳转即可）。 */
export function beginPlaylistOpen(source: PlaylistOpenSource): boolean {
  if (typeof window === 'undefined' || prefersReducedMotion()) return false;
  const rect = source.rect;
  if (!rect || rect.w <= 0 || rect.h <= 0) return false;

  resetLayer();
  coverUrl.value = source.coverUrl ?? '';
  assignLayers({ rect: { ...rect }, radius: CARD_RADIUS }, { rect: viewportRect(), radius: 0 });
  phase.value = 'expanding';

    const parsed = parseRepresentativeCssColor(source.color);
  const initial = parsed ? resolvePageChrome(parsed) : fallbackPageChrome();
  bgColor.value = applyChromeToLayout(initial) || bgColor.value;
  bgEndColor.value = bgColor.value;
  if (!parsed && coverUrl.value) {
    void getPageChromeForCover(coverUrl.value)
      .then((chrome) => {
        bgColor.value = applyChromeToLayout(chrome) || bgColor.value;
        bgEndColor.value = bgColor.value;
      })
      .catch(() => {});
  }

  // 记住源矩形与底色，供回程镜像
  lastRect = { ...rect };
  lastColor = bgColor.value;

  scheduleReveal();
  // 兜底：目标页迟迟不 resolve 也要收尾，避免覆盖层卡死
  timer = setTimeout(() => resolvePlaylistOpen(), PLAYLIST_OPEN_EXPAND_MS + 900);
  return true;
}

/**
 * 歌单页卸载前调用：镜像回程——底色块从全屏收缩回源卡片矩形再淡出。
 */
export function beginPlaylistOpenReturn(): boolean {
  if (typeof window === 'undefined' || prefersReducedMotion()) return false;
  if (!lastRect || !lastColor) return false;

    resetLayer();
  coverUrl.value = '';
  bgColor.value = lastColor;
  // 回程终点色 = 主页底色：收缩过程中从歌单页 chrome 色渐变过来，落定时无缝融入页面
  bgEndColor.value = resolveHomeBgColor();
  assignLayers({ rect: viewportRect(), radius: 0 }, { rect: { ...lastRect }, radius: CARD_RADIUS });
  phase.value = 'expanding';

  scheduleReveal();
  timer = setTimeout(() => resolvePlaylistOpen(), PLAYLIST_OPEN_EXPAND_MS + 420);
  return true;
}

/**
 * 目标歌单页挂载完成后调用：把封面克隆对齐到真实 hero 位置并淡出覆盖层。
 * 不传 heroRect 也能收尾（覆盖层直接淡出）。
 */
export function resolvePlaylistOpen(hero?: TransitionRect | null) {
  if (phase.value === 'idle') return;
  if (hero && hero.w > 0 && hero.h > 0) heroRect.value = { ...hero };
  // 极端情况下（交接极快）reveal 还没翻：直接置真，让覆盖层先到目标态再淡出
  reveal.value = true;
  phase.value = 'fadeout';
  if (timer) clearTimeout(timer);
  timer = setTimeout(resetLayer, FADE_MS + 80);
}

/**
 * 回程封面克隆飞行（fixed 覆盖层，不受任何容器裁剪）：
 * 封面克隆从歌单页 hero 矩形飞回主页卡片矩形，随后淡出。由主页侧消费
 * `musicListCoverReturn` 后调用；不带底色块。
 */
export interface ReturnFlightPayload {
  heroRect: TransitionRect;
  endRect: TransitionRect;
  coverUrl?: string;
}

export function beginReturnFlight(payload: ReturnFlightPayload): boolean {
  if (typeof window === 'undefined' || prefersReducedMotion()) return false;
  if (!payload.heroRect || !payload.endRect) return false;
  if (payload.heroRect.w <= 0 || payload.endRect.w <= 0) return false;

  resetLayer();
  coverUrl.value = payload.coverUrl ?? '';
  bgColor.value = '';
  assignLayers(
    { rect: { ...payload.heroRect }, radius: CARD_RADIUS },
    { rect: { ...payload.endRect }, radius: CARD_RADIUS }
  );
  phase.value = 'expanding';

  scheduleReveal();
  timer = setTimeout(() => resolvePlaylistOpen(), PLAYLIST_OPEN_EXPAND_MS + 320);
  return true;
}