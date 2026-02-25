import type { IFileSystem, DirEntry } from '../core/interfaces/IFileSystem';

export class MemoryFileSystem implements IFileSystem {
  private files = new Map<string, string>();
  private dirs = new Set<string>();

  constructor() {
    this.dirs.add('/');
  }

  async readTextFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    // Ensure parent directory exists
    const parentDir = path.substring(0, path.lastIndexOf('/'));
    if (parentDir && !this.dirs.has(parentDir)) {
      throw new Error(`Parent directory does not exist: ${parentDir}`);
    }
    this.files.set(path, content);
  }

  async readDir(path: string): Promise<DirEntry[]> {
    const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    const entries: DirEntry[] = [];
    const seen = new Set<string>();

    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(normalizedPath + '/')) {
        const relative = filePath.substring(normalizedPath.length + 1);
        const name = relative.split('/')[0];
        if (!seen.has(name)) {
          seen.add(name);
          const isDir = relative.includes('/');
          entries.push({
            name,
            isDirectory: isDir,
            isFile: !isDir,
          });
        }
      }
    }

    for (const dirPath of this.dirs) {
      if (dirPath.startsWith(normalizedPath + '/')) {
        const relative = dirPath.substring(normalizedPath.length + 1);
        const name = relative.split('/')[0];
        if (!seen.has(name) && !relative.includes('/')) {
          seen.add(name);
          entries.push({ name, isDirectory: true, isFile: false });
        }
      }
    }

    return entries;
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.dirs.has(path);
  }

  async createDir(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      const parts = path.split('/').filter(Boolean);
      let current = '';
      for (const part of parts) {
        current += '/' + part;
        this.dirs.add(current);
      }
    } else {
      this.dirs.add(path);
    }
  }

  async removeFile(path: string): Promise<void> {
    this.files.delete(path);
  }

  async removeDir(path: string, _options?: { recursive?: boolean }): Promise<void> {
    this.dirs.delete(path);
    for (const key of this.files.keys()) {
      if (key.startsWith(path + '/')) {
        this.files.delete(key);
      }
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const content = this.files.get(oldPath);
    if (content !== undefined) {
      this.files.set(newPath, content);
      this.files.delete(oldPath);
    }
  }

  async copyFile(src: string, dest: string): Promise<void> {
    const content = this.files.get(src);
    if (content === undefined) throw new Error(`File not found: ${src}`);
    this.files.set(dest, content);
  }
}
