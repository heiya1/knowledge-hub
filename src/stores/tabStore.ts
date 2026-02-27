import { create } from 'zustand';

export interface Tab {
  id: string;
  title: string;
  isDirty: boolean;
}

/* ---- Recursive pane tree (each leaf has its own tabs) ---- */
export type PaneLeaf = { type: 'leaf'; id: string; tabs: Tab[]; activeTabId: string | null; editing: boolean };
export type PaneSplit = { type: 'split'; id: string; direction: 'horizontal' | 'vertical'; ratio: number; first: PaneNode; second: PaneNode };
export type PaneNode = PaneLeaf | PaneSplit;

let paneCounter = 0;
const nextPaneId = () => `pane-${++paneCounter}`;

/** Find a leaf node by id */
function findLeafNode(root: PaneNode, paneId: string): PaneLeaf | null {
  if (root.type === 'leaf') return root.id === paneId ? root : null;
  return findLeafNode(root.first, paneId) || findLeafNode(root.second, paneId);
}

/** Collect activeTabId from every leaf (for document loading) */
export function collectLeafDocIds(node: PaneNode): string[] {
  if (node.type === 'leaf') return node.activeTabId ? [node.activeTabId] : [];
  return [...collectLeafDocIds(node.first), ...collectLeafDocIds(node.second)];
}

/** Update a specific leaf in the tree */
function updateLeaf(root: PaneNode, paneId: string, updater: (leaf: PaneLeaf) => PaneNode): PaneNode {
  if (root.type === 'leaf') return root.id === paneId ? updater(root) : root;
  return {
    ...root,
    first: updateLeaf(root.first, paneId, updater),
    second: updateLeaf(root.second, paneId, updater),
  };
}

/** Update all leaves in the tree */
function updateAllLeaves(root: PaneNode, updater: (leaf: PaneLeaf) => PaneLeaf): PaneNode {
  if (root.type === 'leaf') return updater(root);
  return {
    ...root,
    first: updateAllLeaves(root.first, updater),
    second: updateAllLeaves(root.second, updater),
  };
}

/** Replace a node by id */
function replaceNode(root: PaneNode, id: string, replacement: PaneNode): PaneNode {
  if (root.id === id) return replacement;
  if (root.type === 'leaf') return root;
  return {
    ...root,
    first: replaceNode(root.first, id, replacement),
    second: replaceNode(root.second, id, replacement),
  };
}

/** Remove a pane (collapse its parent split) */
function removePane(root: PaneNode, id: string): PaneNode {
  if (root.type === 'leaf') return root;
  if (root.first.id === id) return root.second;
  if (root.second.id === id) return root.first;
  return {
    ...root,
    first: removePane(root.first, id),
    second: removePane(root.second, id),
  };
}

/** Update ratio on a split node */
function updateRatio(root: PaneNode, splitId: string, ratio: number): PaneNode {
  if (root.id === splitId && root.type === 'split') return { ...root, ratio };
  if (root.type === 'leaf') return root;
  return {
    ...root,
    first: updateRatio(root.first, splitId, ratio),
    second: updateRatio(root.second, splitId, ratio),
  };
}

/** Find first leaf id */
function firstLeafId(node: PaneNode): string {
  if (node.type === 'leaf') return node.id;
  return firstLeafId(node.first);
}

/** Pick next active tab after removing one */
function pickNextActiveTab(tabs: Tab[], removedIdx: number): string | null {
  if (tabs.length === 0) return null;
  if (removedIdx >= tabs.length) return tabs[tabs.length - 1].id;
  return tabs[removedIdx].id;
}

interface TabState {
  paneLayout: PaneNode;
  activePaneId: string;

  /** Active pane's active tab id */
  getActiveDocId: () => string | null;

  // Tab actions
  openTab: (id: string, title: string) => void;
  selectPaneTab: (paneId: string, tabId: string) => void;
  closePaneTab: (paneId: string, tabId: string) => void;
  closePaneOtherTabs: (paneId: string, tabId: string) => void;
  closePaneAllTabs: (paneId: string) => void;
  reorderPaneTabs: (paneId: string, fromIndex: number, toIndex: number) => void;
  setTabDirty: (tabId: string, dirty: boolean) => void;
  setTabTitle: (tabId: string, title: string) => void;
  replaceTabId: (oldId: string, newId: string, newTitle: string) => void;
  closeTabsMatching: (predicate: (tabId: string) => boolean) => void;
  closeAllTabs: () => void;

