<template>
  <teleport to="body">
    <transition name="star-chart-page">
      <div
        v-if="isVisible"
        class="star-chart-player player-style-surface"
        :class="[
          {
            'player-style-customized': isCustom,
            'player-style-custom-font': customFontActive,
            'player-style-custom-background': customBackgroundActive
          },
          `star-position-${starPosition}`
        ]"
        :style="{
          ...styleVars,
          '--accent-color': accentColor,
          '--accent-color-rgb': accentColorRgb,
          '--star-disc-scale': String(discScale),
          '--star-text-scale': String(textScale),
          ...lyricsSwipeStyle
        }"
        @click="handleTapToggle"
        @pointerdown.capture="
          onLyricsSwipePointerDown($event);
          commentsSwipe.onPointerDown($event);
        "
        @pointermove.capture="
          onLyricsSwipePointerMove($event);
          commentsSwipe.onPointerMove($event);
        "
        @pointerup.capture="
          onLyricsSwipePointerUp($event);
          commentsSwipe.onPointerUp($event);
        "
        @pointercancel.capture="
          onLyricsSwipePointerCancel($event);
          commentsSwipe.onPointerCancel($event);
        "
        @touchstart="onSwipeCloseTouchStart"
        @touchend="onSwipeCloseTouchEnd"
      >
        <transition name="star-chart-header">
          <header v-show="controlsVisible" class="song-header">
            <p class="song-title">{{ songTitle }}</p>
            <p class="song-artist">{{ artistText }}</p>
          </header>
        </transition>

        <transition name="star-chart-controls">
          <div v-show="controlsVisible" class="top-controls no-toggle">
            <button type="button" class="icon-button" aria-label="关闭播放器" @click="close">
              <i class="ri-arrow-down-s-line" />
            </button>
            <button
              type="button"
              class="icon-button"
              aria-label="播放器设置"
              @click="showPlayerSettings = true"
            >
              <i class="ri-more-2-fill" />
            </button>
          </div>
        </transition>

        <transition name="star-chart-chart">
          <main
            v-show="!showFullLyrics || lyricsSwipePreview"
            ref="chartFrame"
            class="chart-shell"
            :class="{ 'is-playing': isPlaying, 'is-climax': styleEngine.isInClimax }"
            :style="lyricsUnderlayStyle"
          >
            <div
              class="chart-rotor"
              aria-hidden="true"
              @pointerdown="startCoverLongPress"
              @pointerup="cancelCoverLongPress"
              @pointercancel="cancelCoverLongPress"
              @contextmenu.prevent="openCoverPreview"
            >
              <canvas ref="chartCanvas" class="chart-canvas" />
            </div>
          </main>
        </transition>

        <!-- 歌词文本块:独立于星盘定位(竖屏恒居中,横屏按星盘位置自动落位) -->
        <button
          v-show="!showFullLyrics || lyricsSwipePreview"
          :key="`portrait-${lyricBlockStart}`"
          type="button"
          class="lyric-block no-toggle"
          aria-label="打开滚动歌词"
          @dblclick.stop="openLyricsAnimated"
        >
          <span class="lyric-block-canvas">
            <span v-for="(line, i) in lyricBlockLines" :key="`l${i}`" class="lyric-block-line">{{
              line
            }}</span>
            <span
              v-for="(line, i) in lyricBlockTranslations"
              :key="`t${i}`"
              class="lyric-block-line lyric-block-translation"
              >{{ line }}</span
            >
          </span>
        </button>

        <button
          v-show="!showFullLyrics || lyricsSwipePreview"
          type="button"
          class="landscape-lyric lyric-block no-toggle"
          aria-label="打开滚动歌词"
          @dblclick.stop="openLyricsAnimated"
          :style="lyricsUnderlayStyle"
        >
          <span class="lyric-block-canvas">
            <span v-for="(line, i) in lyricBlockLines" :key="`l${i}`" class="lyric-block-line">{{
              line
            }}</span>
            <span
              v-for="(line, i) in lyricBlockTranslations"
              :key="`t${i}`"
              class="lyric-block-line lyric-block-translation"
              >{{ line }}</span
            >
          </span>
        </button>

        <div
          v-show="showFullLyrics || lyricsSwipePreview"
          class="lyrics-backdrop"
          :style="lyricsBackdropStyle"
          @click="closeLyricsAnimated"
        />
        <mobile-comments-overlay :gesture="commentsSwipe" />
        <div
          v-show="showFullLyrics || lyricsSwipePreview"
          class="scrolling-lyrics-overlay"
          :style="lyricsOverlayStyle"
        >
          <mobile-scrolling-lyrics
            class="scrolling-lyrics-content"
            :back-closes="showFullLyrics"
            :active="true"
            @close="closeLyricsAnimated"
            @interact="showControls"
            @generatePoster="handleGeneratePoster"
          />
        </div>

        <mobile-controls-area
          :visible="controlsVisible"
          :is-fullscreen="showFullLyrics"
          @close="closeLyricsAnimated"
          @showPlaylist="openPlaylist"
          @show-settings="showPlayerSettings = true"
          @interact="showControls"
        />
      </div>
    </transition>
  </teleport>

  <mobile-player-settings v-model:visible="showPlayerSettings" />
  <cover-preview-modal
    v-model:visible="coverPreviewVisible"
    :src="previewCoverUrl"
    :title="songTitle"
  />
  <poster-share-modal
    v-model:visible="showPosterModal"
    :lyrics="selectedLyrics"
    :subject="posterSubject"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import MobileCommentsOverlay from '@/components/comment/MobileCommentsOverlay.vue';
