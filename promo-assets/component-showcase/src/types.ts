export interface ShowcaseFrameContext {
  frame: number;
  fps: 30;
  time: number;
  progress: number;
}

export interface ShowcaseSong {
  id: string;
  title: string;
  artist: string;
  cover: string;
  primaryColor: string;
  surfaceColor: string;
  ttmlFixture: string;
}

export interface ShowcaseRenderer {
  seekToFrame(frame: number): Promise<void>;
  ready(): Promise<void>;
  fps?: number;
  totalFrames?: number;
}

declare global {
  interface Window {
    __ZEPHYRUS_SHOWCASE__: ShowcaseRenderer;
  }
}
