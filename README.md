<p align="center">
  <img src="src/renderer/assets/icon.png" alt="Zephyrus Player" width="112" />
</p>

<div align="center">

# Zephyrus Player

**西风播放器，一款只为 Android 手机设计的音乐播放器。**

[![版本](https://img.shields.io/badge/version-v1.2.0-b48b52)](https://github.com/cang-dot/zephyrus-player-android/releases)
[![Android](https://img.shields.io/badge/Android-Capacitor_8-3ddc84?logo=android&logoColor=white)](https://capacitorjs.com/)
[![Vue](https://img.shields.io/badge/Vue_3-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![文档](https://img.shields.io/badge/文档-mucang.xyz-b48b52)](https://www.mucang.xyz/zephyrus/docs/)

</div>

## 这是什么

Zephyrus Player 把音乐播放、逐字歌词和视觉设计放在同一个移动端工作流里。首页、歌单、发现和个人页围绕手机单手操作设计，播放栏、播放列表和播放设置共享同一套形变表面，页面切换使用可中断的短弹簧动画。

它不是一个桌面播放器的缩小版。本仓库的发布目标是 Android 手机，桌面代码仅作为历史兼容资料保留，不在本项目中提供桌面体验保证。

## 立即下载

- [下载 v1.2.0 APK](https://github.com/cang-dot/zephyrus-player-android/releases/tag/v1.2.0)
- [服务器直链](https://mucang.xyz/zephyrus/apks/zephyrus-player-latest.apk)
- [Android 版产品页](https://mucang.xyz/zephyrus/)
- [使用文档](https://www.mucang.xyz/zephyrus/docs/)

安装 Android 8.0 或更高版本。首次运行时按系统提示允许通知和悬浮窗权限，状态栏歌词、后台播放和更新提示会根据权限启用。

## 核心体验

### 逐字歌词

歌词按照来源优先级加载：

1. 自有 Zephyrus TTML 歌词库
2. AMLL TTML 歌词库
3. 网易云 YRC
4. QQ 音乐 QRC
5. 普通 LRC

TTML 保留主唱、背景词和对唱声部，YRC 与 QRC 保留接口提供的原始分词粒度。中文通常按字同步，英文按接口词组同步，不会把一个完整词再次拆成单字。移动端滚动歌词使用 AMLL 组件渲染，没有逐字源时会自然退回普通滚动歌词。

### 播放器样式

每种样式都有独立的背景、基础歌词色、字体、字重和高潮效果配置。原始设置使用内置视觉，自定义设置只影响当前样式，一键还原不会清除其他样式。

| 样式 | 视觉方向                     | 高潮能力             |
| ---- | ---------------------------- | -------------------- |
| 默认 | 封面取色、滚动歌词、轻量过渡 | 主题色与基础动画     |
| 舞台 | 巨幅居中歌词、背景声部       | 变色、逐字砸下       |
| 诡谲 | 噪点、重点字、超大背景词     | 重点字与逐字砸下互斥 |
| 狂热 | 强对比构图、冲击性文字       | CRT、变色、逐字砸下  |
| 陈旧 | 旧印刷质感、霓虹边缘         | 字色与强制单行       |
| 杂志 | 版式化歌词和封面构图         | 海报式高潮排版       |
| 雨夜 | 雨幕、反射和动态封面         | 音频响应雨幕         |
| 星盘 | 星轨和夜空层次               | 星轨与歌词呼吸       |
| 烟雾 | WebGL 流体烟雾和暗角         | 响度响应、高潮暗角   |

舞台、诡谲、狂热和烟雾共享 TTML 背景词与对唱层。每句声部显示完整句子，逐字卡拉 OK 只应用于其内部的分词进度。间奏和尾奏判断不要求处于高潮，只要求存在有效 TTML，当前主句已经结束且距离下一句至少 15 秒或没有后续主句。

### Android 状态栏歌词

打开悬浮窗权限后，状态栏歌词会由 Android 原生 `TextView` 渲染，不是应用内的模拟预览。可以单独设置：

- 横屏和竖屏位置
- 系统字体、内置字体或导入的 TTF/OTF
- 字体大小和字重
- 是否逐字
- 已唱、当前、未唱和表面四层颜色
- 五秒真实悬浮窗预览

状态栏歌词只显示主歌词，不复制 TTML 背景词和对唱声部。普通 LRC 会自动退化为整句显示。

### 多平台与本地音乐

- 网易云、QQ 音乐、酷狗等来源可以在搜索和歌单页中筛选。
- QQ QRC 通过网关解密后进入统一逐字播放状态，失败时回退到 LRC 或已有匹配源。
- 本地音乐支持 MP3、FLAC、M4A、OGG、Opus 等常见格式，歌词文件支持 LRC、YRC、TTML 和纯文本。
- 用户维护的 TTML 可以放入自有仓库，再在构建环境中配置 Zephyrus TTML 地址。

## 快速开始

```bash
npm install
npm run dev:web
```

常用检查：

```bash
npm run test:lyrics
npm run typecheck
npm run lint:i18n
npm run build
npx cap sync android
cd android
./gradlew.bat assembleRelease --no-daemon
```

APK 输出在 `android/app/build/outputs/apk/release/app-release.apk`。真机安装需要 Android SDK 和一台已授权的设备：

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## 项目结构

```text
src/renderer/
├── api/                 平台搜索、歌词、云端歌曲和高潮接口
├── components/          移动布局、播放栏、播放器样式和设置
├── composables/         逐字播放、播放器形变和手势状态
├── services/            TTML、音频、原生桥接和缓存服务
├── store/               播放、歌词、样式、账号和设置状态
├── utils/               QRC/YRC/LRC 解析、海报和字体工具
└── views/               首页、歌单、发现、我的、搜索和设置
android/                 Capacitor Android 壳和原生状态栏歌词
website/                 VitePress 使用文档
product-site/            Zephyrus Player Android 产品官网
profile/                 GitHub 个人主页 README 卡片草稿
```

## 文档与贡献

先阅读 [安装指南](https://www.mucang.xyz/zephyrus/docs/guide/installation.html)，再看 [歌词源说明](https://www.mucang.xyz/zephyrus/docs/features/lyric-sources.html) 和 [播放器样式总览](https://www.mucang.xyz/zephyrus/docs/styles/overview.html)。

提交代码前运行歌词测试、类型检查、改动文件 ESLint 和生产构建。新增翻译必须同步 `zh-CN`、`zh-Hant`、`en-US`、`ja-JP`、`ko-KR` 五份语言文件。不要提交 Cookie、令牌、服务器密码、个人歌词原稿或本机 `AIREADEME`。

## 开源与版权

应用代码沿用上游项目的开源声明，并在各依赖目录保留对应许可证。音乐、封面和歌词的版权归原作者与平台所有。请只在拥有合法使用权的范围内播放、保存和分享内容。

## 致谢

感谢 [Apple Music-like Lyrics](https://github.com/amll-dev/applemusic-like-lyrics) 提供高质量的逐字滚动歌词组件。本项目通过其 Vue 绑定实现移动端歌词渲染；AMLL 采用 GNU Affero General Public License v3.0。

<!-- 需要发布到个人主页时，可直接使用 profile/README.md。 -->
