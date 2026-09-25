import { Howl } from 'howler';

import { isElectron } from '@/utils';

import { isAndroidNative } from './androidNative';

/**
 * 网页端在线歌曲音频响应可行性网关
 *
 * 背景：非 Electron 环境的流媒体此前走 _setupEQHowlMobile（不建 Web Audio 图），
 * 因为跨域媒体一旦接入 createMediaElementSource 会被 taint 成静音且不可逆。
 * 实测（2026-09）：网易云 CDN 绝大多数节点（m7/m8/m701/m702/m801）与自建曲库
 * 均返回 Access-Control-Allow-Origin: *，少数节点（m802/jd-musicrep 等）不带。
 * 因此按"运行时探测 + host 级缓存"决定是否武装元素并建图；探测不过的一律
 * 维持原直通播放——本网关只影响可视化，绝不影响播放本身。
 *
 * 铁律：只有探测通过的 URL 才给媒体元素挂 crossOrigin='anonymous'；
 * 挂了 crossOrigin 却打到无 ACAO 的节点，元素加载会直接失败（连声音都没有）。
 */

type ProbeVerdict = {
  ok: boolean;
  /** 探测时刻；失败结论只短期信任，避免网络抖动污染整个会话 */
  at: number;
};

/** 失败结论的复检间隔（毫秒）——可能只是探测瞬间网络抖动 */
const FAIL_TTL_MS = 5 * 60 * 1000;

/** host 级缓存：网易 CDN 节点按解析轮换，host 粒度足够；带界防泄漏 */
const probeCache = new Map<string, ProbeVerdict>();
const PROBE_CACHE_MAX = 96;

/**
 * 是否为"纯 Web 浏览器"平台：
 * Electron 无 CORS 限制（走桌面建图路径），Android 原生有 PeakSafeAudioProcessor
 * 分析通道（styleEngine 直接注入），都不经过本网关。
 * 注意：@capacitor/core 的 web 运行时在纯浏览器里也会注册 window.Capacitor，
 * 必须用 isNativePlatform() 区分真实原生壳与网页版。
 */
export function isWebAnalysisPlatform(): boolean {
  if (isElectron || isAndroidNative()) return false;
  if (typeof window === 'undefined') return false;
  const capacitor = (window as any).Capacitor;
  return !(capacitor?.isNativePlatform?.() === true);
}

function cacheVerdict(host: string, ok: boolean) {
  if (probeCache.size >= PROBE_CACHE_MAX) {
    const oldest = probeCache.keys().next().value;
    if (oldest !== undefined) probeCache.delete(oldest);
  }
  probeCache.set(host, { ok, at: Date.now() });
}

/**
 * http→https 升级：media 元素在 https 页面上会自动升级混合内容，
 * fetch() 不会（直接 TypeError: Failed to fetch）——所有对音频直链的
 * fetch 都必须先走这一步。
 */
export function upgradeToHttps(url: string): string {
  return url.replace(/^http:\/\//i, 'https://');
}

/**
 * 探测 URL 所在 CDN 是否允许跨域读取（决定能否安全建 Web Audio 图）。
 * 结果按 host 缓存：成功长期有效（CDN 的 ACAO 是节点级配置），
 * 失败 5 分钟后复检。blob:/data: 等同源 URL 视作可分析。
 */
export async function probeAnalysisCapability(url: string): Promise<boolean> {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return false;
  }

  const cached = probeCache.get(host);
  if (cached) {
    const expired = !cached.ok && Date.now() - cached.at > FAIL_TTL_MS;
    if (!expired) return cached.ok;
  }

  try {
    // 与媒体元素实际请求对齐：https 升级 + CORS 模式 + 小段 Range
    const probeUrl = upgradeToHttps(url);
    const res = await fetch(probeUrl, {
      mode: 'cors',
      headers: { Range: 'bytes=0-1023' }
    });
    try {
      await res.body?.cancel();
    } catch {
      /* 连接释放失败无关紧要 */
    }
    const ok = res.ok;
    console.debug(
      `[audioAnalysisGate] 探测 ${host}: ${ok ? 'ACAO 通过，武装建图' : `不可分析(HTTP ${res.status})，维持直通`}`
    );
    cacheVerdict(host, ok);
    return ok;
  } catch {
    // CORS 拒绝时 fetch 直接 throw；按不可分析处理，5 分钟后复检
    console.debug(`[audioAnalysisGate] 探测 ${host}: 请求被拒(CORS/网络)，维持直通`);
    cacheVerdict(host, false);
    return false;
  }
}

/** Howler html5 模式下 Howl 的媒体元素节点，构造后同步存在 */
function getHowlMediaNode(howl: Howl): HTMLMediaElement | null {
  const node = (howl as any)._sounds?.[0]?._node;
  return node instanceof HTMLMediaElement ? node : null;
}

/**
 * 武装 Howl：给媒体元素挂 crossOrigin='anonymous' 并重设 src 触发重载，
 * 使响应以 CORS 模式获取，从而可以安全 createMediaElementSource。
 * 必须在 Howl 构造后尽早（同任务内）调用——Howler 构造时已赋 src 开始加载，
 * 重设 src 会中止原请求并以 CORS 模式重新发起。
 */
export function armHowlForAnalysis(howl: Howl, url: string): void {
  try {
    const node = getHowlMediaNode(howl);
    if (!node) return;
    // 用属性而非 crossOrigin 属性赋值：后者在部分环境只读（happy-dom），
    // 属性反射在所有真实浏览器中等价
    node.setAttribute('crossorigin', 'anonymous');
    node.src = url;
    node.load();
  } catch {
    /* 武装失败退化为普通播放（setupEQ 按"未武装"分流） */
  }
}

/**
 * 摘除武装：Howler 的 html5 对象池会回收带 crossOrigin 残留的元素，
 * 复用去播无 ACAO 的歌曲会整段加载失败。发现残留时摘除并重载；
 * 无残留（新节点）则不动，零开销。
 */
export function disarmHowlAudio(howl: Howl, url: string): void {
  try {
    const node = getHowlMediaNode(howl);
    if (!node) return;
    if (!node.getAttribute('crossorigin')) return;
    node.removeAttribute('crossorigin');
    node.src = url;
    node.load();
  } catch {
    /* 同上 */
  }
}

/** 是否已武装（audioService.setupEQ 由此判定走建图分支） */
export function isAnalysisArmed(howl: Howl): boolean {
  const node = getHowlMediaNode(howl);
  return !!node && node.getAttribute('crossorigin') === 'anonymous';
}

/** 清空探测缓存（测试用） */
export function resetProbeCache(): void {
  probeCache.clear();
}
