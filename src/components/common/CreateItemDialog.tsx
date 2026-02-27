import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocumentMeta } from '../../core/models/Document';

interface CreateItemDialogProps {
  isOpen: boolean;
  mode: 'page' | 'folder';
  documents: DocumentMeta[];
  onConfirm: (name: string, parentFolder: string | null) => void;
  onCancel: () => void;
}

export function CreateItemDialog({ isOpen, mode, documents, onConfirm, onCancel }: CreateItemDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [parentFolder, setParentFolder] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Collect all folder paths from documents
  const folders = useMemo(() => {
    const folderSet = new Set<string>();
    for (const doc of documents) {
      if (doc.tags?.includes('__folder')) {
        folderSet.add(doc.id);
      }
      // Also add parent paths of all documents
      if (doc.parent) {
        folderSet.add(doc.parent);
      }
    }
    // Add "pages" folder as a default option
    folderSet.add('pages');
    return Array.from(folderSet).sort();
  }, [documents]);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setParentFolder(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      onConfirm(trimmed, parentFolder);
    }
  };

  if (!isOpen) return null;

  const title = mode === 'page' ? t('createItem.newPage') : t('createItem.newFolder');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-bg-main rounded-lg shadow-xl border border-border p-6 max-w-sm w-full mx-4">
        <h3 className="text-base font-semibold text-text-primary mb-4">
          {title}
        </h3>
        <form onSubmit={handleSubmit}>
          {/* Name / Title input */}
          <label className="block text-sm text-text-secondary mb-1">
            {mode === 'page' ? t('createItem.pageTitle') : t('createItem.folderName')}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-bg-main text-text-primary outline-none focus:border-accent mb-4"
            placeholder={mode === 'page' ? t('editor.untitled') : t('createItem.folderNamePlaceholder')}
          />

          {/* Location select */}
          <label className="block text-sm text-text-secondary mb-1">
            {t('createItem.location')}
          </label>
          <select
            value={parentFolder ?? ''}
            onChange={(e) => setParentFolder(e.target.value || null)}
            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-bg-main text-text-primary outline-none focus:border-accent mb-4"
          >
            <option value="">/ ({t('createItem.root')})</option>
            {folders.map((folder) => (
              <option key={folder} value={folder}>
                /{folder}
              </option>
            ))}
          </select>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded-md text-text-primary hover:bg-bg-hover transition-colors border border-border"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm rounded-md bg-accent text-white hover:opacity-90 transition-colors disabled:opacity-50"
            >
              {t('createItem.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
