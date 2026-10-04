import fs from 'fs';
import { createVerify } from 'crypto';
import { LicenseFileContent, LicensePayload, LicenseVerificationResult } from './license-types';
import { getMachineFingerprint } from './machine-fingerprint';
import { PUBLIC_KEY_PEM } from './public-key';

/**
 * التحقق من صحة ترخيص البرنامج محلياً بدون إنترنت
 * التسلسل: التحقق من وجود الملف ← التحقق من التوقيع الرقمي (RSA-SHA256) ← مطابقة بصمة الجهاز ← فحص تاريخ الصلاحية
 */
export function verifyLicense(licensePathOrContent: string | LicenseFileContent): LicenseVerificationResult {
  try {
    let licenseContent: LicenseFileContent;

    if (typeof licensePathOrContent === 'string') {
      // إذا كان المدخل مسار ملف على القرص
      if (fs.existsSync(licensePathOrContent)) {
        const raw = fs.readFileSync(licensePathOrContent, 'utf8');
        licenseContent = JSON.parse(raw);
      } else {
        // أو قد يكون المدخل هو نص JSON مباشرة
        try {
          licenseContent = JSON.parse(licensePathOrContent);
        } catch {
          return {
            valid: false,
            reason: 'ملف الترخيص غير موجود',
          };
        }
      }
    } else {
      licenseContent = licensePathOrContent;
    }

    if (!licenseContent || !licenseContent.payload || !licenseContent.signature) {
      return {
        valid: false,
        reason: 'صيغة ملف الترخيص غير صالحة أو ناقصة',
      };
    }

    // 1. التحقق من التوقيع الرقمي بالمفتاح العام (RSA-SHA256)
    const verifier = createVerify('RSA-SHA256');
    verifier.update(licenseContent.payload);
    verifier.end();

    const isSignatureValid = verifier.verify(
      PUBLIC_KEY_PEM,
      Buffer.from(licenseContent.signature, 'base64')
    );

    if (!isSignatureValid) {
      return {
        valid: false,
        reason: 'التوقيع الرقمي غير صحيح — الترخيص مزوّر أو تم التعديل عليه',
      };
    }

    // 2. فك تشفير وفك ترميز بيانات الترخيص (Payload)
    const payloadJson = Buffer.from(licenseContent.payload, 'base64').toString('utf8');
    const licenseData: LicensePayload = JSON.parse(payloadJson);

    // 3. مطابقة بصمة الجهاز الحالية مع البصمة المسجلة في الترخيص
    const currentFingerprint = getMachineFingerprint();
    const licenseFingerprint = (licenseData.machineFingerprint || '').trim().toUpperCase();

    if (currentFingerprint !== licenseFingerprint) {
      return {
        valid: false,
        reason: 'هذا الترخيص مخصص لجهاز آخر ولا يتطابق مع بصمة هذا الجهاز',
        license: licenseData,
      };
    }

    // 4. التحقق من تاريخ انتهاء الصلاحية
    if (licenseData.expiresAt) {
      const expirationDate = new Date(licenseData.expiresAt);
      const now = new Date();

      if (now > expirationDate) {
        return {
          valid: false,
          reason: `انتهت صلاحية الترخيص في تاريخ: ${expirationDate.toISOString().split('T')[0]}`,
          license: licenseData,
        };
      }
    }

    // الترخيص سليم وموثوق 100%
    return {
      valid: true,
      license: licenseData,
    };
  } catch (err: any) {
    return {
      valid: false,
      reason: `فشل التحقق من الترخيص: ${err.message || 'خطأ غير معروف'}`,
    };
  }
}