import MobileControlsArea from '@/components/lyric/MobileControlsArea.vue';
import MobileScrollingLyrics from '@/components/lyric/MobileScrollingLyrics.vue';
import CoverPreviewModal from '@/components/player/CoverPreviewModal.vue';
import MobilePlayerSettings from '@/components/player/MobilePlayerSettings.vue';
import PosterShareModal from '@/components/share/PosterShareModal.vue';
import { useCommentsPage } from '@/composables/useCommentsPage';
import { useLyricSwipeGesture } from '@/composables/useLyricSwipeGesture';
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { usePlayerStyleAppearance } from '@/composables/usePlayerStyleAppearance';
import { usePosterShare } from '@/composables/usePosterShare';
import { useStyleCustomConfig } from '@/composables/useStyleCustomConfig';
import { useSwipeClose } from '@/composables/useSwipeClose';
import { useTapToggle } from '@/composables/useTapToggle';
import { artistList, lrcArray, nowIndex, nowTime, playMusic } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { ensureFontLoaded } from '@/utils/fontLoader';
import { shouldSkipMobilePlayerFrame } from '@/utils/mobilePlayerPerformance';
import { acquirePlayerResource } from '@/utils/playerResourceDiagnostics';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  overlayMode: { type: Boolean, default: false }
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const { primaryColor, primaryColorRgb } = useCoverColor();
const { showPosterModal, selectedLyrics, posterSubject, handleGeneratePoster } = usePosterShare();
const { styleVars, isCustom, customBackgroundActive, customFontActive } =
  usePlayerStyleAppearance('starChart');
const commentsSwipe = useCommentsPage();
const showFullLyrics = ref(false);
const {
  style: lyricsSwipeStyle,
  overlayStyle: lyricsOverlayStyle,
  underlayStyle: lyricsUnderlayStyle,
  backdropStyle: lyricsBackdropStyle,
  previewing: lyricsSwipePreview,
  onPointerDown: onLyricsSwipePointerDown,
  onPointerMove: onLyricsSwipePointerMove,
  onPointerUp: onLyricsSwipePointerUp,
  onPointerCancel: onLyricsSwipePointerCancel,
  animateOpen: openLyricsAnimated,
  animateClose: closeLyricsAnimated
} = useLyricSwipeGesture({
  isOpen: () => showFullLyrics.value,
  suppressed: () => playerStore.fullCommentsVisible,
  onOpen: () => {
    showFullLyrics.value = true;
    playerStore.setFullLyricsVisible(true);
  },
  onClose: () => {
    showFullLyrics.value = false;
    playerStore.setFullLyricsVisible(false);
  }
});
const chartFrame = ref<HTMLElement>();
const chartCanvas = ref<HTMLCanvasElement>();
let resizeObserver: ResizeObserver | undefined;
let renderVersion = 0;
let spectrumFrameId: number | null = null;
let pageVisible = !document.hidden;
let releaseCanvasLoop: (() => void) | null = null;
let lastSpectrumRenderAt = 0;

interface TrailStar {
  orbit: number;
  angle: number;
  speed: number;
  magnitude: number;
  trail: number;
  twinkle: number;
  alpha: number;
  tint: number;
}

const trailStars: TrailStar[] = [];
let starTints: Array<[number, number, number]> = [];
let chartSize = 0;
let starFieldSeed = 1;
let starSpeed = 1;
let lastStarFrameAt = 0;
let starTintMix = 0.08; // 封面色占比:平时 8%,高潮渐强至 32%
let vividTints: Array<[number, number, number]> = [];
let vividTintMix = -1;
const STAR_BASE_SPEED = 0.055; // × spinSpeed 配置

