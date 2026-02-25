import { Sidebar } from '../sidebar/Sidebar';
import { EditorView } from '../editor/EditorView';
import { Terminal } from '../terminal/Terminal';
import type { TreeNode } from '../../core/models/TreeNode';
import type { Document, DocumentMeta } from '../../core/models/Document';

interface AppShellProps {
  tree: TreeNode[];
  selectedId: string | null;
  currentDocument: Document | null;
  ancestors: DocumentMeta[];
  workspaceName: string;
  workspacePath: string;
  onSelectPage: (id: string) => void;
  onNewPage: () => void;
  onDeletePage: (id: string, title: string, childCount: number) => void;
  onRenamePage: (id: string, currentTitle: string) => void;
  onSave: (doc: Document) => Promise<void>;
  onNavigate: (id: string) => void;
  onOpenSettings: () => void;
  onCommit: (message: string) => Promise<void>;
  onSync: () => Promise<void>;
}

export function AppShell({
  tree,
  selectedId,
  currentDocument,
  ancestors,
  workspaceName,
  workspacePath,
  onSelectPage,
  onNewPage,
  onDeletePage,
  onRenamePage,
  onSave,
  onNavigate,
  onOpenSettings,
  onCommit,
  onSync,
}: AppShellProps) {
  return (
    <div className="flex h-full">
      <Sidebar
        tree={tree}
        selectedId={selectedId}
        onSelectPage={onSelectPage}
        onNewPage={onNewPage}
        onDeletePage={onDeletePage}
        onRenamePage={onRenamePage}
        onOpenSettings={onOpenSettings}
        workspaceName={workspaceName}
      />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <EditorView
          document={currentDocument}
          ancestors={ancestors}
          onSave={onSave}
          onNavigate={onNavigate}
          onCommit={onCommit}
          onSync={onSync}
        />
        <Terminal workspacePath={workspacePath} />
      </div>
    </div>
  );
}
