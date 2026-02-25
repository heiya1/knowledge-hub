import { useTranslation } from 'react-i18next';
import type { TreeNode } from '../../core/models/TreeNode';
import { PageTreeItem } from './PageTreeItem';

interface PageTreeProps {
  tree: TreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, title: string, childCount: number) => void;
  onRename: (id: string, currentTitle: string) => void;
}

export function PageTree({ tree, selectedId, onSelect, onDelete, onRename }: PageTreeProps) {
  const { t } = useTranslation();

  if (tree.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
        {t('sidebar.noPages')}
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
          onDelete={onDelete}
          onRename={onRename}
        />
      ))}
    </div>
  );
}
