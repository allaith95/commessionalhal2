/**
 * Arabic number to words (Tafqeet) converter
 */

const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

function convertHundreds(n: number): string {
  let str = '';
  const c = Math.floor(n / 100);
  const remainder = n % 100;
  const t = Math.floor(remainder / 10);
  const u = remainder % 10;

  if (c > 0) {
    str += hundreds[c];
  }

  if (remainder > 0) {
    if (str.length > 0) str += ' و';
    if (remainder === 11) {
      str += 'أحد عشر';
    } else if (remainder === 12) {
      str += 'اثنا عشر';
    } else if (remainder < 10) {
      str += ones[u];
    } else if (remainder < 20) {
      str += ones[u] + ' عشر';
    } else {
      if (u > 0) {
        str += ones[u] + ' و' + tens[t];
      } else {
        str += tens[t];
      }
    }
  }

  return str;
}

export function numberToArabicWords(num: number, currency = 'ليرة سورية'): string {
  if (isNaN(num) || num === 0) return `صفر ${currency}`;
  
  let integerPart = Math.floor(Math.abs(num));
  let result = '';

  const billions = Math.floor(integerPart / 1000000000);
  integerPart %= 1000000000;
  const millions = Math.floor(integerPart / 1000000);
  integerPart %= 1000000;
  const thousands = Math.floor(integerPart / 1000);
  const remainder = integerPart % 1000;

  if (billions > 0) {
    result += convertHundreds(billions) + ' مليار';
  }

  if (millions > 0) {
    if (result.length > 0) result += ' و';
    result += convertHundreds(millions) + (millions === 1 ? 'مليون' : millions === 2 ? 'مليونان' : ' مليون');
  }

  if (thousands > 0) {
    if (result.length > 0) result += ' و';
    if (thousands === 1) result += 'ألف';
    else if (thousands === 2) result += 'ألفان';
    else if (thousands >= 3 && thousands <= 10) result += convertHundreds(thousands) + ' آلاف';
    else result += convertHundreds(thousands) + ' ألف';
  }

  if (remainder > 0) {
    if (result.length > 0) result += ' و';
    result += convertHundreds(remainder);
  }

  return `فقط ${result.trim()} ${currency} لا غير`;
}

export const tafqeetNumber = numberToArabicWords;

export function formatCurrency(amount: number, separator?: string): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0';
  const sep = separator !== undefined ? separator : ',';
  if (sep === ',') {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount);
  }
  const parts = Math.abs(amount).toString().split('.');
  const integerFormatted = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep || '');
  const formatted = parts.length > 1 ? `${integerFormatted}.${parts[1]}` : integerFormatted;
  return amount < 0 ? `-${formatted}` : formatted;
}
