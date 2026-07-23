<template>
  <Teleport to="body">
    <Transition name="welcome-fade">
      <div
        v-if="showDrawer"
        class="fixed inset-0 z-[999999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
        @click.self="remindLater"
      >
        <div
          class="w-full max-w-sm bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col"
        >
          <!-- 顶部渐变条 -->
          <div class="h-1.5 bg-gradient-to-r from-[var(--accent-color)] via-purple-500 to-blue-500"></div>

          <!-- 内容区 -->
          <div class="px-6 py-8 flex flex-col items-center text-center">
            <!-- 图标 -->
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent-color)] to-purple-600 flex items-center justify-center mb-5 shadow-lg">
              <i class="ri-music-2-fill text-3xl text-white"></i>
            </div>

            <!-- 标题 -->
            <h2 class="text-xl font-bold text-white mb-2">感谢使用 Zephyrus Player</h2>
            <p class="text-sm text-white/50 leading-relaxed mb-6">
              本项目基于
              <span class="text-[var(--accent-color)] font-medium">AlgerMusicPlayer</span>
              深度二次开发<br />
              在支持本项目的同时，给 Alger 老师的原项目一个 Star 吧
            </p>

            <!-- 按钮区（竖向排列） -->
            <div class="w-full space-y-3">
              <!-- 前往本项目 -->
              <a
                href="https://github.com/cang-dot/zephyrus-player-android"
                target="_blank"
                class="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-color)] to-[var(--accent-color-dark)] hover:brightness-110 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-[var(--accent-color)]/25"
              >
                <i class="ri-github-fill text-lg"></i>
                前往本项目 GitHub
              </a>

              <!-- 前往原项目 -->
              <a
                href="https://github.com/algerkong/AlgerMusicPlayer"
                target="_blank"
                class="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-medium text-white/80 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all duration-200 border border-white/10"
              >
                <i class="ri-github-fill text-lg"></i>
                前往 AlgerMusicPlayer 的 GitHub
              </a>

              <!-- 下次一定 -->
              <button
                @click="remindLater"
                class="w-full py-2.5 rounded-2xl text-sm font-medium text-white/40 hover:text-white/70 transition-colors"
              >
                下次一定
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const showDrawer = ref(false);

const remindLater = () => {
  const now = new Date();
  localStorage.setItem('trafficDonated4RemindLater', now.toISOString());
  showDrawer.value = false;
};

onMounted(() => {
  if (localStorage.getItem('trafficDonated4Never')) return;

  const remindLaterTime = localStorage.getItem('trafficDonated4RemindLater');
  if (remindLaterTime) {
    const lastRemind = new Date(remindLaterTime);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastRemind.getTime()) / (1000 * 60 * 60);
    if (hoursDiff < 24) return;
  }

  setTimeout(() => {
    showDrawer.value = true;
  }, 20000);
});
</script>

<style scoped>
.welcome-fade-enter-active,
.welcome-fade-leave-active {
  transition: opacity 0.3s ease;
}

.welcome-fade-enter-from,
.welcome-fade-leave-to {
  opacity: 0;
}
</style>
