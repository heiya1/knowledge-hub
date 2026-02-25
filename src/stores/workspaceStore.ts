import { create } from 'zustand';

export interface Workspace {
  id: string;
  name: string;
  path: string;
  remoteUrl?: string;
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  loading: boolean;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Omit<Workspace, 'id'>>) => void;
  getActiveWorkspace: () => Workspace | undefined;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  loading: true,
  setWorkspaces: (workspaces) => set({ workspaces, loading: false }),
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  addWorkspace: (workspace) => set((state) => ({
    workspaces: [...state.workspaces, workspace],
  })),
  updateWorkspace: (id, updates) => set((state) => ({
    workspaces: state.workspaces.map((w) =>
      w.id === id ? { ...w, ...updates } : w
    ),
  })),
  getActiveWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find((w) => w.id === activeWorkspaceId);
  },
}));
