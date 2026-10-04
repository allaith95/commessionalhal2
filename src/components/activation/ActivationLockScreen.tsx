import React, { useState, useEffect } from 'react';
import {
  Lock,
  Copy,
  Check,
  ClipboardPaste,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  MessageSquareShare,
  Building2,
} from 'lucide-react';
import {
  getMachineId,
  fetchServerMachineFingerprint,
  checkServerLicenseStatus,
  importLicense,
  activateApp,
} from '../../utils/activation';

interface ActivationLockScreenProps {
  onActivated: () => void;
}

export const ActivationLockScreen: React.FC<ActivationLockScreenProps> = ({
  onActivated,
}) => {
  const [machineId, setMachineId] = useState<string>(() => getMachineId());
  const [activationKeyInput, setActivationKeyInput] = useState<string>('');
  const [copiedMachineId, setCopiedMachineId] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // 1. جلب البصمة الرسمية من السيرفر
    fetchServerMachineFingerprint().then((fp) => {
      if (fp) setMachineId(fp);
    });

    // 2. فحص ما إذا كان هناك ترخيص صالح مسبقاً في config/license.json
    checkServerLicenseStatus().then((status) => {
      if (status.activated && status.valid) {
        setSuccessMessage(`البرنامج مرخص باسم: ${status.license?.customerName || 'العميل'}`);
        setTimeout(() => {
          onActivated();
        }, 600);
      }
    });
  }, [onActivated]);

  const handleCopyMachineId = () => {
    const currentId = machineId || getMachineId();
    if (!currentId) return;
    navigator.clipboard.writeText(currentId);
    setCopiedMachineId(true);
    setTimeout(() => setCopiedMachineId(false), 2500);
  };

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setActivationKeyInput(text.trim());
        setErrorMessage(null);
      }
    } catch {
      // Fallback
    }
  };

  const handleRequestWhatsApp = () => {
    const currentId = machineId || getMachineId();
    const rawPhoneNumber = '963984463801';
    const message = `طلب تفعيل إدارة الكمسيون والحسابات (CommessionalHal)\nرمز الجهاز:\n${currentId}\n\nشكراً لثقتكم شركة أبديت لحلول الأعمال`;
    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${rawPhoneNumber}?text=${encoded}`;
    
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const processActivation = async (inputStr: string) => {
    const trimmed = inputStr.trim();
    if (!trimmed) {
      setErrorMessage('يرجى إدخال رمز التفعيل أولاً');
      return;
    }

    setIsChecking(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // محاولة 1: استيراد ملف الترخيص الرقمي RSA (JSON)
      if (trimmed.startsWith('{') || trimmed.includes('"payload"') || trimmed.includes('"signature"')) {
        const result = await importLicense(trimmed);
        setIsChecking(false);
        if (result.success && result.license) {
          setSuccessMessage(`تم تفعيل الترخيص بنجاح للعميل (${result.license.customerName})!`);
          setTimeout(() => {
            onActivated();
          }, 700);
          return;
        } else {
          setErrorMessage(result.error || 'ملف الترخيص غير صالح لهذا الجهاز!');
          return;
        }
      }

      // محاولة 2: تفعيل عبر مفتاح كودي ACT-XXXX-XXXX-XXXX
      const legacyResult = activateApp(trimmed);
      setIsChecking(false);

      if (legacyResult.success) {
        setSuccessMessage(legacyResult.message);
        setTimeout(() => {
          onActivated();
        }, 700);
      } else {
        setErrorMessage(legacyResult.message || 'رمز التفعيل غير صالح لهذا الجهاز!');
      }
    } catch (err: any) {
      setIsChecking(false);
      setErrorMessage(err.message || 'حدث خطأ أثناء التفعيل');
    }
  };

  const handleActivate = () => {
    processActivation(activationKeyInput);
  };

  return (
    <div
      className="min-h-screen w-full bg-[#182330] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2a3b4c] via-[#1a2533] to-[#0f1722] flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 select-none antialiased"
      dir="rtl"
    >
      {/* Background Decorative Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Lock Container Card */}
      <div className="w-full max-w-lg bg-[#223040]/95 backdrop-blur-xl border border-slate-600/80 rounded-2xl shadow-2xl overflow-hidden relative z-10 flex flex-col">
        {/* Header */}
        <div className="bg-[#192432] border-b border-slate-700/80 p-5 sm:p-6 flex items-center justify-center">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg border border-amber-400/30 shrink-0">
              <Lock className="w-6 h-6 text-slate-950 font-black" />
            </div>
            <h1 className="text-xl font-black text-white tracking-wide">
              تفعيل البرنامج
            </h1>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 flex flex-col gap-4">
          
          {/* Action Buttons: Copy Machine Code & Request via WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleCopyMachineId}
              className="py-3 px-4 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm active:scale-98"
              title="نسخ رمز الجهاز إلى الحافظة"
            >
              {copiedMachineId ? (
                <>
                  <Check className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-300">تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 text-amber-400" />
                  <span>نسخ الرمز</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleRequestWhatsApp}
              className="py-3 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black text-sm rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-98"
              title="طلب تفعيل البرنامج عبر واتساب"
            >
              <MessageSquareShare className="w-5 h-5 text-slate-950" />
              <span>طلب تفعيل واتساب</span>
            </button>
          </div>

          {/* Activation Key Input with Paste Button */}
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handlePasteKey}
                className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1.5 cursor-pointer bg-slate-800/90 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 shadow-sm transition-colors"
                title="لصق الرمز من الحافظة"
              >
                <ClipboardPaste className="w-4 h-4" />
                <span>زر لصق</span>
              </button>
            </div>

            <div className="relative">
              <textarea
                rows={3}
                value={activationKeyInput}
                onChange={(e) => {
                  setActivationKeyInput(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder=""
                className="w-full bg-[#121a24] text-emerald-300 border border-slate-600 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-400/30 transition-all select-all shadow-inner resize-none"
              ></textarea>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-rose-500/20 border border-rose-400/60 text-rose-200 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-bold">{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="bg-emerald-500/25 border border-emerald-400 text-emerald-200 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
              <span className="font-bold text-sm">{successMessage} جاري الدخول...</span>
            </div>
          )}

          {/* Submit Activation Button */}
          <button
            type="button"
            onClick={handleActivate}
            disabled={isChecking || Boolean(successMessage)}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-sm sm:text-base rounded-xl shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
          >
            <Sparkles className="w-5 h-5 text-amber-300" />
            <span>{isChecking ? 'جاري التحقق من الترخيص...' : 'تفعيل البرنامج'}</span>
          </button>
        </div>

        {/* Footer with Company Info */}
        <div className="bg-[#17212d] border-t border-slate-700/80 px-5 py-3 text-center text-xs text-slate-300 flex items-center justify-center">
          <span className="flex items-center gap-1.5 text-amber-300 font-bold">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>شركة أبديت لحلول الأعمال</span>
          </span>
        </div>
      </div>
    </div>
  );
};
