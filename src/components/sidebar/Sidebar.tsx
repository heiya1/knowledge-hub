import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  PanelLeftClose,
  Check,
  Plus,
  FolderPlus,
  SquareTerminal as TerminalIcon,
  Trash2,
  ImageIcon,
  Settings,
} from "lucide-react";
import { PageTree } from "./PageTree";
import { FavoritesSection } from "./FavoritesSection";
import { RecentSection } from "./RecentSection";
import { Tooltip } from "../common/Tooltip";
import type { TreeNode } from "../../core/models/TreeNode";
import type { DocumentMeta } from "../../core/models/Document";

interface WorkspaceInfo {
  id: string;
  name: string;
}

interface SidebarProps {
  tree: TreeNode[];
  documents: DocumentMeta[];
  selectedId: string | null;
  onSelectPage: (id: string) => void;
  onNewPage: () => void;
  onDeletePage: (id: string, title: string, childCount: number) => void;
  onRenamePage: (id: string, currentTitle: string) => void;
  onNewFolder: () => void;
  onOpenSettings: () => void;
  onOpenTrash: () => void;
  onOpenImageCleanup: () => void;
  workspaceName: string;
  workspaces?: WorkspaceInfo[];
  activeWorkspaceId?: string | null;
  onSwitchWorkspace?: (id: string) => void;
  onAddWorkspace?: () => void;
  onDeleteWorkspace?: (id: string, name: string) => void;
  onToggleSidebar?: () => void;
  favorites?: string[];
  recentPages?: Array<{ id: string; title: string; timestamp: string }>;
  onToggleFavorite?: (id: string) => void;
}

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 260;

