import React from 'react';
import { CompanySettings } from '../../types';

interface DisplayOptionsTabProps {
  formData: CompanySettings;
  onChange: (data: Partial<CompanySettings>) => void;
}

export const DisplayOptionsTab: React.FC<DisplayOptionsTabProps> = ({
  formData,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-3 max-w-md animate-in fade-in duration-150">
      <div className="bg-[#243343] p-5 rounded-lg border border-slate-600/70 shadow-xs flex flex-col gap-4">
        {/* التشيك الأول: إظهار رمز المادة */}
        <label className="flex items-center gap-3 cursor-pointer select-none group">
          <input
            type="checkbox"
            checked={!!formData.showItemCode}
            onChange={(e) => onChange({ showItemCode: e.target.checked })}
            className="w-5 h-5 rounded border-slate-500 text-sky-600 focus:ring-sky-500 cursor-pointer accent-sky-500"
          />
          <span className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
            إظهار رمز المادة
          </span>
        </label>

        {/* التشيك الثاني: إظهار رمز الحساب */}
        <label className="flex items-center gap-3 cursor-pointer select-none group">
          <input
            type="checkbox"
            checked={!!formData.showAccountCode}
            onChange={(e) => onChange({ showAccountCode: e.target.checked })}
            className="w-5 h-5 rounded border-slate-500 text-sky-600 focus:ring-sky-500 cursor-pointer accent-sky-500"
          />
          <span className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
            إظهار رمز الحساب
          </span>
        </label>

        {/* التشيك الثالث: إظهار التفقيط */}
        <label className="flex items-center gap-3 cursor-pointer select-none group">
          <input
            type="checkbox"
            checked={!!formData.showTafqeet}
            onChange={(e) => onChange({ showTafqeet: e.target.checked })}
            className="w-5 h-5 rounded border-slate-500 text-sky-600 focus:ring-sky-500 cursor-pointer accent-sky-500"
          />
          <span className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
            إظهار التفقيط
          </span>
        </label>
      </div>
    </div>
  );
};
