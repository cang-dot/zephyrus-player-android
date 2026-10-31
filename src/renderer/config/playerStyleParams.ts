/**
 * playerStyleParams.ts — 播放器样式参数 schema（统一参数系统）
 *
 * 六种样式的「可暴露自定义参数」统一在此声明：面板按 schema 渲染控件、
 * resolvePlayerStyleConfig 按 schema 钳制、样式组件按 key 消费
 * （经 useStyleCustomConfig，undefined 回退 default——完全向后兼容）。
 *
 * 每个参数的 default 即组件当前硬编码值（2026-10-30 参数系统统一时的快照）。
 */

export type PlayerStyleParamType = 'number' | 'color';

export interface PlayerStyleParamDef {
  key: string;
  label: string;
  desc?: string;
  type: PlayerStyleParamType;
  /** number 的取值范围与步进（color 忽略） */
  min?: number;
  max?: number;
  step?: number;
  default: number | string;
  /** number 显示单位（如 dB/ms/×） */
  unit?: string;
  /** 面板分组标题（同组连续渲染） */
  group: string;
}

const num = (
  key: string,
  label: string,
  group: string,
  def: number,
  min: number,
  max: number,
  step: number,
  unit?: string,
  desc?: string
): PlayerStyleParamDef => ({ key, label, group, type: 'number', default: def, min, max, step, unit, desc });

const color = (key: string, label: string, group: string, def: string): PlayerStyleParamDef => ({
  key,
  label,
  group,
  type: 'color',
  default: def
});

