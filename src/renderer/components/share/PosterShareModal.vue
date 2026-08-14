<template>
  <Teleport to="body">
    <Transition name="poster-modal">
      <div
        v-if="visible"
        class="poster-modal-overlay"
        :style="posterTransitionStyle"
        @click.self="close"
      >
        <!-- 主体 -->
        <div class="poster-modal-container">
          <header class="poster-editor-header">
            <button type="button" class="poster-header-button" aria-label="关闭" @click="close">
              <i class="ri-close-line" />
            </button>
            <div class="poster-editor-title">
              <strong>歌词海报</strong>
              <span>{{ songInfo.songName }} · {{ props.lyrics.length }} 句</span>
            </div>
            <div class="poster-header-spacer" aria-hidden="true" />
          </header>
          <!-- 预览区域 -->
          <div class="poster-preview-area">
            <!-- 加载中 -->
            <div v-if="generating" class="poster-loading">
              <i class="ri-loader-4-line spin"></i>
              <span>正在生成海报...</span>
            </div>
            <!-- 海报预览 -->
            <img
              v-else-if="posterDataUrl"
              :src="posterDataUrl"
              class="poster-preview-img"
              alt="poster"
            />
            <!-- 错误 -->
            <div v-else class="poster-error">
              <i class="ri-error-warning-line"></i>
              <span>海报生成失败</span>
              <button @click="regenerate" class="retry-btn">重试</button>
            </div>
          </div>

          <!-- 配置面板 -->
          <div class="poster-config-panel">
            <!-- 布局选择 -->
            <div class="config-section">
              <div class="config-label">布局风格</div>
              <div class="layout-tabs">
                <button
                  v-for="layout in layouts"
                  :key="layout.key"
                  class="layout-tab"
                  :class="{ active: config.layout === layout.key }"
                  @click="setConfig('layout', layout.key)"
                >
                  <i :class="layout.icon"></i>
                  <span>{{ layout.label }}</span>
                </button>
              </div>
            </div>

            <!-- 字体选择 -->
            <div class="config-section">
              <div class="config-label">字体</div>
              <morphing-font-selector
                :selected-id="config.fontId"
                :label="currentFontName"
                @select="onFontSelected"
              />
            </div>

            <div class="config-section">
              <div class="config-label">
                字体粗细
                <span class="value-tag">{{ config.fontWeight }}</span>
              </div>
              <input
                v-model.number="config.fontWeight"
                type="range"
                min="100"
                max="900"
                step="50"
                @input="regenerateDebounced"
              />
            </div>

            <!-- 布局一专属配置 -->
            <template v-if="config.layout === 'torn-paper'">
              <!-- 封面位置 -->
              <div class="config-section">
                <div class="config-label">封面位置</div>
                <div class="segment-tabs">
                  <button
                    :class="{ active: config.coverPosition === 'left' }"
                    @click="setConfig('coverPosition', 'left')"
                  >
                    左图右文
                  </button>
                  <button
                    :class="{ active: config.coverPosition === 'right' }"
                    @click="setConfig('coverPosition', 'right')"
                  >
                    右图左文
                  </button>
                </div>
              </div>

              <!-- 歌词对齐 -->
              <div class="config-section">
                <div class="config-label">歌词对齐</div>
                <div class="segment-tabs">
                  <button
                    v-for="align in lyricAligns"
                    :key="align.key"
                    :class="{ active: config.lyricAlign === align.key }"
                    @click="setConfig('lyricAlign', align.key)"
                  >
                    {{ align.label }}
                  </button>
                </div>
              </div>

              <!-- 歌词颜色 -->
              <div class="config-section">
                <div class="config-label">歌词颜色</div>
                <div class="segment-tabs">
                  <button
                    :class="{ active: config.lyricColorMode === 'cover' }"
                    @click="setConfig('lyricColorMode', 'cover')"
                  >
                    跟随封面
                  </button>
                  <button
                    :class="{ active: config.lyricColorMode === 'custom' }"
                    @click="setConfig('lyricColorMode', 'custom')"
                  >
                    自定义
                  </button>
                </div>
                <div v-if="config.lyricColorMode === 'custom'" class="color-picker-row">
                  <input
                    type="color"
                    v-model="config.customLyricColor"
                    @input="regenerateDebounced"
                  />
                  <span class="color-value">{{ config.customLyricColor }}</span>
                </div>
              </div>

              <!-- 背景 -->
              <div class="config-section">
                <div class="config-label">背景</div>
                <div class="segment-tabs">
                  <button
                    v-for="bg in bgModes"
                    :key="bg.key"
                    :class="{ active: config.backgroundMode === bg.key }"
                    @click="setConfig('backgroundMode', bg.key)"
                  >
                    {{ bg.label }}
                  </button>
                </div>
                <div v-if="config.backgroundMode === 'solid'" class="color-picker-row">
                  <input type="color" v-model="config.solidBgColor" @input="regenerateDebounced" />
                  <span class="color-value">{{ config.solidBgColor }}</span>
                </div>
              </div>
            </template>

            <!-- 布局二专属配置 -->
            <template v-if="config.layout === 'immersive'">
              <!-- 背景模糊 -->
              <div class="config-section">
                <div class="config-label">
                  背景模糊度
                  <span class="value-tag">{{ config.blurAmount }}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  v-model.number="config.blurAmount"
                  @input="regenerateDebounced"
                  class="range-input"
                />
              </div>

              <!-- 遮罩透明度 -->
              <div class="config-section">
                <div class="config-label">
                  遮罩透明度
                  <span class="value-tag">{{ config.overlayOpacity }}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="5"
                  v-model.number="config.overlayOpacity"
                  @input="regenerateDebounced"
                  class="range-input"
                />
              </div>

              <!-- 文字颜色 -->
              <div class="config-section">
                <div class="config-label">文字颜色</div>
                <div class="color-picker-row">
                  <input type="color" v-model="config.textColor" @input="regenerateDebounced" />
                  <span class="color-value">{{ config.textColor }}</span>
                </div>
              </div>

              <!-- 歌手名位置 -->
              <div class="config-section">
                <div class="config-label">歌手名位置</div>
                <div class="segment-tabs">
                  <button
                    :class="{ active: config.artistPosition === 'right' }"
                    @click="setConfig('artistPosition', 'right')"
                  >
                    右对齐
                  </button>
                  <button
                    :class="{ active: config.artistPosition === 'center' }"
                    @click="setConfig('artistPosition', 'center')"
                  >
                    居中
                  </button>
                </div>
              </div>
            </template>

            <template
              v-if="config.layout === 'performance-archive' || config.layout === 'seal-tour'"
            >
              <div class="config-section">
                <div class="config-label">强调色</div>
                <div class="segment-tabs">
                  <button
                    :class="{ active: config.accentColorMode === 'cover' }"
                    @click="setConfig('accentColorMode', 'cover')"
                  >
                    跟随歌曲主色
                  </button>
                  <button
                    :class="{ active: config.accentColorMode === 'custom' }"
                    @click="setConfig('accentColorMode', 'custom')"
                  >
                    自定义
                  </button>
                </div>
                <div v-if="config.accentColorMode === 'custom'" class="color-picker-row">
                  <input v-model="config.accentColor" type="color" @input="regenerateDebounced" />
                  <span class="color-value">{{ config.accentColor }}</span>
                </div>
              </div>

              <div class="config-section">
                <div class="config-label">图像滤镜</div>
                <div class="segment-tabs">
                  <button
                    v-for="filter in imageFilters"
                    :key="filter.key"
                    :class="{ active: config.imageFilter === filter.key }"
                    @click="setConfig('imageFilter', filter.key)"
                  >
                    {{ filter.label }}
                  </button>
                </div>
              </div>

              <div v-if="config.layout === 'performance-archive'" class="config-section">
                <div class="config-label">标题排版</div>
                <div class="segment-tabs">
                  <button
                    v-for="orientation in titleOrientations"
                    :key="orientation.key"
                    :class="{ active: config.titleOrientation === orientation.key }"
                    @click="setConfig('titleOrientation', orientation.key)"
                  >
                    {{ orientation.label }}
                  </button>
                </div>
              </div>

              <div class="config-section archive-fields">
                <label>
                  <span>附加信息</span>
                  <input v-model="config.eventLabel" type="text" @input="regenerateDebounced" />
                </label>
              </div>
            </template>

            <!-- 二维码开关 -->
            <div class="config-section">
              <div class="config-label">显示二维码</div>
              <button
                class="toggle-switch"
                :class="{ on: config.showQRCode }"
                @click="setConfig('showQRCode', !config.showQRCode)"
              >
                <span class="toggle-knob"></span>
              </button>
            </div>

            <!-- 水印设置 -->
            <div class="config-section">
              <div class="config-label">左下角水印</div>
              <div class="segment-tabs">
                <button
                  :class="{ active: config.watermarkType === 'text' }"
                  @click="setConfig('watermarkType', 'text')"
                >
                  软件名
                </button>
                <button
                  :class="{ active: config.watermarkType === 'logo' }"
                  @click="setConfig('watermarkType', 'logo')"
                >
                  Logo
                </button>
              </div>
            </div>

            <!-- 水印透明度 -->
            <div class="config-section">
              <div class="config-label">
                水印透明度
                <span class="value-tag">{{ config.watermarkOpacity }}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                v-model.number="config.watermarkOpacity"
                @input="regenerateDebounced"
                class="range-input"
              />
            </div>
          </div>

          <!-- 底部操作栏 -->
          <div class="poster-action-bar">
            <button
              class="action-btn save-btn"
              :class="{ 'is-saved': saveState === 'saved' }"
              :disabled="generating || saveState === 'saving'"
              @click="handleSave"
            >
              <i
                :class="
                  saveState === 'saving'
                    ? 'ri-loader-4-line spin'
                    : saveState === 'saved'
                      ? 'ri-check-line'
                      : 'ri-save-line'
                "
              ></i>
              <span>{{
                saveState === 'saving' ? '保存中' : saveState === 'saved' ? '已保存' : '保存'
              }}</span>
            </button>
            <button class="action-btn share-btn" :disabled="generating" @click="handleShare">
              <i class="ri-share-line"></i>
              <span>分享</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Toast 提示 -->
    <Transition name="toast">
      <div v-if="toastMessage" class="poster-toast">
        <i :class="toastIcon"></i>
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import logoUrl from '@/assets/logo.png';
import MorphingFontSelector from '@/components/share/MorphingFontSelector.vue';
import { usePosterTransitionOrigin } from '@/composables/usePosterTransitionOrigin';
import { artistList, playMusic } from '@/hooks/MusicHook';
import {
  BUILTIN_FONTS,
  DEFAULT_POSTER_CONFIG,
  normalizePosterConfig,
  POSTER_LAYOUT_OPTIONS,
  type PosterConfig,
  type SelectedLyric
} from '@/types/share';
import { getImgUrl } from '@/utils';
import { ensureFontLoaded } from '@/utils/fontLoader';
import { canvasToDataURL, generatePoster } from '@/utils/posterEngine';
import { saveCanvasToGallery, shareCanvasImage } from '@/utils/shareUtil';

