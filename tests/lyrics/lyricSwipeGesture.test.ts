import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, ref } from 'vue';

import {
  lyricSwipeSign,
  shouldCommitLyricSwipe,
  useLyricSwipeGesture
} from '@/composables/useLyricSwipeGesture';

describe('lyric swipe gesture', () => {
  it('uses the configured opening direction and mirrors it when closing', () => {
    expect(lyricSwipeSign('left', false)).toBe(-1);
    expect(lyricSwipeSign('left', true)).toBe(1);
    expect(lyricSwipeSign('right', false)).toBe(1);
    expect(lyricSwipeSign('right', true)).toBe(-1);
  });

  it('commits a projected flick but rejects a short reverse drag', () => {
    expect(shouldCommitLyricSwipe(-72, -140, -1, 400)).toBe(true);
    expect(shouldCommitLyricSwipe(36, 0, -1, 400)).toBe(false);
    expect(shouldCommitLyricSwipe(28, 820, 1, 400)).toBe(true);
  });
});

describe('lyric swipe gesture settle robustness', () => {
  let rafQueue: FrameRequestCallback[];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    rafQueue = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (cb: FrameRequestCallback) => {
        rafQueue.push(cb);
        return rafQueue.length;
      }
    );
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  function mountGesture(handlers: { onOpen: () => void; onClose: () => void }) {
    const opened = ref(false);
    let api: ReturnType<typeof useLyricSwipeGesture> | null = null;
    const host = defineComponent({
      setup() {
        api = useLyricSwipeGesture({
          isOpen: () => opened.value,
          onOpen: () => {
            opened.value = true;
            handlers.onOpen();
          },
          onClose: () => {
            opened.value = false;
            handlers.onClose();
          },
          variant: () => 'scale',
          scaleGeometry: () => null
        });
        return () => h('div');
      }
    });
    const el = document.createElement('div');
    document.body.appendChild(el);
    const app = createApp(host);
    app.mount(el);
    return {
      api: api!,
      opened,
      unmount: () => {
        app.unmount();
        el.remove();
      }
    };
  }

  function pointerEvent(partial: {
    pointerId?: number;
    clientX?: number;
    clientY?: number;
    timeStamp?: number;
  }): PointerEvent {
    return {
      pointerId: partial.pointerId ?? 11,
      isPrimary: true,
      pointerType: 'touch',
      button: 0,
      clientX: partial.clientX ?? 0,
      clientY: partial.clientY ?? 0,
      timeStamp: partial.timeStamp ?? 0,
      cancelable: false,
      target: document.createElement('div')
    } as unknown as PointerEvent;
  }

  /** 逐帧推进 rAF 队列（90ms/帧），settle 在 0.55s 硬上限内自然完成 */
  function flushSettle(frames = 24) {
    let t = performance.now();
    for (let i = 0; i < frames && rafQueue.length > 0; i += 1) {
      const cb = rafQueue.shift()!;
      t += 90;
      cb(t);
    }
  }

  it('commit settle 被新触摸打断时按弹道收尾（onClose 落地、状态解环）', () => {
    const onClose = vi.fn();
    const h = mountGesture({ onOpen: vi.fn(), onClose });
    try {
      h.opened.value = true;
      h.api.animateClose();
      expect(h.api.previewing.value).toBe(true);

      // settle 在途时新触摸（此前会 cancelAnimation 丢弃完成回调 → 冻结在过渡中间帧）
      h.api.onPointerDown(pointerEvent({ clientX: 5, timeStamp: 5000 }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(h.api.previewing.value).toBe(false);
      expect(h.api.phase.value).toBe(null);
      expect(h.api.progress.value).toBe(0); // offset 归零 ⇔ progress=0
      expect(h.opened.value).toBe(false);
    } finally {
      h.unmount();
    }
  });

  it('回弹 settle 被打断时不 commit、仅解预览', () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const h = mountGesture({ onOpen, onClose });
    try {
      // 封面页低速拖 40px 后松手：投影位移不足 → 回弹 settle（target=0）
      h.api.onPointerDown(pointerEvent({ clientX: 0, timeStamp: 1000 }));
      h.api.onPointerMove(pointerEvent({ clientX: -40, timeStamp: 1160 }));
      h.api.onPointerUp(pointerEvent({ clientX: -40, timeStamp: 1180 }));
      expect(h.api.previewing.value).toBe(true);
      expect(onOpen).not.toHaveBeenCalled();

      h.api.onPointerDown(pointerEvent({ clientX: -40, timeStamp: 1400 }));

      expect(onOpen).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(h.api.previewing.value).toBe(false);
      expect(h.api.progress.value).toBe(0); // offset 归零 ⇔ progress=0
    } finally {
      h.unmount();
    }
  });

  it('rAF 链死亡时看门狗兜底收束弹道', () => {
    const onClose = vi.fn();
    const h = mountGesture({ onOpen: vi.fn(), onClose });
    try {
      h.opened.value = true;
      h.api.animateClose();
      expect(h.api.previewing.value).toBe(true);

      // 不 flush rAF，模拟 rAF 链死亡（回调异常/WebView 暂停）
      vi.advanceTimersByTime(900);

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(h.api.previewing.value).toBe(false);
      expect(h.api.phase.value).toBe(null);
      expect(h.api.progress.value).toBe(0); // offset 归零 ⇔ progress=0
      expect(h.opened.value).toBe(false);
    } finally {
      h.unmount();
    }
  });

  it('完成回调抛错仍解预览，且看门狗不重复触发', () => {
    const onClose = vi.fn(() => {
      throw new Error('boom');
    });
    const h = mountGesture({ onOpen: vi.fn(), onClose });
    try {
      h.opened.value = true;
      h.api.animateClose();

      expect(() => flushSettle()).toThrow('boom');

      expect(h.api.previewing.value).toBe(false);
      expect(h.api.progress.value).toBe(0); // offset 归零 ⇔ progress=0
      expect(h.opened.value).toBe(false);

      vi.advanceTimersByTime(2000);
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      h.unmount();
    }
  });
});
