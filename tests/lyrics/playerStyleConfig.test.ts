import { describe, expect, it } from 'vitest';

import { createPlayerStyleConfig, resolvePlayerStyleConfig } from '@/config/playerStyleConfig';

describe('smoke player style configuration', () => {
  it('defaults smoke and climax glow colors to the song theme', () => {
    const config = createPlayerStyleConfig('smoke');

    expect(config.smokeFollowThemeColor).toBe(true);
    expect(config.smokeGlowFollowThemeColor).toBe(true);
    expect(config.smokeCustomColor).toBe('#5fffd0');
    expect(config.smokeGlowCustomColor).toBe('#ff765f');
  });

  it('keeps independent custom smoke, glow, and background colors', () => {
    const config = resolvePlayerStyleConfig('smoke', {
      mode: 'custom',
      useCustomBackground: true,
      backgroundMode: 'solid',
      solidColor: '#101820',
      smokeFollowThemeColor: false,
      smokeCustomColor: '#12abef',
      smokeGlowFollowThemeColor: false,
      smokeGlowCustomColor: '#fe3a82'
    });

    expect(config.solidColor).toBe('#101820');
    expect(config.smokeCustomColor).toBe('#12abef');
    expect(config.smokeGlowCustomColor).toBe('#fe3a82');
  });

  it('normalizes invalid persisted colors without coupling their follow switches', () => {
    const config = resolvePlayerStyleConfig('smoke', {
      smokeFollowThemeColor: false,
      smokeCustomColor: 'invalid',
      smokeGlowFollowThemeColor: true,
      smokeGlowCustomColor: '#123'
    });

    expect(config.smokeFollowThemeColor).toBe(false);
    expect(config.smokeGlowFollowThemeColor).toBe(true);
    expect(config.smokeCustomColor).toBe('#5fffd0');
    expect(config.smokeGlowCustomColor).toBe('#ff765f');
  });
});