function seededRandom(): number {
  starFieldSeed = (starFieldSeed + 0x6d2b79f5) | 0;
  let t = Math.imul(starFieldSeed ^ (starFieldSeed >>> 15), 1 | starFieldSeed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const { controlsVisible, handleTapToggle, showControls } = useTapToggle({
  onDoubleClick: () => {
    openLyricsAnimated();
  }
});

const { onTouchStart: onSwipeCloseTouchStart, onTouchEnd: onSwipeCloseTouchEnd } = useSwipeClose({
  shouldClose: () => !showFullLyrics.value && !playerStore.fullCommentsVisible,
  onClose: () => close()
});

const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});
const isPlaying = computed(() => playerStore.isPlay);
const showPlayerSettings = computed({
  get: () => playerStore.playerSettingsVisible,
  set: (value) => playerStore.setPlayerSettingsVisible(value)
});
const songTitle = computed(() => playMusic.value?.name || 'Zephyrus');
const artistText = computed(() => artistList.value.map((artist) => artist.name).join(' / '));
const accentColor = computed(() => primaryColor.value || '#a0a0a0');
const accentColorRgb = computed(() => primaryColorRgb.value || '160, 160, 160');
const coverUrl = computed(
  () => playMusic.value?.picUrl || playMusic.value?.al?.picUrl || '/images/default_cover.png'
);
const coverPreviewVisible = ref(false);
let coverLongPressTimer: ReturnType<typeof setTimeout> | null = null;
const previewCoverUrl = computed(() => coverUrl.value);

function startCoverLongPress() {
  cancelCoverLongPress();
  coverLongPressTimer = setTimeout(() => {
    if (previewCoverUrl.value) coverPreviewVisible.value = true;
  }, 500);
}

function cancelCoverLongPress() {
  if (coverLongPressTimer) clearTimeout(coverLongPressTimer);
  coverLongPressTimer = null;
}

function openCoverPreview() {
  cancelCoverLongPress();
  if (previewCoverUrl.value) coverPreviewVisible.value = true;
}
// ── 楷体文本块歌词:按 N 行切块,整块竖排右起展示 ──
const { config: starStyleCustom } = useStyleCustomConfig('starChart');
const spinSpeed = computed(() => {
  const value = Number(starStyleCustom.value.starSpinSpeed);
  return Number.isFinite(value) && value >= 0 ? Math.min(10, value) : 1;
});
const discScale = computed(() => {
  const value = Number(starStyleCustom.value.starDiscSize);
  return Number.isFinite(value) && value > 0 ? Math.min(1.3, Math.max(0.5, value / 100)) : 1;
});
const textScale = computed(() => {
  const value = Number(starStyleCustom.value.starTextSize);
  return Number.isFinite(value) && value > 0 ? Math.min(2, Math.max(0.6, value / 100)) : 1;
});
const STAR_POSITIONS = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
] as const;
const starPosition = computed(() => {
  const value = String(starStyleCustom.value.starChartPosition);
  return (STAR_POSITIONS as readonly string[]).includes(value) ? value : 'center';
});
const blockLineCount = computed(() => {
  const value = Number(starStyleCustom.value.starBlockLines);
  return Number.isFinite(value) ? Math.min(6, Math.max(2, Math.round(value))) : 4;
});
/**
 * 智能分块:在固定行数上限内按语义截断——
 * ① 间奏(行间隙 ≥2.8s)切;② 行长突变(排版格式切换)切;
 * ③ 到达行数上限切;④ 收尾消孤行(末块单行且无强间隔则并入前块)。
 */
// 分块输入:过滤空行(间奏占位)与制作名单行(作词/作曲/演职员表),
// 这些行不属于演唱内容,不应出现在歌词块里
const CREDITS_LINE_RE =
  /^\s*(作词|作曲|编曲|混音|母带|出品|版权|录音|人声|和声|吉他|贝斯|笛子|古筝|键盘|鼓|制作人|监制|配器|策划|文案|主唱|合成器|录音棚)\s*[:：]/;
const CREDITS_ANYWHERE_RE =
  /(作词|作曲|编曲|混音|母带|出品|版权|录音棚|监制|配器|策划|文案|MIDI工程|混音\/母带)/;
// 间奏/尾奏占位行('.' '♪' '——' 等):无演唱内容,还会以超长 duration 吞掉间奏判定
const PLACEHOLDER_LINE_RE = /^[.。·•*※♪♫~\-—_\s]+$/;
const chartRows = computed(() => {
  const rows: Array<{ idx: number; text: string }> = [];
  lrcArray.value.forEach((line, idx) => {
    const text = (line?.text || '').trim();
    if (!text || PLACEHOLDER_LINE_RE.test(text) || CREDITS_LINE_RE.test(text)) return;
    // 名单行也会写在句中(录音棚/监制：宽音studio、混音/母带/MIDI工程：李豪)
    if (CREDITS_ANYWHERE_RE.test(text) && text.length < 30) return;
    rows.push({ idx, text });
  });
  return rows;
});

