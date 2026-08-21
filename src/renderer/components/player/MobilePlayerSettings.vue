<template>
  <Teleport to="body" :disabled="embedded">
    <Transition name="settings-drawer" :css="!embedded">
      <div
        v-if="visible"
        class="player-settings-overlay fixed inset-0 z-[99999] flex items-end justify-center"
        :class="{ embedded }"
        @click.self="close"
      >
        <!-- 遮罩层 -->
        <div v-if="!embedded" class="absolute inset-0 bg-black/50" @click="close"></div>

        <!-- 弹窗内容 - 磨砂玻璃效果 -->
        <div
          class="player-settings-surface relative w-full max-w-lg overflow-hidden max-h-[78vh] flex flex-col"
          :style="settingsDragStyle"
          @pointermove="onSettingsDragMove"
          @pointerup="onSettingsDragEnd"
          @pointercancel="onSettingsDragEnd"
        >
          <!-- 顶部拖拽条 -->
          <div
            v-if="!embedded"
            class="settings-drag-region flex justify-center pt-3 pb-2 flex-shrink-0"
            @pointerdown="onSettingsDragStart"
          >
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

          <div class="px-5 pb-4 flex-shrink-0">
            <div class="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
              <button
                type="button"
                class="rounded-lg py-2 text-sm transition-colors"
                :class="activeTab === 'song' ? 'bg-white/15 text-white' : 'text-white/50'"
                @click="activeTab = 'song'"
              >
                <i class="ri-music-2-line mr-1"></i>歌曲
              </button>
              <button
                type="button"
                class="rounded-lg py-2 text-sm transition-colors"
                :class="activeTab === 'control' ? 'bg-white/15 text-white' : 'text-white/50'"
                @click="activeTab = 'control'"
              >
                <i class="ri-sliders-3-line mr-1"></i>控制
              </button>
            </div>
          </div>

          <!-- 内容区域：两页常驻，横向手势只移动轨道，不重建页面。 -->
          <div
            ref="settingsTabViewportRef"
            class="settings-tab-viewport"
            @pointerdown.capture="onTabPointerDown"
            @pointermove.capture="onTabPointerMove"
            @pointerup.capture="onTabPointerUp"
            @pointercancel.capture="onTabPointerCancel"
          >
            <div
              class="settings-tab-page overflow-y-auto px-5 pb-6"
              :aria-hidden="activeTab !== 'control'"
              :inert="activeTab !== 'control'"
              :style="getSettingsTabPageStyle('control')"
            >
              <!-- 播放器样式 2×2 网格 -->
              <section
                class="control-settings-section"
                :class="{ expanded: isControlSectionExpanded('playerStyle') }"
              >
                <button
                  type="button"
                  class="control-section-header"
                  :aria-expanded="isControlSectionExpanded('playerStyle')"
                  aria-controls="control-section-player-style"
                  @click="toggleControlSection('playerStyle')"
                >
                  <span class="control-section-title">
                    <i class="ri-palette-line"></i>
                    {{ t('player.settings.playerStyle') || '播放器样式' }}
                  </span>
                  <i
                    class="ri-arrow-down-s-line control-section-chevron"
                    :class="{ expanded: isControlSectionExpanded('playerStyle') }"
                  ></i>
                </button>
                <div
                  class="control-section-reveal"
                  :class="{ expanded: isControlSectionExpanded('playerStyle') }"
                  :aria-hidden="!isControlSectionExpanded('playerStyle')"
                  :inert="!isControlSectionExpanded('playerStyle')"
                >
                  <div id="control-section-player-style" class="control-section-body">
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

                    <player-style-customization-panel
                      :key="currentPlayerStyle"
                      v-model="styleConfig"
                      :style-key="currentPlayerStyle"
                      @reset="resetCurrentStyleConfig"
                    />
                  </div>
                </div>
              </section>

              <!-- 手动标记高潮段落 -->
              <section
                class="control-settings-section"
                :class="{ expanded: isControlSectionExpanded('climax') }"
              >
                <button
                  type="button"
                  class="control-section-header"
                  :aria-expanded="isControlSectionExpanded('climax')"
                  aria-controls="control-section-climax"
                  @click="toggleControlSection('climax')"
                >
                  <span class="control-section-title">
                    <i class="ri-fire-line mr-1"></i>
                    高潮段落标记
                  </span>
                  <span class="control-section-summary">{{ manualClimaxSegments.length }} 段</span>
                  <i
                    class="ri-arrow-down-s-line control-section-chevron"
                    :class="{ expanded: isControlSectionExpanded('climax') }"
                  ></i>
                </button>
                <div
                  class="control-section-reveal"
                  :class="{ expanded: isControlSectionExpanded('climax') }"
                  :aria-hidden="!isControlSectionExpanded('climax')"
                  :inert="!isControlSectionExpanded('climax')"
                >
                  <div id="control-section-climax" class="control-section-body">
                    <!-- 当前播放时间显示 -->
                    <div class="flex items-center justify-between mb-2 px-1">
                      <span class="text-xs text-white/50">在时间轴上拖动以标记高潮段落</span>
                      <span class="text-xs font-mono text-white/60"
                        >{{ formatTime(currentPlayTime) }} / {{ formatTime(songDuration) }}</span
                      >
                    </div>

                    <!-- 时间轴 -->
                    <div class="climax-timeline-wrapper">
                      <!-- 时间刻度 -->
                      <div class="climax-time-scale">
                        <span
                          v-for="mark in climaxTimeMarks"
                          :key="mark"
                          class="climax-time-mark"
                          :style="{ left: (mark / songDuration) * 100 + '%' }"
                          >{{ formatTime(mark) }}</span
                        >
                      </div>

                      <!-- 时间轴主体 -->
                      <div
                        class="climax-timeline"
                        ref="climaxTimelineRef"
                        @touchstart.passive="onTimelineTouchStart"
                        @touchmove.passive="onTimelineTouchMove"
                        @touchend="onTimelineTouchEnd"
                      >
                        <!-- 已有段落 -->
                        <div
                          v-for="(seg, i) in manualClimaxSegments"
                          :key="'seg-' + i"
                          class="climax-region"
                          :class="{
                            'climax-region-active':
                              currentPlayTime >= seg.start && currentPlayTime <= seg.end
                          }"
                          :style="getClimaxRegionStyle(seg)"
                        >
                          <!-- 左侧拖拽手柄 -->
                          <div
                            class="climax-handle left"
                            @touchstart.stop.prevent="onEdgeTouchStart($event, i, 'start')"
                            @touchmove.stop.prevent="onEdgeTouchMove"
                            @touchend.stop="onEdgeTouchEnd"
                          ></div>
                          <!-- 中间内容 -->
                          <div class="climax-region-content">
                            <span class="climax-region-label"
                              >{{ formatTime(seg.start) }} - {{ formatTime(seg.end) }}</span
                            >
                            <button
                              type="button"
                              class="climax-region-remove"
                              aria-label="删除高潮段落"
                              @click.stop="removeClimaxSegment(i)"
                            >
                              <i class="ri-close-line"></i>
                            </button>
                          </div>
                          <!-- 右侧拖拽手柄 -->
                          <div
                            class="climax-handle right"
                            @touchstart.stop.prevent="onEdgeTouchStart($event, i, 'end')"
                            @touchmove.stop.prevent="onEdgeTouchMove"
                            @touchend.stop="onEdgeTouchEnd"
                          ></div>
                        </div>

                        <!-- 拖拽预览选区 -->
                        <div
                          v-if="isClimaxDragging"
                          class="climax-preview"
                          :style="getClimaxPreviewStyle()"
                        ></div>

                        <!-- 当前播放位置 -->
                        <div
                          class="climax-playhead"
                          :style="{ left: (currentPlayTime / songDuration) * 100 + '%' }"
                        ></div>
                      </div>
                    </div>

                    <!-- 操作按钮 -->
                    <div class="flex gap-2 mt-3">
                      <button
                        v-if="manualClimaxSegments.length > 0"
                        @click="clearAllClimaxSegments"
                        class="flex-1 py-2 rounded-xl text-sm bg-white/10 text-white/60 active:scale-95 transition-transform"
                      >
                        <i class="ri-eraser-line mr-1"></i>清空全部
                      </button>
                      <button
                        @click="seekToPlayhead"
                        class="flex-1 py-2 rounded-xl text-sm bg-white/10 text-white/60 active:scale-95 transition-transform"
                      >
                        <i class="ri-music-2-line mr-1"></i>跳到播放位置
                      </button>
                      <button
                        @click="queryCloudClimax"
                        :disabled="cloudClimaxLoading"
                        class="flex-1 py-2 rounded-xl text-sm bg-[var(--accent-color)]/20 text-[var(--accent-color)] active:scale-95 transition-transform disabled:opacity-50"
                      >
                        <i v-if="cloudClimaxLoading" class="ri-loader-4-line animate-spin mr-1"></i>
                        <i v-else class="ri-cloud-line mr-1"></i>
                        {{ cloudClimaxLoading ? '查询中...' : '查询云端' }}
                      </button>
                      <button
                        @click="uploadManualClimax"
                        :disabled="
                          manualClimaxSegments.length === 0 ||
                          uploadingClimax ||
                          isLocalSong(playMusic)
                        "
                        class="flex-1 py-2 rounded-xl text-sm bg-emerald-400/15 text-emerald-300 active:scale-95 transition-transform disabled:opacity-40"
                      >
                        <i v-if="uploadingClimax" class="ri-loader-4-line animate-spin mr-1"></i>
                        <i v-else class="ri-upload-cloud-2-line mr-1"></i>
                        {{ uploadingClimax ? '上传中...' : '上传服务器' }}
                      </button>
                    </div>

                    <!-- 云端查询结果 -->
                    <div v-if="cloudClimaxResults.length > 0" class="mt-3 space-y-2">
                      <div class="text-xs text-white/50 px-1">
                        找到 {{ cloudClimaxResults.length }} 条云端高潮数据，点击覆盖到本地
                      </div>
                      <div
                        v-for="(result, i) in cloudClimaxResults"
                        :key="'cloud-' + i"
                        @click="applyCloudClimax(result)"
                        class="flex items-center gap-3 p-3 rounded-xl bg-white/5 active:bg-white/10 transition-colors"
                      >
                        <i class="ri-cloud-line text-white/40 text-lg flex-shrink-0"></i>
                        <div class="flex-1 min-w-0">
                          <div class="text-sm text-white/80 truncate">{{ result.songName }}</div>
                          <div class="text-xs text-white/40 truncate">
                            {{ result.artist || '未知艺术家' }} · {{ result.segments.length }}段 ·
                            贡献者:
                            {{ result.contributor || '云端' }}
                          </div>
                        </div>
                        <i class="ri-download-2-line text-[var(--accent-color)] flex-shrink-0"></i>
                      </div>
                    </div>

                    <!-- 云端查询无结果 -->
                    <div
                      v-if="cloudClimaxSearched && cloudClimaxResults.length === 0"
                      class="mt-3 flex flex-col items-center justify-center py-3 text-white/30"
                    >
                      <i class="ri-cloud-off-line text-3xl mb-1"></i>
                      <p class="text-xs">未找到同名歌曲的云端高潮数据</p>
                    </div>

                    <!-- 空状态提示 -->
                    <div
                      v-if="manualClimaxSegments.length === 0 && !cloudClimaxSearched"
                      class="flex flex-col items-center justify-center py-3 text-white/30"
                    >
                      <i class="ri-fire-line text-3xl mb-1"></i>
                      <p class="text-xs">在时间轴上左右拖动来创建高潮段落</p>
                    </div>
                  </div>
                </div>
              </section>

              <!-- 歌词设置 -->
              <section
                class="control-settings-section"
                :class="{ expanded: isControlSectionExpanded('lyrics') }"
              >
                <button
                  type="button"
                  class="control-section-header"
                  :aria-expanded="isControlSectionExpanded('lyrics')"
                  aria-controls="control-section-lyrics"
                  @click="toggleControlSection('lyrics')"
                >
                  <span class="control-section-title">
                    <i class="ri-translate-2 mr-1"></i>
                    歌词设置
                  </span>
                  <i
                    class="ri-arrow-down-s-line control-section-chevron"
                    :class="{ expanded: isControlSectionExpanded('lyrics') }"
                  ></i>
                </button>
                <div
                  class="control-section-reveal"
                  :class="{ expanded: isControlSectionExpanded('lyrics') }"
                  :aria-hidden="!isControlSectionExpanded('lyrics')"
                  :inert="!isControlSectionExpanded('lyrics')"
                >
                  <div id="control-section-lyrics" class="control-section-body">
                    <!-- 显示翻译 -->
                    <div class="flex items-center justify-between p-3 rounded-2xl bg-white/5 mb-2">
                      <div>
                        <div class="text-sm text-white/80">
                          {{ tr('settings.lyricSettings.showTranslation', '显示翻译') }}
                        </div>
                        <div class="text-xs text-white/40 mt-1">
                          {{
                            tr(
                              'settings.lyricSettings.showTranslationDescription',
                              '在歌词下方显示翻译文本'
                            )
                          }}
                        </div>
                      </div>
                      <button
                        class="share-toggle-switch"
                        :class="{ on: lyricConfig.showTranslation }"
                        @click="toggleShowTranslation"
                      >
                        <span class="share-toggle-knob"></span>
                      </button>
                    </div>

                    <div class="flex items-center justify-between p-3 rounded-2xl bg-white/5 mb-2">
                      <div class="min-w-0 pr-3">
                        <div class="text-sm text-white/80">
                          {{
                            tr(
                              'settings.lyricSettings.alwaysShowPlayerControls',
                              '始终显示播放控件'
                            )
                          }}
                        </div>
                        <div class="text-xs text-white/40 mt-1">
                          {{
                            tr(
                              'settings.lyricSettings.alwaysShowPlayerControlsDescription',
                              '顶部和底部控件保持常驻'
                            )
                          }}
                        </div>
                      </div>
                      <button
                        class="share-toggle-switch"
                        :class="{ on: lyricConfig.alwaysShowPlayerControls }"
                        @click="
                          lyricConfig.alwaysShowPlayerControls =
                            !lyricConfig.alwaysShowPlayerControls
                        "
                      >
                        <span class="share-toggle-knob"></span>
                      </button>
                    </div>

                    <!-- 歌词对齐 -->
                    <div class="flex items-center justify-between p-3 rounded-2xl bg-white/5 mb-2">
                      <div class="min-w-0 pr-3">
                        <div class="text-sm text-white/80">
                          {{ tr('settings.lyricSettings.alignment', '歌词对齐') }}
                        </div>
                        <div class="text-xs text-white/40 mt-1">
                          {{
                            tr(
                              'settings.lyricSettings.alignmentDescription',
                              '调整滚动歌词的水平对齐方式'
                            )
                          }}
                        </div>
                      </div>
                      <div class="lyric-alignment-control" role="radiogroup">
                        <button
                          v-for="option in lyricAlignmentOptions"
                          :key="option.value"
                          type="button"
                          :class="{ active: lyricConfig.lyricAlignment === option.value }"
                          :aria-label="option.label"
                          :aria-checked="lyricConfig.lyricAlignment === option.value"
                          role="radio"
                          @click="setLyricAlignment(option.value)"
                        >
                          <i :class="option.icon"></i>
                        </button>
                      </div>
                    </div>

                    <div class="flex items-center justify-between p-3 rounded-2xl bg-white/5 mb-2">
                      <div class="min-w-0 pr-3">
                        <div class="text-sm text-white/80">滚动歌词手势</div>
                        <div class="text-xs text-white/40 mt-1">
                          选择大字歌词进入方向，返回时使用相反方向
                        </div>
                      </div>
                      <div class="lyric-swipe-control" role="radiogroup">
                        <button
                          v-for="option in lyricSwipeOptions"
                          :key="option.value"
                          type="button"
                          :class="{ active: lyricConfig.lyricSwipeDirection === option.value }"
                          :aria-checked="lyricConfig.lyricSwipeDirection === option.value"
                          role="radio"
                          @click="setLyricSwipeDirection(option.value)"
                        >
                          {{ option.label }}
                        </button>
                      </div>
                    </div>

                    <!-- 显示罗马音 -->
                    <div class="flex items-center justify-between p-3 rounded-2xl bg-white/5 mb-2">
                      <div>
                        <div class="text-sm text-white/80">
                          {{ tr('settings.lyricSettings.showRomanization', '显示罗马音') }}
                        </div>
                        <div class="text-xs text-white/40 mt-1">
                          {{
                            tr(
                              'settings.lyricSettings.showRomanizationDescription',
                              '在歌词下方显示罗马音文本'
                            )
                          }}
                        </div>
                      </div>
                      <button
                        class="share-toggle-switch"
                        :class="{ on: lyricConfig.showRomanization }"
                        @click="toggleShowRomanization"
                      >
                        <span class="share-toggle-knob"></span>
                      </button>
                    </div>

                    <div
                      v-if="androidNativeAvailable"
                      class="flex items-center justify-between p-3 rounded-2xl bg-white/5 mb-2"
                    >
                      <div class="min-w-0 pr-3">
                        <div class="text-sm text-white/80">
                          {{ tr('settings.lyricSettings.statusBarLyrics', '状态栏歌词') }}
                        </div>
                        <div class="text-xs text-white/40 mt-1">
                          {{
                            tr(
                              'settings.lyricSettings.statusBarLyricsDescription',
                              '通过顶部悬浮窗在其他应用上方显示当前歌词'
                            )
                          }}
                        </div>
                      </div>
                      <button
                        class="share-toggle-switch"
                        :class="{ on: lyricConfig.statusBarLyricsEnabled }"
                        @click="toggleStatusBarLyrics"
                      >
                        <span class="share-toggle-knob"></span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <!-- 播放速度 -->
              <section
                class="control-settings-section"
                :class="{ expanded: isControlSectionExpanded('speed') }"
              >
                <button
                  type="button"
                  class="control-section-header"
                  :aria-expanded="isControlSectionExpanded('speed')"
                  aria-controls="control-section-speed"
                  @click="toggleControlSection('speed')"
                >
                  <span class="control-section-title">
                    <i class="ri-speed-up-line"></i>
                    {{ t('player.settings.playbackSpeed') }}
                  </span>
                  <span class="control-section-summary accent">{{ playbackRate }}x</span>
                  <i
                    class="ri-arrow-down-s-line control-section-chevron"
                    :class="{ expanded: isControlSectionExpanded('speed') }"
                  ></i>
                </button>
                <div
                  class="control-section-reveal"
                  :class="{ expanded: isControlSectionExpanded('speed') }"
                  :aria-hidden="!isControlSectionExpanded('speed')"
                  :inert="!isControlSectionExpanded('speed')"
                >
                  <div id="control-section-speed" class="control-section-body">
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
                </div>
              </section>

              <!-- 歌词解析 -->
              <section
                class="control-settings-section"
                :class="{ expanded: isControlSectionExpanded('analysis') }"
              >
                <button
                  type="button"
                  class="control-section-header"
                  :aria-expanded="isControlSectionExpanded('analysis')"
                  aria-controls="control-section-analysis"
                  @click="toggleControlSection('analysis')"
                >
                  <span class="control-section-title">
                    <i class="ri-quill-pen-line mr-1"></i>
                    歌词解析
                  </span>
                  <i
                    class="ri-arrow-down-s-line control-section-chevron"
                    :class="{ expanded: isControlSectionExpanded('analysis') }"
                  ></i>
                </button>
                <div
                  class="control-section-reveal"
                  :class="{ expanded: isControlSectionExpanded('analysis') }"
                  :aria-hidden="!isControlSectionExpanded('analysis')"
                  :inert="!isControlSectionExpanded('analysis')"
                >
                  <div id="control-section-analysis" class="control-section-body">
                    <div class="control-section-actions">
                      <div
                        ref="metaphorModelMenuRef"
                        class="metaphor-model-picker"
                        :class="{ expanded: metaphorModelMenuOpen }"
                        @pointerdown.stop
                        @pointerup.stop
                        @click.stop
                      >
                        <button
                          type="button"
                          class="metaphor-model-trigger"
                          :aria-expanded="metaphorModelMenuOpen"
                          @click="metaphorModelMenuOpen = !metaphorModelMenuOpen"
                        >
                          <span>{{ selectedMetaphorModelLabel }}</span>
                          <i
                            class="ri-arrow-down-s-line"
                            :class="{ open: metaphorModelMenuOpen }"
                          ></i>
                        </button>
                        <div
                          class="metaphor-model-menu"
                          :class="{ visible: metaphorModelMenuOpen }"
                        >
                          <button
                            v-for="option in metaphorModelOptions"
                            :key="option.value"
                            type="button"
                            class="metaphor-model-option"
                            :class="{
                              active: option.value === metaphorModelSelection,
                              settings: option.value === '__open_metaphor_settings__'
                            }"
                            :tabindex="metaphorModelMenuOpen ? 0 : -1"
                            @click="onMetaphorModelChange(option.value)"
                          >
                            <span>{{ option.label }}</span>
                            <i
                              v-if="option.value === metaphorModelSelection"
                              class="ri-check-line"
                            ></i>
                            <i
                              v-else-if="option.value === '__open_metaphor_settings__'"
                              class="ri-settings-3-line"
                            ></i>
                          </button>
                        </div>
                      </div>
                      <button
                        v-if="!metaphorLoading && !metaphorResult"
                        @click="analyzeLyrics"
                        class="metaphor-analyze-button primary"
                      >
                        开始分析
                      </button>
                      <button
                        v-if="metaphorResult || metaphorLoading"
                        @click="analyzeLyrics"
                        :disabled="metaphorLoading"
                        class="metaphor-analyze-button"
                      >
                        {{ metaphorLoading ? '分析中...' : '重新分析' }}
                      </button>
                    </div>

                    <!-- 加载中 -->
                    <div v-if="metaphorLoading" class="metaphor-output-scroll py-5 text-white/70">
                      <div v-if="metaphorResult" class="metaphor-stream-text">
                        <div class="metaphor-stream-status">
                          <span>{{ metaphorLoadingText }}</span>
                          <span>已运行 {{ metaphorElapsedSeconds }} 秒</span>
                        </div>
                        <div class="metaphor-result" v-html="sanitizedMetaphorResult"></div>
                        <span class="typing-caret" aria-hidden="true"></span>
                      </div>
                      <div
                        v-else
                        class="flex flex-col items-center justify-center py-3 text-white/50"
                      >
                        <i class="ri-loader-4-line animate-spin text-3xl mb-3"></i>
                        <p class="metaphor-loading-label">{{ metaphorLoadingText }}</p>
                        <p class="metaphor-loading-time">已运行 {{ metaphorElapsedSeconds }} 秒</p>
                      </div>
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
                      class="metaphor-output-scroll"
                    >
                      <div class="metaphor-result" v-html="sanitizedMetaphorResult"></div>
                      <div class="metaphor-result-actions">
                        <button type="button" class="metaphor-copy-button" @click="copyMetaphorPlainText">
                          <i :class="metaphorCopied ? 'ri-check-line' : 'ri-file-copy-line'"></i>
                          {{ metaphorCopied ? '已复制' : '复制纯文本' }}
                        </button>
                      </div>
                    </div>

                    <!-- 空状态 -->
                    <div
                      v-else
                      class="flex flex-col items-center justify-center py-6 text-white/40"
                    >
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
                </div>
              </section>

              <!-- 分享功能 -->
              <section
                class="control-settings-section"
                :class="{ expanded: isControlSectionExpanded('sharing') }"
              >
                <button
                  type="button"
                  class="control-section-header"
                  :aria-expanded="isControlSectionExpanded('sharing')"
                  aria-controls="control-section-sharing"
                  @click="toggleControlSection('sharing')"
                >
                  <span class="control-section-title">
                    <i class="ri-share-line mr-1"></i>
                    分享功能
                  </span>
                  <i
                    class="ri-arrow-down-s-line control-section-chevron"
                    :class="{ expanded: isControlSectionExpanded('sharing') }"
                  ></i>
                </button>
                <div
                  class="control-section-reveal"
                  :class="{ expanded: isControlSectionExpanded('sharing') }"
                  :aria-hidden="!isControlSectionExpanded('sharing')"
                  :inert="!isControlSectionExpanded('sharing')"
                >
                  <div id="control-section-sharing" class="control-section-body">
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
                </div>
              </section>

              <!-- 定时关闭 -->
              <section
                class="control-settings-section"
                :class="{ expanded: isControlSectionExpanded('sleepTimer') }"
              >
                <button
                  type="button"
                  class="control-section-header"
                  :aria-expanded="isControlSectionExpanded('sleepTimer')"
                  aria-controls="control-section-sleep-timer"
                  @click="toggleControlSection('sleepTimer')"
                >
                  <span class="control-section-title">
                    <i class="ri-timer-line"></i>
                    {{ t('player.sleepTimer.title') }}
                  </span>
                  <span v-if="hasTimerActive" class="control-section-summary accent">
                    {{ timerStatusText }}
                  </span>
                  <i
                    class="ri-arrow-down-s-line control-section-chevron"
                    :class="{ expanded: isControlSectionExpanded('sleepTimer') }"
                  ></i>
                </button>
                <div
                  class="control-section-reveal"
                  :class="{ expanded: isControlSectionExpanded('sleepTimer') }"
                  :aria-hidden="!isControlSectionExpanded('sleepTimer')"
                  :inert="!isControlSectionExpanded('sleepTimer')"
                >
                  <div id="control-section-sleep-timer" class="control-section-body">
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
                          <div
                            class="flex items-center flex-1 bg-white/10 rounded-full overflow-hidden"
                          >
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
              </section>
            </div>

            <div
              class="settings-tab-page overflow-y-auto px-5 pb-6"
              :aria-hidden="activeTab !== 'song'"
              :inert="activeTab !== 'song'"
              :style="getSettingsTabPageStyle('song')"
            >
              <div v-if="currentSong" class="space-y-4">
                <div class="flex items-center gap-4 rounded-2xl bg-white/5 p-4">
                  <img
                    :src="getImgUrl(currentSong.picUrl || currentSong.al?.picUrl, '200y200')"
                    class="h-16 w-16 rounded-xl object-cover"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-base font-semibold text-white">
                      {{ currentSong.name }}
                    </div>
                    <button
                      v-if="currentArtistText"
                      type="button"
                      class="settings-song-link mt-1 truncate text-left text-sm text-white/50"
                      @click.stop="openCurrentArtist"
                    >
                      {{ currentArtistText || '未知艺术家' }}
                    </button>
                    <button
                      v-if="currentAlbum?.name"
                      type="button"
                      class="settings-song-link mt-1 truncate text-left text-xs text-white/35"
                      @click.stop="openCurrentAlbum"
                    >
                      {{ currentAlbum.name }}
                    </button>
                  </div>
                </div>

                <div v-if="currentAudioParamSegments.length" class="current-audio-params">
                  <span v-for="segment in currentAudioParamSegments" :key="segment">
                    {{ segment }}
                  </span>
                  <button
                    v-if="currentSong && isLocalSong(currentSong)"
                    type="button"
                    class="current-audio-edit"
                    @click="metadataEditorShow = true"
                  >
                    <i class="ri-edit-line" />{{ t('songItem.metadataEditor.edit') }}
                  </button>
                </div>

                <div class="overflow-hidden rounded-2xl bg-white/5">
                  <button class="song-setting-action" @click="playCurrentSong">
                    <i class="ri-play-circle-line"></i><span>播放</span>
                  </button>
                  <button class="song-setting-action" @click="playCurrentNext">
                    <i class="ri-play-list-2-line"></i><span>下一首播放</span>
                  </button>
                  <button
                    v-if="currentArtistId"
                    class="song-setting-action"
                    @click="openCurrentArtist"
                  >
                    <i class="ri-user-line"></i><span>歌手：{{ currentArtistText }}</span
                    ><i class="ri-arrow-right-s-line ml-auto"></i>
                  </button>
                  <button
                    v-if="currentAlbum?.name"
                    class="song-setting-action"
                    @click="openCurrentAlbum"
                  >
                    <i class="ri-disc-line"></i><span>专辑：{{ currentAlbum.name }}</span
                    ><i class="ri-arrow-right-s-line ml-auto"></i>
                  </button>
                  <inline-playlist-picker
                    :song="currentSong"
                    :expanded="settingsPlaylistExpanded"
                    back-layer-id="player-settings-playlist-picker"
                    @update:expanded="settingsPlaylistExpanded = $event"
                  />
                  <button class="song-setting-action" @click="toggleCurrentFavorite">
                    <i
                      :class="currentIsFavorite ? 'ri-heart-fill text-red-400' : 'ri-heart-line'"
                    ></i
                    ><span>{{ currentIsFavorite ? '取消收藏' : '收藏' }}</span>
                  </button>
                </div>
              </div>
              <div v-else class="flex flex-col items-center justify-center py-16 text-white/40">
                <i class="ri-music-2-line text-4xl"></i>
                <p class="mt-3 text-sm">当前没有播放歌曲</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    <song-metadata-editor v-model:show="metadataEditorShow" :song="currentSong!" />
  </Teleport>
