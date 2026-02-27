import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, ChevronRight } from 'lucide-react';
import type { DocumentMeta } from '../../core/models/Document';
import { Tooltip } from '../common/Tooltip';

interface FavoritesSectionProps {
  favorites: string[];
  documents: DocumentMeta[];
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function FavoritesSection({ favorites, documents, onSelect, onToggleFavorite }: FavoritesSectionProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(() => {
    const stored = localStorage.getItem('sidebar-favorites-expanded');
    return stored !== null ? stored === 'true' : true;
  });

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-favorites-expanded', String(next));
      return next;
    });
  }, []);

  // Resolve favorite IDs to document metadata, filtering out deleted/missing pages
  const favoritePages = favorites
    .map((id) => documents.find((d) => d.id === id))
    .filter((d): d is DocumentMeta => d != null);

  if (favoritePages.length === 0) {
    return null;
  }

  return (
    <div className="px-3 py-1">
      <button
        onClick={toggleExpanded}
        className="flex items-center gap-1.5 w-full text-xs font-semibold text-sidebar-text-muted uppercase tracking-wider px-2 py-1 hover:text-sidebar-text transition-colors"
      >
        <ChevronRight
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
        <Star className="w-3 h-3" />
        <span>{t('sidebar.favorites')}</span>
      </button>

      {expanded && (
        <div className="mt-0.5">
          {favoritePages.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center gap-1.5 px-2 py-[5px] text-[13px] text-sidebar-text rounded hover:bg-sidebar-hover transition-colors cursor-pointer"
              onClick={() => onSelect(doc.id)}
            >
              <span className="truncate flex-1">
                {doc.title || t('editor.untitled')}
              </span>
              <Tooltip content={t('sidebar.unfavorite')}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(doc.id);
                  }}
                  className="shrink-0 w-4 h-4 flex items-center justify-center text-warning opacity-80 hover:opacity-100 transition-opacity"
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
