/**
 * 听歌热力图统计（纯函数）：
 * 把带时间戳的播放记录聚合成「周×7」网格（GitHub contributions 风格）。
 * 本地播放历史从 2026-09 起才记录 lastPlayedAt，存量无时间戳的数据不参与。
 */

export const HEATMAP_WEEKS = 16;

export interface PlayTimestampEntry {
  id: string | number;
  timestamp: number;
}

export interface HeatmapCell {
  /** YYYY-MM-DD */
  key: string;
  count: number;
  /** 未来日期（本周尚未到的格子） */
  future: boolean;
}

export interface HeatmapResult {
  /** 列主序：cells[week * 7 + weekday]，weekday 0=周一 */
  cells: HeatmapCell[];
  weeks: number;
  total: number;
  activeDays: number;
}

export function dateKeyOf(value: number): string {
  const d = new Date(value);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** 周一 0 点对齐 */
function startOfWeek(value: number): number {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  const weekday = (d.getDay() + 6) % 7; // 0=周一
  return d.getTime() - weekday * 86400000;
}

export function buildHeatmap(
  entries: PlayTimestampEntry[],
  now = Date.now(),
  weeks = HEATMAP_WEEKS
): HeatmapResult {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const timestamp = Number(entry?.timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) continue;
    const key = dateKeyOf(timestamp);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const gridStart = startOfWeek(now) - (weeks - 1) * 7 * 86400000;
  const endOfToday = (() => {
    const d = new Date(now);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  })();

  const cells: HeatmapCell[] = [];
  let total = 0;
  let activeDays = 0;
  for (let week = 0; week < weeks; week++) {
    for (let weekday = 0; weekday < 7; weekday++) {
      const dayStart = gridStart + (week * 7 + weekday) * 86400000;
      const key = dateKeyOf(dayStart);
      const future = dayStart > endOfToday;
      const count = counts.get(key) ?? 0;
      if (!future && count > 0) {
        total += count;
        activeDays += 1;
      }
      cells.push({ key, count, future });
    }
  }
  return { cells, weeks, total, activeDays };
}

/** 色阶 0-4（5 档）：按当日次数相对峰值分档 */
export function heatLevel(count: number, peak: number): number {
  if (count <= 0 || peak <= 0) return 0;
  const ratio = count / Math.max(1, peak);
  if (ratio > 0.66) return 4;
  if (ratio > 0.4) return 3;
  if (ratio > 0.18) return 2;
  return 1;
}