</template>

<script setup lang="ts">
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { storeToRefs } from 'pinia';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import {
  type ClimaxEntry,
  loadClimaxForSong,
  normalizeClimaxSegments,
  queryClimax,
  uploadClimax
} from '@/api/climax';
import { searchServerSongs } from '@/api/serverSongs';
import InlinePlaylistPicker from '@/components/common/InlinePlaylistPicker.vue';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import SongMetadataEditor from '@/components/common/SongMetadataEditor.vue';
import PlayerStyleCustomizationPanel from '@/components/player/PlayerStyleCustomizationPanel.vue';
import { createPlayerStyleConfig, resolvePlayerStyleConfig } from '@/config/playerStyleConfig';
import { listGatewayModels, type GatewayModel } from '@/features/ai/gateway';
import {
  getMetaphorConfig,
  saveMetaphorConfig,
  useMetaphor
} from '@/features/lyric-metaphor/useMetaphor';
import { lrcArray, nowTime, playMusic, sound } from '@/hooks/MusicHook';
import { useArtist } from '@/hooks/useArtist';
import { isLocalSong } from '@/hooks/useLocalMusic';
import {
  hasStatusBarLyricPermission,
  isAndroidNative,
  refreshStatusBarLyric,
  requestStatusBarLyricPermission
} from '@/services/androidNative';
import { audioService } from '@/services/audioService';
import { deleteClimaxCache, getLocalClimax, saveLocalClimax } from '@/services/cacheService';
import { activeAudioFormat } from '@/services/nativeAudioPlayer';
import { useClimaxStore } from '@/store/modules/climax';
import { useCommunityDataStore } from '@/store/modules/communityData';
import { useLocalMusicStore } from '@/store/modules/localMusic';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { useUserStore } from '@/store/modules/user';
import type { LyricAlignment, LyricConfig, LyricSwipeDirection } from '@/types/lyric';
import {
  DEFAULT_LYRIC_CONFIG,
  normalizeLyricAlignment,
  normalizeLyricSwipeDirection,
  normalizeStatusBarLyricConfig
} from '@/types/lyric';
import type { MobilePlayerStyleKey, PlayerStyleCustomConfig } from '@/types/playerStyle';
import { isMobilePlayerStyleKey } from '@/types/playerStyle';
import { getImgUrl, secondToMinute } from '@/utils';
import { formatAudioSegments } from '@/utils/audioFormat';

