# Zephyrus Player · MD3 符号化亮色宣传片 — 设计 spec

> 模式：自主自由创作（用户已给定视觉硬约束，Agent 连续推进）
> 日期：2026-08-28 · 工程挂在 promo-assets/video（复用 node_modules），本目录存 spec/qa/成片

## 阶段 0 · 产品简报与执行决策

- **产品**：Zephyrus Player（西风播放器），苍岛 Cang-dot 出品，只为 Android 手机设计的音乐播放器（v1.2.5）。
- **用途/发布场景**：B 站等社媒的产品宣传片；16:9 横版 1920×1080 @30fps。
- **受众**：重视歌词同步、原生体验与设计质感的安卓音乐用户。
- **用户硬约束**：①符号化设计 ②不展示完整 UI ③亮色风格 ④展示 MD3 卖点 ⑤最后一屏用用户提供海报 `public/textures/magazine.png`（1920×1080）。
- **数据口径**：无真实用户数据；歌词文案、歌曲名均为虚构占位（"西风之歌""苍岛电台"类中性词）；海报为用户自制可公开素材。
- **语言**：中文文案 + 英文 token 标签。

### MD3 卖点清单（必须覆盖）

| #   | 卖点                                                                   | 证据源                           |
| --- | ---------------------------------------------------------------------- | -------------------------------- |
| 1   | Material You 动态取色：页面颜色来自当前歌曲主题色                      | website/guide/getting-started.md |
| 2   | MD3 形状语言：大圆角、胶囊、tonal 表面                                 | 海报 UI 组件形态                 |
| 3   | 单手触控 + 可中断跟手动画                                              | README 移动播放器                |
| 4   | 逐字歌词时间轴：TTML/AMLL TTML/YRC/QRC/LRC，主唱/背景/对唱/翻译/罗马音 | README 歌词时间轴                |
| 5   | 八种播放器样式（默认/舞台/诡谲/狂热/陈旧/雨夜/星盘/烟雾）              | README                           |
| 6   | 原生 ExoPlayer 音频：无缝切歌、智能过渡                                | 项目记忆 + README 音频与过渡     |
| 7   | 多平台来源：网易云/QQ 音乐/酷狗/本地                                   | README 来源与账号                |
| 8   | 状态栏歌词（原生）                                                     | RELEASE_NOTES v1.2.0             |

## 阶段 1 · 视觉方向（从海报生长，非另造皮肤）

- 底色 `#FAF8F3` 暖米白；主色金棕 `#B48B52`（品牌徽章色）；芥末金 `#C9A02E`；墨色 `#1B1812` 正文。
- MD3 动态色板（取色/换肤演示用 4 套 pastel，均从"专辑主色"推导）：金棕 #B48B52、雾蓝 #7C93B8、灰绿 #8FA98E、藕粉 #C79A93；每套含 primary / primaryContainer(#F2E4D3 类) / surface。
- 字体：Noto Sans SC（系统 VF，可到 Black）；大标题 96–160px 负 tracking；正文 30–40px；MD3 token 标签 24px 加宽字距。
- 材质：tonal 表面（primary 8–12% 叠白）、胶囊 999px 圆角、大卡 28–32px 圆角、局部 backdrop blur、1px 内高光描边。
- **动效性格 tokens（Apple × MD3 expressive）**：
  - 入场主缓动 `cubic-bezier(0.2, 0, 0, 1)`（MD3 emphasized）；物理微交互用弹簧 damping 1.0 / response 0.35（Apple 临界阻尼默认）；动量场景 damping 0.8。
  - 主时长 24–30f；微交互 8–12f；落定过冲 ≤1.04（亮色精致向）。
  - hold 预算：开场主体 ≥90f；批量收尾 ≥15f；终帧海报静止 ≥45f。
  - 三词自检：**干净、弹性、呼吸**。
- 全片符号系统：每镜左下角 MD3 token 标签（`MD3 · Dynamic Color` 等），串起 MD3 主线；章节大字靠左编辑风排布，主体居右，负空间 ≥55%。

## 阶段 2 · 功能到镜头映射

