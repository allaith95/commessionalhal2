import React, { useState, useRef, useEffect } from 'react';
import {
  Home,
  Folder,
  Users,
  Package,
  Receipt,
  FileSpreadsheet,
  Settings,
  Info,
  HelpCircle,
  Undo2,
  ChevronDown,
  Database,
  Download,
  Upload,
  Trash2,
  FilePlus,
  BookOpen,
  Layers,
  FileText,
  KeyRound,
  Server,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AppView } from '../../types';

interface NavbarProps {
  onOpenFileModal: () => void;
  onOpenNewFileModal?: () => void;
  onOpenBackupModal?: () => void;
  onOpenRestoreModal?: () => void;
  onOpenAboutModal: () => void;
  onConfirmEmptyDb: () => void;
  onConfirmDeleteCurrentDb?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenFileModal,
  onOpenNewFileModal,
  onOpenBackupModal,
  onOpenRestoreModal,
  onOpenAboutModal,
  onConfirmEmptyDb,
  onConfirmDeleteCurrentDb,
}) => {
  const {
    currentView,
    setCurrentView,
    goBack,
    backupDatabase,
    setSelectedAccountId,
    setSelectedCategoryId,
    setSelectedItemId,
    setSelectedInvoiceId,
    setSelectedVoucherId,
    loadFromPostgres,
    showNotification,
    isSyncingPg,
  } = useApp();

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name: string) => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  const navigateTo = (view: AppView) => {
    setActiveDropdown(null);
    if (view === 'account_card') setSelectedAccountId(null);
    if (view === 'category_card') setSelectedCategoryId(null);
    if (view === 'item_card') setSelectedItemId(null);
    if (view === 'commission_invoice') setSelectedInvoiceId(null);
    if (view === 'voucher_payment' || view === 'voucher_receipt') setSelectedVoucherId(null);
    setCurrentView(view);
  };

  const handleRestoreClick = () => {
    setActiveDropdown(null);
    if (onOpenRestoreModal) {
      onOpenRestoreModal();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          // Trigger file restore via event
          const restoreEvent = new CustomEvent('restore_db_request', { detail: content });
          window.dispatchEvent(restoreEvent);
        }
      };
      reader.readAsText(file);
    }
    // reset input
    e.target.value = '';
  };

  return (
    <header className="sticky top-0 z-40 w-full select-none shadow-md" ref={navRef}>
      {/* Top red accent line from screenshot */}
      <div className="h-1 w-full bg-red-600"></div>

      {/* Main navigation bar matching screenshot الرئيسية.png */}
      <div className="bg-[#2c394b] text-slate-100 flex items-center justify-between px-3 md:px-6 py-2 border-b border-slate-700">
        {/* Right side navigation items (in RTL: Right to Left) */}
        <div className="flex items-center gap-1 md:gap-3 flex-wrap">
          {/* الرئيسية */}
          <button
            onClick={() => navigateTo('home')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-all cursor-pointer ${
              currentView === 'home' ? 'bg-slate-700 text-white shadow-inner' : 'hover:bg-slate-700/70 text-slate-200'
            }`}
          >
            <Home className="w-4 h-4 text-amber-400" />
            <span>الرئيسية</span>
          </button>

          {/* ملف Dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('file')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-all cursor-pointer ${
                activeDropdown === 'file' ? 'bg-slate-700 text-white' : 'hover:bg-slate-700/70 text-slate-200'
              }`}
            >
              <Folder className="w-4 h-4 text-amber-400" />
              <span>ملف</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {activeDropdown === 'file' && (
              <div className="absolute right-0 mt-1.5 w-64 bg-[#1f2d3d] border border-slate-600 rounded-md shadow-2xl py-1 z-50 text-right">
                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    onOpenFileModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <Database className="w-4 h-4 text-sky-400" />
                  <span>فتح ملف (قاعدة بيانات)</span>
                </button>
                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    if (onOpenNewFileModal) {
                      onOpenNewFileModal();
                    } else {
                      onOpenFileModal();
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-emerald-300 hover:bg-slate-700 hover:text-emerald-200 transition-colors cursor-pointer"
                >
                  <FilePlus className="w-4 h-4 text-emerald-400" />
                  <span>إنشاء ملف جديد</span>
                </button>
                <div className="border-t border-slate-700 my-1"></div>
                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    if (onOpenBackupModal) {
                      onOpenBackupModal();
                    } else {
                      backupDatabase();
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>أخذ نسخة احتياطية</span>
                </button>
                <button
                  onClick={handleRestoreClick}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-blue-400" />
                  <span>استعادة نسخة احتياطية</span>
                </button>
                <div className="border-t border-slate-700 my-1"></div>
                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    onConfirmEmptyDb();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-amber-300 hover:bg-amber-950/50 hover:text-amber-200 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-amber-400" />
                  <span>تفريغ كافة البيانات</span>
                </button>
                {onConfirmDeleteCurrentDb && (
                  <button
                    onClick={() => {
                      setActiveDropdown(null);
                      onConfirmDeleteCurrentDb();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-rose-400 hover:bg-rose-950/60 hover:text-rose-200 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>حذف قاعدة البيانات الحالية</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* حسابات Dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('accounts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-all cursor-pointer ${
                activeDropdown === 'accounts' || currentView.startsWith('account')
                  ? 'bg-slate-700 text-white'
                  : 'hover:bg-slate-700/70 text-slate-200'
              }`}
            >
              <Users className="w-4 h-4 text-sky-400" />
              <span>حسابات</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {activeDropdown === 'accounts' && (
              <div className="absolute right-0 mt-1.5 w-52 bg-[#1f2d3d] border border-slate-600 rounded-md shadow-2xl py-1 z-50 text-right">
                <button
                  onClick={() => navigateTo('account_card')}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <FilePlus className="w-4 h-4 text-emerald-400" />
                  <span>بطاقة حساب</span>
                </button>
                <button
                  onClick={() => navigateTo('accounts_list')}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>استعراض الحسابات</span>
                </button>
                <div className="border-t border-slate-700 my-1"></div>
                <button
                  onClick={() => navigateTo('account_statement')}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span>كشف حساب</span>
                </button>
                <button
                  onClick={() => navigateTo('commission_report')}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-purple-400" />
                  <span>تقرير حركة كمسيون</span>
                </button>
              </div>
            )}
          </div>

          {/* مواد Dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('materials')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-all cursor-pointer ${
                activeDropdown === 'materials' || currentView.startsWith('item') || currentView.startsWith('categor')
                  ? 'bg-slate-700 text-white'
                  : 'hover:bg-slate-700/70 text-slate-200'
              }`}
            >
              <Package className="w-4 h-4 text-emerald-400" />
              <span>مواد</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {activeDropdown === 'materials' && (
              <div className="absolute right-0 mt-1.5 w-52 bg-[#1f2d3d] border border-slate-600 rounded-md shadow-2xl py-1 z-50 text-right">
                <button
                  onClick={() => navigateTo('category_card')}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>بطاقة تصنيف (صنف)</span>
                </button>
                <button
                  onClick={() => navigateTo('item_card')}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <FilePlus className="w-4 h-4 text-emerald-400" />
                  <span>بطاقة مادة</span>
                </button>
                <div className="border-t border-slate-700 my-1"></div>
                <button
                  onClick={() => navigateTo('items_list')}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <Package className="w-4 h-4 text-teal-400" />
                  <span>استعراض المواد</span>
                </button>
                <button
                  onClick={() => navigateTo('item_movement_report')}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                  <span>تقرير حركة مادة</span>
                </button>
              </div>
            )}
          </div>

          {/* فواتير Dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('invoices')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-all cursor-pointer ${
                activeDropdown === 'invoices' || currentView.startsWith('invoice')
                  ? 'bg-slate-700 text-white'
                  : 'hover:bg-slate-700/70 text-slate-200'
              }`}
            >
              <Receipt className="w-4 h-4 text-violet-400" />
              <span>فواتير</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {activeDropdown === 'invoices' && (
              <div className="absolute right-0 mt-1.5 w-52 bg-[#1f2d3d] border border-slate-600 rounded-md shadow-2xl py-1 z-50 text-right">
                <button
                  onClick={() => navigateTo('commission_invoice')}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <FilePlus className="w-4 h-4 text-violet-400" />
                  <span>فاتورة كمسيون</span>
                </button>
                <button
                  onClick={() => navigateTo('invoices_list')}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <Receipt className="w-4 h-4 text-sky-400" />
                  <span>استعراض الفواتير</span>
                </button>
              </div>
            )}
          </div>

          {/* سندات Dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('vouchers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-all cursor-pointer ${
                activeDropdown === 'vouchers' || currentView.startsWith('voucher')
                  ? 'bg-slate-700 text-white'
                  : 'hover:bg-slate-700/70 text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>سندات</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {activeDropdown === 'vouchers' && (
              <div className="absolute right-0 mt-1.5 w-48 bg-[#1f2d3d] border border-slate-600 rounded-md shadow-2xl py-1 z-50 text-right">
                <button
                  onClick={() => navigateTo('voucher_payment')}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-rose-400" />
                  <span>سند دفع</span>
                </button>
                <button
                  onClick={() => navigateTo('voucher_receipt')}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>سند قبض</span>
                </button>
              </div>
            )}
          </div>

          {/* الإعدادات */}
          <button
            onClick={() => navigateTo('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-all cursor-pointer ${
              currentView === 'settings' ? 'bg-slate-700 text-white' : 'hover:bg-slate-700/70 text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4 text-slate-300" />
            <span>الإعدادات</span>
          </button>

          {/* حول البرنامج */}
          <button
            onClick={() => onOpenAboutModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold text-slate-200 hover:bg-slate-700/70 transition-all cursor-pointer"
            title="حول البرنامج وحقوق الملكية"
          >
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            <span>حول</span>
          </button>
        </div>

        {/* Left side: Back button (عودة) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-slate-700/80 hover:bg-slate-600 text-white text-sm font-bold shadow-sm transition-all cursor-pointer"
            title="العودة للشاشة السابقة"
          >
            <Undo2 className="w-4 h-4 text-amber-400 rotate-180" />
            <span>عودة</span>
          </button>
        </div>
      </div>

      {/* Hidden file input for restore database */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />
    </header>
  );
};
