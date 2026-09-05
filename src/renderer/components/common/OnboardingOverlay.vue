<template>
  <Teleport to="body">
    <Transition name="onboarding-fade">
      <div
        v-if="visible"
        ref="onboardingRootRef"
        class="onboarding-root"
        :class="{ 'light-theme': onboardingTheme === 'light' }"
      >
        <!-- 背景遮罩 -->
        <div class="onboarding-scrim"></div>
        <!-- accent 双光晕：随步骤切换位置，产生空间推进感 -->
        <div class="onboarding-glow onboarding-glow-a" :style="glowStyleA"></div>
        <div class="onboarding-glow onboarding-glow-b" :style="glowStyleB"></div>
        <!-- 主题切换：从点击位置向外扩散为新主题底色 -->
        <div
          v-if="themeReveal"
          class="onboarding-theme-reveal"
          :style="{
            background: themeReveal.color,
            clipPath: themeRevealClip,
            opacity: themeRevealFading ? 0 : 1
          }"
        ></div>

        <!-- 顶栏：返回 + 步骤进度 -->
        <header class="onboarding-header">
          <button
            v-if="currentIndex > 0"
            type="button"
            class="onboarding-back"
            :aria-label="tr('settings.onboarding.back', '上一步')"
            @click="goPrev"
          >
            <i class="ri-arrow-left-s-line"></i>
          </button>
          <span v-else class="onboarding-header-spacer"></span>
          <span v-if="currentStep.configurable" class="onboarding-progress">
            {{ stepProgressText }}
          </span>
          <span class="onboarding-header-spacer"></span>
        </header>

        <!-- 步骤轨道：pointer 跟手 + 速度投影翻页 -->
        <div
          ref="viewportRef"
          class="onboarding-viewport"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @click.capture="suppressDragClick"
        >
          <div ref="trackRef" class="onboarding-track" :style="trackStyle">
            <!-- Step 1: 欢迎 -->
            <section class="onboarding-page" :class="{ active: isStepActive('welcome') }">
              <div class="onboarding-page-inner">
                <div class="onboarding-hero-icon" style="--i: 0">
                  <i class="ri-music-2-line"></i>
                </div>
                <div class="onboarding-greeting" style="--i: 1" aria-hidden="true">
                  <Transition name="greeting" mode="out-in">
                    <span :key="greetingIndex" class="onboarding-greeting-word">
                      <span
                        v-for="(char, charIndex) in greetingChars"
                        :key="charIndex"
                        class="greeting-char"
                        :style="{ '--d': `${charIndex * 55}ms` }"
                        >{{ char }}</span
                      >
                    </span>
                  </Transition>
                </div>
                <h2 class="onboarding-title" style="--i: 2">
                  {{ tr('settings.onboarding.welcomeTitle', '欢迎使用 Zephyrus') }}
                </h2>
                <p class="onboarding-desc" style="--i: 3">
                  {{
                    tr('settings.onboarding.welcomeSubtitle', '只需一分钟，完成专属你的播放器设置')
                  }}
                </p>
                <ul class="onboarding-feature-list" style="--i: 4">
                  <li>
                    <i class="ri-search-line"></i
                    >{{ tr('settings.onboarding.featureSearch', '多平台搜索，点击即听') }}
                  </li>
                  <li>
                    <i class="ri-fire-line"></i
                    >{{ tr('settings.onboarding.featureStyles', '9 种播放器样式与逐字歌词') }}
                  </li>
                  <li>
                    <i class="ri-folder-music-line"></i
                    >{{ tr('settings.onboarding.featureLocal', '支持导入本地音乐') }}
                  </li>
                </ul>
              </div>
            </section>

            <!-- Step 2: 用户协议（未同意过时出现在欢迎页之后，不可跳过） -->
            <section class="onboarding-page" :class="{ active: isStepActive('agreement') }">
              <div class="onboarding-page-inner onboarding-agreement-inner">
                <h2 class="onboarding-title" style="--i: 0">
                  {{ tr('settings.onboarding.agreementTitle', '用户协议') }}
                </h2>
                <p class="onboarding-desc" style="--i: 1">
                  {{ tr('settings.onboarding.agreementDesc', '请阅读并同意协议后继续') }}
                </p>
                <div class="onboarding-agreement-card" style="--i: 2">
                  <div class="onboarding-agreement-body" v-html="agreementHtml"></div>
                </div>
                <button
                  type="button"
                  class="onboarding-agreement-decline"
                  style="--i: 3"
                  @click="handleAgreementDecline"
                >
                  {{ tr('settings.onboarding.agreementDecline', '不同意，退出应用') }}
                </button>
              </div>
            </section>

            <!-- Step 3: 语言 -->
            <section class="onboarding-page" :class="{ active: isStepActive('language') }">
              <div class="onboarding-page-inner">
                <h2 class="onboarding-title" style="--i: 0">
                  {{ tr('settings.onboarding.languageTitle', '选择语言') }}
                </h2>
                <p class="onboarding-desc" style="--i: 1">
                  {{ tr('settings.onboarding.languageDesc', '可随时在设置中更改') }}
                </p>
                <div class="onboarding-option-grid" style="--i: 2">
                  <button
                    v-for="lang in languageOptions"
                    :key="lang.id"
                    type="button"
                    class="onboarding-option-card"
                    :class="{ selected: selectedLanguage === lang.id }"
                    @click="selectLanguage(lang.id)"
                  >
                    <span class="onboarding-option-label">{{ lang.native }}</span>
                    <i v-if="selectedLanguage === lang.id" class="ri-check-line"></i>
                  </button>
                </div>
              </div>
            </section>

            <!-- Step 3: 主题 -->
            <section class="onboarding-page" :class="{ active: isStepActive('theme') }">
              <div class="onboarding-page-inner">
                <h2 class="onboarding-title" style="--i: 0">
                  {{ tr('settings.onboarding.themeTitle', '选择外观') }}
                </h2>
                <p class="onboarding-desc" style="--i: 1">
                  {{ tr('settings.onboarding.themeDesc', '深色、浅色，或跟随系统') }}
                </p>
                <div class="onboarding-option-grid" style="--i: 2">
                  <button
                    v-for="option in themeOptions"
                    :key="option.value"
                    type="button"
                    class="onboarding-option-card theme"
                    :class="{ selected: selectedTheme === option.value }"
                    @click="onThemeCardClick(option.value, $event)"
                  >
                    <i :class="option.icon" class="onboarding-option-icon"></i>
                    <span class="onboarding-option-label">{{ option.label }}</span>
                    <i v-if="selectedTheme === option.value" class="ri-check-line"></i>
                  </button>
                </div>
              </div>
            </section>

            <!-- Step 4: 本地音乐文件夹（仅 Android） -->
            <section
              v-if="showAndroidSteps"
              class="onboarding-page"
              :class="{ active: isStepActive('localFolder') }"
            >
              <div class="onboarding-page-inner">
                <div class="onboarding-step-icon" style="--i: 0">
                  <i class="ri-folder-music-line"></i>
                </div>
                <h2 class="onboarding-title" style="--i: 1">
                  {{ tr('settings.onboarding.folderTitle', '导入本地音乐') }}
                </h2>
                <p class="onboarding-desc" style="--i: 2">
                  {{
                    tr('settings.onboarding.folderDesc', '选择存放音乐的文件夹，自动扫描本地歌曲')
                  }}
                </p>
                <div class="onboarding-action-area" style="--i: 3">
                  <template v-if="localFolderCount > 0">
                    <div class="onboarding-done-badge">
                      <i class="ri-checkbox-circle-fill"></i>
                      <span>{{
                        tr('settings.onboarding.folderDone', '已添加文件夹', {
                          n: localFolderCount
                        })
                      }}</span>
                    </div>
                    <button type="button" class="onboarding-secondary-btn" @click="pickLocalFolder">
                      <i class="ri-add-line"></i>
                      {{ tr('settings.onboarding.folderPickMore', '再选一个文件夹') }}
                    </button>
                  </template>
                  <button
                    v-else
                    type="button"
                    class="onboarding-action-btn"
                    @click="pickLocalFolder"
                  >
                    <i class="ri-folder-add-line"></i>
                    {{
                      folderPicking
                        ? tr('settings.onboarding.folderPicking', '等待选择…')
                        : tr('settings.onboarding.folderPick', '选择文件夹')
                    }}
                  </button>
                </div>
              </div>
            </section>

            <!-- Step 5: 状态栏歌词权限（仅 Android） -->
            <section
              v-if="showAndroidSteps"
              class="onboarding-page"
              :class="{ active: isStepActive('statusBarLyric') }"
            >
              <div class="onboarding-page-inner">
                <div class="onboarding-step-icon" style="--i: 0">
                  <i class="ri-notification-badge-line"></i>
                </div>
                <h2 class="onboarding-title" style="--i: 1">
                  {{ tr('settings.onboarding.lyricTitle', '状态栏歌词') }}
                </h2>
                <p class="onboarding-desc" style="--i: 2">
                  {{ tr('settings.onboarding.lyricDesc', '在其他应用上方悬浮显示当前播放歌词') }}
                </p>
                <div class="onboarding-action-area" style="--i: 3">
                  <template v-if="statusBarLyricGranted">
                    <div class="onboarding-done-badge">
                      <i class="ri-checkbox-circle-fill"></i>
                      <span>{{ tr('settings.onboarding.lyricGranted', '已开启状态栏歌词') }}</span>
                    </div>
                    <!-- 授权成功后内嵌完整设置面板：位置/字体/颜色/逐字等详细调节 -->
                    <div class="onboarding-lyric-settings">
                      <status-bar-lyric-settings @update:enabled="onLyricEnabledToggle" />
                    </div>
                  </template>
                  <template v-else-if="statusBarLyricAuthReturned">
                    <div class="onboarding-warn-badge">
                      <i class="ri-error-warning-line"></i>
                      <span>{{
                        tr('settings.onboarding.lyricNotGranted', '未完成授权，可稍后在设置中开启')
                      }}</span>
                    </div>
                    <button
                      type="button"
                      class="onboarding-secondary-btn"
                      @click="requestLyricPermission"
                    >
                      <i class="ri-external-link-line"></i>
                      {{ tr('settings.onboarding.lyricRetry', '重新授权') }}
                    </button>
                  </template>
                  <button
                    v-else
                    type="button"
                    class="onboarding-action-btn"
                    @click="requestLyricPermission"
                  >
                    <i class="ri-shield-check-line"></i>
                    {{ tr('settings.onboarding.lyricEnable', '开启并授权') }}
                  </button>
                </div>
              </div>
            </section>

            <!-- Step 6: 登录音乐账号 -->
            <section class="onboarding-page" :class="{ active: isStepActive('account') }">
              <div class="onboarding-page-inner">
                <div class="onboarding-step-icon" style="--i: 0">
                  <i class="ri-user-smile-line"></i>
                </div>
                <h2 class="onboarding-title" style="--i: 1">
                  {{ tr('settings.onboarding.accountTitle', '登录音乐账号') }}
                </h2>
                <p class="onboarding-desc" style="--i: 2">
                  {{
                    tr(
                      'settings.onboarding.accountDesc',
                      '登录网易云、QQ 音乐等账号，使用你的歌单与收藏'
                    )
                  }}
                </p>
                <div class="onboarding-action-area" style="--i: 3">
                  <template v-if="accountLoggedIn">
                    <div class="onboarding-done-badge">
                      <i class="ri-checkbox-circle-fill"></i>
                      <span>{{
                        tr(
                          'settings.onboarding.accountDone',
                          '登录成功，可随时在「我的」页管理账号'
                        )
                      }}</span>
                    </div>
                  </template>
                  <div v-else class="onboarding-login-embed">
                    <account-login-morph @success="handleAccountLoginSuccess" @back="skipStep" />
                  </div>
                </div>
              </div>
            </section>

            <!-- Step 7: 搜索一首歌，进入播放器配置样式 -->
            <section class="onboarding-page" :class="{ active: isLastStep }">
              <div class="onboarding-page-inner">
                <template v-if="!previewMode">
                  <h2 class="onboarding-title" style="--i: 0">
                    {{ tr('settings.onboarding.searchTitle', '搜索一首你喜欢的歌') }}
                  </h2>
                  <p class="onboarding-desc" style="--i: 1">
                    {{
                      tr(
                        'settings.onboarding.searchDesc',
                        '点击播放搜索结果，即可在此挑选并自定义播放器样式'
                      )
                    }}
                  </p>
                  <div class="onboarding-search-box" style="--i: 2">
                    <i class="ri-search-line"></i>
                    <input
                      v-model="searchKeyword"
                      type="text"
                      :placeholder="tr('settings.onboarding.searchPlaceholder', '歌曲名或歌手名')"
                      enterkeyhint="search"
                      @keydown.enter="performSearch"
                    />
                    <button
                      v-if="searchKeyword"
                      type="button"
                      class="onboarding-search-clear"
                      :aria-label="tr('settings.onboarding.searchClear', '清空')"
                      @click="clearSearch"
                    >
                      <i class="ri-close-circle-fill"></i>
                    </button>
                  </div>
                  <div class="onboarding-example-row" style="--i: 3">
                    <button
                      v-for="example in searchExamples"
                      :key="example"
                      type="button"
                      class="onboarding-example-chip"
                      @click="searchExample(example)"
                    >
                      {{ example }}
                    </button>
                  </div>
                  <div class="onboarding-search-results" style="--i: 4">
                    <template v-if="searchLoading">
                      <div v-for="i in 4" :key="i" class="onboarding-skeleton-row">
                        <span class="skeleton-cover"></span>
                        <span class="skeleton-lines">
                          <span class="skeleton-line long"></span>
                          <span class="skeleton-line short"></span>
                        </span>
                      </div>
                    </template>
                    <template v-else-if="searchError">
                      <div class="onboarding-search-state">
                        <i class="ri-wifi-off-line"></i>
                        <p>{{ searchError }}</p>
                        <button
                          type="button"
                          class="onboarding-secondary-btn"
                          @click="performSearch"
                        >
                          {{ tr('settings.onboarding.searchRetry', '重试') }}
                        </button>
                      </div>
                    </template>
                    <template v-else-if="searchDone && searchResults.length === 0">
                      <div class="onboarding-search-state">
                        <i class="ri-search-eye-line"></i>
                        <p>{{ tr('settings.onboarding.searchEmpty', '没有找到相关歌曲') }}</p>
                      </div>
                    </template>
                    <template v-else-if="searchResults.length > 0">
                      <song-item
                        v-for="song in searchResults"
                        :key="`${song.id}-${song.platform ?? 'netease'}`"
                        :item="song"
                        @play="playFromSearch(song)"
                      />
                    </template>
                  </div>
                </template>

                <!-- 播放后：内嵌播放器预览（无控件） + 样式选择与自定义 -->
                <template v-else>
                  <h2 class="onboarding-title" style="--i: 0">
                    {{ tr('settings.onboarding.stylePickTitle', '挑选你的播放器样式') }}
                  </h2>
                  <p class="onboarding-desc" style="--i: 1">
                    {{
                      tr(
                        'settings.onboarding.stylePickDesc',
                        '上方实时预览播放器效果，点击样式立即切换，可继续自定义细节'
                      )
                    }}
                  </p>
                  <div
                    ref="previewWrapRef"
                    class="onboarding-player-preview"
                    style="--i: 2"
                    :style="previewWrapStyle"
                    aria-hidden="true"
                  >
                    <div class="preview-scale-inner" :style="previewInnerStyle">
                      <component :is="previewComponent" :model-value="true" :embedded="true" />
                    </div>
                  </div>
                  <p class="onboarding-style-hint" style="--i: 3">
                    {{
                      tr(
                        'settings.onboarding.stylePickHint',
                        '提示：滚动歌词逐字跟随，效果在播放时最佳'
                      )
                    }}
                  </p>
                  <div class="onboarding-style-grid" style="--i: 3">
                    <button
                      v-for="style in playerStyleOptions"
                      :key="style.key"
                      type="button"
                      class="onboarding-style-card"
                      :class="{ selected: previewStyle === style.key }"
                      @click="onStyleCardClick(style.key)"
                    >
                      <i
                        :class="style.icon"
                        class="onboarding-style-icon"
                        :style="{ color: style.color }"
                      ></i>
                      <span>{{ style.label }}</span>
                    </button>
                  </div>
                  <p
                    v-if="errorConfirmPending"
                    class="onboarding-error-confirm-hint"
                    style="--i: 4"
                  >
                    {{
                      tr(
                        'settings.onboarding.errorConfirmHint',
                        '「错误」样式包含强烈闪烁效果，为防光敏不适请再次点击确认'
                      )
                    }}
                  </p>
                  <div class="onboarding-style-custom" style="--i: 4">
                    <player-style-customization-panel
                      :key="previewStyle"
                      v-model="styleConfig"
                      :style-key="previewStyle"
                      @reset="resetCurrentStyleConfig"
                    />
                  </div>
                  <button
                    type="button"
                    class="onboarding-secondary-btn"
                    style="--i: 5"
                    @click="exitPreviewMode"
                  >
                    <i class="ri-search-line"></i>
                    {{ tr('settings.onboarding.changeSong', '换首歌试试') }}
                  </button>
                </template>
              </div>
            </section>
          </div>
        </div>

        <!-- 底部按钮 -->
        <footer class="onboarding-footer">
          <button
            v-if="currentStep.skippable"
            type="button"
            class="onboarding-skip"
            @click="skipStep"
          >
            {{ tr('settings.onboarding.skipStep', '跳过此步') }}
          </button>
          <span v-else></span>
          <button type="button" class="onboarding-primary" @click="primaryAction($event)">
            {{ primaryLabel }}
          </button>
        </footer>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { marked } from 'marked';
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { getSearch } from '@/api/search';
import SongItem from '@/components/common/SongItem.vue';
import AccountLoginMorph from '@/components/login/AccountLoginMorph.vue';
import DefaultMobilePlayerV2 from '@/components/lyric/DefaultMobilePlayerV2.vue';
import EerieMobilePlayer from '@/components/lyric/EerieMobilePlayer.vue';
import ErrorMobilePlayer from '@/components/lyric/ErrorMobilePlayer.vue';
import FrenzyMobilePlayer from '@/components/lyric/FrenzyMobilePlayer.vue';
import NeonMobilePlayer from '@/components/lyric/NeonMobilePlayer.vue';
import RainMobilePlayer from '@/components/lyric/RainMobilePlayer.vue';
import SmokeMobilePlayer from '@/components/lyric/SmokeMobilePlayer.vue';
import StageMobilePlayer from '@/components/lyric/StageMobilePlayer.vue';
import StarChartPlayer from '@/components/lyric/StarChartPlayer.vue';
import PlayerStyleCustomizationPanel from '@/components/player/PlayerStyleCustomizationPanel.vue';
import { createPlayerStyleConfig, resolvePlayerStyleConfig } from '@/config/playerStyleConfig';
import {
  hasStatusBarLyricPermission,
  isAndroidNative,
  requestStatusBarLyricPermission
} from '@/services/androidNative';
import { useLocalMusicStore } from '@/store/modules/localMusic';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { useUserStore } from '@/store/modules/user';
import type { SongResult } from '@/types/music';
import type { MobilePlayerStyleKey, PlayerStyleCustomConfig } from '@/types/playerStyle';
import { isElectron } from '@/utils';
import { applyTheme } from '@/utils/theme';
import StatusBarLyricSettings from '@/views/set/components/StatusBarLyricSettings.vue';

