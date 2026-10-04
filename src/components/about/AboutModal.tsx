import React from 'react';
import {
  X,
  Globe,
  Sparkles,
  Receipt,
  Printer,
  FileSpreadsheet,
  Database,
} from 'lucide-react';

export const AboutModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const whatsappUrl = 'https://wa.me/963984463801';
  const websiteUrl = 'https://www.updatecompany.net';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      dir="rtl"
    >
      <div className="bg-[#263547] text-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-600/80 p-4 sm:p-5 relative flex flex-col gap-3.5">
        {/* Close Top Button */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700/60 transition-colors cursor-pointer"
          title="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Section */}
        <div className="flex flex-col items-center text-center pt-1">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/30 border border-amber-400/40 flex items-center justify-center mb-2 shadow-md shadow-amber-950/40">
            <span className="text-xl font-black text-amber-400">%</span>
          </div>

          <h2 className="text-base font-black text-white tracking-wide">
            برنامج كمسيون لإدارة أسواق الهال
          </h2>

          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] font-mono font-bold bg-amber-400/15 text-amber-300 px-2 py-0.5 rounded-md border border-amber-400/30">
              الإصدار 1.0.0
            </span>
            <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
              نسخة مرخصة ومحمية
            </span>
          </div>
        </div>

        {/* Description Banner */}
        <div className="bg-[#1c2937] p-2.5 rounded-xl border border-slate-700/70 text-center">
          <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
            برنامج محاسبي متخصص لإدارة مكاتب الكمسيون وتجارة الخضار والفواكه بالجملة في سوق الهال، لتنظيم عمليات البيع والشراء والعمولات وحسابات المزارعين والتجار والتقارير المالية بدقة وسرعة.
          </p>
        </div>

        {/* System Capabilities - Compact Grid */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#1f2d3d] border border-slate-700/60">
            <Receipt className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-200 font-bold truncate">فواتير كمسيون ذكية</span>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#1f2d3d] border border-slate-700/60">
            <Printer className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-200 font-bold truncate">طباعة بائع ومشتري</span>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#1f2d3d] border border-slate-700/60">
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="text-slate-200 font-bold truncate">سندات قبض ودفع وتفقيط</span>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#1f2d3d] border border-slate-700/60">
            <Database className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="text-slate-200 font-bold truncate">قواعد بيانات SQL ونسخ</span>
          </div>
        </div>

        {/* Contact Icons Bar: WhatsApp & Globe (Icon only) */}
        <div className="flex items-center justify-center gap-3 pt-1">
          {/* WhatsApp Icon Link (Icon only) */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="واتساب: 00963984463801"
            aria-label="WhatsApp"
            className="w-9 h-9 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 hover:border-emerald-400 flex items-center justify-center transition-all duration-150 hover:scale-105 shadow cursor-pointer group"
          >
            <svg
              className="w-4.5 h-4.5 fill-current transition-transform group-hover:scale-105"
              viewBox="0 0 24 24"
            >
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
            </svg>
          </a>

          {/* Website Globe Icon Link (Icon only) */}
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="زيارة الموقع: www.updatecompany.net"
            aria-label="Website"
            className="w-9 h-9 rounded-xl bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white border border-sky-500/40 hover:border-sky-400 flex items-center justify-center transition-all duration-150 hover:scale-105 shadow cursor-pointer group"
          >
            <Globe className="w-4.5 h-4.5 transition-transform group-hover:scale-105" />
          </a>
        </div>

        {/* Rights & Copyright Footer */}
        <div className="pt-2 border-t border-slate-700/60 text-center flex flex-col items-center gap-0.5">
          <p className="text-[11px] font-bold text-slate-200">
            جميع الحقوق محفوظة لشركة ابديت لحلول الأعمال 2026
          </p>
        </div>

        {/* Close Button */}
        <div className="flex justify-center pt-0.5">
          <button
            onClick={onClose}
            className="px-6 py-1.5 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-lg shadow cursor-pointer transition-all duration-150 active:scale-95"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
