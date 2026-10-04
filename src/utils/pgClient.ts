import { PgConfig, PgConnectionStatus } from '../types';
import { SYSTEM_BASIC_ACCOUNTS } from '../context/initialData';

const STORAGE_KEY_PG_CONFIG = 'commission_pg_config';
const STORAGE_KEY_PG_SEEN = 'commission_pg_setup_seen';
const STORAGE_KEY_SERVER_SAVED = 'commission_pg_server_saved';
const STORAGE_KEY_DEFAULT_DB = 'commission_default_database';

export function getDefaultDatabase(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_DEFAULT_DB) || '';
  } catch {
    return '';
  }
}

/**
 * Strips the internal 'commession_' or 'commission_' prefix for UI display
 */
export function formatDbDisplayName(dbName?: string | null): string {
  if (!dbName) return '';
  return dbName.replace(/^(commession_|commission_)+/i, '');
}

/**
 * Ensures database name has the required 'commession_' prefix in background
 */
export function formatDbInternalName(userFriendlyName: string): string {
  if (!userFriendlyName) return '';
  const clean = userFriendlyName.trim().toLowerCase().replace(/^(commession_|commission_)+/i, '').replace(/\s+/g, '_').replace(/[^a-z0-9_\u0600-\u06FF]/g, '_');
  return 'commession_' + (clean || 'db_' + Date.now().toString().slice(-4));
}

export function setDefaultDatabase(dbName: string): void {
  try {
    if (dbName) {
      localStorage.setItem(STORAGE_KEY_DEFAULT_DB, dbName.trim().toLowerCase());
    } else {
      localStorage.removeItem(STORAGE_KEY_DEFAULT_DB);
    }
  } catch (err) {
    console.error('Failed to set default database:', err);
  }
}

export interface PgTestResult {
  success: boolean;
  message?: string;
  version?: string;
  error?: string;
}

export interface PgListDbResult {
  success: boolean;
  databases?: string[];
  error?: string;
}

export interface PgCreateDbResult {
  success: boolean;
  message?: string;
  database?: string;
  error?: string;
}

export interface PgConnectResult {
  success: boolean;
  message?: string;
  database?: string;
  version?: string;
  error?: string;
}

// 1. Get stored PG Config (Server details from localStorage, active database from sessionStorage)
export function getStoredPgConfig(): PgConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PG_CONFIG);
    if (!raw) return null;
    const serverConfig = JSON.parse(raw);
    const sessionDb = sessionStorage.getItem('commission_active_session_database') || '';
    return {
      ...serverConfig,
      database: sessionDb,
    };
  } catch {
    return null;
  }
}

// 2. Save PG Config (Server details to localStorage, active database to sessionStorage)
export function saveStoredPgConfig(config: PgConfig): void {
  try {
    const { database, ...serverOnly } = config;
    localStorage.setItem(STORAGE_KEY_PG_CONFIG, JSON.stringify(serverOnly));
    if (database && database !== 'postgres') {
      sessionStorage.setItem('commission_active_session_database', database);
    } else {
      sessionStorage.removeItem('commission_active_session_database');
    }
  } catch (err) {
    console.error('Failed to save PG config:', err);
  }
}

// 3. Clear stored PG Config and session
export function clearStoredPgConfig(): void {
  localStorage.removeItem(STORAGE_KEY_PG_CONFIG);
  sessionStorage.removeItem('commission_active_session_database');
}

// 4. First-time setup tracking
export function isPgFirstTimeSeen(): boolean {
  return localStorage.getItem(STORAGE_KEY_PG_SEEN) === 'true';
}

export function setPgFirstTimeSeen(seen: boolean = true): void {
  if (seen) {
    localStorage.setItem(STORAGE_KEY_PG_SEEN, 'true');
  } else {
    localStorage.removeItem(STORAGE_KEY_PG_SEEN);
  }
}

