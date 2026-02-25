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

    // Sort children by order
    const sortChildren = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.meta.order - b.meta.order);
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
    let current = docMap.get(id);
    while (current?.parent) {
      const parent = docMap.get(current.parent);
      if (!parent) break;
      ancestors.unshift(parent);
      current = parent;
    }
    return ancestors;
  }
}
