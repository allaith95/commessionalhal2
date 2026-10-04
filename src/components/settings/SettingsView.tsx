import React, { useState } from 'react';
import {
  Save,
  RotateCcw,
  CheckCircle2,
  Settings,
  X,
  Building2,
  Coins,
  Sliders,
  Printer,
  ChevronLeft,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CompanySettings } from '../../types';
import { defaultCompanySettings } from '../../context/initialData';
import { CompanyProfileTab } from './CompanyProfileTab';
import { FinancialCommissionTab } from './FinancialCommissionTab';
import { DisplayOptionsTab } from './DisplayOptionsTab';
import { PrintingTab } from './PrintingTab';

type SettingsTabKey = 'company' | 'financial' | 'display' | 'printing';

interface TabDefinition {
  key: SettingsTabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
}

const TABS: TabDefinition[] = [
  {
    key: 'company',
    label: 'بيانات المنشأة',
    icon: Building2,
    colorClass: 'text-amber-400',
  },
  {
    key: 'financial',
    label: 'العملة والكمسيون والتقريب',
    icon: Coins,
    colorClass: 'text-sky-400',
  },
  {
    key: 'display',
    label: 'خيارات العرض',
    icon: Sliders,
    colorClass: 'text-indigo-400',
  },
  {
    key: 'printing',
    label: 'الطباعة',
    icon: Printer,
    colorClass: 'text-emerald-400',
  },
];

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, setCurrentView } = useApp();
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('company');
  const [formData, setFormData] = useState<CompanySettings>({
    ...defaultCompanySettings,
    ...settings,
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleFieldChange = (partial: Partial<CompanySettings>) => {
    setFormData((prev) => ({
      ...prev,
      ...partial,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleResetDefaults = () => {
    if (window.confirm('هل أنت متأكد من استعادة الإعدادات الافتراضية؟')) {
      setFormData({ ...defaultCompanySettings });
      updateSettings(defaultCompanySettings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  return (
    <div
      className="w-full h-[calc(100vh-56px)] bg-[#7196b8] p-1.5 sm:p-2 md:p-2.5 flex flex-col justify-start overflow-hidden animate-in fade-in duration-150"
      dir="rtl"
    >
      {/* Settings Container Card - Full Screen Expansion */}
      <div className="w-full h-full flex flex-col bg-[#34465a] text-white rounded-xl shadow-2xl border border-slate-600/80 overflow-hidden min-h-0">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-600/80 px-4 sm:px-6 py-2.5 bg-[#2b3a4a] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-400/20 text-amber-400 rounded-lg border border-amber-400/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                الإعدادات العامة للبرنامج
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {savedSuccess && (
              <div className="px-3 py-1 bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-xs font-bold rounded-md flex items-center gap-1.5 shadow-xs animate-in fade-in duration-150">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تم حفظ الإعدادات بنجاح!</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setCurrentView('home')}
              className="p-1.5 bg-slate-700/80 hover:bg-slate-600 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="إغلاق والعودة للرئيسية"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body: Side Tabs on the Right + Content on the Left */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
            {/* القائمة الجانبية للتابات (Right Sidebar in RTL) - توسيع العرض بحسب الكلمات */}
            <aside className="w-full md:w-auto md:min-w-[260px] bg-[#243343] border-b md:border-b-0 md:border-l border-slate-600/70 p-3 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shrink-0">
              <span className="hidden md:block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-2">
                أقسام الإعدادات
              </span>

              {TABS.map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center justify-between gap-4 px-3.5 py-2.5 rounded-lg text-right whitespace-nowrap transition-all cursor-pointer select-none shrink-0 border ${
                      isActive
                        ? 'bg-sky-700 text-white font-black shadow-md border-sky-400 ring-1 ring-sky-300/40'
                        : 'bg-[#1e2a37]/80 hover:bg-[#2b3a4a] text-slate-300 hover:text-white border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-1.5 rounded-md ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-800/80 text-slate-400'
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <span className={`text-xs sm:text-sm font-bold whitespace-nowrap ${isActive ? 'text-white' : 'text-slate-200'}`}>
                        {tab.label}
                      </span>
                    </div>

                    <div className="hidden md:flex items-center">
                      <ChevronLeft
                        className={`w-4 h-4 transition-transform ${
                          isActive ? 'text-white translate-x-0.5' : 'text-slate-500'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </aside>

            {/* منطقة محتوى التبويب النشط (Main Content Area) */}
            <main className="flex-1 bg-[#2e3e50] p-4 sm:p-6 overflow-y-auto">
              {activeTab === 'company' && (
                <CompanyProfileTab
                  formData={formData}
                  onChange={handleFieldChange}
                />
              )}

              {activeTab === 'financial' && (
                <FinancialCommissionTab
                  formData={formData}
                  onChange={handleFieldChange}
                />
              )}

              {activeTab === 'display' && (
                <DisplayOptionsTab
                  formData={formData}
                  onChange={handleFieldChange}
                />
              )}

              {activeTab === 'printing' && (
                <PrintingTab
                  formData={formData}
                  onChange={handleFieldChange}
                />
              )}
            </main>
          </div>

          {/* Bottom Action Bar */}
          <div className="bg-[#202c38] border-t border-slate-600/80 px-4 sm:px-6 py-2.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
            {/* جهة اليمين: استعادة الإعدادات الافتراضية */}
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-700 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 text-xs font-bold rounded-md border border-slate-600 shadow-2xs cursor-pointer transition-colors"
              title="استعادة الإعدادات الافتراضية الأصلية"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الإعدادات الافتراضية</span>
            </button>

            {/* جهة اليسار: إلغاء وحفظ التغييرات */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentView('home')}
                className="px-5 py-2 bg-slate-300 hover:bg-white text-slate-900 font-bold text-xs rounded-md shadow-xs cursor-pointer transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm rounded-md shadow-md cursor-pointer transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التغييرات</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
