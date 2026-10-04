import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/src/hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-lg bg-amber-600/95 text-white px-3.5 py-2 text-xs font-bold shadow-xl border border-amber-400/50 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
      dir="rtl"
    >
      <WifiOff className="w-4 h-4 text-amber-200 animate-pulse" />
      <span>وضع عدم الاتصال — البرنامج يعمل بدون إنترنت من الذاكرة المحلية المخزنة.</span>
    </div>
  );
};
