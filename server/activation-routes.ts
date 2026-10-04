import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getMachineFingerprint } from '../lib/machine-fingerprint';
import { verifyLicense } from '../lib/license-verifier';
import { MachineIdFileContent, LicenseFileContent } from '../lib/license-types';

const router = Router();
const projectRoot = process.cwd();
const configDir = path.join(projectRoot, 'config');
const machineIdPath = path.join(configDir, 'machine_id.json');
const licensePath = path.join(configDir, 'license.json');

// التأكد من وجود مجلد config
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

/**
 * 1. GET /api/activation/machine-id
 * حساب وحفظ واسترجاع بصمة الجهاز الرسمية
 */
router.get('/machine-id', (req: Request, res: Response) => {
  try {
    const fingerprint = getMachineFingerprint();
    let machineInfo: MachineIdFileContent;

    if (fs.existsSync(machineIdPath)) {
      try {
        const raw = fs.readFileSync(machineIdPath, 'utf8');
        machineInfo = JSON.parse(raw);
        // تحديث البصمة إذا تغيرت مع الحفاظ على تاريخ الإنشاء الأصلي
        if (machineInfo.fingerprint !== fingerprint) {
          machineInfo.fingerprint = fingerprint;
          machineInfo.platform = process.platform;
          machineInfo.arch = process.arch;
          fs.writeFileSync(machineIdPath, JSON.stringify(machineInfo, null, 2), 'utf8');
        }
      } catch {
        machineInfo = {
          fingerprint,
          createdAt: new Date().toISOString(),
          platform: process.platform,
          arch: process.arch,
        };
        fs.writeFileSync(machineIdPath, JSON.stringify(machineInfo, null, 2), 'utf8');
      }
    } else {
      machineInfo = {
        fingerprint,
        createdAt: new Date().toISOString(),
        platform: process.platform,
        arch: process.arch,
      };
      fs.writeFileSync(machineIdPath, JSON.stringify(machineInfo, null, 2), 'utf8');
    }

    return res.json({
      success: true,
      fingerprint: machineInfo.fingerprint,
      createdAt: machineInfo.createdAt,
      platform: machineInfo.platform || process.platform,
      arch: machineInfo.arch || process.arch,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'فشل جلب بصمة الجهاز',
    });
  }
});

/**
 * 2. GET /api/activation/status
 * فحص حالة التفعيل الحالية والتحقق من ملف الترخيص على القرص
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const fingerprint = getMachineFingerprint();

    if (!fs.existsSync(licensePath)) {
      return res.json({
        activated: false,
        valid: false,
        reason: 'ملف الترخيص غير موجود في مجلد config',
        fingerprint,
      });
    }

    const verification = verifyLicense(licensePath);

    return res.json({
      activated: verification.valid,
      valid: verification.valid,
      reason: verification.reason,
      license: verification.license,
      fingerprint,
    });
  } catch (err: any) {
    return res.json({
      activated: false,
      valid: false,
      error: err.message,
    });
  }
});

/**
 * 3. POST /api/activation/import-license
 * استيراد وتفعيل ملف ترخيص جديد أو نص JSON
 */
router.post('/import-license', (req: Request, res: Response) => {
  try {
    const { licenseContent, payload, signature } = req.body;

    let licenseObj: LicenseFileContent;

    if (payload && signature) {
      licenseObj = { payload, signature };
    } else if (typeof licenseContent === 'string') {
      try {
        licenseObj = JSON.parse(licenseContent);
      } catch {
        return res.status(400).json({
          success: false,
          error: 'صيغة محتوى ملف الترخيص غير صالحة',
        });
      }
    } else if (licenseContent && typeof licenseContent === 'object') {
      licenseObj = licenseContent;
    } else {
      return res.status(400).json({
        success: false,
        error: 'بيانات الترخيص مطلوبة',
      });
    }

    // التحقق من صحة التوقيع والبصمة والصلاحية
    const verification = verifyLicense(licenseObj);

    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        error: verification.reason || 'الترخيص غير صالح',
        license: verification.license,
      });
    }

    // حفظ الترخيص على القرص في config/license.json
    fs.writeFileSync(licensePath, JSON.stringify(licenseObj, null, 2), 'utf8');

    return res.json({
      success: true,
      message: 'تم تفعيل وترخيص البرنامج بنجاح!',
      license: verification.license,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'حدث خطأ أثناء تفعيل الترخيص',
    });
  }
});

/**
 * 4. POST /api/activation/clear
 * إلغاء التفعيل ومسح ملف الترخيص من القرص
 */
router.post('/clear', (req: Request, res: Response) => {
  try {
    if (fs.existsSync(licensePath)) {
      fs.unlinkSync(licensePath);
    }
    return res.json({
      success: true,
      message: 'تم إلغاء التفعيل ومسح ملف الترخيص بنجاح',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'فشل مسح ملف الترخيص',
    });
  }
});

export default router;
