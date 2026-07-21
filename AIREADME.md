# AIREADME — AI 协作开发指南

> 本文件供 AI 助手快速理解项目架构、开发规范和已知陷阱。
> **每次修改代码后必须提交一次 commit。** 如需更高权限（push/release/tag），向用户索要 GitHub Token。

## 项目关系

| 项目 | 目录 | GitHub |
|------|------|--------|
| **桌面版**（Electron） | `../zephyrus-music-player` | [cang-dot/zephyrus-player](https://github.com/cang-dot/zephyrus-player) |
| **安卓版**（本仓库） | `../zephyrus-player-android` | — |

本仓库是桌面版的 Capacitor Android 移植，两者共享 `src/renderer/` 渲染层代码。桌面版新增功能需手动同步到本仓库，反之亦然。

---

## 一、平台概述

本仓库是 Zephyrus Player 的 **Electron + Capacitor Android** 双平台代码库。同一套 Vue 3 渲染代码（`src/renderer/`）通过 `isElectron` / `isMobile` / `isAndroidNative` 条件分支适配两个平台。

| 平台 | 入口 | 渲染方式 |
|------|------|---------|
| 桌面 | Electron 40 | Chromium BrowserWindow |
| Android | Capacitor 8 | Android WebView |

## 二、常用命令

```bash
# 桌面开发
npm run dev              # Electron 开发模式
npm run build            # Electron 构建
npm run dev:web          # 纯 Web 模式（需要外部 API 服务器）

# 代码质量
npm run lint             # ESLint + i18n 检查
npm run typecheck:web    # TypeScript 类型检查（vue-tsc）

# Android 构建
npm run build:web        # 构建 Web 资源
npx cap sync android     # 同步到 Android 项目
npx cap open android      # 用 Android Studio 打开
```

## 三、项目结构（关键路径）

```
zephyrus-player-android/
├── android/                        # Capacitor Android 原生壳
│   └── app/src/main/
│       ├── java/.../MainActivity.java   # 状态栏/导航栏/WebView 初始化
│       ├── java/.../NativeBridge.java   # WebView ↔ 原生桥接
│       ├── res/values/colors.xml        # 亮色主题颜色（新建）
│       ├── res/values-night/colors.xml  # 深色主题颜色（新建）
│       └── res/values/styles.xml        # AppTheme / AppTheme.NoActionBar
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 窗口创建、IPC 注册
│   │   ├── lyric.ts             # 桌面歌词独立窗口
│   │   ├── server.ts            # 本地 Express API 服务
│   │   └── modules/
│   │       ├── localMusicScanner.ts  # 本地音乐递归扫描 + music-metadata
│   │       ├── window.ts        # 窗口管理
│   │       └── tray.ts          # 系统托盘
│   ├── preload/index.ts         # Electron IPC 桥接
│   └── renderer/                # Vue 3 渲染进程（Web + Electron + Android 共享）
│       ├── components/
│       │   ├── lyric/           # ★ 播放器样式组件
│       │   │   ├── MusicFullWrapper.vue    # 样式路由中枢（桌面/移动/横竖屏）
│       │   │   ├── MusicFullMobile.vue     # 默认样式移动端
│       │   │   ├── EerieMobilePlayer.vue   # 诡谲移动端
│       │   │   ├── NeonMobilePlayer.vue    # 陈旧移动端
│       │   │   ├── StageMobilePlayer.vue   # 舞台移动端
│       │   │   ├── FrenzyMobilePlayer.vue  # 狂躁移动端
│       │   │   ├── MagazineMobilePlayer.vue
│       │   │   └── ...（对应桌面端组件）
│       │   ├── player/          # 播放栏
│       │   │   ├── PlayBar.vue           # 桌面播放栏（含高潮标注）
│       │   │   ├── MobilePlayerSettings.vue  # 移动端播放设置
│       │   │   └── PlayingListDrawer.vue # 播放列表抽屉
│       │   └── common/          # 通用组件（SongItem、InfiniteCoverGrid 等）
│       ├── playerStyles/        # 样式注册插件系统
│       │   ├── registry.ts      # registerStyle / getStyle
│       │   └── {default,stage,magazine,frenzy,eerie,neon}/
│       ├── store/modules/
│       │   ├── climax.ts        # 高潮段落（segments、hasSegments）
│       │   ├── styleEngine.ts   # 音频特征聚合（isInClimax、climaxSegments）
│       │   ├── playerCore.ts    # 播放控制核心
│       │   └── localMusic.ts    # 本地音乐 IndexedDB 缓存
│       ├── services/
│       │   ├── audioService.ts     # 音频引擎（Howler + Web Audio EQ）
│       │   ├── climaxDetector.ts   # 实时高潮检测（RMS + 频谱）
│       │   ├── drumDetector.ts     # 鼓点检测（BPM + 节拍）
│       │   └── localAudioPlayer.ts # 本地文件播放器
│       ├── hooks/
│       │   ├── MusicHook.ts     # ★ 播放进度/歌词/切歌核心
│       │   └── useCoverColor.ts # 封面取色
│       ├── views/
│       │   ├── list/index.vue   # 歌单无限网格
│       │   └── local-music/index.vue # 本地音乐（桌面文件夹 / 移动端目录选取）
│       └── i18n/lang/           # 5 种语言（zh-CN/en-US/ja-JP/ko-KR/zh-Hant）
└── package.json                 # 全平台依赖与脚本
```

## 四、核心架构要点

### 播放器样式路由

`MusicFullWrapper.vue` 是样式路由中枢：

```
isMobile.value === true
  ├─ style.key === 'default'  → MusicFullMobile.vue
  ├─ style.key === 'stage'    → StageMobilePlayer.vue
  ├─ style.key === 'magazine' → MagazineMobilePlayer.vue
  ├─ style.key === 'frenzy'   → FrenzyMobilePlayer.vue
  ├─ style.key === 'eerie'    → EerieMobilePlayer.vue
  └─ style.key === 'neon'     → NeonMobilePlayer.vue
isMobile.value === false（桌面端）
  └─ style.component（原始组件，来自 registry）
```

横竖屏均使用同一个移动端组件，通过 CSS 自适应。控件 3 秒无操作自动隐藏（`useTapToggle` composable）。

### 进度条时间的正确获取方式

**错误**（已修复的 bug）：
```ts
const currentTime = computed(() => playerStore.playingTime || 0);  // playingTime 不存在！
playerStore.setPlayTime(seekTime);  // setPlayTime 不存在！
```

**正确**：
```ts
import { nowTime, sound } from '@/hooks/MusicHook';
const currentTime = computed(() => nowTime.value);  // 每 50ms 更新

function handleSeek(e: MouseEvent) {
  const seekTime = ...;
  if (sound.value) {
    sound.value.seek(seekTime);
    nowTime.value = seekTime;
  }
}
```

### 高潮段落叠加层

所有移动端播放器的进度条都应包含高潮标注。需要在每个组件的 `progress-bar-bg` 内添加：

```html
<div class="climax-track" v-if="climaxStore.hasSegments && duration > 0">
  <div v-for="(seg, i) in climaxStore.segments" :key="i"
       class="climax-segment"
       :class="{ 'climax-active': nowTime >= seg.start && nowTime <= seg.end }"
       :style="{ left: (seg.start / duration) * 100 + '%',
                 width: Math.max(0.5, ((seg.end - seg.start) / duration) * 100) + '%' }" />
</div>
```

每个移动端播放器需要在 `playerStore.currentSong?.id` 的 watcher 中调用 `styleEngine.loadClimaxData(songId)` 以加载高潮数据。

### Android 原生层注意事项

- 状态栏和导航栏颜色必须通过 `colors.xml` + `styles.xml` 中的 `android:statusBarColor` / `android:navigationBarColor` 显式设置，否则会回退为默认灰色
- 导航栏不要设为 `Color.TRANSPARENT`，否则 `CoordinatorLayout` 的默认灰色底会透出
- `CoordinatorLayout` 在 `activity_main.xml` 中需要有 `android:background` 属性
- 深色/亮色两套颜色在 `values/colors.xml` 和 `values-night/colors.xml` 中分别定义

### i18n 样式名称

5 种语言文件都应在 `player.styles` 下包含全部 6 个键：`default`、`stage`、`magazine`、`frenzy`、`eerie`、`neon`。

在 `MobilePlayerSettings.vue` 中，`t('player.styles.eerie') || '诡谲'` 这种写法**不生效**——i18n 找不到键时会返回键路径字符串（truthy），`||` 回退不会触发。应使用辅助函数：

```ts
const tr = (key: string, fallback: string) => {
  const v = t(key);
  return v === key ? fallback : v;
};
```

### 歌单网格 (`views/list/index.vue`)

- 基于 `requestAnimationFrame` 的无限滚动
- 触摸设备上 `mouseenter`/`mouseleave` 不可靠——`pointerup` 时对 `pointerType === 'touch'` 显式清除 `hoveredRow` 以恢复自动滚动
- **必须**监听 `pointercancel`，否则触摸被手势打断后 `isDragging` 卡死，封面标题永远不可见

## 五、核心数据流

```
用户操作 → PlayBar / MusicFull
  ↓
playerStore
  ├─ playerCore.handlePlayMusic() → audioService.play()
  │   └─ Howler / LocalAudioPlayer → Web Audio EQ → 输出
  ↓
MusicHook（全局监听器）
  ├─ 进度 interval (50ms) → nowTime / 歌词索引
  └─ smartMixService.checkCrossfade()
```

## 六、代码约定

- Vue SFC 使用 `<script setup lang="ts">`
- 状态管理使用 Pinia（`defineStore`）
- CSS：Tailwind + SCSS（scoped）
- 平台差异化通过 `isElectron` / `isMobile` / `isAndroidNative`（`@/utils`）
- 提交格式：`<type>: <描述>`（feat / fix / refactor / style / docs / chore）

## 七、已知问题与历史修复

| 问题 | 根因 | 修复 |
|------|------|------|
| Android 状态栏/导航栏灰色背景 | `colors.xml` 缺失，`NoActionBar` 未设置 bar 颜色，导航栏 `TRANSPARENT` 透出默认灰色 | 创建 `colors.xml` + `values-night/colors.xml`，在 `styles.xml` 中显式设置 `statusBarColor`/`navigationBarColor`，`CoordinatorLayout` 添加 `android:background` |
| 非默认样式移动端进度条显示 `00:00` | 引用了不存在的 `playerStore.playingTime` / `setPlayTime()` | 改用 `nowTime` / `sound` from `@/hooks/MusicHook` |
| 竖屏非默认样式未显示专属界面 | `MusicFullWrapper` 将所有竖屏样式路由到 `MusicFullMobile` | 统一移动端路由逻辑，非默认样式使用各自专属组件 |
| Stage/Frenzy/Magazine 移动端 `isInClimax` 永远为 false | 未在切歌时调用 `styleEngine.loadClimaxData()` | 添加 `watch playerStore.currentSong?.id` + 调用 `loadClimaxData` |
| 歌单网格触摸拖拽后不动了 | `pointercancel` 未监听 → `isDragging` 卡死；`hoveredRow` 在 touchend 后未清除 → 自动滚动永久暂停 | 添加 `pointercancel` 监听，`pointerup` 时对 `pointerType === 'touch'` 清除 `hoveredRow` |
| "诡谲"/"陈旧" 样式名显示为英文 key | i18n 缺少 `eerie`/`neon` 键，且 `||` 回退对 i18n 返回键路径时不生效 | 在所有语言文件中添加 `eerie`/`neon` 翻译；添加 `tr()` 辅助函数 |
