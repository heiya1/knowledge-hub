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

  it('creates a document with title as filename', async () => {
    const doc = await service.create({ title: 'Test Page' });
    expect(doc.id).toBe('Test Page');
    expect(doc.title).toBe('Test Page');
    expect(doc.parent).toBeNull();
    expect(doc.body).toBe('');
  });

  it('gets a document (title derived from filename)', async () => {
    const created = await service.create({ title: 'Hello' });
    const fetched = await service.get(created.id);
    expect(fetched.title).toBe('Hello');
    expect(fetched.id).toBe(created.id);
  });

  it('updates a document body', async () => {
    const doc = await service.create({ title: 'Original' });
    doc.body = '# Content';
    await service.update(doc);

    const fetched = await service.get(doc.id);
    expect(fetched.body).toBe('# Content');
    // Title is still derived from filename, not frontmatter
    expect(fetched.title).toBe('Original');
  });

  it('lists all documents', async () => {
    await service.create({ title: 'Page 1' });
    await service.create({ title: 'Page 2' });
    const all = await service.listAll();
    const pages = all.filter(d => !d.tags?.includes('__folder'));
    expect(pages).toHaveLength(2);
  });

  it('deletes a document (moves to trash)', async () => {
    const doc = await service.create({ title: 'To Delete' });
    await service.delete(doc.id);

    const all = await service.listAll();
    const pages = all.filter(d => !d.tags?.includes('__folder'));
    expect(pages).toHaveLength(0);

    const trashName = doc.id.replace(/\//g, '__');
    const trashExists = await fs.exists(`${wsPath}/.trash/${trashName}.md`);
    expect(trashExists).toBe(true);
  });

  it('creates in a parent folder', async () => {
    await fs.createDir(`${wsPath}/docs`, { recursive: true });
    const child = await service.create({ title: 'Child', parentFolder: 'docs' });
    expect(child.parent).toBe('docs');
    expect(child.id).toBe('docs/Child');
  });

  it('renames a document (renames file on disk)', async () => {
    const doc = await service.create({ title: 'OldName' });
    expect(doc.id).toBe('OldName');

    const newId = await service.rename('OldName', 'NewName');
    expect(newId).toBe('NewName');

    // Old file is gone
    expect(await fs.exists(`${wsPath}/OldName.md`)).toBe(false);
    // New file exists
    expect(await fs.exists(`${wsPath}/NewName.md`)).toBe(true);

    const fetched = await service.get(newId);
    expect(fetched.title).toBe('NewName');
  });

  it('handles duplicate filenames with (2) suffix', async () => {
    await service.create({ title: 'Page' });
    const dup = await service.create({ title: 'Page' });
    expect(dup.id).toBe('Page (2)');
    expect(dup.title).toBe('Page (2)');
  });
});