const lyricBreaks = computed(() => {
  const lines = chartRows.value;
  const limit = blockLineCount.value;
  // 优先级:语义切点(间奏/格式边界)> 孤行合并 > 行数上限(兜底均分)。
  // 两遍式:先收集语义骨架,再对超长区间内部均匀插入 cap 切点,
  // 避免 cap 一刀落在形状段中间造成后续块连锁错位。

  // ── 第一遍:语义骨架 ──
  const breaks = new Map<number, 'semantic'>([[0, 'semantic']]);
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const cur = lines[i];
    const prevLen = (prev.text || '').length;
    const curLen = (cur.text || '').length;
    // ① 间奏:到下一句的空隙明显(2.8s 以上);duration 缺失退化为 start-to-start
    const prevEnd =
      (prev.duration ?? 0) > 0
        ? (prev.startTime ?? 0) + (prev.duration ?? 0)
        : (prev.startTime ?? 0);
    if ((cur.startTime ?? 0) / 1000 - prevEnd / 1000 >= 2.8) {
      breaks.set(i, 'semantic');
      continue;
    }
    // ② 格式边界:行内「标点分组节奏」改变(7+7 → 4+4 之类),
    //    只在稳定格式之间生效(prev≈prevPrev 或 cur≈next)。
    //    形状仅对带标点的多组行有意义:无标点整行 [N] 不参与节奏比较
    //    (行间字数差异不是格式突变);多组↔无标点=标点习惯突变,切。
    if (prevLen > 0 && curLen > 0) {
      const shapeOf = (text: string): number[] => {
        const parts = text.split(/[、,，;；\s]+/).filter(Boolean);
        if (parts.length <= 1) return [text.length];
        // 含拉丁字母的行(外语短语)不算中文标点分组节奏
        if (/[a-zA-Z]/.test(text)) return [text.replace(/\s+/g, '').length];
        return parts.map((part) => part.length);
      };
      const sameShape = (a: number[], b: number[]): boolean =>
        a.length === b.length && a.every((len, gi) => Math.abs(len - b[gi]) <= 1);
      const prevShape = shapeOf(prev.text || '');
      const curShape = shapeOf(cur.text || '');
      const prevGrouped = prevShape.length > 1;
      const curGrouped = curShape.length > 1;
      // 只认组数变化(无标点↔带标点、双组↔三组)为格式突变;
      // 同组数的长度波动是词组自然差异,交给行数均分兜底。
      if (prevGrouped !== curGrouped) {
        breaks.set(i, 'semantic');
      }
    }
  }

  // ── 第二遍:超长语义区间内均匀插入 cap 切点 ──
  const points = [...breaks.keys()].sort((a, b) => a - b);
  points.push(lines.length);
  for (let p = 0; p < points.length - 1; p++) {
    const segStart = points[p];
    const segEnd = points[p + 1];
    const segLines = segEnd - segStart;
    if (segLines <= limit) continue;
    const parts = Math.max(1, Math.round(segLines / limit));
    // 段长均匀(7 行 limit 4 → 4+3;8 行 → 4+4;10 行 → 5+5)
    const segmentLength = Math.round(segLines / parts);
    let cursor = segStart;
    for (let part = 0; part < parts - 1; part++) {
      cursor += segmentLength;
      breaks.set(cursor, 'cap' as const);
    }
  }

  // ── 消孤行:末区间只剩 1 行且其切点是 cap → 并回前块(语义切点永不合并) ──
  const starts = [...breaks.keys()].sort((a, b) => a - b);
  if (starts.length >= 2) {
    const last = starts[starts.length - 1];
    if (lines.length - last === 1 && breaks.get(last) !== 'semantic') {
      breaks.delete(last);
    }
  }
  if (lines.length) {
    console.debug(
      '[starChart blocks]',
      'lines:',
      lines.length,
      'breaks:',
      [...breaks.keys()].map((k) => `${k}(${breaks.get(k)})`).join(','),
      'sample:',
      lines.slice(0, 3).map((l) => l.text),
      'src:',
      playMusic.value?.name
    );
  }
  return breaks;
});
// 间奏/尾奏判定:当前时间已越过最近一句的结束(容差 1.2s)且下一句尚远(≥0.5s)
const inInterlude = computed(() => {
  const rows = chartRows.value;
  if (!rows.length) return false;
  // nowIndex 对应的最近有效行
  let lastTextIdx = rows.length - 1;
  for (let r = 0; r < rows.length; r++) {
    if (rows[r].idx > nowIndex.value) {
      lastTextIdx = r - 1;
      break;
    }
  }
  if (lastTextIdx < 0) return true;
  const cur = lrcArray.value[rows[lastTextIdx].idx];
  const endedAt = ((cur.startTime ?? 0) + (cur.duration ?? 0)) / 1000;
  const nextTextStart =
    lastTextIdx + 1 < rows.length
      ? (lrcArray.value[rows[lastTextIdx + 1].idx].startTime ?? 0) / 1000
      : Number.POSITIVE_INFINITY;
  const time = nowTime.value;
  return time > endedAt + 1.2 && time < nextTextStart - 0.5;
});
const lyricBlockStart = computed(() => {
  // nowIndex → 最近有效行(空行/制作名单已透明化)
  let rowIndex = 0;
  const rows = chartRows.value;
  for (let r = 0; r < rows.length; r++) {
    if (rows[r].idx <= nowIndex.value) rowIndex = r;
    else break;
  }
  let start = 0;
  for (const b of lyricBreaks.value.keys()) {
    if (b <= rowIndex) start = b;
    else break;
  }
  return start;
});
const lyricBlockLines = computed(() => {
  const rows = chartRows.value;
  if (!rows.length) return [songTitle.value];
  // 间奏/尾奏:整块替换为歌名
  if (inInterlude.value) return [songTitle.value];
  const lines: string[] = [];
  const start = lyricBlockStart.value;
  // 窗口止于下一语义/兜底切点:块按切点原样呈现(可短于/长于行数上限),
  // 绝不把切点之后的内容追加进当前块
  let end = Math.min(start + blockLineCount.value + 4, rows.length);
  for (const b of lyricBreaks.value.keys()) {
    if (b > start) {
      end = Math.min(end, b);
      break;
    }
  }
  for (let i = start; i < end; i++) {
    lines.push(rows[i].text);
  }
  return lines.length ? lines : [songTitle.value];
});
const lyricBlockTranslations = computed(() => {
  const out: string[] = [];
  const start = lyricBlockStart.value;
  for (let i = start; i < start + blockLineCount.value && i < lrcArray.value.length; i++) {
    const tr = lrcArray.value[i]?.trText?.trim();
    if (tr) out.push(tr);
  }
  return out;
});

