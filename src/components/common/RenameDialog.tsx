import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface RenameDialogProps {
  isOpen: boolean;
  currentTitle: string;
  onConfirm: (newTitle: string) => void;
  onCancel: () => void;
  dialogTitle?: string;
  dialogLabel?: string;
  allowSameValue?: boolean;
}

export function RenameDialog({ isOpen, currentTitle, onConfirm, onCancel, dialogTitle, dialogLabel, allowSameValue }: RenameDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(currentTitle);
      // Focus and select text after render
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, currentTitle]);

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
    const trimmed = title.trim();
    if (trimmed && (allowSameValue || trimmed !== currentTitle)) {
      onConfirm(trimmed);
    } else {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-bg-main rounded-lg shadow-xl border border-border p-6 max-w-sm w-full mx-4">
        <h3 className="text-base font-semibold text-text-primary mb-2">
          {dialogTitle || t('common.rename')}
        </h3>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm text-text-secondary mb-2">
            {dialogLabel || t('sidebar.renamePrompt')}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-bg-main text-text-primary outline-none focus:border-accent mb-4"
            placeholder={t('editor.untitled')}
          />
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
              className="px-4 py-2 text-sm rounded-md bg-accent text-white hover:opacity-90 transition-colors"
            >
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
