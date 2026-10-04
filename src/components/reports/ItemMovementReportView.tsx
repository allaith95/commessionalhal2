import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/tafqeet';
import {
  Printer,
  X,
  Calendar,
  Search,
  Package,
  RefreshCw,
  Tag,
  User,
} from 'lucide-react';
import { normalizeArabicText } from '../common/ContainmentCombobox';

type FilterType = 'item' | 'category';

export interface FlatItemMovementRow {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  itemId: string;
  itemName: string;
  categoryName: string;
  sellerName: string;
  buyerName: string;
  unit: string;
  grossWeight: number;
  discountTare: number;
  netWeight: number;
  unitPrice: number;
  total: number;
  inQty: number;
  inPrice: number;
  outQty: number;
  outPrice: number;
  balanceQty: number;
  balancePrice: number;
}

export const ItemMovementReportView: React.FC = () => {
  const { items, invoices, triggerPrint, setCurrentView, settings } = useApp();

  const currentYear = new Date().getFullYear();
  const defaultYearStart = `${currentYear}-01-01`;
  const defaultYearEnd = `${currentYear}-12-31`;

  // Filter States
  const [filterType, setFilterType] = useState<FilterType>('item');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(defaultYearStart);
  const [endDate, setEndDate] = useState<string>(defaultYearEnd);

  // Flatten invoices to individual item movements
  const allRows = useMemo<FlatItemMovementRow[]>(() => {
    const rows: FlatItemMovementRow[] = [];

    invoices.forEach((inv) => {
      if (inv.rows && inv.rows.length > 0) {
        inv.rows.forEach((r, idx) => {
          const matchedItem = items.find(
            (it) => it.name === r.itemName || it.id === r.itemId
          );
          const catName = matchedItem?.category || '';
          const netW = Number(r.netWeight) || 0;
          const tot = Number(r.total) || 0;

          rows.push({
            id: `${inv.id}-${idx}`,
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            date: inv.date,
            itemId: r.itemId || matchedItem?.id || '',
            itemName: r.itemName || 'مادة',
            categoryName: catName,
            sellerName: inv.sellerName || '-',
            buyerName: inv.buyerName || '-',
            unit: r.unit || matchedItem?.unit || 'كغ',
            grossWeight: Number(r.grossWeight) || 0,
            discountTare: Number(r.discountTare) || 0,
            netWeight: netW,
            unitPrice: Number(r.unitPrice) || 0,
            total: tot,
            inQty: netW,
            inPrice: tot,
            outQty: netW,
            outPrice: tot,
            balanceQty: 0,
            balancePrice: 0,
          });
        });
      }
    });

    // Sort by date descending
    return rows.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
  }, [invoices, items]);

  // Filtered Rows
  const filteredRows = useMemo(() => {
    const query = normalizeArabicText((activeSearch || searchTerm).trim());

    return allRows.filter((row) => {
      // Date filter
      if (startDate && row.date < startDate) return false;
      if (endDate && row.date > endDate) return false;

      // Type-based search filter
      if (query) {
        if (filterType === 'category') {
          const matchCategory = row.categoryName
            ? normalizeArabicText(row.categoryName).includes(query)
            : false;
          const matchItem = normalizeArabicText(row.itemName).includes(query);
          if (!matchCategory && !matchItem) return false;
        } else if (filterType === 'item') {
          const matchItem = normalizeArabicText(row.itemName).includes(query);
          if (!matchItem) return false;
        }
      }

      return true;
    });
  }, [allRows, filterType, activeSearch, searchTerm, startDate, endDate]);

  // Totals calculations
  const {
    totalInQty,
    totalInPrice,
    totalOutQty,
    totalOutPrice,
    totalBalanceQty,
    totalBalancePrice,
  } = useMemo(() => {
    let inQty = 0;
    let inPrice = 0;
    let outQty = 0;
    let outPrice = 0;
    let balQty = 0;
    let balPrice = 0;

    filteredRows.forEach((r) => {
      inQty += r.inQty;
      inPrice += r.inPrice;
      outQty += r.outQty;
      outPrice += r.outPrice;
      balQty += r.balanceQty;
      balPrice += r.balancePrice;
    });

    return {
      totalInQty: Math.round(inQty * 100) / 100,
      totalInPrice: inPrice,
      totalOutQty: Math.round(outQty * 100) / 100,
      totalOutPrice: outPrice,
      totalBalanceQty: Math.round(balQty * 100) / 100,
      totalBalancePrice: balPrice,
    };
  }, [filteredRows]);

  const handleSearchClick = () => {
    setActiveSearch(searchTerm);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setActiveSearch(searchTerm);
    }
  };

  const handleResetFilters = () => {
    setStartDate(defaultYearStart);
    setEndDate(defaultYearEnd);
    setSearchTerm('');
    setActiveSearch('');
    setFilterType('item');
  };

  const handlePrint = () => {
    triggerPrint('item_report', {
      movements: filteredRows,
      totalInQty,
      totalInPrice,
      totalOutQty,
      totalOutPrice,
      totalBalanceQty,
      totalBalancePrice,
      startDate,
      endDate,
      filterType,
      searchTerm: activeSearch || searchTerm,
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

  return (
    <div
      className="w-full min-h-[calc(100vh-56px)] bg-[#7196b8] p-2 sm:p-3 md:p-4 animate-in fade-in duration-200 flex flex-col justify-between"
      dir="rtl"
    >
      <div className="w-full flex flex-col gap-3">
        {/* 1. Unified Top Control & Filter Card (مطابق تماماً لتصميم حركة كمسيون) */}
        <div className="bg-[#233142] text-white p-3 rounded-lg shadow-md border border-slate-700 flex flex-col gap-2.5">
          {/* Header Row: Title, Badges & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-700/80">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-1.5 bg-slate-800 rounded-md text-amber-400 border border-slate-700 shadow-xs">
                <Package className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black tracking-wide text-white">
                  حركة مادة
                </h1>

                {/* Filter Type Badge */}
                <span className="bg-amber-900/80 text-amber-200 border border-amber-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {filterType === 'category' ? 'بحث بالصنف' : 'بحث بالمادة'}
                </span>

                <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-md font-mono border border-slate-700">
                  {filteredRows.length} حركة
                </span>
              </div>
            </div>

            {/* Action buttons (طباعة، إغلاق) */}
            <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
              <button
                onClick={handlePrint}
                disabled={filteredRows.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-md text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة</span>
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

          {/* Filter Controls Row (الأعمدة الثلاثة: نوع الفلترة، البحث، الفترة) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {/* 1. Filter Type Selector (المادة / الصنف فقط) */}
            <div className="flex flex-col gap-1.5 bg-[#1a2533] p-2 rounded-lg border border-slate-700">
              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>نوع الفلترة:</span>
              </span>
              <div className="flex items-center justify-between gap-2 bg-slate-900 p-1 rounded-md border border-slate-700 h-8">
                <label
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-1 px-2 rounded cursor-pointer transition-all ${
                    filterType === 'item'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="itemMovementFilterType"
                    checked={filterType === 'item'}
                    onChange={() => {
                      setFilterType('item');
                      setActiveSearch('');
                    }}
                    className="hidden"
                  />
                  <Package className="w-3.5 h-3.5" />
                  <span>المادة</span>
                </label>

                <label
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-1 px-2 rounded cursor-pointer transition-all ${
                    filterType === 'category'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="itemMovementFilterType"
                    checked={filterType === 'category'}
                    onChange={() => {
                      setFilterType('category');
                      setActiveSearch('');
                    }}
                    className="hidden"
                  />
                  <Tag className="w-3.5 h-3.5" />
                  <span>الصنف</span>
                </label>
              </div>
            </div>

            {/* 2. Search Box with Search Button */}
            <div className="flex flex-col gap-1.5 bg-[#1a2533] p-2 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-emerald-300 flex items-center gap-1">
                  <Search className="w-3.5 h-3.5 text-emerald-400" />
                  <span>البحث في النتائج:</span>
                </span>
                {(searchTerm || activeSearch) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setActiveSearch('');
                    }}
                    className="text-[10px] text-rose-300 hover:text-white underline font-bold"
                  >
                    مسح
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder={
                    filterType === 'category'
                      ? 'اسم الصنف أو المادة...'
                      : 'اسم المادة...'
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-white text-slate-900 placeholder:text-slate-500 font-bold text-xs rounded px-2.5 py-1 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 h-8 shadow-xs"
                />
                <button
                  type="button"
                  onClick={handleSearchClick}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black px-3 py-1 rounded h-8 shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>بحث</span>
                </button>
              </div>
            </div>

            {/* 3. Date Range Filter Box (من تاريخ - إلى تاريخ) */}
            <div className="flex flex-col gap-1.5 bg-[#1a2533] p-2 rounded-lg border border-slate-700">
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
              <div className="grid grid-cols-2 gap-1.5">
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
          </div>
        </div>

        {/* 2. Main Transactions Table with Multi-Level Colored Group Headers & Aligned Totals */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden border border-slate-700 w-full">
          <div className="overflow-x-auto max-h-[calc(100vh-250px)]">
            <table className="w-full text-center border-collapse">
              <thead className="sticky top-0 shadow z-10 whitespace-nowrap text-white text-[11px] sm:text-xs font-bold">
                {/* Level 1 Header: Basic Columns & Colored Groups */}
                <tr className="border-b border-slate-600">
                  <th
                    rowSpan={2}
                    className="bg-[#2c3e50] py-2.5 px-3 border-l border-slate-600 w-28 align-middle"
                  >
                    التاريخ
                  </th>
                  <th
                    rowSpan={2}
                    className="bg-[#2c3e50] py-2.5 px-3 border-l border-slate-600 w-20 align-middle"
                  >
                    الفاتورة
                  </th>
                  <th
                    rowSpan={2}
                    className="bg-[#2c3e50] py-2.5 px-4 border-l border-slate-600 text-center w-40 align-middle"
                  >
                    اسم المادة
                  </th>

                  {/* الإدخالات Header (Red / Crimson Theme) */}
                  <th
                    colSpan={2}
                    className="bg-[#b91c1c] py-2 px-4 border-l border-red-900 text-center text-xs font-black tracking-wide"
                  >
                    الإدخالات
                  </th>

                  {/* الإخراجات Header (Blue Theme) */}
                  <th
                    colSpan={2}
                    className="bg-[#1d4ed8] py-2 px-4 border-l border-blue-900 text-center text-xs font-black tracking-wide"
                  >
                    الإخراجات
                  </th>

                  {/* الرصيد Header (Dark Slate Theme) */}
                  <th
                    colSpan={2}
                    className="bg-[#334155] py-2 px-4 text-center text-xs font-black tracking-wide"
                  >
                    الرصيد
                  </th>
                </tr>

                {/* Level 2 Sub-Headers: الكمية & السعر */}
                <tr className="bg-[#233142] text-[11px] font-bold border-b border-slate-700">
                  {/* Under الإدخالات */}
                  <th className="bg-[#991b1b] py-1.5 px-3 border-l border-red-900 w-24 text-red-100">
                    الكمية
                  </th>
                  <th className="bg-[#991b1b] py-1.5 px-3 border-l border-red-900 w-32 text-red-100">
                    السعر
                  </th>

                  {/* Under الإخراجات */}
                  <th className="bg-[#1e40af] py-1.5 px-3 border-l border-blue-900 w-24 text-blue-100">
                    الكمية
                  </th>
                  <th className="bg-[#1e40af] py-1.5 px-3 border-l border-blue-900 w-32 text-blue-100">
                    السعر
                  </th>

                  {/* Under الرصيد */}
                  <th className="bg-[#1e293b] py-1.5 px-3 border-l border-slate-700 w-24 text-slate-200">
                    الكمية
                  </th>
                  <th className="bg-[#1e293b] py-1.5 px-3 w-32 text-slate-200">
                    السعر
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 text-[11px] sm:text-xs font-semibold text-slate-800 whitespace-nowrap">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-12 text-slate-500 font-semibold text-sm text-center"
                    >
                      لا توجد بيانات حركة مادة تطابق خيارات التصفية المحددة
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`transition-colors font-semibold ${
                        index % 2 === 0 ? 'bg-[#e2edf7]' : 'bg-white'
                      } hover:bg-sky-100/80`}
                    >
                      {/* 1. Date */}
                      <td className="py-2 px-3 border-l border-slate-300 font-mono text-slate-700">
                        {row.date}
                      </td>

                      {/* 2. Invoice Doc Number */}
                      <td className="py-2 px-3 border-l border-slate-300 font-mono text-slate-700">
                        {row.invoiceNumber}
                      </td>

                      {/* 3. Item Name */}
                      <td className="py-2 px-4 border-l border-slate-300 text-center font-bold text-slate-900">
                        {row.itemName}
                      </td>

                      {/* 4. In Qty */}
                      <td className="py-2 px-3 border-l border-slate-300 font-mono font-bold text-slate-800">
                        {row.inQty}
                      </td>

                      {/* 5. In Price */}
                      <td className="py-2 px-3 border-l border-slate-300 font-mono font-bold text-slate-900">
                        {formatCurrency(row.inPrice)}
                      </td>

                      {/* 6. Out Qty */}
                      <td className="py-2 px-3 border-l border-slate-300 font-mono font-bold text-slate-800">
                        {row.outQty}
                      </td>

                      {/* 7. Out Price */}
                      <td className="py-2 px-3 border-l border-slate-300 font-mono font-bold text-slate-900">
                        {formatCurrency(row.outPrice)}
                      </td>

                      {/* 8. Balance Qty */}
                      <td className="py-2 px-3 border-l border-slate-300 font-mono text-slate-600">
                        {row.balanceQty}
                      </td>

                      {/* 9. Balance Price */}
                      <td className="py-2 px-3 font-mono text-slate-600">
                        {formatCurrency(row.balancePrice)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* 3. Bottom Summary directly aligned with each column above */}
              <tfoot className="sticky bottom-0 bg-[#233142] text-white text-xs font-bold shadow-lg border-t-2 border-slate-700 z-10 whitespace-nowrap">
                <tr className="bg-[#1f2c3b]">
                  <td
                    colSpan={3}
                    className="py-2.5 px-4 text-center font-black text-amber-300 border-l border-slate-600 text-xs sm:text-sm"
                  >
                    المجموع الكلي ({filteredRows.length} حركة)
                  </td>

                  {/* Under الإدخالات - الكمية */}
                  <td className="py-2.5 px-3 border-l border-slate-600 font-mono text-slate-100 font-black text-xs sm:text-sm">
                    {totalInQty > 0 ? `${totalInQty.toLocaleString()}` : '0'}
                  </td>

                  {/* Under الإدخالات - السعر */}
                  <td className="py-2.5 px-3 border-l border-slate-600 font-mono text-rose-300 font-black text-xs sm:text-sm">
                    {formatCurrency(totalInPrice)}
                  </td>

                  {/* Under الإخراجات - الكمية */}
                  <td className="py-2.5 px-3 border-l border-slate-600 font-mono text-slate-100 font-black text-xs sm:text-sm">
                    {totalOutQty > 0 ? `${totalOutQty.toLocaleString()}` : '0'}
                  </td>

                  {/* Under الإخراجات - السعر */}
                  <td className="py-2.5 px-3 border-l border-slate-600 font-mono text-sky-300 font-black text-xs sm:text-sm">
                    {formatCurrency(totalOutPrice)}
                  </td>

                  {/* Under الرصيد - الكمية */}
                  <td className="py-2.5 px-3 border-l border-slate-600 font-mono text-emerald-300 font-black text-xs sm:text-sm">
                    {totalBalanceQty.toLocaleString()}
                  </td>

                  {/* Under الرصيد - السعر */}
                  <td className="py-2.5 px-3 font-mono text-emerald-300 font-black text-xs sm:text-sm">
                    {formatCurrency(totalBalancePrice)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
