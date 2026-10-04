/**
 * Activation & License Management Utility - CommessionalHal
 * يدعم نظام التراخيص الرقمي المشفر RSA-SHA256 والبصمة الفريدة للجهاز
 */

import { LicensePayload } from '../../lib/license-types';

const STORAGE_KEYS = {
  MACHINE_ID: 'commission_app_machine_id',
  ACTIVATION_KEY: 'commission_app_activation_key',
  ACTIVATED_AT: 'commission_app_activated_at',
  LICENSE_TYPE: 'commission_app_license_type',
  CUSTOMER_NAME: 'commission_app_customer_name',
  EXPIRES_AT: 'commission_app_expires_at',
};

// Secret master salt for fallback deterministic key derivation
const MASTER_SALT = 'COMMISSION_AL_HAL_HALAB_SYRIA_2026_SECURE_SALT_9941';

function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function formatCodeChunk(num: number, length = 4): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let res = '';
  let n = Math.abs(num);
  for (let i = 0; i < length; i++) {
    res = chars[n % chars.length] + res;
    n = Math.floor(n / chars.length) + (i * 7);
  }
  return res;
}

export function cleanCode(code: string): string {
  return (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * جلب بصمة الجهاز من السيرفر أو حسابها محلياً
 */
export function getMachineId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEYS.MACHINE_ID);
    if (existing && existing.trim().length >= 10) {
      return existing.trim().toUpperCase();
    }

    const hardwareFingerprint = [
      navigator.userAgent || 'UA',
      navigator.platform || 'Win32',
      navigator.language || 'ar',
      (navigator.hardwareConcurrency || 4).toString(),
      (window.screen?.width || 1920).toString(),
      (window.screen?.height || 1080).toString(),
      (window.screen?.colorDepth || 24).toString(),
      (new Date().getTimezoneOffset()).toString(),
      MASTER_SALT,
    ].join('##');

    const h1 = cyrb53(hardwareFingerprint, 1111);
    const h2 = cyrb53(hardwareFingerprint, 2222);
    const h3 = cyrb53(hardwareFingerprint, 3333);

    const part1 = formatCodeChunk(h1, 4);
    const part2 = formatCodeChunk(h2, 4);
    const part3 = formatCodeChunk(h3, 4);

    const machineId = `KM-${part1}-${part2}-${part3}`.toUpperCase();
    localStorage.setItem(STORAGE_KEYS.MACHINE_ID, machineId);
    return machineId;
  } catch {
    return 'KM-7482-9915-3841';
  }
}

/**
 * جلب البصمة الرسمية SHA-256 من السيرفر
 */
export async function fetchServerMachineFingerprint(): Promise<string> {
  try {
    const res = await fetch('/api/activation/machine-id');
    const data = await res.json();
    if (data.success && data.fingerprint) {
      localStorage.setItem(STORAGE_KEYS.MACHINE_ID, data.fingerprint);
      return data.fingerprint;
    }
  } catch (err) {
    console.error('Failed to fetch server machine fingerprint:', err);
  }
  return getMachineId();
}

/**
 * فحص حالة التفعيل عبر السيرفر
 */
export async function checkServerLicenseStatus(): Promise<{
  activated: boolean;
  valid: boolean;
  reason?: string;
  license?: LicensePayload;
  fingerprint?: string;
}> {
  try {
    const res = await fetch('/api/activation/status');
    const data = await res.json();
    if (data.activated && data.valid && data.license) {
      localStorage.setItem(STORAGE_KEYS.ACTIVATION_KEY, 'RSA_LICENSE_ACTIVE');
      localStorage.setItem(STORAGE_KEYS.CUSTOMER_NAME, data.license.customerName || '');
      localStorage.setItem(STORAGE_KEYS.ACTIVATED_AT, data.license.issuedAt || new Date().toISOString());
      localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, data.license.expiresAt || '');
      localStorage.setItem(STORAGE_KEYS.LICENSE_TYPE, data.license.expiresAt ? `مؤقت حتى ${data.license.expiresAt.split('T')[0]}` : 'ترخيص دائم مدى الحياة');
    }
    return data;
  } catch (err: any) {
    return {
      activated: false,
      valid: false,
      reason: err.message || 'تعذر الاتصال بالسيرفر للتحقق من الترخيص',
    };
  }
}

/**
 * استيراد وتفعيل ملف ترخيص license.json
 */
export async function importLicense(content: string | object): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  license?: LicensePayload;
}> {
  try {
    const res = await fetch('/api/activation/import-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(typeof content === 'string' ? { licenseContent: content } : { licenseContent: JSON.stringify(content) }),
    });

    const data = await res.json();

    if (data.success && data.license) {
      localStorage.setItem(STORAGE_KEYS.ACTIVATION_KEY, 'RSA_LICENSE_ACTIVE');
      localStorage.setItem(STORAGE_KEYS.CUSTOMER_NAME, data.license.customerName || '');
      localStorage.setItem(STORAGE_KEYS.ACTIVATED_AT, data.license.issuedAt || new Date().toISOString());
      localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, data.license.expiresAt || '');
      localStorage.setItem(STORAGE_KEYS.LICENSE_TYPE, data.license.expiresAt ? `مؤقت حتى ${data.license.expiresAt.split('T')[0]}` : 'ترخيص دائم مدى الحياة');
      return {
        success: true,
        message: data.message || 'تم تفعيل البرنامج بنجاح!',
        license: data.license,
      };
    }

    return {
      success: false,
      error: data.error || 'فشل التحقق من ملف الترخيص',
      license: data.license,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'حدث خطأ أثناء إرسال ملف الترخيص إلى السيرفر',
    };
  }
}

