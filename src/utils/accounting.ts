import { Account, Invoice, Voucher } from '../types';

/**
 * Calculates dynamic balances for all accounts given opening balances, invoices, and vouchers.
 */
export function calculateDynamicAccountBalances(
  accounts: Account[],
  invoices: Invoice[],
  vouchers: Voucher[]
): Map<string, number> {
  const balanceMap = new Map<string, number>();

  accounts.forEach((acc) => {
    const openingDebit = Number(acc.openingDebit) || 0;
    const openingCredit = Number(acc.openingCredit) || 0;
    let balance = openingDebit - openingCredit;

    const accId = acc.id;
    const accCode = acc.code.trim();
    const accName = acc.name.trim().toLowerCase();

    const isCash = accCode === '1' || accName === 'الصندوق';
    const isPurchases = accName === 'المشتريات';
    const isSales = accName === 'المبيعات';
    const isCommission = accCode === '2' || accCode === '4' || accName === 'الكمسيون';

    // Invoices effect
    invoices.forEach((inv) => {
      const totalAmount = Number(inv.totalAmount) || 0;
      const commissionValue = Number(inv.commissionValue) || 0;
      const netAmount = Number(inv.netAmount) || (totalAmount - commissionValue);

      // Cash account (الصندوق): مدين بالمقبوض من المشتري، ودائن بالمسلم للبائع
      if (isCash) {
        if (inv.buyerPaymentType === 'نقدي') {
          balance += totalAmount;
        }
        if (inv.sellerPaymentType === 'نقدي') {
          balance -= netAmount;
        }
      }

      // Purchases account is debited by totalAmount
      if (isPurchases) {
        balance += totalAmount;
      }

      // Sales account is credited by totalAmount
      if (isSales) {
        balance -= totalAmount;
      }

      // Commission account is credited by commissionValue
      if (isCommission) {
        balance -= commissionValue;
      }

      // Seller account
      const isSeller =
        inv.sellerId === accId ||
        (inv.sellerName && inv.sellerName.trim().toLowerCase() === accName);

      if (isSeller) {
        // في حال الآجل: دائن بالصافي. وفي حال النقدي: الحركة متوازنة فوراً والقيمة 0 لأثر الحركة
        if (inv.sellerPaymentType === 'آجل') {
          balance -= netAmount;
        }
      }

      // Buyer account
      const isBuyer =
        inv.buyerId === accId ||
        (inv.buyerName && inv.buyerName.trim().toLowerCase() === accName);

      if (isBuyer) {
        // في حال الآجل: مدين بالإجمالي. وفي حال النقدي: يثبت بالمدين والدائن بنفس الحركة والقيمة 0 للأثر
        if (inv.buyerPaymentType === 'آجل') {
          balance += totalAmount;
        }
      }
    });

    // Vouchers effect
    vouchers.forEach((v) => {
      v.rows.forEach((row) => {
        const matches =
          (row.accountCode && row.accountCode.trim() === accCode) ||
          (row.accountName && row.accountName.trim().toLowerCase() === accName);

        if (matches) {
          const amt = Number(row.amount) || 0;
          if (v.type === 'دفع') {
            balance += amt; // Debit to the account
          } else {
            balance -= amt; // Credit to the account
          }
        }
      });
    });

    balanceMap.set(acc.id, balance);
  });

  return balanceMap;
}
