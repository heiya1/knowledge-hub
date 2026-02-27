import { useCallback, useRef, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from '../sidebar/Sidebar';
import { EditorView } from '../editor/EditorView';
import { PaneTabBar } from '../editor/TabBar';
import { Terminal } from '../terminal/Terminal';
import { useTabStore } from '../../stores/tabStore';
import type { PaneNode } from '../../stores/tabStore';
import type { TreeNode } from '../../core/models/TreeNode';
import type { Document, DocumentMeta } from '../../core/models/Document';

interface WorkspaceInfo {
  id: string;
  name: string;
}

interface AppShellProps {
  tree: TreeNode[];
  documents: DocumentMeta[];
  selectedId: string | null;
  documentMap: Record<string, Document>;
  getAncestors: (docId: string) => DocumentMeta[];
  workspaceName: string;
  workspacePath: string;
  sidebarVisible: boolean;
  workspaces?: WorkspaceInfo[];
  activeWorkspaceId?: string | null;
  onSwitchWorkspace?: (id: string) => void;
  onAddWorkspace?: () => void;
  onDeleteWorkspace?: (id: string, name: string) => void;
  onSelectPage: (id: string) => void;
  onNewPage: () => void;
  onNewFolder: () => void;
  onDeletePage: (id: string, title: string, childCount: number) => void;
  onRenamePage: (id: string, currentTitle: string) => void;
  onSave: (doc: Document) => Promise<void>;
  onNavigate: (id: string) => void;
  onOpenSettings: () => void;
  onOpenTrash: () => void;
  onOpenImageCleanup: () => void;
  onCommit: (message: string) => Promise<void>;
  onSync: () => Promise<void>;
  onReloadDocument?: () => void;
  onSelectTab: (paneId: string, tabId: string) => void;
  onCloseTab: (paneId: string, tabId: string) => void;
  onActivatePane: (paneId: string) => void;
  onPaneClosed: () => void;
  onToggleSidebar: () => void;
  favorites?: string[];
  recentPages?: Array<{ id: string; title: string; timestamp: string }>;
  onToggleFavorite?: (id: string) => void;
  onCopyPage?: (id: string) => void;
}

/* ---------- Split Pane Container ---------- */
function SplitPane({
  direction,
  ratio,
  onRatioChange,
  first,
  second,
}: {
  direction: 'horizontal' | 'vertical';
  ratio: number;
  onRatioChange: (ratio: number) => void;
  first: React.ReactNode;
  second: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const isHorizontal = direction === 'horizontal';
  // Use ref for callback to avoid re-registering listeners on every render
  const onRatioChangeRef = useRef(onRatioChange);
  onRatioChangeRef.current = onRatioChange;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newRatio = isHorizontal
        ? (e.clientX - rect.left) / rect.width
        : (e.clientY - rect.top) / rect.height;
      onRatioChangeRef.current(Math.max(0.15, Math.min(0.85, newRatio)));
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
  }, [isHorizontal]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [isHorizontal]);

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex ${isHorizontal ? 'flex-row' : 'flex-col'} min-h-0 min-w-0 overflow-hidden`}
    >
      <div
        className="min-h-0 min-w-0 overflow-hidden flex flex-col"
        style={isHorizontal ? { width: `${ratio * 100}%` } : { height: `${ratio * 100}%` }}
      >
        {first}
      </div>
      <div
        className={`shrink-0 ${
          isHorizontal
            ? 'w-1 cursor-col-resize'
            : 'h-1 cursor-row-resize'
        } bg-border hover:bg-accent/50 active:bg-accent transition-colors`}
        onMouseDown={handleMouseDown}
      />
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
        {second}
      </div>
    </div>
  );
}

/* ---------- AppShell ---------- */
export function AppShell({
  tree,
  documents,
  selectedId,
  documentMap,
  getAncestors,
  workspaceName,
  workspacePath,
  sidebarVisible,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  onAddWorkspace,
  onDeleteWorkspace,
  onSelectPage,
  onNewPage,
  onNewFolder,
  onDeletePage,
  onRenamePage,
  onSave,
  onNavigate,
  onOpenSettings,
  onOpenTrash,
  onOpenImageCleanup,
  onCommit,
  onSync,
  onReloadDocument,
  onSelectTab,
  onCloseTab,
  onActivatePane,
  onPaneClosed,
  onToggleSidebar,
  favorites,
  recentPages,
  onToggleFavorite,
  onCopyPage,
}: AppShellProps) {
  const { paneLayout, activePaneId, setPaneRatio } = useTabStore();

  const renderPaneNode = useCallback((node: PaneNode): React.ReactNode => {
    if (node.type === 'leaf') {
      const doc = node.activeTabId ? documentMap[node.activeTabId] ?? null : null;
      const anc = node.activeTabId ? getAncestors(node.activeTabId) : [];
      const isActive = node.id === activePaneId;

      return (
        <div
          key={node.id}
          className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden"
          onClick={() => {
            if (activePaneId !== node.id) {
              onActivatePane(node.id);
            }
          }}
        >
          <PaneTabBar
            paneId={node.id}
            tabs={node.tabs}
            activeTabId={node.activeTabId}
            isActivePane={isActive}
            onSelectTab={(tabId) => onSelectTab(node.id, tabId)}
            onCloseTab={(tabId) => onCloseTab(node.id, tabId)}
            onPaneClosed={onPaneClosed}
          />
          <EditorView
            paneId={node.id}
            document={doc}
            ancestors={anc}
            workspaceName={workspaceName}
            onSave={onSave}
            onNavigate={onNavigate}
            onCommit={onCommit}
            onSync={onSync}
            onReloadDocument={onReloadDocument}
            onDelete={onDeletePage}
            onRename={onRenamePage}
            onCopy={onCopyPage}
          />
        </div>
      );
    }

    return (
      <SplitPane
        key={node.id}
        direction={node.direction}
        ratio={node.ratio}
        onRatioChange={(r) => setPaneRatio(node.id, r)}
        first={renderPaneNode(node.first)}
        second={renderPaneNode(node.second)}
      />
    );
  }, [documentMap, getAncestors, activePaneId, setPaneRatio, workspaceName, onSave, onNavigate, onCommit, onSync, onReloadDocument, onDeletePage, onRenamePage, onCopyPage, onSelectTab, onCloseTab, onActivatePane, onPaneClosed]);

  return (
    <div className="flex flex-1 min-h-0">
      {sidebarVisible ? (
        <Sidebar
          tree={tree}
          documents={documents}
          selectedId={selectedId}
          onSelectPage={onSelectPage}
          onNewPage={onNewPage}
          onNewFolder={onNewFolder}
          onDeletePage={onDeletePage}
          onRenamePage={onRenamePage}
          onOpenSettings={onOpenSettings}
          onOpenTrash={onOpenTrash}
          onOpenImageCleanup={onOpenImageCleanup}
          workspaceName={workspaceName}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitchWorkspace={onSwitchWorkspace}
          onAddWorkspace={onAddWorkspace}
          onDeleteWorkspace={onDeleteWorkspace}
          onToggleSidebar={onToggleSidebar}
          favorites={favorites}
          recentPages={recentPages}
          onToggleFavorite={onToggleFavorite}
        />
      ) : (
        <button
          onClick={onToggleSidebar}
          className="shrink-0 w-8 h-full flex flex-col items-center pt-2 bg-bg-sidebar border-r border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>
      )}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {renderPaneNode(paneLayout)}
        </div>
        <Terminal workspacePath={workspacePath} />
      </div>
    </div>
  );
}
