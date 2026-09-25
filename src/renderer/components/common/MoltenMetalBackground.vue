<script setup lang="ts">
/**
 * MoltenMetalBackground — 熔融金属流体背景（OGL / WebGL2 着色器）
 * 来源：vue-bits (https://vue-bits.dev/backgrounds/molten-metal, MIT License)，移植着色器与生命周期骨架。
 * 本地适配：paused 外部暂停（pager 非活跃页 / 减弱动画）、dpr 与帧率上限、初始化失败 emit('fallback') 供父级 CSS 兜底。
 */
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { onMounted, onUnmounted, ref, watch } from 'vue';

export type MoltenMetalColorMode = 'molten' | 'ember' | 'frost';

interface MoltenMetalProps {
  color1?: string;
  color2?: string;
  color3?: string;
  speed?: number;
  scale?: number;
  detail?: number;
  glow?: number;
  coreSize?: number;
  swirl?: number;
  fold?: number;
  blackPoint?: number;
  brightness?: number;
  colorMode?: MoltenMetalColorMode;
  grain?: boolean;
  grainIntensity?: number;
  mouseInteraction?: boolean;
  mouseStrength?: number;
  opacity?: number;
  /** 外部暂停渲染循环（pager 非活跃页 / prefers-reduced-motion） */
  paused?: boolean;
  /** 渲染 dpr 上限，移动端建议 1.5 */
  maxPixelRatio?: number;
  /** 帧率上限，0 = 不限 */
  maxFps?: number;
}

const emit = defineEmits<{ fallback: [] }>();

const props = withDefaults(defineProps<MoltenMetalProps>(), {
  color1: '#5227FF',
  color2: '#FF9FFC',
  color3: '#FFFFFF',
  speed: 0.35,
  scale: 4,
  detail: 3,
  glow: 1.6,
  coreSize: 0.1,
  swirl: 1,
  fold: -0.2,
  blackPoint: 0.05,
  brightness: 1.3,
  colorMode: 'molten',
  grain: true,
  grainIntensity: 0.05,
  mouseInteraction: true,
  mouseStrength: 0.3,
  opacity: 1.0,
  paused: false,
  maxPixelRatio: 1.5,
  maxFps: 30
});

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ];
};