| 功能         | 镜头卡（style-key 已过 library.json 校验）  | 变体/取舍                                                                 |
| ------------ | ------------------------------------------- | ------------------------------------------------------------------------- |
| MD3 形状开场 | `morph-from-primitive`                      | 正圆呼吸→播放圆钮                                                         |
| 动态取色     | `theme-switch-moves`                        | palette-ripple 式：色板圆点涟漪换肤（不用 theme-sweep，给 S4 留扫色手法） |
| 跟手触控     | `segmented-thumb-hero`                      | 超大胶囊分段控件特写                                                      |
| 逐字歌词     | 自定义 `word-timed-capsule`（无现成卡）     | 歌词大字逐字点亮+副行延迟；mask 填充实现，风险低；逐字 pop 音效钉帧       |
| 多平台来源   | `icon-field-colorize`                       | 灰阶图标场→品牌色横带扫翻                                                 |
| 八种样式     | `beat-step-list-theme-cycle`                | 形容词列表逐拍上移+胶囊接词+底色同拍 8 色循环                             |
| 原生引擎     | `spectrum-morph-ui`                         | "ExoPlayer" 下划线裂成频谱跳动                                            |
| 品牌收尾     | 海报直出 + `color-block-step-wipe` B 式入场 | 金棕阶跃三跳吞屏→揭示 magazine.png→缓推落定 hold                          |

动画手法主角唯一性检查：morph(开场) / 涟漪(S1) / thumb 滑动(S2) / 逐字点亮(S3) / 扫色(S4) / 节拍循环(S5) / 频谱(S6) / 阶跃揭示(S7)——无重复主角。

## 阶段 3 · 分镜与帧级时间轴（30fps，总 1650f ≈ 55s）

| shot            | from | dur | 内容                                                                                                                         | 卡                                  | 字幕（主 / token 标签）                                 | SFX                                       |
| --------------- | ---- | --- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| S0 shape-morph  | 0    | 150 | 正圆呼吸 20f→24f path 插值成长播放圆钮（金棕 tonal+白三角），三角 spring 落定，hold                                          | morph-from-primitive                | 一个圆，开始播放。/ MD3 · Shape                         | morph 落定 impact                         |
| S1 color-ripple | 150  | 180 | 符号化 UI 元素组（顶栏胶囊/播放条/FAB/歌词行）灰阶浮入；中央色板圆点按下，两圈涟漪荡开，波前扫过处元素就地换肤成金棕主题     | theme-switch-moves · palette-ripple | 页面颜色，来自正在播放的歌。/ MD3 · Dynamic Color       | click + 涟漪 whoosh                       |
| S2 thumb-hero   | 330  | 150 | 超大分段胶囊弹簧浮入；描边光标画外滑入按下；thumb 8f 滑段；新图标 spring 弹出；hold                                          | segmented-thumb-hero                | 每一次触控，都跟手。/ MD3 · Expressive Motion           | cursor whoosh + click + pop               |
| S3 word-timed   | 480  | 240 | 歌词大字逐字点亮（墨色→金棕填充左→右扫），副行胶囊（翻译/罗马音）延迟淡入，右侧时间刻度同推进；第二句副歌大字 + 背景声部小字 | 自定义 word-timed-capsule           | 一字一句，都跟上。/ TTML · YRC · QRC · LRC              | 逐字 pop 群（音量递减）                   |
| S4 icon-field   | 720  | 180 | 灰阶小图标点阵错峰浮现铺满，静一拍，金棕色横带波纹向下扫翻全场着色                                                           | icon-field-colorize                 | 四个来源，一个曲库。/ 网易云 · QQ 音乐 · 酷狗 · 本地    | 浮现轻 tick + 翻色 impact                 |
| S5 style-cycle  | 900  | 240 | 三通道节拍器：形容词列表逐拍上移，中央胶囊接词换色，底色同拍换 8 色 pastel；收尾 hold                                        | beat-step-list-theme-cycle          | 八种样式，各有各的舞台。/ Stage · Rain · Nebula · Smoke | 每拍 tick（阶梯递减）                     |
| S6 spectrum     | 1140 | 180 | "ExoPlayer" 大字入场，下划线裂成竖条按频谱跳动两小节，收拢还原；副标"无缝切歌 · 智能过渡"                                    | spectrum-morph-ui                   | 原生引擎，无缝换曲。/ Android · ExoPlayer               | 裂开 swoosh + 频谱 tick 群                |
| S7 poster       | 1320 | 330 | 金棕阶跃色块三跳吞屏（携带海报卡前进），第 3 跳满屏揭示 magazine.png；1.03→1.00 缓推落定；静止 hold ≥45f                     | color-block-step-wipe B + 海报      | （海报自带品牌信息）                                    | riser 进 impact（全片峰值）+ sparkle 余韵 |