  // Pane actions
  splitPane: (paneId: string, direction: 'horizontal' | 'vertical') => void;
  closePane: (paneId: string) => void;
  setPaneRatio: (splitId: string, ratio: number) => void;
  setActivePaneId: (paneId: string) => void;
  setPaneEditing: (paneId: string, editing: boolean) => void;
  getPaneEditing: (paneId: string) => boolean;
  resetLayout: () => void;
  hasSplit: () => boolean;

  // Persistence
  loadTabState: (data: { paneLayout: PaneNode; activePaneId: string }) => void;
  serializeTabState: () => { paneLayout: PaneNode; activePaneId: string };
}

const ROOT_PANE_ID = 'pane-root';

export const useTabStore = create<TabState>((set, get) => ({
  paneLayout: { type: 'leaf', id: ROOT_PANE_ID, tabs: [], activeTabId: null, editing: false },
  activePaneId: ROOT_PANE_ID,

  getActiveDocId: () => {
    const { paneLayout, activePaneId } = get();
    const leaf = findLeafNode(paneLayout, activePaneId);
    return leaf?.activeTabId ?? null;
  },

  openTab: (id, title) => {
    const { activePaneId, paneLayout } = get();
    set({
      paneLayout: updateLeaf(paneLayout, activePaneId, (leaf) => {
        const existing = leaf.tabs.find(t => t.id === id);
        if (existing) {
          return { ...leaf, activeTabId: id };
        }
        return {
          ...leaf,
          tabs: [...leaf.tabs, { id, title, isDirty: false }],
          activeTabId: id,
        };
      }),
    });
  },

  selectPaneTab: (paneId, tabId) => {
    const { paneLayout } = get();
    set({
      paneLayout: updateLeaf(paneLayout, paneId, (leaf) => ({
        ...leaf,
        activeTabId: tabId,
      })),
    });
  },

  closePaneTab: (paneId, tabId) => {
    const { paneLayout } = get();
    set({
      paneLayout: updateLeaf(paneLayout, paneId, (leaf) => {
        const idx = leaf.tabs.findIndex(t => t.id === tabId);
        if (idx === -1) return leaf;
        const newTabs = leaf.tabs.filter(t => t.id !== tabId);
        let newActiveId = leaf.activeTabId;
        if (leaf.activeTabId === tabId) {
          newActiveId = pickNextActiveTab(newTabs, idx);
        }
        return { ...leaf, tabs: newTabs, activeTabId: newActiveId };
      }),
    });
  },

  closePaneOtherTabs: (paneId, tabId) => {
    const { paneLayout } = get();
    set({
      paneLayout: updateLeaf(paneLayout, paneId, (leaf) => ({
        ...leaf,
        tabs: leaf.tabs.filter(t => t.id === tabId),
        activeTabId: tabId,
      })),
    });
  },

  closePaneAllTabs: (paneId) => {
    const { paneLayout } = get();
    set({
      paneLayout: updateLeaf(paneLayout, paneId, (leaf) => ({
        ...leaf,
        tabs: [],
        activeTabId: null,
      })),
    });
  },

  reorderPaneTabs: (paneId, fromIndex, toIndex) => {
    const { paneLayout } = get();
    set({
      paneLayout: updateLeaf(paneLayout, paneId, (leaf) => {
        const newTabs = [...leaf.tabs];
        const [moved] = newTabs.splice(fromIndex, 1);
        newTabs.splice(toIndex, 0, moved);
        return { ...leaf, tabs: newTabs };
      }),
    });
  },

  setTabDirty: (tabId, dirty) => {
    const { paneLayout } = get();
    set({
      paneLayout: updateAllLeaves(paneLayout, (leaf) => ({
        ...leaf,
        tabs: leaf.tabs.map(t => t.id === tabId ? { ...t, isDirty: dirty } : t),
      })),
    });
  },

  setTabTitle: (tabId, title) => {
    const { paneLayout } = get();
    set({
      paneLayout: updateAllLeaves(paneLayout, (leaf) => ({
        ...leaf,
        tabs: leaf.tabs.map(t => t.id === tabId ? { ...t, title } : t),
      })),
    });
  },

  replaceTabId: (oldId, newId, newTitle) => {
    const { paneLayout } = get();
    set({
      paneLayout: updateAllLeaves(paneLayout, (leaf) => ({
        ...leaf,
        tabs: leaf.tabs.map(t => t.id === oldId ? { ...t, id: newId, title: newTitle } : t),
        activeTabId: leaf.activeTabId === oldId ? newId : leaf.activeTabId,
      })),
    });
  },

  closeTabsMatching: (predicate) => {
    const { paneLayout } = get();
    set({
      paneLayout: updateAllLeaves(paneLayout, (leaf) => {
        const newTabs = leaf.tabs.filter(t => !predicate(t.id));
        let newActiveId = leaf.activeTabId;
        if (leaf.activeTabId && predicate(leaf.activeTabId)) {
          const idx = leaf.tabs.findIndex(t => t.id === leaf.activeTabId);
          newActiveId = pickNextActiveTab(newTabs, idx);
        }
        return { ...leaf, tabs: newTabs, activeTabId: newActiveId };
      }),
    });
  },

  closeAllTabs: () => set({
    paneLayout: { type: 'leaf', id: ROOT_PANE_ID, tabs: [], activeTabId: null, editing: false },
    activePaneId: ROOT_PANE_ID,
  }),

  splitPane: (paneId, direction) => {
    const { paneLayout } = get();
    const leaf = findLeafNode(paneLayout, paneId);
    if (!leaf) return;

    const newFirstId = nextPaneId();
    const newSecondId = nextPaneId();

    const newSplit: PaneNode = {
      type: 'split',
      id: nextPaneId(),
      direction,
      ratio: 0.5,
      first: { type: 'leaf', id: newFirstId, tabs: [...leaf.tabs], activeTabId: leaf.activeTabId, editing: leaf.editing },
      second: { type: 'leaf', id: newSecondId, tabs: [], activeTabId: null, editing: false },
    };
    set({
      paneLayout: replaceNode(paneLayout, paneId, newSplit),
      activePaneId: newSecondId,
    });
  },

  closePane: (paneId) => {
    const { paneLayout } = get();
    if (paneLayout.type === 'leaf') return;
    const newLayout = removePane(paneLayout, paneId);
    const newActivePaneId = firstLeafId(newLayout);
    set({ paneLayout: newLayout, activePaneId: newActivePaneId });
  },

  setPaneRatio: (splitId, ratio) => {
    const { paneLayout } = get();
    set({ paneLayout: updateRatio(paneLayout, splitId, ratio) });
  },

  setActivePaneId: (paneId) => set({ activePaneId: paneId }),

  setPaneEditing: (paneId, editing) => {
    const { paneLayout } = get();
    set({
      paneLayout: updateLeaf(paneLayout, paneId, (leaf) => ({ ...leaf, editing })),
    });
  },

  getPaneEditing: (paneId) => {
    const { paneLayout } = get();
    const leaf = findLeafNode(paneLayout, paneId);
    return leaf?.editing ?? false;
  },

  resetLayout: () => {
    const { paneLayout, activePaneId } = get();
    const activeLeaf = findLeafNode(paneLayout, activePaneId);
    set({
      paneLayout: {
        type: 'leaf',
        id: ROOT_PANE_ID,
        tabs: activeLeaf ? [...activeLeaf.tabs] : [],
        activeTabId: activeLeaf?.activeTabId ?? null,
        editing: activeLeaf?.editing ?? false,
      },
      activePaneId: ROOT_PANE_ID,
    });
  },

  hasSplit: () => get().paneLayout.type === 'split',

  loadTabState: (data) => {
    // Clean up: clear dirty flags and editing state on load (stale from previous session)
    const cleanLayout = (node: PaneNode): PaneNode => {
      if (node.type === 'leaf') {
        return {
          ...node,
          editing: false,
          tabs: node.tabs.map(t => ({ ...t, isDirty: false })),
        };
      }
      return { ...node, first: cleanLayout(node.first), second: cleanLayout(node.second) };
    };
    set({
      paneLayout: cleanLayout(data.paneLayout),
      activePaneId: data.activePaneId,
    });
  },

  serializeTabState: () => {
    const { paneLayout, activePaneId } = get();
    return { paneLayout, activePaneId };
  },
}));
