<template>
  <div class="h-full w-full page-bg transition-colors duration-500">
    <div class="pe-scroll" style="padding-top: var(--mobile-topbar-inset)">
      <!-- 头像 -->
      <section class="pe-card">
        <div class="pe-avatar-row">
          <div class="pe-avatar-wrap" role="button" tabindex="0" @click="pickAvatar">
            <img
              v-if="previewAvatarUrl"
              :src="getImgUrl(previewAvatarUrl)"
              referrerpolicy="no-referrer"
              :alt="t('user.profileEdit.avatar')"
            />
            <span v-else class="pe-avatar-placeholder"><i class="ri-user-3-line" /></span>
            <span class="pe-avatar-camera"><i class="ri-camera-line" /></span>
          </div>
          <div class="pe-avatar-copy">
            <strong>{{ t('user.profileEdit.avatar') }}</strong>
            <small>{{ t('user.profileEdit.avatarHint') }}</small>
          </div>
          <button
            v-if="localProfileStore.profile.avatarUrl"
            type="button"
            class="pe-avatar-reset"
            @click="resetAvatar"
          >
            {{ t('user.profileEdit.resetAvatar') }}
          </button>
        </div>
        <input ref="avatarInputRef" type="file" accept="image/*" hidden @change="onAvatarChange" />
      </section>

      <!-- 资料表单 -->
      <section class="pe-card">
        <div class="pe-row">
          <label>{{ t('user.profileEdit.nickname') }}</label>
          <n-input
            v-model:value="draft.nickname"
            class="pe-input"
            :placeholder="baseNickname || t('user.profileEdit.emptyPlaceholder')"
            :maxlength="30"
          />
        </div>
        <div class="pe-row">
          <label>{{ t('user.profileEdit.signature') }}</label>
          <n-input
            v-model:value="draft.signature"
            class="pe-input"
            type="textarea"
            :rows="2"
            :placeholder="baseSignature || t('user.profileEdit.emptyPlaceholder')"
            :maxlength="254"
          />
        </div>
        <div class="pe-row">
          <label>{{ t('user.profileEdit.gender') }}</label>
          <div class="pe-gender-seg" role="radiogroup">
            <button
              v-for="option in genderOptions"
              :key="option.value"
              type="button"
              :class="{ active: draft.gender === option.value }"
              @click="draft.gender = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <div class="pe-row">
          <label>{{ t('user.profileEdit.birthday') }}</label>
          <n-date-picker
            v-model:value="draft.birthday"
            class="pe-input"
            type="date"
            clearable
            :default-time="'00:00:00'"
            :is-date-disabled="blockFutureDates"
          />
        </div>
        <div class="pe-row">
          <label>{{ t('user.profileEdit.region') }}</label>
          <n-input
            v-model:value="draft.region"
            class="pe-input"
            :placeholder="t('user.profileEdit.regionPlaceholder')"
            :maxlength="30"
          />
        </div>
      </section>

      <!-- 导入 / 账号管理 -->
      <section class="pe-card pe-nav-card">
        <button type="button" class="pe-nav-row" @click="openImportSource">
          <i class="ri-download-cloud-2-line" />
          <span>{{ t('user.profileEdit.importTitle') }}</span>
          <i class="ri-arrow-right-s-line pe-nav-arrow" />
        </button>
        <button type="button" class="pe-nav-row" @click="goAccounts">
          <i class="ri-user-settings-line" />
          <span>{{ t('user.accounts.title') }}</span>
          <i class="ri-arrow-right-s-line pe-nav-arrow" />
        </button>
      </section>

      <p class="pe-hint">{{ t('user.profileEdit.localOnlyHint') }}</p>

      <!-- 双保存按钮 -->
      <div class="pe-save-bar">
        <button type="button" class="pe-save-offline" @click="saveOffline">
          {{ t('user.profileEdit.saveOffline') }}
        </button>
        <button
          type="button"
          class="pe-save-sync"
          :disabled="syncing || !hasSyncableAccount"
          @click="openSyncSheet"
        >
          {{ syncing ? t('user.profileEdit.syncing') : t('user.profileEdit.saveSync') }}
        </button>
      </div>

      <div class="pe-bottom-spacer" />
    </div>

    <!-- 底部菜单：同步多选 / 导入两级选择 -->
    <Teleport to="body">
      <Transition name="pe-fade">
        <div v-if="sheetMode" class="pe-overlay" @click="closeSheet" />
      </Transition>
      <Transition name="pe-rise">
        <div v-if="sheetMode" class="pe-sheet" role="dialog">
          <!-- 同步：账号多选 -->
          <template v-if="sheetMode === 'sync'">
            <p class="pe-sheet-title">{{ t('user.profileEdit.syncTitle') }}</p>
            <button
              v-for="item in syncItems"
              :key="item.account.accountId"
              type="button"
              class="pe-sheet-row"
              :class="{ disabled: !item.supported }"
              :disabled="!item.supported"
              @click="toggleSyncSelection(item)"
            >
              <span
                class="pe-check"
                :class="{ checked: selectedSyncIds.has(item.account.accountId) }"
              >
                <i v-if="selectedSyncIds.has(item.account.accountId)" class="ri-check-line" />
              </span>
              <img
                v-if="item.account.avatarUrl"
                class="pe-row-avatar"
                :src="getImgUrl(item.account.avatarUrl, '72y72')"
                referrerpolicy="no-referrer"
                alt=""
              />
              <span v-else class="pe-row-avatar pe-avatar-placeholder"
                ><i class="ri-user-3-line"
              /></span>
              <span class="pe-row-copy">
                <strong>{{ item.account.nickname }}</strong>
                <small>{{ item.reason || t('user.profileEdit.syncFieldsHint') }}</small>
              </span>
            </button>
            <p class="pe-sheet-footnote">{{ t('user.profileEdit.syncFootnote') }}</p>
            <div class="pe-sheet-actions">
              <button type="button" class="pe-sheet-cancel" @click="closeSheet">
                {{ t('common.cancel') }}
              </button>
              <button
                type="button"
                class="pe-sheet-confirm"
                :disabled="!selectedSyncIds.size"
                @click="confirmSync"
              >
                {{ t('common.confirm') }}
              </button>
            </div>
          </template>

          <!-- 导入：第一级选账号 -->
          <template v-else-if="sheetMode === 'import-source'">
            <p class="pe-sheet-title">{{ t('user.profileEdit.importSourceTitle') }}</p>
            <button
              v-for="account in accounts"
              :key="account.accountId"
              type="button"
              class="pe-sheet-row"
              @click="selectImportSource(account)"
            >
              <img
                v-if="account.avatarUrl"
                class="pe-row-avatar"
                :src="getImgUrl(account.avatarUrl, '72y72')"
                referrerpolicy="no-referrer"
                alt=""
              />
              <span v-else class="pe-row-avatar pe-avatar-placeholder"
                ><i class="ri-user-3-line"
              /></span>
              <span class="pe-row-copy">
                <strong>{{ account.nickname }}</strong>
                <small>{{ platformDisplayName(account.platform) }}</small>
              </span>
              <i class="ri-arrow-right-s-line pe-nav-arrow" />
            </button>
          </template>

          <!-- 导入：第二级选字段 -->
          <template v-else>
            <p class="pe-sheet-title">{{ t('user.profileEdit.importFieldTitle') }}</p>
            <button
              v-for="field in importFields"
              :key="field.key"
              type="button"
              class="pe-sheet-row"
              @click="applyImportField(field)"
            >
              <span class="pe-row-copy">
                <strong>{{ field.label }}</strong>
                <small>{{ field.preview }}</small>
              </span>
              <i class="ri-check-line pe-import-check" />
            </button>
          </template>
          <div class="pe-sheet-pad" aria-hidden="true" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { updateUserProfile } from '@/api/user';
