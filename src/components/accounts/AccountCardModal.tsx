import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  Plus,
  Save,
  Trash2,
  X,
  List,
  FileText,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Account } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { ContainmentCombobox, ComboboxOption } from '../common/ContainmentCombobox';
import { NumericInput } from '../common/NumericInput';
import { getNextAccountCode } from '../../utils/codeGenerator';
import { isPermanentSystemAccount } from '../../utils/systemAccounts';

interface AccountCardModalProps {
  onClose: () => void;
  isDialog?: boolean;
  initialName?: string;
  initialParentAccount?: string;
  onAccountCreated?: (account: Account) => void;
}

export const AccountCardModal: React.FC<AccountCardModalProps> = ({
  onClose,
  isDialog = false,
  initialName,
  initialParentAccount,
  onAccountCreated,
}) => {
  const {
    accounts,
    invoices,
    vouchers,
    addAccount,
    updateAccount,
    deleteAccount,
    selectedAccountId,
    setSelectedAccountId,
    setCurrentView,
    showNotification,
  } = useApp();

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [formData, setFormData] = useState<Omit<Account, 'id'>>({
    code: '',
    name: '',
    parentAccount: '',
    governorate: '',
    city: '',
    address: '',
    phone: '',
    notes: '',
    openingDebit: 0,
    openingCredit: 0,
  });

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Check if the current account is a protected permanent system account
  const currentAccount = currentId ? accounts.find((a) => a.id === currentId) : null;
  const isCurrentSystemAccount =
    isPermanentSystemAccount(currentAccount) ||
    (Boolean(currentId) && isPermanentSystemAccount({ code: formData.code, name: formData.name }));

  // Helper: check if an account is used in any financial transactions or has balances
  const checkAccountFinancialActivity = (accountNameOrCode: string, accountId?: string) => {
    const trimmed = accountNameOrCode.trim().toLowerCase();
    const accObj = accounts.find(
      (a) =>
        (accountId && a.id === accountId) ||
        a.name.trim().toLowerCase() === trimmed ||
        a.code.trim() === accountNameOrCode.trim()
    );

    const name = accObj ? accObj.name : accountNameOrCode;
    const code = accObj ? accObj.code : '';
    const id = accObj ? accObj.id : accountId;

    // 1. Check opening balance or current balance
    if (accObj) {
      const debit = Number(accObj.openingDebit) || 0;
      const credit = Number(accObj.openingCredit) || 0;
      const balance =
        accObj.currentBalance !== undefined
          ? accObj.currentBalance
          : debit - credit;

      if (debit !== 0 || credit !== 0 || balance !== 0) {
        return {
          hasActivity: true,
          reason: `الحساب لديه رصيد مسجل (${balance !== 0 ? `الرصيد: ${balance}` : `مدين: ${debit} / دائن: ${credit}`})`,
        };
      }
    }

    // 2. Check vouchers
    const foundVoucher = vouchers.find(
      (v) =>
        v.mainAccountName.trim().toLowerCase() === name.trim().toLowerCase() ||
        (code && v.mainAccountCode.trim() === code.trim()) ||
        v.rows.some(
          (r) =>
            r.accountName.trim().toLowerCase() === name.trim().toLowerCase() ||
            (code && r.accountCode.trim() === code.trim())
        )
    );
    if (foundVoucher) {
      return {
        hasActivity: true,
        reason: `الحساب مستخدم في سند ${foundVoucher.type} رقم (${foundVoucher.voucherNumber}) بتاريخ ${foundVoucher.date}`,
      };
    }

    // 3. Check invoices
    const foundInvoice = invoices.find(
      (inv) =>
        inv.sellerName.trim().toLowerCase() === name.trim().toLowerCase() ||
        (id && inv.sellerId === id) ||
        inv.buyerName.trim().toLowerCase() === name.trim().toLowerCase() ||
        (id && inv.buyerId === id)
    );
    if (foundInvoice) {
      return {
        hasActivity: true,
        reason: `الحساب مستخدم في فاتورة كمسيون رقم (${foundInvoice.invoiceNumber}) بتاريخ ${foundInvoice.date}`,
      };
    }

    return { hasActivity: false };
  };

  // Build searchable parent options with metadata and financial usage flags
  const parentComboboxOptions: ComboboxOption[] = useMemo(() => {
    // Only fundamental system accounts and custom existing parent categories requested
    const validParentNames = [
      'التجار',
      'المزارعين',
      'المصاريف',
      'الكمسيون',
      'الصندوق',
    ];

    const rawOptions = Array.from(
      new Set([
        ...validParentNames,
        ...accounts
          .map((a) => a.parentAccount)
          .filter((p) => p && p.trim() !== ''),
        ...accounts
          .filter((a) => !a.parentAccount || a.parentAccount.trim() === '')
          .map((a) => a.name),
      ])
    ).filter((name) => {
      if (!name) return false;
      const norm = name.trim().toLowerCase();
      // Exclude "أصول", "حسابات ختامية", "إيرادات", "خصوم", "مدينون", "دائنون"
      const banned = [
        'أصول',
        'اصول',
        'حسابات ختامية',
        'حسابات ختاميه',
        'حساب ختامي',
        'حسابات ختامي',
        'إيرادات',
        'ايرادات',
        'أصول متداولة',
        'خصوم',
        'خصوم / دائنون',
        'أصول / مدينون',
        'مدينون',
        'دائنون',
      ];
      if (banned.includes(norm)) {
        return false;
      }
      return true;
    });

    return rawOptions.map((optName) => {
      const matchAcc = accounts.find((a) => a.name.trim() === optName.trim());
      const activity = checkAccountFinancialActivity(optName, matchAcc?.id);

      let badge = undefined;
      if (activity.hasActivity) {
        badge = 'حساب له رصيد/حركة';
      }

      return {
        id: optName,
        label: optName,
        code: matchAcc?.code,
        subLabel: matchAcc ? `رمز: ${matchAcc.code}` : undefined,
        badge,
      };
    });
  }, [accounts, vouchers, invoices]);

  // Initialize or update form when accounts or selectedAccountId change
  useEffect(() => {
    if (!selectedAccountId) {
      handleNew();
      if (initialName && initialName.trim()) {
        const pAcc = initialParentAccount || 'زبائن';
        const nextCode = getNextAccountCode(pAcc, undefined, accounts);
        setFormData((prev) => ({
          ...prev,
          name: initialName.trim(),
          parentAccount: pAcc,
          code: nextCode,
        }));
      }
      return;
    }

    const foundIdx = accounts.findIndex((a) => a.id === selectedAccountId);
    if (foundIdx !== -1) {
      setCurrentIndex(foundIdx);
      loadAccount(accounts[foundIdx]);
    } else {
      handleNew();
    }
  }, [selectedAccountId, initialName, initialParentAccount]);

  const loadAccount = (acc?: Account) => {
    if (!acc) {
      handleNew();
      return;
    }
    setCurrentId(acc.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFormData({
      code: acc.code || '',
      name: acc.name || '',
      parentAccount: acc.parentAccount || '',
      governorate: acc.governorate || '',
      city: acc.city || '',
      address: acc.address || '',
      phone: acc.phone || '',
      notes: acc.notes || '',
      openingDebit: acc.openingDebit || 0,
      openingCredit: acc.openingCredit || 0,
    });
  };

  // 1. عند النقر يدوياً على زر "جديد": تفريغ كل الحقول بالكامل
  const handleManualNew = () => {
    setCurrentId(null);
    setSelectedAccountId(null);
    setCurrentIndex(accounts.length);
    setErrorMessage(null);
    setSuccessMessage(null);

    setFormData({
      code: '',
      name: '',
      parentAccount: '',
      governorate: '',
      city: '',
      address: '',
      phone: '',
      notes: '',
      openingDebit: 0,
      openingCredit: 0,
    });

    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
  };

  // 2. عند الحفظ: الحفاظ على الحساب الأب وزيادة الرمز 1 منعاً للتضارب
  const handlePostSaveNew = (preserveParent?: string, lastCode?: string) => {
    setCurrentId(null);
    setSelectedAccountId(null);
    setCurrentIndex(accounts.length);
    setErrorMessage(null);
    setSuccessMessage(null);

    const targetParent = typeof preserveParent === 'string' ? preserveParent.trim() : '';
    const safeLastCode = typeof lastCode === 'string' ? lastCode : undefined;
    let nextCode = '';
    if (targetParent) {
      nextCode = getNextAccountCode(targetParent, safeLastCode, accounts);
    }

    setFormData({
      code: nextCode,
      name: '',
      parentAccount: targetParent,
      governorate: formData.governorate || '',
      city: formData.city || '',
      address: '',
      phone: '',
      notes: '',
      openingDebit: 0,
      openingCredit: 0,
    });

    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
  };

  const handleNew = (preserveParent?: unknown, lastCode?: string) => {
    if (typeof preserveParent === 'string' && preserveParent.trim()) {
      handlePostSaveNew(preserveParent, typeof lastCode === 'string' ? lastCode : undefined);
    } else {
      handleManualNew();
    }
  };

  // 2. عند تغيير الحساب الرئيسي يتم التحقق من رصيده وتغيير الرمز المقترح تبعاً له
  const handleParentAccountChange = (newParent: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newParent || !newParent.trim()) {
      setFormData((prev) => ({
        ...prev,
        parentAccount: '',
        code: currentId ? prev.code : '',
      }));
      return;
    }

    const trimmedParent = newParent.trim();

    // 3. التحقق مما إذا كان الحساب الرئيسي له رصيد أو مستخدم في عملية مالية
    const activity = checkAccountFinancialActivity(trimmedParent);
    if (activity.hasActivity) {
      const warningMsg = `تنبيه: الحساب الرئيسي (${trimmedParent}) لديه رصيد أو حركة مالية مسجلة (${activity.reason})! في النظام المحاسبي يمنع تفريع حسابات جديدة تحت حسابات ذات حركة مالية مباشرة.`;
      setErrorMessage(warningMsg);
    }

    // توليد الرمز المقترح تبعاً للحساب الرئيسي الجديد
    const nextCode = getNextAccountCode(trimmedParent, undefined, accounts);

    setFormData((prev) => ({
      ...prev,
      parentAccount: trimmedParent,
      code: !currentId || prev.code === '' ? nextCode : prev.code,
    }));
  };

  // Navigation handlers (مطابقة تماماً لآلية الفاتورة)
  // 1. الأول (First record)
  const handleFirst = () => {
    if (accounts.length > 0) {
      setCurrentIndex(0);
      loadAccount(accounts[0]);
    }
  };

  // 2. السابق (Previous record)
  const handlePrev = () => {
    if (accounts.length === 0) return;
    if (currentId === null) {
      const lastIdx = accounts.length - 1;
      setCurrentIndex(lastIdx);
      loadAccount(accounts[lastIdx]);
    } else if (currentIndex > 0) {
      const newIdx = currentIndex - 1;
      setCurrentIndex(newIdx);
      loadAccount(accounts[newIdx]);
    }
  };

  // 3. التالي (Next record)
  const handleNext = () => {
    if (accounts.length === 0 || currentId === null) return;
    if (currentIndex < accounts.length - 1) {
      const newIdx = currentIndex + 1;
      setCurrentIndex(newIdx);
      loadAccount(accounts[newIdx]);
    }
  };

  // 4. الأخير (Last record)
  const handleLast = () => {
    if (accounts.length > 0) {
      const lastIdx = accounts.length - 1;
      setCurrentIndex(lastIdx);
      loadAccount(accounts[lastIdx]);
    }
  };

  // Save handler with validation, duplicate checks, parent account financial activity block, and auto-increment
  const handleSave = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedCode = formData.code.trim();
    const trimmedName = formData.name.trim();
    const trimmedParent = formData.parentAccount.trim();

    if (!trimmedCode) {
      setErrorMessage('يرجى إدخال رمز الحساب أو اختيار الحساب الرئيسي لتوليد الرمز تلقائياً');
      return;
    }

    if (!trimmedName) {
      setErrorMessage('يرجى إدخال اسم الحساب');
      nameInputRef.current?.focus();
      return;
    }

    if (!trimmedParent && !isCurrentSystemAccount) {
      setErrorMessage('يرجى اختيار الحساب الرئيسي (الأب)');
      return;
    }

    // 1. في حال كان الحساب الرئيسي له رصيد أو مستخدم في عملية مالية يمنع إضافة حساب فرعي عليه
    if (trimmedParent) {
      const parentActivity = checkAccountFinancialActivity(trimmedParent);
      if (parentActivity.hasActivity && !currentId) {
        const msg = `يمنع إضافة حساب فرعي تحت الحساب الرئيسي "${trimmedParent}" لأنه ${parentActivity.reason}! يجب اختيار حساب رئيسي تجميعي لا يحتوي على حركات مالية مباشرة.`;
        setErrorMessage(msg);
        showNotification(msg, 'error');
        return;
      }
    }

    // 2. منع التكرار للرمز
    const duplicateCode = accounts.find(
      (a) => a.id !== currentId && a.code.trim() === trimmedCode
    );
    if (duplicateCode) {
      const msg = `رمز الحساب (${trimmedCode}) مستخدم مسبقاً للحساب "${duplicateCode.name}"! يمنع تكرار الرمز.`;
      setErrorMessage(msg);
      showNotification(msg, 'error');
      return;
    }

    // 3. منع التكرار لاسم الحساب
    const duplicateName = accounts.find(
      (a) => a.id !== currentId && a.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicateName) {
      const msg = `اسم الحساب "${trimmedName}" موجود مسبقاً بالرمز (${duplicateName.code})! يمنع تكرار اسم الحساب.`;
      setErrorMessage(msg);
      showNotification(msg, 'error');
      return;
    }

    // Save or update
    const isEditMode = Boolean(currentId);
    const finalParent = isCurrentSystemAccount ? '' : trimmedParent;
    let savedAccount: Account;

    if (currentId) {
      savedAccount = {
        ...formData,
        code: trimmedCode,
        name: trimmedName,
        parentAccount: finalParent,
        id: currentId,
      };
      updateAccount(savedAccount);
      showNotification(`تم تعديل الحساب (${trimmedName}) بنجاح`, 'success');
      setSuccessMessage(`تم تعديل بيانات الحساب (${trimmedName}) برمز (${trimmedCode}) بنجاح`);
      if (onAccountCreated) {
        onAccountCreated(savedAccount);
        onClose();
        return;
      }
      // البقاء في نفس بطاقة الحساب عند التعديل وعدم التصفير
      setFormData({
        code: trimmedCode,
        name: trimmedName,
        parentAccount: finalParent,
        governorate: formData.governorate || '',
        city: formData.city || '',
        address: formData.address || '',
        phone: formData.phone || '',
        notes: formData.notes || '',
        openingDebit: formData.openingDebit || 0,
        openingCredit: formData.openingCredit || 0,
      });
      return;
    } else {
      savedAccount = addAccount({
        ...formData,
        code: trimmedCode,
        name: trimmedName,
        parentAccount: finalParent,
      });
      showNotification(`تمت إضافة الحساب (${trimmedName}) برمز (${trimmedCode}) بنجاح`, 'success');
      setSuccessMessage(`تم حفظ الحساب (${trimmedName}) برمز (${trimmedCode}) بنجاح!`);
      
      if (onAccountCreated) {
        onAccountCreated(savedAccount);
        onClose();
        return;
      }

      // الانتقال مباشرة إلى بطاقة جديدة مع الحفاظ على الحساب الأب وزيادة الرمز 1 (+1)
      handleNew(finalParent, trimmedCode);
    }
  };

  // 4. منع حذف الحساب في حال كان حساباً أساسياً أو وجود سند أو فاتورة محفوظة باسم الحساب أو وجود حسابات فرعية
  const handleDelete = () => {
    if (!currentId) return;

    const accToDelete = accounts.find((a) => a.id === currentId);
    if (!accToDelete) return;

    // أ) التحقق من أن الحساب ليس حساب نظام أساسي غير قابل للحذف
    if (isPermanentSystemAccount(accToDelete) || isCurrentSystemAccount) {
      const msg = `الحساب "${accToDelete.name}" (رمز ${accToDelete.code}) هو حساب أساسي في النظام وغير قابل للحذف نهائياً!`;
      setErrorMessage(msg);
      setShowDeleteConfirm(false);
      showNotification(msg, 'error');
      return;
    }

    // ب) التحقق من وجود حسابات فرعية تابعة لهذا الحساب
    const hasSubAccounts = accounts.some(
      (a) =>
        a.id !== currentId &&
        a.parentAccount.trim().toLowerCase() === accToDelete.name.trim().toLowerCase()
    );
    if (hasSubAccounts) {
      const msg = `يمنع حذف الحساب "${accToDelete.name}" لوجود حسابات فرعية تتبع له! يرجى حذف أو نقل الحسابات الفرعية أولاً.`;
      setErrorMessage(msg);
      setShowDeleteConfirm(false);
      showNotification(msg, 'error');
      return;
    }

    // ج) التحقق من وجود سند أو فاتورة أو رصيد باسم الحساب
    const activity = checkAccountFinancialActivity(accToDelete.name, accToDelete.id);
    if (activity.hasActivity) {
      const msg = `يمنع حذف الحساب "${accToDelete.name}" (رمز ${accToDelete.code}) لوجود حركات مالية مسجلة باسمه (${activity.reason})! يمنع حذف أي حساب له حركة مالية في النظام.`;
      setErrorMessage(msg);
      setShowDeleteConfirm(false);
      showNotification(msg, 'error');
      return;
    }

    // د) التنفيذ في حال عدم وجود أي قيود
    deleteAccount(currentId);
    setShowDeleteConfirm(false);
    showNotification(`تم حذف الحساب (${accToDelete.name}) بنجاح`, 'success');
    setSuccessMessage(`تم حذف الحساب (${accToDelete.name}) بنجاح`);
    handleNew();
  };

  // Keyboard shortcuts (F2 Save, F3 New, F9 Delete)
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const handleNewRef = useRef(handleNew);
  handleNewRef.current = handleNew;
  const handleDeleteRef = useRef(() => {
    if (currentId && !isCurrentSystemAccount) {
      setShowDeleteConfirm(true);
    }
  });
  handleDeleteRef.current = () => {
    if (currentId && !isCurrentSystemAccount) {
      setShowDeleteConfirm(true);
    }
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
      } else if (e.key === 'F9' || e.code === 'F9' || e.keyCode === 120) {
        e.preventDefault();
        e.stopPropagation();
        handleDeleteRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const cardContent = (
    <>
      <div className={`w-full ${isDialog ? 'max-w-5xl my-auto' : 'max-w-6xl mx-auto'} bg-[#3c4f65] text-white rounded-xl shadow-2xl border border-slate-600/80 p-5 md:p-7 flex flex-col gap-5`}>
        
        {/* Top Header Row: Title on right, Navigation buttons in exact order: الأخير | التالي | السابق | الأول on left */}
        <div className="flex items-center justify-between border-b border-slate-500/40 pb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide">
              بطاقة حساب
            </h2>
            {isCurrentSystemAccount ? (
              <span className="bg-sky-500/25 text-sky-200 border border-sky-400/50 text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-xs">
                <Lock className="w-3.5 h-3.5 text-sky-300" />
                <span>حساب نظام أساسي (غير قابل للحذف نهائياً)</span>
              </span>
            ) : currentId ? (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs px-2.5 py-1 rounded font-semibold">
                تعديل حساب ({formData.code})
              </span>
            ) : (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-xs px-2.5 py-1 rounded font-semibold">
                حساب جديد (إضافة متتالية)
              </span>
            )}
          </div>

          {/* Navigation buttons: مثل الفاتورة (أيقونات فقط بدون كتابة: الأخير | التالي | السابق | الأول) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#243343] p-1 rounded-lg border border-slate-600/70 shadow-inner">
              <button
                type="button"
                onClick={handleLast}
                disabled={accounts.length === 0 || currentId === null || currentIndex >= accounts.length - 1}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="السجل الأخير"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={accounts.length === 0 || currentId === null || currentIndex >= accounts.length - 1}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="التالي"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handlePrev}
                disabled={accounts.length === 0 || (currentId !== null && currentIndex === 0)}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="السابق"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleFirst}
                disabled={accounts.length === 0 || (currentId !== null && currentIndex === 0)}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="السجل الأول"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <span className="text-[11px] text-slate-300 font-bold px-2 min-w-[70px] text-center font-mono">
                {currentId === null
                  ? `(جديد / ${accounts.length})`
                  : `(${currentIndex + 1} / ${accounts.length})`}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-slate-700/80 hover:bg-slate-600 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {successMessage && (
          <div className="bg-emerald-500/20 border border-emerald-400/60 text-emerald-200 text-xs px-4 py-2.5 rounded-lg flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
              <span className="font-bold">{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-300 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="bg-rose-500/20 border border-rose-400/60 text-rose-200 text-xs px-4 py-2.5 rounded-lg flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-300" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-300 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Form Body: 2 Columns - Right column = Basic Info, Left column = Contact/Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 bg-slate-800/40 p-4 md:p-6 rounded-lg border border-slate-600/40">
          
          {/* الطرف اليميني: معلومات الحساب الأساسية */}
          <div className="flex flex-col gap-3.5">
            <h3 className="text-sm font-bold text-amber-300 border-b border-slate-500/50 pb-1.5 flex items-center justify-between">
              <span>معلومات الحساب الأساسية</span>
              <span className="text-xs text-slate-300 font-normal">الرمز واسم الحساب فريدان</span>
            </h3>

            {/* الحساب الرئيسي (الأب) - قابل للبحث (Searchable Combobox) */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200">
                  الحساب الرئيسي (الأب){' '}
                  {isCurrentSystemAccount ? (
                    <span className="text-sky-300 font-bold">(حساب أساسي بدون أب)</span>
                  ) : (
                    <span className="text-amber-400">* (قابل للبحث)</span>
                  )}
                </label>
                <span className="text-[11px] text-slate-400">
                  {isCurrentSystemAccount ? 'حساب نظام رئيسي مستقل' : 'يحدد تسلسل الرمز'}
                </span>
              </div>
              <ContainmentCombobox
                options={parentComboboxOptions}
                value={isCurrentSystemAccount ? '' : formData.parentAccount}
                onChange={(val) => {
                  if (!isCurrentSystemAccount) {
                    handleParentAccountChange(val);
                  }
                }}
                disabled={isCurrentSystemAccount}
                placeholder={
                  isCurrentSystemAccount
                    ? 'حساب أساسي رئيسي مستقل (بدون حساب رئيسي)'
                    : '-- ابحث واختر الحساب الرئيسي --'
                }
                searchPlaceholder="اكتب للبحث عن الحساب الرئيسي بالاسم أو الرمز..."
                allowCustom={false}
                className={`w-full text-slate-900 ${isCurrentSystemAccount ? 'cursor-not-allowed opacity-75' : ''}`}
              />
            </div>

            {/* رمز الحساب */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200">
                  رمز الحساب <span className="text-amber-400">* (يمنع التكرار)</span>
                </label>
                <span className="text-[11px] text-slate-400">يزيد 1 تلقائياً تبعاً للأب</span>
              </div>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full bg-white text-slate-900 px-3 py-2 rounded-md font-mono font-bold text-base focus:outline-none focus:ring-2 focus:ring-amber-400 text-center md:text-right border border-slate-300"
              />
            </div>

            {/* اسم الحساب */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-200">
                اسم الحساب <span className="text-amber-400">* (يمنع التكرار)</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                className="w-full bg-white text-slate-900 px-3 py-2 rounded-md font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-300"
              />
            </div>

            {/* الرصيد الافتتاحي */}
            <div className="mt-2 pt-3 border-t border-slate-600/70">
              <span className="text-xs font-bold text-slate-200 block mb-2">الرصيد الافتتاحي</span>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-300">مدين</label>
                  <NumericInput
                    value={formData.openingDebit}
                    onChange={(val) => setFormData({ ...formData, openingDebit: val })}
                    placeholder="0"
                    className="w-full bg-white text-slate-900 px-3 py-2 rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-300"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-300">دائن</label>
                  <NumericInput
                    value={formData.openingCredit}
                    onChange={(val) => setFormData({ ...formData, openingCredit: val })}
                    placeholder="0"
                    className="w-full bg-white text-slate-900 px-3 py-2 rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-300"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* الطرف اليساري: معلومات التواصل والموقع */}
          <div className="flex flex-col gap-3.5">
            <h3 className="text-sm font-bold text-amber-300 border-b border-slate-500/50 pb-1.5">
              معلومات التواصل والموقع
            </h3>

            {/* المحافظة والمدينة */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-200">المحافظة</label>
                <input
                  type="text"
                  value={formData.governorate}
                  onChange={(e) => setFormData({ ...formData, governorate: e.target.value })}
                  className="w-full bg-white text-slate-900 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-300"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-200">المدينة / البلدة</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full bg-white text-slate-900 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-300"
                />
              </div>
            </div>

            {/* مكان السكن / العنوان */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-200">العنوان / مكان السكن</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-white text-slate-900 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-300"
              />
            </div>

            {/* الهاتف */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-200">الهاتف / الموبايل</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-white text-slate-900 px-3 py-2 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 text-left md:text-right border border-slate-300"
              />
            </div>

            {/* ملاحظات */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-200">ملاحظات</label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full bg-white text-slate-900 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none border border-slate-300"
              ></textarea>
            </div>
          </div>
        </div>

        {/* Bottom Actions Toolbar: الطرف اليميني (دليل الحسابات، كشف حساب) - الطرف اليساري (حفظ، حذف، جديد، إغلاق من أقصى اليسار) */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-500/40 flex-wrap">
          {/* الطرف اليميني: دليل الحسابات و كشف حساب */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentView('accounts_list')}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-200 hover:bg-white text-slate-900 font-bold text-xs rounded-lg shadow cursor-pointer transition-colors"
            >
              <List className="w-4 h-4 text-sky-700" />
              <span>دليل الحسابات</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentId) setSelectedAccountId(currentId);
                setCurrentView('account_statement');
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-200 hover:bg-white text-slate-900 font-bold text-xs rounded-lg shadow cursor-pointer transition-colors"
            >
              <FileText className="w-4 h-4 text-amber-700" />
              <span>كشف حساب</span>
            </button>
          </div>

          {/* الطرف اليساري: بدءاً من أقصى اليسار (حفظ | حذف | جديد | إغلاق) */}
          <div className="flex items-center gap-2.5 flex-wrap" dir="ltr">
            {/* 1. حفظ (أقصى اليسار) */}
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-lg shadow-md cursor-pointer transition-all active:scale-95"
              title="حفظ السجل وتوليد الرمز التالي مع تفريغ الحقول"
            >
              <Save className="w-4 h-4" />
              <span>حفظ (F2)</span>
            </button>

            {/* 2. حذف */}
            <button
              type="button"
              onClick={() => {
                if (isCurrentSystemAccount) {
                  const msg = `الحساب "${formData.name}" (رمز ${formData.code}) هو حساب أساسي في النظام وغير قابل للحذف نهائياً.`;
                  setErrorMessage(msg);
                  showNotification(msg, 'error');
                  return;
                }
                setShowDeleteConfirm(true);
              }}
              disabled={!currentId || isCurrentSystemAccount}
              title={
                isCurrentSystemAccount
                  ? 'حساب نظام أساسي محمي غير قابل للحذف نهائياً'
                  : !currentId
                  ? 'يرجى اختيار حساب لحذفه'
                  : 'حذف الحساب'
              }
              className={`flex items-center gap-1.5 px-5 py-2.5 font-bold text-sm rounded-lg shadow transition-colors ${
                isCurrentSystemAccount
                  ? 'bg-slate-600/70 text-slate-400 cursor-not-allowed border border-slate-500/40'
                  : 'bg-slate-300 hover:bg-rose-600 hover:text-white text-slate-800 disabled:opacity-40 cursor-pointer'
              }`}
            >
              {isCurrentSystemAccount ? <Lock className="w-4 h-4 text-amber-400" /> : <Trash2 className="w-4 h-4" />}
              <span>حذف {isCurrentSystemAccount ? '(أساسي 🔒)' : ''}</span>
            </button>

            {/* 3. جديد */}
            <button
              type="button"
              onClick={() => handleNew()}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm rounded-lg shadow cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>جديد</span>
            </button>

            {/* 4. إغلاق */}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm rounded-lg shadow cursor-pointer transition-colors"
            >
              <X className="w-4 h-4 text-slate-600" />
              <span>إغلاق</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation modal for deletion */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="حذف حساب"
        message={`هل أنت متأكد من حذف الحساب "${formData.name}" (رمز ${formData.code})؟\nسيتم التحقق من عدم وجود سندات أو فواتير مرتبطة به قبل الحذف.`}
        confirmText="تأكيد الحذف"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );

  if (isDialog) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-150" dir="rtl">
        {cardContent}
      </div>
    );
  }

  return (
    <div className="w-full min-h-[calc(100vh-56px)] bg-[#7196b8] p-3 md:p-6 flex flex-col justify-start animate-in fade-in duration-200">
      {cardContent}
    </div>
  );
};

