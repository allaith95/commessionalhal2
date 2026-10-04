import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/tafqeet';
import {
  Printer,
  X,
  FileText,
  Calendar,
  Search,
  Percent,
  RefreshCw,
  Tag,
  Package,
  User,
} from 'lucide-react';
import { normalizeArabicText } from '../common/ContainmentCombobox';

type FilterType = 'client' | 'category' | 'item';

interface FlatCommissionRow {
  id: string;
  invoiceId: string;
  docNumber: string;
  date: string;
  buyerName: string;
  sellerName: string;
  itemName: string;
  categoryName?: string;
  grossWeight: number | string;
  netWeight: number | string;
  rawGrossWeight: number;
  rawNetWeight: number;
  commissionValue: number;
  totalAmount: number;
  netAmount: number;
}

export const CommissionReportView: React.FC = () => {
  const { invoices, categories, items, triggerPrint, setCurrentView, settings } = useApp();

  const currentYear = new Date().getFullYear();
  const defaultYearStart = `${currentYear}-01-01`;
  const defaultYearEnd = `${currentYear}-12-31`;

  // Filter States
  const [filterType, setFilterType] = useState<FilterType>('client');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(defaultYearStart);
  const [endDate, setEndDate] = useState<string>(defaultYearEnd);

  // Flatten invoices to individual item commission movement rows
  const allRows = useMemo<FlatCommissionRow[]>(() => {
    const rows: FlatCommissionRow[] = [];

    invoices.forEach((inv) => {
      const rate = Number(inv.commissionRate) || 5;

      if (inv.rows && inv.rows.length > 0) {
        const invTotal = Number(inv.totalAmount) || 0;
        const invComm = Number(inv.commissionValue);
        const hasValidInvComm = !isNaN(invComm) && invComm >= 0;

        inv.rows.forEach((r, idx) => {
          const rowTotal = Number(r.total) || 0;
          const rowComm = inv.rows.length === 1 && hasValidInvComm
            ? invComm
            : invTotal > 0 && hasValidInvComm
            ? Math.round((rowTotal / invTotal) * invComm)
            : Math.round((rowTotal * rate) / 100);
          const rowNet = rowTotal - rowComm;

          // Find category if possible
          const matchedItem = items.find((it) => it.name === r.itemName || it.id === r.itemId);
          const catName = matchedItem?.category || '';

          const gWeight = Number(r.grossWeight) || 0;
          const nWeight = Number(r.netWeight) || 0;

          rows.push({
            id: `${inv.id}-${idx}`,
            invoiceId: inv.id,
            docNumber: inv.invoiceNumber,
            date: inv.date,
            buyerName: inv.buyerName || '-',
            sellerName: inv.sellerName || '-',
            itemName: r.itemName || '-',
            categoryName: catName,
            grossWeight: gWeight > 0 ? gWeight : '-',
            netWeight: nWeight > 0 ? nWeight : '-',
            rawGrossWeight: gWeight,
            rawNetWeight: nWeight,
            commissionValue: rowComm,
            totalAmount: rowTotal,
            netAmount: rowNet,
          });
        });
      } else {
        // Fallback for invoice without sub-items
        rows.push({
          id: inv.id,
          invoiceId: inv.id,
          docNumber: inv.invoiceNumber,
          date: inv.date,
          buyerName: inv.buyerName || '-',
          sellerName: inv.sellerName || '-',
          itemName: '-',
          categoryName: '',
          grossWeight: '-',
          netWeight: '-',
          rawGrossWeight: 0,
          rawNetWeight: 0,
          commissionValue: Number(inv.commissionValue) || 0,
          totalAmount: Number(inv.totalAmount) || 0,
          netAmount: Number(inv.netAmount) || 0,
        });
      }
    });

    return rows;
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
        if (filterType === 'client') {
          const matchSeller = normalizeArabicText(row.sellerName).includes(query);
          const matchBuyer = normalizeArabicText(row.buyerName).includes(query);
          const matchDoc = row.docNumber.toLowerCase().includes(query.toLowerCase());
          if (!matchSeller && !matchBuyer && !matchDoc) return false;
        } else if (filterType === 'category') {
          const matchCategory = row.categoryName ? normalizeArabicText(row.categoryName).includes(query) : false;
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

  // Summary Totals
  const { totalInvoicesAmount, totalCommissionAmount, totalNetAmount, totalGrossWeight, totalNetWeight } = useMemo(() => {
    let totalInv = 0;
    let totalComm = 0;
    let totalNet = 0;
    let totalGrossW = 0;
    let totalNetW = 0;

    filteredRows.forEach((r) => {
      totalInv += Number(r.totalAmount) || 0;
      totalComm += Number(r.commissionValue) || 0;
      totalNet += Number(r.netAmount) || 0;
      totalGrossW += r.rawGrossWeight || 0;
      totalNetW += r.rawNetWeight || 0;
    });

    return {
      totalInvoicesAmount: totalInv,
      totalCommissionAmount: totalComm,
      totalNetAmount: totalNet,
      totalGrossWeight: Math.round(totalGrossW * 100) / 100,
      totalNetWeight: Math.round(totalNetW * 100) / 100,
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
    setFilterType('client');
  };

  const handlePrint = () => {
    triggerPrint('commission_report', {
      rows: filteredRows,
      invoices: invoices.filter((inv) => filteredRows.some((r) => r.invoiceId === inv.id)),
      totalGross: totalInvoicesAmount,
      totalCommission: totalCommissionAmount,
      totalNet: totalNetAmount,
      totalGrossWeight,
      totalNetWeight,
      startDate,
      endDate,
      filterType,
      searchTerm: activeSearch || searchTerm,
      mode: 'table_view',
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
    <div className="w-full min-h-[calc(100vh-56px)] bg-[#7196b8] p-2 sm:p-3 md:p-4 animate-in fade-in duration-200 flex flex-col justify-between" dir="rtl">
      <div className="w-full flex flex-col gap-3">
        
        {/* 1. Unified Top Control & Filter Card (مطابق لتصميم كشف الحساب) */}
        <div className="bg-[#233142] text-white p-3 rounded-lg shadow-md border border-slate-700 flex flex-col gap-2.5">
          
          {/* Header Row: Title, Badges & Top Action Buttons (تمت إزالة الشريط كما طُلب) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-700/80">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-1.5 bg-slate-800 rounded-md text-amber-400 border border-slate-700 shadow-xs">
                <Percent className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black tracking-wide text-white">
                  حركة كمسيون
                </h1>

                {/* Filter Type Badge */}
                <span className="bg-amber-900/80 text-amber-200 border border-amber-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {filterType === 'client' ? 'بحث بالعميل' : filterType === 'category' ? 'بحث بالصنف' : 'بحث بالمادة'}
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

          {/* Filter Controls Row (الخيارات الثلاثة: نوع الفلترة، البحث، الفترة) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            
            {/* 1. Filter Type Selector (العميل / الصنف / المادة) */}
            <div className="flex flex-col gap-1.5 bg-[#1a2533] p-2 rounded-lg border border-slate-700">
              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>نوع الفلترة:</span>
              </span>
              <div className="flex items-center justify-between gap-1 bg-slate-900 p-1 rounded-md border border-slate-700 h-8">
                <label className={`flex-1 flex items-center justify-center gap-1 text-xs font-bold py-1 px-1.5 rounded cursor-pointer transition-all ${
                  filterType === 'client' ? 'bg-amber-400 text-slate-950 shadow-xs' : 'text-slate-300 hover:text-white'
                }`}>
                  <input
                    type="radio"
                    name="filterType"
                    checked={filterType === 'client'}
                    onChange={() => {
                      setFilterType('client');
                      setActiveSearch('');
                    }}
                    className="hidden"
                  />
                  <User className="w-3 h-3" />
                  <span>العميل</span>
                </label>

                <label className={`flex-1 flex items-center justify-center gap-1 text-xs font-bold py-1 px-1.5 rounded cursor-pointer transition-all ${
                  filterType === 'category' ? 'bg-amber-400 text-slate-950 shadow-xs' : 'text-slate-300 hover:text-white'
                }`}>
                  <input
                    type="radio"
                    name="filterType"
                    checked={filterType === 'category'}
                    onChange={() => {
                      setFilterType('category');
                      setActiveSearch('');
                    }}
                    className="hidden"
                  />
                  <Tag className="w-3 h-3" />
                  <span>الصنف</span>
                </label>

                <label className={`flex-1 flex items-center justify-center gap-1 text-xs font-bold py-1 px-1.5 rounded cursor-pointer transition-all ${
                  filterType === 'item' ? 'bg-amber-400 text-slate-950 shadow-xs' : 'text-slate-300 hover:text-white'
                }`}>
                  <input
                    type="radio"
                    name="filterType"
                    checked={filterType === 'item'}
                    onChange={() => {
                      setFilterType('item');
                      setActiveSearch('');
                    }}
                    className="hidden"
                  />
                  <Package className="w-3 h-3" />
                  <span>المادة</span>
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
                    filterType === 'client'
                      ? 'اسم البائع أو المشتري...'
                      : filterType === 'category'
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

        {/* 2. Main Transactions Table with Directly Aligned Bottom Totals (مطابقة الأعمدة 100%) */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden border border-slate-700 w-full">
          <div className="overflow-x-auto max-h-[calc(100vh-250px)]">
            <table className="w-full text-center border-collapse">
              <thead className="sticky top-0 bg-[#2c3e50] text-white text-[11px] sm:text-xs font-bold shadow z-10 whitespace-nowrap">
                <tr>
                  <th className="py-2.5 px-3 border-l border-slate-600 w-20">رقم</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 w-28">تاريخ</th>
                  <th className="py-2.5 px-4 border-l border-slate-600 text-center w-40">المشتري</th>
                  <th className="py-2.5 px-4 border-l border-slate-600 text-center w-40">البائع</th>
                  <th className="py-2.5 px-4 border-l border-slate-600 text-center w-36">المادة</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 w-28">القائم</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 w-28">الصافي</th>
                  <th className="py-2.5 px-4 border-l border-slate-600 w-36">الكمسيون</th>
                  <th className="py-2.5 px-4 w-40">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] sm:text-xs font-semibold text-slate-800 whitespace-nowrap">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-12 text-slate-500 font-semibold text-sm text-center"
                    >
                      لا توجد بيانات حركة كمسيون تطابق خيارات التصفية المحددة
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
                      {/* 1. Doc Number */}
                      <td className="py-2 px-3 border-l border-slate-300 font-mono text-slate-700">
                        {row.docNumber}
                      </td>

                      {/* 2. Date */}
                      <td className="py-2 px-3 border-l border-slate-300 font-mono text-slate-700">
                        {row.date}
                      </td>

                      {/* 3. Buyer Name */}
                      <td className="py-2 px-4 border-l border-slate-300 text-center font-bold text-slate-800">
                        {row.buyerName}
                      </td>

                      {/* 4. Seller Name */}
                      <td className="py-2 px-4 border-l border-slate-300 text-center font-bold text-slate-900">
                        {row.sellerName}
                      </td>

                      {/* 5. Item Name */}
                      <td className="py-2 px-4 border-l border-slate-300 text-center font-bold text-slate-900">
                        {row.itemName}
                      </td>

                      {/* 6. Gross Weight */}
                      <td className="py-2 px-3 border-l border-slate-300 font-mono text-slate-800">
                        {row.grossWeight}
                      </td>

                      {/* 7. Net Weight */}
                      <td className="py-2 px-3 border-l border-slate-300 font-mono font-bold text-emerald-800">
                        {row.netWeight}
                      </td>

                      {/* 8. Commission Value */}
                      <td className="py-2 px-4 border-l border-slate-300 font-mono font-bold text-amber-800">
                        {formatCurrency(row.commissionValue)}
                      </td>

                      {/* 9. Gross Total */}
                      <td className="py-2 px-4 font-mono font-black text-slate-900">
                        {formatCurrency(row.totalAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* 3. Bottom Summary directly aligned with each column above (مطابقة دقيقة لكل عمود) */}
              <tfoot className="sticky bottom-0 bg-[#233142] text-white text-xs font-bold shadow-lg border-t-2 border-slate-700 z-10 whitespace-nowrap">
                {/* Main Totals Row */}
                <tr className="bg-[#1f2c3b] border-b border-slate-700">
                  <td colSpan={5} className="py-2.5 px-4 text-center font-black text-amber-300 border-l border-slate-600 text-xs sm:text-sm">
                    المجموع الكلي ({filteredRows.length} حركة)
                  </td>
                  
                  {/* Under القائم */}
                  <td className="py-2.5 px-3 border-l border-slate-600 font-mono text-slate-100 font-black text-xs sm:text-sm">
                    {totalGrossWeight > 0 ? `${totalGrossWeight.toLocaleString()} كغ` : '-'}
                  </td>

                  {/* Under الصافي */}
                  <td className="py-2.5 px-3 border-l border-slate-600 font-mono text-emerald-300 font-black text-xs sm:text-sm">
                    {totalNetWeight > 0 ? `${totalNetWeight.toLocaleString()} كغ` : '-'}
                  </td>

                  {/* Under الكمسيون */}
                  <td className="py-2.5 px-4 border-l border-slate-600 font-mono text-amber-400 font-black text-xs sm:text-sm">
                    {formatCurrency(totalCommissionAmount)}
                  </td>

                  {/* Under الإجمالي */}
                  <td className="py-2.5 px-4 font-mono text-sky-300 font-black text-xs sm:text-sm">
                    {formatCurrency(totalInvoicesAmount)}
                  </td>
                </tr>

                {/* Sub Row: Net Invoices Result */}
                <tr className="bg-[#15212e] text-xs">
                  <td colSpan={7} className="py-2 px-4 text-left font-bold text-slate-300 border-l border-slate-700">
                    صافي الفواتير (إجمالي الفواتير - عمولة الكمسيون):
                  </td>
                  <td colSpan={2} className="py-2 px-4 font-mono font-black text-emerald-400 text-sm sm:text-base text-center bg-[#0e1722]">
                    {formatCurrency(totalNetAmount)} <span className="text-xs font-normal text-slate-400">{settings.currency || 'ل.س'}</span>
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
