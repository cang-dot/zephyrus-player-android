import { readonly, ref } from 'vue';

const active = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

function pulse(): void {
  active.value = true;
  if (timer) clearTimeout(timer);
  const duration =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 100
      : 220;
  timer = setTimeout(() => {
    active.value = false;
    timer = undefined;
  }, duration);
}

export function usePlayerSurfaceFeedback() {
  return { active: readonly(active), pulse };
}
