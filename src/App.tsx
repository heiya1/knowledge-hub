import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigationStore } from "./stores/navigationStore";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { useDocumentStore } from "./stores/documentStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useGitStore } from "./stores/gitStore";
import { useTabStore, collectLeafDocIds } from "./stores/tabStore";
import { useEditorStore } from "./stores/editorStore";
import { useFavoritesStore } from "./stores/favoritesStore";
import { WelcomeScreen } from "./components/workspace/WelcomeScreen";
import { AppShell } from "./components/layout/AppShell";
import { SearchModal } from "./components/search/SearchModal";
import { SettingsView } from "./components/settings/SettingsView";
import { ConfirmDialog } from "./components/common/ConfirmDialog";
import { RenameDialog } from "./components/common/RenameDialog";
import { CreateItemDialog } from "./components/common/CreateItemDialog";
import { TemplateDialog } from "./components/common/TemplateDialog";
import { TrashPanel } from "./components/sidebar/TrashPanel";
import { ImageCleanupView } from "./components/imageCleanup/ImageCleanupView";
import { ToastContainer, showToast } from "./components/common/Toast";
import { LoadingSpinner } from "./components/common/LoadingSpinner";
import { TitleBar } from "./components/layout/TitleBar";
import { HelpPage } from "./components/help/HelpPage";
import { TauriFileSystem, getAppDataPath } from "./infrastructure/TauriFileSystem";
import { fetchGitUserFromToken, readSystemGitConfig } from "./infrastructure/GitProviderApi";
import { initContainer, getContainer, updateWorkspacePath } from "./infrastructure/container";
import { generateId } from "./core/utils/id";
import type { Document, DocumentMeta } from "./core/models/Document";
import type { SearchResult } from "./core/services/SearchService";
import type { PageTemplate } from "./core/templates";

const fs = new TauriFileSystem();

/** Number of days before trash items are auto-deleted */
const TRASH_AUTO_DELETE_DAYS = 30;

/** Convert a name into a URL-safe slug */
function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Persist workspace list and active workspace to workspaces.json */
async function persistWorkspaces(
  appDataPath: string,
  workspaces: { id: string; name: string; path: string; remoteUrl?: string }[],
  activeWorkspaceId: string,
): Promise<void> {
  await fs.writeTextFile(
    `${appDataPath}workspaces.json`,
    JSON.stringify({ workspaces, activeWorkspaceId })
  );
}

