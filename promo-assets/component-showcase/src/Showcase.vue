<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { gsap } from 'gsap';
import SegmentSlider from '@/components/common/SegmentSlider.vue';
import { LYRIC_LINES, PLAYER_STYLES, SHOTS, SONGS, DATABASE_TITLES } from './data';

const frame = ref(0);
const reducedMotion = ref(false);
const nowTime = ref(0);
const nowIndex = ref(0);

const scene = computed(() => {
  const f = frame.value;
  if (f < SHOTS.database[0]) return 'material';
  if (f < SHOTS.lyrics[0]) return 'database';
  if (f < SHOTS.alignment[0]) return 'lyrics';
  if (f < SHOTS.styles[0]) return 'alignment';
  if (f < SHOTS.slider[0]) return 'styles';
  if (f < SHOTS.playbar[0]) return 'slider';
  if (f < SHOTS.poster[0]) return 'playbar';
  if (f < SHOTS.brand[0]) return 'poster';
  return 'brand';
});

const beat = computed(() => frame.value / 15);
const song = computed(() => SONGS[Math.floor(beat.value / 4) % SONGS.length]);
const localProgress = computed(() => (frame.value % 120) / 120);
const sceneProgress = computed(() => {
  const bounds = SHOTS[scene.value as keyof typeof SHOTS];
  return Math.min(1, Math.max(0, (frame.value - bounds[0]) / Math.max(1, bounds[1] - bounds[0])));
});

function alphaFor(name: string) {
  return scene.value === name ? 1 : 0;
}

function selectSongForFrame() {
  const current = song.value;
  void current;

  nowTime.value = (frame.value / 30) % 22;
  nowIndex.value = Math.min(LYRIC_LINES.length - 1, Math.floor(nowTime.value / 4.4));
}

function seek(detail: { frame: number }) {
  frame.value = detail.frame;
  selectSongForFrame();
}

function handleShowcaseSeek(event: Event) {
  seek((event as CustomEvent<{ frame: number }>).detail);
}

onMounted(() => {
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.addEventListener('showcase:seek', handleShowcaseSeek);
  selectSongForFrame();
});

onUnmounted(() => window.removeEventListener('showcase:seek', handleShowcaseSeek));

const ringItems = computed(() => Array.from({ length: 12 }, (_, i) => ({
  label: ['按钮', '开关', '滑块', '卡片'][i % 4],
  angle: i * 30 + beat.value * 2
})));

const titleCloud = computed(() => DATABASE_TITLES.map((title, i) => ({
  title,
  x: ((i * 83) % 920) - 460,
  y: ((i * 47) % 280) - 140,
  rotate: ((i * 17) % 16) - 8,
  opacity: 0.35 + ((i * 13) % 55) / 100
})));

const previewStyle = computed(() => {
  const index = Math.min(PLAYER_STYLES.length - 1, Math.floor(sceneProgress.value * PLAYER_STYLES.length));
  return PLAYER_STYLES[index];
});

const alignment = computed(() => {
  const p = sceneProgress.value;
  return p < 0.33 ? 'left' : p < 0.66 ? 'center' : 'right';
});
</script>

