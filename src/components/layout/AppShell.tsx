import { Sidebar } from '../sidebar/Sidebar';
import { EditorView } from '../editor/EditorView';
import { Terminal } from '../terminal/Terminal';
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
  currentDocument: Document | null;
  ancestors: DocumentMeta[];
  workspaceName: string;
  workspacePath: string;
  sidebarVisible: boolean;
  workspaces?: WorkspaceInfo[];
  activeWorkspaceId?: string | null;
  onSwitchWorkspace?: (id: string) => void;
  onAddWorkspace?: () => void;
  onSelectPage: (id: string) => void;
  onNewPage: () => void;
  onDeletePage: (id: string, title: string, childCount: number) => void;
  onRenamePage: (id: string, currentTitle: string) => void;
  onMovePage: (id: string, newParent: string | null, newOrder: number) => void;
  onSave: (doc: Document) => Promise<void>;
  onNavigate: (id: string) => void;
  onOpenSettings: () => void;
  onOpenTrash: () => void;
  onCommit: (message: string) => Promise<void>;
  onSync: () => Promise<void>;
  onReloadDocument?: () => void;
}

export function AppShell({
  tree,
  documents,
  selectedId,
  currentDocument,
  ancestors,
  workspaceName,
  workspacePath,
  sidebarVisible,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  onAddWorkspace,
  onSelectPage,
  onNewPage,
  onDeletePage,
  onRenamePage,
  onMovePage,
  onSave,
  onNavigate,
  onOpenSettings,
  onOpenTrash,
  onCommit,
  onSync,
  onReloadDocument,
}: AppShellProps) {
  return (
    <div className="flex h-full">
      {sidebarVisible && (
        <Sidebar
          tree={tree}
          documents={documents}
          selectedId={selectedId}
          onSelectPage={onSelectPage}
          onNewPage={onNewPage}
          onDeletePage={onDeletePage}
          onRenamePage={onRenamePage}
          onMovePage={onMovePage}
          onOpenSettings={onOpenSettings}
          onOpenTrash={onOpenTrash}
          workspaceName={workspaceName}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitchWorkspace={onSwitchWorkspace}
          onAddWorkspace={onAddWorkspace}
        />
      )}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <EditorView
          document={currentDocument}
          ancestors={ancestors}
          workspaceName={workspaceName}
          onSave={onSave}
          onNavigate={onNavigate}
          onCommit={onCommit}
          onSync={onSync}
          onReloadDocument={onReloadDocument}
        />
        <Terminal workspacePath={workspacePath} />
      </div>
    </div>
  );
}