const { t } = useI18n();
const router = useRouter();
const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const climaxStore = useClimaxStore();
const communityDataStore = useCommunityDataStore();
const userStore = useUserStore();
const { navigateToArtist } = useArtist();
const message = window.$message;
const androidNativeAvailable = isAndroidNative();
const activeTab = ref<'song' | 'control'>('control');
const metaphorModels = ref<GatewayModel[]>([]);
const metaphorModelsLoading = ref(false);
const metaphorModelMenuRef = ref<HTMLElement | null>(null);
const metaphorModelMenuOpen = ref(false);
const metaphorModelSelection = ref(getMetaphorConfig().model || 'opencode-v4f');
const metaphorModelName = (id: string, fallback?: string) => {
  if (id === 'opencode-v4f' || id === 'deepseek-v4-flash-0731') return 'DeepSeekV4Flash';
  return fallback || id;
};
const metaphorModelOptions = computed(() => {
  const options = metaphorModels.value.map((model) => ({
    label: `${metaphorModelName(model.id, model.name)} · ${model.multiplier}x`,
    value: model.id
  }));
  if (!options.some((option) => option.value === metaphorModelSelection.value)) {
    options.unshift({
      label: metaphorModelName(metaphorModelSelection.value),
      value: metaphorModelSelection.value
    });
  }
  return [...options, { label: '打开设置', value: '__open_metaphor_settings__' }];
});
const selectedMetaphorModelLabel = computed(
  () =>
    metaphorModelOptions.value.find((option) => option.value === metaphorModelSelection.value)
      ?.label || metaphorModelName(metaphorModelSelection.value)
);