呼吸位：每镜尾 hold 15–30f 已计入；S3/S5 后各留整拍静置。

## 素材

- `public/textures/magazine.png` — 用户海报（收尾整幅）。
- 其余全部 Remotion 内绘制（符号化，无需截图采集——非复刻场景，阶段 4 豁免截图三件套）。
- 音频：video-shotcraft `assets/audio/`（免费商用，见 ATTRIBUTION）；BGM 从 `audio/bgm/` 试听选型。

## 执行修订记录（阶段 5–6 实现后）

- S7 由 330f 压缩为 240f（避免结尾 7s 死静止），TOTAL 1560f ≈ 52s；S7 删除下载信息叠字（海报信息完整，叠字与海报底部导航打架）。
- S5 修复：胶囊 zIndex 与列表 transform 层叠上下文冲突导致选中词被盖——按 demo 写法去掉胶囊 zIndex，DOM 顺序定层级。
- S6 真 FFT：@remotion/media-utils visualizeAudio（numberOfSamples=512，2 的幂；此版本 spectrum[i] 为标量）+ 低中频段（前 35%）对数分桶聚合 32 根 + pow 0.6 压缩动态范围；kick 命中帧左端条 85–90px 达标，帧间变化真实。
- S1 修复：因果圆点移入 chips 行专属槽位（ORIGIN 精确对齐），不再遮挡"私人 FM"chip。
- BGM 选型：bgm-tech-house.mp3（librosa 实测 123 BPM；前 10s rms 0.11 build-up / 30s 后 0.28 groove，贴合开场呼吸与高潮段），音量 0.34，首 30f 淡入尾 60f 淡出。
- SFX 14 文件入 public/sfx/（video-shotcraft assets，免费商用授权）；峰值实测贴 0dBFS，系数 0.2–0.55；长样本 impact-cine-big(8s)/impact-deep-whoosh(4.1s)/riser-cine(4.9s) 显式 durationInFrames 截断。
- 钉帧表见 src/md3/SfxTrack.tsx（全部相对 SHOTS 表达式）。

## 交付

- 成片：out/promo.mp4（带 BGM）/ out/promo-nobgm.mp4（props-nobgm.json 渲，保留 SFX）
- qa 静帧：out/qa/

- 渲染修复：bundle 中 public 资产位于 /public 子路径，所有 staticFile/Audio 路径去除前导斜杠（字体加载靠 catch 兜底曾掩盖该问题，文字实为微软雅黑回退——修正后 NotoSC 真字重生效）。

## 终检回写（FINAL-REVIEW 后）

- **S5 幽灵词修复**：词列表加 clipPath inset(330px 0 0 0)，上行词进标题带前裁掉（终检 ❌ 项）。
- **S3 时间戳修复**：时间文字随进度 98s→122s 同步跳动，不再冻结在 01:38（终检 ⚠️ 项）。
- **S4 四色波确认**：终态即四来源色带（金棕/雾蓝/灰绿/藕粉对应网易云/QQ/酷狗/本地），spec 前文"金棕色横带"表述以本条为准。
- **卖点 #8 状态栏歌词：本片未拍**。取舍：八样式节拍循环与状态栏歌词二选一取前者（旧片已有状态栏歌词完整镜头），不重复。
- **S3 罗马音未单独出现**：翻译胶囊承载多声部叙事，罗马音并入"副行"概念记录。
- **token 标签终名**：S3=LYRICS · WORD-TIMED、S4=SOURCES · MULTI-PLATFORM、S5=STAGES · 8 STYLES（原分镜文案已转画面内 chips，信息未丢）。
- **TokenTag 24px 裁决**：属编辑风小标签（非正文辅助文字），24px+0.28em 字距为刻意排版，保留；aesthetic-rules 的 ≥32px 针对说明性正文。
- **S2"顺序"图标**：采用循环箭头（列表循环）——音乐播放器行业惯例语义，保留。
