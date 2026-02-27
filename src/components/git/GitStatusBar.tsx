import { useTranslation } from 'react-i18next';
import { useGitStore } from '../../stores/gitStore';
import { Tooltip } from '../common/Tooltip';

interface GitStatusBarProps {
  onCommit: () => void;
  onSync: () => void;
}

export function GitStatusBar({ onCommit, onSync }: GitStatusBarProps) {
  const { t } = useTranslation();
  const { statuses, isSyncing, lastSyncAt } = useGitStore();

  const changedCount = statuses.length;

  return (
    <div className="flex items-center gap-3 text-xs text-text-secondary">
      {changedCount > 0 && (
        <Tooltip content={t('git.commitChanges')}>
          <button
            onClick={onCommit}
            className="flex items-center gap-1 hover:text-accent transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-warning" />
            <span>
              {changedCount} {t('git.changes')}
            </span>
          </button>
        </Tooltip>
      )}
      <Tooltip content={t('git.sync')}>
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="hover:text-accent transition-colors disabled:opacity-50"
        >
          {isSyncing ? t('git.syncing') : t('git.sync')}
        </button>
      </Tooltip>
      {lastSyncAt && (
        <span className="text-text-secondary">
          {new Date(lastSyncAt).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
