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

  it('indexes every status-bar lyric customization under the expandable item', () => {
    const related = MOBILE_SETTING_SEARCH_DEFINITIONS.filter(
      (item) => item.targetId === 'status-bar-lyrics'
    );
    expect(related.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        '逐字显示',
        '状态栏歌词位置',
        '状态栏歌词字体',
        '状态栏歌词配色',
        '状态栏歌词预览'
      ])
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
