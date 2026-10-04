import { Account, Category, Item } from '../types';

/**
 * Generate next unique account code based on parent account and last saved code.
 * If parent account has code P (e.g. "4"), child accounts will follow P's numbering (e.g. 4001, 4002...).
 * Ensures no duplicate code is produced.
 */
export function getNextAccountCode(
  parentAccountName: string,
  lastSavedCode: string | undefined,
  allAccounts: Account[]
): string {
  const parentAccount = allAccounts.find(
    (a) => a.name.trim().toLowerCase() === parentAccountName.trim().toLowerCase()
  );
  const parentCode = parentAccount ? parentAccount.code.trim() : '';

  // Existing children under this parent account
  const siblingAccounts = allAccounts.filter(
    (a) => a.parentAccount.trim().toLowerCase() === parentAccountName.trim().toLowerCase()
  );

  let maxSiblingNum = 0;
  siblingAccounts.forEach((acc) => {
    const n = parseInt(acc.code, 10);
    if (!isNaN(n) && n > maxSiblingNum) {
      maxSiblingNum = n;
    }
  });

  const lastNum = lastSavedCode ? parseInt(lastSavedCode, 10) : NaN;

  let candidate: number;

  if (!isNaN(lastNum) && lastNum > 0) {
    // Increment by 1 on last saved code
    candidate = Math.max(lastNum + 1, maxSiblingNum + 1);
  } else if (maxSiblingNum > 0) {
    candidate = maxSiblingNum + 1;
  } else if (parentCode && !isNaN(parseInt(parentCode, 10))) {
    // If parent has code e.g. "4", start children at 4001 or parentCode * 1000 + 1
    const pNum = parseInt(parentCode, 10);
    if (pNum >= 1000) {
      candidate = pNum + 1;
    } else if (pNum >= 100) {
      candidate = pNum * 10 + 1;
    } else {
      candidate = pNum * 1000 + 1;
    }
  } else {
    // Default fallback starting at 1001 or highest overall + 1
    const maxOverall = allAccounts.reduce((max, a) => {
      const n = parseInt(a.code, 10);
      return !isNaN(n) && n > max ? n : max;
    }, 1000);
    candidate = maxOverall + 1;
  }

  // Ensure candidate is strictly unique across all accounts
  while (allAccounts.some((a) => a.code.trim() === String(candidate))) {
    candidate++;
  }

  return String(candidate);
}

/**
 * Generate next unique item code based on category and last saved code.
 */
export function getNextItemCode(
  categoryName: string,
  lastSavedCode: string | undefined,
  allItems: Item[],
  categories: Category[]
): string {
  const cat = categories.find(
    (c) => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase()
  );
  const catCode = cat ? cat.code.trim() : '';

  const siblingItems = allItems.filter(
    (i) => i.category.trim().toLowerCase() === categoryName.trim().toLowerCase()
  );

  let maxSiblingNum = 0;
  siblingItems.forEach((item) => {
    const n = parseInt(item.code, 10);
    if (!isNaN(n) && n > maxSiblingNum) {
      maxSiblingNum = n;
    }
  });

  const lastNum = lastSavedCode ? parseInt(lastSavedCode, 10) : NaN;

  let candidate: number;

  if (!isNaN(lastNum) && lastNum > 0) {
    candidate = Math.max(lastNum + 1, maxSiblingNum + 1);
  } else if (maxSiblingNum > 0) {
    candidate = maxSiblingNum + 1;
  } else if (catCode && !isNaN(parseInt(catCode, 10))) {
    const cNum = parseInt(catCode, 10);
    candidate = cNum * 1000 + 1; // e.g. cat 1 -> 1001, cat 2 -> 2001
  } else {
    const maxOverall = allItems.reduce((max, i) => {
      const n = parseInt(i.code, 10);
      return !isNaN(n) && n > max ? n : max;
    }, 1000);
    candidate = maxOverall + 1;
  }

  while (allItems.some((i) => i.code.trim() === String(candidate))) {
    candidate++;
  }

  return String(candidate);
}

/**
 * Generate next unique category code based on last saved category code.
 */
export function getNextCategoryCode(
  lastSavedCode: string | undefined,
  allCategories: Category[]
): string {
  const lastNum = lastSavedCode ? parseInt(lastSavedCode, 10) : NaN;

  const maxOverall = allCategories.reduce((max, c) => {
    const n = parseInt(c.code, 10);
    return !isNaN(n) && n > max ? n : max;
  }, 0);

  let candidate = !isNaN(lastNum) && lastNum > 0 ? Math.max(lastNum + 1, maxOverall + 1) : maxOverall + 1;

  while (allCategories.some((c) => c.code.trim() === String(candidate))) {
    candidate++;
  }

  return String(candidate);
}