import userAgreementText from '../../../../用户协议.md?raw';

const STORAGE_KEY = 'onboarding-completed';
const { t, locale } = useI18n();

/** 安全翻译：缺键时回退中文（可带 {x}/{y}/{n} 参数占位） */
const tr = (key: string, fallback: string, params?: Record<string, string | number>) => {
  const value = t(key, params ?? {}) as string;
  if (value === key) {
    let result = fallback;
    for (const [name, param] of Object.entries(params ?? {})) {
      result = result.replace(new RegExp(`\\{${name}\\}`, 'g'), String(param));
    }
    return result;
  }
  return value;
};

type StepId =
  | 'welcome'
  | 'agreement'
  | 'language'
  | 'theme'
  | 'localFolder'
  | 'statusBarLyric'
  | 'account'
  | 'searchAndDone';
type OnboardingStep = {
  id: StepId;
  skippable: boolean;
  configurable: boolean;
};

const visible = ref(false);
const reduceMotion = ref(false);
const showAndroidSteps = isAndroidNative();

// ==================== 用户协议（引导内步骤） ====================

const DISCLAIMER_AGREED_KEY = 'disclaimer_agreed_timestamp';
const agreementHtml = marked.parse(userAgreementText, { async: false }) as string;
const hasAgreedDisclaimer = () => Boolean(localStorage.getItem(DISCLAIMER_AGREED_KEY));

