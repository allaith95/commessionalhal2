import React, { useState } from 'react';
import {
  Calculator,
  ArrowUp,
  ArrowDown,
  MoveHorizontal,
  Ban,
  Sparkles,
  Percent,
  Scale,
  DollarSign,
  HelpCircle,
  Hash,
} from 'lucide-react';
import { CompanySettings, CommissionRoundingDirection } from '../../types';
import { roundCommission } from '../../utils/commissionRounding';
import { THOUSANDS_SEPARATOR_OPTIONS } from '../../utils/numberFormat';

interface FinancialCommissionTabProps {
  formData: CompanySettings;
  onChange: (data: Partial<CompanySettings>) => void;
}

export const FinancialCommissionTab: React.FC<FinancialCommissionTabProps> = ({
  formData,
  onChange,
}) => {
  const currentDirection: CommissionRoundingDirection =
    formData.commissionRoundingDirection || 'none';
  const currentStep =
    Number(formData.commissionRoundingValue) > 0
      ? Number(formData.commissionRoundingValue)
      : 50;

  const currentSeparator = formData.thousandsSeparator ?? ',';

  // Live simulation test value (defaults to 955 as in the user's requirement example)
  const [testCommissionVal, setTestCommissionVal] = useState<number>(955);
  const simulatedResult = roundCommission(testCommissionVal, {
    direction: currentDirection,
    step: currentStep,
  });

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-200" dir="rtl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* القسم الأيمن: القيم المالية الافتراضية وفاصلة الألف */}
        <div className="lg:col-span-5 bg-[#2a3a4c] p-4 rounded-lg border border-slate-600/60 shadow-xs flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-600/50">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <h4 className="font-bold text-xs sm:text-sm text-slate-100">القيم المالية وفاصلة الألف</h4>
          </div>

          {/* فاصلة الألف (شكل فاصلة الألوف) */}
          <div className="flex flex-col gap-2 p-3 bg-[#1e2b38] rounded-lg border border-slate-600/70 shadow-2xs">
            <label className="text-xs font-bold text-amber-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-amber-400" />
                <span>فاصلة الألف:</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                مثال: {currentSeparator === 'none' ? '1000000' : `1${currentSeparator}000${currentSeparator}000`}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {THOUSANDS_SEPARATOR_OPTIONS.map((opt) => {
                const isSelected = (formData.thousandsSeparator ?? ',') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChange({ thousandsSeparator: opt.id })}
                    className={`px-2.5 py-2 rounded-md text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-xs ring-1 ring-amber-300'
                        : 'bg-[#243343] text-slate-200 border-slate-600 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="text-[10px] font-mono opacity-80">{opt.example}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* العملة الأساسية */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span>العملة الأساسية للنظام:</span>
              <span className="text-[11px] text-slate-400">تظهر في الفواتير والتقارير</span>
            </label>
            <input
              type="text"
              value={formData.currency || 'ل.س'}
              onChange={(e) => onChange({ currency: e.target.value })}
              placeholder="ل.س"
              className="w-full bg-white text-slate-900 px-3 py-2 rounded-md font-bold text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 shadow-2xs"
            />
          </div>

          {/* نسبة الكمسيون الافتراضية */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-sky-400" />
                <span>نسبة الكمسيون الافتراضية %:</span>
              </span>
              <span className="text-[11px] text-slate-400">تُطبق تلقائياً على فواتير الأمانة</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                value={formData.defaultCommissionRate ?? 5}
                onChange={(e) =>
                  onChange({
                    defaultCommissionRate: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full bg-white text-slate-900 px-3 py-2 rounded-md font-mono font-black text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 shadow-2xs pl-8"
              />
              <span className="absolute left-2.5 top-2.5 font-bold text-slate-400 text-xs pointer-events-none">
                %
              </span>
            </div>
          </div>

          {/* الخصم الافتراضي (فارغ كغ) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                <span>الخصم الافتراضي (كغ):</span>
              </span>
              <span className="text-[11px] text-slate-400">خصم الفارغ لكل عبوة</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                value={formData.defaultDiscountTare ?? 2}
                onChange={(e) =>
                  onChange({
                    defaultDiscountTare: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full bg-white text-slate-900 px-3 py-2 rounded-md font-mono font-black text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 shadow-2xs pl-9"
              />
              <span className="absolute left-2.5 top-2.5 font-bold text-slate-400 text-xs pointer-events-none">
                كغ
              </span>
            </div>
          </div>

          <div className="bg-[#1f2c3a] p-3 rounded-md border border-slate-700/80 text-[11px] text-slate-300 flex items-start gap-2 mt-auto">
            <HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <span>
              يمكن دائماً تعديل نسبة الكمسيون وقيمة الخصم يدوياً لكل فاتورة على حدة أثناء إدخال الفاتورة.
            </span>
          </div>
        </div>

        {/* القسم الأيسر: ميزة تقريب قيمة الكمسيون والتحكم فيها */}
        <div className="lg:col-span-7 bg-[#243343] p-4 rounded-lg border border-amber-500/50 shadow-md flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-600/60 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-400/20 text-amber-400 rounded border border-amber-400/30">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-black text-xs sm:text-sm text-amber-300">
                  ميزة تقريب قيمة الكمسيون في الفواتير
                </h4>
                <p className="text-[11px] text-slate-300">
                  تقريب مبلغ الكمسيون لأعلى أو لأقرب أو لأدنى مع الحفاظ على إجمالي الفاتورة
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                currentDirection === 'none'
                  ? 'bg-slate-700 text-slate-300 border-slate-600'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
              }`}
            >
              {currentDirection === 'none' ? 'التقريب معطل' : `مفعل (${currentStep})`}
            </span>
          </div>

          {/* اختيار طريقة التقريب */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-200">طريقة تقريب الكمسيون:</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* بدون تقريب */}
              <button
                type="button"
                onClick={() => onChange({ commissionRoundingDirection: 'none' })}
                className={`flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  currentDirection === 'none'
                    ? 'bg-slate-700 text-white border-sky-400 shadow-md ring-2 ring-sky-400/50'
                    : 'bg-[#1b2633] text-slate-300 border-slate-600 hover:bg-slate-700/60 hover:text-white'
                }`}
              >
                <Ban className="w-4 h-4 mb-1 text-slate-400" />
                <span>بدون تقريب</span>
                <span className="text-[10px] text-slate-400 mt-0.5">القيمة الدقيقة</span>
              </button>

              {/* إلى أعلى */}
              <button
                type="button"
                onClick={() => onChange({ commissionRoundingDirection: 'up' })}
                className={`flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  currentDirection === 'up'
                    ? 'bg-emerald-600 text-white border-emerald-300 shadow-md ring-2 ring-emerald-300/50'
                    : 'bg-[#1b2633] text-slate-300 border-slate-600 hover:bg-slate-700/60 hover:text-white'
                }`}
              >
                <ArrowUp className="w-4 h-4 mb-1 text-emerald-300" />
                <span>إلى أعلى (Ceil)</span>
                <span className="text-[10px] text-emerald-200/80 mt-0.5">لصالح المحل</span>
              </button>

              {/* إلى أقرب */}
              <button
                type="button"
                onClick={() => onChange({ commissionRoundingDirection: 'nearest' })}
                className={`flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  currentDirection === 'nearest'
                    ? 'bg-sky-600 text-white border-sky-300 shadow-md ring-2 ring-sky-300/50'
                    : 'bg-[#1b2633] text-slate-300 border-slate-600 hover:bg-slate-700/60 hover:text-white'
                }`}
              >
                <MoveHorizontal className="w-4 h-4 mb-1 text-sky-300" />
                <span>إلى أقرب (Round)</span>
                <span className="text-[10px] text-sky-200/80 mt-0.5">الأقرب حسابياً</span>
              </button>

              {/* إلى أدنى */}
              <button
                type="button"
                onClick={() => onChange({ commissionRoundingDirection: 'down' })}
                className={`flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  currentDirection === 'down'
                    ? 'bg-amber-600 text-white border-amber-300 shadow-md ring-2 ring-amber-300/50'
                    : 'bg-[#1b2633] text-slate-300 border-slate-600 hover:bg-slate-700/60 hover:text-white'
                }`}
              >
                <ArrowDown className="w-4 h-4 mb-1 text-amber-300" />
                <span>إلى أدنى (Floor)</span>
                <span className="text-[10px] text-amber-200/80 mt-0.5">لصالح البائع</span>
              </button>
            </div>
          </div>

          {/* حقل قيمة خطوة التقريب وأزرار الاختيار السريع */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200">
                قيمة خطوة التقريب (مضاعف التقريب):
              </label>
              <span className="text-[11px] text-amber-300 font-mono">
                يتم التقريب لمضاعفات هذه القيمة
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="1"
                value={formData.commissionRoundingValue ?? 50}
                onChange={(e) =>
                  onChange({
                    commissionRoundingValue: Math.max(1, parseInt(e.target.value, 10) || 1),
                  })
                }
                placeholder="50"
                className="flex-1 bg-white text-slate-900 px-3 py-2 rounded-md font-mono font-black text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-2xs"
              />
              {/* أزرار سريعة للقيم الشائعة */}
              {[10, 25, 50, 100].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onChange({ commissionRoundingValue: val })}
                  className={`px-3 py-2 rounded-md text-xs font-mono font-black border transition-all cursor-pointer ${
                    (formData.commissionRoundingValue ?? 50) === val
                      ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-sm scale-105'
                      : 'bg-[#1b2633] text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white'
                  }`}
                  title={`تحديد ${val}`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* صندوق المعاينة الحية والتوضيح المباشر */}
          <div className="bg-[#19232e] p-3 rounded-lg border border-slate-700/80 flex flex-col gap-2 shadow-xs">
            <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>معاينة حية وتجربة فورية:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-xs">قيمة تجريبية:</span>
                <input
                  type="number"
                  value={testCommissionVal}
                  onChange={(e) => setTestCommissionVal(Number(e.target.value) || 0)}
                  className="w-20 bg-slate-800 text-amber-300 border border-slate-600 rounded px-2 py-1 font-mono text-xs text-center focus:outline-none focus:ring-1 focus:ring-amber-400"
                  title="أدخل أي قيمة لتجربة التقريب فوراً"
                />
              </div>
            </div>

            <div className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-md font-mono text-xs sm:text-sm">
              <span className="text-slate-300">
                القيمة المحسوبة: <strong className="text-white font-black">{testCommissionVal.toLocaleString()}</strong>
              </span>
              <span className="text-amber-400 font-bold">➔</span>
              <span className="text-emerald-400 font-bold">
                بعد التقريب: <strong className="text-emerald-300 text-sm font-black">{simulatedResult.toLocaleString()}</strong>
              </span>
            </div>

            <div className="p-2 rounded bg-slate-800/60 border border-slate-700/60">
              <p className="text-xs text-slate-200 leading-relaxed font-sans">
                {currentDirection === 'none' ? (
                  'التقريب معطل حالياً: يتم اعتماد قيمة الكمسيون الفعلية كما هي دون تقريب.'
                ) : currentDirection === 'up' ? (
                  <>
                    التقريب لأعلى بمقدار <strong className="text-amber-300">{currentStep}</strong>: إذا كانت قيمة الكمسيون المحسوبة <strong className="text-white">{testCommissionVal}</strong> فإنها تصبح <strong className="text-emerald-300">{simulatedResult.toLocaleString()}</strong> مع <u>الحفاظ على إجمالي الفاتورة كما هي</u> وتعديل صافي استحقاق البائع تلقائياً.
                  </>
                ) : currentDirection === 'nearest' ? (
                  <>
                    التقريب لأقرب <strong className="text-amber-300">{currentStep}</strong>: يتم التقريب إلى أقرب مضاعف للعدد {currentStep} مع <u>الحفاظ على إجمالي الفاتورة كما هي</u>.
                  </>
                ) : (
                  <>
                    التقريب لأدنى بمقدار <strong className="text-amber-300">{currentStep}</strong>: إذا كانت قيمة الكمسيون المحسوبة <strong className="text-white">{testCommissionVal}</strong> تصبح <strong className="text-emerald-300">{simulatedResult.toLocaleString()}</strong> مع <u>الحفاظ على إجمالي الفاتورة كما هي</u>.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
