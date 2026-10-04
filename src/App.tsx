import React, { useState, useEffect } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { HomeDashboard } from './components/home/HomeDashboard';
import { AccountCardModal } from './components/accounts/AccountCardModal';
import { AccountsListView } from './components/accounts/AccountsListView';
import { CategoryCardModal } from './components/items/CategoryCardModal';
import { ItemCardModal } from './components/items/ItemCardModal';
import { ItemsListView } from './components/items/ItemsListView';
import { CommissionInvoiceView } from './components/invoices/CommissionInvoiceView';
import { InvoicesListView } from './components/invoices/InvoicesListView';
import { VouchersView } from './components/vouchers/VouchersView';
import { AccountStatementView } from './components/reports/AccountStatementView';
import { CommissionReportView } from './components/reports/CommissionReportView';
import { ItemMovementReportView } from './components/reports/ItemMovementReportView';
import { SettingsView } from './components/settings/SettingsView';
import { AboutModal } from './components/about/AboutModal';
import { DatabaseSelectorModal } from './components/database/DatabaseSelectorModal';
import { BackupRestoreModal } from './components/database/BackupRestoreModal';
import { PrintContainer } from './components/print/PrintContainer';
import { ToastNotification } from './components/common/ToastNotification';
import { ConfirmModal } from './components/common/ConfirmModal';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { isAppActivated, readActivationFromFile } from './utils/activation';
import {
  isServerConfigSaved,
  getStoredPgConfig,
  setServerConfigSaved,
  saveStoredPgConfig,
  listPgDatabases,
  getDefaultDatabase,
  setDefaultDatabase,
  connectAndLoadPgDatabase,
  deletePgDatabase,
  formatDbDisplayName,
} from './utils/pgClient';
import { SYSTEM_BASIC_ACCOUNTS } from './context/initialData';
import { PgConfig } from './types';
import { CustomContextMenu } from './components/common/CustomContextMenu';
import { ActivationLockScreen } from './components/activation/ActivationLockScreen';
import { ServerConnectionScreen } from './components/database/ServerConnectionScreen';
import { DatabaseFilesSetupScreen } from './components/database/DatabaseFilesSetupScreen';

