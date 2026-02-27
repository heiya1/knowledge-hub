import { useTranslation } from 'react-i18next';
import type { DocumentMeta } from '../../core/models/Document';

interface BreadcrumbProps {
  ancestors: DocumentMeta[];
  current?: DocumentMeta;
  onNavigate: (id: string) => void;
  className?: string;
}

export function Breadcrumb({ ancestors, current, onNavigate, className }: BreadcrumbProps) {
  const { t } = useTranslation();

  return (
    <nav className={`flex items-center text-sm text-text-secondary ${className || ''}`}>
      {/* Ancestors: can shrink and truncate first */}
      <div className="flex items-center min-w-0 shrink overflow-hidden">
        <button
          onClick={() => onNavigate('')}
          className="hover:text-accent transition-colors shrink-0 whitespace-nowrap"
        >
          {t('breadcrumb.home', 'Home')}
        </button>

        {ancestors.map((doc) => (
          <span key={doc.id} className="flex items-center min-w-0 shrink">
            <span className="text-border shrink-0 mx-1">/</span>
            <button
              onClick={() => onNavigate(doc.id)}
              className="hover:text-accent transition-colors truncate"
              title={doc.title}
            >
              {doc.title}
            </button>
          </span>
        ))}
      </div>

      {/* Current page: prioritized, shrinks last */}
      {current && (
        <span className="flex items-center min-w-0 shrink-0 max-w-[70%]">
          <span className="text-border shrink-0 mx-1">/</span>
          <span className="text-text-primary truncate" title={current.title}>
            {current.title}
          </span>
        </span>
      )}
    </nav>
  );
}