function handleAgreementAgree() {
  if (!hasAgreedDisclaimer()) {
    localStorage.setItem(DISCLAIMER_AGREED_KEY, Date.now().toString());
  }
  goNext();
}

function handleAgreementDecline() {
  if (isElectron) {
    window.api?.quitApp?.();
  } else {
    window.close();
  }
}

// ==================== 步骤定义 ====================

const baseSteps: OnboardingStep[] = [
  { id: 'welcome', skippable: false, configurable: false },
  // 协议未同意时插入（新装/清理过存储的用户）；已同意的老用户重进引导不再重复
  ...(!hasAgreedDisclaimer()
    ? ([{ id: 'agreement', skippable: false, configurable: true }] as OnboardingStep[])
    : []),
  { id: 'language', skippable: true, configurable: true },
  { id: 'theme', skippable: true, configurable: true },
  ...(showAndroidSteps
    ? ([
        { id: 'localFolder', skippable: true, configurable: true },
        { id: 'statusBarLyric', skippable: true, configurable: true }
      ] as OnboardingStep[])
    : []),
  { id: 'account', skippable: true, configurable: true },
  { id: 'searchAndDone', skippable: false, configurable: false }
];
const steps = baseSteps;
const currentIndex = ref(0);
const currentStep = computed(() => steps[currentIndex.value]);
const isLastStep = computed(() => currentIndex.value === steps.length - 1);
const isStepActive = (id: StepId) => currentStep.value.id === id;
const stepProgressText = computed(() =>
  tr('settings.onboarding.stepOf', '第 {x} 步，共 {y} 步', {
    x: currentIndex.value,
    y: steps.length - 1
  })
);

// ==================== 配置状态 ====================

const settingsStore = useSettingsStore();
const playerStore = usePlayerStore();
const localMusicStore = useLocalMusicStore();
const userStore = useUserStore();

// 状态栏歌词设置组件依赖该注入值控制悬浮预览常驻（引导内始终展开）
provide('settingItemExpanded', ref(true));

const languageOptions = [
  { id: 'zh-CN', native: '简体中文' },
  { id: 'zh-Hant', native: '繁體中文' },
  { id: 'en-US', native: 'English' },
  { id: 'ja-JP', native: '日本語' },
  { id: 'ko-KR', native: '한국어' }
];
const selectedLanguage = ref('zh-CN');

type ThemeChoice = 'auto' | 'light' | 'dark';
const themeOptions = computed(() => [
  {
    value: 'auto' as const,
    icon: 'ri-contrast-2-line',
    label: tr('settings.onboarding.themeAuto', '跟随系统')
  },
  {
    value: 'light' as const,
    icon: 'ri-sun-line',
    label: tr('settings.onboarding.themeLight', '浅色')
  },
  {
    value: 'dark' as const,
    icon: 'ri-moon-line',
    label: tr('settings.onboarding.themeDark', '深色')
  }
]);
const selectedTheme = ref<ThemeChoice>('auto');

