import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown, Link2 } from 'lucide-react';
import { useDocumentStore } from '../../stores/documentStore';

interface BacklinksSectionProps {
  pageId: string;
  onNavigate: (id: string) => void;
}

export function BacklinksSection({ pageId, onNavigate }: BacklinksSectionProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const backlinkIndex = useDocumentStore((s) => s.backlinkIndex);
  const documents = useDocumentStore((s) => s.documents);

  const backlinks = useMemo(() => {
    const sourceIds = backlinkIndex.get(pageId) ?? [];
    return sourceIds
      .map((id) => {
        const doc = documents.find((d) => d.id === id);
        return doc ? { id: doc.id, title: doc.title } : null;
      })
      .filter((item): item is { id: string; title: string } => item !== null);
  }, [pageId, backlinkIndex, documents]);

  const count = backlinks.length;

  return (
    <div className="max-w-[800px] mx-auto px-6 pb-6">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors py-2"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <Link2 className="w-3.5 h-3.5" />
        <span>{t('editor.backlinks', 'Backlinks')}</span>
        <span className="text-xs opacity-70">({count})</span>
      </button>

      {expanded && (
        <div className="ml-5 mt-1 space-y-0.5">
          {count === 0 ? (
            <p className="text-xs text-text-secondary italic">{t('editor.noBacklinks', 'No pages link to this page')}</p>
          ) : (
            backlinks.map((link) => (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className="block w-full text-left px-2 py-1 text-sm text-accent hover:bg-bg-hover rounded transition-colors truncate"
              >
                {link.title}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
