import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { createSign } from 'crypto';
import { fileURLToPath } from 'url';
import { LicenseFileContent, LicensePayload } from '../lib/license-types';

const currentFileUrl = import.meta.url;
const currentFilePath = fileURLToPath(currentFileUrl);
const toolsDir = path.dirname(currentFilePath);
const projectRoot = path.resolve(toolsDir, '..');
const privateKeyPath = path.join(projectRoot, 'private-key.pem');

/**
 * سكربت CLI لتوليد وتوقيع ترخيص العميل بمفتاح RSA الخاص (RSA-SHA256)
 * يدعم الاستخدام التفاعلي (Interactive Prompt) أو تمرير المعاملات كـ CLI arguments.
 */
function createPrompt(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

export function signLicense(payload: LicensePayload, privateKeyPem: string): LicenseFileContent {
  const payloadJson = JSON.stringify(payload, null, 2);
  const payloadBase64 = Buffer.from(payloadJson, 'utf8').toString('base64');

  const signer = createSign('RSA-SHA256');
  signer.update(payloadBase64);
  signer.end();

  const signature = signer.sign(privateKeyPem, 'base64');

  return {
    payload: payloadBase64,
    signature,
  };
}

async function main() {
  console.log('\n======================================================');
  console.log('   🔑 أداة توليد تراخيص CommessionalHal (RSA-SHA256)   ');
  console.log('======================================================\n');

  if (!fs.existsSync(privateKeyPath)) {
    console.error('❌ خطأ: ملف المفتاح الخاص (private-key.pem) غير موجود.');
    console.error('يرجى تشغيل أمر توليد المفاتيح أولاً:');
    console.error('  npx tsx tools/generate-keys.ts\n');
    process.exit(1);
  }

  const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');

  // هل تم تمرير معاملات عبر سطر الأوامر؟
  const args = process.argv.slice(2);
  const isDirectArgsMode = args.length > 0;

  // 1. بصمة الجهاز
  let fingerprint = args[0] || '';
  if (!fingerprint && !isDirectArgsMode) {
    fingerprint = await createPrompt('📋 أدخل بصمة جهاز العميل (Machine Fingerprint): ');
  }
  fingerprint = fingerprint.trim().toUpperCase();

  if (!fingerprint) {
    console.error('❌ خطأ: بصمة الجهاز مطلوبة.');
    process.exit(1);
  }

  // 2. اسم العميل
  let customerName = args[1] || '';
  if (!customerName && !isDirectArgsMode) {
    customerName = await createPrompt('👤 أدخل اسم العميل أو اسم المنشأة: ');
  }
  customerName = customerName.trim() || 'عميل معتمد';

  // 3. مدة الصلاحية / تاريخ الانتهاء
  let expiresInput = args[2] || '';
  if (!expiresInput && !isDirectArgsMode) {
    expiresInput = await createPrompt('📅 تاريخ الانتهاء (YYYY-MM-DD) أو اضغط Enter لترخيص دائم مدى الحياة: ');
  }

  let expiresAt: string | null = null;
  if (expiresInput.trim()) {
    const parsedDate = new Date(expiresInput.trim());
    if (isNaN(parsedDate.getTime())) {
      console.error('❌ خطأ: تاريخ غير صالح.');
      process.exit(1);
    }
    expiresAt = parsedDate.toISOString();
  }

  // بناء حمولة الترخيص (Payload)
  const payload: LicensePayload = {
    version: 1,
    machineFingerprint: fingerprint,
    customerName,
    productName: 'CommessionalHal',
    issuedAt: new Date().toISOString(),
    expiresAt,
    features: ['invoices', 'vouchers', 'reports', 'accounts', 'items', 'backup'],
  };

  // توقيع الترخيص رقمياً بمفتاح RSA
  const licenseFileContent = signLicense(payload, privateKeyPem);

  // حفظ ملف الترخيص
  const defaultLicensePath = path.join(projectRoot, 'config', 'license.json');
  const customOutputPath = path.join(projectRoot, `license_${customerName.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')}.json`);

  const configDir = path.join(projectRoot, 'config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(defaultLicensePath, JSON.stringify(licenseFileContent, null, 2), 'utf8');
  fs.writeFileSync(customOutputPath, JSON.stringify(licenseFileContent, null, 2), 'utf8');

  console.log('✅ تم توليد وتوقيع الترخيص بنجاح!');
  console.log('------------------------------------------------------');
  console.log(`👤 العميل: ${customerName}`);
  console.log(`💻 بصمة الجهاز: ${fingerprint}`);
  console.log(`⏳ نوع الترخيص: ${expiresAt ? `مؤقت حتى ${expiresAt.split('T')[0]}` : 'دائم مدى الحياة'}`);
  console.log(`📁 تم حفظ الملف في: ${defaultLicensePath}`);
  console.log(`📁 نسخة إضافية: ${customOutputPath}`);
  console.log('\n✉️ أرسل ملف (license.json) للعميل ليضعه في مجلد config أو يستورده من شاشة التفعيل.');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('حدث خطأ أثناء توليد الترخيص:', err);
});
