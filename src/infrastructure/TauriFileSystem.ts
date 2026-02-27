import { readTextFile, writeTextFile, readDir, exists, mkdir, remove, rename, stat } from '@tauri-apps/plugin-fs';
import { appDataDir } from '@tauri-apps/api/path';
import type { IFileSystem, DirEntry, FileStat } from '../core/interfaces/IFileSystem';

export class TauriFileSystem implements IFileSystem {
  async readTextFile(path: string): Promise<string> {
    return readTextFile(path);
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await writeTextFile(path, content);
  }

  async readDir(path: string): Promise<DirEntry[]> {
    const entries = await readDir(path);
    return entries.map(e => ({
      name: e.name ?? '',
      isDirectory: e.isDirectory,
      isFile: e.isFile,
    }));
  }

  async exists(path: string): Promise<boolean> {
    return exists(path);
  }

  async createDir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await mkdir(path, { recursive: options?.recursive ?? false });
  }

  async removeFile(path: string): Promise<void> {
    await remove(path);
  }

  async removeDir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await remove(path, { recursive: options?.recursive ?? false });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await rename(oldPath, newPath);
  }

  async stat(path: string): Promise<FileStat> {
    const info = await stat(path);
    return {
      size: info.size,
      mtime: info.mtime,
      birthtime: info.birthtime,
    };
  }
}

export async function getAppDataPath(): Promise<string> {
  const dir = await appDataDir();
  return dir.endsWith('/') ? dir : `${dir}/`;
}
