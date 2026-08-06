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

          <!-- 内容区域 -->
          <div
            v-if="activeTab === 'control'"
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

            <player-style-customization-panel
              :key="currentPlayerStyle"
              v-model="styleConfig"
              :style-key="currentPlayerStyle"
              @reset="resetCurrentStyleConfig"
            />

            <!-- 分隔线 -->
            <div class="h-px bg-white/10 my-5"></div>

            <!-- 手动标记高潮段落 -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-white/80">
                  <i class="ri-fire-line mr-1"></i>
                  高潮段落标记
                </span>
                <span class="text-xs text-white/40">{{ manualClimaxSegments.length }} 段</span>
              </div>

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
                    manualClimaxSegments.length === 0 || uploadingClimax || isLocalSong(playMusic)
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
                      {{ result.artist || '未知艺术家' }} · {{ result.segments.length }}段 · 贡献者:
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

            <!-- 分隔线 -->
            <div class="h-px bg-white/10 my-5"></div>
          </div>

          <div
            v-else
            class="flex-1 overflow-y-auto px-5 pb-6"
            :style="{ paddingBottom: `calc(24px + var(--safe-area-inset-bottom, 0px))` }"
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
                  <div class="mt-1 truncate text-sm text-white/50">
                    {{ currentArtistText || '未知艺术家' }}
                  </div>
                  <div v-if="currentAlbum?.name" class="mt-1 truncate text-xs text-white/35">
                    {{ currentAlbum.name }}
                  </div>
                </div>
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
                <button class="song-setting-action" @click="addCurrentToPlaylist">
                  <i class="ri-folder-add-line"></i><span>添加到歌单</span>
                </button>
                <button class="song-setting-action" @click="toggleCurrentFavorite">
                  <i :class="currentIsFavorite ? 'ri-heart-fill text-red-400' : 'ri-heart-line'"></i
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
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { storeToRefs } from 'pinia';
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { loadClimaxForSong, normalizeClimaxSegments, uploadClimax } from '@/api/climax';
import { searchServerSongs } from '@/api/serverSongs';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlayerStyleCustomizationPanel from '@/components/player/PlayerStyleCustomizationPanel.vue';
import { createPlayerStyleConfig, resolvePlayerStyleConfig } from '@/config/playerStyleConfig';
import { useMetaphor } from '@/features/lyric-metaphor/useMetaphor';
import { lrcArray, nowTime, playMusic, sound } from '@/hooks/MusicHook';
import { useArtist } from '@/hooks/useArtist';
import { isLocalSong } from '@/hooks/useLocalMusic';
import { getLocalClimax, saveLocalClimax } from '@/services/cacheService';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { useUserStore } from '@/store/modules/user';
import type { LyricConfig } from '@/types/lyric';
import { DEFAULT_LYRIC_CONFIG } from '@/types/lyric';
import type { SongResult } from '@/types/music';
import type { MobilePlayerStyleKey, PlayerStyleCustomConfig } from '@/types/playerStyle';
import { isMobilePlayerStyleKey } from '@/types/playerStyle';
import { getImgUrl, secondToMinute } from '@/utils';

const { t } = useI18n();
const router = useRouter();
const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const userStore = useUserStore();
const { navigateToArtist } = useArtist();
const message = window.$message;
const activeTab = ref<'song' | 'control'>('control');
const openPlaylistDrawer = inject<(songOrId: number | SongResult) => void>('openPlaylistDrawer');

const currentSong = computed(() => playMusic.value || null);
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
  navigateToArtist(Number(currentArtistId.value));
  close();
}

function openCurrentAlbum() {
  const album = currentAlbum.value;
  if (!album?.id || !album?.name) return;
  navigateToMusicList(router, {
    id: album.id,
    type: 'album',
    name: album.name,
    listInfo: album
  });
  close();
}

function addCurrentToPlaylist() {
  if (!currentSong.value) return;
  openPlaylistDrawer?.(currentSong.value);
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
    sound.value.seek(currentPlayTime.value);
  }
}

async function saveManualClimax() {
  const song = playMusic.value;
  if (!song) return;
  const songId = String(song.id);
  const segments = manualClimaxSegments.value.map((s) => ({ start: s.start, end: s.end }));
  await saveLocalClimax(songId, { segments, contributor: '手动标记' });
  styleEngine.climaxSegments = segments as any;
}

const uploadingClimax = ref(false);

async function uploadManualClimax() {
  const song = playMusic.value;
  if (!song || manualClimaxSegments.value.length === 0 || isLocalSong(song)) return;
  uploadingClimax.value = true;
  try {
    await uploadClimax({
      songId: String(song.platformId || song.id),
      songName: song.name || '',
      artist: song.ar?.map((artist) => artist.name).join('/') || '',
      album: song.al?.name || '',
      duration: songDuration.value,
      segments: manualClimaxSegments.value,
      contributorName: userStore.user?.nickname || 'Anonymous'
    });
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
  if (data?.segments?.length) {
    manualClimaxSegments.value = data.segments.map((s) => ({ start: s.start, end: s.end }));
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

async function queryCloudClimax() {
  const song = playMusic.value;
  if (!song?.name) return;

  cloudClimaxLoading.value = true;
  cloudClimaxSearched.value = false;
  cloudClimaxResults.value = [];

  try {
    const songName = song.name.trim();
    const serverSongs = await searchServerSongs(songName, 10);
    const matched = serverSongs.filter((s) => s.name === songName);
    const results: CloudClimaxResult[] = [];

    // 1. 收集 songs.json 中自带的高潮数据
    for (const ss of matched) {
      if (ss.climax && ss.climax.length > 0) {
        const normalized = normalizeClimaxSegments(ss.climax, ss.duration);
        if (normalized.length > 0) {
          results.push({
            songName: ss.name,
            artist: ss.artists.join(' / '),
            segments: normalized.map((s) => ({ start: s.start, end: s.end })),
            contributor: 'Zephyrus 云端',
            source: 'songs.json'
          });
        }
      }

      // 2. 查询社区标注的高潮数据
      const communityResult = await loadClimaxForSong(ss.id);
      if (communityResult.segments && communityResult.segments.length > 0) {
        results.push({
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
function loadStoredLyricConfig(): LyricConfig {
  try {
    const saved = localStorage.getItem('music-full-config');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      ...DEFAULT_LYRIC_CONFIG,
      ...parsed,
      playerStyle: isMobilePlayerStyleKey(parsed.playerStyle) ? parsed.playerStyle : 'default'
    };
  } catch {
    return { ...DEFAULT_LYRIC_CONFIG };
  }
}

const lyricConfig = ref<LyricConfig>(loadStoredLyricConfig());

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
    key: 'magazine' as const,
    label: tr('player.styles.magazine', '杂志'),
    icon: 'ri-layout-grid-line',
    color: '#f59e0b'
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
