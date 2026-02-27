import type { DocumentMeta } from '../models/Document';
import type { TreeNode } from '../models/TreeNode';

export class TreeService {
  buildTree(documents: DocumentMeta[]): TreeNode[] {
    const nodeMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    // Create nodes
    for (const doc of documents) {
      nodeMap.set(doc.id, { meta: doc, children: [] });
    }

    // Build hierarchy
    for (const doc of documents) {
      const node = nodeMap.get(doc.id)!;
      if (doc.parent && nodeMap.has(doc.parent)) {
        nodeMap.get(doc.parent)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Sort: folders first, then by title
    const isFolder = (n: TreeNode) => n.meta.tags?.includes('__folder');
    const sortChildren = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        const aFolder = isFolder(a) ? 0 : 1;
        const bFolder = isFolder(b) ? 0 : 1;
        if (aFolder !== bFolder) return aFolder - bFolder;
        return a.meta.title.localeCompare(b.meta.title);
      });
      for (const node of nodes) {
        sortChildren(node.children);
      }
    };
    sortChildren(roots);

    return roots;
  }

  findNode(tree: TreeNode[], id: string): TreeNode | null {
    for (const node of tree) {
      if (node.meta.id === id) return node;
      const found = this.findNode(node.children, id);
      if (found) return found;
    }
    return null;
  }

  getAncestors(documents: DocumentMeta[], id: string): DocumentMeta[] {
    const docMap = new Map<string, DocumentMeta>();
    for (const doc of documents) {
      docMap.set(doc.id, doc);
    }
    const ancestors: DocumentMeta[] = [];
    const visited = new Set<string>();
    let current = docMap.get(id);
    while (current?.parent) {
      if (visited.has(current.parent)) break; // Prevent circular reference loop
      visited.add(current.parent);
      const parent = docMap.get(current.parent);
      if (!parent) break;
      ancestors.unshift(parent);
      current = parent;
    }
    return ancestors;
  }
}