// Props
const props = defineProps<{
  visible: boolean;
  lyrics: SelectedLyric[];
}>();

// Emits
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
}>();
const posterTransitionOrigin = usePosterTransitionOrigin();
const POSTER_CONFIG_STORAGE_KEY = 'zephyrus-poster-config';

// 状态
const generating = ref(false);
const posterDataUrl = ref('');
const posterCanvas = ref<HTMLCanvasElement | null>(null);
const toastMessage = ref('');
const toastIcon = ref('ri-check-line');
const saveState = ref<'idle' | 'saving' | 'saved'>('idle');
let saveStateTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

// 配置
const readPosterConfig = (): PosterConfig => {
  try {
    const saved = localStorage.getItem(POSTER_CONFIG_STORAGE_KEY);
    const posterConfig = saved ? JSON.parse(saved) : {};
    const lyricConfig = JSON.parse(localStorage.getItem('music-full-config') || '{}');
    return normalizePosterConfig({
      ...posterConfig,
      layout: posterConfig.layout || lyricConfig.shareDefaultPosterLayout
    });
  } catch {
    return normalizePosterConfig(DEFAULT_POSTER_CONFIG);
  }
};
const config = ref<PosterConfig>(readPosterConfig());
const posterTransitionStyle = computed(() => {
  const source = posterTransitionOrigin.origin.value;
  const coverStyle = songInfo.value.coverUrl
    ? { '--poster-cover-image': `url("${songInfo.value.coverUrl}")` }
    : {};
  if (!source) return coverStyle;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const targetWidth = Math.min(viewportWidth, 560);
  return {
    ...coverStyle,
    '--poster-origin-x': `${source.left + source.width / 2 - viewportWidth / 2}px`,
    '--poster-origin-y': `${source.top + source.height / 2 - viewportHeight / 2}px`,
    '--poster-origin-scale': String(Math.max(0.12, Math.min(0.62, source.width / targetWidth)))
  };
});