import { registerMobileBackLayer } from '@/services/mobileBackStack';
import {
  type LocalProfile,
  platformDisplayName,
  useLocalProfileStore
} from '@/store/modules/localProfile';
import { type PlatformAccount, usePlatformAccountsStore } from '@/store/modules/platformAccounts';
import { useUserStore } from '@/store/modules/user';
import { getImgUrl } from '@/utils';

defineOptions({ name: 'UserProfileEdit' });

const { t } = useI18n();
const router = useRouter();
const message = useMessage();

const userStore = useUserStore();
const accountStore = usePlatformAccountsStore();
const localProfileStore = useLocalProfileStore();
const { accounts, activeAccountId } = storeToRefs(accountStore);
const { userDetail } = storeToRefs(userStore);

type SheetMode = 'sync' | 'import-source' | 'import-field' | null;
const sheetMode = ref<SheetMode>(null);
const syncing = ref(false);
const avatarInputRef = ref<HTMLInputElement | null>(null);
const selectedSyncIds = ref<Set<string>>(new Set());
const importSource = ref<PlatformAccount | null>(null);
let backDisposer: (() => void) | null = null;

// 平台原始资料（未覆盖时的显示值）
const baseNickname = computed(
  () => localProfileStore.displayNickname || userStore.user?.nickname || ''
);
const baseSignature = computed(() => userDetail.value?.profile?.signature || '');
const baseAvatarUrl = computed(
  () => localProfileStore.displayAvatarUrl || userStore.user?.avatarUrl || ''
);

