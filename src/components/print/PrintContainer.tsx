import React, { useState, useEffect, useCallback } from 'react';
import { Printer, X, FileText, Check, Layout } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { tafqeetNumber, formatCurrency } from '../../utils/tafqeet';
import { Invoice, Voucher, Account, PaperSize } from '../../types';

/**
 * Isolated and pristine print executor:
 * Injects document HTML into a dedicated iframe with Cairo font & Tailwind styles
 * and prints directly without affecting main UI DOM or looping.
 */
export const executePrintDocument = (
  elementId: string,
  pageSize: PaperSize = 'A4',
  documentTitle: string = 'طباعة وثيقة',
  headerFontSize?: number,
  bodyFontSize?: number,
  summaryFontSize?: number
) => {
  const sourceElement = document.getElementById(elementId);
  if (!sourceElement) {
    window.print();
    return;
  }

  const hSize = Number(headerFontSize) > 0 ? Number(headerFontSize) : 11;
  const bSize = Number(bodyFontSize) > 0 ? Number(bodyFontSize) : 11;
  const sSize = Number(summaryFontSize) > 0 ? Number(summaryFontSize) : 11;

  let sizeCss = 'size: A4 portrait; margin: 0 !important;';
  let paddingCss = 'padding: 6mm 8mm !important;';
  if (pageSize === 'A5') {
    sizeCss = 'size: A5 landscape; margin: 0 !important;';
    paddingCss = 'padding: 4mm 6mm !important;';
  }
  if (pageSize === 'A6') {
    sizeCss = 'size: A6 portrait; margin: 0 !important;';
    paddingCss = 'padding: 3mm 4mm !important;';
  }
  if (pageSize === 'B5') {
    sizeCss = 'size: B5 portrait; margin: 0 !important;';
    paddingCss = 'padding: 5mm 6mm !important;';
  }

  // Gather all style elements and stylesheets from current document
  let stylesHtml = '';
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
    stylesHtml += el.outerHTML;
  });

  // Remove any leftover print iframe
  const existingIframe = document.getElementById('app-print-iframe');
  if (existingIframe && existingIframe.parentNode) {
    existingIframe.parentNode.removeChild(existingIframe);
  }

  // Create isolated iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'app-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.setAttribute('aria-hidden', 'true');

  const contentHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title></title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        ${stylesHtml}
        <style>
          @page {
            ${sizeCss}
            margin: 0 !important;
          }
          *, ::before, ::after {
            font-family: 'Cairo', system-ui, -apple-system, sans-serif !important;
            box-sizing: border-box !important;
          }
          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: 100% !important;
            direction: rtl !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-clean-container {
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            ${paddingCss}
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            page-break-inside: auto !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          thead {
            display: table-header-group !important;
          }
          thead th, thead tr th, .print-clean-container thead th, th {
            font-size: ${hSize}px !important;
          }
          tbody td, tbody tr td, .print-clean-container tbody td, td {
            font-size: ${bSize}px !important;
          }
          tfoot td, tfoot tr td, .print-clean-container tfoot td,
          .print-summary-box, .print-summary-box span, .print-summary-box div, [data-print-summary], [data-print-summary] * {
            font-size: ${sSize}px !important;
          }
        </style>
      </head>
      <body>
        <div class="print-clean-container">
          ${sourceElement.innerHTML}
        </div>
      </body>
    </html>
  `;

  let printed = false;
  const triggerPrintNow = () => {
    if (printed) return;
    printed = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Print failed in iframe, falling back to window.print', err);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (win && 'fonts' in win.document) {
      win.document.fonts.ready
        .then(() => setTimeout(triggerPrintNow, 60))
        .catch(() => setTimeout(triggerPrintNow, 60));
    } else {
      setTimeout(triggerPrintNow, 100);
    }
  };

  // Populate iframe safely without document.write()
  iframe.srcdoc = contentHtml;
  document.body.appendChild(iframe);

  // Fallback timer if onload event does not fire
  setTimeout(triggerPrintNow, 500);
};

export const PrintContainer: React.FC = () => {
  const { printData, closePrint, settings } = useApp();

  const printType = printData?.type;
  const payload = printData?.data;

  // Paper size is taken directly and automatically from the saved settings according to document type
  const paperSize: PaperSize = (() => {
    if (!printType) return 'A4';
    if (printType === 'seller_invoice') return settings.sellerInvoicePageSize || 'A5';
    if (printType === 'buyer_invoice') return settings.buyerInvoicePageSize || 'A5';
    if (printType === 'voucher_payment' || printType === 'voucher_receipt') return settings.voucherPageSize || 'A4';
    return settings.reportPageSize || 'A4';
  })();

  const documentTitle = (() => {
    switch (printType) {
      case 'seller_invoice':
        return `فاتورة بائع - ${(payload as Invoice)?.invoiceNumber || ''}`;
      case 'buyer_invoice':
        return `فاتورة مشتري - ${(payload as Invoice)?.invoiceNumber || ''}`;
      case 'voucher_payment':
        return `سند دفع - ${(payload as Voucher)?.voucherNumber || ''}`;
      case 'voucher_receipt':
        return `سند قبض - ${(payload as Voucher)?.voucherNumber || ''}`;
      case 'account_statement':
        return 'كشف حساب زبون';
      case 'commission_report':
        return 'تقرير عمولة الكمسيون';
      case 'item_report':
        return 'حركة مادة تفصيلي';
      case 'invoices_report':
        return 'تقرير فواتير المبيعات';
      case 'accounts_list':
        return 'دليل وأرصدة الحسابات';
      case 'items_list':
        return 'دليل المواد والأصناف';
      default:
        return 'طباعة وثيقة محاسبية';
    }
  })();

  const handleExecutePrint = useCallback(() => {
    executePrintDocument(
      'printable-document-root',
      paperSize,
      documentTitle,
      settings.printHeaderFontSize,
      settings.printBodyFontSize,
      settings.printSummaryFontSize
    );
  }, [paperSize, documentTitle, settings.printHeaderFontSize, settings.printBodyFontSize, settings.printSummaryFontSize]);

  // Keyboard shortcut listener: Esc to close, Enter or Ctrl+P to Print
  useEffect(() => {
    if (!printData || !printData.type) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePrint();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        handleExecutePrint();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handleExecutePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [printData, closePrint, handleExecutePrint]);

  if (!printData || !printData.type) return null;

  const pageCss = (() => {
    switch (paperSize) {
      case 'A5':
        return 'size: A5 landscape; margin: 0 !important;';
      case 'A6':
        return 'size: A6 portrait; margin: 0 !important;';
      case 'B5':
        return 'size: B5 portrait; margin: 0 !important;';
      case 'A4':
      default:
        return 'size: A4 portrait; margin: 0 !important;';
    }
  })();

  const containerWidthClass = (() => {
    switch (paperSize) {
      case 'A6':
        return 'max-w-xl text-[11px] p-4 sm:p-6';
      case 'A5':
        return 'max-w-3xl text-xs p-5 sm:p-8';
      case 'B5':
        return 'max-w-3xl text-xs p-5 sm:p-8';
      case 'A4':
      default:
        return 'max-w-4xl text-sm p-6 sm:p-10';
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-start p-2 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto print-document-container"
      dir="rtl"
    >
      {/* Dynamic Print Styles & Table Font Sizes */}
      <style>{`
        @page {
          ${pageCss}
        }
        #printable-document-root thead th {
          font-size: ${settings.printHeaderFontSize ?? 11}px !important;
        }
        #printable-document-root tbody td {
          font-size: ${settings.printBodyFontSize ?? 11}px !important;
        }
        #printable-document-root tfoot td,
        #printable-document-root .print-summary-box,
        #printable-document-root .print-summary-box span,
        #printable-document-root .print-summary-box div,
        #printable-document-root [data-print-summary],
        #printable-document-root [data-print-summary] * {
          font-size: ${settings.printSummaryFontSize ?? 11}px !important;
        }
      `}</style>

      {/* Floating Control Toolbar */}
      <div className="sticky top-2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-3 border border-slate-700 w-full max-w-4xl print:hidden my-2">
        {/* Document Title Badge */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">{documentTitle}</h3>
            <span className="text-[11px] text-slate-400">طباعة فورية للمستند</span>
          </div>
        </div>

        {/* Paper Size from Settings Badge (بدون خيارات تبديل - يتم الأخذ مباشرة من الإعدادات) */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
          <Layout className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-slate-400 text-[11px]">حجم الورق (من الإعدادات):</span>
          <span className="font-mono font-bold text-sky-300 bg-sky-950 px-2 py-0.5 rounded border border-sky-800 text-xs">
            {paperSize}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExecutePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black text-xs shadow-lg cursor-pointer transition-all transform active:scale-95"
            title="طباعة الوثيقة (Enter أو Ctrl+P)"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الوثيقة</span>
          </button>

          <button
            type="button"
            onClick={closePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-bold text-xs border border-slate-700 cursor-pointer transition-colors"
            title="إغلاق (Esc)"
          >
            <X className="w-4 h-4" />
            <span>إغلاق (Esc)</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet (Previewed exactly as paper output) */}
      <div
        id="printable-document-root"
        className={`w-full ${containerWidthClass} bg-white text-slate-900 shadow-2xl rounded-xl mb-12 print:mb-0 print:shadow-none print:rounded-none print:w-full print:p-0 border border-slate-300 print:border-none print-document-sheet transition-all`}
      >
        {/* Render appropriate view based on printType */}
        {printType === 'seller_invoice' && <SellerInvoicePrint invoice={payload as Invoice} settings={settings} />}
        {printType === 'buyer_invoice' && <BuyerInvoicePrint invoice={payload as Invoice} settings={settings} />}
        {(printType === 'voucher_payment' || printType === 'voucher_receipt') && (
          <VoucherPrint voucher={payload as Voucher} type={printType === 'voucher_payment' ? 'دفع' : 'قبض'} settings={settings} />
        )}
        {printType === 'account_statement' && <AccountStatementPrint data={payload} settings={settings} />}
        {printType === 'commission_report' && <CommissionReportPrint data={payload} settings={settings} />}
        {printType === 'item_report' && <ItemReportPrint data={payload} settings={settings} />}
        {printType === 'invoices_report' && <InvoicesReportPrint data={payload} settings={settings} />}
        {printType === 'accounts_list' && <AccountsListPrint data={payload} settings={settings} />}
        {printType === 'items_list' && <ItemsListPrint data={payload} settings={settings} />}
      </div>
    </div>
  );
};

/* Reusable Print Company Header Component */
const PrintCompanyHeader: React.FC<{ settings: any }> = ({ settings }) => {
  return (
    <div className="flex flex-col gap-0.5 text-right">
      <h1 className="text-xl font-black text-slate-900">{settings.companyName || 'اولاد المرحوم صالح درويش'}</h1>
      <span className="text-xs font-semibold text-slate-700">لتجارة الخضار والفواكه بالجملة (كمسيون)</span>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 font-medium">
        <span>{settings.address || 'رأس العين'}</span>
        {settings.license && <span className="text-slate-400 font-bold">•</span>}
        {settings.license && <span className="font-bold">{settings.license}</span>}
      </div>
      {(settings.firstPhone || settings.secondPhone || settings.firstName || settings.secondName) && (
        <div className="text-[11px] text-slate-600 font-mono font-bold flex flex-col gap-0.5 mt-0.5">
          {(settings.firstName || settings.firstPhone) && (
            <div>
              {settings.firstName ? `${settings.firstName}: ` : ''}
              {settings.firstPhone}
            </div>
          )}
          {(settings.secondName || settings.secondPhone) && (
            <div>
              {settings.secondName ? `${settings.secondName}: ` : ''}
              {settings.secondPhone}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* 1. Seller Invoice Print */
export const SellerInvoicePrint: React.FC<{ invoice: Invoice; settings: any }> = ({ invoice, settings }) => {
  return (
    <div className="flex flex-col gap-5 text-sm">
      {/* Top Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
        <PrintCompanyHeader settings={settings} />

        <div className="flex flex-col items-center justify-center self-center">
          <div className="px-6 py-2 bg-slate-100 border-2 border-slate-800 rounded-md font-black text-lg text-slate-900 shadow-xs">
            فاتورة بائع
          </div>
        </div>
      </div>

      {/* Invoice Meta Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-300 text-xs font-bold">
        <div>
          <span className="text-slate-500 ml-1">رقم الفاتورة:</span>
          <span className="font-mono text-sm text-slate-900 font-black">{invoice.invoiceNumber}</span>
        </div>
        <div>
          <span className="text-slate-500 ml-1">التاريخ:</span>
          <span className="font-mono text-slate-900">{invoice.date}</span>
        </div>
        <div>
          <span className="text-slate-500 ml-1">السيد / البائع:</span>
          <span className="text-slate-900 font-black">{invoice.sellerName}</span>
        </div>
        <div>
          <span className="text-slate-500 ml-1">طريقة الدفع:</span>
          <span className="text-slate-900">{invoice.sellerPaymentType}</span>
        </div>
      </div>

      {/* Table */}
      <table className="w-full text-center border-collapse border border-slate-800 text-xs">
        <thead className="bg-slate-200 font-bold border-b border-slate-800">
          <tr>
            <th className="py-2 px-2 border-l border-slate-800 w-10">م</th>
            <th className="py-2 px-3 border-l border-slate-800">المادة</th>
            <th className="py-2 px-2 border-l border-slate-800 w-16">الوحدة</th>
            <th className="py-2 px-2 border-l border-slate-800 w-24">وزن قائم</th>
            <th className="py-2 px-2 border-l border-slate-800 w-20">الخصم</th>
            <th className="py-2 px-2 border-l border-slate-800 w-24">وزن صافي</th>
            <th className="py-2 px-2 border-l border-slate-800 w-24">الإفرادي</th>
            <th className="py-2 px-3 border-slate-800 w-28">الإجمالي</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-400 font-semibold">
          {invoice.rows.map((row, idx) => (
            <tr key={row.id}>
              <td className="py-2 px-2 border-l border-slate-400">{idx + 1}</td>
              <td className="py-2 px-3 border-l border-slate-400 font-bold">{row.itemName}</td>
              <td className="py-2 px-2 border-l border-slate-400">{row.unit}</td>
              <td className="py-2 px-2 border-l border-slate-400 font-mono">{row.grossWeight}</td>
              <td className="py-2 px-2 border-l border-slate-400 font-mono">{row.discountTare}</td>
              <td className="py-2 px-2 border-l border-slate-400 font-mono font-bold text-slate-900">{row.netWeight}</td>
              <td className="py-2 px-2 border-l border-slate-400 font-mono">{formatCurrency(row.unitPrice, settings.thousandsSeparator)}</td>
              <td className="py-2 px-3 font-mono font-bold">{formatCurrency(row.total, settings.thousandsSeparator)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Calculations Box */}
      <div className="flex justify-end mt-2">
        <div className="w-72 flex flex-col gap-1.5 border-2 border-slate-800 p-3 rounded bg-slate-50 text-xs font-bold print-summary-box">
          <div className="flex justify-between items-center border-b border-slate-300 pb-1">
            <span>مجموع الإجمالي:</span>
            <span className="font-mono text-sm">{formatCurrency(invoice.totalAmount, settings.thousandsSeparator)} {settings.currency}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-300 pb-1 text-slate-700">
            <span>نسبة الكمسيون ({invoice.commissionRate}%):</span>
            <span className="font-mono text-sm">{formatCurrency(invoice.commissionValue, settings.thousandsSeparator)} {settings.currency}</span>
          </div>
          <div className="flex justify-between items-center pt-1 text-emerald-800 font-black text-sm">
            <span>صافي المستحق للبائع:</span>
            <span className="font-mono text-base">{formatCurrency(invoice.netAmount, settings.thousandsSeparator)} {settings.currency}</span>
          </div>
        </div>
      </div>

      {/* Tafqeet */}
      {settings.showTafqeet && (
        <div className="bg-slate-100 p-2.5 rounded border border-slate-300 text-xs font-bold text-slate-800">
          <span className="text-slate-500 ml-2">فقط وقدره:</span>
          <span>{tafqeetNumber(invoice.netAmount, settings.currency)}</span>
        </div>
      )}

      {/* Footer Note */}
      {settings.footerNote && (
        <div className="text-center text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-200">
          {settings.footerNote}
        </div>
      )}
    </div>
  );
};

/* 2. Buyer Invoice Print */
export const BuyerInvoicePrint: React.FC<{ invoice: Invoice; settings: any }> = ({ invoice, settings }) => {
  return (
    <div className="flex flex-col gap-5 text-sm">
      {/* Top Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
        <PrintCompanyHeader settings={settings} />

        <div className="flex flex-col items-center justify-center self-center">
          <div className="px-6 py-2 bg-slate-100 border-2 border-slate-800 rounded-md font-black text-lg text-slate-900 shadow-xs">
            فاتورة مشتري
          </div>
        </div>
      </div>

      {/* Meta Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-300 text-xs font-bold">
        <div>
          <span className="text-slate-500 ml-1">رقم الفاتورة:</span>
          <span className="font-mono text-sm text-slate-900 font-black">{invoice.invoiceNumber}</span>
        </div>
        <div>
          <span className="text-slate-500 ml-1">التاريخ:</span>
          <span className="font-mono text-slate-900">{invoice.date}</span>
        </div>
        <div>
          <span className="text-slate-500 ml-1">السيد / المشتري:</span>
          <span className="text-slate-900 font-black">{invoice.buyerName}</span>
        </div>
        <div>
          <span className="text-slate-500 ml-1">طريقة الدفع:</span>
          <span className="text-slate-900">{invoice.buyerPaymentType}</span>
        </div>
      </div>

      {/* Table */}
      <table className="w-full text-center border-collapse border border-slate-800 text-xs">
        <thead className="bg-slate-200 font-bold border-b border-slate-800">
          <tr>
            <th className="py-2 px-2 border-l border-slate-800 w-10">م</th>
            <th className="py-2 px-3 border-l border-slate-800">المادة</th>
            <th className="py-2 px-2 border-l border-slate-800 w-16">الوحدة</th>
            <th className="py-2 px-2 border-l border-slate-800 w-24">وزن قائم</th>
            <th className="py-2 px-2 border-l border-slate-800 w-20">الخصم</th>
            <th className="py-2 px-2 border-l border-slate-800 w-24">وزن صافي</th>
            <th className="py-2 px-2 border-l border-slate-800 w-24">الإفرادي</th>
            <th className="py-2 px-3 border-slate-800 w-28">الإجمالي</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-400 font-semibold">
          {invoice.rows.map((row, idx) => (
            <tr key={row.id}>
              <td className="py-2 px-2 border-l border-slate-400">{idx + 1}</td>
              <td className="py-2 px-3 border-l border-slate-400 font-bold">{row.itemName}</td>
              <td className="py-2 px-2 border-l border-slate-400">{row.unit}</td>
              <td className="py-2 px-2 border-l border-slate-400 font-mono">{row.grossWeight}</td>
              <td className="py-2 px-2 border-l border-slate-400 font-mono">{row.discountTare}</td>
              <td className="py-2 px-2 border-l border-slate-400 font-mono font-bold text-slate-900">{row.netWeight}</td>
              <td className="py-2 px-2 border-l border-slate-400 font-mono">{formatCurrency(row.unitPrice, settings.thousandsSeparator)}</td>
              <td className="py-2 px-3 font-mono font-bold">{formatCurrency(row.total, settings.thousandsSeparator)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Calculations for Buyer */}
      <div className="flex justify-end mt-2">
        <div className="w-72 flex flex-col gap-1.5 border-2 border-slate-800 p-3 rounded bg-slate-50 text-xs font-bold print-summary-box">
          <div className="flex justify-between items-center pt-1 text-slate-900 font-black text-sm">
            <span>إجمالي المطلوب من المشتري:</span>
            <span className="font-mono text-base">{formatCurrency(invoice.totalAmount, settings.thousandsSeparator)} {settings.currency}</span>
          </div>
        </div>
      </div>

      {/* Tafqeet */}
      {settings.showTafqeet && (
        <div className="bg-slate-100 p-2.5 rounded border border-slate-300 text-xs font-bold text-slate-800">
          <span className="text-slate-500 ml-2">فقط وقدره:</span>
          <span>{tafqeetNumber(invoice.totalAmount, settings.currency)}</span>
        </div>
      )}

      {/* Footer Note */}
      {settings.footerNote && (
        <div className="text-center text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-200">
          {settings.footerNote}
        </div>
      )}
    </div>
  );
};

/* 3. Voucher Print (Payment or Receipt) */
export const VoucherPrint: React.FC<{ voucher: Voucher; type: 'دفع' | 'قبض'; settings: any }> = ({
  voucher,
  type,
  settings,
}) => {
  const isPayment = type === 'دفع';

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
        <PrintCompanyHeader settings={settings} />

        <div className="flex flex-col items-center justify-center self-center">
          <div className="px-6 py-2 bg-slate-100 border-2 border-slate-800 rounded-md font-black text-lg text-slate-900 shadow-xs">
            {isPayment ? 'سند دفع' : 'سند قبض'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-300 text-xs font-bold">
        <div>
          <span className="text-slate-500 ml-1">رقم الإيصال:</span>
          <span className="font-mono text-sm text-slate-900 font-black">{voucher.voucherNumber}</span>
        </div>
        <div>
          <span className="text-slate-500 ml-1">التاريخ:</span>
          <span className="font-mono text-slate-900">{voucher.date}</span>
        </div>
        <div>
          <span className="text-slate-500 ml-1">الصندوق / المصرف:</span>
          <span className="text-slate-900">{voucher.mainAccountName}</span>
        </div>
        <div>
          <span className="text-slate-500 ml-1">العملة:</span>
          <span className="text-slate-900">{voucher.currency}</span>
        </div>
      </div>

      <table className="w-full text-center border-collapse border border-slate-800 text-xs">
        <thead className="bg-slate-200 font-bold border-b border-slate-800">
          <tr>
            <th className="py-2 px-2 border-l border-slate-800 w-12">م</th>
            <th className="py-2 px-3 border-l border-slate-800 w-36">{isPayment ? 'المبلغ المدين' : 'المبلغ الدائن'}</th>
            <th className="py-2 px-4 border-l border-slate-800 w-56">الحساب</th>
            <th className="py-2 px-4">البيان</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-400 font-semibold">
          {voucher.rows.map((row, idx) => (
            <tr key={row.id}>
              <td className="py-2.5 px-2 border-l border-slate-400">{idx + 1}</td>
              <td className="py-2.5 px-3 border-l border-slate-400 font-mono font-bold text-slate-900">
                {formatCurrency(row.amount, settings.thousandsSeparator)} {voucher.currency}
              </td>
              <td className="py-2.5 px-4 border-l border-slate-400 font-bold">{row.accountName}</td>
              <td className="py-2.5 px-4 text-right">{row.notes || voucher.notes || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={`flex ${settings.showTafqeet ? 'justify-between' : 'justify-end'} items-center bg-slate-100 p-3 rounded border border-slate-300 text-xs font-bold print-summary-box`}>
        {settings.showTafqeet && (
          <div>
            <span className="text-slate-500 ml-2">فقط وقدره:</span>
            <span>{tafqeetNumber(voucher.totalAmount, voucher.currency)}</span>
          </div>
        )}
        <div className="text-sm font-black">
          <span>المجموع: </span>
          <span className="font-mono text-emerald-800 mr-1">{formatCurrency(voucher.totalAmount, settings.thousandsSeparator)} {voucher.currency}</span>
        </div>
      </div>
    </div>
  );
};

/* 4. Account Statement Print */
export const AccountStatementPrint: React.FC<{ data: any; settings: any }> = ({ data, settings }) => {
  const { account, rows, totalDebit, totalCredit, finalBalance, summaryStats, mode, columnVisibility, startDate, endDate } = data;

  const cols = columnVisibility || {
    showGrossWeight: true,
    showDiscountValue: false,
    showDiscountPercent: false,
    showNetWeight: true,
    showUnitPrice: true,
    showTotal: true,
    showCommission: false,
  };

  const displayDebit = summaryStats ? summaryStats.totalDebit : totalDebit;
  const displayCredit = summaryStats ? summaryStats.totalCredit : totalCredit;
  const displayBalance = summaryStats ? summaryStats.finalBalance : finalBalance;

  let calcGrossWeight = 0;
  let calcNetWeight = 0;
  const processedInvoiceKeys = new Set<string>();

  rows.forEach((r: any) => {
    if (r.rawInvoice?.rows && r.rawInvoice.rows.length > 0) {
      const invKey = r.docNumber || r.id;
      if (!processedInvoiceKeys.has(invKey)) {
        processedInvoiceKeys.add(invKey);
        r.rawInvoice.rows.forEach((pr: any) => {
          calcGrossWeight += Number(pr.grossWeight) || 0;
          calcNetWeight += Number(pr.netWeight) || 0;
        });
      }
    }
  });

  const displayGrossWeight =
    summaryStats?.totalGrossWeight !== undefined && summaryStats.totalGrossWeight > 0
      ? summaryStats.totalGrossWeight
      : Math.round(calcGrossWeight * 100) / 100;

  const displayNetWeight =
    summaryStats?.totalNetWeight !== undefined && summaryStats.totalNetWeight > 0
      ? summaryStats.totalNetWeight
      : Math.round(calcNetWeight * 100) / 100;

  return (
    <div className="flex flex-col gap-5 text-sm" dir="rtl">
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
        <PrintCompanyHeader settings={settings} />

        <div className="flex flex-col items-center justify-center self-center text-center">
          <div className="px-6 py-2 bg-slate-100 border-2 border-slate-800 rounded-md font-black text-lg text-slate-900 shadow-xs">
            كشف حساب مالي
          </div>
          <span className="text-xs text-slate-700 mt-1 font-bold">
            للسيد: {account.name}{settings.showAccountCode && account.code ? ` (رمز الحساب: ${account.code})` : ''}
          </span>
          {(startDate || endDate) && (
            <span className="text-[11px] text-slate-500 font-medium">
              الفترة من: {startDate || 'البداية'} إلى: {endDate || 'الآن'}
            </span>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <table className="w-full text-center border-collapse border border-slate-800 text-xs">
        <thead className="bg-slate-200 font-bold border-b border-slate-800">
          <tr>
            <th className="py-2 px-3 border-l border-slate-800 w-24">التاريخ</th>
            <th className="py-2 px-3 border-l border-slate-800 w-32">المستند</th>
            {cols?.showOppositeAccount && (
              <th className="py-2 px-3 border-l border-slate-800 w-32 text-right">الحساب المقابل</th>
            )}
            <th className="py-2 px-4 border-l border-slate-800 text-right">البيان والشرح</th>
            <th className="py-2 px-3 border-l border-slate-800 w-24">مدين / لنا</th>
            <th className="py-2 px-3 border-l border-slate-800 w-24">دائن / له</th>
            <th className="py-2 px-3 w-28">الرصيد التراكمي</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-400 font-semibold">
          {rows.map((r: any) => {
            const isInvoice = !!r.rawInvoice || r.docType === 'invoice_seller' || r.docType === 'invoice_buyer' || String(r.id).startsWith('inv_');
            const docTitle =
              r.docType === 'opening'
                ? 'رصيد افتتاحي'
                : isInvoice
                ? `فاتورة كمسيون رقم ${r.docNumber}`
                : r.docType === 'voucher_receipt'
                ? `سند قبض رقم ${r.docNumber}`
                : r.docType === 'voucher_payment'
                ? `سند دفع رقم ${r.docNumber}`
                : r.docNumber
                ? `مستند رقم ${r.docNumber}`
                : '-';

            return (
              <React.Fragment key={r.id}>
                <tr className="bg-white">
                  <td className="py-2 px-3 border-l border-slate-400 font-mono">{r.date}</td>
                  <td className="py-2 px-3 border-l border-slate-400 font-bold font-mono text-slate-900">{docTitle}</td>
                  {cols?.showOppositeAccount && (
                    <td className="py-2 px-3 border-l border-slate-400 text-right font-bold text-slate-900">
                      {r.oppositeAccount && r.oppositeAccount !== '-' ? r.oppositeAccount : '-'}
                    </td>
                  )}
                  <td className="py-2 px-4 border-l border-slate-400 text-right">{r.description}</td>
                  <td className="py-2 px-3 border-l border-slate-400 font-mono">{r.debit > 0 ? formatCurrency(r.debit, settings.thousandsSeparator) : '-'}</td>
                  <td className="py-2 px-3 border-l border-slate-400 font-mono">{r.credit > 0 ? formatCurrency(r.credit, settings.thousandsSeparator) : '-'}</td>
                  <td className="py-2 px-3 font-mono font-bold">{formatCurrency(r.balance, settings.thousandsSeparator)}</td>
                </tr>
                {mode === 'detailed' && r.rawInvoice?.rows?.length > 0 && (
                  <tr className="bg-slate-50 text-[11px]">
                    <td colSpan={6 + (cols?.showOppositeAccount ? 1 : 0)} className="p-2 border-t border-dashed border-slate-300">
                      <div className="pr-4 text-right font-bold text-slate-700 mb-1">
                        تفاصيل البضاعة:
                      </div>
                      <table className="w-full text-center border border-slate-300 bg-white">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            <th className="py-1 px-2 border border-slate-300">المادة</th>
                            {cols.showGrossWeight && <th className="py-1 px-2 border border-slate-300">وزن قائم</th>}
                            {cols.showDiscountValue && <th className="py-1 px-2 border border-slate-300">قيمة الخصم</th>}
                            {cols.showDiscountPercent && <th className="py-1 px-2 border border-slate-300">نسبة الخصم %</th>}
                            {cols.showNetWeight && <th className="py-1 px-2 border border-slate-300">وزن صافي</th>}
                            {cols.showUnitPrice && <th className="py-1 px-2 border border-slate-300">السعر الإفرادي</th>}
                            {cols.showTotal && <th className="py-1 px-2 border border-slate-300">الإجمالي</th>}
                            {cols.showCommission && <th className="py-1 px-2 border border-slate-300">الكمسيون</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {r.rawInvoice.rows.map((pr: any, prIdx: number) => {
                            const rowCommission = Math.round(
                              (Number(pr.total || 0) * (r.rawInvoice?.commissionRate || 5)) / 100
                            );

                            return (
                              <tr key={prIdx}>
                                <td className="py-1 px-2 border border-slate-200 text-right font-bold">{pr.itemName}</td>
                                {cols.showGrossWeight && <td className="py-1 px-2 border border-slate-200 font-mono">{pr.grossWeight || '-'}</td>}
                                {cols.showDiscountValue && <td className="py-1 px-2 border border-slate-200 font-mono">{pr.discountTare ? `${pr.discountTare} ${pr.unit || 'كغ'}` : '-'}</td>}
                                {cols.showDiscountPercent && <td className="py-1 px-2 border border-slate-200 font-mono">{pr.discountPercent ? `${pr.discountPercent}%` : '-'}</td>}
                                {cols.showNetWeight && <td className="py-1 px-2 border border-slate-200 font-mono font-bold">{pr.netWeight} {pr.unit || 'كغ'}</td>}
                                {cols.showUnitPrice && <td className="py-1 px-2 border border-slate-200 font-mono">{formatCurrency(pr.unitPrice, settings.thousandsSeparator)}</td>}
                                {cols.showTotal && <td className="py-1 px-2 border border-slate-200 font-mono font-bold">{formatCurrency(pr.total, settings.thousandsSeparator)}</td>}
                                {cols.showCommission && (
                                  <td className="py-1 px-2 border border-slate-200 font-mono text-rose-800">
                                    {formatCurrency(rowCommission, settings.thousandsSeparator)} ({r.rawInvoice?.commissionRate}%)
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {mode === 'detailed' ? (
        <div className="grid grid-cols-5 gap-2 border-2 border-slate-800 p-2.5 rounded bg-slate-50 text-xs font-bold text-center print-summary-box">
          <div className="border-l border-slate-300 pl-2">
            <span className="text-slate-700 block">مجموع المدين (لنا): </span>
            <span className="font-mono text-sm block mt-1 text-emerald-800">{formatCurrency(displayDebit, settings.thousandsSeparator)} {settings.currency}</span>
          </div>
          <div className="border-l border-slate-300 pl-2">
            <span className="text-slate-700 block">مجموع الدائن (له): </span>
            <span className="font-mono text-sm block mt-1 text-rose-800">{formatCurrency(displayCredit, settings.thousandsSeparator)} {settings.currency}</span>
          </div>
          <div className="border-l border-slate-300 pl-2">
            <span className="text-slate-700 block">الرصيد النهائي: </span>
            <span className="font-mono text-sm block mt-1 font-black text-slate-950">
              {formatCurrency(Math.abs(displayBalance), settings.thousandsSeparator)} {settings.currency} ({displayBalance > 0 ? 'لنا / مدين' : displayBalance < 0 ? 'له / دائن' : 'متزن'})
            </span>
          </div>
          <div className="border-l border-slate-300 pl-2">
            <span className="text-slate-700 block">إجمالي الوزن القائم: </span>
            <span className="font-mono text-sm block mt-1 text-sky-900">{formatCurrency(displayGrossWeight, settings.thousandsSeparator)} كغ</span>
          </div>
          <div>
            <span className="text-slate-700 block">إجمالي الوزن الصافي: </span>
            <span className="font-mono text-sm block mt-1 text-indigo-900">{formatCurrency(displayNetWeight, settings.thousandsSeparator)} كغ</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 border-2 border-slate-800 p-2.5 rounded bg-slate-50 text-xs font-bold text-center print-summary-box">
          <div className="border-l border-slate-300 pl-2">
            <span className="text-slate-700 block">مجموع المدين (لنا): </span>
            <span className="font-mono text-sm block mt-1 text-emerald-800">{formatCurrency(displayDebit, settings.thousandsSeparator)} {settings.currency}</span>
          </div>
          <div className="border-l border-slate-300 pl-2">
            <span className="text-slate-700 block">مجموع الدائن (له): </span>
            <span className="font-mono text-sm block mt-1 text-rose-800">{formatCurrency(displayCredit, settings.thousandsSeparator)} {settings.currency}</span>
          </div>
          <div>
            <span className="text-slate-700 block">الرصيد النهائي: </span>
            <span className="font-mono text-sm block mt-1 font-black text-slate-950">
              {formatCurrency(Math.abs(displayBalance), settings.thousandsSeparator)} {settings.currency} ({displayBalance > 0 ? 'لنا / مدين' : displayBalance < 0 ? 'له / دائن' : 'متزن'})
            </span>
          </div>
        </div>
      )}

      {settings.showTafqeet && (
        <div className="bg-slate-100 p-2.5 rounded border border-slate-300 text-xs font-bold text-slate-800">
          <span className="text-slate-500 ml-2">فقط وقدره كتابةً:</span>
          <span>{tafqeetNumber(Math.abs(displayBalance), settings.currency)} لا غير.</span>
        </div>
      )}
    </div>
  );
};

/* 5. Commission Report Print */
export const CommissionReportPrint: React.FC<{ data: any; settings: any }> = ({ data, settings }) => {
  const {
    rows,
    invoices = [],
    totalGross = 0,
    totalCommission = 0,
    totalNet = 0,
    startDate,
    endDate,
    searchTerm,
  } = data;

  // If flat rows are provided, print the exact tabular layout
  if (rows && rows.length > 0) {
    return (
      <div className="flex flex-col gap-4 text-sm" dir="rtl">
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
          <PrintCompanyHeader settings={settings} />

          <div className="flex flex-col items-center justify-center self-center text-center">
            <div className="px-6 py-1.5 bg-slate-100 border-2 border-slate-800 rounded-md font-black text-lg text-slate-900 shadow-xs">
              تقرير حركة كمسيون
            </div>
            <span className="text-xs text-slate-600 mt-1 font-bold">
              {startDate || endDate ? `الفترة من: ${startDate || 'البداية'} إلى: ${endDate || 'الآن'}` : 'كافة الفترات'}
              {searchTerm ? ` | البحث: ${searchTerm}` : ''}
            </span>
          </div>
        </div>

        {/* Flat Movement Table */}
        <table className="w-full text-center border-collapse border border-slate-800 text-xs">
          <thead className="bg-[#344455] text-white font-bold border-b border-slate-800">
            <tr>
              <th className="py-2 px-2 border-l border-slate-600 w-12">رقم</th>
              <th className="py-2 px-2 border-l border-slate-600 w-24">تاريخ</th>
              <th className="py-2 px-3 border-l border-slate-600 text-center w-36">المشتري</th>
              <th className="py-2 px-3 border-l border-slate-600 text-center w-36">البائع</th>
              <th className="py-2 px-3 border-l border-slate-600 text-center w-32">المادة</th>
              <th className="py-2 px-2 border-l border-slate-600 w-20">القائم</th>
              <th className="py-2 px-2 border-l border-slate-600 w-20">الصافي</th>
              <th className="py-2 px-3 border-l border-slate-600 w-28">الكمسيون</th>
              <th className="py-2 px-3 w-32">الإجمالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-400 font-semibold">
            {rows.map((r: any, idx: number) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                <td className="py-1.5 px-2 border-l border-slate-400 font-mono text-slate-700">{r.docNumber}</td>
                <td className="py-1.5 px-2 border-l border-slate-400 font-mono">{r.date}</td>
                <td className="py-1.5 px-3 border-l border-slate-400 text-center">{r.buyerName}</td>
                <td className="py-1.5 px-3 border-l border-slate-400 text-center">{r.sellerName}</td>
                <td className="py-1.5 px-3 border-l border-slate-400 text-center font-bold">{r.itemName}</td>
                <td className="py-1.5 px-2 border-l border-slate-400 font-mono">{r.grossWeight}</td>
                <td className="py-1.5 px-2 border-l border-slate-400 font-mono font-bold text-emerald-800">{r.netWeight}</td>
                <td className="py-1.5 px-3 border-l border-slate-400 font-mono font-bold text-amber-900">{formatCurrency(r.commissionValue)}</td>
                <td className="py-1.5 px-3 font-mono font-bold text-slate-900">{formatCurrency(r.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 border-t-2 border-slate-800 text-xs font-bold">
            <tr className="bg-slate-200">
              <td colSpan={5} className="py-2 px-2 border-l border-slate-800 text-center font-black">
                المجموع الكلي ({rows.length} حركة)
              </td>
              <td className="py-2 px-2 border-l border-slate-800 font-mono font-black text-slate-900">
                {data.totalGrossWeight !== undefined && data.totalGrossWeight > 0 ? `${data.totalGrossWeight.toLocaleString()} كغ` : '-'}
              </td>
              <td className="py-2 px-2 border-l border-slate-800 font-mono font-black text-emerald-900">
                {data.totalNetWeight !== undefined && data.totalNetWeight > 0 ? `${data.totalNetWeight.toLocaleString()} كغ` : '-'}
              </td>
              <td className="py-2 px-3 border-l border-slate-800 font-mono font-black text-amber-900">
                {formatCurrency(totalCommission)}
              </td>
              <td className="py-2 px-3 font-mono font-black text-slate-900">
                {formatCurrency(totalGross)}
              </td>
            </tr>
            <tr className="bg-slate-100 border-t border-slate-800 text-xs">
              <td colSpan={7} className="py-1.5 px-3 text-left font-bold text-slate-700 border-l border-slate-800">
                صافي الفواتير (إجمالي الفواتير - عمولة الكمسيون):
              </td>
              <td colSpan={2} className="py-1.5 px-3 font-mono font-black text-emerald-900 text-sm text-center">
                {formatCurrency(totalNet)} {settings.currency || 'ل.س'}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="flex justify-between items-center text-xs text-slate-600 border-t border-slate-400 pt-2 mt-2">
          <div>عدد السطور: {rows.length}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 text-sm" dir="rtl">
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
        <PrintCompanyHeader settings={settings} />

        <div className="flex flex-col items-center justify-center self-center text-center">
          <div className="px-6 py-2 bg-slate-100 border-2 border-slate-800 rounded-md font-black text-lg text-slate-900 shadow-xs">
            تقرير حركة الكمسيون
          </div>
          <span className="text-xs text-slate-600 mt-1 font-bold">
            {startDate || endDate ? `الفترة: ${startDate || 'البداية'} إلى ${endDate || 'الآن'}` : 'كافة الفترات'}
          </span>
        </div>
      </div>

      <table className="w-full text-center border-collapse border border-slate-800 text-xs">
        <thead className="bg-slate-200 font-bold border-b border-slate-800">
          <tr>
            <th className="py-2 px-2 border-l border-slate-800 w-10">م</th>
            <th className="py-2 px-2 border-l border-slate-800 w-24">رقم الفاتورة</th>
            <th className="py-2 px-2 border-l border-slate-800 w-24">التاريخ</th>
            <th className="py-2 px-3 border-l border-slate-800 text-right">البائع</th>
            <th className="py-2 px-3 border-l border-slate-800 text-right">المشتري</th>
            <th className="py-2 px-3 border-l border-slate-800 w-28">إجمالي البضاعة</th>
            <th className="py-2 px-2 border-l border-slate-800 w-16">النسبة</th>
            <th className="py-2 px-3 border-l border-slate-800 w-28">قيمة الكمسيون</th>
            <th className="py-2 px-3 w-28">صافي البائع</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-400 font-semibold">
          {invoices.map((inv: Invoice, idx: number) => (
            <tr key={inv.id} className="bg-white">
              <td className="py-2 px-2 border-l border-slate-400 font-mono text-slate-600">{idx + 1}</td>
              <td className="py-2 px-2 border-l border-slate-400 font-mono font-bold">{inv.invoiceNumber}</td>
              <td className="py-2 px-2 border-l border-slate-400 font-mono">{inv.date}</td>
              <td className="py-2 px-3 border-l border-slate-400 text-right font-bold">{inv.sellerName}</td>
              <td className="py-2 px-3 border-l border-slate-400 text-right">{inv.buyerName}</td>
              <td className="py-2 px-3 border-l border-slate-400 font-mono font-bold">{formatCurrency(inv.totalAmount, settings.thousandsSeparator)}</td>
              <td className="py-2 px-2 border-l border-slate-400 font-mono">%{inv.commissionRate || 5}</td>
              <td className="py-2 px-3 border-l border-slate-400 font-mono font-bold text-amber-900">{formatCurrency(inv.commissionValue, settings.thousandsSeparator)}</td>
              <td className="py-2 px-3 font-mono font-bold text-emerald-900">{formatCurrency(inv.netAmount, settings.thousandsSeparator)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary Footer Box */}
      <div className="border-2 border-slate-800 rounded p-2.5 bg-slate-50 flex items-center justify-between text-xs sm:text-sm font-bold text-slate-900 print-summary-box">
        <div className="font-mono">
          <span>إجمالي الفواتير: </span>
          <span className="font-black text-slate-950">{formatCurrency(totalGross, settings.thousandsSeparator)} {settings.currency || 'ل.س'}</span>
        </div>
        <div className="font-mono">
          <span>قيمة الكمسيون: </span>
          <span className="font-black text-amber-900">{formatCurrency(totalCommission, settings.thousandsSeparator)} {settings.currency || 'ل.س'}</span>
        </div>
        <div className="font-mono">
          <span>صافي الفواتير: </span>
          <span className="font-black text-emerald-800">{formatCurrency(totalNet, settings.thousandsSeparator)} {settings.currency || 'ل.س'}</span>
        </div>
      </div>
    </div>
  );
};

/* 6. Item Report Print */
export const ItemReportPrint: React.FC<{ data: any; settings: any }> = ({ data, settings }) => {
  const {
    movements = [],
    totalInQty = 0,
    totalInPrice = 0,
    totalOutQty = 0,
    totalOutPrice = 0,
    totalBalanceQty = 0,
    totalBalancePrice = 0,
    startDate,
    endDate,
    filterType,
    searchTerm,
  } = data;

  const filterLabel =
    filterType === 'category' ? 'بحث بالصنف' : 'بحث بالمادة';

  return (
    <div className="flex flex-col gap-4 text-xs" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
        <PrintCompanyHeader settings={settings} />

        <div className="flex flex-col items-center justify-center self-center text-center">
          <div className="px-6 py-1.5 bg-slate-100 border-2 border-slate-800 rounded font-black text-base text-slate-900 shadow-xs">
            حركة مادة
          </div>
          <span className="text-[11px] text-slate-700 mt-1 font-bold">
            {filterLabel} {searchTerm ? `(${searchTerm})` : ''} | {startDate || endDate ? `الفترة: ${startDate || 'البداية'} إلى ${endDate || 'الآن'}` : 'كافة الفترات'}
          </span>
        </div>
      </div>

      {/* Main Table with Groups & Direct Column Alignment */}
      <table className="w-full text-center border-collapse border border-slate-800 text-[11px]">
        <thead>
          {/* Level 1 Header */}
          <tr className="bg-slate-200 font-bold border-b border-slate-800">
            <th rowSpan={2} className="py-2 px-2 border-l border-slate-800 w-24">التاريخ</th>
            <th rowSpan={2} className="py-2 px-2 border-l border-slate-800 w-20">الفاتورة</th>
            <th rowSpan={2} className="py-2 px-3 border-l border-slate-800 text-center">اسم المادة</th>
            <th colSpan={2} className="py-1 px-2 border-l border-slate-800 bg-slate-300 font-black">الإدخالات</th>
            <th colSpan={2} className="py-1 px-2 border-l border-slate-800 bg-slate-300 font-black">الإخراجات</th>
            <th colSpan={2} className="py-1 px-2 bg-slate-300 font-black">الرصيد</th>
          </tr>
          {/* Level 2 Header */}
          <tr className="bg-slate-100 font-bold border-b border-slate-800 text-[10px]">
            <th className="py-1 px-2 border-l border-slate-800 w-20">الكمية</th>
            <th className="py-1 px-2 border-l border-slate-800 w-28">السعر</th>
            <th className="py-1 px-2 border-l border-slate-800 w-20">الكمية</th>
            <th className="py-1 px-2 border-l border-slate-800 w-28">السعر</th>
            <th className="py-1 px-2 border-l border-slate-800 w-20">الكمية</th>
            <th className="py-1 px-2 w-28">السعر</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-400 font-semibold">
          {movements.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-8 text-slate-500 font-bold text-center">
                لا توجد حركات مسجلة تطابق خيارات التصفية
              </td>
            </tr>
          ) : (
            movements.map((mov: any, idx: number) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                <td className="py-1.5 px-2 border-l border-slate-400 font-mono text-slate-700">{mov.date}</td>
                <td className="py-1.5 px-2 border-l border-slate-400 font-mono font-bold text-slate-900">{mov.invoiceNumber}</td>
                <td className="py-1.5 px-3 border-l border-slate-400 text-center font-bold text-slate-900">{mov.itemName}</td>
                <td className="py-1.5 px-2 border-l border-slate-400 font-mono font-bold text-slate-800">{mov.inQty}</td>
                <td className="py-1.5 px-2 border-l border-slate-400 font-mono font-bold text-slate-900">{formatCurrency(mov.inPrice, settings.thousandsSeparator)}</td>
                <td className="py-1.5 px-2 border-l border-slate-400 font-mono font-bold text-slate-800">{mov.outQty}</td>
                <td className="py-1.5 px-2 border-l border-slate-400 font-mono font-bold text-slate-900">{formatCurrency(mov.outPrice, settings.thousandsSeparator)}</td>
                <td className="py-1.5 px-2 border-l border-slate-400 font-mono text-slate-600">{mov.balanceQty}</td>
                <td className="py-1.5 px-2 font-mono text-slate-600">{formatCurrency(mov.balancePrice, settings.thousandsSeparator)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot className="bg-slate-200 border-t-2 border-slate-800 text-[11px] font-bold">
          <tr>
            <td colSpan={3} className="py-2 px-2 border-l border-slate-800 text-center font-black">
              المجموع الكلي ({movements.length} حركة)
            </td>
            <td className="py-2 px-2 border-l border-slate-800 font-mono font-black text-slate-900">
              {totalInQty > 0 ? totalInQty.toLocaleString() : '0'}
            </td>
            <td className="py-2 px-2 border-l border-slate-800 font-mono font-black text-slate-900">
              {formatCurrency(totalInPrice, settings.thousandsSeparator)}
            </td>
            <td className="py-2 px-2 border-l border-slate-800 font-mono font-black text-slate-900">
              {totalOutQty > 0 ? totalOutQty.toLocaleString() : '0'}
            </td>
            <td className="py-2 px-2 border-l border-slate-800 font-mono font-black text-slate-900">
              {formatCurrency(totalOutPrice, settings.thousandsSeparator)}
            </td>
            <td className="py-2 px-2 border-l border-slate-800 font-mono font-black text-slate-900">
              {totalBalanceQty.toLocaleString()}
            </td>
            <td className="py-2 px-2 font-mono font-black text-slate-900">
              {formatCurrency(totalBalancePrice, settings.thousandsSeparator)}
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="flex justify-between items-center text-[10px] text-slate-600 border-t border-slate-400 pt-2 mt-2">
        <div>عدد الحركات: {movements.length}</div>
      </div>
    </div>
  );
};

/* 7. Invoices Review / Report Print */
export const InvoicesReportPrint: React.FC<{ data: any; settings: any }> = ({ data, settings }) => {
  const {
    invoices,
    totalGross,
    totalCommission,
    totalNet,
    startDate,
    endDate,
    filterSeller,
    filterBuyer,
    filterPaymentType,
  } = data;

  const paymentTypeLabel =
    filterPaymentType === 'cash' ? 'نقدي' : filterPaymentType === 'credit' ? 'آجل' : 'الكل';

  return (
    <div className="flex flex-col gap-5 text-sm" dir="rtl">
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
        <PrintCompanyHeader settings={settings} />

        <div className="flex flex-col items-center justify-center self-center text-center">
          <div className="px-6 py-2 bg-slate-100 border-2 border-slate-800 rounded-md font-black text-lg text-slate-900 shadow-xs">
            تقرير استعراض الفواتير
          </div>
          <span className="text-xs text-slate-700 mt-1 font-bold flex flex-wrap justify-center gap-1.5">
            {filterSeller ? `البائع: ${filterSeller} | ` : ''}
            {filterBuyer ? `المشتري: ${filterBuyer} | ` : ''}
            {`طريقة الدفع: ${paymentTypeLabel} | `}
            {startDate || endDate ? `الفترة: ${startDate || 'البداية'} إلى ${endDate || 'الآن'}` : 'كافة الفترات'}
          </span>
        </div>
      </div>

      <table className="w-full text-center border-collapse border border-slate-800 text-xs">
        <thead className="bg-slate-200 font-bold border-b border-slate-800">
          <tr>
            <th className="py-2 px-2 border-l border-slate-800 w-16">رقم الفاتورة</th>
            <th className="py-2 px-2 border-l border-slate-800 w-24">التاريخ</th>
            <th className="py-2 px-3 border-l border-slate-800 text-right">البائع</th>
            <th className="py-2 px-2 border-l border-slate-800 w-16">دفع البائع</th>
            <th className="py-2 px-3 border-l border-slate-800 text-right">المشتري</th>
            <th className="py-2 px-2 border-l border-slate-800 w-16">دفع المشتري</th>
            <th className="py-2 px-3 border-l border-slate-800 w-24">الإجمالي القائم</th>
            <th className="py-2 px-3 border-l border-slate-800 w-24">الكمسيون</th>
            <th className="py-2 px-3 w-24">الصافي</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-400 font-semibold">
          {invoices.map((inv: Invoice) => (
            <tr key={inv.id} className="bg-white">
              <td className="py-2 px-2 border-l border-slate-400 font-mono font-bold">{inv.invoiceNumber}</td>
              <td className="py-2 px-2 border-l border-slate-400 font-mono">{inv.date}</td>
              <td className="py-2 px-3 border-l border-slate-400 text-right font-bold">{inv.sellerName}</td>
              <td className="py-2 px-2 border-l border-slate-400 text-[11px] font-bold">{inv.sellerPaymentType || 'نقدي'}</td>
              <td className="py-2 px-3 border-l border-slate-400 text-right font-bold">{inv.buyerName}</td>
              <td className="py-2 px-2 border-l border-slate-400 text-[11px] font-bold">{inv.buyerPaymentType || 'نقدي'}</td>
              <td className="py-2 px-3 border-l border-slate-400 font-mono">{formatCurrency(inv.totalAmount, settings.thousandsSeparator)}</td>
              <td className="py-2 px-3 border-l border-slate-400 font-mono text-amber-900 font-bold">{formatCurrency(inv.commissionValue, settings.thousandsSeparator)}</td>
              <td className="py-2 px-3 font-mono text-emerald-900 font-bold">{formatCurrency(inv.netAmount, settings.thousandsSeparator)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-4 gap-3 border-2 border-slate-800 p-3 rounded bg-slate-50 text-xs font-bold text-center print-summary-box">
        <div>
          <span>عدد الفواتير: </span>
          <span className="font-mono text-sm block mt-1 font-black text-slate-900">{invoices.length} فاتورة</span>
        </div>
        <div>
          <span>مجموع المبيعات (القائم): </span>
          <span className="font-mono text-sm block mt-1 font-bold text-slate-900">{formatCurrency(totalGross, settings.thousandsSeparator)} {settings.currency || 'ل.س'}</span>
        </div>
        <div>
          <span>مجموع العمولات: </span>
          <span className="font-mono text-sm block mt-1 text-amber-900 font-black">{formatCurrency(totalCommission, settings.thousandsSeparator)} {settings.currency || 'ل.س'}</span>
        </div>
        <div>
          <span>صافي الفواتير: </span>
          <span className="font-mono text-base block mt-1 font-black text-emerald-800">{formatCurrency(totalNet, settings.thousandsSeparator)} {settings.currency || 'ل.س'}</span>
        </div>
      </div>
    </div>
  );
};

/* 8. Accounts List Print */
export const AccountsListPrint: React.FC<{ data: any; settings: any }> = ({ data, settings }) => {
  const accounts: any[] = data?.accounts || [];
  const stats = data?.stats || { totalDebit: 0, totalCredit: 0, net: 0, totalCount: accounts.length };
  const filterTitle = data?.filterTitle || 'دليل وأرصدة الحسابات';

  return (
    <div className="flex flex-col gap-5 text-sm" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
        <PrintCompanyHeader settings={settings} />

        <div className="flex flex-col items-center justify-center self-center text-center">
          <div className="px-6 py-2 bg-slate-100 border-2 border-slate-800 rounded-md font-black text-lg text-slate-900 shadow-xs">
            تقرير دليل وأرصدة الحسابات
          </div>
          <span className="text-xs text-slate-700 mt-1 font-bold">
            {filterTitle} | التاريخ: {new Date().toLocaleDateString('ar-EG')}
          </span>
        </div>
      </div>

      {/* Table */}
      <table className="w-full text-center border-collapse border border-slate-800 text-xs">
        <thead className="bg-slate-200 font-bold border-b border-slate-800">
          <tr>
            <th className="py-2 px-2 border-l border-slate-800 w-12">#</th>
            <th className="py-2 px-2 border-l border-slate-800 w-24">رمز الحساب</th>
            <th className="py-2 px-3 border-l border-slate-800 text-right">اسم الحساب</th>
            <th className="py-2 px-3 border-l border-slate-800 text-right w-32">الحساب الرئيسي (الأب)</th>
            <th className="py-2 px-3 border-l border-slate-800 w-28">مدين (له)</th>
            <th className="py-2 px-3 border-l border-slate-800 w-28">دائن (عليه)</th>
            <th className="py-2 px-3 w-28">الرصيد الصافي</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-400 font-semibold">
          {accounts.map((acc, idx) => {
            const bal = Number(acc.computedBalance ?? acc.currentBalance ?? 0);
            const isDebit = bal > 0;
            const isCredit = bal < 0;
            return (
              <tr key={acc.id || idx} className="bg-white hover:bg-slate-50">
                <td className="py-2 px-2 border-l border-slate-400 font-mono text-slate-600">{idx + 1}</td>
                <td className="py-2 px-2 border-l border-slate-400 font-mono font-bold text-slate-900">{acc.code}</td>
                <td className="py-2 px-3 border-l border-slate-400 text-right font-bold text-slate-950">{acc.name}</td>
                <td className="py-2 px-3 border-l border-slate-400 text-right text-slate-700">{acc.parentAccount || 'حساب رئيسي'}</td>
                <td className="py-2 px-3 border-l border-slate-400 font-mono text-emerald-800 font-bold">
                  {isDebit ? formatCurrency(bal, settings.thousandsSeparator) : '-'}
                </td>
                <td className="py-2 px-3 border-l border-slate-400 font-mono text-rose-800 font-bold">
                  {isCredit ? formatCurrency(Math.abs(bal), settings.thousandsSeparator) : '-'}
                </td>
                <td className={`py-2 px-3 font-mono font-black ${isDebit ? 'text-emerald-800' : isCredit ? 'text-rose-800' : 'text-slate-600'}`}>
                  {formatCurrency(Math.abs(bal), settings.thousandsSeparator)} {isDebit ? '(مدين)' : isCredit ? '(دائن)' : '(متزن)'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary Footer */}
      <div className="grid grid-cols-4 gap-3 border-2 border-slate-800 p-3 rounded bg-slate-50 text-xs font-bold text-center print-summary-box">
        <div>
          <span>إجمالي الحسابات: </span>
          <span className="font-mono text-sm block mt-1 font-black text-slate-900">{stats.totalCount || accounts.length} حساب</span>
        </div>
        <div>
          <span>مجموع الأرصدة المدينة: </span>
          <span className="font-mono text-sm block mt-1 font-black text-emerald-800">{formatCurrency(stats.totalDebit || 0, settings.thousandsSeparator)} {settings.currency || 'ل.س'}</span>
        </div>
        <div>
          <span>مجموع الأرصدة الدائنة: </span>
          <span className="font-mono text-sm block mt-1 font-black text-rose-800">{formatCurrency(stats.totalCredit || 0, settings.thousandsSeparator)} {settings.currency || 'ل.س'}</span>
        </div>
        <div>
          <span>صافي الرصيد العام: </span>
          <span className="font-mono text-base block mt-1 font-black text-slate-950">
            {formatCurrency(Math.abs(stats.net || 0), settings.thousandsSeparator)} {settings.currency || 'ل.س'} {stats.net > 0 ? '(مدين)' : stats.net < 0 ? '(دائن)' : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

/* 9. Items List Print */
export const ItemsListPrint: React.FC<{ data: any; settings: any }> = ({ data, settings }) => {
  const items: any[] = data?.items || [];
  const categoryFilter = data?.categoryFilter || 'الكل';

  return (
    <div className="flex flex-col gap-5 text-sm" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
        <PrintCompanyHeader settings={settings} />

        <div className="flex flex-col items-center justify-center self-center text-center">
          <div className="px-6 py-2 bg-slate-100 border-2 border-slate-800 rounded-md font-black text-lg text-slate-900 shadow-xs">
            دليل وقائمة المواد والأصناف
          </div>
          <span className="text-xs text-slate-700 mt-1 font-bold">
            {categoryFilter !== 'all' ? `الصنف: ${categoryFilter} | ` : ''} التاريخ: {new Date().toLocaleDateString('ar-EG')}
          </span>
        </div>
      </div>

      {/* Table */}
      <table className="w-full text-center border-collapse border border-slate-800 text-xs">
        <thead className="bg-slate-200 font-bold border-b border-slate-800">
          <tr>
            <th className="py-2 px-2 border-l border-slate-800 w-12">#</th>
            <th className="py-2 px-2 border-l border-slate-800 w-28">رمز المادة</th>
            <th className="py-2 px-3 border-l border-slate-800 text-right">اسم المادة</th>
            <th className="py-2 px-3 border-l border-slate-800 text-right w-40">الصنف التابع له</th>
            <th className="py-2 px-3 border-l border-slate-800 w-28">الوحدة الافتراضية</th>
            <th className="py-2 px-3 text-right">ملاحظات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-400 font-semibold">
          {items.map((item, idx) => (
            <tr key={item.id || idx} className="bg-white hover:bg-slate-50">
              <td className="py-2 px-2 border-l border-slate-400 font-mono text-slate-600">{idx + 1}</td>
              <td className="py-2 px-2 border-l border-slate-400 font-mono font-bold text-slate-900">{item.code}</td>
              <td className="py-2 px-3 border-l border-slate-400 text-right font-bold text-slate-950">{item.name}</td>
              <td className="py-2 px-3 border-l border-slate-400 text-right text-slate-700">{item.category || '-'}</td>
              <td className="py-2 px-3 border-l border-slate-400 font-bold text-slate-800">{item.unit || 'طرد'}</td>
              <td className="py-2 px-3 text-right text-slate-600 text-[11px]">{item.notes || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary Footer */}
      <div className="border-2 border-slate-800 p-3 rounded bg-slate-50 text-xs font-bold text-center print-summary-box">
        <span>إجمالي عدد المواد المدرجة: </span>
        <span className="font-mono text-base font-black text-slate-900 mr-2">{items.length} مادة</span>
      </div>
    </div>
  );
};

