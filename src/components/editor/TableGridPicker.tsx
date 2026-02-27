import { useState, useCallback } from 'react';

interface TableGridPickerProps {
  onSelect: (rows: number, cols: number) => void;
  onClose: () => void;
}

const MAX_ROWS = 8;
const MAX_COLS = 8;

export function TableGridPicker({ onSelect, onClose }: TableGridPickerProps) {
  const [hover, setHover] = useState({ row: 0, col: 0 });

  const handleMouseEnter = useCallback((row: number, col: number) => {
    setHover({ row, col });
  }, []);

  const handleClick = useCallback((row: number, col: number) => {
    onSelect(row, col);
    onClose();
  }, [onSelect, onClose]);

  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-bg-main border border-border rounded-lg shadow-lg p-2">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${MAX_COLS}, 1fr)` }}>
        {Array.from({ length: MAX_ROWS }, (_, r) =>
          Array.from({ length: MAX_COLS }, (_, c) => {
            const row = r + 1;
            const col = c + 1;
            const isHighlighted = row <= hover.row && col <= hover.col;
            return (
              <div
                key={`${r}-${c}`}
                className={`w-5 h-5 border rounded-sm cursor-pointer transition-colors ${
                  isHighlighted
                    ? 'bg-accent/30 border-accent'
                    : 'border-border hover:border-accent/50'
                }`}
                onMouseEnter={() => handleMouseEnter(row, col)}
                onClick={() => handleClick(row, col)}
              />
            );
          })
        )}
      </div>
      <div className="text-center text-xs text-text-secondary mt-1.5">
        {hover.row > 0 && hover.col > 0 ? `${hover.row} × ${hover.col}` : '\u00A0'}
      </div>
    </div>
  );
}
