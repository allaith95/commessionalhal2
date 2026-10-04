import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  Plus,
  Save,
  Trash2,
  X,
  Package,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Category } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { getNextCategoryCode } from '../../utils/codeGenerator';

interface CategoryCardModalProps {
  onClose: () => void;
}

export const CategoryCardModal: React.FC<CategoryCardModalProps> = ({ onClose }) => {
  const {
    categories,
    items,
    addCategory,
    updateCategory,
    deleteCategory,
    selectedCategoryId,
    setSelectedCategoryId,
    setCurrentView,
    showNotification,
  } = useApp();

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [formData, setFormData] = useState<Omit<Category, 'id'>>({
    code: '',
    name: '',
    notes: '',
  });

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedCategoryId) {
      handleNew();
      return;
    }

    const foundIdx = categories.findIndex((c) => c.id === selectedCategoryId);
    if (foundIdx !== -1) {
      setCurrentIndex(foundIdx);
      loadCategory(categories[foundIdx]);
    } else {
      handleNew();
    }
  }, [selectedCategoryId]);

  const loadCategory = (cat?: Category) => {
    if (!cat) {
      handleNew();
      return;
    }
    setCurrentId(cat.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFormData({
      code: cat.code || '',
      name: cat.name || '',
      notes: cat.notes || '',
    });
  };

  // 1. عند النقر يدوياً على زر "جديد": تفريغ كل الحقول بالكامل
  const handleManualNew = () => {
    setCurrentId(null);
    setSelectedCategoryId(null);
    setCurrentIndex(categories.length);
    setErrorMessage(null);
    setSuccessMessage(null);

    setFormData({
      code: '',
      name: '',
      notes: '',
    });

    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
  };

  // 2. عند الحفظ: زيادة الرمز 1 منعاً للتضارب
  const handlePostSaveNew = (lastSavedCode?: string) => {
    setCurrentId(null);
    setSelectedCategoryId(null);
    setCurrentIndex(categories.length);
    setErrorMessage(null);
    setSuccessMessage(null);

    const safeLastCode = typeof lastSavedCode === 'string' ? lastSavedCode : undefined;
    const nextCode = getNextCategoryCode(safeLastCode, categories);

    setFormData({
      code: nextCode,
      name: '',
      notes: '',
    });

    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
  };

  const handleNew = (lastSavedCode?: unknown) => {
    if (typeof lastSavedCode === 'string' && lastSavedCode.trim()) {
      handlePostSaveNew(lastSavedCode);
    } else {
      handleManualNew();
    }
  };

  // Navigation handlers (مطابقة تماماً لآلية الفاتورة)
  // 1. الأول (First record)
  const handleFirst = () => {
    if (categories.length > 0) {
      setCurrentIndex(0);
      loadCategory(categories[0]);
    }
  };

  // 2. السابق (Previous record)
  const handlePrev = () => {
    if (categories.length === 0) return;
    if (currentId === null) {
      const lastIdx = categories.length - 1;
      setCurrentIndex(lastIdx);
      loadCategory(categories[lastIdx]);
    } else if (currentIndex > 0) {
      const newIdx = currentIndex - 1;
      setCurrentIndex(newIdx);
      loadCategory(categories[newIdx]);
    }
  };

  // 3. التالي (Next record)
  const handleNext = () => {
    if (categories.length === 0 || currentId === null) return;
    if (currentIndex < categories.length - 1) {
      const newIdx = currentIndex + 1;
      setCurrentIndex(newIdx);
      loadCategory(categories[newIdx]);
    }
  };

  // 4. الأخير (Last record)
  const handleLast = () => {
    if (categories.length > 0) {
      const lastIdx = categories.length - 1;
      setCurrentIndex(lastIdx);
      loadCategory(categories[lastIdx]);
    }
  };

  // Save handler with duplicate code/name checks, auto-increment by 1, and clearing
  const handleSave = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedCode = formData.code.trim();
    const trimmedName = formData.name.trim();

    if (!trimmedCode) {
      setErrorMessage('يرجى إدخال رمز الصنف');
      return;
    }

    if (!trimmedName) {
      setErrorMessage('يرجى إدخال اسم الصنف');
      nameInputRef.current?.focus();
      return;
    }

    // 1. منع تكرار رمز الصنف
    const duplicateCode = categories.find(
      (c) => c.id !== currentId && c.code.trim() === trimmedCode
    );
    if (duplicateCode) {
      const msg = `رمز الصنف (${trimmedCode}) مستخدم مسبقاً للصنف "${duplicateCode.name}"! يمنع تكرار الرمز.`;
      setErrorMessage(msg);
      showNotification(msg, 'error');
      return;
    }

    // 2. منع تكرار اسم الصنف
    const duplicateName = categories.find(
      (c) => c.id !== currentId && c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicateName) {
      const msg = `اسم الصنف "${trimmedName}" موجود مسبقاً بالرمز (${duplicateName.code})! يمنع تكرار اسم الصنف.`;
      setErrorMessage(msg);
      showNotification(msg, 'error');
      return;
    }

    // Save or update
    if (currentId) {
      const updatedCat: Category = {
        ...formData,
        code: trimmedCode,
        name: trimmedName,
        id: currentId,
      };
      updateCategory(updatedCat);
      showNotification(`تم تعديل الصنف (${trimmedName}) بنجاح`, 'success');
      setSuccessMessage(`تم تعديل بيانات الصنف (${trimmedName}) برمز (${trimmedCode}) بنجاح`);
      handleNew(trimmedCode);
      return;
    } else {
      addCategory({
        ...formData,
        code: trimmedCode,
        name: trimmedName,
      });
      showNotification(`تمت إضافة الصنف (${trimmedName}) برمز (${trimmedCode}) بنجاح`, 'success');
      setSuccessMessage(`تم حفظ الصنف (${trimmedName}) برمز (${trimmedCode}) بنجاح!`);
      // الانتقال مباشرة لبطاقة صنف جديدة جاهزة للإدخال التالي مع زيادة الرمز 1
      handleNew(trimmedCode);
    }
  };

  const handleDelete = () => {
    if (!currentId) return;

    const catToDelete = categories.find((c) => c.id === currentId);
    if (!catToDelete) return;

    // التحقق من عدم وجود مواد تتبع لهذا الصنف
    const hasItems = items.some(
      (item) => item.category.trim().toLowerCase() === catToDelete.name.trim().toLowerCase()
    );

    if (hasItems) {
      const msg = `يمنع حذف الصنف "${catToDelete.name}" (رمز ${catToDelete.code}) لوجود مواد مسجلة تتبع له! يرجى حذف أو نقل المواد أولاً.`;
      setErrorMessage(msg);
      setShowDeleteConfirm(false);
      showNotification(msg, 'error');
      return;
    }

    deleteCategory(currentId);
    setShowDeleteConfirm(false);
    showNotification(`تم حذف الصنف (${catToDelete.name}) بنجاح`, 'success');
    setSuccessMessage(`تم حذف الصنف (${catToDelete.name}) بنجاح`);
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

  return (
    <div className="w-full min-h-[calc(100vh-56px)] bg-[#7196b8] p-3 md:p-6 flex flex-col justify-start animate-in fade-in duration-200">
      {/* Full-width card layout extending across the background */}
      <div className="w-full max-w-4xl mx-auto bg-[#3c4f65] text-white rounded-xl shadow-2xl border border-slate-600/80 p-5 md:p-7 flex flex-col gap-5">
        
        {/* Top Header Row: Title on right, Navigation buttons: الأخير | التالي | السابق | الأول on left */}
        <div className="flex items-center justify-between border-b border-slate-500/40 pb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide">
              بطاقة صنف
            </h2>
            {currentId ? (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs px-2.5 py-1 rounded font-semibold">
                تعديل صنف ({formData.code})
              </span>
            ) : (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-xs px-2.5 py-1 rounded font-semibold">
                صنف جديد (إضافة متتالية)
              </span>
            )}
          </div>

          {/* Navigation buttons: مثل الفاتورة (أيقونات فقط بدون كتابة: الأخير | التالي | السابق | الأول) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#243343] p-1 rounded-lg border border-slate-600/70 shadow-inner">
              <button
                type="button"
                onClick={handleLast}
                disabled={categories.length === 0 || currentId === null || currentIndex >= categories.length - 1}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="السجل الأخير"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={categories.length === 0 || currentId === null || currentIndex >= categories.length - 1}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="التالي"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handlePrev}
                disabled={categories.length === 0 || (currentId !== null && currentIndex === 0)}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="السابق"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleFirst}
                disabled={categories.length === 0 || (currentId !== null && currentIndex === 0)}
                className="p-1.5 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-md shadow-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
                title="السجل الأول"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <span className="text-[11px] text-slate-300 font-bold px-2 min-w-[70px] text-center font-mono">
                {currentId === null
                  ? `(جديد / ${categories.length})`
                  : `(${currentIndex + 1} / ${categories.length})`}
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

        {/* Form Body: 2 Columns - Right column = Category Info (Code, Name), Left column = Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-800/40 p-4 md:p-6 rounded-lg border border-slate-600/40">
          {/* الطرف اليميني: معلومات الصنف الأساسية */}
          <div className="flex flex-col gap-3.5">
            <h3 className="text-sm font-bold text-amber-300 border-b border-slate-500/50 pb-1.5 flex items-center justify-between">
              <span>بيانات الصنف الأساسية</span>
              <span className="text-xs text-slate-300 font-normal">الرمز واسم الصنف فريدان</span>
            </h3>

            {/* رمز الصنف */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200">
                  رمز الصنف <span className="text-amber-400">* (يمنع التكرار)</span>
                </label>
                <span className="text-[11px] text-slate-400">يزيد 1 تلقائياً عند الحفظ</span>
              </div>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full bg-white text-slate-900 px-3 py-2 rounded-md font-mono font-bold text-base focus:outline-none focus:ring-2 focus:ring-amber-400 text-center md:text-right border border-slate-300"
              />
            </div>

            {/* اسم الصنف */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-200">
                اسم الصنف <span className="text-amber-400">* (يمنع التكرار)</span>
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

          {/* الطرف اليساري: ملاحظات */}
          <div className="flex flex-col gap-3.5">
            <h3 className="text-sm font-bold text-amber-300 border-b border-slate-500/50 pb-1.5">
              ملاحظات وتفاصيل
            </h3>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-200">ملاحظات</label>
              <textarea
                rows={5}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full bg-white text-slate-900 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none border border-slate-300"
              ></textarea>
            </div>
          </div>
        </div>

        {/* Bottom Actions Toolbar: الطرف اليميني (بطاقة مادة، استعراض المواد) - الطرف اليساري (حفظ، حذف، جديد، إغلاق من أقصى اليسار) */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-500/40 flex-wrap">
          {/* الطرف اليميني: بطاقة مادة و استعراض المواد */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentView('item_card')}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-200 hover:bg-white text-slate-900 font-bold text-xs rounded-lg shadow cursor-pointer transition-colors"
            >
              <Package className="w-4 h-4 text-amber-700" />
              <span>بطاقة مادة</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('items_list')}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-200 hover:bg-white text-slate-900 font-bold text-xs rounded-lg shadow cursor-pointer transition-colors"
            >
              <Package className="w-4 h-4 text-teal-700" />
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
              title="حفظ الصنف وتوليد الرمز التالي مع تفريغ الحقول"
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
        title="حذف صنف"
        message={`هل أنت متأكد من حذف الصنف "${formData.name}" (رمز ${formData.code})؟\nسيتم التحقق من عدم وجود مواد مرتبطة به قبل الحذف.`}
        confirmText="تأكيد الحذف"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};
