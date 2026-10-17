<template>
  <div class="lyric-immersive-header" :style="containerStyle">
    <img
      v-if="showCover && coverUrl"
      class="lih-cover"
      :src="coverUrl"
      alt=""
      :style="coverStyle"
    />
    <div v-if="showInfo" class="lih-copy" :style="copyStyle">
      <strong class="lih-title">{{ title }}</strong>
      <span class="lih-artist">{{ artistText }}</span>
    </div>
    <div class="lih-actions" :style="actionsStyle">
      <button
        type="button"
        class="lih-action"
        :class="{ active: isFavorite }"
        aria-label="收藏歌曲"
        @click.stop="handleFavorite"
      >
        <i :class="isFavorite ? 'ri-heart-3-fill' : 'ri-heart-3-line'"></i>
      </button>
      <button
        type="button"
        class="lih-action"
        :aria-label="settingsActive ? '返回歌词' : '播放设置'"
        @click.stop="emit('showSettings')"
      >
        <i :class="settingsActive ? 'ri-close-line' : 'ri-more-2-fill'"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 沉浸歌词页顶部栏（Apple Music 式）：小封面 + 歌名/作者 + 收藏/更多圆钮。
 * 入场完全由 progress 驱动（跟手/弹簧共用同一进度）：
 * - morph：克隆飞行负责位移，本栏文本按进度后半段交叉淡入，封面在克隆落位时接管；
 * - top-in：整栏自顶向下滑入（translateY -100% → 0）；
 * - rise：随歌词覆盖层一起淡入，按钮仍自右划入。
 */
import { computed } from 'vue';

import { artistList, playMusic } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';

const props = withDefaults(
  defineProps<{
    coverUrl?: string;
    title?: string;
    /** 逐项尊重「显示封面 / 歌名作者」开关；两者都关时仅剩右侧按钮行（降级形态） */
    showCover?: boolean;
    showInfo?: boolean;
    progress?: number;
    entrance?: 'morph' | 'top-in' | 'rise';
    /** 内容区已被设置面板替换：更多按钮切换为关闭型图标 */
    settingsActive?: boolean;
  }>(),
  {
    coverUrl: '',
    title: '',
    showCover: true,
    showInfo: true,
    progress: 1,
    entrance: 'morph',
    settingsActive: false
  }
);

const emit = defineEmits<{ showSettings: [] }>();

const playerStore = usePlayerStore();

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / Math.max(1e-4, edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const p = computed(() => clamp01(props.progress));

const artistText = computed(() => artistList.value.map((artist) => artist.name).join(' / '));
const isFavorite = computed(() =>
  playerStore.favoriteList.some((id) => String(id) === String(playMusic.value?.id))
);

function handleFavorite() {
  const id = playMusic.value?.id;
  if (id === undefined || id === null) return;
  if (isFavorite.value) playerStore.removeFromFavorite(id);
  else playerStore.addToFavorite(id);
}

const containerStyle = computed(() => {
  // 注意：本体必须可命中（顶栏是下拖关闭的把手）；按钮的排除由手势侧
  // closest('button') 承担，拖拽从封面/歌名区发起
  const base = {
    transition: 'none',
    willChange: 'transform, opacity'
  } as Record<string, string>;
  if (props.entrance === 'top-in') {
    return { ...base, transform: `translate3d(0, ${((p.value - 1) * 100).toFixed(3)}%, 0)` };
  }
  const opacity = props.entrance === 'rise' ? p.value : smoothstep(0.45, 0.95, p.value);
  return { ...base, opacity: opacity.toFixed(3) };
});

const coverStyle = computed(() => {
  if (props.entrance !== 'morph') return undefined;
  // 克隆飞行落位后交接：落位前由克隆呈现，避免同一张封面出现两份
  return { opacity: smoothstep(0.88, 1, p.value).toFixed(3), transition: 'none' };
});

const copyStyle = computed(() => {
  if (props.entrance !== 'morph') return undefined;
  return { opacity: smoothstep(0.5, 0.9, p.value).toFixed(3), transition: 'none' };
});

const actionsStyle = computed(() => ({
  transform: `translate3d(${((1 - p.value) * 48).toFixed(2)}px, 0, 0)`,
  opacity: clamp01(p.value * 1.2).toFixed(3)
}));
</script>

<style scoped>
.lyric-immersive-header {
  /* 流内布局：由外层 immersive-header-wrap 的 padding-top 真正下推
     （此前 absolute+top:0 不受 padding 约束，顶栏会贴到屏幕顶与克隆落点分离） */
  position: relative;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 12px;
  /* 顶部安全区与关闭条留白由外层 immersive-header-wrap 负责，本组件只管一行 */
  padding: 0 20px;
  color: var(--player-ink, #fff);
  /* 下拖关闭把手：本体必须可命中（外层 wrap 是 pointer-events:none 穿透层），
     touch-action:none 防滚动意图接管竖直拖拽 */
  pointer-events: auto;
  touch-action: none;
}

.lih-cover {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
  flex: none;
  transform: translateZ(0);
}

.lih-copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.lih-title {
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lih-artist {
  overflow: hidden;
  font-size: 12px;
  line-height: 1.3;
  color: rgba(var(--player-ink-rgb, 255, 255, 255), 0.62);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lih-actions {
  display: flex;
  flex: none;
  gap: 10px;
  margin-left: auto;
  pointer-events: auto;
}

.lih-action {
  display: grid;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(var(--player-ink-rgb, 255, 255, 255), 0.14);
  color: var(--player-ink, #fff);
  font-size: 20px;
  place-items: center;
  /* 按下即反馈（apple-design §1） */
  transition: transform 100ms ease-out;
}

.lih-action:active {
  transform: scale(0.94);
}

.lih-action.active {
  color: var(--accent-color, var(--player-ink, #fff));
}

@media (prefers-reduced-motion: reduce) {
  .lyric-immersive-header,
  .lih-cover,
  .lih-copy,
  .lih-actions {
    transition: none;
  }
}
</style>
