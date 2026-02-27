import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import {
  ArrowUpToLine, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine,
  Trash2, Rows3, Columns3, Merge, SplitSquareHorizontal, ToggleLeft,
  Paintbrush,
} from 'lucide-react';
import { Tooltip } from '../common/Tooltip';

interface TableToolbarProps {
  editor: Editor;
}

const CELL_COLORS = [
  { value: null, labelKey: 'editor.toolbar.colorNone' },
  { value: '#e3f2fd', labelKey: 'editor.toolbar.colorBlue' },
  { value: '#e8f5e9', labelKey: 'editor.toolbar.colorGreen' },
  { value: '#fff3e0', labelKey: 'editor.toolbar.colorOrange' },
  { value: '#fce4ec', labelKey: 'editor.toolbar.colorRed' },
  { value: '#f3e5f5', labelKey: 'editor.toolbar.colorPurple' },
  { value: '#fff9c4', labelKey: 'editor.toolbar.colorYellow' },
  { value: '#e0f2f1', labelKey: 'editor.toolbar.colorTeal' },
  { value: '#f5f5f5', labelKey: 'editor.toolbar.colorGray' },
];

export function TableToolbar({ editor }: TableToolbarProps) {
  const { t } = useTranslation();
  const [colorOpen, setColorOpen] = useState(false);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  // Close on outside click
  useEffect(() => {
    if (!colorOpen) return;
    const handle = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-cell-color]')) {
        setColorOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [colorOpen]);

  const handleToggleColor = () => {
    if (!colorOpen && colorBtnRef.current) {
      const rect = colorBtnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setColorOpen((v) => !v);
  };

  if (!editor.isActive('table')) return null;

  const btnClass =
    'flex items-center justify-center w-7 h-7 rounded text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors';
  const dangerBtnClass =
    'flex items-center justify-center w-7 h-7 rounded text-text-secondary hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 transition-colors';

  return (
    <div className="flex items-center gap-0.5 px-4 py-1 border-b border-border bg-bg-main">
      {/* Row operations */}
      <Tooltip content={t('editor.toolbar.addRowBefore')}>
        <button onClick={() => editor.chain().focus().addRowBefore().run()} className={btnClass}>
          <ArrowUpToLine className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <Tooltip content={t('editor.toolbar.addRowAfter')}>
        <button onClick={() => editor.chain().focus().addRowAfter().run()} className={btnClass}>
          <ArrowDownToLine className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <Tooltip content={t('editor.toolbar.deleteRow')}>
        <button onClick={() => editor.chain().focus().deleteRow().run()} className={dangerBtnClass}>
          <Rows3 className="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Column operations */}
      <Tooltip content={t('editor.toolbar.addColumnBefore')}>
        <button onClick={() => editor.chain().focus().addColumnBefore().run()} className={btnClass}>
          <ArrowLeftToLine className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <Tooltip content={t('editor.toolbar.addColumnAfter')}>
        <button onClick={() => editor.chain().focus().addColumnAfter().run()} className={btnClass}>
          <ArrowRightToLine className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <Tooltip content={t('editor.toolbar.deleteColumn')}>
        <button onClick={() => editor.chain().focus().deleteColumn().run()} className={dangerBtnClass}>
          <Columns3 className="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Cell operations */}
      <Tooltip content={t('editor.toolbar.mergeCells')}>
        <button onClick={() => editor.chain().focus().mergeCells().run()} className={btnClass}>
          <Merge className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <Tooltip content={t('editor.toolbar.splitCell')}>
        <button onClick={() => editor.chain().focus().splitCell().run()} className={btnClass}>
          <SplitSquareHorizontal className="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Cell color */}
      <div data-cell-color>
        <Tooltip content={t('editor.toolbar.cellColor')}>
          <button
            ref={colorBtnRef}
            onClick={handleToggleColor}
            className={`${btnClass} ${colorOpen ? 'bg-bg-hover' : ''}`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        {colorOpen && createPortal(
          <div
            data-cell-color
            className="bg-bg-main border border-content-border rounded-lg shadow-lg p-2"
            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
          >
            <div className="grid grid-cols-3 gap-1">
              {CELL_COLORS.map(({ value, labelKey }) => (
                <Tooltip key={labelKey} content={t(labelKey)}>
                  <button
                    onClick={() => {
                      editor.chain().focus().setCellAttribute('backgroundColor', value).run();
                      setColorOpen(false);
                    }}
                    className="w-7 h-7 rounded border border-content-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: value ?? 'transparent' }}
                  >
                    {!value && (
                      <span className="block w-full h-full relative">
                        <span className="absolute inset-0 flex items-center justify-center text-text-secondary text-xs">✕</span>
                      </span>
                    )}
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>,
          document.body,
        )}
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Header toggle */}
      <Tooltip content={t('editor.toolbar.toggleHeaderRow')}>
        <button onClick={() => editor.chain().focus().toggleHeaderRow().run()} className={btnClass}>
          <ToggleLeft className="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Delete table */}
      <Tooltip content={t('editor.toolbar.deleteTable')}>
        <button onClick={() => editor.chain().focus().deleteTable().run()} className={dangerBtnClass}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}
