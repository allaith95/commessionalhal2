import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Lock,
  Search,
  Plus,
  X,
  BookOpen,
  Scale,
  Filter,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/tafqeet';
import { isPermanentSystemAccount } from '../../utils/systemAccounts';
import { calculateDynamicAccountBalances } from '../../utils/accounting';

type BalanceFilterType = 'all' | 'nonzero' | 'debit' | 'credit';

export const AccountsListView: React.FC = () => {
  const { accounts, invoices, vouchers, setSelectedAccountId, setCurrentView, settings, loadFromPostgres, triggerPrint } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Trigger live PostgreSQL fetch on view mount
  useEffect(() => {
    loadFromPostgres();
  }, [loadFromPostgres]);

  const showAccountCode = settings?.showAccountCode ?? true;

  // Calculate live dynamic accounting balances for all accounts
  const dynamicBalances = useMemo(
    () => calculateDynamicAccountBalances(accounts, invoices, vouchers),
    [accounts, invoices, vouchers]
  );

  // Extract distinct parent categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    accounts.forEach((acc) => {
      if (acc.parentAccount && acc.parentAccount.trim()) {
        set.add(acc.parentAccount.trim());
      }
    });
    return Array.from(set);
  }, [accounts]);

  // Compute calculated balances and filtered list
  const processedAccounts = useMemo(() => {
    return accounts.map((acc) => {
      const debit = Number(acc.openingDebit) || 0;
      const credit = Number(acc.openingCredit) || 0;
      const balance = dynamicBalances.get(acc.id) ?? (acc.currentBalance !== undefined ? Number(acc.currentBalance) : debit - credit);
      const isSys = isPermanentSystemAccount(acc);
      return {
        ...acc,
        computedDebit: debit,
        computedCredit: credit,
        computedBalance: balance,
        isSys,
      };
    });
  }, [accounts, dynamicBalances]);

  const filteredAccounts = useMemo(() => {
    return processedAccounts.filter((acc) => {
      // Search term filter
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        acc.name.toLowerCase().includes(term) ||
        acc.code.includes(term) ||
        (acc.parentAccount && acc.parentAccount.toLowerCase().includes(term)) ||
        (acc.phone && acc.phone.includes(term));

      if (!matchesSearch) return false;

      // Category filter
      if (categoryFilter !== 'all') {
        if (categoryFilter === '__root__') {
          if (acc.parentAccount && acc.parentAccount.trim() !== '') return false;
        } else if (acc.parentAccount !== categoryFilter) {
          return false;
        }
      }

      // Balance filter (بدون / مدين ودائن / مدين فقط / دائن فقط)
      if (balanceFilter === 'nonzero') {
        return acc.computedBalance !== 0;
      }
      if (balanceFilter === 'debit') {
        return acc.computedBalance > 0;
      }
      if (balanceFilter === 'credit') {
        return acc.computedBalance < 0;
      }

      return true;
    });
  }, [processedAccounts, searchTerm, balanceFilter, categoryFilter]);

  // Summary statistics for footer
  const stats = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;

    filteredAccounts.forEach((acc) => {
      if (acc.computedBalance > 0) {
        totalDebit += acc.computedBalance;
      } else if (acc.computedBalance < 0) {
        totalCredit += Math.abs(acc.computedBalance);
      }
    });

    const net = totalDebit - totalCredit;

    return {
      totalDebit,
      totalCredit,
      net,
      totalCount: filteredAccounts.length,
    };
  }, [filteredAccounts]);

  const handleOpenAccount = (id: string) => {
    setSelectedAccountId(id);
    setCurrentView('account_card');
  };

  const handleOpenStatement = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAccountId(id);
    setCurrentView('account_statement');
  };

  const handlePrint = () => {
    let filterTitle = 'كافة الحسابات';
    if (categoryFilter !== 'all') {
      filterTitle = `تصنيف: ${categoryFilter}`;
    }
    if (balanceFilter === 'debit') {
      filterTitle += ' - الحسابات المدينة فقط';
    } else if (balanceFilter === 'credit') {
      filterTitle += ' - الحسابات الدائنة فقط';
    } else if (balanceFilter === 'nonzero') {
      filterTitle += ' - الحسابات ذات الرصيد غير الصفري';
    }

    triggerPrint('accounts_list', {
      accounts: filteredAccounts,
      stats,
      filterTitle,
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

  const isFilterActive = searchTerm !== '' || balanceFilter !== 'all' || categoryFilter !== 'all';

  const resetFilters = () => {
    setSearchTerm('');
    setBalanceFilter('all');
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
              <div className="w-8 h-8 rounded bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
                <Scale className="w-4 h-4" />
              </div>
              <h1 className="text-lg md:text-xl font-black text-white tracking-wide">
                استعراض الحسابات
              </h1>
              <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-0.5 rounded-md font-mono border border-slate-700">
                {filteredAccounts.length} حساب
              </span>
            </div>

            {/* Left Side: Compact Actions */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              <button
                onClick={() => {
                  setSelectedAccountId(null);
                  setCurrentView('account_card');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-md shadow transition-all cursor-pointer border border-emerald-400/40"
                title="إضافة بطاقة حساب جديدة"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>حساب جديد</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-xs rounded-md shadow transition-colors cursor-pointer border border-slate-600"
                title="طباعة كشف الحسابات"
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

          {/* Filter Controls Row: Search Box & Dropdowns Filter (Balance & Category) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-white">
            {/* Right Area: Search Box */}
            <div className="flex-1 flex items-center gap-2 max-w-lg">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث بالاسم، الرمز، الحساب الأب، أو الهاتف..."
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
                  className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-amber-300 text-xs rounded font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                  title="إعادة ضبط الفلاتر"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة ضبط</span>
                </button>
              )}
            </div>

            {/* Left Area: Balance Type Filter & Category Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Balance Nature Dropdown (طبيعة الرصيد) */}
              <div className="flex items-center gap-1.5 bg-[#1e2a38] px-2.5 py-1.5 rounded border border-slate-700 text-xs">
                <Scale className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-slate-300 font-semibold">الرصيد:</span>
                <select
                  value={balanceFilter}
                  onChange={(e) => setBalanceFilter(e.target.value as BalanceFilterType)}
                  className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-800 text-white">بدون</option>
                  <option value="nonzero" className="bg-slate-800 text-white">مدين ودائن</option>
                  <option value="debit" className="bg-slate-800 text-white">مدين فقط (لنا)</option>
                  <option value="credit" className="bg-slate-800 text-white">دائن فقط (له)</option>
                </select>
              </div>

              {/* Parent Account Category Selector */}
              {categories.length > 0 && (
                <div className="flex items-center gap-1.5 bg-[#1e2a38] px-2.5 py-1.5 rounded border border-slate-700 text-xs">
                  <Filter className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-slate-300 font-semibold">التصنيف:</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer max-w-[170px] truncate"
                  >
                    <option value="all" className="bg-slate-800 text-white">جميع التصنيفات</option>
                    <option value="__root__" className="bg-slate-800 text-white">حسابات رئيسية (بدون أب)</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat} className="bg-slate-800 text-white">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Accounts Table Container */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden border border-slate-700">
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-center border-collapse">
              {/* Table Header */}
              <thead className="sticky top-0 bg-[#2c3e50] text-white text-xs sm:text-sm font-bold shadow z-10">
                <tr>
                  {showAccountCode && (
                    <th className="py-2.5 px-3 border-l border-slate-600 w-24 text-center">الرمز</th>
                  )}
                  <th className="py-2.5 px-4 border-l border-slate-600 text-right">اسم الحساب</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 text-right w-44">الحساب الرئيسي</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 w-32">دائن / له</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 w-32">مدين / لنا</th>
                  <th className="py-2.5 px-3 border-l border-slate-600 w-36">الرصيد الحالي</th>
                  <th className="py-2.5 px-3 w-24 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-semibold text-slate-800">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={showAccountCode ? 7 : 6} className="py-10 text-center text-slate-500 font-medium">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Scale className="w-8 h-8 text-slate-400 stroke-1" />
                        <span className="text-sm text-slate-700 font-bold">لا توجد حسابات مطابقة للبحث أو التصفية</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((acc, index) => {
                    const balance = acc.computedBalance;
                    const isDebit = balance > 0;
                    const isCredit = balance < 0;

                    return (
                      <tr
                        key={acc.id}
                        onClick={() => handleOpenAccount(acc.id)}
                        className={`transition-colors hover:bg-amber-100/70 cursor-pointer ${
                          index % 2 === 0 ? 'bg-[#f4f8fb]' : 'bg-white'
                        }`}
                        title="انقر لفتح بطاقة الحساب للتعديل"
                      >
                        {/* Code */}
                        {showAccountCode && (
                          <td className="py-2 px-3 border-l border-slate-200 font-mono font-bold text-slate-900 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {acc.isSys && (
                                <Lock className="w-3 h-3 text-sky-700" title="حساب نظام أساسي محمي" />
                              )}
                              <span className="bg-slate-200/80 px-2 py-0.5 rounded text-xs">
                                {acc.code}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* Account Name */}
                        <td className="py-2 px-4 border-l border-slate-200 text-right font-bold text-slate-900 hover:text-sky-700">
                          <div className="flex items-center gap-2">
                            <span>{acc.name}</span>
                            {acc.isSys && (
                              <span className="bg-sky-100 text-sky-800 border border-sky-300 text-[10px] px-1.5 py-0.2 rounded font-bold">
                                أساسي
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Parent Account */}
                        <td className="py-2 px-3 border-l border-slate-200 text-right text-slate-600 text-xs font-medium">
                          {acc.parentAccount && acc.parentAccount.trim() ? (
                            <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                              {acc.parentAccount}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">
                              حساب رئيسي مستقل
                            </span>
                          )}
                        </td>

                        {/* Credit (له) */}
                        <td className="py-2 px-3 border-l border-slate-200 text-slate-700 font-mono text-center text-xs">
                          {isCredit ? (
                            <span className="text-rose-700 font-bold">
                              {formatCurrency(Math.abs(balance))}
                            </span>
                          ) : acc.computedCredit > 0 ? (
                            <span>{formatCurrency(acc.computedCredit)}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Debit (لنا) */}
                        <td className="py-2 px-3 border-l border-slate-200 text-slate-700 font-mono text-center text-xs">
                          {isDebit ? (
                            <span className="text-emerald-700 font-bold">
                              {formatCurrency(balance)}
                            </span>
                          ) : acc.computedDebit > 0 ? (
                            <span>{formatCurrency(acc.computedDebit)}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Current Net Balance */}
                        <td
                          className={`py-2 px-3 border-l border-slate-200 font-mono font-black text-center text-xs ${
                            isDebit
                              ? 'text-emerald-700 bg-emerald-50/50'
                              : isCredit
                              ? 'text-rose-700 bg-rose-50/50'
                              : 'text-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>{formatCurrency(balance)}</span>
                            {isDebit && (
                              <span className="text-[10px] text-emerald-800 font-sans font-bold bg-emerald-200/80 px-1 rounded">
                                لنا
                              </span>
                            )}
                            {isCredit && (
                              <span className="text-[10px] text-rose-800 font-sans font-bold bg-rose-200/80 px-1 rounded">
                                له
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-1.5 px-3 text-center">
                          <button
                            onClick={(e) => handleOpenStatement(acc.id, e)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded text-xs font-bold transition-all shadow-xs cursor-pointer"
                            title="عرض كشف حساب تفصيلي"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>كشف</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Table Footer Summary Row */}
              {filteredAccounts.length > 0 && (
                <tfoot className="sticky bottom-0 bg-[#eef4f9] border-t-2 border-slate-600 text-slate-900 font-bold text-xs sm:text-sm">
                  <tr>
                    <td colSpan={3} className="py-2.5 px-4 text-right border-l border-slate-300 font-black">
                      عدد الحسابات: {filteredAccounts.length}
                    </td>
                    <td className="py-2.5 px-3 text-center border-l border-slate-300 font-mono font-black text-rose-700 text-xs sm:text-sm">
                      {formatCurrency(stats.totalCredit)}
                    </td>
                    <td className="py-2.5 px-3 text-center border-l border-slate-300 font-mono font-black text-emerald-700 text-xs sm:text-sm">
                      {formatCurrency(stats.totalDebit)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-center border-l border-slate-300 font-mono font-black text-xs sm:text-sm ${
                        stats.net > 0
                          ? 'text-emerald-700'
                          : stats.net < 0
                          ? 'text-rose-700'
                          : 'text-slate-800'
                      }`}
                    >
                      {formatCurrency(stats.net)}
                    </td>
                    <td className="py-2.5 px-3 text-center text-[11px] text-slate-500 font-medium">
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
