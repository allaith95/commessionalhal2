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
  UserCheck,
  ShoppingCart,
  Calendar,
  Layers,
  Settings2,
  UserPlus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Invoice, InvoiceRow, Account, Item } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { ContainmentCombobox, ComboboxOption } from '../common/ContainmentCombobox';
import { NumericInput } from '../common/NumericInput';
import { AccountCardModal } from '../accounts/AccountCardModal';
import { ItemCardModal } from '../items/ItemCardModal';
import { tafqeetNumber } from '../../utils/tafqeet';
import { isPermanentSystemAccount } from '../../utils/systemAccounts';
import { roundCommission } from '../../utils/commissionRounding';
import { handleGridKeyDown } from '../../utils/gridNavigation';

interface CommissionInvoiceViewProps {
  onClose?: () => void;
}

export const CommissionInvoiceView: React.FC<CommissionInvoiceViewProps> = ({ onClose }) => {
  const {
    invoices,
    accounts,
    items,
    settings,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    selectedInvoiceId,
    setSelectedInvoiceId,
    triggerPrint,
    showNotification,
    setIsInvoiceDirty,
    setCurrentView,
    goBack,
    loadFromPostgres,
  } = useApp();

  // Trigger live PostgreSQL fetch on view mount
  useEffect(() => {
    loadFromPostgres();
  }, [loadFromPostgres]);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Modal dialog states for instant addition of missing entities
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountModalTarget, setAccountModalTarget] = useState<'seller' | 'buyer'>('seller');
  const [accountModalInitialName, setAccountModalInitialName] = useState('');

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalRowIndex, setItemModalRowIndex] = useState<number | null>(null);
  const [itemModalInitialName, setItemModalInitialName] = useState('');

  // Missing entity prompt modal dialog (triggered on Enter if not found)
  const [notFoundDialog, setNotFoundDialog] = useState<{
    isOpen: boolean;
    type: 'seller' | 'buyer' | 'item';
    name: string;
    rowIndex?: number;
  }>({
    isOpen: false,
    type: 'seller',
    name: '',
  });

  // Calculate sequential invoice number starting strictly from 1
  const getNextInvoiceNumber = (invs?: unknown): string => {
    const safeInvs = Array.isArray(invs)
      ? invs
      : Array.isArray(invoices)
      ? invoices
      : [];
    const numbers = safeInvs
      .map((inv) => (inv && inv.invoiceNumber ? parseInt(String(inv.invoiceNumber), 10) : 0))
      .filter((n) => !isNaN(n) && n > 0);
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    return String(maxNum + 1);
  };

  // Form State
  const [invoiceNumber, setInvoiceNumber] = useState<string>('1');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Seller
  const [sellerId, setSellerId] = useState<string>('');
  const [sellerName, setSellerName] = useState<string>('');
  const [sellerPaymentType, setSellerPaymentType] = useState<'نقدي' | 'آجل'>('نقدي');
  const [sellerNotes, setSellerNotes] = useState<string>('');

  // Buyer
  const [buyerId, setBuyerId] = useState<string>('');
  const [buyerName, setBuyerName] = useState<string>('');
  const [buyerPaymentType, setBuyerPaymentType] = useState<'نقدي' | 'آجل'>('نقدي');
  const [buyerNotes, setBuyerNotes] = useState<string>('');

  // Helper to create empty rows (default 10 rows per user request)
  const createDefaultRows = (count: number = 10): InvoiceRow[] => {
    return Array.from({ length: count }, (_, idx) => ({
      id: `r_init_${idx + 1}_${Date.now()}`,
      rowNumber: idx + 1,
      itemName: '',
      unit: 'كغ',
      grossWeight: 0,
      discountTare: settings.defaultDiscountTare ?? 2,
      netWeight: 0,
      unitPrice: 0,
      total: 0,
      notes: '',
    }));
  };

  // Rows (10 rows by default)
  const [rows, setRows] = useState<InvoiceRow[]>(() => createDefaultRows(10));

  // Commission % (defaults to settings or 5)
  const [commissionRate, setCommissionRate] = useState<number>(settings.defaultCommissionRate ?? 5);

  // Optional loaded invoice override for commission
  const [loadedCommissionValue, setLoadedCommissionValue] = useState<number | null>(null);

  // Column visibility options for invoice items table (الخصم % مخفي افتراضياً، وحفظ التخصيص فورياً)
  const STORAGE_KEY_INVOICE_COLUMNS = 'commission_invoice_visible_columns';
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INVOICE_COLUMNS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          discountTare: parsed.discountTare ?? true,
          discountPercent: parsed.discountPercent ?? false, // افتراضياً مخفي
          unit: parsed.unit ?? true,
          notes: parsed.notes ?? true,
        };
      }
    } catch {
      // fallback
    }
    return {
      discountTare: true,
      discountPercent: false, // افتراضياً مخفي
      unit: true,
      notes: true,
    };
  });

  const handleToggleColumn = (col: keyof typeof visibleColumns, val: boolean) => {
    setVisibleColumns((prev) => {
      const updated = { ...prev, [col]: val };
      try {
        localStorage.setItem(STORAGE_KEY_INVOICE_COLUMNS, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save invoice columns', err);
      }
      return updated;
    });
  };

  const [showColumnControlPopover, setShowColumnControlPopover] = useState(false);

  // Computed Totals & Metrics (مع الحفاظ على إجمالي الفاتورة كما هي وتطبيق التقريب على الكمسيون)
  const totalAmount = rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  const rawCommission = (totalAmount * commissionRate) / 100;
  const calculatedCommission = roundCommission(rawCommission, {
    direction: settings.commissionRoundingDirection,
    step: settings.commissionRoundingValue,
  });
  const commissionValue = loadedCommissionValue !== null ? loadedCommissionValue : calculatedCommission;
  const netAmount = totalAmount - commissionValue;

  const totalGrossWeight = rows.reduce((sum, r) => sum + (Number(r.grossWeight) || 0), 0);
  const totalTareWeight = rows.reduce((sum, r) => sum + (Number(r.discountTare) || 0), 0);
  const totalNetWeight = rows.reduce((sum, r) => sum + (Number(r.netWeight) || 0), 0);
  const activeItemsCount = rows.filter((r) => r.itemName.trim() || r.total > 0).length;

  // Options for ContainmentCombobox (حسابات البائع والمشتري - عرض الاسم والرمز فقط وفق خيار الإعدادات)
  const accountComboboxOptions = useMemo<ComboboxOption[]>(() => {
    return accounts
      .filter((acc) => !isPermanentSystemAccount(acc))
      .map((acc) => ({
        id: acc.id,
        label: acc.name,
        code: acc.code,
      }));
  }, [accounts]);

  const itemComboboxOptions = useMemo<ComboboxOption[]>(() => {
    return items.map((it) => ({
      id: it.name,
      label: it.name,
      code: it.code,
      subLabel: it.category ? `صنف: ${it.category}` : undefined,
      badge: it.unit || 'كغ',
    }));
  }, [items]);

  // Keep invoices sorted ascending by invoiceNumber for strictly sequential navigation
  const sortedInvoices = useMemo(() => {
    return [...invoices].sort((a, b) => {
      const numA = parseInt(String(a.invoiceNumber), 10) || 0;
      const numB = parseInt(String(b.invoiceNumber), 10) || 0;
      return numA - numB;
    });
  }, [invoices]);

  // Track if invoice has unsaved data
  const isDirty = useMemo(() => {
    const hasSeller = Boolean(sellerName.trim() || sellerId);
    const hasBuyer = Boolean(buyerName.trim() || buyerId);
    const hasNotes = Boolean(sellerNotes.trim() || buyerNotes.trim());
    const hasItems = rows.some((r) => r.itemName.trim() || (Number(r.grossWeight) || 0) > 0 || (Number(r.total) || 0) > 0 || r.notes.trim());
    return hasSeller || hasBuyer || hasNotes || hasItems;
  }, [sellerName, sellerId, buyerName, buyerId, sellerNotes, buyerNotes, rows]);

  useEffect(() => {
    setIsInvoiceDirty(isDirty);
  }, [isDirty, setIsInvoiceDirty]);

  // Open fresh empty invoice by default when entering Commission Invoice, or load if specifically selected
  useEffect(() => {
    if (selectedInvoiceId) {
      const foundIdx = sortedInvoices.findIndex((inv) => inv.id === selectedInvoiceId);
      if (foundIdx !== -1) {
        setCurrentIndex(foundIdx);
        loadInvoice(sortedInvoices[foundIdx]);
        return;
      }
    }
    // By default, opening commission invoice ALWAYS opens a new empty invoice with 10 rows
    handleNew();
  }, [selectedInvoiceId]);

  const loadInvoice = (inv?: Invoice) => {
    if (!inv) {
      handleNew();
      return;
    }
    setCurrentId(inv.id);
    setInvoiceNumber(inv.invoiceNumber);
    setInvoiceDate(inv.date);
    setSellerId(inv.sellerId);
    setSellerName(inv.sellerName);
    setSellerPaymentType(inv.sellerPaymentType);
    setSellerNotes(inv.sellerNotes || '');
    setBuyerId(inv.buyerId);
    setBuyerName(inv.buyerName);
    setBuyerPaymentType(inv.buyerPaymentType);
    setBuyerNotes(inv.buyerNotes || '');

    const existingRows = inv.rows && inv.rows.length > 0 ? inv.rows : [];
    if (existingRows.length === 0) {
      setRows(createDefaultRows(10));
    } else if (existingRows.length < 10) {
      const padding = createDefaultRows(10 - existingRows.length).map((r, i) => ({
        ...r,
        rowNumber: existingRows.length + i + 1,
      }));
      setRows([...existingRows, ...padding]);
    } else {
      setRows(existingRows);
    }
    setCommissionRate(inv.commissionRate || (settings.defaultCommissionRate ?? 5));
    setLoadedCommissionValue(inv.commissionValue ?? null);
  };

  const handleNew = (overrideInvoices?: unknown) => {
    const list = Array.isArray(overrideInvoices)
      ? (overrideInvoices as Invoice[])
      : Array.isArray(sortedInvoices)
      ? sortedInvoices
      : [];
    setCurrentId(null);
    setSelectedInvoiceId(null);
    setCurrentIndex(list.length);
    const nextNum = getNextInvoiceNumber(list);

    setInvoiceNumber(nextNum);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setSellerId('');
    setSellerName('');
    setSellerPaymentType('نقدي');
    setSellerNotes('');
    setBuyerId('');
    setBuyerName('');
    setBuyerPaymentType('نقدي');
    setBuyerNotes('');
    setCommissionRate(settings.defaultCommissionRate ?? 5);
    setLoadedCommissionValue(null);

    // Reset to exactly 10 clean rows (always 10 rows when empty)
    setRows(createDefaultRows(10));
    setIsInvoiceDirty(false);
  };

  const handleFirst = () => {
    if (sortedInvoices.length > 0) {
      setCurrentIndex(0);
      loadInvoice(sortedInvoices[0]);
    }
  };

  const handlePrev = () => {
    if (sortedInvoices.length === 0) return;
    if (currentId === null) {
      // In new invoice mode, navigate to the latest existing saved invoice
      const lastIdx = sortedInvoices.length - 1;
      setCurrentIndex(lastIdx);
      loadInvoice(sortedInvoices[lastIdx]);
    } else if (currentIndex > 0) {
      const newIdx = currentIndex - 1;
      setCurrentIndex(newIdx);
      loadInvoice(sortedInvoices[newIdx]);
    }
  };

  const handleNext = () => {
    if (sortedInvoices.length === 0 || currentId === null) return;
    if (currentIndex < sortedInvoices.length - 1) {
      const newIdx = currentIndex + 1;
      setCurrentIndex(newIdx);
      loadInvoice(sortedInvoices[newIdx]);
    }
  };

  const handleLast = () => {
    if (sortedInvoices.length > 0) {
      const lastIdx = sortedInvoices.length - 1;
      setCurrentIndex(lastIdx);
      loadInvoice(sortedInvoices[lastIdx]);
    }
  };

  // Row changes
  const updateRowField = (idx: number, field: keyof InvoiceRow, value: any) => {
    if (field === 'netWeight' || field === 'grossWeight' || field === 'discountTare' || field === 'discountPercent' || field === 'unitPrice') {
      setLoadedCommissionValue(null);
    }
    setRows((prev) => {
      const updated = [...prev];
      const target = { ...updated[idx] };

      if (field === 'netWeight') {
        const net = Number(value) || 0;
        target.netWeight = net;
        const tare = target.discountTare || 0;
        target.grossWeight = net > 0 ? Math.round((net + tare) * 100) / 100 : target.grossWeight;
        target.discountPercent =
          target.grossWeight > 0
            ? Math.round((tare / target.grossWeight) * 100 * 100) / 100
            : 0;
        target.total = Math.round(net * (target.unitPrice || 0));
      } else if (field === 'grossWeight') {
        const gross = Number(value) || 0;
        target.grossWeight = gross;
        const tare = target.discountTare || 0;
        target.netWeight = Math.max(0, Math.round((gross - tare) * 100) / 100);
        target.discountPercent =
          gross > 0 ? Math.round((tare / gross) * 100 * 100) / 100 : 0;
        target.total = Math.round(target.netWeight * (target.unitPrice || 0));
      } else if (field === 'discountTare') {
        const tare = Number(value) || 0;
        target.discountTare = tare;
        if (target.grossWeight > 0) {
          target.netWeight = Math.max(0, Math.round((target.grossWeight - tare) * 100) / 100);
        } else if (target.netWeight > 0) {
          target.grossWeight = Math.round((target.netWeight + tare) * 100) / 100;
        }
        target.discountPercent =
          target.grossWeight > 0 ? Math.round((tare / target.grossWeight) * 100 * 100) / 100 : 0;
        target.total = Math.round(target.netWeight * (target.unitPrice || 0));
      } else if (field === 'discountPercent') {
        const pct = Number(value) || 0;
        target.discountPercent = pct;
        const gross = target.grossWeight || 0;
        target.discountTare = Math.round(((gross * pct) / 100) * 100) / 100;
        target.netWeight = Math.max(0, Math.round((gross - target.discountTare) * 100) / 100);
        target.total = Math.round(target.netWeight * (target.unitPrice || 0));
      } else if (field === 'unitPrice') {
        const price = Number(value) || 0;
        target.unitPrice = price;
        target.total = Math.round(target.netWeight * price);
      } else if (field === 'itemName') {
        target.itemName = String(value);
        const matchingItem = items.find(
          (i) => i.name.trim().toLowerCase() === String(value).trim().toLowerCase()
        );
        if (matchingItem) {
          target.unit = matchingItem.unit || 'كغ';
          target.itemId = matchingItem.id;
        }
      } else {
        (target as any)[field] = value;
      }

      updated[idx] = target;
      return updated;
    });
  };

  const addRow = () => {
    setLoadedCommissionValue(null);
    setRows((prev) => [
      ...prev,
      {
        id: `r_${Date.now()}`,
        rowNumber: prev.length + 1,
        itemName: '',
        unit: 'كغ',
        grossWeight: 0,
        discountTare: settings.defaultDiscountTare ?? 2,
        netWeight: 0,
        unitPrice: 0,
        total: 0,
        notes: '',
      },
    ]);
  };

  const removeRow = (idx: number) => {
    setLoadedCommissionValue(null);
    setRows((prev) => {
      const filtered = prev.filter((_, i) => i !== idx);
      // Ensure always at least 10 rows if empty or padded
      if (filtered.length < 10) {
        const diff = 10 - filtered.length;
        const padding: InvoiceRow[] = Array.from({ length: diff }, (_, i) => ({
          id: `r_pad_del_${Date.now()}_${i}`,
          rowNumber: filtered.length + i + 1,
          itemName: '',
          unit: 'كغ',
          grossWeight: 0,
          discountTare: settings.defaultDiscountTare ?? 2,
          netWeight: 0,
          unitPrice: 0,
          total: 0,
          notes: '',
        }));
        return [...filtered, ...padding].map((r, i) => ({ ...r, rowNumber: i + 1 }));
      }
      return filtered.map((r, i) => ({ ...r, rowNumber: i + 1 }));
    });
  };

  // Missing entity action handlers
  const handleOpenNewAccount = (target: 'seller' | 'buyer', initialName?: string) => {
    setAccountModalTarget(target);
    const prefill = initialName || (target === 'seller' ? sellerName : buyerName);
    setAccountModalInitialName(prefill.trim());
    setAccountModalOpen(true);
  };

  const handleAccountCreated = (newAcc: Account) => {
    if (accountModalTarget === 'seller') {
      setSellerId(newAcc.id);
      setSellerName(newAcc.name);
      showNotification(`تمت إضافة حساب البائع (${newAcc.name}) بنجاح وإدراجه في الفاتورة`, 'success');
    } else {
      setBuyerId(newAcc.id);
      setBuyerName(newAcc.name);
      showNotification(`تمت إضافة حساب المشتري (${newAcc.name}) بنجاح وإدراجه في الفاتورة`, 'success');
    }
    setAccountModalOpen(false);
  };

  const handleOpenNewItem = (rowIndex: number, initialName?: string) => {
    setItemModalRowIndex(rowIndex);
    const prefill = initialName || rows[rowIndex]?.itemName || '';
    setItemModalInitialName(prefill.trim());
    setItemModalOpen(true);
  };

  const handleItemCreated = (newItem: Item) => {
    if (itemModalRowIndex !== null && itemModalRowIndex >= 0 && itemModalRowIndex < rows.length) {
      updateRowField(itemModalRowIndex, 'itemName', newItem.name);
      updateRowField(itemModalRowIndex, 'unit', newItem.unit || 'كغ');
      showNotification(`تمت إضافة المادة (${newItem.name}) بنجاح وإدراجها في السطر رقم (${itemModalRowIndex + 1})`, 'success');
    }
    setItemModalOpen(false);
  };

  // Helper to assemble full invoice data for printing or preview
  const getCurrentInvoiceData = (roleOverride?: 'seller' | 'buyer'): Invoice => {
    const validRows = rows.filter((r) => r.itemName.trim() || r.total > 0);
    const resolvedSeller = (sellerName || accounts.find((a) => a.id === sellerId)?.name || '').trim() || (roleOverride === 'seller' ? 'بائع تجريبي' : 'بائع');
    const resolvedBuyer = (buyerName || accounts.find((a) => a.id === buyerId)?.name || '').trim() || (roleOverride === 'buyer' ? 'مشتري تجريبي' : 'مشتري');

    return {
      id: currentId || 'temp',
      invoiceNumber,
      date: invoiceDate,
      sellerId: sellerId || 'custom',
      sellerName: resolvedSeller,
      sellerPaymentType,
      sellerNotes,
      buyerId: buyerId || 'custom',
      buyerName: resolvedBuyer,
      buyerPaymentType,
      buyerNotes,
      rows: validRows,
      totalAmount,
      commissionRate,
      commissionValue,
      netAmount,
    };
  };

  const handleSave = () => {
    const effectiveSeller = (sellerName || accounts.find((a) => a.id === sellerId)?.name || '').trim();
    const effectiveBuyer = (buyerName || accounts.find((a) => a.id === buyerId)?.name || '').trim();

    if (!effectiveSeller) {
      showNotification('يجب تحديد طرف البائع (حقل إجباري)', 'error');
      return;
    }
    if (!effectiveBuyer) {
      showNotification('يجب تحديد طرف المشتري (حقل إجباري)', 'error');
      return;
    }

    const validRows = rows.filter((r) => r.itemName.trim() || r.total > 0);
    if (validRows.length === 0) {
      showNotification('يرجى إدخال مادة واحدة على الأقل في الفاتورة', 'error');
      return;
    }

    const payload: Omit<Invoice, 'id'> = {
      invoiceNumber: invoiceNumber.trim() || String(Date.now()),
      date: invoiceDate,
      sellerId: sellerId || 'custom',
      sellerName: effectiveSeller,
      sellerPaymentType,
      sellerNotes,
      buyerId: buyerId || 'custom',
      buyerName: effectiveBuyer,
      buyerPaymentType,
      buyerNotes,
      rows: validRows,
      totalAmount,
      commissionRate,
      commissionValue,
      netAmount,
    };

    if (currentId) {
      updateInvoice({ ...payload, id: currentId });
      showNotification(`تم تعديل الفاتورة رقم (${invoiceNumber}) بنجاح`, 'success');
      setIsInvoiceDirty(false);
      // البقاء في نفس الفاتورة عند التعديل وعدم التصفير
    } else {
      const newInvoiceWithId: Invoice = { ...payload, id: `inv_${Date.now()}` };
      const updatedList = [newInvoiceWithId, ...invoices];
      addInvoice(payload);
      showNotification(`تم حفظ الفاتورة رقم (${invoiceNumber}) بنجاح وتفريغ الحقول لفاتورة جديدة`, 'success');
      handleNew(updatedList);
    }
  };

  const handleDelete = () => {
    if (currentId) {
      const remaining = invoices.filter((inv) => inv.id !== currentId);
      deleteInvoice(currentId);
      setShowDeleteConfirm(false);
      showNotification(`تم حذف الفاتورة رقم (${invoiceNumber}) بنجاح`, 'success');
      handleNew(remaining);
    }
  };

  // Printing handlers
  const handlePrintSeller = () => {
    triggerPrint('seller_invoice', getCurrentInvoiceData('seller'));
  };

  const handlePrintBuyer = () => {
    triggerPrint('buyer_invoice', getCurrentInvoiceData('buyer'));
  };

  // Keyboard shortcuts (F2 Save, F3 New, F4 Print Seller, F5 Print Buyer, F9 Delete)
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const handleNewRef = useRef(handleNew);
  handleNewRef.current = handleNew;
  const handlePrintSellerRef = useRef(handlePrintSeller);
  handlePrintSellerRef.current = handlePrintSeller;
  const handlePrintBuyerRef = useRef(handlePrintBuyer);
  handlePrintBuyerRef.current = handlePrintBuyer;
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
        handlePrintSellerRef.current();
      } else if (e.key === 'F5' || e.code === 'F5' || e.keyCode === 116) {
        e.preventDefault();
        e.stopPropagation();
        handlePrintBuyerRef.current();
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
      {/* Full-Screen Invoice Card with fixed header, scrollable table body, and pinned bottom bar */}
      <div className="w-full h-full flex flex-col bg-[#3c4f65] text-white rounded-xl shadow-2xl border border-slate-600/80 overflow-hidden min-h-0">
        
        {/* Top Header Row: Title, Number, Date on Right, Icon-Only Navigation & Close on Left */}
        <div className="flex items-center justify-between border-b border-slate-500/50 px-3 md:px-5 py-2 shrink-0 flex-wrap gap-2 bg-[#34465a]">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-1.5 bg-sky-500/20 text-sky-300 rounded-lg border border-sky-400/30 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg md:text-xl font-black text-white tracking-wide">
                فاتورة كمسيون
              </h2>
              {/* حقل رقم الفاتورة المصغر بجانب العنوان */}
              <div className="flex items-center gap-1 bg-[#1e2a38] px-2 py-0.5 rounded-md border border-amber-500/40 shadow-inner">
                <span className="text-[11px] font-bold text-amber-400 shrink-0">رقم:</span>
                <input
                  type="text"
                  readOnly
                  value={invoiceNumber}
                  className="w-12 sm:w-14 bg-amber-400 text-slate-950 px-1 py-0.5 rounded text-xs font-mono font-black text-center cursor-not-allowed border border-amber-300 shadow-inner select-all"
                  title="رقم الفاتورة تسلسلي"
                />
              </div>

              {/* حقل تاريخ الفاتورة في الأعلى بجانب الرقم */}
              <div className="flex items-center gap-1.5 bg-[#1e2a38] px-2 py-0.5 rounded-md border border-slate-500/60 shadow-inner">
                <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-[11px] font-bold text-slate-300 shrink-0">التاريخ:</span>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="bg-white text-slate-900 px-1.5 py-0.5 rounded text-xs font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Navigation buttons: أيقونات فقط بدون كتابة (الأخير | التالي | السابق | الأول) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#243343] p-1 rounded-lg border border-slate-600/70 shadow-inner">
              <button
                type="button"
                onClick={handleLast}
                disabled={sortedInvoices.length === 0 || currentId === null || currentIndex >= sortedInvoices.length - 1}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="السجل الأخير"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={sortedInvoices.length === 0 || currentId === null || currentIndex >= sortedInvoices.length - 1}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="التالي"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handlePrev}
                disabled={sortedInvoices.length === 0 || (currentId !== null && currentIndex === 0)}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="السابق"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleFirst}
                disabled={sortedInvoices.length === 0 || (currentId !== null && currentIndex === 0)}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="السجل الأول"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <span className="text-[11px] text-slate-300 font-bold px-2 min-w-[70px] text-center font-mono">
                {currentId === null
                  ? `(جديدة / ${sortedInvoices.length})`
                  : `(${currentIndex + 1} / ${sortedInvoices.length})`}
              </span>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 bg-slate-700/80 hover:bg-slate-600 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Top 2-Card Metadata Grid: Seller (Right), Buyer (Left) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-2.5 sm:p-3 shrink-0 text-xs border-b border-slate-600/70 bg-[#2e3e50]">
          
          {/* Card 1: البائع */}
          <div className="bg-[#334457] border border-slate-600/70 p-2.5 sm:p-3 rounded-lg shadow-sm flex flex-col justify-between gap-2.5">
            {/* Row 1: Label + Combobox + Payment Toggle */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-sky-300 shrink-0 flex items-center gap-1 w-[100px] whitespace-nowrap">
                <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>اختر البائع</span>
                <span className="text-rose-400 font-bold mr-0.5">*</span>
              </label>

              <div className="flex-1 min-w-0">
                <ContainmentCombobox
                  options={accountComboboxOptions}
                  value={sellerId}
                  onChange={(id, opt) => {
                    setSellerId(id);
                    if (opt) setSellerName(opt.label);
                    else {
                      const selected = accounts.find((a) => a.id === id);
                      if (selected) setSellerName(selected.name);
                      else setSellerName(id);
                    }
                  }}
                  showCode={settings.showAccountCode}
                  allowCustom={true}
                  onAddNew={(text) => handleOpenNewAccount('seller', text)}
                  onEnterNotFound={(text) => {
                    setNotFoundDialog({
                      isOpen: true,
                      type: 'seller',
                      name: text,
                    });
                  }}
                  addNewType="account"
                  size="sm"
                  placeholder="اختر البائع..."
                  searchPlaceholder="اكتب اسم أو رمز البائع للبحث..."
                  className="w-full"
                  onAddClick={() => handleOpenNewAccount('seller', sellerName)}
                  addTitle="إضافة عميل / بائع جديد"
                />
              </div>

              {/* Payment 2-Button Toggle */}
              <div className="flex rounded-md overflow-hidden border border-slate-500/60 bg-[#202c3a] p-0.5 w-24 shrink-0 h-8">
                <button
                  type="button"
                  onClick={() => setSellerPaymentType('نقدي')}
                  className={`flex-1 h-full text-[11px] font-bold text-center rounded transition-colors cursor-pointer flex items-center justify-center ${
                    sellerPaymentType === 'نقدي'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  نقدي
                </button>
                <button
                  type="button"
                  onClick={() => setSellerPaymentType('آجل')}
                  className={`flex-1 h-full text-[11px] font-bold text-center rounded transition-colors cursor-pointer flex items-center justify-center ${
                    sellerPaymentType === 'آجل'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  آجل
                </button>
              </div>
            </div>

            {/* Row 2: Notes Input aligned exactly with Combobox start and end */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300 shrink-0 w-[100px] flex items-center whitespace-nowrap">
                ملاحظات البائع:
              </span>
              <input
                type="text"
                placeholder="اكتب ملاحظات..."
                value={sellerNotes}
                onChange={(e) => setSellerNotes(e.target.value)}
                className="flex-1 min-w-0 bg-white text-slate-900 px-2.5 py-1 rounded text-xs h-8 focus:outline-none focus:ring-1 focus:ring-sky-400 placeholder:text-slate-400 font-medium"
              />
              <div className="w-24 shrink-0" />
            </div>
          </div>

          {/* Card 2: المشتري */}
          <div className="bg-[#334457] border border-slate-600/70 p-2.5 sm:p-3 rounded-lg shadow-sm flex flex-col justify-between gap-2.5">
            {/* Row 1: Label + Combobox + Payment Toggle */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-emerald-300 shrink-0 flex items-center gap-1 w-[100px] whitespace-nowrap">
                <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                <span>اختر المشتري</span>
                <span className="text-rose-400 font-bold mr-0.5">*</span>
              </label>

              <div className="flex-1 min-w-0">
                <ContainmentCombobox
                  options={accountComboboxOptions}
                  value={buyerId}
                  onChange={(id, opt) => {
                    setBuyerId(id);
                    if (opt) setBuyerName(opt.label);
                    else {
                      const selected = accounts.find((a) => a.id === id);
                      if (selected) setBuyerName(selected.name);
                      else setBuyerName(id);
                    }
                  }}
                  showCode={settings.showAccountCode}
                  allowCustom={true}
                  onAddNew={(text) => handleOpenNewAccount('buyer', text)}
                  onEnterNotFound={(text) => {
                    setNotFoundDialog({
                      isOpen: true,
                      type: 'buyer',
                      name: text,
                    });
                  }}
                  addNewType="account"
                  size="sm"
                  placeholder="اختر المشتري..."
                  searchPlaceholder="اكتب اسم أو رمز المشتري للبحث..."
                  className="w-full"
                  onAddClick={() => handleOpenNewAccount('buyer', buyerName)}
                  addTitle="إضافة عميل / مشتري جديد"
                />
              </div>

              {/* Payment 2-Button Toggle */}
              <div className="flex rounded-md overflow-hidden border border-slate-500/60 bg-[#202c3a] p-0.5 w-24 shrink-0 h-8">
                <button
                  type="button"
                  onClick={() => setBuyerPaymentType('نقدي')}
                  className={`flex-1 h-full text-[11px] font-bold text-center rounded transition-colors cursor-pointer flex items-center justify-center ${
                    buyerPaymentType === 'نقدي'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  نقدي
                </button>
                <button
                  type="button"
                  onClick={() => setBuyerPaymentType('آجل')}
                  className={`flex-1 h-full text-[11px] font-bold text-center rounded transition-colors cursor-pointer flex items-center justify-center ${
                    buyerPaymentType === 'آجل'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  آجل
                </button>
              </div>
            </div>

            {/* Row 2: Notes Input aligned exactly with Combobox start and end */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300 shrink-0 w-[100px] flex items-center whitespace-nowrap">
                ملاحظات المشتري:
              </span>
              <input
                type="text"
                placeholder="اكتب ملاحظات..."
                value={buyerNotes}
                onChange={(e) => setBuyerNotes(e.target.value)}
                className="flex-1 min-w-0 bg-white text-slate-900 px-2.5 py-1 rounded text-xs h-8 focus:outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-slate-400 font-medium"
              />
              <div className="w-24 shrink-0" />
            </div>
          </div>

        </div>

        {/* Middle Section: Table with flexible height taking full remaining space */}
        <div className="flex-1 min-h-0 flex flex-col p-2 sm:p-2.5 md:p-3 bg-[#263545] overflow-hidden">
          
          {/* Invoice Rows Grid Header & Action Bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-slate-700/80 rounded-md text-slate-200">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs md:text-sm font-black text-white">
                جدول مواد الفاتورة
              </h3>
            </div>

            <div className="flex items-center gap-2 relative">
              <button
                type="button"
                onClick={() => setShowColumnControlPopover(!showColumnControlPopover)}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-xs font-bold shadow-xs cursor-pointer transition-colors border border-slate-600"
                title="التحكم بأعمدة الجدول"
              >
                <Settings2 className="w-3.5 h-3.5 text-amber-400" />
                <span>التحكم بالأعمدة</span>
              </button>

              {showColumnControlPopover && (
                <div className="absolute left-0 top-full mt-1.5 w-48 bg-[#1e2a38] text-white border border-slate-600 rounded-lg shadow-2xl p-2.5 z-40 space-y-2 text-xs font-bold animate-in fade-in zoom-in-95 duration-100">
                  <div className="text-[11px] text-amber-400 font-black border-b border-slate-700 pb-1 flex items-center justify-between">
                    <span>إظهار / إخفاء الأعمدة</span>
                    <button
                      type="button"
                      onClick={() => setShowColumnControlPopover(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-800 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={visibleColumns.discountTare}
                      onChange={(e) => handleToggleColumn('discountTare', e.target.checked)}
                      className="accent-emerald-500 w-3.5 h-3.5 rounded"
                    />
                    <span>الخصم</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-800 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={visibleColumns.discountPercent}
                      onChange={(e) => handleToggleColumn('discountPercent', e.target.checked)}
                      className="accent-emerald-500 w-3.5 h-3.5 rounded"
                    />
                    <span>الخصم %</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-800 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={visibleColumns.unit}
                      onChange={(e) => handleToggleColumn('unit', e.target.checked)}
                      className="accent-emerald-500 w-3.5 h-3.5 rounded"
                    />
                    <span>الوحدة</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-800 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={visibleColumns.notes}
                      onChange={(e) => handleToggleColumn('notes', e.target.checked)}
                      className="accent-emerald-500 w-3.5 h-3.5 rounded"
                    />
                    <span>ملاحظات</span>
                  </label>
                </div>
              )}

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
          <div id="invoice-table-root" className="flex-1 min-h-0 bg-white rounded-lg overflow-y-auto overflow-x-auto border border-slate-600 shadow-inner relative">
            <table className="w-full min-w-full text-center border-collapse text-xs min-h-full">
              <thead className="sticky top-0 bg-[#253342] text-slate-100 font-bold z-20 shadow-xs">
                <tr className="border-b border-slate-700">
                  <th className="py-2 px-2 border-l border-slate-700 w-12 text-center">#</th>
                  <th className="py-2 px-3 border-l border-slate-700 min-w-[200px] text-right">
                    {settings.showItemCode ? 'المادة والرمز' : 'اسم المادة'}
                  </th>
                  {visibleColumns.unit && (
                    <th className="py-2 px-2 border-l border-slate-700 w-20">الوحدة</th>
                  )}
                  <th className="py-2 px-2 border-l border-slate-700 w-28">وزن قائم</th>
                  {visibleColumns.discountTare && (
                    <th className="py-2 px-2 border-l border-slate-700 w-24">الخصم</th>
                  )}
                  {visibleColumns.discountPercent && (
                    <th className="py-2 px-2 border-l border-slate-700 w-20">الخصم %</th>
                  )}
                  <th className="py-2 px-2 border-l border-slate-700 w-28 bg-[#1e2a37]">الوزن الصافي</th>
                  <th className="py-2 px-2 border-l border-slate-700 w-28">السعر الإفرادي</th>
                  <th className="py-2 px-3 border-l border-slate-700 w-32 bg-[#1e2a37]">المجموع</th>
                  {visibleColumns.notes && (
                    <th className="py-2 px-3 border-l border-slate-700 min-w-[140px] text-right">ملاحظات</th>
                  )}
                  <th className="py-2 px-1.5 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-900 align-top">
                {rows.map((row, idx) => {
                  return (
                    <tr key={row.id} className="hover:bg-sky-50/50 bg-white transition-colors">
                      {/* الرقم */}
                      <td className="py-1 px-2 border-l border-slate-200 font-bold text-slate-700 bg-slate-50/80">
                        {idx + 1}
                      </td>

                      {/* المادة (بحث احتواء مع إمكانية إضافة مادة جديدة فورية) */}
                      <td className="py-1 px-2 border-l border-slate-200 text-right">
                        <ContainmentCombobox
                          options={itemComboboxOptions}
                          value={row.itemName}
                          onChange={(val, opt) => updateRowField(idx, 'itemName', opt ? opt.label : val)}
                          showCode={settings.showItemCode}
                          allowCustom={true}
                          onAddNew={(text) => handleOpenNewItem(idx, text)}
                          onEnterNotFound={(text) => {
                            setNotFoundDialog({
                              isOpen: true,
                              type: 'item',
                              name: text,
                              rowIndex: idx,
                            });
                          }}
                          addNewType="item"
                          size="sm"
                          placeholder="-- اختر أو ابحث عن مادة --"
                          searchPlaceholder="ابحث باسم المادة..."
                          className="w-full text-right"
                          gridRow={idx}
                          gridCol={0}
                          onGridKeyDown={(e) => handleGridKeyDown(e, idx, 0, 'invoice-table-root', addRow)}
                        />
                      </td>

                      {/* الوحدة */}
                      {visibleColumns.unit && (
                        <td className="py-1 px-1.5 border-l border-slate-200">
                          <input
                            type="text"
                            data-grid-row={idx}
                            data-grid-col={1}
                            value={row.unit}
                            onChange={(e) => updateRowField(idx, 'unit', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            onKeyDown={(e) => handleGridKeyDown(e, idx, 1, 'invoice-table-root', addRow)}
                            className="w-full bg-slate-50 text-slate-900 px-2 py-0.5 rounded border border-slate-300 text-xs text-center font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>
                      )}

                      {/* وزن قائم */}
                      <td className="py-1 px-1.5 border-l border-slate-200">
                        <NumericInput
                          data-grid-row={idx}
                          data-grid-col={2}
                          value={row.grossWeight}
                          onChange={(val) => updateRowField(idx, 'grossWeight', val)}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          onKeyDown={(e) => handleGridKeyDown(e, idx, 2, 'invoice-table-root', addRow)}
                          placeholder="0"
                          className="w-full bg-white text-slate-900 px-2 py-0.5 rounded border border-slate-300 text-xs font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </td>

                      {/* الخصم (كغ) */}
                      {visibleColumns.discountTare && (
                        <td className="py-1 px-1.5 border-l border-slate-200">
                          <NumericInput
                            data-grid-row={idx}
                            data-grid-col={3}
                            value={row.discountTare}
                            onChange={(val) => updateRowField(idx, 'discountTare', val)}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            onKeyDown={(e) => handleGridKeyDown(e, idx, 3, 'invoice-table-root', addRow)}
                            placeholder="0"
                            className="w-full bg-white text-slate-900 px-2 py-0.5 rounded border border-slate-300 text-xs font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>
                      )}

                      {/* الخصم % */}
                      {visibleColumns.discountPercent && (
                        <td className="py-1 px-1.5 border-l border-slate-200">
                          <NumericInput
                            data-grid-row={idx}
                            data-grid-col={4}
                            value={row.discountPercent}
                            onChange={(val) => updateRowField(idx, 'discountPercent', val)}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            onKeyDown={(e) => handleGridKeyDown(e, idx, 4, 'invoice-table-root', addRow)}
                            placeholder="%"
                            className="w-full bg-white text-slate-900 px-1 py-0.5 rounded border border-slate-300 text-xs font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>
                      )}

                      {/* الوزن الصافي (قابل للتعديل بحساب عكسي) */}
                      <td className="py-1 px-1.5 border-l border-slate-200 bg-emerald-50/70">
                        <NumericInput
                          data-grid-row={idx}
                          data-grid-col={5}
                          value={row.netWeight}
                          onChange={(val) => updateRowField(idx, 'netWeight', val)}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          onKeyDown={(e) => handleGridKeyDown(e, idx, 5, 'invoice-table-root', addRow)}
                          placeholder="0"
                          className="w-full bg-emerald-50 text-emerald-950 font-mono font-black text-xs md:text-sm px-2 py-0.5 rounded border border-emerald-300 text-center focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </td>

                      {/* الإفرادي (السعر) */}
                      <td className="py-1 px-1.5 border-l border-slate-200">
                        <NumericInput
                          data-grid-row={idx}
                          data-grid-col={6}
                          value={row.unitPrice}
                          onChange={(val) => updateRowField(idx, 'unitPrice', val)}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          onKeyDown={(e) => handleGridKeyDown(e, idx, 6, 'invoice-table-root', addRow)}
                          placeholder="0"
                          className="w-full bg-white text-slate-900 px-2 py-0.5 rounded border border-slate-300 text-xs font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </td>

                      {/* الإجمالي */}
                      <td className="py-1 px-2 border-l border-slate-200 font-mono font-black text-slate-950 bg-slate-50 text-xs md:text-sm">
                        {row.total.toLocaleString()}
                      </td>

                      {/* ملاحظات السطر */}
                      {visibleColumns.notes && (
                        <td className="py-1 px-1.5 border-l border-slate-200 text-right">
                          <input
                            type="text"
                            data-grid-row={idx}
                            data-grid-col={7}
                            placeholder="ملاحظات..."
                            value={row.notes}
                            onChange={(e) => updateRowField(idx, 'notes', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            onKeyDown={(e) => handleGridKeyDown(e, idx, 7, 'invoice-table-root', addRow)}
                            className="w-full bg-white text-slate-900 px-2 py-0.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>
                      )}

                      {/* Delete row */}
                      <td className="py-1 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 cursor-pointer transition-colors"
                          title="حذف السطر"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Fixed / Sticky Footer */}
              <tfoot className="sticky bottom-0 bg-white text-slate-900 font-bold z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.12)]">
                <tr className="divide-x divide-x-reverse divide-slate-200 text-xs bg-white sticky bottom-0">
                  <td className="sticky bottom-0 py-2.5 px-2 text-center text-slate-950 font-black bg-slate-100 font-mono text-xs md:text-sm border-t-2 border-slate-300 shadow-[0_-4px_8px_rgba(0,0,0,0.06)]" title={`عدد الأسطر: ${rows.length}`}>
                    {rows.length}
                  </td>

                  <td className="sticky bottom-0 py-2.5 px-3 text-right bg-white border-t-2 border-slate-300 shadow-[0_-4px_8px_rgba(0,0,0,0.06)]">
                    <span className="text-slate-600 font-bold">عدد المواد: </span>
                    <span className="font-mono font-black text-amber-800 text-xs px-2 py-0.5 bg-amber-50 rounded border border-amber-300">
                      {activeItemsCount}
                    </span>
                  </td>

                  {visibleColumns.unit && (
                    <td className="sticky bottom-0 py-2.5 px-2 text-center text-slate-400 bg-white border-t-2 border-slate-300 shadow-[0_-4px_8px_rgba(0,0,0,0.06)]">
                      -
                    </td>
                  )}

                  <td className="sticky bottom-0 py-2.5 px-2 text-center font-mono font-black text-sky-800 bg-sky-50 text-xs md:text-sm border-t-2 border-slate-300 shadow-[0_-4px_8px_rgba(0,0,0,0.06)]" title="إجمالي الوزن القائم">
                    {totalGrossWeight.toLocaleString()}
                  </td>

                  {visibleColumns.discountTare && (
                    <td className="sticky bottom-0 py-2.5 px-2 text-center font-mono font-black text-amber-800 bg-amber-50 text-xs md:text-sm border-t-2 border-slate-300 shadow-[0_-4px_8px_rgba(0,0,0,0.06)]" title="إجمالي الخصم">
                      {totalTareWeight.toLocaleString()}
                    </td>
                  )}

                  {visibleColumns.discountPercent && (
                    <td className="sticky bottom-0 py-2.5 px-2 text-center text-slate-400 bg-white border-t-2 border-slate-300 shadow-[0_-4px_8px_rgba(0,0,0,0.06)]">
                      -
                    </td>
                  )}

                  <td className="sticky bottom-0 py-2.5 px-2 text-center font-mono font-black text-emerald-800 bg-emerald-50 text-xs md:text-sm border-t-2 border-slate-300 shadow-[0_-4px_8px_rgba(0,0,0,0.06)]" title="إجمالي الوزن الصافي">
                    {totalNetWeight.toLocaleString()}
                  </td>

                  <td className="sticky bottom-0 py-2.5 px-2 text-center text-slate-400 bg-white border-t-2 border-slate-300 shadow-[0_-4px_8px_rgba(0,0,0,0.06)]">
                    -
                  </td>

                  <td className="sticky bottom-0 py-2.5 px-3 text-center font-mono font-black text-slate-950 bg-slate-100 text-xs md:text-sm border-t-2 border-slate-300 shadow-[0_-4px_8px_rgba(0,0,0,0.06)]" title="الإجمالي">
                    {totalAmount.toLocaleString()}
                  </td>

                  {visibleColumns.notes && (
                    <td className="sticky bottom-0 py-2.5 px-3 text-right text-[11px] text-slate-600 bg-white border-t-2 border-slate-300 shadow-[0_-4px_8px_rgba(0,0,0,0.06)]">
                      {activeItemsCount > 0 ? `${activeItemsCount} مواد مسجلة` : 'لا توجد مواد'}
                    </td>
                  )}

                  <td className="sticky bottom-0 py-2.5 px-1 bg-white border-t-2 border-slate-300 shadow-[0_-4px_8px_rgba(0,0,0,0.06)]"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Compact Pinned Bottom Bar: Action Buttons & Totals */}
        <div className="shrink-0 bg-[#18222d] border-t border-slate-600 px-3 py-1.5 shadow-lg z-20 flex flex-wrap items-center justify-between gap-2">
          
          {/* Main Action Buttons on Right in RTL: جديد حذف تعديل حفظ طباعة بائع طباعة مشتري */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 1. جديد */}
            <button
              type="button"
              onClick={() => handleNew()}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer transition-colors"
              title="تفريغ الفاتورة وإنشاء فاتورة جديدة"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>جديد</span>
            </button>

            {/* 2. حذف */}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={!currentId}
              className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow-sm disabled:opacity-40 cursor-pointer transition-colors"
              title="حذف الفاتورة الحالية"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف</span>
            </button>

            {/* 3. حفظ / تعديل ذكي */}
            <button
              type="button"
              onClick={handleSave}
              className={`flex items-center gap-1 px-3 py-1 font-black text-xs rounded-lg shadow-sm cursor-pointer transition-colors ${
                currentId
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950'
              }`}
              title={currentId ? "حفظ التعديلات على الفاتورة" : "حفظ الفاتورة الحالية"}
            >
              {currentId ? <Edit className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{currentId ? 'تعديل' : 'حفظ'}</span>
            </button>

            <div className="h-4 w-px bg-slate-600 mx-0.5" />

            {/* 5. طباعة بائع */}
            <button
              type="button"
              onClick={handlePrintSeller}
              className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-lg shadow-sm cursor-pointer transition-colors"
              title="طباعة نسخة البائع"
            >
              <Printer className="w-3.5 h-3.5 text-sky-700" />
              <span>طباعة بائع</span>
            </button>

            {/* 6. طباعة مشتري */}
            <button
              type="button"
              onClick={handlePrintBuyer}
              className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-lg shadow-sm cursor-pointer transition-colors"
              title="طباعة نسخة المشتري"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-700" />
              <span>طباعة مشتري</span>
            </button>

            <div className="h-4 w-px bg-slate-600 mx-0.5" />

            {/* 7. إغلاق */}
            <button
              type="button"
              onClick={onClose || (() => setCurrentView('home'))}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer transition-colors"
              title="إغلاق والعودة"
            >
              <X className="w-3.5 h-3.5 text-rose-400" />
              <span>إغلاق</span>
            </button>
          </div>

          {/* Compact Financial Totals on Left in RTL */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* الإجمالي */}
            <div className="flex items-center gap-1.5 bg-[#253342] px-2 py-0.5 rounded-lg border border-slate-600/70 text-xs">
              <span className="text-slate-300 font-bold text-[11px]">الإجمالي:</span>
              <div className="bg-white text-slate-950 px-2 py-0.5 rounded font-mono font-black text-xs min-w-[70px] text-center">
                {totalAmount.toLocaleString()}
              </div>
            </div>

            {/* الكمسيون مع إظهار حالة التقريب */}
            <div className="flex items-center gap-1.5 bg-[#253342] px-2 py-0.5 rounded-lg border border-slate-600/70 text-xs">
              <span className="text-slate-300 font-bold text-[11px]">كمسيون</span>
              <div className="flex items-center bg-slate-800 rounded px-1.5 py-0.5 border border-slate-600">
                <input
                  type="number"
                  value={commissionRate}
                  onChange={(e) => {
                    setLoadedCommissionValue(null);
                    setCommissionRate(Number(e.target.value) || 0);
                  }}
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-7 bg-transparent text-amber-300 font-mono font-black text-xs text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-slate-400 text-[10px]">%</span>
              </div>
              <span className="text-slate-400 text-[10px]">:</span>
              <div
                className="bg-white text-amber-900 px-2 py-0.5 rounded font-mono font-black text-xs min-w-[65px] text-center"
                title={
                  settings.commissionRoundingDirection && settings.commissionRoundingDirection !== 'none'
                    ? `قيمة الكمسيون قبل التقريب: ${Math.round(rawCommission).toLocaleString()} | مقرب ${
                        settings.commissionRoundingDirection === 'up'
                          ? 'لأعلى'
                          : settings.commissionRoundingDirection === 'down'
                          ? 'لأدنى'
                          : 'لأقرب'
                      } بمقدار ${settings.commissionRoundingValue ?? 50}`
                    : 'قيمة الكمسيون'
                }
              >
                {commissionValue.toLocaleString()}
              </div>

              {settings.commissionRoundingDirection && settings.commissionRoundingDirection !== 'none' && (
                <span
                  className="text-[9px] px-1 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold hidden sm:inline-flex items-center gap-0.5 select-none"
                  title={`تقريب ${
                    settings.commissionRoundingDirection === 'up'
                      ? 'لأعلى'
                      : settings.commissionRoundingDirection === 'down'
                      ? 'لأدنى'
                      : 'لأقرب'
                  } ${settings.commissionRoundingValue ?? 50} (الخام: ${Math.round(rawCommission).toLocaleString()})`}
                >
                  <span>{settings.commissionRoundingDirection === 'up' ? '↑' : settings.commissionRoundingDirection === 'down' ? '↓' : '≈'}</span>
                  <span>{settings.commissionRoundingValue ?? 50}</span>
                </span>
              )}
            </div>

            {/* صافي الفاتورة */}
            <div className="flex items-center gap-1.5 bg-emerald-600 text-slate-950 px-2.5 py-0.5 rounded-lg border border-emerald-400 shadow-xs text-xs">
              <span className="font-black text-slate-950 text-xs">الصافي:</span>
              <div className="bg-white text-slate-950 px-2 py-0.5 rounded font-mono font-black text-xs min-w-[75px] text-center shadow-inner">
                {netAmount.toLocaleString()}
              </div>
            </div>

            {/* تفقيط المبلغ */}
            {settings.showTafqeet && (
              <div className="hidden 2xl:flex items-center text-[10px] text-slate-200 font-semibold bg-[#141e28] px-2 py-1 rounded-lg border border-slate-700 truncate max-w-[200px]" title={tafqeetNumber(netAmount)}>
                {tafqeetNumber(netAmount)}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Missing Entity Prompt Modal (Triggered on Enter key if not in database) */}
      {notFoundDialog.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" dir="rtl">
          <div className="bg-[#243343] text-white border border-amber-500/50 rounded-2xl p-5 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3 border-b border-slate-600/70 pb-3">
              <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-400/40 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-base text-white">
                  {notFoundDialog.type === 'item' ? 'المادة غير موجودة في الدليل' : 'الحساب غير موجود في الدليل'}
                </h3>
                <p className="text-xs text-amber-200/90 font-medium mt-0.5">
                  تنبيه إدخال بيانات جديدة
                </p>
              </div>
            </div>

            <div className="bg-[#1c2633] p-3.5 rounded-xl border border-slate-700/80 mb-4 text-xs leading-relaxed text-slate-200">
              {notFoundDialog.type === 'item' ? (
                <>
                  المادة <span className="font-bold text-amber-300">«{notFoundDialog.name}»</span> غير مسجلة في دليل المواد.
                  <br />
                  هل ترغب في فتح بطاقة مادة جديدة لإضافتها فوراً إلى النظام وإدراجها بالسطر؟
                </>
              ) : (
                <>
                  الحساب <span className="font-bold text-amber-300">«{notFoundDialog.name}»</span> غير مسجل في دليل الحسابات.
                  <br />
                  هل ترغب في فتح بطاقة حساب جديدة لإضافته فوراً إلى دليل الحسابات وإدراجه في الفاتورة؟
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setNotFoundDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  const { type, name, rowIndex } = notFoundDialog;
                  setNotFoundDialog((prev) => ({ ...prev, isOpen: false }));
                  if (type === 'item') {
                    handleOpenNewItem(rowIndex ?? 0, name);
                  } else {
                    handleOpenNewAccount(type, name);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-md transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{notFoundDialog.type === 'item' ? 'إضافة بطاقة مادة جديدة' : 'إضافة بطاقة حساب جديدة'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="حذف فاتورة كمسيون"
        message={`هل أنت متأكد من حذف الفاتورة رقم (${invoiceNumber}) نهائياً من النظام؟\nلن يمكن التراجع عن هذا الإجراء.`}
        confirmText="تأكيد الحذف"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Instant Account Card Modal Dialog */}
      {accountModalOpen && (
        <AccountCardModal
          isDialog={true}
          initialName={accountModalInitialName}
          initialParentAccount={accountModalTarget === 'seller' ? 'موردين' : 'زبائن'}
          onAccountCreated={handleAccountCreated}
          onClose={() => setAccountModalOpen(false)}
        />
      )}

      {/* Instant Item Card Modal Dialog */}
      {itemModalOpen && (
        <ItemCardModal
          isDialog={true}
          initialName={itemModalInitialName}
          onItemCreated={handleItemCreated}
          onClose={() => setItemModalOpen(false)}
        />
      )}
    </div>
  );
};
