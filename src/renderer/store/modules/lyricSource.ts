/**
 * LyricSource Store — 歌词请求源优先级与单曲临时覆盖
 *
 * 三项能力（播放界面设置面板 · 数据/歌词来源）：
 *   1. 默认请求源：优先级列表首位即默认源（卡片点击置顶）
 *   2. 请求优先级：横向拖拽排序，持久化 localStorage（lyricSourceOrder）
 *   3. 本首临时切换：单曲级 override，仅存会话态（不持久化），切换后由
 *      调用方清空 playMusic.lyric 并重新加载
 *
 * 源语义与 usePlayerHooks.loadBestLyric 的 loader 一一对应；
 * 'ttml' 是 AMLL 社区逐字库，走 amllStore 独立链路，仅参与优先级展示，
 * 不进入 loadBestLyric 的串行/兜底池（TTML 优先级由歌词渲染层天然保证）。
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface LyricSourceDef {
  key: string;
  label: string;
  /** 简述（设置页小字） */
  desc: string;
}

export const LYRIC_SOURCES: readonly LyricSourceDef[] = Object.freeze([
  { key: 'netease', label: '网易云', desc: '官方 LRC / YRC 逐字' },
  { key: 'qq', label: 'QQ 音乐', desc: '逐字歌词组 QRC（需登录态）' },
  { key: 'kugou', label: '酷狗', desc: 'KRC / LRC' },
  { key: 'community', label: '社区', desc: '网易云社区歌词' },
  { key: 'lrclib', label: 'LRCLIB', desc: '开源歌词库' },
  { key: 'ttml', label: 'TTML 库', desc: 'AMLL 社区逐字（独立链路）' }
]) as readonly LyricSourceDef[];

const ORDER_STORAGE_KEY = 'lyricSourceOrder';
const DEFAULT_ORDER = ['netease', 'qq', 'kugou', 'community', 'lrclib', 'ttml'];

function normalizeOrder(raw: string | null): string[] {
  const saved = raw ? (JSON.parse(raw) as string[]) : [];
  const valid = saved.filter((key) => LYRIC_SOURCES.some((s) => s.key === key));
  const missing = DEFAULT_ORDER.filter((key) => !valid.includes(key));
  return [...valid, ...missing];
}

export const useLyricSourceStore = defineStore('lyricSource', () => {
  const order = ref<string[]>(normalizeOrder(localStorage.getItem(ORDER_STORAGE_KEY)));
  /** 单曲临时覆盖：songId → 源 key；'auto' 或删除该键 = 跟随默认 */
  const songOverride = ref<Record<string, string>>({});

  function persistOrder(): void {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order.value));
  }

  /** 拖拽排序：整体重排（UI 直接传新数组） */
  function setOrder(next: string[]): void {
    order.value = normalizeOrder(JSON.stringify(next));
    persistOrder();
  }

  /** 点击卡片置顶 = 设为默认请求源 */
  function promoteToDefault(key: string): void {
    const rest = order.value.filter((k) => k !== key);
    order.value = [key, ...rest];
    persistOrder();
  }

  function setSongOverride(songId: string | number | null | undefined, source: string | null): void {
    if (!songId) return;
    if (!source || source === 'auto') delete songOverride.value[String(songId)];
    else songOverride.value[String(songId)] = source;
  }

  function getSongOverride(songId: string | number | null | undefined): string | null {
    if (!songId) return null;
    return songOverride.value[String(songId)] ?? null;
  }

  /** 按优先级排序后的源 key 列表 */
  function effectiveOrder(): string[] {
    return [...order.value];
  }

  return {
    order,
    songOverride,
    setOrder,
    promoteToDefault,
    setSongOverride,
    getSongOverride,
    effectiveOrder
  };
});
