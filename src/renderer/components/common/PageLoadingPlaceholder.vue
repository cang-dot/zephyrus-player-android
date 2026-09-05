<template>
  <section
    class="page-loading-placeholder"
    :class="`page-loading-placeholder--${variant}`"
    role="status"
    aria-live="polite"
  >
    <span class="loading-label">{{ label }}</span>

    <template v-if="variant === 'user'">
      <div class="loading-profile loading-glass">
        <div class="loading-profile-main">
          <span class="loading-shape loading-avatar" />
          <div class="loading-copy">
            <span class="loading-shape loading-line loading-line--name" />
            <span class="loading-shape loading-line loading-line--secondary" />
            <span class="loading-shape loading-chip" />
          </div>
        </div>
        <div class="loading-stat-grid">
          <div v-for="index in 4" :key="`stat-${index}`" class="loading-stat">
            <span class="loading-shape loading-stat-value" />
            <span class="loading-shape loading-stat-label" />
          </div>
        </div>
      </div>

      <div class="loading-ranking loading-glass">
        <span class="loading-shape loading-section-title" />
        <div
          v-for="index in 5"
          :key="`ranking-${index}`"
          class="loading-row"
          :style="delayStyle(index + 2)"
        >
          <span class="loading-rank">{{ index }}</span>
          <span class="loading-shape loading-cover" />
          <span class="loading-copy">
            <i class="loading-shape loading-line" />
            <i class="loading-shape loading-line loading-line--short" />
          </span>
          <span class="loading-shape loading-dot" />
        </div>
      </div>
    </template>

    <template v-else>
      <!-- 音乐列表/歌手:现版本顶栏由全局胶囊承担,页面直接从列表开始 -->
      <div class="loading-list">
        <div v-for="index in rows" :key="index" class="loading-row" :style="delayStyle(index)">
          <span class="loading-index">{{ String(index).padStart(2, '0') }}</span>
          <span class="loading-shape loading-cover" />
          <span class="loading-copy">
            <i
              class="loading-shape loading-line"
              :class="{ 'loading-line--wide': index % 3 === 1 }"
            />
            <i class="loading-shape loading-line loading-line--short" />
          </span>
          <span class="loading-shape loading-dot" />
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant: 'music-list' | 'artist' | 'user';
    rows?: number;
    label?: string;
  }>(),
  {
    rows: 8,
    label: 'Loading'
  }
);

const delayStyle = (index: number) => ({ '--loading-index': index }) as Record<string, number>;
</script>

<style scoped lang="scss">
.page-loading-placeholder {
  --loading-tint: color-mix(in srgb, var(--accent-color, #888) 12%, transparent);
  --loading-base: color-mix(
    in srgb,
    var(--cover-surface-alt, rgba(128, 128, 128, 0.1)) 84%,
    var(--loading-tint)
  );
  --loading-highlight: color-mix(in srgb, var(--m-white, #fff) 34%, transparent);
  display: grid;
  width: 100%;
  gap: 14px;
  padding: 12px 16px 28px;
}

.loading-label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.loading-glass {
  border: 1px solid
    color-mix(in srgb, var(--cover-border, rgba(255, 255, 255, 0.2)) 78%, transparent);
  background: color-mix(
    in srgb,
    var(--m-glass-bg, rgba(255, 255, 255, 0.46)) 88%,
    var(--loading-tint)
  );
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--m-white, #fff) 22%, transparent),
    0 14px 34px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(24px) saturate(155%);
  -webkit-backdrop-filter: blur(24px) saturate(155%);
}

.loading-shape {
  position: relative;
  display: block;
  overflow: hidden;
  background: var(--loading-base);

  &::after {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      transparent 24%,
      var(--loading-highlight) 46%,
      transparent 68%
    );
    content: '';
    transform: translate3d(-115%, 0, 0);
    animation: loading-sheen 1.65s cubic-bezier(0.32, 0.72, 0, 1) infinite;
  }
}

.loading-copy {
  display: grid;
  min-width: 0;
  flex: 1;
  align-content: center;
  gap: 8px;
}

.loading-line {
  width: 58%;
  height: 12px;
  border-radius: 6px;
}

.loading-line--wide {
  width: 76%;
}

.loading-line--short {
  width: 38%;
  height: 9px;
  opacity: 0.78;
}

.loading-line--secondary {
  width: min(74%, 220px);
  height: 10px;
  border-radius: 5px;
  opacity: 0.72;
}

.loading-list,
.loading-ranking {
  display: grid;
  gap: 2px;
}

.loading-row {
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 12px;
  padding: 8px 4px;
  opacity: 0;
  transform: translate3d(0, 8px, 0);
  animation: loading-row-arrive 480ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
  animation-delay: calc(min(var(--loading-index, 0), 7) * 38ms);
}

.loading-index,
.loading-rank {
  width: 22px;
  flex: 0 0 22px;
  color: color-mix(in srgb, var(--cover-text-muted, #888) 52%, transparent);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.loading-cover {
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  border-radius: 13px;
}

.loading-dot {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  border-radius: 50%;
  opacity: 0.68;
}





.loading-profile {
  display: grid;
  gap: 18px;
  padding: 18px;
  border-radius: 26px;
}

.loading-profile-main {
  display: flex;
  align-items: center;
  gap: 14px;
}

.loading-avatar {
  width: 68px;
  height: 68px;
  flex: 0 0 68px;
  border-radius: 50%;
}

.loading-line--name {
  width: min(56%, 160px);
  height: 20px;
  border-radius: 9px;
}

.loading-chip {
  width: 64px;
  height: 20px;
  border-radius: 10px;
}

.loading-stat-grid {
  display: flex;
  justify-content: space-between;
  padding: 0 6px;
}

.loading-stat {
  display: grid;
  justify-items: center;
  gap: 7px;
}

.loading-stat-value {
  width: 34px;
  height: 18px;
  border-radius: 8px;
}

.loading-stat-label {
  width: 46px;
  height: 8px;
  border-radius: 4px;
  opacity: 0.68;
}





.loading-ranking {
  padding: 18px 14px 10px;
  border-radius: 26px;
}

.loading-section-title {
  width: 96px;
  height: 20px;
  margin: 0 4px 8px;
  border-radius: 9px;
}

@keyframes loading-sheen {
  55%,
  100% {
    transform: translate3d(115%, 0, 0);
  }
}

@keyframes loading-row-arrive {
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@media (min-width: 768px) {
  .page-loading-placeholder {
    max-width: 960px;
    margin-inline: auto;
    padding-inline: 32px;
  }

  .loading-row {
    min-height: 70px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-shape::after {
    display: none;
  }

  .loading-row {
    opacity: 1;
    transform: none;
    animation: none;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .loading-glass {
    background: var(--cover-surface, var(--m-bg, #fff));
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
