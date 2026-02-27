import type { IFileSystem } from '../interfaces/IFileSystem';
import type { Document, DocumentMeta } from '../models/Document';
import { parseFrontmatter, stringifyFrontmatter } from '../utils/frontmatter';

/** Directories to skip when scanning for markdown files */
const SKIP_DIRS = new Set(['.git', '.trash', 'node_modules', '.vscode', 'assets']);

/** Sanitize a title into a safe filename (without extension) */
function sanitizeFilename(title: string): string {
  // Replace filesystem-unsafe characters with underscore
  let name = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
  // Collapse multiple underscores/spaces
  name = name.replace(/_{2,}/g, '_');
  // Remove leading/trailing dots (hidden files on Unix)
  name = name.replace(/^\.+|\.+$/g, '');
  return name || 'untitled';
}

export class DocumentService {
  constructor(private fs: IFileSystem, private workspacePath: string) {}

  /**
   * Resolve document ID to absolute file path.
   * ID is the relative path from workspace root without .md extension.
   */
  private filePath(id: string): string {
    return `${this.workspacePath}/${id}.md`;
  }

  /**
   * Derive a display title from a document ID.
   * Takes the last segment of the path (filename without .md).
   */
  private titleFromId(id: string): string {
    return id.split('/').pop() || id;
  }

  /**
   * Recursively scan a directory for .md files.
   * Returns relative paths from workspace root (without .md extension).
   */
  private async scanDir(dirPath: string, relativeTo: string): Promise<string[]> {
    const results: string[] = [];
    const entries = await this.fs.readDir(dirPath);

    for (const entry of entries) {
      if (entry.isDirectory) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        const subResults = await this.scanDir(
          `${dirPath}/${entry.name}`,
          relativeTo
        );
        results.push(...subResults);
      } else if (entry.isFile && entry.name.endsWith('.md')) {
        const absPath = `${dirPath}/${entry.name}`;
        const relPath = absPath
          .slice(relativeTo.length)
          .replace(/^\//, '')
          .replace(/\.md$/, '');
        results.push(relPath);
      }
    }

    return results;
  }

  /**
   * Generate a unique filename, appending (2), (3), etc. if the name already exists.
   */
  private async uniqueId(baseId: string): Promise<string> {
    if (!await this.fs.exists(this.filePath(baseId))) return baseId;
    let n = 2;
    while (await this.fs.exists(this.filePath(`${baseId} (${n})`))) {
      n++;
    }
    return `${baseId} (${n})`;
  }

  async create(options: { title: string; parentFolder?: string | null }): Promise<Document> {
    const folder = options.parentFolder ?? null;
    const safeName = sanitizeFilename(options.title || 'untitled');
    const baseId = folder ? `${folder}/${safeName}` : safeName;
    const id = await this.uniqueId(baseId);

    // Ensure target directory exists
    if (folder) {
      const targetDir = `${this.workspacePath}/${folder}`;
      if (!await this.fs.exists(targetDir)) {
        await this.fs.createDir(targetDir, { recursive: true });
      }
    }

    const doc: Document = {
      id,
      title: this.titleFromId(id),
      parent: folder,
      tags: [],
      body: '',
      hasFrontmatter: false,
    };
    await this.fs.writeTextFile(this.filePath(id), stringifyFrontmatter(doc));
    return doc;
  }

  async get(id: string): Promise<Document> {
    const path = this.filePath(id);
    const fileExists = await this.fs.exists(path);
    if (!fileExists) {
      // Virtual folder node — return empty document
      const folderName = id.split('/').pop() || id;
      return {
        id,
        title: folderName,
        parent: null,
        tags: ['__folder'],
        body: '',
      };
    }
    const raw = await this.fs.readTextFile(path);
    const doc = parseFrontmatter(raw);
    doc.id = id;
    doc.title = this.titleFromId(id);
    return doc;
  }

  async update(doc: Document): Promise<void> {
    await this.fs.writeTextFile(this.filePath(doc.id), stringifyFrontmatter(doc));
  }

  /**
   * Rename a file on disk. Returns the new document ID.
   */
  async rename(id: string, newTitle: string): Promise<string> {
    const parts = id.split('/');
    parts[parts.length - 1] = sanitizeFilename(newTitle);
    const newId = parts.join('/');

    if (newId === id) return id; // no change

    // Ensure unique
    const finalId = await this.uniqueId(newId);
    await this.fs.rename(this.filePath(id), this.filePath(finalId));
    return finalId;
  }

