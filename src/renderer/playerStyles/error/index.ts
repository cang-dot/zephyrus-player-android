import ErrorMobilePlayer from '@/components/lyric/ErrorMobilePlayer.vue';

import { registerStyle } from '../registry';
import settings from './settings.json';

export default registerStyle({
  key: 'error',
  label: '错误',
  component: ErrorMobilePlayer,
  isFullScreen: true,
  theme: 'dark',
  showStyleSwitch: false,
  settings
});