// draft 初始化为当前显示值；keepAlive:false 每次进入重建
const draft = reactive({
  nickname: localProfileStore.profile.nickname,
  signature: localProfileStore.profile.signature,
  avatarUrl: localProfileStore.profile.avatarUrl,
  gender: localProfileStore.profile.gender ?? userDetail.value?.profile?.gender ?? 0,
  birthday: localProfileStore.profile.birthday,
  region: localProfileStore.profile.region
});

const previewAvatarUrl = computed(() => draft.avatarUrl || baseAvatarUrl.value);

const genderOptions = computed(() => [
  { value: 0, label: t('user.profileEdit.genderSecret') },
  { value: 1, label: t('user.profileEdit.genderMale') },
  { value: 2, label: t('user.profileEdit.genderFemale') }
]);

const blockFutureDates = (current: number) => current > Date.now();

// ---------- 头像 ----------
const pickAvatar = () => avatarInputRef.value?.click();

/** 中心正方形裁剪 + 压成 ≤512px 的 jpeg data URL（仅存离线，体积可控） */
async function squareCropAvatarFile(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('image load failed'));
      element.src = objectUrl;
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const size = Math.min(side, 512);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas unavailable');
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size
    );
    return canvas.toDataURL('image/jpeg', 0.88);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const onAvatarChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    draft.avatarUrl = await squareCropAvatarFile(file);
  } catch {
    message.error(t('user.profileEdit.avatarFailed'));
  }
};

const resetAvatar = () => {
  draft.avatarUrl = '';
  localProfileStore.saveProfile({ avatarUrl: '' });
};

// ---------- 保存 ----------
const saveOffline = () => {
  localProfileStore.saveProfile({
    nickname: draft.nickname.trim(),
    signature: draft.signature.trim(),
    avatarUrl: draft.avatarUrl,
    gender: draft.gender,
    birthday: draft.birthday,
    region: draft.region.trim()
  } satisfies Partial<LocalProfile>);
  message.success(t('user.profileEdit.saveOfflineOk'));
};

// ---------- 同步 ----------
const syncItems = computed(() =>
  accounts.value.map((account) => ({
    account,
    supported: account.platform === 'netease' && Boolean(account.cookie),
    reason:
      account.platform !== 'netease'
        ? t('user.profileEdit.unsupportedPlatform')
        : account.cookie
          ? ''
          : t('user.profileEdit.unsupportedLogin')
  }))
);
const hasSyncableAccount = computed(() => syncItems.value.some((item) => item.supported));

