import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigationStore } from "./stores/navigationStore";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { useDocumentStore } from "./stores/documentStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useGitStore } from "./stores/gitStore";
import { WelcomeScreen } from "./components/workspace/WelcomeScreen";
import { AppShell } from "./components/layout/AppShell";
import { SearchModal } from "./components/search/SearchModal";
import { SettingsView } from "./components/settings/SettingsView";
import { ConfirmDialog } from "./components/common/ConfirmDialog";
import { RenameDialog } from "./components/common/RenameDialog";
import { TrashPanel } from "./components/sidebar/TrashPanel";
import { ToastContainer, showToast } from "./components/common/Toast";
import { LoadingSpinner } from "./components/common/LoadingSpinner";
import { TauriFileSystem, getAppDataPath } from "./infrastructure/TauriFileSystem";
import { initContainer, getContainer, updateWorkspacePath } from "./infrastructure/container";
import { generateId } from "./core/utils/id";
import { parseFrontmatter } from "./core/utils/frontmatter";
import type { Document } from "./core/models/Document";
import type { SearchResult } from "./core/services/SearchService";

const fs = new TauriFileSystem();

/** Number of days before trash items are auto-deleted */
const TRASH_AUTO_DELETE_DAYS = 30;

function App() {
  const { t } = useTranslation();
  const { screen, setScreen } = useNavigationStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [addWsDialogOpen, setAddWsDialogOpen] = useState(false);

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
    setLoading: setDocLoading,
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

        // Load workspaces
        const workspacesFile = `${appDataPath}workspaces.json`;
        if (await fs.exists(workspacesFile)) {
          const raw = await fs.readTextFile(workspacesFile);
          const data = JSON.parse(raw);
          setWorkspaces(data.workspaces || []);
          if (data.activeWorkspaceId) {
            setActiveWorkspace(data.activeWorkspaceId);
            setScreen("editor");
          }
        } else {
          setWorkspaces([]);
        }
      } catch {
        setWorkspaces([]);
      }
    })();
  }, []);

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
          aiProvider: state.aiProvider,
          aiApiKey: state.aiApiKey,
          ollamaModel: state.ollamaModel,
          ollamaUrl: state.ollamaUrl,
        };
        await fs.writeTextFile(`${appDataPath}settings.json`, JSON.stringify(data, null, 2));
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
      setDocLoading(true);
      try {
        updateWorkspacePath(fs, ws.path);
        const container = getContainer();
        const docs = await container.documentService.listAll();
        setDocuments(docs);
        const builtTree = container.treeService.buildTree(docs);
        setTree(builtTree);
        container.searchService.rebuild(docs);
        // Load git status
        await refreshGitStatus();
        await refreshGitLog();

        // Auto-cleanup: delete trash items older than 30 days
        await cleanupOldTrashItems(ws.path);
      } catch (e) {
        showToast("error", `Failed to load documents: ${e}`);
      } finally {
        setDocLoading(false);
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
          const raw = await fs.readTextFile(filePath);
          const doc = parseFrontmatter(raw);

          // Use updatedAt as the deletion timestamp (it was set when the page was last saved before deletion)
          const deletedAt = new Date(doc.updatedAt).getTime();
          if (now - deletedAt > maxAge) {
            await fs.removeFile(filePath);
          }
        } catch {
          // Skip files that can't be parsed; don't delete them to be safe
        }
      }
    } catch {
      // Silently ignore cleanup errors
    }
  }, []);

  // Load current document
  useEffect(() => {
    if (!currentDocumentId || !activeWorkspaceId) {
      setCurrentDocument(null);
      return;
    }
    (async () => {
      try {
        const container = getContainer();
        const doc = await container.documentService.get(currentDocumentId);
        setCurrentDocument(doc);
      } catch (e) {
        showToast("error", `Failed to load document: ${e}`);
        setCurrentDocument(null);
      }
    })();
  }, [currentDocumentId]);

  const handleCreateWorkspace = useCallback(
    async (name: string, token?: string) => {
      try {
        const appDataPath = await getAppDataPath();
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const wsPath = `${appDataPath}workspaces/${slug}`;

        // Create directories
        await fs.createDir(`${wsPath}/pages`, { recursive: true });
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

        // Save workspace info
        const wsId = generateId();
        const workspace = { id: wsId, name, path: wsPath };
        addWorkspace(workspace);
        setActiveWorkspace(wsId);

        // Persist
        await fs.writeTextFile(
          `${appDataPath}workspaces.json`,
          JSON.stringify({ workspaces: [...workspaces, workspace], activeWorkspaceId: wsId })
        );

        // Save token to settings if provided
        if (token) {
          useSettingsStore.getState().setGitToken(token);
        }

        setScreen("editor");
        showToast("success", `Workspace "${name}" created`);
      } catch (e) {
        showToast("error", `Failed to create workspace: ${e}`);
      }
    },
    [workspaces, gitAuthorName, gitAuthorEmail]
  );

  const handleCloneRepo = useCallback(
    async (url: string, name: string, token?: string) => {
      try {
        const appDataPath = await getAppDataPath();
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const wsPath = `${appDataPath}workspaces/${slug}`;

        // Save token first so clone can use it for private repos
        if (token) {
          useSettingsStore.getState().setGitToken(token);
        }

        // Create workspace directory
        await fs.createDir(wsPath, { recursive: true });

        // Initialize container and clone
        initContainer(fs, wsPath);
        const container = getContainer();
        await container.gitService.init(wsPath);

        // Clone - this uses isomorphic-git's clone
        const git = await import('isomorphic-git');
        const http = await import('isomorphic-git/http/web');
        const { tauriFsAdapter } = await import('./infrastructure/TauriFsAdapter');
        await git.clone({
          fs: tauriFsAdapter,
          http: http.default,
          dir: wsPath,
          url,
          singleBranch: true,
          ...(token ? {
            onAuth: () => ({ username: token }),
          } : {}),
        });

        // Ensure required directories exist
        if (!await fs.exists(`${wsPath}/pages`)) {
          await fs.createDir(`${wsPath}/pages`, { recursive: true });
        }
        if (!await fs.exists(`${wsPath}/assets`)) {
          await fs.createDir(`${wsPath}/assets/images`, { recursive: true });
          await fs.createDir(`${wsPath}/assets/diagrams`, { recursive: true });
        }

        // Save workspace info with remote URL
        const wsId = generateId();
        const workspace = { id: wsId, name, path: wsPath, remoteUrl: url };
        addWorkspace(workspace);
        setActiveWorkspace(wsId);

        // Persist
        await fs.writeTextFile(
          `${appDataPath}workspaces.json`,
          JSON.stringify({ workspaces: [...workspaces, workspace], activeWorkspaceId: wsId })
        );

        setScreen("editor");
        showToast("success", `Repository "${name}" cloned successfully`);
      } catch (e) {
        showToast("error", `Failed to clone repository: ${e}`);
      }
    },
    [workspaces]
  );

  const handleSelectPage = useCallback((id: string) => {
    setCurrentDocumentId(id);
  }, []);

  // Refresh documents, tree, and search index (shared helper)
  const refreshDocuments = useCallback(async () => {
    const container = getContainer();
    const docs = await container.documentService.listAll();
    setDocuments(docs);
    setTree(container.treeService.buildTree(docs));
    container.searchService.rebuild(docs);
  }, [setDocuments, setTree]);

  const handleNewPage = useCallback(async () => {
    try {
      const container = getContainer();
      const doc = await container.documentService.create({ title: "" });
      await refreshDocuments();
      setCurrentDocumentId(doc.id);
    } catch (e) {
      showToast("error", `Failed to create page: ${e}`);
    }
  }, [refreshDocuments]);

  // --- Delete page (show confirmation dialog) ---
  const handleDeleteRequest = useCallback((id: string, title: string, childCount: number) => {
    setDeleteDialog({ isOpen: true, id, title, childCount });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    const { id, childCount } = deleteDialog;
    setDeleteDialog({ isOpen: false, id: "", title: "", childCount: 0 });

    try {
      const container = getContainer();

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

      // If the deleted page was the current one, clear selection
      if (currentDocumentId === id) {
        setCurrentDocumentId(null);
        setCurrentDocument(null);
      }

      await refreshDocuments();
      refreshGitStatus();
    } catch (e) {
      showToast("error", `Failed to delete page: ${e}`);
    }
  }, [deleteDialog, tree, currentDocumentId, refreshDocuments, refreshGitStatus, setCurrentDocumentId, setCurrentDocument]);

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
      const doc = await container.documentService.get(id);
      doc.title = newTitle;
      await container.documentService.update(doc);

      // If this is the currently open document, update its state too
      if (currentDocumentId === id) {
        setCurrentDocument({ ...doc, title: newTitle });
      }

      await refreshDocuments();
      refreshGitStatus();
    } catch (e) {
      showToast("error", `Failed to rename page: ${e}`);
    }
  }, [renameDialog, currentDocumentId, refreshDocuments, refreshGitStatus, setCurrentDocument]);

  const handleRenameCancel = useCallback(() => {
    setRenameDialog({ isOpen: false, id: "", currentTitle: "" });
  }, []);

  // --- Move page (drag & drop reorder / reparent) ---
  const handleMovePage = useCallback(async (id: string, newParent: string | null, newOrder: number) => {
    try {
      const container = getContainer();
      const doc = await container.documentService.get(id);

      // Get all documents to recalculate orders
      const allDocs = await container.documentService.listAll();

      // Get current siblings at the target location (same parent), excluding the moved doc
      const targetSiblings = allDocs
        .filter(d => d.parent === newParent && d.id !== id)
        .sort((a, b) => a.order - b.order);

      // Clamp the target order to valid range
      const clampedOrder = Math.max(0, Math.min(newOrder, targetSiblings.length));

      // Update order values for all affected siblings
      for (let i = 0; i < targetSiblings.length; i++) {
        const sibling = targetSiblings[i];
        const newSiblingOrder = i >= clampedOrder ? i + 1 : i;
        if (sibling.order !== newSiblingOrder) {
          const siblingDoc = await container.documentService.get(sibling.id);
          siblingDoc.order = newSiblingOrder;
          await container.documentService.update(siblingDoc);
        }
      }

      // Update the moved document
      doc.parent = newParent;
      doc.order = clampedOrder;
      await container.documentService.update(doc);

      // If this is the currently open document, refresh it
      if (currentDocumentId === id) {
        setCurrentDocument({ ...doc });
      }

      await refreshDocuments();
      refreshGitStatus();
    } catch (e) {
      showToast("error", `Failed to move page: ${e}`);
    }
  }, [currentDocumentId, refreshDocuments, refreshGitStatus, setCurrentDocument]);

  const handleSave = useCallback(async (doc: Document) => {
    try {
      const container = getContainer();
      await container.documentService.update(doc);
      await refreshDocuments();
      refreshGitStatus();
    } catch (e) {
      showToast("error", `Failed to save: ${e}`);
    }
  }, [refreshDocuments, refreshGitStatus]);

  const handleNavigate = useCallback((id: string) => {
    if (id) {
      setCurrentDocumentId(id);
    } else {
      setCurrentDocumentId(null);
    }
  }, []);

  const handleSwitchWorkspace = useCallback(async (wsId: string) => {
    try {
      setCurrentDocumentId(null);
      setCurrentDocument(null);
      setActiveWorkspace(wsId);
      // Persist the active workspace
      const appDataPath = await getAppDataPath();
      await fs.writeTextFile(
        `${appDataPath}workspaces.json`,
        JSON.stringify({ workspaces, activeWorkspaceId: wsId })
      );
    } catch (e) {
      showToast("error", `Failed to switch workspace: ${e}`);
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
      showToast("success", "git.commitSuccess");
      await refreshGitStatus();
      await refreshGitLog();
    } catch (e) {
      showToast("error", `Commit failed: ${e}`);
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
      showToast("error", `Sync failed: ${e}`);
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
    } catch {
      // Silent fail: increment error count
      consecutiveErrorsRef.current += 1;
    }
  }, [refreshGitStatus, refreshGitLog, setDocuments, setTree, gitToken]);

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
    } catch (e) {
      showToast("error", `Failed to reload document: ${e}`);
    }
  }, [setCurrentDocument]);

  const handleTrashRestored = useCallback(async () => {
    await refreshDocuments();
    refreshGitStatus();
  }, [refreshDocuments, refreshGitStatus]);

  const getAncestors = () => {
    if (!currentDocument) return [];
    try {
      const container = getContainer();
      return container.treeService.getAncestors(documents, currentDocument.id);
    } catch {
      return [];
    }
  };

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
    return <LoadingSpinner />;
  }

  if (screen === "welcome" || workspaces.length === 0) {
    return (
      <>
        <WelcomeScreen onCreateWorkspace={handleCreateWorkspace} onCloneRepo={handleCloneRepo} />
        <ToastContainer />
      </>
    );
  }

  const activeWs = getActiveWorkspace();

  return (
    <>
      <AppShell
        tree={tree}
        documents={documents}
        selectedId={currentDocumentId}
        currentDocument={currentDocument}
        ancestors={getAncestors()}
        workspaceName={activeWs?.name ?? "Knowledge Hub"}
        workspacePath={activeWs?.path ?? ""}
        sidebarVisible={sidebarVisible}
        workspaces={workspaces.map(ws => ({ id: ws.id, name: ws.name }))}
        activeWorkspaceId={activeWorkspaceId}
        onSwitchWorkspace={handleSwitchWorkspace}
        onAddWorkspace={() => setAddWsDialogOpen(true)}
        onSelectPage={handleSelectPage}
        onNewPage={handleNewPage}
        onDeletePage={handleDeleteRequest}
        onRenamePage={handleRenameRequest}
        onMovePage={handleMovePage}
        onSave={handleSave}
        onNavigate={handleNavigate}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenTrash={() => setTrashOpen(true)}
        onCommit={handleCommit}
        onSync={handleSync}
        onReloadDocument={handleReloadDocument}
      />
      <SearchModal onSelect={handleSelectPage} onSearch={handleSearch} />
      {settingsOpen && <SettingsView onClose={() => setSettingsOpen(false)} />}
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
      <RenameDialog
        isOpen={addWsDialogOpen}
        currentTitle=""
        onConfirm={(name) => {
          setAddWsDialogOpen(false);
          if (name.trim()) {
            handleCreateWorkspace(name.trim());
          }
        }}
        onCancel={() => setAddWsDialogOpen(false)}
      />
      <ToastContainer />
    </>
  );
}

export default App;
