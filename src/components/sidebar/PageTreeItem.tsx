import { useState } from 'react';
import type { TreeNode } from '../../core/models/TreeNode';

interface PageTreeItemProps {
  node: TreeNode;
  level: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PageTreeItem({ node, level, selectedId, onSelect }: PageTreeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = node.meta.id === selectedId;

  return (
    <div>
      <button
        onClick={() => onSelect(node.meta.id)}
        className={`w-full flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition-colors text-left
          ${isSelected
            ? 'bg-[var(--color-sidebar-selected)] text-[var(--color-accent)]'
            : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
          }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="w-4 h-4 flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] shrink-0"
          >
            {expanded ? '\u25BC' : '\u25B6'}
          </span>
        ) : (
          <span className="w-4 h-4 flex items-center justify-center text-[var(--color-text-secondary)] shrink-0">
            {'\u25CB'}
          </span>
        )}
        <span className="truncate">{node.meta.title || 'Untitled'}</span>
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <PageTreeItem
              key={child.meta.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
