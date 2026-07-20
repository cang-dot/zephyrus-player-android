# Zephyrus Player 开发文档

## 技术栈

- **前端框架**：Vue 3 + TypeScript
- **UI 组件库**：naive-ui
- **样式框架**：Tailwind CSS + SCSS
- **图标库**：remixicon
- **状态管理**：Pinia
- **动画引擎**：GSAP
- **WebGL**：OGL（Gritty/Frenzy 背景特效）
- **工具库**：VueUse
- **构建工具**：Vite, electron-vite
- **打包工具**：electron-builder
- **国际化**：vue-i18n
- **音频播放**：Howler.js + Web Audio API
- **音乐 API**：netease-cloud-music-api
- **音乐解锁**：@unblockneteasemusic/server

## 项目结构

```
zephyrus-music-player/
├── .github/workflows/           # GitHub Actions
│   ├── build.yml                # 构建 & 发布（tag 触发）
│   └── ci.yml                   # CI 检查（push/PR 触发）
├── build/                       # 构建相关文件
├── resources/                   # 资源文件
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 入口
│   │   ├── lyric.ts             # 桌面歌词窗口
│   │   ├── server.ts            # 本地 API 服务
│   │   ├── unblockMusic.ts      # 音乐解锁
│   │   └── modules/             # 主进程模块
│   ├── preload/                 # 预加载脚本
│   └── renderer/                # Vue 3 渲染进程
│       ├── api/                 # API 层
│       │   ├── climax.ts        # 高潮段落 API
│       │   ├── keywords.ts      # 重点词 API
│       │   └── communityLyric.ts # 社区歌词 API
│       ├── components/
│       │   └── lyric/           # 歌词组件
│       │       ├── GrittyPlayer.vue      # Gritty 模式播放器
│       │       ├── GrittyLyrics.vue      # Gritty 双层歌词
│       │       ├── FrenzyPlayer.vue      # Frenzy 模式播放器
│       │       ├── FrenzyLyrics.vue      # Frenzy 双层歌词
│       │       ├── GlitchBackground.vue  # WebGL 故障背景
│       │       ├── LyricSettings.vue     # 歌词设置面板
│       │       └── MusicFullWrapper.vue  # 样式切换包装器
│       ├── services/
│       │   ├── audioService.ts   # 音频引擎
│       │   ├── cacheService.ts   # IndexedDB 缓存
│       │   └── climaxDetector.ts # 高潮检测
│       ├── store/modules/
│       │   ├── styleEngine.ts    # 样式引擎
│       │   └── communityData.ts  # 社区数据管理
│       └── types/
│           └── lyric.ts          # 歌词配置类型
```

## 主要模块说明

### 样式引擎 (styleEngine)

聚合播放状态、音频特征、副歌数据、封面颜色、社区数据（重点词），为所有视觉模式提供统一数据源。

### 社区数据 (communityData)

管理高潮段落、重点词、社区歌词的加载和缓存。

**数据流**：IndexedDB 缓存 → API 请求 → 缓存

**加载顺序**：高潮段落 → 重点词 → 社区歌词

### Gritty/Frenzy 歌词模式

双层歌词渲染：
- **黑字层**：普通歌词文字（可 scaleY 拉伸）
- **红字层**：服务器重点词（正常比例，可配置颜色）

**强调色模式**：
- `red`：始终红色（默认）
- `cover`：跟随歌曲封面主色
- `custom`：自定义颜色

### GlitchBackground (WebGL)

使用 OGL 渲染的故障背景效果：
- 扫描线（可开关）
- RGB 通道偏移
- 噪点
- 暗角

## 开发指南

### 启动

```bash
npm install
npm run dev          # Electron 桌面
npm run dev:web      # Web（需外部 API）
```

### 构建

```bash
npm run build              # 构建渲染进程
npm run build:win          # 打包 Windows
npm run build:mac          # 打包 macOS
npm run build:linux        # 打包 Linux
```

### 代码质量

```bash
npm run lint       # ESLint + i18n 检查
npm run format     # Prettier 格式化
npm run typecheck  # TypeScript 类型检查
```

### 命名约定

- 目录：kebab-case
- 组件：PascalCase
- 组合式函数：camelCase（`use` 前缀）

### 代码风格

- Composition API + `<script setup>` 语法
- TypeScript 类型系统
- Tailwind CSS 响应式设计

## 发布流程

1. 推送 tag `v*` 触发 GitHub Actions
2. 自动构建 Windows/macOS/Linux
3. 创建 GitHub Release 并上传产物

## 环境变量

```bash
# Web 开发模式
VITE_API=<网易云API地址>
VITE_API_MUSIC=<音乐解锁API地址>
```
