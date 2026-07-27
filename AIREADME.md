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

安装到设备（USB 调试）：
```bash
adb -s <device_id> install -r android/app/build/outputs/apk/debug/app-debug.apk
```

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
│       │   └── useCoverColor.ts          # ★ 封面取色 → 动态颜色变量
│       ├── layout/
│       │   ├── MobileLayout.vue          # ★ 移动端主布局
│       │   └── components/
│       │       └── MobileHeader.vue      # ★ 浮动顶栏（页面名+搜索框+头像）
│       ├── views/
│       │   ├── home/
│       │   │   └── components/
│       │   │       └── ModularHome.vue   # ★★ 模块化首页（核心）
│       │   ├── set/                   # 设置页
│       │   │   ├── index.vue                # 设置主页
│       │   │   └── tabs/
│       │   │       ├── AboutTab.vue         # 关于（版本/协议/介绍）
│       │   │       ├── InterfaceTab.vue     # 界面设置
│       │   │       └── ...
│       │   └── ...
│       └── i18n/lang/                   # 5 种语言
└── package.json
```

## 四、核心架构要点

### 模块化首页（ModularHome.vue）★★ 核心

首页采用 Apple Music 风格的模块化设计，包含两大区域：

1. **顶部卡片轮播区**：全屏宽度卡片，横向滑动浏览
2. **下方功能网格区**：4 列网格，组件可变大小（1-4 宽 × 1-2 高）

#### 数据模型

```typescript
interface LayoutItem {
  type: BlockType;  // 'daily-recommend' | 'personal-fm' | 'user' | ...
  w: number;        // 宽度：1-4（网格列数）
  h: number;        // 高度：1-2（网格行数）
}

// 存储在 localStorage 'homeLayoutV2'，包含 cards 和 blocks 两个数组
const cardItems = ref<LayoutItem[]>([]);
const blockItems = ref<LayoutItem[]>([]);
```

#### 4 列可变大小网格

- 网格使用 `grid-template-columns: repeat(4, 1fr)`
- 每个组件通过 `grid-column: span {w}` 和 `grid-row: span {h}` 控制大小
- 默认大小为 2×2（正方形），可通过编辑模式下的拖拽把手调整
- 不同大小的组件 UI 有变化（如 3+ 宽度显示更多歌曲预览）

#### 两种编辑模式

| 模式 | 进入方式 | 退出方式 |
|------|----------|----------|
| `drag` | 长按组件 600ms 后开始拖拽 | 手指抬起时自动退出 |
| `manual` | 长按 600ms 但未拖动 | 点击空白区域退出 |

- `drag` 模式：用户长按组件进入编辑并开始拖拽，松手后自动退出
- `manual` 模式：用户长按进入编辑但未拖动，此时可自由拖拽组件，点击空白退出
- 编辑模式下组件会抖动（jiggle 动画），显示删除按钮和拖拽把手

#### FLIP 动画系统

使用 `recordRects()` + `playFlip()` 实现 First-Last-Invert-Play 动画：

```typescript
// 1. 记录变化前位置
const beforeRects = recordRects(container, selector);
// 2. 执行 DOM 变更（通过 Vue nextTick）
await nextTick();
// 3. 计算位移差并播放弹簧动画
playFlip(container, selector, beforeRects);
```

弹簧曲线：`cubic-bezier(0.34, 1.56, 0.64, 1)`，时长 0.45s

#### 跨区域拖拽

- 从网格拖入卡片区：组件变为卡片样式，FLIP 动画平滑过渡
- 从卡片拖出到网格：解除 `overflow: hidden` 防止截断，组件变为 2×2 网格块
- 拖入卡片区时有 morph 动画（快速变圆角）

#### 播放/前往按钮

每个组件右下角有按钮：
- **可播放组件**（每日推荐、私人FM）：显示播放按钮（白色圆形 + 播放图标）
- **其他组件**：显示前往按钮（半透明圆形 + 右箭头）

#### 添加菜单

- 编辑模式下点击"添加"按钮弹出底部抽屉
- 抽屉中以 2×2 缩略图形式展示可用组件
- 缩略图可直接长按拖入主界面

#### 动态取色（Dynamic Color）

通过 `useCoverColor.ts` 提取当前播放歌曲封面颜色，生成 CSS 变量：
- `--cover-bg`：背景色
- `--cover-surface`：表面色（毛玻璃）
- `--accent-color` / `--accent-color-dark` / `--accent-color-light`：强调色

所有组件的渐变、发光、背景都使用这些变量，实现 UI 随音乐变色。

### 浮动顶栏（MobileHeader.vue）

所有页面统一使用浮动顶栏，包含三个超大圆角矩形 pill：
- **页面名**（左侧）：显示当前页面标题或返回箭头
- **搜索框**（中间）：flex-1 占满剩余空间，点击跳转搜索页
- **头像**（右侧）：用户头像，点击跳转"我的"页面

顶栏使用 `position: fixed`，`pointer-events: none`（pill 间区域允许穿透滚动），毛玻璃背景。

### 页面转场动画

```css
/* Apple 风格：交叉淡入 + 微滑动 */
.page-fade-enter-from { opacity: 0; transform: translateY(12px) scale(0.98); }
.page-fade-leave-to { opacity: 0; transform: translateY(-8px) scale(1.01); }
```

搜索框等共享元素因位于固定顶栏中，页面切换时不会消失，自然实现"相同元素过渡"。

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

### 共享组件

| 组件 | 功能 |
|------|------|
| `MobileScrollingLyrics.vue` | 全屏滚动歌词：fit-content 行宽、点击文字跳转、点击空白关闭、拖动显示时间、渐变遮罩 |
| `MobileControlsArea.vue` | 底部控件：进度条+高潮标注+按钮，3秒自动隐藏，z-index 30 |
| `BeatFlashLayer.vue` | 鼓点闪白：高潮时段 `drumDetector` 启动，白色覆盖 150ms 衰减 |

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

**注意**：高潮数据存在 `styleEngine`（`useStyleEngineStore`），不是 `climaxStore`（`useClimaxStore`）。

## 五、代码约定

- Vue SFC 使用 `<script setup lang="ts">`
- 状态管理使用 Pinia（`defineStore`）
- CSS：Tailwind + SCSS（scoped）
- 平台判断：`isMobile`（`@/utils`）
- 提交格式：`<type>: <描述>`（feat / fix / refactor / style / docs / chore）
- **每次修改后必须 commit + push**
- 动画使用 Apple 弹簧曲线：`cubic-bezier(0.34, 1.56, 0.64, 1)`
- 颜色使用动态 CSS 变量（`--cover-bg`, `--accent-color` 等），不硬编码

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
| FLIP 拖拽动画瞬移 | 使用双 rAF 但与 Vue 响应式不同步 | 改用 `nextTick()` + `recordRects/playFlip` |
| 卡片拖出被容器截断 | `cards-track` 的 `overflow: hidden` | 拖出时设为 `overflow: visible` |
| 编辑模式误触发 | 长按阈值太低 | 600ms + 10px 移动检测 |
| 旧布局数据不兼容 | `homeLayout` 格式变化 | 自动迁移到 `homeLayoutV2` |
