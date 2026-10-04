import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scissors, Copy, ClipboardPaste, CheckSquare } from 'lucide-react';

interface MenuPosition {
  x: number;
  y: number;
}

export const CustomContextMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const targetElementRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close context menu
  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Listen to global contextmenu events
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // دائماً منع ظهور قائمة المتصفح الافتراضية للزر اليمين نهائياً
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement;
      targetElementRef.current = target;

      // تحقق من وجود نص محدد حالياً (سواء داخل حقل إدخال/نصي أو في الصفحة العامة)
      let hasSelectedText = false;

      // 1. فحص حقول الإدخال والنصوص
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const start = target.selectionStart ?? 0;
        const end = target.selectionEnd ?? 0;
        if (end > start) {
          const selectedVal = target.value.substring(start, end);
          if (selectedVal.trim().length > 0) {
            hasSelectedText = true;
          }
        }
      }

      // 2. فحص التحديد العام في الصفحة
      if (!hasSelectedText) {
        const sel = window.getSelection();
        const selText = sel ? sel.toString().trim() : '';
        if (selText.length > 0) {
          hasSelectedText = true;
        }
      }

      // القائمة اليمين يجب ألا تظهر إلا في حال وجود نص موجود ومحدد
      if (!hasSelectedText) {
        setIsOpen(false);
        return;
      }

      const menuWidth = 190;
      const menuHeight = 175;

      let posX = e.clientX;
      let posY = e.clientY;

      // Boundary check right/bottom edges
      if (posX + menuWidth > window.innerWidth) {
        posX = Math.max(10, posX - menuWidth);
      }
      if (posY + menuHeight > window.innerHeight) {
        posY = Math.max(10, posY - menuHeight);
      }

      setPosition({ x: posX, y: posY });
      setIsOpen(true);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    const handleScroll = () => {
      closeMenu();
    };

    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [closeMenu]);

  // 1. قص (Cut)
  const handleCut = async () => {
    closeMenu();
    const el = targetElementRef.current;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.focus();
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const selected = el.value.substring(start, end);
      const textToCut = selected || el.value;

      if (textToCut) {
        try {
          await navigator.clipboard.writeText(textToCut);
          if (selected) {
            el.setRangeText('', start, end, 'end');
          } else {
            el.value = '';
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (err) {
          document.execCommand('cut');
        }
      }
    } else {
      const selection = window.getSelection();
      const text = selection?.toString();
      if (text) {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          document.execCommand('copy');
        }
      }
    }
  };

  // 2. نسخ (Copy)
  const handleCopy = async () => {
    closeMenu();
    const el = targetElementRef.current;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const text = el.value.substring(start, end) || el.value;
      if (text) {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          el.select();
          document.execCommand('copy');
        }
      }
    } else {
      const selection = window.getSelection();
      const text = selection?.toString() || (el ? el.innerText || el.textContent : '');
      if (text) {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          document.execCommand('copy');
        }
      }
    }
  };

  // 3. لصق (Paste)
  const handlePaste = async () => {
    closeMenu();
    const el = targetElementRef.current;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.focus();
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          const start = el.selectionStart ?? 0;
          const end = el.selectionEnd ?? 0;
          el.setRangeText(text, start, end, 'end');
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } catch (err) {
        // Fallback if permission not granted
        document.execCommand('paste');
      }
    }
  };

  // 4. تحديد الكل (Select All)
  const handleSelectAll = () => {
    closeMenu();
    const el = targetElementRef.current;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.focus();
      el.select();
    } else {
      const selection = window.getSelection();
      const range = document.createRange();
      if (el) {
        range.selectNodeContents(el);
      } else {
        range.selectNodeContents(document.body);
      }
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[99999] bg-[#1e293b]/95 backdrop-blur-md border border-slate-600/90 rounded-xl shadow-2xl py-1.5 w-48 text-slate-100 select-none animate-in fade-in zoom-in-95 duration-100 font-sans"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      dir="rtl"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* 1. قص (Cut) */}
      <button
        type="button"
        onClick={handleCut}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-sky-600/30 hover:text-sky-300 text-slate-200 text-xs font-bold transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <Scissors className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-300" />
          <span>قص</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 group-hover:text-sky-300/80">Ctrl + X</span>
      </button>

      {/* 2. نسخ (Copy) */}
      <button
        type="button"
        onClick={handleCopy}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-sky-600/30 hover:text-sky-300 text-slate-200 text-xs font-bold transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-300" />
          <span>نسخ</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 group-hover:text-sky-300/80">Ctrl + C</span>
      </button>

      {/* 3. لصق (Paste) */}
      <button
        type="button"
        onClick={handlePaste}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-sky-600/30 hover:text-sky-300 text-slate-200 text-xs font-bold transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <ClipboardPaste className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-300" />
          <span>لصق</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 group-hover:text-sky-300/80">Ctrl + V</span>
      </button>

      <div className="my-1 border-t border-slate-700/80" />

      {/* 4. تحديد الكل (Select All) */}
      <button
        type="button"
        onClick={handleSelectAll}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-sky-600/30 hover:text-sky-300 text-slate-200 text-xs font-bold transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <CheckSquare className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-300" />
          <span>تحديد الكل</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 group-hover:text-sky-300/80">Ctrl + A</span>
      </button>
    </div>
  );
};
