import { generateKeyPairSync } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * سكربت توليد زوج مفاتيح RSA-SHA256 (المفتاح الخاص والمفتاح العام)
 * يُشغل هذا السكربت مرة واحدة فقط على جهاز المطوّر.
 * 
 * المخرجات:
 * 1. private-key.pem  ← يبقى عند المطوّر فقط ولا يُنشر مع التطبيق أبداً
 * 2. public-key.pem   ← يُدمج المفتاح العام داخل lib/public-key.ts
 */
export function generateRsaKeys() {
  console.log('⚡ جاري توليد زوج مفاتيح RSA 2048-bit...');

  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  const currentFileUrl = import.meta.url;
  const currentFilePath = fileURLToPath(currentFileUrl);
  const toolsDir = path.dirname(currentFilePath);
  const projectRoot = path.resolve(toolsDir, '..');
  const privateKeyPath = path.join(projectRoot, 'private-key.pem');
  const publicKeyPath = path.join(projectRoot, 'public-key.pem');
  const publicKeyTsPath = path.join(projectRoot, 'lib', 'public-key.ts');

  // 1. حفظ المفتاح الخاص على جهاز المطور
  fs.writeFileSync(privateKeyPath, privateKey, 'utf8');
  console.log(`✅ تم حفظ المفتاح الخاص في: ${privateKeyPath}`);
  console.log('⚠️ تحذير أمني: احتفظ بهذا المفتاح بسرية تامة ولا ترفعه أبداً للعملاء أو لمستودع الكود العام.');

  // 2. حفظ ملف المفتاح العام PEM
  fs.writeFileSync(publicKeyPath, publicKey, 'utf8');
  console.log(`✅ تم حفظ المفتاح العام في: ${publicKeyPath}`);

  // التأكد من وجود مجلد lib
  const libDir = path.join(projectRoot, 'lib');
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }

  // 3. تحديث ملف lib/public-key.ts تلقائياً
  const tsContent = `/**
 * المفتاح العام المدمج للتحقق من التوقيع الرقمي للترخيص (RSA-SHA256)
 * يُدمج كـ string ثابت داخل التطبيق ولا يمثل أي خطورة أمنية.
 */
export const PUBLIC_KEY_PEM = \`${publicKey.trim()}\`;
`;

  fs.writeFileSync(publicKeyTsPath, tsContent, 'utf8');
  console.log(`✅ تم دمج المفتاح العام في: ${publicKeyTsPath}`);
}

generateRsaKeys();
