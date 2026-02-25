import { useState, useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { MarkdownEditor } from './MarkdownEditor';
import { EditorToolbar } from './EditorToolbar';
import { RemoteChangeBanner } from './RemoteChangeBanner';
import { Breadcrumb } from '../common/Breadcrumb';
import { GitStatusBar } from '../git/GitStatusBar';
import { CommitPanel } from '../git/CommitPanel';
import { HistoryPanel } from '../git/HistoryPanel';
import { useEditorStore } from '../../stores/editorStore';
import { useGitStore } from '../../stores/gitStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Document, DocumentMeta } from '../../core/models/Document';

interface EditorViewProps {
  document: Document | null;
  ancestors: DocumentMeta[];
  workspaceName?: string;
  onSave: (doc: Document) => Promise<void>;
  onNavigate: (id: string) => void;
  onCommit: (message: string) => Promise<void>;
  onSync: () => Promise<void>;
  onReloadDocument?: () => void;
}

export function EditorView({ document, ancestors, workspaceName, onSave, onNavigate, onCommit, onSync, onReloadDocument }: EditorViewProps) {
  const { t } = useTranslation();
  const { isDirty, isSaving, lastSavedAt, setDirty, setSaving, setLastSavedAt } = useEditorStore();
  const { log, remoteChangePageId, remoteChangeAuthor, clearRemoteChange } = useGitStore();
  const { autoSave, fontSize } = useSettingsStore();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [commitOpen, setCommitOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docRef = useRef<Document | null>(null);

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setBody(document.body);
      docRef.current = document;
      setDirty(false);
    }
  }, [document?.id]);

  const doSave = useCallback(async () => {
    if (!docRef.current) return;
    setSaving(true);
    try {
      const updated = { ...docRef.current, title, body };
      await onSave(updated);
      setDirty(false);
      setLastSavedAt(new Date().toISOString());
    } finally {
      setSaving(false);
    }
  }, [title, body, onSave, setDirty, setSaving, setLastSavedAt]);

  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setDirty(true);
    if (!autoSave) return;
    saveTimerRef.current = setTimeout(() => {
      doSave();
    }, 2000);
  }, [doSave, setDirty, autoSave]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    scheduleAutoSave();
  };

  const handleBodyUpdate = (markdown: string) => {
    setBody(markdown);
    docRef.current = docRef.current ? { ...docRef.current, body: markdown } : null;
    scheduleAutoSave();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doSave]);

  // Listen for Ctrl+Shift+S (open-commit-panel) custom event from App
  useEffect(() => {
    const handleOpenCommit = () => {
      setCommitOpen(true);
    };
    window.addEventListener('open-commit-panel', handleOpenCommit);
    return () => window.removeEventListener('open-commit-panel', handleOpenCommit);
  }, []);

  // Update window title: "{pageTitle} - {workspaceName} - Knowledge Hub"
  useEffect(() => {
    const pageTitle = title || t('editor.untitled');
    const wsName = workspaceName || 'Knowledge Hub';
    window.document.title = `${pageTitle} - ${wsName} - Knowledge Hub`;
    return () => { window.document.title = 'Knowledge Hub'; };
  }, [title, workspaceName, t]);

  const handleEditorReady = useCallback((editor: Editor | null) => {
    setEditorInstance(editor);
  }, []);

  // Remote change banner: show when the current page was updated remotely
  const showRemoteBanner = !!(document && remoteChangePageId === document.id && remoteChangeAuthor);

  const handleViewDiff = useCallback(() => {
    setHistoryOpen(true);
    clearRemoteChange();
  }, [clearRemoteChange]);

  const handleApplyRemoteChange = useCallback(() => {
    clearRemoteChange();
    if (onReloadDocument) {
      onReloadDocument();
    }
  }, [clearRemoteChange, onReloadDocument]);

  const handleDismissRemoteChange = useCallback(() => {
    clearRemoteChange();
  }, [clearRemoteChange]);

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-secondary)]">
        <p>{t('editor.selectPage')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <Breadcrumb ancestors={ancestors} current={document} onNavigate={onNavigate} />
      {showRemoteBanner && (
        <RemoteChangeBanner
          author={remoteChangeAuthor!}
          onViewDiff={handleViewDiff}
          onApply={handleApplyRemoteChange}
          onDismiss={handleDismissRemoteChange}
        />
      )}
      <EditorToolbar editor={editorInstance} />

      {/* Title */}
      <div className="max-w-[800px] mx-auto w-full px-4 pt-6">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder={t('editor.untitled')}
          className="w-full text-3xl font-bold bg-transparent border-none outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
        />
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto" style={{ fontSize: `${fontSize}px` }}>
        <MarkdownEditor content={body} onUpdate={handleBodyUpdate} onNavigate={onNavigate} onEditorReady={handleEditorReady} />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 text-xs text-[var(--color-text-secondary)] border-t border-[var(--color-border)] bg-[var(--color-bg-sidebar)]">
        <div className="flex items-center gap-3">
          <span>
            {isSaving ? t('editor.saving') : isDirty ? t('editor.unsaved') : t('editor.saved')}
          </span>
          <GitStatusBar
            onCommit={() => setCommitOpen(true)}
            onSync={onSync}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setHistoryOpen(true)}
            className="hover:text-[var(--color-accent)] transition-colors"
          >
            {t('editor.history')}
          </button>
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
        filepath={`pages/${document.id}.md`}
      />
    </div>
  );
}
