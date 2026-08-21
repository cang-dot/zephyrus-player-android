# Zephyrus Player Component Showcase

独立的 Vue 宣传片工程，不参与正式 Android 应用路由。它把组件展示拆成 900 帧确定性状态，并输出 1920x1080、30fps 的静音版、BGM 版和带少量产品宣传片拟音的混音版。

```powershell
npm install
npm run build
npm run render:frames
npm run contact-sheet
npm run render
```

`npm run render:frames` 会启动本地 Vite、使用 Playwright 逐帧截图并写入 `out/frames`。`npm run render` 使用 FFmpeg 合成 `out/zephyrus-component-showcase-silent.mp4`、`out/zephyrus-component-showcase-bgm.mp4` 和最终 `out/zephyrus-component-showcase.mp4`。BGM 版本使用项目提供的本地文件，公开发布前请确认音乐授权。

关键帧联系表位于 `out/qa/contact-sheet.png`。镜头边界、冻结歌曲和歌词数据在 `src/data.ts`。

## 致谢

- [Apple Music Like Lyrics](https://github.com/amll-dev/applemusic-like-lyrics)：歌词视觉与逐字时间轴设计的参考项目。
- [VueSeq](https://github.com/bennyzen/vueseq)：Vue 确定性视频渲染方向的参考项目；当前 npm 环境缺少对应版本，因此实际渲染使用同一 Vue harness 的 Playwright + FFmpeg fallback。

视频展示素材不向正式播放器注入宣传片路由，也不展示账号、Spotify 或本地扫描流程。
