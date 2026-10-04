import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, Trash2, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ConfirmModal';

interface BackupRestoreModalProps {
  isOpen: boolean;
  initialTab?: 'backup' | 'restore' | 'empty';
  onClose: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  initialTab = 'backup',
  onClose,
}) => {
  const { exportSqlBackup, importBackup, emptyDatabase, currentDatabaseName } = useApp();
  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'empty'>(initialTab);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize activeTab whenever modal opens or initialTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setMessage(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleDownloadSqlBackup = () => {
    try {
      const dataStr = exportSqlBackup();
      const blob = new Blob([dataStr], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `commission_backup_${currentDatabaseName}_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMessage({ text: 'تم تنزيل النسخة الاحتياطية بصيغة PostgreSQL SQL (.sql) بنجاح!', type: 'success' });
    } catch {
      setMessage({ text: 'حدث خطأ أثناء تصدير النسخة الاحتياطية', type: 'error' });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setPendingRestoreData(content);
      setShowRestoreConfirm(true);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeRestore = () => {
    if (!pendingRestoreData) return;
    const success = importBackup(pendingRestoreData);
    setShowRestoreConfirm(false);
    setPendingRestoreData(null);
    if (success) {
      setMessage({ text: 'تمت استعادة النسخة الاحتياطية بنجاح!', type: 'success' });
    } else {
      setMessage({ text: 'فشل في استعادة النسخة الاحتياطية، الملف غير صالح', type: 'error' });
    }
  };

  const executeEmpty = () => {
    emptyDatabase();
    setShowEmptyConfirm(false);
    setMessage({ text: 'تم تفريغ قاعدة البيانات بنجاح', type: 'success' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#3c4f65] text-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-600/80 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-slate-300 hover:text-white p-1 rounded-full hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Tabs */}
        <div className="flex border-b border-slate-500/40 pb-3 mb-5 gap-2">
          <button
            onClick={() => {
              setActiveTab('backup');
              setMessage(null);
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-white text-slate-900 shadow'
                : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            أخذ نسخة احتياطية
          </button>
          <button
            onClick={() => {
              setActiveTab('restore');
              setMessage(null);
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'restore'
                ? 'bg-white text-slate-900 shadow'
                : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            استعادة نسخة
          </button>
          <button
            onClick={() => {
              setActiveTab('empty');
              setMessage(null);
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'empty'
                ? 'bg-rose-600 text-white shadow'
                : 'text-rose-300 hover:bg-slate-700'
            }`}
          >
            تفريغ قاعدة البيانات
          </button>
        </div>

        {/* Message notification */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400'
                : 'bg-rose-500/20 text-rose-200 border border-rose-400'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Tab 1: Backup */}
        {activeTab === 'backup' && (
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <div className="p-4 bg-emerald-900/40 rounded-full border border-emerald-400/40 text-emerald-400">
              <Download className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">تصدير وحفظ نسخة احتياطية (SQL)</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-sm leading-relaxed">
                تنزيل جميع البيانات والجداول المحاسبية من قاعدة البيانات ({currentDatabaseName}) كملف نصي تنفيذي بصيغة SQL (.sql).
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              <button
                type="button"
                onClick={handleDownloadSqlBackup}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-2 active:scale-95"
              >
                <Download className="w-5 h-5" />
                <span>تحميل النسخة الاحتياطية بصيغة SQL (.sql)</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Restore */}
        {activeTab === 'restore' && (
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <div className="p-4 bg-amber-900/40 rounded-full border border-amber-400/40 text-amber-400">
              <Upload className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">استعادة نسخة احتياطية سابقة</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-sm leading-relaxed">
                اختر ملف النسخة الاحتياطية بصيغة SQL (.sql) لاسترجاع البيانات لقاعدة البيانات الحالية ({currentDatabaseName}).
              </p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".sql,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-lg shadow-lg cursor-pointer transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>اختيار ملف النسخة الاحتياطية (.sql)</span>
            </button>
          </div>
        )}

        {/* Tab 3: Empty */}
        {activeTab === 'empty' && (
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <div className="p-4 bg-rose-900/40 rounded-full border border-rose-400/40 text-rose-400">
              <Trash2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">تفريغ وحذف كافة البيانات</h3>
              <p className="text-xs text-rose-200 mt-1 max-w-sm bg-rose-950/40 p-2.5 rounded border border-rose-600/50 leading-relaxed">
                تحذير: سيتم حذف وتفريغ كافة السندات، الفواتير، المواد، الأصناف، والحسابات المضافة بشكل كامل والاحتفاظ بالحسابات الـ 5 الافتراضية فقط من الملف الحالي ({currentDatabaseName}).
              </p>
            </div>
            <button
              onClick={() => setShowEmptyConfirm(true)}
              className="mt-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-lg shadow-lg cursor-pointer transition-colors"
            >
              تفريغ كافة البيانات الآن
            </button>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-600/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-1.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded shadow cursor-pointer transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Confirmation for Restore */}
      <ConfirmModal
        isOpen={showRestoreConfirm}
        title="تأكيد استعادة النسخة الاحتياطية"
        message="هل أنت متأكد من استعادة هذه النسخة؟ سيتم استبدال البيانات الحالية في هذا الملف بالبيانات الموجودة في ملف النسخة."
        confirmText="نعم، استعادة النسخة"
        onConfirm={executeRestore}
        onCancel={() => {
          setShowRestoreConfirm(false);
          setPendingRestoreData(null);
        }}
      />

      {/* Confirmation for Empty */}
      <ConfirmModal
        isOpen={showEmptyConfirm}
        title="تأكيد تفريغ كافة البيانات"
        message={`هل أنت متأكد تماماً من حذف وتفريغ كافة البيانات (السندات، الفواتير، المواد، الأصناف، والحسابات المضافة) والاحتفاظ بالحسابات الـ 5 الافتراضية فقط من الملف "${currentDatabaseName}"؟\n\nتنبيه: سيتم مسح القيود والسجلات نهائياً، ولا يمكن التراجع عن هذه الخطوة إلا بوجود نسخة احتياطية سابقة!`}
        confirmText="نعم، تفريغ وحذف كافة البيانات"
        onConfirm={executeEmpty}
        onCancel={() => setShowEmptyConfirm(false)}
      />
    </div>
  );
};