// 4.1 Server Configuration Persistence Tracking (One-time setup)
export function isServerConfigSaved(): boolean {
  try {
    const isSaved = localStorage.getItem(STORAGE_KEY_SERVER_SAVED) === 'true';
    const config = getStoredPgConfig();
    return isSaved || Boolean(config && config.host);
  } catch {
    return false;
  }
}

export function setServerConfigSaved(saved: boolean = true): void {
  if (saved) {
    localStorage.setItem(STORAGE_KEY_SERVER_SAVED, 'true');
  } else {
    localStorage.removeItem(STORAGE_KEY_SERVER_SAVED);
  }
}

// 5. Test connection to PostgreSQL server engine
export async function testPgConnection(params: {
  host: string;
  port?: number;
  user?: string;
  password?: string;
  ssl?: boolean;
}): Promise<PgTestResult> {
  try {
    const res = await fetch('/api/pg/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: params.host.trim(),
        port: Number(params.port) || 5432,
        user: (params.user || 'postgres').trim(),
        password: params.password || '',
        ssl: Boolean(params.ssl),
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error:
        err.message ||
        'تعذر الوصول إلى سيرفر التطبيق أو فشل الاتصال بمحرك PostgreSQL. تأكد من عمل السيرفر.',
    };
  }
}

// 6. List databases on the PostgreSQL server
export async function listPgDatabases(params: {
  host: string;
  port?: number;
  user?: string;
  password?: string;
  ssl?: boolean;
}): Promise<PgListDbResult> {
  try {
    const res = await fetch('/api/pg/list-databases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: params.host.trim(),
        port: Number(params.port) || 5432,
        user: (params.user || 'postgres').trim(),
        password: params.password || '',
        ssl: Boolean(params.ssl),
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'فشل جلب قائمة قواعد البيانات من سيرفر PostgreSQL',
    };
  }
}

// 7. Create a new database and initialize accounting schema
export async function deletePgDatabase(params: {
  host: string;
  port?: number;
  user?: string;
  password?: string;
  dbName: string;
  ssl?: boolean;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/pg/delete-database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: params.host.trim(),
        port: Number(params.port) || 5432,
        user: (params.user || 'postgres').trim(),
        password: params.password || '',
        dbName: params.dbName.trim(),
        ssl: Boolean(params.ssl),
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'حدث خطأ أثناء إرسال أمر حذف قاعدة البيانات من PostgreSQL',
    };
  }
}

// 7.1 Empty all data from a database except system accounts
export async function emptyPgDatabase(params: {
  host: string;
  port?: number;
  user?: string;
  password?: string;
  database: string;
  ssl?: boolean;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/pg/empty-database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: params.host.trim(),
        port: Number(params.port) || 5432,
        user: (params.user || 'postgres').trim(),
        password: params.password || '',
        database: params.database.trim(),
        ssl: Boolean(params.ssl),
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'حدث خطأ أثناء إرسال أمر تفريغ قاعدة البيانات في PostgreSQL',
    };
  }
}

export async function createPgDatabase(params: {
  host: string;
  port?: number;
  user?: string;
  password?: string;
  dbName: string;
  ssl?: boolean;
}): Promise<PgCreateDbResult> {
  try {
    const res = await fetch('/api/pg/create-database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: params.host.trim(),
        port: Number(params.port) || 5432,
        user: (params.user || 'postgres').trim(),
        password: params.password || '',
        dbName: params.dbName.trim(),
        ssl: Boolean(params.ssl),
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'حدث خطأ أثناء إرسال أمر إنشاء قاعدة البيانات في PostgreSQL',
    };
  }
}

