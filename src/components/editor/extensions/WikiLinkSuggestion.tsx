import { useState, useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { useDocumentStore } from '../../../stores/documentStore';

interface WikiLinkSuggestionProps {
  editor: Editor;
  onNavigate: (id: string) => void;
}

interface SuggestionItem {
  id: string;
  title: string;
  breadcrumb: string;
}

export function WikiLinkSuggestion({ editor, onNavigate: _onNavigate }: WikiLinkSuggestionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [, setQuery] = useState('');
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const documents = useDocumentStore((s) => s.documents);

  // Build suggestion list with breadcrumb for disambiguation of duplicate titles
  const buildSuggestions = useCallback(
    (searchQuery: string): SuggestionItem[] => {
      // Count how many documents share each title
      const titleCounts = new Map<string, number>();
      for (const doc of documents) {
        titleCounts.set(doc.title, (titleCounts.get(doc.title) || 0) + 1);
      }

      // Build a map for parent lookups
      const docMap = new Map(documents.map((d) => [d.id, d]));

      // Build breadcrumb path for a document (shows parent chain)
      const getBreadcrumb = (doc: (typeof documents)[0]): string => {
        const parts: string[] = [];
        let current = doc.parent ? docMap.get(doc.parent) : undefined;
        while (current) {
          parts.unshift(current.title);
          current = current.parent ? docMap.get(current.parent) : undefined;
        }
        return parts.length > 0 ? parts.join(' > ') : '';
      };

      return documents
        .filter((doc) => {
          if (!searchQuery) return true;
          return doc.title.toLowerCase().includes(searchQuery.toLowerCase());
        })
        .map((doc) => ({
          id: doc.id,
          title: doc.title || 'Untitled',
          breadcrumb:
            (titleCounts.get(doc.title) || 0) > 1 ? getBreadcrumb(doc) : '',
        }))
        .slice(0, 10);
    },
    [documents]
  );

  // Listen for editor updates to detect [[ trigger
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const { state } = editor;
      const { from } = state.selection;

      // Look back up to 50 characters for the [[ trigger
      const start = Math.max(0, from - 50);
      const textBefore = state.doc.textBetween(start, from, '\n');

      // Check if we are inside a [[ trigger (no closing ]])
      const match = textBefore.match(/\[\[([^\]]*?)$/);
      if (match) {
        const searchQuery = match[1];
        setQuery(searchQuery);
        setItems(buildSuggestions(searchQuery));
        setSelectedIndex(0);
        setIsOpen(true);

        // Calculate popup position relative to the editor container
        const coords = editor.view.coordsAtPos(from);
        const editorContainer = editor.view.dom.closest('.relative');
        if (editorContainer) {
          const containerRect = editorContainer.getBoundingClientRect();
          setPosition({
            top: coords.bottom - containerRect.top + 4,
            left: coords.left - containerRect.left,
          });
        }
      } else {
        setIsOpen(false);
      }
    };

    editor.on('update', handleUpdate);
    editor.on('selectionUpdate', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
      editor.off('selectionUpdate', handleUpdate);
    };
  }, [editor, buildSuggestions]);

  // Handle keyboard navigation within the suggestion popup
  useEffect(() => {
    if (!isOpen || !editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && items[selectedIndex]) {
        e.preventDefault();
        selectItem(items[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    // Use capture phase to intercept before TipTap handles the key
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, items, selectedIndex, editor]);

  const selectItem = (item: SuggestionItem) => {
    if (!editor) return;

    const { state } = editor;
    const { from } = state.selection;
    const start = Math.max(0, from - 50);
    const textBefore = state.doc.textBetween(start, from, '\n');
    const match = textBefore.match(/\[\[([^\]]*?)$/);
    if (!match) return;

    // Delete the `[[query` text and insert the wiki link node
    const deleteFrom = from - match[0].length;
    editor
      .chain()
      .focus()
      .deleteRange({ from: deleteFrom, to: from })
      .setWikiLink({ pageId: item.id, pageTitle: item.title })
      .run();

    setIsOpen(false);
  };

  if (!isOpen || !position) return null;

  return (
    <div
      ref={popupRef}
      className="absolute z-50 bg-[var(--color-bg-main)] border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        minWidth: 240,
        maxWidth: 360,
      }}
    >
      {items.length === 0 ? (
        <div className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          No pages found
        </div>
      ) : (
        items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => selectItem(item)}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
              index === selectedIndex
                ? 'bg-[var(--color-sidebar-selected)] text-[var(--color-accent)]'
                : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
            }`}
          >
            <div className="font-medium truncate">{item.title}</div>
            {item.breadcrumb && (
              <div className="text-xs text-[var(--color-text-secondary)] truncate">
                {item.breadcrumb}
              </div>
            )}
          </button>
        ))
      )}
    </div>
  );
}
