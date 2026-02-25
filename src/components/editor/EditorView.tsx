import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MarkdownEditor } from './MarkdownEditor';
import { EditorToolbar } from './EditorToolbar';
import { Breadcrumb } from '../common/Breadcrumb';
import { useEditorStore } from '../../stores/editorStore';
import type { Document, DocumentMeta } from '../../core/models/Document';

interface EditorViewProps {
  document: Document | null;
  ancestors: DocumentMeta[];
  onSave: (doc: Document) => Promise<void>;
  onNavigate: (id: string) => void;
}

export function EditorView({ document, ancestors, onSave, onNavigate }: EditorViewProps) {
  const { t } = useTranslation();
  const { isDirty, isSaving, lastSavedAt, setDirty, setSaving, setLastSavedAt } = useEditorStore();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
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
    saveTimerRef.current = setTimeout(() => {
      doSave();
    }, 2000);
  }, [doSave, setDirty]);

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
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doSave]);

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-secondary)]">
        <p>{t('editor.selectPage')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Breadcrumb ancestors={ancestors} current={document} onNavigate={onNavigate} />
      <EditorToolbar editor={null} />

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
      <div className="flex-1 overflow-y-auto">
        <MarkdownEditor content={body} onUpdate={handleBodyUpdate} onNavigate={onNavigate} />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 text-xs text-[var(--color-text-secondary)] border-t border-[var(--color-border)] bg-[var(--color-bg-sidebar)]">
        <span>
          {isSaving ? t('editor.saving') : isDirty ? t('editor.unsaved') : t('editor.saved')}
        </span>
        {lastSavedAt && (
          <span>{new Date(lastSavedAt).toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}
