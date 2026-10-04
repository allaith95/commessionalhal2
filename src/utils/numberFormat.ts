/**
 * Number formatting and Thousands Separator utilities
 */

export type ThousandsSeparatorOption = ',' | '.' | ' ' | '،' | 'none';

export const THOUSANDS_SEPARATOR_OPTIONS: { id: ThousandsSeparatorOption; label: string; symbol: string; example: string }[] = [
  { id: ',', label: 'فاصلة عادية (Comma)', symbol: ',', example: '1,000,000' },
  { id: '،', label: 'فاصلة عربية', symbol: '،', example: '1،000،000' },
  { id: '.', label: 'نقطة (Dot)', symbol: '.', example: '1.000.000' },
  { id: ' ', label: 'مسافة (Space)', symbol: ' ', example: '1 000 000' },
  { id: 'none', label: 'بدون فاصلة', symbol: '', example: '1000000' },
];

/**
 * Returns the active separator character
 */
export function getSeparatorChar(sep?: string): string {
  if (sep === 'none' || sep === '') return '';
  if (sep === '.') return '.';
  if (sep === ' ') return ' ';
  if (sep === '،') return '،';
  return ',';
}

/**
 * Normalizes Eastern Arabic digits (٠-٩) and Persian digits to standard Western digits (0-9)
 */
export function normalizeEasternDigits(str: string): string {
  if (!str) return '';
  return str
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9');
}

/**
 * Formats a number or numeric string with thousands separator dynamically
 */
export function formatThousands(
  value: number | string | null | undefined,
  separator: string = ','
): string {
  if (value === null || value === undefined || value === '') return '';
  
  const sepChar = getSeparatorChar(separator);
  let str = normalizeEasternDigits(String(value)).trim();
  
  // Strip all non-numeric except decimal point and leading minus
  // Remove existing separator chars first
  if (sepChar) {
    str = str.split(sepChar).join('');
  }
  str = str.replace(/,/g, '').replace(/،/g, '');

  if (!str) return '';

  const isNegative = str.startsWith('-');
  if (isNegative) {
    str = str.substring(1);
  }

  const hasTrailingDot = str.endsWith('.');
  const parts = str.split('.');
  let integerPart = parts[0].replace(/\D/g, '');
  const decimalPart = parts.length > 1 ? parts[1].replace(/\D/g, '') : null;

  if (sepChar && integerPart.length > 0) {
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, sepChar);
  }

  let formatted = integerPart;
  if (decimalPart !== null) {
    formatted += '.' + decimalPart;
  } else if (hasTrailingDot) {
    formatted += '.';
  }

  return isNegative ? '-' + formatted : formatted;
}

/**
 * Parses a formatted string back to a numeric float
 */
export function parseThousands(
  value: string | number | null | undefined,
  separator: string = ','
): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  const sepChar = getSeparatorChar(separator);
  let str = normalizeEasternDigits(String(value)).trim();

  if (sepChar) {
    str = str.split(sepChar).join('');
  }
  str = str.replace(/,/g, '').replace(/،/g, '').replace(/\s/g, '');

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}
