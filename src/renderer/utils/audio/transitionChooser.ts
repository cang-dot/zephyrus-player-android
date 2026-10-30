/**
 * transitionChooser.ts — 智能接法选择器（folia automix 移植，简化版）
 *
 * folia 的选择依据是曲目 profile（BPM/调性/stems），本移植只保留可离线
 * 轻量测得的首尾段特征（trackFeatures）；无证据时的降级原则与 folia 一致：
 * 「启发式只决定怎么接，不决定接不接」——特征缺失退 plainBlend（现有行为），
 * 而不是激进硬切。
 *
 * 接法（kind）：
 *   beatCut    40ms 硬切：新歌开场即热且有足够前导静音可等待落拍
 *   bassSwap   短重叠等功率（together 0.55）：热开场但静音不足 / 出歌自带淡出 / 兜底
 *   tailRide   长重叠骑尾音（together 0.5）：出歌自然衰减、新歌有 intro
 *   plainBlend 纯等功率（现有 Level 1 形状）：任一侧特征缺失
 */

import type { IntroFeatures, OutroFeatures } from '@/utils/audio/trackFeatures';
import { TRACK_FEATURE_THRESHOLDS } from '@/utils/audio/trackFeatures';

export type TransitionKind = 'beatCut' | 'bassSwap' | 'tailRide' | 'plainBlend';

export interface TransitionChoice {
  kind: TransitionKind;
  /** 实际执行的重叠时长（秒）；beatCut ≈ 0.04 */
  overlapSec: number;
  /** together 平台占比（0 = 纯等功率） */
  together: number;
  /** 触发提前量（秒）≈ overlapSec，供调度器提前启动 */
  leadSec: number;
  /** 判定依据（日志与设置页展示用） */
  reason: string;
}

/** overlap 下限钳制：低于此值就不是「更短」而是没人写下的硬切（folia 原则） */
const OVERLAP_FLOOR_SEC = 1;
const BEAT_CUT_SEC = 0.04;

export interface ChooserInput {
  /** 新歌首段特征（null = 无证据） */
  next: IntroFeatures | null;
  /** 当前曲尾段特征（null = 无证据，如 iOS 无分析图） */
  current: OutroFeatures | null;
  /** 用户设置的基准交叉时长（秒） */
  baseOverlapSec: number;
}

export function chooseTransition({
  next,
  current,
  baseOverlapSec
}: ChooserInput): TransitionChoice {
  const fallback: TransitionChoice = {
    kind: 'plainBlend',
    overlapSec: baseOverlapSec,
    together: 0,
    leadSec: baseOverlapSec,
    reason: '特征缺失，回退等功率'
  };
  if (!next || !current) return fallback;

  const clampOverlap = (value: number): number => Math.max(OVERLAP_FLOOR_SEC, value);

  // 1. beatCut：热开场 + 静音窗足够等一次落拍
  if (next.startsHot && next.introSilenceSec >= 0.6) {
    return {
      kind: 'beatCut',
      overlapSec: BEAT_CUT_SEC,
      together: 0,
      leadSec: BEAT_CUT_SEC,
      reason: `热开场 + ${next.introSilenceSec.toFixed(1)}s 前导静音，硬切`
    };
  }

  // 2. 热开场但静音不足：短重叠（folia ×0.6，避免满能量开场叠满能量尾段）
  if (next.startsHot) {
    const overlap = clampOverlap(baseOverlapSec * 0.6);
    return {
      kind: 'bassSwap',
      overlapSec: overlap,
      together: 0.55,
      leadSec: overlap,
      reason: '热开场静音不足，短重叠换手'
    };
  }

  // 3. 出歌自带制作淡出：fading a fade doubles it，压短重叠
  if (current.outroSlopeDbPerSec <= TRACK_FEATURE_THRESHOLDS.selfFadeSlopeDbPerSec) {
    const overlap = clampOverlap(baseOverlapSec * 0.6);
    return {
      kind: 'bassSwap',
      overlapSec: overlap,
      together: 0.55,
      leadSec: overlap,
      reason: `出歌自带淡出（${current.outroSlopeDbPerSec.toFixed(1)}dB/s），压短重叠`
    };
  }

  // 4. tailRide：出歌自然衰减 + 新歌有 intro 或非热开场
  if (!current.endsHot && (next.introSilenceSec > 0.3 || !next.startsHot)) {
    const overlap = clampOverlap(baseOverlapSec * 1.4);
    return {
      kind: 'tailRide',
      overlapSec: overlap,
      together: 0.5,
      leadSec: overlap,
      reason: '出歌自然衰减，骑尾音长重叠'
    };
  }

  // 5. 兜底：folia「有任何证据时默认 bassSwap」
  const overlap = clampOverlap(baseOverlapSec);
  return {
    kind: 'bassSwap',
    overlapSec: overlap,
    together: 0.55,
    leadSec: overlap,
    reason: '有证据无强特征，标准换手'
  };
}
