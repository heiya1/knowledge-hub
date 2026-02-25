import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { TreeNode } from '../../core/models/TreeNode';
import { PageTreeItem } from './PageTreeItem';

interface PageTreeProps {
  tree: TreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, title: string, childCount: number) => void;
  onRename: (id: string, currentTitle: string) => void;
  onMovePage: (id: string, newParent: string | null, newOrder: number) => void;
}

/** Recursively collect all node IDs in the tree for SortableContext */
function collectAllIds(nodes: TreeNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.meta.id);
    ids.push(...collectAllIds(node.children));
  }
  return ids;
}

/** Find a TreeNode by ID in the tree */
function findNodeInTree(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.meta.id === id) return node;
    const found = findNodeInTree(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Find the parent node of a given node ID */
function findParentNode(nodes: TreeNode[], targetId: string, parent: TreeNode | null = null): TreeNode | null {
  for (const node of nodes) {
    if (node.meta.id === targetId) return parent;
    const found = findParentNode(node.children, targetId, node);
    if (found !== null) return found;
  }
  return null;
}

/** Get siblings (nodes at same level under same parent) for a given node ID */
function getSiblings(tree: TreeNode[], nodeId: string): TreeNode[] {
  // Check if it's a root-level item
  for (const node of tree) {
    if (node.meta.id === nodeId) return tree;
  }
  // Search in children
  for (const node of tree) {
    const result = getSiblingsRecursive(node.children, nodeId);
    if (result) return result;
  }
  return [];
}

function getSiblingsRecursive(nodes: TreeNode[], nodeId: string): TreeNode[] | null {
  for (const node of nodes) {
    if (node.meta.id === nodeId) return nodes;
    const result = getSiblingsRecursive(node.children, nodeId);
    if (result) return result;
  }
  return null;
}

/** Check if a node is a descendant of another node */
function isDescendantOf(tree: TreeNode[], potentialDescendantId: string, potentialAncestorId: string): boolean {
  const ancestor = findNodeInTree(tree, potentialAncestorId);
  if (!ancestor) return false;
  return findNodeInTree(ancestor.children, potentialDescendantId) !== null;
}

export function PageTree({ tree, selectedId, onSelect, onDelete, onRename, onMovePage }: PageTreeProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overItemId, setOverItemId] = useState<string | null>(null);

  // All IDs for SortableContext
  const allIds = useMemo(() => collectAllIds(tree), [tree]);

  // Use PointerSensor with a small activation distance to distinguish click from drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const activeNode = useMemo(() => {
    if (!activeId) return null;
    return findNodeInTree(tree, activeId);
  }, [activeId, tree]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      setOverItemId(over.id as string);
    } else {
      setOverItemId(null);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverItemId(null);

    if (!over || active.id === over.id) return;

    const draggedId = active.id as string;
    const overId = over.id as string;

    // Prevent dropping a node onto its own descendant
    if (isDescendantOf(tree, overId, draggedId)) return;

    const draggedNode = findNodeInTree(tree, draggedId);
    const overNode = findNodeInTree(tree, overId);
    if (!draggedNode || !overNode) return;

    const draggedParent = findParentNode(tree, draggedId);
    const overParent = findParentNode(tree, overId);

    const draggedParentId = draggedParent?.meta.id ?? null;
    const overParentId = overParent?.meta.id ?? null;

    if (draggedParentId === overParentId) {
      // Same parent: reorder within the same level
      const siblings = getSiblings(tree, overId);
      const overIndex = siblings.findIndex(n => n.meta.id === overId);

      if (overIndex >= 0) {
        onMovePage(draggedId, draggedParentId, overIndex);
      }
    } else {
      // Different parent: reparent the dragged node under the overNode's parent
      // If the over node is at a different level, move the dragged node to be
      // a sibling of the over node (under the same parent)
      const overSiblings = getSiblings(tree, overId);
      const overIndex = overSiblings.findIndex(n => n.meta.id === overId);

      if (overIndex >= 0) {
        onMovePage(draggedId, overParentId, overIndex);
      }
    }
  }, [tree, onMovePage]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverItemId(null);
  }, []);

  if (tree.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
        {t('sidebar.noPages')}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
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
              onMovePage={onMovePage}
              activeId={activeId}
              overItemId={overItemId}
            />
          ))}
        </div>
      </SortableContext>

      {/* Drag overlay: ghost element shown while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeNode ? (
          <div className="px-2 py-1.5 text-sm rounded-md bg-[var(--color-bg-main)] shadow-lg border border-[var(--color-accent)] text-[var(--color-text-primary)] opacity-90 max-w-[200px] truncate">
            {activeNode.meta.title || t('editor.untitled')}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
