# AIREADME — AI 协作开发指南

> 本文件供 AI 助手快速理解项目架构、开发规范和已知陷阱。
> **每次修改代码后必须提交一次 commit。** 如需更高权限（push/release/tag），向用户索要 GitHub Token。

## 项目关系

| 项目 | GitHub |
|------|--------|
| **安卓版**（本仓库） | [cang-dot/zephyrus-player-android](https://github.com/cang-dot/zephyrus-player-android) |
| **桌面版**（Electron） | [cang-dot/zephyrus-player](https://github.com/cang-dot/zephyrus-player) |

本仓库是安卓独立版本，基于桌面版深度移植。版本号：**v1-alpha**。

---

## 一、平台概述

纯 Android 应用，使用 Capacitor 8 + Android WebView 渲染 Vue 3 前端。

| 层 | 技术 |
|----|------|
| 前端 | Vue 3.5 + TypeScript 5.9 + Vite 6 |
| 原生壳 | Capacitor 8 (Android) |
| 音频 | Howler.js + Web Audio API |
| 状态 | Pinia |
| 样式 | Tailwind CSS + SCSS |

## 二、常用命令

```bash
npm run build              # 构建前端 Web 资源
npx cap sync android       # 同步到 Android 项目
cd android && ./gradlew assembleDebug  # 构建 APK
npm run dev:web            # Web 开发模式
npm run typecheck:web      # TypeScript 类型检查
npm run lint               # 代码检查
```

APK 输出：`android/app/build/outputs/apk/debug/app-debug.apk`

## 三、项目结构（关键路径）

```
zephyrus-player-android/
├── android/                           # Capacitor Android 原生壳
│   └── app/src/main/
│       ├── java/.../MainActivity.java      # WebView 初始化
│       ├── res/values/colors.xml           # 主题颜色
│       └── res/values/styles.xml           # AppTheme
├── src/
│   ├── main/                          # Electron 主进程（仅桌面兼容）
│   │   └── server.ts                       # 本地 API 服务
│   ├── preload/index.ts               # IPC 桥接
│   └── renderer/                      # Vue 3 渲染层（核心）
│       ├── components/
│       │   ├── lyric/                 # ★ 播放器样式组件
│       │   │   ├── MusicFullWrapper.vue       # 样式路由中枢
│       │   │   ├── MusicFullMobile.vue         # 默认样式
│       │   │   ├── MobileScrollingLyrics.vue   # ★ 共享滚动歌词
│       │   │   ├── MobileControlsArea.vue       # ★ 共享底部控件
│       │   │   ├── BeatFlashLayer.vue           # ★ 鼓点闪白
│       │   │   ├── StageMobilePlayer.vue        # 舞台
│       │   │   ├── EerieMobilePlayer.vue        # 诡谲
│       │   │   ├── NeonMobilePlayer.vue         # 陈旧
│       │   │   ├── FrenzyMobilePlayer.vue       # 狂热
│       │   │   └── MagazineMobilePlayer.vue     # 杂志
│       │   └── player/
│       │       ├── MobilePlayerSettings.vue     # 播放设置（含自定义效果）
│       │       └── MobilePlayBar.vue             # 迷你播放栏
│       ├── composables/
│       │   ├── useTapToggle.ts           # ★ 单击/双击 + 3秒隐藏
│       │   └── useStyleCustomConfig.ts   # ★ 样式自定义参数读取
│       ├── store/modules/
│       │   ├── styleEngine.ts           # 高潮数据 + climaxSegments
│       │   ├── playerCore.ts            # 播放控制
│       │   └── settings.ts              # 应用设置
│       ├── services/
│       │   ├── audioService.ts           # 音频引擎
│       │   ├── climaxDetector.ts        # 高潮检测
│       │   └── drumDetector.ts           # 鼓点检测
│       ├── hooks/
│       │   ├── MusicHook.ts             # ★ 播放/歌词/进度核心
│       │   └── useCoverColor.ts          # 封面取色
│       ├── views/set/                   # 设置页
│       │   ├── index.vue                # 设置主页
│       │   └── tabs/
│       │       ├── AboutTab.vue         # 关于（版本/协议/介绍）
│       │       ├── InterfaceTab.vue     # 界面设置
│       │       └── ...
│       └── i18n/lang/                   # 5 种语言
└── package.json
```

## 四、核心架构要点

### 播放器样式路由

`MusicFullWrapper.vue` 根据 `playerStyle` 和 `isMobile` 路由到对应组件：

```
isMobile.value === true
  ├─ style.key === 'default'  → MusicFullMobile.vue
  ├─ style.key === 'stage'    → StageMobilePlayer.vue
  ├─ style.key === 'magazine' → MagazineMobilePlayer.vue
  ├─ style.key === 'frenzy'   → FrenzyMobilePlayer.vue
  ├─ style.key === 'eerie'    → EerieMobilePlayer.vue
  └─ style.key === 'neon'     → NeonMobilePlayer.vue
```

竖屏和横屏均使用同一个移动端组件，通过 CSS 自适应。

### 共享组件

| 组件 | 功能 |
|------|------|
| `MobileScrollingLyrics.vue` | 全屏滚动歌词：fit-content 行宽、点击文字跳转、点击空白关闭、拖动显示时间、渐变遮罩 |
| `MobileControlsArea.vue` | 底部控件：进度条+高潮标注+按钮，3秒自动隐藏，z-index 30 |
| `BeatFlashLayer.vue` | 鼓点闪白：高潮时段 `drumDetector` 启动，白色覆盖 150ms 衰减 |

### 交互逻辑

```
单击屏幕 → 切换控件显隐（300ms 延迟区分双击）
双击屏幕 → 进入滚动歌词（showFullLyrics = true）
滚动歌词内：
  ├─ 点击文字 → setAudioTime(index) 跳转进度
  ├─ 点击空白 → emit('close') 关闭滚动歌词
  ├─ 拖动滚动 → 右侧时间指示器 + emit('interact') 显示控件
  └─ 点击时间指示器 → setAudioTime 跳转
```

### 自定义效果配置

`useStyleCustomConfig(styleKey)` composable 从 `localStorage` 读取 `styleCustomConfig[styleKey]`：

| 样式 | 参数 |
|------|------|
| Stage | auroraSpeed, beatFlashIntensity |
| Eerie | newspaperFreq, keywordSize |
| Neon | glowRadius, pulseSpeed |
| Frenzy | giantSize |
| Magazine | flipSpeed |
| 通用 | customFontFamily（TTF 导入） |

数据流：`MobilePlayerSettings` 滑块 → `styleConfig` watch → `saveStyleConfig()` → localStorage → `dispatchEvent` → 各组件 `useStyleCustomConfig` 重新加载 → computed 更新。

### 播放控制

```ts
// 进度条 seek
import { sound } from '@/hooks/MusicHook';
sound.value?.seek(time);  // 直接控制音频

// 播放/暂停
import { play, pause } from '@/hooks/MusicHook';
play();   // 或 pause()

// 播放状态
const isPlaying = computed(() => playerStore.isPlay);
```

### 高潮数据

```ts
// 在移动端组件中加载高潮数据
watch(
  () => playerStore.currentSong?.id,
  (songId) => {
    if (songId) styleEngine.loadClimaxData(String(songId));
  },
  { immediate: true }
);

// 判断是否在高潮时段
const isInClimax = computed(() => {
  const t = nowTime.value;
  return styleEngine.climaxSegments.some(s => t >= s.start && t <= s.end);
});
```

**注意**：高潮数据存在 `styleEngine`（`useStyleEngineStore`），不是 `climaxStore`（`useClimaxStore`）。`BeatFlashLayer` 和 `MobileControlsArea` 都应使用 `styleEngine.climaxSegments`。

### 启动默认页

路由 redirect 同步读 `localStorage`（非异步 store）：
```ts
redirect: () => {
  try {
    const saved = localStorage.getItem('settings-data');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.defaultPage) return data.defaultPage;
    }
  } catch {}
  return '/';
}
```

`defaultPageOptions` 仅包含移动端可用页面（移除了 `/search`、`/album`、`/toplist`）。

## 五、代码约定

- Vue SFC 使用 `<script setup lang="ts">`
- 状态管理使用 Pinia（`defineStore`）
- CSS：Tailwind + SCSS（scoped）
- 平台判断：`isMobile`（`@/utils`）
- 提交格式：`<type>: <描述>`（feat / fix / refactor / style / docs / chore）
- **每次修改后必须 commit**

## 六、已知问题与历史修复

| 问题 | 根因 | 修复 |
|------|------|------|
| 鼓点闪白不生效 | `BeatFlashLayer` 用 `climaxStore`（空），数据在 `styleEngine` | 改用 `useStyleEngineStore` |
| 进度条无法 seek | `playerStore.setNowTime()` 只更新 store | 改用 `sound.value.seek(time)` |
| 暂停不同步 | `playerStore.setPlay()` 期望 SongResult 参数 | 改用 MusicHook 的 `play()` / `pause()` |
| 滚动歌词时间显示 1692:80 | `item.startTime` 是毫秒 | 改用 `lrcTimeArray.value[i]`（秒） |
| 歌词悬停高亮残留 | `.hover-text:hover` 在触摸设备上不消失 | 包裹 `@media (hover: hover)` |
| 控件层级被滚动歌词遮住 | z-index 不够 | `MobileControlsArea` z-index 改为 30 |
| 启动默认页手机端无效 | 路由 redirect 依赖异步 store | 改为同步读 `localStorage` |
| 舞台中文歌词字体 | 默认 Cormorant Garamond | 添加 Noto Serif SC |
