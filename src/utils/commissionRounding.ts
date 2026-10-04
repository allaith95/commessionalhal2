import { CommissionRoundingDirection } from '../types';

export interface CommissionRoundingOptions {
  direction?: CommissionRoundingDirection;
  step?: number;
}

/**
 * تقريب قيمة الكمسيون حسب الاتجاه المحدد وقيمة خطوة التقريب
 *
 * الخيارات:
 * - 'none': بدون تقريب (التقريب العادي لأقرب عدد صحيح Math.round)
 * - 'up': تقريب إلى أعلى (Math.ceil(val / step) * step) -> مثلاً 955 مع خطوة 50 تصبح 1000
 * - 'nearest': تقريب إلى أقرب مضاعف (Math.round(val / step) * step)
 * - 'down': تقريب إلى أدنى (Math.floor(val / step) * step) -> مثلاً 955 مع خطوة 50 تصبح 950
 *
 * ملاحظة هامة: إجمالي الفاتورة يبقى كما هو دون أي تغيير، ويتم احتساب صافي استحقاق البائع = الإجمالي - الكمسيون المقرب.
 */
export function roundCommission(
  rawCommission: number,
  options?: CommissionRoundingOptions
): number {
  const num = Number(rawCommission) || 0;
  if (num === 0) return 0;

  const direction = options?.direction || 'none';
  const step = Number(options?.step) || 0;

  // إذا لم يتم تفعيل التقريب أو كانت قيمة الخطوة غير صالحة أو <= 0
  if (direction === 'none' || step <= 0) {
    return Math.round(num);
  }

  if (direction === 'up') {
    // تقريب إلى أعلى
    return Math.ceil(num / step) * step;
  }

  if (direction === 'down') {
    // تقريب إلى أدنى
    return Math.floor(num / step) * step;
  }

  if (direction === 'nearest') {
    // تقريب إلى أقرب
    return Math.round(num / step) * step;
  }

  return Math.round(num);
}

/**
 * دالة مساعدة لتوفير وصف عربي مبسط لطريقة التقريب
 */
export function getRoundingDirectionLabel(direction?: CommissionRoundingDirection): string {
  switch (direction) {
    case 'up':
      return 'تقريب إلى أعلى';
    case 'nearest':
      return 'تقريب إلى أقرب';
    case 'down':
      return 'تقريب إلى أدنى';
    case 'none':
    default:
      return 'بدون تقريب';
  }
}
