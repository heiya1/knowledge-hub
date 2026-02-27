import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useGitStore } from '../../stores/gitStore';

interface CommitPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onCommit: (message: string) => Promise<void>;
}

export function CommitPanel({ isOpen, onClose, onCommit }: CommitPanelProps) {
  const { t } = useTranslation();
  const { statuses, commitMessage, setCommitMessage } = useGitStore();

  const handleCommit = useCallback(async () => {
    if (!commitMessage.trim()) return;
    await onCommit(commitMessage.trim());
    setCommitMessage('');
    onClose();
  }, [commitMessage, onCommit, setCommitMessage, onClose]);

  if (!isOpen) return null;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'added': return { label: 'A', color: 'text-success' };
      case 'modified': return { label: 'M', color: 'text-warning' };
      case 'deleted': return { label: 'D', color: 'text-danger' };
      default: return { label: '?', color: 'text-text-secondary' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-md bg-bg-main rounded-xl shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">
            {t('git.commitChanges')}
          </h2>
        </div>

        {/* Changed files */}
        <div className="max-h-[200px] overflow-y-auto border-b border-border">
          {statuses.length === 0 ? (
            <div className="px-4 py-3 text-sm text-text-secondary">
              {t('git.noChanges')}
            </div>
          ) : (
            statuses.map((s) => {
              const icon = statusIcon(s.status);
              return (
                <div
                  key={s.filepath}
                  className="flex items-center gap-2 px-4 py-1.5 text-sm"
                >
                  <span className={`font-mono font-bold ${icon.color}`}>
                    {icon.label}
                  </span>
                  <span className="text-text-primary truncate">
                    {s.filepath}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Commit message */}
        <div className="p-4">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder={t('git.commitMessagePlaceholder')}
            className="w-full h-20 px-3 py-2 rounded-md border border-border bg-bg-main text-text-primary text-sm resize-none focus:outline-none focus:border-accent placeholder:text-text-secondary"
            autoFocus
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-4 pb-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-border text-text-primary hover:bg-bg-hover transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim() || statuses.length === 0}
            className="px-4 py-2 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('git.commit')}
          </button>
        </div>
      </div>
    </div>
  );
}
