import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency, numberToArabicWords } from '../../utils/tafqeet';
import {
  Printer,
  X,
  FileText,
  ListFilter,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Check,
} from 'lucide-react';
import { InvoiceRow } from '../../types';
import { ContainmentCombobox, ComboboxOption } from '../common/ContainmentCombobox';

interface StatementRow {
  id: string;
  docNumber: string;
  docType: 'opening' | 'invoice_seller' | 'invoice_buyer' | 'voucher_payment' | 'voucher_receipt';
  docTypeLabel: string;
  date: string;
  description: string;
  oppositeAccount?: string;
  debit: number;
  credit: number;
  balance: number;
  sourceType?: 'opening' | 'invoice' | 'voucher';
  sourceId?: string;
  voucherType?: 'دفع' | 'قبض';
  rawInvoice?: {
    id: string;
    invoiceNumber: string;
    sellerName: string;
    buyerName: string;
    commissionRate: number;
    commissionValue: number;
    totalAmount: number;
    netAmount: number;
    rows: InvoiceRow[];
  };
  rawVoucher?: {
    id: string;
    voucherType: 'دفع' | 'قبض';
    voucherNumber: string;
    mainAccountName: string;
    notes?: string;
  };
}

export const AccountStatementView: React.FC = () => {
  const {
    accounts,
    invoices,
    vouchers,
    selectedAccountId,
    setSelectedAccountId,
    setSelectedInvoiceId,
    setSelectedVoucherId,
    triggerPrint,
    setCurrentView,
    settings,
    showNotification,
  } = useApp();

  const currentYear = new Date().getFullYear();
  const defaultYearStart = `${currentYear}-01-01`;
  const defaultYearEnd = `${currentYear}-12-31`;

  const [chosenAccountId, setChosenAccountId] = useState<string>(
    selectedAccountId || ''
  );
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('detailed');
  const [startDate, setStartDate] = useState<string>(defaultYearStart);
  const [endDate, setEndDate] = useState<string>(defaultYearEnd);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Column visibility options (الحساب المقابل، الوزن القائم، قيمة الخصم، نسبة الخصم، الوزن الصافي، الإفرادي، الإجمالي، الكمسيون)
  const [columnVisibility, setColumnVisibility] = useState({
    showOppositeAccount: false, // الحساب المقابل (افتراضياً غير مفعل)
    showGrossWeight: true, // الوزن القائم
    showDiscountValue: false, // قيمة الخصم (افتراضياً غير مفعل)
    showDiscountPercent: false, // نسبة الخصم % (افتراضياً غير مفعل)
    showNetWeight: true, // الوزن الصافي
    showUnitPrice: true, // الإفرادي
    showTotal: true, // الإجمالي
    showCommission: false, // الكمسيون (افتراضياً غير مفعل)
  });

  const currentAccount = accounts.find((a) => a.id === chosenAccountId);

  // Accounts options for ContainmentCombobox (بحث احتواء)
  const accountComboboxOptions = useMemo<ComboboxOption[]>(() => {
    return accounts.map((acc) => ({
      id: acc.id,
      label: acc.name,
      code: acc.code,
    }));
  }, [accounts]);

  const toggleRowExpand = (id: string) => {
    setExpandedRows((prev) => {
      const isCurrentlyExpanded = prev[id] !== undefined ? prev[id] : (viewMode === 'detailed');
      return {
        ...prev,
        [id]: !isCurrentlyExpanded,
      };
    });
  };

  // 1. Calculate All Statement Transactions
  const { allRows, summaryStats } = useMemo(() => {
    if (!currentAccount) {
      return {
        allRows: [],
        summaryStats: {
          openingDebit: 0,
          openingCredit: 0,
          totalSales: 0,
          totalPurchases: 0,
          totalReceipts: 0,
          totalPayments: 0,
          totalCommission: 0,
          totalGrossWeight: 0,
          totalNetWeight: 0,
          totalDebit: 0,
          totalCredit: 0,
          finalBalance: 0,
        },
      };
    }

    const list: StatementRow[] = [];
    let runningBalance = 0;

    let openingDebit = Number(currentAccount.openingDebit) || 0;
    let openingCredit = Number(currentAccount.openingCredit) || 0;
    let totalSales = 0;
    let totalPurchases = 0;
    let totalReceipts = 0;
    let totalPayments = 0;
    let totalCommission = 0;
    let totalGrossWeight = 0;
    let totalNetWeight = 0;

    // Opening Balance
    if (openingDebit > 0 || openingCredit > 0) {
      runningBalance = openingDebit - openingCredit;
      list.push({
        id: 'opening_balance',
        docNumber: '-',
        docType: 'opening',
        docTypeLabel: 'رصيد افتتاحي سابق',
        date: '2026-01-01',
        description: 'رصيد افتتاحي سابق مدور',
        oppositeAccount: '-',
        debit: openingDebit,
        credit: openingCredit,
        balance: runningBalance,
        sourceType: 'opening',
        sourceId: currentAccount.id,
      });
    }

    // Invoices
    const isCashAcc =
      currentAccount.code.trim() === '1' ||
      currentAccount.name.trim().toLowerCase() === 'الصندوق';
    const isPurchasesAcc =
      currentAccount.code.trim() === '2' ||
      currentAccount.name.trim().toLowerCase() === 'المشتريات';
    const isSalesAcc =
      currentAccount.code.trim() === '3' ||
      currentAccount.name.trim().toLowerCase() === 'المبيعات';
    const isCommissionAcc =
      currentAccount.code.trim() === '4' ||
      currentAccount.name.trim().toLowerCase() === 'الكمسيون';

    invoices.forEach((inv) => {
      const isSeller =
        inv.sellerId === currentAccount.id ||
        inv.sellerName.trim().toLowerCase() === currentAccount.name.trim().toLowerCase();
      const isBuyer =
        inv.buyerId === currentAccount.id ||
        inv.buyerName.trim().toLowerCase() === currentAccount.name.trim().toLowerCase();

      // Accumulate weights if this invoice pertains to the current account
      if (isSeller || isBuyer || isPurchasesAcc || isSalesAcc || isCommissionAcc || isCashAcc) {
        inv.rows?.forEach((pr) => {
          totalGrossWeight += Number(pr.grossWeight) || 0;
          totalNetWeight += Number(pr.netWeight) || 0;
        });
      }

      const total = Number(inv.totalAmount) || 0;
      const comm = Number(inv.commissionValue) || 0;
      const net = Number(inv.netAmount) || (total - comm);

      const rawInvoiceData = {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        sellerName: inv.sellerName,
        buyerName: inv.buyerName,
        commissionRate: inv.commissionRate,
        commissionValue: inv.commissionValue,
        totalAmount: inv.totalAmount,
        netAmount: inv.netAmount,
        rows: inv.rows || [],
      };

      // Case 0: Cash Account (حساب الصندوق: مقبوضات نقدية من المشتري ومدفوعات نقدية للبائع)
      if (isCashAcc) {
        if (inv.buyerPaymentType === 'نقدي') {
          totalReceipts += total;
          list.push({
            id: `inv_cash_in_${inv.id}`,
            docNumber: inv.invoiceNumber,
            docType: 'voucher_receipt',
            docTypeLabel: 'قبض نقدي (فاتورة)',
            date: inv.date,
            description: `قبض نقدي قيمة فاتورة كمسيون رقم ${inv.invoiceNumber} من المشتري ${inv.buyerName}`,
            oppositeAccount: inv.buyerName,
            debit: total,
            credit: 0,
            balance: 0,
            sourceType: 'invoice',
            sourceId: inv.id,
            rawInvoice: rawInvoiceData,
          });
        }

        if (inv.sellerPaymentType === 'نقدي') {
          totalPayments += net;
          list.push({
            id: `inv_cash_out_${inv.id}`,
            docNumber: inv.invoiceNumber,
            docType: 'voucher_payment',
            docTypeLabel: 'دفع نقدي (فاتورة)',
            date: inv.date,
            description: `دفع نقدي لصافي استحقاق البائع ${inv.sellerName} عن فاتورة كمسيون رقم ${inv.invoiceNumber}`,
            oppositeAccount: inv.sellerName,
            debit: 0,
            credit: net,
            balance: 0,
            sourceType: 'invoice',
            sourceId: inv.id,
            rawInvoice: rawInvoiceData,
          });
        }
      }

      // Case 1: Purchases Account (حساب المشتريات مدين بإجمالي البضاعة)
      if (isPurchasesAcc) {
        totalPurchases += total;

        list.push({
          id: `inv_pur_${inv.id}`,
          docNumber: inv.invoiceNumber,
          docType: 'invoice_buyer',
          docTypeLabel: 'فاتورة كمسيون (مشتريات)',
          date: inv.date,
          description: `فاتورة رقم ${inv.invoiceNumber} - إجمالي بضاعة مشتريات (بائع: ${inv.sellerName} / مشتري: ${inv.buyerName})`,
          oppositeAccount: inv.sellerName,
          debit: total,
          credit: 0,
          balance: 0,
          sourceType: 'invoice',
          sourceId: inv.id,
          rawInvoice: rawInvoiceData,
        });
      }

      // Case 1.5: Sales Account (حساب المبيعات دائن بإجمالي البضاعة)
      if (isSalesAcc) {
        totalSales += total;

        list.push({
          id: `inv_sales_${inv.id}`,
          docNumber: inv.invoiceNumber,
          docType: 'invoice_seller',
          docTypeLabel: 'مبيعات بضاعة',
          date: inv.date,
          description: `فاتورة رقم ${inv.invoiceNumber} - إجمالي مبيعات بضاعة (بائع: ${inv.sellerName} / مشتري: ${inv.buyerName})`,
          oppositeAccount: inv.buyerName,
          debit: 0,
          credit: total,
          balance: 0,
          sourceType: 'invoice',
          sourceId: inv.id,
          rawInvoice: rawInvoiceData,
        });
      }

      // Case 2: Commission Account (حساب الكمسيون دائن بقيمة الكمسيون)
      if (isCommissionAcc) {
        totalCommission += comm;

        list.push({
          id: `inv_comm_${inv.id}`,
          docNumber: inv.invoiceNumber,
          docType: 'invoice_seller',
          docTypeLabel: 'إيراد كمسيون',
          date: inv.date,
          description: `إيراد عمولة كمسيون %${inv.commissionRate || 5} عن فاتورة رقم ${inv.invoiceNumber} (${inv.sellerName} / ${inv.buyerName})`,
          oppositeAccount: inv.sellerName,
          debit: 0,
          credit: comm,
          balance: 0,
          sourceType: 'invoice',
          sourceId: inv.id,
          rawInvoice: rawInvoiceData,
        });
      }

      // Case 3: Seller Account (حساب البائع)
      if (isSeller) {
        totalSales += total;
        totalCommission += comm;

        if (inv.sellerPaymentType === 'نقدي') {
          totalPayments += net;
          list.push({
            id: `inv_s_cash_${inv.id}`,
            docNumber: inv.invoiceNumber,
            docType: 'invoice_seller',
            docTypeLabel: 'فاتورة كمسيون (نقدي)',
            date: inv.date,
            description: `فاتورة رقم ${inv.invoiceNumber} (نقدي) - صافي مستحق البائع: ${formatCurrency(net)} [معلومة: إجمالي البضاعة: ${formatCurrency(total)} / عمولة الكمسيون: ${formatCurrency(comm)}] للمشتري ${inv.buyerName}`,
            oppositeAccount: inv.buyerName,
            debit: net,
            credit: net,
            balance: 0,
            sourceType: 'invoice',
            sourceId: inv.id,
            rawInvoice: rawInvoiceData,
          });
        } else {
          list.push({
            id: `inv_s_cr_${inv.id}`,
            docNumber: inv.invoiceNumber,
            docType: 'invoice_seller',
            docTypeLabel: 'فاتورة كمسيون (آجل)',
            date: inv.date,
            description: `فاتورة رقم ${inv.invoiceNumber} (آجل) - بيع بضاعة بالآجل للمشتري ${inv.buyerName} [عمولة الكمسيون: ${formatCurrency(comm)}]`,
            oppositeAccount: inv.buyerName,
            debit: 0,
            credit: net,
            balance: 0,
            sourceType: 'invoice',
            sourceId: inv.id,
            rawInvoice: rawInvoiceData,
          });
        }
      }

      // Case 4: Buyer Account (حساب المشتري)
      if (isBuyer) {
        totalPurchases += total;

        // الملاحظة الافتراضية للمشتري في حال عدم كتابة ملاحظة: لا يذكر اسم البائع داخل الملاحظة فقط الفاتورة آجل أو نقدي مع رقمها
        const buyerDesc = inv.buyerNotes?.trim()
          ? inv.buyerNotes.trim()
          : (inv.buyerPaymentType === 'نقدي'
              ? `فاتورة نقدي رقم ${inv.invoiceNumber}`
              : `فاتورة آجل رقم ${inv.invoiceNumber}`);

        if (inv.buyerPaymentType === 'نقدي') {
          totalReceipts += total;
          list.push({
            id: `inv_b_cash_${inv.id}`,
            docNumber: inv.invoiceNumber,
            docType: 'invoice_buyer',
            docTypeLabel: 'فاتورة كمسيون (نقدي)',
            date: inv.date,
            description: buyerDesc,
            oppositeAccount: inv.sellerName,
            debit: total,
            credit: total,
            balance: 0,
            sourceType: 'invoice',
            sourceId: inv.id,
            rawInvoice: rawInvoiceData,
          });
        } else {
          list.push({
            id: `inv_b_db_${inv.id}`,
            docNumber: inv.invoiceNumber,
            docType: 'invoice_buyer',
            docTypeLabel: 'فاتورة كمسيون (آجل)',
            date: inv.date,
            description: buyerDesc,
            oppositeAccount: inv.sellerName,
            debit: total,
            credit: 0,
            balance: 0,
            sourceType: 'invoice',
            sourceId: inv.id,
            rawInvoice: rawInvoiceData,
          });
        }
      }
    });

    // Vouchers
    vouchers.forEach((v) => {
      const isMainAcc =
        v.mainAccountId === currentAccount.id ||
        v.mainAccountName?.trim().toLowerCase() === currentAccount.name.trim().toLowerCase();

      if (isMainAcc) {
        v.rows.forEach((row, rIdx) => {
          const amt = Number(row.amount) || 0;
          if (v.type === 'دفع') {
            list.push({
              id: `vouch_main_pay_${v.id}_${rIdx}`,
              docNumber: v.voucherNumber,
              docType: 'voucher_payment',
              docTypeLabel: 'سند دفع نقدي',
              date: v.date,
              description: row.notes || v.notes || `صرف نقدي للحساب: ${row.accountName}`,
              oppositeAccount: row.accountName,
              debit: 0,
              credit: amt,
              balance: 0,
              sourceType: 'voucher',
              sourceId: v.id,
              voucherType: 'دفع',
              rawVoucher: {
                id: v.id,
                voucherType: 'دفع',
                voucherNumber: v.voucherNumber,
                mainAccountName: v.mainAccountName,
                notes: row.notes || v.notes,
              },
            });
          } else {
            list.push({
              id: `vouch_main_rec_${v.id}_${rIdx}`,
              docNumber: v.voucherNumber,
              docType: 'voucher_receipt',
              docTypeLabel: 'سند قبض نقدي',
              date: v.date,
              description: row.notes || v.notes || `قبض نقدي من الحساب: ${row.accountName}`,
              oppositeAccount: row.accountName,
              debit: amt,
              credit: 0,
              balance: 0,
              sourceType: 'voucher',
              sourceId: v.id,
              voucherType: 'قبض',
              rawVoucher: {
                id: v.id,
                voucherType: 'قبض',
                voucherNumber: v.voucherNumber,
                mainAccountName: v.mainAccountName,
                notes: row.notes || v.notes,
              },
            });
          }
        });
      } else {
        v.rows.forEach((row, rIdx) => {
          const matches =
            row.accountName.trim().toLowerCase() === currentAccount.name.trim().toLowerCase() ||
            row.accountCode === currentAccount.code;

          if (matches) {
            const amt = Number(row.amount) || 0;
            if (v.type === 'دفع') {
              list.push({
                id: `vouch_pay_${v.id}_${rIdx}`,
                docNumber: v.voucherNumber,
                docType: 'voucher_payment',
                docTypeLabel: 'سند دفع نقدي',
                date: v.date,
                description: row.notes || v.notes || `دفعة نقدية بموجب سند دفع رقم ${v.voucherNumber}`,
                oppositeAccount: v.mainAccountName || 'الصندوق',
                debit: amt,
                credit: 0,
                balance: 0,
                sourceType: 'voucher',
                sourceId: v.id,
                voucherType: 'دفع',
                rawVoucher: {
                  id: v.id,
                  voucherType: 'دفع',
                  voucherNumber: v.voucherNumber,
                  mainAccountName: v.mainAccountName,
                  notes: row.notes || v.notes,
                },
              });
            } else {
              list.push({
                id: `vouch_rec_${v.id}_${rIdx}`,
                docNumber: v.voucherNumber,
                docType: 'voucher_receipt',
                docTypeLabel: 'سند قبض نقدي',
                date: v.date,
                description: row.notes || v.notes || `قبض نقدي بموجب سند قبض رقم ${v.voucherNumber}`,
                oppositeAccount: v.mainAccountName || 'الصندوق',
                debit: 0,
                credit: amt,
                balance: 0,
                sourceType: 'voucher',
                sourceId: v.id,
                voucherType: 'قبض',
                rawVoucher: {
                  id: v.id,
                  voucherType: 'قبض',
                  voucherNumber: v.voucherNumber,
                  mainAccountName: v.mainAccountName,
                  notes: row.notes || v.notes,
                },
              });
            }
          }
        });
      }
    });

    list.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

    let running = 0;
    list.forEach((row) => {
      running += row.debit - row.credit;
      row.balance = running;
    });

    const totalDebit = list.reduce((sum, r) => sum + r.debit, 0);
    const totalCredit = list.reduce((sum, r) => sum + r.credit, 0);
    const finalBalance = totalDebit - totalCredit;

    return {
      allRows: list,
      summaryStats: {
        openingDebit,
        openingCredit,
        totalSales,
        totalPurchases,
        totalReceipts,
        totalPayments,
        totalCommission,
        totalGrossWeight,
        totalNetWeight,
        totalDebit,
        totalCredit,
        finalBalance,
      },
    };
  }, [currentAccount, invoices, vouchers]);

  // 2. Filter rows by date and search
  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      if (startDate && row.date < startDate) return false;
      if (endDate && row.date > endDate) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesDoc = row.docNumber.toLowerCase().includes(query);
        const matchesDesc = row.description.toLowerCase().includes(query);
        const matchesType = row.docTypeLabel.toLowerCase().includes(query);
        const matchesOpposite = (row.oppositeAccount || '').toLowerCase().includes(query);
        const matchesProduce =
          row.rawInvoice?.rows?.some((r) => r.itemName.toLowerCase().includes(query)) || false;
        if (!matchesDoc && !matchesDesc && !matchesType && !matchesOpposite && !matchesProduce) return false;
      }
      return true;
    });
  }, [allRows, startDate, endDate, searchQuery]);

  // 3. Compute active filtered summary statistics and weights
  const activeSummaryStats = useMemo(() => {
    let debit = 0;
    let credit = 0;
    let grossWeight = 0;
    let netWeight = 0;
    const processedInvoiceKeys = new Set<string>();

    filteredRows.forEach((r) => {
      debit += r.debit || 0;
      credit += r.credit || 0;

      if (r.rawInvoice?.rows && r.rawInvoice.rows.length > 0) {
        const invKey = r.docNumber || r.id;
        if (!processedInvoiceKeys.has(invKey)) {
          processedInvoiceKeys.add(invKey);
          r.rawInvoice.rows.forEach((pr) => {
            grossWeight += Number(pr.grossWeight) || 0;
            netWeight += Number(pr.netWeight) || 0;
          });
        }
      }
    });

    const isFiltered = !!(startDate || endDate || searchQuery);

    return {
      ...summaryStats,
      totalDebit: isFiltered ? debit : summaryStats.totalDebit,
      totalCredit: isFiltered ? credit : summaryStats.totalCredit,
      finalBalance: isFiltered ? debit - credit : summaryStats.finalBalance,
      totalGrossWeight: isFiltered ? Math.round(grossWeight * 100) / 100 : summaryStats.totalGrossWeight,
      totalNetWeight: isFiltered ? Math.round(netWeight * 100) / 100 : summaryStats.totalNetWeight,
    };
  }, [filteredRows, summaryStats, startDate, endDate, searchQuery]);

  const handlePrint = () => {
    if (!currentAccount) return;
    triggerPrint('account_statement', {
      account: currentAccount,
      rows: filteredRows,
      summaryStats: activeSummaryStats,
      mode: viewMode,
      columnVisibility,
      startDate,
      endDate,
    });
  };

  const handlePrintRef = useRef(handlePrint);
  handlePrintRef.current = handlePrint;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4' || e.code === 'F4' || e.keyCode === 115) {
        e.preventDefault();
        e.stopPropagation();
        handlePrintRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Double click handler to open linked movement (فاتورة / سند / رصيد افتتاحي)
  const handleRowDoubleClick = (row: StatementRow) => {
    // 1. Opening balance -> open account card
    if (row.docType === 'opening' || row.sourceType === 'opening' || row.id === 'opening_balance') {
      const targetAccId = row.sourceId || chosenAccountId;
      if (targetAccId) {
        setSelectedAccountId(targetAccId);
        setCurrentView('account_card');
        showNotification(`تم فتح بطاقة الحساب: ${currentAccount?.name || ''}`, 'info');
      }
      return;
    }

    // 2. Invoice movement -> open commission invoice
    if (
      row.sourceType === 'invoice' ||
      row.rawInvoice ||
      row.docType === 'invoice_seller' ||
      row.docType === 'invoice_buyer' ||
      row.id.startsWith('inv_')
    ) {
      const invId = row.rawInvoice?.id || row.sourceId;
      const foundInv = invoices.find(
        (inv) =>
          (invId && inv.id === invId) ||
          inv.invoiceNumber === row.docNumber ||
          (row.id.startsWith('inv_') && row.id.includes(inv.id))
      );
      if (foundInv) {
        setSelectedInvoiceId(foundInv.id);
        setCurrentView('commission_invoice');
        showNotification(`تم فتح فاتورة كمسيون رقم (${foundInv.invoiceNumber})`, 'info');
        return;
      }
    }

    // 3. Voucher movement -> open payment / receipt voucher
    if (
      row.sourceType === 'voucher' ||
      row.rawVoucher ||
      row.docType === 'voucher_payment' ||
      row.docType === 'voucher_receipt' ||
      row.id.startsWith('vouch_')
    ) {
      const vId = row.rawVoucher?.id || row.sourceId;
      const foundVoucher = vouchers.find(
        (v) =>
          (vId && v.id === vId) ||
          v.voucherNumber === row.docNumber ||
          (row.id.startsWith('vouch_') && row.id.includes(v.id))
      );
      if (foundVoucher) {
        setSelectedVoucherId(foundVoucher.id);
        setCurrentView(foundVoucher.type === 'دفع' ? 'voucher_payment' : 'voucher_receipt');
        showNotification(`تم فتح سند ${foundVoucher.type} رقم (${foundVoucher.voucherNumber})`, 'info');
        return;
      }

      // If it was a cash movement from an invoice
      const fallbackInv = invoices.find(
        (inv) =>
          (row.sourceId && inv.id === row.sourceId) ||
          inv.invoiceNumber === row.docNumber ||
          row.id.includes(inv.id)
      );
      if (fallbackInv) {
        setSelectedInvoiceId(fallbackInv.id);
        setCurrentView('commission_invoice');
        showNotification(`تم فتح فاتورة كمسيون رقم (${fallbackInv.invoiceNumber})`, 'info');
        return;
      }
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-56px)] bg-[#7196b8] p-2 sm:p-3 md:p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="w-full flex flex-col gap-3">

        {/* Unified Top Control & Filter Card (دمج العناصر في كومبوننت واحد) */}
        <div className="bg-[#233142] text-white p-3 rounded-lg shadow-md border border-slate-700 flex flex-col gap-2.5">
          {/* Header Row: Title, Badges, Net Balance & Top Action Buttons */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-700/80">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-1.5 bg-slate-800 rounded-md text-sky-400 border border-slate-700 shadow-xs">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black tracking-wide text-white">
                  كشف حساب
                </h1>
                {currentAccount && (
                  <span className="bg-sky-900/80 text-sky-200 border border-sky-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                    {currentAccount.name}
                  </span>
                )}
                <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-md font-mono border border-slate-700">
                  {filteredRows.length} حركة
                </span>

                {/* Net Balance Pill in the same row */}
                {currentAccount && (
                  <div className="flex items-center gap-2 bg-[#1a2533] px-2.5 py-1 rounded-md border border-slate-700 shadow-xs">
                    <span className="text-[11px] text-slate-300 font-bold">صافي الرصيد الحالي:</span>
                    <span
                      className={`text-sm sm:text-base font-black font-mono ${
                        activeSummaryStats.finalBalance > 0
                          ? 'text-emerald-400'
                          : activeSummaryStats.finalBalance < 0
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {formatCurrency(Math.abs(activeSummaryStats.finalBalance))} {settings.currency || 'ل.س'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold border ${
                        activeSummaryStats.finalBalance > 0
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                          : activeSummaryStats.finalBalance < 0
                          ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                          : 'bg-slate-800 text-slate-300 border-slate-600'
                      }`}
                    >
                      {activeSummaryStats.finalBalance > 0
                        ? 'رصيد مدين (لنا)'
                        : activeSummaryStats.finalBalance < 0
                        ? 'رصيد دائن (له)'
                        : 'حساب متزن'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto">
              <button
                onClick={handlePrint}
                disabled={!currentAccount || filteredRows.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-md text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة الكشف</span>
              </button>
              <button
                onClick={() => setCurrentView('home')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white rounded-md text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-slate-300" />
                <span>إغلاق</span>
              </button>
            </div>
          </div>

          {/* Filter Controls Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Account Containment Combobox (اختر الحساب) */}
            <div className="flex flex-col gap-1 bg-[#1a2533] p-2 rounded-lg border border-slate-700">
              <span className="text-[11px] font-bold text-sky-300 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span>اختر الحساب:</span>
              </span>
              <ContainmentCombobox
                options={accountComboboxOptions}
                value={chosenAccountId}
                onChange={(id) => {
                  setChosenAccountId(id);
                  setSelectedAccountId(id);
                }}
                showCode={settings?.showAccountCode ?? true}
                placeholder="-- جميع الحسابات (اختر) --"
                searchPlaceholder="اسم أو رمز الحساب..."
                className="w-full"
                size="sm"
              />
            </div>

            {/* View Mode Switcher (عرض مفصل / عرض مختصر) */}
            <div className="flex flex-col gap-1 bg-[#1a2533] p-2 rounded-lg border border-slate-700 justify-between">
              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                <ListFilter className="w-3.5 h-3.5 text-amber-400" />
                <span>نمط العرض:</span>
              </span>
              <div className="flex items-center bg-slate-900 p-0.5 rounded-md border border-slate-700 h-8">
                <button
                  type="button"
                  onClick={() => setViewMode('detailed')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'detailed'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ListFilter className="w-3 h-3" />
                  <span>مفصل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('summary')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'summary'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span>مختصر</span>
                </button>
              </div>
            </div>

            {/* Date Range Filter Box */}
            <div className="flex flex-col gap-1 bg-[#1a2533] p-2 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-200 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>الفترة (من - إلى):</span>
                </span>
                {(startDate !== defaultYearStart || endDate !== defaultYearEnd) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate(defaultYearStart);
                      setEndDate(defaultYearEnd);
                    }}
                    className="text-[10px] text-rose-300 hover:text-white underline font-bold"
                    title="إعادة ضبط التاريخ للسنة الحالية"
                  >
                    إعادة ضبط
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  title="من تاريخ"
                  className="bg-white text-slate-900 px-1.5 py-1 rounded text-xs font-bold h-8 focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-300 shadow-xs cursor-pointer w-full text-center"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  title="إلى تاريخ"
                  className="bg-white text-slate-900 px-1.5 py-1 rounded text-xs font-bold h-8 focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-300 shadow-xs cursor-pointer w-full text-center"
                />
              </div>
            </div>

            {/* Containment Search Box */}
            <div className="flex flex-col gap-1 bg-[#1a2533] p-2 rounded-lg border border-slate-700">
              <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-emerald-400" />
                <span>بحث احتواء:</span>
              </span>
              <div className="relative">
                <input
                  type="text"
                  placeholder="بحث في البيان أو رقم المستند..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 text-white placeholder:text-slate-400 font-bold text-xs rounded-md px-2.5 py-1.5 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400 h-8"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2 top-2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Column Visibility Options */}
          <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between flex-wrap gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-black text-amber-300">
                إظهار الأعمدة:
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* الحساب المقابل (افتراضياً غير مفعل) */}
              <label className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-600 text-xs font-bold cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={columnVisibility.showOppositeAccount}
                  onChange={(e) =>
                    setColumnVisibility((prev) => ({ ...prev, showOppositeAccount: e.target.checked }))
                  }
                  className="accent-amber-400 w-3.5 h-3.5 rounded cursor-pointer"
                />
                <span className={columnVisibility.showOppositeAccount ? 'text-amber-300' : 'text-slate-400'}>
                  الحساب المقابل
                </span>
              </label>

              {viewMode === 'detailed' && (
                <>
                  {/* الوزن القائم */}
                  <label className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-600 text-xs font-bold cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={columnVisibility.showGrossWeight}
                      onChange={(e) =>
                        setColumnVisibility((prev) => ({ ...prev, showGrossWeight: e.target.checked }))
                      }
                      className="accent-amber-400 w-3.5 h-3.5 rounded cursor-pointer"
                    />
                    <span className={columnVisibility.showGrossWeight ? 'text-amber-300' : 'text-slate-400'}>
                      الوزن القائم
                    </span>
                  </label>

                  {/* قيمة الخصم */}
                  <label className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-600 text-xs font-bold cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={columnVisibility.showDiscountValue}
                      onChange={(e) =>
                        setColumnVisibility((prev) => ({ ...prev, showDiscountValue: e.target.checked }))
                      }
                      className="accent-amber-400 w-3.5 h-3.5 rounded cursor-pointer"
                    />
                    <span className={columnVisibility.showDiscountValue ? 'text-amber-300' : 'text-slate-400'}>
                      قيمة الخصم
                    </span>
                  </label>

                  {/* نسبة الخصم */}
                  <label className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-600 text-xs font-bold cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={columnVisibility.showDiscountPercent}
                      onChange={(e) =>
                        setColumnVisibility((prev) => ({ ...prev, showDiscountPercent: e.target.checked }))
                      }
                      className="accent-amber-400 w-3.5 h-3.5 rounded cursor-pointer"
                    />
                    <span className={columnVisibility.showDiscountPercent ? 'text-amber-300' : 'text-slate-400'}>
                      نسبة الخصم %
                    </span>
                  </label>

                  {/* الوزن الصافي */}
                  <label className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-600 text-xs font-bold cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={columnVisibility.showNetWeight}
                      onChange={(e) =>
                        setColumnVisibility((prev) => ({ ...prev, showNetWeight: e.target.checked }))
                      }
                      className="accent-amber-400 w-3.5 h-3.5 rounded cursor-pointer"
                    />
                    <span className={columnVisibility.showNetWeight ? 'text-amber-300' : 'text-slate-400'}>
                      الوزن الصافي
                    </span>
                  </label>

                  {/* الكمسيون */}
                  <label className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-600 text-xs font-bold cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={columnVisibility.showCommission}
                      onChange={(e) =>
                        setColumnVisibility((prev) => ({ ...prev, showCommission: e.target.checked }))
                      }
                      className="accent-amber-400 w-3.5 h-3.5 rounded cursor-pointer"
                    />
                    <span className={columnVisibility.showCommission ? 'text-amber-300' : 'text-slate-400'}>
                      الكمسيون
                    </span>
                  </label>

                  {/* الإفرادي */}
                  <label className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-600 text-xs font-bold cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={columnVisibility.showUnitPrice}
                      onChange={(e) =>
                        setColumnVisibility((prev) => ({ ...prev, showUnitPrice: e.target.checked }))
                      }
                      className="accent-amber-400 w-3.5 h-3.5 rounded cursor-pointer"
                    />
                    <span className={columnVisibility.showUnitPrice ? 'text-amber-300' : 'text-slate-400'}>
                      الإفرادي
                    </span>
                  </label>

                  {/* الإجمالي */}
                  <label className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-600 text-xs font-bold cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={columnVisibility.showTotal}
                      onChange={(e) =>
                        setColumnVisibility((prev) => ({ ...prev, showTotal: e.target.checked }))
                      }
                      className="accent-amber-400 w-3.5 h-3.5 rounded cursor-pointer"
                    />
                    <span className={columnVisibility.showTotal ? 'text-amber-300' : 'text-slate-400'}>
                      الإجمالي
                    </span>
                  </label>

                  {/* Select All */}
                  <button
                    type="button"
                    onClick={() =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        showGrossWeight: true,
                        showDiscountValue: true,
                        showDiscountPercent: true,
                        showNetWeight: true,
                        showCommission: true,
                        showUnitPrice: true,
                        showTotal: true,
                      }))
                    }
                    className="text-[11px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded cursor-pointer transition-colors font-bold"
                  >
                    تحديد كل الأعمدة
                  </button>

                  {/* Toggle Expand/Collapse All */}
                  <button
                    type="button"
                    onClick={() => {
                      const hasAnyExpanded = filteredRows.some(
                        (r) => expandedRows[r.id] !== undefined ? expandedRows[r.id] : true
                      );
                      const updated: Record<string, boolean> = {};
                      filteredRows.forEach((r) => {
                        updated[r.id] = !hasAnyExpanded;
                      });
                      setExpandedRows(updated);
                    }}
                    className="text-[11px] bg-slate-700 hover:bg-slate-600 text-amber-300 px-2 py-1 rounded cursor-pointer transition-colors font-bold border border-slate-600"
                  >
                    طي / إظهار كل الفواتير
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden border border-slate-700 w-full">
          <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
            <table className="w-full text-center border-collapse">
              <thead className="sticky top-0 bg-[#2c3e50] text-white text-[11px] sm:text-xs font-bold shadow z-10 whitespace-nowrap">
                <tr>
                  <th className="py-2.5 px-3 border-l border-slate-600 w-28">التاريخ</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 w-36">المستند</th>
                  {columnVisibility.showOppositeAccount && (
                    <th className="py-2.5 px-3 border-l border-slate-600 w-36 text-right">الحساب المقابل</th>
                  )}
                  <th className="py-2.5 px-4 border-l border-slate-600 text-right">البيان والشرح</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 w-28">مدين (لنا)</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 w-28">دائن (له)</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 w-32">الرصيد التراكمي</th>
                  {viewMode === 'detailed' && (
                    <th className="py-2.5 px-2 border-l border-slate-600 w-16">التفاصيل</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] sm:text-xs font-semibold text-slate-800 whitespace-nowrap">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={(viewMode === 'detailed' ? 7 : 6) + (columnVisibility.showOppositeAccount ? 1 : 0)}
                      className="py-12 text-slate-500 font-semibold text-sm"
                    >
                      {!currentAccount
                        ? 'يرجى اختيار حساب من القائمة أعلاه لعرض كشف الحساب'
                        : 'لا توجد حركات مسجلة لهذا الحساب وفق خيارات التصفية'}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => {
                    const isExpanded = expandedRows[row.id] !== undefined ? !!expandedRows[row.id] : (viewMode === 'detailed');
                    const hasDetails = !!row.rawInvoice?.rows?.length;

                    const isInvoice = !!row.rawInvoice || row.docType === 'invoice_seller' || row.docType === 'invoice_buyer' || String(row.id).startsWith('inv_');
                    const docTitle =
                      row.docType === 'opening'
                        ? 'رصيد افتتاحي'
                        : isInvoice
                        ? `فاتورة كمسيون رقم ${row.docNumber}`
                        : row.docType === 'voucher_receipt'
                        ? `سند قبض رقم ${row.docNumber}`
                        : row.docType === 'voucher_payment'
                        ? `سند دفع رقم ${row.docNumber}`
                        : row.docNumber
                        ? `مستند رقم ${row.docNumber}`
                        : '-';

                    return (
                      <React.Fragment key={row.id}>
                        <tr
                          onDoubleClick={() => handleRowDoubleClick(row)}
                          title="انقر مرتين لفتح الحركة الأصلية (فاتورة / سند / بطاقة الحساب)"
                          className={`transition-colors font-semibold cursor-pointer select-none ${
                            index % 2 === 0 ? 'bg-[#e2edf7]' : 'bg-white'
                          } hover:bg-sky-200/90 active:bg-sky-300/80`}
                        >
                          {/* 1. Date */}
                          <td className="py-2 px-3 border-l border-slate-300 font-mono text-slate-700">
                            {row.date}
                          </td>

                          {/* 2. Document Name & Number */}
                          <td className="py-2 px-3 border-l border-slate-300 font-bold text-slate-900 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowDoubleClick(row);
                              }}
                              title="انقر لفتح المستند الأصلي"
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-transform hover:scale-105 active:scale-95 shadow-2xs ${
                                row.docType === 'opening'
                                  ? 'bg-slate-200 text-slate-800 border border-slate-300 hover:bg-slate-300'
                                  : isInvoice
                                  ? 'bg-blue-100 text-blue-950 border border-blue-300 font-mono hover:bg-blue-200'
                                  : row.docType === 'voucher_payment'
                                  ? 'bg-amber-100 text-amber-950 border border-amber-300 font-mono hover:bg-amber-200'
                                  : row.docType === 'voucher_receipt'
                                  ? 'bg-emerald-100 text-emerald-950 border border-emerald-300 font-mono hover:bg-emerald-200'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              <span>{docTitle}</span>
                            </button>
                          </td>

                          {/* 3. Opposite Account */}
                          {columnVisibility.showOppositeAccount && (
                            <td className="py-2 px-3 border-l border-slate-300 text-right font-bold text-slate-900 whitespace-nowrap">
                              {row.oppositeAccount && row.oppositeAccount !== '-' ? (
                                <span className="text-slate-900 font-bold">{row.oppositeAccount}</span>
                              ) : (
                                <span className="text-slate-400 font-normal">-</span>
                              )}
                            </td>
                          )}

                          {/* 4. Description */}
                          <td className="py-2 px-4 border-l border-slate-300 text-right font-medium text-slate-900 whitespace-normal">
                            {row.description}
                          </td>

                          {/* 5. Debit */}
                          <td className="py-2 px-3 border-l border-slate-300 font-mono font-bold text-slate-900">
                            {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                          </td>

                          {/* 6. Credit */}
                          <td className="py-2 px-3 border-l border-slate-300 font-mono font-bold text-slate-900">
                            {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                          </td>

                          {/* 7. Balance */}
                          <td
                            className={`py-2 px-3 border-l border-slate-300 font-mono font-black ${
                              row.balance > 0
                                ? 'text-emerald-800'
                                : row.balance < 0
                                ? 'text-rose-800'
                                : 'text-slate-700'
                            }`}
                          >
                            {formatCurrency(row.balance)}
                          </td>

                          {/* 8. Details */}
                          {viewMode === 'detailed' && (
                            <td className="py-2 px-2 border-l border-slate-300">
                              {hasDetails ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRowExpand(row.id);
                                  }}
                                  className={`p-1.5 rounded transition-all cursor-pointer ${
                                    isExpanded
                                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                                  }`}
                                  title={isExpanded ? 'إخفاء تفاصيل البضاعة' : 'إظهار تفاصيل البضاعة'}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                          )}
                        </tr>

                        {/* Detailed Sub-Table with User-Configured Columns */}
                        {viewMode === 'detailed' && isExpanded && hasDetails && (
                          <tr className="bg-slate-100/95 border-b-2 border-slate-400">
                            <td colSpan={7 + (columnVisibility.showOppositeAccount ? 1 : 0)} className="p-2.5">
                              <div className="bg-white rounded-lg border border-slate-300 p-2.5 shadow-xs">
                                <div className="flex items-center justify-between mb-2 text-xs font-bold text-slate-700 border-b border-slate-200 pb-1.5 flex-wrap gap-2">
                                  <span>تفصيل بضاعة الفاتورة رقم ({row.docNumber})</span>
                                  <div className="flex items-center gap-3">
                                    <span>إجمالي البضاعة: <strong className="font-mono text-slate-900">{formatCurrency(row.rawInvoice?.totalAmount || 0)}</strong></span>
                                    <span>عمولة كمسيون: <strong className="font-mono text-amber-800">{formatCurrency(row.rawInvoice?.commissionValue || 0)} ({row.rawInvoice?.commissionRate}%)</strong></span>
                                    <span>صافي الفاتورة: <strong className="font-mono text-emerald-800">{formatCurrency(row.rawInvoice?.netAmount || 0)}</strong></span>
                                  </div>
                                </div>

                                <table className="w-full text-center border-collapse text-[11px]">
                                  <thead className="bg-slate-200 text-slate-800 font-bold">
                                    <tr>
                                      <th className="py-1 px-2 border border-slate-300">المادة</th>
                                      {columnVisibility.showGrossWeight && (
                                        <th className="py-1 px-2 border border-slate-300">الوزن القائم</th>
                                      )}
                                      {columnVisibility.showDiscountValue && (
                                        <th className="py-1 px-2 border border-slate-300">قيمة الخصم</th>
                                      )}
                                      {columnVisibility.showDiscountPercent && (
                                        <th className="py-1 px-2 border border-slate-300">نسبة الخصم %</th>
                                      )}
                                      {columnVisibility.showNetWeight && (
                                        <th className="py-1 px-2 border border-slate-300">الوزن الصافي</th>
                                      )}
                                      {columnVisibility.showUnitPrice && (
                                        <th className="py-1 px-2 border border-slate-300">الإفرادي</th>
                                      )}
                                      {columnVisibility.showTotal && (
                                        <th className="py-1 px-2 border border-slate-300">الإجمالي</th>
                                      )}
                                      {columnVisibility.showCommission && (
                                        <th className="py-1 px-2 border border-slate-300">الكمسيون</th>
                                      )}
                                      <th className="py-1 px-2 border border-slate-300">ملاحظات</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.rawInvoice?.rows.map((pRow, pIdx) => {
                                      const rowCommission = Math.round(
                                        (Number(pRow.total || 0) * (row.rawInvoice?.commissionRate || 5)) / 100
                                      );

                                      return (
                                        <tr key={pIdx} className="hover:bg-slate-50 font-semibold">
                                          <td className="py-1 px-2 border border-slate-300 text-right font-bold text-slate-900">
                                            {pRow.itemName}
                                          </td>
                                          {columnVisibility.showGrossWeight && (
                                            <td className="py-1 px-2 border border-slate-300 font-mono">
                                              {pRow.grossWeight || '-'}
                                            </td>
                                          )}
                                          {columnVisibility.showDiscountValue && (
                                            <td className="py-1 px-2 border border-slate-300 font-mono text-amber-900">
                                              {pRow.discountTare ? `${pRow.discountTare} ${pRow.unit || 'كغ'}` : '-'}
                                            </td>
                                          )}
                                          {columnVisibility.showDiscountPercent && (
                                            <td className="py-1 px-2 border border-slate-300 font-mono text-amber-900">
                                              {pRow.discountPercent ? `${pRow.discountPercent}%` : '-'}
                                            </td>
                                          )}
                                          {columnVisibility.showNetWeight && (
                                            <td className="py-1 px-2 border border-slate-300 font-mono font-bold text-emerald-700">
                                              {pRow.netWeight} {pRow.unit || 'كغ'}
                                            </td>
                                          )}
                                          {columnVisibility.showUnitPrice && (
                                            <td className="py-1 px-2 border border-slate-300 font-mono">
                                              {formatCurrency(pRow.unitPrice)}
                                            </td>
                                          )}
                                          {columnVisibility.showTotal && (
                                            <td className="py-1 px-2 border border-slate-300 font-mono font-bold text-slate-900">
                                              {formatCurrency(pRow.total)}
                                            </td>
                                          )}
                                          {columnVisibility.showCommission && (
                                            <td className="py-1 px-2 border border-slate-300 font-mono text-rose-800">
                                              {formatCurrency(rowCommission)} ({row.rawInvoice?.commissionRate}%)
                                            </td>
                                          )}
                                          <td className="py-1 px-2 border border-slate-300 text-slate-600">
                                            {pRow.notes || '-'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6. Bottom Summary Table (جدول إجماليات الكشف) */}
        <div className="bg-[#233142] rounded-lg shadow-md border border-slate-700 overflow-hidden w-full">
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs font-bold whitespace-nowrap">
              <thead className="bg-[#1a2533] text-slate-300 border-b border-slate-700 text-[11px] sm:text-xs">
                <tr>
                  <th className="py-2 px-3 border-l border-slate-700 font-bold w-1/5">مجموع المدين (لنا)</th>
                  <th className="py-2 px-3 border-l border-slate-700 font-bold w-1/5">مجموع الدائن (له)</th>
                  <th className="py-2 px-3 border-l border-slate-700 font-bold w-1/5">صافي الرصيد الختامي</th>
                  <th className="py-2 px-3 border-l border-slate-700 font-bold w-1/5">إجمالي الوزن القائم</th>
                  <th className="py-2 px-3 font-bold w-1/5">إجمالي الوزن الصافي</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-[#233142] text-white">
                  <td className="py-2.5 px-3 border-l border-slate-700 font-mono text-sm sm:text-base font-black text-emerald-400">
                    {formatCurrency(activeSummaryStats.totalDebit)}
                  </td>
                  <td className="py-2.5 px-3 border-l border-slate-700 font-mono text-sm sm:text-base font-black text-rose-400">
                    {formatCurrency(activeSummaryStats.totalCredit)}
                  </td>
                  <td className="py-2.5 px-3 border-l border-slate-700 font-mono text-sm sm:text-base font-black">
                    <span
                      className={`${
                        activeSummaryStats.finalBalance > 0
                          ? 'text-emerald-400'
                          : activeSummaryStats.finalBalance < 0
                          ? 'text-rose-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {formatCurrency(Math.abs(activeSummaryStats.finalBalance))}
                    </span>{' '}
                    <span
                      className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded border inline-block mr-1.5 ${
                        activeSummaryStats.finalBalance > 0
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                          : activeSummaryStats.finalBalance < 0
                          ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                          : 'bg-slate-800 text-slate-300 border-slate-600'
                      }`}
                    >
                      {activeSummaryStats.finalBalance > 0
                        ? '(لنا)'
                        : activeSummaryStats.finalBalance < 0
                        ? '(له)'
                        : '(متزن)'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 border-l border-slate-700 font-mono text-sm sm:text-base font-black text-sky-300">
                    {formatCurrency(activeSummaryStats.totalGrossWeight)} <span className="text-xs font-bold text-slate-400">كغ</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-sm sm:text-base font-black text-amber-300">
                    {formatCurrency(activeSummaryStats.totalNetWeight)} <span className="text-xs font-bold text-slate-400">كغ</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
