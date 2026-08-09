<template>
  <span class="platform-logo" :style="logoStyle" :class="{ 'platform-logo--muted': muted }">
    <span v-if="assetUrl" class="platform-svg platform-svg--asset" />
    <svg v-else viewBox="0 0 24 24" class="platform-svg">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"
      />
    </svg>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import kugouLogo from '@/assets/platforms/kugou.svg?url';
import neteaseLogo from '@/assets/platforms/netease-music.svg?url';
import qqMusicLogo from '@/assets/platforms/qqmusic.svg?url';
import spotifyLogo from '@/assets/platforms/spotify.svg?url';

const props = withDefaults(
  defineProps<{
    platform: string;
    size?: number;
    color?: string;
    muted?: boolean;
  }>(),
  {
    size: 20,
    color: 'currentColor',
    muted: false
  }
);

const assets: Record<string, string> = {
  netease: neteaseLogo,
  qq: qqMusicLogo,
  kugou: kugouLogo,
  spotify: spotifyLogo
};
const assetUrl = computed(() => assets[props.platform]);
const logoStyle = computed(() => ({
  color: props.color,
  '--logo-size': `${props.size}px`,
  '--platform-mask': assetUrl.value ? `url("${assetUrl.value}")` : undefined
}));
</script>

<style scoped>
.platform-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--logo-size, 20px);
  height: var(--logo-size, 20px);
  transition:
    opacity 160ms ease,
    color 160ms ease,
    transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
}

.platform-svg {
  display: block;
  width: 100%;
  height: 100%;
}

.platform-svg--asset {
  background: currentColor;
  mask: var(--platform-mask) center / contain no-repeat;
  -webkit-mask: var(--platform-mask) center / contain no-repeat;
}

.platform-logo--muted {
  opacity: 0.4;
}

@media (prefers-reduced-motion: reduce) {
  .platform-logo {
    transition-duration: 0ms;
  }
}
</style>