// 预加载 App Logo 图片，供海报水印使用
let logoLoaded = false;
function preloadLogo() {
  if (logoLoaded || (window as any).__zephyrusLogoImg) return;
  const img = new Image();
  img.onload = () => {
    (window as any).__zephyrusLogoImg = img;
    logoLoaded = true;
  };
  img.src = logoUrl;
}

// 布局选项
const layouts = POSTER_LAYOUT_OPTIONS;

const imageFilters = [
  { key: 'monochrome' as const, label: '黑白' },
  { key: 'low-saturation' as const, label: '低饱和' },
  { key: 'high-contrast' as const, label: '高对比' }
];

const titleOrientations = [
  { key: 'horizontal' as const, label: '横向' },
  { key: 'vertical' as const, label: '竖向' },
  { key: 'staggered' as const, label: '错位' }
];

const lyricAligns = [
  { key: 'staggered' as const, label: '错落' },
  { key: 'center' as const, label: '居中' },
  { key: 'left' as const, label: '左对齐' },
  { key: 'right' as const, label: '右对齐' }
];

const bgModes = [
  { key: 'cover' as const, label: '跟随封面' },
  { key: 'solid' as const, label: '纯色' },
  { key: 'gradient' as const, label: '渐变' }
];

// 计算属性
const currentFontName = computed(() => {
  const font = BUILTIN_FONTS.find((f) => f.id === config.value.fontId);
  return font?.name || '默认字体';
});

