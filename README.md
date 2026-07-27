<p align="center">
  <img src="src/renderer/assets/icon.png" alt="Zephyrus Player" width="120" style="border-radius: 24px;" />
</p>

<div align="center">

# Zephyrus Player

**西风播放器** — 沉浸式音乐播放器 · Android

[![Version](https://img.shields.io/badge/version-v1.0.5-blue)](https://github.com/cang-dot/zephyrus-player-android/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Vue](https://img.shields.io/badge/Vue_3.5-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript_5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Android](https://img.shields.io/badge/Android_Capacitor_8-3ddc84?logo=android&logoColor=white)](https://capacitorjs.com/)
[![Docs](https://img.shields.io/badge/文档-www.mucang.xyz-8b5cf6)](https://www.mucang.xyz/zephyrus/docs)

</div>

---

## 概述

Zephyrus Player 是一款深度集成网易云音乐生态的沉浸式 Android 音乐播放器。项目以高度可定制的播放器界面为核心，内置 **7 种全屏播放器样式**，通过实时高潮检测、鼓点跟踪、封面取色等技术驱动视觉动画与歌词渲染。支持跨平台搜索（网易云 / QQ音乐 / 咪咕 / 酷狗 / 酷我），自动去重合并，让找歌更简单。

> 本项目基于 [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer) 深度二次开发。
> 桌面版（Electron）见 [zephyrus-player](https://github.com/cang-dot/zephyrus-player)。
> 📖 **使用文档**：[www.mucang.xyz/zephyrus/docs](https://www.mucang.xyz/zephyrus/docs)

---

## 关于桌面版与安卓版

桌面版与安卓版同源开发，共享绝大部分代码与核心体验。但由于两端各自的侧重不同，可能会出现某一端独有的功能：

- 某些功能有可能在后续版本中移植到另一端，以统一更新进度。
- 但作者更多会保留某一端的独占功能。（其实是懒）

比如，安卓版拥有深度链接分享、剪贴板智能识别等移动端特性，而桌面版则拥有窗口管理、全局快捷键等桌面端特性。这些差异是设计取舍，而非 Bug。

---

## 核心特性

### 模块化首页

Apple Music 风格的可定制首页，所有组件可自由拖拽排列：

- **卡片轮播区**：顶部全屏宽度卡片，横向滑动浏览每日推荐、私人FM等
- **4 列功能网格**：下方组件网格，支持 1-4 宽 × 1-2 高的任意大小
- **拖拽排列**：长按组件进入编辑模式，可跨区域拖拽（网格 ↔ 卡片）
- **可变大小**：编辑模式下拖拽右下角把手调整组件大小，不同大小显示不同 UI
- **两种编辑模式**：长按拖拽（松手退出）和长按编辑（点击空白退出）
- **FLIP 弹簧动画**：组件位置变化时使用 Apple 风格弹簧曲线平滑过渡
- **动态取色**：所有颜色基于当前播放歌曲封面提取，UI 随音乐变色
- **播放/前往按钮**：可播放组件右下角显示播放按钮，其他显示前往箭头
- **添加菜单**：2×2 缩略图预览，可长按拖入主界面

### 7 种播放器样式

| 样式          | 说明                                     |
| ------------- | ---------------------------------------- |
| 默认          | 封面取色背景 + 逐字歌词 + 渐变遮罩       |
| 舞台 Stage    | 深色背景 + 居中大字歌词 + 高潮鼓点闪白   |
| 诡谲 Eerie    | 噪点底 + 书法字歌词 + 高潮关键词闪现     |
| 陈旧 Neon     | 混凝土底 + 霓虹描边字 + 脉冲光晕         |
| 狂热 Frenzy   | 极简色块 + 巨字歌词分屏                  |
| 杂志 Magazine | 色块拼贴 + 期刊式歌词                    |
| 雨夜 Rain     | 3D 封面 + 雨水效果 + 歌词叠加 + 底部反射 |

### 浮动顶栏

所有页面统一使用 Apple 风格浮动顶栏：

- **超大圆角 Pill 设计**：页面名、搜索框、头像三个独立 pill
- **毛玻璃材质**：`backdrop-filter: blur(20px) saturate(180%)`
- **搜索框共享**：搜索框在所有页面间保持一致，页面切换时无闪烁
- **动态取色**：pill 背景随封面颜色变化

### 跨平台搜索

搜索时自动搜索网易云、QQ音乐、咪咕、酷狗、酷我等平台，结果去重合并。每首歌标注来源（网易云 / JOOX / QQ 等），支持按来源筛选。

### 歌曲分享（深度链接）

- 支持 `zephyrus://song/{id}` 深度链接协议，点击链接直接拉起 App
- 分享中转页（relay），海报式布局展示歌曲信息，支持 30 秒试听
- App 内弹出毛玻璃歌曲卡片（SharedSongCard），点击播放按钮直接播放
- 从后台切回前台时自动检测剪贴板，智能识别分享链接

### 自定义效果

每种播放器样式支持独立的效果参数调节：

- **字体导入**：支持 `.ttf` / `.otf` 字体文件，每种样式单独设置
- **样式参数**：Aurora 速度、鼓点闪白强度、光晕半径、脉冲速度、巨字字号、翻页速度、雨水强度等

### 滚动歌词

- 全屏滚动歌词，点击文字精确跳转
- 拖动时右侧显示时间指示器（可点击跳转）
- 上下渐变遮罩 + 自动滚动追踪
- 双击进入、单击空白退出

### 其他

- 网易云音乐登录（扫码 + 手机号）
- 跨平台搜索 + 来源筛选
- 歌单 / 专辑 / 排行榜
- 本地音乐播放
- 歌词翻译（多引擎）
- AI 歌词隐喻分析
- 高潮段落检测 + 鼓点跟踪
- 封面取色动态主题
- 定时关闭
- 平台 Cookie 管理

---

## 技术栈

| 层       | 技术                      |
| -------- | ------------------------- |
| 框架     | Vue 3.5 + TypeScript 5.9  |
| 构建     | Electron-Vite 6           |
| 原生壳   | Capacitor 8 (Android)     |
| 状态管理 | Pinia                     |
| 音频引擎 | Howler.js + Web Audio API |
| 动画     | GSAP + CSS Animations     |
| 样式     | Tailwind CSS + SCSS       |
| i18n     | vue-i18n（5 种语言）      |

---

## 下载

从 [GitHub Releases](https://github.com/cang-dot/zephyrus-player-android/releases) 下载最新 APK。

系统要求：Android 7.0+，约 50MB 存储空间。

📖 详细安装指南见 [文档](https://www.mucang.xyz/zephyrus/docs/guide/installation)。

---

## 构建

```bash
# 安装依赖
npm install

# 构建 Web 资源
npm run build

# 同步到 Android
npx cap sync android

# 构建 APK
cd android && ./gradlew assembleDebug
```

APK 输出路径：`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 开发

```bash
# Web 开发模式
npm run dev:web

# 类型检查
npm run typecheck:web

# 代码检查
npm run lint
```

---

## 开源协议

[MIT License](LICENSE)

本项目基于 [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer) 二次开发，感谢原作者。
