# Zephyrus Player 横版推荐视频

- 画幅：1920 x 1080，30 fps
- 时长：约 125.24 秒
- 口播：MiMo TTS 音色复刻，文案逐字采用用户定稿
- 画面：Remotion 程序化渲染；播放器样式段只使用用户提供的真实截图
- 音乐节片段：使用用户提供的现场画面，作为开场突然插入的整活镜头
- 样式展示：默认、舞台、星盘、狂热、诡谲、陈旧、雨夜、烟雾。杂志样式完全不显示

## 成片

- `out/zephyrus-horizontal-v2-bgm.mp4`：新版带背景音乐和音效
- `out/zephyrus-horizontal-v2-nobgm.mp4`：新版无背景音乐，保留口播和音效
- `out/zephyrus-horizontal-v2.srt`：新版可编辑外挂字幕

## 重新渲染

```powershell
npm install
npm run render
```

八张真实截图已经放进 `public/screenshots/styles/`。`npm run render` 会校验截图、依次渲染两个版本，并把最终音轨标准化到约 -16 LUFS、-1.5 dBTP。执行 `npm run dev` 可以打开 Remotion Studio 调整镜头和字幕。

## 素材

音频来源见 `ASSET-SOURCES.md`。字幕原文位于 `../voice/tts-copy.txt`，仅用于发音控制的 TTS 输入位于 `../voice/tts-spoken-copy.txt`，成品音轨使用已验收的20句合成音频。
