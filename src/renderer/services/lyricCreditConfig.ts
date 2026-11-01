import { shallowReadonly, shallowRef } from 'vue';

import { type LyricCreditConfig, normalizeCreditConfig } from '@/utils/lyricCredits';

const STORAGE_KEY = 'music-full-config';
function readStored(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

const config = shallowRef(normalizeCreditConfig(readStored()));
export const lyricCreditConfig = shallowReadonly(config);

/** Legacy panels save complete snapshots; retain newer credit settings when they do. */
export function mergeStoredLyricConfig(snapshot: object) {
  return { ...readStored(), ...snapshot, ...config.value };
}

function refresh() {
  const next = normalizeCreditConfig(readStored());
  if (JSON.stringify(next) !== JSON.stringify(config.value)) config.value = next;
}

export function saveLyricCreditConfig(patch: Partial<LyricCreditConfig>) {
  const latest = readStored();
  const next = normalizeCreditConfig({ ...normalizeCreditConfig(latest), ...patch });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...latest, ...next }));
  refresh();
  window.dispatchEvent(new CustomEvent('music-full-config-updated'));
}

if (typeof window !== 'undefined') {
  window.addEventListener('music-full-config-updated', refresh);
  window.addEventListener('storage', (event) => {
    if (!event.key || event.key === STORAGE_KEY) refresh();
  });
}
