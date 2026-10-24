<template>
  <span
    class="morph-icon"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${size}px` }"
  >
    <Transition name="morph-icon-swap">
      <!-- idle 态继续用字体图标（不必为三角形也引入 SVG），其余态走可形变的 SVG -->
      <i v-if="state === 'idle'" key="glyph" class="morph-icon-glyph" :class="idleClass" />
      <svg
        v-else
        key="vector"
        ref="svgRef"
        class="morph-icon-vector"
        :viewBox="viewBox"
        fill="currentColor"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path ref="pathRef" :d="fromD" />
      </svg>
    </Transition>
  </span>
</template>

<script setup lang="ts">
import { gsap } from 'gsap';
import MorphSVGPlugin from 'gsap/MorphSVGPlugin';
import { onBeforeUnmount, ref, watch } from 'vue';

gsap.registerPlugin(MorphSVGPlugin);

const props = withDefaults(
  defineProps<{
    /** idle 用字体图标；loading → success 之间做形状补间 */
    state: 'idle' | 'loading' | 'success';
    /** idle 态沿用的字体图标 class（如 `ri-play-fill`） */
    idleClass?: string;
    /** 起始形状（正在转圈的那枚），与 toD 需同为「带状」形状才能补间得漂亮 */
    fromD: string;
    /** 目标形状（完成那枚） */
    toD: string;
    size?: number;
    viewBox?: string;
    /** 转一圈的秒数 */
    spinDuration?: number;
    /** 形变时长（秒） */
    morphDuration?: number;
  }>(),
  {
    idleClass: '',
    size: 18,
    viewBox: '0 0 24 24',
    spinDuration: 0.9,
    morphDuration: 0.26
  }
);

const svgRef = ref<SVGSVGElement>();
const pathRef = ref<SVGPathElement>();

let spinTween: gsap.core.Tween | null = null;
let morphTimeline: gsap.core.Timeline | null = null;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const stopTweens = () => {
  spinTween?.kill();
  spinTween = null;
  morphTimeline?.kill();
  morphTimeline = null;
  if (svgRef.value) {
    gsap.set(svgRef.value, { rotation: 0, scale: 1 });
  }
};

const startSpin = () => {
  const svg = svgRef.value;
  if (!svg) return;
  gsap.set(svg, { rotation: 0 });
  spinTween = gsap.to(svg, {
    rotation: 360,
    duration: props.spinDuration,
    ease: 'none',
    repeat: -1
  });
};

/** 转圈 → 对勾：先让旋转收束到整圈（避免中途硬停的跳变），再形变 + 轻微回弹 */
const morphToTarget = () => {
  const svg = svgRef.value;
  const path = pathRef.value;
  if (!svg || !path) return;

  spinTween?.kill();
  spinTween = null;

  if (prefersReducedMotion()) {
    gsap.set(svg, { rotation: 0 });
    path.setAttribute('d', props.toD);
    return;
  }

  const currentRotation = Number(gsap.getProperty(svg, 'rotation')) || 0;
  const settleTo = Math.ceil((currentRotation + 0.01) / 360) * 360;

  morphTimeline = gsap
    .timeline()
    .to(svg, { rotation: settleTo, duration: 0.16, ease: 'power2.out' })
    .to(path, { morphSVG: props.toD, duration: props.morphDuration, ease: 'power2.inOut' }, '<0.02')
    .to(svg, { scale: 1.08, duration: 0.12, ease: 'power2.out' }, '<')
    .to(svg, { scale: 1, duration: 0.16, ease: 'power2.inOut' });
};

watch(
  () => props.state,
  (next, prev) => {
    if (next === prev) return;
    stopTweens();
    if (!pathRef.value) return;
    // 回到起始形状，避免下次进入 loading 时残留在上一状态
    pathRef.value.setAttribute('d', props.fromD);
    if (next === 'loading') {
      if (!prefersReducedMotion()) startSpin();
    } else if (next === 'success') {
      morphToTarget();
    }
  },
  { flush: 'post' }
);

onBeforeUnmount(stopTweens);
</script>

<style scoped lang="scss">
.morph-icon {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;

  .morph-icon-glyph,
  .morph-icon-vector {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .morph-icon-glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .morph-icon-vector {
    display: block;
  }
}

.morph-icon-swap-enter-active,
.morph-icon-swap-leave-active {
  transition: opacity 140ms ease;
}

.morph-icon-swap-enter-from,
.morph-icon-swap-leave-to {
  opacity: 0;
}
</style>
