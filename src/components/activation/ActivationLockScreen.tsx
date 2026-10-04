import React, { useState, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  Copy,
  Check,
  ClipboardPaste,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileKey,
  ShieldCheck,
  MessageSquareShare,
  Send,
  Building2,
  ExternalLink,
  Cpu,
} from 'lucide-react';
import {
  getMachineId,
  activateApp,
} from '../../utils/activation';
import { KeyGeneratorModal } from './KeyGeneratorModal';

interface ActivationLockScreenProps {
  onActivated: () => void;
}

export const ActivationLockScreen: React.FC<ActivationLockScreenProps> = ({
  onActivated,
}) => {
  const [machineId, setMachineId] = useState<string>('');
  const [activationKeyInput, setActivationKeyInput] = useState<string>('');
  const [copiedMachineId, setCopiedMachineId] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [showKeyGenerator, setShowKeyGenerator] = useState(false);

  useEffect(() => {
    const id = getMachineId();
    setMachineId(id);
  }, []);

  const handleCopyMachineId = () => {
    if (!machineId) return;
    navigator.clipboard.writeText(machineId);
    setCopiedMachineId(true);
    setTimeout(() => setCopiedMachineId(false), 2500);
  };

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setActivationKeyInput(text.trim().toUpperCase());
        setErrorMessage(null);
      }
    } catch {
      // Fallback
    }
  };

  // WhatsApp activation request handler
  const handleRequestWhatsApp = () => {
    const currentId = machineId || getMachineId();
    const rawPhoneNumber = '963984463801';
    const message = `طلب تفعيل إدارة الكمسيون والحسابات\nرمز الجهاز:\n${currentId}\n\nشكرا لثقتكم شركة ابديت لحلول الاعمال`;
    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${rawPhoneNumber}?text=${encoded}`;
    
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleActivate = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const key = activationKeyInput.trim();
    if (!key) {
      setErrorMessage('يرجى إدخال رمز التفعيل أولاً');
      return;
    }

    setIsChecking(true);

    setTimeout(() => {
      const result = activateApp(key);
      setIsChecking(false);

      if (result.success) {
        setSuccessMessage(result.message);
        setTimeout(() => {
          onActivated();
        }, 500);
      } else {
        setErrorMessage(result.message || 'رمز التفعيل غير صالح لهذا الجهاز!');
      }
    }, 150);
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
        <div className="bg-[#192432] border-b border-slate-700/80 p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg border border-amber-400/30 shrink-0">
              <Lock className="w-6 h-6 text-slate-950 font-black" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-wide">
                برنامج كمسيون لإدارة أسواق الهال
              </h1>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>شاشة تفعيل وترخيص البرنامج</span>
              </p>
            </div>
          </div>

          <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[11px] px-2.5 py-1 rounded-full font-bold shadow-xs">
            ترخيص دائم
          </span>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 flex flex-col gap-4">
          
          {/* Section 1: Machine ID (رمز الجهاز مع زر النسخ) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileKey className="w-4 h-4 text-amber-400" />
                <span>رمز الجهاز (كود جهازك الفريد):</span>
              </span>
              <span className="text-[11px] text-amber-300 font-bold">
                نسخة واحدة للجهاز
              </span>
            </label>

            <div className="flex items-center gap-2 bg-[#121a24] border border-slate-700 rounded-xl p-2 shadow-inner">
              <span className="flex-1 font-mono text-base sm:text-lg font-black text-amber-300 tracking-wider px-2 text-center select-all">
                {machineId || 'KM-....-....-....'}
              </span>

              <button
                type="button"
                onClick={handleCopyMachineId}
                className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
                title="نسخ رمز الجهاز إلى الحافظة"
              >
                {copiedMachineId ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300">تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>نسخ الرمز</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Request Activation via WhatsApp (00963984463801) */}
          <div className="bg-[#15231c] border border-emerald-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3 text-right w-full sm:w-auto">
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/20 border border-[#25D366]/40 flex items-center justify-center shrink-0">
                <MessageSquareShare className="w-5 h-5 text-[#25D366]" />
              </div>
              <div>
                <span className="text-xs font-black text-emerald-200 block">طلب رمز التفعيل عبر واتساب:</span>
                <span className="text-[11px] text-slate-300 font-mono" dir="ltr">00963 984 463 801</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRequestWhatsApp}
              className="w-full sm:w-auto px-4 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
              title="إرسال طلب تفعيل إدارة الكمسيون والحسابات إلى واتساب"
            >
              <Send className="w-4 h-4 text-slate-950 rotate-180" />
              <span>إرسال طلب التفعيل</span>
            </button>
          </div>

          {/* Section 3: Activation Key Input (إدخال رمز التفعيل) */}
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>أدخل رمز التفعيل المستلم:</span>
              </label>

              <button
                type="button"
                onClick={handlePasteKey}
                className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 cursor-pointer bg-slate-800/80 px-2 py-1 rounded border border-slate-700"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>لصق من الحافظة</span>
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={activationKeyInput}
                onChange={(e) => {
                  setActivationKeyInput(e.target.value.toUpperCase());
                  setErrorMessage(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleActivate();
                }}
                placeholder="ACT-XXXX-XXXX-XXXX"
                className="w-full bg-[#121a24] text-emerald-300 border border-slate-600 focus:border-emerald-400 rounded-xl px-3.5 py-3 text-sm sm:text-base font-mono font-bold tracking-widest text-center uppercase focus:outline-none focus:ring-2 focus:ring-emerald-400/30 transition-all select-all shadow-inner"
              />
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
            <span>{isChecking ? 'جاري التحقق من الرمز...' : 'تفعيل البرنامج'}</span>
          </button>

          {/* Key Generator / Admin Section */}
          <div className="pt-2 border-t border-slate-700/60 flex items-center justify-center text-xs">
            <button
              type="button"
              onClick={() => setShowKeyGenerator(true)}
              className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>لوحة توليد التراخيص (للموزع والإدارة)</span>
            </button>
          </div>
        </div>

        {/* Footer with Company Info */}
        <div className="bg-[#17212d] border-t border-slate-700/80 px-5 py-3 text-center text-xs text-slate-300 flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-1.5 text-amber-300 font-bold">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>شركة أبديت لحلول الأعمال</span>
          </span>
          <span className="font-mono text-slate-400 text-[11px]">
            واتساب: 00963984463801
          </span>
        </div>
      </div>

      {/* Embedded Key Generator Modal */}
      <KeyGeneratorModal
        isOpen={showKeyGenerator}
        onClose={() => setShowKeyGenerator(false)}
        onActivated={onActivated}
        initialMachineId={machineId}
      />
    </div>
  );
};
