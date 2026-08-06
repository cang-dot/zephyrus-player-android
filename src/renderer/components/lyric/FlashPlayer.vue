<template>
  <teleport to="body">
    <transition name="flash-v2-fade">
      <div
        v-if="isVisible"
        class="flash-v2-player player-style-surface"
        :style="flashStyle"
        @click="handleTapToggle"
        @touchstart="onSwipeTouchStart"
        @touchend="onSwipeTouchEnd"
      >
        <div class="flash-v2-grain" aria-hidden="true"></div>

        <div v-if="backgroundLines.length > 0" class="flash-v2-auxiliary" aria-hidden="true">
          <span v-for="(line, index) in backgroundLines" :key="`${line}-${index}`">{{ line }}</span>
        </div>
        <div v-if="showRepeatedBackground" class="flash-v2-repeat" aria-hidden="true">
          <span v-for="(line, index) in repeatedBackgroundLines" :key="`${line}-${index}`">{{
            line
          }}</span>
        </div>

        <header v-show="controlsVisible" class="flash-v2-header no-toggle">
          <button type="button" class="flash-v2-icon" aria-label="关闭播放器" @click.stop="close">
            <i class="ri-arrow-down-s-line"></i>
          </button>
          <div class="flash-v2-meta">
            <strong>{{ songTitle }}</strong>
            <span>{{ artistText }}</span>
          </div>
          <button
            type="button"
            class="flash-v2-icon"
            aria-label="播放器设置"
            @click.stop="openSettings"
          >
            <i class="ri-settings-4-line"></i>
          </button>
        </header>

        <main class="flash-v2-stage" :class="{ climax: isClimax, outro: isOutro }">
          <div class="flash-v2-kicker">{{ stateLabel }}</div>
          <transition name="flash-token" mode="out-in">
            <div :key="tokenKey" class="flash-v2-token" :class="{ keyword: isKeyword }">
              {{ displayText }}
            </div>
          </transition>
          <div v-if="translationText && !isOutro" class="flash-v2-translation">
            {{ translationText }}
          </div>
          <div v-if="isOutro" class="flash-v2-outro-title">{{ songTitle }}</div>
          <div v-if="amllStore.loading" class="flash-v2-source">AMLL TTML</div>
        </main>

        <mobile-controls-area
          :visible="controlsVisible"
          :is-fullscreen="true"
          @close="close"
          @showPlaylist="openPlaylist"
          @interact="showControls"
        />

        <mobile-player-settings v-model:visible="showPlayerSettings" />
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';

import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import MobilePlayerSettings from '@/components/player/MobilePlayerSettings.vue';
import { usePlayerStyleAppearance } from '@/composables/usePlayerStyleAppearance';
import { useStyleCustomConfig } from '@/composables/useStyleCustomConfig';
import { useSwipeClose } from '@/composables/useSwipeClose';
import { useTapToggle } from '@/composables/useTapToggle';
import { artistList, lrcArray, nowIndex, nowTime, playMusic } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import {
  findTtmlLineIndex,
  findTtmlWordIndex,
  getTtmlBackgroundLines,
  isTtmlPartActive,
  type TtmlLine,
  type TtmlWord
} from '@/services/ttmlParser';
import { useAmllStore } from '@/store/modules/amll';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { getClimaxWordCandidates } from '@/utils/emotionalDetector';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  overlayMode: { type: Boolean, default: false }
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const amllStore = useAmllStore();
const { primaryColor } = useCoverColor();
const { styleVars } = usePlayerStyleAppearance();
const { config: styleCfg } = useStyleCustomConfig('flash');
const flashStyle = computed(() => ({
  ...styleVars.value,
  '--flash-keyword-color': styleCfg.value.flashKeywordColor || primaryColor.value,
  '--flash-token-size': `${styleCfg.value.flashFontSize || 180}px`,
  '--flash-font-family': styleCfg.value.flashFontFamily || "SimSun, 'STSong', serif"
}));

const isVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
});
const showPlayerSettings = computed({
  get: () => playerStore.playerSettingsVisible,
  set: (value: boolean) => playerStore.setPlayerSettingsVisible(value)
});

const { controlsVisible, handleTapToggle, showControls } = useTapToggle();
const { onTouchStart: onSwipeTouchStart, onTouchEnd: onSwipeTouchEnd } = useSwipeClose({
  shouldClose: () => true,
  onClose: () => close()
});

