/**
 * 宽屏侧栏 UI 状态（WideSidebar 与 MobileLayout 共享）。
 *
 * MobileLayout 需要知道侧栏当前占位宽度来给内容区让位
 * （--wide-sidebar-inset），状态抽到这里避免事件总线和 DOM 探测。
 * pinned 持久化 localStorage（与展开态无关，仅钉住记忆）。
 */
import { ref, watch } from 'vue';

const PIN_KEY = 'wide-sidebar-pinned';

const expanded = ref(false);
const pinned = ref(false);

// 初始化持久化状态（模块级一次）
try {
  pinned.value = localStorage.getItem(PIN_KEY) === '1';
} catch {
  pinned.value = false;
}

watch(pinned, (value) => {
  try {
    localStorage.setItem(PIN_KEY, value ? '1' : '0');
  } catch {
    /* 存储不可用时仅本次会话生效 */
  }
});

export function useWideSidebarState() {
  return { expanded, pinned };
}

export function setSidebarExpanded(value: boolean): void {
  expanded.value = value;
}

export function toggleSidebarPinned(): boolean {
  pinned.value = !pinned.value;
  if (pinned.value) expanded.value = true;
  return pinned.value;
}