const openSyncSheet = () => {
  if (!draft.nickname.trim() && !draft.signature.trim()) {
    message.warning(t('user.profileEdit.syncEmpty'));
    return;
  }
  selectedSyncIds.value = new Set(
    syncItems.value.filter((item) => item.supported).map((item) => item.account.accountId)
  );
  openSheet('sync');
};

const toggleSyncSelection = (item: { account: PlatformAccount; supported: boolean }) => {
  if (!item.supported) return;
  const next = new Set(selectedSyncIds.value);
  if (next.has(item.account.accountId)) {
    next.delete(item.account.accountId);
  } else {
    next.add(item.account.accountId);
  }
  selectedSyncIds.value = next;
};

const confirmSync = async () => {
  const targetIds = [...selectedSyncIds.value];
  if (!targetIds.length) return;
  const payload: { nickname?: string; signature?: string } = {};
  const nickname = draft.nickname.trim();
  const signature = draft.signature.trim();
  if (nickname) payload.nickname = nickname;
  if (signature) payload.signature = signature;

  syncing.value = true;
  closeSheet();
  let okCount = 0;
  const failedNames: string[] = [];
  for (const id of targetIds) {
    const account = accounts.value.find((item) => item.accountId === id);
    if (!account) continue;
    try {
      await updateUserProfile(payload, account.cookie);
      if (payload.nickname) accountStore.renameAccount(id, payload.nickname);
      if (id === activeAccountId.value && account.platform === 'netease') {
        userStore.setUser({
          userId: Number(account.userId) || 0,
          nickname: payload.nickname || account.nickname,
          avatarUrl: account.avatarUrl,
          vipType: account.vip ? 11 : 0
        });
        if (userDetail.value?.profile && payload.signature !== undefined) {
          userDetail.value.profile.signature = payload.signature;
        }
      }
      okCount += 1;
    } catch {
      failedNames.push(account.nickname);
    }
  }
  syncing.value = false;
  if (okCount && failedNames.length) {
    message.warning(t('user.profileEdit.syncPartial', { ok: okCount, fail: failedNames.length }));
  } else if (okCount) {
    message.success(t('user.profileEdit.syncOk'));
  } else {
    message.error(t('user.profileEdit.syncFail'));
  }
};

// ---------- 从平台导入 ----------
type ImportField = { key: 'nickname' | 'signature' | 'avatarUrl'; label: string; value: string };

const openImportSource = () => {
  if (!accounts.value.length) {
    message.warning(t('user.profileEdit.importEmpty'));
    return;
  }
  openSheet('import-source');
};

const selectImportSource = (account: PlatformAccount) => {
  importSource.value = account;
  openSheet('import-field');
};

const importFields = computed<(ImportField & { preview: string })[]>(() => {
  const source = importSource.value;
  if (!source) return [];
  const fields: ImportField[] = [
    { key: 'nickname', label: t('user.profileEdit.fieldNickname'), value: source.nickname },
    { key: 'avatarUrl', label: t('user.profileEdit.fieldAvatar'), value: source.avatarUrl }
  ];
  if (
    source.accountId === activeAccountId.value &&
    source.platform === 'netease' &&
    baseSignature.value
  ) {
    fields.push({
      key: 'signature',
      label: t('user.profileEdit.fieldSignature'),
      value: baseSignature.value
    });
  }
  return fields.map((field) => ({
    ...field,
    preview: field.value
      ? field.value.length > 24
        ? `${field.value.slice(0, 24)}…`
        : field.value
      : '—'
  }));
});

const applyImportField = (field: ImportField & { preview: string }) => {
  if (field.key === 'nickname') draft.nickname = field.value;
  else if (field.key === 'signature') draft.signature = field.value;
  else if (field.key === 'avatarUrl') draft.avatarUrl = field.value;
  closeSheet();
  message.success(t('user.profileEdit.importDone'));
};

// ---------- sheet / 导航 ----------
const goAccounts = () => router.push('/user/accounts');

