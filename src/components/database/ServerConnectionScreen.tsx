import React, { useState } from 'react';
import {
  Server,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  Dices,
  Sparkles,
} from 'lucide-react';
import { testPgConnection, listPgDatabases, saveStoredPgConfig, getStoredPgConfig, setServerConfigSaved } from '../../utils/pgClient';
import { PgConfig } from '../../types';
import { useApp } from '../../context/AppContext';

interface ServerConnectionScreenProps {
  onSuccess: (config: PgConfig, databases: string[]) => void;
}

export const ServerConnectionScreen: React.FC<ServerConnectionScreenProps> = ({
  onSuccess,
}) => {
  const { setPgConfigState, setIsPgConnected, showNotification } = useApp();

  const stored = getStoredPgConfig();
  const [host, setHost] = useState(stored?.host || 'localhost');
  const [port, setPort] = useState(String(stored?.port || 5432));
  const [user, setUser] = useState(stored?.user || 'postgres');
  const [password, setPassword] = useState(stored?.password || '');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!host.trim()) {
      setErrorMessage('يرجى إدخال اسم المخدم');
      return;
    }

    setIsLoading(true);

    try {
      const config: PgConfig = {
        host: host.trim(),
        port: Number(port) || 5432,
        user: user.trim() || 'postgres',
        password: password,
        database: 'postgres',
        ssl: false,
      };

      // 1. Test Server Connection
      const testRes = await testPgConnection(config);

      if (!testRes.success) {
        setIsLoading(false);
        setErrorMessage(testRes.error || 'فشل الاتصال بالمخدم. يرجى التحقق من بيانات الاتصال وكلمة المرور وصلاحيات الوصول.');
        return;
      }

      // 2. Fetch Databases list from server
      const dbRes = await listPgDatabases(config);
      const serverDbs = dbRes.success && Array.isArray(dbRes.databases) ? dbRes.databases : [];

      setServerConfigSaved(true);
      saveStoredPgConfig(config);
      setPgConfigState(config);
      setIsPgConnected(true);

      setSuccessMessage('تم الاتصال بالمخدم بنجاح! جاري تحويلك لإعداد الملفات...');
      showNotification('تم الاتصال بالمخدم بنجاح', 'success');

      setTimeout(() => {
        setIsLoading(false);
        onSuccess(config, serverDbs);
      }, 700);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'حدث خطأ غير متوقع أثناء الاتصال بالمخدم');
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#182330] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2a3b4c] via-[#1a2533] to-[#0f1722] flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 select-none antialiased"
      dir="rtl"
    >
      <div className="w-full max-w-lg bg-[#223040]/95 backdrop-blur-xl border border-slate-600/80 rounded-2xl shadow-2xl overflow-hidden relative z-10 flex flex-col">
        {/* Header */}
        <div className="bg-[#192432] border-b border-slate-700/80 p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center shadow-lg border border-sky-400/30 shrink-0">
              <Server className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-wide">
                إعداد الاتصال بالمخدم
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                يرجى إدخال بيانات الاتصال بالمخدم للمتابعة
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConnect} className="p-5 sm:p-6 flex flex-col gap-4">
          {/* Host Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-200">
              اسم المخدم / المضيف:
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => {
                setHost(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="localhost أو عنوان IP"
              className="w-full bg-[#121a24] text-white border border-slate-600 focus:border-sky-400 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400/30 transition-all shadow-inner"
              dir="ltr"
              required
            />
          </div>

          {/* Port and User row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-200">
                المنفذ (Port):
              </label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="5432"
                className="w-full bg-[#121a24] text-white border border-slate-600 focus:border-sky-400 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400/30 transition-all shadow-inner"
                dir="ltr"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-200">
                اسم المستخدم:
              </label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="postgres"
                className="w-full bg-[#121a24] text-white border border-slate-600 focus:border-sky-400 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400/30 transition-all shadow-inner"
                dir="ltr"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>كلمة المرور:</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="كلمة مرور المخدم"
                className="w-full bg-[#121a24] text-white border border-slate-600 focus:border-sky-400 rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400/30 transition-all shadow-inner"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-rose-500/20 border border-rose-400/60 text-rose-200 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-bold">{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="bg-emerald-500/25 border border-emerald-400 text-emerald-200 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
              <span className="font-bold text-sm">{successMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || Boolean(successMessage)}
            className="w-full mt-2 py-3.5 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white font-black text-sm sm:text-base rounded-xl shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>جاري الاتصال بالمخدم...</span>
              </>
            ) : (
              <>
                <Server className="w-5 h-5" />
                <span>الاتصال بالمخدم والمتابعة</span>
                <ArrowLeft className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
