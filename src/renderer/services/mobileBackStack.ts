export type MobileBackResult = boolean | void | Promise<boolean | void>;

export interface MobileBackLayer {
  id: string;
  priority: number;
  isActive: () => boolean;
  onBack: () => MobileBackResult;
  onProgress?: (progress: number) => void;
  onCancel?: () => void;
}

type RegisteredLayer = MobileBackLayer & { order: number };

export class MobileBackStack {
  private readonly layers = new Map<string, RegisteredLayer>();
  private order = 0;
  private gestureLayer: RegisteredLayer | undefined;

  register(layer: MobileBackLayer) {
    const registered: RegisteredLayer = { ...layer, order: ++this.order };
    this.layers.set(layer.id, registered);
    return () => {
      if (this.layers.get(layer.id) === registered) this.layers.delete(layer.id);
    };
  }

  top() {
    return [...this.layers.values()]
      .filter((layer) => layer.isActive())
      .sort((a, b) => b.priority - a.priority || b.order - a.order)[0];
  }

  handleBack() {
    const gestureLayer = this.gestureLayer;
    this.gestureLayer = undefined;
    const candidates = [...this.layers.values()]
      .filter((layer) => layer.isActive())
      .sort((a, b) => b.priority - a.priority || b.order - a.order);
    if (gestureLayer?.isActive()) {
      const index = candidates.indexOf(gestureLayer);
      if (index >= 0) candidates.splice(index, 1);
      candidates.unshift(gestureLayer);
    }

    for (const layer of candidates) {
      const result = layer.onBack();
      if (result !== false) return true;
    }
    return false;
  }

  startProgress() {
    this.gestureLayer = this.top();
    this.gestureLayer?.onProgress?.(0);
  }

  updateProgress(progress: number) {
    if (!this.gestureLayer) this.gestureLayer = this.top();
    this.gestureLayer?.onProgress?.(Math.max(0, Math.min(1, progress)));
  }

  cancelProgress() {
    (this.gestureLayer ?? this.top())?.onCancel?.();
    this.gestureLayer = undefined;
  }

  activeLayerId() {
    return this.top()?.id || '';
  }
}

export const mobileBackStack = new MobileBackStack();

export const registerMobileBackLayer = (layer: MobileBackLayer) => mobileBackStack.register(layer);

export const handleMobileBack = () => mobileBackStack.handleBack();

declare global {
  interface Window {
    __handleAndroidBack?: () => boolean;
    __handleAndroidBackStart?: () => void;
    __handleAndroidBackProgress?: (progress: number) => void;
    __handleAndroidBackCancel?: () => void;
    __activeAndroidBackLayer?: () => string;
  }
}

let bridgeInstalled = false;

export function installMobileBackBridge() {
  if (bridgeInstalled || typeof window === 'undefined') return;
  bridgeInstalled = true;
  window.__handleAndroidBack = () => mobileBackStack.handleBack();
  window.__handleAndroidBackStart = () => mobileBackStack.startProgress();
  window.__handleAndroidBackProgress = (progress) => mobileBackStack.updateProgress(progress);
  window.__handleAndroidBackCancel = () => mobileBackStack.cancelProgress();
  window.__activeAndroidBackLayer = () => mobileBackStack.activeLayerId();
}
