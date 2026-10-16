<template>
  <Teleport to="body">
    <div v-if="visible" class="csm-scrim" @click.stop="emit('close')" @contextmenu.prevent />
    <div
      v-if="visible"
      ref="menuRef"
      class="context-song-menu"
      :style="menuStyle"
      @click.stop
      @contextmenu.prevent
    >
      <!-- 歌曲信息头（紧凑：仅比两个操作项略矮） -->
      <div class="csm-song" @click.stop="emit('action', cardActionId)">
        <img class="csm-cover" :src="coverUrl" alt="" />
        <div class="csm-copy">
          <div class="csm-name">{{ songName }}</div>
          <div class="csm-artist">{{ songArtist }}</div>
        </div>
        <i v-if="cardActionId" class="ri-arrow-right-s-line csm-arrow"></i>
      </div>

      <!-- 快捷图标行 -->
      <div v-if="quickActions.length" class="csm-quick">
        <button
          v-for="qa in quickActions"
          :key="qa.id"
          type="button"
          class="csm-quick-btn"
          :class="{ danger: qa.danger, active: qa.active }"
          @click.stop="emit('action', qa.id)"
        >
          <i :class="qa.icon"></i>
          <span>{{ qa.label }}</span>
        </button>
      </div>

      <!-- 分组条目 -->
      <template v-for="(group, groupIndex) in itemGroups" :key="groupIndex">
        <div class="csm-divider"></div>
        <button
          v-for="entry in group"
          :key="entry.id"
          type="button"
          class="csm-item"
          :class="{ danger: entry.danger }"
          @click.stop="emit('action', entry.id)"
        >
          <i :class="entry.icon"></i>
          <span class="csm-item-copy">
            {{ entry.label }}
            <small v-if="entry.subtitle">{{ entry.subtitle }}</small>
          </span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<script lang="ts">
/** 菜单动作条目 / 锚点矩形（供宿主与组件共享的类型） */
export interface ContextMenuAction {
  id: string;
  icon: string;
  label: string;
  subtitle?: string;
  danger?: boolean;
  active?: boolean;
}

export interface ContextMenuAnchorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
</script>

<script lang="ts" setup>
/**
 * 歌曲上下文菜单（单卡片）：上方紧凑歌曲信息，下方操作项，实色底无毛玻璃。
 * 锚定弹出：优先贴锚点下方，空间不足翻到上方，水平夹取视口。
 * 条目/快捷行由使用方配置，动作经 action 事件上抛。
 */
import { computed, nextTick, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    visible?: boolean;
    coverUrl?: string;
    songName?: string;
    songArtist?: string;
    /** 快捷图标行（横向，建议 ≤3 项） */
    quickActions?: ContextMenuAction[];
    /** 条目分组：组间渲染分隔线 */
    items?: ContextMenuAction[][];
    /** 卡片点击 / 卡片箭头触发的动作 id（如前往专辑）；空则不渲染箭头 */
    cardActionId?: string;
    anchorRect?: ContextMenuAnchorRect | null;
  }>(),
  {
    visible: false,
    coverUrl: '',
    songName: '',
    songArtist: '',
    quickActions: () => [],
    items: () => [],
    cardActionId: '',
    anchorRect: null
  }
);

const emit = defineEmits<{ action: [id: string]; close: [] }>();

const menuRef = ref<HTMLElement | null>(null);
const menuHeight = ref(0);

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return;
    menuHeight.value = 0;
    await nextTick();
    menuHeight.value = menuRef.value?.offsetHeight || 0;
  },
  { immediate: true }
);

const itemGroups = computed(() => (Array.isArray(props.items) ? props.items : []));

const menuStyle = computed(() => {
  const width = Math.min(320, (typeof window !== 'undefined' ? window.innerWidth : 390) - 24);
  const style: Record<string, string> = { width: `${width}px` };
  const anchor = props.anchorRect;
  if (!anchor) {
    // 无锚点：屏幕下方居中兜底
    style.left = '50%';
    style.transform = 'translateX(-50%)';
    style.bottom = '24px';
    return style;
  }
  const maxLeft = Math.max(12, window.innerWidth - width - 12);
  const left = Math.min(Math.max(12, anchor.left + anchor.width / 2 - width / 2), maxLeft);
  style.left = `${left.toFixed(1)}px`;
  const below = anchor.top + anchor.height + 8;
  const estimated = menuHeight.value || 360;
  const viewportH = window.innerHeight;
  if (
    below + Math.min(estimated, viewportH * 0.7) < viewportH - 12 ||
    anchor.top > viewportH * 0.5
  ) {
    style.top = `${Math.min(below, viewportH - 12).toFixed(1)}px`;
  } else {
    // 上方放不下：底边对齐锚点上方
    style.bottom = `${Math.max(12, viewportH - anchor.top + 8).toFixed(1)}px`;
  }
  return style;
});
</script>

<style scoped>
.csm-scrim {
  position: fixed;
  inset: 0;
  z-index: 9990;
  background: rgba(0, 0, 0, 0.28);
}

.context-song-menu {
  position: fixed;
  z-index: 9991;
  overflow: hidden;
  border-radius: 14px;
  background: #242426;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.42);
  color: #fff;
}

/* 歌曲信息头：紧凑，仅比两个操作项略矮 */
.csm-song {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
}

.csm-song:active {
  background: rgba(255, 255, 255, 0.06);
}

.csm-cover {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  flex: none;
}

.csm-copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.csm-name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csm-artist {
  overflow: hidden;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csm-arrow {
  flex: none;
  font-size: 20px;
  color: rgba(255, 255, 255, 0.45);
}

.csm-quick {
  display: flex;
  align-items: stretch;
  padding: 2px 6px 6px;
}

.csm-quick-btn {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.csm-quick-btn i {
  font-size: 20px;
}

.csm-quick-btn:active {
  background: rgba(255, 255, 255, 0.08);
}

.csm-quick-btn.danger,
.csm-item.danger {
  color: #ff453a;
}

.csm-quick-btn.active {
  color: #34c759;
}

.csm-divider {
  height: 1px;
  margin: 0 12px;
  background: rgba(255, 255, 255, 0.1);
}

.csm-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  border: 0;
  background: none;
  color: #fff;
  font-size: 15px;
  text-align: left;
  cursor: pointer;
}

.csm-item i {
  flex: none;
  font-size: 18px;
  opacity: 0.9;
}

.csm-item-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.csm-item-copy small {
  font-size: 12px;
  opacity: 0.55;
}

.csm-item:active {
  background: rgba(255, 255, 255, 0.08);
}

@media (prefers-reduced-motion: reduce) {
  .context-song-menu {
    transition: none;
  }
}
</style>
