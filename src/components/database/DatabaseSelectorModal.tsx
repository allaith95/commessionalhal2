import React, { useState, useEffect } from 'react';
import { Database, Plus, Check, X, FolderOpen, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  listPgDatabases,
  connectPgDatabase,
  createPgDatabase,
  deletePgDatabase,
  pullPgData,
  saveStoredPgConfig,
  getStoredPgConfig,
  getDefaultDatabase,
  setDefaultDatabase,
  formatDbDisplayName,
  formatDbInternalName,
} from '../../utils/pgClient';
import { PgConfig } from '../../types';
import { SYSTEM_BASIC_ACCOUNTS } from '../../context/initialData';

interface DatabaseSelectorModalProps {
  isOpen: boolean;
  initialCreateMode?: boolean;
  onClose: () => void;
}

export const DatabaseSelectorModal: React.FC<DatabaseSelectorModalProps> = ({
  isOpen,
  initialCreateMode = false,
  onClose,
}) => {
  const {
    currentDatabaseName,
    pgConfig,
    setPgConfigState,
    setIsPgConnected,
    setAccounts,
    setCategories,
    setItems,
    setInvoices,
    setVouchers,
    setSettings,
    setCurrentView,
    closeAllWindows,
    showNotification,
  } = useApp();

  const [dbList, setDbList] = useState<string[]>([]);
  const [newDbName, setNewDbName] = useState('');
  const [isCreating, setIsCreating] = useState(initialCreateMode);
  const [dbToDelete, setDbToDelete] = useState<string | null>(null);
  const [defaultDbName, setDefaultDbName] = useState<string>(() => getDefaultDatabase());
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeConfig: PgConfig = pgConfig || getStoredPgConfig() || {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '',
    database: 'postgres',
    ssl: false,
  };

  const loadLiveDatabases = async () => {
    try {
      const res = await listPgDatabases(activeConfig);
      if (res.success && Array.isArray(res.databases)) {
        setDbList(res.databases);
      }
    } catch (err) {
      console.error('Failed to list PG databases:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsCreating(initialCreateMode);
      setNewDbName('');
      setDbToDelete(null);
      setErrorMessage(null);
      loadLiveDatabases();
    }
  }, [isOpen, initialCreateMode]);

  if (!isOpen) return null;

  const handleOpenDatabase = async (dbName: string) => {
    if (!dbName) return;
    setIsLoading(true);
    const displayName = formatDbDisplayName(dbName);
    setLoadingText(`جاري التحويل وفتح قاعدة البيانات (${displayName})...`);
    setErrorMessage(null);

    try {
      const res = await connectPgDatabase({
        ...activeConfig,
        database: dbName,
      });

      const updatedConfig: PgConfig = {
        ...activeConfig,
        database: dbName,
      };

      saveStoredPgConfig(updatedConfig);
      setPgConfigState(updatedConfig);
      setIsPgConnected(true);

      if (res.success) {
        const pullRes = await pullPgData(updatedConfig);
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

      closeAllWindows();
      setCurrentView('home');
      showNotification(`تم فتح والتحويل لقاعدة البيانات (${displayName}) بنجاح`, 'success');
      setIsLoading(false);
      onClose();
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'حدث خطأ أثناء فتح قاعدة البيانات');
    }
  };

  const handleCreateDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanInput = newDbName.trim();
    if (!cleanInput) {
      setErrorMessage('يرجى كتابة اسم ملف قاعدة البيانات الجديد');
      return;
    }

    const internalDbName = formatDbInternalName(cleanInput);
    const displayName = formatDbDisplayName(internalDbName);

    setIsLoading(true);
    setLoadingText(`جاري إنشاء وتهيئة قاعدة البيانات (${displayName})...`);

    try {
      const res = await createPgDatabase({
        ...activeConfig,
        dbName: internalDbName,
      });

      const finalDbName = res.success && res.database ? res.database : internalDbName;

      const updatedConfig: PgConfig = {
        ...activeConfig,
        database: finalDbName,
      };

      saveStoredPgConfig(updatedConfig);
      setPgConfigState(updatedConfig);
      setIsPgConnected(true);

      if (res.success) {
        const pullRes = await pullPgData(updatedConfig);
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

      // Close open database, reset view to home screen
      closeAllWindows();
      setCurrentView('home');

      showNotification(`تم إنشاء وفتح قاعدة البيانات (${displayName}) بنجاح والتحويل إلى الواجهة الرئيسية`, 'success');
      setIsLoading(false);
      setIsCreating(false);
      setNewDbName('');
      onClose();
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'حدث خطأ أثناء إنشاء قاعدة البيانات');
    }
  };

  const handleConfirmDelete = async () => {
    if (!dbToDelete) return;
    const nameToDelete = dbToDelete;
    const displayName = formatDbDisplayName(nameToDelete);

    const isCurrent =
      nameToDelete === activeConfig.database ||
      nameToDelete === currentDatabaseName ||
      formatDbDisplayName(nameToDelete) === currentDatabaseName;

    setDbToDelete(null);
    setIsLoading(true);
    setLoadingText(`جاري حذف قاعدة البيانات (${displayName})...`);

    try {
      const res = await deletePgDatabase({
        ...activeConfig,
        dbName: nameToDelete,
      });

      if (res.success) {
        if (defaultDbName === nameToDelete) {
          setDefaultDatabase('');
          setDefaultDbName('');
        }

        // Update local list state
        setDbList((prev) => prev.filter((d) => d !== nameToDelete));

        if (isCurrent) {
          // If the deleted database was the currently open one, exit to file selection screen
          const resetConfig: PgConfig = {
            ...activeConfig,
            database: 'postgres',
          };
          saveStoredPgConfig(resetConfig);
          setPgConfigState(resetConfig);
          setIsPgConnected(true);
          setAccounts(SYSTEM_BASIC_ACCOUNTS);
          setCategories([]);
          setItems([]);
          setInvoices([]);
          setVouchers([]);
          closeAllWindows();
          onClose();
          showNotification(`تم حذف قاعدة البيانات الحالية (${displayName}) بنجاح، وتمت العودة لواجهة اختيار الملفات`, 'success');
        } else {
          // Otherwise keep modal open with updated list
          showNotification(`تم حذف قاعدة البيانات (${displayName}) بنجاح`, 'success');
        }
      } else {
        setErrorMessage(res.error || `فشل حذف قاعدة البيانات (${displayName})`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حذف قاعدة البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#3c4f65] text-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-600/80 p-6 sm:p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-slate-300 hover:text-white p-1 rounded-full hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-500/40 pb-3 mb-4">
          <div className="p-2.5 bg-slate-800 rounded-xl text-amber-400 border border-slate-700 shadow-md">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">فتح وإنشاء ملف قاعدة بيانات</h2>
          </div>
        </div>

        {/* Table Header / Subtitle */}
        {dbList.length > 0 && (
          <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-3 pb-2 border-b border-slate-600/50 mb-2">
            <span>اسم قاعدة البيانات</span>
            <span className="flex items-center gap-6">
              <span>الافتراضية</span>
              <span className="w-24 text-center">الإجراءات</span>
            </span>
          </div>
        )}

        {/* Database List */}
        <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
          {dbList.length === 0 ? (
            <div className="bg-[#324357] border border-slate-600/70 rounded-xl p-5 text-center flex flex-col items-center justify-center gap-2">
              <Database className="w-8 h-8 text-amber-400 opacity-80" />
              <p className="text-xs text-slate-200 font-bold">
                لا توجد قواعد بيانات أنشئتها مسبقاً على السيرفر.
              </p>
              <p className="text-[11px] text-slate-300">
                أدخل اسم قاعدة البيانات الجديدة في الأسفل ثم اضغط «إنشاء وفتح».
              </p>
            </div>
          ) : (
            dbList.map((dbName) => {
              const isCurrent = dbName === activeConfig.database || dbName === currentDatabaseName || formatDbDisplayName(dbName) === currentDatabaseName;
              const isDefault = defaultDbName === dbName;
              const displayName = formatDbDisplayName(dbName);

              const handleToggleDefault = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (isDefault) {
                  setDefaultDatabase('');
                  setDefaultDbName('');
                  showNotification(`تم إلغاء تعيين (${displayName}) كقاعدة افتراضية`, 'info');
                } else {
                  setDefaultDatabase(dbName);
                  setDefaultDbName(dbName);
                  showNotification(`تم تعيين (${displayName}) كقاعدة البيانات الافتراضية بنجاح`, 'success');
                }
              };

              return (
                <div
                  key={dbName}
                  onClick={() => handleOpenDatabase(dbName)}
                  className={`group flex items-center justify-between p-3 px-4 rounded-xl border text-slate-200 transition-all cursor-pointer shadow-xs ${
                    isCurrent
                      ? 'bg-emerald-800/40 border-emerald-400 text-white shadow-md'
                      : isDefault
                      ? 'bg-amber-950/30 border-amber-400/80 hover:bg-amber-900/40 text-slate-100'
                      : 'bg-[#324357] hover:bg-[#3d526a] border-slate-600/70 hover:border-emerald-400'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Database className={`w-5 h-5 shrink-0 ${isCurrent ? 'text-emerald-400' : isDefault ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span className="font-bold text-base font-mono text-white tracking-wide truncate">{displayName}</span>
                    {isCurrent && (
                      <span className="text-[10px] font-black bg-emerald-600 text-white px-2.5 py-0.5 rounded-full shrink-0">
                        الملف الحالي
                      </span>
                    )}
                    {isDefault && !isCurrent && (
                      <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shrink-0">
                        الافتراضية
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {/* Default Checkbox Toggle */}
                    <button
                      type="button"
                      onClick={handleToggleDefault}
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
                        onChange={() => {}}
                        className="w-3.5 h-3.5 accent-amber-500 pointer-events-none"
                      />
                      <span className="text-xs">{isDefault ? 'افتراضي' : 'تعيين افتراضي'}</span>
                    </button>

                    {/* Direct Entry Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDatabase(dbName);
                      }}
                      disabled={isLoading}
                      className="flex items-center gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>دخول</span>
                    </button>

                    {/* Delete Database Button - Allowed for all databases */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDbToDelete(dbName);
                      }}
                      title={`حذف قاعدة البيانات (${displayName}) والخروج لواجهة اختيار الملفات`}
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
          <form onSubmit={handleCreateDatabase} className="mt-4 pt-4 border-t border-slate-600/70 flex flex-col gap-3 bg-[#324357]/60 p-3.5 rounded-xl border border-amber-400/30">
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
                onChange={(e) => setNewDbName(e.target.value)}
                autoFocus
                placeholder="أدخل اسم قاعدة البيانات"
                className="flex-1 bg-white text-slate-900 px-3 py-2 rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-inner"
                dir="ltr"
                required
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black shadow-md cursor-pointer transition-all flex items-center gap-1 shrink-0 active:scale-95"
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
          <div className="mt-4 pt-4 border-t border-slate-600/70 flex justify-between items-center">
            <button
              onClick={() => {
                setNewDbName('');
                setIsCreating(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer border border-amber-300 active:scale-95"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>إنشاء ملف جديد</span>
            </button>

            <button
              onClick={onClose}
              className="px-6 py-2 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl shadow cursor-pointer transition-colors"
            >
              إغلاق
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

        {/* Loading status */}
        {isLoading && (
          <div className="mt-3 bg-sky-950/70 border border-sky-400/70 p-3 rounded-xl flex items-center gap-2.5 text-xs text-sky-200 font-bold animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400 shrink-0" />
            <span>{loadingText || 'جاري المعالجة...'}</span>
          </div>
        )}

        {/* Confirmation Modal for Deleting Database */}
        <ConfirmModal
          isOpen={Boolean(dbToDelete)}
          title="تأكيد حذف قاعدة البيانات نهائياً"
          message={`هل أنت متأكد تماماً من رغبتك في حذف قاعدة البيانات "${formatDbDisplayName(dbToDelete)}" بشكل نهائي؟\n\nتنبيه: سيتم مسح ملف قاعدة البيانات وكافة البيانات والحسابات نهائياً، وسيتم الخروج فوراً من الواجهة والعودة لواجهة اختيار الملفات في البداية.`}
          confirmText="نعم، حذف قاعدة البيانات والعودة للبداية"
          cancelText="إلغاء"
          type="danger"
          isDestructive={true}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDbToDelete(null)}
        />
      </div>
    </div>
  );
};
