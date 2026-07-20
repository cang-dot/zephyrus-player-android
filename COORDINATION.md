# 舞台播放器（StagePlayer）协调文档

## 项目信息
- 项目路径：`C:\Users\Administrator\Desktop\AlgerMusicPlayer\AlgerMusicPlayer-5.1.0`
- 源码路径：`src/renderer/`
- 创建日期：2026-06-18

## 架构概览

```
舞台播放器
├── services/climaxDetector.ts     ← 子代理1：高潮检测
├── utils/stageAnimations.ts       ← 子代理2：动画预设库
├── components/lyric/StagePlayer.vue ← 子代理3：主组件
└── 集成到现有文件                  ← 子代理4：集成
```

## 共享接口定义

### WordData（来自 music.ts，已有）
```typescript
interface IWordData {
  text: string;
  startTime: number;   // 毫秒
  duration: number;    // 毫秒
  space?: boolean;
}
```

### LyricLine（来自 music.ts，已有）
```typescript
interface ILyricText {
  text: string;
  trText: string;
  words?: IWordData[];
  hasWordByWord?: boolean;
  startTime?: number;
  duration?: number;
}
```

### ClimaxDetector 导出接口（子代理1）
```typescript
interface ClimaxDetector {
  // 状态
  isClimax: boolean;
  energyLevel: number;           // 0-2，1.0为正常
  spectrumCoverage: number;      // 0-1，频谱覆盖度
  
  // 方法
  connect(audioContext: AudioContext, sourceNode: AudioNode): void;
  start(): void;
  stop(): void;
  onClimax(callback: (energy: number) => void): () => void;  // 返回取消函数
}
```

### 动画函数签名（子代理2）
```typescript
type AnimationFn = (
  element: HTMLElement, 
  options?: { energy?: number; duration?: number }
) => gsap.core.Timeline;

interface StageAnimations {
  // 普通模式动画
  slideRight: AnimationFn;
  slideLeft: AnimationFn;
  slideTop: AnimationFn;
  slideBottom: AnimationFn;
  fadeIn: AnimationFn;
  wordByWord: AnimationFn;
  scaleIn: AnimationFn;
  blurIn: AnimationFn;
  
  // 节奏模式动画
  wordDrop: AnimationFn;
  wordVibrate: AnimationFn;
  wordNormal: AnimationFn;
  
  // 退场动画
  exit: AnimationFn;
}
```

### AnimationSelector（子代理2）
```typescript
class AnimationSelector {
  select(lineIndex: number): number;  // 返回动画编号 0-7
  reset(): void;
}
```

### 动画模式类型（子代理3）
```typescript
type AnimationMode = 'normal' | 'rhythm';
```

## 子代理依赖关系

```
子代理1 (climaxDetector) ──┐
                           ├──→ 子代理3 (StagePlayer)
子代理2 (stageAnimations) ─┘
                           
子代理4 (集成) ──→ 修改 audioService.ts, MusicFull.vue
```

## 动画模式检测规则

```typescript
// 句间间隔阈值
const LINE_GAP_THRESHOLD = 200;  // ms，低于此值为连续歌词

// 词间间隔阈值
const WORD_GAP_THRESHOLD = 300;  // ms，高于此值为长间隔

// 拉长音阈值
const LONG_DURATION_THRESHOLD = 800;  // ms

function detectAnimationMode(line: ILyricText, nextLine?: ILyricText): AnimationMode {
  if (!nextLine) return 'normal';
  const lineGap = nextLine.startTime! - (line.startTime! + line.duration!);
  if (lineGap < LINE_GAP_THRESHOLD) return 'normal';
  
  if (line.hasWordByWord && line.words) {
    for (let i = 1; i < line.words.length; i++) {
      const prev = line.words[i - 1];
      const curr = line.words[i];
      const gap = curr.startTime - (prev.startTime + prev.duration);
      if (gap > WORD_GAP_THRESHOLD) return 'rhythm';
    }
  }
  
  return 'normal';
}
```

## CSS 变量（舞台播放器专用）

```css
:root {
  --stage-bg-opacity: 0.2;
  --stage-blur: 30px;
  --stage-light-count: 6;
  --lyric-font-size: 48px;
  --lyric-font-weight: 700;
}
```

## 文件创建清单

| 文件 | 负责 | 状态 |
|------|------|------|
| `services/climaxDetector.ts` | 子代理1 | ✅ 已完成 |
| `utils/stageAnimations.ts` | 子代理2 | ✅ 已完成 |
| `utils/animationSelector.ts` | 子代理2 | ✅ 已完成 |
| `components/lyric/StagePlayer.vue` | 子代理3 | ✅ 已完成 |
| `components/lyric/StagePlayer.css` | 子代理3 | ✅ 已完成 |
| `types/lyric.ts` 修改 | 子代理4 | ✅ 已完成 |
| `components/lyric/MusicFull.vue` 修改 | 子代理4 | ✅ 已完成 |
| `services/audioService.ts` 修改 | 子代理4 | ✅ 已完成 |
| `components/lyric/MusicFullWrapper.vue` 修改 | 子代理4 | ✅ 已完成 |
| `components/lyric/LyricSettings.vue` 修改 | 子代理4 | ✅ 已完成 |

## 更新日志

- 2026-06-18：初始协调文档创建
