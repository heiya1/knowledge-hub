import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { diffLines } from 'diff';
import type { GitLogEntry } from '../../core/interfaces/IGitService';
import { getContainer } from '../../infrastructure/container';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  entries: GitLogEntry[];
  pageTitle?: string;
  /** Relative path to the file within the workspace (e.g. "pages/abc123.md") */
  filepath?: string;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

export function HistoryPanel({ isOpen, onClose, entries, pageTitle, filepath }: HistoryPanelProps) {
  const { t } = useTranslation();
  const [selectedOids, setSelectedOids] = useState<string[]>([]);
  const [diffResult, setDiffResult] = useState<DiffLine[] | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const handleToggleSelect = (oid: string) => {
    setSelectedOids((prev) => {
      if (prev.includes(oid)) {
        return prev.filter((o) => o !== oid);
      }
      if (prev.length >= 2) {
        // Replace the oldest selection
        return [prev[1], oid];
      }
      return [...prev, oid];
    });
    // Clear previous diff when selection changes
    setDiffResult(null);
    setDiffError(null);
  };

  const handleCompare = async () => {
    if (selectedOids.length !== 2 || !filepath) return;

    setDiffLoading(true);
    setDiffError(null);
    setDiffResult(null);

    try {
      const container = getContainer();
      const dir = container.workspacePath;

      // Determine older and newer commits based on their position in the entries list
      // entries are ordered newest first, so the one with the higher index is older
      const idx0 = entries.findIndex((e) => e.oid === selectedOids[0]);
      const idx1 = entries.findIndex((e) => e.oid === selectedOids[1]);
      const olderOid = idx0 > idx1 ? selectedOids[0] : selectedOids[1];
      const newerOid = idx0 > idx1 ? selectedOids[1] : selectedOids[0];

      let olderContent = '';
      let newerContent = '';

      try {
        olderContent = await container.gitService.readFileAtCommit(dir, olderOid, filepath);
      } catch {
        // File may not exist in older commit (newly created)
        olderContent = '';
      }

      try {
        newerContent = await container.gitService.readFileAtCommit(dir, newerOid, filepath);
      } catch {
        // File may not exist in newer commit (deleted)
        newerContent = '';
      }

      const changes = diffLines(olderContent, newerContent);
      const lines: DiffLine[] = [];
      for (const change of changes) {
        const type = change.added ? 'added' : change.removed ? 'removed' : 'unchanged';
        // Split multi-line values into individual lines for display
        const valueLines = change.value.split('\n');
        // diffLines includes trailing newline in value, so the last empty string should be skipped
        for (let i = 0; i < valueLines.length; i++) {
          if (i === valueLines.length - 1 && valueLines[i] === '') continue;
          lines.push({ type, value: valueLines[i] });
        }
      }
      setDiffResult(lines);
    } catch (e) {
      setDiffError(String(e));
    } finally {
      setDiffLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedOids([]);
    setDiffResult(null);
    setDiffError(null);
    onClose();
  };

  const handleBackToList = () => {
    setDiffResult(null);
    setDiffError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-2xl bg-bg-main rounded-xl shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">
            {diffResult ? t('git.diffView') : t('git.history')}{pageTitle ? `: ${pageTitle}` : ''}
          </h2>
          <div className="flex items-center gap-2">
            {diffResult && (
              <button
                onClick={handleBackToList}
                className="text-sm text-accent hover:underline transition-colors"
              >
                {t('git.history')}
              </button>
            )}
            <button
              onClick={handleClose}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>

        {/* Diff view */}
        {diffResult ? (
          <div className="max-h-[500px] overflow-y-auto font-mono text-xs">
            {diffResult.map((line, i) => (
              <div
                key={i}
                className={`px-4 py-0.5 whitespace-pre-wrap break-all ${
                  line.type === 'added'
                    ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                    : line.type === 'removed'
                      ? 'bg-red-500/15 text-red-700 dark:text-red-400'
                      : 'text-text-primary'
                }`}
              >
                <span className="inline-block w-4 select-none opacity-50">
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </span>
                {line.value || ' '}
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Compare bar */}
            {filepath && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-sidebar">
                <span className="text-xs text-text-secondary">
                  {selectedOids.length === 2
                    ? `${selectedOids.map((o) => o.slice(0, 7)).join(' / ')}`
                    : t('git.selectToCompare')}
                </span>
                <button
                  onClick={handleCompare}
                  disabled={selectedOids.length !== 2 || diffLoading}
                  className="px-3 py-1 text-xs font-medium rounded bg-accent text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  {diffLoading ? '...' : t('git.compare')}
                </button>
              </div>
            )}

            {diffError && (
              <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-b border-border">
                {diffError}
              </div>
            )}

            {/* Commit list */}
            <div className="max-h-[400px] overflow-y-auto">
              {entries.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-text-secondary">
                  {t('git.noHistory')}
                </div>
              ) : (
                entries.map((entry) => {
                  const isSelected = selectedOids.includes(entry.oid);
                  return (
                    <div
                      key={entry.oid}
                      className={`px-4 py-3 border-b border-border last:border-b-0 hover:bg-bg-hover transition-colors cursor-pointer ${
                        isSelected ? 'bg-accent/10 border-l-2 border-l-accent' : ''
                      }`}
                      onClick={() => filepath && handleToggleSelect(entry.oid)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {filepath && (
                          <div className="flex items-center pt-0.5">
                            <div
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-accent border-accent'
                                  : 'border-border'
                              }`}
                            >
                              {isSelected && (
                                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text-primary truncate">
                            {entry.message}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-text-secondary">
                            <span>{entry.author.name}</span>
                            <span>&middot;</span>
                            <span>{formatDate(entry.author.timestamp)}</span>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-text-secondary shrink-0">
                          {entry.oid.slice(0, 7)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
