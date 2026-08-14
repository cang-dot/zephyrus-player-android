const MOBILE_STARTUP_PATHS = new Set([
  '/',
  '/list',
  '/discover',
  '/history',
  '/local-music',
  '/user',
  '/set'
]);

export type MobileStartupTarget = string | { path: string; query?: Record<string, string> };

export const readMobileStartupTarget = (
  storage: Pick<Storage, 'getItem'> = localStorage
): MobileStartupTarget => {
  try {
    const saved = storage.getItem('appSettings');
    const requested = saved ? JSON.parse(saved)?.defaultPage : '/';
    if (typeof requested !== 'string' || !MOBILE_STARTUP_PATHS.has(requested)) return '/';
    if (requested === '/local-music') {
      return { path: '/list', query: { source: 'local', localTab: 'songs' } };
    }
    return requested;
  } catch {
    return '/';
  }
};

export const isBareMobileLaunch = (hash: string) => hash === '' || hash === '#' || hash === '#/';
