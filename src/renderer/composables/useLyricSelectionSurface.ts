import { readonly, ref } from 'vue';

interface LyricSelectionActions {
  onCancel: () => void;
  onToggleAll: () => void;
  onCopy: () => void;
  onGeneratePoster: () => void;
}

interface LyricSelectionState {
  selectedCount: number;
  allSelected: boolean;
}

const active = ref(false);
const selectedCount = ref(0);
const allSelected = ref(false);
let currentOwner: symbol | null = null;
let currentActions: LyricSelectionActions | null = null;

function begin(owner: symbol, actions: LyricSelectionActions, state: LyricSelectionState): void {
  currentOwner = owner;
  currentActions = actions;
  selectedCount.value = state.selectedCount;
  allSelected.value = state.allSelected;
  active.value = true;
}

function update(owner: symbol, state: LyricSelectionState): void {
  if (owner !== currentOwner) return;
  selectedCount.value = state.selectedCount;
  allSelected.value = state.allSelected;
}

function end(owner?: symbol): void {
  if (owner && owner !== currentOwner) return;
  active.value = false;
  selectedCount.value = 0;
  allSelected.value = false;
  currentOwner = null;
  currentActions = null;
}

export function useLyricSelectionSurface() {
  return {
    active: readonly(active),
    selectedCount: readonly(selectedCount),
    allSelected: readonly(allSelected),
    begin,
    update,
    end,
    cancel: () => currentActions?.onCancel(),
    toggleAll: () => currentActions?.onToggleAll(),
    copy: () => currentActions?.onCopy(),
    generatePoster: () => currentActions?.onGeneratePoster()
  };
}