const openSheet = (mode: Exclude<SheetMode, null>) => {
  sheetMode.value = mode;
};

const closeSheet = () => {
  sheetMode.value = null;
  importSource.value = null;
};

onMounted(() => {
  backDisposer = registerMobileBackLayer({
    id: 'profile-edit-sheet',
    priority: 900,
    isActive: () => sheetMode.value !== null,
    onBack: () => closeSheet()
  });
});

onBeforeUnmount(() => {
  backDisposer?.();
});
</script>

<style lang="scss" scoped>
.pe-scroll {
  width: 100%;
  min-height: 100%;
  padding-left: 16px;
  padding-right: 16px;
}

.pe-card {
  margin-top: 12px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--m-border, #d8d3cc) 34%, transparent);
  border-radius: 24px;
  background: var(--m-surface, #f7f5f1);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--m-shadow, #000) 10%, transparent);
}

/* 头像行 */
.pe-avatar-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pe-avatar-wrap {
  position: relative;
  width: 72px;
  height: 72px;
  flex: 0 0 72px;
  border-radius: 50%;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.16);
  }

  &:active .pe-avatar-camera {
    transform: scale(0.92);
  }
}

.pe-avatar-placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--m-surface-alt) 72%, transparent);
  color: var(--m-text-muted);
  font-size: 28px;
}

.pe-avatar-camera {
  position: absolute;
  right: -2px;
  bottom: -2px;
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 2px solid var(--m-surface, #f7f5f1);
  border-radius: 50%;
  background: var(--accent-color);
  color: #fff;
  font-size: 14px;
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.pe-avatar-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
  flex: 1;

  strong {
    color: var(--m-text-primary);
    font-size: 16px;
  }

  small {
    color: var(--m-text-muted);
    font-size: 11px;
  }
}

.pe-avatar-reset {
  flex-shrink: 0;
  padding: 7px 14px;
  border: 1px solid color-mix(in srgb, var(--m-border) 45%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--m-surface-alt) 60%, transparent);
  color: var(--m-text-secondary);
  font-size: 12px;

  &:active {
    transform: scale(0.95);
  }
}

/* 表单行 */
.pe-row {
  display: flex;
  align-items: center;
  gap: 14px;

  & + .pe-row {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid color-mix(in srgb, var(--m-border) 26%, transparent);
  }

  label {
    width: 56px;
    flex-shrink: 0;
    color: var(--m-text-secondary);
    font-size: 13px;
  }
}

.pe-input {
  min-width: 0;
  flex: 1;
}

/* 性别三段钮 */
.pe-gender-seg {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 6px;

  button {
    flex: 1;
    min-height: 34px;
    padding: 0 8px;
    border: 1px solid color-mix(in srgb, var(--m-border) 40%, transparent);
    border-radius: 999px;
    background: transparent;
    color: var(--m-text-secondary);
    font-size: 12px;
    transition:
      background 160ms ease,
      color 160ms ease,
      border-color 160ms ease;

    &.active {
      border-color: color-mix(in srgb, var(--accent-color) 55%, transparent);
      background: color-mix(in srgb, var(--accent-color) 14%, transparent);
      color: var(--accent-color);
      font-weight: 700;
    }

    &:active {
      transform: scale(0.96);
    }
  }
}

/* 导航行 */
.pe-nav-card {
  padding: 6px 8px;
}

.pe-nav-row {
  display: flex;
  width: 100%;
  min-height: 46px;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 16px;
  color: var(--m-text-primary);
  font-size: 14px;
  text-align: left;
  transition: background 160ms ease;

  > i:first-child {
    display: grid;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    place-items: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
    color: var(--accent-color);
    font-size: 16px;
  }

  &:active {
    background: color-mix(in srgb, var(--m-surface-alt) 70%, transparent);
  }
}

.pe-nav-arrow {
  margin-left: auto;
  color: var(--m-text-muted);
  font-size: 18px;
}

.pe-hint {
  margin: 12px 6px 0;
  color: var(--m-text-muted);
  font-size: 11px;
  line-height: 1.5;
}

