import React, { useState } from 'react';
import {
  KeyRound,
  Copy,
  Check,
  X,
  Zap,
  ClipboardPaste,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  generateActivationKey,
  getMachineId,
  activateApp,
} from '../../utils/activation';

interface KeyGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivated?: () => void;
  initialMachineId?: string;
}

export const KeyGeneratorModal: React.FC<KeyGeneratorModalProps> = ({
  isOpen,
  onClose,
  onActivated,
  initialMachineId,
}) => {
  const currentLocalMachineId = getMachineId();
  const [targetMachineId, setTargetMachineId] = useState(
    initialMachineId || currentLocalMachineId
  );
  const [generatedKey, setGeneratedKey] = useState<string>(() =>
    generateActivationKey(initialMachineId || currentLocalMachineId, 'lifetime')
  );
  const [copiedKey, setCopiedKey] = useState(false);
  const [appliedDirectly, setAppliedDirectly] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = () => {
    setErrorMsg(null);
    if (!targetMachineId.trim()) {
      setErrorMsg('يرجى إدخال أو لصق كود الجهاز أولاً');
      return;
    }
    const key = generateActivationKey(targetMachineId.trim(), 'lifetime');
    if (!key) {
      setErrorMsg('كود الجهاز غير صالح، تأكد من نسخه بشكل كامل');
      return;
    }
    setGeneratedKey(key);
    setCopiedKey(false);
    setAppliedDirectly(false);
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handlePasteTargetId = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTargetMachineId(text.trim().toUpperCase());
        setErrorMsg(null);
        const key = generateActivationKey(text.trim().toUpperCase(), 'lifetime');
        setGeneratedKey(key);
      }
    } catch {
      // Fallback
    }
  };

  const handleApplyToThisDevice = () => {
    if (!generatedKey) return;
    const res = activateApp(generatedKey);
    if (res.success) {
      setAppliedDirectly(true);
      if (onActivated) {
        setTimeout(() => {
          onActivated();
          onClose();
        }, 600);
      }
    }
  };

  const isCurrentDevice =
    targetMachineId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') ===
    currentLocalMachineId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="bg-[#1e293b] text-[#f8fafc] w-full max-w-[580px] rounded-2xl shadow-2xl border border-[#334155] relative flex flex-col overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-700/60 transition-colors cursor-pointer z-10"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="bg-[#0f172a] p-5 sm:p-6 border-b border-[#334155] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#d97706] flex items-center justify-center text-2xl shadow-lg shrink-0">
            🔑
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">
              أداة توليد رموز التفعيل (لوحة الإدارة والموزع)
            </h1>
            <p className="text-xs text-[#94a3b8] mt-1">
              نظام توليد تراخيص مدى الحياة لبرنامج كمسيون إدارة أسواق الهال
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">
          {/* Machine Code Input */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#cbd5e1]">
                كود الجهاز الفريد (Machine Hardware Code):
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTargetMachineId(currentLocalMachineId);
                    setErrorMsg(null);
                    const key = generateActivationKey(currentLocalMachineId, 'lifetime');
                    setGeneratedKey(key);
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>كود هذا الجهاز</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={targetMachineId}
                onChange={(e) => {
                  setTargetMachineId(e.target.value.toUpperCase());
                  setErrorMsg(null);
                  setAppliedDirectly(false);
                }}
                placeholder="مثال: KM-7482-9915-3841"
                className="flex-1 bg-[#0f172a] border border-[#475569] focus:border-[#f59e0b] text-[#f8fafc] px-3.5 py-3 rounded-lg font-mono text-sm font-bold tracking-widest text-center direction-ltr focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/20"
                dir="ltr"
              />
              <button
                type="button"
                onClick={handlePasteTargetId}
                className="px-4 py-3 bg-[#334155] hover:bg-[#475569] text-[#f8fafc] font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <ClipboardPaste className="w-4 h-4" />
                <span>لصق</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/15 border border-rose-500 text-rose-300 px-3.5 py-2.5 rounded-lg text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            className="w-full py-3.5 bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#34d399] hover:to-[#10b981] text-white font-extrabold text-sm rounded-xl shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <Sparkles className="w-4 h-4" />
            <span>⚡ توليد رمز التفعيل مدى الحياة (Lifetime Key)</span>
          </button>

          {/* Result Box */}
          {generatedKey && (
            <div className="bg-[#09131f] border-2 border-dashed border-[#10b981] rounded-xl p-4 flex flex-col gap-2.5 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between text-xs font-bold text-[#34d399]">
                <span>✅ تم توليد رمز التفعيل الدائم بنجاح:</span>
                <span>نوع الترخيص: مدى الحياة</span>
              </div>

              <div className="bg-[#020617] border border-[#1e293b] p-3.5 rounded-lg font-mono text-lg sm:text-xl font-black text-[#34d399] text-center tracking-widest select-all shadow-inner" dir="ltr">
                {generatedKey}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="flex-1 py-3 bg-[#10b981] hover:bg-[#34d399] text-[#020617] font-extrabold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {copiedKey ? (
                    <>
                      <Check className="w-4 h-4 text-[#020617]" />
                      <span>تم نسخ رمز التفعيل بنجاح!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>📄 نسخ رمز التفعيل لإرساله للعميل</span>
                    </>
                  )}
                </button>

                {isCurrentDevice && (
                  <button
                    type="button"
                    onClick={handleApplyToThisDevice}
                    disabled={appliedDirectly}
                    className="px-4 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-[#020617] rounded-lg text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                    title="تفعيل هذا الجهاز الحالي مباشرة بهذا الرمز"
                  >
                    <Zap className="w-4 h-4" />
                    <span>{appliedDirectly ? 'تم التفعيل!' : 'تفعيل هذا الجهاز'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#0f172a] px-6 py-3.5 border-t border-[#334155] text-[11px] text-[#64748b] flex items-center justify-between">
          <span>أداة خارجية مستقلة للإدارة</span>
          <span>التشفير: Deterministic Dual-Seed Hash Engine</span>
        </div>
      </div>
    </div>
  );
};