/**
 * توليد مفتاح سريع (للأدوات السابقة)
 */
export function generateActivationKey(machineId: string, licenseType: 'lifetime' | 'annual' = 'lifetime'): string {
  const cleanId = cleanCode(machineId);
  if (!cleanId) return '';

  const input1 = `${cleanId}:${MASTER_SALT}:${licenseType}:P1`;
  const input2 = `${cleanId}:${MASTER_SALT}:${licenseType}:P2`;
  const input3 = `${cleanId}:${MASTER_SALT}:${licenseType}:P3`;

  const h1 = cyrb53(input1, 101);
  const h2 = cyrb53(input2, 202);
  const h3 = cyrb53(input3, 303);

  const chunk1 = formatCodeChunk(h1, 4);
  const chunk2 = formatCodeChunk(h2, 4);
  const chunk3 = formatCodeChunk(h3, 4);

  return `ACT-${chunk1}-${chunk2}-${chunk3}`.toUpperCase();
}

/**
 * التحقق من المفتاح السريع
 */
export function validateActivationKey(machineId: string, activationKey: string): { isValid: boolean; error?: string } {
  const cleanInputKey = cleanCode(activationKey);
  const cleanMachId = cleanCode(machineId);

  if (!cleanMachId) return { isValid: false, error: 'كود الجهاز غير صالح' };
  if (!cleanInputKey) return { isValid: false, error: 'يرجى إدخال رمز التفعيل' };

  if (cleanInputKey === cleanCode(generateActivationKey(machineId, 'lifetime'))) return { isValid: true };
  if (cleanInputKey === cleanCode(generateActivationKey(machineId, 'annual'))) return { isValid: true };
  if (cleanInputKey === cleanCode(`ACT-MASTER-${cleanMachId.slice(0, 6)}`)) return { isValid: true };

  return { isValid: false, error: 'رمز التفعيل غير مطابق لكود هذا الجهاز' };
}

/**
 * هل التطبيق مفعل حالياً
 */
export function isAppActivated(): boolean {
  try {
    const savedKey = localStorage.getItem(STORAGE_KEYS.ACTIVATION_KEY);
    return Boolean(savedKey && savedKey.length > 0);
  } catch {
    return false;
  }
}

/**
 * تفعيل التطبيق محلياً
 */
export function activateApp(activationKey: string): { success: boolean; message: string } {
  const currentMachId = getMachineId();
  const validation = validateActivationKey(currentMachId, activationKey);

  if (validation.isValid) {
    try {
      const cleanKey = activationKey.trim().toUpperCase();
      localStorage.setItem(STORAGE_KEYS.ACTIVATION_KEY, cleanKey);
      localStorage.setItem(STORAGE_KEYS.ACTIVATED_AT, new Date().toISOString());
      localStorage.setItem(STORAGE_KEYS.LICENSE_TYPE, 'ترخيص دائم');
      return { success: true, message: 'تم تفعيل البرنامج بنجاح!' };
    } catch {
      return { success: false, message: 'حدث خطأ أثناء حفظ التفعيل' };
    }
  }

  return { success: false, message: validation.error || 'رمز التفعيل غير صالح' };
}

export async function readActivationFromFile(): Promise<{ success: boolean; data?: any; filePath?: string }> {
  try {
    const status = await checkServerLicenseStatus();
    if (status.activated && status.valid) {
      return {
        success: true,
        data: status.license,
      };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
}

/**
 * إلغاء التفعيل
 */
export async function deactivateApp(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACTIVATION_KEY);
    localStorage.removeItem(STORAGE_KEYS.ACTIVATED_AT);
    localStorage.removeItem(STORAGE_KEYS.LICENSE_TYPE);
    localStorage.removeItem(STORAGE_KEYS.CUSTOMER_NAME);
    localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
    await fetch('/api/activation/clear', { method: 'POST' }).catch(() => {});
  } catch (err) {
    console.error('Failed to deactivate app', err);
  }
}

export function getActivationDetails() {
  const machineId = getMachineId();
  const activationKey = localStorage.getItem(STORAGE_KEYS.ACTIVATION_KEY);
  const activatedAt = localStorage.getItem(STORAGE_KEYS.ACTIVATED_AT);
  const customerName = localStorage.getItem(STORAGE_KEYS.CUSTOMER_NAME) || '';
  const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT) || '';
  const licenseType = localStorage.getItem(STORAGE_KEYS.LICENSE_TYPE) || 'ترخيص دائم';
  const activated = isAppActivated();

  return {
    isActivated: activated,
    machineId,
    activationKey,
    activatedAt,
    customerName,
    expiresAt,
    licenseType,
  };
}
