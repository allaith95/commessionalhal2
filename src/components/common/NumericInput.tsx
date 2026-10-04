import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { formatThousands, parseThousands } from '../../utils/numberFormat';

export interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string | null | undefined;
  onChange: (val: number) => void;
  allowDecimals?: boolean;
  onEnter?: () => void;
}

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(({
  value,
  onChange,
  allowDecimals = true,
  onEnter,
  className = '',
  placeholder = '0',
  disabled = false,
  readOnly = false,
  onKeyDown,
  ...props
}, ref) => {
  const { settings } = useApp();
  const separator = settings?.thousandsSeparator ?? ',';

  // Internal string state for fluid typing
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (value === null || value === undefined || value === '' || value === 0) return '';
    return formatThousands(value, separator);
  });

  const isInternalChange = useRef(false);

  // Sync with incoming external prop changes
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (value === null || value === undefined || value === '' || (typeof value === 'number' && isNaN(value))) {
      setDisplayValue('');
    } else if (value === 0) {
      // If display value is already '0' or empty, keep it
      if (displayValue !== '0' && displayValue !== '') {
        setDisplayValue('');
      }
    } else {
      const currentParsed = parseThousands(displayValue, separator);
      if (currentParsed !== Number(value)) {
        setDisplayValue(formatThousands(value, separator));
      }
    }
  }, [value, separator]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Handle empty input
    if (!raw.trim()) {
      isInternalChange.current = true;
      setDisplayValue('');
      onChange(0);
      return;
    }

    // Format with thousands separator
    const formatted = formatThousands(raw, separator);
    const num = parseThousands(formatted, separator);

    isInternalChange.current = true;
    setDisplayValue(formatted);
    onChange(num);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter) {
      onEnter();
    }
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      dir="ltr"
      ref={ref}
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      readOnly={readOnly}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  );
});

NumericInput.displayName = 'NumericInput';
