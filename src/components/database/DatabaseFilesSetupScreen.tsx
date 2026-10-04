import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Database,
  Check,
  Plus,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Dices,
  Sparkles,
  Server,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  createPgDatabase,
  deletePgDatabase,
  connectPgDatabase,
  pullPgData,
  listPgDatabases,
  saveStoredPgConfig,
  setPgFirstTimeSeen,
  getDefaultDatabase,
  setDefaultDatabase,
  formatDbDisplayName,
  formatDbInternalName,
} from '../../utils/pgClient';
import { PgConfig } from '../../types';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ConfirmModal';
import { SYSTEM_BASIC_ACCOUNTS } from '../../context/initialData';

interface DatabaseFilesSetupScreenProps {
  pgConfig: PgConfig;
  initialDatabases?: string[];
  onSuccess: () => void;
}

// Smart algorithm to suggest non-repeating database names
function generateUniqueDbSuggestion(existingDbs: string[]): string {
  const currentYear = new Date().getFullYear();
  const lowerExisting = new Set((existingDbs || []).map((s) => (s || '').toLowerCase().trim()));

  const candidateTemplates = [
    `souq_halab_${currentYear}`,
    `souq_damascus_${currentYear}`,
    `souq_alhal_${currentYear}`,
    `souq_main_${currentYear}`,
    `souq_branch_1`,
    `souq_branch_2`,
    `souq_market_${currentYear}`,
  ];

  for (const candidate of candidateTemplates) {
    const internalCandidate = 'commession_' + candidate;
    if (!lowerExisting.has(internalCandidate.toLowerCase()) && !lowerExisting.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  let index = 1;
  while (
    lowerExisting.has(`commession_db_${currentYear}_${index}`) ||
    lowerExisting.has(`commession_db_${index}`) ||
    lowerExisting.has(`commission_db_${currentYear}_${index}`)
  ) {
    index++;
  }
  return `souq_db_${currentYear}_${index}`;
}

export const DatabaseFilesSetupScreen: React.FC<DatabaseFilesSetupScreenProps> = ({
  pgConfig,
  initialDatabases = [],
  onSuccess,
}) => {
  const {
    showNotification,
    setAccounts,
    setCategories,
    setItems,
    setInvoices,
    setVouchers,
    setSettings,
    setPgConfigState,
    setIsPgConnected,
  } = useApp();

  const [defaultDbName, setDefaultDbName] = useState<string>(() => getDefaultDatabase());

  const [databases, setDatabases] = useState<string[]>(() => {
    if (initialDatabases && initialDatabases.length > 0) {
      return initialDatabases;
    }
    return [];
  });

  const [selectedDb, setSelectedDb] = useState<string>(() => {
    const storedDefault = getDefaultDatabase();
    if (storedDefault && initialDatabases.includes(storedDefault)) {
      return storedDefault;
    }
    return initialDatabases && initialDatabases.length > 0 ? initialDatabases[0] : '';
  });

  const [isCreating, setIsCreating] = useState(() => (initialDatabases || []).length === 0);
  const [newDbName, setNewDbName] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dbToDelete, setDbToDelete] = useState<string | null>(null);

  const handleDeleteDbClick = (dbName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDbToDelete(dbName);
  };

  const handleConfirmDeleteDatabase = async () => {
    if (!dbToDelete) return;
    const nameToDelete = dbToDelete;
    setDbToDelete(null);
    setIsLoading(true);
    setLoadingText(`جاري حذف قاعدة البيانات (${nameToDelete})...`);

    try {
      const res = await deletePgDatabase({
        host: pgConfig.host,
        port: pgConfig.port,
        user: pgConfig.user,
        password: pgConfig.password,
        dbName: nameToDelete,
        ssl: pgConfig.ssl,
      });

      if (res.success) {
        setDatabases((prev) => prev.filter((d) => d !== nameToDelete));
        if (defaultDbName === nameToDelete) {
          setDefaultDatabase('');
          setDefaultDbName('');
        }
        showNotification(`تم حذف قاعدة البيانات (${nameToDelete}) بنجاح`, 'info');
      } else {
        setErrorMessage(res.error || `فشل حذف قاعدة البيانات (${nameToDelete})`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حذف قاعدة البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch actual databases list from server on mount
  useEffect(() => {
    let active = true;
    listPgDatabases(pgConfig).then((res) => {
      if (active && res.success && Array.isArray(res.databases)) {
        const listToUse = res.databases;
        setDatabases(listToUse);

        const currentDefault = getDefaultDatabase();

        // 1. في حال وجود ملف افتراضي يتم الدخول مباشرة الى الملف
        if (currentDefault && listToUse.includes(currentDefault)) {
          setSelectedDb(currentDefault);
          handleOpenSelectedDatabase(currentDefault);
          return;
        }

        // 2. وفي حال عدم وجود أي ملف افتراضي (حتى لو كان هناك ملف واحد فقط)، يتم البقاء على واجهة اختيار الملفات
        if (listToUse.length === 0) {
          setIsCreating(true);
        } else {
          setIsCreating(false);
          setSelectedDb(listToUse[0]);
        }
      }
    });
    return () => {
      active = false;
    };
  }, [pgConfig]);

  const handleToggleDefaultDb = (dbName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (defaultDbName === dbName) {
      setDefaultDatabase('');
      setDefaultDbName('');
      showNotification(`تم إلغاء تعيين (${dbName}) كقاعدة افتراضية`, 'info');
    } else {
      setDefaultDatabase(dbName);
      setDefaultDbName(dbName);
      showNotification(`تم تعيين (${dbName}) كقاعدة البيانات الافتراضية بنجاح`, 'success');
    }
  };

  // Re-generate suggestion if databases change or on user request
  const handleSuggestNextName = () => {
    const currentYear = new Date().getFullYear();
    const existing = new Set(databases.map((d) => d.toLowerCase()));
    const suggestions = [
      `souq_halab_${currentYear}`,
      `souq_damascus_${currentYear}`,
      `souq_alhal_${currentYear}`,
      `souq_main_${currentYear}`,
      `souq_branch_1`,
      `souq_branch_2`,
      `souq_market_${currentYear}`,
      `souq_db_${Math.floor(100 + Math.random() * 900)}`,
    ];

    const available = suggestions.filter((s) => !existing.has(('commession_' + s).toLowerCase()) && s !== newDbName);
    if (available.length > 0) {
      const randomPicked = available[Math.floor(Math.random() * available.length)];
      setNewDbName(randomPicked);
    } else {
      setNewDbName(`souq_db_${Date.now().toString().slice(-4)}`);
    }
    setErrorMessage(null);
  };

  // 1. Create New Database File
  const handleCreateDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanInput = newDbName.trim();
    if (!cleanInput) {
      setErrorMessage('يرجى كتابة اسم الملف الجديد');
      return;
    }

    const internalDbName = formatDbInternalName(cleanInput);
    const displayName = formatDbDisplayName(internalDbName);

    // Check if name already exists in current list
    const isDuplicate = databases.some(
      (d) => d.toLowerCase().trim() === internalDbName.toLowerCase().trim()
    );
    if (isDuplicate) {
      setErrorMessage(`اسم قاعدة البيانات (${displayName}) مستخدم مسبقاً، يرجى اختيار اسم غير مكرر.`);
      return;
    }

    setIsLoading(true);
    setLoadingText('جاري إنشاء وتهيئة الملف والجداول المحاسبية على المخدم...');

    try {
      const res = await createPgDatabase({
        host: pgConfig.host,
        port: pgConfig.port,
        user: pgConfig.user,
        password: pgConfig.password,
        dbName: internalDbName,
        ssl: pgConfig.ssl,
      });

      const finalDbName = res.success && res.database ? res.database : internalDbName;
      setDatabases((prev) => (prev.includes(finalDbName) ? prev : [...prev, finalDbName]));

      const activeConfig: PgConfig = {
        ...pgConfig,
        database: finalDbName,
      };

      setPgFirstTimeSeen(true);
      saveStoredPgConfig(activeConfig);
      setPgConfigState(activeConfig);
      setIsPgConnected(true);

      // Pull initial data directly from PostgreSQL
      if (res.success) {
        const pullRes = await pullPgData(activeConfig);
        if (pullRes.success && pullRes.data) {
          setAccounts(Array.isArray(pullRes.data.accounts) && pullRes.data.accounts.length > 0 ? pullRes.data.accounts : SYSTEM_BASIC_ACCOUNTS);
          setCategories(Array.isArray(pullRes.data.categories) ? pullRes.data.categories : []);
          setItems(Array.isArray(pullRes.data.items) ? pullRes.data.items : []);
          setInvoices(Array.isArray(pullRes.data.invoices) ? pullRes.data.invoices : []);
          setVouchers(Array.isArray(pullRes.data.vouchers) ? pullRes.data.vouchers : []);
          if (pullRes.data.settings) {
            setSettings(pullRes.data.settings);
          }
        } else {
          setAccounts(SYSTEM_BASIC_ACCOUNTS);
          setCategories([]);
          setItems([]);
          setInvoices([]);
          setVouchers([]);
        }
      }

      setSuccessMessage(`تم إنشاء وتهيئة الملف (${displayName}) بنجاح! جاري الدخول للنظام...`);
      showNotification(`تم إنشاء وفتح الملف (${displayName}) بنجاح`, 'success');

      setTimeout(() => {
        setIsLoading(false);
        onSuccess();
      }, 500);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'حدث خطأ أثناء إنشاء الملف');
    }
  };

  // 2. Open Selected Database
  const handleOpenSelectedDatabase = async (dbName: string) => {
    if (!dbName) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const displayName = formatDbDisplayName(dbName);
    setIsLoading(true);
    setLoadingText(`جاري فتح الملف (${displayName}) وتحميل البيانات...`);

    try {
      const res = await connectPgDatabase({
        host: pgConfig.host,
        port: pgConfig.port,
        user: pgConfig.user,
        password: pgConfig.password,
        database: dbName,
        ssl: pgConfig.ssl,
      });

      const activeConfig: PgConfig = {
        ...pgConfig,
        database: dbName,
      };

      setPgFirstTimeSeen(true);
      saveStoredPgConfig(activeConfig);
      setPgConfigState(activeConfig);
      setIsPgConnected(true);

      if (res.success) {
        const pullRes = await pullPgData(activeConfig);
        if (pullRes.success && pullRes.data) {
          setAccounts(Array.isArray(pullRes.data.accounts) && pullRes.data.accounts.length > 0 ? pullRes.data.accounts : SYSTEM_BASIC_ACCOUNTS);
          setCategories(Array.isArray(pullRes.data.categories) ? pullRes.data.categories : []);
          setItems(Array.isArray(pullRes.data.items) ? pullRes.data.items : []);
          setInvoices(Array.isArray(pullRes.data.invoices) ? pullRes.data.invoices : []);
          setVouchers(Array.isArray(pullRes.data.vouchers) ? pullRes.data.vouchers : []);
          if (pullRes.data.settings) {
            setSettings(pullRes.data.settings);
          }
        }
      }

      setSuccessMessage(`تم فتح الملف (${displayName}) بنجاح! جاري الدخول للنظام...`);
      showNotification(`تم فتح الملف (${displayName}) بنجاح`, 'success');

      setTimeout(() => {
        setIsLoading(false);
        onSuccess();
      }, 500);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'حدث خطأ أثناء فتح الملف');
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#182330] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2a3b4c] via-[#1a2533] to-[#0f1722] flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 select-none antialiased"
      dir="rtl"
    >
      <div className="w-full max-w-2xl bg-[#3c4f65] text-white rounded-2xl shadow-2xl border border-slate-600/80 p-6 sm:p-8 relative">
        {/* Header - Identical to internal DatabaseSelectorModal style */}
        <div className="flex items-center justify-between border-b border-slate-500/40 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-800 rounded-xl text-amber-400 border border-slate-700 shadow-md">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">
                فتح وإنشاء ملف قاعدة بيانات
              </h2>
            </div>
          </div>
        </div>

        {/* Table Header / Subtitle */}
        {databases.length > 0 && (
          <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-3 pb-2 border-b border-slate-600/50 mb-2">
            <span>اسم قاعدة البيانات</span>
            <span className="flex items-center gap-6">
              <span>الافتراضية</span>
              <span className="w-24 text-center">الإجراءات</span>
            </span>
          </div>
        )}

        {/* Database List - Showing database name + default checkbox + direct entry + delete */}
        <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
          {databases.length === 0 ? (
            <div className="bg-[#324357] border border-slate-600/70 rounded-xl p-5 text-center flex flex-col items-center justify-center gap-2">
              <Database className="w-8 h-8 text-amber-400 opacity-80" />
              <p className="text-xs text-slate-200 font-bold">
                لا توجد قواعد بيانات أنشئتها مسبقاً.
              </p>
              <p className="text-[11px] text-slate-300">
                أدخل اسم قاعدة البيانات الجديدة في الأسفل ثم اضغط «إنشاء وفتح».
              </p>
            </div>
          ) : (
            databases.map((dbName) => {
              const isDefault = defaultDbName === dbName;
              const displayName = formatDbDisplayName(dbName);

              return (
                <div
                  key={dbName}
                  onClick={() => handleOpenSelectedDatabase(dbName)}
                  className={`group flex items-center justify-between p-3 px-4 rounded-xl border text-slate-200 transition-all cursor-pointer shadow-xs ${
                    isDefault
                      ? 'bg-amber-950/30 border-amber-400/80 hover:bg-amber-900/40'
                      : 'bg-[#324357] hover:bg-[#3d526a] border-slate-600/70 hover:border-emerald-400'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Database className={`w-5 h-5 shrink-0 ${isDefault ? 'text-amber-400' : 'text-emerald-400'}`} />
                    <span className="font-bold text-base font-mono text-white tracking-wide truncate">
                      {displayName}
                    </span>
                    {isDefault && (
                      <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shrink-0">
                        الافتراضية
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {/* Default Checkbox Toggle */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleDefaultDb(dbName, e)}
                      title={isDefault ? 'إلغاء القاعدة الافتراضية' : 'تعيين كقاعدة بيانات افتراضية'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                        isDefault
                          ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-sm'
                          : 'bg-slate-800/80 text-slate-300 border-slate-600 hover:border-amber-400 hover:text-amber-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isDefault}
                        onChange={() => {}} // Handled by button onClick
                        className="w-3.5 h-3.5 accent-amber-500 pointer-events-none"
                      />
                      <span className="text-xs">{isDefault ? 'افتراضي' : 'تعيين افتراضي'}</span>
                    </button>

                    {/* Direct Entry Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSelectedDatabase(dbName);
                      }}
                      disabled={isLoading}
                      className="flex items-center gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>دخول</span>
                    </button>

                    {/* Delete Database Button */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteDbClick(dbName, e)}
                      title={`حذف قاعدة البيانات (${displayName})`}
                      className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Create new DB section */}
        {isCreating ? (
          <form
            onSubmit={handleCreateDatabase}
            className="mt-4 pt-4 border-t border-slate-600/70 flex flex-col gap-3 bg-[#324357]/60 p-3.5 rounded-xl border border-amber-400/30"
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>اسم قاعدة البيانات الجديدة:</span>
              </label>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newDbName}
                onChange={(e) => {
                  setNewDbName(e.target.value);
                  setErrorMessage(null);
                }}
                autoFocus
                placeholder="أدخل اسم قاعدة البيانات"
                className="flex-1 bg-white text-slate-900 px-3 py-2 rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-inner"
                dir="ltr"
                required
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black shadow-md cursor-pointer transition-all flex items-center gap-1 shrink-0 disabled:opacity-50 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء وفتح</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 pt-4 border-t border-slate-600/70 flex justify-start items-center">
            <button
              type="button"
              onClick={() => {
                setIsCreating(true);
                setNewDbName('');
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer border border-amber-300 active:scale-95"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>إنشاء ملف جديد</span>
            </button>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mt-3 bg-rose-500/20 border border-rose-400/60 text-rose-200 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-bold">{errorMessage}</span>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mt-3 bg-emerald-500/25 border border-emerald-400 text-emerald-200 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
            <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
            <span className="font-bold text-sm">{successMessage}</span>
          </div>
        )}

        {/* Loading status */}
        {isLoading && (
          <div className="mt-3 bg-sky-950/70 border border-sky-400/70 p-3 rounded-xl flex items-center gap-2.5 text-xs text-sky-200 font-bold animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400 shrink-0" />
            <span>{loadingText || 'جاري المعالجة...'}</span>
          </div>
        )}
      </div>

      {/* Confirm Database Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(dbToDelete)}
        title="تأكيد حذف قاعدة البيانات"
        message={`هل أنت متأكد تماماً من رغبتك في حذف قاعدة البيانات "${formatDbDisplayName(dbToDelete)}" بشكل نهائي؟\n\nتحذير: سيتم مسح كافة البيانات والجداول والحسابات المسجلة في هذا الملف نهائياً، ولا يمكن التراجع عن هذه العملية إلا في حال وجود نسخة احتياطية سابقة!`}
        confirmText="نعم، حذف قاعدة البيانات"
        cancelText="إلغاء"
        isDestructive={true}
        onConfirm={handleConfirmDeleteDatabase}
        onCancel={() => setDbToDelete(null)}
      />
    </div>
  );
};
