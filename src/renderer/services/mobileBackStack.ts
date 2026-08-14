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
    const candidates = [...this.layers.values()]
      .filter((layer) => layer.isActive())
      .sort((a, b) => b.priority - a.priority || b.order - a.order);

    for (const layer of candidates) {
      const result = layer.onBack();
      if (result !== false) return true;
    }
    return false;
  }

  updateProgress(progress: number) {
    this.top()?.onProgress?.(Math.max(0, Math.min(1, progress)));
  }

  cancelProgress() {
    this.top()?.onCancel?.();
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
  window.__handleAndroidBackProgress = (progress) => mobileBackStack.updateProgress(progress);
  window.__handleAndroidBackCancel = () => mobileBackStack.cancelProgress();
  window.__activeAndroidBackLayer = () => mobileBackStack.activeLayerId();
}
