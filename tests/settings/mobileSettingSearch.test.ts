import { describe, expect, it } from 'vitest';

import { MOBILE_SETTING_SEARCH_DEFINITIONS } from '../../src/renderer/views/set/mobileSettingSearch';

describe('mobile settings search registry', () => {
  it('indexes the Android status-bar lyrics setting', () => {
    expect(MOBILE_SETTING_SEARCH_DEFINITIONS).toContainEqual(
      expect.objectContaining({
        tabId: 'playback',
        titleKey: 'settings.lyricSettings.statusBarLyrics'
      })
    );
  });

  it('does not expose desktop-only settings', () => {
    const serialized = JSON.stringify(MOBILE_SETTING_SEARCH_DEFINITIONS);
    const desktopOnlyTerms = [
      '桌面歌词',
      '侧边栏',
      '悬浮窗口',
      'audioDevice',
      'gpuAcceleration',
      'downloadPath',
      'closeAction',
      'settings.network.proxy'
    ];

    desktopOnlyTerms.forEach((term) => expect(serialized).not.toContain(term));
  });

  it('does not contain duplicate setting definitions', () => {
    const identities = MOBILE_SETTING_SEARCH_DEFINITIONS.map(
      (item) => `${item.tabId}:${item.titleKey || item.title}`
    );
    expect(new Set(identities).size).toBe(identities.length);
  });
});
