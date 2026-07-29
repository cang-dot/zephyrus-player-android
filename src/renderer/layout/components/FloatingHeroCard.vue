<template>
  <Transition name="hero-card-fade">
    <div
      v-if="heroCard.visible"
      class="floating-hero-card"
      :class="{ compact: heroCard.compact }"
    >
      <div class="hero-bg" />
      <div class="hero-content">
        <h1 class="hero-title">{{ heroCard.title }}</h1>
        <p class="hero-subtitle">{{ heroCard.subtitle }}</p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useHeroCard } from '@/composables/useHeroCard';

const { heroCard } = useHeroCard();
</script>

<style lang="scss" scoped>
/* 弹簧曲线 */
$spring: cubic-bezier(0.34, 1.56, 0.64, 1);
$spring-smooth: cubic-bezier(0.32, 0.72, 0, 1);

.floating-hero-card {
  position: fixed;
  top: calc(var(--safe-area-inset-top, 0px) + 52px);
  left: 16px;
  right: 16px;
  z-index: 50;
  border-radius: 22px;
  overflow: hidden;
  transition: top 0.4s $spring,
              border-radius 0.4s $spring,
              box-shadow 0.4s $spring-smooth,
              left 0.4s $spring,
              right 0.4s $spring;

  &.compact {
    top: calc(var(--safe-area-inset-top, 0px) + 56px);
    border-radius: 18px;
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.08);
  }
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--cover-surface, rgba(255, 255, 255, 0.55));
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  opacity: 1;
  transition: opacity 0.4s $spring-smooth;

  .floating-hero-card.compact & {
    opacity: 1;
  }
}

.hero-content {
  position: relative;
  padding: 16px 20px 12px;
  transition: padding 0.4s $spring;

  .floating-hero-card.compact & {
    padding: 10px 16px 8px;
  }
}

.hero-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--cover-text-primary, var(--m-text-primary, var(--text-color, #2c2c2c)));
  margin: 0;
  transition: font-size 0.4s $spring;

  .floating-hero-card.compact & {
    font-size: 16px;
    font-weight: 600;
  }
}

.hero-subtitle {
  font-size: 13px;
  color: var(--cover-text-muted, var(--m-text-muted, #9a9590));
  margin: 4px 0 0;
  opacity: 1;
  max-height: 20px;
  overflow: hidden;
  transition: opacity 0.25s ease,
              max-height 0.4s $spring,
              margin-top 0.4s $spring;

  .floating-hero-card.compact & {
    opacity: 0;
    max-height: 0;
    margin-top: 0;
  }
}

/* 入场/退场动画 */
.hero-card-fade-enter-active {
  transition: opacity 0.35s $spring-smooth,
              transform 0.45s $spring;
}
.hero-card-fade-leave-active {
  transition: opacity 0.2s ease,
              transform 0.25s $spring-smooth;
}
.hero-card-fade-enter-from {
  opacity: 0;
  transform: translateY(-12px) scale(0.95);
}
.hero-card-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .floating-hero-card,
  .hero-bg,
  .hero-content,
  .hero-title,
  .hero-subtitle {
    transition: none;
  }
}
</style>
