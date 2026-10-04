import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check, AlertCircle, Plus, UserPlus } from 'lucide-react';

export interface ComboboxOption {
  id: string;
  label: string;
  code?: string;
  subLabel?: string;
  badge?: string;
}

interface ContainmentComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (id: string, option?: ComboboxOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allowCustom?: boolean;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: 'sm' | 'md';
  onAddNew?: (searchedText: string) => void;
  addNewType?: 'account' | 'item' | 'general';
  onEnterNotFound?: (searchedText: string) => void;
  showCode?: boolean;
  onAddClick?: () => void;
  addTitle?: string;
  gridRow?: number;
  gridCol?: number;
  onGridKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

// Arabic text normalizer for accurate containment search
export const normalizeArabicText = (text: string): string => {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel (fatha, damma, etc.)
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[\s\-_]+/g, ' ');
};

// Excluded root accounts requested by user ("أصول", "حسابات ختامية", "مدينون", "دائنون", "إيرادات", "خصوم")
const EXCLUDED_ROOT_ACCOUNTS = [
  'اصول',
  'حسابات ختاميه',
  'حساب ختامي',
  'حسابات ختامي',
  'مدينون',
  'دائنون',
  'ايرادات',
  'خصوم',
  'اصول متداوله',
];

export const ContainmentCombobox: React.FC<ContainmentComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = '-- ابحث واختر --',
  searchPlaceholder = 'اكتب للبحث هنا بالاسم...',
  allowCustom = false,
  className = '',
  disabled = false,
  autoFocus = false,
  size = 'md',
  onAddNew,
  addNewType = 'account',
  onEnterNotFound,
  showCode = true,
  onAddClick,
  addTitle,
  gridRow,
  gridCol,
  onGridKeyDown,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter out excluded parent accounts ("أصول", "حسابات ختامية")
  const sanitizedOptions = useMemo(() => {
    const list = Array.isArray(options) ? options : [];
    return list.filter((opt) => {
      const normLabel = normalizeArabicText(opt.label);
      const isExcluded = EXCLUDED_ROOT_ACCOUNTS.some((ex) => normLabel === ex || normLabel.startsWith(ex));
      return !isExcluded;
    });
  }, [options]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return sanitizedOptions.find((opt) => opt.id === value || opt.label === value);
  }, [sanitizedOptions, value]);

  // Sync display text when value changes and combobox is not focused
  useEffect(() => {
    if (!isOpen) {
      if (selectedOption) {
        setInputValue(selectedOption.label);
      } else if (value && allowCustom) {
        setInputValue(value);
      } else {
        setInputValue('');
      }
    }
  }, [selectedOption, value, isOpen, allowCustom]);

  // Containment Filter: matches ANYWHERE in label, code, or subLabel based on inputValue
  const filteredOptions = useMemo(() => {
    if (!isOpen || !inputValue.trim()) {
      return sanitizedOptions;
    }
    // If input value exactly matches the selected option's label, show all options unless user edits
    if (selectedOption && inputValue.trim() === selectedOption.label.trim()) {
      return sanitizedOptions;
    }
    const query = normalizeArabicText(inputValue);
    return sanitizedOptions.filter((opt) => {
      const matchLabel = normalizeArabicText(opt.label).includes(query);
      const matchCode = showCode && opt.code ? opt.code.toLowerCase().includes(query) : false;
      const matchSub = opt.subLabel ? normalizeArabicText(opt.subLabel).includes(query) : false;
      return matchLabel || matchCode || matchSub;
    });
  }, [sanitizedOptions, inputValue, isOpen, selectedOption, showCode]);

  // Click outside to close and apply custom if allowed
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (isOpen) {
          setIsOpen(false);
          if (allowCustom && inputValue.trim() && !selectedOption) {
            onChange(inputValue.trim(), { id: inputValue.trim(), label: inputValue.trim() });
          } else if (selectedOption) {
            setInputValue(selectedOption.label);
          } else if (!value) {
            setInputValue('');
          }
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, allowCustom, inputValue, selectedOption, onChange, value]);

  // Reset highlight index when filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions.length]);

  const handleSelect = (option: ComboboxOption) => {
    onChange(option.id, option);
    setInputValue(option.label);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', undefined);
    setInputValue('');
    setIsOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        if (inputValue.trim()) {
          const match = sanitizedOptions.find(
            (opt) => normalizeArabicText(opt.label) === normalizeArabicText(inputValue) || opt.id === inputValue.trim()
          );
          if (match) {
            handleSelect(match);
          } else if (onEnterNotFound) {
            e.preventDefault();
            onEnterNotFound(inputValue.trim());
            return;
          }
        }
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length > 0 && filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (inputValue.trim()) {
        const match = sanitizedOptions.find(
          (opt) => normalizeArabicText(opt.label) === normalizeArabicText(inputValue) || opt.id === inputValue.trim()
        );
        if (match) {
          handleSelect(match);
        } else if (onEnterNotFound) {
          setIsOpen(false);
          onEnterNotFound(inputValue.trim());
        } else if (allowCustom) {
          onChange(inputValue.trim(), { id: inputValue.trim(), label: inputValue.trim() });
          setIsOpen(false);
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      if (selectedOption) {
        setInputValue(selectedOption.label);
      } else if (!value) {
        setInputValue('');
      }
    }
  };

  const isSmall = size === 'sm';

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-right select-none ${className}`}
      dir="rtl"
    >
      {/* Search Input Box directly in the field */}
      <div
        className={`flex items-center justify-between gap-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg shadow-xs transition-all hover:border-slate-400 focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500 ${
          disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''
        } ${isSmall ? 'px-2 py-0.5' : 'px-2.5 py-1'}`}
      >
        <div className="flex items-center gap-1.5 overflow-hidden flex-1 text-right">
          <Search className={`text-slate-400 shrink-0 ${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
          {showCode && selectedOption?.code && !isOpen && (
            <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 border border-slate-200">
              {selectedOption.code}
            </span>
          )}
          {selectedOption?.badge && !isOpen && (
            <span className="font-mono bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 border border-emerald-300 whitespace-nowrap shadow-2xs">
              {selectedOption.badge}
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            data-grid-row={gridRow}
            data-grid-col={gridCol}
            disabled={disabled}
            autoFocus={autoFocus}
            value={inputValue}
            placeholder={placeholder}
            onFocus={() => {
              if (!disabled) {
                // Select text for quick typing over existing selection
                inputRef.current?.select();
              }
            }}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onKeyDown={(e) => {
              if (!isOpen) {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Enter') {
                  if (onGridKeyDown) {
                    onGridKeyDown(e);
                    if (e.defaultPrevented) return;
                  }
                }
              }
              handleKeyDown(e);
            }}
            className={`w-full bg-transparent text-slate-900 font-bold focus:outline-none placeholder:text-slate-400 placeholder:font-normal ${
              isSmall ? 'text-xs py-0.5' : 'text-xs py-1'
            }`}
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onAddClick && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddClick();
              }}
              className="p-1 text-sky-600 hover:text-sky-800 hover:bg-sky-50 active:bg-sky-100 rounded border border-sky-200 transition-colors cursor-pointer shrink-0"
              title={addTitle || "إضافة جديد"}
            >
              <UserPlus className={isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            </button>
          )}
          {(value || inputValue) && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="مسح الاختيار"
            >
              <X className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              if (!disabled) {
                setIsOpen(!isOpen);
                if (!isOpen) inputRef.current?.focus();
              }
            }}
            className="p-0.5 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          >
            <ChevronDown
              className={`text-slate-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-sky-600' : ''
              } ${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'}`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown Options List Only (Search occurs directly in the field above) */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-full min-w-[260px] max-w-[420px] bg-white border border-slate-300 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Status summary banner */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span>نتائج البحث ({filteredOptions.length})</span>
            <span className="text-[10px] text-slate-400">اضغط Enter أو اختر بالماوس</span>
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs font-semibold">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-slate-700 bg-amber-50/60">
                <div className="flex items-center justify-center gap-1.5 text-amber-800 font-black text-xs mb-1">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {addNewType === 'item' ? 'المادة غير موجودة' : 'الحساب غير موجود'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mb-2.5">
                  {inputValue.trim()
                    ? `لا يوجد تطابق للاسم "${inputValue.trim()}" في النظام`
                    : 'لا توجد بيانات مطابقة للبحث'}
                </p>
                {onAddNew && inputValue.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      const text = inputValue.trim();
                      setIsOpen(false);
                      onAddNew(text);
                    }}
                    className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-md text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      إضافة {addNewType === 'item' ? 'مادة جديدة' : 'حساب جديد'}: &quot;{inputValue.trim()}&quot;
                    </span>
                  </button>
                )}
                {allowCustom && inputValue.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(inputValue.trim(), { id: inputValue.trim(), label: inputValue.trim() });
                      setIsOpen(false);
                    }}
                    className="block w-full mt-2 py-1 px-2 text-slate-500 hover:text-slate-800 text-[10px] font-semibold underline cursor-pointer"
                  >
                    استخدام &quot;{inputValue.trim()}&quot; كنص يدوي فقط
                  </button>
                )}
              </div>
            ) : (
              <>
                {filteredOptions.map((opt, index) => {
                  const isSelected = selectedOption?.id === opt.id || value === opt.id || value === opt.label;
                  const isHighlighted = highlightedIndex === index;

                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSelect(opt)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-sky-100 text-sky-950 font-black'
                          : isHighlighted
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden text-right flex-1">
                        {showCode && opt.code && (
                          <span className="font-mono bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 border border-slate-300">
                            {opt.code}
                          </span>
                        )}
                        <div className="flex flex-col truncate">
                          <span className="truncate text-xs font-bold">{opt.label}</span>
                          {opt.subLabel && (
                            <span className="text-[10px] text-slate-500 truncate">{opt.subLabel}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 mr-2">
                        {opt.badge && (
                          <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300 font-bold">
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-sky-700 shrink-0" />}
                      </div>
                    </div>
                  );
                })}

                {/* Additional option to add new if user typed something that is not an exact match */}
                {onAddNew && inputValue.trim() && !filteredOptions.some(o => o.label.trim() === inputValue.trim()) && (
                  <div className="p-1.5 bg-slate-50 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        const text = inputValue.trim();
                        setIsOpen(false);
                        onAddNew(text);
                      }}
                      className="flex items-center justify-center gap-1.5 w-full py-1 px-2 text-emerald-700 hover:bg-emerald-50 rounded text-[11px] font-bold transition-colors cursor-pointer border border-emerald-300/50"
                    >
                      <Plus className="w-3 h-3 text-emerald-600" />
                      <span>
                        إضافة {addNewType === 'item' ? 'مادة جديدة' : 'حساب جديد'}: &quot;{inputValue.trim()}&quot;
                      </span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
