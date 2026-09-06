<template>
  <div class="ttml-word-effect-layer" aria-hidden="true">
    <TransitionGroup
      name="ttml-auxiliary"
      tag="div"
      class="ttml-auxiliary-layer"
      :class="{ 'is-centered': centerAuxiliary }"
    >
      <span
        v-for="token in visibleAuxiliaryTokens"
        :key="token.key"
        class="ttml-auxiliary-token"
        :class="`slot-${token.slot}`" :style="auxiliaryTokenStyle(token)"
        >{{ token.text }}</span
      >
    </TransitionGroup>

    <div
      v-if="showDrop && mainToken && isTtmlToken"
      :key="mainToken.key"
      class="ttml-drop-token ttml-drop-token--ttml"
      :style="ttmlDropTokenStyle"
    >
      <span :class="{ 'climax-shake': climaxShake }">{{ mainToken.text }}</span>
    </div>

    <Transition v-else name="ttml-drop" mode="out-in">
      <div v-if="showDrop && mainToken" :key="mainToken.key" class="ttml-drop-token">
        {{ mainToken.text }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { WordAuxiliaryToken, WordPlaybackToken } from '@/composables/useWordTimedPlayback';

const props = withDefaults(
  defineProps<{
    auxiliaryTokens: WordAuxiliaryToken[];
    mainToken: WordPlaybackToken | null;
    showDrop: boolean;
    centerAuxiliary?: boolean;
    climaxShake?: boolean;
  }>(),
  { centerAuxiliary: false, climaxShake: false }
);

const visibleAuxiliaryTokens = computed(() => {
  if (!props.centerAuxiliary) return props.auxiliaryTokens;
  const latest = props.auxiliaryTokens.reduce<WordAuxiliaryToken | null>(
    (selected, token) => (!selected || token.begin >= selected.begin ? token : selected),
    null
  );
  return latest ? [{ ...latest, slot: 0 }] : [];
});

const isTtmlToken = computed(() => props.mainToken?.key.startsWith('ttml:') === true);
const ttmlDropTokenStyle = computed(() => {
  const tokenDuration = props.mainToken
    ? Math.max(0, props.mainToken.end - props.mainToken.begin) * 1000
    : 300;
  const animationDuration = Math.min(120, Math.max(56, tokenDuration * 0.35));
  return { '--ttml-drop-duration': `${animationDuration}ms` };
});
// 背景/对唱词逐字进出场时长按分词时间动态计算：
// 进入时长上限为字时长的 50%（80-220ms），离开上限为 25%（40-100ms），
// 确保下一字出现前上一字已基本退场，避免快字相互覆盖（吞字）。
const AUX_ENTER_MIN_MS = 80;
const AUX_ENTER_MAX_MS = 220;
const AUX_LEAVE_MIN_MS = 40;
const AUX_LEAVE_MAX_MS = 100;

function auxiliaryTokenStyle(token: WordAuxiliaryToken) {
  const wordMs = Math.max(0, token.end - token.begin) * 1000;
  if (!Number.isFinite(wordMs) || wordMs <= 0) return undefined;
  const enterMs = Math.min(Math.max(wordMs * 0.5, AUX_ENTER_MIN_MS), AUX_ENTER_MAX_MS);
  const leaveMs = Math.min(Math.max(wordMs * 0.25, AUX_LEAVE_MIN_MS), AUX_LEAVE_MAX_MS);
  return {
    '--aux-in-duration': `${enterMs}ms`,
    '--aux-out-duration': `${leaveMs}ms`
  };
}
</script>

<style scoped>
.ttml-word-effect-layer,
.ttml-auxiliary-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.ttml-word-effect-layer {
  z-index: 2;
  font-family: var(--player-style-resolved-font, inherit);
}
.ttml-auxiliary-layer {
  z-index: 0;
}
.ttml-auxiliary-token {
  position: absolute;
  max-width: 80vw;
  color: var(--player-style-auxiliary-color, currentColor);
  font-size: clamp(104px, 34vw, 360px);
  font-weight: 800;
  line-height: 0.82;
  opacity: 0.14;
  overflow-wrap: anywhere;
  text-align: center;
}
.ttml-auxiliary-token.slot-0 {
  top: 5%;
  left: -3%;
  transform: rotate(-5deg);
}
.ttml-auxiliary-token.slot-1 {
  top: 36%;
  right: -4%;
  transform: rotate(4deg);
}
.ttml-auxiliary-token.slot-2 {
  bottom: 2%;
  left: 17%;
  transform: rotate(-2deg);
}
.ttml-auxiliary-layer.is-centered {
  display: grid;
  place-items: center;
  padding: 8vw;
}
.ttml-auxiliary-layer.is-centered .ttml-auxiliary-token {
  position: static;
  max-width: 84vw;
  font-size: clamp(112px, 40vw, 420px);
  line-height: 0.86;
  opacity: 0.16;
  transform: none;
}

.ttml-drop-token {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  padding: 10vw;
  color: var(--player-style-lyric-color, currentColor);
  font-size: clamp(112px, 42vw, 420px);
  font-weight: var(--player-style-drop-font-weight, 900);
  line-height: 0.82;
  text-align: center;
  overflow-wrap: anywhere;
  text-shadow: 0 12px 26px rgba(0, 0, 0, 0.18);
}

.ttml-drop-enter-active {
  animation: ttml-word-impact 180ms cubic-bezier(0.16, 0.84, 0.34, 1);
}
.ttml-drop-token--ttml {
  animation: ttml-word-impact-ttml var(--ttml-drop-duration, 80ms) cubic-bezier(0.12, 0.72, 0.2, 1)
    both;
}
.ttml-drop-token--ttml > span {
  display: inline-block;
  will-change: transform;
}
.ttml-drop-token--ttml > span.climax-shake {
  animation: ttml-climax-shake 260ms linear infinite;
}
.ttml-drop-leave-active {
  transition: opacity 70ms linear;
}
.ttml-drop-leave-to {
  opacity: 0;
}
.ttml-auxiliary-enter-active {
  animation: ttml-aux-in var(--aux-in-duration, 220ms) ease-out;
}
.ttml-auxiliary-leave-active {
  transition: opacity var(--aux-out-duration, 100ms) linear;
}
.ttml-auxiliary-leave-to {
  opacity: 0;
}

@keyframes ttml-word-impact {
  0% {
    opacity: 0;
    transform: translateY(-48vh) scale(0.88);
  }
  72% {
    opacity: 1;
    transform: translateY(2.5vh) scale(1.04, 0.96);
  }
  88% {
    transform: translateY(-1vh) scale(0.98, 1.02);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}
@keyframes ttml-word-impact-ttml {
  0% {
    opacity: 0.35;
    transform: translateY(-38vh) scale(0.9);
  }
  42% {
    opacity: 1;
    transform: translateY(2.5vh) scale(1.04, 0.96);
  }
  72% {
    transform: translateY(-0.8vh) scale(0.985, 1.015);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes ttml-aux-in {
  from {
    opacity: 0;
    filter: blur(7px);
  }
}

@keyframes ttml-climax-shake {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  20% {
    transform: translate3d(-1.4vw, 0.7vh, 0) rotate(-1.8deg) scale(1.02);
  }
  40% {
    transform: translate3d(1.6vw, -0.8vh, 0) rotate(1.7deg) scale(1.03);
  }
  60% {
    transform: translate3d(-1.2vw, 0.9vh, 0) rotate(-1.4deg) scale(1.01);
  }
  80% {
    transform: translate3d(1.3vw, -0.7vh, 0) rotate(1.5deg) scale(1.04);
  }
}

@media (orientation: landscape) {
  .ttml-auxiliary-layer.is-centered .ttml-auxiliary-token {
    font-size: clamp(104px, 58vh, 300px);
  }
  .ttml-drop-token {
    inset: 0 0 clamp(24px, 12vh, 64px);
    padding: clamp(16px, 4vh, 36px) 10vw;
    font-size: clamp(104px, 60vh, 280px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ttml-drop-enter-active,
  .ttml-drop-token--ttml,
  .ttml-drop-token--ttml > span.climax-shake,
  .ttml-auxiliary-enter-active {
    animation: none;
    transition: opacity 140ms linear;
  }
  .ttml-drop-enter-from,
  .ttml-auxiliary-enter-from {
    opacity: 0;
  }
}
</style>
