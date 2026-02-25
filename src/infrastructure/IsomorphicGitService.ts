import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { tauriFsAdapter } from './TauriFsAdapter';
import type {
  IGitService,
  GitStatus,
  GitLogEntry,
} from '../core/interfaces/IGitService';

/**
 * IGitService implementation using isomorphic-git + TauriFsAdapter.
 *
 * isomorphic-git runs entirely in JavaScript (no native git binary required),
 * which makes it suitable for Tauri's WebView environment. The TauriFsAdapter
 * translates isomorphic-git's Node.js fs calls to Tauri plugin-fs calls.
 *
 * If this approach proves unreliable, the fallback plan is to use Rust's
 * git2 crate via Tauri commands (see CLAUDE.md risk table).
 */
export class IsomorphicGitService implements IGitService {
  private fs = tauriFsAdapter;

  async init(dir: string): Promise<void> {
    await git.init({ fs: this.fs, dir, defaultBranch: 'main' });
  }

  async status(dir: string): Promise<GitStatus[]> {
    const matrix = await git.statusMatrix({ fs: this.fs, dir });
    const statuses: GitStatus[] = [];

    for (const [filepath, head, workdir, _stage] of matrix) {
      let status: GitStatus['status'] = 'unmodified';

      // statusMatrix returns [filepath, HEAD, WORKDIR, STAGE]
      // HEAD: 0 = absent, 1 = present
      // WORKDIR: 0 = absent, 1 = identical to HEAD, 2 = different from HEAD
      if (head === 0 && workdir === 2) status = 'added';
      else if (head === 1 && workdir === 2) status = 'modified';
      else if (head === 1 && workdir === 0) status = 'deleted';
      else if (head === 1 && workdir === 1) status = 'unmodified';

      if (status !== 'unmodified') {
        statuses.push({ filepath, status });
      }
    }

    return statuses;
  }

  async add(dir: string, filepath: string): Promise<void> {
    await git.add({ fs: this.fs, dir, filepath });
  }

  async commit(
    dir: string,
    message: string,
    author: { name: string; email: string }
  ): Promise<string> {
    const oid = await git.commit({
      fs: this.fs,
      dir,
      message,
      author: {
        name: author.name,
        email: author.email,
      },
    });
    return oid;
  }

  async log(
    dir: string,
    options?: { depth?: number; filepath?: string }
  ): Promise<GitLogEntry[]> {
    const commits = await git.log({
      fs: this.fs,
      dir,
      depth: options?.depth ?? 20,
      filepath: options?.filepath,
    });

    return commits.map((c) => ({
      oid: c.oid,
      message: c.commit.message.trim(),
      author: {
        name: c.commit.author.name,
        email: c.commit.author.email,
        timestamp: c.commit.author.timestamp,
      },
    }));
  }

  async push(
    dir: string,
    options?: { remote?: string; branch?: string; token?: string }
  ): Promise<void> {
    const pushOptions: Parameters<typeof git.push>[0] = {
      fs: this.fs,
      http,
      dir,
      remote: options?.remote ?? 'origin',
      ref: options?.branch,
    };

    if (options?.token) {
      pushOptions.onAuth = () => ({
        username: options.token!,
        password: 'x-oauth-basic',
      });
    }

    await git.push(pushOptions);
  }

  async pull(
    dir: string,
    options?: { remote?: string; branch?: string; token?: string }
  ): Promise<void> {
    const pullOptions: Parameters<typeof git.pull>[0] = {
      fs: this.fs,
      http,
      dir,
      ref: options?.branch,
      remote: options?.remote ?? 'origin',
      singleBranch: true,
      author: { name: 'Knowledge Hub', email: 'app@knowledgehub.local' },
    };

    if (options?.token) {
      pullOptions.onAuth = () => ({
        username: options.token!,
        password: 'x-oauth-basic',
      });
    }

    await git.pull(pullOptions);
  }
}
