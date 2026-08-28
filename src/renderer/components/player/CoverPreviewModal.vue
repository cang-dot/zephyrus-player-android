<template>
  <Teleport to="body">
    <Transition name="cover-preview-fade">
      <div
        v-if="visible"
        class="cover-preview-modal"
        role="dialog"
        aria-modal="true"
        @click="close"
      >
        <div class="preview-body" @click.stop>
          <img :src="src" alt="" decoding="async" @load="loaded = true" @error="failed = true" />
          <p v-if="!loaded && !failed">加载中…</p>
          <p v-if="failed">封面加载失败</p>
        </div>

        <div class="preview-actions" @click.stop>
          <button type="button" :disabled="saving || failed" @click="save">
            <i class="ri-save-line"></i>
            {{ saving ? '保存中' : '保存封面' }}
          </button>
          <button type="button" class="secondary" @click="close">
            <i class="ri-close-line"></i>
            关闭
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { downloadBlob } from '@/utils/shareUtil';
import { showBottomToast } from '@/utils/shortcutToast';

const props = withDefaults(defineProps<{ visible: boolean; src: string; title?: string }>(), {
  title: ''
});
const emit = defineEmits<{ (event: 'update:visible', value: boolean): void }>();

const saving = ref(false);
const loaded = ref(false);
const failed = ref(false);
const safeName = computed(() => {
  const name = props.title.replace(/[\\/:*?"<>|]/g, '_').trim();
  return `zephyrus_cover_${name || Date.now()}.jpg`;
});

watch(
  () => [props.visible, props.src] as const,
  ([visible]) => {
    loaded.value = false;
    failed.value = false;
    if (!visible) saving.value = false;
  }
);

function close() {
  emit('update:visible', false);
}

async function save() {
  if (!props.src || saving.value) return;
  saving.value = true;
  try {
    const response = await fetch(props.src, { credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const saved = await saveImageBlob(blob, safeName.value);
    showBottomToast(saved ? '封面已保存' : '保存失败');
  } catch {
    failed.value = true;
    showBottomToast('保存失败');
  } finally {
    saving.value = false;
  }
}

async function saveImageBlob(blob: Blob, filename: string): Promise<boolean> {
  const nativeBridge = (window as any).AndroidNative;
  if (nativeBridge?.saveBase64ImageToGallery) {
    const dataUrl = await blobToDataUrl(blob);
    if (nativeBridge.saveBase64ImageToGallery(dataUrl, filename) === true) return true;
  }

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const base64 = (await blobToDataUrl(blob)).split(',')[1] || '';
    await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
    nativeBridge?.scanMediaFile?.(filename);
    return true;
  } catch {
    return downloadBlob(blob);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
</script>

<style scoped>
.cover-preview-modal {
  position: fixed;
  inset: 0;
  z-index: 10000000;
  display: grid;
  place-items: center;
  gap: 20px;
  align-content: center;
  padding: max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom));
  background: rgba(0, 0, 0, 0.9);
}

.preview-body {
  display: grid;
  min-height: 160px;
  max-width: min(92vw, 720px);
  color: #fff;
  text-align: center;
}

.preview-body img {
  width: 100%;
  border-radius: 18px;
  object-fit: contain;
}

.preview-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.preview-actions button,
.preview-actions button.secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 20px;
  border: 0;
  border-radius: 999px;
  font-size: 15px;
  color: #111;
  background: #fff;
}

.preview-actions button.secondary {
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
}

.preview-actions button:disabled {
  opacity: 0.55;
}

.cover-preview-fade-enter-active,
.cover-preview-fade-leave-active {
  transition: opacity 0.2s ease;
}

.cover-preview-fade-enter-from,
.cover-preview-fade-leave-to {
  opacity: 0;
}
</style>