// 8. Connect to an existing database
export async function connectPgDatabase(params: {
  host: string;
  port?: number;
  user?: string;
  password?: string;
  database: string;
  ssl?: boolean;
}): Promise<PgConnectResult> {
  try {
    const res = await fetch('/api/pg/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: params.host.trim(),
        port: Number(params.port) || 5432,
        user: (params.user || 'postgres').trim(),
        password: params.password || '',
        database: params.database.trim(),
        ssl: Boolean(params.ssl),
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'فشل الاتصال بقاعدة بيانات PostgreSQL المحددة',
    };
  }
}

// 9. Get current active PostgreSQL connection status from server
export async function getPgStatus(): Promise<PgConnectionStatus> {
  try {
    const res = await fetch('/api/pg/status');
    const data = await res.json();
    return data;
  } catch {
    return { connected: false };
  }
}

// 10. Pull all data from PostgreSQL
export async function pullPgData(config: PgConfig): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const res = await fetch('/api/pg/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    const result = await res.json();
    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'فشل استيراد البيانات من قاعدة بيانات PostgreSQL',
    };
  }
}

// 11. Push local data to PostgreSQL
export async function pushPgData(
  config: PgConfig,
  data: {
    accounts: any[];
    categories: any[];
    items: any[];
    invoices: any[];
    vouchers: any[];
    settings?: any;
  }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/pg/push-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...config,
        data,
      }),
    });

    const result = await res.json();
    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'فشل حفظ ومزامنة البيانات مع PostgreSQL',
    };
  }
}

// 11.1 Delete single record from PostgreSQL
export async function deletePgRecord(
  config: PgConfig,
  params: {
    entityType: 'account' | 'item' | 'category' | 'invoice' | 'voucher';
    id?: string;
    code?: string;
  }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/pg/delete-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...config,
        ...params,
      }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'فشل حذف السجل من قاعدة بيانات PostgreSQL',
    };
  }
}

// 12. Helper to connect and load PostgreSQL database directly
export async function connectAndLoadPgDatabase(
  baseConfig: PgConfig,
  dbName: string,
  callbacks: {
    setPgConfigState: (cfg: PgConfig) => void;
    setIsPgConnected: (connected: boolean) => void;
    setAccounts: (accs: any[]) => void;
    setCategories: (cats: any[]) => void;
    setItems: (items: any[]) => void;
    setInvoices: (invs: any[]) => void;
    setVouchers: (vouchs: any[]) => void;
    setSettings: (settings: any) => void;
  }
): Promise<boolean> {
  try {
    const res = await connectPgDatabase({
      ...baseConfig,
      database: dbName,
    });

    const activeConfig: PgConfig = {
      ...baseConfig,
      database: dbName,
    };

    setPgFirstTimeSeen(true);
    saveStoredPgConfig(activeConfig);
    callbacks.setPgConfigState(activeConfig);
    callbacks.setIsPgConnected(true);

    if (res.success) {
      const pullRes = await pullPgData(activeConfig);
      if (pullRes.success && pullRes.data) {
        callbacks.setAccounts(
          Array.isArray(pullRes.data.accounts) && pullRes.data.accounts.length > 0
            ? pullRes.data.accounts
            : SYSTEM_BASIC_ACCOUNTS
        );
        callbacks.setCategories(Array.isArray(pullRes.data.categories) ? pullRes.data.categories : []);
        callbacks.setItems(Array.isArray(pullRes.data.items) ? pullRes.data.items : []);
        callbacks.setInvoices(Array.isArray(pullRes.data.invoices) ? pullRes.data.invoices : []);
        callbacks.setVouchers(Array.isArray(pullRes.data.vouchers) ? pullRes.data.vouchers : []);
        if (pullRes.data.settings) {
          callbacks.setSettings(pullRes.data.settings);
        }
      } else {
        callbacks.setAccounts(SYSTEM_BASIC_ACCOUNTS);
        callbacks.setCategories([]);
        callbacks.setItems([]);
        callbacks.setInvoices([]);
        callbacks.setVouchers([]);
      }
    }
    return true;
  } catch (err) {
    console.error('Failed to connect and load database:', err);
    return false;
  }
}

