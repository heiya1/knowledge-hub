import { useState, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { List, X } from 'lucide-react';

interface HeadingItem {
  level: number;
  text: string;
  pos: number;
}

interface OutlineSidebarProps {
  editor: Editor | null;
  onClose: () => void;
}

export function OutlineSidebar({ editor, onClose }: OutlineSidebarProps) {
  const { t } = useTranslation();
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activePos, setActivePos] = useState<number | null>(null);

  const extractHeadings = useCallback(() => {
    if (!editor) { setHeadings([]); return; }
    const items: HeadingItem[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        items.push({ level: node.attrs.level, text: node.textContent, pos });
      }
    });
    setHeadings(items);
  }, [editor]);

  // Extract headings on mount and on editor updates
  useEffect(() => {
    if (!editor) return;
    extractHeadings();
    editor.on('update', extractHeadings);
    return () => { editor.off('update', extractHeadings); };
  }, [editor, extractHeadings]);

  // Track which heading is closest to viewport (scroll spy)
  useEffect(() => {
    if (!editor || headings.length === 0) return;

    // Find the scroll container via data attribute set in EditorView
    const scrollContainer = editor.view.dom.closest('[data-editor-scroll]');
    if (!scrollContainer) return;

    const handleScroll = () => {
      let bestPos: number | null = null;
      const containerRect = scrollContainer.getBoundingClientRect();

      // Find the last heading that has scrolled past the top of the container
      for (const h of headings) {
        try {
          const domAtPos = editor.view.domAtPos(h.pos);
          const el = domAtPos.node instanceof HTMLElement
            ? domAtPos.node
            : domAtPos.node.parentElement;
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const offset = rect.top - containerRect.top;
          if (offset <= 40) {
            bestPos = h.pos;
          }
        } catch {
          // pos might be invalid
        }
      }
      setActivePos(bestPos);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [editor, headings]);

  const handleClick = useCallback((pos: number) => {
    if (!editor) return;
    // Don't focus/select in view mode to avoid triggering edit mode
    try {
      const domAtPos = editor.view.domAtPos(pos);
      const el = domAtPos.node instanceof HTMLElement
        ? domAtPos.node
        : domAtPos.node.parentElement;
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      // Fallback: try setTextSelection
      editor.chain().setTextSelection(pos).run();
    }
  }, [editor]);

  return (
    <div className="flex flex-col h-full border-l border-border bg-bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wide">
          <List className="w-3.5 h-3.5" />
          {t('editor.outline', 'Outline')}
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Heading list */}
      <div className="flex-1 overflow-y-auto py-2">
        {headings.length === 0 ? (
          <p className="px-3 text-xs text-text-secondary italic">
            {t('editor.noHeadings', 'No headings')}
          </p>
        ) : (
          <nav className="space-y-0.5">
            {headings.map((h, i) => (
              <button
                key={`${h.pos}-${i}`}
                onClick={() => handleClick(h.pos)}
                className={`block w-full text-left px-3 py-1 text-sm truncate transition-colors
                  ${activePos === h.pos
                    ? 'text-accent bg-sidebar-selected font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  }`}
                style={{ paddingLeft: `${8 + (h.level - 1) * 12}px` }}
                title={h.text}
              >
                {h.text || `H${h.level}`}
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