const songTitle = computed(() => playMusic.value?.name || 'Zephyrus');
const artistText = computed(() => artistList.value.map((artist) => artist.name).join(' / '));
const duration = computed(() => (playMusic.value?.dt || playMusic.value?.duration || 0) / 1000);
const ttml = computed(() => amllStore.ttmlLyric);
const primaryLines = computed(() => ttml.value?.lines.filter((line) => !line.isBackground) || []);

const currentTtmlLine = computed<TtmlLine | null>(() => {
  if (!ttml.value || primaryLines.value.length === 0) return null;
  const active = primaryLines.value.find(
    (line) => nowTime.value >= line.begin && nowTime.value <= line.end
  );
  if (active) return active;
  const lineIndex = findTtmlLineIndex(ttml.value, nowTime.value);
  const candidate = ttml.value.lines[lineIndex];
  return candidate && !candidate.isBackground && nowTime.value <= candidate.end ? candidate : null;
});

const currentWord = computed<TtmlWord | null>(() => {
  const line = currentTtmlLine.value;
  if (!line) return null;
  const activeIndex = findTtmlWordIndex(line, nowTime.value);
  return line.words[activeIndex] || line.words[0] || null;
});

const fallbackText = computed(() => lrcArray.value[nowIndex.value]?.text?.trim() || '');
const displayText = computed(() => {
  if (isOutro.value) return '';
  if (currentWord.value) return currentWord.value.text.trim();
  return ttml.value ? '' : fallbackText.value;
});
const translationText = computed(
  () =>
    currentTtmlLine.value?.translations[0]?.text ||
    lrcArray.value[nowIndex.value]?.trText?.trim() ||
    ''
);
const tokenKey = computed(
  () =>
    `${currentTtmlLine.value?.key || nowIndex.value}:${currentWord.value?.begin || displayText.value}`
);

const isClimax = computed(() => {
  const line = currentTtmlLine.value;
  return Boolean(
    styleEngine.isInClimax ||
    (ttml.value && isTtmlPartActive(ttml.value, ['Chorus', 'PreChorus'], nowTime.value)) ||
    Boolean(
      line &&
      styleEngine.climaxSegments.some(
        (seg) => nowTime.value >= seg.start && nowTime.value <= seg.end
      )
    )
  );
});
const isOutro = computed(() => {
  if (isClimax.value) return false;
  if (ttml.value && isTtmlPartActive(ttml.value, 'Outro', nowTime.value)) return true;
  return duration.value > 0 && nowTime.value >= Math.max(0, duration.value - 30);
});

const backgroundLines = computed(() => {
  if (!ttml.value) return [];
  return getTtmlBackgroundLines(ttml.value, nowTime.value)
    .map((line) => line.text.trim())
    .filter(Boolean)
    .slice(0, 4);
});
const repeatedBackgroundLines = computed(() => {
  if (isOutro.value) {
    return primaryLines.value
      .map((line) => line.text)
      .filter(Boolean)
      .slice(-8);
  }
  const text = currentTtmlLine.value?.text || fallbackText.value;
  return text ? Array.from({ length: 12 }, () => text) : [];
});
const showRepeatedBackground = computed(() => isClimax.value || isOutro.value);

const keywordCandidates = computed(() => {
  const line = currentTtmlLine.value;
  if (!line) return [];
  const configured = styleEngine.currentLineKeywords.map((word) => word.text).filter(Boolean);
  if (configured.length > 0) return configured;
  return getClimaxWordCandidates(line.text);
});
const isKeyword = computed(() => {
  const word = currentWord.value?.text.trim();
  if (!word || !isClimax.value) return false;
  return keywordCandidates.value.some(
    (candidate) => candidate.includes(word) || word.includes(candidate)
  );
});
const stateLabel = computed(() => {
  if (isOutro.value) return 'OUTRO';
  if (isClimax.value) return 'CLIMAX';
  return 'FLASH';
});

const close = () => {
  isVisible.value = false;
};
const openSettings = () => {
  showControls();
  showPlayerSettings.value = true;
};
const openPlaylist = () => playerStore.setPlayListDrawerVisible(true);

