<template>
  <span
    class="platform-logo"
    :style="{ color, '--logo-size': `${size}px` }"
    :class="{ 'platform-logo--muted': muted }"
  >
    <!-- 网易云音乐 -->
    <svg v-if="platform === 'netease'" viewBox="0 0 24 24" class="platform-svg">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.5 14.5c-2.5 0-4.5-2-4.5-4.5 0-2.2 1.5-3.8 3.5-4.2.3-.6.9-1 1.6-1 .9 0 1.6.6 1.8 1.4 1.8.6 3.1 2.2 3.1 4.2 0 2.3-1.8 4.1-4 4.1zm5.5-7c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5zm-5.5 4c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5-.7-1.5-1.5-1.5z"
      />
    </svg>

    <!-- QQ 音乐 -->
    <svg v-else-if="platform === 'qq'" viewBox="0 0 24 24" class="platform-svg">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.5 13.5c-.3.8-1 1.5-1.8 1.8-.4.2-.8.2-1.2.2-.4 0-.8-.1-1.2-.3-.3-.1-.6-.3-.8-.5-.4.3-.9.5-1.5.5-.5 0-1-.2-1.4-.5-.3.2-.5.4-.8.5-.4.2-.8.3-1.2.3-.4 0-.8 0-1.2-.2-.8-.3-1.5-1-1.8-1.8-.2-.5-.2-1 0-1.5.2-.4.5-.7.9-.9-.2-.5-.3-1-.3-1.6 0-2.2 1.8-4 4-4s4 1.8 4 4c0 .6-.1 1.1-.3 1.6.4.2.7.5.9.9.2.5.2 1 0 1.5zM12 9c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
      />
    </svg>

    <!-- 酷狗音乐 -->
    <svg v-else-if="platform === 'kugou'" viewBox="0 0 24 24" class="platform-svg">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.5 12.5c-.3.5-.8.8-1.3 1-.3.1-.6.2-.9.2-.3 0-.6-.1-.9-.2-.2.3-.5.5-.8.7-.4.2-.8.3-1.2.3s-.8-.1-1.2-.3c-.3-.2-.6-.4-.8-.7-.3.1-.6.2-.9.2-.3 0-.6-.1-.9-.2-.5-.2-1-.5-1.3-1-.3-.5-.3-1 0-1.5.2-.3.4-.5.7-.7-.2-.4-.3-.8-.3-1.3 0-1.7 1.3-3 3-3s3 1.3 3 3c0 .5-.1.9-.3 1.3.3.2.5.4.7.7.3.5.3 1 0 1.5zM10 10.5c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5-.7-1.5-1.5-1.5z"
      />
    </svg>

    <svg v-else-if="platform === 'kuwo'" viewBox="0 0 24 24" class="platform-svg">
      <path
        fill="currentColor"
        d="M4 3h3.2v7.1L13.4 3h4l-7 8 7.6 10h-4.1l-5.7-7.7-1 1.1V21H4V3zm14.1 9.1a2.9 2.9 0 1 1 0 5.8 2.9 2.9 0 0 1 0-5.8z"
      />
    </svg>

    <svg v-else-if="platform === 'migu'" viewBox="0 0 24 24" class="platform-svg">
      <path
        fill="currentColor"
        d="M4 19V7.3C4 5.5 5.3 4 7.1 4c1.1 0 2.1.6 2.7 1.5L12 9l2.2-3.5A3.2 3.2 0 0 1 20 7.3V19h-3.2V8.5c0-.4-.5-.5-.7-.2L12 14.7 7.9 8.3c-.2-.3-.7-.2-.7.2V19H4z"
      />
    </svg>

    <svg v-else-if="platform === 'spotify'" viewBox="0 0 24 24" class="platform-svg">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.54 14.42a.7.7 0 0 1-.96.23c-2.64-1.61-5.96-1.98-9.87-1.08a.7.7 0 1 1-.31-1.36c4.28-.98 7.95-.56 10.91 1.25.33.2.43.63.23.96Zm1.3-2.89a.88.88 0 0 1-1.2.29c-3.02-1.86-7.63-2.4-11.2-1.31a.88.88 0 1 1-.51-1.68c4.08-1.24 9.16-.64 12.62 1.49.41.25.54.79.29 1.21Zm.12-3.01C14.34 8.45 8.66 8.27 5.35 9.28a1.05 1.05 0 1 1-.61-2c3.8-1.15 10.13-.92 13.97 1.36a1.05 1.05 0 0 1-.75 1.88Z"
      />
    </svg>

    <!-- 默认 -->
    <svg v-else viewBox="0 0 24 24" class="platform-svg">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"
      />
    </svg>
  </span>
</template>

<script setup lang="ts">
withDefaults(
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
  width: 100%;
  height: 100%;
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
