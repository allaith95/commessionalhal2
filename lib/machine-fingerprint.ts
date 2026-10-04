import { createHash } from 'crypto';
import { execSync } from 'child_process';
import os from 'os';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * دالة آمنة لجلب معرف عتاد الجهاز الأصلي (Hardware Machine ID)
 * تدعم Windows, Linux, macOS, FreeBSD مع بدائل قوية.
 */
function getNativeMachineId(): string {
  // 1. محاولة استخدام مكتبة node-machine-id بطريقة متوافقة مع CJS/ESM
  try {
    const nodeMachineId = require('node-machine-id');
    if (typeof nodeMachineId?.machineIdSync === 'function') {
      const id = nodeMachineId.machineIdSync(true);
      if (id && typeof id === 'string' && id.trim().length > 0) {
        return id.trim();
      }
    } else if (typeof nodeMachineId === 'function') {
      const id = nodeMachineId(true);
      if (id && typeof id === 'string' && id.trim().length > 0) {
        return id.trim();
      }
    }
  } catch {
    // المتابعة إلى الأوامر المباشرة للنظام
  }

  // 2. الاستعلام المباشر من نواة النظام حسب المنصة
  try {
    const platform = process.platform;

    if (platform === 'win32') {
      try {
        const cmd = 'REG QUERY HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid';
        const stdout = execSync(cmd, { timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
        const parts = stdout.split('REG_SZ');
        if (parts.length > 1) {
          return parts[1].replace(/[\r\n\s]/g, '').toLowerCase();
        }
      } catch {
        // تجربة wmic كخيار ثانٍ على ويندوز
        const stdout = execSync('wmic csproduct get uuid', { timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
        const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length > 1 && lines[1] && lines[1].toLowerCase() !== 'uuid') {
          return lines[1].toLowerCase();
        }
      }
    } else if (platform === 'linux') {
      // قراءة معرف لينكس من ملفات النظام
      const paths = ['/etc/machine-id', '/var/lib/dbus/machine-id'];
      for (const p of paths) {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf8').trim();
          if (content.length > 0) {
            return content.toLowerCase();
          }
        }
      }
    } else if (platform === 'darwin') {
      // macOS IOPlatformUUID
      const stdout = execSync('ioreg -rd1 -c IOPlatformExpertDevice', { timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
      const match = stdout.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/i);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    } else if (platform === 'freebsd') {
      const stdout = execSync('kenv -q smbios.system.uuid 2>/dev/null || sysctl -n kern.hostuuid', { timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (stdout) {
        return stdout.toLowerCase();
      }
    }
  } catch {
    // الانتقال للبديل الثابت
  }

  // 3. بديل عتاد ثابت يعتمد على بطاقة الشبكة والمعالج واسم الجهاز
  try {
    const networkInterfaces = os.networkInterfaces();
    let macAddress = '';
    for (const name of Object.keys(networkInterfaces)) {
      const list = networkInterfaces[name];
      if (list) {
        for (const iface of list) {
          if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
            macAddress = iface.mac;
            break;
          }
        }
      }
      if (macAddress) break;
    }

    return [
      os.hostname(),
      macAddress,
      os.platform(),
      os.arch(),
      os.cpus()?.[0]?.model || '',
      os.totalmem()?.toString() || '',
    ].filter(Boolean).join('##');
  } catch {
    return `${os.hostname()}:${process.platform}:${process.arch}`;
  }
}

/**
 * حساب البصمة الفريدة الثابتة لجهاز العميل (Machine Hardware Fingerprint)
 * تجمع بين معرف العتاد الأصلي للجهاز + نظام التشغيل + معمارية المعالج
 * وتُشفر النتيجة بالكامل بخوارزمية SHA-256 (hex).
 */
export function getMachineFingerprint(): string {
  try {
    const rawMachineId = getNativeMachineId();
    const combinedData = `${rawMachineId}:${process.platform}:${process.arch}`;
    const hash = createHash('sha256').update(combinedData, 'utf8').digest('hex');
    return hash.toUpperCase();
  } catch {
    const fallback = `${os.hostname()}:${process.platform}:${process.arch}`;
    return createHash('sha256').update(fallback, 'utf8').digest('hex').toUpperCase();
  }
}

