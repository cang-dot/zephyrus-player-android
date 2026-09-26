/**
 * 公告数据（server-music/announcements.json）
 * 每次启动拉取一次：?t= 时间戳 + no-cache 绕过启发式缓存；失败回退内存缓存。
 */

const API_BASE = 'https://www.mucang.xyz';
const ANNOUNCEMENTS_JSON_URL = `${API_BASE}/server-music/announcements.json`;

export interface AnnouncementAction {
  /**
   * 'album' + id = 打开网易云 web 专辑页（window.open 新标签）；
   * 'url' = 直接打开 action.url 指定的任意地址。
   */
  type: string;
  id?: number | string;
  url?: string;
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