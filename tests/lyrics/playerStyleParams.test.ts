import { describe, expect, it } from 'vitest';

import {
  STYLE_PARAM_SCHEMA,
  resolveStyleParams,
  styleParamDefaults
} from '@/config/playerStyleParams';
import { createPlayerStyleConfig, resolvePlayerStyleConfig } from '@/config/playerStyleConfig';

describe('STYLE_PARAM_SCHEMA', () => {
  it('六种样式均有参数定义，且 key 唯一', () => {
    const keys = ['default', 'stage', 'starChart', 'frenzy', 'smoke', 'error'];
    for (const key of keys) {
      const schema = STYLE_PARAM_SCHEMA[key];
      expect(schema.length).toBeGreaterThan(0);
      const unique = new Set(schema.map((d) => d.key));
      expect(unique.size).toBe(schema.length);
    }
  });

  it('number 参数的 default 在 min/max 范围内', () => {
    for (const [styleKey, schema] of Object.entries(STYLE_PARAM_SCHEMA)) {
      for (const def of schema) {
        if (def.type !== 'number') continue;
        expect(def.default, `${styleKey}.${def.key}`).toBeGreaterThanOrEqual(def.min!);
        expect(def.default, `${styleKey}.${def.key}`).toBeLessThanOrEqual(def.max!);
      }
    }
  });
});

describe('resolveStyleParams', () => {
  it('缺省回默认', () => {
    const out = resolveStyleParams('stage', null);
    expect(out.goldWarmth).toBe(1);
    expect(out.stageFlashSpikeMs).toBe(150);
  });

  it('越界值被钳制、非法值回默认', () => {
    const out = resolveStyleParams('stage', { goldWarmth: 99, stageFlashSpikeMs: 'abc' });
    expect(out.goldWarmth).toBe(2);
    expect(out.stageFlashSpikeMs).toBe(150);
  });

  it('color 仅接受 #rrggbb', () => {
    expect(resolveStyleParams('frenzy', { frenzyBgColor: '#AABBCC' }).frenzyBgColor).toBe(
      '#AABBCC'
    );
    expect(resolveStyleParams('frenzy', { frenzyBgColor: 'red' }).frenzyBgColor).toBe('#f5f5f5');
  });
});

describe('resolvePlayerStyleConfig 集成', () => {
  it('create 默认值包含 schema 默认', () => {
    const config = createPlayerStyleConfig('stage');
    expect(config.goldWarmth).toBe(1);
    expect(config.stageFlashSpikeMs).toBe(150);
  });

  it('resolve 对越界 saved 值按 schema 钳制', () => {
    const resolved = resolvePlayerStyleConfig('starChart', {
      mode: 'custom',
      starDensity: 50,
      starTrailSegments: 100
    });
    expect(resolved.starDensity).toBe(2);
    expect(resolved.starTrailSegments).toBe(16);
  });

  it('死字段不再出现在 resolve 输出', () => {
    for (const styleKey of ['default', 'stage', 'starChart', 'frenzy', 'smoke', 'error']) {
      const resolved = resolvePlayerStyleConfig(styleKey as never, {});
      expect(resolved).not.toHaveProperty('beatFlashIntensity');
    }
    const stage = createPlayerStyleConfig('stage');
    expect(stage).not.toHaveProperty('beatFlashIntensity');
  });
});
