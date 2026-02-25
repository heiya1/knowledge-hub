import type { DocumentMeta } from '../../core/models/Document';

interface BreadcrumbProps {
  ancestors: DocumentMeta[];
  current?: DocumentMeta;
  onNavigate: (id: string) => void;
}

export function Breadcrumb({ ancestors, current, onNavigate }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] px-4 py-2 border-b border-[var(--color-border)]">
      <button
        onClick={() => onNavigate('')}
        className="hover:text-[var(--color-accent)] transition-colors"
      >
        Home
      </button>
      {ancestors.map((doc) => (
        <span key={doc.id} className="flex items-center gap-1">
          <span className="text-[var(--color-border)]">/</span>
          <button
            onClick={() => onNavigate(doc.id)}
            className="hover:text-[var(--color-accent)] transition-colors truncate max-w-[150px]"
          >
            {doc.title}
          </button>
        </span>
      ))}
      {current && (
        <span className="flex items-center gap-1">
          <span className="text-[var(--color-border)]">/</span>
          <span className="text-[var(--color-text-primary)] truncate max-w-[200px]">
            {current.title}
          </span>
        </span>
      )}
    </nav>
  );
}
