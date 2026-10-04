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
  Layers,
  List,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Item } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { ContainmentCombobox, ComboboxOption } from '../common/ContainmentCombobox';
import { getNextItemCode } from '../../utils/codeGenerator';

interface ItemCardModalProps {
  onClose: () => void;
  isDialog?: boolean;
  initialName?: string;
  initialCategory?: string;
  onItemCreated?: (item: Item) => void;
}

export const ItemCardModal: React.FC<ItemCardModalProps> = ({
  onClose,
  isDialog = false,
  initialName,
  initialCategory,
  onItemCreated,
}) => {
  const {
    items,
    categories,
    invoices,
    addItem,
    updateItem,
    deleteItem,
    selectedItemId,
    setSelectedItemId,
    setCurrentView,
    showNotification,
  } = useApp();

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [formData, setFormData] = useState<Omit<Item, 'id'>>({
    code: '',
    name: '',
    unit: 'كغ',
    category: '',
    notes: '',
  });

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  const categoryOptions: ComboboxOption[] = useMemo(() => {
    return categories.map((c) => ({
      id: c.name,
      label: c.name,
      code: c.code,
      subLabel: `رمز: ${c.code}`,
    }));
  }, [categories]);

  const prevSelectedItemIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (prevSelectedItemIdRef.current === selectedItemId) {
      return;
    }
    prevSelectedItemIdRef.current = selectedItemId;

    if (!selectedItemId) {
      if (initialName && initialName.trim()) {
        const cat = initialCategory || (categories.length > 0 ? categories[0].name : '');
        const nextCode = cat ? getNextItemCode(cat, undefined, items, categories) : '';
        setFormData({
          code: nextCode,
          name: initialName.trim(),
          unit: 'كغ',
          category: cat,
          notes: '',
        });
        setCurrentId(null);
      } else {
        handleManualNew();
      }
      return;
    }

    const foundIdx = items.findIndex((i) => i.id === selectedItemId);
    if (foundIdx !== -1) {
      setCurrentIndex(foundIdx);
      loadItem(items[foundIdx]);
    } else {
      handleManualNew();
    }
  }, [selectedItemId]);

  const loadItem = (item?: Item) => {
    if (!item) {
      handleNew();
      return;
    }
    setCurrentId(item.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFormData({
      code: item.code || '',
      name: item.name || '',
      unit: item.unit || 'كغ',
      category: item.category || '',
      notes: item.notes || '',
    });
  };

  // 1. عند النقر يدوياً على زر "جديد": تفريغ كل الحقول بالكامل
  const handleManualNew = () => {
    setCurrentId(null);
    setSelectedItemId(null);
    setCurrentIndex(items.length);
    setErrorMessage(null);
    setSuccessMessage(null);

    setFormData({
      code: '',
      name: '',
      unit: 'كغ',
      category: '',
      notes: '',
    });

    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
  };

  // 2. عند الحفظ: الحفاظ على الصنف الأب وزيادة الرمز 1 منعاً للتضارب
  const handlePostSaveNew = (preserveCategory?: string, lastCode?: string) => {
    setCurrentId(null);
    setSelectedItemId(null);
    setCurrentIndex(items.length);
    setErrorMessage(null);
    setSuccessMessage(null);

    const targetCategory = typeof preserveCategory === 'string' ? preserveCategory.trim() : '';
    const safeLastCode = typeof lastCode === 'string' ? lastCode : undefined;
    let nextCode = '';
    if (targetCategory) {
      nextCode = getNextItemCode(targetCategory, safeLastCode, items, categories);
    }

    setFormData({
      code: nextCode,
      name: '',
      unit: formData.unit || 'كغ',
      category: targetCategory,
      notes: '',
    });

    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
  };

  const handleNew = (preserveCategory?: unknown, lastCode?: string) => {
    if (typeof preserveCategory === 'string' && preserveCategory.trim()) {
      handlePostSaveNew(preserveCategory, typeof lastCode === 'string' ? lastCode : undefined);
    } else {
      handleManualNew();
    }
  };

  const handleCategoryChange = (newCat: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newCat || !newCat.trim()) {
      setFormData((prev) => ({
        ...prev,
        category: '',
        code: currentId ? prev.code : '',
      }));
      return;
    }

    const nextCode = getNextItemCode(newCat.trim(), undefined, items, categories);
    setFormData((prev) => ({
      ...prev,
      category: newCat.trim(),
      code: !currentId || prev.code === '' ? nextCode : prev.code,
    }));
  };

  // Navigation handlers (مطابقة تماماً لآلية الفاتورة)
  // 1. الأول (First record)
  const handleFirst = () => {
    if (items.length > 0) {
      setCurrentIndex(0);
      loadItem(items[0]);
    }
  };

  // 2. السابق (Previous record)
  const handlePrev = () => {
    if (items.length === 0) return;
    if (currentId === null) {
      const lastIdx = items.length - 1;
      setCurrentIndex(lastIdx);
      loadItem(items[lastIdx]);
    } else if (currentIndex > 0) {
      const newIdx = currentIndex - 1;
      setCurrentIndex(newIdx);
      loadItem(items[newIdx]);
    }
  };

  // 3. التالي (Next record)
  const handleNext = () => {
    if (items.length === 0 || currentId === null) return;
    if (currentIndex < items.length - 1) {
      const newIdx = currentIndex + 1;
      setCurrentIndex(newIdx);
      loadItem(items[newIdx]);
    }
  };

  // 4. الأخير (Last record)
  const handleLast = () => {
    if (items.length > 0) {
      const lastIdx = items.length - 1;
      setCurrentIndex(lastIdx);
      loadItem(items[lastIdx]);
    }
  };

  // Save handler with duplicate code/name checks, auto-increment by 1, and clearing
  const handleSave = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedCode = formData.code.trim();
    const trimmedName = formData.name.trim();
    const trimmedCat = formData.category.trim();

    if (!trimmedCode) {
      setErrorMessage('يرجى إدخال رمز المادة أو اختيار التصنيف الأب لتوليد الرمز تلقائياً');
      return;
    }

    if (!trimmedName) {
      setErrorMessage('يرجى إدخال اسم المادة');
      nameInputRef.current?.focus();
      return;
    }

    if (!trimmedCat) {
      setErrorMessage('يرجى اختيار التصنيف الأب (الصنف)');
      return;
    }

    // التحقق من وجود الصنف المعرف مسبقاً في النظام
    const categoryExists = categories.some(
      (c) => c.name.trim().toLowerCase() === trimmedCat.toLowerCase()
    );
    if (!categoryExists) {
      const msg = `الصنف "${trimmedCat}" غير معرف في النظام! يجب تعريف الصنف أولاً من خلال (بطاقة صنف) قبل استخدامه كمادة.`;
      setErrorMessage(msg);
      showNotification(msg, 'error');
      return;
    }

    // 1. منع تكرار رمز المادة
    const duplicateCode = items.find(
      (i) => i.id !== currentId && i.code.trim() === trimmedCode
    );
    if (duplicateCode) {
      const msg = `رمز المادة (${trimmedCode}) مستخدم مسبقاً للمادة "${duplicateCode.name}"! يمنع تكرار الرمز.`;
      setErrorMessage(msg);
      showNotification(msg, 'error');
      return;
    }

    // 2. منع تكرار اسم المادة
    const duplicateName = items.find(
      (i) => i.id !== currentId && i.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicateName) {
      const msg = `اسم المادة "${trimmedName}" موجود مسبقاً بالرمز (${duplicateName.code})! يمنع تكرار اسم المادة.`;
      setErrorMessage(msg);
      showNotification(msg, 'error');
      return;
    }

    // Save or update
    let savedItem: Item;
    if (currentId) {
      savedItem = {
        ...formData,
        code: trimmedCode,
        name: trimmedName,
        category: trimmedCat,
        id: currentId,
      };
      updateItem(savedItem);
      showNotification(`تم تعديل بيانات المادة (${trimmedName}) بنجاح`, 'success');
      setSuccessMessage(`تم تعديل المادة (${trimmedName}) برمز (${trimmedCode}) بنجاح`);
      if (onItemCreated) {
        onItemCreated(savedItem);
        onClose();
        return;
      }
      // البقاء في نفس بطاقة المادة عند التعديل
      setFormData({
        code: trimmedCode,
        name: trimmedName,
        unit: formData.unit || 'كغ',
        category: trimmedCat,
        notes: formData.notes || '',
      });
      return;
    } else {
      savedItem = addItem({
        ...formData,
        code: trimmedCode,
        name: trimmedName,
        category: trimmedCat,
      });
      showNotification(`تمت إضافة المادة (${trimmedName}) برمز (${trimmedCode}) بنجاح`, 'success');
      setSuccessMessage(`تم حفظ المادة (${trimmedName}) برمز (${trimmedCode}) بنجاح!`);
      
      if (onItemCreated) {
        onItemCreated(savedItem);
        onClose();
        return;
      }

      // عند الحفظ الجديد: الانتقال إلى بطاقة جديدة مع الحفاظ على الصنف وزيادة الرمز 1 (+1)
      handleNew(trimmedCat, trimmedCode);
    }
  };

  const handleDelete = () => {
    if (!currentId) return;

    const itemToDelete = items.find((i) => i.id === currentId);
    if (!itemToDelete) return;

    // منع حذف المادة إذا كانت مستخدمة في فواتير محفوظة
    const isUsedInInvoice = invoices.some((inv) =>
      inv.rows.some(
        (r) =>
          r.itemName.trim().toLowerCase() === itemToDelete.name.trim().toLowerCase() ||
          r.itemId === itemToDelete.id
      )
    );

    if (isUsedInInvoice) {
      const msg = `يمنع حذف المادة "${itemToDelete.name}" (رمز ${itemToDelete.code}) لوجود فواتير كمسيون محفوظة تحتوي عليها! يمنع حذف المواد ذات الحركة.`;
      setErrorMessage(msg);
      setShowDeleteConfirm(false);
      showNotification(msg, 'error');
      return;
    }

    deleteItem(currentId);
    setShowDeleteConfirm(false);
    showNotification(`تم حذف المادة (${itemToDelete.name}) بنجاح`, 'success');
    setSuccessMessage(`تم حذف المادة (${itemToDelete.name}) بنجاح`);
    handleNew();
  };

  // Keyboard shortcuts (F2 Save, F3 New, F9 Delete)
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const handleNewRef = useRef(handleNew);
  handleNewRef.current = handleNew;
  const handleDeleteRef = useRef(() => {
    if (currentId) setShowDeleteConfirm(true);
  });
  handleDeleteRef.current = () => {
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
      <div className={`w-full ${isDialog ? 'max-w-4xl my-auto' : 'max-w-5xl mx-auto'} bg-[#3c4f65] text-white rounded-xl shadow-2xl border border-slate-600/80 p-5 md:p-7 flex flex-col gap-5`}>
        
        {/* Top Header Row: Title on right, Navigation buttons: الأخير | التالي | السابق | الأول on left */}
        <div className="flex items-center justify-between border-b border-slate-500/40 pb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide">
              بطاقة مادة
            </h2>
            {currentId ? (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs px-2.5 py-1 rounded font-semibold">
                تعديل مادة ({formData.code})
              </span>
            ) : (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-xs px-2.5 py-1 rounded font-semibold">
                مادة جديدة (إضافة متتالية)
              </span>
            )}
          </div>

          {/* Navigation buttons: مثل الفاتورة (أيقونات فقط بدون كتابة: الأخير | التالي | السابق | الأول) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#243343] p-1 rounded-lg border border-slate-600/70 shadow-inner">
              <button
                type="button"
                onClick={handleLast}
                disabled={items.length === 0 || currentId === null || currentIndex >= items.length - 1}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="السجل الأخير"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={items.length === 0 || currentId === null || currentIndex >= items.length - 1}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="التالي"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handlePrev}
                disabled={items.length === 0 || (currentId !== null && currentIndex === 0)}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="السابق"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleFirst}
                disabled={items.length === 0 || (currentId !== null && currentIndex === 0)}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="السجل الأول"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <span className="text-[11px] text-slate-300 font-bold px-2 min-w-[70px] text-center font-mono">
                {currentId === null
                  ? `(جديد / ${items.length})`
                  : `(${currentIndex + 1} / ${items.length})`}
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
          <div className="bg-rose-500/20 border border-rose-400/60 text-rose-200 text-xs px-4 py-2.5 rounded-lg flex items-center justify-between gap-2">
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

        {/* Form Body: 2 Columns - Right column = Basic Info (Code, Name, Category), Left column = Additional Info (Unit, Notes) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-800/40 p-4 md:p-6 rounded-lg border border-slate-600/40">
          {/* الطرف اليميني: معلومات المادة الأساسية */}
          <div className="flex flex-col gap-3.5">
            <h3 className="text-sm font-bold text-amber-300 border-b border-slate-500/50 pb-1.5 flex items-center justify-between">
              <span>بيانات المادة الأساسية</span>
              <span className="text-xs text-slate-300 font-normal">الرمز واسم المادة فريدان</span>
            </h3>

            {/* الصنف (التصنيف الأب) - قابل للبحث */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200">
                  التصنيف الأب (الصنف) <span className="text-amber-400">* (قابل للبحث)</span>
                </label>
                <span className="text-[11px] text-slate-400">يحدد تسلسل الرمز</span>
              </div>
              <ContainmentCombobox
                options={categoryOptions}
                value={formData.category}
                onChange={(val) => handleCategoryChange(val)}
                placeholder="-- ابحث واختر الصنف المعرف --"
                searchPlaceholder="اكتب للبحث عن الصنف بالاسم أو الرمز..."
                allowCustom={false}
                className="w-full text-slate-900"
              />
            </div>

            {/* رمز المادة */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200">
                  رمز المادة <span className="text-amber-400">* (يمنع التكرار)</span>
                </label>
                <span className="text-[11px] text-slate-400">يزيد 1 تلقائياً تبعاً للصنف</span>
              </div>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full bg-white text-slate-900 px-3 py-2 rounded-md font-mono font-bold text-base focus:outline-none focus:ring-2 focus:ring-amber-400 text-center md:text-right border border-slate-300"
                placeholder={formData.category ? 'رمز المادة' : 'اختر الصنف لتوليد الرمز'}
              />
            </div>

            {/* اسم المادة */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-200">
                اسم المادة <span className="text-amber-400">* (يمنع التكرار)</span>
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
          </div>

          {/* الطرف اليساري: وحدة القياس والملاحظات */}
          <div className="flex flex-col gap-3.5">
            <h3 className="text-sm font-bold text-amber-300 border-b border-slate-500/50 pb-1.5">
              تفاصيل إضافية
            </h3>

            {/* وحدة القياس */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-200">وحدة القياس</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full bg-white text-slate-900 px-3 py-2 rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-300"
              />
            </div>

            {/* ملاحظات */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-200">ملاحظات</label>
              <textarea
                rows={4}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full bg-white text-slate-900 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none border border-slate-300"
              ></textarea>
            </div>
          </div>
        </div>

        {/* Bottom Actions Toolbar: الطرف اليميني (بطاقة صنف، استعراض المواد) - الطرف اليساري (حفظ، حذف، جديد، إغلاق من أقصى اليسار) */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-500/40 flex-wrap">
          {/* الطرف اليميني: بطاقة صنف و استعراض المواد */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentView('category_card')}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-200 hover:bg-white text-slate-900 font-bold text-xs rounded-lg shadow cursor-pointer transition-colors"
            >
              <Layers className="w-4 h-4 text-amber-700" />
              <span>بطاقة صنف</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('items_list')}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-200 hover:bg-white text-slate-900 font-bold text-xs rounded-lg shadow cursor-pointer transition-colors"
            >
              <List className="w-4 h-4 text-teal-700" />
              <span>استعراض المواد</span>
            </button>
          </div>

          {/* الطرف اليساري: بدءاً من أقصى اليسار (حفظ | حذف | جديد | إغلاق) */}
          <div className="flex items-center gap-2.5 flex-wrap" dir="ltr">
            {/* 1. حفظ (أقصى اليسار) */}
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-lg shadow-md cursor-pointer transition-all active:scale-95"
              title="حفظ المادة وتوليد الرمز التالي مع تفريغ الحقول"
            >
              <Save className="w-4 h-4" />
              <span>حفظ (F2)</span>
            </button>

            {/* 2. حذف */}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={!currentId}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-300 hover:bg-rose-600 hover:text-white text-slate-800 font-bold text-sm rounded-lg shadow disabled:opacity-40 cursor-pointer transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف</span>
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

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="حذف مادة"
        message={`هل أنت متأكد من حذف المادة "${formData.name}" (رمز ${formData.code})؟\nسيتم التحقق من عدم وجود فواتير مرتبطة بها قبل الحذف.`}
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
