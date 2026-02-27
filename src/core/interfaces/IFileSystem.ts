export interface IFileSystem {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
  readDir(path: string): Promise<DirEntry[]>;
  exists(path: string): Promise<boolean>;
  createDir(path: string, options?: { recursive?: boolean }): Promise<void>;
  removeFile(path: string): Promise<void>;
  removeDir(path: string, options?: { recursive?: boolean }): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  stat(path: string): Promise<FileStat>;
}

export interface DirEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface FileStat {
  size: number;
  mtime: Date | null;
  birthtime: Date | null;
}
