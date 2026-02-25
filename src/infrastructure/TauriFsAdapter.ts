import {
  readTextFile,
  readFile as tauriReadFile,
  writeTextFile,
  writeFile as tauriWriteFile,
  readDir,
  mkdir,
  remove,
  stat as tauriStat,
  rename,
} from '@tauri-apps/plugin-fs';

/**
 * Adapter that bridges Tauri's file system API to the `fs` interface
 * that isomorphic-git expects.
 *
 * isomorphic-git requires a module with a `promises` object containing
 * Node.js-like filesystem methods. Since Tauri runs in a WebView (not Node.js),
 * we translate each call to the equivalent @tauri-apps/plugin-fs function.
 */
class TauriFsAdapter {
  promises = {
    async readFile(
      filepath: string,
      options?: { encoding?: string } | string
    ): Promise<Uint8Array | string> {
      const encoding =
        typeof options === 'string' ? options : options?.encoding;
      if (encoding === 'utf8' || encoding === 'utf-8') {
        return readTextFile(filepath);
      }
      return tauriReadFile(filepath);
    },

    async writeFile(
      filepath: string,
      data: Uint8Array | string,
      _options?: { encoding?: string; mode?: number } | string
    ): Promise<void> {
      if (typeof data === 'string') {
        await writeTextFile(filepath, data);
      } else {
        await tauriWriteFile(filepath, data);
      }
    },

    async unlink(filepath: string): Promise<void> {
      await remove(filepath);
    },

    async readdir(filepath: string): Promise<string[]> {
      const entries = await readDir(filepath);
      return entries.map((e) => e.name).filter((n): n is string => n != null);
    },

    async mkdir(
      filepath: string,
      options?: { recursive?: boolean }
    ): Promise<void> {
      await mkdir(filepath, { recursive: options?.recursive ?? false });
    },

    async rmdir(
      filepath: string,
      options?: { recursive?: boolean }
    ): Promise<void> {
      await remove(filepath, { recursive: options?.recursive ?? false });
    },

    async stat(filepath: string): Promise<{
      isFile: () => boolean;
      isDirectory: () => boolean;
      isSymbolicLink: () => boolean;
      size: number;
      mtimeMs: number;
    }> {
      const s = await tauriStat(filepath);
      return {
        isFile: () => s.isFile,
        isDirectory: () => s.isDirectory,
        isSymbolicLink: () => s.isSymlink,
        size: s.size,
        mtimeMs: s.mtime ? new Date(s.mtime).getTime() : Date.now(),
      };
    },

    async lstat(filepath: string): Promise<{
      isFile: () => boolean;
      isDirectory: () => boolean;
      isSymbolicLink: () => boolean;
      size: number;
      mtimeMs: number;
    }> {
      // Tauri doesn't distinguish stat/lstat; alias to stat
      return this.stat(filepath);
    },

    async rename(oldPath: string, newPath: string): Promise<void> {
      await rename(oldPath, newPath);
    },

    async chmod(_filepath: string, _mode: number): Promise<void> {
      // No-op on Tauri/WebView — permissions are handled by the OS
    },

    async readlink(filepath: string): Promise<string> {
      // isomorphic-git may call this; Tauri doesn't support readlink natively.
      // Return the filepath itself as a fallback.
      return filepath;
    },

    async symlink(
      _target: string,
      _filepath: string
    ): Promise<void> {
      // No-op — symlinks not supported in Tauri WebView FS
    },
  };
}

export const tauriFsAdapter = new TauriFsAdapter();
