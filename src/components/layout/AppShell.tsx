import { Sidebar } from '../sidebar/Sidebar';
import { EditorView } from '../editor/EditorView';
import type { TreeNode } from '../../core/models/TreeNode';
import type { Document, DocumentMeta } from '../../core/models/Document';

interface AppShellProps {
  tree: TreeNode[];
  selectedId: string | null;
  currentDocument: Document | null;
  ancestors: DocumentMeta[];
  workspaceName: string;
  onSelectPage: (id: string) => void;
  onNewPage: () => void;
  onSave: (doc: Document) => Promise<void>;
  onNavigate: (id: string) => void;
}

export function AppShell({
  tree,
  selectedId,
  currentDocument,
  ancestors,
  workspaceName,
  onSelectPage,
  onNewPage,
  onSave,
  onNavigate,
}: AppShellProps) {
  return (
    <div className="flex h-full">
      <Sidebar
        tree={tree}
        selectedId={selectedId}
        onSelectPage={onSelectPage}
        onNewPage={onNewPage}
        workspaceName={workspaceName}
      />
      <EditorView
        document={currentDocument}
        ancestors={ancestors}
        onSave={onSave}
        onNavigate={onNavigate}
      />
    </div>
  );
}