async function loadMetaphorModels() {
  const config = getMetaphorConfig();
  metaphorModelSelection.value = config.model || 'opencode-v4f';
  if (!config.accessToken) return;
  metaphorModelsLoading.value = true;
  try {
    metaphorModels.value = await listGatewayModels(config.accessToken);
  } catch {
    metaphorModels.value = [];
  } finally {
    metaphorModelsLoading.value = false;
  }
}

function onMetaphorModelChange(value: string) {
  metaphorModelMenuOpen.value = false;
  if (value === '__open_metaphor_settings__') {
    metaphorModelSelection.value = getMetaphorConfig().model || 'opencode-v4f';
    close();
    playerStore.setMusicFull(false);
    void router.push({ path: '/set', query: { section: 'basic', focus: 'lyric-metaphor-ai' } });
    return;
  }
  metaphorModelSelection.value = value;
  const config = getMetaphorConfig();
  saveMetaphorConfig({ ...config, provider: 'gateway', model: value });
}

function closeMetaphorModelMenu(event: PointerEvent) {
  if (!metaphorModelMenuRef.value?.contains(event.target as Node)) {
    metaphorModelMenuOpen.value = false;
  }
}

type ControlSection =
  | 'playerStyle'
  | 'climax'
  | 'lyrics'
  | 'speed'
  | 'analysis'
  | 'sharing'
  | 'sleepTimer';

const expandedControlSections = ref<Set<ControlSection>>(new Set());
const isControlSectionExpanded = (section: ControlSection) =>
  expandedControlSections.value.has(section);

function toggleControlSection(section: ControlSection) {
  const next = new Set(expandedControlSections.value);
  if (next.has(section)) next.delete(section);
  else next.add(section);
  expandedControlSections.value = next;
}

function collapseControlSections() {
  expandedControlSections.value = new Set();
}

const settingsTabViewportRef = ref<HTMLElement | null>(null);
const settingsTabDragOffset = ref(0);
const settingsTabDragging = ref(false);
let settingsTabPointerId = -1;
let settingsTabStartX = 0;
let settingsTabStartY = 0;
let settingsTabAxis: 'none' | 'x' | 'y' = 'none';
let settingsTabSamples: Array<{ x: number; time: number }> = [];

const settingsTabIndex = (tab: 'song' | 'control') => (tab === 'song' ? 0 : 1);
const getSettingsTabPageStyle = (tab: 'song' | 'control') => {
  const pageDelta = settingsTabIndex(tab) - settingsTabIndex(activeTab.value);
  return {
    paddingBottom: 'calc(24px + var(--safe-area-inset-bottom, 0px))',
    transform: `translate3d(calc(${pageDelta * 100}% + ${settingsTabDragOffset.value}px), 0, 0)`,
    transition: settingsTabDragging.value
      ? 'none'
      : 'transform 340ms cubic-bezier(0.32, 0.72, 0, 1)',
    pointerEvents: tab === activeTab.value ? 'auto' : 'none'
  };
};

const isSettingsTabSwipeTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  !target.closest(
    'input, textarea, select, a, [role="slider"], [role="switch"], [data-horizontal-scroll], .n-slider, .climax-timeline, .climax-handle, .metaphor-model-picker'
  );

const pushSettingsTabSample = (x: number) => {
  const time = performance.now();
  settingsTabSamples.push({ x, time });
  settingsTabSamples = settingsTabSamples.filter((sample) => time - sample.time <= 100);
};

const settingsTabVelocity = () => {
  if (settingsTabSamples.length < 2) return 0;
  const first = settingsTabSamples[0];
  const last = settingsTabSamples[settingsTabSamples.length - 1];
  return (last.x - first.x) / Math.max(1, last.time - first.time);
};

const onTabPointerDown = (event: PointerEvent) => {
  if (!event.isPrimary || !isSettingsTabSwipeTarget(event.target)) return;
  settingsTabPointerId = event.pointerId;
  settingsTabStartX = event.clientX;
  settingsTabStartY = event.clientY;
  settingsTabAxis = 'none';
  settingsTabSamples = [{ x: event.clientX, time: performance.now() }];
  try {
    settingsTabViewportRef.value?.setPointerCapture(event.pointerId);
  } catch {
    // Older Android WebViews may not support pointer capture.
  }
};

const onTabPointerMove = (event: PointerEvent) => {
  if (event.pointerId !== settingsTabPointerId) return;
  const deltaX = event.clientX - settingsTabStartX;
  const deltaY = event.clientY - settingsTabStartY;
  if (settingsTabAxis === 'none' && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 8) {
    settingsTabAxis = Math.abs(deltaX) > Math.abs(deltaY) + 4 ? 'x' : 'y';
    if (settingsTabAxis === 'x') {
      settingsTabDragging.value = true;
      settingsTabViewportRef.value?.setPointerCapture(event.pointerId);
    }
  }
  if (settingsTabAxis !== 'x') return;
  event.preventDefault();
  pushSettingsTabSample(event.clientX);
  const activeIndex = settingsTabIndex(activeTab.value);
  const hitsBoundary = (activeIndex === 0 && deltaX > 0) || (activeIndex === 1 && deltaX < 0);
  settingsTabDragOffset.value = hitsBoundary ? deltaX * 0.24 : deltaX;
};

const finishTabPointer = (event: PointerEvent, cancelled = false) => {
  if (event.pointerId !== settingsTabPointerId) return;
  const width = settingsTabViewportRef.value?.clientWidth || window.innerWidth;
  const velocity = settingsTabVelocity();
  const projected = settingsTabDragOffset.value + velocity * 120;
  const direction = projected < 0 ? 1 : -1;
  const targetIndex = settingsTabIndex(activeTab.value) + direction;
  const shouldCommit =
    !cancelled &&
    targetIndex >= 0 &&
    targetIndex <= 1 &&
    (Math.abs(settingsTabDragOffset.value) >= width * 0.12 || Math.abs(velocity) >= 0.16);

  settingsTabDragging.value = false;
  if (shouldCommit) activeTab.value = targetIndex === 0 ? 'song' : 'control';
  settingsTabDragOffset.value = 0;
  if (settingsTabViewportRef.value?.hasPointerCapture(event.pointerId)) {
    settingsTabViewportRef.value.releasePointerCapture(event.pointerId);
  }
  settingsTabPointerId = -1;
  settingsTabAxis = 'none';
  settingsTabSamples = [];
};

