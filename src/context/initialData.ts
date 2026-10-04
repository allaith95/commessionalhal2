import { Account, Category, Item, Invoice, Voucher, CompanySettings, DatabaseInfo } from '../types';

export const defaultCompanySettings: CompanySettings = {
  companyName: 'شركة تجارة وتسويق زراعي',
  address: '',
  license: '',
  firstName: '',
  firstPhone: '',
  secondName: '',
  secondPhone: '',
  showItemCode: false,
  showAccountCode: true,
  showTafqeet: false,
  sellerInvoicePageSize: 'A5',
  buyerInvoicePageSize: 'A5',
  voucherPageSize: 'A4',
  reportPageSize: 'A4',
  printHeaderFontSize: 11,
  printBodyFontSize: 11,
  printSummaryFontSize: 11,
  thousandsSeparator: ',',
  currency: 'ل.س',
  defaultCommissionRate: 5,
  defaultDiscountTare: 0,
  footerNote: 'شكراً لتعاملكم معنا',
  commissionRoundingDirection: 'none',
  commissionRoundingValue: 50,
};

export const defaultCategories: Category[] = [];

export const defaultItems: Item[] = [];

export const SYSTEM_BASIC_ACCOUNTS: Account[] = [
  {
    id: 'sys_1',
    code: '1',
    name: 'الصندوق',
    parentAccount: '',
    governorate: '',
    city: '',
    address: '',
    phone: '',
    notes: '',
    openingDebit: 0,
    openingCredit: 0,
    currentBalance: 0,
    isSystem: true,
  },
  {
    id: 'sys_2',
    code: '2',
    name: 'الكمسيون',
    parentAccount: '',
    governorate: '',
    city: '',
    address: '',
    phone: '',
    notes: '',
    openingDebit: 0,
    openingCredit: 0,
    currentBalance: 0,
    isSystem: true,
  },
  {
    id: 'sys_3',
    code: '3',
    name: 'المصاريف',
    parentAccount: '',
    governorate: '',
    city: '',
    address: '',
    phone: '',
    notes: '',
    openingDebit: 0,
    openingCredit: 0,
    currentBalance: 0,
    isSystem: true,
  },
  {
    id: 'sys_4',
    code: '4',
    name: 'المزارعين',
    parentAccount: '',
    governorate: '',
    city: '',
    address: '',
    phone: '',
    notes: '',
    openingDebit: 0,
    openingCredit: 0,
    currentBalance: 0,
    isSystem: true,
  },
  {
    id: 'sys_5',
    code: '5',
    name: 'التجار',
    parentAccount: '',
    governorate: '',
    city: '',
    address: '',
    phone: '',
    notes: '',
    openingDebit: 0,
    openingCredit: 0,
    currentBalance: 0,
    isSystem: true,
  },
];

export const defaultAccounts: Account[] = [
  ...SYSTEM_BASIC_ACCOUNTS,
];

export const defaultInvoices: Invoice[] = [];

export const defaultVouchers: Voucher[] = [];

export const defaultDatabases: DatabaseInfo[] = [];
