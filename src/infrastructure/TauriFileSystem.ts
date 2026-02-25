import { readTextFile, writeTextFile, readDir, exists, mkdir, remove, rename, copyFile } from '@tauri-apps/plugin-fs';
import { appDataDir } from '@tauri-apps/api/path';
import type { IFileSystem, DirEntry } from '../core/interfaces/IFileSystem';

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

  async copyFile(src: string, dest: string): Promise<void> {
    await copyFile(src, dest);
  }
}

export async function getAppDataPath(): Promise<string> {
  return appDataDir();
}
