import { computed, reactive } from 'vue';

export interface MobileTopbarOption {
  key: string | number;
  label: string;
  icon?: string;
  /** 平台标识:有值时在 label 后渲染对应平台 SVG logo(PlatformLogo) */
  platform?: string;
}

export interface MobileTopbarGroup {
  id: string;
  routePath: string;
  options: MobileTopbarOption[];
  value: string | number;
  select: (value: string | number) => void;
}

export interface MobileTopbarAction {
  id: string;
  routePath: string;
  label: string;
  icon: string;
  run: () => void;
  options?: MobileTopbarOption[];
  value?: string | number;
  select?: (value: string | number) => void;
  keepOpen?: boolean;
}

export interface MobileTopbarPresentation {
  routePath: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  badge?: string;
  descriptionTitle?: string;
  description?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchInput?: (value: string) => void;
}

const state = reactive({
  groups: new Map<string, MobileTopbarGroup>(),
  actions: new Map<string, MobileTopbarAction>(),
  presentations: new Map<string, MobileTopbarPresentation>(),
  expanded: false
});

export const registerMobileTopbarGroup = (group: MobileTopbarGroup) =>
  state.groups.set(group.id, group);
export const unregisterMobileTopbarGroup = (id: string) => state.groups.delete(id);
export const registerMobileTopbarAction = (action: MobileTopbarAction) =>
  state.actions.set(action.id, action);
export const unregisterMobileTopbarAction = (id: string) => state.actions.delete(id);
export const registerMobileTopbarPresentation = (presentation: MobileTopbarPresentation) =>
  state.presentations.set(presentation.routePath, presentation);
export const unregisterMobileTopbarPresentation = (routePath: string) =>
  state.presentations.delete(routePath);

export function useMobileTopbarMenu(routePath?: () => string) {
  const groups = computed(() => {
    const path = routePath?.();
    return Array.from(state.groups.values()).filter(
      (group) =>
        !path ||
        group.routePath === path ||
        (group.routePath.endsWith('/*') && path.startsWith(group.routePath.slice(0, -2)))
    );
  });
  const actions = computed(() => {
    const path = routePath?.();
    return Array.from(state.actions.values()).filter(
      (action) =>
        !path ||
        action.routePath === path ||
        (action.routePath.endsWith('/*') && path.startsWith(action.routePath.slice(0, -2)))
    );
  });
  const presentation = computed(() => {
    const path = routePath?.();
    if (!path) return null;
    return (
      state.presentations.get(path) ||
      state.presentations.get(`${path.split('/').slice(0, 2).join('/')}/*`) ||
      null
    );
  });
  const activeLabel = computed(() => {
    const group = groups.value[0];
    return group?.options.find((option) => String(option.key) === String(group.value))?.label || '';
  });

  return {
    expanded: computed({
      get: () => state.expanded,
      set: (value: boolean) => {
        state.expanded = value;
      }
    }),
    groups,
    actions,
    presentation,
    activeLabel,
    close: () => {
      state.expanded = false;
    }
  };
}
