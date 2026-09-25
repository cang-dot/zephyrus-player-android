<template>
  <section class="listening-heatmap">
    <header class="heatmap-header">
      <h2>{{ t('comp.homeSection.listenStats') }}</h2>
      <span class="heatmap-total">
        {{ t('comp.homeSection.heatmapMeta', { total, days: activeDays }) }}
      </span>
    </header>
    <div class="heatmap-grid" role="img" :aria-label="ariaLabel">
      <div v-for="(column, week) in weeklyColumns" :key="week" class="heatmap-column">
        <span
          v-for="cell in column"
          :key="cell.key"
          class="heatmap-cell"
          :class="[`level-${heatLevel(cell.count, peak)}`, { future: cell.future }]"
          :title="`${cell.key} · ${cell.count}`"
        />
      </div>
    </div>
    <div class="heatmap-legend">
      <span>{{ t('comp.homeSection.heatmapLess') }}</span>
      <span v-for="level in 5" :key="level" class="heatmap-cell" :class="`level-${level - 1}`" />
      <span>{{ t('comp.homeSection.heatmapMore') }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { getRecentSongs } from '@/api/user';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import { useUserStore } from '@/store/modules/user';
import {
  buildHeatmap,
  heatLevel,
  HEATMAP_WEEKS,
  type PlayTimestampEntry
} from '@/utils/heatmapStats';

const { t } = useI18n();
const playHistoryStore = usePlayHistoryStore();
const userStore = useUserStore();

/** 云端最近记录补历史（登录时）；失败静默回退纯本地 */
const cloudEntries = ref<PlayTimestampEntry[]>([]);

onMounted(async () => {
  if (!userStore.user?.userId || !localStorage.getItem('token')) return;
  try {
    const response = await getRecentSongs(100);
    const list = response.data?.data?.list || [];
    cloudEntries.value = list
      .map((item: any) => ({
        id: item?.data?.id ?? item?.data?.songId ?? '',
        timestamp: Number(item?.playTime)
      }))
      .filter(
        (entry: PlayTimestampEntry) => Number.isFinite(entry.timestamp) && entry.timestamp > 0
      );
  } catch {
    cloudEntries.value = [];
  }
});

const entries = computed<PlayTimestampEntry[]>(() => {
  const local = playHistoryStore.musicHistory
    .map((song: any) => ({ id: song.id, timestamp: Number(song.lastPlayedAt) }))
    .filter((entry) => Number.isFinite(entry.timestamp) && entry.timestamp > 0);
  // 云端合并去重：同 id 同一天只记一次（本地已有该次播放则跳过）
  const localKeys = new Set(local.map((entry) => `${entry.id}-${entry.timestamp}`));
  const merged = [
    ...local,
    ...cloudEntries.value.filter((entry) => !localKeys.has(`${entry.id}-${entry.timestamp}`))
  ];
  return merged;
});

const heatmap = computed(() => buildHeatmap(entries.value, Date.now(), HEATMAP_WEEKS));
const weeklyColumns = computed(() => {
  const columns: (typeof heatmap.value.cells)[] = [];
  for (let week = 0; week < heatmap.value.weeks; week++) {
    columns.push(heatmap.value.cells.slice(week * 7, week * 7 + 7));
  }
  return columns;
});
const peak = computed(() =>
  heatmap.value.cells.reduce((acc, cell) => Math.max(acc, cell.count), 0)
);
const total = computed(() => heatmap.value.total);
const activeDays = computed(() => heatmap.value.activeDays);
const ariaLabel = computed(() =>
  t('comp.homeSection.heatmapMeta', { total: total.value, days: activeDays.value })
);
</script>

<style lang="scss" scoped>
.listening-heatmap {
  margin: 4px 16px 18px;
  /* 无卡片底：直接落在页面上 */
}

.heatmap-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;

  h2 {
    font-size: 14px;
    font-weight: 700;
    color: var(--d-text-primary, rgba(0, 0, 0, 0.9));
  }

  .heatmap-total {
    font-size: 11px;
    color: var(--d-text-secondary, rgba(0, 0, 0, 0.55));
  }
}

.heatmap-grid {
  display: flex;
  gap: 3px;
  justify-content: space-between;

  /* 完整 16 周网格；列上限 18px，剩余空间均匀分到列间 → 左右边距对称 */
  .heatmap-column {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 0 1 18px;
    min-width: 0;
  }

  .heatmap-cell {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 3px;
    background: rgba(128, 128, 128, 0.14);
  }
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  font-size: 10px;
  color: var(--d-text-secondary, rgba(0, 0, 0, 0.45));

  .heatmap-cell {
    width: 9px;
    height: 9px;
  }
}
</style>
