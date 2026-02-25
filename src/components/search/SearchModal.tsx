import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
        className="relative w-full max-w-lg bg-[var(--color-bg-main)] rounded-xl shadow-2xl border border-[var(--color-border)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder={t('sidebar.searchPlaceholder')}
            className="flex-1 bg-transparent border-none outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
          />
          <kbd className="px-1.5 py-0.5 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-secondary)]">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto">
          {query && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
              {t('search.noResults')}
            </div>
          )}
          {results.map((result, index) => (
            <button
              key={result.id}
              onClick={() => { onSelect(result.id); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                index === selectedIndex
                  ? 'bg-[var(--color-sidebar-selected)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              <div className="font-medium">{result.title || t('editor.untitled')}</div>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] flex items-center gap-4">
          <span>{t('search.navigate')}</span>
          <span>{t('search.open')}</span>
          <span>{t('search.close')}</span>
        </div>
      </div>
    </div>
  );
}
