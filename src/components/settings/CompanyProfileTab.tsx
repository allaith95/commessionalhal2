import React from 'react';
import { Phone, User, MapPin, FileText, Bookmark } from 'lucide-react';
import { CompanySettings } from '../../types';

interface CompanyProfileTabProps {
  formData: CompanySettings;
  onChange: (data: Partial<CompanySettings>) => void;
}

export const CompanyProfileTab: React.FC<CompanyProfileTabProps> = ({
  formData,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-200">
      {/* Grid of details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* معلومات المنشأة */}
        <div className="bg-[#2a3a4c] p-4 rounded-lg border border-slate-600/60 shadow-xs flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-600/50">
            <FileText className="w-4 h-4 text-amber-400" />
            <h4 className="font-bold text-xs sm:text-sm text-slate-100">بيانات المحل والسجل</h4>
          </div>

          {/* اسم المحل */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-200">اسم المحل / الشركة</label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => onChange({ companyName: e.target.value })}
              placeholder="اولاد المرحوم صالح درويش"
              className="w-full bg-white text-slate-900 px-3 py-1.5 rounded-md font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-2xs"
            />
          </div>

          {/* رقم السجل التجاري */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-200">رقم السجل التجاري / الترخيص</label>
            <input
              type="text"
              value={formData.license}
              onChange={(e) => onChange({ license: e.target.value })}
              placeholder="س . ت 40592"
              className="w-full bg-white text-slate-900 px-3 py-1.5 rounded-md font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-2xs"
            />
          </div>

          {/* العنوان وموقع المحل */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>العنوان وموقع المحل</span>
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => onChange({ address: e.target.value })}
              placeholder="رأس العين - سوق الهال المركزي"
              className="w-full bg-white text-slate-900 px-3 py-1.5 rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-2xs"
            />
          </div>
        </div>

        {/* مسؤولو الإدارة والاتصال */}
        <div className="bg-[#2a3a4c] p-4 rounded-lg border border-slate-600/60 shadow-xs flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-600/50">
            <Phone className="w-4 h-4 text-sky-400" />
            <h4 className="font-bold text-xs sm:text-sm text-slate-100">مسؤولو الإدارة والاتصال</h4>
          </div>

          {/* المسؤول الأول */}
          <div className="bg-[#202c3a] p-3 rounded-md border border-slate-700/80 flex flex-col gap-2">
            <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>المسؤول الأول</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-slate-300 font-semibold">الاسم:</span>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => onChange({ firstName: e.target.value })}
                  placeholder="الاسم"
                  className="bg-white text-slate-900 px-2.5 py-1.5 rounded text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-400 shadow-2xs"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-slate-300 font-semibold">رقم الهاتف:</span>
                <input
                  type="text"
                  value={formData.firstPhone}
                  onChange={(e) => onChange({ firstPhone: e.target.value })}
                  placeholder="الهاتف"
                  className="bg-white text-slate-900 px-2.5 py-1.5 rounded text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-400 text-left shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* المسؤول الثاني */}
          <div className="bg-[#202c3a] p-3 rounded-md border border-slate-700/80 flex flex-col gap-2">
            <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>المسؤول الثاني</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-slate-300 font-semibold">الاسم:</span>
                <input
                  type="text"
                  value={formData.secondName}
                  onChange={(e) => onChange({ secondName: e.target.value })}
                  placeholder="الاسم"
                  className="bg-white text-slate-900 px-2.5 py-1.5 rounded text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-400 shadow-2xs"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-slate-300 font-semibold">رقم الهاتف:</span>
                <input
                  type="text"
                  value={formData.secondPhone}
                  onChange={(e) => onChange({ secondPhone: e.target.value })}
                  placeholder="الهاتف"
                  className="bg-white text-slate-900 px-2.5 py-1.5 rounded text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-400 text-left shadow-2xs"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* تذييل الفواتير والتقارير */}
      <div className="bg-[#2a3a4c] p-4 rounded-lg border border-slate-600/60 shadow-xs flex flex-col gap-2">
        <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
          <Bookmark className="w-4 h-4 text-emerald-400" />
          <span>تذييل الفواتير والتقارير المطبوعة</span>
        </label>
        <p className="text-[11px] text-slate-400">
          هذه العبارة تظهر أسفل فواتير البيع والشراء والتقارير الرسمية كرسالة شكر أو ملاحظة ختامية.
        </p>
        <input
          type="text"
          value={formData.footerNote || ''}
          onChange={(e) => onChange({ footerNote: e.target.value })}
          placeholder="شكراً لتعاملكم معنا"
          className="w-full bg-white text-slate-900 px-3 py-2 rounded-md text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-2xs"
        />
      </div>
    </div>
  );
};