const colorModeToFloat = (mode: MoltenMetalColorMode): number =>
  mode === 'ember' ? 1 : mode === 'frost' ? 2 : 0;

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uScale;
uniform float uDetail;
uniform float uGlow;
uniform float uCoreSize;
uniform float uSwirl;
uniform float uFold;
uniform float uBlackPoint;
uniform float uBrightness;
uniform float uColorMode;
uniform float uGrain;
uniform float uGrainIntensity;
uniform float uOpacity;
uniform vec2 uMouse;
uniform float uMouseStrength;
uniform bool uEnableMouse;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float time = iTime * uSpeed;
  vec2 p = uScale * ((gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y) - 0.5;

  vec2 drift = vec2(0.0);
  if (uEnableMouse) {
    drift = (uMouse - 0.5) * uMouseStrength * 2.0;
  }
  p += drift;

  vec2 i = p;
  float c = 0.0;
  float r = length(p + vec2(sin(time), sin(time * 0.3 + 5.0)) * 0.5);
  float d = length(p);
  float rot = d + time + p.x * uSwirl;

  float cosRot = cos(rot);
  mat2 warp = mat2(cos(rot - sin(time / 5.0)), sin(rot), -sin(cosRot - time), cosRot) * uFold;
  float glowCore = uGlow * uCoreSize;

  for (float n = 0.0; n < 8.0; n++) {
    if (n >= uDetail) break;
    p *= warp;
    float t = r - time / (n + 3.0);
    i -= p + vec2(cos(t - i.x - r) + sin(t + i.y), sin(t - i.y) + cos(t + i.x) + r);
    c += glowCore / length(vec2(sin(i.x + t), cos(i.y + t)));
  }

  c /= 6.0;

  float intensity = max(c - uBlackPoint, 0.0) * uBrightness;

  float g = clamp(intensity, 0.0, 1.0);

  float mid = 0.5;
  if (uColorMode > 1.5) {
    mid = 0.65;
  } else if (uColorMode > 0.5) {
    mid = 0.35;
  }

  vec3 col = mix(uColor1, uColor2, smoothstep(0.0, mid, g));
  col = mix(col, uColor3, smoothstep(mid, 1.0, g));

  float a = g;
  if (uGrain > 0.5) {
    float gr = hash(gl_FragCoord.xy + iTime);
    a += (gr - 0.5) * uGrainIntensity;
  }
  a = clamp(a, 0.0, 1.0) * uOpacity;
  fragColor = vec4(col * a, a);
}
`;

// OGL 把 Program.uniforms 定为宽松 Record，这里描述本项目 uniform 形状并在唯一构造点 cast，
// 其余读写全部强类型（沿上游写法）。
interface ScalarUniform {
  value: number;
}
interface Vec2Uniform {
  value: Float32Array;
}
interface Vec3Uniform {
  value: Float32Array;
}
interface BoolUniform {
  value: boolean;
}

interface MainUniforms {
  iTime: ScalarUniform;
  iResolution: Vec2Uniform;
  uSpeed: ScalarUniform;
  uScale: ScalarUniform;
  uDetail: ScalarUniform;
  uGlow: ScalarUniform;
  uCoreSize: ScalarUniform;
  uSwirl: ScalarUniform;
  uFold: ScalarUniform;
  uBlackPoint: ScalarUniform;
  uBrightness: ScalarUniform;
  uColorMode: ScalarUniform;
  uGrain: ScalarUniform;
  uGrainIntensity: ScalarUniform;
  uOpacity: ScalarUniform;
  uMouse: Vec2Uniform;
  uMouseStrength: ScalarUniform;
  uEnableMouse: BoolUniform;
  uColor1: Vec3Uniform;
  uColor2: Vec3Uniform;
  uColor3: Vec3Uniform;
}

const containerRef = ref<HTMLDivElement | null>(null);

// 非响应式的渲染期状态：与上游的 useRef 语义一致
let program: MainUniforms | null = null;
let teardown: (() => void) | null = null;
let applyPaused: ((value: boolean) => void) | null = null;

const syncUniforms = () => {
  if (!program) return;
  const u = program;

  u.uSpeed.value = props.speed;
  u.uScale.value = props.scale;
  u.uDetail.value = props.detail;
  u.uGlow.value = props.glow;
  u.uCoreSize.value = Math.max(props.coreSize, 0.001);
  u.uSwirl.value = props.swirl;
  u.uFold.value = props.fold;
  u.uBlackPoint.value = props.blackPoint;
  u.uBrightness.value = props.brightness;
  u.uColorMode.value = colorModeToFloat(props.colorMode);
  u.uGrain.value = props.grain ? 1 : 0;
  u.uGrainIntensity.value = props.grainIntensity;
  u.uOpacity.value = props.opacity;
  u.uMouseStrength.value = props.mouseStrength;
  u.uEnableMouse.value = props.mouseInteraction;

  const c1 = hexToRgb(props.color1);
  const c2 = hexToRgb(props.color2);
  const c3 = hexToRgb(props.color3);
  const uc1 = u.uColor1.value;
  const uc2 = u.uColor2.value;
  const uc3 = u.uColor3.value;
  uc1[0] = c1[0];
  uc1[1] = c1[1];
  uc1[2] = c1[2];
  uc2[0] = c2[0];
  uc2[1] = c2[1];
  uc2[2] = c2[2];
  uc3[0] = c3[0];
  uc3[1] = c3[1];
  uc3[2] = c3[2];
};

watch(
  () => [
    props.color1,
    props.color2,
    props.color3,
    props.speed,
    props.scale,
    props.detail,
    props.glow,
    props.coreSize,
    props.swirl,
    props.fold,
    props.blackPoint,
    props.brightness,
    props.colorMode,
    props.grain,
    props.grainIntensity,
    props.mouseInteraction,
    props.mouseStrength,
    props.opacity
  ],
  () => syncUniforms()
);

watch(
  () => props.paused,
  (value) => applyPaused?.(Boolean(value))
);

onMounted(() => {
  const container = containerRef.value;
  if (!container) return;

  try {
    const renderer = new Renderer({
      webgl: 2,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, props.maxPixelRatio)
    });

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const geometry = new Triangle(gl);
    const localProgram = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uSpeed: { value: 0.35 },
        uScale: { value: 4 },
        uDetail: { value: 3 },
        uGlow: { value: 1.6 },
        uCoreSize: { value: 0.1 },
        uSwirl: { value: 1 },
        uFold: { value: -0.2 },
        uBlackPoint: { value: 0.05 },
        uBrightness: { value: 1.3 },
        uColorMode: { value: 0 },
        uGrain: { value: 1 },
        uGrainIntensity: { value: 0.05 },
        uOpacity: { value: 1.0 },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uMouseStrength: { value: 0.3 },
        uEnableMouse: { value: true },
        uColor1: { value: new Float32Array([1, 1, 1]) },
        uColor2: { value: new Float32Array([1, 1, 1]) },
        uColor3: { value: new Float32Array([1, 1, 1]) }
      }
    });
    const mu = localProgram.uniforms as unknown as MainUniforms;
    program = mu;

    const mesh = new Mesh(gl, { geometry, program: localProgram });

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h);
      const res = mu.iResolution.value;
      res[0] = gl.drawingBufferWidth;
      res[1] = gl.drawingBufferHeight;
      renderer.render({ scene: mesh });
    };

    const ro = new ResizeObserver(setSize);
    ro.observe(container);
    setSize();

    const targetMouse: [number, number] = [0.5, 0.5];
    const currentMouse: [number, number] = [0.5, 0.5];

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetMouse[0] = (e.clientX - rect.left) / rect.width;
      targetMouse[1] = 1.0 - (e.clientY - rect.top) / rect.height;
    };
    const handleMouseLeave = () => {
      targetMouse[0] = 0.5;
      targetMouse[1] = 0.5;
    };
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    let raf = 0;
    let lastFrameTime = 0;
    let isVisible = true;
    let isPageVisible = !document.hidden;
    let isExternallyPaused = Boolean(props.paused);
    const t0 = performance.now();

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const minInterval = props.maxFps > 0 ? 1000 / props.maxFps : 0;
      if (minInterval > 0 && t - lastFrameTime < minInterval - 1) return;
      lastFrameTime = t;

      mu.iTime.value = (t - t0) * 0.001;
      currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
      currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
      const m = mu.uMouse.value;
      m[0] = currentMouse[0];
      m[1] = currentMouse[1];
      renderer.render({ scene: mesh });
    };

    const tryStart = () => {
      if (isVisible && isPageVisible && !isExternallyPaused && raf === 0) {
        raf = requestAnimationFrame(loop);
      }
    };
    const tryStop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    applyPaused = (value: boolean) => {
      isExternallyPaused = value;
      if (value) tryStop();
      else tryStart();
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) tryStart();
        else tryStop();
      },
      { threshold: 0 }
    );
    io.observe(container);

    const onVisibility = () => {
      isPageVisible = !document.hidden;
      if (isPageVisible) tryStart();
      else tryStop();
    };
    document.addEventListener('visibilitychange', onVisibility);

    tryStart();
    syncUniforms();

    teardown = () => {
      tryStop();
      applyPaused = null;
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      program = null;
      try {
        container.removeChild(canvas);
      } catch {
        /* canvas 已被移除 */
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  } catch (error) {
    console.warn('[MoltenMetalBackground] WebGL 初始化失败，回退 CSS 背景', error);
    emit('fallback');
  }
});

onUnmounted(() => {
  teardown?.();
  teardown = null;
});
</script>

<template>
  <div ref="containerRef" class="relative h-full w-full overflow-hidden" />
</template>
