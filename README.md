# نظام تفعيل وترخيص CommessionalHal (RSA-SHA256)

نظام متكامل لتفعيل وترخيص برنامج إدارة الكمسيون والحسابات (**CommessionalHal**)، يعمل بدون اتصال بالإنترنت (Offline License Verification) ويعتمد على التوقيع الرقمي بمفتاح RSA 2048-bit وبصمة العتاد الفريدة للجهاز (Hardware Fingerprint).

---

## 🏛️ بنية النظام (Architecture)

يتكون النظام من ثلاث طبقات متكاملة:

```
[1] جهاز المطوّر (Developer Side - CLI Tool)
    ├── private-key.pem (المفتاح الخاص - سري 100%)
    └── tools/generate-license.ts (توليد وتوقيع ملف الترخيص)

[2] خادم التطبيق (Client Backend - Express & Node.js)
    ├── lib/machine-fingerprint.ts (بصمة العتاد SHA-256)
    ├── lib/public-key.ts (المفتاح العام المدمج)
    ├── lib/license-verifier.ts (التحقق من التوقيع والبصمة والصلاحية)
    └── server/activation-routes.ts (نقاط نهاية التفعيل)

[3] واجهة المستخدم (Client Frontend - React 19)
    ├── src/components/activation/ActivationLockScreen.tsx (شاشة القفل والتفعيل)
    └── src/components/activation/KeyGeneratorModal.tsx (لوحة توليد التراخيص المدمجة)
```

---

## 📁 هيكلية الملفات

```
📁 lib/
  ├── license-types.ts        ← تعريفات TypeScript للترخيص وحمولة البيانات
  ├── machine-fingerprint.ts  ← حساب بصمة الجهاز باستخدام node-machine-id + SHA-256
  ├── public-key.ts           ← المفتاح العام RSA مدمج كـ string
  └── license-verifier.ts     ← محرك التحقق الرقمي محلياً بدون إنترنت

📁 tools/
  ├── generate-keys.ts        ← توليد زوج مفاتيح RSA 2048-bit (يُشغل مرة واحدة)
  └── generate-license.ts     ← أداة CLI تفاعلية لتوليد وتوقيع ترخيص العميل

📁 server/
  └── activation-routes.ts    ← نقاط النهاية:
                                GET  /api/activation/machine-id
                                GET  /api/activation/status
                                POST /api/activation/import-license
                                POST /api/activation/clear

📁 config/
  ├── machine_id.json         ← يُنشأ تلقائياً عند أول تشغيل
  └── license.json            ← ملف الترخيص الموقّع رقمياً

📁 src/components/activation/
  ├── ActivationLockScreen.tsx ← شاشة التفعيل واستيراد الترخيص
  └── KeyGeneratorModal.tsx    ← لوحة الإدارة والموزع
```

---

## 📦 المكتبات المطلوبة

- `node-machine-id`: لقراءة معرف العتاد الفريد للوحة الأم/النظام
- `crypto`: مكتبة Node.js المدمجة (RSA-SHA256 & SHA-256)

أمر التثبيت:
```bash
npm install node-machine-id
```

---

## 🚀 دليل الاستخدام والتشغيل

### الخطوة 1: توليد المفاتيح (على جهاز المطوّر - مرة واحدة فقط)
```bash
npx tsx tools/generate-keys.ts
```
- ينشئ `private-key.pem` (احتفظ به بسرية ولا ترفعه مع النسخة المرسلة للعميل).
- ينشئ `public-key.pem` ويدمجه تلقائياً داخل `lib/public-key.ts`.

---

### الخطوة 2: العميل يرسل بصمة جهازه
1. يفتح العميل التطبيق لأول مرة.
2. تظهر شاشة التفعيل وتستعرض **بصمة الجهاز (Machine Fingerprint)**.
3. يضغط العميل على **«نسخ البصمة»** ويرسلها إلى المطوّر عبر الواتساب أو البريد.

---

### الخطوة 3: المطوّر يولّد الترخيص للعميل
يشغّل المطوّر السكربت التفاعلي على جهازه:
```bash
npx tsx tools/generate-license.ts
```
أو بتمرير المعاملات مباشرة:
```bash
npx tsx tools/generate-license.ts "FINGERPRINT_HEX" "اسم العميل" "2027-12-31"
```
*(إذا تركت التاريخ فارغاً، يتم إنشاء ترخيص دائم مدى الحياة).*

الناتج: ينشئ السكربت ملف `license.json` موقّعاً رقمياً.

---

### الخطوة 4: تفعيل التطبيق عند العميل
يقوم العميل بأحد الخيارات التالية:
1. وضع ملف `license.json` مباشرة داخل مجلد `config/`
2. **أو** فتح شاشة التفعيل والضغط على **«استيراد ملف»** واختيار `license.json`
3. **أو** لصق محتوى الملف في مربع النص والضغط على **«تفعيل البرنامج»**

---

## 📄 مثال على ملف الترخيص المولد (`config/license.json`)

```json
{
  "payload": "eyJ2ZXJzaW9uIjoxLCJtYWNoaW5lRmluZ2VycHJpbnQiOiJBQkMxMjM0NTY3ODlERUZBIiwiY3VzdG9tZXJOYW1lIjoi2YXZg9iq2Kgg2KfZhNij2YXZhCDZhNmE2YPZhdiz2YrZiNmGIiwicHJvZHVjdE5hbWUiOiJDb21tZXNzaW9uYWxIYWwiLCJpc3N1ZWRBdCI6IjIwMjYtMTAtMDRUMDI6MDA6MDAuMDAwWiIsImV4cGlyZXNBdCI6bnVsbCwiZmVhdHVyZXMiOlsiaW52b2ljZXMiLCJ2b3VjaGVycyIsInJlcG9ydHMiXX0=",
  "signature": "k910ABCdEfgHIjKlmNOpqRStUVwXyz1234567890/AbCdEfGhIjKlMnOpQrStUvWxYz=="
}
```

عند فك ترميز `payload` تظهر البيانات كالتالي:
```json
{
  "version": 1,
  "machineFingerprint": "ABC123456789DEFA...",
  "customerName": "مكتب الأمل للكمسيون",
  "productName": "CommessionalHal",
  "issuedAt": "2026-10-04T02:00:00.000Z",
  "expiresAt": null,
  "features": ["invoices", "vouchers", "reports", "accounts", "items", "backup"]
}
```

---

## 🛡️ رسائل الأمان والتحقق

يقوم محرك `verifyLicense` بالتحقق الصارم بالترتيب الآتي مع رسائل عربية واضحة:
1. **فحص وجود وصيغة الملف**: *"ملف الترخيص غير موجود"* / *"صيغة ملف الترخيص غير صالحة"*
2. **فحص التوقيع بالمفتاح العام**: *"التوقيع الرقمي غير صحيح — الترخيص مزوّر أو تم التعديل عليه"*
3. **مطابقة بصمة العتاد**: *"هذا الترخيص مخصص لجهاز آخر ولا يتطابق مع بصمة هذا الجهاز"*
4. **فحص تاريخ الصلاحية**: *"انتهت صلاحية الترخيص في تاريخ: YYYY-MM-DD"*
