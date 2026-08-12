export interface AccountIdentity {
  accountId: string;
  platform: string;
}

export function resolveReplacementAccount<T extends AccountIdentity>(
  accounts: T[],
  removedAccount: T
): T | null {
  return (
    accounts.find((account) => account.platform === removedAccount.platform) || accounts[0] || null
  );
}