// 歌曲信息
const songInfo = computed(() => {
  const song = playMusic.value;
  const artists = (artistList.value || []).map((a: any) => a.name).join(' / ');
  return {
    songId: song?.id || '',
    songName: song?.name || '未知歌曲',
    artists: artists || '未知歌手',
    coverUrl: song?.picUrl ? getImgUrl(song.picUrl, '500y500') : ''
  };
});

// 方法
function close() {
  emit('update:visible', false);
}

function setConfig(key: keyof PosterConfig, value: any) {
  (config.value as any)[key] = value;
  regenerateDebounced();
}

function onFontSelected(fontId: string) {
  config.value.fontId = fontId;
  regenerate();
}

function showToast(message: string, icon: string = 'ri-check-line') {
  if (toastTimer) clearTimeout(toastTimer);
  toastMessage.value = message;
  toastIcon.value = icon;
  toastTimer = setTimeout(() => {
    toastMessage.value = '';
  }, 2500);
}

// 生成海报
let regenerateTimer: ReturnType<typeof setTimeout> | null = null;

async function regenerate() {
  if (props.lyrics.length === 0) return;
  if (saveStateTimer) clearTimeout(saveStateTimer);
  saveState.value = 'idle';
  generating.value = true;
  posterDataUrl.value = '';

  try {
    // 确保字体已加载
    await ensureFontLoaded(config.value.fontId);

    // 生成海报
    const canvas = await generatePoster(config.value, songInfo.value, props.lyrics);
    posterCanvas.value = canvas;
    posterDataUrl.value = canvasToDataURL(canvas);
  } catch (e) {
    console.error('[PosterShareModal] 海报生成失败:', e);
    showToast('海报生成失败', 'ri-error-warning-line');
  } finally {
    generating.value = false;
  }
}

function regenerateDebounced() {
  if (regenerateTimer) clearTimeout(regenerateTimer);
  regenerateTimer = setTimeout(() => regenerate(), 300);
}

// 保存
async function handleSave() {
  if (!posterCanvas.value || saveState.value === 'saving') return;
  saveState.value = 'saving';
  showToast('正在保存...', 'ri-loader-4-line');
  try {
    const success = await saveCanvasToGallery(posterCanvas.value);
    saveState.value = success ? 'saved' : 'idle';
    showToast(
      success ? '已保存到相册' : '保存失败',
      success ? 'ri-check-line' : 'ri-error-warning-line'
    );
    if (success) {
      if (saveStateTimer) clearTimeout(saveStateTimer);
      saveStateTimer = setTimeout(() => {
        saveState.value = 'idle';
      }, 3000);
    }
  } catch (error) {
    console.error('[PosterShareModal] 保存失败:', error);
    saveState.value = 'idle';
    showToast('保存失败', 'ri-error-warning-line');
  }
}

