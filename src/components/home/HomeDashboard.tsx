import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Receipt,
  FileText,
  Users,
  UserPlus,
  BookOpen,
  BarChart3,
  Package,
  Boxes,
  Database,
  Settings,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const HomeDashboard: React.FC<{ onOpenBackupModal: () => void }> = ({ onOpenBackupModal }) => {
  const { setCurrentView } = useApp();

  // Current live time
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Arabic date calculations
  const today = currentTime;
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const monthNames = [
    'كانون الثاني',
    'شباط',
    'آذار',
    'نيسان',
    'أيار',
    'حزيران',
    'تموز',
    'آب',
    'أيلول',
    'تشرين الأول',
    'تشرين الثاني',
    'كانون الأول',
  ];

  const dayName = dayNames[today.getDay()];
  const dayNumber = today.getDate();
  const monthName = monthNames[today.getMonth()];
  const yearNumber = today.getFullYear();

  // Formatted live time string (HH:MM:SS)
  const timeString = currentTime.toLocaleTimeString('ar-SY', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div
      className="relative w-full min-h-[calc(100vh-56px)] bg-[#7196b8] p-3 sm:p-4 md:p-6 lg:p-8 flex flex-col justify-between overflow-y-auto select-none"
      dir="rtl"
    >
      {/* Top breathing room (No app icon as requested) */}
      <div className="w-full h-1 md:h-2 shrink-0"></div>

      {/* Main 12-Square Grid: Operations, Records & Reports */}
      <div className="w-full max-w-7xl mx-auto my-auto py-2 sm:py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-4.5 lg:gap-5">
          
          {/* 1. فاتورة كمسيون */}
          <div
            onClick={() => setCurrentView('commission_invoice')}
            className="group relative bg-white/95 hover:bg-white rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 cursor-pointer flex flex-col items-center justify-between p-3.5 sm:p-4 md:p-4.5 border border-white/90 aspect-square"
          >
            <div className="text-center w-full">
              <h3 className="text-slate-800 font-black text-sm sm:text-base md:text-lg group-hover:text-purple-600 transition-colors">
                فاتورة كمسيون
              </h3>
            </div>

            <div className="flex-1 flex items-center justify-center w-full my-auto">
              <div className="flex flex-col items-center">
                <div className="w-11 h-4 bg-sky-200 border-2 border-sky-400 rounded-t-sm flex items-center justify-center shadow-2xs">
                  <span className="text-[7.5px] font-bold text-sky-800">0.00</span>
                </div>
                <div className="relative w-20 h-13 bg-slate-100 border-2 border-slate-300 rounded-md shadow flex flex-col items-center justify-end p-1">
                  <div className="absolute -top-2.5 right-2.5 w-4.5 h-3.5 bg-white border border-slate-300 rounded-t shadow-2xs"></div>
                  <div className="grid grid-cols-4 gap-0.5 w-full mt-0.5">
                    <div className="h-1.5 bg-slate-300 rounded-2xs"></div>
                    <div className="h-1.5 bg-emerald-400 rounded-2xs"></div>
                    <div className="h-1.5 bg-amber-400 rounded-2xs"></div>
                    <div className="h-1.5 bg-slate-300 rounded-2xs"></div>
                    <div className="h-1.5 bg-slate-300 rounded-2xs"></div>
                    <div className="h-1.5 bg-slate-300 rounded-2xs"></div>
                    <div className="h-1.5 bg-slate-300 rounded-2xs"></div>
                    <div className="h-1.5 bg-sky-400 rounded-2xs"></div>
                  </div>
                  <div className="w-full h-1 bg-slate-300 rounded-2xs mt-1 border-t border-slate-400 flex items-center justify-center">
                    <div className="w-3.5 h-0.5 bg-slate-500 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="w-6 h-1 rounded-full bg-purple-500/30 group-hover:bg-purple-600 transition-colors"></div>
          </div>

          {/* 2. استعراض الفواتير */}
          <div
            onClick={() => setCurrentView('invoices_list')}
            className="group relative bg-white/95 hover:bg-white rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 cursor-pointer flex flex-col items-center justify-between p-3.5 sm:p-4 md:p-4.5 border border-white/90 aspect-square"
          >
            <div className="text-center w-full">
              <h3 className="text-slate-800 font-black text-sm sm:text-base md:text-lg group-hover:text-sky-600 transition-colors">
                استعراض الفواتير
              </h3>
            </div>

            <div className="flex-1 flex items-center justify-center w-full my-auto">
              <div className="relative flex flex-col items-center">
                <div className="w-18 h-13 bg-sky-50 border-2 border-sky-300 rounded-lg p-1.5 shadow-sm flex flex-col justify-between group-hover:border-sky-400 transition-colors">
                  <div className="flex items-center justify-between border-b border-sky-200 pb-1">
                    <Receipt className="w-3.5 h-3.5 text-sky-600" />
                    <span className="text-[8px] font-bold text-sky-800">قائمة الفواتير</span>
                  </div>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <div className="w-full h-1 bg-sky-200 rounded"></div>
                    <div className="w-4/5 h-1 bg-sky-200 rounded"></div>
                    <div className="w-3/5 h-1 bg-sky-200 rounded"></div>
                  </div>
                </div>
                <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-md border border-white">
                  <FileText className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
            <div className="w-6 h-1 rounded-full bg-sky-500/30 group-hover:bg-sky-600 transition-colors"></div>
          </div>

          {/* 3. سند قبض */}
          <div
            onClick={() => setCurrentView('voucher_receipt')}
            className="group relative bg-white/95 hover:bg-white rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 cursor-pointer flex flex-col items-center justify-between p-3.5 sm:p-4 md:p-4.5 border border-white/90 aspect-square"
          >
            <div className="text-center w-full">
              <h3 className="text-slate-800 font-black text-sm sm:text-base md:text-lg group-hover:text-emerald-600 transition-colors">
                سند قبض
              </h3>
            </div>

            <div className="flex-1 flex items-center justify-center w-full my-auto">
              <div className="relative flex flex-col items-center">
                <div className="w-18 bg-slate-50 border-2 border-dashed border-slate-300 rounded-md p-1.5 shadow flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                    <span className="text-[8.5px] font-bold text-slate-700 uppercase tracking-wider">RECEIPT</span>
                  </div>
                  <div className="w-full flex flex-col gap-0.5">
                    <div className="w-full h-0.5 bg-slate-200 rounded"></div>
                    <div className="w-3/4 h-0.5 bg-slate-200 rounded"></div>
                    <div className="w-5/6 h-0.5 bg-slate-200 rounded"></div>
                  </div>
                  <div className="w-13 h-3.5 bg-emerald-100 border border-emerald-500 rounded text-[7.5px] text-emerald-700 font-black flex items-center justify-center shadow-2xs">
                    PAID / مقبوض
                  </div>
                </div>
              </div>
            </div>
            <div className="w-6 h-1 rounded-full bg-emerald-500/30 group-hover:bg-emerald-600 transition-colors"></div>
          </div>

          {/* 4. سند دفع */}
          <div
            onClick={() => setCurrentView('voucher_payment')}
            className="group relative bg-white/95 hover:bg-white rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 cursor-pointer flex flex-col items-center justify-between p-3.5 sm:p-4 md:p-4.5 border border-white/90 aspect-square"
          >
            <div className="text-center w-full">
              <h3 className="text-slate-800 font-black text-sm sm:text-base md:text-lg group-hover:text-rose-600 transition-colors">
                سند دفع
              </h3>
            </div>

            <div className="flex-1 flex items-center justify-center w-full my-auto">
              <div className="relative flex flex-col items-center">
                <div className="w-18 bg-slate-50 border border-slate-200 rounded-md p-1.5 shadow flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-rose-600" />
                    <span className="text-[8.5px] font-bold text-slate-800 uppercase tracking-wide">PAYMENT</span>
                  </div>
                  <div className="w-full h-0.5 bg-slate-300"></div>
                  <div className="w-full flex flex-col gap-0.5">
                    <div className="w-full h-0.5 bg-slate-300 rounded"></div>
                    <div className="w-4/5 h-0.5 bg-slate-300 rounded"></div>
                  </div>
                  <div className="w-full pt-0.5 border-t border-slate-200 flex justify-between items-center text-[7.5px] font-bold text-slate-700">
                    <span>TOTAL</span>
                    <span>$$$</span>
                  </div>
                  <div className="w-11 h-3 rounded-full bg-rose-500 text-white text-[7.5px] font-black flex items-center justify-center shadow-xs">
                    دفع
                  </div>
                </div>
              </div>
            </div>
            <div className="w-6 h-1 rounded-full bg-rose-500/30 group-hover:bg-rose-600 transition-colors"></div>
          </div>

          {/* 5. كشف حساب */}
          <div
            onClick={() => setCurrentView('account_statement')}
            className="group relative bg-white/95 hover:bg-white rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 cursor-pointer flex flex-col items-center justify-between p-3.5 sm:p-4 md:p-4.5 border border-white/90 aspect-square"
          >
            <div className="text-center w-full">
              <h3 className="text-slate-800 font-black text-sm sm:text-base md:text-lg group-hover:text-teal-600 transition-colors">
                كشف حساب
              </h3>
            </div>

            <div className="flex-1 flex items-center justify-center w-full my-auto">
              <div className="relative flex flex-col items-center">
                <div className="w-17 h-8.5 bg-emerald-600 rounded-md shadow-md border-2 border-emerald-500 flex items-center justify-center transform -rotate-6">
                  <div className="w-10 h-4 border border-emerald-400 rounded flex items-center justify-center">
                    <span className="text-[8.5px] text-emerald-100 font-black">$</span>
                  </div>
                </div>
                <div className="w-17 h-8.5 bg-emerald-700 rounded-md shadow-md border-2 border-emerald-600 flex items-center justify-center transform rotate-3 -mt-5.5">
                  <div className="w-10 h-4 border border-emerald-500 rounded flex items-center justify-center">
                    <span className="text-[8.5px] text-emerald-200 font-black">$</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 mt-1">
                  <div className="w-4 h-4 rounded-full bg-amber-400 border border-amber-500 shadow flex items-center justify-center text-[7px] font-black text-amber-900">
                    S
                  </div>
                  <div className="w-5 h-5 rounded-full bg-amber-400 border border-amber-500 shadow flex items-center justify-center text-[8px] font-black text-amber-900">
                    P
                  </div>
                  <div className="w-4 h-4 rounded-full bg-amber-400 border border-amber-500 shadow flex items-center justify-center text-[7px] font-black text-amber-900">
                    S
                  </div>
                </div>
              </div>
            </div>
            <div className="w-6 h-1 rounded-full bg-teal-500/30 group-hover:bg-teal-600 transition-colors"></div>
          </div>

          {/* 6. تقرير الكمسيون */}
          <div
            onClick={() => setCurrentView('commission_report')}
            className="group relative bg-white/95 hover:bg-white rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 cursor-pointer flex flex-col items-center justify-between p-3.5 sm:p-4 md:p-4.5 border border-white/90 aspect-square"
          >
            <div className="text-center w-full">
              <h3 className="text-slate-800 font-black text-sm sm:text-base md:text-lg group-hover:text-fuchsia-600 transition-colors">
                تقرير الكمسيون
              </h3>
            </div>

            <div className="flex-1 flex items-center justify-center w-full my-auto">
              <div className="relative flex flex-col items-center">
                <div className="w-17 h-12 bg-fuchsia-50 border-2 border-fuchsia-200 rounded-lg p-1.5 shadow-sm flex items-end justify-around gap-1 group-hover:border-fuchsia-400 transition-colors">
                  <div className="w-2.5 h-4 bg-fuchsia-300 rounded-t-sm"></div>
                  <div className="w-2.5 h-7 bg-fuchsia-400 rounded-t-sm"></div>
                  <div className="w-2.5 h-5 bg-fuchsia-300 rounded-t-sm"></div>
                  <div className="w-2.5 h-9 bg-fuchsia-600 rounded-t-sm"></div>
                </div>
                <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-fuchsia-600 text-white flex items-center justify-center shadow-md border border-white font-black text-xs">
                  %
                </div>
              </div>
            </div>
            <div className="w-6 h-1 rounded-full bg-fuchsia-500/30 group-hover:bg-fuchsia-600 transition-colors"></div>
          </div>

          {/* 7. دليل الحسابات */}
          <div
            onClick={() => setCurrentView('accounts_list')}
            className="group relative bg-white/95 hover:bg-white rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 cursor-pointer flex flex-col items-center justify-between p-3.5 sm:p-4 md:p-4.5 border border-white/90 aspect-square"
          >
            <div className="text-center w-full">
              <h3 className="text-slate-800 font-black text-sm sm:text-base md:text-lg group-hover:text-indigo-600 transition-colors">
                دليل الحسابات
              </h3>
            </div>

            <div className="flex-1 flex items-center justify-center w-full my-auto">
              <div className="relative flex flex-col items-center">
                <div className="w-17 h-12 bg-indigo-50 border-2 border-indigo-200 rounded-lg p-1.5 shadow-sm flex flex-col justify-between group-hover:border-indigo-400 transition-colors">
                  <div className="flex items-center justify-between border-b border-indigo-200 pb-1">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-[8px] font-bold text-indigo-800">سجل الحسابات</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="w-3 h-3 rounded-full bg-indigo-400"></div>
                    <div className="w-9 h-1 bg-indigo-200 rounded"></div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                    <div className="w-7 h-1 bg-indigo-200 rounded"></div>
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md border border-white">
                  <Users className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
            <div className="w-6 h-1 rounded-full bg-indigo-500/30 group-hover:bg-indigo-600 transition-colors"></div>
          </div>

          {/* 8. بطاقة حساب */}
          <div
            onClick={() => setCurrentView('account_card')}
            className="group relative bg-white/95 hover:bg-white rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 cursor-pointer flex flex-col items-center justify-between p-3.5 sm:p-4 md:p-4.5 border border-white/90 aspect-square"
          >
            <div className="text-center w-full">
              <h3 className="text-slate-800 font-black text-sm sm:text-base md:text-lg group-hover:text-blue-600 transition-colors">
                بطاقة حساب
              </h3>
            </div>

            <div className="flex-1 flex items-center justify-center w-full my-auto">
              <div className="relative flex flex-col items-center">
                <div className="w-18 h-12 bg-blue-50 border-2 border-blue-200 rounded-lg p-1.5 shadow-sm flex flex-col justify-between group-hover:border-blue-400 transition-colors">
                  <div className="flex items-center gap-1 border-b border-blue-200 pb-1">
                    <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px] font-bold">
                      ID
                    </div>
                    <div className="w-8 h-1.5 bg-blue-300 rounded"></div>
                  </div>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <div className="w-full h-1 bg-blue-200 rounded"></div>
                    <div className="w-3/4 h-1 bg-blue-200 rounded"></div>
                  </div>
                </div>
                <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md border border-white">
                  <UserPlus className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
            <div className="w-6 h-1 rounded-full bg-blue-500/30 group-hover:bg-blue-600 transition-colors"></div>
          </div>

          {/* 9. دليل المواد */}
          <div
            onClick={() => setCurrentView('items_list')}
            className="group relative bg-white/95 hover:bg-white rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 cursor-pointer flex flex-col items-center justify-between p-3.5 sm:p-4 md:p-4.5 border border-white/90 aspect-square"
          >
            <div className="text-center w-full">
              <h3 className="text-slate-800 font-black text-sm sm:text-base md:text-lg group-hover:text-amber-600 transition-colors">
                دليل المواد
              </h3>
            </div>

            <div className="flex-1 flex items-center justify-center w-full my-auto">
              <div className="relative flex flex-col items-center">
                <div className="w-16 h-12 bg-amber-50 border-2 border-amber-200 rounded-lg p-1.5 shadow-sm flex flex-col items-center justify-center group-hover:border-amber-400 transition-colors">
                  <Boxes className="w-7 h-7 text-amber-600" />
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span className="text-[7.5px] font-bold text-amber-900">أصناف وبضائع</span>
                  </div>
                </div>
                <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md border border-white">
                  <Package className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
            <div className="w-6 h-1 rounded-full bg-amber-500/30 group-hover:bg-amber-600 transition-colors"></div>
          </div>

          {/* 10. تقرير حركة مادة */}
          <div
            onClick={() => setCurrentView('item_movement_report')}
            className="group relative bg-white/95 hover:bg-white rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 cursor-pointer flex flex-col items-center justify-between p-3.5 sm:p-4 md:p-4.5 border border-white/90 aspect-square"
          >
            <div className="text-center w-full">
              <h3 className="text-slate-800 font-black text-sm sm:text-base md:text-lg group-hover:text-orange-600 transition-colors">
                تقرير حركة مادة
              </h3>
            </div>

            <div className="flex-1 flex items-center justify-center w-full my-auto">
              <div className="relative flex flex-col items-center">
                <div className="w-16 h-12 bg-orange-50 border-2 border-orange-200 rounded-lg p-1.5 shadow-sm flex flex-col justify-between group-hover:border-orange-400 transition-colors">
                  <div className="flex items-center justify-between border-b border-orange-200 pb-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-orange-600" />
                    <span className="text-[7.5px] font-bold text-orange-900">حركة المادة</span>
                  </div>
                  <div className="flex items-center justify-between text-[7px] font-bold text-slate-600 mt-0.5">
                    <span className="text-emerald-600">+ وارد</span>
                    <span className="text-rose-600">- صادر</span>
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-md border border-white">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
            <div className="w-6 h-1 rounded-full bg-orange-500/30 group-hover:bg-orange-600 transition-colors"></div>
          </div>

          {/* 11. النسخ الاحتياطي */}
          <div
            onClick={onOpenBackupModal}
            className="group relative bg-white/95 hover:bg-white rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 cursor-pointer flex flex-col items-center justify-between p-3.5 sm:p-4 md:p-4.5 border border-white/90 aspect-square"
          >
            <div className="text-center w-full">
              <h3 className="text-slate-800 font-black text-sm sm:text-base md:text-lg group-hover:text-blue-600 transition-colors">
                النسخ الاحتياطي
              </h3>
            </div>

            <div className="flex-1 flex items-center justify-center w-full my-auto">
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-16 h-8 bg-gradient-to-r from-sky-400 to-blue-500 rounded-t-full relative flex items-center justify-center text-white shadow">
                  <svg className="w-4.5 h-4.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
                  </svg>
                </div>
                <div className="w-20 bg-slate-800 rounded-md p-1 shadow flex flex-col gap-0.5 border border-slate-700">
                  <div className="h-1.5 bg-slate-600 rounded flex items-center justify-between px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                    <div className="w-11 h-0.5 bg-slate-500 rounded"></div>
                  </div>
                  <div className="h-1.5 bg-slate-600 rounded flex items-center justify-between px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                    <div className="w-11 h-0.5 bg-slate-500 rounded"></div>
                  </div>
                  <div className="h-1.5 bg-slate-600 rounded flex items-center justify-between px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                    <div className="w-11 h-0.5 bg-slate-500 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="w-6 h-1 rounded-full bg-blue-500/30 group-hover:bg-blue-600 transition-colors"></div>
          </div>

          {/* 12. الإعدادات */}
          <div
            onClick={() => setCurrentView('settings')}
            className="group relative bg-white/95 hover:bg-white rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 cursor-pointer flex flex-col items-center justify-between p-3.5 sm:p-4 md:p-4.5 border border-white/90 aspect-square"
          >
            <div className="text-center w-full">
              <h3 className="text-slate-800 font-black text-sm sm:text-base md:text-lg group-hover:text-slate-900 transition-colors">
                الإعدادات
              </h3>
            </div>

            <div className="flex-1 flex items-center justify-center w-full my-auto">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center shadow-md group-hover:rotate-45 transition-transform duration-500">
                  <div className="w-5.5 h-5.5 rounded-full bg-amber-400"></div>
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center shadow-xs group-hover:-rotate-45 transition-transform duration-500">
                  <div className="w-3.5 h-3.5 rounded-full bg-white"></div>
                </div>
                <div className="absolute -bottom-0.5 -left-0.5 w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center shadow-xs group-hover:rotate-90 transition-transform duration-500">
                  <div className="w-3 h-3 rounded-full bg-white"></div>
                </div>
              </div>
            </div>
            <div className="w-6 h-1 rounded-full bg-slate-700/30 group-hover:bg-slate-800 transition-colors"></div>
          </div>

        </div>
      </div>

      {/* Bottom Horizontal Calendar Bar (التقويم كخط أفقي في الأسفل) */}
      <div className="w-full max-w-5xl mx-auto mt-auto pt-2 sm:pt-4">
        <div className="bg-[#243343]/90 backdrop-blur-md text-white rounded-2xl shadow-xl border border-slate-600/70 px-4 md:px-6 py-2.5 flex items-center justify-between flex-wrap gap-3">
          
          {/* Calendar Date Section */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-400/20 text-amber-300 rounded-xl border border-amber-400/30 shadow-inner">
              <Calendar className="w-5 h-5" />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-extrabold text-sm md:text-base">
                {dayName}
              </span>
              <span className="text-slate-500">|</span>
              <span className="bg-[#1a2532] text-white font-mono font-black text-base md:text-lg px-2.5 py-0.5 rounded-lg border border-slate-600 shadow-inner">
                {dayNumber}
              </span>
              <span className="text-slate-200 font-bold text-sm md:text-base">
                {monthName} {yearNumber}
              </span>
            </div>
          </div>

          {/* Live Clock Section */}
          <div className="flex items-center gap-2 bg-[#1a2532] px-3.5 py-1.5 rounded-xl border border-slate-600/80 shadow-inner">
            <Clock className="w-4 h-4 text-sky-400 animate-pulse" />
            <span className="font-mono font-black text-sm md:text-base text-sky-300 tracking-wider">
              {timeString}
            </span>
          </div>

          {/* System Title / Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>نظام إدارة الكمسيون وسوق الهال</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
