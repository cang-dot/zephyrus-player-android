---
layout: page
title: Zephyrus Player Android 文档
titleTemplate: false
---

<section class="docs-hero">
  <div class="docs-hero__visual" aria-hidden="true">
    <img src="/zephyrus-home.png" alt="" />
  </div>
  <div class="docs-hero__veil" aria-hidden="true"></div>
  <img class="docs-hero__mark" src="/zephyrus-mark.png" alt="" aria-hidden="true" />
  <div class="docs-hero__content">
    <p class="docs-kicker">ZEPHYRUS PLAYER · ANDROID</p>
    <h1>让歌词成为<br>播放界面本身</h1>
    <p class="docs-hero__lead">从安装、账号和音乐来源，到 TTML 逐字歌词、八种播放器舞台、状态栏悬浮歌词与故障排查。</p>
    <div class="docs-actions">
      <a class="docs-action docs-action--primary" href="/zephyrus/docs/guide/installation">开始安装</a>
      <a class="docs-action" href="/zephyrus/docs/guide/getting-started">第一次使用</a>
    </div>
    <p class="docs-hero__meta">ANDROID 8.0+ · MOBILE ONLY · OPEN SOURCE</p>
  </div>
</section>

<section class="docs-launchpad">
  <div class="docs-section-heading">
    <p class="docs-kicker">01 · 选择入口</p>
    <h2>你现在要解决什么？</h2>
    <p>按任务进入，不必从头阅读整套文档。</p>
  </div>
  <div class="docs-route-list">
    <a href="/zephyrus/docs/guide/installation"><strong>安装与更新</strong><span>下载、系统要求、应用内更新与 ADB 安装</span><i>01</i></a>
    <a href="/zephyrus/docs/features/lyric-sources"><strong>歌词没有逐字</strong><span>检查 TTML、YRC、QRC、LRC 的来源与回退顺序</span><i>02</i></a>
    <a href="/zephyrus/docs/styles/overview"><strong>配置播放器</strong><span>八种样式、独立外观、字体与高潮效果</span><i>03</i></a>
    <a href="/zephyrus/docs/features/status-bar-lyrics"><strong>开启状态栏歌词</strong><span>悬浮窗权限、位置、逐字显示与分层颜色</span><i>04</i></a>
    <a href="/zephyrus/docs/guide/faq"><strong>排查异常</strong><span>播放、登录、歌词、字体与耗电问题</span><i>05</i></a>
  </div>
</section>

<section class="docs-timeline">
  <div>
    <p class="docs-kicker">02 · 一条统一时间轴</p>
    <h2>更好的歌词到达时，<br>在下一行安静接管。</h2>
  </div>
  <p>接口歌词可以立即开始播放。自有 TTML 或 AMLL TTML 稍后加载成功时，播放器会等到下一条主歌词边界再切换，不让一个词在中途改变来源。</p>
  <ol class="docs-source-order">
    <li><b>01</b><span>Zephyrus TTML</span><small>主唱 · 背景 · 对唱</small></li>
    <li><b>02</b><span>AMLL TTML</span><small>主唱 · 背景 · 对唱</small></li>
    <li><b>03</b><span>网易云 YRC</span><small>逐字 · 翻译 · 罗马音</small></li>
    <li><b>04</b><span>QQ QRC</span><small>逐字 · 翻译 · 罗马音</small></li>
    <li><b>05</b><span>普通 LRC</span><small>稳定行级回退</small></li>
  </ol>
</section>

<section class="docs-stage-band">
  <div class="docs-stage-copy">
    <p class="docs-kicker">03 · 播放器舞台</p>
    <h2>每种视觉，保留自己的设置。</h2>
    <p>背景、歌词颜色、字体、字重、强制单行与高潮效果按样式分别持久化。一键还原只影响当前舞台。</p>
    <a href="/zephyrus/docs/features/custom-effects">查看外观与高潮效果 →</a>
  </div>
  <div class="docs-stage-names" aria-label="播放器样式">
    <span>默认</span><span>舞台</span><span>诡谲</span><span>狂热</span><span>陈旧</span><span>雨夜</span><span>星盘</span><span>烟雾</span>
  </div>
</section>

<section class="docs-mobile">
  <figure>
    <img src="/zephyrus-home.png" alt="Zephyrus Player Android 首页" />
    <figcaption>当前 Android 首页与共享播放 Dock</figcaption>
  </figure>
  <div class="docs-mobile__copy">
    <p class="docs-kicker">04 · 手机优先</p>
    <h2>交互从拇指出发，<br>不是桌面界面的缩小版。</h2>
    <p>首页、歌单、发现和我的支持横向手势；底栏、迷你播放栏、完整播放器、播放列表与播放设置围绕同一表面连续变化，并完整避让状态栏、挖孔与底部安全区。</p>
    <div class="docs-inline-links">
      <a href="/zephyrus/docs/settings/interface">界面与手势</a>
      <a href="/zephyrus/docs/settings/playback">播放与歌词</a>
      <a href="https://mucang.xyz/zephyrus/">打开官方网站</a>
    </div>
  </div>
</section>

<section class="docs-support">
  <p class="docs-kicker">05 · 仍然有问题</p>
  <h2>先保存现场，再逐层排查。</h2>
  <p>记录歌曲名、来源平台、歌词格式、播放器样式、横竖屏状态和复现步骤。歌词问题先确认来源与时间校准，状态栏歌词先确认悬浮窗权限和系统电池限制。</p>
  <div class="docs-actions">
    <a class="docs-action docs-action--primary" href="/zephyrus/docs/guide/faq">打开故障排查</a>
    <a class="docs-action" href="https://github.com/cang-dot/zephyrus-player-android/issues">提交 GitHub Issue</a>
  </div>
</section>
