import MusicFull from '@/components/lyric/MusicFull.vue';

import { registerStyle } from '../registry';

export default registerStyle({
  key: 'smoke',
  label: '烟雾',
  component: MusicFull,
  isFullScreen: false,
  theme: 'dark',
  showStyleSwitch: true
});
