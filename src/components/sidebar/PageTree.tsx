import type { TreeNode } from '../../core/models/TreeNode';
import { PageTreeItem } from './PageTreeItem';

interface PageTreeProps {
  tree: TreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PageTree({ tree, selectedId, onSelect }: PageTreeProps) {
  if (tree.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
        No pages yet
      </div>
    );
  }

  return (
    <div className="py-1">
      {tree.map((node) => (
        <PageTreeItem
          key={node.meta.id}
          node={node}
          level={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
