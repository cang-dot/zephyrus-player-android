# Zephyrus Player Android 产品官网（1.2.5）

静态站点，目标部署路径为 `https://mucang.xyz/zephyrus/`。页面不依赖构建工具，入口是 `index.html`。

本地预览可以在仓库根目录运行：

```bash
npx serve product-site
```

部署时保留 `public/` 目录。首屏使用当前 Android 实体设备的 `zephyrus-home.png`；大字播放器与状态栏歌词场景由 HTML/CSS 实时渲染，不依赖额外设备截图。

`zephyrus-logo-original.png` 是用户提供的新 Logo 原图，`zephyrus-mark.png` 是用于网页的透明裁切版本。线性背景、滚动速度文字和按钮高光的交互语言参考 [React Bits](https://reactbits.dev/get-started/index)，实现为本站原生 Canvas、CSS 和 JavaScript，不引入 React 运行时。
