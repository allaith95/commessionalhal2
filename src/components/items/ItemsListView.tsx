import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Package,
  Search,
  Plus,
  X,
  Layers,
  Printer,
  RefreshCw,
  Filter,
  Edit3,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ConfirmModal';

export const ItemsListView: React.FC = () => {
  const { items, categories, deleteItem, setSelectedItemId, setCurrentView, settings, loadFromPostgres, triggerPrint } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  // Trigger live PostgreSQL fetch on view mount
  useEffect(() => {
    loadFromPostgres();
  }, [loadFromPostgres]);

  const showItemCode = settings?.showItemCode ?? true;

  // Extract distinct categories from both categories state and items
  const allCategoryNames = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((cat) => {
      if (cat.name && cat.name.trim()) set.add(cat.name.trim());
    });
    items.forEach((item) => {
      if (item.category && item.category.trim()) set.add(item.category.trim());
    });
    return Array.from(set);
  }, [categories, items]);

  // Count items per category
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((item) => {
      const cat = item.category?.trim() || '__unknown__';
      map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [items]);

  // Filtered items (Search & Category filter only)
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.code.toLowerCase().includes(term) ||
        (item.category && item.category.toLowerCase().includes(term)) ||
        (item.unit && item.unit.toLowerCase().includes(term)) ||
        (item.notes && item.notes.toLowerCase().includes(term));

      if (!matchesSearch) return false;

      if (categoryFilter !== 'all') {
        if (item.category?.trim().toLowerCase() !== categoryFilter.trim().toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [items, searchTerm, categoryFilter]);

  // Count of distinct categories present in the filtered table items only
  const filteredCategoryCount = useMemo(() => {
    const set = new Set<string>();
    filteredItems.forEach((item) => {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim());
      }
    });
    return set.size;
  }, [filteredItems]);

  const handleEdit = (id: string) => {
    setSelectedItemId(id);
    setCurrentView('item_card');
  };

  const confirmDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToDelete({ id, name });
  };

  const executeDelete = () => {
    if (itemToDelete) {
      deleteItem(itemToDelete.id);
      setItemToDelete(null);
    }
  };

  const handlePrint = () => {
    triggerPrint('items_list', {
      items: filteredItems,
      categoryFilter,
      searchTerm,
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

  const isFilterActive = searchTerm !== '' || categoryFilter !== 'all';

  const resetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
  };

  return (
    <div
      className="w-full min-h-[calc(100vh-56px)] bg-[#7196b8] p-2 sm:p-3 md:p-4 animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="w-full flex flex-col gap-3">
        
        {/* Unified Top Control & Filter Card (دمج العناصر مثل كشف الحساب) */}
        <div className="bg-[#233142] text-white p-3 rounded-lg shadow-md border border-slate-700 flex flex-col gap-2.5">
          {/* Header Row: Title & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pb-2.5 border-b border-slate-700/80">
            {/* Right Side: Compact Title & Count Badge */}
            <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
              <div className="w-8 h-8 rounded bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                <Package className="w-4 h-4" />
              </div>
              <h1 className="text-lg md:text-xl font-black text-white tracking-wide">
                استعراض المواد والأصناف
              </h1>
              <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-0.5 rounded-md font-mono border border-slate-700">
                {filteredItems.length} مادة
              </span>
            </div>

            {/* Left Side: Compact Actions */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              <button
                onClick={() => {
                  setSelectedItemId(null);
                  setCurrentView('item_card');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-md shadow transition-all cursor-pointer border border-emerald-400/40"
                title="إضافة بطاقة مادة جديدة"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>مادة جديدة</span>
              </button>

              <button
                onClick={() => {
                  setSelectedItemId(null);
                  setCurrentView('category_card');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-xs rounded-md shadow transition-all cursor-pointer border border-sky-400/40"
                title="إضافة أو إدارة الأصناف"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>صنف جديد</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-xs rounded-md shadow transition-colors cursor-pointer border border-slate-600"
                title="طباعة"
              >
                <Printer className="w-3.5 h-3.5 text-slate-300" />
                <span className="hidden sm:inline">طباعة</span>
              </button>

              <button
                onClick={() => setCurrentView('home')}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-700 hover:bg-rose-600 active:bg-rose-800 text-white font-bold text-xs rounded-md shadow transition-all cursor-pointer border border-rose-500/40"
                title="إغلاق والعودة للرئيسية"
              >
                <X className="w-3.5 h-3.5" />
                <span>إغلاق</span>
              </button>
            </div>
          </div>

          {/* Filter Controls Row: Search Box & Category Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-white">
            {/* Right Area: Search Box */}
            <div className="flex-1 flex items-center gap-2 max-w-lg">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث بالاسم، الرمز، الصنف، الملاحظات..."
                  className="w-full bg-white text-slate-900 pr-9 pl-8 py-1.5 rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-300 shadow-xs"
                />
                <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    title="مسح البحث"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              {isFilterActive && (
                <button
                  onClick={resetFilters}
                  className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-amber-300 text-xs rounded font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                  title="إعادة ضبط الفلاتر"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>إعادة ضبط</span>
                </button>
              )}
            </div>

            {/* Left Area: Category Filter Dropdown Only */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[#1e2a38] px-2.5 py-1.5 rounded border border-slate-700 text-xs">
                <Filter className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-300 font-semibold">الصنف:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer max-w-[170px] truncate"
                >
                  <option value="all" className="bg-slate-800 text-white">
                    جميع الأصناف ({items.length})
                  </option>
                  {allCategoryNames.map((cat) => (
                    <option key={cat} value={cat} className="bg-slate-800 text-white">
                      {cat} ({categoryCounts[cat] || 0})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table Container */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden border border-slate-700">
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-center border-collapse">
              {/* Table Header */}
              <thead className="sticky top-0 bg-[#2c3e50] text-white text-xs sm:text-sm font-bold shadow z-10">
                <tr>
                  <th className="py-2.5 px-2 border-l border-slate-600 w-16 text-center">#</th>
                  {showItemCode && (
                    <th className="py-2.5 px-3 border-l border-slate-600 w-24 text-center">الرمز</th>
                  )}
                  <th className="py-2.5 px-4 border-l border-slate-600 text-right">اسم المادة</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 text-right w-40">الصنف</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 w-28 text-center">الوحدة</th>
                  <th className="py-2.5 px-4 border-l border-slate-600 text-right">الملاحظات</th>
                  <th className="py-2.5 px-3 w-32 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-semibold text-slate-800">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={showItemCode ? 7 : 6} className="py-10 text-center text-slate-500 font-medium">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Package className="w-8 h-8 text-slate-400 stroke-1" />
                        <span className="text-sm text-slate-700 font-bold">لا توجد مواد مطابقة للبحث</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => (
                    <tr
                      key={item.id}
                      onClick={() => handleEdit(item.id)}
                      className={`transition-colors hover:bg-amber-100/70 cursor-pointer ${
                        index % 2 === 0 ? 'bg-[#f4f8fb]' : 'bg-white'
                      }`}
                      title="انقر لفتح بطاقة المادة للتعديل"
                    >
                      {/* Sequence # */}
                      <td className="py-2 px-2 border-l border-slate-200 text-slate-600 font-mono text-center">
                        {index + 1}
                      </td>

                      {/* Code */}
                      {showItemCode && (
                        <td className="py-2 px-3 border-l border-slate-200 font-mono font-bold text-slate-900 text-center">
                          <span className="bg-slate-200/80 px-2 py-0.5 rounded text-xs">
                            {item.code}
                          </span>
                        </td>
                      )}

                      {/* Item Name */}
                      <td className="py-2 px-4 border-l border-slate-200 text-right font-bold text-slate-900 hover:text-sky-700">
                        <div className="flex items-center gap-2">
                          <span>{item.name}</span>
                          {item.unit && (
                            <span className="text-xs text-slate-500 font-normal">
                              ({item.unit})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-2 px-3 border-l border-slate-200 text-right text-xs font-semibold">
                        {item.category && item.category.trim() ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300/80 px-2 py-0.5 rounded font-bold">
                            <Layers className="w-3 h-3 text-amber-700" />
                            <span>{item.category}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">غير مصنف</span>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="py-2 px-3 border-l border-slate-200 text-center text-slate-700 text-xs">
                        {item.unit ? (
                          <span className="bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded font-medium">
                            {item.unit}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-2 px-4 border-l border-slate-200 text-right text-slate-600 text-xs truncate max-w-xs">
                        {item.notes ? item.notes : <span className="text-slate-400">-</span>}
                      </td>

                      {/* Actions */}
                      <td className="py-1.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(item.id);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded text-xs font-bold transition-all shadow-xs cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>تعديل</span>
                          </button>
                          <button
                            onClick={(e) => confirmDelete(item.id, item.name, e)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded text-xs font-bold transition-all shadow-xs cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Compact Table Footer */}
              {filteredItems.length > 0 && (
                <tfoot className="sticky bottom-0 bg-[#eef4f9] border-t-2 border-slate-600 text-slate-900 font-bold text-xs sm:text-sm">
                  <tr>
                    <td colSpan={3} className="py-2.5 px-4 text-right border-l border-slate-300 font-black">
                      عدد المواد: {filteredItems.length}
                    </td>
                    <td className="py-2.5 px-3 text-right border-l border-slate-300 text-xs text-slate-800 font-bold">
                      {categoryFilter === 'all'
                        ? `عدد الأصناف: ${filteredCategoryCount}`
                        : `الصنف: ${categoryFilter} (${filteredCategoryCount})`}
                    </td>
                    <td colSpan={3} className="py-2.5 px-3 border-slate-300"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(itemToDelete)}
        title="حذف مادة"
        message={`هل أنت متأكد من رغبتك في حذف المادة "${itemToDelete?.name}" من النظام؟\nلن يمكن استرجاعها بعد الحذف.`}
        confirmText="تأكيد الحذف"
        onConfirm={executeDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};
