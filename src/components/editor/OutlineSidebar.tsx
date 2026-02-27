import { useState, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { PanelRightClose } from 'lucide-react';

interface HeadingItem {
  level: number;
  text: string;
  pos: number;
}

interface OutlineSidebarProps {
  editor: Editor | null;
  onClose: () => void;
}

/** Resolve the actual heading DOM element for a given document position */
function getHeadingElement(editor: Editor, pos: number): HTMLElement | null {
  try {
    const dom = editor.view.nodeDOM(pos);
    if (dom instanceof HTMLElement) return dom;
    const domAtPos = editor.view.domAtPos(pos + 1);
    const node = domAtPos.node;
    if (node instanceof HTMLElement) {
      return node.closest('h1, h2, h3, h4, h5, h6') || node;
    }
    return node.parentElement?.closest('h1, h2, h3, h4, h5, h6') || node.parentElement;
  } catch {
    return null;
  }
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

      for (const h of headings) {
        const el = getHeadingElement(editor, h.pos);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const offset = rect.top - containerRect.top;
        if (offset <= 40) {
          bestPos = h.pos;
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
    const el = getHeadingElement(editor, pos);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editor]);

  return (
    <div className="flex flex-col h-full border-l border-outlinebar-border bg-outlinebar-bg">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-outlinebar-border">
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-outlinebar-text-muted hover:text-outlinebar-text hover:bg-outlinebar-hover transition-colors"
        >
          <PanelRightClose className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-semibold text-outlinebar-text-muted uppercase tracking-wide">
          {t('editor.outline', 'Outline')}
        </span>
      </div>

      {/* Heading list */}
      <div className="flex-1 overflow-y-auto py-2">
        {headings.length === 0 ? (
          <p className="px-3 text-xs text-outlinebar-text-muted italic">
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
                    ? 'text-outlinebar-accent bg-outlinebar-item-selected font-medium'
                    : 'text-outlinebar-text hover:bg-outlinebar-hover'
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
