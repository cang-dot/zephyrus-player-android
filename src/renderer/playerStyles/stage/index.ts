import StagePlayer from '@/components/lyric/StagePlayer.vue';

import { registerStyle, type SettingItem } from '../registry';
import settings from './settings.json';

export default registerStyle({
  key: 'stage',
  label: '舞台',
  component: StagePlayer,
  isFullScreen: false,
  theme: 'light',
  showStyleSwitch: true,
  // JSON 模块会把 type 字段拓宽成 string，收窄回联合类型
  settings: settings as SettingItem[]
});