const localFolderCount = computed(() => localMusicStore.folderPaths.length);
const folderPicking = ref(false);
const statusBarLyricGranted = ref(false);
const statusBarLyricAuthReturned = ref(false);

function selectLanguage(id: string) {
  selectedLanguage.value = id;
  settingsStore.setLanguage(id);
}

function selectTheme(choice: ThemeChoice) {
  selectedTheme.value = choice;
  if (choice === 'auto') {
    settingsStore.setAutoTheme(true);
    return;
  }
  // 手动主题：与 settings store toggleTheme 手动分支一致
  settingsStore.setSetData({ autoTheme: false, manualTheme: choice });
  settingsStore.theme = choice;
  applyTheme(choice);
}

// ==================== 引导界面主题（跟随所选外观） ====================

const onboardingRootRef = ref<HTMLElement | null>(null);
const systemDarkQuery =
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

type ResolvedTheme = 'light' | 'dark';

function resolveThemeOf(choice: ThemeChoice): ResolvedTheme {
  if (choice === 'auto') return systemDarkQuery?.matches ? 'dark' : 'light';
  return choice;
}

const onboardingTheme = computed<ResolvedTheme>(() => resolveThemeOf(selectedTheme.value));

// ==================== 主题切换：从点击位置向外扩散为新主题底色 ====================

const themeReveal = ref<{ color: string } | null>(null);
const themeRevealClip = ref('circle(0px at 50% 50%)');
const themeRevealFading = ref(false);
let themeRevealTimers: number[] = [];

const THEME_BG: Record<ResolvedTheme, string> = { light: '#f5f5f7', dark: '#000000' };

function clearThemeRevealTimers() {
  themeRevealTimers.forEach((id) => window.clearTimeout(id));
  themeRevealTimers = [];
}

function onThemeCardClick(choice: ThemeChoice, event: MouseEvent) {
  if (themeReveal.value) return;
  if (reduceMotion.value || !onboardingRootRef.value) {
    selectTheme(choice);
    return;
  }
  const root = onboardingRootRef.value;
  const rect = root.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const maxR = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y)) + 48;

  themeReveal.value = { color: THEME_BG[resolveThemeOf(choice)] };
  themeRevealFading.value = false;
  themeRevealClip.value = `circle(0px at ${x}px ${y}px)`;
  // 双 rAF 确保 clip-path 初值已提交，再触发过渡扩散
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      themeRevealClip.value = `circle(${maxR}px at ${x}px ${y}px)`;
    });
  });
  themeRevealTimers.push(
    window.setTimeout(() => {
      // 扩散覆盖全屏后应用主题并淡出扩散层
      selectTheme(choice);
      themeRevealFading.value = true;
    }, 580),
    window.setTimeout(() => {
      clearThemeRevealTimers();
      themeReveal.value = null;
      themeRevealFading.value = false;
    }, 860)
  );
}

// ==================== 本地文件夹（Android） ====================

let prevFolderPickHandler: ((uri: string | null) => void) | null | undefined;

function waitForFolderPick(): Promise<string | null> {
  return new Promise((resolve) => {
    prevFolderPickHandler =
      typeof (window as any).__localMusicFolderPicked === 'function'
        ? (window as any).__localMusicFolderPicked
        : null;
    (window as any).__localMusicFolderPicked = (treeUri: string | null) => {
      restoreFolderPickHandler();
      resolve(treeUri);
    };
  });
}

function restoreFolderPickHandler() {
  if (prevFolderPickHandler === undefined) return;
  if (prevFolderPickHandler) (window as any).__localMusicFolderPicked = prevFolderPickHandler;
  else delete (window as any).__localMusicFolderPicked;
  prevFolderPickHandler = undefined;
}

async function pickLocalFolder() {
  if (folderPicking.value) return;
  // 纯浏览器环境（Web 版）没有文件夹访问能力
  if (!isElectron && !(window as any).AndroidNative) return;
  folderPicking.value = true;
  try {
    (window as any).AndroidNative.pickAudioFolder();
    const treeUri = await waitForFolderPick();
    if (!treeUri) return;
    localMusicStore.addFolder(treeUri);
    await localMusicStore.scanFolders();
  } catch (error) {
    console.warn('[Onboarding] 选择本地音乐文件夹失败:', error);
  } finally {
    folderPicking.value = false;
    restoreFolderPickHandler();
  }
}

// ==================== 状态栏歌词权限（Android） ====================

function refreshLyricPermissionState() {
  statusBarLyricGranted.value = hasStatusBarLyricPermission();
}

function requestLyricPermission() {
  requestStatusBarLyricPermission();
  // 授权在系统设置页完成；返回 app 后复查并自动启用
  statusBarLyricAuthReturned.value = true;
}

async function finalizeLyricPermission() {
  refreshLyricPermissionState();
  if (!statusBarLyricGranted.value) return;
  try {
    const saved = JSON.parse(localStorage.getItem('music-full-config') || '{}');
    saved.statusBarLyricsEnabled = true;
    saved.statusBarLyricConfig = {
      ...(saved.statusBarLyricConfig || {}),
      enabled: true
    };
    localStorage.setItem('music-full-config', JSON.stringify(saved));
    window.dispatchEvent(new CustomEvent('music-full-config-updated'));
  } catch {
    // localStorage 不可用时跳过持久化
  }
}

function handleVisibilityReturn() {
  if (document.visibilityState !== 'visible') return;
  if (statusBarLyricAuthReturned.value && !statusBarLyricGranted.value) {
    void finalizeLyricPermission();
  }
}

/** 内嵌设置面板中用户手动关闭状态栏歌词 */
function onLyricEnabledToggle(enabled: boolean) {
  statusBarLyricGranted.value = enabled ? hasStatusBarLyricPermission() : false;
}

// ==================== 登录账号 ====================

const accountLoggedIn = computed(() => Boolean(userStore.user));

function handleAccountLoginSuccess() {
  // morph 内部已完成 setUser 持久化，这里刷新展示状态
  userStore.user = userStore.user ?? (JSON.parse(localStorage.getItem('user') || 'null') as any);
}

// ==================== 首页多语言问候轮播（blur-text 逐字入场） ====================

const greetings = [
  '欢迎使用',
  '歡迎使用',
  'Welcome',
  'ようこそ',
  '환영합니다',
  'Bienvenue',
  'Willkommen',
  'Benvenuto',
  'Bienvenido',
  'Добро пожаловать'
];
const greetingIndex = ref(0);
let greetingTimer: ReturnType<typeof setInterval> | null = null;

const currentGreeting = computed(() => greetings[greetingIndex.value % greetings.length]);
const greetingChars = computed(() => Array.from(currentGreeting.value));

function startGreetingLoop() {
  stopGreetingLoop();
  greetingTimer = setInterval(() => {
    greetingIndex.value = (greetingIndex.value + 1) % greetings.length;
  }, 2600);
}

function stopGreetingLoop() {
  if (greetingTimer) clearInterval(greetingTimer);
  greetingTimer = null;
}

// ==================== 搜索与播放（最后一步） ====================

const searchKeyword = ref('');
const searchLoading = ref(false);
const searchDone = ref(false);
const searchError = ref('');
const searchResults = ref<SongResult[]>([]);

const searchExamples = computed(() => [
  tr('settings.onboarding.searchExample1', '晴天'),
  tr('settings.onboarding.searchExample2', '告白气球'),
  tr('settings.onboarding.searchExample3', '孤勇者')
]);

function clearSearch() {
  searchKeyword.value = '';
  searchResults.value = [];
  searchDone.value = false;
  searchError.value = '';
}

async function performSearch() {
  const keyword = searchKeyword.value.trim();
  if (!keyword || searchLoading.value) return;
  searchLoading.value = true;
  searchError.value = '';
  searchDone.value = false;
  try {
    const { data } = await getSearch({ keywords: keyword, type: 1, limit: 8 });
    const songs = ((data?.result?.songs || []) as any[]).map((item) => ({
      ...item,
      picUrl: item.al?.picUrl,
      artists: item.ar || item.artists
    }));
    searchResults.value = songs;
    searchDone.value = true;
  } catch (error) {
    console.warn('[Onboarding] 搜索失败:', error);
    searchError.value = tr('settings.onboarding.searchError', '搜索失败，请检查网络');
  } finally {
    searchLoading.value = false;
  }
}

