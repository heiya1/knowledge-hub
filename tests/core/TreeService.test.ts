import { describe, it, expect } from 'vitest';
import { TreeService } from '../../src/core/services/TreeService';
import type { DocumentMeta } from '../../src/core/models/Document';

function makeMeta(overrides: Partial<DocumentMeta> & { id: string; title: string }): DocumentMeta {
  return {
    parent: null,
    tags: [],
    ...overrides,
  };
}

describe('TreeService', () => {
  const service = new TreeService();

  it('builds flat list into tree', () => {
    const docs: DocumentMeta[] = [
      makeMeta({ id: 'a', title: 'Page A' }),
      makeMeta({ id: 'b', title: 'Page B' }),
    ];

    const tree = service.buildTree(docs);
    expect(tree).toHaveLength(2);
    expect(tree[0].meta.id).toBe('a');
    expect(tree[1].meta.id).toBe('b');
  });

  it('builds nested hierarchy', () => {
    const docs: DocumentMeta[] = [
      makeMeta({ id: 'root', title: 'Root' }),
      makeMeta({ id: 'child1', title: 'Child 1', parent: 'root' }),
      makeMeta({ id: 'child2', title: 'Child 2', parent: 'root' }),
      makeMeta({ id: 'grandchild', title: 'Grandchild', parent: 'child1' }),
    ];

    const tree = service.buildTree(docs);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].meta.id).toBe('child1');
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].meta.id).toBe('grandchild');
  });

  it('sorts children by title (folders first)', () => {
    const docs: DocumentMeta[] = [
      makeMeta({ id: 'root', title: 'Root' }),
      makeMeta({ id: 'c', title: 'C', parent: 'root' }),
      makeMeta({ id: 'a', title: 'A', parent: 'root' }),
      makeMeta({ id: 'b', title: 'B', parent: 'root' }),
      makeMeta({ id: 'folder', title: '00-folder', parent: 'root', tags: ['__folder'] }),
    ];

    const tree = service.buildTree(docs);
    const ids = tree[0].children.map((n) => n.meta.id);
    expect(ids).toEqual(['folder', 'a', 'b', 'c']);
  });

  it('finds a node in the tree', () => {
    const docs: DocumentMeta[] = [
      makeMeta({ id: 'root', title: 'Root' }),
      makeMeta({ id: 'child', title: 'Child', parent: 'root' }),
    ];

    const tree = service.buildTree(docs);
    const found = service.findNode(tree, 'child');
    expect(found).not.toBeNull();
    expect(found!.meta.title).toBe('Child');
  });

  it('gets ancestors', () => {
    const docs: DocumentMeta[] = [
      makeMeta({ id: 'root', title: 'Root' }),
      makeMeta({ id: 'child', title: 'Child', parent: 'root' }),
      makeMeta({ id: 'grandchild', title: 'Grandchild', parent: 'child' }),
    ];

    const ancestors = service.getAncestors(docs, 'grandchild');
    expect(ancestors).toHaveLength(2);
    expect(ancestors[0].id).toBe('root');
    expect(ancestors[1].id).toBe('child');
  });

  it('orphan child goes to root', () => {
    const docs: DocumentMeta[] = [
      makeMeta({ id: 'orphan', title: 'Orphan', parent: 'nonexistent' }),
    ];

    const tree = service.buildTree(docs);
    expect(tree).toHaveLength(1);
    expect(tree[0].meta.id).toBe('orphan');
  });
});