const onTabPointerUp = (event: PointerEvent) => finishTabPointer(event);
const onTabPointerCancel = (event: PointerEvent) => finishTabPointer(event, true);
const currentSong = computed(() => playMusic.value || null);
const metadataEditorShow = ref(false);
// 本地歌曲：歌曲卡片下方展示当前音频参数（静态元数据 + 引擎实际解码格式）。
const localMusicStore = useLocalMusicStore();
const currentAudioParamSegments = computed(() => {
  const song = currentSong.value;
  if (!song || !isLocalSong(song)) return [] as string[];
  const entry = localMusicStore.musicList.find((meta) => meta.id === String(song.id));
  return formatAudioSegments({
    mime: activeAudioFormat.value?.sampleMimeType || entry?.mime,
    sampleRate: activeAudioFormat.value?.sampleRate || entry?.sampleRate,
    channelCount: activeAudioFormat.value?.channelCount,
    bitrate: activeAudioFormat.value?.bitrate || entry?.bitrate,
    fileSize: entry?.fileSize
  });
});
const settingsPlaylistExpanded = ref(false);
const currentArtists = computed(() => currentSong.value?.ar || currentSong.value?.artists || []);
const currentArtistText = computed(() =>
  Array.isArray(currentArtists.value)
    ? currentArtists.value
        .map((artist: any) => artist.name)
        .filter(Boolean)
        .join(' / ')
    : String(currentArtists.value || '')
);
const currentArtistId = computed(() =>
  Array.isArray(currentArtists.value) ? currentArtists.value[0]?.id : undefined
);
const currentAlbum = computed(
  () => currentSong.value?.al || currentSong.value?.album || currentSong.value?.song?.album || null
);
const currentIsFavorite = computed(() => {
  const id = currentSong.value?.id;
  return (
    id !== undefined &&
    playerStore.favoriteList.some((favoriteId) => String(favoriteId) === String(id))
  );
});

function playCurrentSong() {
  if (currentSong.value) void playerStore.setPlayMusic(true);
}

function playCurrentNext() {
  if (!currentSong.value) return;
  playerStore.addToNextPlay(currentSong.value);
  message?.success('已添加到下一首播放');
}

function openCurrentArtist() {
  if (!currentArtistId.value) return;
  playerStore.setFullLyricsVisible(false);
  playerStore.setMusicFull(false);
  navigateToArtist(Number(currentArtistId.value));
  close();
}

function openCurrentAlbum() {
  const album = currentAlbum.value;
  if (!album?.id || !album?.name) return;
  playerStore.setFullLyricsVisible(false);
  playerStore.setMusicFull(false);
  navigateToMusicList(router, {
    id: album.id,
    type: 'album',
    name: album.name,
    listInfo: album
  });
  close();
}

async function toggleCurrentFavorite() {
  const id = currentSong.value?.id;
  if (id === undefined) return;
  if (currentIsFavorite.value) await playerStore.removeFromFavorite(id);
  else await playerStore.addToFavorite(id);
}

// ==================== 手动高潮段落标记（时间轴拖拽） ====================
const currentPlayTime = computed(() => nowTime.value);
const songDuration = computed(
  () => (playMusic.value?.dt || playMusic.value?.duration || 0) / 1000 || 1
);
const manualClimaxSegments = ref<{ start: number; end: number }[]>([]);
const climaxTimelineRef = ref<HTMLElement | null>(null);

// 拖拽创建新段落
const isClimaxDragging = ref(false);
const climaxDragStart = ref(0);
const climaxDragEnd = ref(0);

// 边缘拖拽调整已有段落
const climaxEdgeDrag = ref<{
  segIndex: number;
  edge: 'start' | 'end';
  startTouchX: number;
  origStart: number;
  origEnd: number;
} | null>(null);

// 时间刻度
const climaxTimeMarks = computed(() => {
  const marks: number[] = [];
  const step = Math.max(10, Math.ceil(songDuration.value / 10));
  for (let t = 0; t <= songDuration.value; t += step) {
    marks.push(t);
  }
  return marks;
});

function formatTime(sec: number): string {
  if (!sec || sec < 0) return '0:00';
  return secondToMinute(sec);
}

function getClimaxRegionStyle(seg: { start: number; end: number }) {
  const left = (seg.start / songDuration.value) * 100;
  const width = ((seg.end - seg.start) / songDuration.value) * 100;
  return { left: `${left}%`, width: `${Math.max(0.5, width)}%` };
}

function getClimaxPreviewStyle() {
  const start = Math.min(climaxDragStart.value, climaxDragEnd.value);
  const end = Math.max(climaxDragStart.value, climaxDragEnd.value);
  const left = (start / songDuration.value) * 100;
  const width = ((end - start) / songDuration.value) * 100;
  return { left: `${left}%`, width: `${Math.max(0.5, width)}%` };
}

function touchToTime(e: TouchEvent): number {
  if (!climaxTimelineRef.value) return 0;
  const rect = climaxTimelineRef.value.getBoundingClientRect();
  const x = e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0;
  const ratio = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
  return ratio * songDuration.value;
}

// 时间轴拖拽创建新段落
function onTimelineTouchStart(e: TouchEvent) {
  if (climaxEdgeDrag.value) return;
  const t = touchToTime(e);
  isClimaxDragging.value = true;
  climaxDragStart.value = t;
  climaxDragEnd.value = t;
}

function onTimelineTouchMove(e: TouchEvent) {
  if (!isClimaxDragging.value) return;
  climaxDragEnd.value = touchToTime(e);
}

function onTimelineTouchEnd() {
  if (!isClimaxDragging.value) return;
  isClimaxDragging.value = false;
  const start = Math.min(climaxDragStart.value, climaxDragEnd.value);
  const end = Math.max(climaxDragStart.value, climaxDragEnd.value);
  if (end - start > 1) {
    addClimaxSegment(start, end);
  }
}

// 边缘拖拽调整
function onEdgeTouchStart(e: TouchEvent, segIndex: number, edge: 'start' | 'end') {
  const seg = manualClimaxSegments.value[segIndex];
  if (!seg) return;
  climaxEdgeDrag.value = {
    segIndex,
    edge,
    startTouchX: touchToTime(e),
    origStart: seg.start,
    origEnd: seg.end
  };
}

function onEdgeTouchMove(e: TouchEvent) {
  if (!climaxEdgeDrag.value) return;
  const currentX = touchToTime(e);
  const delta = currentX - climaxEdgeDrag.value.startTouchX;
  const segs = [...manualClimaxSegments.value];
  const seg = { ...segs[climaxEdgeDrag.value.segIndex] };

  if (climaxEdgeDrag.value.edge === 'start') {
    seg.start = Math.max(0, Math.min(seg.end - 0.5, climaxEdgeDrag.value.origStart + delta));
  } else {
    seg.end = Math.min(
      songDuration.value,
      Math.max(seg.start + 0.5, climaxEdgeDrag.value.origEnd + delta)
    );
  }
  segs[climaxEdgeDrag.value.segIndex] = seg;
  manualClimaxSegments.value = segs;
}

function onEdgeTouchEnd() {
  if (!climaxEdgeDrag.value) return;
  climaxEdgeDrag.value = null;
  saveManualClimax();
}

function addClimaxSegment(start: number, end: number) {
  const all = [...manualClimaxSegments.value, { start, end }].sort((a, b) => a.start - b.start);
  // 合并重叠段落
  const merged: { start: number; end: number }[] = [{ ...all[0] }];
  for (let i = 1; i < all.length; i++) {
    const last = merged[merged.length - 1];
    if (all[i].start <= last.end) {
      last.end = Math.max(last.end, all[i].end);
    } else {
      merged.push({ ...all[i] });
    }
  }
  manualClimaxSegments.value = merged;
  saveManualClimax();
}

function removeClimaxSegment(index: number) {
  manualClimaxSegments.value.splice(index, 1);
  saveManualClimax();
}

function clearAllClimaxSegments() {
  manualClimaxSegments.value = [];
  saveManualClimax();
}

function seekToPlayhead() {
  if (sound?.value) {
    audioService.seek(currentPlayTime.value);
  }
}

async function saveManualClimax() {
  const song = playMusic.value;
  if (!song) return;
  const songId = String(song.id);
  const segments = normalizeClimaxSegments(manualClimaxSegments.value, songDuration.value);
  manualClimaxSegments.value = segments.map((segment) => ({ ...segment }));
  manualClimaxSaveQueue = manualClimaxSaveQueue
    .catch(() => undefined)
    .then(() => saveLocalClimax(songId, { segments, contributor: '手动标记' }));
  await manualClimaxSaveQueue;
  if (String(playMusic.value?.id || '') !== songId) return;
  communityDataStore.currentSongId = songId;
  communityDataStore.climaxSegments = segments;
  communityDataStore.climaxContributor = '手动标记';
  climaxStore.updateSegments(segments, songId, '手动标记');
  styleEngine.setClimaxSegments(segments);
}

let manualClimaxSaveQueue: Promise<void> = Promise.resolve();

const uploadingClimax = ref(false);

async function uploadManualClimax() {
  const song = playMusic.value;
  if (!song || manualClimaxSegments.value.length === 0 || isLocalSong(song)) return;
  uploadingClimax.value = true;
  try {
    const remoteSongId = String(song.platformId || song.id);
    const response = await uploadClimax({
      songId: remoteSongId,
      songName: song.name || '',
      artist: song.ar?.map((artist) => artist.name).join('/') || '',
      album: song.al?.name || '',
      duration: songDuration.value,
      segments: manualClimaxSegments.value,
      contributorName: userStore.user?.nickname || 'Anonymous'
    });
    await Promise.all([
      deleteClimaxCache(remoteSongId),
      remoteSongId === String(song.id) ? Promise.resolve() : deleteClimaxCache(String(song.id))
    ]);
    cloudClimaxResults.value = [cloudResultFromEntry(response.entry, '刚刚上传')];
    cloudClimaxSearched.value = true;
    message?.success('高潮标注已上传到服务器');
  } catch (error) {
    console.error('[MobileClimax] 上传高潮标注失败:', error);
    message?.error('上传失败，请稍后重试');
  } finally {
    uploadingClimax.value = false;
  }
}