export function Sidebar({
  tree,
  documents,
  selectedId,
  onSelectPage,
  onNewPage,
  onDeletePage,
  onRenamePage,
  onNewFolder,
  onOpenSettings,
  onOpenTrash,
  onOpenImageCleanup,
  workspaceName,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  onAddWorkspace,
  onDeleteWorkspace,
  onToggleSidebar,
  favorites,
  recentPages,
  onToggleFavorite,
}: SidebarProps) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const isResizing = useRef(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const wsDropdownRef = useRef<HTMLDivElement>(null);

  // Close workspace dropdown on click outside
  const closeWsDropdown = useCallback(() => setWsDropdownOpen(false), []);
  useClickOutside(wsDropdownRef, wsDropdownOpen, closeWsDropdown);

  // --- Resize logic ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // --- Tag extraction ---
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const doc of documents) {
      if (doc.tags) {
        for (const tag of doc.tags) {
          if (!tag.startsWith("__")) tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [documents]);

  // --- Tag-based tree filtering ---
  const filteredTree = useMemo(() => {
    if (!selectedTag) return tree;

    // Collect IDs of documents that have the selected tag
    const matchingIds = new Set<string>();
    for (const doc of documents) {
      if (doc.tags && doc.tags.includes(selectedTag)) {
        matchingIds.add(doc.id);
      }
    }

    // Also collect all ancestor IDs so we keep the tree structure
    const ancestorIds = new Set<string>();
    for (const doc of documents) {
      if (matchingIds.has(doc.id)) {
        // Walk up the parent chain (with cycle detection)
        const visited = new Set<string>();
        let parentId = doc.parent;
        while (parentId && !visited.has(parentId)) {
          visited.add(parentId);
          ancestorIds.add(parentId);
          const parentDoc = documents.find((d) => d.id === parentId);
          parentId = parentDoc?.parent ?? null;
        }
      }
    }

    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      const result: TreeNode[] = [];
      for (const node of nodes) {
        const isMatch = matchingIds.has(node.meta.id);
        const isAncestor = ancestorIds.has(node.meta.id);
        if (isMatch || isAncestor) {
          result.push({
            ...node,
            children: filterNodes(node.children),
          });
        }
      }
      return result;
    };

    return filterNodes(tree);
  }, [tree, documents, selectedTag]);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTag((prev) => (prev === tag ? null : tag));
  }, []);

  return (
    <aside
      ref={sidebarRef}
      className="h-full bg-bg-sidebar border-r border-content-border flex flex-col overflow-hidden select-none relative"
      style={{
        width: `${width}px`,
        minWidth: `${MIN_WIDTH}px`,
        maxWidth: `${MAX_WIDTH}px`,
      }}
    >
      {/* Workspace selector */}
      <div
        className="px-3 py-2.5 border-b border-sidebar-border relative flex items-center gap-1"
        ref={wsDropdownRef}
      >
        <button
          onClick={() => setWsDropdownOpen((v) => !v)}
          className="flex-1 flex items-center justify-between text-sm font-semibold text-sidebar-text truncate hover:text-sidebar-accent transition-colors min-w-0"
        >
          <span className="truncate">{workspaceName}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 ml-1 transition-transform ${wsDropdownOpen ? "rotate-180" : ""}`}
          />
        </button>
        {/* Sidebar close button */}
        {onToggleSidebar && (
          <Tooltip content={`${t('sidebar.closeSidebar')} (Ctrl+\\)`}>
            <button
              onClick={onToggleSidebar}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
        {wsDropdownOpen && (
          <div className="absolute left-2 right-2 top-full mt-1 bg-bg-main border border-border rounded-lg shadow-lg z-20 overflow-hidden">
            {workspaces?.map((ws) => (
              <div
                key={ws.id}
                className={`group flex items-center hover:bg-bg-hover transition-colors ${
                  ws.id === activeWorkspaceId
                    ? "text-accent font-medium bg-sidebar-selected"
                    : "text-text-primary"
                }`}
              >
                <button
                  onClick={() => {
                    if (ws.id !== activeWorkspaceId && onSwitchWorkspace) {
                      onSwitchWorkspace(ws.id);
                    }
                    setWsDropdownOpen(false);
                  }}
                  className="flex-1 text-left px-3 py-2 text-sm flex items-center gap-2 min-w-0"
                >
                  <span className="w-3 h-3 shrink-0 flex items-center justify-center">
                    {ws.id === activeWorkspaceId && <Check className="w-3 h-3" />}
                  </span>
                  <span className="truncate">{ws.name}</span>
                </button>
                {onDeleteWorkspace && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setWsDropdownOpen(false);
                      onDeleteWorkspace(ws.id, ws.name);
                    }}
                    className="shrink-0 w-6 h-6 mr-1 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-text-secondary hover:text-danger transition-all"
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            <div className="border-t border-border">
              <button
                onClick={() => {
                  setWsDropdownOpen(false);
                  onAddWorkspace?.();
                }}
                className="w-full text-left px-3 py-2 text-sm text-accent hover:bg-bg-hover transition-colors"
              >
                + {t("sidebar.addWorkspace")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New page / folder buttons */}
      <div className="px-3 pb-2 flex gap-1">
        <button
          onClick={onNewPage}
          className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm text-sidebar-accent hover:bg-sidebar-hover transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t("sidebar.newPage")}</span>
        </button>
        <Tooltip content={t("sidebar.newFolder", "New Folder")}>
          <button
            onClick={onNewFolder}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-sm text-sidebar-text-muted hover:bg-sidebar-hover transition-colors"
          >
            <FolderPlus className="w-5 h-5" />
          </button>
        </Tooltip>
      </div>

      {/* Favorites section */}
      {favorites && onToggleFavorite && (
        <FavoritesSection
          favorites={favorites}
          documents={documents}
          onSelect={onSelectPage}
          onToggleFavorite={onToggleFavorite}
        />
      )}

      {/* Recent pages section */}
      {recentPages && recentPages.length > 0 && (
        <RecentSection
          recentPages={recentPages}
          onSelect={onSelectPage}
        />
      )}

      {/* Pages section */}
      <div className="px-3 py-1">
        <div className="text-xs font-semibold text-sidebar-text-muted uppercase tracking-wider px-2">
          {t("sidebar.pages")}
        </div>
      </div>

      {/* Page tree */}
      <div className="flex-1 overflow-y-auto px-1">
        <PageTree
          tree={filteredTree}
          selectedId={selectedId}
          onSelect={onSelectPage}
          onDelete={onDeletePage}
          onRename={onRenamePage}
        />
      </div>

      {/* Tags section */}
      {allTags.length > 0 && (
        <div className="px-3 py-2 border-t border-sidebar-border">
          <div className="text-xs font-semibold text-sidebar-text-muted uppercase tracking-wider px-2 mb-1.5">
            {t("sidebar.tags")}
          </div>
          <div className="flex flex-wrap gap-1 px-1">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full transition-colors ${
                  selectedTag === tag
                    ? "bg-sidebar-accent text-white"
                    : "bg-sidebar-hover text-sidebar-text-muted hover:bg-sidebar-item-selected"
                }`}
              >
                # {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="px-2 py-2 border-t border-sidebar-border bg-bg-sidebar-footer flex items-center gap-1">
        <Tooltip content={`${t("terminal.title")} (Ctrl+\`)`}>
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("toggle-terminal"))
            }
            className="flex items-center justify-center w-8 h-8 rounded-md text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text transition-colors"
          >
            <TerminalIcon className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content={t("sidebar.trash")}>
          <button
            onClick={onOpenTrash}
            className="flex items-center justify-center w-8 h-8 rounded-md text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content={t("imageCleanup.title")}>
          <button
            onClick={onOpenImageCleanup}
            className="flex items-center justify-center w-8 h-8 rounded-md text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content={t("settings.title")}>
          <button
            onClick={onOpenSettings}
            className="flex items-center justify-center w-8 h-8 rounded-md text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-accent/30 active:bg-accent/50 transition-colors z-10"
        onMouseDown={handleMouseDown}
      />
    </aside>
  );
}