const MainContent: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    goBack,
    emptyDatabase,
    restoreDatabase,
    currentDatabaseName,
    pgConfig,
    showDiscardInvoiceModal,
    confirmDiscardInvoice,
    cancelDiscardInvoice,
    setPgConfigState,
    setIsPgConnected,
    setAccounts,
    setCategories,
    setItems,
    setInvoices,
    setVouchers,
    closeAllWindows,
    showNotification,
  } = useApp();

  // Dialog states for File menu and About
  const [dbModalState, setDbModalState] = useState<{
    isOpen: boolean;
    initialCreateMode: boolean;
  }>({
    isOpen: false,
    initialCreateMode: false,
  });

  const [backupModalState, setBackupModalState] = useState<{
    isOpen: boolean;
    initialTab: 'backup' | 'restore' | 'empty';
  }>({
    isOpen: false,
    initialTab: 'backup',
  });

  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [showDeleteCurrentDbConfirm, setShowDeleteCurrentDbConfirm] = useState(false);

  // Listen to file restore request from Navbar
  useEffect(() => {
    const handleRestoreEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        restoreDatabase(customEvent.detail);
      }
    };
    window.addEventListener('restore_db_request', handleRestoreEvent);
    return () => window.removeEventListener('restore_db_request', handleRestoreEvent);
  }, [restoreDatabase]);

  const handleConfirmEmpty = () => {
    emptyDatabase();
    setShowEmptyConfirm(false);
  };

  const handleConfirmDeleteCurrentDb = async () => {
    const activeCfg = pgConfig || getStoredPgConfig() || {
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: '',
      database: 'postgres',
      ssl: false,
    };

    const targetDb = activeCfg.database && activeCfg.database !== 'postgres' ? activeCfg.database : currentDatabaseName;
    if (!targetDb) return;
    const displayName = formatDbDisplayName(targetDb);
    setShowDeleteCurrentDbConfirm(false);

    try {
      const res = await deletePgDatabase({
        host: activeCfg.host,
        port: activeCfg.port,
        user: activeCfg.user,
        password: activeCfg.password,
        dbName: targetDb,
        ssl: activeCfg.ssl,
      });

      if (res.success) {
        if (getDefaultDatabase() === targetDb || getDefaultDatabase() === displayName) {
          setDefaultDatabase('');
        }
        const resetCfg: PgConfig = { ...activeCfg, database: 'postgres' };
        saveStoredPgConfig(resetCfg);
        setPgConfigState(resetCfg);
        setIsPgConnected(true);
        setAccounts(SYSTEM_BASIC_ACCOUNTS);
        setCategories([]);
        setItems([]);
        setInvoices([]);
        setVouchers([]);
        closeAllWindows();
        showNotification(`تم حذف قاعدة البيانات (${displayName}) بنجاح، وتمت العودة لواجهة اختيار الملفات`, 'success');
      } else {
        showNotification(res.error || `فشل حذف قاعدة البيانات (${displayName})`, 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'حدث خطأ أثناء حذف قاعدة البيانات', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#7196b8] flex flex-col font-sans select-none text-slate-900 antialiased" dir="rtl">
      {/* Top Navbar matching the exact menus in the screenshots */}
      <Navbar
        onOpenFileModal={() => setDbModalState({ isOpen: true, initialCreateMode: false })}
        onOpenNewFileModal={() => setDbModalState({ isOpen: true, initialCreateMode: true })}
        onOpenBackupModal={() => setBackupModalState({ isOpen: true, initialTab: 'backup' })}
        onOpenRestoreModal={() => setBackupModalState({ isOpen: true, initialTab: 'restore' })}
        onConfirmEmptyDb={() => setShowEmptyConfirm(true)}
        onConfirmDeleteCurrentDb={() => setShowDeleteCurrentDbConfirm(true)}
        onOpenAboutModal={() => setIsAboutOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 w-full flex flex-col justify-start">
        {currentView === 'home' && (
          <HomeDashboard
            onOpenBackupModal={() =>
              setBackupModalState({ isOpen: true, initialTab: 'backup' })
            }
          />
        )}

        {currentView === 'account_card' && (
          <AccountCardModal onClose={goBack} />
        )}

        {currentView === 'accounts_list' && <AccountsListView />}

        {currentView === 'account_statement' && <AccountStatementView />}

        {currentView === 'commission_report' && <CommissionReportView />}

        {currentView === 'category_card' && (
          <CategoryCardModal onClose={goBack} />
        )}

        {currentView === 'item_card' && (
          <ItemCardModal onClose={goBack} />
        )}

        {currentView === 'items_list' && <ItemsListView />}

        {(currentView === 'item_movement_report' || currentView === 'item_report') && (
          <ItemMovementReportView />
        )}

        {currentView === 'commission_invoice' && (
          <CommissionInvoiceView onClose={goBack} />
        )}

        {currentView === 'invoices_list' && <InvoicesListView />}

        {currentView === 'voucher_payment' && (
          <VouchersView type="دفع" onClose={goBack} />
        )}

        {currentView === 'voucher_receipt' && (
          <VouchersView type="قبض" onClose={goBack} />
        )}

        {currentView === 'settings' && <SettingsView />}
      </main>

      {/* File Menu Modals */}
      <DatabaseSelectorModal
        isOpen={dbModalState.isOpen}
        initialCreateMode={dbModalState.initialCreateMode}
        onClose={() => setDbModalState({ isOpen: false, initialCreateMode: false })}
      />

      <BackupRestoreModal
        isOpen={backupModalState.isOpen}
        initialTab={backupModalState.initialTab}
        onClose={() => setBackupModalState({ isOpen: false, initialTab: 'backup' })}
      />

      {/* About Modal */}
      {isAboutOpen && <AboutModal onClose={() => setIsAboutOpen(false)} />}

      {/* Confirm Empty Database Modal */}
      <ConfirmModal
        isOpen={showEmptyConfirm}
        title="تأكيد تفريغ كافة البيانات"
        message={`هل أنت متأكد تماماً من حذف وتفريغ كافة البيانات (السندات، الفواتير، المواد، الأصناف، والحسابات المضافة) والاحتفاظ بالحسابات الـ 5 الافتراضية فقط من ملف "${currentDatabaseName}"؟\n\nتنبيه: سيتم مسح كافة القيود والسجلات نهائياً، ولا يمكن التراجع عن هذه الخطوة إلا في حال وجود نسخة احتياطية سابقة!`}
        confirmText="نعم، حذف وتفريغ كافة البيانات"
        cancelText="إلغاء الأمر"
        onConfirm={handleConfirmEmpty}
        onCancel={() => setShowEmptyConfirm(false)}
      />

      {/* Confirm Delete Current Database Modal */}
      <ConfirmModal
        isOpen={showDeleteCurrentDbConfirm}
        title="تأكيد حذف قاعدة البيانات الحالية نهائياً"
        message={`هل أنت متأكد تماماً من حذف قاعدة البيانات الحالية "${currentDatabaseName}" نهائياً من السيرفر؟\n\nتحذير هام: سيتم مسح هذا الملف وكافة قيوده وحساباته نهائياً، وسيتم الخروج فوراً من الواجهة الرئيسية والعودة لواجهة اختيار الملفات في البداية!`}
        confirmText="نعم، حذف قاعدة البيانات والعودة للبداية"
        cancelText="إلغاء الأمر"
        type="danger"
        isDestructive={true}
        onConfirm={handleConfirmDeleteCurrentDb}
        onCancel={() => setShowDeleteCurrentDbConfirm(false)}
      />

      {/* Confirm Discard Invoice Modal */}
      <ConfirmModal
        isOpen={showDiscardInvoiceModal}
        title="تنبيه: تجاهل الفاتورة والخروج"
        message="لديك فاتورة كمسيون قيد التحرير حالياً. هل تريد بالتأكيد تجاهل الفاتورة الحالية والخروج إلى النافذة المحددة؟"
        confirmText="نعم، تجاهل الفاتورة والخروج"
        cancelText="لا، البقاء في الفاتورة"
        type="warning"
        onConfirm={confirmDiscardInvoice}
        onCancel={cancelDiscardInvoice}
      />

      {/* Print Layer - Renders high-fidelity print document & window.print() */}
      <PrintContainer />

      {/* Global Toast Notification */}
      <ToastNotification />

      {/* PWA Offline Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
};

const AppRoot: React.FC = () => {
  const [isActivated, setIsActivated] = useState<boolean>(() => isAppActivated());
  const {
    isPgConnected,
    setIsPgConnected,
    pgConfig,
    setPgConfigState,
    setAccounts,
    setCategories,
    setItems,
    setInvoices,
    setVouchers,
    setSettings,
    showNotification,
  } = useApp();
  const [serverDatabases, setServerDatabases] = useState<string[]>([]);
  const [showServerSetupManual, setShowServerSetupManual] = useState<boolean>(false);
  const [isResolvingStartupDb, setIsResolvingStartupDb] = useState<boolean>(true);
  const [startupStatusText, setStartupStatusText] = useState<string>('جاري فحص قواعد البيانات...');

  const storedConfig = getStoredPgConfig();
  const isServerReady = isServerConfigSaved() || Boolean(storedConfig && storedConfig.host);

  useEffect(() => {
    // Read activation key from external disk file (config/activation_license.json)
    readActivationFromFile().then((res) => {
      if (res.success && res.data) {
        setIsActivated(isAppActivated());
      }
    });

    const handleLockEvent = () => {
      setIsActivated(false);
    };
    window.addEventListener('app_lock_requested', handleLockEvent);
    return () => window.removeEventListener('app_lock_requested', handleLockEvent);
  }, []);

  // Startup Database Resolution according to exact user rules:
  // 1. في حال وجود ملف افتراضي يتم الدخول مباشرة الى الملف
  // 2. وفي حال وجود ملف واحد فقط ولم يكن افتراضي يتم الدخول اليه مباشرة
  // 3. وفي حال عدم وجود اي ملف افتراضي يتم الفتح على واجهة اختيار ملف
  useEffect(() => {
    if (!isActivated || !isServerReady) {
      setIsResolvingStartupDb(false);
      return;
    }

    if (pgConfig?.database && pgConfig.database !== 'postgres') {
      setIsResolvingStartupDb(false);
      return;
    }

    let active = true;

    async function checkStartupDatabases() {
      const activeConfig: PgConfig = pgConfig || storedConfig || {
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: '',
        database: 'postgres',
        ssl: false,
      };

      try {
        setStartupStatusText('جاري فحص قواعد البيانات على المخدم...');
        const res = await listPgDatabases(activeConfig);
        if (!active) return;

        const dbs: string[] = res.success && Array.isArray(res.databases) ? res.databases : [];
        setServerDatabases(dbs);

        const defaultDb = getDefaultDatabase();

        // Rule 1: في حال وجود ملف افتراضي يتم الدخول مباشرة الى الملف
        if (defaultDb && dbs.includes(defaultDb)) {
          setStartupStatusText(`جاري الدخول إلى الملف الافتراضي (${defaultDb})...`);
          const ok = await connectAndLoadPgDatabase(activeConfig, defaultDb, {
            setPgConfigState,
            setIsPgConnected,
            setAccounts,
            setCategories,
            setItems,
            setInvoices,
            setVouchers,
            setSettings,
          });
          if (active) {
            if (ok) {
              showNotification(`تم الدخول إلى الملف الافتراضي (${defaultDb})`, 'success');
            }
            setIsResolvingStartupDb(false);
          }
          return;
        }

        // وفي حال عدم وجود أي ملف افتراضي (حتى لو كان هناك ملف واحد فقط)، يتم الفتح مباشرة على واجهة اختيار ملف
        if (active) {
          setIsResolvingStartupDb(false);
        }
      } catch (err) {
        console.error('Database auto-resolution error:', err);
        if (active) {
          setIsResolvingStartupDb(false);
        }
      }
    }

    checkStartupDatabases();

    return () => {
      active = false;
    };
  }, [isActivated, isServerReady]);

  // Gate 1: Activation is strictly required first
  if (!isActivated) {
    return <ActivationLockScreen onActivated={() => setIsActivated(true)} />;
  }

  // Gate 2: Server Connection is only shown ONCE at initial setup (or if manually requested)
  if ((!isServerReady && !pgConfig) || showServerSetupManual) {
    return (
      <ServerConnectionScreen
        onSuccess={(config, dbs) => {
          setServerConfigSaved(true);
          setPgConfigState(config);
          setIsPgConnected(true);
          setServerDatabases(dbs);
          setShowServerSetupManual(false);

          const defaultDb = getDefaultDatabase();
          if (defaultDb && dbs.includes(defaultDb)) {
            connectAndLoadPgDatabase(config, defaultDb, {
              setPgConfigState,
              setIsPgConnected,
              setAccounts,
              setCategories,
              setItems,
              setInvoices,
              setVouchers,
              setSettings,
            }).then((ok) => {
              if (ok) {
                showNotification(`تم الدخول إلى الملف الافتراضي (${defaultDb})`, 'success');
              }
            });
          }
        }}
      />
    );
  }

  // Startup resolution splash loading state
  if (isResolvingStartupDb) {
    return (
      <div
        className="min-h-screen w-full bg-[#182330] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2a3b4c] via-[#1a2533] to-[#0f1722] flex flex-col items-center justify-center p-4 text-slate-100 select-none antialiased"
        dir="rtl"
      >
        <div className="bg-[#223040]/95 border border-slate-600/80 rounded-2xl p-8 max-w-sm w-full flex flex-col items-center text-center shadow-2xl backdrop-blur-md">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg border border-emerald-400/30 mb-4 animate-pulse">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-base font-bold text-white mb-2">نظام إدارة سوق الهال والكمسيون</h2>
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-300 mt-2 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>{startupStatusText}</span>
          </div>
        </div>
      </div>
    );
  }

  // Active or fallback effective PG config
  const activePgConfig = pgConfig || storedConfig || {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '',
    database: 'postgres',
    ssl: false,
  };

  // Gate 3: Database / File selection or creation (Go directly here if no active DB selected)
  const hasActiveDb = Boolean(activePgConfig.database && activePgConfig.database !== 'postgres');
  if (!hasActiveDb) {
    return (
      <DatabaseFilesSetupScreen
        pgConfig={activePgConfig}
        initialDatabases={serverDatabases}
        onSuccess={() => {
          // Success updates pgConfig in AppContext with the selected/created db
        }}
      />
    );
  }

  // Gate 4: All requirements fulfilled -> Enter Main Application
  return <MainContent />;
};

export default function App() {
  return (
    <AppProvider>
      <AppRoot />
      <CustomContextMenu />
    </AppProvider>
  );
}