async function loadManualClimax() {
  const song = playMusic.value;
  if (!song) return;
  const songId = String(song.id);
  const data = await getLocalClimax(songId);
  if (String(playMusic.value?.id || '') !== songId) return;
  if (data != null) {
    manualClimaxSegments.value = normalizeClimaxSegments(data.segments, songDuration.value).map(
      (segment) => ({ ...segment })
    );
  } else {
    manualClimaxSegments.value = styleEngine.climaxSegments.map((s) => ({
      start: s.start,
      end: s.end
    }));
  }
}

// ==================== 云端高潮数据查询 ====================
interface CloudClimaxResult {
  songName: string;
  artist: string;
  segments: { start: number; end: number }[];
  contributor: string | null;
  source: string;
}

const cloudClimaxLoading = ref(false);
const cloudClimaxSearched = ref(false);
const cloudClimaxResults = ref<CloudClimaxResult[]>([]);

function cloudResultFromEntry(entry: ClimaxEntry, source = 'community'): CloudClimaxResult {
  return {
    songName: entry.song_name,
    artist: entry.artist,
    segments: normalizeClimaxSegments(entry.segments, entry.duration),
    contributor: entry.contributor_name || '社区用户',
    source
  };
}

async function queryCloudClimax() {
  const song = playMusic.value;
  if (!song?.name) return;

  cloudClimaxLoading.value = true;
  cloudClimaxSearched.value = false;
  cloudClimaxResults.value = [];

  try {
    const songName = song.name.trim();
    const remoteSongId = String(song.platformId || song.id);
    const [directResult, serverSongs] = await Promise.all([
      queryClimax(remoteSongId).catch((error) => {
        console.warn('[MobileClimax] 按歌曲 ID 查询失败:', error);
        return { entries: [], activeEntryId: null };
      }),
      searchServerSongs(songName, 10).catch((error) => {
        console.warn('[MobileClimax] 自有曲库搜索失败:', error);
        return [];
      })
    ]);
    const matched = serverSongs.filter((s) => s.name === songName);
    const results: CloudClimaxResult[] = [];
    const seen = new Set<string>();
    const pushResult = (result: CloudClimaxResult) => {
      if (result.segments.length === 0) return;
      const key = `${result.songName}|${result.artist}|${result.segments
        .map((segment) => `${segment.start}-${segment.end}`)
        .join(',')}`;
      if (seen.has(key)) return;
      seen.add(key);
      results.push(result);
    };

    // 1. 普通网易云 / QQ 歌曲按平台歌曲 ID 直接查询。
    for (const entry of directResult.entries) {
      pushResult(cloudResultFromEntry(entry));
    }

    // 2. 补充自有曲库 songs.json 中的高潮数据。
    for (const ss of matched) {
      if (ss.climax && ss.climax.length > 0) {
        const normalized = normalizeClimaxSegments(ss.climax, ss.duration);
        if (normalized.length > 0) {
          pushResult({
            songName: ss.name,
            artist: ss.artists.join(' / '),
            segments: normalized.map((s) => ({ start: s.start, end: s.end })),
            contributor: 'Zephyrus 云端',
            source: 'songs.json'
          });
        }
      }

      // 3. 查询自有曲库歌曲 ID 对应的社区标注。
      const communityResult = await loadClimaxForSong(ss.id);
      if (communityResult.segments && communityResult.segments.length > 0) {
        pushResult({
          songName: ss.name,
          artist: ss.artists.join(' / '),
          segments: communityResult.segments.map((s) => ({ start: s.start, end: s.end })),
          contributor: communityResult.contributor || '社区用户',
          source: 'community'
        });
      }
    }

    cloudClimaxResults.value = results;
    cloudClimaxSearched.value = true;
  } catch (err) {
    console.error('[MobileClimax] 查询云端高潮数据失败:', err);
    cloudClimaxSearched.value = true;
  } finally {
    cloudClimaxLoading.value = false;
  }
}

function applyCloudClimax(result: CloudClimaxResult) {
  manualClimaxSegments.value = result.segments.map((s) => ({ start: s.start, end: s.end }));
  saveManualClimax();
  cloudClimaxResults.value = [];
  cloudClimaxSearched.value = false;
}

watch(
  () => playMusic.value?.id,
  () => {
    cloudClimaxSearched.value = false;
    cloudClimaxResults.value = [];
    loadManualClimax();
  },
  { immediate: true }
);

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
  analyze: metaphorAnalyze
} = useMetaphor();

const sanitizedMetaphorResult = computed(() => {
  if (!metaphorResult.value) return '';
  try {
    const tokens = marked.lexer(metaphorResult.value, { breaks: true, gfm: true });
    const html = marked.parser(tokens);
    return DOMPurify.sanitize(html);
  } catch {
    return metaphorResult.value;
  }
});

const metaphorLoadingPhrases = [
  '正在品鉴',
  '正在解析',
  '正在聆听',
  '正在分析',
  '正在思考',
  '正在整理'
];
const metaphorElapsedSeconds = ref(0);
const metaphorLoadingPhraseIndex = ref(0);
const metaphorCopied = ref(false);
let metaphorLoadingTimer: ReturnType<typeof setInterval> | null = null;
const metaphorLoadingText = computed(
  () => metaphorLoadingPhrases[metaphorLoadingPhraseIndex.value] || metaphorLoadingPhrases[0]
);

function stopMetaphorLoadingTimer() {
  if (metaphorLoadingTimer) clearInterval(metaphorLoadingTimer);
  metaphorLoadingTimer = null;
}

watch(
  metaphorLoading,
  (active) => {
    stopMetaphorLoadingTimer();
    metaphorElapsedSeconds.value = 0;
    metaphorLoadingPhraseIndex.value = 0;
    if (!active) return;
    const startedAt = Date.now();
    metaphorLoadingTimer = setInterval(() => {
      metaphorElapsedSeconds.value = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      metaphorLoadingPhraseIndex.value =
        Math.floor(metaphorElapsedSeconds.value / 3) % metaphorLoadingPhrases.length;
    }, 250);
  },
  { immediate: true }
);

const metaphorPlainText = computed(() => {
  if (!metaphorResult.value) return '';
  const html = marked.parse(metaphorResult.value, { breaks: true, gfm: true }) as string;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\u00a0/g, ' ').trim();
});

async function copyMetaphorPlainText() {
  if (!metaphorPlainText.value) return;
  try {
    await navigator.clipboard.writeText(metaphorPlainText.value);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = metaphorPlainText.value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  metaphorCopied.value = true;
  window.setTimeout(() => (metaphorCopied.value = false), 1600);
}

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
function loadStoredLyricConfig(): LyricConfig {
  try {
    const saved = localStorage.getItem('music-full-config');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      ...DEFAULT_LYRIC_CONFIG,
      ...parsed,
      lyricAlignment: normalizeLyricAlignment(parsed.lyricAlignment, parsed.centerLyrics),
      lyricSwipeDirection: normalizeLyricSwipeDirection(parsed.lyricSwipeDirection),
      statusBarLyricConfig: normalizeStatusBarLyricConfig(
        parsed.statusBarLyricConfig,
        Boolean(parsed.statusBarLyricsEnabled)
      ),
      playerStyle: isMobilePlayerStyleKey(parsed.playerStyle) ? parsed.playerStyle : 'default'
    };
  } catch {
    return { ...DEFAULT_LYRIC_CONFIG };
  }
}

const lyricConfig = ref<LyricConfig>(loadStoredLyricConfig());
const settingsDragOffset = ref(0);
const settingsDragging = ref(false);
let settingsDragPointer = -1;
let settingsDragStart = 0;
const isLandscapeSettings = () => window.innerWidth > window.innerHeight;
const settingsDragStyle = computed(() => ({
  transform: isLandscapeSettings()
    ? `translate3d(${Math.max(0, settingsDragOffset.value)}px, 0, 0)`
    : `translate3d(0, ${Math.max(0, settingsDragOffset.value)}px, 0)`,
  transition: settingsDragging.value ? 'none' : 'transform 360ms cubic-bezier(0.32, 0.72, 0, 1)'
}));

const onSettingsDragStart = (event: PointerEvent) => {
  settingsDragging.value = true;
  settingsDragPointer = event.pointerId;
  settingsDragStart = isLandscapeSettings() ? event.clientX : event.clientY;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};
const onSettingsDragMove = (event: PointerEvent) => {
  if (!settingsDragging.value || event.pointerId !== settingsDragPointer) return;
  const current = isLandscapeSettings() ? event.clientX : event.clientY;
  settingsDragOffset.value = Math.max(0, current - settingsDragStart);
};
const onSettingsDragEnd = (event: PointerEvent) => {
  if (!settingsDragging.value || event.pointerId !== settingsDragPointer) return;
  settingsDragging.value = false;
  settingsDragPointer = -1;
  const threshold = isLandscapeSettings() ? window.innerWidth * 0.18 : window.innerHeight * 0.14;
  if (settingsDragOffset.value >= threshold) close();
  settingsDragOffset.value = 0;
};

watch(
  lyricConfig,
  (value) => {
    localStorage.setItem('music-full-config', JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('music-full-config-updated'));
  },
  { deep: true }
);

const playerStyles = computed<
  Array<{ key: MobilePlayerStyleKey; label: string; icon: string; color: string }>