  async delete(id: string): Promise<void> {
    const trashDir = `${this.workspacePath}/.trash`;
    const exists = await this.fs.exists(trashDir);
    if (!exists) {
      await this.fs.createDir(trashDir, { recursive: true });
    }
    // Flatten the ID for trash filename (replace / with __)
    const trashName = id.replace(/\//g, '__');
    await this.fs.rename(this.filePath(id), `${trashDir}/${trashName}.md`);
  }

  /**
   * Rename a folder on disk. Returns the new folder ID (path).
   */
  async renameFolder(folderId: string, newName: string): Promise<string> {
    const parts = folderId.split('/');
    parts[parts.length - 1] = newName;
    const newId = parts.join('/');

    const oldPath = `${this.workspacePath}/${folderId}`;
    const newPath = `${this.workspacePath}/${newId}`;
    await this.fs.rename(oldPath, newPath);
    return newId;
  }

  /**
   * Delete a folder: move all .md files inside to .trash, then remove directory.
   */
  async deleteFolder(folderId: string): Promise<void> {
    const dirPath = `${this.workspacePath}/${folderId}`;
    const fileIds = await this.scanDir(dirPath, this.workspacePath);

    for (const fileId of fileIds) {
      try {
        await this.delete(fileId);
      } catch {
        // skip files that can't be moved
      }
    }

    try {
      await this.fs.removeDir(dirPath, { recursive: true });
    } catch {
      // Directory might already be gone
    }
  }

  /**
   * Build a backlink index: for each page, find which other pages link to it via [[title|id]].
   * Returns a Map where key = target page ID, value = array of source page IDs.
   */
  async buildBacklinkIndex(): Promise<Map<string, string[]>> {
    const ids = await this.scanDir(this.workspacePath, this.workspacePath);
    const index = new Map<string, string[]>();
    // Matches [[title|pageId]] — captures pageId
    const wikiLinkWithId = /\[\[[^\]]*?\|([^\]]+?)\]\]/g;
    // Matches [[title]] without id — captures title
    const wikiLinkTitleOnly = /\[\[([^\]|]+?)\]\]/g;

    // Build title→id map for resolving [[title]] links
    const titleToId = new Map<string, string>();
    for (const id of ids) {
      const title = this.titleFromId(id);
      // Last-write wins for duplicate titles (same behavior as wiki-link suggestion)
      titleToId.set(title, id);
    }

    for (const sourceId of ids) {
      try {
        const raw = await this.fs.readTextFile(this.filePath(sourceId));
        // Extract body (skip frontmatter)
        const bodyStart = raw.startsWith('---')
          ? raw.indexOf('---', 3)
          : -1;
        const body = bodyStart >= 0 ? raw.slice(bodyStart + 3) : raw;

        // Find [[title|targetId]] links
        let match: RegExpExecArray | null;
        while ((match = wikiLinkWithId.exec(body)) !== null) {
          const targetId = match[1];
          if (targetId === sourceId) continue; // skip self-links
          const arr = index.get(targetId);
          if (arr) {
            if (!arr.includes(sourceId)) arr.push(sourceId);
          } else {
            index.set(targetId, [sourceId]);
          }
        }

        // Find [[title]] links (without explicit id)
        while ((match = wikiLinkTitleOnly.exec(body)) !== null) {
          const title = match[1];
          const targetId = titleToId.get(title);
          if (!targetId || targetId === sourceId) continue;
          const arr = index.get(targetId);
          if (arr) {
            if (!arr.includes(sourceId)) arr.push(sourceId);
          } else {
            index.set(targetId, [sourceId]);
          }
        }
      } catch {
        // skip files that can't be read
      }
    }

    return index;
  }

  async listAll(): Promise<DocumentMeta[]> {
    const ids = await this.scanDir(this.workspacePath, this.workspacePath);
    const metas: DocumentMeta[] = [];
    const dirsSeen = new Set<string>();

    for (const id of ids) {
      try {
        const raw = await this.fs.readTextFile(this.filePath(id));
        const doc = parseFrontmatter(raw);
        doc.id = id;
        doc.title = this.titleFromId(id);

        // Derive parent from directory structure
        const idParts = id.split('/');
        doc.parent = idParts.length > 1 ? idParts.slice(0, -1).join('/') : null;

        // Track directories that need virtual folder nodes
        for (let i = 1; i < idParts.length; i++) {
          dirsSeen.add(idParts.slice(0, i).join('/'));
        }

        metas.push(doc);
      } catch {
        // skip files that can't be read
      }
    }

    // Create virtual folder nodes for directories containing .md files
    const existingIds = new Set(metas.map(m => m.id));
    for (const dir of dirsSeen) {
      if (existingIds.has(dir)) continue;
      const parts = dir.split('/');
      const folderName = parts[parts.length - 1];
      metas.push({
        id: dir,
        title: folderName,
        parent: parts.length > 1 ? parts.slice(0, -1).join('/') : null,
        tags: ['__folder'],
      });
    }

    return metas;
  }

}
