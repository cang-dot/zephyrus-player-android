import StarChartPlayer from '@/components/lyric/StarChartPlayer.vue';

import { registerStyle } from '../registry';

export default registerStyle({
  key: 'starChart',
  label: '星盘',
  component: StarChartPlayer,
  isFullScreen: false,
  theme: 'dark',
  showStyleSwitch: true
});