function searchExample(keyword: string) {
  searchKeyword.value = keyword;
  void performSearch();
}

async function playFromSearch(song: SongResult) {
  if (searchResults.value.length === 0) return;
  try {
    playerStore.setPlayList(searchResults.value);
    await playerStore.setPlay(song);
  } catch (error) {
    console.warn('[Onboarding] 播放失败:', error);
  }
  // 不再跳出引导：切换到内嵌预览模式，挑选播放器样式后由「开始体验」退出
  previewMode.value = true;
  void nextTick(measurePreview);
}

// ==================== 内嵌播放器预览 + 样式选择（播放后） ====================

const previewMode = ref(false);
const previewStyle = ref<MobilePlayerStyleKey>('default');
const previewWrapRef = ref<HTMLElement | null>(null);
const previewScale = ref(0.32);

const mobileStyleComponents: Record<MobilePlayerStyleKey, any> = {
  default: markRaw(DefaultMobilePlayerV2),
  stage: markRaw(StageMobilePlayer),
  starChart: markRaw(StarChartPlayer),
  frenzy: markRaw(FrenzyMobilePlayer),
  eerie: markRaw(EerieMobilePlayer),
  neon: markRaw(NeonMobilePlayer),
  rain: markRaw(RainMobilePlayer),
  smoke: markRaw(SmokeMobilePlayer),
  error: markRaw(ErrorMobilePlayer)
};

const previewComponent = computed(() => mobileStyleComponents[previewStyle.value]);

/** 缩放渲染：内层以真实视口尺寸布局，transform 缩进小窗口（transform 生成包含块承接 fixed 子元素） */
const previewViewport = ref({ w: window.innerWidth, h: window.innerHeight });

const previewInnerStyle = computed(() => ({
  width: `${previewViewport.value.w}px`,
  height: `${previewViewport.value.h}px`,
  transform: `scale(${previewScale.value})`
}));

const previewWrapStyle = computed(() => ({
  height: `${Math.round(previewViewport.value.h * previewScale.value)}px`
}));

function measurePreview() {
  if (!previewMode.value) return;
  const el = previewWrapRef.value;
  const w = el?.clientWidth || window.innerWidth * 0.82;
  previewViewport.value = { w: window.innerWidth, h: window.innerHeight };
  previewScale.value = w / window.innerWidth;
}

const playerStyleOptions = computed<
  Array<{ key: MobilePlayerStyleKey; label: string; icon: string; color: string }>
>(() => [
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
    key: 'starChart',
    label: tr('player.styles.starChart', '星盘'),
    icon: 'ri-record-circle-line',
    color: 'var(--accent-color, #a0a0a0)'
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
  { key: 'rain', label: tr('player.styles.rain', '雨夜'), icon: 'ri-rainy-line', color: '#3b82f6' },
  {
    key: 'smoke',
    label: tr('player.styles.smoke', '烟雾'),
    icon: 'ri-cloudy-line',
    color: '#14b8a6'
  },
  { key: 'error', label: tr('player.styles.error', '错误'), icon: 'ri-bug-line', color: '#ef4444' }
]);

function readFullConfig(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem('music-full-config') || '{}') as Record<string, any>;
  } catch {
    return {};
  }
}

/** 防御式写回：合并 localStorage 最新值再整体写回，避免覆盖其他字段 */
function persistFullConfig(patch: Record<string, any>) {
  const latest = readFullConfig();
  try {
    localStorage.setItem('music-full-config', JSON.stringify({ ...latest, ...patch }));
  } catch (error) {
    console.error('[Onboarding] 配置写入失败:', error);
  }
  window.dispatchEvent(new CustomEvent('music-full-config-updated'));
}

function exitPreviewMode() {
  previewMode.value = false;
}

/** 「错误」样式含高频闪烁：首次启用需二次点击确认（同 MobilePlayerSettings 的光敏警告） */
const PHOTOSENSITIVITY_ACK_KEY = 'photosensitivity-warning-acked';
const errorConfirmPending = ref(false);
let errorConfirmTimer: number | null = null;

function onStyleCardClick(key: MobilePlayerStyleKey) {
  if (key === 'error' && previewStyle.value !== 'error') {
    let acknowledged = true;
    try {
      acknowledged = Boolean(localStorage.getItem(PHOTOSENSITIVITY_ACK_KEY));
    } catch {
      acknowledged = true;
    }
    if (!acknowledged && !errorConfirmPending.value) {
      errorConfirmPending.value = true;
      if (errorConfirmTimer) window.clearTimeout(errorConfirmTimer);
      errorConfirmTimer = window.setTimeout(() => {
        errorConfirmPending.value = false;
      }, 5000);
      return;
    }
    try {
      localStorage.setItem(PHOTOSENSITIVITY_ACK_KEY, '1');
    } catch {
      // 忽略写入失败
    }
  }
  if (errorConfirmTimer) {
    window.clearTimeout(errorConfirmTimer);
    errorConfirmTimer = null;
  }
  errorConfirmPending.value = false;
  previewStyle.value = key;
  persistFullConfig({ playerStyle: key });
}

// ==================== 样式自定义配置（复用 MobilePlayerSettings 逻辑） ====================

const styleConfig = ref<PlayerStyleCustomConfig>(createPlayerStyleConfig('default'));
let suppressStyleSave = false;

function loadStyleConfigFor(key: MobilePlayerStyleKey) {
  const config = readFullConfig();
  const allConfigs = config.styleCustomConfig || {};
  styleConfig.value = resolvePlayerStyleConfig(key, allConfigs[key]);
}

function resetCurrentStyleConfig() {
  try {
    suppressStyleSave = true;
    const config = readFullConfig();
    if (config.styleCustomConfig) delete config.styleCustomConfig[previewStyle.value];
    persistFullConfig({ styleCustomConfig: config.styleCustomConfig || {} });
    styleConfig.value = createPlayerStyleConfig(previewStyle.value);
    void nextTick(() => {
      suppressStyleSave = false;
    });
  } catch (error) {
    console.error('[Onboarding] 还原样式配置失败:', error);
  }
}

watch(
  styleConfig,
  () => {
    if (suppressStyleSave) return;
    try {
      const config = readFullConfig();
      config.styleCustomConfig = {
        ...(config.styleCustomConfig || {}),
        [previewStyle.value]: { ...styleConfig.value }
      };
      persistFullConfig({ styleCustomConfig: config.styleCustomConfig });
    } catch (error) {
      console.error('[Onboarding] 保存自定义配置失败:', error);
    }
  },
  { deep: true }
);

watch(previewStyle, (key) => loadStyleConfigFor(key), { immediate: true });

// ==================== 步进导航（跟手 + 速度投影） ====================

const viewportRef = ref<HTMLElement | null>(null);
const pageWidth = ref(1);
const positionPx = ref(0); // 轨道当前实际位移（单一样式来源）
let raf = 0;
let pointerId = -1;
let startX = 0;
let startY = 0;
let axis: 'pending' | 'horizontal' | 'vertical' = 'pending';
const dragging = ref(false);
let samples: Array<{ x: number; time: number }> = [];
let suppressClickUntil = 0;

const dragOffset = ref(0);

const trackStyle = computed(() => ({
  transform: `translate3d(${positionPx.value + dragOffset.value}px, 0, 0)`
}));

function measureViewport() {
  pageWidth.value = Math.max(1, viewportRef.value?.clientWidth || window.innerWidth);
}

function rubberBand(distance: number): number {
  const constant = 0.24;
  return (
    (distance * pageWidth.value * constant) / (pageWidth.value + constant * Math.abs(distance))
  );
}

