import MusicFull from '@/components/lyric/MusicFull.vue';

import { registerStyle, type SettingItem } from '../registry';
import settings from './settings.json';

export default registerStyle({
  key: 'default',
  label: '默认',
  component: MusicFull,
  isFullScreen: false,
  theme: 'light',
  showStyleSwitch: false,
  // JSON 模块会把 type 字段拓宽成 string，收窄回联合类型
  settings: settings as SettingItem[]
});
