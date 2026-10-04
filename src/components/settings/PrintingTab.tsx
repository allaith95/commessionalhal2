import React from 'react';
import { CompanySettings, PaperSize } from '../../types';
import { Type, Minus, Plus, Eye, Printer } from 'lucide-react';

interface PrintingTabProps {
  formData: CompanySettings;
  onChange: (data: Partial<CompanySettings>) => void;
}

const PAPER_SIZES: PaperSize[] = ['A4', 'A5', 'A6', 'B5'];

export const PrintingTab: React.FC<PrintingTabProps> = ({
  formData,
  onChange,
}) => {
  const headerFontSize = formData.printHeaderFontSize ?? 11;
  const bodyFontSize = formData.printBodyFontSize ?? 11;
  const summaryFontSize = formData.printSummaryFontSize ?? 11;

  const printItems = [
    {
      id: 'sellerInvoicePageSize',
      label: 'فاتورة البائع (الأمانة):',
      current: formData.sellerInvoicePageSize || 'A4',
      setter: (size: PaperSize) => onChange({ sellerInvoicePageSize: size }),
    },
    {
      id: 'buyerInvoicePageSize',
      label: 'فاتورة المشتري:',
      current: formData.buyerInvoicePageSize || 'A4',
      setter: (size: PaperSize) => onChange({ buyerInvoicePageSize: size }),
    },
    {
      id: 'voucherPageSize',
      label: 'سندات القبض والصرف:',
      current: formData.voucherPageSize || 'A5',
      setter: (size: PaperSize) => onChange({ voucherPageSize: size }),
    },
    {
      id: 'reportPageSize',
      label: 'التقارير والكشوفات:',
      current: formData.reportPageSize || 'A4',
      setter: (size: PaperSize) => onChange({ reportPageSize: size }),
    },
  ];

  const updateHeaderSize = (val: number) => {
    const clamped = Math.max(8, Math.min(24, val));
    onChange({ printHeaderFontSize: clamped });
  };

  const updateBodySize = (val: number) => {
    const clamped = Math.max(8, Math.min(24, val));
    onChange({ printBodyFontSize: clamped });
  };

  const updateSummarySize = (val: number) => {
    const clamped = Math.max(8, Math.min(24, val));
    onChange({ printSummaryFontSize: clamped });
  };

  return (
    <div className="flex flex-col gap-5 max-w-xl animate-in fade-in duration-150" dir="rtl">
      {/* 1. قسم أحجام الورق */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
          <Printer className="w-3.5 h-3.5" />
          <span>أحجام الورق الافتراضية للمستندات والتقارير:</span>
        </h4>
        <div className="bg-[#243343] p-4 rounded-lg border border-slate-600/70 shadow-xs flex flex-col divide-y divide-slate-700/60">
          {printItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-3"
            >
              <span className="text-xs sm:text-sm font-bold text-slate-200">
                {item.label}
              </span>
              <div className="flex items-center gap-1.5">
                {PAPER_SIZES.map((size) => {
                  const isSelected = item.current === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => item.setter(size)}
                      className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-xs'
                          : 'bg-[#1b2633] text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. قسم أحجام خطوط الجداول عند الطباعة */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5" />
          <span>أحجام خطوط الجداول والملخصات ضمن الطباعة:</span>
        </h4>

        <div className="bg-[#243343] p-4 rounded-lg border border-slate-600/70 shadow-xs flex flex-col gap-4">
          {/* حجم خط رؤوس الأعمدة */}
          <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-slate-700/60">
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-200">
                حجم خط رؤوس الأعمدة (Header Font Size):
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                يتحكم بحجم خط عناوين الأعمدة في أعلى جداول الفواتير والتقارير
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateHeaderSize(headerFontSize - 1)}
                className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors cursor-pointer border border-slate-600"
                title="تصغير خط الأعمدة"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center bg-slate-900 border border-slate-600 rounded px-2 py-1 min-w-[75px] justify-center">
                <input
                  type="number"
                  min={8}
                  max={24}
                  value={headerFontSize}
                  onChange={(e) => updateHeaderSize(parseInt(e.target.value) || 11)}
                  className="w-10 bg-transparent text-center font-mono font-black text-amber-300 text-sm focus:outline-none"
                />
                <span className="text-slate-400 text-xs font-bold font-mono">px</span>
              </div>

              <button
                type="button"
                onClick={() => updateHeaderSize(headerFontSize + 1)}
                className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors cursor-pointer border border-slate-600"
                title="تكبير خط الأعمدة"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* حجم خط تفاصيل وبيانات الجدول */}
          <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-slate-700/60">
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-200">
                حجم خط تفاصيل الجدول (Details Font Size):
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                يتحكم بحجم خط سطور المواد والحركات والأرقام داخل خلايا الجداول
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateBodySize(bodyFontSize - 1)}
                className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors cursor-pointer border border-slate-600"
                title="تصغير خط التفاصيل"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center bg-slate-900 border border-slate-600 rounded px-2 py-1 min-w-[75px] justify-center">
                <input
                  type="number"
                  min={8}
                  max={24}
                  value={bodyFontSize}
                  onChange={(e) => updateBodySize(parseInt(e.target.value) || 11)}
                  className="w-10 bg-transparent text-center font-mono font-black text-emerald-300 text-sm focus:outline-none"
                />
                <span className="text-slate-400 text-xs font-bold font-mono">px</span>
              </div>

              <button
                type="button"
                onClick={() => updateBodySize(bodyFontSize + 1)}
                className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors cursor-pointer border border-slate-600"
                title="تكبير خط التفاصيل"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* حجم خط الملخص للعمليات والتقارير */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-200">
                حجم خط الملخص (Summary Font Size):
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                يتحكم بحجم خط صناديق الإجماليات وملخصات العمليات والتقارير عند الطباعة
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateSummarySize(summaryFontSize - 1)}
                className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors cursor-pointer border border-slate-600"
                title="تصغير خط الملخص"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center bg-slate-900 border border-slate-600 rounded px-2 py-1 min-w-[75px] justify-center">
                <input
                  type="number"
                  min={8}
                  max={24}
                  value={summaryFontSize}
                  onChange={(e) => updateSummarySize(parseInt(e.target.value) || 11)}
                  className="w-10 bg-transparent text-center font-mono font-black text-sky-300 text-sm focus:outline-none"
                />
                <span className="text-slate-400 text-xs font-bold font-mono">px</span>
              </div>

              <button
                type="button"
                onClick={() => updateSummarySize(summaryFontSize + 1)}
                className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors cursor-pointer border border-slate-600"
                title="تكبير خط الملخص"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="bg-[#1a2530] p-3 rounded-lg border border-slate-700 mt-1 flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
              <Eye className="w-3 h-3 text-sky-400" />
              معاينة حية لشكل الخطوط المختارة (الجدول والملخص):
            </span>
            <div className="overflow-x-auto bg-white rounded border border-slate-300 text-slate-900 shadow-xs">
              <table className="w-full text-center border-collapse">
                <thead className="bg-slate-200 font-bold border-b border-slate-400">
                  <tr>
                    <th
                      style={{ fontSize: `${headerFontSize}px` }}
                      className="py-1 px-2 border-l border-slate-300"
                    >
                      المادة
                    </th>
                    <th
                      style={{ fontSize: `${headerFontSize}px` }}
                      className="py-1 px-2 border-l border-slate-300"
                    >
                      الوزن الصافي
                    </th>
                    <th
                      style={{ fontSize: `${headerFontSize}px` }}
                      className="py-1 px-2 border-l border-slate-300"
                    >
                      الإفرادي
                    </th>
                    <th
                      style={{ fontSize: `${headerFontSize}px` }}
                      className="py-1 px-2"
                    >
                      المجموع
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td
                      style={{ fontSize: `${bodyFontSize}px` }}
                      className="py-1 px-2 border-l border-slate-200 font-bold"
                    >
                      بندورة درعة أولى
                    </td>
                    <td
                      style={{ fontSize: `${bodyFontSize}px` }}
                      className="py-1 px-2 border-l border-slate-200 font-mono"
                    >
                      480 كغ
                    </td>
                    <td
                      style={{ fontSize: `${bodyFontSize}px` }}
                      className="py-1 px-2 border-l border-slate-200 font-mono"
                    >
                      3,500
                    </td>
                    <td
                      style={{ fontSize: `${bodyFontSize}px` }}
                      className="py-1 px-2 font-mono font-bold text-emerald-800"
                    >
                      1,680,000
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t border-slate-400">
                    <td
                      colSpan={3}
                      style={{ fontSize: `${summaryFontSize}px` }}
                      className="py-1 px-2 text-right font-black border-l border-slate-300 text-slate-700"
                    >
                      المجموع والملخص الإجمالي:
                    </td>
                    <td
                      style={{ fontSize: `${summaryFontSize}px` }}
                      className="py-1 px-2 font-mono font-black text-emerald-900"
                    >
                      1,680,000
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
