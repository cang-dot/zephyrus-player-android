import { describe, expect, it, vi } from 'vitest';

import { MobileBackStack } from '../src/renderer/services/mobileBackStack';

describe('MobileBackStack', () => {
  it('closes the highest active layer first', () => {
    const stack = new MobileBackStack();
    const closePlayer = vi.fn();
    const closeMenu = vi.fn();
    stack.register({ id: 'player', priority: 100, isActive: () => true, onBack: closePlayer });
    stack.register({ id: 'menu', priority: 300, isActive: () => true, onBack: closeMenu });

    expect(stack.handleBack()).toBe(true);
    expect(closeMenu).toHaveBeenCalledOnce();
    expect(closePlayer).not.toHaveBeenCalled();
  });

  it('falls through handlers that decline the back action', () => {
    const stack = new MobileBackStack();
    const closePlayer = vi.fn();
    stack.register({ id: 'player', priority: 100, isActive: () => true, onBack: closePlayer });
    stack.register({ id: 'menu', priority: 300, isActive: () => true, onBack: () => false });

    expect(stack.handleBack()).toBe(true);
    expect(closePlayer).toHaveBeenCalledOnce();
  });

  it('exposes progress only to the current top layer', () => {
    const stack = new MobileBackStack();
    const playerProgress = vi.fn();
    const menuProgress = vi.fn();
    stack.register({
      id: 'player',
      priority: 100,
      isActive: () => true,
      onBack: () => undefined,
      onProgress: playerProgress
    });
    stack.register({
      id: 'menu',
      priority: 300,
      isActive: () => true,
      onBack: () => undefined,
      onProgress: menuProgress
    });

    stack.updateProgress(0.45);
    expect(menuProgress).toHaveBeenCalledWith(0.45);
    expect(playerProgress).not.toHaveBeenCalled();
  });

  it('cancels predictive progress on the same top layer', () => {
    const stack = new MobileBackStack();
    const cancelPlayer = vi.fn();
    const cancelMenu = vi.fn();
    let menuVisible = true;
    stack.register({
      id: 'player',
      priority: 100,
      isActive: () => true,
      onBack: () => undefined,
      onCancel: cancelPlayer
    });
    stack.register({
      id: 'menu',
      priority: 300,
      isActive: () => menuVisible,
      onBack: () => undefined,
      onCancel: cancelMenu
    });

    stack.cancelProgress();
    expect(cancelMenu).toHaveBeenCalledOnce();
    expect(cancelPlayer).not.toHaveBeenCalled();

    menuVisible = false;
    stack.cancelProgress();
    expect(cancelPlayer).toHaveBeenCalledOnce();
  });

  it('locks predictive progress and cancellation to the layer active at gesture start', () => {
    const stack = new MobileBackStack();
    const playerProgress = vi.fn();
    const cancelMenu = vi.fn();
    const menuProgress = vi.fn();
    let menuVisible = true;
    stack.register({
      id: 'player',
      priority: 100,
      isActive: () => true,
      onBack: () => undefined,
      onProgress: playerProgress
    });
    stack.register({
      id: 'menu',
      priority: 300,
      isActive: () => menuVisible,
      onBack: () => undefined,
      onProgress: menuProgress,
      onCancel: cancelMenu
    });

    stack.startProgress();
    menuVisible = false;
    stack.updateProgress(0.6);
    stack.cancelProgress();

    expect(menuProgress).toHaveBeenNthCalledWith(1, 0);
    expect(menuProgress).toHaveBeenNthCalledWith(2, 0.6);
    expect(playerProgress).not.toHaveBeenCalled();
    expect(cancelMenu).toHaveBeenCalledOnce();
  });
});
