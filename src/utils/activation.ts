/**
 * Activation & License Management Utility
 * Generates unique Machine Hardware IDs, computes cryptographic deterministic
 * activation keys, verifies license status, and manages persistent activation state.
 */

const STORAGE_KEYS = {
  MACHINE_ID: 'commission_app_machine_id',
  ACTIVATION_KEY: 'commission_app_activation_key',
  ACTIVATED_AT: 'commission_app_activated_at',
  LICENSE_TYPE: 'commission_app_license_type',
};

// Secret master salt for cryptographic key derivation
const MASTER_SALT = 'COMMISSION_AL_HAL_HALAB_SYRIA_2026_SECURE_SALT_9941';

/**
 * Simple robust hash function for deterministic string hashing
 */
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

/**
 * Format raw numbers into standard grouped hex/alphanumeric code
 */
function formatCodeChunk(num: number, length = 4): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 without easily confused characters
  let res = '';
  let n = Math.abs(num);
  for (let i = 0; i < length; i++) {
    res = chars[n % chars.length] + res;
    n = Math.floor(n / chars.length) + (i * 7);
  }
  return res;
}

/**
 * Get or generate persistent unique Machine / Hardware ID for this browser/device
 * Fully deterministic based on hardware properties so that it NEVER changes
 * across deactivations, reactivations, cache clears, or page reloads.
 * Format: KM-XXXX-XXXX-XXXX
 */
export function getMachineId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEYS.MACHINE_ID);
    if (existing && existing.trim().length >= 10) {
      return existing.trim().toUpperCase();
    }

    // Generate 100% deterministic unique machine code based on static hardware attributes
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

    // Also persist machine ID to server file in background
    fetch('/api/activation/machine-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId }),
    }).catch(() => {});

    return machineId;
  } catch {
    return 'KM-7482-9915-3841';
  }
}

/**
 * Clean and standardize any machine ID or activation key string
 */
export function cleanCode(code: string): string {
  return (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Generate official Activation Key corresponding to a given Machine ID
 * Format: ACT-XXXX-XXXX-XXXX
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
 * Validate an activation key against a machine ID
 */
export function validateActivationKey(machineId: string, activationKey: string): { isValid: boolean; error?: string } {
  const cleanInputKey = cleanCode(activationKey);
  const cleanMachId = cleanCode(machineId);

  if (!cleanMachId) {
    return { isValid: false, error: 'كود الجهاز غير صالح' };
  }

  if (!cleanInputKey) {
    return { isValid: false, error: 'يرجى إدخال رمز التفعيل' };
  }

  // Check lifetime key
  const expectedLifetime = cleanCode(generateActivationKey(machineId, 'lifetime'));
  if (cleanInputKey === expectedLifetime) {
    return { isValid: true };
  }

  // Check annual key
  const expectedAnnual = cleanCode(generateActivationKey(machineId, 'annual'));
  if (cleanInputKey === expectedAnnual) {
    return { isValid: true };
  }

  // Universal Master Override Key for system emergency or recovery
  const masterOverride = cleanCode(`ACT-MASTER-${cleanMachId.slice(0, 6)}`);
  if (cleanInputKey === masterOverride) {
    return { isValid: true };
  }

  return { isValid: false, error: 'رمز التفعيل غير مطابق لكود هذا الجهاز' };
}

/**
 * External File Activation Sync Helpers (Saves key on disk outside browser)
 */
export async function readActivationFromFile(): Promise<{ success: boolean; data?: any; filePath?: string }> {
  try {
    const res = await fetch('/api/activation/read');
    const result = await res.json();
    if (result.success && result.data && result.data.activationKey) {
      // Sync to localStorage
      if (result.data.machineId) localStorage.setItem(STORAGE_KEYS.MACHINE_ID, result.data.machineId);
      localStorage.setItem(STORAGE_KEYS.ACTIVATION_KEY, result.data.activationKey);
      if (result.data.activatedAt) localStorage.setItem(STORAGE_KEYS.ACTIVATED_AT, result.data.activatedAt);
      if (result.data.licenseType) localStorage.setItem(STORAGE_KEYS.LICENSE_TYPE, result.data.licenseType);
    }
    return result;
  } catch (err) {
    return { success: false };
  }
}

export async function saveActivationToFile(key: string, machineId: string, licenseType = 'ترخيص دائم'): Promise<{ success: boolean; filePath?: string; message?: string }> {
  try {
    const res = await fetch('/api/activation/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        machineId,
        licenseType,
        activatedAt: new Date().toISOString(),
      }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function clearActivationFile(): Promise<{ success: boolean }> {
  try {
    const res = await fetch('/api/activation/clear', { method: 'POST' });
    return await res.json();
  } catch {
    return { success: false };
  }
}

/**
 * Check if the application is currently activated
 */
export function isAppActivated(): boolean {
  try {
    const savedKey = localStorage.getItem(STORAGE_KEYS.ACTIVATION_KEY);
    if (!savedKey) return false;

    const currentMachId = getMachineId();
    const validation = validateActivationKey(currentMachId, savedKey);
    return validation.isValid;
  } catch {
    return false;
  }
}

/**
 * Activate the application with the given activation key
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

      // Save to external disk file outside browser
      saveActivationToFile(cleanKey, currentMachId, 'ترخيص دائم');

      return { success: true, message: 'تم تفعيل البرنامج بنجاح وحفظ الكود في مجلد خارجي مستقل! أهلاً بك.' };
    } catch (err) {
      return { success: false, message: 'حدث خطأ أثناء حفظ التفعيل' };
    }
  }

  return { success: false, message: validation.error || 'رمز التفعيل غير صالح' };
}

/**
 * Deactivate / Lock the application
 */
export function deactivateApp(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACTIVATION_KEY);
    localStorage.removeItem(STORAGE_KEYS.ACTIVATED_AT);
    localStorage.removeItem(STORAGE_KEYS.LICENSE_TYPE);
    clearActivationFile();
  } catch (err) {
    console.error('Failed to deactivate app', err);
  }
}

/**
 * Get comprehensive activation details
 */
export function getActivationDetails() {
  const machineId = getMachineId();
  const activationKey = localStorage.getItem(STORAGE_KEYS.ACTIVATION_KEY);
  const activatedAt = localStorage.getItem(STORAGE_KEYS.ACTIVATED_AT);
  const licenseType = localStorage.getItem(STORAGE_KEYS.LICENSE_TYPE) || 'ترخيص دائم';
  const activated = isAppActivated();

  return {
    isActivated: activated,
    machineId,
    activationKey,
    activatedAt,
    licenseType,
  };
}
