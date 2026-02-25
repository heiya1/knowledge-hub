import { useTranslation } from 'react-i18next';
import type { GitLogEntry } from '../../core/interfaces/IGitService';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  entries: GitLogEntry[];
  pageTitle?: string;
}

export function HistoryPanel({ isOpen, onClose, entries, pageTitle }: HistoryPanelProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-lg bg-[var(--color-bg-main)] rounded-xl shadow-2xl border border-[var(--color-border)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {t('git.history')}{pageTitle ? `: ${pageTitle}` : ''}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            {t('common.close')}
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {entries.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
              {t('git.noHistory')}
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.oid}
                className="px-4 py-3 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {entry.message}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-text-secondary)]">
                      <span>{entry.author.name}</span>
                      <span>&middot;</span>
                      <span>{formatDate(entry.author.timestamp)}</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-[var(--color-text-secondary)] shrink-0">
                    {entry.oid.slice(0, 7)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
