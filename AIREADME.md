# AIREADME — AI 协作开发指南

> 本文件供 AI 助手快速理解项目架构、开发规范和已知陷阱。
> **每次修改代码后必须提交一次 commit。** 如需更高权限（push / release / tag），向用户索要 GitHub Token。

## 项目关系

| 项目 | GitHub |
|------|--------|
| **安卓版**（本仓库） | [cang-dot/zephyrus-player-android](https://github.com/cang-dot/zephyrus-player-android) |
| **桌面版**（Electron） | [cang-dot/zephyrus-player](https://github.com/cang-dot/zephyrus-player) |

本仓库是安卓独立版本，基于桌面版深度移植。版本号：**v1.1.0**。

---

## 一、平台概述

纯 Android 应用，使用 Capacitor 8 + Android WebView 渲染 Vue 3 前端。项目同时保留了 Electron 主进程代码（桌面兼容），但移动端运行时只使用 WebView 渲染层 + Java 原生桥接。

| 层 | 技术 |
|----|------|
| 前端 | Vue 3.5 + TypeScript 5.9 + Vite 6 |
| 原生壳 | Capacitor 8 (Android) |
| 原生桥接 | Java `NativeBridge.java` + `@JavascriptInterface` |
| 音频 | Howler.js + Web Audio API + `LocalAudioPlayer` |
| 状态 | Pinia (`pinia-plugin-persistedstate`) |
| 样式 | Tailwind CSS + SCSS |
| 动画 | GSAP + CSS Animations |
| i18n | vue-i18n（5 种语言：zh-CN / zh-Hant / en-US / ja-JP / ko-KR） |

### 移动端 vs 桌面端

代码通过 `isMobile`（`@/utils`）区分平台：

- **移动端独有**：`MobileLayout.vue` 主布局、`MobileHeader.vue` 浮动顶栏、`MobilePlayBar.vue` 迷你播放栏、深度链接分享、剪贴板智能识别、本地音乐原生扫描
- **桌面端独有**：`AppLayout.vue` / `MiniLayout.vue` / `OverlayLayout.vue` 多布局系统、`TitleBar.vue` 标题栏、`FloatingSidebar.vue` 侧栏、全局快捷键、窗口管理
- **共享**：所有播放器样式组件、Pinia stores、services、hooks、i18n

---

## 二、常用命令

```bash
npm run build              # 构建前端 Web 资源（electron-vite build → out/renderer/）
npx cap sync android       # 同步到 Android 项目
cd android && ./gradlew assembleDebug  # 构建 APK
npm run dev:web            # Web 开发模式（浏览器调试）
npm run typecheck          # TypeScript 类型检查（node + web）
npm run typecheck:web      # 仅 Web 类型检查
npm run lint               # 代码检查 + i18n 检查
npm run format             # Prettier 格式化
```

APK 输出：`android/app/build/outputs/apk/debug/app-debug.apk`

安装到设备（USB 调试）：

```bash
adb -s <device_id> install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### CI/CD

GitHub Actions（`.github/workflows/build.yml`）：推送 `v*` tag 自动构建 APK 并发布 Release。

---

## 三、项目结构

```
zephyrus-player-android/
├── android/                                    # Capacitor Android 原生壳
│   └── app/src/main/
│       ├── java/com/zephyrus/player/
│       │   ├── MainActivity.java               # WebView 初始化 + 深度链接 + 生命周期
│       │   ├── NativeBridge.java               # ★ @JavascriptInterface 原生桥接
│       │   ├── MusicPlaybackService.java        # 后台播放服务
│       │   └── MediaNotificationManager.java    # 媒体通知栏
│       └── res/values/
│           ├── colors.xml                       # 主题颜色
│           └── styles.xml                       # AppTheme
├── src/
│   ├── main/                                   # Electron 主进程（桌面兼容）
│   │   ├── index.ts                            # 入口
│   │   ├── server.ts                           # 本地 Express API 服务
│   │   └── modules/
│   │       ├── fileManager.ts                  # 文件操作
│   │       ├── localMusicScanner.ts            # 桌面端本地音乐扫描
│   │       ├── multiPlatformSearch.ts          # 跨平台搜索
│   │       ├── unblockMusic.ts                 # 解锁音源
│   │       └── ...
│   ├── preload/index.ts                        # IPC 桥接（桌面端）
│   └── renderer/                               # ★★ Vue 3 渲染层（核心）
│       ├── components/
│       │   ├── lyric/                          # ★ 播放器样式组件
│       │   │   ├── MusicFullWrapper.vue        # 样式路由中枢（根据 playerStyle 分发）
│       │   │   ├── MusicFullMobile.vue         # 默认样式（封面取色 + 逐字歌词）
│       │   │   ├── StageMobilePlayer.vue       # 舞台（深色 + 大字歌词 + 鼓点闪白）
│       │   │   ├── EerieMobilePlayer.vue       # 诡谲（噪点 + 书法字 + VHS 效果）
│       │   │   ├── NeonMobilePlayer.vue        # 陈旧（混凝土 + 霓虹描边字）
│       │   │   ├── FrenzyMobilePlayer.vue      # 狂热（极简色块 + 巨字歌词）
│       │   │   ├── MagazineMobilePlayer.vue    # 杂志（色块拼贴 + 期刊式歌词）
│       │   │   ├── RainMobilePlayer.vue        # 雨夜（3D 封面 + Canvas 雨水）
│       │   │   ├── MobileScrollingLyrics.vue   # ★ 共享全屏滚动歌词
│       │   │   ├── MobileControlsArea.vue      # ★ 共享底部控件（进度条 + 按钮）
│       │   │   ├── BeatFlashLayer.vue          # ★ 鼓点闪白层
│       │   │   ├── RainCanvas.vue              # Canvas 雨水效果引擎
│       │   │   └── NeonStrokeChar.vue          # 霓虹描边字符组件
│       │   ├── player/
│       │   │   ├── MobilePlayBar.vue           # ★ 移动端迷你播放栏
│       │   │   ├── MobilePlayerSettings.vue    # 播放设置（含自定义效果参数）
│       │   │   ├── PlayBar.vue                 # 桌面端播放栏
│       │   │   ├── PlayingListDrawer.vue       # 当前播放列表抽屉
│       │   │   └── SleepTimer.vue              # 定时关闭
│       │   ├── common/
│       │   │   ├── SharedSongCard.vue          # ★ 分享歌曲卡片（深度链接）
│       │   │   ├── GlowTabs.vue                # ★ 光晕滑块 Tab 组件
│       │   │   ├── SongItem.vue / songItemCom/ # 歌曲列表项（多种变体）
│       │   │   ├── PlaylistDrawer.vue          # 歌单抽屉
│       │   │   ├── MobileSongActionSheet.vue   # 移动端歌曲操作面板
│       │   │   ├── MobileUpdateModal.vue       # 移动端更新弹窗
│       │   │   └── ...
│       │   ├── settings/                       # 设置组件
│       │   ├── share/                          # 分享组件（海报生成）
│       │   ├── splash/SplashScreen.vue         # 启动画面
│       │   └── ...
│       ├── composables/
│       │   ├── useTapToggle.ts                 # ★ 单击/双击 + 3 秒隐藏
│       │   ├── useStyleCustomConfig.ts         # ★ 样式自定义参数读取
│       │   ├── useCoverTransition.ts           # 封面切换动画
│       │   ├── useHeroCard.ts                  # Hero Card 收起/展开
│       │   ├── useSwipeClose.ts                # 滑动关闭手势
│       │   └── useSmartAudio.ts                # 智能音频管理
│       ├── store/modules/
│       │   ├── styleEngine.ts                  # ★ 高潮数据 + climaxSegments
│       │   ├── player.ts / playerCore.ts       # ★ 播放控制
│       │   ├── settings.ts                     # 应用设置
│       │   ├── localMusic.ts                   # ★ 本地音乐（扫描 + IndexedDB 缓存）
│       │   ├── search.ts                       # 搜索（跨平台）
│       │   ├── lyric.ts                        # 歌词解析
│       │   ├── user.ts                         # 用户信息
│       │   ├── sleepTimer.ts                   # 定时关闭
│       │   └── ...
│       ├── services/
│       │   ├── audioService.ts                 # ★ 音频引擎（Howler + EQ + LocalAudioPlayer）
│       │   ├── localAudioPlayer.ts             # ★ 本地音频播放器（Web Audio API）
│       │   ├── climaxDetector.ts               # 高潮检测
│       │   ├── drumDetector.ts                 # 鼓点检测
│       │   ├── eqService.ts                    # 均衡器
│       │   ├── cacheService.ts                 # 缓存服务
│       │   ├── sourceProbeService.ts           # 音源探测
│       │   ├── playbackController.ts           # 播放控制
│       │   ├── lyricTranslation.ts             # 歌词翻译
│       │   ├── androidNative.ts                # Android 原生接口封装
│       │   └── ...
│       ├── hooks/
│       │   ├── MusicHook.ts                    # ★ 播放/歌词/进度核心
│       │   ├── useCoverColor.ts                # ★ 封面取色 → 动态 CSS 变量
│       │   ├── useLocalMusic.ts                # 本地音乐 Hook
│       │   ├── usePlaybackControl.ts           # 播放控制 Hook
│       │   ├── useDownload.ts                  # 下载管理
│       │   └── ...
│       ├── layout/
│       │   ├── MobileLayout.vue                # ★ 移动端主布局
│       │   ├── AppLayout.vue                   # 桌面端全功能布局
│       │   ├── MiniLayout.vue                  # 桌面端迷你布局
│       │   ├── OverlayLayout.vue               # 桌面端覆盖布局
│       │   └── components/
│       │       ├── MobileHeader.vue            # ★ 浮动顶栏（页面名 + 搜索框 + 头像）
│       │       ├── FloatingHeroCard.vue         # ★ Hero Card 浮动卡片
│       │       ├── FloatingSidebar.vue          # 桌面侧栏
│       │       ├── FloatingSearchBar.vue        # 桌面搜索栏
│       │       └── OverlayPlayerHost.vue        # 覆盖播放器容器
│       ├── views/
│       │   ├── home/
│       │   │   └── components/
│       │   │       ├── ModularHome.vue         # ★★ 模块化首页（核心）
│       │   │       ├── HomeHero.vue            # 首页 Hero 区域
│       │   │       └── ...
│       │   ├── local-music/index.vue           # ★ 本地音乐页
│       │   ├── mobile-search/                  # 移动端搜索
│       │   ├── mobile-search-result/           # 移动端搜索结果
│       │   ├── user/                           # 用户页（含平台账号管理）
│       │   ├── set/                            # 设置页
│       │   │   └── tabs/                       # 设置标签页
│       │   ├── login/                          # 登录页
│       │   ├── lyric/                          # 桌面歌词页
│       │   ├── playlist/                       # 歌单
│       │   ├── album/                          # 专辑
│       │   ├── artist/                         # 歌手
│       │   ├── toplist/                        # 排行榜
│       │   ├── favorite/                       # 收藏
│       │   ├── history/                        # 播放历史
│       │   ├── download/                       # 下载管理
│       │   ├── mv/                             # MV
│       │   ├── podcast/                        # 播客
│       │   └── ...
│       ├── utils/
│       │   ├── index.ts                        # ★ isMobile 等通用工具
│       │   ├── deepLink.ts                     # 深度链接处理
│       │   ├── localMusicUtils.ts              # 本地音乐工具
│       │   ├── yrcParser.ts                    # 逐字歌词解析
│       │   ├── ttmlParser.ts                   # TTML 歌词解析
│       │   ├── posterEngine.ts                 # 海报生成引擎
│       │   ├── shareUtil.ts                    # 分享工具
│       │   ├── wordSplitter.ts                 # 中文分词
│       │   └── ...
│       └── i18n/ → ../../i18n/                 # 5 种语言
├── capacitor.config.ts                         # Capacitor 配置
├── package.json
└── .github/workflows/build.yml                 # CI/CD
```

---

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

#### 两种编辑模式

| 模式 | 进入方式 | 退出方式 |
|------|----------|----------|
| `drag` | 长按组件 600ms 后开始拖拽 | 手指抬起时自动退出 |
| `manual` | 长按 600ms 但未拖动 | 点击空白区域退出 |

编辑模式下组件会抖动（jiggle 动画），显示删除按钮和拖拽把手。

#### FLIP 动画系统

使用 `recordRects()` + `playFlip()` 实现 First-Last-Invert-Play 动画：

```typescript
const beforeRects = recordRects(container, selector);
await nextTick();
playFlip(container, selector, beforeRects);
```

弹簧曲线：`cubic-bezier(0.34, 1.56, 0.64, 1)`，时长 0.45s。

### 播放器样式路由

`MusicFullWrapper.vue` 根据 `playerStyle` 和 `isMobile` 路由到对应组件：

```
isMobile.value === true
  ├─ style.key === 'default'  → MusicFullMobile.vue
  ├─ style.key === 'stage'    → StageMobilePlayer.vue
  ├─ style.key === 'magazine' → MagazineMobilePlayer.vue
  ├─ style.key === 'frenzy'   → FrenzyMobilePlayer.vue
  ├─ style.key === 'eerie'    → EerieMobilePlayer.vue
  ├─ style.key === 'neon'     → NeonMobilePlayer.vue
  └─ style.key === 'rain'     → RainMobilePlayer.vue
```

### 共享组件

| 组件 | 功能 |
|------|------|
| `MobileScrollingLyrics.vue` | 全屏滚动歌词：fit-content 行宽、点击文字跳转、拖动显示时间、渐变遮罩 |
| `MobileControlsArea.vue` | 底部控件：进度条 + 高潮标注 + 按钮，3 秒自动隐藏，z-index 30 |
| `BeatFlashLayer.vue` | 鼓点闪白：高潮时段 `drumDetector` 启动，白色覆盖 150ms 衰减 |
| `RainCanvas.vue` | Canvas 雨水效果：粒子系统 + 风向 + 底部反射涟漪 |

### 高潮数据

```typescript
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

### 浮动顶栏（MobileHeader.vue）

所有页面统一使用浮动顶栏，包含三个超大圆角矩形 pill：

- **页面名**（左侧）：显示当前页面标题或返回箭头，在有 Hero Card 的页面自动隐藏
- **搜索框**（中间）：flex-1 占满剩余空间，点击跳转搜索页
- **头像**（右侧）：用户头像，点击跳转"我的"页面

顶栏使用 `position: fixed`，`pointer-events: none`（pill 间区域允许穿透滚动），毛玻璃背景。

### 本地音乐系统

#### 原生扫描（Android）

`NativeBridge.java` 通过 `MediaMetadataRetriever` 提取元数据：

- `scanLocalMusic()` — 扫描设备音频文件
- `getAudioMetadata(path)` — 提取标题/艺术家/专辑/封面/时长/歌词
- `extractEmbeddedLyrics()` — 嵌入式歌词提取（ID3v2 USLT / FLAC LYRICS）
- `copyToCacheDirAsync()` — 异步复制文件到缓存目录（避免阻塞 JS 线程）

#### 前端处理

- `localAudioPlayer.ts` — 通过 Web Audio API 播放本地文件，支持异步加载
- `localMusic.ts` (store) — 管理扫描结果，IndexedDB 缓存，`SCAN_VERSION` 控制重新扫描
- `useLocalMusic.ts` (hook) — 扫描状态 + 播放控制

**关键**：本地音乐播放时，`audioService.ts` 的 `setupEQ` 会调用 `_setupEQLocalMobile()` 连接到 `AudioContext.destination`，否则没有声音。

### 深度链接分享

- `zephyrus://song/{id}` — 拉起 App 并弹出 `SharedSongCard`
- `MainActivity.java` 处理 Intent + 冷启动 `pendingUrl` 队列重试
- `deepLink.ts` (utils) — 解析链接，构建歌曲对象
- `relay.html` — 中转页（暗色玻璃拟态，30 秒试听）

### 动态取色（Dynamic Color）

通过 `useCoverColor.ts` 提取当前播放歌曲封面颜色，生成 CSS 变量：

- `--cover-bg`：背景色
- `--cover-surface`：表面色（毛玻璃）
- `--accent-color` / `--accent-color-dark` / `--accent-color-light`：强调色

所有组件的渐变、发光、背景都使用这些变量，实现 UI 随音乐变色。

### 页面转场动画

```css
/* Apple 风格：交叉淡入 + 微滑动 */
.page-fade-enter-from { opacity: 0; transform: translateY(12px) scale(0.98); }
.page-fade-leave-to { opacity: 0; transform: translateY(-8px) scale(1.01); }
```

搜索框等共享元素因位于固定顶栏中，页面切换时不会消失，自然实现"相同元素过渡"。

---

## 五、代码约定

- Vue SFC 使用 `<script setup lang="ts">`
- 状态管理使用 Pinia（`defineStore`），持久化用 `pinia-plugin-persistedstate`
- CSS：Tailwind + SCSS（scoped）
- 平台判断：`isMobile`（`@/utils`）
- 提交格式：`<type>: <描述>`（feat / fix / refactor / style / docs / chore）
- **每次修改后必须 commit + push**
- 动画使用 Apple 弹簧曲线：`cubic-bezier(0.34, 1.56, 0.64, 1)`
- 颜色使用动态 CSS 变量（`--cover-bg`, `--accent-color` 等），不硬编码
- 移动端 UI 组件以 `Mobile` 前缀命名（如 `MobilePlayBar`、`MobileHeader`）
- 底栏导航使用 `GlowTabs` 组件保持全站一致
- 紧凑模式播放栏需与底栏导航位置/高度完全对齐

---

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
| FLIP 拖拽动画瞬移 | 使用双 rAF 但与 Vue 响应式不同步 | 改用 `nextTick()` + `recordRects/playFlip` |
| 卡片拖出被容器截断 | `cards-track` 的 `overflow: hidden` | 拖出时设为 `overflow: visible` |
| 编辑模式误触发 | 长按阈值太低 | 600ms + 10px 移动检测 |
| 本地音乐播放卡死 | `copyToCacheDir` 同步 JNI 阻塞 JS 线程 | 改用 `copyToCacheDirAsync` 异步回调 |
| 本地音乐无声音 | `setupEQ` 对 `LocalAudioPlayer` 提前 return | 新增 `_setupEQLocalMobile` 连接 destination |
| 嵌入歌词不读取 | `getAudioMetadata` 硬编码 lyrics 为 NULL | 实现 `extractEmbeddedLyrics`（ID3v2 + FLAC） |
| 深度链接冷启动不弹卡片 | JS 层未就绪时调用无响应 | 新增 `pendingUrl` 队列 + 多次 `postDelayed` 重试 |
| 雨夜样式移动端不显示 | 配置缺失 + 路由缺失 | 补全 `MobilePlayerSettings` + `MusicFullWrapper` 路由 |
| 构建产物路径不匹配 | `vite build` 输出 `dist/renderer`，Capacitor 期望 `out/renderer` | 改用 `electron-vite build` |

---

## 七、服务器部署

### APK 自动发布 Agent

服务器（`43.250.173.177`）上部署了自动发布 Agent：

- **脚本位置**：`/opt/zephyrus-agent/apk-release-agent.sh`
- **APK 目录**：`/var/www/zephyrus/apks/`（保留 30 天滑动窗口）
- **下载地址**：`https://mucang.xyz/zephyrus/apks/zephyrus-player-latest.apk`
- **Cron**：每天 03:00 自动检查 GitHub Release，下载最新 APK，更新文档链接
- **日志**：`/var/log/zephyrus-agent.log`

Agent 逻辑：
1. 调用 GitHub API（需 Token，private 仓库）获取最新 Release
2. 通过 API asset URL + `Accept: application/octet-stream` 下载 APK（private 仓库不能用 browser_download_url）
3. 下载到临时文件，完成后原子重命名
4. 创建 `latest` 软链接
5. 清理超过 30 天的旧 APK
6. 更新 `/var/www/zephyrus/docs/guide/installation.html` 中的下载链接
7. 确保 nginx 配置了 `/zephyrus/apks/` location

### 文档站点

- **目录**：`/var/www/zephyrus/docs/`
- **URL**：`https://mucang.xyz/zephyrus/docs/`
- **工具**：VitePress
- **源码**：`website/` 目录

---

## 八、注意事项

1. **Private 仓库**：GitHub API 调用必须携带 Token，下载 APK 必须用 asset API URL + `Accept: application/octet-stream`
2. **异步优先**：所有可能阻塞 JS 线程的原生调用必须使用异步方式（如 `copyToCacheDirAsync`）
3. **AudioContext**：移动端 `AudioContext` 可能在后台被暂停，播放前需调用 `AudioContext.resume()`
4. **SCAN_VERSION**：修改元数据解析逻辑后需递增 `localMusic.ts` 中的 `SCAN_VERSION`，强制重新扫描
5. **z-index 层级**：`SharedSongCard`（100001）> 播放器全屏 > 控件区（30）> 滚动歌词 > 页面内容
6. **safe-area**：移动端底部需考虑 `safe-area-inset-bottom`，避免被导航栏遮挡
