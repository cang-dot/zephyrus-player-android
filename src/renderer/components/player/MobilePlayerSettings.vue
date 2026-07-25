<template>
  <Teleport to="body">
    <Transition name="settings-drawer">
      <div
        v-if="visible"
        class="fixed inset-0 z-[99999] flex items-end justify-center"
        @click.self="close"
      >
        <!-- 遮罩层 -->
        <div class="absolute inset-0 bg-black/50" @click="close"></div>

        <!-- 弹窗内容 - 磨砂玻璃效果 -->
        <div
          class="relative w-full max-w-lg bg-gray-900/70 backdrop-blur-2xl rounded-t-3xl overflow-hidden max-h-[85vh] flex flex-col border-t border-white/10 shadow-2xl"
        >
          <!-- 顶部拖拽条 -->
          <div class="flex justify-center pt-3 pb-2 flex-shrink-0">
            <div class="w-10 h-1 rounded-full bg-white/30"></div>
          </div>

          <!-- 标题栏 -->
          <div class="flex items-center justify-between px-5 pb-4 flex-shrink-0">
            <h2 class="text-lg font-semibold text-white">
              {{ t('player.settings.title') }}
            </h2>
            <button
              @click="close"
              class="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:bg-white/10"
            >
              <i class="ri-close-line text-xl"></i>
            </button>
          </div>

          <!-- 内容区域 -->
          <div
            class="flex-1 overflow-y-auto px-5 pb-6"
            :style="{ paddingBottom: `calc(24px + var(--safe-area-inset-bottom, 0px))` }"
          >
            <!-- 播放器样式 2×2 网格 -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-white/80">
                  {{ t('player.settings.playerStyle') || '播放器样式' }}
                </span>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <button
                  v-for="style in playerStyles"
                  :key="style.key"
                  @click="setPlayerStyle(style.key)"
                  class="style-card relative flex flex-col items-center gap-2 rounded-2xl p-4 transition-all duration-300"
                  :class="
                    currentPlayerStyle === style.key
                      ? 'style-card-active'
                      : 'bg-white/5 hover:bg-white/10'
                  "
                >
                  <i :class="style.icon" class="text-2xl" :style="{ color: style.color }" />
                  <span
                    class="text-xs font-medium"
                    :class="currentPlayerStyle === style.key ? 'text-white' : 'text-white/60'"
                  >
                    {{ style.label }}
                  </span>
                </button>
              </div>
            </div>

            <!-- 自定义效果（非默认样式时显示） -->
            <div v-if="currentPlayerStyle !== 'default'" class="mb-6">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-white/80">自定义效果</span>
              </div>
              <div class="space-y-4 px-1">
                <!-- 通用：字体导入 -->
                <div class="flex items-center gap-3">
                  <button
                    @click="importFont"
                    class="px-3 py-2 rounded-full text-sm bg-white/10 text-white/70 hover:bg-white/15"
                  >
                    <i class="ri-font-line mr-1"></i>导入字体 (.ttf)
                  </button>
                  <span v-if="customFontName" class="text-xs text-white/50 truncate">{{
                    customFontName
                  }}</span>
                </div>

                <!-- Stage -->
                <template v-if="currentPlayerStyle === 'stage'">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-white/60">Aurora 速度</span>
                    <input
                      type="range"
                      min="0.4"
                      max="2"
                      step="0.1"
                      v-model.number="styleConfig.auroraSpeed"
                      class="w-32 accent-[var(--accent-color)]"
                    />
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-white/60">鼓点闪白强度</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      v-model.number="styleConfig.beatFlashIntensity"
                      class="w-32 accent-[var(--accent-color)]"
                    />
                  </div>
                </template>

                <!-- Eerie -->
                <template v-if="currentPlayerStyle === 'eerie'">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-white/60">报纸闪现频率(ms)</span>
                    <input
                      type="range"
                      min="200"
                      max="1000"
                      step="100"
                      v-model.number="styleConfig.newspaperFreq"
                      class="w-32 accent-[var(--accent-color)]"
                    />
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-white/60">关键词字号</span>
                    <input
                      type="range"
                      min="16"
                      max="48"
                      step="2"
                      v-model.number="styleConfig.keywordSize"
                      class="w-32 accent-[var(--accent-color)]"
                    />
                  </div>
                </template>

                <!-- Neon -->
                <template v-if="currentPlayerStyle === 'neon'">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-white/60">光晕半径</span>
                    <input
                      type="range"
                      min="4"
                      max="30"
                      step="2"
                      v-model.number="styleConfig.glowRadius"
                      class="w-32 accent-[var(--accent-color)]"
                    />
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-white/60">脉冲速度</span>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.1"
                      v-model.number="styleConfig.pulseSpeed"
                      class="w-32 accent-[var(--accent-color)]"
                    />
                  </div>
                </template>

                <!-- Frenzy -->
                <template v-if="currentPlayerStyle === 'frenzy'">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-white/60">巨字字号</span>
                    <input
                      type="range"
                      min="40"
                      max="120"
                      step="5"
                      v-model.number="styleConfig.giantSize"
                      class="w-32 accent-[var(--accent-color)]"
                    />
                  </div>
                </template>

                <!-- Magazine -->
                <template v-if="currentPlayerStyle === 'magazine'">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-white/60">翻页速度(ms)</span>
                    <input
                      type="range"
                      min="200"
                      max="800"
                      step="50"
                      v-model.number="styleConfig.flipSpeed"
                      class="w-32 accent-[var(--accent-color)]"
                    />
                  </div>
                </template>
              </div>
            </div>

            <!-- 分隔线 -->
            <div class="h-px bg-white/10 my-5"></div>

            <!-- 歌词设置 -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-white/80">
                  <i class="ri-translate-2 mr-1"></i>
                  歌词设置
                </span>
              </div>

              <!-- 显示翻译 -->
              <div class="flex items-center justify-between p-3 rounded-2xl bg-white/5 mb-2">
                <div>
                  <div class="text-sm text-white/80">显示翻译</div>
                  <div class="text-xs text-white/40 mt-1">在歌词下方显示翻译文本</div>
                </div>
                <button
                  class="share-toggle-switch"
                  :class="{ on: lyricConfig.showTranslation }"
                  @click="toggleShowTranslation"
                >
                  <span class="share-toggle-knob"></span>
                </button>
              </div>
            </div>

            <!-- 分隔线 -->
            <div class="h-px bg-white/10 my-5"></div>

            <!-- 播放速度 -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-white/80">
                  {{ t('player.settings.playbackSpeed') }}
                </span>
                <span class="text-sm text-[var(--accent-color-light)] font-medium"
                  >{{ playbackRate }}x</span
                >
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="option in speedOptions"
                  :key="option"
                  @click="setSpeed(option)"
                  class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
                  :class="
                    playbackRate === option
                      ? 'bg-[var(--accent-color)] text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/15'
                  "
                >
                  {{ option }}x
                </button>
              </div>
            </div>

            <!-- 分隔线 -->
            <div class="h-px bg-white/10 my-5"></div>

            <!-- 歌词解析 -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-white/80">
                  <i class="ri-quill-pen-line mr-1"></i>
                  歌词解析
                </span>
                <button
                  v-if="!metaphorLoading && !metaphorResult"
                  @click="analyzeLyrics"
                  class="px-3 py-1 rounded-full text-sm font-medium bg-[var(--accent-color)] text-white"
                >
                  开始分析
                </button>
                <button
                  v-if="metaphorResult || metaphorLoading"
                  @click="analyzeLyrics"
                  :disabled="metaphorLoading"
                  class="px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white/70 hover:bg-white/15 disabled:opacity-50"
                >
                  {{ metaphorLoading ? '分析中...' : '重新分析' }}
                </button>
              </div>

              <!-- 加载中 -->
              <div
                v-if="metaphorLoading"
                class="flex flex-col items-center justify-center py-8 text-white/50"
              >
                <i class="ri-loader-4-line animate-spin text-3xl mb-3"></i>
                <p class="text-sm">正在分析歌词...</p>
                <p class="text-xs opacity-60 mt-1">AI 分析可能需要 10-30 秒</p>
              </div>

              <!-- 错误 -->
              <div
                v-else-if="metaphorError"
                class="flex flex-col items-center justify-center py-8 text-white/50 text-center"
              >
                <i class="ri-error-warning-line text-3xl mb-3 text-red-400"></i>
                <p class="text-sm max-w-xs">{{ metaphorError }}</p>
                <button
                  @click="analyzeLyrics"
                  class="mt-3 px-3 py-1 rounded-full text-sm bg-white/10 text-white/70 hover:bg-white/15"
                >
                  重试
                </button>
              </div>

              <!-- 结果 -->
              <div
                v-else-if="metaphorResult"
                class="metaphor-result prose prose-invert max-w-none text-sm leading-relaxed text-white/80"
                v-html="sanitizedMetaphorResult"
              ></div>

              <!-- 空状态 -->
              <div v-else class="flex flex-col items-center justify-center py-6 text-white/40">
                <i class="ri-quill-pen-line text-4xl mb-2"></i>
                <p class="text-sm">分析当前歌词的隐喻和修辞手法</p>
              </div>

              <!-- 缓存标记 -->
              <div
                v-if="metaphorCached"
                class="flex items-center justify-center mt-3 text-xs text-white/30"
              >
                <i class="ri-database-2-line mr-1"></i> 缓存结果
              </div>
            </div>

            <!-- 分隔线 -->
            <div class="h-px bg-white/10 my-5"></div>

            <!-- 分享功能 -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-white/80">
                  <i class="ri-share-line mr-1"></i>
                  分享功能
                </span>
              </div>

              <!-- 截图自动添加二维码 -->
              <div class="flex items-center justify-between p-3 rounded-2xl bg-white/5 mb-2">
                <div>
                  <div class="text-sm text-white/80">截图自动添加二维码</div>
                  <div class="text-xs text-white/40 mt-1">截图后自动叠加歌曲深链二维码</div>
                </div>
                <button
                  class="share-toggle-switch"
                  :class="{ on: lyricConfig.shareScreenshotQRCode }"
                  @click="toggleShareScreenshotQRCode"
                >
                  <span class="share-toggle-knob"></span>
                </button>
              </div>

              <!-- 默认海报布局 -->
              <div class="p-3 rounded-2xl bg-white/5 mb-2">
                <div class="text-sm text-white/80 mb-2">默认海报布局</div>
                <div class="flex gap-2">
                  <button
                    v-for="layout in posterLayouts"
                    :key="layout.key"
                    @click="setShareDefaultLayout(layout.key)"
                    class="px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                    :class="
                      lyricConfig.shareDefaultPosterLayout === layout.key
                        ? 'bg-[var(--accent-color)] text-white'
                        : 'bg-white/10 text-white/60'
                    "
                  >
                    <i :class="layout.icon" class="mr-1"></i>
                    {{ layout.label }}
                  </button>
                </div>
              </div>

              <!-- 长按歌词提示 -->
              <div class="p-3 rounded-2xl bg-white/5">
                <div class="flex items-center gap-2 text-xs text-white/50">
                  <i class="ri-information-line"></i>
                  <span>在歌词页面长按歌词可进入多选模式，生成精美海报</span>
                </div>
              </div>
            </div>

            <!-- 分隔线 -->
            <div class="h-px bg-white/10 my-5"></div>

            <!-- 定时关闭 -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-white/80">
                  {{ t('player.sleepTimer.title') }}
                </span>
                <span
                  v-if="hasTimerActive"
                  class="text-sm text-[var(--accent-color-light)] font-medium"
                >
                  {{ timerStatusText }}
                </span>
              </div>

              <!-- 已激活状态 -->
              <div v-if="hasTimerActive" class="space-y-3">
                <div
                  class="p-4 rounded-2xl bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/30"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <i class="ri-timer-line text-[var(--accent-color-light)] text-xl"></i>
                      <span class="text-[var(--accent-color-light)]">
                        {{ timerDisplayText }}
                      </span>
                    </div>
                    <button
                      @click="cancelTimer"
                      class="px-3 py-1 rounded-full text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    >
                      {{ t('player.sleepTimer.cancel') }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- 未激活状态 - 设置选项 -->
              <div v-else class="space-y-4">
                <!-- 按时间 -->
                <div>
                  <p class="text-xs text-white/50 mb-2">
                    {{ t('player.sleepTimer.timeMode') }}
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="minutes in [15, 30, 60, 90]"
                      :key="minutes"
                      @click="setTimeTimer(minutes)"
                      class="px-4 py-2 rounded-full text-sm font-medium bg-white/10 text-white/70 hover:bg-white/15"
                    >
                      {{ minutes }}{{ t('player.sleepTimer.minutes') }}
                    </button>
                  </div>
                  <!-- 自定义时间 -->
                  <div class="flex items-center gap-2 mt-3">
                    <div class="flex items-center flex-1 bg-white/10 rounded-full overflow-hidden">
                      <button
                        @click="decreaseMinutes"
                        class="w-10 h-10 flex items-center justify-center text-white/70 hover:bg-white/10 active:bg-white/20"
                      >
                        <i class="ri-subtract-line text-lg"></i>
                      </button>
                      <input
                        v-model="customMinutes"
                        type="text"
                        inputmode="numeric"
                        pattern="[0-9]*"
                        placeholder="分钟"
                        class="flex-1 px-2 py-2 text-sm text-center bg-transparent text-white/80 border-0 outline-none placeholder-white/40"
                        @input="handleMinutesInput"
                      />
                      <button
                        @click="increaseMinutes"
                        class="w-10 h-10 flex items-center justify-center text-white/70 hover:bg-white/10 active:bg-white/20"
                      >
                        <i class="ri-add-line text-lg"></i>
                      </button>
                    </div>
                    <button
                      @click="setCustomTimeTimer"
                      :disabled="!customMinutes || Number(customMinutes) < 1"
                      class="px-4 py-2 rounded-full text-sm font-medium bg-[var(--accent-color)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {{ t('player.sleepTimer.set') }}
                    </button>
                  </div>
                </div>

                <!-- 按歌曲数 -->
                <div>
                  <p class="text-xs text-white/50 mb-2">
                    {{ t('player.sleepTimer.songsMode') }}
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="songs in [1, 3, 5, 10]"
                      :key="songs"
                      @click="setSongsTimer(songs)"
                      class="px-4 py-2 rounded-full text-sm font-medium bg-white/10 text-white/70 hover:bg-white/15"
                    >
                      {{ songs }}{{ t('player.sleepTimer.songs') }}
                    </button>
                  </div>
                </div>

                <!-- 播放列表结束 -->
                <button
                  @click="setPlaylistEndTimer"
                  class="w-full py-3 rounded-2xl text-sm font-medium bg-white/10 text-white/70 hover:bg-white/15"
                >
                  {{ t('player.sleepTimer.playlistEnd') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useMetaphor } from '@/features/lyric-metaphor/useMetaphor';
import { lrcArray, playMusic } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';
import type { LyricConfig } from '@/types/lyric';
import { DEFAULT_LYRIC_CONFIG } from '@/types/lyric';

const { t } = useI18n();
const playerStore = usePlayerStore();

// 安全的 i18n 翻译：当 vue-i18n 找不到键时返回键路径本身（而非空字符串），
// 因此 `t(key) || fallback` 会因键路径为真值而失效。这里显式比对返回值。
const tr = (key: string, fallback: string) => {
  const v = t(key);
  return v === key ? fallback : v;
};
const { sleepTimer, playbackRate } = storeToRefs(playerStore);

// 歌词解析
const {
  loading: metaphorLoading,
  error: metaphorError,
  result: metaphorResult,
  cached: metaphorCached,
  analyze: metaphorAnalyze,
  clear: metaphorClear
} = useMetaphor();

const sanitizedMetaphorResult = computed(() => {
  if (!metaphorResult.value) return '';
  try {
    const tokens = marked.lexer(metaphorResult.value);
    const html = marked.parser(tokens);
    return DOMPurify.sanitize(html);
  } catch {
    return metaphorResult.value;
  }
});

const analyzeLyrics = async () => {
  const lyrics =
    lrcArray.value
      ?.map((l) => l.text)
      .filter((t) => t)
      .join('\n') || '';
  if (!lyrics) return;
  const song = playMusic.value;
  if (!song) return;
  const songName = song.name || '';
  const artist = song.ar?.map((a: any) => a.name).join(',') || '';
  let albumDesc = '';
  if (song.al?.id) {
    try {
      const { getAlbum } = await import('@/api/list');
      const res = await getAlbum(song.al.id);
      albumDesc = res?.data?.album?.description || '';
    } catch {
      // 忽略专辑描述获取失败
    }
  }
  await metaphorAnalyze(lyrics, songName, artist, albumDesc);
};

// 播放器样式配置
const lyricConfig = ref<LyricConfig>({ ...DEFAULT_LYRIC_CONFIG });

const playerStyles = computed(() => [
  {
    key: 'default',
    label: tr('player.styles.default', '默认'),
    icon: 'ri-music-2-line',
    color: '#6366f1'
  },
  {
    key: 'stage',
    label: tr('player.styles.stage', '舞台'),
    icon: 'ri-spotify-line',
    color: '#ec4899'
  },
  {
    key: 'magazine',
    label: tr('player.styles.magazine', '杂志'),
    icon: 'ri-layout-grid-line',
    color: '#f59e0b'
  },
  {
    key: 'frenzy',
    label: tr('player.styles.frenzy', '狂热'),
    icon: 'ri-fire-line',
    color: '#ef4444'
  },
  {
    key: 'eerie',
    label: tr('player.styles.eerie', '诡谲'),
    icon: 'ri-ghost-line',
    color: '#8b5cf6'
  },
  {
    key: 'neon',
    label: tr('player.styles.neon', '陈旧'),
    icon: 'ri-lightbulb-flash-line',
    color: '#c9a96e'
  },
  {
    key: 'rain',
    label: tr('player.styles.rain', '雨夜'),
    icon: 'ri-rainy-line',
    color: '#3b82f6'
  }
]);

const currentPlayerStyle = computed(() => lyricConfig.value.playerStyle || 'default');

const setPlayerStyle = (style: string) => {
  lyricConfig.value.playerStyle = style as LyricConfig['playerStyle'];
  localStorage.setItem('music-full-config', JSON.stringify(lyricConfig.value));
  window.dispatchEvent(new CustomEvent('music-full-config-updated'));
};

// ==================== 自定义效果配置 ====================
const styleConfigDefaults: Record<string, any> = {
  stage: { auroraSpeed: 0.8, beatFlashIntensity: 0.5 },
  eerie: { newspaperFreq: 500, keywordSize: 32 },
  neon: { glowRadius: 12, pulseSpeed: 1.5 },
  frenzy: { giantSize: 80 },
  magazine: { flipSpeed: 400 }
};

const styleConfig = ref<any>({});
const customFontName = ref('');

function loadStyleConfig() {
  try {
    const saved = localStorage.getItem('music-full-config');
    if (!saved) return;
    const config = JSON.parse(saved);
    const allConfigs = config.styleCustomConfig || {};
    const styleKey = config.playerStyle || 'default';
    styleConfig.value = { ...styleConfigDefaults[styleKey], ...allConfigs[styleKey] };
    customFontName.value = allConfigs[styleKey]?.customFontName || '';
  } catch {
    // 忽略配置读取失败
  }
}

function saveStyleConfig() {
  try {
    const saved = localStorage.getItem('music-full-config');
    if (!saved) return;
    const config = JSON.parse(saved);
    if (!config.styleCustomConfig) config.styleCustomConfig = {};
    config.styleCustomConfig[config.playerStyle] = {
      ...styleConfig.value,
      customFontName: customFontName.value
    };
    localStorage.setItem('music-full-config', JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('music-full-config-updated'));
  } catch (e) {
    console.error('保存自定义配置失败:', e);
  }
}

watch(styleConfig, () => saveStyleConfig(), { deep: true });
watch(currentPlayerStyle, () => loadStyleConfig(), { immediate: true });

// 导入 TTF 字体
function importFont() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.ttf,.otf';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    customFontName.value = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const fontName = `UserFont-${currentPlayerStyle.value}`;
      const oldStyle = document.getElementById(`user-font-${currentPlayerStyle.value}`);
      if (oldStyle) oldStyle.remove();
      const styleEl = document.createElement('style');
      styleEl.id = `user-font-${currentPlayerStyle.value}`;
      styleEl.textContent = `@font-face { font-family: '${fontName}'; src: url(data:font/ttf;base64,${base64}); }`;
      document.head.appendChild(styleEl);
      styleConfig.value.customFontFamily = fontName;
      saveStyleConfig();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

loadStyleConfig();

// ==================== 歌词设置 ====================
function toggleShowTranslation() {
  lyricConfig.value.showTranslation = !lyricConfig.value.showTranslation;
  localStorage.setItem('music-full-config', JSON.stringify(lyricConfig.value));
  window.dispatchEvent(new CustomEvent('music-full-config-updated'));
}

// ==================== 分享功能配置 ====================
const posterLayouts = [
  { key: 'torn-paper' as const, label: '撕纸文艺', icon: 'ri-quill-pen-line' },
  { key: 'immersive' as const, label: '沉浸全屏', icon: 'ri-image-line' }
];

function toggleShareScreenshotQRCode() {
  lyricConfig.value.shareScreenshotQRCode = !lyricConfig.value.shareScreenshotQRCode;
  localStorage.setItem('music-full-config', JSON.stringify(lyricConfig.value));
  window.dispatchEvent(new CustomEvent('music-full-config-updated'));
}

function setShareDefaultLayout(layout: 'torn-paper' | 'immersive') {
  lyricConfig.value.shareDefaultPosterLayout = layout;
  localStorage.setItem('music-full-config', JSON.stringify(lyricConfig.value));
  window.dispatchEvent(new CustomEvent('music-full-config-updated'));
}

// Props & Emits
defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
}>();

// 播放速度选项
const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// 自定义时间
const customMinutes = ref<number | string>(30);

// 定时器相关
const refreshTrigger = ref(0);
let timerInterval: number | null = null;

const hasTimerActive = computed(() => playerStore.hasSleepTimerActive);

const timerStatusText = computed(() => {
  if (sleepTimer.value.type === 'time') return t('player.sleepTimer.timeMode');
  if (sleepTimer.value.type === 'songs') return t('player.sleepTimer.songsMode');
  if (sleepTimer.value.type === 'end') return t('player.sleepTimer.afterPlaylist');
  return '';
});

const timerDisplayText = computed(() => {
  void refreshTrigger.value;

  if (sleepTimer.value.type === 'time' && sleepTimer.value.endTime) {
    const remaining = Math.max(0, sleepTimer.value.endTime - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  if (sleepTimer.value.type === 'songs') {
    return t('player.sleepTimer.songsRemaining', { count: sleepTimer.value.remainingSongs || 0 });
  }

  if (sleepTimer.value.type === 'end') {
    return t('player.sleepTimer.afterPlaylist');
  }

  return '';
});

// 方法
const close = () => {
  emit('update:visible', false);
};

const setSpeed = (speed: number) => {
  playerStore.setPlaybackRate(speed);
};

const setTimeTimer = (minutes: number) => {
  playerStore.setSleepTimerByTime(minutes);
};

const setCustomTimeTimer = () => {
  const minutes =
    typeof customMinutes.value === 'number'
      ? customMinutes.value
      : parseInt(String(customMinutes.value) || '0', 10);
  if (minutes >= 1) {
    playerStore.setSleepTimerByTime(minutes);
    customMinutes.value = 30;
  }
};

const increaseMinutes = () => {
  const current = Number(customMinutes.value) || 0;
  customMinutes.value = Math.min(300, current + 1);
};

const decreaseMinutes = () => {
  const current = Number(customMinutes.value) || 0;
  customMinutes.value = Math.max(1, current - 1);
};

const handleMinutesInput = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const value = input.value.replace(/[^0-9]/g, '');
  if (value) {
    customMinutes.value = Math.min(300, Math.max(1, parseInt(value, 10)));
  } else {
    customMinutes.value = '';
  }
};

const setSongsTimer = (songs: number) => {
  playerStore.setSleepTimerBySongs(songs);
};

const setPlaylistEndTimer = () => {
  playerStore.setSleepTimerAtPlaylistEnd();
};

const cancelTimer = () => {
  playerStore.clearSleepTimer();
};

// 定时刷新倒计时
const startTimerUpdate = () => {
  if (timerInterval) return;
  timerInterval = window.setInterval(() => {
    refreshTrigger.value = Date.now();
  }, 500);
};

const stopTimerUpdate = () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
};

watch(
  () => [hasTimerActive.value, sleepTimer.value.type],
  ([active, type]) => {
    if (active && type === 'time') {
      startTimerUpdate();
    } else {
      stopTimerUpdate();
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (hasTimerActive.value && sleepTimer.value.type === 'time') {
    startTimerUpdate();
  }
  // 加载歌词配置
  const saved = localStorage.getItem('music-full-config');
  if (saved) {
    try {
      lyricConfig.value = { ...DEFAULT_LYRIC_CONFIG, ...JSON.parse(saved) };
    } catch {
      // keep default
    }
  }
});

onUnmounted(() => {
  stopTimerUpdate();
});
</script>

<style scoped>
/* 弹窗动画 */
.settings-drawer-enter-active,
.settings-drawer-leave-active {
  transition: opacity 0.3s ease;
}

.settings-drawer-enter-active > div:last-child,
.settings-drawer-leave-active > div:last-child {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.settings-drawer-enter-from,
.settings-drawer-leave-to {
  opacity: 0;
}

.settings-drawer-enter-from > div:last-child,
.settings-drawer-leave-to > div:last-child {
  transform: translateY(100%);
}

/* 播放器样式卡片激活状态 */
.style-card-active {
  background: rgba(var(--accent-color-rgb, 99, 102, 241), 0.2);
  border: 1px solid rgba(var(--accent-color-rgb, 99, 102, 241), 0.4);
}

.style-card {
  border: 1px solid transparent;
}

.style-card:active {
  transform: scale(0.96);
}

/* 分享功能开关 */
.share-toggle-switch {
  width: 44px;
  height: 26px;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.12);
  position: relative;
  transition: background 0.3s;
  flex-shrink: 0;
}

.share-toggle-switch.on {
  background: var(--accent-color, #6366f1);
}

.share-toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.share-toggle-switch.on .share-toggle-knob {
  transform: translateX(18px);
}
</style>