function pointerVelocity(): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  const first = samples.find((sample) => last.time - sample.time <= 90) || samples[0];
  return ((last.x - first.x) / Math.max(1, last.time - first.time)) * 1000;
}

function cancelAnimation() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

/** 阻尼弹簧：从当前值带速度动画到目标（可被新手势随时打断） */
function animateTo(targetPx: number, initialVelocity = 0) {
  cancelAnimation();
  const from = positionPx.value + dragOffset.value;
  if (reduceMotion.value || Math.abs(targetPx - from) < 0.5) {
    positionPx.value = targetPx;
    dragOffset.value = 0;
    return;
  }
  const startedAt = performance.now();
  const displacement = from - targetPx;
  const omega = 18;
  const tick = (now: number) => {
    const elapsed = Math.min(0.55, (now - startedAt) / 1000);
    const decay = Math.exp(-omega * elapsed);
    const value =
      targetPx + (displacement + (initialVelocity + omega * displacement) * elapsed) * decay;
    positionPx.value = value;
    dragOffset.value = 0;
    if (elapsed >= 0.55 || (Math.abs(value - targetPx) < 0.35 && now - startedAt > 120)) {
      positionPx.value = targetPx;
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function onPointerDown(event: PointerEvent) {
  if (pointerId !== -1) return;
  cancelAnimation();
  pointerId = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  axis = 'pending';
  samples = [{ x: event.clientX, time: event.timeStamp || performance.now() }];
  viewportRef.value?.setPointerCapture?.(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerId !== pointerId) return;
  const deltaX = event.clientX - startX;
  const deltaY = event.clientY - startY;

  if (axis === 'pending') {
    if (Math.hypot(deltaX, deltaY) < 10) return;
    axis = Math.abs(deltaX) > Math.abs(deltaY) * 1.12 ? 'horizontal' : 'vertical';
    if (axis === 'vertical') return;
    dragging.value = true;
  }
  if (axis !== 'horizontal') return;

  samples.push({ x: event.clientX, time: event.timeStamp || performance.now() });
  if (samples.length > 6) samples.shift();

  // 相对当前逻辑页的位移；正 = 向右（回退方向），负 = 向左（前进方向）
  const travel = deltaX;
  const atStart = currentIndex.value === 0 && travel > 0;
  const atEnd = isLastStep.value && travel < 0;
  // 边界外继续拖 → rubber-band 渐进阻尼，不硬停
  dragOffset.value = atStart || atEnd ? rubberBand(travel) : travel;
}

function onPointerUp(event: PointerEvent) {
  if (event.pointerId !== pointerId) return;
  const wasHorizontal = axis === 'horizontal' && dragging.value;
  pointerId = -1;
  if (!wasHorizontal) {
    dragging.value = false;
    return;
  }

  const velocity = pointerVelocity();
  const offset = dragOffset.value;
  dragging.value = false;
  suppressClickUntil = performance.now() + 420;

  // 动量投影：projected = offset + v * 0.14（与 useLyricSwipeGesture 判定同族）
  const projected = offset + velocity * 0.14;
  const threshold = Math.min(112, Math.max(72, pageWidth.value * 0.2));
  let targetIndex = currentIndex.value;
  if (offset <= -threshold || projected <= -threshold || velocity <= -760) {
    if (currentIndex.value < steps.length - 1) targetIndex = currentIndex.value + 1;
  } else if (offset >= threshold || projected >= threshold || velocity >= 760) {
    if (currentIndex.value > 0) targetIndex = currentIndex.value - 1;
  }

  currentIndex.value = targetIndex;
  animateTo(-(targetIndex * pageWidth.value), velocity);
}

function suppressDragClick(event: MouseEvent) {
  if (performance.now() >= suppressClickUntil) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

function goTo(index: number) {
  const clamped = Math.min(steps.length - 1, Math.max(0, index));
  if (clamped === currentIndex.value) return;
  currentIndex.value = clamped;
  animateTo(-(clamped * pageWidth.value));
}

function goPrev() {
  goTo(currentIndex.value - 1);
}

function goNext() {
  goTo(currentIndex.value + 1);
}

function skipStep() {
  goNext();
}

const primaryLabel = computed(() => {
  if (currentStep.value.id === 'welcome') {
    return tr('settings.onboarding.startSetup', '开始设置');
  }
  if (currentStep.value.id === 'agreement') {
    return tr('settings.onboarding.agreementAccept', '同意并继续');
  }
  if (isLastStep.value) {
    return tr('settings.onboarding.startExperience', '直接开始体验');
  }
  return tr('settings.onboarding.continue', '继续');
});

function primaryAction(event?: MouseEvent) {
  if (currentStep.value.id === 'agreement') {
    handleAgreementAgree();
    return;
  }
  if (isLastStep.value) {
    finishWithReveal(event);
    return;
  }
  goNext();
}

// ==================== 退出引导：从点击位置圆形扩散揭示应用 ====================

let finishRevealRaf = 0;

function finishWithReveal(event?: MouseEvent) {
  const root = onboardingRootRef.value;
  if (reduceMotion.value || !root || !event?.currentTarget) {
    finish();
    return;
  }
  const btn = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const rect = root.getBoundingClientRect();
  const x = btn.left + btn.width / 2 - rect.left;
  const y = btn.top + btn.height / 2 - rect.top;
  const maxR = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y)) + 48;
  const duration = 620;
  const startedAt = performance.now();

  // 扩散孔洞：mask 透明圈内露出下层应用，随 rAF 逐帧扩大
  const applyMask = (r: number) => {
    const value = `radial-gradient(circle ${r}px at ${x}px ${y}px, transparent ${Math.max(0, r - 1)}px, black ${r}px)`;
    root.style.maskImage = value;
    (root.style as CSSStyleDeclaration & { webkitMaskImage: string }).webkitMaskImage = value;
  };
  applyMask(0);
  cancelAnimationFrame(finishRevealRaf);
  const tick = (now: number) => {
    const t = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    applyMask(eased * maxR);
    if (t < 1) {
      finishRevealRaf = requestAnimationFrame(tick);
    } else {
      finishRevealRaf = 0;
      finish();
    }
  };
  finishRevealRaf = requestAnimationFrame(tick);
}

// ==================== 生命周期 ====================

let motionQuery: MediaQueryList | null = null;
let resizeHandler: (() => void) | null = null;

function show() {
  if (localStorage.getItem(STORAGE_KEY)) return;
  // 初始语言跟随当前 locale
  selectedLanguage.value = locale.value;
  visible.value = true;
  currentIndex.value = 0;
  positionPx.value = 0;
  dragOffset.value = 0;
  previewMode.value = false;
  errorConfirmPending.value = false;
  startGreetingLoop();
  void nextTick(measureViewport);
}

function finish() {
  localStorage.setItem(STORAGE_KEY, '1');
  restoreFolderPickHandler();
  stopGreetingLoop();
  clearThemeRevealTimers();
  themeReveal.value = null;
  visible.value = false;
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduceMotion.value = motionQuery.matches;
  motionQuery.addEventListener('change', handleMotionChange);
  resizeHandler = () => {
    measureViewport();
    measurePreview();
  };
  window.addEventListener('resize', resizeHandler);
  document.addEventListener('visibilitychange', handleVisibilityReturn);
});

function handleMotionChange(event: MediaQueryListEvent) {
  reduceMotion.value = event.matches;
}

onBeforeUnmount(() => {
  cancelAnimation();
  cancelAnimationFrame(finishRevealRaf);
  clearThemeRevealTimers();
  if (errorConfirmTimer) window.clearTimeout(errorConfirmTimer);
  motionQuery?.removeEventListener('change', handleMotionChange);
  window.removeEventListener('resize', resizeHandler!);
  document.removeEventListener('visibilitychange', handleVisibilityReturn);
  restoreFolderPickHandler();
});

defineExpose({ show });

// ==================== 光晕 ====================

const glowStyleA = computed(() => {
  const positions = ['38% 18%', '70% 24%', '30% 30%', '62% 16%', '40% 22%', '50% 20%'];
  const position = positions[Math.min(currentIndex.value, positions.length - 1)];
  return {
    background: `radial-gradient(circle at ${position}, var(--accent-color-20, transparent), transparent 62%)`
  };
});

const glowStyleB = computed(() => {
  const positions = ['68% 78%', '22% 82%', '74% 74%', '30% 84%', '66% 80%', '50% 84%'];
  const position = positions[Math.min(currentIndex.value, positions.length - 1)];
  return {
    background: `radial-gradient(circle at ${position}, var(--accent-color-10, transparent), transparent 55%)`
  };
});
</script>

<style scoped>
.onboarding-root {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #000;
  color: #fff;
  transition:
    background-color 0.45s ease,
    color 0.45s ease;
}

.onboarding-scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(28px) saturate(140%);
  -webkit-backdrop-filter: blur(28px) saturate(140%);
  transition: background-color 0.45s ease;
}

