<template>
  <section class="mobile-home-hero">
    <!-- 心动模式：背景渐变为当前歌曲封面 -->
    <div
      class="hero-heart-cover"
      :class="{ visible: isHeartMode && currentCoverUrl }"
      :style="
        currentCoverUrl ? { backgroundImage: `url(${getImgUrl(currentCoverUrl, '512y512')})` } : {}
      "
      aria-hidden="true"
    />
    <!-- 遮罩：保证文字可读 -->
    <div class="hero-shade" aria-hidden="true" />
    <div v-if="isHeartMode" class="hero-blur" aria-hidden="true" />

    <div class="hero-content">
      <p class="hero-greeting">{{ greeting }}</p>
      <h1 class="hero-name">{{ userName }}</h1>
      <p class="hero-wish">{{ wishText }}</p>
      <div class="hero-actions">
        <button
          type="button"
          class="hero-heart-btn"
          :class="{ playing: isHeartMode }"
          @click="emit('play-heart')"
        >
          <i :class="isHeartMode ? 'ri-pause-line' : 'ri-heart-fill'" />
          <span>{{
            isHeartMode ? t('comp.homeHero.heartPlaying') : t('comp.homeHero.intelligenceMode')
          }}</span>
        </button>
        <button type="button" class="hero-fm-btn" :disabled="fmLoading" @click="emit('play-fm')">
          <i class="ri-radio-fill" />
          <span>{{ t('comp.homeHero.personalFm') }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { getImgUrl } from '@/utils';

withDefaults(
  defineProps<{
    isHeartMode?: boolean;
    /** 心动模式下渐变铺满的当前歌曲封面 */
    currentCoverUrl?: string;
    userName?: string;
    fmLoading?: boolean;
  }>(),
  {
    isHeartMode: false,
    currentCoverUrl: '',
    userName: '',
    fmLoading: false
  }
);

const emit = defineEmits<{ 'play-heart': []; 'play-fm': [] }>();
const { t, tm } = useI18n();

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return t('comp.homeHero.greetingMorning');
  if (hour >= 11 && hour < 13) return t('comp.homeHero.greetingNoon');
  if (hour >= 13 && hour < 18) return t('comp.homeHero.greetingAfternoon');
  return t('comp.homeHero.greetingEvening');
});

/** 关心话/吉祥话：进入页面时从池中随机一条 */
const wishText = ref('');
const pickWish = () => {
  const wishes = tm('comp.homeHero.wishes');
  const list = Array.isArray(wishes) ? (wishes as string[]) : [];
  wishText.value = list.length ? list[Math.floor(Math.random() * list.length)] : '';
};
pickWish();
onMounted(() => {
  pickWish();
});
</script>

<style lang="scss" scoped>
.mobile-home-hero {
  position: relative;
  height: 232px;
  overflow: hidden;
  background:
    linear-gradient(
      160deg,
      rgba(var(--accent-color-rgb, 136, 136, 136), 0.4) 0%,
      rgba(var(--accent-color-rgb, 136, 136, 136), 0.12) 46%,
      rgba(0, 0, 0, 0.5) 100%
    ),
    var(--m-bg, #111);
}

/* 心动模式：当前歌曲封面渐变铺满 */
.hero-heart-cover {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 0;
  transition: opacity 600ms ease;
  transform: scale(1.04);
}

.hero-heart-cover.visible {
  opacity: 1;
}

/* 遮罩：左侧文字可读，整体压暗，底部加重 */
.hero-shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      to top,
      rgba(0, 0, 0, 0.72) 0%,
      rgba(0, 0, 0, 0.18) 46%,
      rgba(0, 0, 0, 0.2) 100%
    ),
    linear-gradient(
      to right,
      rgba(0, 0, 0, 0.5) 0%,
      rgba(0, 0, 0, 0.1) 46%,
      rgba(0, 0, 0, 0.42) 100%
    );
  pointer-events: none;
}

/* 右侧加重模糊（按钮区），向左过渡为透明 */
.hero-blur {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 46%;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  mask-image: linear-gradient(to right, transparent 0%, rgb(0 0 0 / 0.9) 55%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, rgb(0 0 0 / 0.9) 55%);
  pointer-events: none;
}

.hero-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 18px 18px 16px;
  color: #fff;
}

.hero-greeting {
  font-size: 14px;
  opacity: 0.82;
}

.hero-name {
  margin-top: 2px;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0.3px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
}

.hero-wish {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.5;
  opacity: 0.78;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}

.hero-heart-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 40px;
  padding: 0 20px;
  border: 0;
  border-radius: 20px;
  background: #fff;
  color: #17171a;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;

  i {
    font-size: 17px;
  }

  &.playing {
    background: var(--accent-color, #888);
    color: #fff;
  }

  &:active {
    transform: scale(0.97);
  }
}

.hero-fm-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.22);
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
  cursor: pointer;

  &:active {
    transform: scale(0.97);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wall-track {
    animation: none;
  }
}
</style>
