import express, { Request, Response } from 'express';
import cors from 'cors';
import { Client, Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import activationRoutes from './server/activation-routes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACTIVATION_FILE_DIR = path.join(__dirname, 'config');
const ACTIVATION_FILE_PATH = path.join(ACTIVATION_FILE_DIR, 'activation_license.json');

// Ensure external config directory exists
try {
  if (!fs.existsSync(ACTIVATION_FILE_DIR)) {
    fs.mkdirSync(ACTIVATION_FILE_DIR, { recursive: true });
  }
} catch (err) {
  console.error('Failed to create activation config folder:', err);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Mount Activation & Licensing API routes
app.use('/api/activation', activationRoutes);

// Active PostgreSQL connection config
let activePgConfig: {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
} | null = null;

let activePool: Pool | null = null;

// In-Memory Virtual PostgreSQL storage for offline/demo/sandbox
interface VirtualDb {
  name: string;
  createdAt: string;
  accounts: any[];
  categories: any[];
  items: any[];
  invoices: any[];
  vouchers: any[];
  settings: any;
}

const virtualDatabases: Map<string, VirtualDb> = new Map();

function getOrCreateVirtualDb(dbName: string): VirtualDb {
  const name = (dbName || '').trim().toLowerCase() || 'main_db';
  if (!virtualDatabases.has(name)) {
    virtualDatabases.set(name, {
      name,
      createdAt: new Date().toISOString(),
      accounts: [
        { id: 'sys_1', code: '1', name: 'الصندوق', parentAccount: '', isSystem: true, openingDebit: 0, openingCredit: 0, currentBalance: 0 },
        { id: 'sys_2', code: '2', name: 'الكمسيون', parentAccount: '', isSystem: true, openingDebit: 0, openingCredit: 0, currentBalance: 0 },
        { id: 'sys_3', code: '3', name: 'المصاريف', parentAccount: '', isSystem: true, openingDebit: 0, openingCredit: 0, currentBalance: 0 },
        { id: 'sys_4', code: '4', name: 'المزارعين', parentAccount: '', isSystem: true, openingDebit: 0, openingCredit: 0, currentBalance: 0 },
        { id: 'sys_5', code: '5', name: 'التجار', parentAccount: '', isSystem: true, openingDebit: 0, openingCredit: 0, currentBalance: 0 },
      ],
      categories: [],
      items: [],
      invoices: [],
      vouchers: [],
      settings: null,
    });
  }
  return virtualDatabases.get(name)!;
}

function isVirtualHost(host: string): boolean {
  if (!host) return false;
  const h = host.toLowerCase().trim();
  return h === 'demo' || h === 'virtual' || h === 'sandbox' || h === 'mock' || h === 'تجريبي';
}

function formatPgError(err: any, host: string, port: number = 5432, user: string = 'postgres') {
  const code = err?.code || '';
  const msg = err?.message || String(err || '');

  if (code === 'ECONNREFUSED' || msg.includes('ECONNREFUSED')) {
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    return {
      title: 'سيرفر PostgreSQL غير متاح على هذا العنوان',
      error: `تعذر الاتصال بـ (${host}:${port}). تأكد من تشغيل خادم PostgreSQL 18 على جهازك ومن المنفذ 5432.`,
      isCloudNotice: isLocalHost || host.startsWith('DESKTOP-'),
      tip: isLocalHost
        ? 'إذا كنت تشغل التطبيق محلياً على حاسوبك: تأكد من تشغيل خدمة PostgreSQL (مثل pgAdmin 4 أو Windows Service).'
        : 'تأكد من تشغيل خدمة PostgreSQL على السيرفر والسماح بالمنفذ 5432.',
    };
  }

  if (code === 'EAI_AGAIN' || code === 'ENOTFOUND' || msg.includes('getaddrinfo')) {
    return {
      title: 'اسم السيرفر / المضيف غير موجود',
      error: `تعذر الوصول إلى المضيف (${host}).`,
      isCloudNotice: host.startsWith('DESKTOP-') || !host.includes('.'),
      tip: 'يرجى كتابة localhost أو عنوان IP صحيح لسيرفر PostgreSQL.',
    };
  }

  if (code === '28P01' || msg.includes('password authentication failed')) {
    return {
      title: 'كلمة السر غير صحيحة',
      error: `فشل التحقق من كلمة المرور الخاصة بالمستخدم (${user}) على سيرفر PostgreSQL.`,
      tip: 'يرجى التأكد من كتابة كلمة المرور الصحيحة لمستخدم postgres.',
    };
  }

  if (code === '3D000' || (msg.includes('database') && msg.includes('does not exist'))) {
    return {
      title: 'قاعدة البيانات غير موجودة',
      error: 'قاعدة البيانات المحددة غير موجودة على سيرفر PostgreSQL.',
      tip: 'اضغط على زر «جديد» لإنشاء قاعدة البيانات وتهيئة كافة الجداول فوراً.',
    };
  }

  return {
    title: 'فشل الاتصال بـ PostgreSQL',
    error: msg || 'حدث خطأ أثناء الاتصال بسيرفر PostgreSQL.',
    tip: 'تحقق من صحة بيانات السيرفر وكلمة السر والشبكة.',
  };
}

function getPool(config: {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
}) {
  if (isVirtualHost(config.host)) {
    activePgConfig = config;
    return null;
  }

  if (
    activePool &&
    activePgConfig &&
    activePgConfig.host === config.host &&
    activePgConfig.database === config.database &&
    activePgConfig.user === config.user &&
    activePgConfig.port === config.port
  ) {
    return activePool;
  }

  if (activePool) {
    activePool.end().catch(() => {});
  }

  activePool = new Pool({
    host: config.host,
    port: config.port || 5432,
    user: config.user || 'postgres',
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 4000,
  });

  activePool.on('error', () => {});
  activePgConfig = config;
  return activePool;
}

// SQL Schema Creator Helper: Pure Relational Schema (No JSON reliance)
async function initializeRelationalSchema(client: Client | Pool) {
  await client.query(`
    -- 1. Accounts Table (شجرة الحسابات)
    CREATE TABLE IF NOT EXISTS accounts (
      id VARCHAR(255) PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      parent_account VARCHAR(255) DEFAULT '',
      governorate VARCHAR(100) DEFAULT '',
      city VARCHAR(100) DEFAULT '',
      address TEXT DEFAULT '',
      phone VARCHAR(50) DEFAULT '',
      notes TEXT DEFAULT '',
      opening_debit NUMERIC(15,2) DEFAULT 0,
      opening_credit NUMERIC(15,2) DEFAULT 0,
      current_balance NUMERIC(15,2) DEFAULT 0,
      is_system BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Categories Table (بطاقة الأصناف / التصنيفات)
    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(255) PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL UNIQUE,
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Items Table (بطاقة المواد)
    CREATE TABLE IF NOT EXISTS items (
      id VARCHAR(255) PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL UNIQUE,
      unit VARCHAR(50) DEFAULT 'كغ',
      category VARCHAR(255) NOT NULL,
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Invoices Table (رأس فواتير الكمسيون)
    CREATE TABLE IF NOT EXISTS invoices (
      id VARCHAR(255) PRIMARY KEY,
      invoice_number VARCHAR(50) NOT NULL,
      date VARCHAR(50) NOT NULL,
      seller_id VARCHAR(255) DEFAULT '',
      seller_name VARCHAR(255) NOT NULL,
      seller_payment_type VARCHAR(50) DEFAULT 'نقدي',
      seller_notes TEXT DEFAULT '',
      buyer_id VARCHAR(255) DEFAULT '',
      buyer_name VARCHAR(255) NOT NULL,
      buyer_payment_type VARCHAR(50) DEFAULT 'نقدي',
      buyer_notes TEXT DEFAULT '',
      total_amount NUMERIC(15,2) DEFAULT 0,
      commission_rate NUMERIC(10,2) DEFAULT 5,
      commission_value NUMERIC(15,2) DEFAULT 0,
      net_amount NUMERIC(15,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Invoice Items Table (بنود وأسطر فواتير الكمسيون العلائقية)
    CREATE TABLE IF NOT EXISTS invoice_items (
      id VARCHAR(255) PRIMARY KEY,
      invoice_id VARCHAR(255) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      row_number INT NOT NULL,
      item_id VARCHAR(255) DEFAULT '',
      item_name VARCHAR(255) NOT NULL,
      unit VARCHAR(50) DEFAULT 'كغ',
      gross_weight NUMERIC(12,2) DEFAULT 0,
      discount_tare NUMERIC(12,2) DEFAULT 0,
      discount_percent NUMERIC(10,2) DEFAULT 0,
      net_weight NUMERIC(12,2) DEFAULT 0,
      unit_price NUMERIC(12,2) DEFAULT 0,
      total NUMERIC(15,2) DEFAULT 0,
      notes TEXT DEFAULT ''
    );

    -- 6. Vouchers Table (رأس سندات القبض والدفع)
    CREATE TABLE IF NOT EXISTS vouchers (
      id VARCHAR(255) PRIMARY KEY,
      voucher_number VARCHAR(50) NOT NULL,
      type VARCHAR(50) NOT NULL,
      main_account_code VARCHAR(50) NOT NULL,
      main_account_name VARCHAR(255) NOT NULL,
      currency VARCHAR(50) DEFAULT 'ل.س',
      date VARCHAR(50) NOT NULL,
      notes TEXT DEFAULT '',
      total_amount NUMERIC(15,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. Voucher Rows Table (أسطر وحسابات السندات العلائقية)
    CREATE TABLE IF NOT EXISTS voucher_rows (
      id VARCHAR(255) PRIMARY KEY,
      voucher_id VARCHAR(255) NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
      row_number INT NOT NULL,
      amount NUMERIC(15,2) DEFAULT 0,
      account_code VARCHAR(50) NOT NULL,
      account_name VARCHAR(255) NOT NULL,
      notes TEXT DEFAULT ''
    );

    -- 8. Company Settings Table (إعدادات المنشأة بالأعمدة العلائقية)
    CREATE TABLE IF NOT EXISTS company_settings (
      id VARCHAR(50) PRIMARY KEY,
      company_name VARCHAR(255) DEFAULT '',
      address TEXT DEFAULT '',
      license VARCHAR(100) DEFAULT '',
      first_name VARCHAR(100) DEFAULT '',
      first_phone VARCHAR(50) DEFAULT '',
      second_name VARCHAR(100) DEFAULT '',
      second_phone VARCHAR(50) DEFAULT '',
      show_item_code BOOLEAN DEFAULT false,
      show_account_code BOOLEAN DEFAULT true,
      show_tafqeet BOOLEAN DEFAULT false,
      seller_invoice_page_size VARCHAR(20) DEFAULT 'A5',
      buyer_invoice_page_size VARCHAR(20) DEFAULT 'A5',
      voucher_page_size VARCHAR(20) DEFAULT 'A4',
      report_page_size VARCHAR(20) DEFAULT 'A4',
      print_header_font_size INT DEFAULT 11,
      print_body_font_size INT DEFAULT 11,
      print_summary_font_size INT DEFAULT 11,
      thousands_separator VARCHAR(5) DEFAULT ',',
      currency VARCHAR(50) DEFAULT 'ل.س',
      default_commission_rate NUMERIC(10,2) DEFAULT 5,
      default_discount_tare NUMERIC(10,2) DEFAULT 0,
      footer_note TEXT DEFAULT 'شكراً لتعاملكم معنا',
      commission_rounding_direction VARCHAR(20) DEFAULT 'none',
      commission_rounding_value NUMERIC(10,2) DEFAULT 50,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Ensure columns exist if table was already created
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS commission_rounding_direction VARCHAR(20) DEFAULT 'none';
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS commission_rounding_value NUMERIC(10,2) DEFAULT 50;
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS print_header_font_size INT DEFAULT 11;
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS print_body_font_size INT DEFAULT 11;
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS print_summary_font_size INT DEFAULT 11;
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS thousands_separator VARCHAR(5) DEFAULT ',';

    -- Seed basic permanent system accounts
    INSERT INTO accounts (id, code, name, parent_account, is_system)
    VALUES 
      ('sys_1', '1', 'الصندوق', '', true),
      ('sys_2', '2', 'الكمسيون', '', true),
      ('sys_3', '3', 'المصاريف', '', true),
      ('sys_4', '4', 'المزارعين', '', true),
      ('sys_5', '5', 'التجار', '', true)
    ON CONFLICT (id) DO UPDATE SET is_system = true;
  `);
}

// 1. Test PostgreSQL Connection
app.post('/api/pg/test-connection', async (req: Request, res: Response) => {
  const { host, port = 5432, user = 'postgres', password, ssl = false } = req.body;

  if (!host) {
    return res.status(400).json({ success: false, error: 'اسم السيرفر مطلوب' });
  }

  if (isVirtualHost(host)) {
    return res.json({
      success: true,
      message: 'تم الاتصال بمحرك PostgreSQL التجريبي بنجاح!',
      version: 'PostgreSQL 18.0 (Virtual Engine)',
      isVirtual: true,
    });
  }

  const client = new Client({
    host,
    port: Number(port) || 5432,
    user: user || 'postgres',
    password: password || '',
    database: 'postgres',
    ssl: ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 4000,
  });

  try {
    await client.connect();
    const result = await client.query('SELECT version();');
    await client.end();
    return res.json({
      success: true,
      message: 'تم الاتصال بسيرفر PostgreSQL بنجاح!',
      version: result.rows[0]?.version || 'PostgreSQL 18',
    });
  } catch (err: any) {
    try {
      await client.end();
    } catch {}
    const formatted = formatPgError(err, host, Number(port) || 5432, user);
    return res.status(200).json({
      success: false,
      error: formatted.error,
      title: formatted.title,
      tip: formatted.tip,
      isCloudNotice: formatted.isCloudNotice,
      rawCode: err.code,
    });
  }
});

// 2. List databases (Exclusively databases starting with commession_ or commission_)
app.post('/api/pg/list-databases', async (req: Request, res: Response) => {
  const { host, port = 5432, user = 'postgres', password, ssl = false } = req.body;

  if (!host) {
    return res.status(400).json({ success: false, error: 'اسم السيرفر مطلوب' });
  }

  if (isVirtualHost(host)) {
    const list = Array.from(virtualDatabases.keys()).filter((name) => name.startsWith('commession_') || name.startsWith('commission_'));
    return res.json({ success: true, databases: list, isVirtual: true });
  }

  const client = new Client({
    host,
    port: Number(port) || 5432,
    user: user || 'postgres',
    password: password || '',
    database: 'postgres',
    ssl: ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 4000,
  });

  try {
    await client.connect();
    const result = await client.query(`
      SELECT datname 
      FROM pg_database 
      WHERE datistemplate = false 
        AND (datname LIKE 'commession_%' OR datname LIKE 'commission_%')
      ORDER BY datname ASC;
    `);
    await client.end();

    const databases = result.rows.map((r: any) => r.datname);
    return res.json({ success: true, databases });
  } catch (err: any) {
    try {
      await client.end();
    } catch {}
    const formatted = formatPgError(err, host, Number(port) || 5432, user);
    return res.status(200).json({
      success: false,
      error: formatted.error,
      title: formatted.title,
      tip: formatted.tip,
      isCloudNotice: formatted.isCloudNotice,
    });
  }
});

// Delete Database Endpoint
app.post('/api/pg/delete-database', async (req: Request, res: Response) => {
  const { host, port = 5432, user = 'postgres', password, dbName, database, ssl = false } = req.body;
  const targetDbName = (dbName || database || '').trim();

  if (!host || !targetDbName) {
    return res.status(400).json({ success: false, error: 'اسم السيرفر واسم قاعدة البيانات مطلوبان' });
  }

  const cleanDbName = targetDbName.toLowerCase();
  const rawClean = cleanDbName.replace(/^(commession_|commission_)+/i, '');
  const possibleNames = Array.from(new Set([
    cleanDbName,
    'commession_' + rawClean,
    'commission_' + rawClean,
    rawClean,
  ])).filter(Boolean);

  if (isVirtualHost(host)) {
    for (const name of possibleNames) {
      virtualDatabases.delete(name);
    }
    return res.json({ success: true, message: `تم حذف قاعدة البيانات (${cleanDbName}) بنجاح` });
  }

  const client = new Client({
    host,
    port: Number(port) || 5432,
    user: user || 'postgres',
    password: password || '',
    database: 'postgres',
    ssl: ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    // Terminate all connections to any of the matching database names, then drop
    for (const name of possibleNames) {
      try {
        await client.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [name]);
        await client.query(`DROP DATABASE IF EXISTS "${name}"`);
      } catch (dropErr) {
        console.error(`Attempt to drop database ${name}:`, dropErr);
      }
    }
    await client.end();
    return res.json({ success: true, message: `تم حذف قاعدة البيانات (${cleanDbName}) بنجاح` });
  } catch (err: any) {
    try {
      await client.end();
    } catch {}
    const formatted = formatPgError(err, host, Number(port) || 5432, user);
    return res.status(200).json({
      success: false,
      error: formatted.error || err.message,
    });
  }
});

// Empty Database Endpoint (Truncates all data except the 5 permanent system accounts)
app.post('/api/pg/empty-database', async (req: Request, res: Response) => {
  const { host, port = 5432, user = 'postgres', password, database, ssl = false } = req.body;

  if (!host || !database) {
    return res.status(400).json({ success: false, error: 'اسم السيرفر واسم قاعدة البيانات مطلوبان' });
  }

  const cleanDbName = database.trim().toLowerCase();

  if (isVirtualHost(host)) {
    const cleanDb = getOrCreateVirtualDb(cleanDbName);
    cleanDb.accounts = [
      { id: 'sys_1', code: '1', name: 'الصندوق', parentAccount: '', isSystem: true, openingDebit: 0, openingCredit: 0, currentBalance: 0 },
      { id: 'sys_2', code: '2', name: 'الكمسيون', parentAccount: '', isSystem: true, openingDebit: 0, openingCredit: 0, currentBalance: 0 },
      { id: 'sys_3', code: '3', name: 'المصاريف', parentAccount: '', isSystem: true, openingDebit: 0, openingCredit: 0, currentBalance: 0 },
      { id: 'sys_4', code: '4', name: 'المزارعين', parentAccount: '', isSystem: true, openingDebit: 0, openingCredit: 0, currentBalance: 0 },
      { id: 'sys_5', code: '5', name: 'التجار', parentAccount: '', isSystem: true, openingDebit: 0, openingCredit: 0, currentBalance: 0 },
    ];
    cleanDb.categories = [];
    cleanDb.items = [];
    cleanDb.invoices = [];
    cleanDb.vouchers = [];
    return res.json({ success: true, message: 'تم تفريغ قاعدة البيانات بنجاح والاحتفاظ بالحسابات الـ 5 الافتراضية فقط' });
  }

  const pool = getPool({ host, port: Number(port) || 5432, user: user || 'postgres', password: password || '', database: cleanDbName, ssl });
  if (!pool) {
    return res.status(500).json({ success: false, error: 'سيرفر PostgreSQL غير متصل' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN;');
    await client.query('TRUNCATE TABLE invoice_items, invoices, voucher_rows, vouchers, items, categories CASCADE;');
    await client.query('DELETE FROM accounts WHERE is_system = false OR is_system IS NULL;');
    await client.query(`
      UPDATE accounts 
      SET opening_debit = 0, opening_credit = 0, current_balance = 0 
      WHERE is_system = true;
    `);
    // Ensure all 5 system accounts exist
    await client.query(`
      INSERT INTO accounts (id, code, name, parent_account, is_system, opening_debit, opening_credit, current_balance)
      VALUES 
        ('sys_1', '1', 'الصندوق', '', true, 0, 0, 0),
        ('sys_2', '2', 'الكمسيون', '', true, 0, 0, 0),
        ('sys_3', '3', 'المصاريف', '', true, 0, 0, 0),
        ('sys_4', '4', 'المزارعين', '', true, 0, 0, 0),
        ('sys_5', '5', 'التجار', '', true, 0, 0, 0)
      ON CONFLICT (id) DO UPDATE SET 
        opening_debit = 0, opening_credit = 0, current_balance = 0;
    `);
    await client.query('COMMIT;');
    client.release();
    return res.json({ success: true, message: 'تم تفريغ كافة الجداول والبيانات بنجاح والاحتفاظ بالحسابات الـ 5 الافتراضية فقط' });
  } catch (err: any) {
    if (client) {
      try {
        await client.query('ROLLBACK;');
        client.release();
      } catch {}
    }
    return res.status(500).json({ success: false, error: err.message || 'فشل تفريغ قاعدة البيانات' });
  }
});

// Create Database Endpoint
app.post('/api/pg/create-database', async (req: Request, res: Response) => {
  const { host, port = 5432, user = 'postgres', password, dbName, ssl = false } = req.body;

  if (!host) {
    return res.status(400).json({ success: false, error: 'اسم السيرفر مطلوب' });
  }

  let rawName = (dbName || 'db_' + Date.now().toString().slice(-4)).trim().toLowerCase();
  rawName = rawName.replace(/^(commession_|commission_)+/gi, '');
  rawName = rawName.replace(/[^a-z0-9_\u0600-\u06FF]/g, '_');
  if (!rawName || rawName.replace(/_+/g, '') === '') {
    rawName = 'db_' + Date.now().toString().slice(-4);
  }
  const cleanDbName = 'commession_' + rawName;

  if (isVirtualHost(host)) {
    if (!virtualDatabases.has(cleanDbName)) {
      virtualDatabases.set(cleanDbName, {
        name: cleanDbName,
        createdAt: new Date().toISOString(),
        accounts: [
          { id: 'sys_1', code: '1', name: 'الصندوق', parentAccount: '', isSystem: true, openingDebit: 0, openingCredit: 0, currentBalance: 0 },
          { id: 'sys_2', code: '2', name: 'الكمسيون', parentAccount: '', isSystem: true, openingDebit: 0, openingCredit: 0, currentBalance: 0 },
          { id: 'sys_3', code: '3', name: 'المصاريف', parentAccount: '', isSystem: true, openingDebit: 0, openingCredit: 0, currentBalance: 0 },
          { id: 'sys_4', code: '4', name: 'المزارعين', parentAccount: '', isSystem: true, openingDebit: 0, openingCredit: 0, currentBalance: 0 },
          { id: 'sys_5', code: '5', name: 'التجار', parentAccount: '', isSystem: true, openingDebit: 0, openingCredit: 0, currentBalance: 0 },
        ],
        categories: [],
        items: [],
        invoices: [],
        vouchers: [],
        settings: null,
      });
    }

    activePgConfig = {
      host: 'demo',
      port: 5432,
      user: 'postgres',
      database: cleanDbName,
    };

    return res.json({
      success: true,
      message: `تم إنشاء وتهيئة قاعدة البيانات "${cleanDbName}" بنجاح على محرك PostgreSQL!`,
      database: cleanDbName,
      isVirtual: true,
    });
  }

  const adminClient = new Client({
    host,
    port: Number(port) || 5432,
    user: user || 'postgres',
    password: password || '',
    database: 'postgres',
    ssl: ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 4000,
  });

  try {
    await adminClient.connect();
    const checkDb = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1;',
      [cleanDbName]
    );

    if (checkDb.rows.length === 0) {
      await adminClient.query(`CREATE DATABASE "${cleanDbName}" WITH ENCODING 'UTF8';`);
    }

    await adminClient.end();

    // Connect to the new database and create tables
    const dbClient = new Client({
      host,
      port: Number(port) || 5432,
      user: user || 'postgres',
      password: password || '',
      database: cleanDbName,
      ssl: ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 4000,
    });

    await dbClient.connect();
    await initializeRelationalSchema(dbClient);
    await dbClient.end();

    getPool({
      host,
      port: Number(port) || 5432,
      user: user || 'postgres',
      password: password || '',
      database: cleanDbName,
      ssl,
    });

    return res.json({
      success: true,
      message: `تم إنشاء وتهيئة كافة الجداول العلائقية لقاعدة البيانات "${cleanDbName}" بنجاح في PostgreSQL!`,
      database: cleanDbName,
    });
  } catch (err: any) {
    try {
      await adminClient.end();
    } catch {}
    const formatted = formatPgError(err, host, Number(port) || 5432, user);
    return res.status(200).json({
      success: false,
      error: formatted.error,
      title: formatted.title,
      tip: formatted.tip,
      isCloudNotice: formatted.isCloudNotice,
    });
  }
});

// 4. Connect to database
app.post('/api/pg/connect', async (req: Request, res: Response) => {
  const { host, port = 5432, user = 'postgres', password, database, ssl = false } = req.body;

  if (!host || !database) {
    return res.status(400).json({ success: false, error: 'اسم السيرفر واسم قاعدة البيانات مطلوبان' });
  }

  if (isVirtualHost(host)) {
    activePgConfig = {
      host: 'demo',
      port: 5432,
      user: 'postgres',
      database,
    };
    return res.json({
      success: true,
      message: `تم الاتصال بنجاح بقاعدة البيانات "${database}"`,
      database,
      version: 'PostgreSQL 18',
      isVirtual: true,
    });
  }

  const pool = getPool({
    host,
    port: Number(port) || 5432,
    user: user || 'postgres',
    password: password || '',
    database,
    ssl,
  });

  if (!pool) {
    return res.status(500).json({ success: false, error: 'فشل إنشاء مجمع الاتصال' });
  }

  try {
    const testResult = await pool.query('SELECT current_database(), version();');
    await initializeRelationalSchema(pool);
    return res.json({
      success: true,
      message: `تم الاتصال بنجاح بقاعدة البيانات "${testResult.rows[0]?.current_database}" في PostgreSQL`,
      database: testResult.rows[0]?.current_database,
      version: testResult.rows[0]?.version,
    });
  } catch (err: any) {
    const formatted = formatPgError(err, host, Number(port) || 5432, user);
    return res.status(200).json({
      success: false,
      error: formatted.error,
      title: formatted.title,
      tip: formatted.tip,
      isCloudNotice: formatted.isCloudNotice,
    });
  }
});

// 5. Get current status
app.get('/api/pg/status', (req: Request, res: Response) => {
  if (activePgConfig) {
    return res.json({
      connected: true,
      host: activePgConfig.host,
      database: activePgConfig.database,
      user: activePgConfig.user,
      port: activePgConfig.port,
      isVirtual: isVirtualHost(activePgConfig.host),
    });
  }
  return res.json({ connected: false });
});

// 6. Direct SQL Fetch All Data (Pure SQL JOINs)
app.post('/api/pg/pull-data', async (req: Request, res: Response) => {
  const { host, port = 5432, user = 'postgres', password, database, ssl = false } = req.body;

  if (isVirtualHost(host)) {
    const db = getOrCreateVirtualDb(database);
    return res.json({
      success: true,
      data: {
        accounts: db.accounts || [],
        categories: db.categories || [],
        items: db.items || [],
        invoices: db.invoices || [],
        vouchers: db.vouchers || [],
        settings: db.settings || null,
      },
      isVirtual: true,
    });
  }

  const pool = getPool({
    host,
    port: Number(port) || 5432,
    user: user || 'postgres',
    password: password || '',
    database,
    ssl,
  });

  if (!pool) {
    return res.status(500).json({ success: false, error: 'سيرفر PostgreSQL غير متصل' });
  }

  try {
    await initializeRelationalSchema(pool);

    const [accRes, catRes, itemRes, invRes, invItemsRes, vouchRes, vouchRowsRes, setRes] = await Promise.all([
      pool.query('SELECT * FROM accounts ORDER BY code ASC;'),
      pool.query('SELECT * FROM categories ORDER BY code ASC;'),
      pool.query('SELECT * FROM items ORDER BY code ASC;'),
      pool.query('SELECT * FROM invoices ORDER BY invoice_number ASC;'),
      pool.query('SELECT * FROM invoice_items ORDER BY row_number ASC;'),
      pool.query('SELECT * FROM vouchers ORDER BY voucher_number ASC;'),
      pool.query('SELECT * FROM voucher_rows ORDER BY row_number ASC;'),
      pool.query("SELECT * FROM company_settings WHERE id = 'main' LIMIT 1;"),
    ]);

    const accounts = accRes.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      parentAccount: r.parent_account || '',
      governorate: r.governorate || '',
      city: r.city || '',
      address: r.address || '',
      phone: r.phone || '',
      notes: r.notes || '',
      openingDebit: Number(r.opening_debit) || 0,
      openingCredit: Number(r.opening_credit) || 0,
      currentBalance: Number(r.current_balance) || 0,
      isSystem: Boolean(r.is_system),
    }));

    const categories = catRes.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      notes: r.notes || '',
    }));

    const items = itemRes.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      unit: r.unit || 'كغ',
      category: r.category || '',
      notes: r.notes || '',
    }));

    // Group invoice items by invoice_id
    const invoiceItemsMap = new Map<string, any[]>();
    for (const row of invItemsRes.rows) {
      const itemsList = invoiceItemsMap.get(row.invoice_id) || [];
      itemsList.push({
        id: row.id,
        rowNumber: Number(row.row_number) || 1,
        itemId: row.item_id || '',
        itemName: row.item_name || '',
        unit: row.unit || 'كغ',
        grossWeight: Number(row.gross_weight) || 0,
        discountTare: Number(row.discount_tare) || 0,
        discountPercent: Number(row.discount_percent) || 0,
        netWeight: Number(row.net_weight) || 0,
        unitPrice: Number(row.unit_price) || 0,
        total: Number(row.total) || 0,
        notes: row.notes || '',
      });
      invoiceItemsMap.set(row.invoice_id, itemsList);
    }

    const invoices = invRes.rows.map((r: any) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      date: r.date,
      sellerId: r.seller_id || '',
      sellerName: r.seller_name,
      sellerPaymentType: r.seller_payment_type || 'نقدي',
      sellerNotes: r.seller_notes || '',
      buyerId: r.buyer_id || '',
      buyerName: r.buyer_name,
      buyerPaymentType: r.buyer_payment_type || 'نقدي',
      buyerNotes: r.buyer_notes || '',
      rows: invoiceItemsMap.get(r.id) || [],
      totalAmount: Number(r.total_amount) || 0,
      commissionRate: Number(r.commission_rate) || 5,
      commissionValue: Number(r.commission_value) || 0,
      netAmount: Number(r.net_amount) || 0,
    }));

    // Group voucher rows by voucher_id
    const voucherRowsMap = new Map<string, any[]>();
    for (const row of vouchRowsRes.rows) {
      const rowsList = voucherRowsMap.get(row.voucher_id) || [];
      rowsList.push({
        id: row.id,
        rowNumber: Number(row.row_number) || 1,
        amount: Number(row.amount) || 0,
        accountCode: row.account_code || '',
        accountName: row.account_name || '',
        notes: row.notes || '',
      });
      voucherRowsMap.set(row.voucher_id, rowsList);
    }

    const vouchers = vouchRes.rows.map((r: any) => ({
      id: r.id,
      voucherNumber: r.voucher_number,
      type: r.type,
      mainAccountCode: r.main_account_code,
      mainAccountName: r.main_account_name,
      currency: r.currency || 'ل.س',
      date: r.date,
      notes: r.notes || '',
      rows: voucherRowsMap.get(r.id) || [],
      totalAmount: Number(r.total_amount) || 0,
    }));

    let settings = null;
    if (setRes.rows.length > 0) {
      const s = setRes.rows[0];
      settings = {
        companyName: s.company_name || '',
        address: s.address || '',
        license: s.license || '',
        firstName: s.first_name || '',
        firstPhone: s.first_phone || '',
        secondName: s.second_name || '',
        secondPhone: s.second_phone || '',
        showItemCode: Boolean(s.show_item_code),
        showAccountCode: Boolean(s.show_account_code),
        showTafqeet: Boolean(s.show_tafqeet),
        sellerInvoicePageSize: s.seller_invoice_page_size || 'A5',
        buyerInvoicePageSize: s.buyer_invoice_page_size || 'A5',
        voucherPageSize: s.voucher_page_size || 'A4',
        reportPageSize: s.report_page_size || 'A4',
        printHeaderFontSize: s.print_header_font_size != null ? Number(s.print_header_font_size) : 11,
        printBodyFontSize: s.print_body_font_size != null ? Number(s.print_body_font_size) : 11,
        printSummaryFontSize: s.print_summary_font_size != null ? Number(s.print_summary_font_size) : 11,
        thousandsSeparator: s.thousands_separator || ',',
        currency: s.currency || 'ل.س',
        defaultCommissionRate: Number(s.default_commission_rate) || 5,
        defaultDiscountTare: Number(s.default_discount_tare) || 0,
        footerNote: s.footer_note || '',
        commissionRoundingDirection: s.commission_rounding_direction || 'none',
        commissionRoundingValue: Number(s.commission_rounding_value) || 50,
      };
    }

    return res.json({
      success: true,
      data: {
        accounts,
        categories,
        items,
        invoices,
        vouchers,
        settings,
      },
    });
  } catch (err: any) {
    const formatted = formatPgError(err, host, Number(port) || 5432, user);
    return res.status(200).json({
      success: false,
      error: formatted.error,
      title: formatted.title,
      tip: formatted.tip,
    });
  }
});

