import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ToastNotification: React.FC = () => {
  const { notification, clearNotification } = useApp();

  if (!notification) return null;

  const isSuccess = notification.type === 'success' || !notification.type;
  const isError = notification.type === 'error';
  const isInfo = notification.type === 'info';

  return (
    <aside
      aria-label="تنبيهات النظام"
      className="fixed bottom-6 left-6 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto"
      dir="rtl"
    >
      <div
        className={`flex items-start gap-3 p-4 rounded-xl shadow-2xl border ${
          isSuccess
            ? 'bg-emerald-800 text-white border-emerald-600'
            : isError
            ? 'bg-rose-800 text-white border-rose-600'
            : 'bg-sky-800 text-white border-sky-600'
        }`}
      >
        <div className="shrink-0 mt-0.5">
          {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-200" />}
          {isError && <AlertTriangle className="w-5 h-5 text-rose-200" />}
          {isInfo && <Info className="w-5 h-5 text-sky-200" />}
        </div>

        <div className="flex-1 text-sm font-bold leading-relaxed">
          {notification.message}
        </div>

        <button
          type="button"
          onClick={clearNotification}
          className="shrink-0 p-1 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors cursor-pointer"
          title="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