watch(
  () => [nowIndex.value, currentTtmlLine.value?.key],
  () => styleEngine.updateCurrentLineKeywords(nowIndex.value),
  { immediate: true }
);

watch(
  () => playerStore.currentSong?.id,
  (songId) => {
    if (songId) void styleEngine.loadClimaxData(String(songId));
  },
  { immediate: true }
);

onMounted(() => {
  styleEngine.syncFromPlayerStore();
  styleEngine.syncCoverColors();
});
</script>

<style scoped lang="scss">
.flash-v2-player {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: #080808;
  color: var(--player-style-lyric-color);
  font-family: var(--flash-font-family, SimSun), 'STSong', serif;
}

.flash-v2-grain {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0.08;
  pointer-events: none;
  background-image: radial-gradient(rgba(255, 255, 255, 0.8) 0.5px, transparent 0.5px);
  background-size: 5px 5px;
  mix-blend-mode: soft-light;
}

.flash-v2-header,
.flash-v2-stage,
:deep(.mobile-controls) {
  position: relative;
  z-index: 2;
}

.flash-v2-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: max(18px, env(safe-area-inset-top)) 22px 10px;
}

.flash-v2-icon {
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 50%;
  color: var(--player-style-lyric-color);
  background: rgba(0, 0, 0, 0.24);
  font-size: 20px;
}

.flash-v2-meta {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  text-align: center;
}

.flash-v2-meta strong,
.flash-v2-meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flash-v2-meta strong {
  font-size: 16px;
  font-weight: 600;
}

.flash-v2-meta span {
  margin-top: 3px;
  opacity: 0.65;
  font-family: system-ui, sans-serif;
  font-size: 12px;
}

.flash-v2-stage {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 36px 18px 150px;
  text-align: center;
}

.flash-v2-kicker {
  color: var(--accent-color, var(--player-style-lyric-color));
  font-family: system-ui, sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.28em;
  opacity: 0.9;
}

.flash-v2-token {
  max-width: 100%;
  color: var(--player-style-lyric-color);
  font-size: clamp(76px, 19vw, var(--flash-token-size, 290px));
  font-weight: 400;
  line-height: 0.96;
  text-wrap: balance;
  text-shadow: 0 4px 32px rgba(0, 0, 0, 0.3);
  transition:
    color 160ms ease,
    transform 160ms ease;
}

.flash-v2-token.keyword {
  color: var(--flash-keyword-color, var(--accent-color, var(--player-style-lyric-color)));
  transform: scale(1.08);
}

.flash-v2-translation,
.flash-v2-source {
  max-width: min(680px, 88vw);
  font-family: system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  opacity: 0.68;
}

.flash-v2-source {
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.flash-v2-outro-title {
  font-family: system-ui, sans-serif;
  font-size: clamp(18px, 4vw, 30px);
  letter-spacing: 0.16em;
  opacity: 0.78;
}

.flash-v2-auxiliary,
.flash-v2-repeat {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  align-content: center;
  justify-content: center;
  gap: 22px 34px;
  overflow: hidden;
  padding: 12vh 7vw;
  color: var(--player-style-lyric-color);
  font-size: clamp(24px, 6vw, 88px);
  line-height: 1.05;
  opacity: 0.11;
  pointer-events: none;
  transform: rotate(-7deg) scale(1.08);
}

.flash-v2-auxiliary {
  z-index: 0;
  font-size: clamp(18px, 4vw, 60px);
  opacity: 0.16;
  transform: rotate(4deg) scale(1.05);
}

.flash-v2-repeat {
  grid-template-columns: repeat(3, minmax(180px, 1fr));
}

.outro .flash-v2-repeat {
  grid-template-columns: 1fr;
  gap: 12px;
  padding: 16vh 12vw;
  font-size: clamp(18px, 3vw, 42px);
  line-height: 1.25;
  opacity: 0.14;
  transform: none;
}

.flash-token-enter-active,
.flash-token-leave-active {
  transition:
    opacity 120ms ease,
    transform 120ms ease;
}

.flash-token-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.92);
}

.flash-token-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(1.05);
}

@media (orientation: landscape) {
  .flash-v2-stage {
    padding-bottom: 110px;
  }

  .flash-v2-token {
    font-size: clamp(64px, 13vw, 220px);
  }
}
</style>
