import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const MUSIC_PLATFORMS = ['netease', 'qq', 'kugou', 'spotify'] as const;
const DEPRECATED_LOGIN_PLATFORMS = ['kuwo', 'migu'] as const;

export type MusicPlatform = (typeof MUSIC_PLATFORMS)[number];
export type PlatformLoginMethod = 'qr' | 'cookie' | 'uid' | 'oauth';
export type AccountDataKind = 'playlists' | 'favorites' | 'albums' | 'history';

export interface PlatformAccount {
  accountId: string;
  platform: MusicPlatform;
  userId: string;
  nickname: string;
  avatarUrl: string;
  vip: boolean;
  vipLabel?: string;
  cookie: string;
  loginMethod: PlatformLoginMethod;
  createdAt: number;
  updatedAt: number;
}

export interface PlatformAccountInput {
  accountId?: string;
  platform: MusicPlatform;
  userId?: string | number;
  nickname?: string;
  avatarUrl?: string;
  vip?: boolean;
  vipLabel?: string;
  cookie?: string;
  loginMethod: PlatformLoginMethod;
}

export interface PlatformAccountCache {
  playlists?: unknown[];
  favorites?: unknown[];
  albums?: unknown[];
  history?: unknown[];
  updatedAt: number;
}

const PLATFORM_NAMES: Record<MusicPlatform, string> = {
  netease: '网易云',
  qq: 'QQ 音乐',
  kugou: '酷狗音乐',
  spotify: 'Spotify'
};

function parseStoredJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function cookieFingerprint(cookie: string): string {
  let fingerprint = 2166136261;
  for (const character of cookie) {
    fingerprint ^= character.charCodeAt(0);
    fingerprint = Math.imul(fingerprint, 16777619);
  }
  return (fingerprint >>> 0).toString(36);
}

function resolveAccountId(input: PlatformAccountInput): string {
  if (input.accountId) return input.accountId;
  const userId = String(input.userId || '').trim();
  const identity = userId || (input.cookie ? cookieFingerprint(input.cookie) : String(Date.now()));
  return `${input.platform}:${identity}`;
}