<template>
  <main class="showcase" :style="{ '--accent': song.primaryColor, '--surface': song.surfaceColor }">
    <div class="grain" />
    <section class="scene scene-material" :style="{ opacity: alphaFor('material') }">
      <div class="eyebrow">ZEPHYRUS PLAYER · MD3</div>
      <div class="material-orbit" :style="{ transform: `rotate(${beat * 3}deg)` }">
        <div v-for="item in ringItems" :key="item.angle" class="orbit-chip" :style="{ transform: `rotate(${item.angle}deg) translateY(-320px) rotate(${-item.angle}deg)` }">{{ item.label }}</div>
      </div>
      <article class="song-card" :style="{ '--card-accent': song.primaryColor }">
        <img :src="song.cover" alt="" />
        <div><strong>{{ song.title }}</strong><span>{{ song.artist }}</span></div>
        <button aria-label="播放">▶</button>
      </article>
      <p class="caption">Material You，随音乐生长</p>
    </section>

    <section class="scene scene-database" :style="{ opacity: alphaFor('database') }">
      <div class="title-cloud">
        <span v-for="item in titleCloud" :key="item.title" :style="{ transform: `translate(${item.x}px, ${item.y}px) rotate(${item.rotate}deg) scale(${1 + sceneProgress * .25})`, opacity: item.opacity }">{{ item.title }}</span>
        <strong>AMLL-TTML-DB</strong>
      </div>
      <p class="caption">AMLL 逐字歌词数据库支持</p>
    </section>

    <section class="scene scene-lyrics" :style="{ opacity: alphaFor('lyrics') }">
      <div class="lyrics-stage" :class="{ 'is-reduced': reducedMotion }">
        <div v-for="(line, i) in LYRIC_LINES" :key="line.text" class="showcase-line" :class="{ active: i === nowIndex }" :style="{ transform: `translateY(${(i - nowIndex) * 116 - sceneProgress * 26}px) scale(${i === nowIndex ? 1 : .82})`, opacity: i === nowIndex ? 1 : .25 }">
          <span v-for="(word, j) in [...line.text]" :key="`${i}-${j}`" :style="{ '--word-progress': `${Math.max(0, Math.min(1, nowTime / 4.4 - i + j / Math.max(1, line.text.length)))}` }">{{ word }}</span>
          <small>{{ line.translation }}</small>
        </div>
        <div class="background-lyrics">风从很远的地方来 · 把云层写成缓慢的海</div>
      </div>
      <p class="caption">每一个字，都在时间里</p>
    </section>

    <section class="scene scene-alignment" :style="{ opacity: alphaFor('alignment') }">
      <div class="alignment-stage" :class="`align-${alignment}`">
        <div class="alignment-line">把每一个字 都跟随音乐盛开</div>
        <div class="alignment-line secondary">让时间与声音保持同一方向</div>
        <div class="selection-pill">{{ alignment === 'center' ? '已选择歌词' : '✓ 已选择歌词' }}</div>
      </div>
      <div class="alignment-controls"><SegmentSlider :model-value="alignment === 'left' ? 0 : alignment === 'center' ? 1 : 2" :min="0" :max="2" :step="1" /></div>
      <p class="caption">对齐、选择，交给你的手势</p>
    </section>

    <section class="scene scene-styles" :style="{ opacity: alphaFor('styles') }">
      <div class="styles-copy"><span v-for="(style, i) in PLAYER_STYLES" :key="style.name" :class="{ current: i === Math.floor(sceneProgress * PLAYER_STYLES.length) }">{{ style.name }}</span></div>
      <div class="style-preview"><img :src="previewStyle.image" alt="播放器样式预览" /><div class="preview-sheen" /></div>
      <p class="caption">一首歌，五种现场</p>
    </section>

    <section class="scene scene-slider" :style="{ opacity: alphaFor('slider') }">
      <div class="demo-slider"><span>更轻量</span><div class="track"><i v-for="n in 5" :key="n" class="dot" :style="{ left: `${(n - 1) * 25}%` }" /><b :style="{ left: `${Math.min(100, sceneProgress * 125)}%` }" /></div><span>更智能</span></div>
      <p class="caption">智能过渡，跟着音乐吸附</p>
    </section>

    <section class="scene scene-playbar" :style="{ opacity: alphaFor('playbar') }">
      <div class="mini-bar"><img :src="song.cover" alt="" /><span>{{ song.title }} · {{ song.artist }}</span><strong>▶</strong><i>☰</i></div>
      <div class="full-player-hint"><img :src="SONGS[(Math.floor(beat / 4) + 1) % SONGS.length].cover" alt="" /><img :src="song.cover" alt="" /></div>
      <div class="transition-label">智能过渡中 <em>•••</em></div>
      <div class="progress-line"><i :style="{ width: `${localProgress * 100}%`, background: `linear-gradient(90deg, ${song.primaryColor}, #ffffff)` }" /></div>
      <p class="caption">让下一首歌，自然抵达</p>
    </section>

    <section class="scene scene-poster" :style="{ opacity: alphaFor('poster') }">
      <div class="poster-source"><div v-for="(line, i) in LYRIC_LINES.slice(0, 4)" :key="line.text" :class="{ picked: i < 2 }">{{ line.text }}</div></div>
      <div class="poster-card"><div class="poster-title">把歌词，留成一张海报</div><div v-for="line in LYRIC_LINES.slice(0, 3)" :key="line.text">{{ line.text }}</div><small>Zephyrus Player · AMLL</small></div>
    </section>

    <section class="scene scene-brand" :style="{ opacity: alphaFor('brand') }">
      <img class="brand-logo" src="/logo.png" alt="Zephyrus Player" />
      <h1>Zephyrus Player</h1>
      <p>github.com/cang-dot/zephyrus-player</p>
    </section>
  </main>
</template>