>(() => [
  {
    key: 'default' as const,
    label: tr('player.styles.default', '默认'),
    icon: 'ri-music-2-line',
    color: '#6366f1'
  },
  {
    key: 'stage' as const,
    label: tr('player.styles.stage', '舞台'),
    icon: 'ri-spotify-line',
    color: '#ec4899'
  },
  {
    key: 'starChart' as const,
    label: tr('player.styles.starChart', '星盘'),
    icon: 'ri-record-circle-line',
    color: 'var(--accent-color, #a0a0a0)'
  },
  {
    key: 'frenzy' as const,
    label: tr('player.styles.frenzy', '狂热'),
    icon: 'ri-fire-line',
    color: '#ef4444'
  },
  {
    key: 'eerie' as const,
    label: tr('player.styles.eerie', '诡谲'),
    icon: 'ri-ghost-line',
    color: '#8b5cf6'
  },
  {
    key: 'neon' as const,
    label: tr('player.styles.neon', '陈旧'),
    icon: 'ri-lightbulb-flash-line',
    color: '#c9a96e'
  },
  {
    key: 'rain' as const,
    label: tr('player.styles.rain', '雨夜'),
    icon: 'ri-rainy-line',
    color: '#3b82f6'
  },
  {
    key: 'smoke' as const,
    label: tr('player.styles.smoke', '烟雾'),
    icon: 'ri-cloudy-line',
    color: '#14b8a6'
  }
]);

const currentPlayerStyle = computed<MobilePlayerStyleKey>(() =>
  isMobilePlayerStyleKey(lyricConfig.value.playerStyle) ? lyricConfig.value.playerStyle : 'default'
);

const setPlayerStyle = (style: MobilePlayerStyleKey) => {
  lyricConfig.value.playerStyle = style;
  localStorage.setItem('music-full-config', JSON.stringify(lyricConfig.value));
  window.dispatchEvent(new CustomEvent('music-full-config-updated'));
};

// ==================== 自定义效果配置 ====================
const styleConfig = ref<PlayerStyleCustomConfig>(createPlayerStyleConfig('default'));
let suppressStyleSave = false;

function loadStyleConfig() {
  try {
    const saved = localStorage.getItem('music-full-config');
    const config = saved ? JSON.parse(saved) : {};
    const allConfigs = config.styleCustomConfig || {};
    const styleKey = isMobilePlayerStyleKey(config.playerStyle) ? config.playerStyle : 'default';
    styleConfig.value = resolvePlayerStyleConfig(styleKey, allConfigs[styleKey]);
  } catch {
    // 忽略配置读取失败
  }
}

function resetCurrentStyleConfig() {
  try {
    suppressStyleSave = true;
    if (lyricConfig.value.styleCustomConfig) {
      delete lyricConfig.value.styleCustomConfig[currentPlayerStyle.value];
    }
    styleConfig.value = createPlayerStyleConfig(currentPlayerStyle.value);
    localStorage.setItem('music-full-config', JSON.stringify(lyricConfig.value));
    window.dispatchEvent(new CustomEvent('music-full-config-updated'));
    void nextTick(() => {
      suppressStyleSave = false;
    });
  } catch (error) {
    console.error('还原样式配置失败:', error);
  }
}

function saveStyleConfig() {
  if (suppressStyleSave) return;
  try {
    if (!lyricConfig.value.styleCustomConfig) lyricConfig.value.styleCustomConfig = {};
    lyricConfig.value.styleCustomConfig[currentPlayerStyle.value] = {
      ...styleConfig.value,
      customFontName: styleConfig.value.customFontName
    };
    localStorage.setItem('music-full-config', JSON.stringify(lyricConfig.value));
    window.dispatchEvent(new CustomEvent('music-full-config-updated'));
  } catch (e) {
    console.error('保存自定义配置失败:', e);
  }
}

watch(styleConfig, () => saveStyleConfig(), { deep: true });
watch(currentPlayerStyle, () => loadStyleConfig(), { immediate: true });

loadStyleConfig();

// ==================== 歌词设置 ====================
const lyricAlignmentOptions = computed(() => [
  {
    value: 'left' as const,
    label: tr('settings.lyricSettings.alignmentLeft', '左对齐'),
    icon: 'ri-align-left'
  },
  {
    value: 'center' as const,
    label: tr('settings.lyricSettings.alignmentCenter', '居中'),
    icon: 'ri-align-center'
  },
  {
    value: 'right' as const,
    label: tr('settings.lyricSettings.alignmentRight', '右对齐'),
    icon: 'ri-align-right'
  }
]);

function setLyricAlignment(alignment: LyricAlignment) {
  lyricConfig.value.lyricAlignment = alignment;
  lyricConfig.value.centerLyrics = alignment === 'center';
}

const lyricSwipeOptions: Array<{ value: LyricSwipeDirection; label: string }> = [
  { value: 'none', label: '关闭' },
  { value: 'left', label: '左划' },
  { value: 'right', label: '右划' }
];

function setLyricSwipeDirection(direction: LyricSwipeDirection) {
  lyricConfig.value.lyricSwipeDirection = direction;
}

function toggleShowTranslation() {
  lyricConfig.value.showTranslation = !lyricConfig.value.showTranslation;
  localStorage.setItem('music-full-config', JSON.stringify(lyricConfig.value));
  window.dispatchEvent(new CustomEvent('music-full-config-updated'));
}

function toggleShowRomanization() {
  lyricConfig.value.showRomanization = !lyricConfig.value.showRomanization;
  localStorage.setItem('music-full-config', JSON.stringify(lyricConfig.value));
  window.dispatchEvent(new CustomEvent('music-full-config-updated'));
}

function toggleStatusBarLyrics() {
  lyricConfig.value.statusBarLyricsEnabled = !lyricConfig.value.statusBarLyricsEnabled;
  lyricConfig.value.statusBarLyricConfig = normalizeStatusBarLyricConfig(
    {
      ...lyricConfig.value.statusBarLyricConfig,
      enabled: lyricConfig.value.statusBarLyricsEnabled
    },
    lyricConfig.value.statusBarLyricsEnabled
  );
  localStorage.setItem('music-full-config', JSON.stringify(lyricConfig.value));
  window.dispatchEvent(new CustomEvent('music-full-config-updated'));
  if (lyricConfig.value.statusBarLyricsEnabled && !hasStatusBarLyricPermission()) {
    requestStatusBarLyricPermission();
    message?.info('请允许 Zephyrus 显示在其他应用上层');
  }
  void nextTick(refreshStatusBarLyric);
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
const props = withDefaults(
  defineProps<{
    visible: boolean;
    embedded?: boolean;
  }>(),
  { embedded: false }
);

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
}>();

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      collapseControlSections();
      void loadMetaphorModels();
    }
  },
  { immediate: true }
);

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
  settingsDragOffset.value = 0;
  settingsPlaylistExpanded.value = false;
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
  document.addEventListener('pointerdown', closeMetaphorModelMenu);
  if (hasTimerActive.value && sleepTimer.value.type === 'time') {
    startTimerUpdate();
  }
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', closeMetaphorModelMenu);
  stopTimerUpdate();
  stopMetaphorLoadingTimer();
});
</script>

