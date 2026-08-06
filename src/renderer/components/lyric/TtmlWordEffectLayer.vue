<template>
  <div class="ttml-word-effect-layer" aria-hidden="true">
    <TransitionGroup name="ttml-auxiliary" tag="div" class="ttml-auxiliary-layer">
      <span
        v-for="token in auxiliaryTokens"
        :key="token.key"
        class="ttml-auxiliary-token"
        :class="`slot-${token.slot}`"
        >{{ token.text }}</span
      >
    </TransitionGroup>

    <Transition name="ttml-drop" mode="out-in">
      <div v-if="showDrop && mainToken" :key="mainToken.key" class="ttml-drop-token">
        {{ mainToken.text }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { WordAuxiliaryToken, WordPlaybackToken } from '@/composables/useWordTimedPlayback';

defineProps<{
  auxiliaryTokens: WordAuxiliaryToken[];
  mainToken: WordPlaybackToken | null;
  showDrop: boolean;
}>();
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

.ttml-drop-token {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  padding: 10vw;
  color: var(--player-style-lyric-color, currentColor);
  font-size: clamp(112px, 42vw, 420px);
  font-weight: 900;
  line-height: 0.82;
  text-align: center;
  overflow-wrap: anywhere;
  text-shadow: 0 12px 26px rgba(0, 0, 0, 0.18);
}

.ttml-drop-enter-active {
  animation: ttml-word-impact 300ms cubic-bezier(0.16, 0.84, 0.34, 1);
}
.ttml-drop-leave-active {
  transition: opacity 70ms linear;
}
.ttml-drop-leave-to {
  opacity: 0;
}
.ttml-auxiliary-enter-active {
  animation: ttml-aux-in 220ms ease-out;
}
.ttml-auxiliary-leave-active {
  transition: opacity 100ms linear;
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
@keyframes ttml-aux-in {
  from {
    opacity: 0;
    filter: blur(7px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ttml-drop-enter-active,
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
