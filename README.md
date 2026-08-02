<p align="center">
  <img src="src/renderer/assets/icon.png" alt="Zephyrus Player" width="120" style="border-radius: 24px;" />
</p>

<div align="center">

# Zephyrus Player

**西风播放器** — 沉浸式音乐播放器 · Android

[![Version](https://img.shields.io/badge/version-v1.1.3-blue)](https://github.com/cang-dot/zephyrus-player-android/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Vue](https://img.shields.io/badge/Vue_3.5-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript_5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Android](https://img.shields.io/badge/Capacitor_8-3ddc84?logo=android&logoColor=white)](https://capacitorjs.com/)
[![Docs](https://img.shields.io/badge/文档-mucang.xyz-8b5cf6)](https://www.mucang.xyz/zephyrus/docs)

</div>

---

## 简介

Zephyrus Player 是一款以**视觉体验为核心**的 Android 音乐播放器，深度集成网易云音乐生态，同时支持
QQ 音乐、酷狗音乐等多平台账号登录与跨平台搜索。内置 7 种全屏播放器样式，通过实时高潮检测、鼓点跟踪、
封面取色等技术驱动视觉动画与歌词渲染，让每一首歌都有独特的视觉表达。

> 本项目基于 [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer) 深度二次开发。
> 桌面版（Electron）见 [zephyrus-player](https://github.com/cang-dot/zephyrus-player)。
> 📖 **使用文档**：[mucang.xyz/zephyrus/docs](https://www.mucang.xyz/zephyrus/docs)

---

## 下载

| 渠道 | 地址 |
|------|------|
| **正式版** | [GitHub Releases](https://github.com/cang-dot/zephyrus-player-android/releases) |
| **服务器直链** | [zephyrus-player-latest.apk](https://mucang.xyz/zephyrus/apks/zephyrus-player-latest.apk) |
| **预览版（Beta）** | 见[文档站 · 安装指南](https://www.mucang.xyz/zephyrus/docs/guide/installation.html) |

当前版本：**v1.1.3-beta**（预览版）。安装版 App 会在启动时自动检查更新并提示下载。

---

## 核心特性

### 模块化首页

Apple Music 风格的可定制首页，所有组件可自由拖拽排列：

- 卡片轮播区 + 4 列可变大小功能网格（1-4 宽 × 1-2 高）
- 长按进入编辑模式：拖拽排序、跨区域移动、缩放尺寸、增删组件
- FLIP 弹簧动画：组件位置/尺寸变化时平滑过渡，拖动时其他组件实时避让

### 7 种播放器样式

| 样式 | 说明 |
|------|------|
| 默认 | 封面取色背景 + 逐字歌词 + 渐变遮罩 |
| 舞台 Stage | 深色背景 + 居中大字歌词 + 高潮鼓点闪白 |
| 诡谲 Eerie | 噪点底 + 书法字 + VHS 效果 + 高潮关键词闪现 |
| 陈旧 Neon | 混凝土底 + 霓虹描边字 + 脉冲光晕 |
| 狂热 Frenzy | 极简色块 + 巨字歌词分屏 |
| 杂志 Magazine | 色块拼贴 + 期刊式歌词 |
| 雨夜 Rain | 3D 封面 + Canvas 雨水 + 歌词叠加 + 底部反射 |
| 星图 Star Chart（预览） | 星座星图背景 + 星轨歌词 |

### 多平台账号

- **QQ 音乐扫码登录**：获取真实昵称/头像，拉取创建歌单、收藏歌单、收藏专辑
- **酷狗音乐扫码登录**：歌单/收藏数据
- 登录后自动**解锁对应平台的搜索**，结果按匹配度统一排序
- 网易云账号沿用原有登录体系

### 云端歌曲库

- 服务器托管被封禁/独立音乐（FLAC/MP3），带完整元数据与歌词
- 多段**高潮时段**标注：只依赖人工标注，不使用 LRC 推断
- 点击专辑名可进入**云端同名专辑详情页**

### 高潮段落与鼓点

- 社区高潮标注 + 实时音频能量检测双通道
- 高潮期间驱动颜色模式切换、鼓点闪白、故障特效

### 其他

- 跨平台搜索（网易云 / QQ / 酷狗 / 咪咕 / 酷我等）自动去重合并、来源筛选
- 深度链接分享、本地音乐原生扫描、智能混音、定时关闭
- 后台保活：保持音频焦点，降低被录音/其他播放打断的概率
- 开机自启动、电池优化等系统权限快捷入口

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3.5 + TypeScript 5.9 + Vite 6 + Pinia + Tailwind/SCSS |
| 原生壳 | Capacitor 8（Android WebView + Java 原生桥接） |
| 音频 | Howler.js + Web Audio API |
| 动画 | GSAP + CSS/WAAPI 动画 |
| 服务端 | 网易云 API + 自建扫码登录网关 + 云端歌曲/社区标注服务 |

---

## 开发与构建

```bash
npm install
npm run dev:web        # 浏览器调试
npm run typecheck      # 类型检查
npm run build          # 构建 Web 资源 → out/renderer
npx cap sync android   # 同步到 Android 工程
cd android && ./gradlew.bat assembleDebug   # 构建 debug APK
```

APK 输出：`android/app/build/outputs/apk/debug/app-debug.apk`

发布预览版/正式版：推送 `v*` 标签，GitHub Actions 自动构建签名 APK 并创建 Release。

---

## 项目结构

```
src/
├── main/                 # Electron 主进程（桌面兼容）
├── renderer/             # ★ Vue 渲染层（核心）
│   ├── api/              # 平台/音乐/云端歌曲 API
│   ├── components/       # 播放器样式、登录、通用组件
│   ├── layout/           # 移动端主布局
│   ├── playerStyles/     # 播放器样式注册表
│   ├── store/            # Pinia 状态
│   └── views/            # 页面（首页/搜索/我的/设置…）
├── shared/               # 跨平台共享代码
android/                  # Capacitor Android 原生壳
website/                  # VitePress 文档站
server-platform-login.js  # 多平台扫码登录网关（部署于 mucang.xyz）
```

---

## 开源声明

本项目仅用于学习与技术交流，音乐内容版权归原平台所有；请遵守所在地区法律法规。
基于 [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer)（MIT License）二次开发。
