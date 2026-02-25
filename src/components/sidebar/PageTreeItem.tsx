import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TreeNode } from '../../core/models/TreeNode';

interface PageTreeItemProps {
  node: TreeNode;
  level: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, title: string, childCount: number) => void;
  onRename: (id: string, currentTitle: string) => void;
  onMovePage: (id: string, newParent: string | null, newOrder: number) => void;
  /** ID of the item currently being dragged (passed from DndContext) */
  activeId: string | null;
  /** ID of the item currently being hovered over for reparenting */
  overItemId: string | null;
}

export function PageTreeItem({ node, level, selectedId, onSelect, onDelete, onRename, onMovePage, activeId, overItemId }: PageTreeItemProps) {
  const { t } = useTranslation();
  const storageKey = `tree-expanded-${node.meta.id}`;
  const [expanded, setExpanded] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === 'true' : true;
  });

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(storageKey, String(next));
      return next;
    });
  }, [storageKey]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasChildren = node.children.length > 0;
  const isSelected = node.meta.id === selectedId;
  const isDraggedItem = activeId === node.meta.id;
  const isDropTarget = overItemId === node.meta.id && activeId !== node.meta.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.meta.id,
    data: {
      type: 'page',
      node,
      level,
      parentId: node.meta.parent,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const countDescendants = useCallback((treeNode: TreeNode): number => {
    let count = treeNode.children.length;
    for (const child of treeNode.children) {
      count += countDescendants(child);
    }
    return count;
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    onRename(node.meta.id, node.meta.title);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    const childCount = countDescendants(node);
    onDelete(node.meta.id, node.meta.title || t('editor.untitled'), childCount);
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className={`relative group ${isDropTarget ? 'ring-2 ring-[var(--color-accent)] ring-inset rounded-md' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); if (!menuOpen) setMenuOpen(false); }}
      >
        <button
          onClick={() => onSelect(node.meta.id)}
          className={`w-full flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition-colors text-left
            ${isSelected
              ? 'bg-[var(--color-sidebar-selected)] text-[var(--color-accent)]'
              : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
            }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          {/* Drag handle - visible on hover */}
          <span
            ref={setActivatorNodeRef}
            {...listeners}
            className={`w-4 h-4 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing transition-opacity ${
              hovered || isDragging ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={(e) => e.stopPropagation()}
            title={t('common.move')}
          >
            <svg className="w-3 h-3 text-[var(--color-text-secondary)]" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="5" cy="3" r="1.5" />
              <circle cx="11" cy="3" r="1.5" />
              <circle cx="5" cy="8" r="1.5" />
              <circle cx="11" cy="8" r="1.5" />
              <circle cx="5" cy="13" r="1.5" />
              <circle cx="11" cy="13" r="1.5" />
            </svg>
          </span>

          {hasChildren ? (
            <span
              onClick={(e) => { e.stopPropagation(); toggleExpanded(); }}
              className="w-4 h-4 flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] shrink-0"
            >
              {expanded ? '\u25BC' : '\u25B6'}
            </span>
          ) : (
            <span className="w-4 h-4 flex items-center justify-center text-[var(--color-text-secondary)] shrink-0">
              {'\u25CB'}
            </span>
          )}
          <span className="truncate flex-1">{node.meta.title || t('editor.untitled')}</span>
        </button>

        {/* "..." menu button - visible on hover */}
        {(hovered || menuOpen) && !isDragging && (
          <button
            onClick={handleMenuToggle}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors"
            title={t('common.more', 'More')}
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
        )}

        {/* Context menu dropdown */}
        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full z-50 mt-0.5 w-36 rounded-md shadow-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] py-1"
          >
            <button
              onClick={handleRename}
              className="w-full text-left px-3 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              {t('common.rename')}
            </button>
            <button
              onClick={handleDelete}
              className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              {t('common.delete')}
            </button>
          </div>
        )}
      </div>

      {hasChildren && expanded && !isDraggedItem && (
        <div>
          {node.children.map((child) => (
            <PageTreeItem
              key={child.meta.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
              onMovePage={onMovePage}
              activeId={activeId}
              overItemId={overItemId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
