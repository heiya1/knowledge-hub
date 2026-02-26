import { homeDir } from '@tauri-apps/api/path';
import type { IFileSystem } from '../core/interfaces/IFileSystem';

export interface GitUserInfo {
  name: string;
  email: string;
}

/** Detect provider from token prefix and fetch user profile */
export async function fetchGitUserFromToken(token: string): Promise<GitUserInfo | null> {
  try {
    if (token.startsWith('glpat-')) {
      // GitLab
      const res = await fetch('https://gitlab.com/api/v4/user', {
        headers: { 'PRIVATE-TOKEN': token },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        name: data.name || data.username || '',
        email: data.email || `${data.username}@users.noreply.gitlab.com`,
      };
    } else {
      // GitHub (ghp_, github_pat_, etc.)
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        name: data.name || data.login || '',
        email: data.email || `${data.login}@users.noreply.github.com`,
      };
    }
  } catch {
    return null;
  }
}

export interface GitRepo {
  name: string;
  fullName: string;
  cloneUrl: string;
  description: string;
  isPrivate: boolean;
}

/** Fetch repository list from GitHub or GitLab */
export async function fetchRepoList(token: string): Promise<GitRepo[]> {
  try {
    if (token.startsWith('glpat-')) {
      const res = await fetch(
        'https://gitlab.com/api/v4/projects?membership=true&per_page=50&order_by=last_activity_at',
        { headers: { 'PRIVATE-TOKEN': token } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((p: Record<string, unknown>) => ({
        name: p.name as string,
        fullName: p.path_with_namespace as string,
        cloneUrl: p.http_url_to_repo as string,
        description: (p.description as string) || '',
        isPrivate: p.visibility !== 'public',
      }));
    } else {
      const res = await fetch(
        'https://api.github.com/user/repos?per_page=50&sort=updated&affiliation=owner,collaborator,organization_member',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((r: Record<string, unknown>) => ({
        name: r.name as string,
        fullName: r.full_name as string,
        cloneUrl: r.clone_url as string,
        description: (r.description as string) || '',
        isPrivate: r.private as boolean,
      }));
    }
  } catch {
    return [];
  }
}

/** Read user.name / user.email from ~/.gitconfig */
export async function readSystemGitConfig(fsImpl: IFileSystem): Promise<GitUserInfo | null> {
  try {
    const home = await homeDir();
    const configPath = `${home}.gitconfig`;
    if (!await fsImpl.exists(configPath)) return null;

    const content = await fsImpl.readTextFile(configPath);

    let inUserSection = false;
    let name = '';
    let email = '';

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed === '[user]') {
        inUserSection = true;
        continue;
      }
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        inUserSection = false;
        continue;
      }
      if (inUserSection) {
        const match = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
        if (match) {
          if (match[1] === 'name') name = match[2].trim();
          if (match[1] === 'email') email = match[2].trim();
        }
      }
    }

    if (name || email) return { name, email };
    return null;
  } catch {
    return null;
  }
}
