<template>
  <div ref="containerRef" class="splash-container">
    <!-- 左侧竖条 -->
    <div ref="leftBarRef" class="splash-left-bar">
      <span class="splash-left-text">基于AlgerMusicPlayer修改</span>
    </div>

    <!-- 右下横条 -->
    <div ref="rightBarRef" class="splash-right-bar">
      <span class="splash-right-title">西风播放器</span>
      <span class="splash-right-author">—— cang-dot ——</span>
    </div>

    <!-- 底部色块 -->
    <div ref="bottomBarRef" class="splash-bottom-bar"></div>

    <!-- 中央内容 -->
    <div class="splash-center">
      <div ref="zephyrusRef" class="splash-title-zephyrus">Zephyrus</div>
      <div ref="centerLineRef" class="splash-center-line"></div>
      <div ref="playerRef" class="splash-title-player">Player</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import gsap from 'gsap';
import { onMounted, onUnmounted, ref } from 'vue';

const emit = defineEmits<{
  finish: [];
}>();

const containerRef = ref<HTMLElement>();
const leftBarRef = ref<HTMLElement>();
const rightBarRef = ref<HTMLElement>();
const bottomBarRef = ref<HTMLElement>();
const zephyrusRef = ref<HTMLElement>();
const centerLineRef = ref<HTMLElement>();
const playerRef = ref<HTMLElement>();

let tl: gsap.core.Timeline | null = null;

onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) {
    emit('finish');
    return;
  }

  tl = gsap.timeline({
    onComplete: () => {
      emit('finish');
    }
  });

  // === 入场动画 ===

  // 左侧竖条从左侧滑入
  tl.from(leftBarRef.value, {
    x: '-100%',
    duration: 0.7,
    ease: 'power3.out'
  });

  // 右下横条从右下角滑入
  tl.from(
    rightBarRef.value,
    {
      x: '100%',
      y: '100%',
      duration: 0.7,
      ease: 'power3.out'
    },
    '<0.1'
  );

  // 底部色块从底部滑入
  tl.from(
    bottomBarRef.value,
    {
      y: '100%',
      duration: 0.6,
      ease: 'power3.out'
    },
    '<0.1'
  );

  // 中央分割线展开
  tl.from(
    centerLineRef.value,
    {
      scaleX: 0,
      duration: 0.5,
      ease: 'power2.out'
    },
    '-=0.3'
  );

  // Zephyrus 从缝隙上方钻出
  tl.from(
    zephyrusRef.value,
    {
      y: 30,
      autoAlpha: 0,
      duration: 0.6,
      ease: 'power2.out'
    },
    '-=0.2'
  );

  // Player 从缝隙下方钻出
  tl.from(
    playerRef.value,
    {
      y: -30,
      autoAlpha: 0,
      duration: 0.6,
      ease: 'power2.out'
    },
    '<'
  );

  // 停留展示
  tl.to({}, { duration: 1.0 });

  // === 退场动画 ===

  // Zephyrus 滑回缝隙
  tl.to(zephyrusRef.value, {
    y: 30,
    autoAlpha: 0,
    duration: 0.4,
    ease: 'power2.in'
  });

  // Player 滑回缝隙
  tl.to(
    playerRef.value,
    {
      y: -30,
      autoAlpha: 0,
      duration: 0.4,
      ease: 'power2.in'
    },
    '<'
  );

  // 分割线消失
  tl.to(centerLineRef.value, {
    scaleX: 0,
    duration: 0.3,
    ease: 'power2.in'
  });

  // 左侧竖条文字消失
  tl.to(
    leftBarRef.value?.querySelector('.splash-left-text'),
    {
      autoAlpha: 0,
      duration: 0.2
    },
    '-=0.1'
  );

  // 左侧竖条扩展占满左半屏
  tl.to(leftBarRef.value, {
    width: '50vw',
    duration: 0.6,
    ease: 'power3.inOut'
  });

  // 右下横条扩展占满右半屏
  tl.to(
    rightBarRef.value,
    {
      width: '50vw',
      x: '-50vw',
      duration: 0.6,
      ease: 'power3.inOut'
    },
    '<'
  );

  // 底部色块扩展
  tl.to(
    bottomBarRef.value,
    {
      height: '100vh',
      duration: 0.6,
      ease: 'power3.inOut'
    },
    '<'
  );

  // 整体淡出
  tl.to(
    containerRef.value,
    {
      autoAlpha: 0,
      duration: 0.4,
      ease: 'power2.inOut'
    },
    '-=0.1'
  );
});

onUnmounted(() => {
  tl?.kill();
});
</script>

<style scoped>
.splash-container {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #ffffff;
  overflow: hidden;
}

.splash-left-bar {
  position: absolute;
  left: 0;
  top: 0;
  width: 80px;
  height: 100%;
  background: #0f2b8a;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.splash-left-text {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  color: #ffffff;
  font-size: 14px;
  letter-spacing: 2px;
  white-space: nowrap;
}

.splash-right-bar {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 320px;
  height: 100px;
  background: #0f2b8a;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  z-index: 2;
}

.splash-right-title {
  color: #ffffff;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 4px;
}

.splash-right-author {
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  letter-spacing: 2px;
}

.splash-bottom-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 60px;
  background: linear-gradient(135deg, #0f2b8a 0%, #1a3fba 100%);
  z-index: 1;
}

.splash-center {
  position: absolute;
  top: 42%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  z-index: 3;
}

.splash-title-zephyrus {
  font-size: 72px;
  font-weight: 800;
  color: #0f2b8a;
  letter-spacing: -1px;
  line-height: 1.1;
}

.splash-center-line {
  width: 400px;
  height: 2px;
  background: #0f2b8a;
  transform-origin: center;
}

.splash-title-player {
  font-size: 72px;
  font-weight: 800;
  color: #0f2b8a;
  letter-spacing: -1px;
  line-height: 1.1;
  align-self: flex-end;
}
</style>
