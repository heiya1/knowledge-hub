import { useTranslation } from 'react-i18next';
import { PageTree } from './PageTree';
import type { TreeNode } from '../../core/models/TreeNode';

interface SidebarProps {
  tree: TreeNode[];
  selectedId: string | null;
  onSelectPage: (id: string) => void;
  onNewPage: () => void;
  workspaceName: string;
}

export function Sidebar({ tree, selectedId, onSelectPage, onNewPage, workspaceName }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="w-[260px] min-w-[180px] max-w-[400px] h-full bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border)] flex flex-col overflow-hidden select-none">
      {/* Workspace name */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
          {workspaceName}
        </div>
      </div>

      {/* Search placeholder */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] text-sm cursor-pointer">
          <span>{t('sidebar.searchPlaceholder')}</span>
        </div>
      </div>

      {/* New page button */}
      <div className="px-3 pb-2">
        <button
          onClick={onNewPage}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] transition-colors"
        >
          <span>+</span>
          <span>{t('sidebar.newPage')}</span>
        </button>
      </div>

      {/* Pages section */}
      <div className="px-3 py-1">
        <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider px-2">
          {t('sidebar.pages')}
        </div>
      </div>

      {/* Page tree */}
      <div className="flex-1 overflow-y-auto px-1">
        <PageTree tree={tree} selectedId={selectedId} onSelect={onSelectPage} />
      </div>
    </aside>
  );
}
