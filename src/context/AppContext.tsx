import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Account,
  Category,
  Item,
  Invoice,
  Voucher,
  CompanySettings,
  DatabaseInfo,
  AppView,
  PgConfig,
  PgConnectionStatus,
} from '../types';
import {
  defaultCompanySettings,
  defaultCategories,
  defaultItems,
  defaultAccounts,
  defaultInvoices,
  defaultVouchers,
  defaultDatabases,
  SYSTEM_BASIC_ACCOUNTS,
} from './initialData';
import {
  ensureSystemAccounts,
  isPermanentSystemAccount,
} from '../utils/systemAccounts';
import {
  getStoredPgConfig,
  saveStoredPgConfig,
  isPgFirstTimeSeen,
  pullPgData,
  pushPgData,
  deletePgRecord,
  connectPgDatabase,
  emptyPgDatabase,
  formatDbDisplayName,
} from '../utils/pgClient';

interface PrintConfig {
  type:
    | 'seller_invoice'
    | 'buyer_invoice'
    | 'voucher_payment'
    | 'voucher_receipt'
    | 'account_statement'
    | 'commission_report'
    | 'item_report'
    | 'invoices_report'
    | 'accounts_list'
    | 'items_list';
  data: any;
}

interface AppContextType {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  viewHistory: AppView[];
  goBack: () => void;

  // Company Settings
  settings: CompanySettings;
  updateSettings: (newSettings: CompanySettings) => void;

  // Databases (ملف)
  databases: DatabaseInfo[];
  currentDatabaseId: string;
  currentDatabaseName: string;
  switchDatabase: (id: string) => void;
  createDatabase: (name: string, companyName?: string) => void;
  deleteDatabase: (id: string) => boolean;
  backupDatabase: () => void;
  restoreDatabase: (content: string) => boolean;
  exportBackup: () => string;
  exportSqlBackup: () => string;
  importBackup: (content: string) => boolean;
  emptyDatabase: () => void;
  closeAllWindows: () => void;

  // Accounts (حسابات)
  accounts: Account[];
  addAccount: (account: Omit<Account, 'id'>) => Account;
  updateAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;

  // Categories (أصناف)
  categories: Category[];
  addCategory: (category: Omit<Category, 'id'>) => Category;
  updateCategory: (category: Category) => void;
  deleteCategory: (id: string) => void;
  selectedCategoryId: string | null;
  setSelectedCategoryId: (id: string | null) => void;

  // Items (مواد)
  items: Item[];
  addItem: (item: Omit<Item, 'id'>) => Item;
  updateItem: (item: Item) => void;
  deleteItem: (id: string) => void;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;

  // Invoices (فواتير كمسيون)
  invoices: Invoice[];
  addInvoice: (invoice: Omit<Invoice, 'id'>) => Invoice;
  updateInvoice: (invoice: Invoice) => void;
  deleteInvoice: (id: string) => void;
  selectedInvoiceId: string | null;
  setSelectedInvoiceId: (id: string | null) => void;

  // Vouchers (سندات)
  vouchers: Voucher[];
  addVoucher: (voucher: Omit<Voucher, 'id'>) => Voucher;
  updateVoucher: (voucher: Voucher) => void;
  deleteVoucher: (id: string) => void;
  selectedVoucherId: string | null;
  setSelectedVoucherId: (id: string | null) => void;

  // Printing
  printData: PrintConfig | null;
  triggerPrint: (type: PrintConfig['type'], data: any) => void;
  closePrint: () => void;

  // Invoice Unsaved Changes Guard
  isInvoiceDirty: boolean;
  setIsInvoiceDirty: (dirty: boolean) => void;
  pendingViewChange: AppView | null;
  setPendingViewChange: (view: AppView | null) => void;
  showDiscardInvoiceModal: boolean;
  setShowDiscardInvoiceModal: (show: boolean) => void;
  confirmDiscardInvoice: () => void;
  cancelDiscardInvoice: () => void;

  // Notifications / Alert
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearNotification: () => void;