function close() {
  useMobilePlayerTransition().close(0, () => {
    isVisible.value = false;
    playerStore.setMusicFull(false);
  });
}

function openPlaylist() {
  playerStore.setPlayListDrawerVisible(true);
}

onBeforeUnmount(cancelCoverLongPress);

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:/i.test(url)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** 封面随机位置采样 24 色,作为星点的轻微偏色源 */
function sampleCoverTints(image: HTMLImageElement) {
  try {
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 32;
    sampleCanvas.height = 32;
    const context = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    const source = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(
      image,
      (image.naturalWidth - source) / 2,
      (image.naturalHeight - source) / 2,
      source,
      source,
      0,
      0,
      32,
      32
    );
    const pixels = context.getImageData(0, 0, 32, 32).data;
    starTints = [];
    for (let i = 0; i < 24; i++) {
      const offset = Math.floor(seededRandom() * 1024) * 4;
      starTints.push([pixels[offset], pixels[offset + 1], pixels[offset + 2]]);
    }
  } catch {
    starTints = [];
  }
}

/** 生成星轨星场:轨道半径中带密、随机差速、拖尾弧长随机;相邻星共享 tint 形成局部偏色 */
function buildStarField(size: number, seedText: string) {
  trailStars.length = 0;
  starFieldSeed = hashText(seedText) || 1;
  const count = Math.round(Math.min(560, Math.max(320, size * 1.25)));
  for (let i = 0; i < count; i++) {
    trailStars.push({
      orbit: 0.14 + Math.pow(seededRandom(), 0.82) * 0.6,
      angle: seededRandom() * Math.PI * 2,
      speed: 0.6 + seededRandom() * 0.8,
      magnitude: 0.5 + seededRandom() * 1.1,
      trail: 0.05 + seededRandom() * 0.13,
      twinkle: seededRandom() * Math.PI * 2,
      alpha: 0.35 + seededRandom() * 0.55,
      tint: starTints.length ? Math.floor(seededRandom() * starTints.length) : -1
    });
  }
}

function drawStarField(context: CanvasRenderingContext2D, size: number, dt: number) {
  context.clearRect(0, 0, size, size);
  // 播放全速旋转(速度倍率可配),暂停缓停
  const targetSpeed = isPlaying.value ? spinSpeed.value : spinSpeed.value * 0.12;
  starSpeed += (targetSpeed - starSpeed) * Math.min(1, dt * 2.4);

  const center = size / 2;
  const maxRadius = size * 0.72;
  const now = performance.now();
  const segments = 8;

  // 高潮效果:星点直接切为最高饱和度的封面采样色,退出回落 8% 混白
  const targetMix = styleEngine.isInClimax ? 1 : 0.08;
  starTintMix += (targetMix - starTintMix) * Math.min(1, dt * 6);
  if (vividTintMix !== starTintMix || vividTints.length !== starTints.length) {
    vividTints = starTints.map((tint) => {
      const lum = 0.299 * tint[0] + 0.587 * tint[1] + 0.114 * tint[2];
      // 高潮(mix→1)时色域全开:饱和度拉到最高
      const punch = 1 + starTintMix * 2.2;
      const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
      return [
        clamp(lum + (tint[0] - lum) * punch),
        clamp(lum + (tint[1] - lum) * punch),
        clamp(lum + (tint[2] - lum) * punch)
      ] as [number, number, number];
    });
    vividTintMix = starTintMix;
  }

  for (const star of trailStars) {
    star.angle += STAR_BASE_SPEED * star.speed * starSpeed * dt;
    const orbitRadius = star.orbit * maxRadius;
    const twinkle = 0.78 + 0.22 * Math.sin(now * 0.0016 + star.twinkle);
    const alpha = star.alpha * twinkle;
    const head = star.angle;
    const tint = star.tint >= 0 ? vividTints[star.tint] : null;
    // 白 + 封面采样色:平时 92/8,高潮即整点纯采样色(最高饱和度)
    const whitePart = 1 - starTintMix;
    const red = tint ? Math.round(255 * whitePart + tint[0] * starTintMix) : 255;
    const green = tint ? Math.round(255 * whitePart + tint[1] * starTintMix) : 255;
    const blue = tint ? Math.round(255 * whitePart + tint[2] * starTintMix) : 255;

    let x = center + Math.cos(head) * orbitRadius;
    let y = center + Math.sin(head) * orbitRadius;
    for (let seg = 1; seg <= segments; seg++) {
      const angle = head - (star.trail * seg) / segments;
      const nextX = center + Math.cos(angle) * orbitRadius;
      const nextY = center + Math.sin(angle) * orbitRadius;
      const fade = 1 - seg / segments;
      context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${(alpha * fade * 0.85).toFixed(3)})`;
      context.lineWidth = star.magnitude * (0.35 + fade * 0.65);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(nextX, nextY);
      context.stroke();
      x = nextX;
      y = nextY;
    }
    context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`;
    context.beginPath();
    context.arc(x, y, star.magnitude * 0.9, 0, Math.PI * 2);
    context.fill();
  }
}

