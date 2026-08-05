<template>
  <Teleport to="body">
    <Transition name="onboarding-fade">
      <div v-if="visible" class="fixed inset-0 z-[100000] flex items-center justify-center">
        <!-- 遮罩 -->
        <div class="absolute inset-0 bg-black/80 backdrop-blur-xl"></div>

        <!-- 内容 -->
        <div class="relative w-full max-w-sm mx-4">
          <!-- 滑动容器 -->
          <div
            class="overflow-hidden rounded-3xl"
            @touchstart.passive="onTouchStart"
            @touchmove.passive="onTouchMove"
            @touchend="onTouchEnd"
          >
            <div
              class="flex transition-transform duration-300 ease-out"
              :style="{ transform: `translateX(-${currentIndex * 100}%)` }"
            >
              <!-- Page 0: 搜索听歌 -->
              <div class="w-full flex-shrink-0 px-6 py-10 text-center">
                <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-[var(--accent-color)]/20 flex items-center justify-center">
                  <i class="ri-search-eye-line text-5xl text-[var(--accent-color)]"></i>
                </div>
                <h2 class="text-xl font-bold text-white mb-3">搜索即听</h2>
                <p class="text-sm text-white/50 leading-relaxed">
                  搜索歌曲名或歌手名，点击即可播放。支持网易云、QQ 音乐、酷狗多平台搜索。
                </p>
              </div>

              <!-- Page 1: 歌词与高潮效果 -->
              <div class="w-full flex-shrink-0 px-6 py-10 text-center">
                <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <i class="ri-fire-line text-5xl text-amber-400"></i>
                </div>
                <h2 class="text-xl font-bold text-white mb-3">歌词与高潮效果</h2>
                <p class="text-sm text-white/50 leading-relaxed">
                  6 种播放器样式随心切换。在设置中手动标记高潮段落，体验 CRT 狂热视觉特效。
                </p>
              </div>

              <!-- Page 2: 解锁密钥 -->
              <div class="w-full flex-shrink-0 px-6 py-10 text-center">
                <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <i class="ri-key-2-line text-5xl text-green-400"></i>
                </div>
                <h2 class="text-xl font-bold text-white mb-3">解锁 VIP 歌曲</h2>
                <p class="text-sm text-white/50 leading-relaxed">
                  在粉丝群获取口令，输入后即可播放 VIP 歌曲。口令仅用于歌曲播放，不会获取你的账号信息。
                </p>
              </div>
            </div>
          </div>

          <!-- 指示器 -->
          <div class="flex justify-center gap-2 mt-6">
            <div
              v-for="i in 3"
              :key="i"
              class="h-1.5 rounded-full transition-all duration-300"
              :class="currentIndex === i - 1 ? 'w-6 bg-[var(--accent-color)]' : 'w-1.5 bg-white/30'"
            ></div>
          </div>

          <!-- 按钮 -->
          <div class="flex items-center justify-between mt-6 px-2">
            <button
              @click="skip"
              class="text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              跳过
            </button>
            <button
              v-if="currentIndex < 2"
              @click="next"
              class="px-6 py-2.5 rounded-full text-sm font-medium bg-[var(--accent-color)] text-white active:scale-95 transition-transform"
            >
              下一步
            </button>
            <button
              v-else
              @click="finish"
              class="px-6 py-2.5 rounded-full text-sm font-medium bg-[var(--accent-color)] text-white active:scale-95 transition-transform"
            >
              开始体验
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const STORAGE_KEY = 'onboarding-completed';

const visible = ref(false);
const currentIndex = ref(0);

// 触摸滑动
let touchStartX = 0;

function show() {
  if (localStorage.getItem(STORAGE_KEY)) return;
  visible.value = true;
}

function next() {
  if (currentIndex.value < 2) currentIndex.value++;
}

function skip() {
  finish();
}

function finish() {
  localStorage.setItem(STORAGE_KEY, '1');
  visible.value = false;
}

function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX;
}

function onTouchMove() {
  // passive, do nothing
}

function onTouchEnd(e: TouchEvent) {
  const endX = e.changedTouches[0].clientX;
  const delta = endX - touchStartX;
  if (Math.abs(delta) > 50) {
    if (delta < 0 && currentIndex.value < 2) {
      currentIndex.value++;
    } else if (delta > 0 && currentIndex.value > 0) {
      currentIndex.value--;
    }
  }
}

defineExpose({ show });
</script>

<style scoped>
.onboarding-fade-enter-active,
.onboarding-fade-leave-active {
  transition: opacity 0.4s ease;
}

.onboarding-fade-enter-from,
.onboarding-fade-leave-to {
  opacity: 0;
}
</style>
