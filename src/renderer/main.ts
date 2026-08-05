import './index.css';
import '@/assets/css/mobile.css';
import 'animate.css';
import 'remixicon/fonts/remixicon.css';
// 触发所有播放模式自注册
import '@/playerStyles';

import { createApp } from 'vue';

import i18n from '@/../i18n/renderer';
import router from '@/router';
import pinia from '@/store';

import App from './App.vue';
import directives from './directive';

const app = createApp(App);

Object.keys(directives).forEach((key: string) => {
  app.directive(key, directives[key as keyof typeof directives]);
});

app.use(pinia);
app.use(router);
app.use(i18n as any);
app.mount('#app');

// 注册 deep link 处理器（供原生 Android 调用）
import { setupDeepLinkHandler } from '@/utils/deepLink';
setupDeepLinkHandler();

// 注册 Spotify OAuth 回调处理器（供原生 Android 调用）
import { useSpotifyStore } from '@/store/modules/spotify';
const spotifyStore = useSpotifyStore();
(window as any).__handleSpotifyCallback = (url: string) => {
  spotifyStore.handleCallback(url).catch(console.error);
};
// 初始化 Spotify 登录状态
spotifyStore.init();