/* 主题扩散层：主题切换时从点击位置扩张至全屏，随后淡出 */
.onboarding-theme-reveal {
  position: absolute;
  inset: 0;
  z-index: 60;
  pointer-events: none;
  transition:
    clip-path 0.56s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.26s ease 0.06s;
  will-change: clip-path, opacity;
}

/* 浅色主题覆盖：跟随所选外观整体换色 */
.onboarding-root.light-theme {
  background: #f5f5f7;
  color: #0e0e12;
}

.onboarding-root.light-theme .onboarding-scrim {
  background: rgba(245, 245, 247, 0.86);
}

.onboarding-root.light-theme .onboarding-back {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.72);
}

.onboarding-root.light-theme .onboarding-progress,
.onboarding-root.light-theme .onboarding-skip,
.onboarding-root.light-theme .onboarding-search-state,
.onboarding-root.light-theme .onboarding-search-box i {
  color: rgba(0, 0, 0, 0.4);
}

.onboarding-root.light-theme .onboarding-skip:active {
  color: rgba(0, 0, 0, 0.7);
}

.onboarding-root.light-theme .onboarding-desc {
  color: rgba(0, 0, 0, 0.48);
}

.onboarding-root.light-theme .onboarding-feature-list {
  color: rgba(0, 0, 0, 0.72);
}

.onboarding-root.light-theme .onboarding-feature-list i {
  background: rgba(0, 0, 0, 0.06);
}

.onboarding-root.light-theme .onboarding-hero-icon {
  border-color: rgba(0, 0, 0, 0.1);
}

.onboarding-root.light-theme .onboarding-option-card {
  border-color: rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.85);
}

.onboarding-root.light-theme .onboarding-secondary-btn {
  border-color: rgba(0, 0, 0, 0.16);
  color: rgba(0, 0, 0, 0.72);
}

.onboarding-root.light-theme .onboarding-search-box {
  border-color: rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.05);
}

.onboarding-root.light-theme .onboarding-search-box input {
  color: #0e0e12;
}

.onboarding-root.light-theme .onboarding-search-box input::placeholder {
  color: rgba(0, 0, 0, 0.32);
}

.onboarding-root.light-theme .onboarding-search-clear {
  color: rgba(0, 0, 0, 0.36);
}

.onboarding-root.light-theme .onboarding-example-chip {
  border-color: rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 0.56);
}

.onboarding-root.light-theme .onboarding-example-chip:active {
  background: rgba(0, 0, 0, 0.07);
}

.onboarding-root.light-theme .skeleton-cover,
.onboarding-root.light-theme .skeleton-line {
  background: rgba(0, 0, 0, 0.07);
}

.onboarding-root.light-theme .onboarding-agreement-card {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.08);
}

.onboarding-root.light-theme .onboarding-agreement-body {
  color: rgba(0, 0, 0, 0.68);
}

.onboarding-root.light-theme .onboarding-agreement-body h1,
.onboarding-root.light-theme .onboarding-agreement-body h2,
.onboarding-root.light-theme .onboarding-agreement-body h3,
.onboarding-root.light-theme .onboarding-agreement-body strong {
  color: rgba(0, 0, 0, 0.9);
}

.onboarding-root.light-theme .onboarding-agreement-body code {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.85);
}

.onboarding-root.light-theme .onboarding-agreement-decline {
  color: rgba(0, 0, 0, 0.35);
}

.onboarding-glow {
  position: absolute;
  inset: -20%;
  pointer-events: none;
  transition: background 0.6s cubic-bezier(0.32, 0.72, 0, 1);
}

.onboarding-header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 0px) + 14px) 16px 10px;
}

.onboarding-back {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.72);
  font-size: 22px;
  transition: transform 0.1s ease-out;
}

.onboarding-back:active {
  transform: scale(0.92);
}

.onboarding-header-spacer {
  width: 36px;
}

.onboarding-progress {
  font-size: 12px;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.4);
}

.onboarding-viewport {
  position: relative;
  z-index: 10;
  flex: 1;
  overflow: hidden;
  touch-action: pan-y;
}

.onboarding-track {
  display: flex;
  height: 100%;
  will-change: transform;
}

.onboarding-page {
  width: 100%;
  height: 100%;
  flex-shrink: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.onboarding-page-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  min-height: 100%;
  padding: 24px 28px 32px;
  text-align: center;
}

/* 内容级联入场：仅当前页触发 */
.onboarding-page.active .onboarding-page-inner > * {
  animation: onboarding-item-in 0.44s cubic-bezier(0.32, 0.72, 0, 1) both;
  animation-delay: calc(var(--i, 0) * 60ms);
}

@keyframes onboarding-item-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.onboarding-hero-icon {
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  margin: 8vh auto 28px;
  border-radius: 32px;
  background: linear-gradient(
    135deg,
    var(--accent-color-20, rgba(255, 255, 255, 0.12)),
    rgba(255, 255, 255, 0.04)
  );
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 44px;
  color: var(--accent-color, #fff);
}

.onboarding-step-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin: 4vh auto 20px;
  border-radius: 22px;
  background: var(--accent-color-20, rgba(255, 255, 255, 0.1));
  font-size: 28px;
  color: var(--accent-color, #fff);
}

.onboarding-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.onboarding-desc {
  max-width: 30em;
  margin-top: 10px;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.48);
}

/* ==================== 用户协议步骤 ==================== */
.onboarding-agreement-inner {
  width: 100%;
  max-width: 620px;
  margin: 0 auto;
}

.onboarding-agreement-card {
  width: 100%;
  margin-top: 22px;
  padding: 18px 18px 22px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-align: left;
  overflow-y: auto;
  overscroll-behavior: contain;
  /* 撑满剩余高度，卡片内滚动阅读 */
  flex: 1;
  min-height: 0;
}

.onboarding-agreement-body {
  font-size: 13px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.78);
}

.onboarding-agreement-body h1,
.onboarding-agreement-body h2,
.onboarding-agreement-body h3 {
  margin: 1.2em 0 0.5em;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
}

.onboarding-agreement-body h1:first-child,
.onboarding-agreement-body h2:first-child,
.onboarding-agreement-body p:first-child {
  margin-top: 0;
}

.onboarding-agreement-body p,
.onboarding-agreement-body ul,
.onboarding-agreement-body ol {
  margin: 0.6em 0;
}

.onboarding-agreement-body ul,
.onboarding-agreement-body ol {
  padding-left: 1.4em;
}

.onboarding-agreement-body li {
  margin: 0.3em 0;
  list-style: inherit;
}

.onboarding-agreement-body strong {
  color: #fff;
}

.onboarding-agreement-body a {
  color: var(--accent-color, #fff);
  text-decoration: underline;
}

.onboarding-agreement-body code {
  padding: 0.1em 0.4em;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.9em;
  color: rgba(255, 255, 255, 0.9);
}

.onboarding-agreement-decline {
  margin-top: 14px;
  padding: 6px 0;
  border: 0;
  background: transparent;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  transition: color 0.2s ease;
}

.onboarding-agreement-decline:active {
  color: rgba(255, 255, 255, 0.6);
}

/* 协议步骤：内容占满纵向空间，标题/描述收紧 */
.onboarding-page.active .onboarding-agreement-inner {
  height: 100%;
}

.onboarding-feature-list {
  display: grid;
  gap: 12px;
  margin-top: 28px;
  text-align: left;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
}

.onboarding-feature-list li {
  display: flex;
  align-items: center;
  gap: 12px;
}

.onboarding-feature-list i {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--accent-color, #fff);
  font-size: 16px;
}

.onboarding-option-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  width: 100%;
  max-width: 360px;
  margin-top: 24px;
}

