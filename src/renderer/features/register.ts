import { registerFeature } from './registry';

export function registerBuiltinFeatures() {
  registerFeature({
    id: 'lyric-metaphor',
    name: '歌词隐喻分析',
    description: '使用 AI 分析当前歌词中的隐喻、象征等修辞手法，以 Markdown 形式在侧边面板展示',
    icon: 'ri-quill-pen-line',
    type: 'analysis'
  });

  registerFeature({
    id: 'default-style',
    name: '默认样式',
    description: '标准的歌词播放器样式',
    icon: 'ri-file-text-line',
    type: 'playerStyle',
    locked: true
  });

  registerFeature({
    id: 'stage-style',
    name: '舞台样式',
    description: '沉浸式舞台风格的歌词展示',
    icon: 'ri-flood-fill',
    type: 'playerStyle'
  });

  registerFeature({
    id: 'star-chart-style',
    name: '星盘样式',
    description: '以专辑封面生成旋转点阵星盘，并在中心显示歌词',
    icon: 'ri-record-circle-line',
    type: 'playerStyle'
  });

  registerFeature({
    id: 'frenzy-style',
    name: '狂躁样式',
    description: '全屏动态效果的歌词展示',
    icon: 'ri-fire-line',
    type: 'playerStyle'
  });

  registerFeature({
    id: 'error-style',
    name: '错误样式',
    description: '黑底高速流体+CRT扫描线+噪点闪烁的故障风格播放器，含高频闪光效果',
    icon: 'ri-bug-line',
    type: 'playerStyle'
  });
}
