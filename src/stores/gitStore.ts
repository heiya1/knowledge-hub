import { create } from 'zustand';
import type { GitStatus, GitLogEntry } from '../core/interfaces/IGitService';

interface GitState {
  statuses: GitStatus[];
  log: GitLogEntry[];
  isSyncing: boolean;
  lastSyncAt: string | null;
  commitMessage: string;
  error: string | null;
  remoteChangePageId: string | null;
  remoteChangeAuthor: string | null;
  setStatuses: (statuses: GitStatus[]) => void;
  setLog: (log: GitLogEntry[]) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncAt: (time: string | null) => void;
  setCommitMessage: (message: string) => void;
  setError: (error: string | null) => void;
  setRemoteChange: (pageId: string | null, author: string | null) => void;
  clearRemoteChange: () => void;
}

export const useGitStore = create<GitState>((set) => ({
  statuses: [],
  log: [],
  isSyncing: false,
  lastSyncAt: null,
  commitMessage: '',
  error: null,
  remoteChangePageId: null,
  remoteChangeAuthor: null,
  setStatuses: (statuses) => set({ statuses }),
  setLog: (log) => set({ log }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
  setCommitMessage: (commitMessage) => set({ commitMessage }),
  setError: (error) => set({ error }),
  setRemoteChange: (pageId, author) => set({ remoteChangePageId: pageId, remoteChangeAuthor: author }),
  clearRemoteChange: () => set({ remoteChangePageId: null, remoteChangeAuthor: null }),
}));
