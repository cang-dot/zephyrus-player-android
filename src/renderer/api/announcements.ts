/**
 * 公告数据（server-music/announcements.json）
 * 每次启动拉取一次：?t= 时间戳 + no-cache 绕过启发式缓存；失败回退内存缓存。
 */

const API_BASE = 'https://www.mucang.xyz';
const ANNOUNCEMENTS_JSON_URL = `${API_BASE}/server-music/announcements.json`;

export interface AnnouncementAction {
  /**
   * 跳转行为：
   * - 手机端先尝试 `appUrl`（如 orpheus 深链唤起网易云 App），失败回退 web 网页；
   * - 桌面端直接新开 `web` 网页（type='album'+id 时按网易云 web 专辑页拼链接）。
   */
  type: string;
  id?: number | string;
  url?: string;
  /** 手机端唤起 App 用的深链（缺省按 orpheus://album/<id> 拼） */
  appUrl?: string;
}

export interface Announcement {
  id: string | number;
  title: string;
  body: string;
  buttonText?: string;
  action?: AnnouncementAction;
}

let cachedList: Announcement[] | null = null;

export async function fetchAnnouncements(): Promise<Announcement[]> {
  if (cachedList) return cachedList;
  try {
    const res = await fetch(`${ANNOUNCEMENTS_JSON_URL}?t=${Date.now()}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Announcement[];
    cachedList = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[Announcements] 拉取失败：', error);
    return cachedList ?? [];
  }
  return cachedList;
}