export const usePlatformAccountsStore = defineStore(
  'platformAccounts',
  () => {
    const accounts = ref<PlatformAccount[]>([]);
    const activeAccountId = ref<string | null>(null);
    const accountCache = ref<Record<string, PlatformAccountCache>>({});

    const activeAccount = computed(
      () => accounts.value.find((account) => account.accountId === activeAccountId.value) || null
    );
    const activePlatform = computed<MusicPlatform | null>(
      () => activeAccount.value?.platform || null
    );
    const activeAccountCache = computed(() =>
      activeAccountId.value ? accountCache.value[activeAccountId.value] || null : null
    );

    const accountsForPlatform = (platform: MusicPlatform) =>
      accounts.value.filter((account) => account.platform === platform);

    const syncRuntimePlatformCookie = (platform: MusicPlatform, cookie: string) => {
      if (
        platform === 'netease' ||
        platform === 'spotify' ||
        typeof window === 'undefined' ||
        !window.api?.setPlatformCookie
      ) {
        return;
      }

      void window.api.setPlatformCookie(platform, cookie).catch((error) => {
        console.error(`[platformAccounts] 同步 ${platform} Cookie 失败:`, error);
      });
    };

    const syncLegacyPlatformState = (account: PlatformAccount) => {
      localStorage.setItem('active-music-account', account.accountId);
      localStorage.setItem('active-music-platform', account.platform);

      // Spotify 使用独立的 OAuth 令牌管理，不走 cookie 体系
      if (account.platform === 'spotify') {
        return;
      }

      localStorage.setItem(`platform-user-${account.platform}`, JSON.stringify(account));

      if (account.cookie) {
        localStorage.setItem(`platform-cookie-${account.platform}`, account.cookie);
      }
      syncRuntimePlatformCookie(account.platform, account.cookie);

      if (account.platform === 'netease') {
        localStorage.setItem(
          'user',
          JSON.stringify({
            userId: Number(account.userId) || account.userId,
            nickname: account.nickname,
            avatarUrl: account.avatarUrl,
            vipType: account.vip ? 11 : 0
          })
        );
        localStorage.setItem('loginType', account.loginMethod);
        if (account.cookie) {
          localStorage.setItem('token', account.cookie);
        }
      }
    };

    const setActiveAccount = (accountId: string) => {
      const account = accounts.value.find((item) => item.accountId === accountId);
      if (!account) return false;
      activeAccountId.value = accountId;
      syncLegacyPlatformState(account);
      return true;
    };

    const moveAccount = (fromIndex: number, toIndex: number) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= accounts.value.length ||
        toIndex >= accounts.value.length ||
        fromIndex === toIndex
      ) {
        return false;
      }

      const nextAccounts = [...accounts.value];
      const [movedAccount] = nextAccounts.splice(fromIndex, 1);
      nextAccounts.splice(toIndex, 0, movedAccount);
      accounts.value = nextAccounts;
      return true;
    };

    const addOrUpdateAccount = (input: PlatformAccountInput) => {
      const now = Date.now();
      const accountId = resolveAccountId(input);
      const existingIndex = accounts.value.findIndex((account) => account.accountId === accountId);
      const existing = existingIndex >= 0 ? accounts.value[existingIndex] : undefined;
      const account: PlatformAccount = {
        accountId,
        platform: input.platform,
        userId: String(input.userId || existing?.userId || ''),
        nickname:
          input.nickname?.trim() || existing?.nickname || `${PLATFORM_NAMES[input.platform]}用户`,
        avatarUrl: input.avatarUrl || existing?.avatarUrl || '',
        vip: input.vip ?? existing?.vip ?? false,
        vipLabel: input.vipLabel || existing?.vipLabel,
        cookie: input.cookie ?? existing?.cookie ?? '',
        loginMethod: input.loginMethod,
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };

      if (existingIndex >= 0) {
        accounts.value.splice(existingIndex, 1, account);
      } else {
        accounts.value.push(account);
      }

      setActiveAccount(account.accountId);
      return account;
    };

    const removeAccount = (accountId: string) => {
      const account = accounts.value.find((item) => item.accountId === accountId);
      if (!account) return false;

      accounts.value = accounts.value.filter((item) => item.accountId !== accountId);
      delete accountCache.value[accountId];

      const replacement =
        accounts.value.find((item) => item.platform === account.platform) ||
        accounts.value[0] ||
        null;

      if (activeAccountId.value === accountId) {
        if (replacement) {
          setActiveAccount(replacement.accountId);
        } else {
          activeAccountId.value = null;
          localStorage.removeItem('active-music-account');
          localStorage.removeItem('active-music-platform');
        }
      }

      const platformReplacement = accounts.value.find((item) => item.platform === account.platform);
      if (platformReplacement) {
        localStorage.setItem(
          `platform-user-${account.platform}`,
          JSON.stringify(platformReplacement)
        );
        if (platformReplacement.cookie) {
          localStorage.setItem(`platform-cookie-${account.platform}`, platformReplacement.cookie);
        }
      } else {
        localStorage.removeItem(`platform-user-${account.platform}`);
        localStorage.removeItem(`platform-cookie-${account.platform}`);
        syncRuntimePlatformCookie(account.platform, '');
        if (account.platform === 'netease') {
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          localStorage.removeItem('loginType');
          localStorage.removeItem('uidLogin');
        }
      }

      return true;
    };

    const cacheAccountData = (accountId: string, kind: AccountDataKind, data: unknown[]) => {
      if (!accounts.value.some((account) => account.accountId === accountId)) return;
      accountCache.value[accountId] = {
        ...accountCache.value[accountId],
        [kind]: data.slice(0, 300),
        updatedAt: Date.now()
      };
    };

    const getCachedAccountData = (accountId: string, kind: AccountDataKind) =>
      accountCache.value[accountId]?.[kind] || [];

    const migrateLegacyAccounts = () => {
      accounts.value = accounts.value.filter((account) =>
        MUSIC_PLATFORMS.includes(account.platform)
      );
      const accountIds = new Set(accounts.value.map((account) => account.accountId));
      accountCache.value = Object.fromEntries(
        Object.entries(accountCache.value).filter(([accountId]) => accountIds.has(accountId))
      );
      for (const platform of DEPRECATED_LOGIN_PLATFORMS) {
        localStorage.removeItem(`platform-cookie-${platform}`);
        localStorage.removeItem(`platform-user-${platform}`);
      }

      if (accounts.value.length) {
        const storedActiveAccountId = localStorage.getItem('active-music-account');
        const activeAccountStillExists = accounts.value.some(
          (account) => account.accountId === activeAccountId.value
        );
        if (
          storedActiveAccountId &&
          accounts.value.some((account) => account.accountId === storedActiveAccountId)
        ) {
          activeAccountId.value = storedActiveAccountId;
        } else if (!activeAccountStillExists) {
          activeAccountId.value = accounts.value[0].accountId;
        }
        return;
      }

      const legacyUser = parseStoredJson<Record<string, unknown> | null>('user', null);
      const legacyToken = localStorage.getItem('token') || '';
      const legacyLoginMethod = localStorage.getItem('loginType') as PlatformLoginMethod | null;
      if (legacyUser && legacyUser.userId) {
        addOrUpdateAccount({
          platform: 'netease',
          userId: String(legacyUser.userId),
          nickname: String(legacyUser.nickname || '网易云用户'),
          avatarUrl: String(legacyUser.avatarUrl || ''),
          vip: Boolean(legacyUser.vipType),
          cookie: legacyToken,
          loginMethod: legacyLoginMethod === 'uid' ? 'uid' : 'qr'
        });
      }

      for (const platform of MUSIC_PLATFORMS.filter((item) => item !== 'netease')) {
        const cookie = localStorage.getItem(`platform-cookie-${platform}`) || '';
        if (!cookie) continue;
        const legacyPlatformUser = parseStoredJson<Record<string, unknown> | null>(
          `platform-user-${platform}`,
          null
        );
        addOrUpdateAccount({
          platform,
          userId: String(legacyPlatformUser?.userId || ''),
          nickname: String(legacyPlatformUser?.nickname || `${PLATFORM_NAMES[platform]}用户`),
          avatarUrl: String(legacyPlatformUser?.avatarUrl || ''),
          vip: Boolean(legacyPlatformUser?.vip),
          cookie,
          loginMethod: 'cookie'
        });
      }

      if (!accounts.value.length) {
        activeAccountId.value = null;
      }
    };

    migrateLegacyAccounts();

    return {
      accounts,
      activeAccountId,
      accountCache,
      activeAccount,
      activePlatform,
      activeAccountCache,
      accountsForPlatform,
      setActiveAccount,
      moveAccount,
      addOrUpdateAccount,
      removeAccount,
      cacheAccountData,
      getCachedAccountData,
      migrateLegacyAccounts
    };
  },
  {
    persist: {
      key: 'platform-accounts-store',
      storage: localStorage,
      pick: ['accounts', 'activeAccountId', 'accountCache']
    }
  }
);
