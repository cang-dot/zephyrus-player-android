import { describe, expect, it } from 'vitest';

import { buildHeatmap, dateKeyOf, heatLevel } from '@/utils/heatmapStats';
import { resolveSongBadge } from '@/utils/songBadges';

describe('buildHeatmap', () => {
  // 固定“今天”：2026-09-23（周三）12:00 本地时间
  const now = new Date(2026, 8, 23, 12, 0, 0).getTime();
  const DAY = 86400000;

  it('builds a weeks×7 grid ending at the current week', () => {
    const result = buildHeatmap([], now, 16);
    expect(result.cells.length).toBe(16 * 7);
    expect(result.total).toBe(0);
    // 最后一格是本周日（未来格）
    expect(result.cells[result.cells.length - 1].future).toBe(true);
  });

  it('counts plays per day and ignores out-of-range timestamps', () => {
    const today = new Date(2026, 8, 23, 9, 0).getTime();
    const yesterday = today - DAY;
    const entries = [
      { id: 1, timestamp: today },
      { id: 2, timestamp: today },
      { id: 3, timestamp: today },
      { id: 4, timestamp: yesterday },
      { id: 5, timestamp: 0 }, // 无效
      { id: 6, timestamp: now - 400 * DAY } // 超出窗口
    ];
    const result = buildHeatmap(entries, now, 16);
    expect(result.total).toBe(4);
    expect(result.activeDays).toBe(2);
    const todayKey = dateKeyOf(today);
    const todayCell = result.cells.find((cell) => cell.key === todayKey);
    expect(todayCell?.count).toBe(3);
  });

  it('maps counts to 5 heat levels', () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(1, 10)).toBe(1);
    expect(heatLevel(3, 10)).toBe(2);
    expect(heatLevel(5, 10)).toBe(3);
    expect(heatLevel(9, 10)).toBe(4);
  });
});

describe('resolveSongBadge', () => {
  const t = (key: string) => key;

  it('prefers the recommendation reason', () => {
    const badge = resolveSongBadge({ reason: '超87%人播放' }, t);
    expect(badge).toEqual({ kind: 'reason', text: '超87%人播放' });
  });

  it('marks lossless quality by maxbr', () => {
    expect(resolveSongBadge({ privilege: { maxbr: 999000 } }, t)).toEqual({
      kind: 'quality',
      text: 'comp.homeBadge.lossless'
    });
    expect(resolveSongBadge({ privilege: { maxbr: 320000 } }, t)).toBeUndefined();
  });

  it('marks niche songs by low popularity', () => {
    expect(resolveSongBadge({ pop: 30 }, t)).toEqual({ kind: 'niche', text: 'comp.homeBadge.niche' });
    expect(resolveSongBadge({ popularity: 80 }, t)).toBeUndefined();
    // pop=0 视为字段缺失，不判小众
    expect(resolveSongBadge({ pop: 0 }, t)).toBeUndefined();
  });
});
