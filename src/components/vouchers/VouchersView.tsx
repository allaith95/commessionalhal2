import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  Plus,
  Trash2,
  Save,
  Printer,
  Edit,
  FileText,
  AlertCircle,
  X,
  Calendar,
  Wallet,
  Receipt,
  CreditCard,
  Layers,
  Coins,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Voucher, VoucherRow, Account } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { ContainmentCombobox, ComboboxOption } from '../common/ContainmentCombobox';
import { NumericInput } from '../common/NumericInput';
import { AccountCardModal } from '../accounts/AccountCardModal';
import { tafqeetNumber, formatCurrency } from '../../utils/tafqeet';
import { calculateDynamicAccountBalances } from '../../utils/accounting';
import { handleGridKeyDown } from '../../utils/gridNavigation';

interface VouchersViewProps {
  type: 'دفع' | 'قبض';
  onClose?: () => void;
}

export const VouchersView: React.FC<VouchersViewProps> = ({ type, onClose }) => {
  const {
    vouchers,
    accounts,
    invoices,
    settings,
    addVoucher,
    updateVoucher,
    deleteVoucher,
    selectedVoucherId,
    setSelectedVoucherId,
    triggerPrint,
    setCurrentView,
    showNotification,
    loadFromPostgres,
  } = useApp();

  // Trigger live PostgreSQL fetch on view mount
  useEffect(() => {
    loadFromPostgres();
  }, [loadFromPostgres]);

  const isPayment = type === 'دفع';
  const typeTitle = isPayment ? 'سند دفع' : 'سند قبض';
  const filteredVouchers = useMemo(() => {
    return vouchers
      .filter((v) => v.type === type)
      .sort((a, b) => {
        const numA = parseInt(String(a.voucherNumber), 10) || 0;
        const numB = parseInt(String(b.voucherNumber), 10) || 0;
        return numA - numB;
      });
  }, [vouchers, type]);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Modal dialog states for quick account creation
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountModalTarget, setAccountModalTarget] = useState<'main' | 'row'>('main');
  const [accountModalRowIndex, setAccountModalRowIndex] = useState<number | null>(null);
  const [accountModalInitialName, setAccountModalInitialName] = useState('');

  // Missing entity prompt modal
  const [notFoundDialog, setNotFoundDialog] = useState<{
    isOpen: boolean;
    name: string;
    target: 'main' | 'row';
    rowIndex?: number;
  }>({
    isOpen: false,
    name: '',
    target: 'main',
  });

  // Helper to calculate next sequential voucher number starting strictly from 1
  const getNextVoucherNumber = (vList?: unknown): string => {
    const safeVList = Array.isArray(vList)
      ? vList
      : Array.isArray(filteredVouchers)
      ? filteredVouchers
      : [];
    const numbers = safeVList
      .map((v) => (v && v.voucherNumber ? parseInt(String(v.voucherNumber), 10) : 0))
      .filter((n) => !isNaN(n) && n > 0);
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    return String(maxNum + 1);
  };

  // Helper to create empty rows (default 5 rows)
  const createDefaultRows = (count: number = 5): VoucherRow[] => {
    return Array.from({ length: count }, (_, idx) => ({
      id: `vr_${idx + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      rowNumber: idx + 1,
      amount: 0,
      accountCode: '',
      accountName: '',
      notes: '',
    }));
  };

  // Form State
  const [voucherNumber, setVoucherNumber] = useState<string>('1');
  const [mainAccountCode, setMainAccountCode] = useState<string>('1');
  const [mainAccountName, setMainAccountName] = useState<string>('الصندوق');
  const [currency, setCurrency] = useState<string>(settings?.currency || 'ل.س');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [rows, setRows] = useState<VoucherRow[]>(() => createDefaultRows(5));

  // Computed Totals
  const totalAmount = useMemo(() => {
    return rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [rows]);

  const validRowsCount = useMemo(() => {
    return rows.filter((r) => Number(r.amount) > 0 && r.accountName.trim()).length;
  }, [rows]);

  // 1. Calculate live dynamic accounting balances for all accounts
  const dynamicBalances = useMemo(
    () => calculateDynamicAccountBalances(accounts, invoices, vouchers),
    [accounts, invoices, vouchers]
  );

  // 2. Identify all parent accounts (الحسابات الرئيسية التي يتفرع منها أبناء أو مجموعات رئيسية)
  const parentAccountNamesSet = useMemo(() => {
    const set = new Set<string>();
    accounts.forEach((acc) => {
      if (acc.parentAccount && acc.parentAccount.trim()) {
        set.add(acc.parentAccount.trim().toLowerCase());
      }
    });
    return set;
  }, [accounts]);

  const isParentAccount = useMemo(() => {
    return (acc?: Partial<Account> | { name?: string; code?: string; parentAccount?: string; isSystem?: boolean } | null): boolean => {
      if (!acc) return false;
      const name = (acc.name || '').trim().toLowerCase();
      const code = (acc.code || '').trim().toLowerCase();
      if (!name && !code) return false;

      // System basic accounts (الصندوق 1، الكمسيون 2، المصاريف 3، المزارعين 4، التجار 5)
      if (acc.isSystem || ['1', '2', '3', '4', '5'].includes(code)) {
        return true;
      }

      // If any other account has this as parentAccount
      if (parentAccountNamesSet.has(name) || parentAccountNamesSet.has(code)) {
        return true;
      }

      // Root parent headers
      const rootCategories = [
        'المزارعين',
        'التجار',
        'المصاريف',
        'الصندوق',
        'الكمسيون',
        'المبيعات',
        'المشتريات',
        'أصول',
        'اصول',
        'خصوم',
        'إيرادات',
        'ايرادات',
        'حسابات ختامية',
        'حسابات ختاميه',
      ];
      if (rootCategories.includes(acc.name?.trim() || '')) {
        return true;
      }
      return false;
    };
  }, [parentAccountNamesSet]);

  // Main Account Combobox options (حساب الصندوق / المصرف)
  const mainAccountComboboxOptions = useMemo<ComboboxOption[]>(() => {
    return accounts.map((acc) => {
      const balance = dynamicBalances.get(acc.id) ?? (acc.currentBalance !== undefined ? Number(acc.currentBalance) : (Number(acc.openingDebit) || 0) - (Number(acc.openingCredit) || 0));
      const formattedBalance = formatCurrency(Math.abs(balance));
      const balanceSuffix = balance > 0 ? '(لنا)' : balance < 0 ? '(له)' : '(متزن)';
      return {
        id: acc.name,
        label: acc.name,
        code: acc.code,
        badge: `رصيد: ${formattedBalance} ${settings?.currency || 'ل.س'} ${balanceSuffix}`,
      };
    });
  }, [accounts, dynamicBalances, settings]);

  // Row Account Combobox options (الابناء فقط - منع ذكر الحسابات الرئيسية مع ذكر الرصيد بجانب الاسم)
  const rowAccountComboboxOptions = useMemo<ComboboxOption[]>(() => {
    // Only child/sub accounts (الأبناء فقط)
    const childAccounts = accounts.filter((acc) => !isParentAccount(acc));

    return childAccounts.map((acc) => {
      const balance = dynamicBalances.get(acc.id) ?? (acc.currentBalance !== undefined ? Number(acc.currentBalance) : (Number(acc.openingDebit) || 0) - (Number(acc.openingCredit) || 0));
      const formattedBalance = formatCurrency(Math.abs(balance));
      const balanceSuffix = balance > 0 ? '(لنا)' : balance < 0 ? '(له)' : '(متزن)';

      return {
        id: acc.name,
        label: acc.name,
        code: acc.code,
        badge: `الرصيد: ${formattedBalance} ${settings?.currency || 'ل.س'} ${balanceSuffix}`,
      };
    });
  }, [accounts, isParentAccount, dynamicBalances, settings]);

  // Load selected voucher or start with new empty voucher
  useEffect(() => {
    if (selectedVoucherId) {
      const foundIdx = filteredVouchers.findIndex((v) => v.id === selectedVoucherId);
      if (foundIdx !== -1) {
        setCurrentIndex(foundIdx);
        loadVoucher(filteredVouchers[foundIdx]);
        return;
      }
    }

    // Default to a new voucher with empty 5 rows
    handleNew();
  }, [selectedVoucherId, type]);

  const loadVoucher = (v?: Voucher) => {
    if (!v) {
      handleNew();
      return;
    }
    setCurrentId(v.id);
    setVoucherNumber(v.voucherNumber);
    setMainAccountCode(v.mainAccountCode || '1');
    setMainAccountName(v.mainAccountName || 'الصندوق');
    setCurrency(v.currency || settings?.currency || 'ل.س');
    setDate(v.date);
    setNotes(v.notes || '');

    const currentRows = [...v.rows];
    while (currentRows.length < 5) {
      currentRows.push({
        id: `vr_pad_${currentRows.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        rowNumber: currentRows.length + 1,
        amount: 0,
        accountCode: '',
        accountName: '',
        notes: '',
      });
    }
    setRows(currentRows);
  };

  const handleNew = (forcedNumber?: string, overrideList?: Voucher[]) => {
    const list = Array.isArray(overrideList) ? overrideList : filteredVouchers;
    setCurrentId(null);
    setSelectedVoucherId(null);
    setCurrentIndex(list.length);
    const nextNum = forcedNumber || getNextVoucherNumber(list);

    setVoucherNumber(nextNum);
    setMainAccountCode('1');
    setMainAccountName('الصندوق');
    setCurrency(settings?.currency || 'ل.س');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setRows(createDefaultRows(5));
  };

  // Navigation handlers (مطابقة تماماً لآلية الفاتورة)
  const handleFirst = () => {
    if (filteredVouchers.length > 0) {
      setCurrentIndex(0);
      loadVoucher(filteredVouchers[0]);
    }
  };

  const handlePrev = () => {
    if (filteredVouchers.length === 0) return;
    if (currentId === null) {
      // In new voucher mode, navigate to the latest existing saved voucher
      const lastIdx = filteredVouchers.length - 1;
      setCurrentIndex(lastIdx);
      loadVoucher(filteredVouchers[lastIdx]);
    } else if (currentIndex > 0) {
      const newIdx = currentIndex - 1;
      setCurrentIndex(newIdx);
      loadVoucher(filteredVouchers[newIdx]);
    }
  };

  const handleNext = () => {
    if (filteredVouchers.length === 0 || currentId === null) return;
    if (currentIndex < filteredVouchers.length - 1) {
      const newIdx = currentIndex + 1;
      setCurrentIndex(newIdx);
      loadVoucher(filteredVouchers[newIdx]);
    }
  };

  const handleLast = () => {
    if (filteredVouchers.length > 0) {
      const lastIdx = filteredVouchers.length - 1;
      setCurrentIndex(lastIdx);
      loadVoucher(filteredVouchers[lastIdx]);
    }
  };

  // Row operations
  const updateRow = (idx: number, field: keyof VoucherRow, value: any) => {
    setRows((prev) => {
      const updated = [...prev];
      const target = { ...updated[idx], [field]: value };
      if (field === 'accountName') {
        const found = accounts.find(
          (a) =>
            a.name.trim().toLowerCase() === String(value).trim().toLowerCase() ||
            a.id === value ||
            a.code === value
        );
        if (found) {
          if (isParentAccount(found)) {
            showNotification(
              `تنبيه: "${found.name}" هو حساب رئيسي. يرجى اختيار حساب فرعي (أحد الأبناء) فقط في أسطر السند`,
              'error'
            );
            return prev;
          }
          target.accountCode = found.code;
          target.accountName = found.name;
        }
      }
      updated[idx] = target;
      return updated;
    });
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `vr_${Date.now()}_${prev.length + 1}`,
        rowNumber: prev.length + 1,
        amount: 0,
        accountCode: '',
        accountName: '',
        notes: '',
      },
    ]);
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows((prev) =>
      prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, rowNumber: i + 1 }))
    );
  };

  // Account creation handling
  const handleAccountCreated = (newAcc: Account) => {
    if (accountModalTarget === 'main') {
      setMainAccountName(newAcc.name);
      setMainAccountCode(newAcc.code);
    } else if (accountModalRowIndex !== null && accountModalRowIndex >= 0) {
      if (isParentAccount(newAcc)) {
        showNotification(
          `تنبيه: "${newAcc.name}" هو حساب رئيسي. لا يمكن إضافته في أسطر السند`,
          'error'
        );
        return;
      }
      updateRow(accountModalRowIndex, 'accountName', newAcc.name);
      updateRow(accountModalRowIndex, 'accountCode', newAcc.code);
    }
    setAccountModalOpen(false);
  };

  // Save handler
  const handleSave = () => {
    const validRows = rows.filter((r) => Number(r.amount) > 0 && r.accountName.trim());
    if (validRows.length === 0) {
      showNotification('يرجى إدخال مبلغ وحساب في سطر واحد على الأقل', 'error');
      return;
    }

    // Verify that NO parent account is entered in any row
    for (const r of validRows) {
      const acc = accounts.find(
        (a) =>
          a.name.trim().toLowerCase() === r.accountName.trim().toLowerCase() ||
          a.code === r.accountCode
      );
      if (acc && isParentAccount(acc)) {
        showNotification(
          `لا يمكن حفظ السند لأن الحساب "${acc.name}" حساب رئيسي. يرجى اختيار حسابات فرعية (أبناء) فقط في أسطر السند.`,
          'error'
        );
        return;
      }
    }

    const payload: Omit<Voucher, 'id'> = {
      voucherNumber: voucherNumber.trim() || '1',
      type,
      mainAccountCode,
      mainAccountName,
      currency,
      date,
      notes,
      rows: validRows,
      totalAmount,
    };

    if (currentId) {
      updateVoucher({ ...payload, id: currentId });
      showNotification(`تم تحديث ${typeTitle} رقم ${voucherNumber} بنجاح`, 'success');
      // البقاء في نفس السند عند التعديل وعدم التصفير
    } else {
      const created = addVoucher(payload);
      showNotification(`تم حفظ ${typeTitle} رقم ${voucherNumber} بنجاح`, 'success');
      const updatedList = [...filteredVouchers, created];
      const nextNum = getNextVoucherNumber(updatedList);
      handleNew(nextNum, updatedList);
    }
  };

  // Delete handler
  const handleDelete = () => {
    if (currentId) {
      deleteVoucher(currentId);
      setShowDeleteConfirm(false);
      showNotification(`تم حذف ${typeTitle} بنجاح`, 'info');
      handleNew();
    }
  };

  // Print handler
  const handlePrint = () => {
    const validRows = rows.filter((r) => Number(r.amount) > 0);
    const currentVoucherData: Voucher = {
      id: currentId || 'temp',
      voucherNumber,
      type,
      mainAccountCode,
      mainAccountName,
      currency,
      date,
      notes,
      rows: validRows.length > 0 ? validRows : rows.slice(0, 3),
      totalAmount,
    };

    triggerPrint(isPayment ? 'voucher_payment' : 'voucher_receipt', currentVoucherData);
  };

  // Current voucher snapshot for live preview
  const currentVoucherSnapshot: Voucher = useMemo(() => {
    return {
      id: currentId || 'temp',
      voucherNumber,
      type,
      mainAccountCode,
      mainAccountName,
      currency,
      date,
      notes,
      rows: rows.filter((r) => Number(r.amount) > 0 || r.accountName.trim()),
      totalAmount,
    };
  }, [currentId, voucherNumber, type, mainAccountCode, mainAccountName, currency, date, notes, rows, totalAmount]);

  // Keyboard shortcuts (F2 Save, F3 New, F4 Print, F9 Delete)
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const handleNewRef = useRef(handleNew);
  handleNewRef.current = handleNew;
  const handlePrintRef = useRef(handlePrint);
  handlePrintRef.current = handlePrint;
  const handleDeleteTriggerRef = useRef(() => {
    if (currentId) setShowDeleteConfirm(true);
  });
  handleDeleteTriggerRef.current = () => {
    if (currentId) setShowDeleteConfirm(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' || e.code === 'F2' || e.keyCode === 113) {
        e.preventDefault();
        e.stopPropagation();
        handleSaveRef.current();
      } else if (e.key === 'F3' || e.code === 'F3' || e.keyCode === 114) {
        e.preventDefault();
        e.stopPropagation();
        handleNewRef.current();
      } else if (e.key === 'F4' || e.code === 'F4' || e.keyCode === 115) {
        e.preventDefault();
        e.stopPropagation();
        handlePrintRef.current();
      } else if (e.key === 'F9' || e.code === 'F9' || e.keyCode === 120) {
        e.preventDefault();
        e.stopPropagation();
        handleDeleteTriggerRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  return (
    <div className="w-full h-[calc(100vh-56px)] bg-[#7196b8] p-1.5 sm:p-2 md:p-2.5 flex flex-col justify-start overflow-hidden animate-in fade-in duration-150" dir="rtl">
      {/* Full-Screen Voucher Card with fixed header, scrollable table body, and pinned bottom bar */}
      <div className="w-full h-full flex flex-col bg-[#3c4f65] text-white rounded-xl shadow-2xl border border-slate-600/80 overflow-hidden min-h-0">
        {/* Top Header Row: Title, Number, Date on Right, Icon-Only Navigation & Close on Left */}
        <div className="flex items-center justify-between border-b border-slate-500/50 px-3 md:px-5 py-2 shrink-0 flex-wrap gap-2 bg-[#34465a]">
          <div className="flex items-center gap-3 flex-wrap">
            <div
              className={`p-1.5 rounded-lg border shadow-xs ${
                isPayment
                  ? 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
              }`}
            >
              {isPayment ? <CreditCard className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
            </div>
            
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg md:text-xl font-black text-white tracking-wide">
                {typeTitle}
              </h2>

              {/* Voucher Number Badge */}
              <div className="flex items-center gap-1 bg-[#1e2a38] px-2 py-0.5 rounded-md border border-amber-500/40 shadow-inner">
                <span className="text-[11px] font-bold text-amber-400 shrink-0">رقم:</span>
                <input
                  type="text"
                  value={voucherNumber}
                  onChange={(e) => setVoucherNumber(e.target.value)}
                  className="w-12 sm:w-14 bg-amber-400 text-slate-950 px-1 py-0.5 rounded text-xs font-mono font-black text-center border border-amber-300 shadow-inner select-all focus:outline-none focus:ring-1 focus:ring-amber-500"
                  title="رقم السند تسلسلي"
                />
              </div>

              {/* Date Input */}
              <div className="flex items-center gap-1.5 bg-[#1e2a38] px-2 py-0.5 rounded-md border border-slate-500/60 shadow-inner">
                <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-[11px] font-bold text-slate-300 shrink-0">التاريخ:</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-white text-slate-900 px-1.5 py-0.5 rounded text-xs font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Navigation buttons: مثل الفاتورة (الأخير | التالي | السابق | الأول) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#243343] p-1 rounded-lg border border-slate-600/70 shadow-inner">
              <button
                type="button"
                onClick={handleLast}
                disabled={filteredVouchers.length === 0 || currentId === null || currentIndex >= filteredVouchers.length - 1}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="السجل الأخير"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={filteredVouchers.length === 0 || currentId === null || currentIndex >= filteredVouchers.length - 1}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="التالي"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handlePrev}
                disabled={filteredVouchers.length === 0 || (currentId !== null && currentIndex === 0)}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="السابق"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleFirst}
                disabled={filteredVouchers.length === 0 || (currentId !== null && currentIndex === 0)}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="السجل الأول"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <span className="text-[11px] text-slate-300 font-bold px-2 min-w-[70px] text-center font-mono">
                {currentId === null
                  ? `(جديد / ${filteredVouchers.length})`
                  : `(${currentIndex + 1} / ${filteredVouchers.length})`}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose || (() => setCurrentView('home'))}
              className="p-1.5 bg-slate-700/80 hover:bg-slate-600 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top 2-Card Metadata Grid: Main Account (Right), General Notes (Left) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-2.5 sm:p-3 shrink-0 text-xs border-b border-slate-600/70 bg-[#2e3e50]">
          
          {/* Card 1: الحساب الرئيسي (الصندوق / المصرف) */}
          <div className="bg-[#334457] border border-slate-600/70 p-2.5 sm:p-3 rounded-lg shadow-sm flex flex-col justify-between gap-2.5">
            {/* Header Row: Label */}
            <div className="flex items-center justify-between border-b border-slate-500/40 pb-1.5">
              <label className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>الصندوق / المصرف</span>
                <span className="text-rose-400 font-bold mr-0.5">*</span>
              </label>
            </div>

            {/* Combobox for Main Account */}
            <div className="w-full">
              <ContainmentCombobox
                options={mainAccountComboboxOptions}
                value={mainAccountName}
                showCode={settings.showAccountCode}
                onChange={(val, opt) => {
                  if (opt) {
                    setMainAccountName(opt.label);
                    if (opt.code) setMainAccountCode(opt.code);
                  } else {
                    setMainAccountName(val);
                    const found = accounts.find((a) => a.name === val || a.code === val);
                    if (found) {
                      setMainAccountCode(found.code);
                    } else if (val.trim()) {
                      setNotFoundDialog({
                        isOpen: true,
                        name: val.trim(),
                        target: 'main',
                      });
                    }
                  }
                }}
                placeholder="-- اختر حساب الصندوق أو المصرف --"
                searchPlaceholder="ابحث بالاسم أو الرمز..."
                className="w-full text-right"
              />
            </div>
          </div>

          {/* Card 2: البيان العام والملاحظات */}
          <div className="bg-[#334457] border border-slate-600/70 p-2.5 sm:p-3 rounded-lg shadow-sm flex flex-col justify-between gap-2">
            <div className="flex items-center gap-2 border-b border-slate-500/40 pb-1.5">
              <FileText className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-xs text-slate-200">البيان العام / ملاحظات السند</span>
            </div>

            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب ملاحظات عامة حول السند أو سبب الصرف/القبض..."
              className="w-full flex-1 bg-white text-slate-900 px-2.5 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-400 border border-slate-300 resize-none h-[68px]"
            ></textarea>
          </div>

        </div>

        {/* Middle Section: Table with flexible height taking full remaining space */}
        <div className="flex-1 min-h-0 flex flex-col p-2 sm:p-2.5 md:p-3 bg-[#263545] overflow-hidden">
          
          {/* Table Toolbar */}
          <div className="flex items-center justify-between gap-2 pb-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-slate-700/80 rounded-md text-slate-200">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <h3 className="text-xs md:text-sm font-black text-white">
                جدول حسابات السند (الحسابات الفرعية فقط)
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة سطر جديد</span>
              </button>
            </div>
          </div>

          {/* Table Container - fills all available middle space with internal scroll */}
          <div id="voucher-table-root" className="flex-1 min-h-0 bg-white rounded-lg overflow-y-auto overflow-x-auto border border-slate-600 shadow-inner relative">
            <table className="w-full min-w-full text-center border-collapse text-xs min-h-full">
              <thead className="sticky top-0 z-20 bg-[#253342] text-slate-100 font-bold border-b border-slate-700 shadow-xs">
                <tr>
                  <th className="py-2 px-2 border-l border-slate-700 w-12 text-center">م</th>
                  <th className="py-2 px-3 border-l border-slate-700 w-44 text-center">
                    {isPayment ? 'المبلغ المدين' : 'المبلغ الدائن'}
                  </th>
                  <th className="py-2 px-3 border-l border-slate-700 min-w-[280px] text-right">
                    الحساب الفرعي (مع الرصيد)
                  </th>
                  <th className="py-2 px-3 border-l border-slate-700 min-w-[200px] text-right">
                    البيان
                  </th>
                  <th className="py-2 px-2 w-12 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 font-semibold text-slate-900 bg-white">
                {rows.map((row, idx) => {
                  const isEven = idx % 2 === 0;

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-amber-50/70 transition-colors ${
                        isEven ? 'bg-[#eef4f9]' : 'bg-white'
                      }`}
                    >
                      {/* رقم السطر */}
                      <td className="py-1.5 px-2 border-l border-slate-300 font-black text-slate-800 bg-slate-200/60 font-mono text-xs">
                        {idx + 1}
                      </td>

                      {/* المبلغ المدين / الدائن */}
                      <td className="py-1.5 px-2 border-l border-slate-300">
                        <div className="relative flex items-center">
                          <NumericInput
                            data-grid-row={idx}
                            data-grid-col={0}
                            value={row.amount}
                            onChange={(val) => updateRow(idx, 'amount', val)}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            onKeyDown={(e) => handleGridKeyDown(e, idx, 0, 'voucher-table-root', addRow)}
                            placeholder="0"
                            className="w-full bg-emerald-50 text-emerald-950 font-mono font-black text-xs md:text-sm px-2 py-1 rounded border border-emerald-300 text-center focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </td>

                      {/* الحساب الفرعي مع ذكر الرصيد بجانب الاسم */}
                      <td className="py-1.5 px-2 border-l border-slate-300 text-right">
                        <div className="flex flex-col gap-1">
                          <ContainmentCombobox
                            options={rowAccountComboboxOptions}
                            value={row.accountName}
                            showCode={settings.showAccountCode}
                            onChange={(val, opt) => {
                              const name = opt ? opt.label : val;
                              const found = accounts.find(
                                (a) =>
                                  a.name.trim().toLowerCase() === name.trim().toLowerCase() ||
                                  a.code === name
                              );
                              if (found && isParentAccount(found)) {
                                showNotification(
                                  `تنبيه: "${found.name}" هو حساب رئيسي. يُسمح فقط باختيار الحسابات الفرعية (الأبناء) في أسطر السند`,
                                  'error'
                                );
                                return;
                              }
                              updateRow(idx, 'accountName', name);
                              if (opt?.code) {
                                updateRow(idx, 'accountCode', opt.code);
                              } else if (found) {
                                updateRow(idx, 'accountCode', found.code);
                              } else if (name.trim()) {
                                setNotFoundDialog({
                                  isOpen: true,
                                  name: name.trim(),
                                  target: 'row',
                                  rowIndex: idx,
                                });
                              }
                            }}
                            allowCustom={false}
                            size="sm"
                            placeholder="-- اختر حساب فرعي (ابن) --"
                            searchPlaceholder="اكتب اسم الحساب أو رمزه..."
                            className="w-full text-right"
                            gridRow={idx}
                            gridCol={1}
                            onGridKeyDown={(e) => handleGridKeyDown(e, idx, 1, 'voucher-table-root', addRow)}
                          />
                        </div>
                      </td>

                      {/* البيان */}
                      <td className="py-1.5 px-2 border-l border-slate-300">
                        <input
                          type="text"
                          data-grid-row={idx}
                          data-grid-col={2}
                          value={row.notes}
                          onChange={(e) => updateRow(idx, 'notes', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          onKeyDown={(e) => handleGridKeyDown(e, idx, 2, 'voucher-table-root', addRow)}
                          placeholder="بيان صرف / تفاصيل الحساب..."
                          className="w-full bg-white text-slate-900 px-2.5 py-1 rounded border border-slate-300 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </td>

                      {/* حذف السطر */}
                      <td className="py-1.5 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          disabled={rows.length <= 1}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 disabled:opacity-20 cursor-pointer transition-colors"
                          title="حذف هذا السطر"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Fixed / Sticky Footer (matching invoice footer colors) */}
              <tfoot className="sticky bottom-0 bg-white text-slate-900 font-bold z-30 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
                <tr className="divide-x divide-x-reverse divide-slate-200 text-xs bg-white sticky bottom-0">
                  <td className="sticky bottom-0 py-2 px-2 text-center text-slate-950 font-black bg-slate-100 font-mono text-xs md:text-sm border-t-2 border-slate-300" title={`عدد الأسطر: ${rows.length}`}>
                    {rows.length}
                  </td>
                  <td className="sticky bottom-0 py-2 px-3 text-center font-mono font-black text-emerald-800 bg-emerald-50 text-xs md:text-sm border-t-2 border-slate-300" title="إجمالي المبالغ">
                    {formatCurrency(totalAmount)}
                  </td>
                  <td className="sticky bottom-0 py-2 px-3 text-right bg-white border-t-2 border-slate-300 text-slate-400">
                    -
                  </td>
                  <td className="sticky bottom-0 py-2 px-3 text-right text-slate-700 font-medium truncate bg-white border-t-2 border-slate-300">
                    {settings.showTafqeet && totalAmount > 0 ? (
                      <span className="text-slate-800 font-serif font-bold">
                        {tafqeetNumber(totalAmount, currency)}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="sticky bottom-0 py-2 px-1 text-center text-slate-400 bg-white border-t-2 border-slate-300">
                    -
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Bottom Pinned Bar: Actions on Right, Financial Totals on Left (matching Commission Invoice) */}
        <div className="bg-[#243343] border-t border-slate-500/60 px-3 md:px-5 py-2 shrink-0 flex items-center justify-between flex-wrap gap-2.5">
          
          {/* Action Buttons Group */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 1. سند جديد */}
            <button
              type="button"
              onClick={handleNew}
              className="flex items-center gap-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-lg shadow-sm cursor-pointer transition-colors"
              title="سند جديد (F3)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>جديد (F3)</span>
            </button>

            {/* 2. حذف */}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={!currentId}
              className="flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow-sm disabled:opacity-30 cursor-pointer transition-colors"
              title="حذف السند"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف</span>
            </button>

            {/* 3. حفظ / تعديل ذكي موحد */}
            <button
              type="button"
              onClick={handleSave}
              className={`flex items-center gap-1 px-3.5 py-1 font-black text-xs rounded-lg shadow-sm cursor-pointer transition-colors ${
                currentId
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  : 'bg-sky-400 hover:bg-sky-300 text-slate-950'
              }`}
              title={currentId ? 'حفظ التعديلات (F2)' : 'حفظ السند (F2)'}
            >
              {currentId ? <Edit className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{currentId ? 'تعديل (F2)' : 'حفظ (F2)'}</span>
            </button>

            <div className="h-4 w-px bg-slate-600 mx-0.5" />

            {/* 4. طباعة */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-lg shadow-sm cursor-pointer transition-colors"
              title="طباعة السند (F4)"
            >
              <Printer className="w-3.5 h-3.5 text-sky-700" />
              <span>طباعة (F4)</span>
            </button>
          </div>

          {/* Left Financial Totals in RTL */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Tafqeet in Words */}
            {settings.showTafqeet && totalAmount > 0 && (
              <div className="hidden lg:flex items-center gap-1.5 bg-[#1e2a38] px-2.5 py-0.5 rounded-lg border border-slate-600/70 text-xs">
                <span className="text-slate-400 text-[10px]">فقط:</span>
                <span className="text-amber-300 font-serif font-bold text-[11px]">
                  {tafqeetNumber(totalAmount, currency)}
                </span>
              </div>
            )}

            {/* Total Box matching Commission Invoice */}
            <div className="flex items-center gap-1.5 bg-[#253342] px-2.5 py-1 rounded-lg border border-slate-600/70 text-xs">
              <span className="text-slate-300 font-bold text-[11px]">الإجمالي:</span>
              <div className="bg-white text-slate-950 px-2.5 py-0.5 rounded font-mono font-black text-sm min-w-[75px] text-center shadow-inner">
                {formatCurrency(totalAmount)}
              </div>
              <span className="text-slate-300 font-bold text-[11px]">{currency}</span>
            </div>
          </div>

        </div>

      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title={`حذف ${typeTitle}`}
        message={`هل أنت متأكد من حذف ${typeTitle} رقم ${voucherNumber} نهائياً؟`}
        confirmText="تأكيد الحذف"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Missing Account Notification & Prompt Dialog */}
      {notFoundDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-[#2c3e50] text-white w-full max-w-md rounded-2xl p-6 border border-slate-500 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-400/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">الحساب غير مسجل</h3>
                <p className="text-xs text-slate-300">
                  الحساب "<span className="text-amber-300 font-bold">{notFoundDialog.name}</span>" غير موجود في دليل الحسابات.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-200 bg-[#34495e] p-3 rounded-xl border border-slate-600 mb-5">
              هل ترغب بإنشاء بطاقة حساب جديدة لهذا الاسم الآن وإضافتها تلقائياً إلى السند؟
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setNotFoundDialog({ isOpen: false, name: '', target: 'main' })}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = notFoundDialog.target;
                  const rowIdx = notFoundDialog.rowIndex ?? null;
                  const name = notFoundDialog.name;
                  setNotFoundDialog({ isOpen: false, name: '', target: 'main' });
                  setAccountModalTarget(target);
                  setAccountModalRowIndex(rowIdx);
                  setAccountModalInitialName(name);
                  setAccountModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إنشاء بطاقة حساب</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Card Modal for direct addition */}
      {accountModalOpen && (
        <AccountCardModal
          isDialog={true}
          initialName={accountModalInitialName}
          onClose={() => setAccountModalOpen(false)}
          onAccountCreated={handleAccountCreated}
        />
      )}
    </div>
  );
};

