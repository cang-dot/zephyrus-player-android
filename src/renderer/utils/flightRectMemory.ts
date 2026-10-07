/**
 * 封面飞回的入口矩形内存：来源页把入口时的卡片/封面矩形记在这里，
 * 返回时飞回终点直接复用（来源页多为常驻/保活页，滚动位置不变，入口矩形
 * 即最终位置）；返回时实时量 DOM 会受入场动画/布局恢复时序干扰而错位。
 */
type FlightRect = { x: number; y: number; w: number; h: number };

const entries = new Map<string, FlightRect>();
const MAX_ENTRIES = 24;

export function rememberFlightRect(key: string, rect: FlightRect): void {
  if (entries.size >= MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
  entries.set(key, { ...rect });
}

/** 取出（并清除）指定 key 的入口矩形 */
export function takeFlightRect(key: string): FlightRect | null {
  const rect = entries.get(key);
  if (rect) entries.delete(key);
  return rect ? { ...rect } : null;
}
