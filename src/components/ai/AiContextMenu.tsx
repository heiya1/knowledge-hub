import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';

export type AiAction = 'summarize' | 'translate' | 'rewrite' | 'explain';

interface AiContextMenuProps {
  editor: Editor | null;
  onAiAction?: (action: AiAction, selectedText: string) => void;
}

interface MenuPosition {
  top: number;
  left: number;
}

export function AiContextMenu({ editor, onAiAction }: AiContextMenuProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    if (from === to) {
      setVisible(false);
      return;
    }

    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) {
      setVisible(false);
      return;
    }

    // Get the coordinates of the selection start to position the floating toolbar
    const coords = editor.view.coordsAtPos(from);
    const editorRect = editor.view.dom.getBoundingClientRect();

    // Position above the selection
    setPosition({
      top: coords.top - editorRect.top - 40,
      left: coords.left - editorRect.left,
    });
    setVisible(true);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      updatePosition();
    };

    const handleBlur = () => {
      // Delay hiding so button clicks can register
      setTimeout(() => {
        if (!menuRef.current?.contains(document.activeElement)) {
          setVisible(false);
        }
      }, 200);
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    editor.on('blur', handleBlur);

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('blur', handleBlur);
    };
  }, [editor, updatePosition]);

  const handleAction = useCallback((action: AiAction) => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) return;

    onAiAction?.(action, selectedText);
    setVisible(false);
  }, [editor, onAiAction]);

  if (!visible || !editor) return null;

  const actions: { action: AiAction; label: string; icon: string }[] = [
    { action: 'summarize', label: t('ai.summarizeSelection'), icon: 'S' },
    { action: 'translate', label: t('ai.translateSelection'), icon: 'T' },
    { action: 'rewrite', label: t('ai.rewriteSelection'), icon: 'R' },
    { action: 'explain', label: t('ai.explainSelection'), icon: '?' },
  ];

  return (
    <div
      ref={menuRef}
      className="absolute z-50 flex items-center gap-0.5 px-1 py-0.5 rounded-lg shadow-lg border border-[var(--color-border)] bg-[var(--color-bg-main)]"
      style={{ top: position.top, left: position.left }}
    >
      {actions.map(({ action, label, icon }) => (
        <button
          key={action}
          onClick={() => handleAction(action)}
          title={label}
          className="px-2 py-1 text-xs font-medium rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-sidebar-selected)] transition-colors"
        >
          <span className="inline-flex items-center gap-1">
            <span className="font-bold">{icon}</span>
            <span className="hidden sm:inline">{label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
