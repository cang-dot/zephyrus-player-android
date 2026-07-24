import RainPlayer from '@/components/lyric/RainPlayer.vue';

import { registerStyle } from '../registry';

const settings = [
  {
    key: 'rainLyricMode',
    type: 'radio' as const,
    label: '歌词显示模式',
    options: [
      { value: 'split', label: '左右分词' },
      { value: 'group', label: '两句一组' }
    ],
    default: 'split'
  },
  {
    key: 'rainShowCover',
    type: 'boolean' as const,
    label: '显示封面',
    default: true
  },
  {
    key: 'rainBackgroundDarkness',
    type: 'slider' as const,
    label: '背景暗化程度',
    min: 0,
    max: 100,
    step: 5,
    marks: ['原图', '50%', '全黑'],
    default: 70
  },
  {
    key: 'rainIntensity',
    type: 'slider' as const,
    label: '雨水强度',
    min: 0,
    max: 100,
    default: 50
  },
  {
    key: 'rainSpeed',
    type: 'slider' as const,
    label: '下落速度',
    min: 0.5,
    max: 3,
    step: 0.1,
    default: 1
  },
  {
    key: 'rainAudioReactive',
    type: 'boolean' as const,
    label: '音频响应',
    default: true
  },
  {
    key: 'rainColor',
    type: 'color' as const,
    label: '雨水颜色',
    default: '#ffffff'
  },
  {
    key: 'rainOpacity',
    type: 'slider' as const,
    label: '透明度',
    min: 0.1,
    max: 1,
    step: 0.05,
    default: 0.6
  },
  {
    type: 'divider' as const
  },
  {
    key: 'rainAngle',
    type: 'slider' as const,
    label: '雨滴倾斜角度',
    min: -30,
    max: 30,
    step: 5,
    default: 15
  },
  {
    key: 'rainLength',
    type: 'slider' as const,
    label: '雨滴长度',
    min: 10,
    max: 100,
    step: 5,
    default: 40
  }
];

const rainStyle = registerStyle({
  key: 'rain',
  label: '雨夜',
  component: RainPlayer,
  isFullScreen: true,
  theme: 'dark',
  showStyleSwitch: false,
  settings
});

export default rainStyle;
