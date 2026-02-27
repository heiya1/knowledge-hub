import { useState, useRef, useCallback, memo } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Folder, FileText, MoreVertical } from 'lucide-react';
import type { TreeNode } from '../../core/models/TreeNode';

interface PageTreeItemProps {
  node: TreeNode;
  level: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, title: string, childCount: number) => void;
  onRename: (id: string, currentTitle: string) => void;
}

export const PageTreeItem = memo(function PageTreeItem({ node, level, selectedId, onSelect, onDelete, onRename }: PageTreeItemProps) {
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
  const isFolder = node.meta.tags?.includes('__folder');

  const countDescendants = useCallback((treeNode: TreeNode): number => {
    let count = treeNode.children.length;
    for (const child of treeNode.children) {
      count += countDescendants(child);
    }
    return count;
  }, []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useClickOutside(menuRef, menuOpen, closeMenu);

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
    <div>
      <div
        className="relative group"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); if (!menuOpen) setMenuOpen(false); }}
      >
        <button
          onClick={() => isFolder ? toggleExpanded() : onSelect(node.meta.id)}
          className={`w-full flex items-center gap-1.5 py-[5px] text-[13px] rounded transition-colors text-left
            ${isSelected
              ? 'bg-sidebar-item-selected text-sidebar-accent font-medium'
              : 'text-sidebar-text hover:bg-sidebar-hover'
            }`}
          style={{ paddingLeft: `${level * 12 + 8}px`, paddingRight: '28px' }}
        >
          {/* Expand/collapse chevron */}
          {hasChildren ? (
            <span
              onClick={(e) => { e.stopPropagation(); toggleExpanded(); }}
              className="w-4 h-4 flex items-center justify-center text-sidebar-text-muted hover:text-sidebar-text shrink-0"
            >
              <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </span>
          ) : (
            <span className="w-4 h-4 shrink-0" />
          )}

          {/* Icon: folder or document */}
          {isFolder || hasChildren ? (
            <Folder className="w-4 h-4 shrink-0 text-sidebar-text-muted" />
          ) : (
            <FileText className="w-4 h-4 shrink-0 text-sidebar-text-muted" />
          )}

          <span className="truncate flex-1">{node.meta.title || t('editor.untitled')}</span>
        </button>

        {/* "..." menu button */}
        {(hovered || menuOpen) && (
          <button
            onClick={handleMenuToggle}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-sidebar-text-muted hover:text-sidebar-text hover:bg-sidebar-hover transition-colors"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Context menu */}
        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full z-50 mt-0.5 w-36 rounded-lg shadow-lg border border-border bg-bg-main py-1"
          >
            <button
              onClick={handleRename}
              className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover transition-colors"
            >
              {t('common.rename')}
            </button>
            <button
              onClick={handleDelete}
              className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-bg-hover transition-colors"
            >
              {t('common.delete')}
            </button>
          </div>
        )}
      </div>

      {hasChildren && expanded && (
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
            />
          ))}
        </div>
      )}
    </div>
  );
});