export const STYLE_PARAM_SCHEMA: Record<string, PlayerStyleParamDef[]> = {
  default: [
    // 网格音频驱动（MeshGradientBackground.vue 常量）
    num('meshBaseWeight', '呼吸权重', '网格音频驱动', 0.35, 0.05, 0.8, 0.05, undefined, '连续层（低频呼吸）在合成中的占比'),
    num('meshPulseStrong', '强拍脉冲', '网格音频驱动', 0.9, 0.4, 1, 0.05, undefined, '强拍触发的脉冲峰值'),
    num('meshPulseNormal', '弱拍脉冲', '网格音频驱动', 0.5, 0.2, 0.8, 0.05, undefined, '弱拍触发的脉冲峰值'),
    num('meshVolumeCeiling', '输出上限', '网格音频驱动', 1.6, 0.8, 2.5, 0.1, '×', '低频驱动量的封顶（core 内部 ÷10）'),
    num('meshProminenceDb', '呼吸满档', '网格音频驱动', 9, 4, 16, 1, 'dB', '频带比基线高出该值时呼吸打满'),
    // 极光与调色板（DefaultMobilePlayerV2.vue）
    num('auroraAmplitude', '极光幅度', '极光与调色板', 1, 0.4, 2, 0.05, '×'),
    num('auroraBlend', '极光混合', '极光与调色板', 0.5, 0.2, 0.9, 0.05),
    num('auroraPaletteMix', '调色板停靠比', '极光与调色板', 0.55, 0.3, 0.8, 0.05, undefined, '色板暗端与主题色的混合比'),
    // 排版与封面基准（DefaultMobilePlayerV2.vue）
    num('titleFontSize', '歌名字号上限', '排版与封面', 26, 18, 34, 1, 'px'),
    num('coverBasisScale', '封面基准缩放', '排版与封面', 1, 0.8, 1.3, 0.01, '×', '封面基准档位的全局缩放'),
    num('contentRowSplit', '内容行比', '排版与封面', 0.58, 0.4, 0.75, 0.01, undefined, '封面区/歌词区的网格高度比')
  ],
  stage: [
    num('goldWarmth', '暖金强度', '舞台色彩', 1, 0, 2, 0.05, '×', '暖金强调色公式的整体系数'),
    num('stageFlashStrong', '强拍闪白', '鼓点闪白', 0.5, 0, 1, 0.05),
    num('stageFlashWeak', '弱拍闪白', '鼓点闪白', 0.35, 0, 1, 0.05),
    num('stageFlashSpikeMs', '闪白时长', '鼓点闪白', 150, 80, 300, 10, 'ms'),
    num('stageLyricMaxVh', '歌词字号上限', '排版与控件', 30, 20, 45, 1, 'vh'),
    num('stageControlsHideMs', '控件隐藏延时', '排版与控件', 3000, 1000, 8000, 250, 'ms'),
    num('stageTearPower', '撕裂强度', '高潮撕裂', 1, 0.5, 2, 0.05, '×'),
    num('stageTearRate', '撕裂频率', '高潮撕裂', 1, 0.5, 2, 0.05, '×', '触发间隔的缩放（越大越稀疏）')
  ],
  starChart: [
    num('starDensity', '星点密度', '星场', 1, 0.5, 2, 0.05, '×'),
    num('starSpeedBase', '星轨基础速度', '星场', 0.055, 0.02, 0.12, 0.005, undefined, '转速滑杆在此系数上叠加'),
    num('starTintCalm', '染色占比·平时', '封面染色', 0.08, 0, 0.3, 0.01),
    num('starTintClimax', '染色占比·高潮', '封面染色', 1, 0.6, 1, 0.01),
    num('starTwinkleFreq', '闪烁频率', '闪烁与拖尾', 0.0016, 0.0006, 0.004, 0.0002),
    num('starTrailSegments', '拖尾段数', '闪烁与拖尾', 8, 4, 16, 1, '段'),
    num('starLyricSize', '歌词块字号', '歌词块排版', 24, 16, 32, 1, 'px'),
    num('starLyricLineHeight', '歌词块行高', '歌词块排版', 2.05, 1.6, 2.6, 0.05),
    num('starLyricTracking', '歌词块字距', '歌词块排版', 0.16, 0, 0.3, 0.01, 'em')
  ],
  frenzy: [
    color('frenzyBgColor', '故障背景色', 'Glitch 调色', '#f5f5f5'),
    color('frenzyAccentColor', '故障强调色', 'Glitch 调色', '#d0d0d0'),
    num('frenzyGlitchSpeed', '故障流速', 'Glitch 调色', 0.8, 0.3, 2, 0.05, '×'),
    num('frenzyBeatStrong', '强拍强度', '鼓点', 0.45, 0, 1, 0.05),
    num('frenzyBeatWeak', '弱拍强度', '鼓点', 0.25, 0, 1, 0.05),
    num('frenzyBeatSpikeMs', '脉冲时长', '鼓点', 120, 60, 250, 10, 'ms'),
    num('frenzyGlitchBase', '故障基底', '故障合成', 0.15, 0, 0.5, 0.01, undefined, '非高潮时段的故障强度底值'),
    num('frenzyCrtLevel', 'CRT 亮度', '故障合成', 0.6, 0, 1, 0.05),
    color('frenzyGiantColorA', '巨字常态色·一段', '巨字排版', '#1a1a1a'),
    color('frenzyGiantColorB', '巨字常态色·二段', '巨字排版', '#6b6b6b')
  ],
  smoke: [
    num('smokeFlowSpeed', '烟雾流速', 'shader 形态', 1, 0.4, 2, 0.05, '×'),
    num('smokeFlowAmplitude', '流场振幅', 'shader 形态', 0.32, 0.1, 0.6, 0.01),
    num('smokeDrift', '漂移量', 'shader 形态', 0.12, 0, 0.3, 0.01),
    num('smokeDensityGain', '密度加成', '音频加成', 0.2, 0, 0.6, 0.02, '×', '能量等级对烟雾密度的加成系数'),
    num('smokeChaosGain', '混乱加成', '音频加成', 0.4, 0, 0.8, 0.02, '×', '节拍通量对混乱度的加成系数'),
    num('smokeLoudnessGain', '响度加成', '音频加成', 0.3, 0, 0.6, 0.02, '×', '低频响度对形态的加成系数'),
    num('smokeLyricSize', '歌词字号上限', '歌词排版与底色', 150, 80, 220, 5, 'px'),
    color('smokeBgColor', '底色', '歌词排版与底色', '#111111')
  ],
  error: [
    num('errorForceBase', '鼠标力基底', '流体力度', 18, 8, 30, 1),
    num('errorForceClimax', '高潮力加成', '流体力度', 14, 0, 30, 1),
    num('errorForcePulse', '脉冲力峰值', '流体力度', 22, 0, 40, 1),
    num('errorAutoBase', '自动摆动基底', '流体力度', 3.2, 1, 6, 0.1),
    num('errorTearCount', '撕裂条数', '撕裂与故障块', 3, 1, 6, 1, '条'),
    num('errorBlockScale', '故障块缩放', '撕裂与故障块', 1, 0.5, 2, 0.05, '×'),
    num('errorNoiseDensity', '噪点密度', '噪点与爆发', 1, 0.3, 2.5, 0.05, '×'),
    num('errorBurstCooldown', '爆发冷却', '噪点与爆发', 220, 100, 500, 10, 'ms'),
    num('errorRgbShift', 'RGB 色散', '噪点与爆发', 1.5, 0, 6, 0.1, 'px'),
    num('errorFrameAmp', '抽帧振幅', '噪点与爆发', 2.2, 0.5, 4, 0.05, '×'),
    num('etherPunchScale', '耀斑 punch 放大', '耀斑驱动', 2.5, 1, 4, 0.05, '×'),
    num('etherBeatStrong', '耀斑强拍强度', '耀斑驱动', 1, 0.4, 1.5, 0.05, '×')
  ]
};

/** 按 schema 从 saved 配置读取参数值（带钳制；缺省回 default） */
export function resolveStyleParams(
  styleKey: string,
  saved: Record<string, unknown> | null | undefined
): Record<string, number | string> {
  const schema = STYLE_PARAM_SCHEMA[styleKey] ?? [];
  const out: Record<string, number | string> = {};
  for (const def of schema) {
    const raw = saved?.[def.key];
    if (def.type === 'color') {
      out[def.key] =
        typeof raw === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : (def.default as string);
      continue;
    }
    const value = typeof raw === 'number' ? raw : Number(raw);
    const min = def.min ?? -Infinity;
    const max = def.max ?? Infinity;
    out[def.key] =
      Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : (def.default as number);
  }
  return out;
}

/** schema 默认值表（供 createPlayerStyleConfig 展开） */
export function styleParamDefaults(styleKey: string): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const def of STYLE_PARAM_SCHEMA[styleKey] ?? []) out[def.key] = def.default;
  return out;
}