async function renderChart() {
  const canvas = chartCanvas.value;
  const frame = chartFrame.value;
  if (!canvas || !frame || !isVisible.value) return;

  const version = ++renderVersion;
  const size = Math.max(1, Math.min(frame.clientWidth, frame.clientHeight));
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(size * pixelRatio);
  canvas.height = Math.round(size * pixelRatio);
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  chartSize = size;

  try {
    const image = await loadImage(coverUrl.value);
    if (version !== renderVersion) return;
    sampleCoverTints(image);
  } catch {
    if (version !== renderVersion) return;
    starTints = [];
  }
  buildStarField(size, `${songTitle.value}:${coverUrl.value}`);

  if (context) drawStarField(context, chartSize, 0.016);
  lastStarFrameAt = performance.now();
  if (isVisible.value && !showFullLyrics.value) startSpectrumLoop();
}

function stopSpectrumLoop() {
  if (spectrumFrameId !== null) {
    cancelAnimationFrame(spectrumFrameId);
    spectrumFrameId = null;
  }
  releaseCanvasLoop?.();
  releaseCanvasLoop = null;
}

function renderSpectrumFrame() {
  const canvas = chartCanvas.value;
  if (!canvas || !trailStars.length || !isVisible.value || showFullLyrics.value || !pageVisible) {
    stopSpectrumLoop();
    return;
  }

  const now = performance.now();
  if (shouldSkipMobilePlayerFrame(lastStarFrameAt, now)) {
    spectrumFrameId = requestAnimationFrame(renderSpectrumFrame);
    return;
  }
  const dt = Math.min(0.05, Math.max(0.001, (now - lastStarFrameAt) / 1000));
  lastStarFrameAt = now;

  const context = canvas.getContext('2d');
  if (context) drawStarField(context, chartSize, dt);
  spectrumFrameId = requestAnimationFrame(renderSpectrumFrame);
}

function startSpectrumLoop() {
  stopSpectrumLoop();
  if (!pageVisible || !isVisible.value || showFullLyrics.value) return;
  releaseCanvasLoop = acquirePlayerResource('canvas-loop');
  spectrumFrameId = requestAnimationFrame(renderSpectrumFrame);
}

function handlePageVisibility() {
  pageVisible = !document.hidden;
  if (pageVisible && isVisible.value && !showFullLyrics.value) startSpectrumLoop();
  if (!pageVisible) stopSpectrumLoop();
}

watch(
  () => [coverUrl.value, isVisible.value],
  async () => {
    await nextTick();
    if (chartFrame.value && resizeObserver) resizeObserver.observe(chartFrame.value);
    renderChart();
  },
  { immediate: true }
);

watch(showFullLyrics, async (visible) => {
  await nextTick();
  if (!visible) {
    renderChart();
    startSpectrumLoop();
  } else {
    stopSpectrumLoop();
  }
});

onMounted(() => {
  // 默认楷体(马善政毛笔楷书):提前注册 FontFace,首帧即可生效
  void ensureFontLoaded('ma-shan-zheng');
  styleEngine.syncFromPlayerStore();
  styleEngine.syncCoverColors();
  resizeObserver = new ResizeObserver(() => renderChart());
  if (chartFrame.value) resizeObserver.observe(chartFrame.value);
  void nextTick(() => renderChart());
  document.addEventListener('visibilitychange', handlePageVisibility);
  if (pageVisible && !showFullLyrics.value) startSpectrumLoop();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  stopSpectrumLoop();
  renderVersion++;
  document.removeEventListener('visibilitychange', handlePageVisibility);
});
</script>

<style scoped lang="scss">
.star-chart-player {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #f7f7f5;
  background: #050505;
  isolation: isolate;
}

