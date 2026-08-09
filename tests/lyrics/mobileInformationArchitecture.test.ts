import { describe, expect, it } from 'vitest';

import homeRouter from '@/router/home';
import { shouldRestartMiniPlayerIdleTimer } from '@/utils/miniPlayerIdle';

describe('mobile information architecture', () => {
  it('keeps exactly four ordered bottom navigation destinations', () => {
    expect(homeRouter.filter((route) => route.meta.bottomNav).map((route) => route.path)).toEqual([
      '/',
      '/list',
      '/discover',
      '/user'
    ]);
  });

  it('redirects legacy local music links into the local playlist source', () => {
    const route = homeRouter.find((item) => item.path === '/local-music');
    expect(route?.redirect).toEqual({
      path: '/list',
      query: { source: 'local', localTab: 'songs' }
    });
  });

  it('keeps the mini player collapsed when the route changes', () => {
    expect(shouldRestartMiniPlayerIdleTimer(true, false)).toBe(false);
    expect(shouldRestartMiniPlayerIdleTimer(false, false)).toBe(true);
    expect(shouldRestartMiniPlayerIdleTimer(false, true)).toBe(false);
  });
});
