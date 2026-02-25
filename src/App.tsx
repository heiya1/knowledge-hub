import { useCallback, useEffect } from "react";
import { useNavigationStore } from "./stores/navigationStore";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { useDocumentStore } from "./stores/documentStore";
import { useSettingsStore } from "./stores/settingsStore";
import { WelcomeScreen } from "./components/workspace/WelcomeScreen";
import { AppShell } from "./components/layout/AppShell";
import { ToastContainer, showToast } from "./components/common/Toast";
import { LoadingSpinner } from "./components/common/LoadingSpinner";
import { TauriFileSystem, getAppDataPath } from "./infrastructure/TauriFileSystem";
import { initContainer, getContainer, updateWorkspacePath } from "./infrastructure/container";
import { generateId } from "./core/utils/id";
import type { Document } from "./core/models/Document";

const fs = new TauriFileSystem();

function App() {
  const { screen, setScreen } = useNavigationStore();
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
  const { setGitAuthor } = useSettingsStore();

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

        // Initialize container and create welcome page
        initContainer(fs, wsPath);
        const container = getContainer();
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

  const handleNewPage = useCallback(async () => {
    try {
      const container = getContainer();
      const doc = await container.documentService.create({ title: "" });
      const docs = await container.documentService.listAll();
      setDocuments(docs);
      setTree(container.treeService.buildTree(docs));
      setCurrentDocumentId(doc.id);
    } catch (e) {
      showToast("error", `Failed to create page: ${e}`);
    }
  }, []);

  const handleSave = useCallback(async (doc: Document) => {
    try {
      const container = getContainer();
      await container.documentService.update(doc);
      const docs = await container.documentService.listAll();
      setDocuments(docs);
      setTree(container.treeService.buildTree(docs));
    } catch (e) {
      showToast("error", `Failed to save: ${e}`);
    }
  }, []);

  const handleNavigate = useCallback((id: string) => {
    if (id) {
      setCurrentDocumentId(id);
    } else {
      setCurrentDocumentId(null);
    }
  }, []);

  const getAncestors = () => {
    if (!currentDocument) return [];
    try {
      const container = getContainer();
      return container.treeService.getAncestors(documents, currentDocument.id);
    } catch {
      return [];
    }
  };

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
        onSelectPage={handleSelectPage}
        onNewPage={handleNewPage}
        onSave={handleSave}
        onNavigate={handleNavigate}
      />
      <ToastContainer />
    </>
  );
}

export default App;
