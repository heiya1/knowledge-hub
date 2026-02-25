import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PageTree } from './PageTree';
import { useSearchStore } from '../../stores/searchStore';
import type { TreeNode } from '../../core/models/TreeNode';
import type { DocumentMeta } from '../../core/models/Document';

interface WorkspaceInfo {
  id: string;
  name: string;
}

interface SidebarProps {
  tree: TreeNode[];
  documents: DocumentMeta[];
  selectedId: string | null;
  onSelectPage: (id: string) => void;
  onNewPage: () => void;
  onDeletePage: (id: string, title: string, childCount: number) => void;
  onRenamePage: (id: string, currentTitle: string) => void;
  onMovePage: (id: string, newParent: string | null, newOrder: number) => void;
  onOpenSettings: () => void;
  onOpenTrash: () => void;
  workspaceName: string;
  workspaces?: WorkspaceInfo[];
  activeWorkspaceId?: string | null;
  onSwitchWorkspace?: (id: string) => void;
}

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 260;

export function Sidebar({ tree, documents, selectedId, onSelectPage, onNewPage, onDeletePage, onRenamePage, onMovePage, onOpenSettings, onOpenTrash, workspaceName, workspaces, activeWorkspaceId, onSwitchWorkspace }: SidebarProps) {
  const { t } = useTranslation();
  const { setOpen: setSearchOpen } = useSearchStore();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const isResizing = useRef(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const wsDropdownRef = useRef<HTMLDivElement>(null);

  // Close workspace dropdown on click outside
  useEffect(() => {
    if (!wsDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (wsDropdownRef.current && !wsDropdownRef.current.contains(e.target as Node)) {
        setWsDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [wsDropdownOpen]);

  // --- Resize logic ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // --- Tag extraction ---
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const doc of documents) {
      if (doc.tags) {
        for (const tag of doc.tags) {
          tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [documents]);

  // --- Tag-based tree filtering ---
  const filteredTree = useMemo(() => {
    if (!selectedTag) return tree;

    // Collect IDs of documents that have the selected tag
    const matchingIds = new Set<string>();
    for (const doc of documents) {
      if (doc.tags && doc.tags.includes(selectedTag)) {
        matchingIds.add(doc.id);
      }
    }

    // Also collect all ancestor IDs so we keep the tree structure
    const ancestorIds = new Set<string>();
    for (const doc of documents) {
      if (matchingIds.has(doc.id)) {
        // Walk up the parent chain
        let parentId = doc.parent;
        while (parentId) {
          ancestorIds.add(parentId);
          const parentDoc = documents.find((d) => d.id === parentId);
          parentId = parentDoc?.parent ?? null;
        }
      }
    }

    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      const result: TreeNode[] = [];
      for (const node of nodes) {
        const isMatch = matchingIds.has(node.meta.id);
        const isAncestor = ancestorIds.has(node.meta.id);
        if (isMatch || isAncestor) {
          result.push({
            ...node,
            children: filterNodes(node.children),
          });
        }
      }
      return result;
    };

    return filterNodes(tree);
  }, [tree, documents, selectedTag]);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTag((prev) => (prev === tag ? null : tag));
  }, []);

  return (
    <aside
      ref={sidebarRef}
      className="h-full bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border)] flex flex-col overflow-hidden select-none relative"
      style={{ width: `${width}px`, minWidth: `${MIN_WIDTH}px`, maxWidth: `${MAX_WIDTH}px` }}
    >
      {/* Workspace selector */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] relative" ref={wsDropdownRef}>
        <button
          onClick={() => workspaces && workspaces.length > 1 ? setWsDropdownOpen((v) => !v) : undefined}
          className="w-full flex items-center justify-between text-sm font-semibold text-[var(--color-text-primary)] truncate hover:text-[var(--color-accent)] transition-colors"
        >
          <span className="truncate">{workspaceName}</span>
          {workspaces && workspaces.length > 1 && (
            <svg className={`w-3.5 h-3.5 shrink-0 ml-1 transition-transform ${wsDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
        {wsDropdownOpen && workspaces && (
          <div className="absolute left-2 right-2 top-full mt-1 bg-[var(--color-bg-main)] border border-[var(--color-border)] rounded-lg shadow-lg z-20 overflow-hidden">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  if (ws.id !== activeWorkspaceId && onSwitchWorkspace) {
                    onSwitchWorkspace(ws.id);
                  }
                  setWsDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-bg-hover)] transition-colors ${
                  ws.id === activeWorkspaceId ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-text-primary)]'
                }`}
              >
                {ws.id === activeWorkspaceId && <span className="mr-1.5">●</span>}
                {ws.name}
              </button>
            ))}
          </div>
        )}
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
          tree={filteredTree}
          selectedId={selectedId}
          onSelect={onSelectPage}
          onDelete={onDeletePage}
          onRename={onRenamePage}
          onMovePage={onMovePage}
        />
      </div>

      {/* Tags section */}
      {allTags.length > 0 && (
        <div className="px-3 py-2 border-t border-[var(--color-border)]">
          <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider px-2 mb-1.5">
            {t('sidebar.tags')}
          </div>
          <div className="flex flex-wrap gap-1 px-1">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full transition-colors ${
                  selectedTag === tag
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                }`}
              >
                # {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Trash button */}
      <div className="px-3 py-1 border-t border-[var(--color-border)]">
        <button
          onClick={onOpenTrash}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>{t('sidebar.trash')}</span>
        </button>
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

      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[var(--color-accent)]/30 active:bg-[var(--color-accent)]/50 transition-colors z-10"
        onMouseDown={handleMouseDown}
      />
    </aside>
  );
}
