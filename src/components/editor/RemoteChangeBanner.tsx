import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';

interface RemoteChangeBannerProps {
  author: string;
  onViewDiff: () => void;
  onApply: () => void;
  onDismiss: () => void;
}

export function RemoteChangeBanner({ author, onViewDiff, onApply, onDismiss }: RemoteChangeBannerProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 shrink-0 text-amber-500 dark:text-amber-400" />
        <span className="text-sm font-medium">
          {t('editor.remoteChangeNotice', { author })}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onViewDiff}
          className="px-3 py-1 text-xs font-medium rounded border border-amber-300 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-800/50 transition-colors"
        >
          {t('editor.viewDiff')}
        </button>
        <button
          onClick={onApply}
          className="px-3 py-1 text-xs font-medium rounded bg-amber-500 dark:bg-amber-600 text-white hover:bg-amber-600 dark:hover:bg-amber-700 transition-colors"
        >
          {t('editor.applyChanges')}
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1 text-xs font-medium rounded hover:bg-amber-100 dark:hover:bg-amber-800/50 transition-colors"
        >
          {t('editor.later')}
        </button>
      </div>
    </div>
  );
}
