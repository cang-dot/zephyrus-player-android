import { computed, reactive } from 'vue';

export interface MobileTopbarOption {
  key: string | number;
  label: string;
  icon?: string;
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
}

const state = reactive({
  groups: new Map<string, MobileTopbarGroup>(),
  actions: new Map<string, MobileTopbarAction>(),
  expanded: false
});

export const registerMobileTopbarGroup = (group: MobileTopbarGroup) =>
  state.groups.set(group.id, group);
export const unregisterMobileTopbarGroup = (id: string) => state.groups.delete(id);
export const registerMobileTopbarAction = (action: MobileTopbarAction) =>
  state.actions.set(action.id, action);
export const unregisterMobileTopbarAction = (id: string) => state.actions.delete(id);

export function useMobileTopbarMenu(routePath?: () => string) {
  const groups = computed(() => {
    const path = routePath?.();
    return Array.from(state.groups.values()).filter((group) => !path || group.routePath === path);
  });
  const actions = computed(() => {
    const path = routePath?.();
    return Array.from(state.actions.values()).filter(
      (action) => !path || action.routePath === path
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
    activeLabel,
    close: () => {
      state.expanded = false;
    }
  };
}
