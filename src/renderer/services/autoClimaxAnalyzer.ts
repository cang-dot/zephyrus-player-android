/**
 * autoClimaxAnalyzer — DSP 自动高潮分析服务（第四优先级数据源）。
 *
 * 流程：查永久缓存（含负缓存）→ 前置 CORS host 探测 → fetch/本地读取整曲字节 →
 *       structureAnalyzer.worker 离线分析 → normalize → 写 auto_climax_data。
 * 手动 > 社区 > server 标注 > 本服务的优先级由调用方（communityData）保证；
 * 分析失败只记内存冷却，不持久化（网络类失败下次应重试）。
 */
import type { ClimaxSegment } from '@/api/climax';
import { probeAnalysisCapability, upgradeToHttps } from '@/services/audioAnalysisGate';
import { decodeToMono8k } from '@/utils/audio/decodeToMono8k';
import { getAutoClimax, saveAutoClimax } from '@/services/cacheService';
import { isElectron } from '@/utils';
import { deviceTier } from '@/utils/deviceTier';

export interface AutoClimaxResult {
  segments: ClimaxSegment[];
  confidence: number;
}

/** 内存级失败冷却：同一 URL 5 分钟内不重试（网络抖动/解析失败），不持久化 */
const failureCooldown = new Map<string, number>();
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

const inFlight = new Map<string, Promise<AutoClimaxResult | null>>();

let worker: Worker | null = null;
let workerBroken = false;
let pendingId = 0;
const pending = new Map<number, { resolve: (r: AutoClimaxResult | null) => void }>();

function ensureWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../workers/structureAnalyzer.worker.ts', import.meta.url), {
      type: 'module'
    });
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      const entry = pending.get(msg.__id);
      if (!entry) return;
      pending.delete(msg.__id);
      if (msg.type === 'result') {
        entry.resolve({
          segments: Array.isArray(msg.segments) ? msg.segments : [],
          confidence: Number(msg.confidence) || 0
        });
      } else {
        entry.resolve(null);
      }
    };
    worker.onerror = () => {
      workerBroken = true;
      worker = null;
      pending.forEach((entry) => entry.resolve(null));
      pending.clear();
    };
  } catch {
    workerBroken = true;
    return null;
  }
  return worker;
}

/** 读取自动分析开关（music-full-config 的 autoClimaxAnalysis，缺省视为开启） */
export function isAutoClimaxEnabled(): boolean {
  try {
    const raw = localStorage.getItem('music-full-config');
    const config = raw ? JSON.parse(raw) : {};
    return config.autoClimaxAnalysis !== false;
  } catch {
    return true;
  }
}

/** 取整曲字节（与 useSmartAudio.preloadAndAnalyzeBpm 同分支） */
async function fetchAudioBytes(url: string): Promise<ArrayBuffer | null> {
  if (url.startsWith('local://')) {
    if (!isElectron) return null;
    const filePath = url.replace(/^local:\/{2,3}/, '').replace(/%2F/g, '/');
    const result: unknown = await (window as unknown as { electron: { ipcRenderer: { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> } } })
      .electron.ipcRenderer.invoke('read-file-binary', decodeURIComponent(filePath));
    if (!result) return null;
    const uint8 = result as Uint8Array;
    const copy = new Uint8Array(uint8.byteLength);
    copy.set(uint8);
    return copy.buffer;
  }
  if (!/^https?:/i.test(url)) return null;
  const response = await fetch(upgradeToHttps(url));
  if (!response.ok) return null;
  return response.arrayBuffer();
}

/**
 * 主线程解码 + 重采样到 8kHz 单声道 PCM（decodeToMono8k 见 utils/audio）。
 * Worker 只承担纯计算。
 */
async function analyzeBytes(arrayBuffer: ArrayBuffer, duration?: number): Promise<AutoClimaxResult | null> {
  const w = ensureWorker();
  if (!w) return Promise.resolve(null);
  let pcm: Float32Array;
  try {
    pcm = await decodeToMono8k(arrayBuffer);
  } catch (err) {
    console.warn('[AutoClimax] 解码失败:', err);
    return null;
  }
  const id = ++pendingId;
  return new Promise((resolve) => {
    pending.set(id, { resolve });
    const pcmCopy = new Float32Array(pcm); // transfer 需要独立 buffer
    w.postMessage({ type: 'analyze', pcm: pcmCopy, duration, __id: id }, [pcmCopy.buffer]);
    // 兜底超时：worker 卡死不悬挂调用方
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve(null);
      }
    }, 60000);
  });
}

/**
 * 确保某歌的自动高潮数据可用（缓存 → 分析 → 持久化）。
 * 返回 null = 不可分析/失败/禁用；segments 为空数组 = 分析过但无结论（负缓存已写入）。
 * duration 接受毫秒（song.dt）或秒，内部统一为秒。
 */
export async function ensureAutoClimax(
  songId: string,
  url: string | undefined,
  duration?: number
): Promise<AutoClimaxResult | null> {
  if (!isAutoClimaxEnabled() || !songId || !url) return null;
  const durationSec =
    duration && duration > 1000 ? duration / 1000 : duration && duration > 0 ? duration : undefined;
  const cached = await getAutoClimax(songId);
  if (cached != null) {
    return { segments: cached.segments, confidence: 0 };
  }
  const existing = inFlight.get(songId);
  if (existing) return existing;

  const job = (async (): Promise<AutoClimaxResult | null> => {
    const cooldownUntil = failureCooldown.get(url) || 0;
    if (Date.now() < cooldownUntil) return null;
    // 在线音源先做 host 级可达性探测（失败 5 分钟内同 host 不再试）
    if (!url.startsWith('local://')) {
      const probe = await probeAnalysisCapability(url).catch(() => false);
      if (!probe) {
        failureCooldown.set(url, Date.now() + FAILURE_COOLDOWN_MS);
        return null;
      }
    }
    try {
      const bytes = await fetchAudioBytes(url);
      if (!bytes) {
        failureCooldown.set(url, Date.now() + FAILURE_COOLDOWN_MS);
        return null;
      }
      const result = await analyzeBytes(bytes, durationSec);
      if (!result) {
        failureCooldown.set(url, Date.now() + FAILURE_COOLDOWN_MS);
        return null;
      }
      // worker 输出已是秒制且排序/钳制过；这里只做曲长范围内的最终过滤
      // （不走 normalizeClimaxSegments——它的毫秒启发式在 >16.7min 歌上会误判）
      const segments = result.segments
        .map((s) => ({
          start: Math.max(0, Math.min(durationSec ?? Infinity, s.start)),
          end: Math.max(0, Math.min(durationSec ?? Infinity, s.end))
        }))
        .filter((s) => s.end > s.start)
        .sort((a, b) => a.start - b.start);
      await saveAutoClimax(songId, { segments, contributor: 'auto-dsp' });
      return { segments, confidence: result.confidence };
    } catch {
      failureCooldown.set(url, Date.now() + FAILURE_COOLDOWN_MS);
      return null;
    }
  })();

  inFlight.set(songId, job);
  try {
    return await job;
  } finally {
    inFlight.delete(songId);
  }
}

/** 预载场景是否值得跑（低端机不做预分析，进入播放器时仍会按需触发） */
export function shouldPreanalyze(): boolean {
  return deviceTier !== 'low';
}