/* 双保存按钮 */
.pe-save-bar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;

  button {
    min-height: 46px;
    border: 0;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 700;
    transition: transform 160ms cubic-bezier(0.32, 0.72, 0, 1);

    &:active {
      transform: scale(0.97);
    }

    &:disabled {
      opacity: 0.5;
    }
  }
}

.pe-save-offline {
  border: 1px solid color-mix(in srgb, var(--accent-color) 42%, transparent);
  background: transparent;
  color: var(--accent-color);
}

.pe-save-sync {
  background: var(--accent-color);
  color: #fff;
}

.pe-bottom-spacer {
  height: calc(var(--safe-area-inset-bottom, 0px) + 140px);
}

/* 底部菜单 */
.pe-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: rgba(0, 0, 0, 0.4);
}

.pe-sheet {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 121;
  max-width: 560px;
  margin: 0 auto;
  /* Teleport 到 body 后取不到布局变量：78px = 播放中迷你栏占位高度，
     保证最后一行按钮不被迷你播放栏遮住 */
  padding: 14px 16px calc(var(--safe-area-inset-bottom, 0px) + 90px);
  border-radius: 24px 24px 0 0;
  background: var(--m-surface, #f7f5f1);
  box-shadow: 0 -12px 40px color-mix(in srgb, var(--m-shadow, #000) 24%, transparent);
}

.pe-sheet-title {
  margin: 2px 4px 10px;
  color: var(--m-text-primary);
  font-size: 15px;
  font-weight: 700;
}

.pe-sheet-row {
  display: flex;
  width: 100%;
  min-height: 52px;
  align-items: center;
  gap: 12px;
  padding: 7px 4px;
  border-radius: 14px;
  color: var(--m-text-primary);
  text-align: left;
  transition: background 160ms ease;

  &:active {
    background: color-mix(in srgb, var(--m-surface-alt) 70%, transparent);
  }

  &.disabled {
    opacity: 0.45;

    .pe-row-copy small {
      color: #ef4444;
    }
  }
}

.pe-check {
  display: grid;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  place-items: center;
  border: 1.5px solid color-mix(in srgb, var(--m-text-muted) 55%, transparent);
  border-radius: 50%;
  color: #fff;
  font-size: 14px;

  &.checked {
    border-color: var(--accent-color);
    background: var(--accent-color);
  }
}

.pe-row-avatar {
  display: grid;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 50%;
  object-fit: cover;
}

.pe-row-copy {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }

  small {
    overflow: hidden;
    color: var(--m-text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
  }
}

.pe-import-check {
  color: var(--accent-color);
  font-size: 18px;
}

.pe-sheet-footnote {
  margin: 10px 4px 0;
  color: var(--m-text-muted);
  font-size: 11px;
}

.pe-sheet-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;

  button {
    min-height: 42px;
    border: 0;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 700;
  }
}

.pe-sheet-cancel {
  border: 1px solid color-mix(in srgb, var(--m-border) 45%, transparent);
  background: transparent;
  color: var(--m-text-secondary);
}

.pe-sheet-confirm {
  background: var(--accent-color);
  color: #fff;

  &:disabled {
    opacity: 0.5;
  }
}

.pe-sheet-pad {
  height: 2px;
}

.pe-fade-enter-active,
.pe-fade-leave-active {
  transition: opacity 200ms ease;
}

.pe-fade-enter-from,
.pe-fade-leave-to {
  opacity: 0;
}

.pe-rise-enter-active,
.pe-rise-leave-active {
  transition:
    transform 280ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 220ms ease;
}

.pe-rise-enter-from,
.pe-rise-leave-to {
  transform: translateY(102%);
  opacity: 0.4;
}

@media (prefers-reduced-motion: reduce) {
  .pe-fade-enter-active,
  .pe-fade-leave-active,
  .pe-rise-enter-active,
  .pe-rise-leave-active {
    transition-duration: 80ms;
  }
}
</style>
