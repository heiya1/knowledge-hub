import { useState, useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, AlignJustify, Maximize2, Maximize, PanelTopOpen, ChevronUp, ChevronDown, X, List, History } from 'lucide-react';
import { MarkdownEditor } from './MarkdownEditor';
import { EditorToolbar } from './EditorToolbar';
import { TableToolbar } from './TableToolbar';
import { FindReplace } from './FindReplace';
import { RemoteChangeBanner } from './RemoteChangeBanner';
import { BacklinksSection } from './BacklinksSection';
import { OutlineSidebar } from './OutlineSidebar';
import { Breadcrumb } from '../common/Breadcrumb';
import { Tooltip } from '../common/Tooltip';
import { GitStatusBar } from '../git/GitStatusBar';
import { CommitPanel } from '../git/CommitPanel';
import { HistoryPanel } from '../git/HistoryPanel';
import { useEditorStore } from '../../stores/editorStore';
import { useGitStore } from '../../stores/gitStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTabStore } from '../../stores/tabStore';
import type { Document, DocumentMeta } from '../../core/models/Document';

interface EditorViewProps {
  paneId: string;
  document: Document | null;
  ancestors: DocumentMeta[];
  workspaceName?: string;
  onSave: (doc: Document) => Promise<void>;
  onNavigate: (id: string) => void;
  onCommit: (message: string) => Promise<void>;
  onSync: () => Promise<void>;
  onReloadDocument?: () => void;
  onDelete?: (id: string, title: string, childCount: number) => void;
  onRename?: (id: string, currentTitle: string) => void;
  onCopy?: (id: string) => void;
}

