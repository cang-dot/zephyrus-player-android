import { reactive, readonly } from 'vue';

/**
 * 共享悬浮卡片状态
 * 所有页面通过此 composable 控制同一个悬浮卡片
 * 卡片组件放在 MobileLayout 中，position: fixed
 */

interface HeroCardState {
  visible: boolean;
  title: string;
  subtitle: string;
  compact: boolean;
  /** 额外内容 slot 标识，用于复杂卡片（如用户页头像、设置页搜索） */
  variant: 'simple' | 'user' | 'settings' | 'none';
}

const state = reactive<HeroCardState>({
  visible: false,
  title: '',
  subtitle: '',
  compact: false,
  variant: 'simple',
});

export function useHeroCard() {
  const setHeroCard = (opts: Partial<HeroCardState>) => {
    if (opts.title !== undefined) state.title = opts.title;
    if (opts.subtitle !== undefined) state.subtitle = opts.subtitle;
    if (opts.variant !== undefined) state.variant = opts.variant;
    if (opts.visible !== undefined) state.visible = opts.visible;
  };

  const setCompact = (compact: boolean) => {
    state.compact = compact;
  };

  const showHeroCard = () => { state.visible = true; };
  const hideHeroCard = () => { state.visible = false; };

  return {
    heroCard: readonly(state),
    setHeroCard,
    setCompact,
    showHeroCard,
    hideHeroCard,
  };
}