// 分享
async function handleShare() {
  if (!posterCanvas.value) return;
  showToast('正在准备分享...', 'ri-loader-4-line');
  const success = await shareCanvasImage(posterCanvas.value);
  if (!success) {
    showToast('分享失败', 'ri-error-warning-line');
  }
}

// 监听可见性变化
watch(
  () => props.visible,
  (v) => {
    document.documentElement.classList.toggle('poster-editor-open', v);
    if (v && props.lyrics.length > 0) {
      preloadLogo();
      regenerate();
    } else if (!v) {
      saveState.value = 'idle';
      window.setTimeout(() => posterTransitionOrigin.clear(), 460);
    }
  }
);

watch(config, (value) => localStorage.setItem(POSTER_CONFIG_STORAGE_KEY, JSON.stringify(value)), {
  deep: true
});

// 监听歌词变化
watch(
  () => props.lyrics,
  (newLyrics) => {
    if (props.visible && newLyrics.length > 0) {
      regenerate();
    }
  },
  { deep: true }
);

onBeforeUnmount(() => {
  if (saveStateTimer) clearTimeout(saveStateTimer);
  if (toastTimer) clearTimeout(toastTimer);
  document.documentElement.classList.remove('poster-editor-open');
  if (regenerateTimer) clearTimeout(regenerateTimer);
});
</script>

<style scoped lang="scss">
.poster-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100300;
  background: #101112;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.poster-modal-overlay::before {
  position: absolute;
  inset: -42px;
  background:
    linear-gradient(rgba(10, 11, 12, 0.7), rgba(10, 11, 12, 0.88)),
    var(--poster-cover-image) center / cover no-repeat;
  content: '';
  filter: blur(30px) saturate(72%);
  transform: scale(1.08);
}

.poster-modal-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  max-width: 560px;
  margin: 0 auto;
  overflow: hidden;
  background: rgba(15, 16, 17, 0.74);
  transform-origin: center;
  will-change: transform, opacity, clip-path;
  z-index: 1;
}

.poster-editor-header {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: 42px minmax(0, 1fr) 42px;
  align-items: center;
  gap: 10px;
  padding: calc(var(--safe-area-inset-top, 0px) + 10px) 16px 10px;
}

.poster-header-button,
.poster-header-spacer {
  width: 42px;
  height: 42px;
}

.poster-header-button {
  display: grid;
  padding: 0;
  place-items: center;
  border: 1px solid color-mix(in srgb, #fff 18%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent-color, #777) 12%, transparent);
  color: rgba(255, 255, 255, 0.92);
  font-size: 22px;
}

.poster-editor-title {
  display: grid;
  min-width: 0;
  justify-items: center;
  line-height: 1.2;
}

.poster-editor-title strong {
  color: rgba(255, 255, 255, 0.94);
  font-size: 16px;
  font-weight: 700;
}

.poster-editor-title span {
  width: 100%;
  margin-top: 4px;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.52);
  font-size: 11px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 预览区域 ===== */
.poster-preview-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 8px 18px 12px;
  overflow: hidden;
  position: relative;
}

.poster-preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 10px;
  box-shadow: 0 14px 42px color-mix(in srgb, var(--accent-color, #777) 12%, rgba(0, 0, 0, 0.5));
}

.poster-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.6);

  .spin {
    font-size: 32px;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.poster-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.5);

  i {
    font-size: 36px;
  }

  .retry-btn {
    padding: 8px 20px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 14px;
  }
}

/* ===== 配置面板 ===== */
.poster-config-panel {
  flex-shrink: 0;
  max-height: min(40dvh, 390px);
  overflow-y: auto;
  margin: 0 14px;
  padding: 10px 16px 14px;
  border: 1px solid color-mix(in srgb, #fff 14%, transparent);
  border-radius: 24px;
  background: rgba(24, 25, 27, 0.72);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px) saturate(145%);
  -webkit-backdrop-filter: blur(16px) saturate(145%);

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
}

.config-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  gap: 12px;
  flex-wrap: wrap;
}

.config-label {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  gap: 6px;
}

.value-tag {
  font-size: 12px;
  color: rgba(var(--accent-color-rgb, 99, 102, 241), 1);
  background: rgba(var(--accent-color-rgb, 99, 102, 241), 0.12);
  padding: 1px 8px;
  border-radius: 8px;
}

/* ===== 布局 Tab ===== */
.layout-tabs {
  display: flex;
  gap: 8px;
}

