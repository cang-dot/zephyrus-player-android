import FlashPlayer from '@/components/lyric/FlashPlayer.vue';

import { registerStyle, type SettingItem } from '../registry';
import settings from './settings.json';

export default registerStyle({
  key: 'flash',
  label: '快闪',
  component: FlashPlayer,
  isFullScreen: true,
  theme: 'dark',
  showStyleSwitch: false,
  settings: settings as SettingItem[]
});
