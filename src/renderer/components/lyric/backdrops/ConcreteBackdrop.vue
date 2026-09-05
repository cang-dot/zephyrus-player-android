<template>
  <div class="concrete-backdrop">
    <div class="concrete-bg"></div>
    <div class="aged-overlay"></div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';

/**
 * 混凝土纹理背景预设
 *
 * 抽取自 NeonMobilePlayer.vue 的背景层（.concrete-bg + .aged-overlay）：
 * - SVG feTurbulence 噪点纹理（512px 平铺）模拟混凝土墙面颗粒
 * - 双径向渐变模拟环境暖光反射
 * - aged-overlay 复古滤镜层（暖色椭圆光斑 + 135deg 陈旧渐变）
 * 纯 CSS/SVG 实现，无 canvas、无动画。
 */

interface ConcreteBackdropParams {
  /** 预留参数位（当前无可调参数），保持与其它背景预设的统一 props 接口 */
  [key: string]: unknown;
}

// 与其它背景预设统一声明 params（noUnusedLocals：脚本内未读取时不绑定）
defineProps({
  params: { type: Object as PropType<ConcreteBackdropParams>, default: () => ({}) }
});
</script>

<style lang="scss" scoped>
.concrete-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: #1a1814;
}

.concrete-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-color: #2a2620;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='5' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.22 0 0 0 0 0.20 0 0 0 0 0.16 0 0 0 0.7 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
    radial-gradient(circle at 20% 50%, rgba(201, 169, 110, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 80% 50%, rgba(180, 150, 100, 0.02) 0%, transparent 50%);
  background-size:
    512px 512px,
    cover,
    cover;
  background-repeat: repeat, no-repeat, no-repeat;
  filter: brightness(0.5) contrast(1.1) sepia(0.3);
}

.aged-overlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(ellipse at 30% 40%, rgba(201, 169, 110, 0.08) 0%, transparent 60%),
    radial-gradient(ellipse at 70% 60%, rgba(180, 140, 80, 0.06) 0%, transparent 50%),
    linear-gradient(135deg, rgba(80, 60, 30, 0.12) 0%, transparent 40%, rgba(60, 40, 20, 0.08) 100%);
  pointer-events: none;
}
</style>
