import type { IFileSystem } from '../interfaces/IFileSystem';
import type { Document, DocumentMeta } from '../models/Document';
import { parseFrontmatter, stringifyFrontmatter } from '../utils/frontmatter';
import { generateId } from '../utils/id';

export class DocumentService {
  constructor(private fs: IFileSystem, private workspacePath: string) {}

  private pagesDir(): string {
    return `${this.workspacePath}/pages`;
  }

  private filePath(id: string): string {
    return `${this.pagesDir()}/${id}.md`;
  }

  async create(options: { title: string; parent?: string | null; order?: number }): Promise<Document> {
    const now = new Date().toISOString();
    const id = generateId();
    const doc: Document = {
      id,
      title: options.title,
      parent: options.parent ?? null,
      order: options.order ?? 0,
      tags: [],
      createdAt: now,
      updatedAt: now,
      body: '',
    };
    await this.fs.writeTextFile(this.filePath(id), stringifyFrontmatter(doc));
    return doc;
  }

  async get(id: string): Promise<Document> {
    const raw = await this.fs.readTextFile(this.filePath(id));
    const doc = parseFrontmatter(raw);
    doc.id = id;
    return doc;
  }

  async update(doc: Document): Promise<void> {
    doc.updatedAt = new Date().toISOString();
    await this.fs.writeTextFile(this.filePath(doc.id), stringifyFrontmatter(doc));
  }

  async delete(id: string): Promise<void> {
    const trashDir = `${this.workspacePath}/.trash`;
    const exists = await this.fs.exists(trashDir);
    if (!exists) {
      await this.fs.createDir(trashDir, { recursive: true });
    }
    await this.fs.rename(this.filePath(id), `${trashDir}/${id}.md`);
  }

  async listAll(): Promise<DocumentMeta[]> {
    const dir = this.pagesDir();
    const dirExists = await this.fs.exists(dir);
    if (!dirExists) return [];
    const entries = await this.fs.readDir(dir);
    const metas: DocumentMeta[] = [];
    for (const entry of entries) {
      if (entry.isFile && entry.name.endsWith('.md')) {
        const id = entry.name.replace('.md', '');
        try {
          const raw = await this.fs.readTextFile(`${dir}/${entry.name}`);
          const doc = parseFrontmatter(raw);
          doc.id = id;
          metas.push(doc);
        } catch {
          // skip invalid files
        }
      }
    }
    return metas;
  }
}
