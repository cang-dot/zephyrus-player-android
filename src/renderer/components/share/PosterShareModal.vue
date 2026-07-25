<template>
  <Teleport to="body">
    <Transition name="poster-modal">
      <div v-if="visible" class="poster-modal-overlay" @click.self="close">
        <!-- 主体 -->
        <div class="poster-modal-container">
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
              <button class="font-selector-btn" @click="showFontSelector = true">
                <span>{{ currentFontName }}</span>
                <i class="ri-arrow-right-s-line"></i>
              </button>
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
            <button class="action-btn save-btn" :disabled="generating" @click="handleSave">
              <i class="ri-save-line"></i>
              <span>保存</span>
            </button>
            <button class="action-btn share-btn" :disabled="generating" @click="handleShare">
              <i class="ri-share-line"></i>
              <span>分享</span>
            </button>
          </div>
        </div>

        <!-- 关闭按钮 -->
        <button class="poster-close-btn" @click="close">
          <i class="ri-close-line"></i>
        </button>
      </div>
    </Transition>

    <!-- 字体选择器 -->
    <font-selector
      v-if="showFontSelector"
      :selectedId="config.fontId"
      @select="onFontSelected"
      @close="showFontSelector = false"
    />

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
import { computed, ref, watch } from 'vue';

import logoUrl from '@/assets/logo.png';
import FontSelector from '@/components/share/FontSelector.vue';
import { artistList, playMusic } from '@/hooks/MusicHook';
import {
  BUILTIN_FONTS,
  DEFAULT_POSTER_CONFIG,
  type PosterConfig,
  type PosterLayout,
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

// 状态
const generating = ref(false);
const posterDataUrl = ref('');
const posterCanvas = ref<HTMLCanvasElement | null>(null);
const showFontSelector = ref(false);
const toastMessage = ref('');
const toastIcon = ref('ri-check-line');

// 配置
const config = ref<PosterConfig>({ ...DEFAULT_POSTER_CONFIG });

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
const layouts = [
  { key: 'torn-paper' as PosterLayout, label: '撕纸文艺', icon: 'ri-quill-pen-line' },
  { key: 'immersive' as PosterLayout, label: '沉浸全屏', icon: 'ri-image-line' }
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
  showFontSelector.value = false;
  regenerate();
}

function showToast(message: string, icon: string = 'ri-check-line') {
  toastMessage.value = message;
  toastIcon.value = icon;
  setTimeout(() => {
    toastMessage.value = '';
  }, 2500);
}

// 生成海报
let regenerateTimer: ReturnType<typeof setTimeout> | null = null;

async function regenerate() {
  if (props.lyrics.length === 0) return;
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
  if (!posterCanvas.value) return;
  showToast('正在保存...', 'ri-loader-4-line');
  const success = await saveCanvasToGallery(posterCanvas.value);
  showToast(
    success ? '已保存到相册' : '保存失败',
    success ? 'ri-check-line' : 'ri-error-warning-line'
  );
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
    if (v && props.lyrics.length > 0) {
      preloadLogo();
      regenerate();
    }
  }
);

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
</script>

<style scoped lang="scss">
.poster-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 99998;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.poster-modal-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  max-width: 500px;
  margin: 0 auto;
}

/* ===== 预览区域 ===== */
.poster-preview-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px 10px;
  overflow: hidden;
  position: relative;
}

.poster-preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
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
  max-height: 38vh;
  overflow-y: auto;
  padding: 12px 20px;
  background: rgba(20, 20, 25, 0.8);
  border-top: 1px solid rgba(255, 255, 255, 0.06);

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
  padding: 12px 20px calc(var(--safe-area-inset-bottom, 0px) + 16px);
  background: rgba(15, 15, 20, 0.9);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
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

.share-btn {
  background: linear-gradient(
    135deg,
    rgba(var(--accent-color-rgb, 99, 102, 241), 1),
    rgba(var(--accent-color-rgb, 99, 102, 241), 0.8)
  );
  color: #fff;
}

/* ===== 关闭按钮 ===== */
.poster-close-btn {
  position: fixed;
  top: calc(var(--safe-area-inset-top, 0px) + 16px);
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
  z-index: 99999;

  &:active {
    transform: scale(0.92);
  }
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
  transition: opacity 0.3s ease;
}

.poster-modal-enter-from,
.poster-modal-leave-to {
  opacity: 0;
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