.onboarding-option-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.85);
  font-size: 15px;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.1s ease-out;
}

.onboarding-option-card:active {
  transform: scale(0.97);
}

.onboarding-option-card.selected {
  border-color: var(--accent-color, #fff);
  background: var(--accent-color-10, rgba(255, 255, 255, 0.1));
}

.onboarding-option-card.theme {
  flex-direction: column;
  gap: 10px;
  padding: 20px 16px;
}

.onboarding-option-icon {
  font-size: 26px;
  color: var(--accent-color, #fff);
}

.onboarding-option-label {
  flex: 1;
  text-align: left;
}

.onboarding-option-card.theme .onboarding-option-label {
  text-align: center;
}

.onboarding-option-card .ri-check-line {
  color: var(--accent-color, #fff);
  font-size: 18px;
}

.onboarding-action-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: 360px;
  margin-top: 26px;
}

.onboarding-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px 20px;
  border: 0;
  border-radius: 999px;
  background: var(--accent-color, #fff);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  transition: transform 0.1s ease-out;
}

.onboarding-action-btn:active {
  transform: scale(0.97);
}

.onboarding-done-badge,
.onboarding-warn-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border-radius: 14px;
  font-size: 14px;
}

.onboarding-done-badge {
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
}

.onboarding-warn-badge {
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
}

.onboarding-secondary-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  font-size: 13px;
}

.onboarding-search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 400px;
  margin-top: 22px;
  padding: 13px 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
}

.onboarding-search-box i {
  color: rgba(255, 255, 255, 0.4);
  font-size: 18px;
}

.onboarding-search-box input {
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  color: #fff;
  font-size: 15px;
}

.onboarding-search-box input::placeholder {
  color: rgba(255, 255, 255, 0.32);
}

.onboarding-search-clear {
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.36);
  font-size: 18px;
}

.onboarding-example-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}

.onboarding-example-chip {
  padding: 7px 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.56);
  font-size: 12px;
  transition:
    background 0.2s ease,
    transform 0.1s ease-out;
}

.onboarding-example-chip:active {
  transform: scale(0.95);
  background: rgba(255, 255, 255, 0.08);
}

.onboarding-search-results {
  width: 100%;
  max-width: 400px;
  margin-top: 14px;
  display: grid;
  gap: 2px;
}

/* 首页多语言问候轮播：逐字 blur 入场（参考 vue-bits blur-text） */
.onboarding-greeting {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 44px;
  margin-bottom: 6px;
  font-size: 22px;
  font-weight: 600;
  color: var(--accent-color, #fff);
  letter-spacing: 0.04em;
}

.onboarding-greeting-word {
  display: inline-flex;
  white-space: nowrap;
}

.greeting-char {
  display: inline-block;
  animation: greeting-char-in 0.62s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--d, 0ms);
  will-change: filter, transform, opacity;
}

@keyframes greeting-char-in {
  from {
    opacity: 0;
    filter: blur(14px);
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    filter: blur(0);
    transform: translateY(0);
  }
}

.greeting-enter-active {
  transition: opacity 0.01s;
}

.greeting-leave-active {
  transition:
    opacity 0.24s ease,
    filter 0.24s ease;
}

.greeting-leave-to {
  opacity: 0;
  filter: blur(8px);
}

/* 登录步骤：内嵌账号登录面板 */
.onboarding-login-embed {
  width: 100%;
  max-width: 400px;
  text-align: left;
}

.onboarding-login-embed :deep(.account-login-back) {
  display: none;
}

/* 状态栏歌词详细设置（复用系统设置页组件） */
.onboarding-lyric-settings {
  width: 100%;
  max-width: 400px;
  margin-top: 4px;
  text-align: left;
}

.onboarding-search-results :deep(.song-item),
.onboarding-search-results :deep([class*='song']) {
  text-align: left;
}

.onboarding-search-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px 0;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.onboarding-search-state i {
  font-size: 26px;
}

.onboarding-skeleton-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
}

.skeleton-cover {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.07);
  animation: skeleton-pulse 1.2s ease-in-out infinite;
}

.skeleton-lines {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.07);
  animation: skeleton-pulse 1.2s ease-in-out infinite;
}

.skeleton-line.long {
  width: 70%;
}

.skeleton-line.short {
  width: 42%;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

.onboarding-footer {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 24px calc(env(safe-area-inset-bottom, 0px) + 24px);
}

.onboarding-skip {
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  transition: color 0.2s ease;
}

.onboarding-skip:active {
  color: rgba(255, 255, 255, 0.7);
}

.onboarding-primary {
  padding: 13px 32px;
  border: 0;
  border-radius: 999px;
  background: var(--accent-color, #fff);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  transition: transform 0.1s ease-out;
}

.onboarding-primary:active {
  transform: scale(0.96);
}

/* 内嵌播放器预览：等比缩放渲染真实播放器界面（无控件、不可交互） */
.onboarding-player-preview {
  position: relative;
  width: 100%;
  max-width: 300px;
  margin-top: 20px;
  overflow: hidden;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  pointer-events: none;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
}

.onboarding-root.light-theme .onboarding-player-preview {
  border-color: rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.04);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.16);
}

.preview-scale-inner {
  transform-origin: top left;
  pointer-events: none;
}

/* 预览态隐藏各样式播放器的控件区域，仅保留界面本体 */
.onboarding-player-preview :deep(.top-controls) {
  display: none !important;
}

.onboarding-player-preview :deep(.song-header) {
  opacity: 0 !important;
}

/* 播放器样式选择网格（3 列 × 3 行） */
.onboarding-style-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: 100%;
  max-width: 400px;
  margin-top: 16px;
}

.onboarding-style-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.1s ease-out;
}

.onboarding-style-card:active {
  transform: scale(0.95);
}

.onboarding-style-card.selected {
  border-color: var(--accent-color, #fff);
  background: var(--accent-color-10, rgba(255, 255, 255, 0.1));
}

.onboarding-root.light-theme .onboarding-style-card {
  border-color: rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.85);
}

.onboarding-style-icon {
  font-size: 20px;
}

.onboarding-style-hint {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.onboarding-root.light-theme .onboarding-style-hint {
  color: rgba(0, 0, 0, 0.4);
}

.onboarding-error-confirm-hint {
  margin-top: 10px;
  font-size: 12px;
  color: #fbbf24;
}

.onboarding-style-custom {
  width: 100%;
  max-width: 420px;
  margin-top: 14px;
  text-align: left;
}

/* 进出场：materialize（模糊 + 缩放 + 透明度），非单纯 fade */
.onboarding-fade-enter-active {
  transition: opacity 0.36s cubic-bezier(0.32, 0.72, 0, 1);
}

.onboarding-fade-leave-active {
  transition: opacity 0.28s ease;
}

.onboarding-fade-enter-from,
.onboarding-fade-leave-to {
  opacity: 0;
}

.onboarding-fade-enter-from .onboarding-track {
  transform: scale(1.02);
}

@media (prefers-reduced-motion: reduce) {
  .onboarding-page.active .onboarding-page-inner > * {
    animation: none;
  }

  .greeting-char {
    animation: none;
    opacity: 1;
    filter: none;
  }

  .onboarding-glow,
  .onboarding-back,
  .onboarding-option-card,
  .onboarding-action-btn,
  .onboarding-example-chip,
  .onboarding-primary {
    transition: none;
  }

  .onboarding-fade-enter-active,
  .onboarding-fade-leave-active {
    transition: opacity 0.15s ease;
  }
}
</style>
