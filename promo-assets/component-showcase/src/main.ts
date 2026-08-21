import { createApp, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import Showcase from './Showcase.vue';
import { FPS, TOTAL_FRAMES } from './data';
import './style.css';

const pinia = createPinia();
setActivePinia(pinia);

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': { common: { loading: '加载中' } } }
});

const app = createApp(Showcase);
app.use(pinia);
app.use(i18n);
app.mount('#app');

let ready = false;
window.__ZEPHYRUS_SHOWCASE__ = {
  seekToFrame: async (frame: number) => {
    const target = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(frame)));
    window.dispatchEvent(new CustomEvent('showcase:seek', { detail: { frame: target } }));
    await nextTick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  },
  ready: async () => {
    if (!ready) {
      await document.fonts?.ready;
      ready = true;
    }
    await nextTick();
  },
  fps: FPS,
  totalFrames: TOTAL_FRAMES
};
