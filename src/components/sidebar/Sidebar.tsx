import { useTranslation } from 'react-i18next';
import { PageTree } from './PageTree';
import { useSearchStore } from '../../stores/searchStore';
import type { TreeNode } from '../../core/models/TreeNode';

interface SidebarProps {
  tree: TreeNode[];
  selectedId: string | null;
  onSelectPage: (id: string) => void;
  onNewPage: () => void;
  onDeletePage: (id: string, title: string, childCount: number) => void;
  onRenamePage: (id: string, currentTitle: string) => void;
  onOpenSettings: () => void;
  workspaceName: string;
}

export function Sidebar({ tree, selectedId, onSelectPage, onNewPage, onDeletePage, onRenamePage, onOpenSettings, workspaceName }: SidebarProps) {
  const { t } = useTranslation();
  const { setOpen: setSearchOpen } = useSearchStore();

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
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] text-sm cursor-pointer hover:bg-[var(--color-border)] transition-colors text-left"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>{t('sidebar.searchPlaceholder')}</span>
        </button>
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
        <PageTree
          tree={tree}
          selectedId={selectedId}
          onSelect={onSelectPage}
          onDelete={onDeletePage}
          onRename={onRenamePage}
        />
      </div>

      {/* Settings button */}
      <div className="px-3 py-2 border-t border-[var(--color-border)]">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{t('settings.title')}</span>
        </button>
      </div>
    </aside>
  );
}
