import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FileText,
  Search,
  Plus,
  X,
  Printer,
  RefreshCw,
  UserCheck,
  ShoppingCart,
  CreditCard,
  Calendar,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/tafqeet';
import { ContainmentCombobox, ComboboxOption } from '../common/ContainmentCombobox';
import { InvoicesReportPrint } from '../print/PrintContainer';

type PaymentFilterType = 'all' | 'cash' | 'credit';

export const InvoicesListView: React.FC = () => {
  const { invoices, accounts, setSelectedInvoiceId, setCurrentView, triggerPrint, settings, loadFromPostgres } = useApp();

  // Trigger live PostgreSQL fetch on view mount
  useEffect(() => {
    loadFromPostgres();
  }, [loadFromPostgres]);

  const currentYear = new Date().getFullYear();
  const defaultYearStart = `${currentYear}-01-01`;
  const defaultYearEnd = `${currentYear}-12-31`;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeller, setFilterSeller] = useState('');
  const [filterBuyer, setFilterBuyer] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilterType>('all');
  const [startDate, setStartDate] = useState(defaultYearStart);
  const [endDate, setEndDate] = useState(defaultYearEnd);

  const showAccountCode = settings?.showAccountCode ?? true;

  // Options for Seller Combobox
  const sellerOptions = useMemo<ComboboxOption[]>(() => {
    return [
      { id: '', label: '-- جميع البائعين (الكل) --', code: 'الكل' },
      ...accounts.map((acc) => ({
        id: acc.name,
        label: acc.name,
        code: acc.code,
      })),
    ];
  }, [accounts]);

  // Options for Buyer Combobox
  const buyerOptions = useMemo<ComboboxOption[]>(() => {
    return [
      { id: '', label: '-- جميع المشترين (الكل) --', code: 'الكل' },
      ...accounts.map((acc) => ({
        id: acc.name,
        label: acc.name,
        code: acc.code,
      })),
    ];
  }, [accounts]);

  // Options for Payment Method Combobox (Matching Seller & Buyer filter style)
  const paymentOptions = useMemo<ComboboxOption[]>(() => {
    return [
      { id: 'all', label: '-- جميع طرق الدفع (الكل) --', code: 'الكل' },
      { id: 'cash', label: 'نقدي فقط', code: 'نقدي' },
      { id: 'credit', label: 'آجل فقط', code: 'آجل' },
    ];
  }, []);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Search term
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        inv.invoiceNumber?.toString().toLowerCase().includes(term) ||
        inv.sellerName?.toLowerCase().includes(term) ||
        inv.buyerName?.toLowerCase().includes(term) ||
        inv.sellerNotes?.toLowerCase().includes(term) ||
        inv.buyerNotes?.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // Seller filter
      if (filterSeller) {
        if (inv.sellerName !== filterSeller && inv.sellerId !== filterSeller) return false;
      }

      // Buyer filter
      if (filterBuyer) {
        if (inv.buyerName !== filterBuyer && inv.buyerId !== filterBuyer) return false;
      }

      // Payment filter
      if (paymentFilter === 'cash') {
        if (inv.sellerPaymentType !== 'نقدي' && inv.buyerPaymentType !== 'نقدي') return false;
      } else if (paymentFilter === 'credit') {
        if (inv.sellerPaymentType !== 'آجل' && inv.buyerPaymentType !== 'آجل') return false;
      }

      // Date range filter
      if (startDate && inv.date < startDate) return false;
      if (endDate && inv.date > endDate) return false;

      return true;
    });
  }, [invoices, searchTerm, filterSeller, filterBuyer, paymentFilter, startDate, endDate]);

  // Totals calculations for summary footer
  const stats = useMemo(() => {
    let totalGross = 0;
    let totalCommission = 0;
    let totalNet = 0;

    filteredInvoices.forEach((inv) => {
      totalGross += Number(inv.totalAmount) || 0;
      totalCommission += Number(inv.commissionValue) || 0;
      totalNet += Number(inv.netAmount) || 0;
    });

    return {
      totalCount: filteredInvoices.length,
      totalGross,
      totalCommission,
      totalNet,
    };
  }, [filteredInvoices]);

  const isFilterActive =
    searchTerm !== '' ||
    filterSeller !== '' ||
    filterBuyer !== '' ||
    paymentFilter !== 'all' ||
    startDate !== defaultYearStart ||
    endDate !== defaultYearEnd;

  const resetFilters = () => {
    setSearchTerm('');
    setFilterSeller('');
    setFilterBuyer('');
    setPaymentFilter('all');
    setStartDate(defaultYearStart);
    setEndDate(defaultYearEnd);
  };

  const handleOpenInvoice = (id: string) => {
    setSelectedInvoiceId(id);
    setCurrentView('commission_invoice');
  };

  const handlePrint = () => {
    triggerPrint('invoices_report', {
      invoices: filteredInvoices,
      totalGross: stats.totalGross,
      totalCommission: stats.totalCommission,
      totalNet: stats.totalNet,
      startDate,
      endDate,
      filterSeller,
      filterBuyer,
      filterPaymentType: paymentFilter,
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
              <div className="w-8 h-8 rounded bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
                <FileText className="w-4 h-4" />
              </div>
              <h1 className="text-lg md:text-xl font-black text-white tracking-wide">
                استعراض الفواتير
              </h1>
              <span className="bg-slate-800 text-amber-300 text-xs px-2.5 py-0.5 rounded-md font-mono font-bold border border-slate-700">
                {stats.totalCount} فاتورة
              </span>
            </div>

            {/* Left Side: Compact Actions */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              <button
                onClick={() => {
                  setSelectedInvoiceId(null);
                  setCurrentView('commission_invoice');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-md shadow transition-all cursor-pointer border border-emerald-400/40"
                title="إنشاء فاتورة جديدة"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>فاتورة جديدة</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-md shadow transition-all cursor-pointer border border-emerald-400/40"
                title="طباعة التقرير (F4)"
              >
                <Printer className="w-3.5 h-3.5 text-white" />
                <span>طباعة</span>
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

          {/* Search Box & Filters Section */}
          <div className="flex flex-col gap-2.5">
            {/* Row 1: Search Box & Stats */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex-1 flex items-center gap-2 max-w-xl">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="بحث برقم الفاتورة، البائع، المشتري، أو الملاحظات..."
                    className="w-full bg-white text-slate-900 pr-9 pl-8 py-1.5 rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-300 shadow-xs"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                      title="مسح البحث"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {isFilterActive && (
                  <button
                    onClick={resetFilters}
                    className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-amber-300 text-xs rounded font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                    title="إعادة ضبط الفلاتر"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>إعادة ضبط</span>
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-300 font-semibold self-end sm:self-auto">
                عدد الفواتير المعروضة: <span className="font-mono font-black text-amber-300 px-1.5 py-0.5 bg-slate-800 rounded">{stats.totalCount}</span>
              </div>
            </div>

            {/* Row 2: Filter Controls Grid (Seller, Buyer, Payment Method, Date Range) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-700/80">
              
              {/* Seller Selector */}
              <div className="flex flex-col gap-1 bg-[#1e2a38] p-2 rounded-lg border border-slate-700">
                <span className="text-[11px] font-bold text-sky-300 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>اختر البائع:</span>
                </span>
                <ContainmentCombobox
                  options={sellerOptions}
                  value={filterSeller}
                  onChange={(id) => setFilterSeller(id)}
                  showCode={showAccountCode}
                  placeholder="-- جميع البائعين (الكل) --"
                  searchPlaceholder="اسم أو رمز البائع..."
                  className="w-full"
                  size="sm"
                />
              </div>

              {/* Buyer Selector */}
              <div className="flex flex-col gap-1 bg-[#1e2a38] p-2 rounded-lg border border-slate-700">
                <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                  <span>اختر المشتري:</span>
                </span>
                <ContainmentCombobox
                  options={buyerOptions}
                  value={filterBuyer}
                  onChange={(id) => setFilterBuyer(id)}
                  showCode={showAccountCode}
                  placeholder="-- جميع المشترين (الكل) --"
                  searchPlaceholder="اسم أو رمز المشتري..."
                  className="w-full"
                  size="sm"
                />
              </div>

              {/* Payment Method Selector */}
              <div className="flex flex-col gap-1 bg-[#1e2a38] p-2 rounded-lg border border-slate-700">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                  <span>طريقة الدفع:</span>
                </span>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value as PaymentFilterType)}
                  className="w-full bg-slate-900 text-amber-300 font-bold text-xs rounded-md px-2.5 py-1 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer h-8"
                >
                  <option value="all">-- جميع طرق الدفع (الكل) --</option>
                  <option value="cash">نقدي فقط</option>
                  <option value="credit">آجل فقط</option>
                </select>
              </div>

              {/* Date Range Selector */}
              <div className="flex flex-col gap-1 bg-[#1e2a38] p-2 rounded-lg border border-slate-700">
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

            </div>

          </div>

        </div>

        {/* Invoices Table Container */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden border border-slate-700 w-full">
          <div className="overflow-x-auto max-h-[calc(100vh-230px)]">
            <table className="w-full text-center border-collapse">
              {/* Table Header (whitespace-nowrap prevents header titles from wrapping into 2 lines) */}
              <thead className="sticky top-0 bg-[#2c3e50] text-white text-[11px] sm:text-xs font-bold shadow z-10 whitespace-nowrap">
                <tr>
                  <th className="py-2.5 px-2.5 border-l border-slate-600 text-center whitespace-nowrap">الرقم</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 text-center whitespace-nowrap">التاريخ</th>
                  <th className="py-2.5 px-4 border-l border-slate-600 text-right whitespace-nowrap">البائع</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 text-center whitespace-nowrap">دفع البائع</th>
                  <th className="py-2.5 px-4 border-l border-slate-600 text-right whitespace-nowrap">المشتري</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 text-center whitespace-nowrap">دفع المشتري</th>
                  <th className="py-2.5 px-3.5 border-l border-slate-600 text-center whitespace-nowrap">الإجمالي القائم</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 text-center whitespace-nowrap">الكمسيون</th>
                  <th className="py-2.5 px-3.5 border-l border-slate-600 text-center whitespace-nowrap">الصافي</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] sm:text-xs font-semibold text-slate-800 whitespace-nowrap">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-slate-500 font-medium whitespace-nowrap">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <AlertCircle className="w-8 h-8 text-slate-400 stroke-1" />
                        <span className="text-xs text-slate-700 font-bold">لا توجد فواتير مطابقة للبحث أو الفلترة</span>
                        {isFilterActive && (
                          <button
                            onClick={resetFilters}
                            className="mt-1 text-xs text-sky-700 hover:underline font-bold cursor-pointer"
                          >
                            إعادة ضبط كافة الفلاتر
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv, index) => (
                    <tr
                      key={inv.id}
                      onClick={() => handleOpenInvoice(inv.id)}
                      className={`cursor-pointer transition-colors hover:bg-sky-100/80 ${
                        index % 2 === 0 ? 'bg-[#e2edf7]' : 'bg-white'
                      }`}
                    >
                      <td className="py-2 px-2.5 border-l border-slate-300 font-mono font-black text-slate-900 whitespace-nowrap">
                        #{inv.invoiceNumber}
                      </td>
                      <td className="py-2 px-3 border-l border-slate-300 font-mono text-slate-700 text-[11px] whitespace-nowrap">
                        {inv.date}
                      </td>
                      <td className="py-2 px-4 border-l border-slate-300 text-right font-bold text-slate-900 whitespace-nowrap">
                        {inv.sellerName}
                      </td>
                      <td className="py-2 px-3 border-l border-slate-300 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-black shadow-2xs border ${
                            inv.sellerPaymentType === 'آجل' || inv.sellerPaymentType === 'credit'
                              ? 'bg-amber-600 text-white border-amber-700'
                              : 'bg-emerald-600 text-white border-emerald-700'
                          }`}
                        >
                          {inv.sellerPaymentType || 'نقدي'}
                        </span>
                      </td>
                      <td className="py-2 px-4 border-l border-slate-300 text-right font-bold text-slate-900 whitespace-nowrap">
                        {inv.buyerName}
                      </td>
                      <td className="py-2 px-3 border-l border-slate-300 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-black shadow-2xs border ${
                            inv.buyerPaymentType === 'آجل' || inv.buyerPaymentType === 'credit'
                              ? 'bg-amber-600 text-white border-amber-700'
                              : 'bg-emerald-600 text-white border-emerald-700'
                          }`}
                        >
                          {inv.buyerPaymentType || 'نقدي'}
                        </span>
                      </td>
                      <td className="py-2 px-3.5 border-l border-slate-300 font-mono font-bold text-slate-900 text-[11px] whitespace-nowrap">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="py-2 px-3 border-l border-slate-300 font-mono font-bold text-amber-900 text-[11px] whitespace-nowrap">
                        {formatCurrency(inv.commissionValue)}
                      </td>
                      <td className="py-2 px-3.5 border-l border-slate-300 font-mono font-black text-emerald-700 text-[11px] whitespace-nowrap">
                        {formatCurrency(inv.netAmount)}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenInvoice(inv.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                          title="عرض واستعراض الفاتورة"
                        >
                          <Eye className="w-3 h-3" />
                          <span>عرض</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Table Footer Summary Row */}
              {filteredInvoices.length > 0 && (
                <tfoot className="sticky bottom-0 bg-[#eef4f9] border-t-2 border-slate-600 text-slate-900 font-bold text-[11px] sm:text-xs whitespace-nowrap">
                  <tr>
                    <td colSpan={6} className="py-2.5 px-4 text-right border-l border-slate-300 font-black whitespace-nowrap">
                      عدد الفواتير: {stats.totalCount}
                    </td>
                    <td className="py-2.5 px-3.5 text-center border-l border-slate-300 font-mono font-black text-slate-900 text-[11px] sm:text-xs whitespace-nowrap">
                      {formatCurrency(stats.totalGross)}
                    </td>
                    <td className="py-2.5 px-3 text-center border-l border-slate-300 font-mono font-black text-amber-900 text-[11px] sm:text-xs whitespace-nowrap">
                      {formatCurrency(stats.totalCommission)}
                    </td>
                    <td className="py-2.5 px-3.5 text-center border-l border-slate-300 font-mono font-black text-emerald-800 text-[11px] sm:text-xs whitespace-nowrap">
                      {formatCurrency(stats.totalNet)}
                    </td>
                    <td colSpan={1} className="py-2.5 px-3 text-center text-[10px] text-slate-500 font-medium whitespace-nowrap">
                      -
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};


