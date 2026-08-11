import type { InjectionKey, Ref } from 'vue';

export interface SettingAccordionContext {
  openItemId: Ref<string | null>;
  toggle: (id: string) => void;
}

export const SETTING_ACCORDION_KEY: InjectionKey<SettingAccordionContext> =
  Symbol('setting-accordion');
