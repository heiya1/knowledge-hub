import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;

  const confirmBtnClass = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-[var(--color-accent)] hover:opacity-90 text-white';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative bg-[var(--color-bg-main)] rounded-lg shadow-xl border border-[var(--color-border)] p-6 max-w-sm w-full mx-4"
      >
        <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
          {title}
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors border border-[var(--color-border)]"
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${confirmBtnClass}`}
          >
            {confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
