import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentService } from '../../src/core/services/DocumentService';
import { MemoryFileSystem } from '../../src/infrastructure/MemoryFileSystem';

describe('DocumentService', () => {
  let fs: MemoryFileSystem;
  let service: DocumentService;
  const wsPath = '/workspace';

  beforeEach(async () => {
    fs = new MemoryFileSystem();
    await fs.createDir(`${wsPath}/pages`, { recursive: true });
    service = new DocumentService(fs, wsPath);
  });

  it('creates a document', async () => {
    const doc = await service.create({ title: 'Test Page' });
    expect(doc.id).toBeTruthy();
    expect(doc.title).toBe('Test Page');
    expect(doc.parent).toBeNull();
    expect(doc.body).toBe('');
  });

  it('gets a document', async () => {
    const created = await service.create({ title: 'Hello' });
    const fetched = await service.get(created.id);
    expect(fetched.title).toBe('Hello');
    expect(fetched.id).toBe(created.id);
  });

  it('updates a document', async () => {
    const doc = await service.create({ title: 'Original' });
    doc.title = 'Updated';
    doc.body = '# Content';
    await service.update(doc);

    const fetched = await service.get(doc.id);
    expect(fetched.title).toBe('Updated');
    expect(fetched.body).toBe('# Content');
  });

  it('lists all documents', async () => {
    await service.create({ title: 'Page 1' });
    await service.create({ title: 'Page 2' });
    const all = await service.listAll();
    expect(all).toHaveLength(2);
  });

  it('deletes a document (moves to trash)', async () => {
    const doc = await service.create({ title: 'To Delete' });
    await service.delete(doc.id);

    const all = await service.listAll();
    expect(all).toHaveLength(0);

    // Check it's in trash
    const trashExists = await fs.exists(`${wsPath}/.trash/${doc.id}.md`);
    expect(trashExists).toBe(true);
  });

  it('creates with parent and order', async () => {
    const parent = await service.create({ title: 'Parent' });
    const child = await service.create({ title: 'Child', parent: parent.id, order: 1 });
    expect(child.parent).toBe(parent.id);
    expect(child.order).toBe(1);
  });
});
