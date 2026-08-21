<template><div ref="host" class="smoke-background" aria-hidden="true" /></template>

<script setup lang="ts">
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { acquirePlayerResource } from '@/utils/playerResourceDiagnostics';

const props = withDefaults(
  defineProps<{
    color: string;
    density?: number;
    chaos?: number;
    loudness?: number;
    opacity?: number;
    reducedMotion?: boolean;
    active?: boolean;
  }>(),
  {
    density: 0.58,
    chaos: 0.42,
    loudness: 0,
    opacity: 0.76,
    reducedMotion: false,
    active: true
  }
);

const host = ref<HTMLDivElement | null>(null);
let renderer: Renderer | null = null;
let mesh: Mesh | null = null;
let program: Program | null = null;
let frameId = 0;
let resize: (() => void) | null = null;
let lastRenderTime = 0;
let isPlayerMorphing = false;
let bodyClassObserver: MutationObserver | null = null;
let pageVisible = true;
let releaseCanvasLoop: (() => void) | null = null;
let startedAt = 0;
const smokeColor = new Float32Array([0.4, 0.4, 0.4]);

const vertex = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}`;
const fragment = `#version 300 es
precision highp float;
uniform vec2 uResolution; uniform float uTime; uniform float uDensity; uniform float uChaos;
uniform float uLoudness; uniform float uOpacity; uniform vec3 uColor; out vec4 fragColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.02+vec2(11.3,7.1);a*=0.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/uResolution;vec2 p=(uv-.5);p.x*=uResolution.x/uResolution.y;float t=uTime*(.18+uChaos*.55);vec2 flow=vec2(fbm(p*1.7+vec2(t,-t*.7)),fbm(p*1.7+vec2(-t*.6,t*1.2)));p+=((flow-.5)*.32+vec2(sin(t*.7),cos(t*.5))*.12)*(uChaos+.3*uLoudness);float n=fbm(p*(2.1+uDensity*2.0)+vec2(t*.3,-t*.22));float smoke=smoothstep(.38-.18*uDensity,.82-.15*uDensity,n);smoke*=.48+.52*clamp(uLoudness*1.4,0.,1.);float vign=1.-smoothstep(.26,.82,length(p));smoke*=.58+.42*vign;fragColor=vec4(uColor,smoke*uOpacity);}`;

function rgb(color: string): [number, number, number] {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return [0.4, 0.4, 0.4];
  return [0, 1, 2].map((i) => Number.parseInt(match[1].slice(i * 2, i * 2 + 2), 16) / 255) as [
    number,
    number,
    number
  ];
}

function updateSmokeColor(color: string): void {
  const nextColor = rgb(color);
  smokeColor[0] = nextColor[0];
  smokeColor[1] = nextColor[1];
  smokeColor[2] = nextColor[2];
}

function stopLoop() {
  if (frameId) cancelAnimationFrame(frameId);
  frameId = 0;
  releaseCanvasLoop?.();
  releaseCanvasLoop = null;
}

function draw(time: number) {
  if (!props.active || !pageVisible || props.reducedMotion) {
    stopLoop();
    return;
  }
  frameId = requestAnimationFrame(draw);
  if (!renderer || !program || !mesh) return;
  // During the geometry morph, the compositor already has a full-screen transform to process.
  // Keep the smoke responsive without competing for every display frame.
  if (isPlayerMorphing && time - lastRenderTime < 33) return;
  lastRenderTime = time;
  program.uniforms.uTime.value = (time - startedAt) / 1000;
  program.uniforms.uLoudness.value = props.loudness;
  program.uniforms.uDensity.value = props.density;
  program.uniforms.uChaos.value = props.chaos;
  program.uniforms.uOpacity.value = props.opacity;
  renderer.render({ scene: mesh });
}

function startLoop() {
  if (frameId || !pageVisible || !props.active || props.reducedMotion || !renderer) return;
  releaseCanvasLoop = acquirePlayerResource('canvas-loop');
  frameId = requestAnimationFrame(draw);
}

function handlePageVisibility() {
  pageVisible = !document.hidden;
  if (pageVisible) startLoop();
  else stopLoop();
}

onMounted(() => {
  const element = host.value;
  if (!element || props.reducedMotion) return;
  pageVisible = !document.hidden;
  try {
    updateSmokeColor(props.color);
    const syncMorphingState = () => {
      isPlayerMorphing = document.body.classList.contains('mobile-player-surface-morphing');
      resize?.();
    };
    syncMorphingState();
    bodyClassObserver = new MutationObserver(syncMorphingState);
    bodyClassObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    renderer = new Renderer({ webgl: 2, alpha: true, antialias: false, dpr: 1 });
    const gl = renderer.gl;
    program = new Program(gl, {
      vertex,
      fragment,
      transparent: true,
      uniforms: {
        uResolution: { value: new Float32Array([1, 1]) },
        uTime: { value: 0 },
        uDensity: { value: props.density },
        uChaos: { value: props.chaos },
        uLoudness: { value: props.loudness },
        uOpacity: { value: props.opacity },
        uColor: { value: smokeColor }
      }
    });
    mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
    element.appendChild(gl.canvas);
    startedAt = performance.now();
    resize = () => {
      if (!renderer || !program) return;
      const resolutionScale = isPlayerMorphing ? 0.7 : 1;
      renderer.setSize(
        Math.max(1, Math.round(element.clientWidth * resolutionScale)),
        Math.max(1, Math.round(element.clientHeight * resolutionScale))
      );
      (program.uniforms.uResolution.value as Float32Array)[0] = gl.drawingBufferWidth;
      (program.uniforms.uResolution.value as Float32Array)[1] = gl.drawingBufferHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handlePageVisibility);
    startLoop();
  } catch {
    renderer = null;
  }
});
watch(
  () => props.reducedMotion,
  (reduced) => {
    if (reduced) stopLoop();
    else startLoop();
  }
);
watch(
  () => props.active,
  (active) => {
    if (active) startLoop();
    else stopLoop();
  }
);
watch(
  () => props.color,
  (color) => updateSmokeColor(color)
);
onBeforeUnmount(() => {
  stopLoop();
  document.removeEventListener('visibilitychange', handlePageVisibility);
  if (resize) window.removeEventListener('resize', resize);
  bodyClassObserver?.disconnect();
  bodyClassObserver = null;
  if (renderer) renderer.gl.canvas.remove();
  renderer = null;
  mesh = null;
  program = null;
});
</script>

<style scoped>
.smoke-background {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(
    circle at center,
    color-mix(in srgb, var(--smoke-color, #777) 24%, transparent),
    transparent 72%
  );
}
.smoke-background :deep(canvas) {
  width: 100%;
  height: 100%;
  display: block;
  opacity: var(--smoke-opacity, 0.76);
}
</style>