<style scoped>
.player-settings-overlay {
  z-index: 100200 !important;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.player-settings-overlay.embedded {
  position: absolute !important;
  inset: 0;
  z-index: auto !important;
  display: block;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.player-settings-overlay.embedded .player-settings-surface {
  width: 100%;
  max-width: none;
  height: 100%;
  max-height: none;
  padding-top: 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.player-settings-surface {
  border: 1px solid var(--player-glass-border, rgba(255, 255, 255, 0.24));
  border-bottom: 0;
  border-radius: 30px 30px 0 0;
  background: var(--player-glass-background, rgba(20, 20, 22, 0.22));
  box-shadow:
    0 -8px 20px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
  backdrop-filter: var(--player-glass-filter, blur(12px) saturate(145%));
  -webkit-backdrop-filter: var(--player-glass-filter, blur(12px) saturate(145%));
  touch-action: pan-y;
}

.settings-tab-viewport {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  /* Vertical scrolling remains native; horizontal movement is owned by the
     tab pager so Android WebView cannot steal the gesture before pointermove. */
  touch-action: pan-y;
}

.settings-tab-page {
  position: absolute;
  inset: 0;
  overscroll-behavior: contain;
  will-change: transform;
  touch-action: pan-y;
}

@media (prefers-reduced-motion: reduce) {
  .settings-tab-page {
    transition-duration: 160ms !important;
  }
}

@supports not (backdrop-filter: blur(1px)) {
  .player-settings-surface {
    background: var(--player-glass-background-fallback, rgba(24, 24, 26, 0.52));
  }
}

.settings-drag-region {
  cursor: grab;
  touch-action: none;
}

@media (orientation: landscape) {
  .player-settings-overlay {
    align-items: stretch !important;
    justify-content: flex-end !important;
  }
  .player-settings-surface {
    width: min(430px, 48vw) !important;
    max-height: 100dvh !important;
    border-right: 0;
    border-bottom: 1px solid color-mix(in srgb, #fff 22%, transparent);
    border-radius: 30px 0 0 30px;
  }

  .player-settings-overlay.embedded .player-settings-surface {
    width: 100% !important;
    max-height: none !important;
    border: 0;
    border-radius: 0;
  }
}

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

/* 控制页可折叠设置分组 */
.control-settings-section {
  margin-bottom: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.035);
  transition:
    background-color 220ms ease,
    border-color 220ms ease;

  /* Keep the container radius stable. Only the content below the header
     extends vertically, which prevents the giant-radius interpolation. */
  &:not(.expanded) {
    background: rgba(255, 255, 255, 0.055);
  }
}

.control-section-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 52px;
  padding: 0 14px;
  border: 0;
  color: rgba(255, 255, 255, 0.82);
  background: transparent;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
}

.control-section-header:active {
  background: rgba(255, 255, 255, 0.08);
}

.control-section-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

.control-section-title > i:first-child {
  width: 20px;
  flex: 0 0 20px;
  color: var(--accent-color-light, rgba(255, 255, 255, 0.7));
  font-size: 18px;
  text-align: center;
}

.control-section-summary {
  color: rgba(255, 255, 255, 0.42);
  font-size: 12px;
  white-space: nowrap;
}

.control-section-summary.accent {
  color: var(--accent-color-light);
  font-size: 13px;
  font-weight: 600;
}

.control-section-chevron {
  color: rgba(255, 255, 255, 0.5);
  font-size: 20px;
  transition:
    transform 180ms ease,
    color 180ms ease;
}

.control-section-chevron.expanded {
  transform: rotate(180deg);
  color: rgba(255, 255, 255, 0.82);
}

.control-section-reveal {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transform: translate3d(0, -5px, 0) scale(0.995);
  transform-origin: top center;
  transition:
    grid-template-rows 360ms cubic-bezier(0.22, 0.8, 0.2, 1),
    max-height 360ms cubic-bezier(0.22, 0.8, 0.2, 1),
    opacity 180ms ease-out,
    transform 360ms cubic-bezier(0.22, 0.8, 0.2, 1);
  will-change: grid-template-rows, opacity, transform;
  max-height: 0;
  overflow: hidden;
}

.control-section-reveal.expanded {
  grid-template-rows: 1fr;
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
  max-height: 5000px;
  overflow: visible;
}

.control-section-body {
  min-height: 0;
  overflow: visible;
  padding: 0 14px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.control-section-actions {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 8px;
  min-height: 34px;
  padding-top: 10px;
}

.metaphor-model-picker {
  position: relative;
  z-index: 40;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.055);
  box-shadow: none;
  backdrop-filter: blur(24px) saturate(1.25);
  -webkit-backdrop-filter: blur(24px) saturate(1.25);
  transition:
    border-radius 300ms cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

.metaphor-model-picker.expanded {
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.07);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.16);
}

.metaphor-model-trigger {
  display: flex;
  width: 100%;
  height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 14px;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  text-align: left;
}

.metaphor-model-trigger span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metaphor-model-trigger i {
  flex: 0 0 auto;
  transition: transform 240ms cubic-bezier(0.32, 0.72, 0, 1);
}

.metaphor-model-trigger i.open {
  transform: rotate(180deg);
}

.metaphor-model-menu {
  display: grid;
  gap: 3px;
  max-height: 0;
  padding: 0 6px;
  overflow: hidden;
  opacity: 0;
  transform: translate3d(0, -4px, 0);
  transition:
    max-height 320ms cubic-bezier(0.32, 0.72, 0, 1),
    padding 320ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 180ms ease,
    transform 320ms cubic-bezier(0.32, 0.72, 0, 1);
}

.metaphor-model-menu.visible {
  max-height: 270px;
  padding: 0 6px 6px;
  overflow-y: auto;
  opacity: 1;
  transform: translate3d(0, 0, 0);
}

.metaphor-model-option {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  text-align: left;
}

.metaphor-model-option.active {
  background: color-mix(in srgb, var(--accent-color) 30%, transparent);
  color: #fff;
}

.metaphor-analyze-button {
  flex: 0 0 auto;
  height: 42px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 21px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.74);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.metaphor-analyze-button.primary {
  border-color: transparent;
  background: var(--accent-color);
  color: #fff;
}

.metaphor-analyze-button:disabled { opacity: 0.48; }

.metaphor-model-option.settings {
  margin-top: 3px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0 0 16px 16px;
  color: var(--accent-color-light, #fff);
}

@media (prefers-reduced-motion: reduce) {
  .control-section-reveal {
    transform: none;
    transition:
      grid-template-rows 120ms linear,
      opacity 120ms linear;
  }

  .control-section-chevron {
    transition-duration: 120ms;
  }

  .metaphor-model-picker,
  .metaphor-model-menu {
    transition-duration: 120ms;
  }
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

.song-setting-action {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 52px;
  padding: 0 16px;
  color: rgba(255, 255, 255, 0.82);
  background: transparent;
  border: 0;
  text-align: left;
  transition: background-color 150ms ease;
}

.metaphor-stream-text {
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.7;
}

.metaphor-output-scroll {
  max-height: min(44vh, 560px);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 4px;
  -webkit-overflow-scrolling: touch;
}

.metaphor-loading-label {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.72);
}

.metaphor-loading-time {
  margin-top: 5px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.38);
  font-variant-numeric: tabular-nums;
}

.metaphor-stream-status {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: -4px 0 12px;
  padding: 7px 10px;
  border-radius: 12px;
  background: rgba(20, 18, 18, 0.82);
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.metaphor-result {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  line-height: 1.78;
  overflow-wrap: anywhere;
}

.metaphor-result :deep(h1) {
  margin: 22px 0 12px;
  color: rgba(255, 255, 255, 0.98);
  font-size: 24px;
  font-weight: 750;
  line-height: 1.25;
}

.metaphor-result :deep(h2) {
  margin: 20px 0 10px;
  color: rgba(255, 255, 255, 0.95);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.32;
}

.metaphor-result :deep(h3) {
  margin: 17px 0 8px;
  color: rgba(255, 255, 255, 0.92);
  font-size: 17px;
  font-weight: 680;
  line-height: 1.4;
}

.metaphor-result :deep(p) { margin: 0 0 13px; }
.metaphor-result :deep(strong) { color: #fff; font-weight: 700; }
.metaphor-result :deep(ul),
.metaphor-result :deep(ol) { margin: 10px 0 14px; padding-left: 22px; }
.metaphor-result :deep(ul) { list-style: disc; }
.metaphor-result :deep(ol) { list-style: decimal; }
.metaphor-result :deep(li) { margin: 5px 0; }
.metaphor-result :deep(blockquote) {
  margin: 14px 0;
  padding: 8px 12px;
  border-left: 3px solid var(--accent-color-light, #fff);
  border-radius: 0 10px 10px 0;
  background: rgba(255, 255, 255, 0.055);
  color: rgba(255, 255, 255, 0.62);
}
.metaphor-result :deep(code) {
  padding: 2px 5px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 0.9em;
}
.metaphor-result :deep(hr) {
  margin: 18px 0;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.metaphor-result-actions {
  display: flex;
  justify-content: flex-end;
  padding: 10px 0 2px;
}

.metaphor-copy-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.76);
}

.typing-caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -0.12em;
  border-radius: 1px;
  background: var(--accent-color-light, #fff);
  animation: metaphor-caret-blink 720ms steps(1, end) infinite;
}

@keyframes metaphor-caret-blink {
  50% {
    opacity: 0;
  }
}

.settings-song-link {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  transition:
    color 140ms ease,
    opacity 140ms ease;

  &:active {
    opacity: 0.62;
  }

  &:hover {
    color: var(--accent-color-light, #fff);
  }
}

.current-audio-params {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
}

.current-audio-params span {
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.current-audio-edit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border: 1px solid color-mix(in srgb, var(--accent-color) 34%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-color) 14%, transparent);
  color: var(--accent-color);
  font-size: 11px;
  font-weight: 500;

  i {
    font-size: 12px;
  }

  &:active {
    transform: scale(0.96);
  }
}

.song-setting-action + .song-setting-action {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.song-setting-action:active {
  background: rgba(255, 255, 255, 0.1);
}

.song-setting-action > i:first-child {
  width: 24px;
  color: var(--accent-color-light, rgba(255, 255, 255, 0.7));
  font-size: 20px;
  text-align: center;
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

.lyric-alignment-control {
  display: grid;
  grid-template-columns: repeat(3, 34px);
  flex-shrink: 0;
  gap: 2px;
  padding: 2px;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.24);
}

.lyric-alignment-control button {
  display: grid;
  width: 34px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: rgba(255, 255, 255, 0.48);
  font-size: 17px;
  place-items: center;
}

.lyric-alignment-control button.active {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.lyric-swipe-control {
  display: grid;
  grid-template-columns: repeat(3, auto);
  flex-shrink: 0;
  gap: 2px;
  padding: 2px;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.24);
}

.lyric-swipe-control button {
  min-width: 42px;
  height: 30px;
  padding: 0 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: rgba(255, 255, 255, 0.48);
  font-size: 12px;
}

.lyric-swipe-control button.active {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

/* ==================== 高潮段落时间轴 ==================== */
.climax-timeline-wrapper {
  position: relative;
  user-select: none;
  -webkit-user-select: none;
}

.climax-time-scale {
  position: relative;
  height: 16px;
  margin-bottom: 4px;
}

.climax-time-mark {
  position: absolute;
  transform: translateX(-50%);
  font-size: 9px;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.climax-timeline {
  position: relative;
  height: 48px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: visible;
  touch-action: none;
}

.climax-region {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 32px;
  background: rgba(255, 200, 50, 0.35);
  border-radius: 16px;
  display: flex;
  align-items: center;
  z-index: 2;
  transition: background 0.2s ease;
}

.climax-region-active {
  background: rgba(255, 200, 50, 0.6);
}

.climax-handle {
  width: 16px;
  height: 100%;
  flex-shrink: 0;
  position: relative;
  z-index: 3;
  touch-action: none;
}

.climax-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 18px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 2px;
}

.climax-handle.left::after {
  left: 5px;
}

.climax-handle.right::after {
  right: 5px;
}

.climax-region-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  pointer-events: auto;
}

.climax-region-label {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.climax-region-remove {
  position: absolute;
  top: -9px;
  right: -9px;
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  color: #fff;
  background: rgba(15, 15, 15, 0.86);
  font-size: 12px;
}

.climax-preview {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 32px;
  background: rgba(255, 200, 50, 0.25);
  border-radius: 16px;
  pointer-events: none;
  z-index: 1;
}

.climax-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #ef4444;
  transform: translateX(-1px);
  pointer-events: none;
  z-index: 5;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
}
</style>
