import React from 'react';

/**
 * Grid Keyboard Navigation helper for RTL Table Grids (Invoice and Voucher rows)
 * Seamlessly navigates across rows and columns using DOM hierarchy.
 * Fully supports dynamically hidden/visible columns without jumping or skipping fields.
 * Handles ArrowLeft (forward in RTL), ArrowRight (backward in RTL), Enter, Tab, Shift+Tab, ArrowDown, ArrowUp.
 */
export const handleGridKeyDown = (
  e: React.KeyboardEvent<HTMLInputElement>,
  rowIndex: number,
  colIndex: number,
  containerId: string,
  onAddRow?: () => void
) => {
  const input = e.currentTarget;
  const val = input.value || '';
  const selStart = input.selectionStart ?? 0;
  const selEnd = input.selectionEnd ?? 0;
  const allSelected = (selStart === 0 && selEnd === val.length) || val === '';

  let moveDirection: 'up' | 'down' | 'forward' | 'backward' | null = null;

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    moveDirection = 'up';
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    moveDirection = 'down';
  } else if (e.key === 'Tab') {
    e.preventDefault();
    moveDirection = e.shiftKey ? 'backward' : 'forward';
  } else if (e.key === 'Enter') {
    e.preventDefault();
    moveDirection = 'forward';
  } else if (e.key === 'ArrowLeft') {
    // In RTL tables (right-to-left layout): ArrowLeft moves forward to the next cell
    if (allSelected || selEnd >= val.length || e.altKey || e.ctrlKey) {
      e.preventDefault();
      moveDirection = 'forward';
    }
  } else if (e.key === 'ArrowRight') {
    // In RTL tables: ArrowRight moves backward to the previous cell
    if (allSelected || selStart <= 0 || e.altKey || e.ctrlKey) {
      e.preventDefault();
      moveDirection = 'backward';
    }
  }

  if (!moveDirection) return;

  const currentTr = input.closest('tr');
  if (!currentTr) return;

  // Helper to get all editable, visible inputs inside a specific table row
  const getInputsInRow = (tr: HTMLTableRowElement): HTMLInputElement[] => {
    const inputs = Array.from(tr.querySelectorAll<HTMLInputElement>('input:not([type="hidden"])'));
    return inputs.filter((el) => {
      if (el.disabled || el.readOnly) return false;
      if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;
      return true;
    });
  };

  const focusAndSelect = (target: HTMLInputElement) => {
    target.focus();
    target.select();
  };

  const currentRowInputs = getInputsInRow(currentTr);
  const currentInputIndex = currentRowInputs.indexOf(input);

  // Helper to find next visible table row in tbody
  const getNextTr = (tr: HTMLTableRowElement): HTMLTableRowElement | null => {
    let next = tr.nextElementSibling;
    while (next && next.tagName.toLowerCase() !== 'tr') {
      next = next.nextElementSibling;
    }
    return next as HTMLTableRowElement | null;
  };

  // Helper to find previous visible table row in tbody
  const getPrevTr = (tr: HTMLTableRowElement): HTMLTableRowElement | null => {
    let prev = tr.previousElementSibling;
    while (prev && prev.tagName.toLowerCase() !== 'tr') {
      prev = prev.previousElementSibling;
    }
    return prev as HTMLTableRowElement | null;
  };

  // 1. Moving forward (ArrowLeft in RTL, Enter, Tab)
  if (moveDirection === 'forward') {
    // If there is another visible input in the current row, move to it
    if (currentInputIndex >= 0 && currentInputIndex < currentRowInputs.length - 1) {
      focusAndSelect(currentRowInputs[currentInputIndex + 1]);
      return;
    }

    // Otherwise, we are at the very end of the current row -> wrap to the first input of the next row
    const nextTr = getNextTr(currentTr);
    if (nextTr) {
      const nextRowInputs = getInputsInRow(nextTr);
      if (nextRowInputs.length > 0) {
        focusAndSelect(nextRowInputs[0]);
        return;
      }
    }

    // At the end of all existing rows -> trigger addRow and focus first cell of the newly added row
    if (onAddRow) {
      onAddRow();
      setTimeout(() => {
        const freshNextTr = getNextTr(currentTr);
        if (freshNextTr) {
          const freshInputs = getInputsInRow(freshNextTr);
          if (freshInputs.length > 0) {
            focusAndSelect(freshInputs[0]);
          }
        }
      }, 70);
    }
    return;
  }

  // 2. Moving backward (ArrowRight in RTL, Shift+Tab)
  if (moveDirection === 'backward') {
    // If there is a previous input in the current row, move to it
    if (currentInputIndex > 0) {
      focusAndSelect(currentRowInputs[currentInputIndex - 1]);
      return;
    }

    // Otherwise, at the beginning of the row -> wrap to the last input of the previous row
    const prevTr = getPrevTr(currentTr);
    if (prevTr) {
      const prevRowInputs = getInputsInRow(prevTr);
      if (prevRowInputs.length > 0) {
        focusAndSelect(prevRowInputs[prevRowInputs.length - 1]);
      }
    }
    return;
  }

  // 3. Moving Down (ArrowDown)
  if (moveDirection === 'down') {
    const nextTr = getNextTr(currentTr);
    if (nextTr) {
      const nextRowInputs = getInputsInRow(nextTr);
      if (nextRowInputs.length > 0) {
        // Try matching by data-grid-col first
        const currentColAttr = input.getAttribute('data-grid-col');
        if (currentColAttr !== null) {
          const sameCol = nextRowInputs.find(
            (el) => el.getAttribute('data-grid-col') === currentColAttr
          );
          if (sameCol) {
            focusAndSelect(sameCol);
            return;
          }
        }
        // Fallback to closest column index in row
        const targetIdx = Math.min(Math.max(0, currentInputIndex), nextRowInputs.length - 1);
        focusAndSelect(nextRowInputs[targetIdx]);
        return;
      }
    }

    // At the last row: add row and focus the same column
    if (onAddRow) {
      onAddRow();
      const currentColAttr = input.getAttribute('data-grid-col');
      setTimeout(() => {
        const freshNextTr = getNextTr(currentTr);
        if (freshNextTr) {
          const freshInputs = getInputsInRow(freshNextTr);
          if (freshInputs.length > 0) {
            if (currentColAttr !== null) {
              const sameCol = freshInputs.find(
                (el) => el.getAttribute('data-grid-col') === currentColAttr
              );
              if (sameCol) {
                focusAndSelect(sameCol);
                return;
              }
            }
            const targetIdx = Math.min(Math.max(0, currentInputIndex), freshInputs.length - 1);
            focusAndSelect(freshInputs[targetIdx]);
          }
        }
      }, 70);
    }
    return;
  }

  // 4. Moving Up (ArrowUp)
  if (moveDirection === 'up') {
    const prevTr = getPrevTr(currentTr);
    if (prevTr) {
      const prevRowInputs = getInputsInRow(prevTr);
      if (prevRowInputs.length > 0) {
        // Try matching by data-grid-col first
        const currentColAttr = input.getAttribute('data-grid-col');
        if (currentColAttr !== null) {
          const sameCol = prevRowInputs.find(
            (el) => el.getAttribute('data-grid-col') === currentColAttr
          );
          if (sameCol) {
            focusAndSelect(sameCol);
            return;
          }
        }
        // Fallback to closest column index in row
        const targetIdx = Math.min(Math.max(0, currentInputIndex), prevRowInputs.length - 1);
        focusAndSelect(prevRowInputs[targetIdx]);
      }
    }
  }
};
