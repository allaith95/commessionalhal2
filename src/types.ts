export interface Account {
  id: string;
  code: string;
  name: string;
  parentAccount: string;
  governorate: string;
  city: string;
  address: string;
  phone: string;
  notes: string;
  openingDebit: number;
  openingCredit: number;
  currentBalance?: number;
  isSystem?: boolean;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  notes: string;
}

export interface Item {
  id: string;
  code: string;
  name: string;
  unit: string;
  category: string;
  notes: string;
}

export interface InvoiceRow {
  id: string;
  rowNumber: number;
  itemId?: string;
  itemName: string;
  unit: string;
  grossWeight: number; // وزن قائم
  discountTare: number; // الخصم (كغ)
  discountPercent?: number; // الخصم %
  netWeight: number; // وزن الصافي
  unitPrice: number; // الإفرادي
  total: number; // الإجمالي = صافي * إفرادي
  notes: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string; // YYYY-MM-DD
  sellerId: string;
  sellerName: string;
  sellerPaymentType: 'نقدي' | 'آجل';
  sellerNotes: string;
  buyerId: string;
  buyerName: string;
  buyerPaymentType: 'نقدي' | 'آجل';
  buyerNotes: string;
  rows: InvoiceRow[];
  totalAmount: number; // الإجمالي
  commissionRate: number; // الكمسيون % (e.g. 5, 6)
  commissionValue: number; // قيمة الكمسيون
  netAmount: number; // الصافي
}

export interface VoucherRow {
  id: string;
  rowNumber: number;
  amount: number;
  accountCode: string;
  accountName: string;
  notes: string;
}

export interface Voucher {
  id: string;
  voucherNumber: string;
  type: 'دفع' | 'قبض';
  mainAccountCode: string;
  mainAccountName: string;
  currency: string;
  date: string;
  notes: string;
  rows: VoucherRow[];
  totalAmount: number;
}

export type PaperSize = 'A4' | 'A5' | 'A6' | 'B5';

export type CommissionRoundingDirection = 'none' | 'up' | 'nearest' | 'down';

export interface CompanySettings {
  companyName: string;
  address: string;
  license: string;
  firstName: string;
  firstPhone: string;
  secondName: string;
  secondPhone: string;
  showItemCode: boolean;
  showAccountCode: boolean;
  showTafqeet: boolean;
  sellerInvoicePageSize: PaperSize;
  buyerInvoicePageSize: PaperSize;
  voucherPageSize: PaperSize;
  reportPageSize: PaperSize;
  printHeaderFontSize?: number;
  printBodyFontSize?: number;
  printSummaryFontSize?: number;
  thousandsSeparator?: string;
  currency?: string;
  defaultCommissionRate?: number;
  defaultDiscountTare?: number;
  footerNote?: string;
  commissionRoundingDirection?: CommissionRoundingDirection;
  commissionRoundingValue?: number;
}

export interface DatabaseInfo {
  id: string;
  name: string;
  companyName: string;
  createdAt: string;
  lastModified: string;
}

export type AppView = 
  | 'home'
  | 'accounts_list'
  | 'account_card'
  | 'account_statement'
  | 'commission_report'
  | 'categories_list'
  | 'category_card'
  | 'items_list'
  | 'item_card'
  | 'item_movement_report'
  | 'item_report'
  | 'commission_invoice'
  | 'invoices_list'
  | 'voucher_payment'
  | 'voucher_receipt'
  | 'settings'
  | 'about';

export interface PgConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
}

export interface PgConnectionStatus {
  connected: boolean;
  host?: string;
  database?: string;
  port?: number;
  user?: string;
}