.chart-shell {
  position: relative;
  width: calc(min(78vw, 560px) * var(--star-disc-scale, 1));
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  /* 九宫格位置:边缘位使圆盘一半出画(center 居中完整) */
  --star-pos-x: 0%;
  --star-pos-y: 0%;
  transform: translate(var(--star-pos-x), var(--star-pos-y));
  transition: transform 460ms cubic-bezier(0.32, 0.72, 0, 1);
}

.star-position-top .chart-shell {
  --star-pos-y: -50%;
}
.star-position-bottom .chart-shell {
  --star-pos-y: 50%;
}
.star-position-left .chart-shell {
  --star-pos-x: -50%;
}
.star-position-right .chart-shell {
  --star-pos-x: 50%;
}
.star-position-top-left .chart-shell {
  --star-pos-x: -50%;
  --star-pos-y: -50%;
}
.star-position-top-right .chart-shell {
  --star-pos-x: 50%;
  --star-pos-y: -50%;
}
.star-position-bottom-left .chart-shell {
  --star-pos-x: -50%;
  --star-pos-y: 50%;
}
.star-position-bottom-right .chart-shell {
  --star-pos-x: 50%;
  --star-pos-y: 50%;
}

.chart-rotor {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.chart-canvas {
  width: 100%;
  height: 100%;
  display: block;
  opacity: 0.9;
  filter: saturate(0.72) brightness(0.88);
  transition:
    opacity 420ms var(--m-ease-out, ease-out),
    filter 420ms var(--m-ease-out, ease-out);
}

.is-climax .chart-canvas {
  opacity: 1;
  filter: saturate(1) brightness(1.12);
}

.lyric-block {
  /* 竖屏:全屏居中,独立于星盘位置 */
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  padding: calc(env(safe-area-inset-top, 0px) + 96px) 20px
    calc(var(--mobile-dock-content-inset, 132px) + 24px);
  color: inherit;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.lyric-block-canvas {
  /* 竖排右起:块级子元素自然从右向左成列(不能用 flex——其主轴随书写模式翻转为纵向) */
  writing-mode: vertical-rl;
  text-align: justify;
  max-width: 100%;
  padding: 26px 30px;
}

.landscape-lyric {
  display: none;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.lyric-block-line {
  display: block;
  font-family: var(
    --player-style-font-family,
    'ZephyrusMaShanZheng',
    'Noto Serif SC',
    'STKai',
    'KaiTi',
    serif
  );
  font-size: calc(clamp(19px, 2.7dvh, 24px) * var(--star-text-scale, 1));
  font-weight: 500;
  line-height: 2.05;
  letter-spacing: 0.16em;
  color: rgba(255, 255, 255, 0.88);
  /* 长句不折列:保持一行完整,允许溢出块区域 */
  white-space: nowrap;
  text-shadow:
    0 2px 14px #000,
    0 0 4px #000;
}

.lyric-block-line:not(:first-child) {
  margin-right: 14px;
}

.lyric-block-translation {
  font-size: clamp(12px, 1.7dvh, 14px);
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.is-climax .lyric-block-line:not(.lyric-block-translation) {
  color: var(--accent-color);
  text-shadow:
    0 0 14px rgba(var(--accent-color-rgb), 0.4),
    0 2px 14px #000;
  transition: color 360ms var(--m-ease-out, ease-out);
}

.top-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 0px) + 16px) 20px 0;
}

.icon-button {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  color: #fff;
  background: #121212;
  backdrop-filter: none;
  cursor: pointer;
  transition:
    transform 180ms var(--m-ease-out, ease-out),
    background-color 220ms var(--m-ease-out, ease-out),
    border-color 220ms var(--m-ease-out, ease-out);
}

.icon-button i {
  font-size: 22px;
}

.icon-button:active {
  transform: scale(0.94);
  background: rgba(var(--accent-color-rgb), 0.22);
  border-color: rgba(var(--accent-color-rgb), 0.42);
}

.song-header {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 23px);
  left: 50%;
  z-index: 35;
  width: min(58vw, 420px);
  transform: translateX(-50%);
  text-align: center;
  pointer-events: none;
}

.song-header p {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0;
}

.song-title {
  font-size: 14px;
  font-weight: 650;
  color: rgba(255, 255, 255, 0.92);
}

.song-artist {
  margin-top: 3px !important;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.46);
}

.lyrics-backdrop {
  position: absolute;
  inset: 0;
  z-index: 45;
  background: #0b0b0b;
  backdrop-filter: none;
}

.scrolling-lyrics-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
}

.scrolling-lyrics-content {
  width: 100%;
  height: 100%;
}

.star-chart-page-enter-active,
.star-chart-page-leave-active {
  transition:
    opacity 320ms var(--m-ease-out, ease-out),
    transform 420ms var(--m-ease-out, ease-out);
}

.star-chart-page-enter-from,
.star-chart-page-leave-to {
  opacity: 0;
  transform: translateY(18px) scale(0.985);
}

