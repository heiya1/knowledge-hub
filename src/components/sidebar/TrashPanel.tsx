import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { IFileSystem } from '../../core/interfaces/IFileSystem';
import { parseFrontmatter } from '../../core/utils/frontmatter';

interface TrashItem {
  id: string;
  filename: string;
  title: string;
  updatedAt: string;
}

interface TrashPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  fs: IFileSystem;
  onRestored: () => void;
}

export function TrashPanel({ isOpen, onClose, workspacePath, fs, onRestored }: TrashPanelProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);

  const trashDir = `${workspacePath}/.trash`;
  const pagesDir = `${workspacePath}/pages`;

  const loadTrashItems = useCallback(async () => {
    setLoading(true);
    try {
      const dirExists = await fs.exists(trashDir);
      if (!dirExists) {
        setItems([]);
        return;
      }
      const entries = await fs.readDir(trashDir);
      const trashItems: TrashItem[] = [];
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith('.md')) {
          const id = entry.name.replace('.md', '');
          try {
            const raw = await fs.readTextFile(`${trashDir}/${entry.name}`);
            const doc = parseFrontmatter(raw);
            trashItems.push({
              id,
              filename: entry.name,
              title: doc.title || t('editor.untitled'),
              updatedAt: doc.updatedAt,
            });
          } catch {
            trashItems.push({
              id,
              filename: entry.name,
              title: entry.name,
              updatedAt: '',
            });
          }
        }
      }
      // Sort by updatedAt descending (most recent first)
      trashItems.sort((a, b) => {
        if (!a.updatedAt) return 1;
        if (!b.updatedAt) return -1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
      setItems(trashItems);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [trashDir, fs, t]);

  useEffect(() => {
    if (isOpen) {
      loadTrashItems();
    }
  }, [isOpen, loadTrashItems]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleRestore = useCallback(async (item: TrashItem) => {
    try {
      const src = `${trashDir}/${item.filename}`;
      const dest = `${pagesDir}/${item.filename}`;
      await fs.rename(src, dest);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      onRestored();
    } catch {
      // Silently fail - could show toast but we don't have access here
    }
  }, [trashDir, pagesDir, fs, onRestored]);

  const handleDeletePermanently = useCallback(async (item: TrashItem) => {
    try {
      await fs.removeFile(`${trashDir}/${item.filename}`);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      // Silently fail
    }
  }, [trashDir, fs]);

  if (!isOpen) return null;

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative bg-[var(--color-bg-main)] rounded-lg shadow-xl border border-[var(--color-border)] w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t('trash.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
              {t('trash.loading')}
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
              {t('trash.empty')}
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-[var(--color-bg-hover)] group"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="text-sm text-[var(--color-text-primary)] truncate">
                      {item.title}
                    </div>
                    {item.updatedAt && (
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {formatDate(item.updatedAt)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleRestore(item)}
                      className="px-2 py-1 text-xs rounded-md text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
                      title={t('trash.restore')}
                    >
                      {t('trash.restore')}
                    </button>
                    <button
                      onClick={() => handleDeletePermanently(item)}
                      className="px-2 py-1 text-xs rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
                      title={t('trash.deletePermanently')}
                    >
                      {t('trash.deletePermanently')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with info */}
        <div className="px-6 py-3 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t('trash.autoDeleteNotice')}
          </p>
        </div>
      </div>
    </div>
  );
}
