import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface RenameDialogProps {
  isOpen: boolean;
  currentTitle: string;
  onConfirm: (newTitle: string) => void;
  onCancel: () => void;
}

export function RenameDialog({ isOpen, currentTitle, onConfirm, onCancel }: RenameDialogProps) {
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
    if (trimmed && trimmed !== currentTitle) {
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
      <div className="relative bg-[var(--color-bg-main)] rounded-lg shadow-xl border border-[var(--color-border)] p-6 max-w-sm w-full mx-4">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
          {t('common.rename')}
        </h3>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
            {t('sidebar.renamePrompt')}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] mb-4"
            placeholder={t('editor.untitled')}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded-md text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors border border-[var(--color-border)]"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded-md bg-[var(--color-accent)] text-white hover:opacity-90 transition-colors"
            >
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
