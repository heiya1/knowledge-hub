export interface GitStatus {
  filepath: string;
  status: 'added' | 'modified' | 'deleted' | 'unmodified';
}

export interface GitLogEntry {
  oid: string;
  message: string;
  author: {
    name: string;
    email: string;
    timestamp: number;
  };
}

export interface IGitService {
  init(dir: string): Promise<void>;
  status(dir: string): Promise<GitStatus[]>;
  add(dir: string, filepath: string): Promise<void>;
  remove(dir: string, filepath: string): Promise<void>;
  commit(dir: string, message: string, author: { name: string; email: string }): Promise<string>;
  log(dir: string, options?: { depth?: number; filepath?: string }): Promise<GitLogEntry[]>;
  push(dir: string, options?: { remote?: string; branch?: string; token?: string }): Promise<void>;
  pull(dir: string, options?: { remote?: string; branch?: string; token?: string }): Promise<void>;
}
