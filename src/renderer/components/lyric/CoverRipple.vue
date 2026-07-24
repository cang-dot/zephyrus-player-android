<template>
  <div
    class="cover-ripple"
    :style="containerStyle"
  >
    <!-- 封面图片 -->
    <div class="cover-image" :style="imageStyle">
      <img v-if="src" :src="src" alt="cover" />
      <div v-else class="cover-placeholder">
        <i class="ri-music-2-line"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * CoverRipple - 封面显示组件（简化版，无涟漪效果）
 * 
 * 功能：
 * - 显示歌曲封面（圆角方形）
 */
interface Props {
  src?: string;
  size?: number;
  borderRadius?: number;
}

const props = withDefaults(defineProps<Props>(), {
  size: 280,
  borderRadius: 24
});

const containerStyle = {
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: `${props.borderRadius}px`
};

const imageStyle = {
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: `${props.borderRadius}px`
};
</script>

<style scoped>
.cover-ripple {
  position: relative;
  overflow: hidden;
  box-shadow: 
    0 0 60px rgba(0, 0, 0, 0.5),
    0 0 100px rgba(255, 255, 255, 0.1),
    inset 0 0 60px rgba(0, 0, 0, 0.3);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.cover-ripple:hover {
  transform: scale(1.02);
  box-shadow: 
    0 0 80px rgba(0, 0, 0, 0.6),
    0 0 120px rgba(255, 255, 255, 0.15),
    inset 0 0 60px rgba(0, 0, 0, 0.3);
}

.cover-image {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.cover-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.cover-placeholder i {
  font-size: 64px;
  color: rgba(255, 255, 255, 0.3);
}
</style>