// 7. Pure Relational SQL Push Data
app.post('/api/pg/push-data', async (req: Request, res: Response) => {
  const { host, port = 5432, user = 'postgres', password, database, ssl = false, data } = req.body;

  if (!data) {
    return res.status(400).json({ success: false, error: 'لا توجد بيانات للإرسال' });
  }

  if (isVirtualHost(host)) {
    const db = virtualDatabases.get(database) || {
      name: database,
      createdAt: new Date().toISOString(),
      accounts: [],
      categories: [],
      items: [],
      invoices: [],
      vouchers: [],
      settings: null,
    };

    if (Array.isArray(data.accounts)) db.accounts = data.accounts;
    if (Array.isArray(data.categories)) db.categories = data.categories;
    if (Array.isArray(data.items)) db.items = data.items;
    if (Array.isArray(data.invoices)) db.invoices = data.invoices;
    if (Array.isArray(data.vouchers)) db.vouchers = data.vouchers;
    if (data.settings) db.settings = data.settings;

    virtualDatabases.set(database, db);

    return res.json({
      success: true,
      message: 'تم حفظ ومزامنة البيانات في محرك PostgreSQL بنجاح!',
      isVirtual: true,
    });
  }

  const pool = getPool({
    host,
    port: Number(port) || 5432,
    user: user || 'postgres',
    password: password || '',
    database,
    ssl,
  });

  if (!pool) {
    return res.status(500).json({ success: false, error: 'سيرفر PostgreSQL غير متصل' });
  }

  let client;
  try {
    client = await pool.connect();
  } catch (err: any) {
    const formatted = formatPgError(err, host, Number(port) || 5432, user);
    return res.status(200).json({
      success: false,
      error: formatted.error,
      title: formatted.title,
      tip: formatted.tip,
    });
  }

  try {
    await client.query('BEGIN');
    await initializeRelationalSchema(client);

    // 1. Sync Accounts (Upsert given, delete missing non-system accounts)
    if (Array.isArray(data.accounts)) {
      const keepIds = data.accounts.map((a: any) => String(a.id)).filter(Boolean);
      if (keepIds.length > 0) {
        await client.query(`
          DELETE FROM accounts 
          WHERE is_system = false 
            AND id != ALL($1::varchar[]);
        `, [keepIds]);
      } else {
        await client.query('DELETE FROM accounts WHERE is_system = false;');
      }

      for (const acc of data.accounts) {
        await client.query(`
          INSERT INTO accounts (id, code, name, parent_account, governorate, city, address, phone, notes, opening_debit, opening_credit, current_balance, is_system)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
            code = EXCLUDED.code,
            name = EXCLUDED.name,
            parent_account = EXCLUDED.parent_account,
            governorate = EXCLUDED.governorate,
            city = EXCLUDED.city,
            address = EXCLUDED.address,
            phone = EXCLUDED.phone,
            notes = EXCLUDED.notes,
            opening_debit = EXCLUDED.opening_debit,
            opening_credit = EXCLUDED.opening_credit,
            current_balance = EXCLUDED.current_balance,
            is_system = EXCLUDED.is_system;
        `, [
          acc.id,
          acc.code,
          acc.name,
          acc.parentAccount || '',
          acc.governorate || '',
          acc.city || '',
          acc.address || '',
          acc.phone || '',
          acc.notes || '',
          acc.openingDebit || 0,
          acc.openingCredit || 0,
          acc.currentBalance || 0,
          Boolean(acc.isSystem),
        ]);
      }
    }

    // 2. Sync Categories (Upsert given, delete missing categories)
    if (Array.isArray(data.categories)) {
      const keepIds = data.categories.map((c: any) => String(c.id)).filter(Boolean);
      if (keepIds.length > 0) {
        await client.query(`
          DELETE FROM categories 
          WHERE id != ALL($1::varchar[]);
        `, [keepIds]);
      } else {
        await client.query('DELETE FROM categories;');
      }

      for (const cat of data.categories) {
        await client.query(`
          INSERT INTO categories (id, code, name, notes)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO UPDATE SET
            code = EXCLUDED.code,
            name = EXCLUDED.name,
            notes = EXCLUDED.notes;
        `, [cat.id, cat.code, cat.name, cat.notes || '']);
      }
    }

    // 3. Sync Items (Upsert given, delete missing items)
    if (Array.isArray(data.items)) {
      const keepIds = data.items.map((i: any) => String(i.id)).filter(Boolean);
      if (keepIds.length > 0) {
        await client.query(`
          DELETE FROM items 
          WHERE id != ALL($1::varchar[]);
        `, [keepIds]);
      } else {
        await client.query('DELETE FROM items;');
      }

      for (const item of data.items) {
        await client.query(`
          INSERT INTO items (id, code, name, unit, category, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            code = EXCLUDED.code,
            name = EXCLUDED.name,
            unit = EXCLUDED.unit,
            category = EXCLUDED.category,
            notes = EXCLUDED.notes;
        `, [item.id, item.code, item.name, item.unit || 'كغ', item.category, item.notes || '']);
      }
    }

    // 4. Sync Invoices & Relational Invoice Items (Upsert given, delete missing invoices)
    if (Array.isArray(data.invoices)) {
      const keepIds = data.invoices.map((inv: any) => String(inv.id)).filter(Boolean);
      if (keepIds.length > 0) {
        await client.query(`
          DELETE FROM invoices 
          WHERE id != ALL($1::varchar[]);
        `, [keepIds]);
      } else {
        await client.query('DELETE FROM invoices;');
      }

      for (const inv of data.invoices) {
        await client.query(`
          INSERT INTO invoices (id, invoice_number, date, seller_id, seller_name, seller_payment_type, seller_notes, buyer_id, buyer_name, buyer_payment_type, buyer_notes, total_amount, commission_rate, commission_value, net_amount)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO UPDATE SET
            invoice_number = EXCLUDED.invoice_number,
            date = EXCLUDED.date,
            seller_id = EXCLUDED.seller_id,
            seller_name = EXCLUDED.seller_name,
            seller_payment_type = EXCLUDED.seller_payment_type,
            seller_notes = EXCLUDED.seller_notes,
            buyer_id = EXCLUDED.buyer_id,
            buyer_name = EXCLUDED.buyer_name,
            buyer_payment_type = EXCLUDED.buyer_payment_type,
            buyer_notes = EXCLUDED.buyer_notes,
            total_amount = EXCLUDED.total_amount,
            commission_rate = EXCLUDED.commission_rate,
            commission_value = EXCLUDED.commission_value,
            net_amount = EXCLUDED.net_amount;
        `, [
          inv.id,
          inv.invoiceNumber,
          inv.date,
          inv.sellerId || '',
          inv.sellerName,
          inv.sellerPaymentType || 'نقدي',
          inv.sellerNotes || '',
          inv.buyerId || '',
          inv.buyerName,
          inv.buyerPaymentType || 'نقدي',
          inv.buyerNotes || '',
          inv.totalAmount || 0,
          inv.commissionRate || 5,
          inv.commissionValue || 0,
          inv.netAmount || 0,
        ]);

        // Replace invoice items in invoice_items table
        await client.query('DELETE FROM invoice_items WHERE invoice_id = $1;', [inv.id]);
        if (Array.isArray(inv.rows)) {
          for (let i = 0; i < inv.rows.length; i++) {
            const row = inv.rows[i];
            const rowId = row.id || `${inv.id}_row_${i + 1}`;
            await client.query(`
              INSERT INTO invoice_items (id, invoice_id, row_number, item_id, item_name, unit, gross_weight, discount_tare, discount_percent, net_weight, unit_price, total, notes)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);
            `, [
              rowId,
              inv.id,
              row.rowNumber || i + 1,
              row.itemId || '',
              row.itemName,
              row.unit || 'كغ',
              row.grossWeight || 0,
              row.discountTare || 0,
              row.discountPercent || 0,
              row.netWeight || 0,
              row.unitPrice || 0,
              row.total || 0,
              row.notes || '',
            ]);
          }
        }
      }
    }

    // 5. Sync Vouchers & Relational Voucher Rows (Upsert given, delete missing vouchers)
    if (Array.isArray(data.vouchers)) {
      const keepIds = data.vouchers.map((v: any) => String(v.id)).filter(Boolean);
      if (keepIds.length > 0) {
        await client.query(`
          DELETE FROM vouchers 
          WHERE id != ALL($1::varchar[]);
        `, [keepIds]);
      } else {
        await client.query('DELETE FROM vouchers;');
      }

      for (const v of data.vouchers) {
        await client.query(`
          INSERT INTO vouchers (id, voucher_number, type, main_account_code, main_account_name, currency, date, notes, total_amount)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            voucher_number = EXCLUDED.voucher_number,
            type = EXCLUDED.type,
            main_account_code = EXCLUDED.main_account_code,
            main_account_name = EXCLUDED.main_account_name,
            currency = EXCLUDED.currency,
            date = EXCLUDED.date,
            notes = EXCLUDED.notes,
            total_amount = EXCLUDED.total_amount;
        `, [
          v.id,
          v.voucherNumber,
          v.type,
          v.mainAccountCode || '1',
          v.mainAccountName || 'الصندوق',
          v.currency || 'ل.س',
          v.date,
          v.notes || '',
          v.totalAmount || 0,
        ]);

        // Replace voucher rows in voucher_rows table
        await client.query('DELETE FROM voucher_rows WHERE voucher_id = $1;', [v.id]);
        if (Array.isArray(v.rows)) {
          for (let i = 0; i < v.rows.length; i++) {
            const row = v.rows[i];
            const rowId = row.id || `${v.id}_row_${i + 1}`;
            await client.query(`
              INSERT INTO voucher_rows (id, voucher_id, row_number, amount, account_code, account_name, notes)
              VALUES ($1, $2, $3, $4, $5, $6, $7);
            `, [
              rowId,
              v.id,
              row.rowNumber || i + 1,
              row.amount || 0,
              row.accountCode || '',
              row.accountName || '',
              row.notes || '',
            ]);
          }
        }
      }
    }

    // 6. Sync Company Settings (Relational columns)
    if (data.settings) {
      const s = data.settings;
      await client.query(`
        INSERT INTO company_settings (id, company_name, address, license, first_name, first_phone, second_name, second_phone, show_item_code, show_account_code, show_tafqeet, seller_invoice_page_size, buyer_invoice_page_size, voucher_page_size, report_page_size, print_header_font_size, print_body_font_size, print_summary_font_size, thousands_separator, currency, default_commission_rate, default_discount_tare, footer_note, commission_rounding_direction, commission_rounding_value)
        VALUES ('main', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        ON CONFLICT (id) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          address = EXCLUDED.address,
          license = EXCLUDED.license,
          first_name = EXCLUDED.first_name,
          first_phone = EXCLUDED.first_phone,
          second_name = EXCLUDED.second_name,
          second_phone = EXCLUDED.second_phone,
          show_item_code = EXCLUDED.show_item_code,
          show_account_code = EXCLUDED.show_account_code,
          show_tafqeet = EXCLUDED.show_tafqeet,
          seller_invoice_page_size = EXCLUDED.seller_invoice_page_size,
          buyer_invoice_page_size = EXCLUDED.buyer_invoice_page_size,
          voucher_page_size = EXCLUDED.voucher_page_size,
          report_page_size = EXCLUDED.report_page_size,
          print_header_font_size = EXCLUDED.print_header_font_size,
          print_body_font_size = EXCLUDED.print_body_font_size,
          print_summary_font_size = EXCLUDED.print_summary_font_size,
          thousands_separator = EXCLUDED.thousands_separator,
          currency = EXCLUDED.currency,
          default_commission_rate = EXCLUDED.default_commission_rate,
          default_discount_tare = EXCLUDED.default_discount_tare,
          footer_note = EXCLUDED.footer_note,
          commission_rounding_direction = EXCLUDED.commission_rounding_direction,
          commission_rounding_value = EXCLUDED.commission_rounding_value,
          updated_at = CURRENT_TIMESTAMP;
      `, [
        s.companyName || '',
        s.address || '',
        s.license || '',
        s.firstName || '',
        s.firstPhone || '',
        s.secondName || '',
        s.secondPhone || '',
        Boolean(s.showItemCode),
        Boolean(s.showAccountCode),
        Boolean(s.showTafqeet),
        s.sellerInvoicePageSize || 'A5',
        s.buyerInvoicePageSize || 'A5',
        s.voucherPageSize || 'A4',
        s.reportPageSize || 'A4',
        s.printHeaderFontSize ?? 11,
        s.printBodyFontSize ?? 11,
        s.printSummaryFontSize ?? 11,
        s.thousandsSeparator ?? ',',
        s.currency || 'ل.س',
        Number(s.defaultCommissionRate) || 5,
        Number(s.defaultDiscountTare) || 0,
        s.footerNote || '',
        s.commissionRoundingDirection || 'none',
        Number(s.commissionRoundingValue) || 50,
      ]);
    }

    await client.query('COMMIT');
    return res.json({ success: true, message: 'تم حفظ ومزامنة كافة الجداول العلائقية في PostgreSQL بنجاح!' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return res.status(200).json({ success: false, error: err.message || 'فشل إرسال البيانات إلى PostgreSQL' });
  } finally {
    client.release();
  }
});

// 8. Delete Single Record API
app.post('/api/pg/delete-record', async (req: Request, res: Response) => {
  const { host, port = 5432, user = 'postgres', password, database, ssl = false, entityType, id, code } = req.body;

  if (!entityType || (!id && !code)) {
    return res.status(400).json({ success: false, error: 'معرف السجل ونوع الكيان مطلوب' });
  }

  if (isVirtualHost(host)) {
    const db = virtualDatabases.get(database);
    if (db) {
      if (entityType === 'account') {
        db.accounts = (db.accounts || []).filter((a: any) => a.id !== id && a.code !== code);
      } else if (entityType === 'item') {
        db.items = (db.items || []).filter((i: any) => i.id !== id && i.code !== code);
      } else if (entityType === 'category') {
        db.categories = (db.categories || []).filter((c: any) => c.id !== id && c.code !== code);
      } else if (entityType === 'invoice') {
        db.invoices = (db.invoices || []).filter((inv: any) => inv.id !== id);
      } else if (entityType === 'voucher') {
        db.vouchers = (db.vouchers || []).filter((v: any) => v.id !== id);
      }
      virtualDatabases.set(database, db);
    }
    return res.json({ success: true, message: 'تم حذف السجل بنجاح' });
  }

  const pool = getPool({
    host,
    port: Number(port) || 5432,
    user: user || 'postgres',
    password: password || '',
    database,
    ssl,
  });

  if (!pool) {
    return res.status(500).json({ success: false, error: 'سيرفر PostgreSQL غير متصل' });
  }

  try {
    if (entityType === 'account') {
      await pool.query('DELETE FROM accounts WHERE (id = $1 OR code = $2) AND is_system = false;', [id || '', code || '']);
    } else if (entityType === 'item') {
      await pool.query('DELETE FROM items WHERE id = $1 OR code = $2;', [id || '', code || '']);
    } else if (entityType === 'category') {
      await pool.query('DELETE FROM categories WHERE id = $1 OR code = $2;', [id || '', code || '']);
    } else if (entityType === 'invoice') {
      await pool.query('DELETE FROM invoices WHERE id = $1;', [id || '']);
    } else if (entityType === 'voucher') {
      await pool.query('DELETE FROM vouchers WHERE id = $1;', [id || '']);
    }
    return res.json({ success: true, message: 'تم حذف السجل من قاعدة البيانات بنجاح' });
  } catch (err: any) {
    return res.status(200).json({ success: false, error: err.message || 'فشل حذف السجل' });
  }
});

// Vite middleware in dev or static in prod
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Commission PostgreSQL App server listening on port ${PORT}`);
});