.layout-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 12px;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
  transition: all 0.2s;

  &.active {
    background: rgba(var(--accent-color-rgb, 99, 102, 241), 0.2);
    color: #fff;
  }

  i {
    font-size: 16px;
  }
}

/* ===== 分段选择器 ===== */
.segment-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;

  button {
    padding: 6px 12px;
    border-radius: 10px;
    font-size: 12px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.55);
    transition: all 0.2s;

    &.active {
      background: rgba(var(--accent-color-rgb, 99, 102, 241), 0.2);
      color: #fff;
    }
  }
}

/* ===== 字体选择按钮 ===== */
.font-selector-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
}

/* ===== 颜色选择 ===== */
.color-picker-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;

  input[type='color'] {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    background: transparent;
    padding: 0;

    &::-webkit-color-swatch-wrapper {
      padding: 0;
    }
    &::-webkit-color-swatch {
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
    }
  }

  .color-value {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    font-family: monospace;
  }
}

.archive-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: 100%;

  label {
    display: grid;
    gap: 6px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 12px;
  }

  input {
    min-width: 0;
    height: 34px;
    padding: 0 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
  }
}

@media (max-width: 520px) {
  .archive-fields {
    grid-template-columns: 1fr;
  }
}

/* ===== 滑块 ===== */
.range-input {
  flex: 1;
  min-width: 100px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(var(--accent-color-rgb, 99, 102, 241), 1);
    cursor: pointer;
  }
}

/* ===== 开关 ===== */
.toggle-switch {
  width: 44px;
  height: 26px;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.1);
  position: relative;
  transition: background 0.3s;

  &.on {
    background: rgba(var(--accent-color-rgb, 99, 102, 241), 1);
  }

  .toggle-knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  &.on .toggle-knob {
    transform: translateX(18px);
  }
}

/* ===== 底部操作栏 ===== */
.poster-action-bar {
  flex-shrink: 0;
  display: flex;
  gap: 12px;
  padding: 12px 16px calc(var(--safe-area-inset-bottom, 0px) + 14px);
  background: transparent;
}

.action-btn {
  flex: 1;
  height: 48px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.4;
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }
}

.save-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.save-btn.is-saved {
  background: color-mix(in srgb, #36c979 34%, rgba(255, 255, 255, 0.12));
  color: #fff;
}

.share-btn {
  background: linear-gradient(
    135deg,
    rgba(var(--accent-color-rgb, 99, 102, 241), 1),
    rgba(var(--accent-color-rgb, 99, 102, 241), 0.8)
  );
  color: #fff;
}

/* ===== Toast ===== */
.poster-toast {
  position: fixed;
  bottom: calc(var(--safe-area-inset-bottom, 0px) + 100px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 24px;
  background: rgba(20, 20, 25, 0.95);
  backdrop-filter: blur(20px);
  color: #fff;
  font-size: 14px;
  z-index: 100000;
  white-space: nowrap;
}

/* ===== 过渡动画 ===== */
.poster-modal-enter-active,
.poster-modal-leave-active {
  transition: opacity 360ms ease;
}

.poster-modal-enter-active .poster-modal-container,
.poster-modal-leave-active .poster-modal-container {
  transition:
    transform 440ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 260ms ease,
    clip-path 440ms cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 440ms cubic-bezier(0.32, 0.72, 0, 1);
}

.poster-modal-enter-from,
.poster-modal-leave-to {
  opacity: 0;
}

.poster-modal-enter-from .poster-modal-container,
.poster-modal-leave-to .poster-modal-container {
  border-radius: 999px;
  opacity: 0.3;
  clip-path: inset(40% 8% 40% 8% round 999px);
  transform: translate3d(var(--poster-origin-x, 0), var(--poster-origin-y, 24vh), 0)
    scale(var(--poster-origin-scale, 0.34));
}

:global(.poster-editor-open .floating-topbar),
:global(.poster-editor-open .mobile-bottom-dock),
:global(.poster-editor-open .shared-player-bottom-layer) {
  opacity: 0 !important;
  pointer-events: none !important;
}

@media (prefers-reduced-motion: reduce) {
  .poster-modal-enter-active,
  .poster-modal-leave-active,
  .poster-modal-enter-active .poster-modal-container,
  .poster-modal-leave-active .poster-modal-container {
    transition-duration: 160ms;
  }

  .poster-modal-enter-from .poster-modal-container,
  .poster-modal-leave-to .poster-modal-container {
    clip-path: none;
    transform: none;
  }
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
