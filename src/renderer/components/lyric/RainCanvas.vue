<template>
  <canvas
    ref="canvasRef"
    class="rain-canvas"
    :style="{ opacity: rainOpacity }"
  />
</template>

<script setup lang="ts">
/**
 * RainCanvas - 雨水效果画布组件
 *
 * 功能：
 * - Canvas 2D 绘制斜向雨滴粒子
 * - 雨滴落地水洼效果（伪3D反射）
 * - 地面到处都有雨滴涟漪，水洼处效果更强
 * - 支持音频响应：根据音量调整雨水密度和下落速度
 * - 可配置：颜色、透明度、倾斜角度、雨滴长度、下落速度
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { drumDetector } from '@/services/drumDetector';
import type { LyricConfig } from '@/types/lyric';

interface Raindrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  width: number;
}

interface GroundRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  speed: number;
  intensity: number; // 强度（水洼处更强）
}

interface Puddle {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
}

interface Props {
  config: LyricConfig;
}

const props = defineProps<Props>();

// 默认值
const rainIntensity = computed(() => props.config.rainIntensity ?? 50);
const rainSpeed = computed(() => props.config.rainSpeed ?? 1);
const rainAudioReactive = computed(() => props.config.rainAudioReactive ?? true);
const rainColor = computed(() => props.config.rainColor ?? '#ffffff');
const rainOpacity = computed(() => props.config.rainOpacity ?? 0.6);
const rainAngle = computed(() => props.config.rainAngle ?? 15);
const rainLength = computed(() => props.config.rainLength ?? 40);

const canvasRef = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let animationId: number | null = null;
let raindrops: Raindrop[] = [];
let groundRipples: GroundRipple[] = [];
let puddles: Puddle[] = [];

// 音频能量状态
const audioEnergy = ref(0);

// 计算实际雨水密度（基础值 + 音频响应）
const actualIntensity = computed(() => {
  let intensity = rainIntensity.value;
  if (rainAudioReactive.value) {
    const audioBoost = audioEnergy.value * 50;
    intensity = Math.min(100, intensity + audioBoost);
  }
  return intensity;
});

// 计算实际下落速度
const actualSpeed = computed(() => {
  let speed = rainSpeed.value;
  if (rainAudioReactive.value) {
    speed = speed * (0.5 + audioEnergy.value * 1.5);
  }
  return speed;
});

// 初始化画布
function initCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  ctx = canvas.getContext('2d');
  if (!ctx) return;

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  initPuddles();
}

// 调整画布大小
function resizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas || !ctx) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.scale(dpr, dpr);
  initPuddles();
}

// 初始化随机水洼
function initPuddles() {
  const canvasHeight = window.innerHeight;
  const canvasWidth = window.innerWidth;
  
  puddles = [];
  const puddleCount = 3 + Math.floor(Math.random() * 4);
  
  for (let i = 0; i < puddleCount; i++) {
    const width = 80 + Math.random() * 120;
    const height = width * (0.3 + Math.random() * 0.2);
    
    puddles.push({
      x: Math.random() * (canvasWidth - width) + width / 2,
      y: canvasHeight - 50 - Math.random() * 100,
      width,
      height,
      opacity: 0.1 + Math.random() * 0.15
    });
  }
}

// 创建雨滴
function createRaindrop(): Raindrop {
  const canvas = canvasRef.value;
  if (!canvas) return { x: 0, y: 0, length: 0, speed: 0, opacity: 0, width: 0 };

  const angleRad = (rainAngle.value * Math.PI) / 180;
  const canvasWidth = window.innerWidth;
  const canvasHeight = window.innerHeight;

  const x = Math.random() * (canvasWidth + Math.abs(Math.tan(angleRad) * canvasHeight)) - Math.abs(Math.tan(angleRad) * canvasHeight) / 2;
  const y = -Math.random() * 100 - rainLength.value;

  const lengthVariation = 0.5 + Math.random() * 0.5;
  const length = rainLength.value * lengthVariation;
  const speedVariation = 0.8 + Math.random() * 0.4;
  const baseSpeed = (5 + length * 0.3) * speedVariation;
  const opacity = 0.3 + Math.random() * 0.5;
  const width = 0.5 + Math.random() * 1.5;

  return { x, y, length, speed: baseSpeed, opacity, width };
}

// 检查点是否在水洼内
function isPointInPuddle(x: number, y: number): { inPuddle: boolean; intensity: number } {
  for (const puddle of puddles) {
    const dx = x - puddle.x;
    const dy = y - puddle.y;
    const normalizedDx = dx / (puddle.width / 2);
    const normalizedDy = dy / (puddle.height / 2);
    const distance = Math.sqrt(normalizedDx * normalizedDx + normalizedDy * normalizedDy);
    
    if (distance <= 1) {
      // 在水洼中心强度最大，边缘较小
      const intensity = 1 - distance * 0.5;
      return { inPuddle: true, intensity };
    }
  }
  return { inPuddle: false, intensity: 0.3 }; // 地面默认强度
}

// 创建地面涟漪
function createGroundRipple(x: number, y: number, intensity: number) {
  groundRipples.push({
    x,
    y,
    radius: 0,
    maxRadius: 5 + intensity * 25, // 水洼处涟漪更大
    opacity: 0.2 + intensity * 0.5,
    speed: 0.3 + intensity * 0.5,
    intensity
  });
}

// 更新雨滴数量
function updateRaindropCount() {
  const targetCount = Math.floor(actualIntensity.value * 3);

  while (raindrops.length < targetCount) {
    raindrops.push(createRaindrop());
  }

  if (raindrops.length > targetCount) {
    raindrops = raindrops.slice(0, targetCount);
  }
}

// 更新音频能量
function updateAudioEnergy() {
  if (!rainAudioReactive.value) {
    audioEnergy.value = 0;
    return;
  }

  const energies = drumDetector.getBandEnergies();
  const avgEnergy = (energies.low + energies.mid + energies.high) / 3;
  audioEnergy.value = audioEnergy.value * 0.8 + avgEnergy * 0.2;
}

// 绘制水洼
function drawPuddles() {
  if (!ctx) return;

  puddles.forEach(puddle => {
    const { x, y, width, height, opacity } = puddle;

    // 水洼底色
    ctx!.save();
    ctx!.beginPath();
    ctx!.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx!.fillStyle = `rgba(20, 25, 35, ${opacity})`;
    ctx!.fill();

    // 水洼边缘
    ctx!.beginPath();
    ctx!.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx!.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.3})`;
    ctx!.lineWidth = 1;
    ctx!.stroke();

    // 内部反射
    ctx!.beginPath();
    ctx!.ellipse(x, y - height * 0.1, width / 2 * 0.8, height / 2 * 0.6, 0, 0, Math.PI * 2);
    ctx!.fillStyle = `rgba(100, 120, 140, ${opacity * 0.2})`;
    ctx!.fill();
    ctx!.restore();
  });
}

// 绘制帧
function draw() {
  if (!ctx || !canvasRef.value) return;

  const canvasWidth = window.innerWidth;
  const canvasHeight = window.innerHeight;
  const angleRad = (rainAngle.value * Math.PI) / 180;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  updateAudioEnergy();
  updateRaindropCount();

  // 绘制水洼（在雨滴后面）
  drawPuddles();

  // 设置雨滴颜色
  ctx.strokeStyle = rainColor.value;
  ctx.lineCap = 'round';

  // 地面Y坐标范围
  const groundYMin = canvasHeight - 150;
  const groundYMax = canvasHeight;

  // 绘制雨滴
  raindrops.forEach((drop) => {
    const currentSpeed = drop.speed * actualSpeed.value;
    drop.x += Math.sin(angleRad) * currentSpeed;
    drop.y += Math.cos(angleRad) * currentSpeed;

    // 绘制雨滴
    ctx!.beginPath();
    ctx!.lineWidth = drop.width;
    ctx!.globalAlpha = drop.opacity;

    const endX = drop.x - Math.sin(angleRad) * drop.length;
    const endY = drop.y - Math.cos(angleRad) * drop.length;

    ctx!.moveTo(drop.x, drop.y);
    ctx!.lineTo(endX, endY);
    ctx!.stroke();

    // 检查是否落地
    if (drop.y >= groundYMin && drop.y <= groundYMax) {
      // 检查是否在水洼内，获取强度
      const { intensity } = isPointInPuddle(drop.x, drop.y);
      
      // 随机决定是否创建涟漪（水洼内概率更高）
      const createChance = 0.1 + intensity * 0.4;
      if (Math.random() < createChance) {
        createGroundRipple(drop.x, drop.y, intensity);
      }
    }

    // 重置超出屏幕的雨滴
    if (drop.y > canvasHeight + drop.length ||
        (rainAngle.value > 0 && drop.x > canvasWidth + drop.length) ||
        (rainAngle.value < 0 && drop.x < -drop.length)) {
      const newDrop = createRaindrop();
      Object.assign(drop, newDrop);
    }
  });

  // 绘制和更新地面涟漪
  ctx.globalAlpha = 1;
  groundRipples = groundRipples.filter(ripple => {
    ripple.radius += ripple.speed;
    ripple.opacity -= 0.008;

    if (ripple.opacity > 0) {
      // 根据强度调整涟漪大小和颜色
      const intensity = ripple.intensity;
      
      // 外圈
      ctx!.beginPath();
      ctx!.strokeStyle = `rgba(200, 220, 240, ${ripple.opacity})`;
      ctx!.lineWidth = 1 + intensity;
      ctx!.ellipse(ripple.x, ripple.y, ripple.radius, ripple.radius * 0.3, 0, 0, Math.PI * 2);
      ctx!.stroke();

      // 内圈（水洼处更明显）
      if (intensity > 0.5 && ripple.radius > 5) {
        ctx!.beginPath();
        ctx!.strokeStyle = `rgba(220, 235, 255, ${ripple.opacity * 0.7})`;
        ctx!.lineWidth = 0.5 + intensity * 0.5;
        ctx!.ellipse(ripple.x, ripple.y, ripple.radius * 0.6, ripple.radius * 0.18, 0, 0, Math.PI * 2);
        ctx!.stroke();
      }
    }

    return ripple.opacity > 0 && ripple.radius < ripple.maxRadius;
  });

  ctx.globalAlpha = 1;
  animationId = requestAnimationFrame(draw);
}

watch(rainIntensity, updateRaindropCount);

onMounted(() => {
  initCanvas();
  draw();
});

onBeforeUnmount(() => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  window.removeEventListener('resize', resizeCanvas);
});
</script>

<style scoped>
.rain-canvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
</style>
