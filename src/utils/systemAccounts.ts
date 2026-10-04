import { Account } from '../types';
import { SYSTEM_BASIC_ACCOUNTS } from '../context/initialData';

export const SYSTEM_ACCOUNT_CODES = ['1', '2', '3', '4', '5'] as const;

export const SYSTEM_ACCOUNT_NAMES = [
  'الصندوق',
  'الكمسيون',
  'المصاريف',
  'المزارعين',
  'التجار',
] as const;

export function isPermanentSystemAccount(
  account?: Partial<Account> | { code?: string; name?: string; isSystem?: boolean; id?: string } | null
): boolean {
  if (!account) return false;

  const code = (account.code || '').trim();
  const name = (account.name || '').trim();

  // Exclude Sales and Purchases if present
  if (name === 'المبيعات' || name === 'المشتريات') return false;

  if (account.isSystem) return true;
  if (account.id && account.id.startsWith('sys_')) return true;

  if (code && (SYSTEM_ACCOUNT_CODES as readonly string[]).includes(code)) return true;
  if (name && (SYSTEM_ACCOUNT_NAMES as readonly string[]).includes(name)) return true;

  return false;
}

/**
 * Ensures that all 5 fundamental system accounts are present in any accounts list and have no parent account.
 * Merges missing system accounts if they don't exist in the current database.
 */
export function ensureSystemAccounts(accounts: Account[]): Account[] {
  let result = [...accounts];

  // 1. Remove obsolete/removed root accounts from stored accounts if present
  const obsoleteNames = [
    'المبيعات',
    'المشتريات',
    'أصول',
    'اصول',
    'حسابات ختامية',
    'حسابات ختاميه',
    'حساب ختامي',
    'إيرادات',
    'ايرادات',
    'أصول متداولة',
    'خصوم',
    'خصوم / دائنون',
    'أصول / مدينون',
    'مدينون',
    'دائنون'
  ];
  result = result.filter(
    (a) => !obsoleteNames.includes(a.name.trim()) && !obsoleteNames.includes(a.parentAccount.trim())
  );

  // 2. Ensure each system basic account exists and has NO parent account (parentAccount = '')
  SYSTEM_BASIC_ACCOUNTS.forEach((sysAcc) => {
    const existingIndex = result.findIndex(
      (a) =>
        a.id === sysAcc.id ||
        a.name.trim() === sysAcc.name.trim() ||
        (a.code.trim() === sysAcc.code.trim() && a.isSystem)
    );

    if (existingIndex === -1) {
      result.push({ ...sysAcc, parentAccount: '' });
    } else {
      // Ensure it is tagged as system account and preserves the standard system code & name & empty parent
      result[existingIndex] = {
        ...result[existingIndex],
        isSystem: true,
        code: sysAcc.code,
        name: sysAcc.name,
        parentAccount: '',
      };
    }
  });

  return result;
}
