# Zephyrus Player AI 协作说明

本文件描述当前 Android 项目的边界、关键数据流、验证入口和发布约束，供 AI 协作者快速建立正确上下文。它不包含服务器密码、Cookie、令牌或用户歌词原稿。仓库根目录的 `AIREADEME` 是本机私有备忘，已通过 `.git/info/exclude` 排除，不应提交。

## 项目边界

- 发布目标是 Android 手机，Capacitor 8 + Android WebView。
- Vue 3.5、TypeScript 5.9、Vite 6、Pinia 和 SCSS 构成渲染层。
- Java `NativeBridge` 负责状态栏歌词、悬浮窗、媒体通知、后台保活和系统权限。
- 桌面相关目录是历史兼容代码。本轮新增功能只维护 Android 移动体验，不为桌面端复制交互。
- 当前版本基线为 `1.2.0`，远端为 `cang-dot/zephyrus-player-android`。

## 目录地图

```text
src/renderer/
├── api/                 歌词、平台、云端歌曲、高潮和播放地址
├── components/          MobileLayout、MobilePlayBar、播放器和设置面板
├── composables/         useWordTimedPlayback、useMobilePlayerTransition 等
├── services/            ttmlParser、audioService、androidNative 和缓存
├── store/modules/       player、lyric、amll、styleEngine、settings 等
├── utils/               qrcParser、yrcParser、timedLyrics、posterEngine
└── views/               home、list、discover、user、search、set
android/app/src/main/   Capacitor Activity、NativeBridge、悬浮歌词和媒体服务
website/                 VitePress 文档站源码
product-site/            独立 Android 产品官网源码
profile/                 GitHub 个人主页 README 卡片草稿
```

## 歌词数据流

移动端按以下顺序取得歌词：自有 Zephyrus TTML、AMLL TTML、网易云 YRC、QQ QRC、普通 LRC。`useWordTimedPlayback` 将不同来源统一成当前行、当前分词、背景声部、对唱声部和稳定动画 key。

- TTML 解析位于 `src/renderer/services/ttmlParser.ts`。
- YRC 解析位于 `src/renderer/utils/yrcParser.ts`，保留中文单字和英文单词粒度。
- QRC 解密与解析位于 `src/renderer/utils/qrcParser.ts` 和 `src/renderer/api/platformQrApi.ts`。
- `ttmlInterlude.ts` 只在有效 TTML 主句结束后判断间奏或尾奏，不要求高潮标注。
- 背景词与对唱词显示完整句子，内部逐字进度通过同一时间轴驱动。
- 翻译和罗马音按时间戳匹配，缺失时不阻塞主歌词。

不要把受版权保护的完整歌词写进测试。使用合成 TTML/YRC/QRC 片段覆盖边界和异常时间即可。

## 播放器与设置

播放器样式注册在 `src/renderer/playerStyles/`，移动组件位于 `src/renderer/components/lyric/`。当前 Android 样式包括默认、舞台、诡谲、狂热、陈旧、杂志、雨夜、星盘和烟雾。烟雾只在 Android 渲染，其他平台遇到该 key 必须回退默认。

`music-full-config.styleCustomConfig[styleKey]` 是样式配置的唯一移动端入口。每个样式独立保存背景、基础歌词色、字体、字重和高潮效果。原始设置、自定义设置和一键还原不能跨样式串联。

`useMobilePlayerTransition` 管理 `idle / dragging / opening / open / closing`。底栏、迷你播放栏、全屏播放、播放列表和播放设置必须共享同一来源矩形与展开进度，避免生成第二个视觉对象。收起和展开优先动画 `transform`、`opacity`、裁切和表面高度。

## Android 状态栏歌词

配置类型是 `StatusBarLyricConfig`，兼容旧的 `statusBarLyricsEnabled`。Web 层通过 `androidNative.ts` 调用：

- `applyStatusBarLyricConfig(configJson)`
- `updateStatusBarLyricState(stateJson)`
- `installStatusBarLyricFont(name, base64Data)`

原生层使用一个非触摸的 `TextView` 和 `SpannableString` 渲染已唱、当前、未唱三段。权限不存在时必须显示可理解的回退状态，而不是静默失败。只显示主歌词，TTML 辅助声部留在应用内播放器。

## 本地音乐和海报

本地扫描支持 MP3、FLAC、M4A、OGG、Opus，歌词文件支持 LRC、YRC、TTML 和 TXT。歌词解析的括号、全角标点和背景声部必须原样保留，不得用正则把 `（`、`）`、`！`、`￥` 互相替换。

海报生成位于 `posterEngine.ts`。默认布局保持兼容，新增的演出档案和印章巡演布局要通过 `sharePosterLayout` 选择。印章巡演的作者名分割和强调色逻辑必须有合成输入测试。

## 验证入口

```bash
npm run test:lyrics
npm run typecheck
npm run lint:i18n
npm run build
cd android && ./gradlew.bat assembleRelease --no-daemon
```

改动文件使用项目现有 ESLint 配置检查。重点回归：TTML/YRC/QRC 逐字时间轴、背景与对唱、间奏尾奏、状态栏歌词权限和字体、播放器形变、歌单来源、五语言设置搜索。

## 发布约束

`.github/workflows/build.yml` 在 `v*` 标签上构建正式签名 APK。签名或产物缺失必须硬失败，不得发布未签名 APK。`RELEASE_NOTES.md` 是版本说明来源。发布前确认版本号、工作流、附件名和 GitHub Release 状态；推送、打标签、远程部署需要用户明确授权。

文档站构建：

```bash
cd website
npm install
npm run build
```

静态输出为 `website/.vitepress/dist`。产品官网是 `product-site/`，不依赖应用运行时，可直接部署到 `/zephyrus/`；文档站继续部署到 `/zephyrus/docs/`。

## 协作纪律

- 不回滚用户已有修改，先读相关文件和测试再编辑。
- 不把本机配置、Cookie、令牌、服务器凭据或个人歌词加入提交。
- 新增 i18n key 必须同步五种语言。
- 每次修改后运行与改动风险匹配的验证，不用旧的桌面截图证明 Android 体验。
- 需要推送或创建发布时，先向用户说明远程影响并等待明确授权。
