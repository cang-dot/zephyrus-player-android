<template>
  <div class="md3-backdrop" :style="backgroundStyle">
    <div class="md3-noise" aria-hidden="true"></div>
  </div>
</template>

<script setup lang="ts">
import tinycolor from 'tinycolor2';
import type { PropType } from 'vue';
import { computed } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';

/**
 * Material Design 3 风格动态背景（全新预设，无源文件）
 *
 * - 取色：useCoverColor() 封面主色，playMusic.primaryColor 兜底，
 *   最终回落 MD3 基线紫 #6750A4；切歌时随封面自动更新（computed 依赖 playMusic 链路）
 * - tonal 色板：主色调固定色相 + 收敛饱和度，生成 5 档明度
 *   （深色 L 12/20/30/45/65%，浅色镜像高明度），按 MD3 surface 容器思路
 *   组成 135deg 对角线多层渐变 + 3 层径向高光
 * - 叠加极轻噪点（内联 SVG feTurbulence data-uri）
 * - params.md3Tone：'auto'（跟随封面亮度）| 'dark'（固定深色系）| 'light'（浅色系）
 */

type Md3Tone = 'auto' | 'dark' | 'light';

interface Md3BackdropParams {
  md3Tone?: Md3Tone;
}

const props = defineProps({
  params: { type: Object as PropType<Md3BackdropParams>, default: () => ({}) }
});

const { primaryColor } = useCoverColor();

const sourceColor = computed(() => {
  const cover = primaryColor.value;
  if (cover && cover.toLowerCase() !== '#888888') return cover;
  return playMusic.value?.primaryColor || '#6750A4';
});

/** auto：按封面色相对亮度选择深/浅 surface（播放器场景默认偏暗） */
const resolvedTone = computed<Md3Tone>(() => {
  const tone = props.params?.md3Tone;
  if (tone === 'dark' || tone === 'light') return tone;
  const luminance = tinycolor(sourceColor.value).getLuminance();
  return luminance >= 0.5 ? 'light' : 'dark';
});

/** 深色 surface 容器 5 档明度（L 12/20/30/45/65%） */
const DARK_TONES = [12, 20, 30, 45, 65];
/** 浅色 surface 容器 5 档明度（镜像高明度档位） */
const LIGHT_TONES = [96, 91, 84, 72, 58];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

interface Md3Palette {
  base: string;
  surfaceLow: string;
  surface: string;
  surfaceHigh: string;
  highlight: string;
  surfaceHighRgb: string;
  highlightRgb: string;
}

/** tonal 色板：主色调固定色相，生成 5 档明度 */
const palette = computed<Md3Palette>(() => {
  const hsl = tinycolor(sourceColor.value).toHsl();
  const hue = Number.isFinite(hsl.h) ? hsl.h : 260;
  const sat = clamp01(Math.min(0.6, Math.max(0.16, Number.isFinite(hsl.s) ? hsl.s : 0.32)));
  const tones = resolvedTone.value === 'dark' ? DARK_TONES : LIGHT_TONES;
  const [base, surfaceLow, surface, surfaceHigh, highlight] = tones.map((lightness) =>
    tinycolor({ h: hue, s: sat, l: lightness / 100 })
  );
  const rgbText = (tiny: ReturnType<typeof tinycolor>) => {
    const { r, g, b } = tiny.toRgb();
    return `${r}, ${g}, ${b}`;
  };
  return {
    base: base.toHexString(),
    surfaceLow: surfaceLow.toHexString(),
    surface: surface.toHexString(),
    surfaceHigh: surfaceHigh.toHexString(),
    highlight: highlight.toHexString(),
    surfaceHighRgb: rgbText(surfaceHigh),
    highlightRgb: rgbText(highlight)
  };
});

/**
 * MD3 surface 容器思路：135deg 对角线主渐变（5 档明度中的 3 档）
 * 叠 3 层径向高光（左上 / 右下 / 底部微光）
 */
const backgroundStyle = computed(() => {
  const p = palette.value;
  const background = [
    `radial-gradient(120% 90% at 14% 6%, rgba(${p.highlightRgb}, 0.14) 0%, transparent 58%)`,
    `radial-gradient(110% 85% at 86% 94%, rgba(${p.surfaceHighRgb}, 0.2) 0%, transparent 55%)`,
    `radial-gradient(85% 65% at 50% 118%, rgba(${p.highlightRgb}, 0.08) 0%, transparent 65%)`,
    `linear-gradient(135deg, ${p.base} 0%, ${p.surfaceLow} 45%, ${p.surface} 100%)`
  ].join(', ');
  return { background };
});
</script>

<style lang="scss" scoped>
.md3-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: #141218;
}

/* 极轻噪点：内联 SVG feTurbulence data-uri */
.md3-noise {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.05;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 256px 256px;
  background-repeat: repeat;
}
</style>
