import ErrorMobilePlayer from '@/components/lyric/ErrorMobilePlayer.vue';

import { registerStyle, type SettingItem } from '../registry';
import settings from './settings.json';

export default registerStyle({
  key: 'error',
  label: '错误',
  component: ErrorMobilePlayer,
  isFullScreen: true,
  theme: 'dark',
  showStyleSwitch: false,
  // JSON 模块会把 type 字段拓宽成 string，收窄回联合类型
  settings: settings as SettingItem[]
});
