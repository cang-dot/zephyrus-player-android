/**
 * 仅供宣传片截图的 mock（仅 dev:web 生效，不进入任何正式构建）。
 * 打开 /#/?__promo=1 进入：注入假播放状态并全屏播放界面；
 * 通过 /#/?__promo=1&style=<key> 切换播放器样式（hash 导航即可触发）。
 */
import { useMobilePlayerTransition } from '@/composables/useMobilePlayerTransition';
import { nowTime } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';

const PROMO_LYRIC = [
  '[00:10.00]新式新时代 大家一起来',
  '[00:14.00]新式时代的真爱 捆绑失控的伤害',
  '[00:18.00]新时代新时代 新式新时代',
  '[00:22.00]大家来大家来 大家一起来',
  '[00:26.00]新式时代的真爱 捆绑失控的伤害',
  '[00:30.00]新式新时代 大家一起来'
].join('\n');

const readHashParams = () =>
  new URLSearchParams(location.hash.split('?')[1] || '');

const applyStyle = (style: string) => {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(localStorage.getItem('music-full-config') || '{}');
  } catch {
    config = {};
  }
  if (config.playerStyle === style) return;
  config.playerStyle = style;
  localStorage.setItem('music-full-config', JSON.stringify(config));
  window.dispatchEvent(new Event('music-full-config-updated'));
};

const injectPlayback = () => {
  const playerStore = usePlayerStore();
  const playerTransition = useMobilePlayerTransition();
  playerStore.playMusic = {
    id: 990001,
    name: '新时代',
    ar: [{ id: 1, name: '大波浪' }],
    al: { id: 2, name: '蓝色面孔', picUrl: '/blue-face-cover.jpg' },
    picUrl: '/blue-face-cover.jpg',
    dt: 254000,
    playMusicUrl: '',
    lyric: PROMO_LYRIC
  } as never;
  playerStore.musicFull = true;
  playerTransition.markOpen();
  applyStyle(readHashParams().get('style') || 'stage');
  // 模拟播放推进，让歌词与进度条动起来
  window.setInterval(() => {
    nowTime.value = (nowTime.value + 0.05) % 250;
  }, 50);
};

if (import.meta.env.DEV) {
  const promoEnabled = () => readHashParams().get('__promo') === '1';
  if (promoEnabled()) window.setTimeout(injectPlayback, 1500);
  window.addEventListener('hashchange', () => {
    if (!promoEnabled()) return;
    const style = readHashParams().get('style');
    if (style) applyStyle(style);
  });
}