  // PostgreSQL Database Connection & Sync
  isPgConnected: boolean;
  setIsPgConnected: (connected: boolean) => void;
  pgConfig: PgConfig | null;
  setPgConfigState: (config: PgConfig | null) => void;
  isPgModalOpen: boolean;
  setIsPgModalOpen: (open: boolean) => void;
  isSyncingPg: boolean;
  syncToPostgres: () => Promise<boolean>;
  loadFromPostgres: () => Promise<boolean>;
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  setVouchers: React.Dispatch<React.SetStateAction<Voucher[]>>;
  setSettings: React.Dispatch<React.SetStateAction<CompanySettings>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentViewInternal] = useState<AppView>('home');
  const [viewHistory, setViewHistory] = useState<AppView[]>(['home']);

  const [databases, setDatabases] = useState<DatabaseInfo[]>(() => {
    const saved = localStorage.getItem('commission_databases');
    return saved ? JSON.parse(saved) : defaultDatabases;
  });

  const [currentDatabaseId, setCurrentDatabaseId] = useState<string>(() => {
    return localStorage.getItem('commission_current_db_id') || 'db_main_2026';
  });

  const getDbKey = (key: string, dbId = currentDatabaseId) => `commission_${dbId}_${key}`;

  const safeParseArray = <T,>(jsonString: string | null, fallback: T[]): T[] => {
    if (!jsonString) return fallback;
    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const [settings, setSettings] = useState<CompanySettings>(() => {
    const saved = localStorage.getItem(getDbKey('settings', currentDatabaseId));
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return defaultCompanySettings;
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    return safeParseArray(localStorage.getItem(getDbKey('categories', currentDatabaseId)), defaultCategories);
  });

  const [items, setItems] = useState<Item[]>(() => {
    return safeParseArray(localStorage.getItem(getDbKey('items', currentDatabaseId)), defaultItems);
  });

  const [accounts, setAccounts] = useState<Account[]>(() => {
    const raw = safeParseArray(localStorage.getItem(getDbKey('accounts', currentDatabaseId)), defaultAccounts);
    return ensureSystemAccounts(raw);
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    return safeParseArray(localStorage.getItem(getDbKey('invoices', currentDatabaseId)), defaultInvoices);
  });

  const [vouchers, setVouchers] = useState<Voucher[]>(() => {
    return safeParseArray(localStorage.getItem(getDbKey('vouchers', currentDatabaseId)), defaultVouchers);
  });

  // Selected item IDs for editing
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);

  // Printing state
  const [printData, setPrintData] = useState<PrintConfig | null>(null);

  // Invoice Unsaved Changes Guard state
  const [isInvoiceDirty, setIsInvoiceDirty] = useState<boolean>(false);
  const [pendingViewChange, setPendingViewChange] = useState<AppView | null>(null);
  const [showDiscardInvoiceModal, setShowDiscardInvoiceModal] = useState<boolean>(false);

  // Toast / notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Timestamp of the latest local save to guard against immediate overwrite by pull requests
  const lastSaveTimestampRef = useRef<number>(0);

  // Persistent localStorage auto-sync
  useEffect(() => {
    try {
      localStorage.setItem(getDbKey('items', currentDatabaseId), JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save items to localStorage:', e);
    }
  }, [items, currentDatabaseId]);

  useEffect(() => {
    try {
      localStorage.setItem(getDbKey('categories', currentDatabaseId), JSON.stringify(categories));
    } catch (e) {
      console.error('Failed to save categories to localStorage:', e);
    }
  }, [categories, currentDatabaseId]);

  useEffect(() => {
    try {
      localStorage.setItem(getDbKey('accounts', currentDatabaseId), JSON.stringify(accounts));
    } catch (e) {
      console.error('Failed to save accounts to localStorage:', e);
    }
  }, [accounts, currentDatabaseId]);

  useEffect(() => {
    try {
      localStorage.setItem(getDbKey('invoices', currentDatabaseId), JSON.stringify(invoices));
    } catch (e) {
      console.error('Failed to save invoices to localStorage:', e);
    }
  }, [invoices, currentDatabaseId]);

  useEffect(() => {
    try {
      localStorage.setItem(getDbKey('vouchers', currentDatabaseId), JSON.stringify(vouchers));
    } catch (e) {
      console.error('Failed to save vouchers to localStorage:', e);
    }
  }, [vouchers, currentDatabaseId]);

  useEffect(() => {
    try {
      localStorage.setItem(getDbKey('settings', currentDatabaseId), JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage:', e);
    }
  }, [settings, currentDatabaseId]);

  // PostgreSQL State
  const [pgConfig, setPgConfigState] = useState<PgConfig | null>(() => getStoredPgConfig());
  const [isPgConnected, setIsPgConnected] = useState<boolean>(() => Boolean(getStoredPgConfig()));
  const [isPgModalOpen, setIsPgModalOpen] = useState<boolean>(false);
  const [isSyncingPg, setIsSyncingPg] = useState<boolean>(false);

  // Synchronous refs to guarantee immediate push always has the newest state
  const accountsRef = useRef<Account[]>(accounts);
  const categoriesRef = useRef<Category[]>(categories);
  const itemsRef = useRef<Item[]>(items);
  const invoicesRef = useRef<Invoice[]>(invoices);
  const vouchersRef = useRef<Voucher[]>(vouchers);
  const settingsRef = useRef<CompanySettings>(settings);
  const pgConfigRef = useRef<PgConfig | null>(pgConfig);
  const isPgConnectedRef = useRef<boolean>(isPgConnected);

  accountsRef.current = accounts;
  categoriesRef.current = categories;
  itemsRef.current = items;
  invoicesRef.current = invoices;
  vouchersRef.current = vouchers;
  settingsRef.current = settings;
  pgConfigRef.current = pgConfig;
  isPgConnectedRef.current = isPgConnected;

  // Immediate push helper that bypasses debounce when creating/editing records
  const pushImmediate = useCallback(
    (customPayload?: {
      accounts?: Account[];
      categories?: Category[];
      items?: Item[];
      invoices?: Invoice[];
      vouchers?: Voucher[];
      settings?: CompanySettings;
    }) => {
      lastSaveTimestampRef.current = Date.now();
      if (pgSyncTimeoutRef.current) {
        clearTimeout(pgSyncTimeoutRef.current);
      }

      const activeCfg = pgConfigRef.current || getStoredPgConfig();
      if (!activeCfg || !isPgConnectedRef.current) return;

      const payload = {
        accounts: customPayload?.accounts ?? accountsRef.current,
        categories: customPayload?.categories ?? categoriesRef.current,
        items: customPayload?.items ?? itemsRef.current,
        invoices: customPayload?.invoices ?? invoicesRef.current,
        vouchers: customPayload?.vouchers ?? vouchersRef.current,
        settings: customPayload?.settings ?? settingsRef.current,
      };

      pushPgData(activeCfg, payload).catch((e) => console.warn('Immediate PG push error:', e));
    },
    []
  );

  // Sync current state to PostgreSQL
  const syncToPostgres = useCallback(async (): Promise<boolean> => {
    if (!pgConfig || !isPgConnected) return false;
    setIsSyncingPg(true);
    try {
      const res = await pushPgData(pgConfig, {
        accounts,
        categories,
        items,
        invoices,
        vouchers,
        settings,
      });
      setIsSyncingPg(false);
      return res.success;
    } catch (e) {
      console.error('Failed to sync to PostgreSQL:', e);
      setIsSyncingPg(false);
      return false;
    }
  }, [pgConfig, isPgConnected, accounts, categories, items, invoices, vouchers, settings]);

  // Load state from PostgreSQL with protective merge and freshness checks
  const loadFromPostgres = useCallback(async (): Promise<boolean> => {
    if (!pgConfig) return false;
    // Prevent recent saves (< 4 seconds ago) from being overwritten by in-flight/stale pulls
    if (Date.now() - lastSaveTimestampRef.current < 4000) {
      return false;
    }
    setIsSyncingPg(true);
    try {
      const res = await pullPgData(pgConfig);
      setIsSyncingPg(false);

      if (Date.now() - lastSaveTimestampRef.current < 4000) {
        return false;
      }

      if (res.success && res.data) {
        if (Array.isArray(res.data.items)) {
          setItems(res.data.items);
          try {
            localStorage.setItem(getDbKey('items', currentDatabaseId), JSON.stringify(res.data.items));
          } catch {}
        }

        if (Array.isArray(res.data.categories)) {
          setCategories(res.data.categories);
          try {
            localStorage.setItem(getDbKey('categories', currentDatabaseId), JSON.stringify(res.data.categories));
          } catch {}
        }

        if (Array.isArray(res.data.accounts)) {
          const accs = ensureSystemAccounts(
            res.data.accounts.length > 0 ? res.data.accounts : SYSTEM_BASIC_ACCOUNTS
          );
          setAccounts(accs);
          try {
            localStorage.setItem(getDbKey('accounts', currentDatabaseId), JSON.stringify(accs));
          } catch {}
        }

        if (Array.isArray(res.data.invoices)) {
          setInvoices(res.data.invoices);
          try {
            localStorage.setItem(getDbKey('invoices', currentDatabaseId), JSON.stringify(res.data.invoices));
          } catch {}
        }

        if (Array.isArray(res.data.vouchers)) {
          setVouchers(res.data.vouchers);
          try {
            localStorage.setItem(getDbKey('vouchers', currentDatabaseId), JSON.stringify(res.data.vouchers));
          } catch {}
        }

        if (res.data.settings) {
          setSettings(res.data.settings);
          try {
            localStorage.setItem(getDbKey('settings', currentDatabaseId), JSON.stringify(res.data.settings));
          } catch {}
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to load from PostgreSQL:', e);
      setIsSyncingPg(false);
      return false;
    }
  }, [pgConfig]);

  // Auto-connect on startup if config is stored and load live PG data
  useEffect(() => {
    const stored = getStoredPgConfig();
    if (stored && stored.host && stored.database) {
      connectPgDatabase(stored)
        .then(async (res) => {
          if (res.success) {
            setIsPgConnected(true);
            setPgConfigState(stored);
            const pullRes = await pullPgData(stored);
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
          } else {
            setIsPgConnected(false);
          }
        })
        .catch(() => {
          setIsPgConnected(false);
        });
    }
  }, []);

  // 1. Window Focus Auto-Fetch (When tab gets focus, pull fresh PG data)
  useEffect(() => {
    const handleFocus = () => {
      if (pgConfig && isPgConnected) {
        loadFromPostgres();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [pgConfig, isPgConnected, loadFromPostgres]);

  // 2. Periodic Live Background Poll (Every 10 seconds, auto-sync multi-device changes)
  useEffect(() => {
    if (!pgConfig || !isPgConnected) return;

    const interval = setInterval(() => {
      loadFromPostgres();
    }, 10000);

    return () => clearInterval(interval);
  }, [pgConfig, isPgConnected, loadFromPostgres]);

  // Debounced auto-sync to PostgreSQL when data changes and is connected
  const pgSyncTimeoutRef = useRef<any>(null);
  useEffect(() => {
    if (!isPgConnected || !pgConfig) return;
    if (pgSyncTimeoutRef.current) {
      clearTimeout(pgSyncTimeoutRef.current);
    }
    pgSyncTimeoutRef.current = setTimeout(() => {
      pushPgData(pgConfig, {
        accounts,
        categories,
        items,
        invoices,
        vouchers,
        settings,
      }).catch((e) => console.warn('Auto PG sync error:', e));
    }, 2000);

    return () => {
      if (pgSyncTimeoutRef.current) clearTimeout(pgSyncTimeoutRef.current);
    };
  }, [isPgConnected, pgConfig, accounts, categories, items, invoices, vouchers, settings]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const clearNotification = () => setNotification(null);

  const setCurrentView = (view: AppView, force = false) => {
    if (view === currentView) return;

    // If leaving commission invoice with unsaved changes, prompt confirmation
    if (!force && currentView === 'commission_invoice' && view !== 'commission_invoice' && isInvoiceDirty) {
      setPendingViewChange(view);
      setShowDiscardInvoiceModal(true);
      return;
    }

    if (currentView === 'commission_invoice' && view !== 'commission_invoice') {
      setIsInvoiceDirty(false);
    }

    setViewHistory((prev) => [...prev, view]);
    setCurrentViewInternal(view);
  };

  const confirmDiscardInvoice = () => {
    const target = pendingViewChange || 'home';
    setShowDiscardInvoiceModal(false);
    setPendingViewChange(null);
    setIsInvoiceDirty(false);

    if (target === 'account_card') setSelectedAccountId(null);
    if (target === 'category_card') setSelectedCategoryId(null);
    if (target === 'item_card') setSelectedItemId(null);
    if (target === 'commission_invoice') setSelectedInvoiceId(null);
    if (target === 'voucher_payment' || target === 'voucher_receipt') setSelectedVoucherId(null);

    setViewHistory((prev) => [...prev, target]);
    setCurrentViewInternal(target);
  };

  const cancelDiscardInvoice = () => {
    setShowDiscardInvoiceModal(false);
    setPendingViewChange(null);
  };

  const goBack = () => {
    if (viewHistory.length > 1) {
      const newHistory = [...viewHistory];
      newHistory.pop(); // current
      const previous = newHistory[newHistory.length - 1];
      setViewHistory(newHistory);
      setCurrentViewInternal(previous);
    } else {
      setCurrentViewInternal('home');
    }
  };

  useEffect(() => {
    localStorage.setItem('commission_databases', JSON.stringify(databases));
  }, [databases]);

  useEffect(() => {
    localStorage.setItem('commission_current_db_id', currentDatabaseId);
  }, [currentDatabaseId]);

  const closeAllWindows = () => {
    setSelectedAccountId(null);
    setSelectedCategoryId(null);
    setSelectedItemId(null);
    setSelectedInvoiceId(null);
    setSelectedVoucherId(null);
    setCurrentViewInternal('home');
    setViewHistory(['home']);
  };

  const currentDatabaseName =
    formatDbDisplayName(pgConfig?.database) ||
    databases.find((d) => d.id === currentDatabaseId)?.name ||
    'قاعدة البيانات الرئيسية';

  // Load database when database ID changes
  const switchDatabase = (dbId: string) => {
    setCurrentDatabaseId(dbId);
    
    // Close all open windows and selections
    setSelectedAccountId(null);
    setSelectedCategoryId(null);
    setSelectedItemId(null);
    setSelectedInvoiceId(null);
    setSelectedVoucherId(null);
    setCurrentViewInternal('home');
    setViewHistory(['home']);

    const savedSettings = localStorage.getItem(getDbKey('settings', dbId));
    let parsedSettings = defaultCompanySettings;
    if (savedSettings) {
      try {
        parsedSettings = JSON.parse(savedSettings);
      } catch {
        parsedSettings = defaultCompanySettings;
      }
    }
    setSettings(parsedSettings);

    const savedCategories = safeParseArray(localStorage.getItem(getDbKey('categories', dbId)), defaultCategories);
    setCategories(savedCategories);

    const savedItems = safeParseArray(localStorage.getItem(getDbKey('items', dbId)), defaultItems);
    setItems(savedItems);

    const rawAccounts = safeParseArray(localStorage.getItem(getDbKey('accounts', dbId)), defaultAccounts);
    setAccounts(ensureSystemAccounts(rawAccounts));

    const savedInvoices = safeParseArray(localStorage.getItem(getDbKey('invoices', dbId)), defaultInvoices);
    setInvoices(savedInvoices);

    const savedVouchers = safeParseArray(localStorage.getItem(getDbKey('vouchers', dbId)), defaultVouchers);
    setVouchers(savedVouchers);

    const dbObj = databases.find((d) => d.id === dbId);
    showNotification(`تم فتح الملف (${dbObj?.name || 'قاعدة البيانات'}) وإغلاق كافة النوافذ السابقة بنجاح`, 'success');
  };

  const createDatabase = (name: string, companyName?: string) => {
    const newId = `db_${Date.now()}`;
    const newDb: DatabaseInfo = {
      id: newId,
      name,
      companyName: companyName || name,
      createdAt: new Date().toISOString().split('T')[0],
      lastModified: new Date().toISOString().split('T')[0],
    };

    // System accounts initialized with zero opening balance
    const initialSystemAccounts = SYSTEM_BASIC_ACCOUNTS.map((acc) => ({
      ...acc,
      openingDebit: 0,
      openingCredit: 0,
      currentBalance: 0,
    }));

    // Save clean initial state for new DB
    localStorage.setItem(getDbKey('settings', newId), JSON.stringify({ ...defaultCompanySettings, companyName: companyName || name }));
    localStorage.setItem(getDbKey('categories', newId), JSON.stringify([]));
    localStorage.setItem(getDbKey('items', newId), JSON.stringify([]));
    localStorage.setItem(getDbKey('accounts', newId), JSON.stringify(initialSystemAccounts));
    localStorage.setItem(getDbKey('invoices', newId), JSON.stringify([]));
    localStorage.setItem(getDbKey('vouchers', newId), JSON.stringify([]));

    setDatabases((prev) => [...prev, newDb]);
    
    // Switch to the newly created DB and close all previous windows
    setCurrentDatabaseId(newId);
    setSettings({ ...defaultCompanySettings, companyName: companyName || name });
    setCategories([]);
    setItems([]);
    setAccounts(initialSystemAccounts);
    setInvoices([]);
    setVouchers([]);
    setSelectedAccountId(null);
    setSelectedCategoryId(null);
    setSelectedItemId(null);
    setSelectedInvoiceId(null);
    setSelectedVoucherId(null);
    setCurrentViewInternal('home');
    setViewHistory(['home']);

    showNotification(`تم إنشاء الملف الجديد (${name}) بنجاح وإغلاق كافة النوافذ السابقة`, 'success');
  };

  const deleteDatabase = (dbId: string): boolean => {
    if (databases.length <= 1) {
      showNotification('لا يمكن حذف قاعدة البيانات الوحيدة المتبقية في النظام. يجب توفر قاعدة بيانات واحدة على الأقل.', 'error');
      return false;
    }

    const targetDb = databases.find((d) => d.id === dbId);
    if (!targetDb) return false;

    // Remove associated database records from localStorage
    localStorage.removeItem(getDbKey('settings', dbId));
    localStorage.removeItem(getDbKey('categories', dbId));
    localStorage.removeItem(getDbKey('items', dbId));
    localStorage.removeItem(getDbKey('accounts', dbId));
    localStorage.removeItem(getDbKey('invoices', dbId));
    localStorage.removeItem(getDbKey('vouchers', dbId));

    const remainingDatabases = databases.filter((d) => d.id !== dbId);
    setDatabases(remainingDatabases);

    // If deleting the currently active database, switch to the first remaining one
    if (dbId === currentDatabaseId) {
      const nextDb = remainingDatabases[0];
      switchDatabase(nextDb.id);
      showNotification(`تم حذف قاعدة البيانات (${targetDb.name}) وتم التبديل تلقائياً إلى (${nextDb.name})`, 'info');
    } else {
      showNotification(`تم حذف قاعدة البيانات (${targetDb.name}) بنجاح`, 'info');
    }

    return true;
  };

  const exportBackup = (): string => {
    const currentDb = databases.find((d) => d.id === currentDatabaseId);
    const backupObj = {
      exportVersion: '3.0',
      exportDate: new Date().toISOString(),
      databaseInfo: currentDb || { id: currentDatabaseId, name: currentDatabaseName },
      settings,
      categories,
      items,
      accounts,
      invoices,
      vouchers,
    };
    return JSON.stringify(backupObj, null, 2);
  };

  const exportSqlBackup = (): string => {
    const currentDb = databases.find((d) => d.id === currentDatabaseId);
    const dbName = currentDb?.name || currentDatabaseName || 'commission_db';
    const backupObj = {
      exportVersion: '3.0',
      exportDate: new Date().toISOString(),
      databaseInfo: currentDb || { id: currentDatabaseId, name: currentDatabaseName },
      settings,
      categories,
      items,
      accounts,
      invoices,
      vouchers,
    };

    const jsonStr = JSON.stringify(backupObj);

    const escapeSql = (val: any) => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'number') return isNaN(val) ? '0' : val.toString();
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    let sql = `-- PostgreSQL Database Dump Export for Commission System\n`;
    sql += `-- Database: ${dbName}\n`;
    sql += `-- Export Date: ${new Date().toISOString()}\n\n`;
    sql += `-- COMMISSION_POSTGRES_SQL_DUMP_START\n`;
    sql += `-- ${jsonStr}\n`;
    sql += `-- COMMISSION_POSTGRES_SQL_DUMP_END\n\n`;

    sql += `BEGIN;\n\n`;

    // 1. company_settings
    sql += `-- 1. Table: company_settings\n`;
    sql += `CREATE TABLE IF NOT EXISTS company_settings (\n`;
    sql += `  id VARCHAR(50) PRIMARY KEY,\n`;
    sql += `  company_name VARCHAR(255) DEFAULT '',\n`;
    sql += `  address TEXT DEFAULT '',\n`;
    sql += `  license VARCHAR(100) DEFAULT '',\n`;
    sql += `  first_name VARCHAR(100) DEFAULT '',\n`;
    sql += `  first_phone VARCHAR(50) DEFAULT '',\n`;
    sql += `  second_name VARCHAR(100) DEFAULT '',\n`;
    sql += `  second_phone VARCHAR(50) DEFAULT '',\n`;
    sql += `  show_item_code BOOLEAN DEFAULT false,\n`;
    sql += `  show_account_code BOOLEAN DEFAULT true,\n`;
    sql += `  show_tafqeet BOOLEAN DEFAULT false,\n`;
    sql += `  seller_invoice_page_size VARCHAR(20) DEFAULT 'A5',\n`;
    sql += `  buyer_invoice_page_size VARCHAR(20) DEFAULT 'A5',\n`;
    sql += `  voucher_page_size VARCHAR(20) DEFAULT 'A4',\n`;
    sql += `  report_page_size VARCHAR(20) DEFAULT 'A4',\n`;
    sql += `  print_header_font_size INT DEFAULT 11,\n`;
    sql += `  print_body_font_size INT DEFAULT 11,\n`;
    sql += `  print_summary_font_size INT DEFAULT 11,\n`;
    sql += `  thousands_separator VARCHAR(5) DEFAULT ',',\n`;
    sql += `  currency VARCHAR(50) DEFAULT 'ل.س',\n`;
    sql += `  default_commission_rate NUMERIC(10,2) DEFAULT 5,\n`;
    sql += `  default_discount_tare NUMERIC(10,2) DEFAULT 0,\n`;
    sql += `  footer_note TEXT DEFAULT 'شكراً لتعاملكم معنا',\n`;
    sql += `  commission_rounding_direction VARCHAR(20) DEFAULT 'none',\n`;
    sql += `  commission_rounding_value NUMERIC(10,2) DEFAULT 50,\n`;
    sql += `  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
    sql += `);\n`;
    sql += `INSERT INTO company_settings (id, company_name, address, license, first_name, first_phone, second_name, second_phone, show_item_code, show_account_code, show_tafqeet, seller_invoice_page_size, buyer_invoice_page_size, voucher_page_size, report_page_size, print_header_font_size, print_body_font_size, print_summary_font_size, thousands_separator, currency, default_commission_rate, default_discount_tare, footer_note, commission_rounding_direction, commission_rounding_value)\n`;
    sql += `VALUES ('main', ${escapeSql(settings.companyName)}, ${escapeSql(settings.address)}, ${escapeSql(settings.license)}, ${escapeSql(settings.firstName)}, ${escapeSql(settings.firstPhone)}, ${escapeSql(settings.secondName)}, ${escapeSql(settings.secondPhone)}, ${escapeSql(settings.showItemCode)}, ${escapeSql(settings.showAccountCode)}, ${escapeSql(settings.showTafqeet)}, ${escapeSql(settings.sellerInvoicePageSize || 'A5')}, ${escapeSql(settings.buyerInvoicePageSize || 'A5')}, ${escapeSql(settings.voucherPageSize || 'A4')}, ${escapeSql(settings.reportPageSize || 'A4')}, ${escapeSql(settings.printHeaderFontSize ?? 11)}, ${escapeSql(settings.printBodyFontSize ?? 11)}, ${escapeSql(settings.printSummaryFontSize ?? 11)}, ${escapeSql(settings.thousandsSeparator ?? ',')}, ${escapeSql(settings.currency || 'ل.س')}, ${escapeSql(settings.defaultCommissionRate ?? 5)}, ${escapeSql(settings.defaultDiscountTare ?? 0)}, ${escapeSql(settings.footerNote || '')}, ${escapeSql(settings.commissionRoundingDirection || 'none')}, ${escapeSql(settings.commissionRoundingValue ?? 50)})\n`;
    sql += `ON CONFLICT (id) DO UPDATE SET company_name = EXCLUDED.company_name, address = EXCLUDED.address, updated_at = CURRENT_TIMESTAMP;\n\n`;

    // 2. accounts
    sql += `-- 2. Table: accounts\n`;
    sql += `CREATE TABLE IF NOT EXISTS accounts (\n`;
    sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
    sql += `  code VARCHAR(50) NOT NULL UNIQUE,\n`;
    sql += `  name VARCHAR(255) NOT NULL,\n`;
    sql += `  parent_account VARCHAR(255) DEFAULT '',\n`;
    sql += `  governorate VARCHAR(100) DEFAULT '',\n`;
    sql += `  city VARCHAR(100) DEFAULT '',\n`;
    sql += `  address TEXT DEFAULT '',\n`;
    sql += `  phone VARCHAR(50) DEFAULT '',\n`;
    sql += `  notes TEXT DEFAULT '',\n`;
    sql += `  opening_debit NUMERIC(15,2) DEFAULT 0,\n`;
    sql += `  opening_credit NUMERIC(15,2) DEFAULT 0,\n`;
    sql += `  current_balance NUMERIC(15,2) DEFAULT 0,\n`;
    sql += `  is_system BOOLEAN DEFAULT false,\n`;
    sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
    sql += `);\n`;
    (accounts || []).forEach((acc) => {
      sql += `INSERT INTO accounts (id, code, name, parent_account, governorate, city, address, phone, notes, opening_debit, opening_credit, current_balance, is_system)\n`;
      sql += `VALUES (${escapeSql(acc.id)}, ${escapeSql(acc.code)}, ${escapeSql(acc.name)}, ${escapeSql(acc.parentAccount)}, ${escapeSql(acc.governorate)}, ${escapeSql(acc.city)}, ${escapeSql(acc.address)}, ${escapeSql(acc.phone)}, ${escapeSql(acc.notes)}, ${escapeSql(acc.openingDebit || 0)}, ${escapeSql(acc.openingCredit || 0)}, ${escapeSql(acc.currentBalance || 0)}, ${escapeSql(acc.isSystem)})\n`;
      sql += `ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, current_balance = EXCLUDED.current_balance;\n`;
    });
    sql += `\n`;

    // 3. categories
    sql += `-- 3. Table: categories\n`;
    sql += `CREATE TABLE IF NOT EXISTS categories (\n`;
    sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
    sql += `  code VARCHAR(50) NOT NULL UNIQUE,\n`;
    sql += `  name VARCHAR(255) NOT NULL UNIQUE,\n`;
    sql += `  notes TEXT DEFAULT '',\n`;
    sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
    sql += `);\n`;
    (categories || []).forEach((cat) => {
      sql += `INSERT INTO categories (id, code, name, notes)\n`;
      sql += `VALUES (${escapeSql(cat.id)}, ${escapeSql(cat.code)}, ${escapeSql(cat.name)}, ${escapeSql(cat.notes)})\n`;
      sql += `ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;\n`;
    });
    sql += `\n`;

    // 4. items
    sql += `-- 4. Table: items\n`;
    sql += `CREATE TABLE IF NOT EXISTS items (\n`;
    sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
    sql += `  code VARCHAR(50) NOT NULL UNIQUE,\n`;
    sql += `  name VARCHAR(255) NOT NULL UNIQUE,\n`;
    sql += `  unit VARCHAR(50) DEFAULT 'كغ',\n`;
    sql += `  category VARCHAR(255) NOT NULL,\n`;
    sql += `  notes TEXT DEFAULT '',\n`;
    sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
    sql += `);\n`;
    (items || []).forEach((item) => {
      sql += `INSERT INTO items (id, code, name, unit, category, notes)\n`;
      sql += `VALUES (${escapeSql(item.id)}, ${escapeSql(item.code)}, ${escapeSql(item.name)}, ${escapeSql(item.unit)}, ${escapeSql(item.category)}, ${escapeSql(item.notes)})\n`;
      sql += `ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit;\n`;
    });
    sql += `\n`;

    // 5. invoices & invoice_items
    sql += `-- 5. Table: invoices\n`;
    sql += `CREATE TABLE IF NOT EXISTS invoices (\n`;
    sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
    sql += `  invoice_number VARCHAR(50) NOT NULL,\n`;
    sql += `  date VARCHAR(50) NOT NULL,\n`;
    sql += `  seller_id VARCHAR(255) DEFAULT '',\n`;
    sql += `  seller_name VARCHAR(255) NOT NULL,\n`;
    sql += `  seller_payment_type VARCHAR(50) DEFAULT 'نقدي',\n`;
    sql += `  seller_notes TEXT DEFAULT '',\n`;
    sql += `  buyer_id VARCHAR(255) DEFAULT '',\n`;
    sql += `  buyer_name VARCHAR(255) NOT NULL,\n`;
    sql += `  buyer_payment_type VARCHAR(50) DEFAULT 'نقدي',\n`;
    sql += `  buyer_notes TEXT DEFAULT '',\n`;
    sql += `  total_amount NUMERIC(15,2) DEFAULT 0,\n`;
    sql += `  commission_rate NUMERIC(10,2) DEFAULT 5,\n`;
    sql += `  commission_value NUMERIC(15,2) DEFAULT 0,\n`;
    sql += `  net_amount NUMERIC(15,2) DEFAULT 0,\n`;
    sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
    sql += `);\n`;

    sql += `-- 6. Table: invoice_items\n`;
    sql += `CREATE TABLE IF NOT EXISTS invoice_items (\n`;
    sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
    sql += `  invoice_id VARCHAR(255) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,\n`;
    sql += `  row_number INT NOT NULL,\n`;
    sql += `  item_id VARCHAR(255) DEFAULT '',\n`;
    sql += `  item_name VARCHAR(255) NOT NULL,\n`;
    sql += `  unit VARCHAR(50) DEFAULT 'كغ',\n`;
    sql += `  gross_weight NUMERIC(12,2) DEFAULT 0,\n`;
    sql += `  discount_tare NUMERIC(12,2) DEFAULT 0,\n`;
    sql += `  discount_percent NUMERIC(10,2) DEFAULT 0,\n`;
    sql += `  net_weight NUMERIC(12,2) DEFAULT 0,\n`;
    sql += `  unit_price NUMERIC(12,2) DEFAULT 0,\n`;
    sql += `  total NUMERIC(15,2) DEFAULT 0,\n`;
    sql += `  notes TEXT DEFAULT ''\n`;
    sql += `);\n`;

    (invoices || []).forEach((inv) => {
      sql += `INSERT INTO invoices (id, invoice_number, date, seller_id, seller_name, seller_payment_type, seller_notes, buyer_id, buyer_name, buyer_payment_type, buyer_notes, total_amount, commission_rate, commission_value, net_amount)\n`;
      sql += `VALUES (${escapeSql(inv.id)}, ${escapeSql(inv.invoiceNumber)}, ${escapeSql(inv.date)}, ${escapeSql(inv.sellerId)}, ${escapeSql(inv.sellerName)}, ${escapeSql(inv.sellerPaymentType)}, ${escapeSql(inv.sellerNotes)}, ${escapeSql(inv.buyerId)}, ${escapeSql(inv.buyerName)}, ${escapeSql(inv.buyerPaymentType)}, ${escapeSql(inv.buyerNotes)}, ${escapeSql(inv.totalAmount)}, ${escapeSql(inv.commissionRate)}, ${escapeSql(inv.commissionValue)}, ${escapeSql(inv.netAmount)})\n`;
      sql += `ON CONFLICT (id) DO UPDATE SET total_amount = EXCLUDED.total_amount, net_amount = EXCLUDED.net_amount;\n`;

      (inv.rows || []).forEach((r) => {
        sql += `INSERT INTO invoice_items (id, invoice_id, row_number, item_id, item_name, unit, gross_weight, discount_tare, discount_percent, net_weight, unit_price, total, notes)\n`;
        sql += `VALUES (${escapeSql(r.id)}, ${escapeSql(inv.id)}, ${escapeSql(r.rowNumber)}, ${escapeSql(r.itemId)}, ${escapeSql(r.itemName)}, ${escapeSql(r.unit)}, ${escapeSql(r.grossWeight)}, ${escapeSql(r.discountTare)}, ${escapeSql(r.discountPercent || 0)}, ${escapeSql(r.netWeight)}, ${escapeSql(r.unitPrice)}, ${escapeSql(r.total)}, ${escapeSql(r.notes)});\n`;
      });
    });
    sql += `\n`;

    // 7. vouchers & voucher_rows
    sql += `-- 7. Table: vouchers\n`;
    sql += `CREATE TABLE IF NOT EXISTS vouchers (\n`;
    sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
    sql += `  voucher_number VARCHAR(50) NOT NULL,\n`;
    sql += `  type VARCHAR(50) NOT NULL,\n`;
    sql += `  main_account_code VARCHAR(50) NOT NULL,\n`;
    sql += `  main_account_name VARCHAR(255) NOT NULL,\n`;
    sql += `  currency VARCHAR(50) DEFAULT 'ل.س',\n`;
    sql += `  date VARCHAR(50) NOT NULL,\n`;
    sql += `  notes TEXT DEFAULT '',\n`;
    sql += `  total_amount NUMERIC(15,2) DEFAULT 0,\n`;
    sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
    sql += `);\n`;

    sql += `-- 8. Table: voucher_rows\n`;
    sql += `CREATE TABLE IF NOT EXISTS voucher_rows (\n`;
    sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
    sql += `  voucher_id VARCHAR(255) NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,\n`;
    sql += `  row_number INT NOT NULL,\n`;
    sql += `  amount NUMERIC(15,2) DEFAULT 0,\n`;
    sql += `  account_code VARCHAR(50) NOT NULL,\n`;
    sql += `  account_name VARCHAR(255) NOT NULL,\n`;
    sql += `  notes TEXT DEFAULT ''\n`;
    sql += `);\n`;

    (vouchers || []).forEach((v) => {
      sql += `INSERT INTO vouchers (id, voucher_number, type, main_account_code, main_account_name, currency, date, notes, total_amount)\n`;
      sql += `VALUES (${escapeSql(v.id)}, ${escapeSql(v.voucherNumber)}, ${escapeSql(v.type)}, ${escapeSql(v.mainAccountCode)}, ${escapeSql(v.mainAccountName)}, ${escapeSql(v.currency)}, ${escapeSql(v.date)}, ${escapeSql(v.notes)}, ${escapeSql(v.totalAmount)})\n`;
      sql += `ON CONFLICT (id) DO UPDATE SET total_amount = EXCLUDED.total_amount;\n`;

      (v.rows || []).forEach((r) => {
        sql += `INSERT INTO voucher_rows (id, voucher_id, row_number, amount, account_code, account_name, notes)\n`;
        sql += `VALUES (${escapeSql(r.id)}, ${escapeSql(v.id)}, ${escapeSql(r.rowNumber)}, ${escapeSql(r.amount)}, ${escapeSql(r.accountCode)}, ${escapeSql(r.accountName)}, ${escapeSql(r.notes)});\n`;
      });
    });
    sql += `\n`;

    sql += `COMMIT;\n`;

    return sql;
  };

  const backupDatabase = async () => {
    // Pull fresh PostgreSQL data first if connected
    if (pgConfig) {
      await loadFromPostgres();
    }
    const currentDb = databases.find((d) => d.id === currentDatabaseId);
    const sqlContent = exportSqlBackup();

    const dataStr = 'data:text/sql;charset=utf-8,' + encodeURIComponent(sqlContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `commission_backup_${currentDb?.name || currentDatabaseName || 'database'}_${new Date().toISOString().split('T')[0]}.sql`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showNotification('تم أخذ النسخة الاحتياطية وتصديرها بصيغة PostgreSQL SQL بنجاح', 'success');
  };

  const restoreDatabase = (fileContent: string): boolean => {
    try {
      let rawJson = fileContent;
      if (fileContent.includes('COMMISSION_POSTGRES_SQL_DUMP_START')) {
        const parts = fileContent.split('COMMISSION_POSTGRES_SQL_DUMP_START');
        if (parts.length > 1) {
          const subParts = parts[1].split('COMMISSION_POSTGRES_SQL_DUMP_END');
          if (subParts.length > 0) {
            rawJson = subParts[0].replace(/^--\s*/gm, '').trim();
          }
        }
      }

      const data = JSON.parse(rawJson);
      let newSettings = settings;
      let newCategories = categories;
      let newItems = items;
      let newAccounts = accounts;
      let newInvoices = invoices;
      let newVouchers = vouchers;

      if (data.settings) {
        const { showOppositeAccount, phone, ownerName, ...cleanSettings } = data.settings;
        newSettings = { ...defaultCompanySettings, ...cleanSettings };
        setSettings(newSettings);
      }
      if (Array.isArray(data.categories)) {
        newCategories = data.categories;
        setCategories(newCategories);
      }
      if (Array.isArray(data.items)) {
        newItems = data.items;
        setItems(newItems);
      }
      if (Array.isArray(data.accounts)) {
        newAccounts = ensureSystemAccounts(data.accounts);
        setAccounts(newAccounts);
      }
      if (Array.isArray(data.invoices)) {
        newInvoices = data.invoices.map((inv: any) => {
          const { status, ...cleanInv } = inv;
          return cleanInv;
        });
        setInvoices(newInvoices);
      }
      if (Array.isArray(data.vouchers)) {
        newVouchers = data.vouchers;
        setVouchers(newVouchers);
      }

      // Synchronize restored dataset to PostgreSQL database engine
      if (pgConfig) {
        pushPgData(pgConfig, {
          accounts: newAccounts,
          categories: newCategories,
          items: newItems,
          invoices: newInvoices,
          vouchers: newVouchers,
          settings: newSettings,
        }).then((res) => {
          if (res.success) {
            loadFromPostgres();
          }
        });
      }

      closeAllWindows();
      showNotification('تم استعادة النسخة الاحتياطية وحفظها في قاعدة البيانات بنجاح', 'success');
      return true;
    } catch (err) {
      console.error('Failed to restore backup', err);
      showNotification('فشل استعادة النسخة الاحتياطية: الملف غير صالح', 'error');
      return false;
    }
  };

  const importBackup = (jsonContent: string): boolean => {
    return restoreDatabase(jsonContent);
  };

  const emptyDatabase = async () => {
    const cleanSystemAccounts = SYSTEM_BASIC_ACCOUNTS.map((acc) => ({
      ...acc,
      openingDebit: 0,
      openingCredit: 0,
      currentBalance: 0,
    }));

    setInvoices([]);
    setVouchers([]);
    setItems([]);
    setCategories([]);
    setAccounts(cleanSystemAccounts);

    if (pgConfig && pgConfig.database) {
      try {
        await emptyPgDatabase(pgConfig);
      } catch (err) {
        console.error('Failed to empty PostgreSQL database via API:', err);
      }
      pushPgData(pgConfig, {
        accounts: cleanSystemAccounts,
        categories: [],
        items: [],
        invoices: [],
        vouchers: [],
        settings,
      });
    }

    closeAllWindows();
    showNotification(
      'تم تفريغ كافة العمليات والسجلات من قاعدة البيانات المفتوحة والعودة للحسابات الافتراضية الخمسة فقط بنجاح',
      'success'
    );
  };

  // Account operations
  const addAccount = (accountData: Omit<Account, 'id'>): Account => {
    const isSys = isPermanentSystemAccount(accountData);
    const newAccount: Account = {
      ...accountData,
      id: isSys ? `sys_${accountData.code}` : String(Date.now()),
      isSystem: isSys ? true : undefined,
      currentBalance: (Number(accountData.openingDebit) || 0) - (Number(accountData.openingCredit) || 0),
    };
    const updated = [...accounts, newAccount];
    accountsRef.current = updated;
    setAccounts(updated);
    try {
      localStorage.setItem(getDbKey('accounts', currentDatabaseId), JSON.stringify(updated));
    } catch {}
    pushImmediate({ accounts: updated });
    showNotification(`تمت إضافة الحساب (${newAccount.name}) بنجاح`);
    return newAccount;
  };

  const updateAccount = (account: Account) => {
    const isSys = isPermanentSystemAccount(account);
    const updatedAccount = {
      ...account,
      isSystem: isSys ? true : account.isSystem,
    };
    const updated = accounts.map((a) => (a.id === account.id ? updatedAccount : a));
    accountsRef.current = updated;
    setAccounts(updated);
    try {
      localStorage.setItem(getDbKey('accounts', currentDatabaseId), JSON.stringify(updated));
    } catch {}
    pushImmediate({ accounts: updated });
    showNotification(`تم تعديل الحساب (${account.name}) بنجاح`);
  };

  const deleteAccount = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    if (isPermanentSystemAccount(acc)) {
      showNotification(
        `الحساب "${acc?.name || id}" هو حساب أساسي في النظام (رمز ${acc?.code || ''}) وغير قابل للحذف نهائياً.`,
        'error'
      );
      return;
    }
    const updated = accounts.filter((a) => a.id !== id);
    accountsRef.current = updated;
    setAccounts(updated);
    try {
      localStorage.setItem(getDbKey('accounts', currentDatabaseId), JSON.stringify(updated));
    } catch {}

    const activeCfg = pgConfigRef.current || getStoredPgConfig();
    if (activeCfg && isPgConnectedRef.current && acc) {
      deletePgRecord(activeCfg, { entityType: 'account', id: acc.id, code: acc.code });
    }
    pushImmediate({ accounts: updated });
    showNotification(`تم حذف الحساب (${acc?.name || ''}) بنجاح`, 'info');
  };

  // Category operations
  const addCategory = (catData: Omit<Category, 'id'>): Category => {
    const newCat: Category = {
      ...catData,
      id: String(Date.now()),
    };
    const updated = [...categories, newCat];
    categoriesRef.current = updated;
    setCategories(updated);
    try {
      localStorage.setItem(getDbKey('categories', currentDatabaseId), JSON.stringify(updated));
    } catch {}
    pushImmediate({ categories: updated });
    showNotification(`تمت إضافة الصنف (${newCat.name}) بنجاح`);
    return newCat;
  };

  const updateCategory = (category: Category) => {
    const updated = categories.map((c) => (c.id === category.id ? category : c));
    categoriesRef.current = updated;
    setCategories(updated);
    try {
      localStorage.setItem(getDbKey('categories', currentDatabaseId), JSON.stringify(updated));
    } catch {}
    pushImmediate({ categories: updated });
    showNotification(`تم تعديل الصنف (${category.name}) بنجاح`);
  };

  const deleteCategory = (id: string): boolean => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return false;

    // Check if any items belong to this category
    const linkedItems = items.filter(
      (item) => item.category && item.category.trim().toLowerCase() === cat.name.trim().toLowerCase()
    );

    if (linkedItems.length > 0) {
      showNotification(
        `يمنع حذف الصنف "${cat.name}" لوجود (${linkedItems.length}) مواد مسجلة تتبع له! يرجى حذف أو نقل المواد أولاً.`,
        'error'
      );
      return false;
    }

    const updated = categories.filter((c) => c.id !== id);
    categoriesRef.current = updated;
    setCategories(updated);
    try {
      localStorage.setItem(getDbKey('categories', currentDatabaseId), JSON.stringify(updated));
    } catch {}

    const activeCfg = pgConfigRef.current || getStoredPgConfig();
    if (activeCfg && isPgConnectedRef.current && cat) {
      deletePgRecord(activeCfg, { entityType: 'category', id: cat.id, code: cat.code });
    }
    pushImmediate({ categories: updated });
    showNotification(`تم حذف الصنف (${cat.name}) بنجاح`, 'info');
    return true;
  };

  // Item operations
  const addItem = (itemData: Omit<Item, 'id'>): Item => {
    const newItem: Item = {
      ...itemData,
      id: String(Date.now()),
    };
    const updated = [...items, newItem];
    itemsRef.current = updated;
    setItems(updated);
    try {
      localStorage.setItem(getDbKey('items', currentDatabaseId), JSON.stringify(updated));
    } catch {}
    pushImmediate({ items: updated });
    showNotification(`تمت إضافة المادة (${newItem.name}) بنجاح`);
    return newItem;
  };

  const updateItem = (item: Item) => {
    const updated = items.map((i) => (i.id === item.id ? item : i));
    itemsRef.current = updated;
    setItems(updated);
    try {
      localStorage.setItem(getDbKey('items', currentDatabaseId), JSON.stringify(updated));
    } catch {}
    pushImmediate({ items: updated });
    showNotification(`تم تعديل المادة (${item.name}) بنجاح`);
  };

  const deleteItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    const updated = items.filter((i) => i.id !== id);
    itemsRef.current = updated;
    setItems(updated);
    try {
      localStorage.setItem(getDbKey('items', currentDatabaseId), JSON.stringify(updated));
    } catch {}

    const activeCfg = pgConfigRef.current || getStoredPgConfig();
    if (activeCfg && isPgConnectedRef.current && item) {
      deletePgRecord(activeCfg, { entityType: 'item', id: item.id, code: item.code });
    }
    pushImmediate({ items: updated });
    showNotification(`تم حذف المادة (${item?.name || ''}) بنجاح`, 'info');
  };

  // Invoice operations
  const addInvoice = (invData: Omit<Invoice, 'id'>): Invoice => {
    const newInvoice: Invoice = {
      ...invData,
      id: String(Date.now()),
    };
    const updated = [newInvoice, ...invoices];
    invoicesRef.current = updated;
    setInvoices(updated);
    try {
      localStorage.setItem(getDbKey('invoices', currentDatabaseId), JSON.stringify(updated));
    } catch {}
    pushImmediate({ invoices: updated });
    showNotification(`تم حفظ فاتورة الكمسيون رقم ${newInvoice.invoiceNumber} بنجاح`);
    return newInvoice;
  };

  const updateInvoice = (invoice: Invoice) => {
    const updated = invoices.map((inv) => (inv.id === invoice.id ? invoice : inv));
    invoicesRef.current = updated;
    setInvoices(updated);
    try {
      localStorage.setItem(getDbKey('invoices', currentDatabaseId), JSON.stringify(updated));
    } catch {}
    pushImmediate({ invoices: updated });
    showNotification(`تم تعديل الفاتورة رقم ${invoice.invoiceNumber} بنجاح`);
  };

  const deleteInvoice = (id: string) => {
    const updated = invoices.filter((inv) => inv.id !== id);
    invoicesRef.current = updated;
    setInvoices(updated);
    try {
      localStorage.setItem(getDbKey('invoices', currentDatabaseId), JSON.stringify(updated));
    } catch {}

    const activeCfg = pgConfigRef.current || getStoredPgConfig();
    if (activeCfg && isPgConnectedRef.current) {
      deletePgRecord(activeCfg, { entityType: 'invoice', id });
    }
    pushImmediate({ invoices: updated });
    showNotification('تم حذف الفاتورة بنجاح', 'info');
  };

  // Voucher operations
  const addVoucher = (voucherData: Omit<Voucher, 'id'>): Voucher => {
    const newVoucher: Voucher = {
      ...voucherData,
      id: String(Date.now()),
    };
    const updated = [newVoucher, ...vouchers];
    vouchersRef.current = updated;
    setVouchers(updated);
    try {
      localStorage.setItem(getDbKey('vouchers', currentDatabaseId), JSON.stringify(updated));
    } catch {}
    pushImmediate({ vouchers: updated });
    showNotification(`تم إضافة سند ${voucherData.type === 'دفع' ? 'الدفع' : 'القبض'} رقم ${newVoucher.voucherNumber} بنجاح`);
    return newVoucher;
  };

  const updateVoucher = (voucher: Voucher) => {
    const updated = vouchers.map((v) => (v.id === voucher.id ? voucher : v));
    vouchersRef.current = updated;
    setVouchers(updated);
    try {
      localStorage.setItem(getDbKey('vouchers', currentDatabaseId), JSON.stringify(updated));
    } catch {}
    pushImmediate({ vouchers: updated });
    showNotification(`تم تعديل السند رقم ${voucher.voucherNumber} بنجاح`);
  };

  const deleteVoucher = (id: string) => {
    const updated = vouchers.filter((v) => v.id !== id);
    vouchersRef.current = updated;
    setVouchers(updated);
    try {
      localStorage.setItem(getDbKey('vouchers', currentDatabaseId), JSON.stringify(updated));
    } catch {}

    const activeCfg = pgConfigRef.current || getStoredPgConfig();
    if (activeCfg && isPgConnectedRef.current) {
      deletePgRecord(activeCfg, { entityType: 'voucher', id });
    }
    pushImmediate({ vouchers: updated });
    showNotification('تم حذف السند بنجاح', 'info');
  };

  const updateSettings = (newSettings: CompanySettings) => {
    settingsRef.current = newSettings;
    setSettings(newSettings);
    try {
      localStorage.setItem(getDbKey('settings', currentDatabaseId), JSON.stringify(newSettings));
    } catch {}
    pushImmediate({ settings: newSettings });
    showNotification('تم حفظ إعدادات الشركة وبيانات الطباعة بنجاح');
  };

  const triggerPrint = (type: PrintConfig['type'], data: any) => {
    setPrintData({ type, data });
  };

  const closePrint = () => {
    setPrintData(null);
  };

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        viewHistory,
        goBack,
        settings,
        updateSettings,
        databases,
        currentDatabaseId,
        currentDatabaseName,
        switchDatabase,
        createDatabase,
        deleteDatabase,
        backupDatabase,
        restoreDatabase,
        exportBackup,
        exportSqlBackup,
        importBackup,
        emptyDatabase,
        closeAllWindows,
        accounts,
        addAccount,
        updateAccount,
        deleteAccount,
        selectedAccountId,
        setSelectedAccountId,
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        selectedCategoryId,
        setSelectedCategoryId,
        items,
        addItem,
        updateItem,
        deleteItem,
        selectedItemId,
        setSelectedItemId,
        invoices,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        selectedInvoiceId,
        setSelectedInvoiceId,
        vouchers,
        addVoucher,
        updateVoucher,
        deleteVoucher,
        selectedVoucherId,
        setSelectedVoucherId,
        printData,
        triggerPrint,
        closePrint,
        isInvoiceDirty,
        setIsInvoiceDirty,
        pendingViewChange,
        setPendingViewChange,
        showDiscardInvoiceModal,
        setShowDiscardInvoiceModal,
        confirmDiscardInvoice,
        cancelDiscardInvoice,
        notification,
        showNotification,
        clearNotification,
        isPgConnected,
        setIsPgConnected,
        pgConfig,
        setPgConfigState,
        isPgModalOpen,
        setIsPgModalOpen,
        isSyncingPg,
        syncToPostgres,
        loadFromPostgres,
        setAccounts,
        setCategories,
        setItems,
        setInvoices,
        setVouchers,
        setSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
