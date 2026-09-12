/**
 * 视频皮肤注册表
 *
 * 9 种播放器样式全部登记在案，引擎按样式 key 取皮肤。
 * 新增样式只需实现一份 VideoSkin 并登记到此。
 */

import type { MobilePlayerStyleKey } from '@/types/playerStyle';

import type { VideoSkin } from '../types';
import { defaultSkin } from './default';
import { eerieSkin } from './eerie';
import { errorSkin } from './error';
import { frenzySkin } from './frenzy';
import { neonSkin } from './neon';
import { rainSkin } from './rain';
import { smokeSkin } from './smoke';
import { stageSkin } from './stage';
import { starChartSkin } from './starChart';

const SKINS: Record<MobilePlayerStyleKey, VideoSkin> = {
  default: defaultSkin,
  stage: stageSkin,
  starChart: starChartSkin,
  frenzy: frenzySkin,
  eerie: eerieSkin,
  neon: neonSkin,
  rain: rainSkin,
  smoke: smokeSkin,
  error: errorSkin
};

/** 取指定样式的视频皮肤；未知 key 退回默认皮肤 */
export function getSkin(key: string): VideoSkin {
  return SKINS[key as MobilePlayerStyleKey] ?? defaultSkin;
}

/** 全部皮肤（顺序与播放器样式列表一致） */
export function getAllSkins(): VideoSkin[] {
  return Object.values(SKINS);
}

export type { VideoSkin } from '../types';
