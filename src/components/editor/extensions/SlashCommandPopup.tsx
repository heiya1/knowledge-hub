import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import type { SlashCommand } from './slash-command';
import { getDefaultCommands } from './slash-command';

interface SlashCommandPopupProps {
  editor: Editor;
  isOpen: boolean;
  position: { top: number; left: number } | null;
  onClose: () => void;
}

export function SlashCommandPopup({
  editor,
  isOpen,
  position,
  onClose,
}: SlashCommandPopupProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const commands = useMemo(() => getDefaultCommands(t), [t]);

  const filtered = commands.filter((cmd) =>
    cmd.name.toLowerCase().includes(query.toLowerCase())
  );

  const executeCommand = useCallback(
    (cmd: SlashCommand) => {
      // Delete the slash and query text first
      const { state } = editor;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(
        Math.max(0, from - 50),
        from,
        '\n'
      );
      const match = textBefore.match(/\/([^\s/]*)$/);
      if (match) {
        const deleteFrom = from - match[0].length;
        editor
          .chain()
          .focus()
          .deleteRange({ from: deleteFrom, to: from })
          .run();
      }
      cmd.action(editor);
      onClose();
    },
    [editor, onClose]
  );

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => {
          const next = Math.min(i + 1, filtered.length - 1);
          itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => {
          const next = Math.max(i - 1, 0);
          itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        e.stopPropagation();
        executeCommand(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    // Listen for text changes after / to filter
    const handleUpdate = () => {
      const { state } = editor;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(
        Math.max(0, from - 50),
        from,
        '\n'
      );
      const match = textBefore.match(/\/([^\s/]*)$/);
      if (match) {
        setQuery(match[1]);
        setSelectedIndex(0);
      } else {
        onClose();
      }
    };

    editor.on('update', handleUpdate);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      editor.off('update', handleUpdate);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, query, selectedIndex, filtered, editor, onClose, executeCommand]);

  // Close popup when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-bg-main border border-border rounded-lg shadow-lg overflow-hidden"
      style={{
        top: position.top + 4,
        left: position.left,
        minWidth: 240,
        maxWidth: 320,
      }}
    >
      <div className="px-3 py-1.5 text-xs text-text-secondary border-b border-border">
        {t('editor.slashCommand.title')}
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-sm text-text-secondary text-center">
            {t('editor.slashCommand.noMatches')}
          </div>
        )}
        {filtered.map((cmd, index) => (
          <button
            key={cmd.name}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            onClick={() => executeCommand(cmd)}
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 transition-colors ${
              index === selectedIndex
                ? 'bg-sidebar-selected text-accent'
                : 'text-text-primary hover:bg-bg-hover'
            }`}
          >
            <span className="w-6 text-center text-base shrink-0">
              {cmd.icon}
            </span>
            <div>
              <div className="font-medium">{cmd.name}</div>
              <div className="text-xs text-text-secondary">
                {cmd.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
