/**
 * 渲染宿主页入口
 *
 * 用途：把真实播放器样式组件在独立页面运行，供云端无头 Chromium 逐帧截图
 * （视频「真复用」渲染）。与主入口的区别仅在于：挂载后执行渲染注入逻辑。
 *
 * 访问：/render-host.html?style=<key>
 * - style：写入 music-full-config.playerStyle，选择真实播放器样式
 * - 歌曲数据由 Puppeteer 在页面脚本执行前注入 window.__RENDER_DATA
 */
import '../index.css';
import '@/assets/css/mobile.css';
import 'animate.css';
import 'remixicon/fonts/remixicon.css';
// 触发所有播放模式自注册
import '@/playerStyles';

import { createApp } from 'vue';

import i18n from '@/../i18n/renderer';
import router from '@/router';
import pinia from '@/store';

import App from '../App.vue';
import directives from '../directive';

// ---------- 预置环境（必须在任何组件初始化前写好 localStorage） ----------
// 宿主页是独立 MPA 页面，样式 key 走普通 query：render-host.html?style=<key>
const query = new URLSearchParams(location.search);
const styleKey = query.get('style') || 'default';

// 光敏警告直接放行（渲染环境无用户交互）
localStorage.setItem('photosensitivity-warning-acked', 'true');

// 样式选择：与 App 一致，播放器组件从 music-full-config.playerStyle 读取
let fullConfig: Record<string, unknown> = {};
try {
  fullConfig = JSON.parse(localStorage.getItem('music-full-config') || '{}');
} catch {
  fullConfig = {};
}
fullConfig.playerStyle = styleKey;
localStorage.setItem('music-full-config', JSON.stringify(fullConfig));

// ---------- 与主入口一致的完整 App 环境 ----------
const app = createApp(App);

Object.keys(directives).forEach((key: string) => {
  app.directive(key, directives[key as keyof typeof directives]);
});

app.use(pinia);
app.use(router);
app.use(i18n as any);
app.mount('#app');

// ---------- 渲染注入：mock 播放状态并打开全屏播放器 ----------
void (async () => {
  const { useMobilePlayerTransition } = await import('@/composables/useMobilePlayerTransition');
  const { allTime, getLrcIndex, lrcArray, nowIndex, nowTime } = await import('@/hooks/MusicHook');
  const { usePlayerStore } = await import('@/store/modules/player');

  const payload = (window as unknown as { __RENDER_DATA?: RenderPayload }).__RENDER_DATA;
  if (!payload) return;

  const playerStore = usePlayerStore();
  const playerTransition = useMobilePlayerTransition();

  // 1) 歌曲信息（含歌词文本；MusicHook 会 watch playMusic 并解析出 lrcArray）
  playerStore.playMusic = payload.song as never;

  // 2) 等歌词解析完成（失败也继续——无歌词画面仍可导出）
  await new Promise<void>((resolve) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (lrcArray.value.length > 0 || Date.now() - started > 8000) {
        window.clearInterval(timer);
        resolve();
      }
    }, 50);
  });

  allTime.value = payload.song.dt ? payload.song.dt / 1000 : 240;
  nowTime.value = payload.startSec ?? 5;
  nowIndex.value = getLrcIndex(nowTime.value);

  // 3) 打开全屏播放器（真实挂载链）
  playerStore.musicFull = true;
  playerTransition.markOpen();

  // 4) 渲染控制接口：seek(t) 精确置位播放进度（歌词/进度条确定性跟随）
  const host = window as unknown as {
    __renderHost?: { seek: (t: number) => void; isReady: boolean };
  };
  host.__renderHost = {
    isReady: true,
    seek(t: number) {
      nowTime.value = t;
      nowIndex.value = getLrcIndex(t);
    }
  };
})();

interface RenderPayload {
  song: Record<string, unknown>;
  startSec?: number;
}