export function EditorView({ paneId, document, ancestors, workspaceName, onSave, onNavigate, onCommit, onSync, onReloadDocument, onDelete, onRename, onCopy }: EditorViewProps) {
  const { t } = useTranslation();
  const { isDirty, isSaving, lastSavedAt, setDirty, setSaving, setLastSavedAt } = useEditorStore();
  const { log, remoteChangePageId, remoteChangeAuthor, setRemoteChange } = useGitStore();
  const { autoSave, fontSize } = useSettingsStore();
  const editing = useTabStore((s) => s.getPaneEditing(paneId));
  const setPaneEditing = useTabStore((s) => s.setPaneEditing);
  const setEditing = useCallback((v: boolean) => setPaneEditing(paneId, v), [paneId, setPaneEditing]);
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [commitOpen, setCommitOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [tableActive, setTableActive] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [pageWidth,setPageWidth] = useState<'normal' | 'wide' | 'full'>('normal');
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docRef = useRef<Document | null>(null);
  const prevDocIdRef = useRef<string | undefined>(undefined);
  // Snapshot of body/tags when entering edit mode (for cancel to revert to)
  const originalBodyRef = useRef<string>('');
  const originalTagsRef = useRef<string[]>([]);

  // Track whether document content has been fully loaded into editor
  const contentLoadedRef = useRef(false);

  useEffect(() => {
    if (document) {
      const isDocChange = prevDocIdRef.current !== undefined && prevDocIdRef.current !== document.id;
      prevDocIdRef.current = document.id;

      // Cancel any pending auto-save from previous document
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      // Mark content as not yet loaded (prevent auto-save until user actually edits)
      contentLoadedRef.current = false;

      setBody(document.body);
      setTags(document.tags?.filter(t => !t.startsWith('__')) ?? []);
      docRef.current = document;
      setDirty(false);
      // Only reset editing when switching to a different document,
      // not on initial mount (preserves editing state across pane splits)
      if (isDocChange) {
        setEditing(false);
      }
      // Allow auto-save after a tick (once body state is applied)
      requestAnimationFrame(() => { contentLoadedRef.current = true; });
    }
  }, [document?.id]);

  // Draft save: file save only, stay in edit mode
  const handleDraftSave = useCallback(async () => {
    if (!docRef.current || !contentLoadedRef.current) return;
    setSaving(true);
    try {
      const updated = { ...docRef.current, body, tags };
      await onSave(updated);
      setDirty(false);
      setLastSavedAt(new Date().toISOString());
      // Update cancel snapshot so cancel reverts to last saved state, not edit-start state
      originalBodyRef.current = body;
      originalTagsRef.current = [...tags];
    } finally {
      setSaving(false);
    }
  }, [body, tags, onSave, setDirty, setSaving, setLastSavedAt]);

  // Publish: file save + commit + push, return to view mode
  const [publishing, setPublishing] = useState(false);
  const handlePublish = useCallback(async () => {
    if (!docRef.current) return;
    setPublishing(true);
    try {
      const updated = { ...docRef.current, body, tags };
      await onSave(updated);
      setDirty(false);
      setLastSavedAt(new Date().toISOString());
      const pageTitle = docRef.current?.title || docRef.current?.id || 'page';
      const commitMsg = `Update ${pageTitle}`;
      await onCommit(commitMsg);
      await onSync();
      setEditing(false);
    } catch {
      // commit/push failure is shown by toast from App, stay in edit mode
    } finally {
      setPublishing(false);
    }
  }, [body, tags, onSave, onCommit, onSync, setDirty, setLastSavedAt]);

  const handleCancelEdit = useCallback(() => {
    // Cancel any pending auto-save so it doesn't fire after cancel
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    // Restore the body/tags snapshot taken when edit mode was entered
    const restoredBody = originalBodyRef.current;
    const restoredTags = originalTagsRef.current;
    setBody(restoredBody);
    setTags(restoredTags);
    if (docRef.current) {
      docRef.current = { ...docRef.current, body: restoredBody, tags: restoredTags };
    }
    // If auto-save already persisted edits, re-save the original content to disk
    if (document && document.body !== restoredBody) {
      const restored = { ...document, body: restoredBody, tags: restoredTags };
      onSave(restored);
    }
    // Force-reset the TipTap editor content.
    // Suppress handleBodyUpdate by temporarily clearing contentLoadedRef
    // so the setContent → onUpdate → handleBodyUpdate chain doesn't re-dirty.
    if (editorInstance) {
      contentLoadedRef.current = false;
      editorInstance.commands.setContent(restoredBody);
      // Move cursor to start so no atom node (image/drawio) stays selected,
      // then blur since we're returning to view mode
      editorInstance.commands.setTextSelection(0);
      editorInstance.commands.blur();
    }
    setDirty(false);
    // Also directly clear tab dirty in case the subscription doesn't fire
    // (e.g. isDirty was already false due to a previous auto-save cycle)
    const activeDocId = useTabStore.getState().getActiveDocId();
    if (activeDocId) {
      useTabStore.getState().setTabDirty(activeDocId, false);
    }
    setEditing(false);
    // Re-enable content loaded after a tick
    requestAnimationFrame(() => { contentLoadedRef.current = true; });
  }, [document, setDirty, onSave, editorInstance]);

  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setDirty(true);
    if (!autoSave) return;
    saveTimerRef.current = setTimeout(() => {
      handleDraftSave();
    }, 2000);
  }, [handleDraftSave, setDirty, autoSave]);

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags(prev => [...prev, tag]);
      scheduleAutoSave();
    }
    setTagInput('');
  }, [tagInput, tags, scheduleAutoSave]);

  const handleRemoveTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  const handleBodyUpdate = (markdown: string) => {
    // Don't trigger auto-save if content hasn't fully loaded yet
    // (prevents overwriting file with empty/stale content on document switch)
    if (!contentLoadedRef.current) return;
    setBody(markdown);
    docRef.current = docRef.current ? { ...docRef.current, body: markdown } : null;
    scheduleAutoSave();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        handleDraftSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        setFindReplaceOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDraftSave]);

  useEffect(() => {
    const handleOpenCommit = () => {
      setCommitOpen(true);
    };
    window.addEventListener('open-commit-panel', handleOpenCommit);
    return () => window.removeEventListener('open-commit-panel', handleOpenCommit);
  }, []);

  useEffect(() => {
    const pageTitle = document?.title || document?.id || t('editor.untitled');
    const wsName = workspaceName || 'Knowledge Hub';
    window.document.title = `${pageTitle} - ${wsName} - Knowledge Hub`;
    return () => { window.document.title = 'Knowledge Hub'; };
  }, [document?.title, document?.id, workspaceName, t]);

  const handleEditorReady = useCallback((editor: Editor | null) => {
    setEditorInstance(editor);
  }, []);

  // Track whether cursor is inside a table for showing TableToolbar
  useEffect(() => {
    if (!editorInstance) return;
    const handleUpdate = () => {
      setTableActive(editorInstance.isActive('table'));
    };
    handleUpdate();
    editorInstance.on('selectionUpdate', handleUpdate);
    editorInstance.on('transaction', handleUpdate);
    return () => {
      editorInstance.off('selectionUpdate', handleUpdate);
      editorInstance.off('transaction', handleUpdate);
    };
  }, [editorInstance]);

  const showRemoteBanner = !!(document && remoteChangePageId === document.id && remoteChangeAuthor);

  const handleViewDiff = useCallback(() => {
    setHistoryOpen(true);
    setRemoteChange(null, null);
  }, [setRemoteChange]);

  const handleApplyRemoteChange = useCallback(() => {
    setRemoteChange(null, null);
    if (onReloadDocument) {
      onReloadDocument();
    }
  }, [setRemoteChange, onReloadDocument]);

  const handleDismissRemoteChange = useCallback(() => {
    setRemoteChange(null, null);
  }, [setRemoteChange]);

  const isFolder = document?.tags?.includes('__folder');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [moreMenuOpen]);

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary">
        <p>{t('editor.selectPage')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header bar: breadcrumb + actions */}
      {headerCollapsed ? (
        <div className="flex items-center justify-end pr-1 py-0.5 bg-bg-main border-b border-border">
          <Tooltip content={t('editor.toolbar.toggleHeader')}>
            <button
              onClick={() => { setHeaderCollapsed(false); setToolbarCollapsed(false); }}
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      ) : (
        <div className="flex items-center bg-bg-main min-w-0 border-b border-border">
          <div className="flex-1 flex flex-wrap items-center px-3 py-1.5 gap-y-1 min-w-0">
            <Breadcrumb ancestors={ancestors} current={document} onNavigate={onNavigate} className="flex-auto min-w-0" />
            <div className="flex flex-wrap items-center gap-1.5">
            {/* Page width toggle */}
            <div className="flex items-center rounded-md border border-border overflow-hidden flex-shrink-0">
              <Tooltip content={t('editor.toolbar.pageWidthNormal')}>
                <button
                  onClick={() => setPageWidth('normal')}
                  className={`w-7 h-7 flex items-center justify-center transition-colors ${pageWidth === 'normal' ? 'bg-sidebar-selected text-accent' : 'text-text-secondary hover:bg-bg-hover'}`}
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
              <Tooltip content={t('editor.toolbar.pageWidthWide')}>
                <button
                  onClick={() => setPageWidth('wide')}
                  className={`w-7 h-7 flex items-center justify-center transition-colors ${pageWidth === 'wide' ? 'bg-sidebar-selected text-accent' : 'text-text-secondary hover:bg-bg-hover'}`}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
              <Tooltip content={t('editor.toolbar.pageWidthFull')}>
                <button
                  onClick={() => setPageWidth('full')}
                  className={`w-7 h-7 flex items-center justify-center transition-colors ${pageWidth === 'full' ? 'bg-sidebar-selected text-accent' : 'text-text-secondary hover:bg-bg-hover'}`}
                >
                  <Maximize className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            </div>

            {/* Outline toggle */}
            <Tooltip content={t('editor.outline', 'Outline')}>
              <button
                onClick={() => setOutlineOpen(v => !v)}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors flex-shrink-0 ${outlineOpen ? 'bg-sidebar-selected text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            {/* History */}
            <Tooltip content={t('editor.history')}>
              <button
                onClick={() => setHistoryOpen(true)}
                className="w-7 h-7 flex items-center justify-center rounded-md transition-colors flex-shrink-0 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              >
                <History className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            {!isFolder && !editing && (
              <button
                onClick={() => {
                  // Snapshot current content so cancel can revert even after auto-save
                  originalBodyRef.current = body;
                  originalTagsRef.current = [...tags];
                  setEditing(true);
                }}
                className="px-4 py-1.5 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-hover transition-colors whitespace-nowrap flex-shrink-0"
              >
                {t('editor.edit', 'Edit')}
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 text-sm rounded-md border border-border text-text-primary hover:bg-bg-hover transition-colors whitespace-nowrap flex-shrink-0"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleDraftSave}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-sm rounded-md border border-border text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                >
                  {isSaving ? t('editor.saving') : t('editor.draftSave')}
                </button>
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="px-4 py-1.5 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                >
                  {publishing ? t('editor.publishing') : t('editor.publish')}
                </button>
              </>
            )}

            </div>
          </div>

          {/* Right column: More menu + collapse button */}
          <div className="flex flex-col items-center shrink-0 mr-1" ref={moreMenuRef}>
            <div className="relative">
              <button
                onClick={() => setMoreMenuOpen(v => !v)}
                className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {moreMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg shadow-lg border border-border bg-bg-main py-1">
                  {onRename && (
                    <button
                      onClick={() => { setMoreMenuOpen(false); onRename(document.id, document.title); }}
                      className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover transition-colors"
                    >
                      {t('common.rename')}
                    </button>
                  )}
                  {onCopy && (
                    <button
                      onClick={() => { setMoreMenuOpen(false); onCopy(document.id); }}
                      className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover transition-colors"
                    >
                      {t('common.duplicate')}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => { setMoreMenuOpen(false); onDelete(document.id, document.title, 0); }}
                      className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-bg-hover transition-colors"
                    >
                      {t('common.delete')}
                    </button>
                  )}
                </div>
              )}
            </div>
            <Tooltip content={t('editor.toolbar.toggleHeader')}>
              <button
                onClick={() => { setHeaderCollapsed(true); setToolbarCollapsed(true); }}
                className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {showRemoteBanner && (
        <RemoteChangeBanner
          author={remoteChangeAuthor!}
          onViewDiff={handleViewDiff}
          onApply={handleApplyRemoteChange}
          onDismiss={handleDismissRemoteChange}
        />
      )}

      {/* Toolbar only in edit mode */}
      {editing && !toolbarCollapsed && (
        <EditorToolbar editor={editorInstance} onCollapse={() => setToolbarCollapsed(true)} onOpenTagModal={() => setTagModalOpen(true)} tagCount={tags.length} />
      )}
      {editing && !toolbarCollapsed && tableActive && editorInstance && <TableToolbar editor={editorInstance} />}

      {/* Toolbar collapsed: thin expand bar (hidden when header is also collapsed to avoid double bars) */}
      {editing && toolbarCollapsed && !headerCollapsed && (
        <div className="flex items-center justify-end pr-1 py-0.5 border-b border-border bg-bg-main">
          <Tooltip content={t('editor.toolbar.toggleToolbar')}>
            <button
              onClick={() => setToolbarCollapsed(false)}
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <PanelTopOpen className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      )}

      {/* Find & Replace bar */}
      {editorInstance && (
        <FindReplace
          editor={editorInstance}
          isOpen={findReplaceOpen}
          onClose={() => setFindReplaceOpen(false)}
        />
      )}

      {/* Tag modal */}
      {tagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setTagModalOpen(false)}>
          <div className="bg-bg-main border border-border rounded-lg shadow-xl w-80 p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">{t('editor.tags')}</h3>
              <button onClick={() => setTagModalOpen(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Existing tags */}
            <div className="flex flex-wrap gap-1.5 mb-3 min-h-[28px]">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-sidebar-selected text-accent whitespace-nowrap">
                  # {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="hover:text-danger transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {tags.length === 0 && (
                <span className="text-xs text-text-secondary">{t('editor.noTags')}</span>
              )}
            </div>
            {/* Add tag input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
                  if (e.key === 'Escape') { setTagModalOpen(false); }
                }}
                placeholder={t('editor.addTag')}
                className="flex-1 text-sm px-2.5 py-1.5 rounded-md border border-border bg-bg-main text-text-primary placeholder:text-text-secondary outline-none focus:border-accent"
                autoFocus
              />
              <button
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
                className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-40"
              >
                {t('common.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor / Viewer + Outline */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div data-editor-scroll className={`flex-1 overflow-y-auto relative editor-width-${pageWidth}`} style={{ fontSize: `${fontSize}px` }}>
          <MarkdownEditor
            content={body}
            onUpdate={handleBodyUpdate}
            onNavigate={onNavigate}
            onEditorReady={handleEditorReady}
            editable={editing}
          />
          {!editing && <BacklinksSection pageId={document.id} onNavigate={onNavigate} />}
        </div>
        {outlineOpen && (
          <div className="shrink-0 w-52">
            <OutlineSidebar editor={editorInstance} onClose={() => setOutlineOpen(false)} />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 text-xs text-text-secondary border-t border-border bg-bg-statusbar">
        <div className="flex items-center gap-3">
          {editing && (
            <span>
              {isSaving ? t('editor.saving') : isDirty ? t('editor.unsaved') : t('editor.saved')}
            </span>
          )}
          <GitStatusBar
            onCommit={() => setCommitOpen(true)}
            onSync={onSync}
          />
        </div>
        <div className="flex items-center gap-3">
          {lastSavedAt && (
            <span>{new Date(lastSavedAt).toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      <CommitPanel
        isOpen={commitOpen}
        onClose={() => setCommitOpen(false)}
        onCommit={onCommit}
      />
      <HistoryPanel
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entries={log}
        pageTitle={document.title}
        filepath={`${document.id}.md`}
      />
    </div>
  );
}