function App() {
  const { t, i18n } = useTranslation();
  const { screen, setScreen } = useNavigationStore();
  const [trashOpen, setTrashOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [deleteWsDialog, setDeleteWsDialog] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: string;
    title: string;
    childCount: number;
  }>({ isOpen: false, id: "", title: "", childCount: 0 });

  // Rename dialog state
  const [renameDialog, setRenameDialog] = useState<{
    isOpen: boolean;
    id: string;
    currentTitle: string;
  }>({ isOpen: false, id: "", currentTitle: "" });
  const {
    workspaces,
    activeWorkspaceId,
    loading,
    setWorkspaces,
    setActiveWorkspace,
    addWorkspace,
    removeWorkspace,
    getActiveWorkspace,
  } = useWorkspaceStore();
  const {
    documents,
    tree,
    currentDocumentId,
    currentDocument,
    setDocuments,
    setTree,
    setCurrentDocumentId,
    setCurrentDocument,
    setBacklinkIndex,
  } = useDocumentStore();
  const { gitAuthorName, gitAuthorEmail, gitToken, autoSync, syncInterval } = useSettingsStore();
  const { setStatuses, setLog, setSyncing } = useGitStore();

  const refreshGitStatus = useCallback(async () => {
    try {
      const container = getContainer();
      const statuses = await container.gitService.status(container.workspacePath);
      setStatuses(statuses);
    } catch {
      // Git may not be initialized yet
    }
  }, [setStatuses]);

  const refreshGitLog = useCallback(async () => {
    try {
      const container = getContainer();
      const entries = await container.gitService.log(container.workspacePath);
      setLog(entries);
    } catch {
      // No commits yet
    }
  }, [setLog]);

  // Load workspaces and settings on startup
  useEffect(() => {
    (async () => {
      try {
        const appDataPath = await getAppDataPath();

        // Load settings
        const settingsFile = `${appDataPath}settings.json`;
        if (await fs.exists(settingsFile)) {
          try {
            const raw = await fs.readTextFile(settingsFile);
            const settings = JSON.parse(raw);
            useSettingsStore.getState().loadSettings(settings);
          } catch {
            // Ignore invalid settings file
          }
        }

        // If git author is not set, try to read from ~/.gitconfig
        const { gitAuthorName: savedName } = useSettingsStore.getState();
        if (!savedName) {
          const sysUser = await readSystemGitConfig();
          if (sysUser) {
            useSettingsStore.getState().setGitAuthor(sysUser.name, sysUser.email);
          }
        }

        // Load favorites
        const favoritesFile = `${appDataPath}favorites.json`;
        if (await fs.exists(favoritesFile)) {
          try {
            const raw = await fs.readTextFile(favoritesFile);
            useFavoritesStore.getState().loadFromStorage(JSON.parse(raw));
          } catch {
            // Ignore invalid favorites file
          }
        }

        // Load workspaces
        const workspacesFile = `${appDataPath}workspaces.json`;
        if (await fs.exists(workspacesFile)) {
          const raw = await fs.readTextFile(workspacesFile);
          const data = JSON.parse(raw);
          setWorkspaces(data.workspaces || []);
          if (data.activeWorkspaceId) {
            setActiveWorkspace(data.activeWorkspaceId);
            setScreen("editor");

            // Restore tab state for this workspace
            const tabsFile = `${appDataPath}tabs-${data.activeWorkspaceId}.json`;
            if (await fs.exists(tabsFile)) {
              try {
                const tabsRaw = await fs.readTextFile(tabsFile);
                const tabsData = JSON.parse(tabsRaw);
                if (tabsData.paneLayout) {
                  useTabStore.getState().loadTabState(tabsData);
                  // Set the active doc to the restored active tab
                  const activeDocId = useTabStore.getState().getActiveDocId();
                  if (activeDocId) {
                    setCurrentDocumentId(activeDocId);
                  }
                }
              } catch {
                // Ignore invalid tabs file
              }
            }
          }
        } else {
          setWorkspaces([]);
        }
      } catch {
        setWorkspaces([]);
      }
    })();
  }, []);

  // Apply theme and language from settings (on load and when they change)
  const theme = useSettingsStore((s) => s.theme);
  const language = useSettingsStore((s) => s.language);
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    if (theme !== 'auto') {
      document.documentElement.classList.add(theme);
    }
  }, [theme]);
  useEffect(() => {
    if (language !== 'auto') {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  // Persist settings when they change
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe(async (state) => {
      try {
        const appDataPath = await getAppDataPath();
        const data = {
          theme: state.theme,
          language: state.language,
          gitAuthorName: state.gitAuthorName,
          gitAuthorEmail: state.gitAuthorEmail,
          autoSave: state.autoSave,
          fontSize: state.fontSize,
          gitToken: state.gitToken,
          autoSync: state.autoSync,
          syncInterval: state.syncInterval,
        };
        await fs.writeTextFile(`${appDataPath}settings.json`, JSON.stringify(data, null, 2));
      } catch {
        // Silently ignore persistence errors
      }
    });
    return unsubscribe;
  }, []);

  // Persist tab state when it changes (debounced)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useTabStore.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const wsId = useWorkspaceStore.getState().activeWorkspaceId;
          if (!wsId) return;
          const appDataPath = await getAppDataPath();
          const data = useTabStore.getState().serializeTabState();
          await fs.writeTextFile(`${appDataPath}tabs-${wsId}.json`, JSON.stringify(data));
        } catch {
          // Silently ignore persistence errors
        }
      }, 500);
    });
    return () => { unsubscribe(); if (timer) clearTimeout(timer); };
  }, []);

  // Persist favorites when they change
  useEffect(() => {
    const unsubscribe = useFavoritesStore.subscribe(async (state) => {
      try {
        const appDataPath = await getAppDataPath();
        await fs.writeTextFile(`${appDataPath}favorites.json`, JSON.stringify({
          favorites: state.favorites,
          recentPages: state.recentPages,
        }));
      } catch {
        // Silently ignore persistence errors
      }
    });
    return unsubscribe;
  }, []);

  // Load documents when workspace changes
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const ws = getActiveWorkspace();
    if (!ws) return;

    (async () => {
      try {
        updateWorkspacePath(fs, ws.path);
        const container = getContainer();
        const docs = await container.documentService.listAll();
        setDocuments(docs);
        const builtTree = container.treeService.buildTree(docs);
        setTree(builtTree);
        container.searchService.rebuild(docs);
        // Build backlink index
        container.documentService.buildBacklinkIndex().then(setBacklinkIndex).catch(() => {});
        // Load git status
        await refreshGitStatus();
        await refreshGitLog();

        // Auto-cleanup: delete trash items older than 30 days
        await cleanupOldTrashItems(ws.path);
      } catch (e) {
        showToast("error", t('toast.loadDocsFailed', { error: String(e) }));
      }
    })();
  }, [activeWorkspaceId]);

  // 30-day auto-cleanup of .trash/ directory
  const cleanupOldTrashItems = useCallback(async (workspacePath: string) => {
    try {
      const trashDir = `${workspacePath}/.trash`;
      const trashExists = await fs.exists(trashDir);
      if (!trashExists) return;

      const entries = await fs.readDir(trashDir);
      const now = Date.now();
      const maxAge = TRASH_AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000;

      for (const entry of entries) {
        if (!entry.isFile || !entry.name.endsWith('.md')) continue;

        try {
          const filePath = `${trashDir}/${entry.name}`;
          const stat = await fs.stat(filePath);
          const deletedAt = stat.mtime?.getTime() ?? now;
          if (now - deletedAt > maxAge) {
            await fs.removeFile(filePath);
          }
        } catch {
          // Skip files that can't be read; don't delete them to be safe
        }
      }
    } catch {
      // Silently ignore cleanup errors
    }
  }, []);

  // Load current document (with cancellation for rapid switching)
  useEffect(() => {
    if (!currentDocumentId || !activeWorkspaceId) {
      setCurrentDocument(null);
      return;
    }
    let cancelled = false;
    const docId = currentDocumentId;
    (async () => {
      try {
        const container = getContainer();
        const doc = await container.documentService.get(docId);
        if (!cancelled) {
          setCurrentDocument(doc);
          setDocumentMap(prev => ({ ...prev, [docId]: doc }));
        }
      } catch (e) {
        if (!cancelled) {
          showToast("error", t('toast.loadDocFailed', { error: String(e) }));
          setCurrentDocument(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [currentDocumentId]);

  // Document map for all visible pane leaves
  const paneLayout = useTabStore(state => state.paneLayout);
  const [documentMap, setDocumentMap] = useState<Record<string, Document>>({});

  // Dev mode: expose setDocumentMap for browser testing
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__setDocumentMap = setDocumentMap;
    }
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const docIds = collectLeafDocIds(paneLayout);
    const uniqueIds = [...new Set(docIds)];
    if (uniqueIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const container = getContainer();
      const loaded: Record<string, Document> = {};
      for (const id of uniqueIds) {
        try {
          loaded[id] = await container.documentService.get(id);
        } catch { /* skip */ }
      }
      if (!cancelled) {
        setDocumentMap(prev => ({ ...prev, ...loaded }));
      }
    })();
    return () => { cancelled = true; };
  }, [paneLayout, activeWorkspaceId]);

  const handleCreateWorkspace = useCallback(
    async (repoName: string, displayName: string, token?: string) => {
      try {
        const appDataPath = await getAppDataPath();
        const wsPath = `${appDataPath}workspaces/${toSlug(repoName)}`;

        // Check for duplicate workspace path
        if (workspaces.some(w => w.path === wsPath)) {
          showToast("error", t('toast.workspaceAlreadyExists', { name: displayName }));
          return;
        }

        // Create workspace directory
        await fs.createDir(`${wsPath}/assets/images`, { recursive: true });
        await fs.createDir(`${wsPath}/assets/diagrams`, { recursive: true });

        // Create .gitignore
        await fs.writeTextFile(
          `${wsPath}/.gitignore`,
          ".trash/\n*.db\n*.db-journal\n*.db-wal\n*.db-shm\n.DS_Store\nThumbs.db\n"
        );

        // Initialize container, git init, and create welcome page
        initContainer(fs, wsPath);
        const container = getContainer();
        await container.gitService.init(wsPath);
        await container.documentService.create({ title: "Getting Started" });

        // Stage all files and create initial commit
        const initAuthor = {
          name: gitAuthorName || 'Knowledge Hub User',
          email: gitAuthorEmail || 'user@knowledgehub.local',
        };
        const initStatuses = await container.gitService.status(wsPath);
        for (const s of initStatuses) {
          await container.gitService.add(wsPath, s.filepath);
        }
        await container.gitService.commit(wsPath, 'Initial commit', initAuthor);

        // Save current workspace's tab state BEFORE clearing
        const currentWsId = useWorkspaceStore.getState().activeWorkspaceId;
        if (currentWsId) {
          const tabData = useTabStore.getState().serializeTabState();
          await fs.writeTextFile(`${appDataPath}tabs-${currentWsId}.json`, JSON.stringify(tabData));
        }

        // Clear previous workspace state before switching
        useTabStore.getState().closeAllTabs();
        setCurrentDocumentId(null);
        setCurrentDocument(null);
        setDocumentMap({});
        setDocuments([]);
        setTree([]);

        // Save workspace info
        const wsId = generateId();
        const workspace = { id: wsId, name: displayName, path: wsPath };
        addWorkspace(workspace);
        setActiveWorkspace(wsId);
        await persistWorkspaces(appDataPath, [...workspaces, workspace], wsId);

        // Save token and fetch git author from provider API
        if (token) {
          useSettingsStore.getState().setGitToken(token);
          const userInfo = await fetchGitUserFromToken(token);
          if (userInfo) {
            useSettingsStore.getState().setGitAuthor(userInfo.name, userInfo.email);
          }
        }

        setScreen("editor");
        showToast("success", t('toast.workspaceCreated', { name: displayName }));
      } catch (e) {
        showToast("error", t('toast.workspaceCreateFailed', { error: String(e) }));
      }
    },
    [workspaces, gitAuthorName, gitAuthorEmail]
  );

  const handleDeleteWorkspace = useCallback(
    async (wsId: string) => {
      try {
        const ws = workspaces.find(w => w.id === wsId);
        if (!ws) return;

        // Delete workspace directory
        await fs.removeDir(ws.path, { recursive: true });

        // Remove from store
        removeWorkspace(wsId);

        // Clear current workspace state
        useTabStore.getState().closeAllTabs();
        setCurrentDocumentId(null);
        setCurrentDocument(null);
        setDocumentMap({});
        setDocuments([]);
        setTree([]);

        // Persist
        const appDataPath = await getAppDataPath();
        const remaining = workspaces.filter(w => w.id !== wsId);
        if (remaining.length > 0) {
          const nextId = remaining[0].id;
          setActiveWorkspace(nextId);
          await persistWorkspaces(appDataPath, remaining, nextId);
        } else {
          await persistWorkspaces(appDataPath, [], '');
          setScreen('welcome');
        }

        showToast("success", t('toast.workspaceDeleted', { name: ws.name }));
      } catch (e) {
        showToast("error", t('toast.workspaceDeleteFailed', { error: String(e) }));
      }
    },
    [workspaces, removeWorkspace, setActiveWorkspace, setScreen]
  );

  const handleCloneRepo = useCallback(
    async (url: string, name: string, token?: string) => {
      try {
        const appDataPath = await getAppDataPath();
        const wsPath = `${appDataPath}workspaces/${toSlug(name)}`;

        // Check for duplicate workspace path
        if (workspaces.some(w => w.path === wsPath)) {
          showToast("error", t('toast.workspaceAlreadyExists', { name }));
          return;
        }

        // Save token first so clone can use it for private repos
        if (token) {
          useSettingsStore.getState().setGitToken(token);
        }

        // Create workspace directory
        await fs.createDir(wsPath, { recursive: true });

        // Initialize container and clone
        initContainer(fs, wsPath);
        const container = getContainer();
        await container.gitService.clone(wsPath, url, token ? { token } : undefined);

        // Ensure assets directories exist
        if (!await fs.exists(`${wsPath}/assets`)) {
          await fs.createDir(`${wsPath}/assets/images`, { recursive: true });
          await fs.createDir(`${wsPath}/assets/diagrams`, { recursive: true });
        }

        // Save current workspace's tab state BEFORE clearing
        const currentWsId = useWorkspaceStore.getState().activeWorkspaceId;
        if (currentWsId) {
          const tabData = useTabStore.getState().serializeTabState();
          await fs.writeTextFile(`${appDataPath}tabs-${currentWsId}.json`, JSON.stringify(tabData));
        }

        // Clear previous workspace state before switching
        useTabStore.getState().closeAllTabs();
        setCurrentDocumentId(null);
        setCurrentDocument(null);
        setDocumentMap({});
        setDocuments([]);
        setTree([]);

        // Save workspace info with remote URL
        const wsId = generateId();
        const workspace = { id: wsId, name, path: wsPath, remoteUrl: url };
        addWorkspace(workspace);
        setActiveWorkspace(wsId);
        await persistWorkspaces(appDataPath, [...workspaces, workspace], wsId);

        // Fetch git author from provider API using token
        if (token) {
          const userInfo = await fetchGitUserFromToken(token);
          if (userInfo) {
            useSettingsStore.getState().setGitAuthor(userInfo.name, userInfo.email);
          }
        }

        setScreen("editor");
        showToast("success", t('toast.cloneSuccess', { name }));
      } catch (e) {
        showToast("error", t('toast.cloneFailed', { error: String(e) }));
      }
    },
    [workspaces]
  );

  const docById = useMemo(() => new Map(documents.map(d => [d.id, d])), [documents]);

  const handleSelectPage = useCallback((id: string) => {
    // Find title from documents list
    const doc = docById.get(id);
    const title = doc?.title || id.split('/').pop() || '';
    useTabStore.getState().openTab(id, title);
    setCurrentDocumentId(id);
    useFavoritesStore.getState().addRecentPage(id, title);
  }, [docById]);

  // Refresh documents, tree, and search index (shared helper)
  const refreshDocuments = useCallback(async () => {
    const container = getContainer();
    const docs = await container.documentService.listAll();
    setDocuments(docs);
    setTree(container.treeService.buildTree(docs));
    container.searchService.rebuild(docs);
    container.documentService.buildBacklinkIndex().then(setBacklinkIndex).catch(() => {});
  }, [setDocuments, setTree, setBacklinkIndex]);

  // --- Favorites ---
  const { favorites, recentPages } = useFavoritesStore();
  const handleToggleFavorite = useCallback((id: string) => {
    useFavoritesStore.getState().toggleFavorite(id);
  }, []);

  // --- Template dialog state ---
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // --- Create page/folder dialog state ---
  const [createDialog, setCreateDialog] = useState<{
    isOpen: boolean;
    mode: 'page' | 'folder';
  }>({ isOpen: false, mode: 'page' });

  const handleNewPage = useCallback(() => {
    setTemplateDialogOpen(true);
  }, []);

  const handleNewFolder = useCallback(() => {
    setCreateDialog({ isOpen: true, mode: 'folder' });
  }, []);

  const handleTemplateSelect = useCallback(async (template: PageTemplate) => {
    setTemplateDialogOpen(false);
    try {
      const container = getContainer();
      const doc = await container.documentService.create({
        title: '',
      });
      if (template.content) {
        doc.body = template.content;
        await container.documentService.update(doc);
      }
      await refreshDocuments();
      useTabStore.getState().openTab(doc.id, doc.title || t('editor.untitled'));
      setCurrentDocumentId(doc.id);
      refreshGitStatus();
    } catch (e) {
      showToast("error", t('toast.createFailed', { mode: 'page', error: String(e) }));
    }
  }, [refreshDocuments, refreshGitStatus, t]);

  const handleCreateItemConfirm = useCallback(async (name: string, parentFolder: string | null) => {
    const mode = createDialog.mode;
    setCreateDialog({ isOpen: false, mode: 'page' });

    try {
      const container = getContainer();
      if (mode === 'page') {
        const doc = await container.documentService.create({
          title: name,
          parentFolder,
        });
        await refreshDocuments();
        useTabStore.getState().openTab(doc.id, name);
        setCurrentDocumentId(doc.id);
      } else {
        // Create folder
        const folderPath = parentFolder
          ? `${container.workspacePath}/${parentFolder}/${name}`
          : `${container.workspacePath}/${name}`;
        await fs.createDir(folderPath, { recursive: true });
        await refreshDocuments();
      }
      refreshGitStatus();
    } catch (e) {
      showToast("error", t('toast.createFailed', { mode, error: String(e) }));
    }
  }, [createDialog.mode, refreshDocuments, refreshGitStatus]);

  const handleCreateItemCancel = useCallback(() => {
    setCreateDialog({ isOpen: false, mode: 'page' });
  }, []);

  // --- Delete page (show confirmation dialog) ---
  const handleDeleteRequest = useCallback((id: string, title: string, childCount: number) => {
    setDeleteDialog({ isOpen: true, id, title, childCount });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    const { id, childCount } = deleteDialog;
    setDeleteDialog({ isOpen: false, id: "", title: "", childCount: 0 });

    try {
      const container = getContainer();
      const isFolder = documents.find(d => d.id === id)?.tags?.includes('__folder');

      if (isFolder) {
        // For folders: use deleteFolder which moves all files to trash then removes dir
        await container.documentService.deleteFolder(id);
      } else {
        // If this page has children, collect all descendant IDs and delete them too
        if (childCount > 0) {
          const node = container.treeService.findNode(tree, id);
          if (node) {
            const collectIds = (n: typeof node): string[] => {
              const ids: string[] = [];
              for (const child of n.children) {
                ids.push(child.meta.id);
                ids.push(...collectIds(child));
              }
              return ids;
            };
            const childIds = collectIds(node);
            for (const childId of childIds) {
              await container.documentService.delete(childId);
            }
          }
        }

        // Delete the page itself
        await container.documentService.delete(id);
      }

      // Close tabs for deleted pages across all panes
      useTabStore.getState().closeTabsMatching(
        (tabId) => tabId === id || tabId.startsWith(id + '/')
      );

      // Update current document to whatever is now active
      const newActiveDocId = useTabStore.getState().getActiveDocId();
      setCurrentDocumentId(newActiveDocId);
      if (!newActiveDocId) {
        setCurrentDocument(null);
      }

      await refreshDocuments();
      refreshGitStatus();
    } catch (e) {
      showToast("error", t('toast.deleteFailed', { error: String(e) }));
    }
  }, [deleteDialog, documents, tree, refreshDocuments, refreshGitStatus, setCurrentDocumentId, setCurrentDocument]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteDialog({ isOpen: false, id: "", title: "", childCount: 0 });
  }, []);

  // --- Rename page (show rename dialog) ---
  const handleRenameRequest = useCallback((id: string, currentTitle: string) => {
    setRenameDialog({ isOpen: true, id, currentTitle });
  }, []);

  const handleRenameConfirm = useCallback(async (newTitle: string) => {
    const { id } = renameDialog;
    setRenameDialog({ isOpen: false, id: "", currentTitle: "" });

    try {
      const container = getContainer();

      // Check if this is a folder (virtual node without .md file)
      const isFolder = documents.find(d => d.id === id)?.tags?.includes('__folder');

      if (isFolder) {
        // Rename the directory on disk
        await container.documentService.renameFolder(id, newTitle);

        // If the currently open document was inside this folder, clear it
        if (currentDocumentId?.startsWith(id + '/')) {
          setCurrentDocumentId(null);
          setCurrentDocument(null);
        }
      } else {
        // Rename = rename file on disk (title is derived from filename)
        const newId = await container.documentService.rename(id, newTitle);
        const newTitleFromId = newId.split('/').pop() || newId;

        // Update tab: replace old ID with new ID
        const tabStore = useTabStore.getState();
        tabStore.replaceTabId(id, newId, newTitleFromId);

        // If this is the currently open document, switch to new ID
        if (currentDocumentId === id) {
          const doc = await container.documentService.get(newId);
          setCurrentDocument(doc);
          setCurrentDocumentId(newId);
        }
        // Update documentMap
        setDocumentMap(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }

      await refreshDocuments();
      refreshGitStatus();
    } catch (e) {
      showToast("error", t('toast.renameFailed', { error: String(e) }));
    }
  }, [renameDialog, documents, currentDocumentId, refreshDocuments, refreshGitStatus, setCurrentDocument, setCurrentDocumentId]);

  const handleRenameCancel = useCallback(() => {
    setRenameDialog({ isOpen: false, id: "", currentTitle: "" });
  }, []);

  // --- Copy / Duplicate page ---
  const handleCopyPage = useCallback(async (id: string) => {
    try {
      const container = getContainer();
      const original = await container.documentService.get(id);
      const copy = await container.documentService.create({
        title: `${original.title} (copy)`,
        parentFolder: original.parent || undefined,
      });
      copy.body = original.body;
      copy.tags = original.tags.filter(t => !t.startsWith('__'));
      copy._rawMeta = original._rawMeta;
      await container.documentService.update(copy);
      await refreshDocuments();
      useTabStore.getState().openTab(copy.id, copy.title);
      setCurrentDocumentId(copy.id);
      refreshGitStatus();
      showToast("success", t('toast.pageCopied', { title: original.title }));
    } catch (e) {
      showToast("error", t('toast.copyFailed', { error: String(e) }));
    }
  }, [refreshDocuments, refreshGitStatus, t]);

  // --- Tab management ---
  const handleSelectTab = useCallback((paneId: string, tabId: string) => {
    useTabStore.getState().selectPaneTab(paneId, tabId);
    useTabStore.getState().setActivePaneId(paneId);
    setCurrentDocumentId(tabId);
  }, []);

  const handleCloseTab = useCallback((paneId: string, tabId: string) => {
    useTabStore.getState().closePaneTab(paneId, tabId);
    const newDocId = useTabStore.getState().getActiveDocId();
    setCurrentDocumentId(newDocId);
    if (!newDocId) {
      setCurrentDocument(null);
    }
  }, [setCurrentDocument]);

  const handleActivatePane = useCallback((paneId: string) => {
    useTabStore.getState().setActivePaneId(paneId);
    const newDocId = useTabStore.getState().getActiveDocId();
    setCurrentDocumentId(newDocId);
  }, []);

  const handlePaneClosed = useCallback(() => {
    const newDocId = useTabStore.getState().getActiveDocId();
    setCurrentDocumentId(newDocId);
    if (!newDocId) setCurrentDocument(null);
  }, [setCurrentDocument]);

  // Sync editorStore.isDirty → active tab's dirty state
  useEffect(() => {
    let prevDirty = useEditorStore.getState().isDirty;
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (state.isDirty !== prevDirty) {
        prevDirty = state.isDirty;
        const activeDocId = useTabStore.getState().getActiveDocId();
        if (activeDocId) {
          useTabStore.getState().setTabDirty(activeDocId, state.isDirty);
        }
      }
    });
    return unsubscribe;
  }, []);

  // When renaming a page, also update the tab title
  useEffect(() => {
    if (currentDocument) {
      useTabStore.getState().setTabTitle(currentDocument.id, currentDocument.title);
    }
  }, [currentDocument?.id, currentDocument?.title]);

  const handleSave = useCallback(async (doc: Document) => {
    try {
      const container = getContainer();
      await container.documentService.update(doc);
      setDocumentMap(prev => ({ ...prev, [doc.id]: doc }));
      await refreshDocuments();
      refreshGitStatus();
    } catch (e) {
      showToast("error", t('toast.saveFailed', { error: String(e) }));
    }
  }, [refreshDocuments, refreshGitStatus]);

  const handleNavigate = useCallback((id: string) => {
    if (id) {
      // Open in a tab when navigating via wiki-link or breadcrumb
      const doc = docById.get(id);
      const title = doc?.title || id.split('/').pop() || '';
      useTabStore.getState().openTab(id, title);
      setCurrentDocumentId(id);
    } else {
      setCurrentDocumentId(null);
    }
  }, [docById]);

  const handleSwitchWorkspace = useCallback(async (wsId: string) => {
    try {
      // Save current workspace's tab state BEFORE clearing
      const currentWsId = useWorkspaceStore.getState().activeWorkspaceId;
      const appDataPath = await getAppDataPath();
      if (currentWsId) {
        const data = useTabStore.getState().serializeTabState();
        await fs.writeTextFile(`${appDataPath}tabs-${currentWsId}.json`, JSON.stringify(data));
      }

      useTabStore.getState().closeAllTabs();
      setCurrentDocumentId(null);
      setCurrentDocument(null);
      setDocumentMap({});
      setDocuments([]);
      setTree([]);
      setActiveWorkspace(wsId);
      await fs.writeTextFile(
        `${appDataPath}workspaces.json`,
        JSON.stringify({ workspaces, activeWorkspaceId: wsId })
      );
      // Restore tab state for the target workspace
      const tabsFile = `${appDataPath}tabs-${wsId}.json`;
      if (await fs.exists(tabsFile)) {
        try {
          const tabsRaw = await fs.readTextFile(tabsFile);
          const tabsData = JSON.parse(tabsRaw);
          if (tabsData.paneLayout) {
            useTabStore.getState().loadTabState(tabsData);
            const activeDocId = useTabStore.getState().getActiveDocId();
            if (activeDocId) {
              setCurrentDocumentId(activeDocId);
            }
          }
        } catch {
          // Ignore invalid tabs file
        }
      }
    } catch (e) {
      showToast("error", t('toast.switchWorkspaceFailed', { error: String(e) }));
    }
  }, [workspaces, setActiveWorkspace, setCurrentDocumentId, setCurrentDocument]);

  const handleSearch = useCallback((query: string): SearchResult[] => {
    try {
      const container = getContainer();
      return container.searchService.search(query);
    } catch {
      return [];
    }
  }, []);

  const handleCommit = useCallback(async (message: string) => {
    try {
      const container = getContainer();
      const dir = container.workspacePath;
      // Stage all changed files
      const statuses = await container.gitService.status(dir);
      for (const s of statuses) {
        if (s.status === 'deleted') {
          await container.gitService.remove(dir, s.filepath);
        } else {
          await container.gitService.add(dir, s.filepath);
        }
      }
      // Commit
      await container.gitService.commit(dir, message, {
        name: gitAuthorName || 'Knowledge Hub User',
        email: gitAuthorEmail || 'user@knowledgehub.local',
      });
      showToast("success", t('git.commitSuccess'));
      await refreshGitStatus();
      await refreshGitLog();
    } catch (e) {
      showToast("error", t('toast.commitFailed', { error: String(e) }));
    }
  }, [gitAuthorName, gitAuthorEmail, refreshGitStatus, refreshGitLog]);

  const handleSync = useCallback(async () => {
    try {
      setSyncing(true);
      const container = getContainer();
      const dir = container.workspacePath;
      const tokenOpts = gitToken ? { token: gitToken } : undefined;
      try {
        await container.gitService.pull(dir, tokenOpts);
      } catch {
        // Pull may fail if no remote configured - that's ok
      }
      try {
        await container.gitService.push(dir, tokenOpts);
      } catch {
        // Push may fail if no remote configured - that's ok
      }
      await refreshGitStatus();
      await refreshGitLog();
    } catch (e) {
      showToast("error", t('toast.syncFailed', { error: String(e) }));
    } finally {
      setSyncing(false);
    }
  }, [setSyncing, refreshGitStatus, refreshGitLog, gitToken]);

  // Auto-sync: pull only (no push) - used by 30s interval and focus recovery
  const consecutiveErrorsRef = useRef(0);

  const handleAutoSync = useCallback(async () => {
    try {
      const container = getContainer();
      const dir = container.workspacePath;

      // Capture HEAD oid before pull to detect what changed
      let headOidBefore: string | null = null;
      try {
        const logBefore = await container.gitService.log(dir, { depth: 1 });
        if (logBefore.length > 0) {
          headOidBefore = logBefore[0].oid;
        }
      } catch {
        // No commits yet - that's fine
      }

      // Check if remote is configured by trying to pull
      const tokenOpts = gitToken ? { token: gitToken } : undefined;
      await container.gitService.pull(dir, tokenOpts);

      // Success: reset error count, update sync timestamp
      consecutiveErrorsRef.current = 0;
      useGitStore.getState().setLastSyncAt(new Date().toISOString());
      await refreshGitStatus();
      await refreshGitLog();

      // Check if the currently open page was affected by the pull
      const openDocId = useDocumentStore.getState().currentDocumentId;
      if (openDocId && headOidBefore) {
        try {
          const logAfter = await container.gitService.log(dir, { depth: 1 });
          const headOidAfter = logAfter.length > 0 ? logAfter[0].oid : null;

          // If HEAD changed, the pull brought in new commits
          if (headOidAfter && headOidAfter !== headOidBefore) {
            const currentPagePath = `pages/${openDocId}.md`;
            // Read the file content at the old and new HEAD to compare
            try {
              const contentBefore = await container.gitService.readFileAtCommit(dir, headOidBefore, currentPagePath);
              const contentAfter = await container.gitService.readFileAtCommit(dir, headOidAfter, currentPagePath);

              if (contentBefore !== contentAfter) {
                // The current page was changed by remote - get the author from the latest commit
                const latestAuthor = logAfter[0]?.author?.name || 'Someone';
                useGitStore.getState().setRemoteChange(openDocId, latestAuthor);
              }
            } catch {
              // File may not exist at one of the commits (new file or deleted) - still notify
              // If the file was newly added remotely, that's also a change worth notifying
              try {
                await container.gitService.readFileAtCommit(dir, headOidAfter, currentPagePath);
                // File exists at new HEAD but threw for old HEAD = new file from remote
                const latestAuthor = logAfter[0]?.author?.name || 'Someone';
                useGitStore.getState().setRemoteChange(openDocId, latestAuthor);
              } catch {
                // File doesn't exist at new HEAD either - no notification needed
              }
            }
          }
        } catch {
          // Could not determine changes - skip notification
        }
      }

      // Also refresh documents in case remote changes pulled new files
      const docs = await container.documentService.listAll();
      setDocuments(docs);
      setTree(container.treeService.buildTree(docs));
      container.searchService.rebuild(docs);
      container.documentService.buildBacklinkIndex().then(setBacklinkIndex).catch(() => {});
    } catch {
      // Silent fail: increment error count
      consecutiveErrorsRef.current += 1;
    }
  }, [refreshGitStatus, refreshGitLog, setDocuments, setTree, setBacklinkIndex, gitToken]);

  // Set up auto-sync with dynamic interval + focus listener
  useEffect(() => {
    if (screen !== "editor" || !activeWorkspaceId || !autoSync) return;

    const ws = getActiveWorkspace();
    // Skip auto-sync if no remote is configured
    if (!ws?.remoteUrl) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = () => {
      if (cancelled) return;
      // Use user-configured interval, double it after 3+ consecutive errors
      const baseMs = syncInterval * 1000;
      const delayMs = consecutiveErrorsRef.current >= 3 ? baseMs * 2 : baseMs;
      timeoutId = setTimeout(async () => {
        if (cancelled) return;
        await handleAutoSync();
        scheduleNext();
      }, delayMs);
    };

    // Start the recurring sync chain
    scheduleNext();

    // Focus recovery: sync when window regains focus
    const handleFocus = () => {
      handleAutoSync();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.removeEventListener("focus", handleFocus);
    };
  }, [screen, activeWorkspaceId, autoSync, syncInterval, handleAutoSync, getActiveWorkspace]);

  // Reload the currently open document from disk (used when applying remote changes)
  const handleReloadDocument = useCallback(async () => {
    const docId = useDocumentStore.getState().currentDocumentId;
    if (!docId) return;
    try {
      const container = getContainer();
      const doc = await container.documentService.get(docId);
      setCurrentDocument(doc);
      setDocumentMap(prev => ({ ...prev, [docId]: doc }));
    } catch (e) {
      showToast("error", t('toast.reloadFailed', { error: String(e) }));
    }
  }, [setCurrentDocument]);

  const handleTrashRestored = useCallback(async () => {
    await refreshDocuments();
    refreshGitStatus();
  }, [refreshDocuments, refreshGitStatus]);

  const getAncestorsForDoc = useCallback((docId: string): DocumentMeta[] => {
    try {
      const container = getContainer();
      return container.treeService.getAncestors(documents, docId);
    } catch {
      return [];
    }
  }, [documents]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarVisible(prev => !prev);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N: New page
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        if (screen === 'editor' && activeWorkspaceId) {
          handleNewPage();
        }
      }
      // Ctrl+Shift+S: Open commit panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (screen === 'editor' && activeWorkspaceId) {
          window.dispatchEvent(new CustomEvent('open-commit-panel'));
        }
      }
      // Ctrl+Shift+P: Git Push
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        if (screen === 'editor' && activeWorkspaceId) {
          handleSync();
        }
      }
      // Ctrl+\: Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        if (screen === 'editor') {
          setSidebarVisible((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, activeWorkspaceId, handleNewPage, handleSync]);

  if (loading) {
    return (
      <div className="flex flex-col h-screen border border-window-border">
        <TitleBar onOpenHelp={() => setScreen('help')} />
        <LoadingSpinner />
      </div>
    );
  }

  if (screen === 'help') {
    return (
      <div className="flex flex-col h-screen border border-window-border">
        <TitleBar onOpenHelp={() => setScreen('help')} />
        <HelpPage onBack={() => setScreen('editor')} />
        <ToastContainer />
      </div>
    );
  }

  if (screen === 'settings') {
    return (
      <div className="flex flex-col h-screen border border-window-border">
        <TitleBar onOpenHelp={() => setScreen('help')} />
        <SettingsView onBack={() => setScreen('editor')} />
        <ToastContainer />
      </div>
    );
  }

  if (screen === 'imageCleanup') {
    const ws = getActiveWorkspace();
    return (
      <div className="flex flex-col h-screen border border-window-border">
        <TitleBar onOpenHelp={() => setScreen('help')} />
        <ImageCleanupView
          onBack={() => setScreen('editor')}
          workspacePath={ws?.path ?? ""}
          fs={fs}
        />
        <ToastContainer />
      </div>
    );
  }

  if (screen === "welcome" || workspaces.length === 0) {
    return (
      <div className="flex flex-col h-screen border border-window-border">
        <TitleBar minimal onOpenHelp={() => setScreen('help')} />
        <div className="flex-1 overflow-auto">
          <WelcomeScreen
            onCreateWorkspace={handleCreateWorkspace}
            onCloneRepo={handleCloneRepo}
            onBack={workspaces.length > 0 ? () => setScreen('editor') : undefined}
            existingToken={gitToken || undefined}
          />
        </div>
        <ToastContainer />
      </div>
    );
  }

  const activeWs = getActiveWorkspace();

  return (
    <div className="flex flex-col h-screen border border-window-border">
      <TitleBar onOpenHelp={() => setScreen('help')} />
      <AppShell
        tree={tree}
        documents={documents}
        selectedId={currentDocumentId}
        documentMap={documentMap}
        getAncestors={getAncestorsForDoc}
        workspaceName={activeWs?.name ?? "Knowledge Hub"}
        workspacePath={activeWs?.path ?? ""}
        sidebarVisible={sidebarVisible}
        workspaces={workspaces.map(ws => ({ id: ws.id, name: ws.name }))}
        activeWorkspaceId={activeWorkspaceId}
        onSwitchWorkspace={handleSwitchWorkspace}
        onAddWorkspace={() => setScreen('welcome')}
        onDeleteWorkspace={(id, name) => setDeleteWsDialog({ isOpen: true, id, name })}
        onSelectPage={handleSelectPage}
        onNewPage={handleNewPage}
        onNewFolder={handleNewFolder}
        onDeletePage={handleDeleteRequest}
        onRenamePage={handleRenameRequest}
        onSave={handleSave}
        onNavigate={handleNavigate}
        onOpenSettings={() => setScreen('settings')}
        onOpenTrash={() => setTrashOpen(true)}
        onOpenImageCleanup={() => setScreen('imageCleanup')}
        onCommit={handleCommit}
        onSync={handleSync}
        onReloadDocument={handleReloadDocument}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onActivatePane={handleActivatePane}
        onPaneClosed={handlePaneClosed}
        onToggleSidebar={handleToggleSidebar}
        favorites={favorites}
        recentPages={recentPages}
        onToggleFavorite={handleToggleFavorite}
        onCopyPage={handleCopyPage}
      />
      <SearchModal onSelect={handleSelectPage} onSearch={handleSearch} />
      <TrashPanel
        isOpen={trashOpen}
        onClose={() => setTrashOpen(false)}
        workspacePath={activeWs?.path ?? ""}
        fs={fs}
        onRestored={handleTrashRestored}
      />
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title={t('sidebar.deleteConfirmTitle')}
        message={
          deleteDialog.childCount > 0
            ? t('sidebar.deleteConfirmWithChildren', { title: deleteDialog.title, count: deleteDialog.childCount })
            : t('sidebar.deleteConfirmMessage', { title: deleteDialog.title })
        }
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
      <RenameDialog
        isOpen={renameDialog.isOpen}
        currentTitle={renameDialog.currentTitle}
        onConfirm={handleRenameConfirm}
        onCancel={handleRenameCancel}
      />
      <ConfirmDialog
        isOpen={deleteWsDialog.isOpen}
        title={t('workspace.deleteTitle')}
        message={t('workspace.deleteMessage', { name: deleteWsDialog.name })}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={() => {
          setDeleteWsDialog({ isOpen: false, id: '', name: '' });
          handleDeleteWorkspace(deleteWsDialog.id);
        }}
        onCancel={() => setDeleteWsDialog({ isOpen: false, id: '', name: '' })}
      />
      <CreateItemDialog
        isOpen={createDialog.isOpen}
        mode={createDialog.mode}
        documents={documents}
        onConfirm={handleCreateItemConfirm}
        onCancel={handleCreateItemCancel}
      />
      <TemplateDialog
        isOpen={templateDialogOpen}
        onSelect={handleTemplateSelect}
        onCancel={() => setTemplateDialogOpen(false)}
      />
      <ToastContainer />
    </div>
  );
}

export default App;
