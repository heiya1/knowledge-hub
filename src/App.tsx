import { useCallback, useEffect, useState } from "react";
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
import { ToastContainer, showToast } from "./components/common/Toast";
import { LoadingSpinner } from "./components/common/LoadingSpinner";
import { TauriFileSystem, getAppDataPath } from "./infrastructure/TauriFileSystem";
import { initContainer, getContainer, updateWorkspacePath } from "./infrastructure/container";
import { generateId } from "./core/utils/id";
import type { Document } from "./core/models/Document";
import type { SearchResult } from "./core/services/SearchService";

const fs = new TauriFileSystem();

function App() {
  const { t } = useTranslation();
  const { screen, setScreen } = useNavigationStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
  const { gitAuthorName, gitAuthorEmail, setGitAuthor } = useSettingsStore();
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

  // Load workspaces on startup
  useEffect(() => {
    (async () => {
      try {
        const appDataPath = await getAppDataPath();
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
      } catch (e) {
        showToast("error", `Failed to load documents: ${e}`);
      } finally {
        setDocLoading(false);
      }
    })();
  }, [activeWorkspaceId]);

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
    async (name: string, authorName: string, authorEmail: string) => {
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

        // Save git author settings
        if (authorName || authorEmail) {
          setGitAuthor(authorName, authorEmail);
        }

        setScreen("editor");
        showToast("success", `Workspace "${name}" created`);
      } catch (e) {
        showToast("error", `Failed to create workspace: ${e}`);
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
      try {
        await container.gitService.pull(dir);
      } catch {
        // Pull may fail if no remote configured - that's ok
      }
      try {
        await container.gitService.push(dir);
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
  }, [setSyncing, refreshGitStatus, refreshGitLog]);

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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, activeWorkspaceId, handleNewPage]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (screen === "welcome" || workspaces.length === 0) {
    return (
      <>
        <WelcomeScreen onCreateWorkspace={handleCreateWorkspace} />
        <ToastContainer />
      </>
    );
  }

  const activeWs = getActiveWorkspace();

  return (
    <>
      <AppShell
        tree={tree}
        selectedId={currentDocumentId}
        currentDocument={currentDocument}
        ancestors={getAncestors()}
        workspaceName={activeWs?.name ?? "Knowledge Hub"}
        workspacePath={activeWs?.path ?? ""}
        onSelectPage={handleSelectPage}
        onNewPage={handleNewPage}
        onDeletePage={handleDeleteRequest}
        onRenamePage={handleRenameRequest}
        onSave={handleSave}
        onNavigate={handleNavigate}
        onOpenSettings={() => setSettingsOpen(true)}
        onCommit={handleCommit}
        onSync={handleSync}
      />
      <SearchModal onSelect={handleSelectPage} onSearch={handleSearch} />
      {settingsOpen && <SettingsView onClose={() => setSettingsOpen(false)} />}
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
      <ToastContainer />
    </>
  );
}

export default App;
