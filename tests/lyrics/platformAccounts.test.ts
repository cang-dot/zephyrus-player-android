import { describe, expect, it } from 'vitest';

import { resolveReplacementAccount } from '@/utils/platformAccountSelection';

const account = (accountId: string, platform: 'netease' | 'qq' | 'kugou' | 'spotify') => ({
  accountId,
  platform,
  userId: accountId,
  nickname: accountId,
  avatarUrl: '',
  vip: false,
  cookie: '',
  loginMethod: platform === 'spotify' ? 'oauth' : 'qr',
  createdAt: 1,
  updatedAt: 1
});

describe('platform account removal', () => {
  it('prefers another account on the removed platform', () => {
    expect(
      resolveReplacementAccount(
        [account('kugou:2', 'kugou'), account('netease:1', 'netease')],
        account('kugou:1', 'kugou')
      )?.accountId
    ).toBe('kugou:2');
  });

  it('falls back to the first remaining account', () => {
    expect(
      resolveReplacementAccount([account('netease:1', 'netease')], account('kugou:1', 'kugou'))
        ?.accountId
    ).toBe('netease:1');
  });

  it('returns null after deleting the final account', () => {
    expect(resolveReplacementAccount([], account('qq:1', 'qq'))).toBeNull();
  });
});
