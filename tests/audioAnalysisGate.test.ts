import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Howl } from 'howler';

import {
  armHowlForAnalysis,
  disarmHowlAudio,
  isAnalysisArmed,
  isWebAnalysisPlatform,
  probeAnalysisCapability,
  resetProbeCache
} from '@/services/audioAnalysisGate';

/** 构造带媒体元素节点的 Howl 桩（gate 只访问 _sounds[0]._node） */
function makeHowl(src = 'about:blank'): Howl {
  const node = new Audio();
  node.src = src;
  return { _sounds: [{ _node: node }] } as unknown as Howl;
}

describe('audioAnalysisGate', () => {
  beforeEach(() => {
    resetProbeCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('probeAnalysisCapability', () => {
    it('同 host 只探测一次，结果跨 URL 复用', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, body: null });
      vi.stubGlobal('fetch', fetchMock);

      const a = await probeAnalysisCapability('https://m7.music.126.net/a.mp3?tok=1');
      const b = await probeAnalysisCapability('https://m7.music.126.net/b.mp3?tok=2');

      expect(a).toBe(true);
      expect(b).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      // 探测请求做了 https 升级并以 CORS 模式发起，带小段 Range
      expect(fetchMock.mock.calls[0][0]).toBe('https://m7.music.126.net/a.mp3?tok=1');
      expect(fetchMock.mock.calls[0][1]).toMatchObject({ mode: 'cors' });
    });

    it('探测失败（CORS 拒绝抛错）返回 false 且缓存失败结论', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      vi.stubGlobal('fetch', fetchMock);

      const a = await probeAnalysisCapability('https://m802.music.126.net/x.mp3');
      const b = await probeAnalysisCapability('https://m802.music.126.net/y.mp3');

      expect(a).toBe(false);
      expect(b).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('http URL 探测时升级为 https', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, body: null });
      vi.stubGlobal('fetch', fetchMock);

      await probeAnalysisCapability('http://m8.music.126.net/song.mp3');

      expect(fetchMock.mock.calls[0][0]).toBe('https://m8.music.126.net/song.mp3');
    });

    it('无法解析的 URL 直接判不可分析，不发起请求', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const result = await probeAnalysisCapability('not-a-url');

      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('arm / disarm', () => {
    it('武装后 crossOrigin=anonymous 且重设 src 触发重载', () => {
      const howl = makeHowl('https://m7.music.126.net/a.mp3');

      armHowlForAnalysis(howl, 'https://m7.music.126.net/a.mp3');

      const node = (howl as any)._sounds[0]._node as HTMLAudioElement;
      expect(node.crossOrigin).toBe('anonymous');
      expect(node.src).toContain('a.mp3');
      expect(isAnalysisArmed(howl)).toBe(true);
    });

    it('摘除池残留的 crossOrigin，避免下一首打到无 ACAO 节点加载失败', () => {
      const howl = makeHowl('https://old.example/a.mp3');
      const node = (howl as any)._sounds[0]._node as HTMLAudioElement;
      node.setAttribute('crossorigin', 'anonymous'); // 模拟对象池残留

      disarmHowlAudio(howl, 'https://noncors.example/b.mp3');

      expect(node.getAttribute('crossorigin')).toBeNull();
      expect(node.src).toContain('b.mp3');
      expect(isAnalysisArmed(howl)).toBe(false);
    });

    it('无残留的干净节点不做任何改动（零开销路径）', () => {
      const howl = makeHowl('https://m7.music.126.net/clean.mp3');
      const node = (howl as any)._sounds[0]._node as HTMLAudioElement;
      const srcBefore = node.src;

      disarmHowlAudio(howl, 'https://m7.music.126.net/clean.mp3');

      expect(node.crossOrigin).toBeNull();
      expect(node.src).toBe(srcBefore);
    });

    it('缺媒体节点的 Howl 武装/摘除均静默不抛', () => {
      const bare = {} as Howl;
      expect(() => armHowlForAnalysis(bare, 'https://x.example/a.mp3')).not.toThrow();
      expect(() => disarmHowlAudio(bare, 'https://x.example/a.mp3')).not.toThrow();
      expect(isAnalysisArmed(bare)).toBe(false);
    });
  });

  describe('isWebAnalysisPlatform', () => {
    it('纯浏览器环境为 true（@capacitor/core web 运行时不算原生壳）', () => {
      expect(isWebAnalysisPlatform()).toBe(true);
    });

    it('Capacitor 原生壳（isNativePlatform=true）为 false', () => {
      (window as any).Capacitor = { isNativePlatform: () => true };
      try {
        expect(isWebAnalysisPlatform()).toBe(false);
      } finally {
        delete (window as any).Capacitor;
      }
    });

    it('Capacitor web 运行时（isNativePlatform=false）仍视为网页版', () => {
      (window as any).Capacitor = { isNativePlatform: () => false };
      try {
        expect(isWebAnalysisPlatform()).toBe(true);
      } finally {
        delete (window as any).Capacitor;
      }
    });
  });
});
