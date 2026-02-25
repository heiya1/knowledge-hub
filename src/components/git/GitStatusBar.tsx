import { useTranslation } from 'react-i18next';
import { useGitStore } from '../../stores/gitStore';

interface GitStatusBarProps {
  onCommit: () => void;
  onSync: () => void;
}

export function GitStatusBar({ onCommit, onSync }: GitStatusBarProps) {
  const { t } = useTranslation();
  const { statuses, isSyncing, lastSyncAt } = useGitStore();

  const changedCount = statuses.length;

  return (
    <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
      {changedCount > 0 && (
        <button
          onClick={onCommit}
          className="flex items-center gap-1 hover:text-[var(--color-accent)] transition-colors"
          title={t('git.commitChanges')}
        >
          <span className="w-2 h-2 rounded-full bg-[var(--color-warning)]" />
          <span>
            {changedCount} {t('git.changes')}
          </span>
        </button>
      )}
      <button
        onClick={onSync}
        disabled={isSyncing}
        className="hover:text-[var(--color-accent)] transition-colors disabled:opacity-50"
        title={t('git.sync')}
      >
        {isSyncing ? t('git.syncing') : t('git.sync')}
      </button>
      {lastSyncAt && (
        <span className="text-[var(--color-text-secondary)]">
          {new Date(lastSyncAt).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