.star-chart-content-enter-active,
.star-chart-content-leave-active {
  transition:
    opacity 260ms var(--m-ease-out, ease-out),
    transform 320ms var(--m-ease-out, ease-out);
}

.star-chart-content-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.star-chart-content-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.star-chart-chart-enter-active,
.star-chart-chart-leave-active {
  transition:
    opacity 360ms var(--m-ease-out, ease-out),
    transform 460ms var(--m-ease-out, ease-out),
    filter 360ms var(--m-ease-out, ease-out);
}

.star-chart-chart-enter-from,
.star-chart-chart-leave-to {
  opacity: 0;
  transform: scale(0.88) translateY(18px);
  filter: blur(10px);
}

.star-chart-controls-enter-active,
.star-chart-controls-leave-active,
.star-chart-header-enter-active,
.star-chart-header-leave-active,
.star-chart-overlay-enter-active,
.star-chart-overlay-leave-active {
  transition:
    opacity 240ms var(--m-ease-out, ease-out),
    transform 280ms var(--m-ease-out, ease-out);
}

.star-chart-controls-enter-from,
.star-chart-controls-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.star-chart-header-enter-from,
.star-chart-header-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

.star-chart-overlay-enter-from,
.star-chart-overlay-leave-to {
  opacity: 0;
}

@media (orientation: landscape) {
  .star-chart-player {
    display: block;
  }

  /* 横屏九宫格:圆盘中心锚到对应边/角(left/top 百分比),边缘位露出一半 */
  .chart-shell {
    position: absolute;
    left: var(--star-anchor-x, 50%);
    top: var(--star-anchor-y, 50%);
    transform: translate(-50%, -50%);
    width: calc(min(82vh, 680px) * var(--star-disc-scale, 1));
    transition:
      left 460ms cubic-bezier(0.32, 0.72, 0, 1),
      top 460ms cubic-bezier(0.32, 0.72, 0, 1);
  }

  .star-position-left .chart-shell {
    --star-anchor-x: 0%;
  }
  .star-position-right .chart-shell {
    --star-anchor-x: 100%;
  }
  .star-position-top .chart-shell {
    --star-anchor-y: 0%;
  }
  .star-position-bottom .chart-shell {
    --star-anchor-y: 100%;
  }
  .star-position-top-left .chart-shell {
    --star-anchor-x: 0%;
    --star-anchor-y: 0%;
  }
  .star-position-top-right .chart-shell {
    --star-anchor-x: 100%;
    --star-anchor-y: 0%;
  }
  .star-position-bottom-left .chart-shell {
    --star-anchor-x: 0%;
    --star-anchor-y: 100%;
  }
  .star-position-bottom-right .chart-shell {
    --star-anchor-x: 100%;
    --star-anchor-y: 100%;
  }

  /* 横屏下隐藏竖屏居中块(只保留定位块) */
  .lyric-block:not(.landscape-lyric) {
    display: none;
  }

  .chart-shell .lyric-block {
    display: none;
  }

  .landscape-lyric.lyric-block {
    position: absolute;
    display: block;
    inset: auto;
    right: clamp(28px, 6vw, 90px);
    top: 50%;
    transform: translateY(-50%);
    width: min(30vw, 380px);
    padding: 0;
  }

  /* 星盘右 → 歌词左 */
  .star-position-right .landscape-lyric.lyric-block {
    right: auto;
    left: clamp(28px, 6vw, 90px);
  }

  /* 角位置 → 歌词居中 */
  .star-position-top-left .landscape-lyric.lyric-block,
  .star-position-top-right .landscape-lyric.lyric-block,
  .star-position-bottom-left .landscape-lyric.lyric-block,
  .star-position-bottom-right .landscape-lyric.lyric-block {
    left: 50%;
    right: auto;
    transform: translate(-50%, -50%);
  }

  /* 星盘上/下/中 → 歌词居中 */
  .star-position-center .landscape-lyric.lyric-block,
  .star-position-top .landscape-lyric.lyric-block,
  .star-position-bottom .landscape-lyric.lyric-block {
    left: 50%;
    right: auto;
    transform: translate(-50%, -50%);
  }

  .landscape-lyric .lyric-block-canvas {
    padding: 20px 24px;
  }

  .landscape-lyric .lyric-block-line {
    font-size: calc(clamp(17px, 2.2vw, 22px) * var(--star-text-scale, 1));
  }
}

@media (max-width: 380px) {
  .chart-shell {
    width: 84vw;
  }

  .lyric-block-line {
    font-size: 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .star-chart-page-enter-active,
  .star-chart-page-leave-active,
  .star-chart-content-enter-active,
  .star-chart-content-leave-active,
  .star-chart-controls-enter-active,
  .star-chart-controls-leave-active,
  .star-chart-header-enter-active,
  .star-chart-header-leave-active,
  .star-chart-overlay-enter-active,
  .star-chart-overlay-leave-active {
    transition-duration: 120ms;
  }
}
</style>
