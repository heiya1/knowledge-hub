import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, ChevronRight } from 'lucide-react';

interface RecentSectionProps {
  recentPages: Array<{ id: string; title: string; timestamp: string }>;
  onSelect: (id: string) => void;
}

export function RecentSection({ recentPages, onSelect }: RecentSectionProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(() => {
    const stored = localStorage.getItem('sidebar-recent-expanded');
    return stored !== null ? stored === 'true' : true;
  });

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-recent-expanded', String(next));
      return next;
    });
  }, []);

  // Show only the last 10 entries
  const displayPages = recentPages.slice(0, 10);

  if (displayPages.length === 0) {
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
        <Clock className="w-3 h-3" />
        <span>{t('sidebar.recent')}</span>
      </button>

      {expanded && (
        <div className="mt-0.5">
          {displayPages.map((page) => (
            <div
              key={page.id}
              className="flex items-center gap-1.5 px-2 py-[5px] text-[13px] text-sidebar-text rounded hover:bg-sidebar-hover transition-colors cursor-pointer"
              onClick={() => onSelect(page.id)}
            >
              <Clock className="w-3.5 h-3.5 shrink-0 text-sidebar-text-muted" />
              <span className="truncate flex-1">
                {page.title || t('editor.untitled')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
