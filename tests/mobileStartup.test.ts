import { describe, expect, it } from 'vitest';

import { isBareMobileLaunch, readMobileStartupTarget } from '../src/renderer/router/mobileStartup';

const storage = (value: string | null) => ({ getItem: () => value });

describe('mobile startup route', () => {
  it('reads a valid persisted mobile page from appSettings', () => {
    expect(readMobileStartupTarget(storage('{"defaultPage":"/user"}'))).toBe('/user');
  });

  it('normalizes the legacy local music route', () => {
    expect(readMobileStartupTarget(storage('{"defaultPage":"/local-music"}'))).toEqual({
      path: '/list',
      query: { source: 'local', localTab: 'songs' }
    });
  });

  it('falls back for malformed and unsupported values', () => {
    expect(readMobileStartupTarget(storage('{broken'))).toBe('/');
    expect(readMobileStartupTarget(storage('{"defaultPage":"/music-list/1"}'))).toBe('/');
  });

  it('only treats an empty root hash as a bare launch', () => {
    expect(isBareMobileLaunch('')).toBe(true);
    expect(isBareMobileLaunch('#/')).toBe(true);
    expect(isBareMobileLaunch('#/list')).toBe(false);
  });
});
