import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { useSearchStore } from '../../stores/searchStore';
import type { SearchResult } from '../../core/services/SearchService';

interface SearchModalProps {
  onSelect: (id: string) => void;
  onSearch: (query: string) => SearchResult[];
}

export function SearchModal({ onSelect, onSearch }: SearchModalProps) {
  const { t } = useTranslation();
  const { isOpen, query, results, selectedIndex, setOpen, setQuery, setResults, setSelectedIndex } = useSearchStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!isOpen);
      }
      if (e.key === 'Escape' && isOpen) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    const searchResults = onSearch(q);
    setResults(searchResults);
  }, [onSearch, setQuery, setResults]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(Math.min(selectedIndex + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(Math.max(selectedIndex - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      onSelect(results[selectedIndex].id);
      setOpen(false);
    }
  }, [selectedIndex, results, onSelect, setOpen, setSelectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={() => setOpen(false)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-bg-main rounded-xl shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-text-secondary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder={t('sidebar.searchPlaceholder')}
            className="flex-1 bg-transparent border-none outline-none text-text-primary placeholder:text-text-secondary"
          />
          <kbd className="px-1.5 py-0.5 text-xs rounded border border-border text-text-secondary">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto">
          {query && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-text-secondary">
              {t('search.noResults')}
            </div>
          )}
          {results.map((result, index) => (
            <button
              key={result.id}
              onClick={() => { onSelect(result.id); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                index === selectedIndex
                  ? 'bg-sidebar-selected text-accent'
                  : 'text-text-primary hover:bg-bg-hover'
              }`}
            >
              <div className="font-medium">{result.title || t('editor.untitled')}</div>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border text-xs text-text-secondary flex items-center gap-4">
          <span>{t('search.navigate')}</span>
          <span>{t('search.open')}</span>
          <span>{t('search.close')}</span>
        </div>
      </div>
    </div>
  );
}
