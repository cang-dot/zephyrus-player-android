<template>
  <div class="credit-settings">
    <label class="credit-toggle">
      <span>{{ t('settings.lyricSettings.hideIntroOutroCredits') }}</span>
      <input type="checkbox" :checked="lyricCreditConfig.hideIntroOutroCredits" @change="toggle" />
    </label>
    <p>{{ t('settings.lyricSettings.creditDescription') }}</p>
    <label class="credit-editor">
      <span>{{ t('settings.lyricSettings.creditKeywords') }}</span>
      <textarea v-model="draft" rows="6" spellcheck="false" />
    </label>
    <p>{{ t('settings.lyricSettings.creditKeywordsHelp') }}</p>
    <div class="credit-actions">
      <button type="button" :disabled="!dirty" @click="save">
        {{ t('settings.lyricSettings.saveCreditKeywords') }}
      </button>
      <button type="button" @click="restore">
        {{ t('settings.lyricSettings.restoreCreditKeywords') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { lyricCreditConfig, saveLyricCreditConfig } from '@/services/lyricCreditConfig';
import { cleanCreditKeywords, DEFAULT_LYRIC_CREDIT_KEYWORDS } from '@/utils/lyricCredits';

const { t } = useI18n();
const savedText = computed(() => lyricCreditConfig.value.lyricCreditKeywords.join('\n'));
const draft = ref(savedText.value);
watch(savedText, (value) => {
  draft.value = value;
});
const dirty = computed(() => draft.value !== savedText.value);
function toggle(event: Event) {
  saveLyricCreditConfig({ hideIntroOutroCredits: (event.target as HTMLInputElement).checked });
}
function save() {
  saveLyricCreditConfig({ lyricCreditKeywords: cleanCreditKeywords(draft.value.split(/\r?\n/u)) });
  draft.value = savedText.value;
}
function restore() {
  saveLyricCreditConfig({ lyricCreditKeywords: [...DEFAULT_LYRIC_CREDIT_KEYWORDS] });
  draft.value = savedText.value;
}
</script>

<style scoped>
.credit-settings {
  padding: 12px;
  border-radius: 16px;
  background: rgb(127 127 127 / 7%);
}
.credit-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 14px;
}
.credit-toggle input {
  width: 20px;
  height: 20px;
  accent-color: var(--primary-color, #7b9cff);
  cursor: pointer;
}
p {
  font-size: 12px;
  opacity: 0.65;
  margin: 8px 0 12px;
  line-height: 1.6;
}
.credit-editor {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 100px;
  max-height: 320px;
  padding: 10px;
  border: 1px solid rgb(127 127 127 / 30%);
  border-radius: 10px;
  background: rgb(127 127 127 / 8%);
  color: inherit;
  font: inherit;
  line-height: 1.6;
}
.credit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
button {
  padding: 8px 12px;
  border-radius: 10px;
  background: rgb(127 127 127 / 15%);
  font: inherit;
  font-size: 12px;
}
button:disabled {
  opacity: 0.4;
}
</style>
